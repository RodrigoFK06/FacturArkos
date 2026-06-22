import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CashMovementType,
  CashSessionStatus,
  FulfillmentStatus,
  IgvAffectation,
  InvoiceStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  Product,
  SaleType,
  StockMovementType,
} from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { decomposeIgv, round2 } from '../common/utils/money';
import { InvoicesService } from '../invoices/invoices.service';
import { BulkSaleDto, CreateSaleDto } from './dto';
import { DocIdentityType, DocumentType } from '@prisma/client';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoices: InvoicesService,
  ) {}

  /**
   * Registra una venta: calcula totales (IGV descompuesto desde el total cobrado),
   * descuenta stock y registra el ingreso en caja, todo en una transacción. La
   * emisión del comprobante (opcional) corre fuera, con su propio outbox-lite.
   */
  async createSale(organizationId: string, userId: string, dto: CreateSaleDto) {
    // Cargar productos referenciados para defaults (afectación, unidad, código SUNAT).
    const productIds = dto.items.map((i) => i.productId).filter((id): id is string => !!id);
    const products = productIds.length
      ? await this.prisma.product.findMany({ where: { organizationId, id: { in: productIds } } })
      : [];
    const pmap = new Map<string, Product>(products.map((p) => [p.id, p]));

    const lines = dto.items.map((it) => {
      const p = it.productId ? pmap.get(it.productId) : undefined;
      if (it.productId && !p) throw new BadRequestException(`Producto ${it.productId} no existe`);
      const igvAffectation: IgvAffectation = it.igvAffectation ?? p?.igvAffectation ?? IgvAffectation.GRAVADO;
      const unitCode = it.unitCode ?? p?.unitCode ?? 'NIU';
      const name = it.name ?? p?.name ?? 'Ítem';
      const discount = round2(it.discount ?? 0);
      const lineTotal = round2(it.quantity * it.unitPrice - discount);
      const { base, igv } =
        igvAffectation === IgvAffectation.GRAVADO ? decomposeIgv(lineTotal) : { base: lineTotal, igv: 0 };
      return {
        product: p,
        productId: it.productId,
        name,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        discount,
        lineTotal,
        base,
        igv,
        igvAffectation,
        unitCode,
        sunatProductCode: it.sunatProductCode ?? p?.sunatProductCode ?? null,
      };
    });

    const subtotal = round2(lines.reduce((a, l) => a + l.base, 0));
    const igv = round2(lines.reduce((a, l) => a + l.igv, 0));
    const discount = round2(lines.reduce((a, l) => a + l.discount, 0));
    const total = round2(lines.reduce((a, l) => a + l.lineTotal, 0));

    const paid = round2((dto.payments ?? []).reduce((a, p) => a + p.amount, 0));
    const status =
      dto.payments && dto.payments.length > 0 && paid >= total
        ? OrderStatus.PAID
        : OrderStatus.PENDING_PAYMENT;

    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          organizationId,
          establishmentId: dto.establishmentId,
          customerId: dto.customerId ?? null,
          cashSessionId: dto.cashSessionId ?? null,
          userId,
          saleType: dto.saleType ?? undefined,
          status,
          subtotal,
          discount,
          igv,
          total,
          note: dto.note,
          detraction: !!dto.detraction,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          paidAt: status === OrderStatus.PAID ? new Date() : null,
          items: {
            create: lines.map((l) => ({
              productId: l.productId ?? null,
              name: l.name,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              unitCost: l.product ? Number(l.product.cost) : 0,
              discount: l.discount,
              total: l.lineTotal,
              igvAffectation: l.igvAffectation,
              unitCode: l.unitCode,
              sunatProductCode: l.sunatProductCode,
            })),
          },
          payments: dto.payments?.length
            ? {
                create: dto.payments.map((p) => ({
                  organizationId,
                  method: p.method,
                  amount: p.amount,
                  status: PaymentStatus.APPROVED,
                })),
              }
            : undefined,
        },
        include: { items: true, payments: true },
      });

      // Descuento de stock (productos que controlan stock) en el almacén principal.
      const warehouse =
        (await tx.warehouse.findFirst({ where: { organizationId, isMain: true } })) ??
        (await tx.warehouse.findFirst({ where: { organizationId } }));
      if (warehouse) {
        for (const l of lines) {
          if (l.product?.tracksStock) {
            await tx.stock.upsert({
              where: { productId_warehouseId: { productId: l.product.id, warehouseId: warehouse.id } },
              create: {
                productId: l.product.id,
                warehouseId: warehouse.id,
                quantity: new Prisma.Decimal(-l.quantity),
              },
              update: { quantity: { decrement: l.quantity } },
            });
            await tx.stockMovement.create({
              data: {
                organizationId,
                productId: l.product.id,
                warehouseId: warehouse.id,
                type: StockMovementType.SALE_OUT,
                quantity: l.quantity,
                reference: `ORDER:${created.id}`,
              },
            });
          }
        }
      }

      // Ingreso a caja por los pagos en efectivo.
      if (dto.cashSessionId && dto.payments?.length) {
        const cash = round2(
          dto.payments.filter((p) => p.method === PaymentMethod.CASH).reduce((a, p) => a + p.amount, 0),
        );
        if (cash > 0) {
          await tx.cashMovement.create({
            data: {
              cashSessionId: dto.cashSessionId,
              type: CashMovementType.SALE_INCOME,
              amount: cash,
              concept: `Venta ${created.id}`,
            },
          });
        }
      }

      return created;
    });

    if (dto.emit) {
      const invoice = await this.invoices.emitForOrder(
        organizationId,
        order.id,
        dto.emit.documentType,
        dto.emit.series,
        dto.detraction && dto.emit.documentType === DocumentType.FACTURA
          ? { code: dto.detraction.code, percent: dto.detraction.percent, account: dto.detraction.account }
          : undefined,
      );
      return { order, invoice };
    }
    return { order };
  }

  /**
   * Emisión masiva: cada documento del lote se procesa de forma independiente
   * (un fallo no aborta el resto). Reutiliza createSale + emit por documento.
   */
  async bulkSale(organizationId: string, userId: string, dto: BulkSaleDto) {
    const est = await this.prisma.establishment.findFirst({
      where: { id: dto.establishmentId, organizationId },
    });
    if (!est) throw new BadRequestException('Establecimiento no válido');

    const results: Array<{
      row: number;
      ok: boolean;
      documentType: DocumentType;
      series?: string;
      number?: number;
      status?: string;
      total?: number;
      error?: string;
    }> = [];

    for (let i = 0; i < dto.documents.length; i++) {
      const doc = dto.documents[i];
      const row = i + 1;
      try {
        if (doc.documentType === DocumentType.FACTURA && doc.customerDocType !== DocIdentityType.RUC) {
          throw new BadRequestException('La factura requiere cliente con RUC');
        }

        // Upsert del cliente (cuando trae documento) para que la emisión lo referencie.
        let customerId: string | undefined;
        if (doc.customerDoc && doc.customerDocType && doc.customerDocType !== DocIdentityType.NONE) {
          const customer = await this.prisma.customer.upsert({
            where: {
              organizationId_identityType_documentNumber: {
                organizationId,
                identityType: doc.customerDocType,
                documentNumber: doc.customerDoc,
              },
            },
            create: {
              organizationId,
              identityType: doc.customerDocType,
              documentNumber: doc.customerDoc,
              name: doc.customerName ?? 'SIN NOMBRE',
              address: doc.customerAddress ?? null,
            },
            update: {
              name: doc.customerName ?? undefined,
              address: doc.customerAddress ?? undefined,
            },
          });
          customerId = customer.id;
        }

        const sale = (await this.createSale(organizationId, userId, {
          establishmentId: dto.establishmentId,
          customerId,
          items: doc.items.map((it) => ({
            name: it.name,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            igvAffectation: it.igvAffectation,
            unitCode: it.unitCode,
            sunatProductCode: it.sunatProductCode,
          })),
          emit: { documentType: doc.documentType, series: doc.series },
        })) as { order: { total: unknown }; invoice?: import('@prisma/client').Invoice };

        results.push({
          row,
          ok: sale.invoice?.status !== 'REJECTED',
          documentType: doc.documentType,
          series: sale.invoice?.series,
          number: sale.invoice?.number,
          status: sale.invoice?.status,
          total: sale.invoice ? Number(sale.invoice.total) : Number(sale.order.total),
          error: sale.invoice?.status === 'REJECTED' ? sale.invoice.sunatMessage ?? 'Rechazado' : undefined,
        });
      } catch (e) {
        results.push({ row, ok: false, documentType: doc.documentType, error: (e as Error).message });
      }
    }

    return {
      total: results.length,
      ok: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    };
  }

  list(organizationId: string) {
    return this.prisma.order.findMany({
      where: { organizationId },
      include: { customer: true, invoice: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  /** Pedidos de la tienda online / delivery, para el tablero de preparación y despacho. */
  listOnline(organizationId: string) {
    return this.prisma.order.findMany({
      where: { organizationId, saleType: { in: [SaleType.ONLINE, SaleType.DELIVERY] } },
      include: { items: true, invoice: true, customer: true, payments: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  /** Avanza el estado de preparación/entrega de un pedido online. */
  async setFulfillment(organizationId: string, orderId: string, status: FulfillmentStatus) {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, organizationId } });
    if (!order) throw new NotFoundException('Pedido no encontrado');
    const data: { fulfillmentStatus: FulfillmentStatus; status?: OrderStatus } = { fulfillmentStatus: status };
    // Anular el pedido también marca la orden como cancelada si aún no se cobró.
    if (status === FulfillmentStatus.CANCELLED && order.status === OrderStatus.PENDING_PAYMENT) {
      data.status = OrderStatus.CANCELLED;
    }
    return this.prisma.order.update({ where: { id: order.id }, data });
  }

  async get(organizationId: string, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, organizationId },
      include: { items: true, payments: true, customer: true, invoice: true },
    });
    if (!order) throw new NotFoundException('Orden no encontrada');
    return order;
  }

  /**
   * Anula una venta que NO tiene comprobante aceptado: repone el stock vendido
   * (RETURN_IN al almacén principal) y revierte el ingreso a caja (si la sesión
   * sigue abierta), todo en una transacción. Si la venta ya tiene comprobante
   * emitido/aceptado, debe anularse vía comunicación de baja del comprobante.
   */
  async cancelSale(organizationId: string, id: string, reason?: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, organizationId },
      include: { items: true, payments: true, invoice: true },
    });
    if (!order) throw new NotFoundException('Venta no encontrada');
    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('La venta ya está anulada');
    }
    if (order.invoice && order.invoice.status !== InvoiceStatus.REJECTED) {
      throw new BadRequestException(
        'Esta venta tiene un comprobante emitido. Anúlalo desde Comprobantes (comunicación de baja).',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Reponer stock al almacén principal (mismo criterio que el descuento de la venta).
      const warehouse =
        (await tx.warehouse.findFirst({ where: { organizationId, isMain: true } })) ??
        (await tx.warehouse.findFirst({ where: { organizationId } }));
      if (warehouse) {
        for (const it of order.items) {
          if (!it.productId) continue;
          const product = await tx.product.findFirst({ where: { id: it.productId, organizationId } });
          if (!product?.tracksStock) continue;
          const qty = Number(it.quantity);
          await tx.stock.upsert({
            where: { productId_warehouseId: { productId: it.productId, warehouseId: warehouse.id } },
            create: { productId: it.productId, warehouseId: warehouse.id, quantity: new Prisma.Decimal(qty) },
            update: { quantity: { increment: qty } },
          });
          await tx.stockMovement.create({
            data: {
              organizationId,
              productId: it.productId,
              warehouseId: warehouse.id,
              type: StockMovementType.RETURN_IN,
              quantity: qty,
              reference: `CANCEL:${order.id}`,
            },
          });
        }
      }

      // Revertir el ingreso de caja en efectivo si la sesión sigue abierta.
      if (order.cashSessionId) {
        const cashPaid = round2(
          order.payments
            .filter((p) => p.method === PaymentMethod.CASH)
            .reduce((a, p) => a + Number(p.amount), 0),
        );
        if (cashPaid > 0) {
          const session = await tx.cashSession.findFirst({ where: { id: order.cashSessionId } });
          if (session && session.status === CashSessionStatus.OPEN) {
            await tx.cashMovement.create({
              data: {
                cashSessionId: order.cashSessionId,
                type: CashMovementType.WITHDRAWAL,
                amount: cashPaid,
                concept: `Anulación venta ${order.id}`,
              },
            });
          }
        }
      }

      const note = reason ? `${order.note ? `${order.note} · ` : ''}Anulada: ${reason}` : order.note;
      return tx.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.CANCELLED, note },
        include: { items: true, payments: true, invoice: true },
      });
    });
  }
}
