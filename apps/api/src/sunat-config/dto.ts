import { SunatProvider } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class UpsertSunatConfigDto {
  @IsOptional() @IsEnum(SunatProvider) provider?: SunatProvider;

  /** PATCH sin personaId/token preserva los existentes (el frontend nunca ve el plaintext). */
  @IsOptional() @IsString() @MinLength(1) personaId?: string;
  @IsOptional() @IsString() @MinLength(1) token?: string;
  @IsOptional() @IsBoolean() testMode?: boolean;
}
