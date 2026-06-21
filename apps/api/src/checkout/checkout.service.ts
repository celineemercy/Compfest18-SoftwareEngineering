import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DELIVERY_FEES, DeliveryMethod, PPN_RATE } from './checkout.constants';
import { CalculateCheckoutDto } from './dto/calculate-checkout.dto';
import { PayCheckoutDto } from './dto/pay-checkout.dto';

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

type CheckoutCart = Prisma.CartGetPayload<{ include: typeof checkoutCartInclude }>;

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

    return this.buildQuote(cart, dto.deliveryMethod);
  }

  async pay(userId: string, dto: PayCheckoutDto) {
    return this.prisma.$transaction(async (tx) => {
      const [cart, address, wallet] = await Promise.all([
        tx.cart.findUnique({
          where: { userId },
          include: checkoutCartInclude,
        }),
        tx.address.findFirst({
          where: {
            id: dto.addressId,
            userId,
          },
        }),
        tx.wallet.findUnique({
          where: { userId },
        }),
      ]);

      if (!cart || cart.items.length === 0) {
        throw new BadRequestException('Cart is empty');
      }

      if (!cart.storeId) {
        throw new BadRequestException('Cart store is missing');
      }

      if (!address) {
        throw new NotFoundException('Address not found');
      }

      const quote = this.buildQuote(cart, dto.deliveryMethod);

      if (!wallet || wallet.balance < quote.finalTotal) {
        throw new BadRequestException('Insufficient wallet balance');
      }

      for (const item of cart.items) {
        if (item.product.stock < item.quantity) {
          throw new BadRequestException(
            `${item.product.name} does not have enough stock`,
          );
        }
      }

      for (const item of cart.items) {
        const updateResult = await tx.product.updateMany({
          where: {
            id: item.productId,
            stock: {
              gte: item.quantity,
            },
          },
          data: {
            stock: {
              decrement: item.quantity,
            },
          },
        });

        if (updateResult.count !== 1) {
          throw new BadRequestException(
            `${item.product.name} does not have enough stock`,
          );
        }
      }

      const updatedWallet = await tx.wallet.update({
        where: { userId },
        data: {
          balance: {
            decrement: quote.finalTotal,
          },
        },
      });

      const order = await tx.order.create({
        data: {
          buyerId: userId,
          storeId: cart.storeId,
          addressId: address.id,
          status: OrderStatus.SEDANG_DIKEMAS,
          deliveryMethod: dto.deliveryMethod,
          deliveryFee: quote.deliveryFee,
          subtotal: quote.subtotal,
          ppn: quote.ppn,
          finalTotal: quote.finalTotal,
          shippingLabel: address.label,
          shippingRecipientName: address.recipientName,
          shippingPhone: address.phone,
          shippingStreet: address.street,
          shippingCity: address.city,
          shippingProvince: address.province,
          shippingPostalCode: address.postalCode,
          items: {
            create: cart.items.map((item) => ({
              productId: item.productId,
              productName: item.product.name,
              quantity: item.quantity,
              snapshotPrice: item.snapshotPrice,
              lineTotal: item.quantity * item.snapshotPrice,
            })),
          },
        },
        include: {
          store: {
            select: {
              id: true,
              name: true,
            },
          },
          items: true,
        },
      });

      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      await tx.cart.update({
        where: { id: cart.id },
        data: { storeId: null },
      });

      return {
        order,
        remainingWalletBalance: updatedWallet.balance,
      };
    });
  }

  private buildQuote(cart: CheckoutCart, deliveryMethod: DeliveryMethod) {
    const items = cart.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      quantity: item.quantity,
      snapshotPrice: item.snapshotPrice,
      lineTotal: item.quantity * item.snapshotPrice,
      product: item.product,
    }));
    const subtotal = items.reduce((total, item) => total + item.lineTotal, 0);
    const deliveryFee = DELIVERY_FEES[deliveryMethod];
    const ppn = Math.round(subtotal * PPN_RATE);

    return {
      store: cart.store,
      items,
      subtotal,
      deliveryMethod,
      deliveryFee,
      ppnRate: PPN_RATE,
      ppn,
      finalTotal: subtotal + deliveryFee + ppn,
    };
  }
}
