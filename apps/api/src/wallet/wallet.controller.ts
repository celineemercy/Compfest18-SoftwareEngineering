import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { BuyerGuard } from '../auth/guards/buyer.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/types/auth.types';
import { TopUpWalletDto } from './dto/top-up-wallet.dto';
import { WalletService } from './wallet.service';

@UseGuards(JwtAuthGuard, BuyerGuard)
@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('me')
  async findMine(@Req() request: AuthenticatedRequest) {
    return this.walletService.findMine(request.user.id);
  }

  @Post('top-up')
  async topUp(
    @Req() request: AuthenticatedRequest,
    @Body() dto: TopUpWalletDto,
  ) {
    return this.walletService.topUp(request.user.id, dto);
  }
}
