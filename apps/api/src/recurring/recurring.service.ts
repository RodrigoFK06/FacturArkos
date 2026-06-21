import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DocumentType, RecurFrequency, RecurStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { OrdersService } from '../pos/orders.service';
import { CreateRecurringDto } from './dto';

function advance(from: Date, freq: RecurFrequency): Date {
  const d = new Date(from);
  if (freq === RecurFrequency.WEEKLY) d.setDate(d.getDate() + 7);
  else if (freq === RecurFrequency.YEARLY) d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d;
}

@Injectable()
export class RecurringService {
  private readonly logger = new Logger(RecurringService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
  ) {}

  list(organizationId: string) {
    return this.prisma.recurringPlan.findMany({
      where: { organizationId },
      include: { customer: true, items: true },
      orderBy: [{ status: 'asc' }, { nextRunAt: 'asc' }],
    });
  }

  async create(organizationId: string, dto: CreateRecurringDto) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, organizationId },
    });
    if (!customer) throw new BadRequestException('Cliente no válido');
    if (!dto.items?.length) throw new BadRequestException('Agrega al menos un ítem');

    const nextRunAt = dto.startDate ? new Date(dto.startDate) : new Date();
    return this.prisma.recurringPlan.create({
      data: {
        organizationId,
        customerId: dto.customerId,
        name: dto.name,
        documentType: dto.documentType ?? DocumentType.FACTURA,
        series: dto.series,
        frequency: dto.frequency ?? RecurFrequency.MONTHLY,
        emitOnRun: dto.emitOnRun ?? true,
        note: dto.note,
        nextRunAt,
        items: {
          create: dto.items.map((i) => ({
            productId: i.productId ?? null,
            name: i.name,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
          })),
        },
      },
      include: { customer: true, items: true },
    });
  }

  async setStatus(organizationId: string, id: string, status: RecurStatus) {
    const plan = await this.prisma.recurringPlan.findFirst({ where: { id, organizationId } });
    if (!plan) throw new NotFoundException('Plan no encontrado');
    return this.prisma.recurringPlan.update({ where: { id }, data: { status } });
  }

  /** Ejecuta un plan ahora (manual o por cron): crea la venta y, si corresponde, emite. */
  async runPlan(planId: string) {
    const plan = await this.prisma.recurringPlan.findUnique({
      where: { id: planId },
      include: { items: true },
    });
    if (!plan) throw new NotFoundException('Plan no encontrado');

    const est =
      (await this.prisma.establishment.findFirst({ where: { organizationId: plan.organizationId, isMain: true } })) ??
      (await this.prisma.establishment.findFirst({ where: { organizationId: plan.organizationId } }));
    if (!est) throw new BadRequestException('La organización no tiene establecimiento');

    const result = await this.orders.createSale(plan.organizationId, undefined as unknown as string, {
      establishmentId: est.id,
      customerId: plan.customerId,
      items: plan.items.map((i) => ({
        productId: i.productId ?? undefined,
        name: i.name,
        quantity: Number(i.quantity),
        unitPrice: Number(i.unitPrice),
      })),
      emit: plan.emitOnRun ? { documentType: plan.documentType as any, series: plan.series ?? undefined } : undefined,
      note: `Recurrente: ${plan.name}`,
    });

    // Avanzar la próxima ejecución (hasta superar "ahora" para no acumular atrasos).
    let next = advance(plan.nextRunAt, plan.frequency);
    const now = new Date();
    let guard = 0;
    while (next <= now && guard++ < 60) next = advance(next, plan.frequency);
    await this.prisma.recurringPlan.update({
      where: { id: planId },
      data: { lastRunAt: now, nextRunAt: next },
    });

    return result;
  }

  async runNow(organizationId: string, id: string) {
    const plan = await this.prisma.recurringPlan.findFirst({ where: { id, organizationId } });
    if (!plan) throw new NotFoundException('Plan no encontrado');
    return this.runPlan(id);
  }

  /** Cron diario: emite todos los planes ACTIVE cuya próxima ejecución ya venció. */
  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async dailyRun() {
    const due = await this.prisma.recurringPlan.findMany({
      where: { status: RecurStatus.ACTIVE, nextRunAt: { lte: new Date() } },
      select: { id: true, name: true },
    });
    this.logger.log(`Facturación recurrente: ${due.length} plan(es) por emitir.`);
    for (const p of due) {
      try {
        await this.runPlan(p.id);
      } catch (e) {
        this.logger.error(`Plan ${p.name} falló: ${(e as Error).message}`);
      }
    }
  }
}
