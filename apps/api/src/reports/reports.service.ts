import { Injectable } from '@nestjs/common';
import { DocumentType, InvoiceStatus, OrderStatus, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { round2 } from '../common/utils/money';
import { limaDateString } from '../common/utils/lima-time';

interface Range {
  gte: Date;
  lte: Date;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private range(from?: string, to?: string): Range {
    if (from || to) {
      const gte = from ? new Date(from) : new Date('2000-01-01');
      const lte = to ? new Date(new Date(to).getTime() + 86_399_999) : new Date();
      return { gte, lte };
    }
    const now = new Date();
    return { gte: new Date(now.getFullYear(), now.getMonth(), 1), lte: now };
  }

  private num(v: unknown): number {
    return v == null ? 0 : Number(v);
  }

  async dashboard(organizationId: string) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [today, month, invoiceGroups, products, topProducts] = await Promise.all([
      this.prisma.order.aggregate({
        where: { organizationId, status: OrderStatus.PAID, createdAt: { gte: todayStart } },
        _sum: { total: true },
        _count: true,
      }),
      this.prisma.order.aggregate({
        where: { organizationId, status: OrderStatus.PAID, createdAt: { gte: monthStart } },
        _sum: { total: true },
        _count: true,
      }),
      this.prisma.invoice.groupBy({ by: ['status'], where: { organizationId }, _count: true }),
      this.prisma.product.findMany({
        where: { organizationId, tracksStock: true, active: true },
        select: { minStock: true, stocks: { select: { quantity: true } } },
      }),
      this.topProducts(organizationId, undefined, undefined, 5),
    ]);

    const lowStockCount = products.filter((p) => {
      const stock = p.stocks.reduce((a, s) => a + this.num(s.quantity), 0);
      return stock <= this.num(p.minStock);
    }).length;

    const invoicesByStatus: Record<string, number> = {};
    for (const g of invoiceGroups) invoicesByStatus[g.status] = g._count;

    return {
      ventasHoy: { total: round2(this.num(today._sum.total)), count: today._count },
      ventasMes: { total: round2(this.num(month._sum.total)), count: month._count },
      comprobantes: invoicesByStatus,
      alertasStockBajo: lowStockCount,
      topProductos: topProducts,
    };
  }

  async sales(organizationId: string, from?: string, to?: string) {
    const createdAt = this.range(from, to);
    const [agg, byMethod] = await Promise.all([
      this.prisma.order.aggregate({
        where: { organizationId, status: OrderStatus.PAID, createdAt },
        _sum: { subtotal: true, igv: true, total: true, discount: true },
        _count: true,
      }),
      this.prisma.payment.groupBy({
        by: ['method'],
        where: { organizationId, status: PaymentStatus.APPROVED, order: { status: OrderStatus.PAID, createdAt } },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    return {
      count: agg._count,
      subtotal: round2(this.num(agg._sum.subtotal)),
      igv: round2(this.num(agg._sum.igv)),
      descuento: round2(this.num(agg._sum.discount)),
      total: round2(this.num(agg._sum.total)),
      porMetodoPago: byMethod.map((m) => ({
        method: m.method,
        total: round2(this.num(m._sum.amount)),
        count: m._count,
      })),
    };
  }

  async topProducts(organizationId: string, from?: string, to?: string, limit = 10) {
    const createdAt = this.range(from, to);
    const rows = await this.prisma.orderItem.groupBy({
      by: ['name'],
      where: { order: { organizationId, status: OrderStatus.PAID, createdAt } },
      _sum: { quantity: true, total: true },
      orderBy: { _sum: { total: 'desc' } },
      take: limit,
    });
    return rows.map((r) => ({
      name: r.name,
      quantity: round2(this.num(r._sum.quantity)),
      total: round2(this.num(r._sum.total)),
    }));
  }

  async purchases(organizationId: string, from?: string, to?: string) {
    const createdAt = this.range(from, to);
    const agg = await this.prisma.purchase.aggregate({
      where: { organizationId, createdAt },
      _sum: { subtotal: true, igv: true, total: true },
      _count: true,
    });
    return {
      count: agg._count,
      subtotal: round2(this.num(agg._sum.subtotal)),
      igv: round2(this.num(agg._sum.igv)),
      total: round2(this.num(agg._sum.total)),
    };
  }

  async cash(organizationId: string, from?: string, to?: string) {
    const openedAt = this.range(from, to);
    const sessions = await this.prisma.cashSession.findMany({
      where: { organizationId, openedAt },
      include: { user: { select: { name: true } } },
      orderBy: { openedAt: 'desc' },
    });
    return sessions.map((s) => ({
      id: s.id,
      cajero: s.user.name,
      status: s.status,
      openedAt: s.openedAt,
      closedAt: s.closedAt,
      apertura: round2(this.num(s.openingAmount)),
      esperado: s.expectedAmount != null ? round2(this.num(s.expectedAmount)) : null,
      contado: s.closingAmount != null ? round2(this.num(s.closingAmount)) : null,
      diferencia:
        s.closingAmount != null && s.expectedAmount != null
          ? round2(this.num(s.closingAmount) - this.num(s.expectedAmount))
          : null,
    }));
  }

  /** Ganancias y pérdidas: margen bruto = ventas netas − costo de ventas (COGS). */
  async profit(organizationId: string, from?: string, to?: string) {
    const createdAt = this.range(from, to);
    const [rev, items] = await Promise.all([
      this.prisma.order.aggregate({
        where: { organizationId, status: OrderStatus.PAID, createdAt },
        _sum: { subtotal: true, total: true },
      }),
      this.prisma.orderItem.findMany({
        where: { order: { organizationId, status: OrderStatus.PAID, createdAt } },
        select: { quantity: true, unitCost: true },
      }),
    ]);
    const revenueNet = round2(this.num(rev._sum.subtotal));
    const cogs = round2(items.reduce((a, i) => a + this.num(i.unitCost) * this.num(i.quantity), 0));
    const grossProfit = round2(revenueNet - cogs);
    return {
      ventasNetas: revenueNet,
      ventasTotal: round2(this.num(rev._sum.total)),
      costoVentas: cogs,
      gananciaBruta: grossProfit,
      margenPct: revenueNet > 0 ? round2((grossProfit / revenueNet) * 100) : 0,
    };
  }

  /** Resumen IGV: débito fiscal (ventas) − crédito fiscal (compras). */
  async igv(organizationId: string, from?: string, to?: string) {
    const createdAt = this.range(from, to);
    const [ventas, compras] = await Promise.all([
      this.prisma.invoice.aggregate({
        where: { organizationId, status: InvoiceStatus.ACCEPTED, createdAt },
        _sum: { igv: true, total: true },
      }),
      this.prisma.purchase.aggregate({ where: { organizationId, createdAt }, _sum: { igv: true } }),
    ]);
    const debito = round2(this.num(ventas._sum.igv));
    const credito = round2(this.num(compras._sum.igv));
    return {
      debitoFiscal: debito,
      creditoFiscal: credito,
      igvPorPagar: round2(debito - credito),
    };
  }

  /**
   * Resumen diario de boletas: consolidado de las boletas (y sus notas) emitidas
   * un día, con su estado SUNAT. En esta arquitectura las boletas se envían
   * individualmente y SUNAT las acepta con CDR, así que el resumen sirve para
   * vigilar que TODAS las del día estén aceptadas y reportar las pendientes.
   */
  async dailyBoletas(organizationId: string, date?: string) {
    const day = date ?? limaDateString();
    const docs = await this.prisma.invoice.findMany({
      where: {
        organizationId,
        issueDate: day,
        OR: [
          { documentType: DocumentType.BOLETA },
          { documentType: { in: [DocumentType.NOTA_CREDITO, DocumentType.NOTA_DEBITO] }, refDocumentType: DocumentType.BOLETA },
        ],
      },
      orderBy: [{ series: 'asc' }, { number: 'asc' }],
      select: {
        id: true,
        documentType: true,
        series: true,
        number: true,
        status: true,
        customerName: true,
        customerDoc: true,
        subtotal: true,
        igv: true,
        total: true,
        sunatMessage: true,
      },
    });

    const accStatus = (s: InvoiceStatus) => {
      switch (s) {
        case InvoiceStatus.ACCEPTED:
          return 'aceptados';
        case InvoiceStatus.REJECTED:
          return 'rechazados';
        case InvoiceStatus.VOIDED:
        case InvoiceStatus.VOID_PENDING:
          return 'anulados';
        default:
          return 'pendientes';
      }
    };

    const byStatus = { aceptados: 0, pendientes: 0, rechazados: 0, anulados: 0 };
    let gravado = 0;
    let igv = 0;
    let total = 0;
    for (const d of docs) {
      byStatus[accStatus(d.status)]++;
      // NC restan al consolidado del día.
      const sign = d.documentType === DocumentType.NOTA_CREDITO ? -1 : 1;
      gravado += sign * this.num(d.subtotal);
      igv += sign * this.num(d.igv);
      total += sign * this.num(d.total);
    }

    const pendientesActivos = docs.filter(
      (d) => d.status === InvoiceStatus.PENDING || d.status === InvoiceStatus.VOID_PENDING,
    ).length;

    return {
      date: day,
      count: docs.length,
      totals: { gravado: round2(gravado), igv: round2(igv), total: round2(total) },
      byStatus,
      pendientesActivos,
      saludable: byStatus.rechazados === 0 && pendientesActivos === 0,
      documentos: docs.map((d) => ({
        id: d.id,
        documentType: d.documentType,
        comprobante: `${d.series}-${String(d.number).padStart(8, '0')}`,
        cliente: d.customerName,
        clienteDoc: d.customerDoc,
        total: this.num(d.total),
        status: d.status,
        mensaje: d.sunatMessage,
      })),
    };
  }
}
