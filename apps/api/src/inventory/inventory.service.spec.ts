import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InventoryService } from './inventory.service';

const svc = (prisma: any) => new InventoryService(prisma);

describe('InventoryService.updateWarehouse', () => {
  it('lanza NotFound si el almacén no existe', async () => {
    const prisma = { warehouse: { findFirst: jest.fn().mockResolvedValue(null) } };
    await expect(svc(prisma).updateWarehouse('org', 'x', { name: 'X' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('bloquea desactivar el almacén principal', async () => {
    const prisma = {
      warehouse: { findFirst: jest.fn().mockResolvedValue({ id: 'w1', isMain: true }) },
    };
    await expect(
      svc(prisma).updateWarehouse('org', 'w1', { active: false }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('actualiza un almacén secundario', async () => {
    const update = jest.fn().mockResolvedValue({ id: 'w1' });
    const prisma = {
      warehouse: { findFirst: jest.fn().mockResolvedValue({ id: 'w1', isMain: false }), update },
    };
    await svc(prisma).updateWarehouse('org', 'w1', { name: 'Depósito' });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: 'Depósito' }) }),
    );
  });
});
