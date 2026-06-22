import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  CreateEstablishmentDto,
  CreateUserDto,
  UpdateEstablishmentDto,
  UpdateOrganizationDto,
  UpdateUserDto,
} from './dto';

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
  listEstablishments(organizationId: string, includeInactive = false) {
    return this.prisma.establishment.findMany({
      where: { organizationId, ...(includeInactive ? {} : { active: true }) },
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

  async updateEstablishment(organizationId: string, id: string, dto: UpdateEstablishmentDto) {
    const est = await this.prisma.establishment.findFirst({ where: { id, organizationId } });
    if (!est) throw new NotFoundException('Establecimiento no encontrado');
    if (est.isMain && dto.active === false) {
      throw new BadRequestException('No puedes desactivar el establecimiento principal');
    }
    return this.prisma.establishment.update({ where: { id }, data: dto });
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

  async updateUser(organizationId: string, id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findFirst({ where: { id, organizationId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    // El OWNER es la cuenta dueña del registro: no se desactiva ni se le cambia el rol.
    if (user.role === UserRole.OWNER && (dto.active === false || (dto.role && dto.role !== UserRole.OWNER))) {
      throw new BadRequestException('No puedes desactivar ni cambiar el rol del propietario');
    }
    // El rol OWNER no se asigna desde aquí (evita dos propietarios).
    if (dto.role === UserRole.OWNER && user.role !== UserRole.OWNER) {
      throw new BadRequestException('No puedes asignar el rol de propietario');
    }
    const data: {
      name?: string;
      role?: UserRole;
      active?: boolean;
      passwordHash?: string;
    } = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.active !== undefined) data.active = dto.active;
    if (dto.password) data.passwordHash = await bcrypt.hash(dto.password, 10);
    const updated = await this.prisma.user.update({
      where: { id },
      data,
      select: { id: true, email: true, name: true, role: true, active: true },
    });
    return updated;
  }
}
