import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CommercialStatus } from '@prisma/client';
import { CommercialService } from './commercial.service';

const svc = (prisma: any) => new CommercialService(prisma, {} as any);

describe('CommercialService.cancel', () => {
  it('lanza NotFound si el documento no existe', async () => {
    const prisma = { commercialDoc: { findFirst: jest.fn().mockResolvedValue(null) } };
    await expect(svc(prisma).cancel('org', 'x')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('anula un documento abierto', async () => {
    const update = jest.fn().mockResolvedValue({ id: 'c1', status: CommercialStatus.ANULADA });
    const prisma = {
      commercialDoc: {
        findFirst: jest.fn().mockResolvedValue({ id: 'c1', status: CommercialStatus.ABIERTA }),
        update,
      },
    };
    await svc(prisma).cancel('org', 'c1');
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: CommercialStatus.ANULADA } }),
    );
  });

  it('bloquea anular un documento ya convertido', async () => {
    const prisma = {
      commercialDoc: {
        findFirst: jest.fn().mockResolvedValue({ id: 'c1', status: CommercialStatus.CONVERTIDA }),
      },
    };
    await expect(svc(prisma).cancel('org', 'c1')).rejects.toBeInstanceOf(BadRequestException);
  });
});
