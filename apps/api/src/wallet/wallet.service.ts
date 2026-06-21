import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TopUpWalletDto } from './dto/top-up-wallet.dto';

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  async findMine(userId: string) {
    return this.prisma.wallet.upsert({
      where: { userId },
      update: {},
      create: { userId, balance: 0 },
    });
  }

  async topUp(userId: string, dto: TopUpWalletDto) {
    await this.findMine(userId);

    return this.prisma.wallet.update({
      where: { userId },
      data: {
        balance: {
          increment: dto.amount,
        },
      },
    });
  }
}
