import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from '../../common/decorators/roles.decorator';
import { env } from '../../common/config/env';
import { JwtPayload } from '../../common/types/auth-user';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest();
    const header: string | undefined = req.headers['authorization'];
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token de acceso faltante');
    }
    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(header.slice(7), {
        secret: env.jwtSecret(),
      });
      // El organizationId vive en el token, nunca en el body (aislamiento tenant).
      req.user = {
        userId: payload.sub,
        organizationId: payload.org,
        email: payload.email,
        role: payload.role,
      };
      return true;
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }
  }
}
