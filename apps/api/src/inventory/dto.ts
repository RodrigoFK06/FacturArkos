import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreateWarehouseDto {
  @IsString() @MinLength(1) name!: string;
  @IsOptional() @IsBoolean() isMain?: boolean;
}

/** Movimiento manual de inventario (ingresos/ajustes; ventas y compras usan su flujo). */
export class MovementDto {
  @IsString() productId!: string;
  @IsString() warehouseId!: string;
  @IsIn(['INITIAL', 'ADJUST_IN', 'ADJUST_OUT', 'RETURN_IN']) type!:
    | 'INITIAL'
    | 'ADJUST_IN'
    | 'ADJUST_OUT'
    | 'RETURN_IN';
  @IsNumber() @Min(0.001) quantity!: number;
  @IsOptional() @IsNumber() @Min(0) unitCost?: number;
  @IsOptional() @IsString() reference?: string;
}

export class TransferDto {
  @IsString() productId!: string;
  @IsString() fromWarehouseId!: string;
  @IsString() toWarehouseId!: string;
  @IsNumber() @Min(0.001) quantity!: number;
  @IsOptional() @IsString() reference?: string;
}

export class CreateLotDto {
  @IsString() productId!: string;
  @IsString() warehouseId!: string;
  @IsString() @MinLength(1) code!: string;
  @IsOptional() @IsDateString() expirationDate?: string;
  @IsNumber() @Min(0) quantity!: number;
}
