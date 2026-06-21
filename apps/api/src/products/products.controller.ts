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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SellerGuard } from '../auth/guards/seller.guard';
import type { AuthenticatedRequest } from '../auth/types/auth.types';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

@UseGuards(JwtAuthGuard, SellerGuard)
@Controller()
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post('stores/:storeId/products')
  async create(
    @Req() request: AuthenticatedRequest,
    @Param('storeId') storeId: string,
    @Body() dto: CreateProductDto,
  ) {
    return this.productsService.create(request.user.id, storeId, dto);
  }

  @Get('stores/:storeId/products')
  async findByStore(
    @Req() request: AuthenticatedRequest,
    @Param('storeId') storeId: string,
  ) {
    return this.productsService.findByStore(request.user.id, storeId);
  }

  @Get('products/:productId')
  async findOne(
    @Req() request: AuthenticatedRequest,
    @Param('productId') productId: string,
  ) {
    return this.productsService.findOne(request.user.id, productId);
  }

  @Patch('products/:productId')
  async update(
    @Req() request: AuthenticatedRequest,
    @Param('productId') productId: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productsService.update(request.user.id, productId, dto);
  }

  @Delete('products/:productId')
  async remove(
    @Req() request: AuthenticatedRequest,
    @Param('productId') productId: string,
  ) {
    return this.productsService.remove(request.user.id, productId);
  }
}
