import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CashMovementType, OrderStatus, PaymentMethod, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { round2 } from '../common/utils/money';

@Injectable()
export class ReceivablesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Cuentas por cobrar: órdenes con saldo pendiente, con aging y datos de contacto. */
  async list(organizationId: string) {
    const orders = await this.prisma.order.findMany({
      where: { organizationId, status: OrderStatus.PENDING_PAYMENT },
      include: { customer: true, payments: true, invoice: true },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
      take: 300,
    });

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let totalPorCobrar = 0;
    let vencido = 0;
    let porVencer = 0;

    const cuentas = orders.map((o) => {
      const paid = round2(o.payments.reduce((a, p) => a + Number(p.amount), 0));
      const balance = round2(Number(o.total) - paid);
      const due = o.dueDate ?? null;
      const overdue = !!due && due < today;
      const daysOverdue = due ? Math.floor((today.getTime() - due.getTime()) / 86_400_000) : 0;
      totalPorCobrar += balance;
      if (overdue) vencido += balance;
      else porVencer += balance;
      return {
        orderId: o.id,
        fecha: o.createdAt,
        vence: due,
        diasVencido: overdue ? daysOverdue : 0,
        vencido: overdue,
        cliente: o.customer?.name ?? 'Clientes varios',
        clienteTelefono: o.customer?.phone ?? null,
        comprobante: o.invoice ? `${o.invoice.series}-${String(o.invoice.number).padStart(8, '0')}` : null,
        total: round2(Number(o.total)),
        pagado: paid,
        saldo: balance,
      };
    });

    return {
      totalPorCobrar: round2(totalPorCobrar),
      vencido: round2(vencido),
      porVencer: round2(porVencer),
      cuentas,
    };
  }

  /** Registra un abono/cobro contra una orden a crédito. Marca PAID si se salda. */
  async registerPayment(
    organizationId: string,
    orderId: string,
    dto: { method: PaymentMethod; amount: number; cashSessionId?: string },
  ) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, organizationId },
      include: { payments: true },
    });
    if (!order) throw new NotFoundException('Orden no encontrada');
    if (order.status === OrderStatus.PAID) throw new BadRequestException('La orden ya está pagada');
    if (dto.amount <= 0) throw new BadRequestException('El monto debe ser mayor a cero');

    const paid = round2(order.payments.reduce((a, p) => a + Number(p.amount), 0));
    const balance = round2(Number(order.total) - paid);
    const amount = round2(Math.min(dto.amount, balance));

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.create({
        data: {
          organizationId,
          orderId,
          method: dto.method,
          amount,
          status: PaymentStatus.APPROVED,
        },
      });
      if (dto.cashSessionId && dto.method === PaymentMethod.CASH) {
        await tx.cashMovement.create({
          data: {
            cashSessionId: dto.cashSessionId,
            type: CashMovementType.SALE_INCOME,
            amount,
            concept: `Cobro orden ${orderId}`,
          },
        });
      }
      if (round2(paid + amount) >= Number(order.total)) {
        await tx.order.update({ where: { id: orderId }, data: { status: OrderStatus.PAID, paidAt: new Date() } });
      }
    });

    return { orderId, abonado: amount, saldo: round2(balance - amount) };
  }
}
