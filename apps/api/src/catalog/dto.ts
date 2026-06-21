import { IgvAffectation } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
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
  @IsOptional() @IsBoolean() active?: boolean;
}

export class CreateCategoryDto {
  @IsString() @MinLength(1) name!: string;
}
