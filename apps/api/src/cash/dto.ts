import { IsIn, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class OpenCashDto {
  @IsString() establishmentId!: string;
  @IsNumber() @Min(0) openingAmount!: number;
}

export class CashMovementDto {
  @IsIn(['INCOME', 'EXPENSE', 'WITHDRAWAL']) type!: 'INCOME' | 'EXPENSE' | 'WITHDRAWAL';
  @IsNumber() @Min(0.01) amount!: number;
  @IsOptional() @IsString() @MinLength(1) concept?: string;
}

export class CloseCashDto {
  @IsNumber() @Min(0) countedAmount!: number;
  @IsOptional() @IsString() notes?: string;
}
