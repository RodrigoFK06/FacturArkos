import { DocIdentityType } from '@prisma/client';
import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateCustomerDto {
  @IsEnum(DocIdentityType) identityType!: DocIdentityType;
  @IsString() @MinLength(1) documentNumber!: string;
  @IsString() @MinLength(1) name!: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() phone?: string;
}

/** Edita datos de contacto / estado. El documento e identidad son la llave: no se cambian. */
export class UpdateCustomerDto {
  @IsOptional() @IsString() @MinLength(1) name?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}
