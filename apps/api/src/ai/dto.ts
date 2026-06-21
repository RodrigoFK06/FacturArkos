import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class AskDto {
  @IsString() @MinLength(2) @MaxLength(1000) question!: string;
}

export class ScanPurchaseDto {
  /** Contenido del archivo en base64 (sin el prefijo data:). */
  @IsString() @MinLength(10) data!: string;
  /** MIME: image/png, image/jpeg, image/webp, image/gif o application/pdf. */
  @IsString() mediaType!: string;
  @IsOptional() @IsString() fileName?: string;
}
