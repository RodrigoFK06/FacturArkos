import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  CreateCategoryDto,
  CreatePriceListDto,
  CreateProductDto,
  SetPricesDto,
  UpdateCategoryDto,
  UpdatePriceListDto,
  UpdateProductDto,
} from './dto';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Productos ──
  // includeInactive: la gestión del catálogo (panel admin) ve también los ocultos
  // para poder reactivarlos; el POS/tienda usa el default (solo activos).
  // priceListId: si viene, sobre-escribe el precio de cada producto con el de esa
  // lista (cae al precio base cuando el producto no tiene precio especial).
  async listProducts(
    organizationId: string,
    q?: string,
    includeInactive = false,
    priceListId?: string,
  ) {
    const products = await this.prisma.product.findMany({
      where: {
        organizationId,
        ...(includeInactive ? {} : { active: true }),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { code: { contains: q, mode: 'insensitive' } },
                { barcode: { contains: q } },
              ],
            }
          : {}),
      },
      include: {
        category: true,
        ...(priceListId ? { prices: { where: { priceListId } } } : {}),
      },
      orderBy: { name: 'asc' },
      take: 50,
    });
    if (!priceListId) return products;
    return products.map((p) => {
      const { prices, ...rest } = p as typeof p & { prices?: { price: unknown }[] };
      return { ...rest, price: prices && prices.length ? prices[0].price : p.price };
    });
  }

  /** Búsqueda exacta por código de barras (RF-POS-001). */
  async findByBarcode(organizationId: string, barcode: string) {
    const p = await this.prisma.product.findFirst({
      where: { organizationId, barcode, active: true },
    });
    if (!p) throw new NotFoundException('Producto no encontrado');
    return p;
  }

  async getProduct(organizationId: string, id: string) {
    const p = await this.prisma.product.findFirst({ where: { id, organizationId } });
    if (!p) throw new NotFoundException('Producto no encontrado');
    return p;
  }

  async createProduct(organizationId: string, dto: CreateProductDto) {
    try {
      return await this.prisma.product.create({ data: { organizationId, ...dto } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Ya existe un producto con ese código');
      }
      throw e;
    }
  }

  async updateProduct(organizationId: string, id: string, dto: UpdateProductDto) {
    await this.getProduct(organizationId, id);
    return this.prisma.product.update({ where: { id }, data: dto });
  }

  // ── Categorías ──
  listCategories(organizationId: string, includeInactive = false) {
    return this.prisma.category.findMany({
      where: { organizationId, ...(includeInactive ? {} : { active: true }) },
      orderBy: { name: 'asc' },
    });
  }

  async createCategory(organizationId: string, dto: CreateCategoryDto) {
    try {
      return await this.prisma.category.create({ data: { organizationId, name: dto.name } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Ya existe una categoría con ese nombre');
      }
      throw e;
    }
  }

  async updateCategory(organizationId: string, id: string, dto: UpdateCategoryDto) {
    const cat = await this.prisma.category.findFirst({ where: { id, organizationId } });
    if (!cat) throw new NotFoundException('Categoría no encontrada');
    try {
      return await this.prisma.category.update({ where: { id }, data: dto });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Ya existe una categoría con ese nombre');
      }
      throw e;
    }
  }

  // ── Listas de precios (ej. menudeo / mayorista) ──
  listPriceLists(organizationId: string) {
    return this.prisma.priceList.findMany({
      where: { organizationId },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  async createPriceList(organizationId: string, dto: CreatePriceListDto) {
    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.priceList.updateMany({ where: { organizationId }, data: { isDefault: false } });
      }
      try {
        return await tx.priceList.create({
          data: { organizationId, name: dto.name, isDefault: dto.isDefault ?? false },
        });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          throw new ConflictException('Ya existe una lista de precios con ese nombre');
        }
        throw e;
      }
    });
  }

  async updatePriceList(organizationId: string, id: string, dto: UpdatePriceListDto) {
    const pl = await this.prisma.priceList.findFirst({ where: { id, organizationId } });
    if (!pl) throw new NotFoundException('Lista de precios no encontrada');
    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.priceList.updateMany({
          where: { organizationId, NOT: { id } },
          data: { isDefault: false },
        });
      }
      try {
        return await tx.priceList.update({
          where: { id },
          data: { name: dto.name ?? undefined, isDefault: dto.isDefault ?? undefined },
        });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          throw new ConflictException('Ya existe una lista de precios con ese nombre');
        }
        throw e;
      }
    });
  }

  /** Productos activos con su precio en la lista (listPrice = null cuando usa el base). */
  async listPrices(organizationId: string, priceListId: string) {
    const pl = await this.prisma.priceList.findFirst({ where: { id: priceListId, organizationId } });
    if (!pl) throw new NotFoundException('Lista de precios no encontrada');
    const products = await this.prisma.product.findMany({
      where: { organizationId, active: true },
      include: { prices: { where: { priceListId } } },
      orderBy: { name: 'asc' },
    });
    return products.map((p) => ({
      productId: p.id,
      name: p.name,
      code: p.code,
      basePrice: p.price,
      listPrice: p.prices.length ? p.prices[0].price : null,
    }));
  }

  /** Fija (upsert) o elimina (precio ≤ 0) los precios especiales de la lista. */
  async setPrices(organizationId: string, priceListId: string, dto: SetPricesDto) {
    const pl = await this.prisma.priceList.findFirst({ where: { id: priceListId, organizationId } });
    if (!pl) throw new NotFoundException('Lista de precios no encontrada');
    const ids = dto.prices.map((r) => r.productId);
    const owned = await this.prisma.product.findMany({
      where: { organizationId, id: { in: ids } },
      select: { id: true },
    });
    const ownedSet = new Set(owned.map((p) => p.id));
    let applied = 0;
    for (const row of dto.prices) {
      if (!ownedSet.has(row.productId)) continue;
      if (row.price > 0) {
        await this.prisma.productPrice.upsert({
          where: { productId_priceListId: { productId: row.productId, priceListId } },
          create: { productId: row.productId, priceListId, price: row.price },
          update: { price: row.price },
        });
      } else {
        await this.prisma.productPrice.deleteMany({ where: { productId: row.productId, priceListId } });
      }
      applied++;
    }
    return { ok: true, applied };
  }
}
