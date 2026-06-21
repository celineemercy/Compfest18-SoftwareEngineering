import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStoreDto } from './dto/create-store.dto';

@Injectable()
export class StoresService {
  constructor(private readonly prisma: PrismaService) {}

  async create(sellerId: string, dto: CreateStoreDto) {
    try {
      return await this.prisma.store.create({
        data: {
          ...dto,
          sellerId,
        },
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException('Store name already exists');
      }

      throw error;
    }
  }

  async findMine(sellerId: string) {
    return this.prisma.store.findMany({
      where: { sellerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  private isUniqueConstraintError(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
