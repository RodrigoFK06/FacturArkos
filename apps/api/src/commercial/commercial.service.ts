import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CommercialKind, CommercialStatus, IgvAffectation, PaymentMethod, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { decomposeIgv, round2 } from '../common/utils/money';
import { OrdersService } from '../pos/orders.service';
import { ConvertDto, CreateCommercialDocDto } from './dto';

const SERIES: Record<CommercialKind, string> = {
  COTIZACION: 'C001',
  NOTA_VENTA: 'NV01',
};

@Injectable()
export class CommercialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
  ) {}

  /** Correlativo atómico por (org, tipo, serie). */
  private async nextNumber(organizationId: string, kind: CommercialKind, series: string): Promise<number> {
    const where = { organizationId_kind_series: { organizationId, kind, series } };
    try {
      const r = await this.prisma.commercialSeries.upsert({
        where,
        create: { organizationId, kind, series, currentNumber: 1 },
        update: { currentNumber: { increment: 1 } },
      });
      return r.currentNumber;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const r = await this.prisma.commercialSeries.update({ where, data: { currentNumber: { increment: 1 } } });
        return r.currentNumber;
      }
      throw e;
    }
  }

  list(organizationId: string, kind?: CommercialKind) {
    return this.prisma.commercialDoc.findMany({
      where: { organizationId, ...(kind ? { kind } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async get(organizationId: string, id: string) {
    const doc = await this.prisma.commercialDoc.findFirst({ where: { id, organizationId }, include: { items: true } });
    if (!doc) throw new NotFoundException('Documento no encontrado');
    return doc;
  }

  async create(organizationId: string, dto: CreateCommercialDocDto) {
    const series = SERIES[dto.kind];
    const productIds = dto.items.map((i) => i.productId).filter((id): id is string => !!id);
    const products = productIds.length
      ? await this.prisma.product.findMany({ where: { organizationId, id: { in: productIds } } })
      : [];
    const pmap = new Map(products.map((p) => [p.id, p]));

    const lines = dto.items.map((it) => {
      const p = it.productId ? pmap.get(it.productId) : undefined;
      const aff = p?.igvAffectation ?? IgvAffectation.GRAVADO;
      const lineTotal = round2(it.quantity * it.unitPrice);
      const { base, igv } = aff === IgvAffectation.GRAVADO ? decomposeIgv(lineTotal) : { base: lineTotal, igv: 0 };
      return { it, name: it.name || p?.name || 'Ítem', lineTotal, base, igv };
    });

    const subtotal = round2(lines.reduce((a, l) => a + l.base, 0));
    const igv = round2(lines.reduce((a, l) => a + l.igv, 0));
    const total = round2(lines.reduce((a, l) => a + l.lineTotal, 0));
    const number = await this.nextNumber(organizationId, dto.kind, series);

    return this.prisma.commercialDoc.create({
      data: {
        organizationId,
        kind: dto.kind,
        series,
        number,
        customerId: dto.customerId ?? null,
        customerName: dto.customerName ?? null,
        subtotal,
        igv,
        total,
        validUntil: dto.validUntil ?? null,
        note: dto.note ?? null,
        items: {
          create: lines.map((l) => ({
            productId: l.it.productId ?? null,
            name: l.name,
            quantity: l.it.quantity,
            unitPrice: l.it.unitPrice,
            total: l.lineTotal,
          })),
        },
      },
      include: { items: true },
    });
  }

  /** Convierte el documento en una venta (orden), opcionalmente emitiendo comprobante. */
  async convert(organizationId: string, userId: string, id: string, dto: ConvertDto) {
    const doc = await this.prisma.commercialDoc.findFirst({ where: { id, organizationId }, include: { items: true } });
    if (!doc) throw new NotFoundException('Documento no encontrado');
    if (doc.status !== CommercialStatus.ABIERTA) {
      throw new BadRequestException('El documento ya fue convertido o anulado');
    }
    const est =
      (await this.prisma.establishment.findFirst({ where: { organizationId, isMain: true } })) ??
      (await this.prisma.establishment.findFirst({ where: { organizationId } }));
    if (!est) throw new BadRequestException('No hay establecimiento configurado');

    const total = Number(doc.total);
    const result = await this.orders.createSale(organizationId, userId, {
      establishmentId: est.id,
      customerId: doc.customerId ?? undefined,
      items: doc.items.map((i) => ({
        productId: i.productId ?? undefined,
        name: i.name,
        quantity: Number(i.quantity),
        unitPrice: Number(i.unitPrice),
      })),
      payments: dto.documentType ? [{ method: PaymentMethod.CASH, amount: total }] : undefined,
      emit: dto.documentType ? { documentType: dto.documentType } : undefined,
    });

    await this.prisma.commercialDoc.update({ where: { id }, data: { status: CommercialStatus.CONVERTIDA } });
    return result;
  }
}
