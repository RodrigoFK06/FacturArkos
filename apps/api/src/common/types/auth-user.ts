import { UserRole } from '@prisma/client';

/**
 * Identidad autenticada extraída del JWT. El `organizationId` SIEMPRE proviene
 * de aquí (token), nunca del body de la request (Playbook: aislamiento tenant).
 */
export interface AuthUser {
  userId: string;
  organizationId: string;
  email: string;
  role: UserRole;
}

export interface JwtPayload {
  sub: string;
  org: string;
  email: string;
  role: UserRole;
}
