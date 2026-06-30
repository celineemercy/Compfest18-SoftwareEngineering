import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';

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
      include: { products: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findPublic() {
    return this.prisma.store.findMany({
      include: { products: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findPublicOne(storeId: string) {
    return this.prisma.store.findUnique({
      where: { id: storeId },
      include: { products: true },
    });
  }

  async update(sellerId: string, storeId: string, dto: UpdateStoreDto) {
    await this.assertSellerOwnsStore(sellerId, storeId);

    try {
      return await this.prisma.store.update({
        where: { id: storeId },
        data: dto,
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException('Store name already exists');
      }

      throw error;
    }
  }

  private async assertSellerOwnsStore(sellerId: string, storeId: string) {
    const store = await this.prisma.store.findFirst({
      where: { id: storeId, sellerId },
      select: { id: true },
    });

    if (!store) {
      throw new ConflictException('Store not found for this seller');
    }
  }

  private isUniqueConstraintError(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
