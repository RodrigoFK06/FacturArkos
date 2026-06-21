import { PaymentProvider } from '@prisma/client';
import { IsBoolean, IsEnum, IsObject, IsOptional, IsString } from 'class-validator';

export class UpsertPaymentConfigDto {
  @IsEnum(PaymentProvider) provider!: PaymentProvider;

  /** Credenciales del proveedor (ej. Niubiz: { user, password, merchantId }). */
  @IsOptional() @IsObject() credentials?: Record<string, string>;

  /** Secreto del webhook (header x-niubiz-webhook-secret). */
  @IsOptional() @IsString() webhookSecret?: string;

  @IsOptional() @IsBoolean() testMode?: boolean;
  @IsOptional() @IsBoolean() enabled?: boolean;
}

export class GenerateQrDto {
  @IsString() orderId!: string;
}
