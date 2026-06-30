import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { ActiveRoleGuard } from '../auth/guards/active-role.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/types/auth.types';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { StoresService } from './stores.service';

@Controller('stores')
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  @Get()
  async findPublic() {
    return this.storesService.findPublic();
  }

  @UseGuards(JwtAuthGuard, ActiveRoleGuard(Role.SELLER))
  @Post()
  async create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateStoreDto,
  ) {
    return this.storesService.create(request.user.id, dto);
  }

  @UseGuards(JwtAuthGuard, ActiveRoleGuard(Role.SELLER))
  @Get('me')
  async findMine(@Req() request: AuthenticatedRequest) {
    return this.storesService.findMine(request.user.id);
  }

  @Get(':storeId')
  async findPublicOne(@Param('storeId') storeId: string) {
    return this.storesService.findPublicOne(storeId);
  }

  @UseGuards(JwtAuthGuard, ActiveRoleGuard(Role.SELLER))
  @Patch(':storeId')
  async update(
    @Req() request: AuthenticatedRequest,
    @Param('storeId') storeId: string,
    @Body() dto: UpdateStoreDto,
  ) {
    return this.storesService.update(request.user.id, storeId, dto);
  }
}
