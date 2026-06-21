import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DocIdentityType, DocumentType, InvoiceStatus, TaxDocKind, TaxDocument } from '@prisma/client';
import { ApiSunatUnavailableError } from '../apisunat/apisunat.errors';
import { ApiSunatCreds, ApiSunatService } from '../apisunat/apisunat.service';
import { ApiSunatStatus, ApiSunatStatusResult } from '../apisunat/apisunat.types';
import { buildTaxDocument, TaxDocReference } from '../apisunat/tax-doc.builder';
import { PrismaService } from '../common/prisma/prisma.service';
import { limaDateString } from '../common/utils/lima-time';
import { round2 } from '../common/utils/money';
import { SunatConfigService } from '../sunat-config/sunat-config.service';
import { BillingSeriesService } from '../invoices/billing-series.service';
import { CreateTaxDocDto } from './dto';

const IDENTITY_CODE: Record<DocIdentityType, string> = {
  NONE: '0',
  DNI: '1',
  CE: '4',
  RUC: '6',
  PASSPORT: '7',
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Mapea el vocabulario de APISUNAT a nuestro dominio (idéntico a invoices). */
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

/** kind → metadatos por defecto (serie, tipo de doc SUNAT, % régimen general). */
const KIND_META: Record<TaxDocKind, { docType: DocumentType; series: string; percent: number }> = {
  RETENCION: { docType: DocumentType.RETENCION, series: 'R001', percent: 3 },
  PERCEPCION: { docType: DocumentType.PERCEPCION, series: 'P001', percent: 2 },
};

@Injectable()
export class TaxDocService {
  private readonly logger = new Logger(TaxDocService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sunatConfig: SunatConfigService,
    private readonly apisunat: ApiSunatService,
    private readonly series: BillingSeriesService,
  ) {}

  list(organizationId: string, kind?: TaxDocKind) {
    return this.prisma.taxDocument.findMany({
      where: { organizationId, ...(kind ? { kind } : {}) },
      include: { refs: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async get(organizationId: string, id: string) {
    const doc = await this.prisma.taxDocument.findFirst({
      where: { id, organizationId },
      include: { refs: true },
    });
    if (!doc) throw new NotFoundException('Comprobante no encontrado');
    return doc;
  }

  /** Emite un Comprobante de Retención (20) o Percepción (40). Outbox-lite (P6). */
  async create(organizationId: string, kind: TaxDocKind, dto: CreateTaxDocDto): Promise<TaxDocument> {
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) throw new NotFoundException('Organización no encontrada');

    if (kind === TaxDocKind.RETENCION && !org.retentionAgent) {
      throw new BadRequestException('La organización no está marcada como agente de retención');
    }
    if (kind === TaxDocKind.PERCEPCION && !org.perceptionAgent) {
      throw new BadRequestException('La organización no está marcada como agente de percepción');
    }
    if (dto.partyDocType !== DocIdentityType.RUC) {
      throw new BadRequestException('La contraparte debe identificarse con RUC');
    }

    const meta = KIND_META[kind];
    const percent =
      dto.percent ?? meta.percent;
    const regime =
      dto.regime ??
      (kind === TaxDocKind.RETENCION ? org.retentionRegime : org.perceptionRegime) ??
      '01';
    const series = dto.series ?? meta.series;

    // Recalcular montos desde los totales de cada comprobante (P5: nunca confiar en el front).
    const refs: TaxDocReference[] = dto.refs.map((r) => {
      const taxAmount = round2((r.total * percent) / 100);
      const netPaid = round2(r.total - taxAmount);
      return {
        docTypeCode: r.docType,
        series: r.series,
        number: r.number,
        issueDate: r.issueDate,
        currency: r.currency ?? 'PEN',
        total: round2(r.total),
        taxAmount,
        netPaid,
        exchangeRate: r.exchangeRate,
      };
    });

    const creds = await this.sunatConfig.getDecrypted(organizationId);
    const number = await this.series.getNextNumber(organizationId, meta.docType, series);
    const issueDate = limaDateString();

    const built = buildTaxDocument({
      kind,
      series,
      number,
      issueDate,
      currency: 'PEN',
      regime,
      percent,
      issuer: {
        ruc: org.ruc,
        razonSocial: org.razonSocial,
        address: org.direccion ?? undefined,
        ubigeo: org.ubigeo ?? undefined,
      },
      party: {
        identityTypeCode: IDENTITY_CODE[dto.partyDocType],
        documentNumber: dto.partyDoc,
        name: dto.partyName,
      },
      refs,
    });

    // Persistir PENDING ANTES de tocar APISUNAT (outbox-lite, P6).
    const doc = await this.prisma.taxDocument.create({
      data: {
        organizationId,
        kind,
        series,
        number,
        status: InvoiceStatus.PENDING,
        issueDate,
        currency: 'PEN',
        regime,
        percent,
        partyDocType: dto.partyDocType,
        partyDoc: dto.partyDoc,
        partyName: dto.partyName,
        totalBase: built.totals.totalBase,
        totalTax: built.totals.totalTax,
        totalPaid: built.totals.totalPaid,
        refs: {
          create: refs.map((r) => ({
            docType: r.docTypeCode,
            series: r.series,
            number: r.number,
            issueDate: r.issueDate,
            currency: r.currency,
            total: r.total,
            taxAmount: r.taxAmount,
            netPaid: r.netPaid,
            exchangeRate: r.exchangeRate ?? null,
          })),
        },
      },
    });

    const apiCreds: ApiSunatCreds = { personaId: creds.personaId, token: creds.token };
    let send;
    try {
      send = await this.apisunat.sendBill(apiCreds, built.fileName, built.documentBody);
    } catch (e) {
      if (e instanceof ApiSunatUnavailableError) {
        this.logger.warn(`${kind} ${built.fileName} quedó PENDING: ${e.message}`);
        return doc;
      }
      await this.prisma.taxDocument.update({
        where: { id: doc.id },
        data: { status: InvoiceStatus.REJECTED, sunatMessage: (e as Error).message },
      });
      throw new BadRequestException(`SUNAT rechazó el comprobante: ${(e as Error).message}`);
    }

    await this.prisma.taxDocument.update({ where: { id: doc.id }, data: { externalId: send.documentId } });
    const final = await this.waitForFinal(apiCreds, send.documentId);
    return this.prisma.taxDocument.update({
      where: { id: doc.id },
      data: {
        status: mapStatus(final.status),
        sunatCode: final.sunatStatus?.code ?? null,
        sunatMessage: final.sunatStatus?.message ?? null,
        pdfUrl: this.apisunat.getPdfUrl(send.documentId, final.fileName ?? built.fileName),
      },
    });
  }

  /** Reconciliación de los que quedaron PENDING (endpoint o cron). */
  async refreshStatus(organizationId: string, id: string): Promise<TaxDocument> {
    const doc = await this.prisma.taxDocument.findFirst({ where: { id, organizationId } });
    if (!doc) throw new NotFoundException('Comprobante no encontrado');
    if (!doc.externalId) return doc;

    const creds = await this.sunatConfig.getDecrypted(organizationId);
    let res: ApiSunatStatusResult;
    try {
      res = await this.apisunat.getById({ personaId: creds.personaId, token: creds.token }, doc.externalId);
    } catch (e) {
      this.logger.warn(`refreshStatus getById falló: ${(e as Error).message}`);
      return doc;
    }
    return this.prisma.taxDocument.update({
      where: { id: doc.id },
      data: {
        status: mapStatus(res.status),
        sunatCode: res.sunatStatus?.code ?? doc.sunatCode,
        sunatMessage: res.sunatStatus?.message ?? doc.sunatMessage,
      },
    });
  }

  /** Polling sincrónico hasta 30s por el estado final (backoff exponencial). */
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
        const res = await this.apisunat.getById(creds, documentId);
        last = res;
        if (res.status !== 'PENDIENTE') return res;
      } catch (e) {
        this.logger.warn(`getById falló (no aborta el loop): ${(e as Error).message}`);
      }
      await sleep(wait);
      wait = Math.min(Math.round(wait * 1.4), 8_000);
    }
    return last;
  }
}
