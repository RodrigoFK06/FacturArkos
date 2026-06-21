import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DocIdentityType, DocumentType, GuiaRemision, GuiaType, InvoiceStatus } from '@prisma/client';
import { ApiSunatUnavailableError } from '../apisunat/apisunat.errors';
import { ApiSunatCreds, ApiSunatService } from '../apisunat/apisunat.service';
import { ApiSunatStatus, ApiSunatStatusResult } from '../apisunat/apisunat.types';
import { PrismaService } from '../common/prisma/prisma.service';
import { limaDateString, limaTimeString } from '../common/utils/lima-time';
import { BillingSeriesService } from '../invoices/billing-series.service';
import { SunatConfigService } from '../sunat-config/sunat-config.service';
import { buildGre } from './gre.builder';
import { CreateGreDto } from './dto';

const IDENTITY_CODE: Record<DocIdentityType, string> = {
  NONE: '0',
  DNI: '1',
  CE: '4',
  RUC: '6',
  PASSPORT: '7',
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
export class GreService {
  private readonly logger = new Logger(GreService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sunatConfig: SunatConfigService,
    private readonly apisunat: ApiSunatService,
    private readonly series: BillingSeriesService,
  ) {}

  list(organizationId: string) {
    return this.prisma.guiaRemision.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async get(organizationId: string, id: string) {
    const g = await this.prisma.guiaRemision.findFirst({
      where: { id, organizationId },
      include: { items: true },
    });
    if (!g) throw new NotFoundException('Guía no encontrada');
    return g;
  }

  /** Emite una GRE remitente (mismo patrón outbox-lite + polling que comprobantes). */
  async emit(organizationId: string, dto: CreateGreDto): Promise<GuiaRemision> {
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) throw new NotFoundException('Organización no encontrada');

    const creds = await this.sunatConfig.getDecrypted(organizationId);
    const series = dto.series ?? 'T001';
    const number = await this.series.getNextNumber(organizationId, DocumentType.GUIA_REMISION, series);
    const issueDate = limaDateString();
    const issueTime = limaTimeString();
    const transferDate = dto.transferDate ?? issueDate;
    const weightUnit = dto.weightUnit ?? 'KGM';
    const transferReason = dto.transferReason ?? '01';

    const built = buildGre({
      series,
      number,
      issueDate,
      issueTime,
      issuer: { ruc: org.ruc, razonSocial: org.razonSocial },
      receiver: {
        docTypeCode: IDENTITY_CODE[dto.receiverDocType],
        doc: dto.receiverDoc,
        name: dto.receiverName,
      },
      transferReason,
      transferDate,
      totalWeight: dto.totalWeight,
      weightUnit,
      origin: { ubigeo: dto.originUbigeo, address: dto.originAddress },
      destination: { ubigeo: dto.destUbigeo, address: dto.destAddress },
      transport: {
        mode: dto.transport.mode,
        carrierRuc: dto.transport.carrierRuc,
        carrierName: dto.transport.carrierName,
        carrierMtc: dto.transport.carrierMtc,
        plate: dto.transport.plate,
        driverDocTypeCode: dto.transport.driverDocType ? IDENTITY_CODE[dto.transport.driverDocType] : undefined,
        driverDoc: dto.transport.driverDoc,
        driverName: dto.transport.driverName,
        driverFamilyName: dto.transport.driverFamilyName,
        driverLicense: dto.transport.driverLicense,
      },
      related:
        dto.relatedDocType && dto.relatedSeries && dto.relatedNumber != null
          ? { docTypeCode: dto.relatedDocType, series: dto.relatedSeries, number: dto.relatedNumber }
          : undefined,
      lines: dto.items.map((i) => ({
        description: i.description,
        quantity: i.quantity,
        unitCode: i.unitCode ?? 'NIU',
      })),
    });

    // Persistir PENDING antes de enviar (outbox-lite, P6).
    let guia = await this.prisma.guiaRemision.create({
      data: {
        organizationId,
        type: GuiaType.REMITENTE,
        series,
        number,
        status: InvoiceStatus.PENDING,
        issueDate,
        receiverDocType: dto.receiverDocType,
        receiverDoc: dto.receiverDoc,
        receiverName: dto.receiverName,
        transferReason,
        transferDate,
        totalWeight: dto.totalWeight,
        weightUnit,
        originUbigeo: dto.originUbigeo,
        originAddress: dto.originAddress,
        destUbigeo: dto.destUbigeo,
        destAddress: dto.destAddress,
        transportMode: dto.transport.mode,
        carrierRuc: dto.transport.carrierRuc,
        carrierName: dto.transport.carrierName,
        vehiclePlate: dto.transport.plate,
        driverDocType: dto.transport.driverDocType ?? null,
        driverDoc: dto.transport.driverDoc,
        driverName: dto.transport.driverName,
        relatedDocType: dto.relatedDocType,
        relatedSeries: dto.relatedSeries,
        relatedNumber: dto.relatedNumber,
        items: {
          create: dto.items.map((i) => ({
            productId: i.productId ?? null,
            description: i.description,
            quantity: i.quantity,
            unitCode: i.unitCode ?? 'NIU',
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
        this.logger.warn(`GRE ${built.fileName} quedó PENDING: ${e.message}`);
        return guia;
      }
      await this.prisma.guiaRemision.update({
        where: { id: guia.id },
        data: { status: InvoiceStatus.REJECTED, sunatMessage: (e as Error).message },
      });
      throw new BadRequestException(`SUNAT rechazó la guía: ${(e as Error).message}`);
    }

    guia = await this.prisma.guiaRemision.update({
      where: { id: guia.id },
      data: { externalId: send.documentId },
    });

    const final = await this.waitForFinal(apiCreds, send.documentId);
    return this.prisma.guiaRemision.update({
      where: { id: guia.id },
      data: {
        status: mapStatus(final.status),
        sunatCode: final.sunatStatus?.code ?? null,
        sunatMessage: final.sunatStatus?.message ?? null,
        pdfUrl: this.apisunat.getPdfUrl(send.documentId, final.fileName ?? built.fileName),
      },
    });
  }

  async refreshStatus(organizationId: string, id: string): Promise<GuiaRemision> {
    const guia = await this.prisma.guiaRemision.findFirst({ where: { id, organizationId } });
    if (!guia) throw new NotFoundException('Guía no encontrada');
    if (!guia.externalId) return guia;
    const creds = await this.sunatConfig.getDecrypted(organizationId);
    try {
      const doc = await this.apisunat.getById(
        { personaId: creds.personaId, token: creds.token },
        guia.externalId,
      );
      return this.prisma.guiaRemision.update({
        where: { id: guia.id },
        data: {
          status: mapStatus(doc.status),
          sunatCode: doc.sunatStatus?.code ?? guia.sunatCode,
          sunatMessage: doc.sunatStatus?.message ?? guia.sunatMessage,
        },
      });
    } catch (e) {
      this.logger.warn(`refreshStatus GRE falló: ${(e as Error).message}`);
      return guia;
    }
  }

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
        this.logger.warn(`getById GRE falló (no aborta): ${(e as Error).message}`);
      }
      await sleep(wait);
      wait = Math.min(Math.round(wait * 1.4), 8_000);
    }
    return last;
  }
}
