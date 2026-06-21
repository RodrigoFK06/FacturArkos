import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { PaymentProvider } from '@prisma/client';
import { createHash, timingSafeEqual } from 'crypto';
import { Public } from '../common/decorators/roles.decorator';
import { PaymentConfigService } from './payment-config.service';
import { PaymentsService } from './payments.service';

/** Lista blanca de estados que cuentan como pago aprobado. */
const APPROVED_STATUS = /approved|success|paid|aprobado/i;

/**
 * Webhook público de Niubiz (Playbook §4.1). El `:organizationId` en la ruta
 * resuelve el tenant (delta per-tenant): cada negocio configura su URL con su id.
 * Sin guard de usuario; la defensa es el secreto compartido fail-closed.
 */
@Controller('webhooks/niubiz')
export class NiubizWebhookController {
  constructor(
    private readonly paymentConfig: PaymentConfigService,
    private readonly payments: PaymentsService,
  ) {}

  @Public()
  @Get(':organizationId')
  health() {
    return { ok: true };
  }

  @Public()
  @Post(':organizationId')
  async handle(
    @Param('organizationId') organizationId: string,
    @Headers('x-niubiz-webhook-secret') provided: string | undefined,
    @Body() body: Record<string, any>,
  ) {
    // Los proveedores mandan pings con body vacío al configurar.
    if (!body || Object.keys(body).length === 0) return { ok: true };

    // 0. Secreto compartido, ANTES de mirar el payload (fail-closed).
    const expected = await this.paymentConfig.getWebhookSecret(organizationId, PaymentProvider.NIUBIZ);
    this.assertSecret(provided, expected);

    // 1. tagId presente.
    const tagId = body.tagId ?? body.id;
    if (!tagId) throw new BadRequestException('tagId requerido');

    // 2. status requerido y en lista blanca.
    const status = String(body.status ?? '');
    if (!APPROVED_STATUS.test(status)) return { ignored: true, status };

    // 3. externalReference debe ser un id no vacío (nuestra orden).
    const externalReference = body.externalReference;
    if (!externalReference || typeof externalReference !== 'string') {
      throw new BadRequestException('externalReference inválido');
    }

    // 4. amount obligatorio, finito y > 0.
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('amount inválido');
    }

    // 5. Aplicar con idempotencia + guard de estado + match de monto + lock optimista.
    return this.payments.applyApprovedPayment(organizationId, {
      tagId: String(tagId),
      externalReference,
      amount,
    });
  }

  /** timingSafeEqual sobre hashes SHA-256 (longitud constante) — anti-timing. */
  private assertSecret(provided: string | undefined, expected: string | null): void {
    if (!expected) throw new UnauthorizedException('Webhook no configurado'); // sin secreto → rechaza todo
    if (!provided) throw new UnauthorizedException('Falta el secreto del webhook');
    const a = createHash('sha256').update(provided).digest();
    const b = createHash('sha256').update(expected).digest();
    if (!timingSafeEqual(a, b)) throw new UnauthorizedException('Secreto de webhook inválido');
  }
}
