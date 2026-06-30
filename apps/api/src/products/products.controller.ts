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
import { Role } from '@prisma/client';
import { ActiveRoleGuard } from '../auth/guards/active-role.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/types/auth.types';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

@Controller()
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get('products')
  async findPublic() {
    return this.productsService.findPublic();
  }

  @Get('stores/:storeId/products')
  async findPublicByStore(@Param('storeId') storeId: string) {
    return this.productsService.findPublic(storeId);
  }

  @Get('products/:productId')
  async findPublicOne(@Param('productId') productId: string) {
    return this.productsService.findPublicOne(productId);
  }

  @UseGuards(JwtAuthGuard, ActiveRoleGuard(Role.SELLER))
  @Post('stores/:storeId/products')
  async create(
    @Req() request: AuthenticatedRequest,
    @Param('storeId') storeId: string,
    @Body() dto: CreateProductDto,
  ) {
    return this.productsService.create(request.user.id, storeId, dto);
  }

  @UseGuards(JwtAuthGuard, ActiveRoleGuard(Role.SELLER))
  @Get('seller/stores/:storeId/products')
  async findByStore(
    @Req() request: AuthenticatedRequest,
    @Param('storeId') storeId: string,
  ) {
    return this.productsService.findByStore(request.user.id, storeId);
  }

  @UseGuards(JwtAuthGuard, ActiveRoleGuard(Role.SELLER))
  @Get('seller/products/:productId')
  async findOne(
    @Req() request: AuthenticatedRequest,
    @Param('productId') productId: string,
  ) {
    return this.productsService.findOne(request.user.id, productId);
  }

  @UseGuards(JwtAuthGuard, ActiveRoleGuard(Role.SELLER))
  @Patch('products/:productId')
  async update(
    @Req() request: AuthenticatedRequest,
    @Param('productId') productId: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productsService.update(request.user.id, productId, dto);
  }

  @UseGuards(JwtAuthGuard, ActiveRoleGuard(Role.SELLER))
  @Delete('products/:productId')
  async remove(
    @Req() request: AuthenticatedRequest,
    @Param('productId') productId: string,
  ) {
    return this.productsService.remove(request.user.id, productId);
  }
}
