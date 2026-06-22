import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StockMovementType } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { round2, round4, weightedAverageCost } from '../common/utils/money';
import {
  CreateLotDto,
  CreateWarehouseDto,
  MovementDto,
  TransferDto,
  UpdateWarehouseDto,
} from './dto';

const round3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;

const IN_TYPES: StockMovementType[] = [
  StockMovementType.INITIAL,
  StockMovementType.PURCHASE_IN,
  StockMovementType.TRANSFER_IN,
  StockMovementType.ADJUST_IN,
  StockMovementType.RETURN_IN,
];

type Tx = Prisma.TransactionClient;

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Almacenes ──
  listWarehouses(organizationId: string, includeInactive = false) {
    return this.prisma.warehouse.findMany({
      where: { organizationId, ...(includeInactive ? {} : { active: true }) },
      orderBy: { name: 'asc' },
    });
  }

  createWarehouse(organizationId: string, dto: CreateWarehouseDto) {
    return this.prisma.warehouse.create({
      data: { organizationId, name: dto.name, isMain: dto.isMain ?? false },
    });
  }

  async updateWarehouse(organizationId: string, id: string, dto: UpdateWarehouseDto) {
    const wh = await this.prisma.warehouse.findFirst({ where: { id, organizationId } });
    if (!wh) throw new NotFoundException('Almacén no encontrado');
    if (wh.isMain && dto.active === false) {
      throw new BadRequestException('No puedes desactivar el almacén principal');
    }
    return this.prisma.warehouse.update({ where: { id }, data: dto });
  }

  // ── Stock ──
  listStock(organizationId: string, warehouseId?: string) {
    return this.prisma.stock.findMany({
      where: { product: { organizationId }, ...(warehouseId ? { warehouseId } : {}) },
      include: { product: { select: { id: true, name: true, code: true, unitCode: true } }, warehouse: true },
      orderBy: { product: { name: 'asc' } },
    });
  }

  /** Aplica delta de stock + registra el movimiento. Reutilizable bajo transacción. */
  async applyStock(
    tx: Tx,
    organizationId: string,
    productId: string,
    warehouseId: string,
    signedQty: number,
    type: StockMovementType,
    unitCost?: number,
    reference?: string,
  ) {
    await tx.stock.upsert({
      where: { productId_warehouseId: { productId, warehouseId } },
      create: { productId, warehouseId, quantity: new Prisma.Decimal(signedQty) },
      update: { quantity: { increment: signedQty } },
    });
    await tx.stockMovement.create({
      data: {
        organizationId,
        productId,
        warehouseId,
        type,
        quantity: Math.abs(signedQty),
        unitCost: unitCost ?? null,
        reference,
      },
    });
  }

  /** Costo promedio ponderado del producto ante una entrada (antes de sumar stock). */
  async updateAverageCost(tx: Tx, productId: string, inQty: number, inCost: number) {
    const product = await tx.product.findUnique({ where: { id: productId } });
    if (!product) return;
    const stocks = await tx.stock.findMany({ where: { productId } });
    const currentQty = stocks.reduce((a, s) => a + Number(s.quantity), 0);
    const newCost = weightedAverageCost(currentQty, Number(product.cost), inQty, inCost);
    await tx.product.update({ where: { id: productId }, data: { cost: newCost } });
  }

  async createMovement(organizationId: string, dto: MovementDto) {
    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, organizationId },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');
    const type = StockMovementType[dto.type];
    const sign = IN_TYPES.includes(type) ? 1 : -1;

    return this.prisma.$transaction(async (tx) => {
      if (sign === 1 && dto.unitCost != null) {
        await this.updateAverageCost(tx, dto.productId, dto.quantity, dto.unitCost);
      }
      await this.applyStock(
        tx,
        organizationId,
        dto.productId,
        dto.warehouseId,
        sign * dto.quantity,
        type,
        dto.unitCost,
        dto.reference,
      );
      return tx.stock.findUnique({
        where: { productId_warehouseId: { productId: dto.productId, warehouseId: dto.warehouseId } },
      });
    });
  }

  async transfer(organizationId: string, dto: TransferDto) {
    if (dto.fromWarehouseId === dto.toWarehouseId) {
      throw new BadRequestException('El almacén origen y destino deben ser distintos');
    }
    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, organizationId },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');

    return this.prisma.$transaction(async (tx) => {
      await this.applyStock(
        tx, organizationId, dto.productId, dto.fromWarehouseId, -dto.quantity,
        StockMovementType.TRANSFER_OUT, undefined, dto.reference,
      );
      await this.applyStock(
        tx, organizationId, dto.productId, dto.toWarehouseId, dto.quantity,
        StockMovementType.TRANSFER_IN, undefined, dto.reference,
      );
      return { ok: true };
    });
  }

  /** Kardex valorizado por promedio ponderado (RF-INV-008). */
  async kardex(organizationId: string, productId: string, warehouseId?: string) {
    const movements = await this.prisma.stockMovement.findMany({
      where: { organizationId, productId, ...(warehouseId ? { warehouseId } : {}) },
      orderBy: { createdAt: 'asc' },
    });

    let qty = 0;
    let avgCost = 0;
    const rows = movements.map((m) => {
      const q = Number(m.quantity);
      const isIn = IN_TYPES.includes(m.type);
      const unitCost = m.unitCost != null ? Number(m.unitCost) : avgCost;
      if (isIn) {
        avgCost = weightedAverageCost(qty, avgCost, q, unitCost);
        qty = qty + q;
      } else {
        qty = qty - q;
      }
      return {
        id: m.id,
        date: m.createdAt,
        type: m.type,
        in: isIn ? q : 0,
        out: isIn ? 0 : q,
        balance: round3(qty),
        unitCost: round4(avgCost),
        value: round2(qty * avgCost),
      };
    });

    return { productId, balance: round3(qty), avgCost: round4(avgCost), value: round2(qty * avgCost), rows };
  }

  // ── Alertas ──
  async lowStockAlerts(organizationId: string) {
    const products = await this.prisma.product.findMany({
      where: { organizationId, tracksStock: true, active: true },
      include: { stocks: true },
    });
    return products
      .map((p) => {
        const stock = round3(p.stocks.reduce((a, s) => a + Number(s.quantity), 0));
        return { id: p.id, name: p.name, stock, minStock: Number(p.minStock) };
      })
      .filter((p) => p.stock <= p.minStock);
  }

  async expiringLots(organizationId: string, days = 30) {
    const limit = new Date(Date.now() + days * 86_400_000);
    return this.prisma.lot.findMany({
      where: { organizationId, quantity: { gt: 0 }, expirationDate: { not: null, lte: limit } },
      include: { product: { select: { id: true, name: true } } },
      orderBy: { expirationDate: 'asc' },
    });
  }

  // ── Lotes (registro para alertas de vencimiento) ──
  listLots(organizationId: string, productId?: string) {
    return this.prisma.lot.findMany({
      where: { organizationId, ...(productId ? { productId } : {}) },
      orderBy: { expirationDate: 'asc' },
    });
  }

  createLot(organizationId: string, dto: CreateLotDto) {
    return this.prisma.lot.create({
      data: {
        organizationId,
        productId: dto.productId,
        warehouseId: dto.warehouseId,
        code: dto.code,
        expirationDate: dto.expirationDate ? new Date(dto.expirationDate) : null,
        quantity: dto.quantity,
      },
    });
  }
}
