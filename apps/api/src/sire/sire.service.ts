import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DocIdentityType, DocumentType, InvoiceStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { round2 } from '../common/utils/money';

/** SUNAT cat 10/01 — tipo de comprobante para libros. */
const DOC_CODE: Record<DocumentType, string> = {
  FACTURA: '01',
  BOLETA: '03',
  NOTA_CREDITO: '07',
  NOTA_DEBITO: '08',
  GUIA_REMISION: '09',
  RETENCION: '20',
  PERCEPCION: '40',
};
const ID_CODE: Record<DocIdentityType, string> = {
  NONE: '0',
  DNI: '1',
  CE: '4',
  RUC: '6',
  PASSPORT: '7',
};

const money = (v: unknown) => Number(v ?? 0).toFixed(2);
const toDmy = (isoDate: string) => {
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
};

/**
 * SIRE (RVIE / RCE) y exportación PLE.
 *
 * ⚠️ El layout PLE 5.x tiene 30-40+ campos por libro. Aquí se generan los campos
 * principales en el orden oficial (resto vacíos). Validar contra la estructura
 * vigente de SUNAT (PLE / SIRE) antes de presentar.
 */
@Injectable()
export class SireService {
  constructor(private readonly prisma: PrismaService) {}

  private periodRange(period: string) {
    if (!/^\d{6}$/.test(period)) throw new BadRequestException('Periodo inválido (use YYYYMM)');
    const year = parseInt(period.slice(0, 4), 10);
    const month = parseInt(period.slice(4, 6), 10) - 1;
    return {
      gte: new Date(year, month, 1),
      lte: new Date(year, month + 1, 0, 23, 59, 59, 999),
    };
  }

  /** Registro de Ventas e Ingresos Electrónico (estructura). */
  async rvie(organizationId: string, period: string) {
    const createdAt = this.periodRange(period);
    const invoices = await this.prisma.invoice.findMany({
      where: { organizationId, createdAt },
      orderBy: [{ documentType: 'asc' }, { series: 'asc' }, { number: 'asc' }],
    });

    const rows = invoices.map((i) => ({
      fechaEmision: i.issueDate,
      tipoComprobante: DOC_CODE[i.documentType],
      serie: i.series,
      numero: i.number,
      tipoDocCliente: ID_CODE[i.customerDocType],
      numDocCliente: i.customerDoc ?? '',
      razonSocial: i.customerName ?? '',
      baseImponible: round2(Number(i.subtotal)),
      igv: round2(Number(i.igv)),
      total: round2(Number(i.total)),
      moneda: i.currency,
      estado: i.status,
    }));

    const aceptadas = invoices.filter((i) => i.status === InvoiceStatus.ACCEPTED);
    const totals = {
      baseImponible: round2(aceptadas.reduce((a, i) => a + Number(i.subtotal), 0)),
      igv: round2(aceptadas.reduce((a, i) => a + Number(i.igv), 0)),
      total: round2(aceptadas.reduce((a, i) => a + Number(i.total), 0)),
    };
    return { period, count: rows.length, totals, rows };
  }

  /** Registro de Compras Electrónico (estructura). */
  async rce(organizationId: string, period: string) {
    const createdAt = this.periodRange(period);
    const purchases = await this.prisma.purchase.findMany({
      where: { organizationId, createdAt },
      include: { supplier: true },
      orderBy: { createdAt: 'asc' },
    });

    const rows = purchases.map((p) => ({
      fechaEmision: p.issueDate,
      tipoComprobante: p.documentType ?? '01',
      serie: p.series ?? '',
      numero: p.number ?? '',
      rucProveedor: p.supplier.ruc,
      razonSocial: p.supplier.businessName,
      baseImponible: round2(Number(p.subtotal)),
      igv: round2(Number(p.igv)),
      total: round2(Number(p.total)),
      moneda: p.currency,
    }));

    const totals = {
      baseImponible: round2(purchases.reduce((a, p) => a + Number(p.subtotal), 0)),
      igv: round2(purchases.reduce((a, p) => a + Number(p.igv), 0)),
      total: round2(purchases.reduce((a, p) => a + Number(p.total), 0)),
    };
    return { period, count: rows.length, totals, rows };
  }

