import { Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SellerGuard } from '../auth/guards/seller.guard';
import type { AuthenticatedRequest } from '../auth/types/auth.types';
import { OrdersService } from './orders.service';

@UseGuards(JwtAuthGuard, SellerGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get('store/:storeId')
  async findByStore(
    @Req() request: AuthenticatedRequest,
    @Param('storeId') storeId: string,
  ) {
    return this.ordersService.findByStore(request.user.id, storeId);
  }

  @Patch(':orderId/process')
  async processOrder(
    @Req() request: AuthenticatedRequest,
    @Param('orderId') orderId: string,
  ) {
    return this.ordersService.processOrder(request.user.id, orderId);
  }
}
