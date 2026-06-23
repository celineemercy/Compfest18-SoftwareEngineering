import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns all orders belonging to a store, newest first.
   * Throws ForbiddenException if the store does not belong to the seller.
   */
  async findByStore(sellerId: string, storeId: string) {
    const store = await this.prisma.store.findFirst({
      where: { id: storeId, sellerId },
    });

    if (!store) {
      throw new ForbiddenException('Store not found or access denied');
    }

    return this.prisma.order.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
      include: {
        items: true,
      },
    });
  }

  /**
   * Advances an order from SEDANG_DIKEMAS → MENUNGGU_PENGIRIM.
   * Throws ForbiddenException if the order doesn't belong to the seller's store.
   * Throws BadRequestException if the order is not in SEDANG_DIKEMAS state.
   */
  async processOrder(sellerId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId },
      include: {
        store: { select: { sellerId: true } },
      },
    });

    if (!order || order.store.sellerId !== sellerId) {
      throw new NotFoundException('Order not found or access denied');
    }

    if (order.status !== OrderStatus.SEDANG_DIKEMAS) {
      throw new BadRequestException(
        `Order is already ${order.status} and cannot be processed again`,
      );
    }

    return this.prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.MENUNGGU_PENGIRIM },
      include: { items: true },
    });
  }
}
