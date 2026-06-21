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
import { DocIdentityType } from '@prisma/client';

export class GreItemDto {
  @IsOptional() @IsString() productId?: string;
  @IsString() @MinLength(1) description!: string;
  @IsNumber() @Min(0.001) quantity!: number;
  @IsOptional() @IsString() unitCode?: string;
}

export class GreTransportDto {
  /** 01 transporte público, 02 transporte privado. */
  @IsIn(['01', '02']) mode!: '01' | '02';
  @IsOptional() @IsString() carrierRuc?: string;
  @IsOptional() @IsString() carrierName?: string;
  @IsOptional() @IsString() carrierMtc?: string;
  @IsOptional() @IsString() plate?: string;
  @IsOptional() @IsEnum(DocIdentityType) driverDocType?: DocIdentityType;
  @IsOptional() @IsString() driverDoc?: string;
  @IsOptional() @IsString() driverName?: string; // nombres del conductor
  @IsOptional() @IsString() driverFamilyName?: string; // apellidos (transporte privado)
  @IsOptional() @IsString() driverLicense?: string; // nº de licencia de conducir (obligatorio en privado)
}

export class CreateGreDto {
  @IsOptional() @IsString() series?: string; // default T001

  // Destinatario
  @IsEnum(DocIdentityType) receiverDocType!: DocIdentityType;
  @IsString() receiverDoc!: string;
  @IsString() @MinLength(2) receiverName!: string;

  // Traslado
  @IsOptional() @IsString() transferReason?: string; // cat 20, default 01
  @IsOptional() @IsString() transferDate?: string;
  @IsNumber() @Min(0) totalWeight!: number;
  @IsOptional() @IsString() weightUnit?: string;

  // Direcciones
  @IsString() @MinLength(3) originAddress!: string;
  @IsOptional() @IsString() originUbigeo?: string;
  @IsString() @MinLength(3) destAddress!: string;
  @IsOptional() @IsString() destUbigeo?: string;

  @ValidateNested() @Type(() => GreTransportDto) transport!: GreTransportDto;

  // Documento relacionado (opcional)
  @IsOptional() @IsString() relatedDocType?: string; // código cat 01 (01/03/...)
  @IsOptional() @IsString() relatedSeries?: string;
  @IsOptional() @IsNumber() relatedNumber?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => GreItemDto)
  items!: GreItemDto[];
}
