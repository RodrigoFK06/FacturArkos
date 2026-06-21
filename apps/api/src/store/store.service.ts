import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { FulfillmentStatus, IgvAffectation, OrderStatus, SaleType } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { decomposeIgv, round2 } from '../common/utils/money';
import { CreateOnlineOrderDto } from './dto';

@Injectable()
export class StoreService {
  constructor(private readonly prisma: PrismaService) {}

  async info(organizationId: string) {
    const org = await this.prisma.organization.findFirst({
      where: { id: organizationId, active: true },
      select: {
        id: true, razonSocial: true, nombreComercial: true, logoUrl: true, whatsapp: true,
        yapeNumber: true, yapeQrUrl: true, plinNumber: true, plinQrUrl: true,
      },
    });
    if (!org) throw new NotFoundException('Tienda no encontrada');
    return {
      id: org.id,
      name: org.nombreComercial || org.razonSocial,
      logoUrl: org.logoUrl,
      whatsapp: org.whatsapp,
      yape: org.yapeNumber || org.yapeQrUrl ? { number: org.yapeNumber, qrUrl: org.yapeQrUrl } : null,
      plin: org.plinNumber || org.plinQrUrl ? { number: org.plinNumber, qrUrl: org.plinQrUrl } : null,
    };
  }

  listProducts(organizationId: string) {
    return this.prisma.product.findMany({
      where: { organizationId, active: true },
      select: {
        id: true,
        name: true,
        price: true,
        barcode: true,
        category: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
      take: 200,
    });
  }

  /** Portal del cliente: comprobantes de un cliente por número de documento (público, sin login). */
  async customerInvoices(organizationId: string, doc: string) {
    const clean = (doc ?? '').trim();
    if (clean.length < 6) throw new BadRequestException('Ingresa tu número de documento (DNI o RUC)');
    const org = await this.prisma.organization.findFirst({
      where: { id: organizationId, active: true },
      select: { nombreComercial: true, razonSocial: true },
    });
    if (!org) throw new NotFoundException('Negocio no encontrado');

    const invoices = await this.prisma.invoice.findMany({
      where: { organizationId, customerDoc: clean },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true, documentType: true, series: true, number: true, status: true,
        issueDate: true, total: true, currency: true, pdfUrl: true, customerName: true,
      },
    });
    return {
      negocio: org.nombreComercial || org.razonSocial,
      cliente: invoices[0]?.customerName ?? null,
      comprobantes: invoices.map((i) => ({
        id: i.id,
        tipo: i.documentType,
        comprobante: `${i.series}-${String(i.number).padStart(8, '0')}`,
        fecha: i.issueDate,
        total: Number(i.total),
        moneda: i.currency,
        estado: i.status,
        pdfUrl: i.pdfUrl,
      })),
    };
  }

  /** Crea un pedido online (sin emitir). El comercio lo confirma/cobra/emite luego. */
  async createOnlineOrder(organizationId: string, dto: CreateOnlineOrderDto) {
    const est =
      (await this.prisma.establishment.findFirst({ where: { organizationId, isMain: true } })) ??
      (await this.prisma.establishment.findFirst({ where: { organizationId } }));
    if (!est) throw new BadRequestException('Tienda no disponible');

    const ids = dto.items.map((i) => i.productId);
    const products = await this.prisma.product.findMany({
      where: { organizationId, id: { in: ids }, active: true },
    });
    const pmap = new Map(products.map((p) => [p.id, p]));

    const lines = dto.items.map((it) => {
      const p = pmap.get(it.productId);
      if (!p) throw new BadRequestException('Producto no disponible');
      const unitPrice = Number(p.price);
      const lineTotal = round2(it.quantity * unitPrice);
      const { base, igv } =
        p.igvAffectation === IgvAffectation.GRAVADO
          ? decomposeIgv(lineTotal)
          : { base: lineTotal, igv: 0 };
      return { p, qty: it.quantity, unitPrice, lineTotal, base, igv };
    });

    const subtotal = round2(lines.reduce((a, l) => a + l.base, 0));
    const igv = round2(lines.reduce((a, l) => a + l.igv, 0));
    const total = round2(lines.reduce((a, l) => a + l.lineTotal, 0));
    const contacto = [dto.customerName, dto.phone, dto.email, dto.address].filter(Boolean).join(' · ');

    const order = await this.prisma.order.create({
      data: {
        organizationId,
        establishmentId: est.id,
        saleType: SaleType.ONLINE,
        status: OrderStatus.PENDING_PAYMENT,
        fulfillmentStatus: FulfillmentStatus.PENDING,
        subtotal,
        igv,
        total,
        note: `Pedido online — ${contacto}`,
        contactName: dto.customerName ?? null,
        contactPhone: dto.phone ?? null,
        contactAddress: dto.address ?? null,
        items: {
          create: lines.map((l) => ({
            productId: l.p.id,
            name: l.p.name,
            quantity: l.qty,
            unitPrice: l.unitPrice,
            unitCost: Number(l.p.cost),
            total: l.lineTotal,
            igvAffectation: l.p.igvAffectation,
            unitCode: l.p.unitCode,
          })),
        },
      },
    });

    return { orderId: order.id, total, status: order.status };
  }
}
