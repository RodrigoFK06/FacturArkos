import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CreateSupplierDto {
  @Matches(/^(10|15|17|20)\d{9}$/, { message: 'RUC inválido' })
  ruc!: string;

  @IsString() @MinLength(2) businessName!: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
}

/** Edita datos del proveedor / estado. El RUC es la llave: no se cambia. */
export class UpdateSupplierDto {
  @IsOptional() @IsString() @MinLength(2) businessName?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class PurchaseItemDto {
  @IsOptional() @IsString() productId?: string;
  @IsString() @MinLength(1) name!: string;
  @IsNumber() @Min(0.001) quantity!: number;
  /** Costo unitario sin IGV. */
  @IsNumber() @Min(0) unitCost!: number;
}

export class CreatePurchaseDto {
  @IsString() supplierId!: string;
  @IsString() warehouseId!: string;
  @IsOptional() @IsString() documentType?: string;
  @IsOptional() @IsString() series?: string;
  @IsOptional() @IsString() number?: string;
  @IsOptional() @IsString() issueDate?: string;
  @IsOptional() @IsString() note?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseItemDto)
  items!: PurchaseItemDto[];
}
