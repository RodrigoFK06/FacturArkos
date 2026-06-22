import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { TenancyService } from './tenancy.service';

const svc = (prisma: any) => new TenancyService(prisma);

describe('TenancyService.updateUser', () => {
  it('lanza NotFound si el usuario no existe', async () => {
    const prisma = { user: { findFirst: jest.fn().mockResolvedValue(null) } };
    await expect(svc(prisma).updateUser('org', 'x', { name: 'A' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('bloquea desactivar al propietario (OWNER)', async () => {
    const prisma = { user: { findFirst: jest.fn().mockResolvedValue({ id: 'u1', role: UserRole.OWNER }) } };
    await expect(svc(prisma).updateUser('org', 'u1', { active: false })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('bloquea cambiar el rol del propietario', async () => {
    const prisma = { user: { findFirst: jest.fn().mockResolvedValue({ id: 'u1', role: UserRole.OWNER }) } };
    await expect(
      svc(prisma).updateUser('org', 'u1', { role: UserRole.ADMIN }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('bloquea asignar el rol OWNER a otro usuario', async () => {
    const prisma = { user: { findFirst: jest.fn().mockResolvedValue({ id: 'u1', role: UserRole.CASHIER }) } };
    await expect(
      svc(prisma).updateUser('org', 'u1', { role: UserRole.OWNER }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('actualiza nombre y rol de un usuario normal', async () => {
    const update = jest.fn().mockResolvedValue({ id: 'u1' });
    const prisma = {
      user: { findFirst: jest.fn().mockResolvedValue({ id: 'u1', role: UserRole.CASHIER }), update },
    };
    await svc(prisma).updateUser('org', 'u1', { name: 'Nuevo', role: UserRole.MANAGER });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: 'Nuevo', role: UserRole.MANAGER }) }),
    );
  });

  it('hashea la contraseña cuando se envía (no la guarda en claro)', async () => {
    const update = jest.fn().mockResolvedValue({ id: 'u1' });
    const prisma = {
      user: { findFirst: jest.fn().mockResolvedValue({ id: 'u1', role: UserRole.CASHIER }), update },
    };
    await svc(prisma).updateUser('org', 'u1', { password: 'supersecreta' });
    const arg = update.mock.calls[0][0];
    expect(arg.data.passwordHash).toBeDefined();
    expect(arg.data.passwordHash).not.toBe('supersecreta');
  });
});
