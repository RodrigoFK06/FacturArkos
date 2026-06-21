import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { DocIdentityType, DocumentType, FulfillmentStatus, IgvAffectation, PaymentMethod, SaleType } from '@prisma/client';

export class SetFulfillmentDto {
  @IsEnum(FulfillmentStatus) status!: FulfillmentStatus;
}

export class SaleItemDto {
  @IsOptional() @IsString() productId?: string;
  @IsString() @MinLength(1) name!: string;
  @IsNumber() @Min(0.001) quantity!: number;
  /** Precio unitario CON IGV (como se cobra). */
  @IsNumber() @Min(0) unitPrice!: number;
  @IsOptional() @IsNumber() @Min(0) discount?: number;
  @IsOptional() @IsEnum(IgvAffectation) igvAffectation?: IgvAffectation;
  @IsOptional() @IsString() unitCode?: string;
  @IsOptional() @IsString() sunatProductCode?: string;
}

export class SalePaymentDto {
  @IsEnum(PaymentMethod) method!: PaymentMethod;
  @IsNumber() @Min(0) amount!: number;
}

/** Detracción (SPOT) — solo aplica a FACTURA. */
export class SaleDetractionDto {
  /** Código del bien/servicio sujeto a detracción (SUNAT cat. 54). */
  @IsString() @MinLength(2) code!: string;
  /** Porcentaje (ej. 12, 10, 4). */
  @IsNumber() @Min(0.1) percent!: number;
  /** Cuenta del Banco de la Nación. Si se omite se usa la de la organización. */
  @IsOptional() @IsString() account?: string;
}

export class EmitOnSaleDto {
  @IsIn([DocumentType.FACTURA, DocumentType.BOLETA]) documentType!: DocumentType;
  @IsOptional() @IsString() series?: string;
}

export class CreateSaleDto {
  @IsString() establishmentId!: string;
  @IsOptional() @IsString() customerId?: string;
  @IsOptional() @IsString() cashSessionId?: string;
  @IsOptional() @IsEnum(SaleType) saleType?: SaleType;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SaleItemDto)
  items!: SaleItemDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SalePaymentDto)
  payments?: SalePaymentDto[];

  /** Si viene, emite el comprobante en el mismo flujo (checkout). */
  @IsOptional()
  @ValidateNested()
  @Type(() => EmitOnSaleDto)
  emit?: EmitOnSaleDto;

  @IsOptional() @IsString() note?: string;

  /** Vencimiento para venta al crédito (ISO). Si viene y no se cubre el total, queda por cobrar. */
  @IsOptional() @IsString() dueDate?: string;

  /** Detracción (SPOT). Solo se aplica si emit.documentType === FACTURA. */
  @IsOptional()
  @ValidateNested()
  @Type(() => SaleDetractionDto)
  detraction?: SaleDetractionDto;
}

// ── Emisión masiva (Excel) ──

export class BulkItemDto {
  @IsString() @MinLength(1) name!: string;
  @IsNumber() @Min(0.001) quantity!: number;
  /** Precio unitario CON IGV. */
  @IsNumber() @Min(0) unitPrice!: number;
  @IsOptional() @IsEnum(IgvAffectation) igvAffectation?: IgvAffectation;
  @IsOptional() @IsString() unitCode?: string;
  @IsOptional() @IsString() sunatProductCode?: string;
}

export class BulkDocDto {
  @IsIn([DocumentType.FACTURA, DocumentType.BOLETA]) documentType!: DocumentType;
  @IsOptional() @IsString() series?: string;
  @IsOptional() @IsEnum(DocIdentityType) customerDocType?: DocIdentityType;
  @IsOptional() @IsString() customerDoc?: string;
  @IsOptional() @IsString() customerName?: string;
  @IsOptional() @IsString() customerAddress?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BulkItemDto)
  items!: BulkItemDto[];
}

export class BulkSaleDto {
  @IsString() establishmentId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => BulkDocDto)
  documents!: BulkDocDto[];
}
