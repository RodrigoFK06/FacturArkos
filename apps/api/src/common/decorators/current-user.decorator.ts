import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthUser } from '../types/auth-user';

/** Inyecta el AuthUser (del JWT). Uso: `@CurrentUser() user: AuthUser`. */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext): AuthUser | string => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthUser;
    return data ? user?.[data] : user;
  },
);

/** Atajo para el tenant: `@OrgId() organizationId: string`. */
export const OrgId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest();
  return (request.user as AuthUser)?.organizationId;
});
