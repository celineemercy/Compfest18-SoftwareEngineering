import { IsIn } from 'class-validator';
import { DELIVERY_METHODS } from '../checkout.constants';
import type { DeliveryMethod } from '../checkout.constants';

export class CalculateCheckoutDto {
  @IsIn(DELIVERY_METHODS)
  deliveryMethod: DeliveryMethod;
}
