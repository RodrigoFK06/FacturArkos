import { Type } from 'class-transformer';
import {
  ArrayMinSize,
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
import { CommercialKind, DocumentType } from '@prisma/client';

export class CommercialItemDto {
  @IsOptional() @IsString() productId?: string;
  @IsString() @MinLength(1) name!: string;
  @IsNumber() @Min(0.001) quantity!: number;
  @IsNumber() @Min(0) unitPrice!: number;
}

export class CreateCommercialDocDto {
  @IsEnum(CommercialKind) kind!: CommercialKind;
  @IsOptional() @IsString() customerId?: string;
  @IsOptional() @IsString() customerName?: string;
  @IsOptional() @IsString() validUntil?: string;
  @IsOptional() @IsString() note?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CommercialItemDto)
  items!: CommercialItemDto[];
}

export class ConvertDto {
  /** Si viene, emite el comprobante en la venta resultante. */
  @IsOptional() @IsIn([DocumentType.FACTURA, DocumentType.BOLETA]) documentType?: DocumentType;
}
