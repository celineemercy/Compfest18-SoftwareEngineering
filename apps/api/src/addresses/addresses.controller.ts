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
import { AddressesService } from './addresses.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@UseGuards(JwtAuthGuard, BuyerGuard)
@Controller('addresses')
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Post()
  async create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateAddressDto,
  ) {
    return this.addressesService.create(request.user.id, dto);
  }

  @Get('me')
  async findMine(@Req() request: AuthenticatedRequest) {
    return this.addressesService.findMine(request.user.id);
  }

  @Patch(':addressId')
  async update(
    @Req() request: AuthenticatedRequest,
    @Param('addressId') addressId: string,
    @Body() dto: UpdateAddressDto,
  ) {
    return this.addressesService.update(request.user.id, addressId, dto);
  }

  @Delete(':addressId')
  async remove(
    @Req() request: AuthenticatedRequest,
    @Param('addressId') addressId: string,
  ) {
    return this.addressesService.remove(request.user.id, addressId);
  }
}
