import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { UserRole } from '@prisma/client';

export class UpdateOrganizationDto {
  @IsOptional() @IsString() nombreComercial?: string;
  @IsOptional() @IsString() direccion?: string;
  @IsOptional() @IsString() ubigeo?: string;
  @IsOptional() @IsString() logoUrl?: string;
  @IsOptional() @IsString() whatsapp?: string;
  @IsOptional() @IsString() pdfFooter?: string;
  @IsOptional() @IsString() yapeNumber?: string;
  @IsOptional() @IsString() yapeQrUrl?: string;
  @IsOptional() @IsString() plinNumber?: string;
  @IsOptional() @IsString() plinQrUrl?: string;
  // Régimen de retención/percepción y detracción
  @IsOptional() @IsBoolean() retentionAgent?: boolean;
  @IsOptional() @IsString() retentionRegime?: string;
  @IsOptional() @IsBoolean() perceptionAgent?: boolean;
  @IsOptional() @IsString() perceptionRegime?: string;
  @IsOptional() @IsString() detractionAccount?: string;
}

export class CreateEstablishmentDto {
  @Matches(/^\d{4}$/, { message: 'El código de establecimiento debe ser de 4 dígitos' })
  code!: string;

  @IsString() @MinLength(2) name!: string;
  @IsOptional() @IsString() address?: string;
}

export class CreateUserDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(2) name!: string;
  @IsString() @MinLength(8) password!: string;
  @IsEnum(UserRole) role!: UserRole;
}
