import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

/** Restringe un endpoint a ciertos roles. Uso: `@Roles('OWNER', 'ADMIN')`. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

/** Marca un endpoint como público (sin JWT). Uso: `@Public()`. */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
