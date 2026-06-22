import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  CreateCategoryDto,
  CreateProductDto,
  UpdateCategoryDto,
  UpdateProductDto,
} from './dto';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Productos ──
  // includeInactive: la gestión del catálogo (panel admin) ve también los ocultos
  // para poder reactivarlos; el POS/tienda usa el default (solo activos).
  listProducts(organizationId: string, q?: string, includeInactive = false) {
    return this.prisma.product.findMany({
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
      include: { category: true },
      orderBy: { name: 'asc' },
      take: 50,
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
}
