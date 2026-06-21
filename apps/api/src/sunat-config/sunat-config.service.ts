import { BadRequestException, Injectable } from '@nestjs/common';
import { SunatProvider } from '@prisma/client';
import { env } from '../common/config/env';
import { decrypt, isEncrypted, maskTail, toStored } from '../common/crypto/encrypt';
import { PrismaService } from '../common/prisma/prisma.service';
import { UpsertSunatConfigDto } from './dto';

/** Credenciales SUNAT desencriptadas. Uso restringido al servicio de integración. */
export interface SunatCredentials {
  provider: SunatProvider;
  personaId: string;
  token: string;
  testMode: boolean;
}

/** Desencripta tolerando valores legacy en texto plano. */
function safeDecrypt(value: string): string {
  return isEncrypted(value) ? decrypt(value) : value;
}

@Injectable()
export class SunatConfigService {
  constructor(private readonly prisma: PrismaService) {}

  /** Vista para el admin: secretos SIEMPRE enmascarados (Playbook §2). */
  async get(organizationId: string) {
    const c = await this.prisma.sunatConfig.findUnique({ where: { organizationId } });
    if (!c) return { configured: false };
    return {
      configured: true,
      provider: c.provider,
      testMode: c.testMode,
      personaIdMasked: maskTail(safeDecrypt(c.personaId)),
      tokenMasked: maskTail(safeDecrypt(c.token)),
    };
  }

  /**
   * Credenciales en claro — ÚNICA ruta que desencripta. La llama solo el servicio
   * de facturación, justo antes de armar la request a APISUNAT.
   * Cae al fallback de env (cuenta dev "arkosprueba") si el tenant no configuró.
   */
  async getDecrypted(organizationId: string): Promise<SunatCredentials> {
    const c = await this.prisma.sunatConfig.findUnique({ where: { organizationId } });
    if (c) {
      return {
        provider: c.provider,
        personaId: safeDecrypt(c.personaId),
        token: safeDecrypt(c.token),
        testMode: c.testMode,
      };
    }
    // Fallback dev (P7: explícito, no dummy). En prod cada tenant DEBE configurar.
    const dev = env.apisunat();
    if (!dev.personaId || !dev.token) {
      throw new BadRequestException(
        'SUNAT no configurado para esta organización (falta personaId/token)',
      );
    }
    return {
      provider: SunatProvider.APISUNAT,
      personaId: dev.personaId,
      token: dev.token,
      testMode: dev.testMode,
    };
  }

  /** Crea o actualiza; PATCH sin secreto preserva el existente. */
  async upsert(organizationId: string, dto: UpsertSunatConfigDto) {
    const existing = await this.prisma.sunatConfig.findUnique({ where: { organizationId } });

    if (!existing && (!dto.personaId || !dto.token)) {
      throw new BadRequestException('personaId y token son requeridos en la primera configuración');
    }

    const data = {
      provider: dto.provider ?? existing?.provider ?? SunatProvider.APISUNAT,
      testMode: dto.testMode ?? existing?.testMode ?? true,
      ...(dto.personaId ? { personaId: toStored(dto.personaId) } : {}),
      ...(dto.token ? { token: toStored(dto.token) } : {}),
    };

    await this.prisma.sunatConfig.upsert({
      where: { organizationId },
      create: {
        organizationId,
        provider: data.provider,
        testMode: data.testMode,
        personaId: toStored(dto.personaId!),
        token: toStored(dto.token!),
      },
      update: data,
    });

    return this.get(organizationId);
  }
}
