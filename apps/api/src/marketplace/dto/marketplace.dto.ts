import {
  DeliveryMethod,
  DiscountType,
  Role,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateReviewDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  category: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  comment: string;
}

export class TopUpWalletDto {
  @Type(() => Number)
  @IsInt()
  @Min(1000)
  amount: number;
}

export class CreateAddressDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  label: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  recipient: string;

  @IsString()
  @Matches(/^[0-9+()\-\s]{7,20}$/)
  phone: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  fullAddress: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  city: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(12)
  postalCode: string;
}

export class UpdateAddressDto extends CreateAddressDto {}

export class AddCartItemDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;
}

export class UpdateCartItemDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;
}

export class CheckoutDto {
  @IsString()
  @IsNotEmpty()
  addressId: string;

  @IsEnum(DeliveryMethod)
  deliveryMethod: DeliveryMethod;

  @IsString()
  @IsOptional()
  @MaxLength(40)
  discountCode?: string;
}

export class CreateDiscountDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  code: string;

  @IsEnum(DiscountType)
  type: DiscountType;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  amount: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  remainingUsage?: number;

  @IsDateString()
  expiresAt: string;
}

export class AdvanceTimeDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  days: number;
}

export class CreateAdminUserDto {
  @IsEmail({}, { message: 'Please provide a valid email' })
  email: string;

  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsEnum(Role, { each: true })
  @IsOptional()
  roles?: Role[];
}
