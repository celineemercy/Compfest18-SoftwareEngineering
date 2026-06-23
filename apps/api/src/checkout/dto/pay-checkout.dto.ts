import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { DELIVERY_METHODS } from '../checkout.constants';
import type { DeliveryMethod } from '../checkout.constants';

export class PayCheckoutDto {
  @IsIn(DELIVERY_METHODS)
  deliveryMethod: DeliveryMethod;

  @IsUUID()
  addressId: string;

  @IsOptional()
  @IsString()
  discountCode?: string;
}
