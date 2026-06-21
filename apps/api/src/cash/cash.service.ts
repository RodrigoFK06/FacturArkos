import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CashMovementType, CashSessionStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { round2 } from '../common/utils/money';
import { CashMovementDto, CloseCashDto, OpenCashDto } from './dto';

@Injectable()
export class CashService {
  constructor(private readonly prisma: PrismaService) {}

  /** Caja abierta del cajero actual (si existe). */
  current(organizationId: string, userId: string) {
    return this.prisma.cashSession.findFirst({
      where: { organizationId, userId, status: CashSessionStatus.OPEN },
      include: { movements: true },
    });
  }

  async open(organizationId: string, userId: string, dto: OpenCashDto) {
    const already = await this.prisma.cashSession.findFirst({
      where: { organizationId, userId, status: CashSessionStatus.OPEN },
    });
    if (already) throw new BadRequestException('Ya tienes una caja abierta; ciérrala primero');

    return this.prisma.cashSession.create({
      data: {
        organizationId,
        establishmentId: dto.establishmentId,
        userId,
        openingAmount: dto.openingAmount,
      },
    });
  }

  async addMovement(organizationId: string, sessionId: string, dto: CashMovementDto) {
    const session = await this.requireOpen(organizationId, sessionId);
    const type =
      dto.type === 'INCOME'
        ? CashMovementType.INCOME
        : dto.type === 'EXPENSE'
          ? CashMovementType.EXPENSE
          : CashMovementType.WITHDRAWAL;
    return this.prisma.cashMovement.create({
      data: { cashSessionId: session.id, type, amount: dto.amount, concept: dto.concept },
    });
  }

  /** Cierre con arqueo: calcula el esperado y la diferencia vs lo contado. */
  async close(organizationId: string, sessionId: string, dto: CloseCashDto) {
    const session = await this.requireOpen(organizationId, sessionId);
    const movements = await this.prisma.cashMovement.findMany({ where: { cashSessionId: sessionId } });

    let expected = Number(session.openingAmount);
    for (const m of movements) {
      const amt = Number(m.amount);
      if (m.type === CashMovementType.INCOME || m.type === CashMovementType.SALE_INCOME) expected += amt;
      else if (m.type === CashMovementType.EXPENSE || m.type === CashMovementType.WITHDRAWAL) expected -= amt;
    }
    expected = round2(expected);

    return this.prisma.cashSession.update({
      where: { id: sessionId },
      data: {
        status: CashSessionStatus.CLOSED,
        closingAmount: dto.countedAmount,
        expectedAmount: expected,
        closedAt: new Date(),
        notes: dto.notes,
      },
      include: { movements: true },
    });
  }

  private async requireOpen(organizationId: string, sessionId: string) {
    const session = await this.prisma.cashSession.findFirst({
      where: { id: sessionId, organizationId },
    });
    if (!session) throw new NotFoundException('Sesión de caja no encontrada');
    if (session.status !== CashSessionStatus.OPEN) {
      throw new BadRequestException('La caja ya está cerrada');
    }
    return session;
  }
}
