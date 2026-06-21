import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DocIdentityType } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { PeruApiService } from '../peru-api/peru-api.service';
import { CreateCustomerDto } from './dto';

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly peru: PeruApiService,
  ) {}

  list(organizationId: string, q?: string) {
    return this.prisma.customer.findMany({
      where: {
        organizationId,
        ...(q
          ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { documentNumber: { contains: q } }] }
          : {}),
      },
      orderBy: { name: 'asc' },
      take: 50,
    });
  }

  async get(organizationId: string, id: string) {
    const c = await this.prisma.customer.findFirst({ where: { id, organizationId } });
    if (!c) throw new NotFoundException('Cliente no encontrado');
    return c;
  }

  /** Crea o actualiza por (tenant, tipoDoc, número). */
  create(organizationId: string, dto: CreateCustomerDto) {
    return this.prisma.customer.upsert({
      where: {
        organizationId_identityType_documentNumber: {
          organizationId,
          identityType: dto.identityType,
          documentNumber: dto.documentNumber,
        },
      },
      create: { organizationId, ...dto },
      update: { name: dto.name, address: dto.address, email: dto.email, phone: dto.phone },
    });
  }

  /** Consulta RENIEC/SUNAT por documento y persiste el cliente (RF-POS-018). */
  async lookupAndSave(organizationId: string, type: string, number: string) {
    const t = type.toUpperCase();
    if (t === 'RUC') {
      const data = await this.peru.lookupRuc(number);
      return this.create(organizationId, {
        identityType: DocIdentityType.RUC,
        documentNumber: number,
        name: data.name,
        address: data.address,
      });
    }
    if (t === 'DNI') {
      const data = await this.peru.lookupDni(number);
      return this.create(organizationId, {
        identityType: DocIdentityType.DNI,
        documentNumber: number,
        name: data.name,
      });
    }
    throw new BadRequestException('Tipo de documento no soportado para consulta (use DNI o RUC)');
  }
}
