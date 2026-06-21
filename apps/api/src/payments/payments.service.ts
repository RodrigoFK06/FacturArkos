import { Injectable, Logger } from '@nestjs/common';
import { OrderStatus, PaymentMethod, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { round2 } from '../common/utils/money';

export interface ApprovedPaymentInput {
  /** ID externo del proveedor (idempotencia). */
  tagId: string;
  /** Referencia a nuestra orden. */
  externalReference: string;
  amount: number;
}

export type ApplyResult =
  | { status: 'applied' }
  | { status: 'duplicated' }
  | { status: 'requiresRefund' }
  | { status: 'amountMismatch'; expected: number; got: number }
  | { status: 'orderNotFound' };

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Aplica un pago aprobado de pasarela. Reúne los patrones del webhook (Playbook
   * §4.1): idempotencia por ID externo, guard de estado, match de monto desde BD
   * y lock optimista (`updateMany` condicional) en una transacción.
   */
  async applyApprovedPayment(
    organizationId: string,
    input: ApprovedPaymentInput,
  ): Promise<ApplyResult> {
    // Idempotencia por ID externo del proveedor (P4).
    const dup = await this.prisma.payment.findUnique({ where: { externalId: input.tagId } });
    if (dup) return { status: 'duplicated' };

    const order = await this.prisma.order.findFirst({
      where: { id: input.externalReference, organizationId },
      include: { payments: true },
    });
    if (!order) return { status: 'orderNotFound' };

    // Guard de estado: jamás aplicar sobre orden cerrada/cancelada.
    if (order.status !== OrderStatus.OPEN && order.status !== OrderStatus.PENDING_PAYMENT) {
      this.logger.warn(
        `Pago ${input.tagId} sobre orden ${order.id} en estado ${order.status} → requiresRefund`,
      );
      return { status: 'requiresRefund' };
    }

    // Match de monto contra el pendiente recalculado desde BD (P5).
    const approved = order.payments
      .filter((p) => p.status === PaymentStatus.APPROVED)
      .reduce((a, p) => a + Number(p.amount), 0);
    const remaining = round2(Number(order.total) - approved);
    if (Math.abs(input.amount - remaining) > 0.009) {
      this.logger.warn(`Monto no coincide: esperado ${remaining}, recibido ${input.amount}`);
      return { status: 'amountMismatch', expected: remaining, got: input.amount };
    }

    // Lock optimista: solo UNA entrega gana el flip condicional de estado.
    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.updateMany({
        where: { id: order.id, status: { in: [OrderStatus.OPEN, OrderStatus.PENDING_PAYMENT] } },
        data: { status: OrderStatus.PAID, paidAt: new Date() },
      });
      if (updated.count === 0) return { won: false };
      await tx.payment.create({
        data: {
          organizationId,
          orderId: order.id,
          method: PaymentMethod.NIUBIZ_QR,
          amount: input.amount,
          status: PaymentStatus.APPROVED,
          provider: 'NIUBIZ',
          externalId: input.tagId,
        },
      });
      return { won: true };
    });

    return result.won ? { status: 'applied' } : { status: 'duplicated' };
  }
}
