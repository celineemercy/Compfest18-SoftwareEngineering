import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(sellerId: string, storeId: string, dto: CreateProductDto) {
    await this.assertSellerOwnsStore(sellerId, storeId);

    return this.prisma.product.create({
      data: {
        ...dto,
        storeId,
      },
    });
  }

  async findByStore(sellerId: string, storeId: string) {
    await this.assertSellerOwnsStore(sellerId, storeId);

    return this.prisma.product.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findPublic(storeId?: string) {
    return this.prisma.product.findMany({
      where: storeId ? { storeId } : undefined,
      include: { store: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findPublicOne(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { store: true },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  async findOne(sellerId: string, productId: string) {
    return this.findSellerProductOrThrow(sellerId, productId);
  }

  async update(sellerId: string, productId: string, dto: UpdateProductDto) {
    await this.findSellerProductOrThrow(sellerId, productId);

    return this.prisma.product.update({
      where: { id: productId },
      data: dto,
    });
  }

  async remove(sellerId: string, productId: string) {
    await this.findSellerProductOrThrow(sellerId, productId);
    await this.prisma.product.delete({ where: { id: productId } });

    return { message: 'Product deleted successfully' };
  }

  private async assertSellerOwnsStore(sellerId: string, storeId: string) {
    const store = await this.prisma.store.findFirst({
      where: {
        id: storeId,
        sellerId,
      },
      select: { id: true },
    });

    if (!store) {
      throw new NotFoundException('Store not found');
    }
  }

  private async findSellerProductOrThrow(sellerId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        store: { sellerId },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }
}
