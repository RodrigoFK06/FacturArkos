import { IgvAffectation } from '@prisma/client';
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

export class CreateProductDto {
  @IsString() @MinLength(1) name!: string;
  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsString() barcode?: string;
  @IsNumber() @Min(0) price!: number; // precio de venta CON IGV
  @IsOptional() @IsNumber() @Min(0) cost?: number;
  @IsOptional() @IsString() unitCode?: string;
  @IsOptional() @IsEnum(IgvAffectation) igvAffectation?: IgvAffectation;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsString() sunatProductCode?: string;
  @IsOptional() @IsBoolean() tracksStock?: boolean;
  @IsOptional() @IsNumber() @Min(0) minStock?: number;
}

export class UpdateProductDto {
  @IsOptional() @IsString() @MinLength(1) name?: string;
  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsString() barcode?: string;
  @IsOptional() @IsNumber() @Min(0) price?: number;
  @IsOptional() @IsNumber() @Min(0) cost?: number;
  @IsOptional() @IsString() unitCode?: string;
  @IsOptional() @IsEnum(IgvAffectation) igvAffectation?: IgvAffectation;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsString() sunatProductCode?: string;
  @IsOptional() @IsBoolean() tracksStock?: boolean;
  @IsOptional() @IsNumber() @Min(0) minStock?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class CreateCategoryDto {
  @IsString() @MinLength(1) name!: string;
}

export class UpdateCategoryDto {
  @IsOptional() @IsString() @MinLength(1) name?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

// ── Listas de precios ──

export class CreatePriceListDto {
  @IsString() @MinLength(1) name!: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
}

export class UpdatePriceListDto {
  @IsOptional() @IsString() @MinLength(1) name?: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
}

export class PriceRowDto {
  @IsString() productId!: string;
  /** Precio CON IGV en esta lista. 0 (o menos) elimina el precio especial. */
  @IsNumber() @Min(0) price!: number;
}

export class SetPricesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PriceRowDto)
  prices!: PriceRowDto[];
}
