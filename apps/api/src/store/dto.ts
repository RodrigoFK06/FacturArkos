import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class OnlineItemDto {
  @IsString() productId!: string;
  @IsNumber() @Min(0.001) quantity!: number;
}

export class CreateOnlineOrderDto {
  @IsString() @MinLength(2) customerName!: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() address?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OnlineItemDto)
  items!: OnlineItemDto[];
}
