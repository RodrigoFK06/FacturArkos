import { DocumentType } from '@prisma/client';
import { IsEnum, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class EmitInvoiceDto {
  /** Solo comprobantes de venta directos. NC/ND tienen su propio flujo. */
  @IsIn([DocumentType.FACTURA, DocumentType.BOLETA])
  documentType!: DocumentType;

  /** Serie (ej. F001/B001). Si se omite se usa la serie por defecto del tipo. */
  @IsOptional() @IsString() series?: string;
}

export class VoidInvoiceDto {
  @IsString() @MinLength(3) reason!: string;
}

export class CreateCreditNoteDto {
  @IsString() @MinLength(3) reason!: string;
  /** SUNAT catálogo 09 (tipo de nota de crédito). Default 01 = anulación de la operación. */
  @IsOptional() @IsString() discrepancyCode?: string;
  @IsOptional() @IsString() series?: string;
}
