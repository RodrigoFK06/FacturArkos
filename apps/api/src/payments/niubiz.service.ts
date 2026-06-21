import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PaymentProvider } from '@prisma/client';
import axios from 'axios';
import { PrismaService } from '../common/prisma/prisma.service';
import { limaTomorrowCompact } from '../common/utils/lima-time';
import { round2 } from '../common/utils/money';
import { PaymentConfigService } from './payment-config.service';

interface TokenCacheEntry {
  token: string;
  expiresAt: number;
}

/**
 * Niubiz QR Simple (Playbook §4.1). Credenciales PER-TENANT.
 * Flujo: Basic Auth → JWT (cacheado con margen 60s) → POST qr/ascii → tagImg.
 * El monto se calcula desde la BD (P5), nunca del cliente.
 *
 * ⚠️ Las rutas exactas de los endpoints Niubiz deben reconciliarse con su doc /
 * con el `niubiz.service.ts` de RestHUB. Bases configurables por env.
 */
@Injectable()
export class NiubizService {
  private readonly logger = new Logger(NiubizService.name);
  private readonly tokenCache = new Map<string, TokenCacheEntry>();

  private readonly securityUrl = process.env.NIUBIZ_SECURITY_URL ?? 'https://apitestenv.vnforapps.com';
  private readonly qrUrl = process.env.NIUBIZ_QR_URL ?? 'https://apitestenv.vnforapps.com';

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentConfig: PaymentConfigService,
  ) {}

  /** Pendiente de cobro recalculado desde BD (P5). */
  async computeRemaining(organizationId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, organizationId },
      include: { payments: true },
    });
    if (!order) throw new NotFoundException('Orden no encontrada');
    const approved = order.payments
      .filter((p) => p.status === 'APPROVED')
      .reduce((a, p) => a + Number(p.amount), 0);
    return { order, remaining: round2(Number(order.total) - approved) };
  }

  async generateQr(organizationId: string, orderId: string) {
    const { order, remaining } = await this.computeRemaining(organizationId, orderId);
    if (remaining <= 0) throw new BadRequestException('La orden ya está pagada');

    const cfg = await this.paymentConfig.getDecrypted(organizationId, PaymentProvider.NIUBIZ);
    const { user, password, merchantId } = cfg.credentials;
    if (!user || !password || !merchantId) {
      throw new BadRequestException('Credenciales Niubiz incompletas (user/password/merchantId)');
    }

    const token = await this.authToken(organizationId, user, password);
    try {
      const { data } = await axios.post(
        `${this.qrUrl}/api.qr.manager/v1/qr/ascii`,
        {
          amount: remaining.toFixed(2),
          merchantId,
          externalReference: order.id,
          // Validez acotada a MAÑANA (Lima), no +7 días (Playbook §4.1).
          validityDate: limaTomorrowCompact(),
        },
        { headers: { Authorization: token }, timeout: 15_000 },
      );
      return { qrImage: data.tagImg ?? data.qr ?? null, amount: remaining, externalReference: order.id };
    } catch (e) {
      this.logger.error(`Niubiz generateQr falló: ${(e as Error).message}`);
      throw new BadRequestException('No se pudo generar el QR de pago');
    }
  }

  /** JWT cacheado por org con 60s de margen antes de exp (Playbook §4.1). */
  private async authToken(organizationId: string, user: string, password: string): Promise<string> {
    const cached = this.tokenCache.get(organizationId);
    if (cached && cached.expiresAt - 60_000 > Date.now()) return cached.token;

    const basic = Buffer.from(`${user}:${password}`).toString('base64');
    const { data } = await axios.post(`${this.securityUrl}/api.security/v1/security`, {}, {
      headers: { Authorization: `Basic ${basic}` },
      timeout: 15_000,
    });
    const token: string = typeof data === 'string' ? data : (data.token ?? data.access_token);
    if (!token) throw new BadRequestException('Niubiz no devolvió token de seguridad');

    this.tokenCache.set(organizationId, { token, expiresAt: this.parseJwtExp(token) });
    return token;
  }

  /** Lee `exp` del JWT sin validar firma (se confía en TLS). */
  private parseJwtExp(token: string): number {
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf8'));
      if (payload.exp) return payload.exp * 1000;
    } catch {
      /* fallback abajo */
    }
    return Date.now() + 15 * 60 * 1000;
  }
}
