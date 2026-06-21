import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateEstablishmentDto, CreateUserDto, UpdateOrganizationDto } from './dto';

@Injectable()
export class TenancyService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Organización ──
  async getOrganization(organizationId: string) {
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) throw new NotFoundException('Organización no encontrada');
    return org;
  }

  updateOrganization(organizationId: string, dto: UpdateOrganizationDto) {
    return this.prisma.organization.update({ where: { id: organizationId }, data: dto });
  }

  // ── Establecimientos ──
  listEstablishments(organizationId: string) {
    return this.prisma.establishment.findMany({
      where: { organizationId },
      orderBy: { code: 'asc' },
    });
  }

  async createEstablishment(organizationId: string, dto: CreateEstablishmentDto) {
    const dup = await this.prisma.establishment.findUnique({
      where: { organizationId_code: { organizationId, code: dto.code } },
    });
    if (dup) throw new ConflictException('Ya existe un establecimiento con ese código');
    return this.prisma.establishment.create({
      data: { organizationId, code: dto.code, name: dto.name, address: dto.address },
    });
  }

  // ── Usuarios ──
  listUsers(organizationId: string) {
    return this.prisma.user.findMany({
      where: { organizationId },
      select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createUser(organizationId: string, dto: CreateUserDto) {
    const dup = await this.prisma.user.findUnique({
      where: { organizationId_email: { organizationId, email: dto.email } },
    });
    if (dup) throw new ConflictException('Ya existe un usuario con ese correo');
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: { organizationId, email: dto.email, name: dto.name, passwordHash, role: dto.role },
    });
    return { id: user.id, email: user.email, name: user.name, role: user.role };
  }
}
