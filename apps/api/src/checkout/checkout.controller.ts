import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { BuyerGuard } from '../auth/guards/buyer.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/types/auth.types';
import { CheckoutService } from './checkout.service';
import { CalculateCheckoutDto } from './dto/calculate-checkout.dto';

@UseGuards(JwtAuthGuard, BuyerGuard)
@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post('calculate')
  async calculate(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CalculateCheckoutDto,
  ) {
    return this.checkoutService.calculate(request.user.id, dto);
  }
}
