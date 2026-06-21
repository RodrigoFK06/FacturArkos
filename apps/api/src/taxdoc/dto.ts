import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { DocIdentityType } from '@prisma/client';

/** Un comprobante referenciado por el CRE/PRE. */
export class TaxRefDto {
  /** Tipo de comprobante (cat. 01): "01" factura, "03" boleta. */
  @IsString() @MinLength(2) docType!: string;
  @IsString() @MinLength(2) series!: string;
  @IsNumber() @Min(1) number!: number;
  @IsString() issueDate!: string; // yyyy-mm-dd
  @IsNumber() @Min(0) total!: number; // importe total del comprobante
  @IsOptional() @IsString() currency?: string; // PEN (default) / USD
  @IsOptional() @IsNumber() exchangeRate?: number; // si el comprobante es en USD
}

export class CreateTaxDocDto {
  /** Sistema de retención/percepción (cat. 23/22). Default de la organización o "01". */
  @IsOptional() @IsString() regime?: string;
  /** Porcentaje. Default 3 (retención) / 2 (percepción). */
  @IsOptional() @IsNumber() @Min(0.1) percent?: number;
  /** Serie del comprobante (R001 / P001). */
  @IsOptional() @IsString() series?: string;

  /** Contraparte: proveedor (retención) o cliente (percepción) — normalmente RUC. */
  @IsEnum(DocIdentityType) partyDocType!: DocIdentityType;
  @IsString() @MinLength(8) partyDoc!: string;
  @IsString() @MinLength(2) partyName!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TaxRefDto)
  refs!: TaxRefDto[];
}
