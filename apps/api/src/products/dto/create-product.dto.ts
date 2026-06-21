import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateProductDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  price: number;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsUrl()
  @IsOptional()
  imageUrl?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  stock?: number;
}
