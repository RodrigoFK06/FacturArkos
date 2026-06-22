import { Injectable, NotFoundException } from '@nestjs/common';
import { PurchaseStatus, StockMovementType } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { limaDateString } from '../common/utils/lima-time';
import { IGV_RATE, round2 } from '../common/utils/money';
import { InventoryService } from '../inventory/inventory.service';
import { CreatePurchaseDto, CreateSupplierDto, UpdateSupplierDto } from './dto';

@Injectable()
export class PurchasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {}

  // ── Proveedores ──
  listSuppliers(organizationId: string, q?: string, includeInactive = false) {
    return this.prisma.supplier.findMany({
      where: {
        organizationId,
        ...(includeInactive ? {} : { active: true }),
        ...(q
          ? { OR: [{ businessName: { contains: q, mode: 'insensitive' } }, { ruc: { contains: q } }] }
          : {}),
      },
      orderBy: { businessName: 'asc' },
    });
  }

  createSupplier(organizationId: string, dto: CreateSupplierDto) {
    return this.prisma.supplier.upsert({
      where: { organizationId_ruc: { organizationId, ruc: dto.ruc } },
      create: { organizationId, ...dto },
      update: {
        businessName: dto.businessName,
        address: dto.address,
        phone: dto.phone,
        email: dto.email,
      },
    });
  }

  async updateSupplier(organizationId: string, id: string, dto: UpdateSupplierDto) {
    const supplier = await this.prisma.supplier.findFirst({ where: { id, organizationId } });
    if (!supplier) throw new NotFoundException('Proveedor no encontrado');
    return this.prisma.supplier.update({ where: { id }, data: dto });
  }

  // ── Compras ──
  listPurchases(organizationId: string) {
    return this.prisma.purchase.findMany({
      where: { organizationId },
      include: { supplier: true, items: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  /**
   * Registra una compra y recibe la mercadería: crea movimientos PURCHASE_IN y
   * actualiza el costo promedio ponderado de cada producto, en una transacción.
   */
  async createPurchase(organizationId: string, dto: CreatePurchaseDto) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: dto.supplierId, organizationId },
    });
    if (!supplier) throw new NotFoundException('Proveedor no encontrado');
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id: dto.warehouseId, organizationId },
    });
    if (!warehouse) throw new NotFoundException('Almacén no encontrado');

    const items = dto.items.map((it) => ({ ...it, total: round2(it.quantity * it.unitCost) }));
    const subtotal = round2(items.reduce((a, i) => a + i.total, 0));
    const igv = round2(subtotal * IGV_RATE);
    const total = round2(subtotal + igv);
    const issueDate = dto.issueDate ?? limaDateString();

    return this.prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.create({
        data: {
          organizationId,
          supplierId: dto.supplierId,
          warehouseId: dto.warehouseId,
          documentType: dto.documentType,
          series: dto.series,
          number: dto.number,
          issueDate,
          subtotal,
          igv,
          total,
          note: dto.note,
          status: PurchaseStatus.RECEIVED,
          items: {
            create: items.map((i) => ({
              productId: i.productId ?? null,
              name: i.name,
              quantity: i.quantity,
              unitCost: i.unitCost,
              total: i.total,
            })),
          },
        },
        include: { items: true, supplier: true },
      });

      for (const i of items) {
        if (!i.productId) continue;
        const product = await tx.product.findFirst({
          where: { id: i.productId, organizationId },
        });
        if (product?.tracksStock) {
          await this.inventory.updateAverageCost(tx, i.productId, i.quantity, i.unitCost);
          await this.inventory.applyStock(
            tx,
            organizationId,
            i.productId,
            dto.warehouseId,
            i.quantity,
            StockMovementType.PURCHASE_IN,
            i.unitCost,
            `PURCHASE:${purchase.id}`,
          );
        }
      }

      return purchase;
    });
  }
}
