import { BadRequestException, Injectable } from '@nestjs/common';
import { PaymentProvider } from '@prisma/client';
import { decrypt, encrypt, isEncrypted } from '../common/crypto/encrypt';
import { PrismaService } from '../common/prisma/prisma.service';
import { UpsertPaymentConfigDto } from './dto';

function safeDecrypt(value: string): string {
  return isEncrypted(value) ? decrypt(value) : value;
}

export interface DecryptedPaymentConfig {
  credentials: Record<string, string>;
  webhookSecret: string | null;
  testMode: boolean;
}

/**
 * Config de pasarela PER-TENANT (delta vs playbook, que la tenía global).
 * Cada negocio trae sus credenciales del proveedor; viven cifradas (P1).
 */
@Injectable()
export class PaymentConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string) {
    const rows = await this.prisma.paymentConfig.findMany({ where: { organizationId } });
    return rows.map((r) => ({
      provider: r.provider,
      enabled: r.enabled,
      testMode: r.testMode,
      hasCredentials: !!r.credentials,
      hasWebhookSecret: !!r.webhookSecret,
    }));
  }

  /** Credenciales en claro — uso restringido al servicio de integración. */
  async getDecrypted(organizationId: string, provider: PaymentProvider): Promise<DecryptedPaymentConfig> {
    const c = await this.prisma.paymentConfig.findUnique({
      where: { organizationId_provider: { organizationId, provider } },
    });
    if (!c || !c.enabled) {
      throw new BadRequestException(`${provider} no está configurado o está inhabilitado`);
    }
    return {
      credentials: JSON.parse(safeDecrypt(c.credentials)),
      webhookSecret: c.webhookSecret ? safeDecrypt(c.webhookSecret) : null,
      testMode: c.testMode,
    };
  }

  /** Secreto del webhook para validar entradas (resuelto por tenant). */
  async getWebhookSecret(organizationId: string, provider: PaymentProvider): Promise<string | null> {
    const c = await this.prisma.paymentConfig.findUnique({
      where: { organizationId_provider: { organizationId, provider } },
    });
    return c?.webhookSecret ? safeDecrypt(c.webhookSecret) : null;
  }

  /** PATCH preserva secretos no provistos. */
  async upsert(organizationId: string, dto: UpsertPaymentConfigDto) {
    const existing = await this.prisma.paymentConfig.findUnique({
      where: { organizationId_provider: { organizationId, provider: dto.provider } },
    });
    if (!existing && !dto.credentials) {
      throw new BadRequestException('credentials es requerido en la primera configuración');
    }

    const data = {
      enabled: dto.enabled ?? existing?.enabled ?? true,
      testMode: dto.testMode ?? existing?.testMode ?? true,
      ...(dto.credentials ? { credentials: encrypt(JSON.stringify(dto.credentials)) } : {}),
      ...(dto.webhookSecret ? { webhookSecret: encrypt(dto.webhookSecret) } : {}),
    };

    await this.prisma.paymentConfig.upsert({
      where: { organizationId_provider: { organizationId, provider: dto.provider } },
      create: {
        organizationId,
        provider: dto.provider,
        credentials: encrypt(JSON.stringify(dto.credentials ?? {})),
        webhookSecret: dto.webhookSecret ? encrypt(dto.webhookSecret) : null,
        enabled: data.enabled,
        testMode: data.testMode,
      },
      update: data,
    });

    return { ok: true, provider: dto.provider };
  }
}
