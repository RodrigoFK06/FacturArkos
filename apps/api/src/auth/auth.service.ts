import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { env } from '../common/config/env';
import { PrismaService } from '../common/prisma/prisma.service';
import { JwtPayload } from '../common/types/auth-user';
import { LoginDto, RegisterDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /** Alta de negocio: crea organización + usuario OWNER + estructura base. */
  async register(dto: RegisterDto) {
    const exists = await this.prisma.organization.findUnique({ where: { ruc: dto.ruc } });
    if (exists) throw new ConflictException('El RUC ya está registrado');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const org = await this.prisma.organization.create({
      data: {
        ruc: dto.ruc,
        razonSocial: dto.razonSocial,
        establishments: { create: { code: '0000', name: 'Principal', isMain: true } },
        warehouses: { create: { name: 'Principal', isMain: true } },
        priceLists: { create: { name: 'General', isDefault: true } },
        units: {
          create: [
            { code: 'NIU', name: 'Unidad' },
            { code: 'ZZ', name: 'Servicio' },
            { code: 'KGM', name: 'Kilogramo' },
          ],
        },
        users: { create: { email: dto.email, passwordHash, name: dto.name, role: UserRole.OWNER } },
      },
      include: { users: true },
    });

    return this.issueToken(org.users[0], org.id);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email, active: true },
    });
    if (!user) throw new UnauthorizedException('Credenciales inválidas');

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Credenciales inválidas');

    return this.issueToken(user, user.organizationId);
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { organization: true },
    });
    if (!user) throw new UnauthorizedException();
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organization: {
        id: user.organization.id,
        ruc: user.organization.ruc,
        razonSocial: user.organization.razonSocial,
        nombreComercial: user.organization.nombreComercial,
      },
    };
  }

  private async issueToken(user: User, organizationId: string) {
    const payload: JwtPayload = {
      sub: user.id,
      org: organizationId,
      email: user.email,
      role: user.role,
    };
    const access_token = await this.jwt.signAsync(payload, {
      secret: env.jwtSecret(),
      // `ms`-style string; el tipo StringValue no admite string genérico.
      expiresIn: env.jwtExpiresIn() as unknown as number,
    });
    return {
      access_token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, organizationId },
    };
  }
}
