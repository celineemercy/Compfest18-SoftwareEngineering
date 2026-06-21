import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

const cartInclude = {
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

type CartClient = PrismaService | Prisma.TransactionClient | PrismaClient;
type CartWithDetails = Prisma.CartGetPayload<{ include: typeof cartInclude }>;

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  async findMine(userId: string) {
    const cart = await this.getOrCreateCart(userId);
    return this.toCartResponse(cart);
  }

  async addItem(userId: string, dto: AddCartItemDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      include: {
        store: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (product.stock < 1) {
      throw new BadRequestException('Product is out of stock');
    }

    const cart = await this.prisma.$transaction(async (tx) => {
      const currentCart = await this.getOrCreateCart(userId, tx);

      if (currentCart.storeId && currentCart.storeId !== product.storeId) {
        throw new ConflictException({
          message: 'Cart already contains items from another store',
          currentStore: currentCart.store,
          incomingStore: product.store,
        });
      }

      const existingItem = currentCart.items.find(
        (item) => item.productId === product.id,
      );
      const nextQuantity = Math.min(
        (existingItem?.quantity ?? 0) + dto.quantity,
        product.stock,
      );

      if (!currentCart.storeId) {
        await tx.cart.update({
          where: { id: currentCart.id },
          data: { storeId: product.storeId },
        });
      }

      if (existingItem) {
        await tx.cartItem.update({
          where: { id: existingItem.id },
          data: {
            quantity: nextQuantity,
            snapshotPrice: product.price,
          },
        });
      } else {
        await tx.cartItem.create({
          data: {
            cartId: currentCart.id,
            productId: product.id,
            quantity: nextQuantity,
            snapshotPrice: product.price,
          },
        });
      }

      return this.findCartById(currentCart.id, tx);
    });

    return this.toCartResponse(cart);
  }

  async updateItem(
    userId: string,
    itemId: string,
    dto: UpdateCartItemDto,
  ) {
    const item = await this.findOwnedItemOrThrow(userId, itemId);
    const nextQuantity = Math.min(dto.quantity, item.product.stock);

    if (item.product.stock < 1) {
      throw new BadRequestException('Product is out of stock');
    }

    const cart = await this.prisma.$transaction(async (tx) => {
      await tx.cartItem.update({
        where: { id: itemId },
        data: {
          quantity: nextQuantity,
          snapshotPrice: item.product.price,
        },
      });

      return this.findCartById(item.cartId, tx);
    });

    return this.toCartResponse(cart);
  }

  async removeItem(userId: string, itemId: string) {
    const item = await this.findOwnedItemOrThrow(userId, itemId);

    const cart = await this.prisma.$transaction(async (tx) => {
      await tx.cartItem.delete({ where: { id: itemId } });
      const remainingItems = await tx.cartItem.count({
        where: { cartId: item.cartId },
      });

      if (remainingItems === 0) {
        await tx.cart.update({
          where: { id: item.cartId },
          data: { storeId: null },
        });
      }

      return this.findCartById(item.cartId, tx);
    });

    return this.toCartResponse(cart);
  }

  async clear(userId: string) {
    const cart = await this.getOrCreateCart(userId);

    const clearedCart = await this.prisma.$transaction(async (tx) => {
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      await tx.cart.update({
        where: { id: cart.id },
        data: { storeId: null },
      });

      return this.findCartById(cart.id, tx);
    });

    return this.toCartResponse(clearedCart);
  }

  private async getOrCreateCart(userId: string, client: CartClient = this.prisma) {
    return client.cart.upsert({
      where: { userId },
      update: {},
      create: { userId },
      include: cartInclude,
    });
  }

  private async findCartById(cartId: string, client: CartClient = this.prisma) {
    const cart = await client.cart.findUnique({
      where: { id: cartId },
      include: cartInclude,
    });

    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    return cart;
  }

  private async findOwnedItemOrThrow(userId: string, itemId: string) {
    const item = await this.prisma.cartItem.findFirst({
      where: {
        id: itemId,
        cart: { userId },
      },
      include: {
        product: true,
      },
    });

    if (!item) {
      throw new NotFoundException('Cart item not found');
    }

    return item;
  }

  private toCartResponse(cart: CartWithDetails) {
    const items = cart.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      quantity: item.quantity,
      snapshotPrice: item.snapshotPrice,
      lineTotal: item.quantity * item.snapshotPrice,
      product: item.product,
    }));

    return {
      id: cart.id,
      userId: cart.userId,
      storeId: cart.storeId,
      store: cart.store,
      items,
      totalItems: items.reduce((total, item) => total + item.quantity, 0),
      subtotal: items.reduce((total, item) => total + item.lineTotal, 0),
      createdAt: cart.createdAt,
      updatedAt: cart.updatedAt,
    };
  }
}
