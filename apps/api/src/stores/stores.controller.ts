import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SellerGuard } from '../auth/guards/seller.guard';
import type { AuthenticatedRequest } from '../auth/types/auth.types';
import { CreateStoreDto } from './dto/create-store.dto';
import { StoresService } from './stores.service';

@UseGuards(JwtAuthGuard, SellerGuard)
@Controller('stores')
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  @Post()
  async create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateStoreDto,
  ) {
    return this.storesService.create(request.user.id, dto);
  }

  @Get('me')
  async findMine(@Req() request: AuthenticatedRequest) {
    return this.storesService.findMine(request.user.id);
  }
}
