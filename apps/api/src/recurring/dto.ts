import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { DocumentType, RecurFrequency, RecurStatus } from '@prisma/client';

export class RecurringItemDto {
  @IsOptional() @IsString() productId?: string;
  @IsString() @MinLength(1) name!: string;
  @IsNumber() @Min(0.001) quantity!: number;
  @IsNumber() @Min(0) unitPrice!: number;
}

export class CreateRecurringDto {
  @IsString() @MinLength(2) name!: string;
  @IsString() customerId!: string;
  @IsOptional() @IsEnum(DocumentType) documentType?: DocumentType;
  @IsOptional() @IsString() series?: string;
  @IsOptional() @IsEnum(RecurFrequency) frequency?: RecurFrequency;
  @IsOptional() @IsBoolean() emitOnRun?: boolean;
  @IsOptional() @IsString() startDate?: string;
  @IsOptional() @IsString() note?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RecurringItemDto)
  items!: RecurringItemDto[];
}

export class SetStatusDto {
  @IsEnum(RecurStatus) status!: RecurStatus;
}

export class UpdateRecurringDto {
  @IsOptional() @IsString() @MinLength(2) name?: string;
  @IsOptional() @IsString() customerId?: string;
  @IsOptional() @IsEnum(DocumentType) documentType?: DocumentType;
  @IsOptional() @IsString() series?: string;
  @IsOptional() @IsEnum(RecurFrequency) frequency?: RecurFrequency;
  @IsOptional() @IsBoolean() emitOnRun?: boolean;
  @IsOptional() @IsString() startDate?: string;
  @IsOptional() @IsString() note?: string;

  /** Si viene, REEMPLAZA todos los ítems del plan. */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RecurringItemDto)
  items?: RecurringItemDto[];
}
