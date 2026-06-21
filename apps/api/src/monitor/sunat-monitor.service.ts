import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InvoiceStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { InvoicesService } from '../invoices/invoices.service';

/**
 * Monitoreo SUNAT — "revisión diaria de comprobantes".
 * Iguala (y mejora) el diferenciador estrella de la competencia: reconcilia a
 * diario el estado de todos los comprobantes no finales contra SUNAT, para que
 * nada quede pendiente/rechazado sin avisar (y evitar multas).
 */
@Injectable()
export class SunatMonitorService {
  private readonly logger = new Logger(SunatMonitorService.name);
  private lastRun: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly invoices: InvoicesService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async dailyReconcile(): Promise<void> {
    this.logger.log('Revisión diaria de comprobantes SUNAT…');
    const { checked } = await this.reconcileAll();
    this.logger.log(`Revisión diaria completada: ${checked} comprobantes`);
  }

  /** Reconcilia todos los comprobantes no finales de TODAS las organizaciones. */
  async reconcileAll(): Promise<{ checked: number }> {
    const pend = await this.prisma.invoice.findMany({
      where: {
        status: { in: [InvoiceStatus.PENDING, InvoiceStatus.VOID_PENDING] },
        externalId: { not: null },
      },
      select: { id: true, organizationId: true },
      take: 2000,
    });
    let checked = 0;
    for (const inv of pend) {
      try {
        await this.invoices.refreshStatus(inv.organizationId, inv.id);
        checked++;
      } catch (e) {
        this.logger.warn(`reconcile ${inv.id}: ${(e as Error).message}`);
      }
    }
    this.lastRun = new Date().toISOString();
    return { checked };
  }

  /** Reconcilia los pendientes de una sola organización ("Revisar ahora"). */
  async reconcileOrg(organizationId: string): Promise<{ checked: number }> {
    const pend = await this.prisma.invoice.findMany({
      where: {
        organizationId,
        status: { in: [InvoiceStatus.PENDING, InvoiceStatus.VOID_PENDING] },
        externalId: { not: null },
      },
      select: { id: true },
    });
    let checked = 0;
    for (const inv of pend) {
      try {
        await this.invoices.refreshStatus(organizationId, inv.id);
        checked++;
      } catch {
        /* se registra en refreshStatus */
      }
    }
    this.lastRun = new Date().toISOString();
    return { checked };
  }

  /** Salud de comprobantes ante SUNAT (para el panel). */
  async health(organizationId: string) {
    const groups = await this.prisma.invoice.groupBy({
      by: ['status'],
      where: { organizationId },
      _count: true,
    });
    const by: Record<string, number> = {};
    for (const g of groups) by[g.status] = g._count;

    const aceptados = by.ACCEPTED ?? 0;
    const pendientes = (by.PENDING ?? 0) + (by.VOID_PENDING ?? 0);
    const rechazados = by.REJECTED ?? 0;
    const total = Object.values(by).reduce((a, b) => a + b, 0);

    const problemas = await this.prisma.invoice.findMany({
      where: {
        organizationId,
        status: { in: [InvoiceStatus.REJECTED, InvoiceStatus.PENDING, InvoiceStatus.VOID_PENDING] },
      },
      select: { id: true, documentType: true, series: true, number: true, status: true, sunatMessage: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return {
      total,
      aceptados,
      pendientes,
      rechazados,
      anulados: by.VOIDED ?? 0,
      saludable: rechazados === 0 && pendientes === 0,
      ultimaRevision: this.lastRun,
      problemas,
    };
  }
}
