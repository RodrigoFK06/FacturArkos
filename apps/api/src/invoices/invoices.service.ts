import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DocIdentityType, DocumentType, Invoice, InvoiceStatus, Prisma } from '@prisma/client';
import { ApiSunatUnavailableError } from '../apisunat/apisunat.errors';
import { ApiSunatCreds, ApiSunatService } from '../apisunat/apisunat.service';
import { buildDocument } from '../apisunat/apisunat.builder';
import { ApiSunatStatus, ApiSunatStatusResult, BuildDetraction, BuildLine, BuildParty } from '../apisunat/apisunat.types';
import { PrismaService } from '../common/prisma/prisma.service';
import { limaDateString, limaTimeString } from '../common/utils/lima-time';
import { round2 } from '../common/utils/money';
import { SunatConfigService } from '../sunat-config/sunat-config.service';
import { BillingSeriesService } from './billing-series.service';

const IDENTITY_CODE: Record<DocIdentityType, string> = {
  NONE: '0',
  DNI: '1',
  CE: '4',
  RUC: '6',
  PASSPORT: '7',
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function defaultSeries(type: DocumentType): string {
  return type === DocumentType.FACTURA ? 'F001' : 'B001';
}

/** Mapea el vocabulario de APISUNAT a nuestro dominio (Playbook §3.3). */
function mapStatus(s: ApiSunatStatus): InvoiceStatus {
  switch (s) {
    case 'ACEPTADO':
      return InvoiceStatus.ACCEPTED;
    case 'RECHAZADO':
    case 'EXCEPCION':
    case 'ERROR':
      return InvoiceStatus.REJECTED;
    case 'BAJA':
    case 'ANULADO':
      return InvoiceStatus.VOIDED;
    default:
      return InvoiceStatus.PENDING;
  }
}

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sunatConfig: SunatConfigService,
    private readonly apisunat: ApiSunatService,
    private readonly series: BillingSeriesService,
  ) {}

  /**
   * Emite el comprobante de una orden (FACTURA/BOLETA). Implementa los patrones
   * P4 (correlativo atómico), P6 (outbox-lite: PENDING → enviar → reconciliar) y
   * la idempotencia 1:1 Order↔Invoice (Playbook §3.3).
   */
  async emitForOrder(
    organizationId: string,
    orderId: string,
    documentType: DocumentType,
    seriesCode?: string,
    detraction?: { code: string; percent: number; account?: string },
  ): Promise<Invoice> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, organizationId },
      include: { items: true, customer: true, organization: true, invoice: true, establishment: true },
    });
    if (!order) throw new NotFoundException('Orden no encontrada');
    if (order.items.length === 0) throw new BadRequestException('La orden no tiene ítems');

    // Idempotencia: si ya tiene comprobante no rechazado, devolverlo (doble-click).
    if (order.invoice && order.invoice.status !== InvoiceStatus.REJECTED) {
      return order.invoice;
    }

    const creds = await this.sunatConfig.getDecrypted(organizationId);
    const series = seriesCode ?? defaultSeries(documentType);

    // Cliente del comprobante.
    let customer: BuildParty;
    if (order.customer) {
      customer = {
        identityTypeCode: IDENTITY_CODE[order.customer.identityType],
        documentNumber: order.customer.documentNumber,
        name: order.customer.name,
        address: order.customer.address ?? undefined,
      };
    } else {
      customer = { identityTypeCode: '0', documentNumber: '00000000', name: 'CLIENTES VARIOS' };
    }
    if (documentType === DocumentType.FACTURA && customer.identityTypeCode !== '6') {
      throw new BadRequestException('La factura requiere un cliente con RUC');
    }

    const lines: BuildLine[] = order.items.map((it) => ({
      description: it.name,
      quantity: Number(it.quantity),
      unitPriceWithIgv: Number(it.unitPrice),
      unitCode: it.unitCode,
      igvAffectation: it.igvAffectation,
      sunatProductCode: it.sunatProductCode ?? undefined,
    }));

    // Detracción (solo FACTURA): el monto se recalcula desde el total persistido (P5).
    let detractionInput: BuildDetraction | undefined;
    if (detraction && documentType === DocumentType.FACTURA) {
      const account = detraction.account ?? order.organization.detractionAccount;
      if (!account) {
        throw new BadRequestException('Falta la cuenta de detracción (Banco de la Nación)');
      }
      const amount = round2((Number(order.total) * detraction.percent) / 100);
      detractionInput = { code: detraction.code, percent: detraction.percent, amount, account };
    }

    const number = await this.series.getNextNumber(organizationId, documentType, series);
    const issueDate = limaDateString();
    const issueTime = limaTimeString();

    const built = buildDocument({
      documentType,
      series,
      number,
      issueDate,
      issueTime,
      currency: order.currency,
      issuer: {
        ruc: order.organization.ruc,
        razonSocial: order.organization.razonSocial,
        nombreComercial: order.organization.nombreComercial ?? undefined,
        address: order.organization.direccion ?? undefined,
        ubigeo: order.organization.ubigeo ?? undefined,
        establishmentCode: order.establishment?.code ?? '0000',
      },
      customer,
      lines,
      detraction: detractionInput,
    });

    const subtotal = round2(
      built.totals.taxableAmount + built.totals.exemptAmount + built.totals.unaffectedAmount,
    );
    const baseData = {
      documentType,
      series,
      number,
      issueDate,
      status: InvoiceStatus.PENDING,
      subtotal,
      igv: built.totals.igv,
      total: built.totals.total,
      currency: order.currency,
      customerDocType: order.customer?.identityType ?? DocIdentityType.NONE,
      customerDoc: customer.documentNumber,
      customerName: customer.name,
      externalId: null,
      sunatCode: null,
      sunatMessage: null,
      detractionCode: detractionInput?.code ?? null,
      detractionPercent: detractionInput?.percent ?? null,
      detractionAmount: detractionInput?.amount ?? null,
    };

    // Persistir PENDING ANTES de tocar APISUNAT (outbox-lite, P6).
    let invoice: Invoice;
    if (order.invoice && order.invoice.status === InvoiceStatus.REJECTED) {
      // Reutilizar la fila rechazada con correlativo fresco.
      invoice = await this.prisma.invoice.update({ where: { id: order.invoice.id }, data: baseData });
    } else {
      try {
        invoice = await this.prisma.invoice.create({ data: { organizationId, orderId, ...baseData } });
      } catch (e) {
        // Doble-submit chocó con UNIQUE(orderId) → devolver el ganador.
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          const existing = await this.prisma.invoice.findUnique({ where: { orderId } });
          if (existing) return existing;
        }
        throw e;
      }
    }

    const apiCreds: ApiSunatCreds = { personaId: creds.personaId, token: creds.token };

    let send;
    try {
      send = await this.apisunat.sendBill(apiCreds, built.fileName, built.documentBody);
    } catch (e) {
      if (e instanceof ApiSunatUnavailableError) {
        // Transitorio: queda PENDING y se reconcilia luego (P6).
        this.logger.warn(`Emisión ${built.fileName} quedó PENDING: ${e.message}`);
        return invoice;
      }
      await this.prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: InvoiceStatus.REJECTED, sunatMessage: (e as Error).message },
      });
      throw new BadRequestException(`SUNAT rechazó el comprobante: ${(e as Error).message}`);
    }

    await this.prisma.invoice.update({ where: { id: invoice.id }, data: { externalId: send.documentId } });

    // Polling sincrónico hasta 30s por el estado final.
    const final = await this.waitForFinal(apiCreds, send.documentId);
    const status = mapStatus(final.status);

    return this.prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status,
        sunatCode: final.sunatStatus?.code ?? null,
        sunatMessage: final.sunatStatus?.message ?? null,
        pdfUrl: this.apisunat.getPdfUrl(send.documentId, final.fileName ?? built.fileName),
      },
    });
  }

  /** Polling con backoff exponencial (Playbook §3.4). getById fallido no aborta. */
  private async waitForFinal(
    creds: ApiSunatCreds,
    documentId: string,
    timeoutMs = 30_000,
    intervalMs = 2_000,
  ): Promise<ApiSunatStatusResult> {
    const start = Date.now();
    let wait = intervalMs;
    let last: ApiSunatStatusResult = { documentId, status: 'PENDIENTE' };
    while (Date.now() - start < timeoutMs) {
      try {
        const doc = await this.apisunat.getById(creds, documentId);
        last = doc;
        if (doc.status !== 'PENDIENTE') return doc;
      } catch (e) {
        this.logger.warn(`getById falló (no aborta el loop): ${(e as Error).message}`);
      }
      await sleep(wait);
      wait = Math.min(Math.round(wait * 1.4), 8_000);
    }
    return last;
  }

  /** Reconciliación de los que quedaron PENDING/VOID_PENDING (endpoint o cron). */
  async refreshStatus(organizationId: string, invoiceId: string): Promise<Invoice> {
    const inv = await this.prisma.invoice.findFirst({ where: { id: invoiceId, organizationId } });
    if (!inv) throw new NotFoundException('Comprobante no encontrado');
    if (!inv.externalId) return inv;

    const creds = await this.sunatConfig.getDecrypted(organizationId);
    let doc: ApiSunatStatusResult;
    try {
      doc = await this.apisunat.getById({ personaId: creds.personaId, token: creds.token }, inv.externalId);
    } catch (e) {
      this.logger.warn(`refreshStatus getById falló: ${(e as Error).message}`);
      return inv;
    }

    const status = mapStatus(doc.status);
    // No retroceder de VOID_PENDING a ACCEPTED mientras la baja sigue en vuelo.
    if (inv.status === InvoiceStatus.VOID_PENDING && status === InvoiceStatus.ACCEPTED) {
      return inv;
    }

    return this.prisma.invoice.update({
      where: { id: inv.id },
      data: {
        status,
        sunatCode: doc.sunatStatus?.code ?? inv.sunatCode,
        sunatMessage: doc.sunatStatus?.message ?? inv.sunatMessage,
      },
    });
  }

  /** Comunicación de baja (anulación) async. Estado intermedio VOID_PENDING (§3.5). */
  async voidInvoice(organizationId: string, invoiceId: string, reason: string): Promise<Invoice> {
    const inv = await this.prisma.invoice.findFirst({ where: { id: invoiceId, organizationId } });
    if (!inv) throw new NotFoundException('Comprobante no encontrado');
    if (inv.status !== InvoiceStatus.ACCEPTED) {
      throw new BadRequestException('Solo se puede anular un comprobante ACEPTADO');
    }
    if (!inv.externalId) throw new BadRequestException('Comprobante sin documentId del proveedor');

    const creds = await this.sunatConfig.getDecrypted(organizationId);
    await this.prisma.invoice.update({ where: { id: inv.id }, data: { status: InvoiceStatus.VOID_PENDING } });
    try {
      await this.apisunat.voidBill({ personaId: creds.personaId, token: creds.token }, inv.externalId, reason);
    } catch (e) {
      // No se aceptó para envío → revertir a ACCEPTED.
      await this.prisma.invoice.update({ where: { id: inv.id }, data: { status: InvoiceStatus.ACCEPTED } });
      throw new BadRequestException(`No se pudo iniciar la baja: ${(e as Error).message}`);
    }
    return (await this.prisma.invoice.findUnique({ where: { id: inv.id } }))!;
  }

  /** Emite una Nota de Crédito (07) que referencia un comprobante ACEPTADO. */
  async createCreditNote(
    organizationId: string,
    invoiceId: string,
    dto: { reason: string; discrepancyCode?: string; series?: string },
  ): Promise<Invoice> {
    const original = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, organizationId },
      include: { order: { include: { items: true } }, organization: true },
    });
    if (!original) throw new NotFoundException('Comprobante no encontrado');
    if (original.status !== InvoiceStatus.ACCEPTED) {
      throw new BadRequestException('Solo se puede emitir NC sobre un comprobante ACEPTADO');
    }
    if (original.documentType !== DocumentType.FACTURA && original.documentType !== DocumentType.BOLETA) {
      throw new BadRequestException('Solo se emite NC sobre factura o boleta');
    }
    if (!original.order || original.order.items.length === 0) {
      throw new BadRequestException('El comprobante original no tiene ítems para referenciar');
    }

    const creds = await this.sunatConfig.getDecrypted(organizationId);
    const series = dto.series ?? (original.documentType === DocumentType.FACTURA ? 'FC01' : 'BC01');
    const discrepancyCode = dto.discrepancyCode ?? '01';
    const number = await this.series.getNextNumber(organizationId, DocumentType.NOTA_CREDITO, series);
    const issueDate = limaDateString();
    const issueTime = limaTimeString();

    const customer: BuildParty = {
      identityTypeCode: IDENTITY_CODE[original.customerDocType],
      documentNumber: original.customerDoc ?? '00000000',
      name: original.customerName ?? 'CLIENTES VARIOS',
    };
    const lines: BuildLine[] = original.order.items.map((it) => ({
      description: it.name,
      quantity: Number(it.quantity),
      unitPriceWithIgv: Number(it.unitPrice),
      unitCode: it.unitCode,
      igvAffectation: it.igvAffectation,
      sunatProductCode: it.sunatProductCode ?? undefined,
    }));

    const built = buildDocument({
      documentType: DocumentType.NOTA_CREDITO,
      series,
      number,
      issueDate,
      issueTime,
      currency: original.currency,
      issuer: {
        ruc: original.organization.ruc,
        razonSocial: original.organization.razonSocial,
        address: original.organization.direccion ?? undefined,
        ubigeo: original.organization.ubigeo ?? undefined,
        establishmentCode: '0000',
      },
      customer,
      lines,
      reference: {
        documentType: original.documentType,
        series: original.series,
        number: original.number,
        discrepancyCode,
        reason: dto.reason,
      },
    });

    const subtotal = round2(
      built.totals.taxableAmount + built.totals.exemptAmount + built.totals.unaffectedAmount,
    );
    const nc = await this.prisma.invoice.create({
      data: {
        organizationId,
        orderId: null,
        documentType: DocumentType.NOTA_CREDITO,
        series,
        number,
        status: InvoiceStatus.PENDING,
        issueDate,
        currency: original.currency,
        subtotal,
        igv: built.totals.igv,
        total: built.totals.total,
        customerDocType: original.customerDocType,
        customerDoc: original.customerDoc,
        customerName: original.customerName,
        refDocumentType: original.documentType,
        refSeries: original.series,
        refNumber: original.number,
        discrepancyCode,
        reason: dto.reason,
      },
    });

    const apiCreds: ApiSunatCreds = { personaId: creds.personaId, token: creds.token };
    let send;
    try {
      send = await this.apisunat.sendBill(apiCreds, built.fileName, built.documentBody);
    } catch (e) {
      if (e instanceof ApiSunatUnavailableError) {
        this.logger.warn(`NC ${built.fileName} quedó PENDING: ${e.message}`);
        return nc;
      }
      await this.prisma.invoice.update({
        where: { id: nc.id },
        data: { status: InvoiceStatus.REJECTED, sunatMessage: (e as Error).message },
      });
      throw new BadRequestException(`SUNAT rechazó la nota de crédito: ${(e as Error).message}`);
    }
    await this.prisma.invoice.update({ where: { id: nc.id }, data: { externalId: send.documentId } });
    const final = await this.waitForFinal(apiCreds, send.documentId);
    return this.prisma.invoice.update({
      where: { id: nc.id },
      data: {
        status: mapStatus(final.status),
        sunatCode: final.sunatStatus?.code ?? null,
        sunatMessage: final.sunatStatus?.message ?? null,
        pdfUrl: this.apisunat.getPdfUrl(send.documentId, final.fileName ?? built.fileName),
      },
    });
  }

  /** Emite una Nota de Débito (08) que referencia un comprobante ACEPTADO. */
  async createDebitNote(
    organizationId: string,
    invoiceId: string,
    dto: { reason: string; discrepancyCode?: string; series?: string },
  ): Promise<Invoice> {
    const original = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, organizationId },
      include: { order: { include: { items: true } }, organization: true },
    });
    if (!original) throw new NotFoundException('Comprobante no encontrado');
    if (original.status !== InvoiceStatus.ACCEPTED) {
      throw new BadRequestException('Solo se puede emitir ND sobre un comprobante ACEPTADO');
    }
    if (original.documentType !== DocumentType.FACTURA && original.documentType !== DocumentType.BOLETA) {
      throw new BadRequestException('Solo se emite ND sobre factura o boleta');
    }
    if (!original.order || original.order.items.length === 0) {
      throw new BadRequestException('El comprobante original no tiene ítems para referenciar');
    }

    const creds = await this.sunatConfig.getDecrypted(organizationId);
    const series = dto.series ?? (original.documentType === DocumentType.FACTURA ? 'FD01' : 'BD01');
    const discrepancyCode = dto.discrepancyCode ?? '01'; // cat 10: 01 intereses por mora
    const number = await this.series.getNextNumber(organizationId, DocumentType.NOTA_DEBITO, series);
    const issueDate = limaDateString();
    const issueTime = limaTimeString();

    const customer: BuildParty = {
      identityTypeCode: IDENTITY_CODE[original.customerDocType],
      documentNumber: original.customerDoc ?? '00000000',
      name: original.customerName ?? 'CLIENTES VARIOS',
    };
    const lines: BuildLine[] = original.order.items.map((it) => ({
      description: it.name,
      quantity: Number(it.quantity),
      unitPriceWithIgv: Number(it.unitPrice),
      unitCode: it.unitCode,
      igvAffectation: it.igvAffectation,
      sunatProductCode: it.sunatProductCode ?? undefined,
    }));

    const built = buildDocument({
      documentType: DocumentType.NOTA_DEBITO,
      series,
      number,
      issueDate,
      issueTime,
      currency: original.currency,
      issuer: {
        ruc: original.organization.ruc,
        razonSocial: original.organization.razonSocial,
        address: original.organization.direccion ?? undefined,
        ubigeo: original.organization.ubigeo ?? undefined,
        establishmentCode: '0000',
      },
      customer,
      lines,
      reference: {
        documentType: original.documentType,
        series: original.series,
        number: original.number,
        discrepancyCode,
        reason: dto.reason,
      },
    });

    const subtotal = round2(
      built.totals.taxableAmount + built.totals.exemptAmount + built.totals.unaffectedAmount,
    );
    const nd = await this.prisma.invoice.create({
      data: {
        organizationId,
        orderId: null,
        documentType: DocumentType.NOTA_DEBITO,
        series,
        number,
        status: InvoiceStatus.PENDING,
        issueDate,
        currency: original.currency,
        subtotal,
        igv: built.totals.igv,
        total: built.totals.total,
        customerDocType: original.customerDocType,
        customerDoc: original.customerDoc,
        customerName: original.customerName,
        refDocumentType: original.documentType,
        refSeries: original.series,
        refNumber: original.number,
        discrepancyCode,
        reason: dto.reason,
      },
    });

    const apiCreds: ApiSunatCreds = { personaId: creds.personaId, token: creds.token };
    let send;
    try {
      send = await this.apisunat.sendBill(apiCreds, built.fileName, built.documentBody);
    } catch (e) {
      if (e instanceof ApiSunatUnavailableError) {
        this.logger.warn(`ND ${built.fileName} quedó PENDING: ${e.message}`);
        return nd;
      }
      await this.prisma.invoice.update({
        where: { id: nd.id },
        data: { status: InvoiceStatus.REJECTED, sunatMessage: (e as Error).message },
      });
      throw new BadRequestException(`SUNAT rechazó la nota de débito: ${(e as Error).message}`);
    }
    await this.prisma.invoice.update({ where: { id: nd.id }, data: { externalId: send.documentId } });
    const final = await this.waitForFinal(apiCreds, send.documentId);
    return this.prisma.invoice.update({
      where: { id: nd.id },
      data: {
        status: mapStatus(final.status),
        sunatCode: final.sunatStatus?.code ?? null,
        sunatMessage: final.sunatStatus?.message ?? null,
        pdfUrl: this.apisunat.getPdfUrl(send.documentId, final.fileName ?? built.fileName),
      },
    });
  }

  list(organizationId: string) {
    return this.prisma.invoice.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async get(organizationId: string, id: string) {
    const inv = await this.prisma.invoice.findFirst({ where: { id, organizationId } });
    if (!inv) throw new NotFoundException('Comprobante no encontrado');
    return inv;
  }

  /**
   * Datos para la representación impresa con marca propia (logo + pie).
   * Los ítems salen de la orden asociada; para NC/ND (orderId nulo) se toman
   * del comprobante referenciado.
   */
  async getForPrint(organizationId: string, id: string) {
    const inv = await this.prisma.invoice.findFirst({
      where: { id, organizationId },
      include: { order: { include: { items: true } }, organization: true },
    });
    if (!inv) throw new NotFoundException('Comprobante no encontrado');

    let items = inv.order?.items ?? [];
    if (items.length === 0 && inv.refSeries && inv.refNumber) {
      const ref = await this.prisma.invoice.findFirst({
        where: {
          organizationId,
          series: inv.refSeries,
          number: inv.refNumber,
          documentType: inv.refDocumentType ?? undefined,
        },
        include: { order: { include: { items: true } } },
      });
      items = ref?.order?.items ?? [];
    }

    const org = inv.organization;
    return {
      org: {
        razonSocial: org.razonSocial,
        nombreComercial: org.nombreComercial,
        ruc: org.ruc,
        direccion: org.direccion,
        logoUrl: org.logoUrl,
        pdfFooter: org.pdfFooter,
      },
      invoice: {
        id: inv.id,
        documentType: inv.documentType,
        series: inv.series,
        number: inv.number,
        status: inv.status,
        issueDate: inv.issueDate,
        currency: inv.currency,
        subtotal: inv.subtotal,
        igv: inv.igv,
        total: inv.total,
        customerName: inv.customerName,
        customerDoc: inv.customerDoc,
        customerDocType: inv.customerDocType,
        refSeries: inv.refSeries,
        refNumber: inv.refNumber,
        reason: inv.reason,
        detractionCode: inv.detractionCode,
        detractionPercent: inv.detractionPercent,
        detractionAmount: inv.detractionAmount,
        pdfUrl: inv.pdfUrl,
      },
      items: items.map((it) => ({
        name: it.name,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        unitCode: it.unitCode,
        total: it.total,
      })),
    };
  }
}
