import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InvoiceStatus, OrderStatus, StockMovementType } from '@prisma/client';
import { OrdersService } from './orders.service';

// Prisma mockeado: cancelSale no toca red ni DB real.
const make = (prisma: any) => new OrdersService(prisma, {} as any);

describe('OrdersService.cancelSale', () => {
  it('lanza NotFound si la venta no existe', async () => {
    const prisma = { order: { findFirst: jest.fn().mockResolvedValue(null) } };
    await expect(make(prisma).cancelSale('org', 'x')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('bloquea si la venta ya está anulada', async () => {
    const prisma = {
      order: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'o1',
          status: OrderStatus.CANCELLED,
          items: [],
          payments: [],
          invoice: null,
        }),
      },
    };
    await expect(make(prisma).cancelSale('org', 'o1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('bloquea si tiene comprobante aceptado (debe anularse por baja)', async () => {
    const prisma = {
      order: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'o1',
          status: OrderStatus.PAID,
          items: [],
          payments: [],
          invoice: { status: InvoiceStatus.ACCEPTED },
        }),
      },
    };
    await expect(make(prisma).cancelSale('org', 'o1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('repone stock (RETURN_IN) y marca la venta como CANCELLED', async () => {
    const tx = {
      warehouse: { findFirst: jest.fn().mockResolvedValue({ id: 'w1' }) },
      product: { findFirst: jest.fn().mockResolvedValue({ id: 'p1', tracksStock: true }) },
      stock: { upsert: jest.fn().mockResolvedValue({}) },
      stockMovement: { create: jest.fn().mockResolvedValue({}) },
      cashSession: { findFirst: jest.fn() },
      cashMovement: { create: jest.fn() },
      order: { update: jest.fn().mockResolvedValue({ id: 'o1', status: OrderStatus.CANCELLED }) },
    };
    const prisma = {
      order: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'o1',
          status: OrderStatus.PAID,
          cashSessionId: null,
          note: null,
          items: [{ productId: 'p1', quantity: 2 }],
          payments: [],
          invoice: null,
        }),
      },
      $transaction: (cb: any) => cb(tx),
    };

    const r = await make(prisma).cancelSale('org', 'o1', 'cliente se arrepintió');
    expect(tx.stockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: StockMovementType.RETURN_IN, quantity: 2 }),
      }),
    );
    expect(tx.order.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: OrderStatus.CANCELLED }) }),
    );
    expect(r.status).toBe(OrderStatus.CANCELLED);
  });
});