  /** PLE — Registro de Ventas (Libro 14.1), TXT pipe-delimited. */
  async pleSales(organizationId: string, period: string) {
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) throw new NotFoundException('Organización no encontrada');
    const createdAt = this.periodRange(period);
    const invoices = await this.prisma.invoice.findMany({
      where: { organizationId, createdAt },
      orderBy: [{ documentType: 'asc' }, { series: 'asc' }, { number: 'asc' }],
    });

    const lines = invoices.map((inv, idx) => {
      const fields = [
        `${period}00`, // 1 periodo
        `${idx + 1}`, // 2 CUO
        `M${String(idx + 1).padStart(6, '0')}`, // 3 correlativo asiento
        toDmy(inv.issueDate), // 4 fecha emisión
        '', // 5 fecha vencimiento
        DOC_CODE[inv.documentType], // 6 tipo comprobante
        inv.series, // 7 serie
        String(inv.number), // 8 número
        '', // 9 número final
        ID_CODE[inv.customerDocType], // 10 tipo doc cliente
        inv.customerDoc ?? '', // 11 nro doc cliente
        inv.customerName ?? '', // 12 razón social
        '0.00', // 13 valor exportación
        money(inv.subtotal), // 14 base imponible gravada
        '0.00', // 15 descuento BI
        money(inv.igv), // 16 IGV/IPM
        '0.00', // 17 descuento IGV
        '0.00', // 18 exoneradas
        '0.00', // 19 inafectas
        '0.00', // 20 ISC
        '0.00', // 21 base arroz pilado
        '0.00', // 22 IVAP
        '0.00', // 23 ICBPER
        '0.00', // 24 otros tributos
        money(inv.total), // 25 importe total
        inv.currency, // 26 moneda
        '1.000', // 27 tipo de cambio
        inv.status === InvoiceStatus.VOIDED ? '2' : '1', // 28 indicador de estado
      ];
      return fields.join('|') + '|';
    });

    const fileName = `LE${org.ruc}${period}00140100001111.txt`;
    return { fileName, count: lines.length, content: lines.join('\r\n') };
  }

  /** PLE — Registro de Compras (Libro 8.1), TXT pipe-delimited. */
  async plePurchases(organizationId: string, period: string) {
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) throw new NotFoundException('Organización no encontrada');
    const createdAt = this.periodRange(period);
    const purchases = await this.prisma.purchase.findMany({
      where: { organizationId, createdAt },
      include: { supplier: true },
      orderBy: { createdAt: 'asc' },
    });

    const lines = purchases.map((p, idx) => {
      const fields = [
        `${period}00`, // 1 periodo
        `${idx + 1}`, // 2 CUO
        `M${String(idx + 1).padStart(6, '0')}`, // 3 correlativo asiento
        toDmy(p.issueDate), // 4 fecha emisión
        '', // 5 fecha vencimiento
        p.documentType ?? '01', // 6 tipo comprobante
        p.series ?? '', // 7 serie
        p.number ?? '', // 8 número
        '6', // 9 tipo doc proveedor (RUC)
        p.supplier.ruc, // 10 nro doc proveedor
        p.supplier.businessName, // 11 razón social
        money(p.subtotal), // 12 base imponible gravada (DG)
        money(p.igv), // 13 IGV
        '0.00', // 14 base no gravada
        '0.00', // 15 IGV no gravado
        '0.00', // 16 valor adquisiciones no gravadas
        '0.00', // 17 ISC
        '0.00', // 18 ICBPER
        '0.00', // 19 otros tributos
        money(p.total), // 20 importe total
        p.currency, // 21 moneda
        '1.000', // 22 tipo de cambio
        '1', // 23 indicador de estado
      ];
      return fields.join('|') + '|';
    });

    const fileName = `LE${org.ruc}${period}00080100001111.txt`;
    return { fileName, count: lines.length, content: lines.join('\r\n') };
  }
}
