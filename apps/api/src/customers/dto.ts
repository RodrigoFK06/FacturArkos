import { DocIdentityType } from '@prisma/client';
import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateCustomerDto {
  @IsEnum(DocIdentityType) identityType!: DocIdentityType;
  @IsString() @MinLength(1) documentNumber!: string;
  @IsString() @MinLength(1) name!: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() phone?: string;
}
