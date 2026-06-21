import { BadRequestException, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DELIVERY_FEES, PPN_RATE } from './checkout.constants';
import { CalculateCheckoutDto } from './dto/calculate-checkout.dto';

const checkoutCartInclude = {
  store: {
    select: {
      id: true,
      name: true,
    },
  },
  items: {
    orderBy: {
      createdAt: 'asc',
    },
    include: {
      product: {
        include: {
          store: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.CartInclude;

@Injectable()
export class CheckoutService {
  constructor(private readonly prisma: PrismaService) {}

  async calculate(userId: string, dto: CalculateCheckoutDto) {
    const cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: checkoutCartInclude,
    });

    if (!cart || cart.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    const items = cart.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      quantity: item.quantity,
      snapshotPrice: item.snapshotPrice,
      lineTotal: item.quantity * item.snapshotPrice,
      product: item.product,
    }));
    const subtotal = items.reduce((total, item) => total + item.lineTotal, 0);
    const deliveryFee = DELIVERY_FEES[dto.deliveryMethod];
    const ppn = Math.round(subtotal * PPN_RATE);

    return {
      store: cart.store,
      items,
      subtotal,
      deliveryMethod: dto.deliveryMethod,
      deliveryFee,
      ppnRate: PPN_RATE,
      ppn,
      finalTotal: subtotal + deliveryFee + ppn,
    };
  }
}
