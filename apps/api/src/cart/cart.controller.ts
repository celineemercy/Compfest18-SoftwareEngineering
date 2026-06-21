import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { BuyerGuard } from '../auth/guards/buyer.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/types/auth.types';
import { CartService } from './cart.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

@UseGuards(JwtAuthGuard, BuyerGuard)
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get('me')
  async findMine(@Req() request: AuthenticatedRequest) {
    return this.cartService.findMine(request.user.id);
  }

  @Post('items')
  async addItem(
    @Req() request: AuthenticatedRequest,
    @Body() dto: AddCartItemDto,
  ) {
    return this.cartService.addItem(request.user.id, dto);
  }

  @Patch('items/:itemId')
  async updateItem(
    @Req() request: AuthenticatedRequest,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.cartService.updateItem(request.user.id, itemId, dto);
  }

  @Delete('items/:itemId')
  async removeItem(
    @Req() request: AuthenticatedRequest,
    @Param('itemId') itemId: string,
  ) {
    return this.cartService.removeItem(request.user.id, itemId);
  }

  @Delete('clear')
  async clear(@Req() request: AuthenticatedRequest) {
    return this.cartService.clear(request.user.id);
  }
}
