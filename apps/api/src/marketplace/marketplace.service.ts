import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DeliveryJobStatus,
  DiscountKind,
  DiscountType,
  OrderStatus,
  OverdueAction,
  Prisma,
  Role,
  WalletTransactionType,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import {
  addSlaDays,
  calculatePpn,
  DELIVERY_RULES,
} from '../common/marketplace.constants';
import { PrismaService } from '../prisma/prisma.service';
import {
  AddCartItemDto,
  AdvanceTimeDto,
  CheckoutDto,
  CreateAddressDto,
  CreateAdminUserDto,
  CreateDiscountDto,
  CreateReviewDto,
  TopUpWalletDto,
  UpdateAddressDto,
  UpdateCartItemDto,
} from './dto/marketplace.dto';

type Tx = Prisma.TransactionClient;

@Injectable()
export class MarketplaceService {
  constructor(private readonly prisma: PrismaService) {}

  listReviews() {
    return this.prisma.applicationReview.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  createReview(dto: CreateReviewDto, userId?: string) {
    return this.prisma.applicationReview.create({
      data: {
        ...dto,
        userId,
      },
    });
  }

  async getWallet(userId: string) {
    return this.ensureWallet(userId);
  }

  async topUpWallet(userId: string, dto: TopUpWalletDto) {
    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.upsert({
        where: { userId },
        update: { balance: { increment: dto.amount } },
        create: { userId, balance: dto.amount },
      });

      await tx.walletTransaction.create({
        data: {
          userId,
          type: WalletTransactionType.TOP_UP,
          amount: dto.amount,
          note: 'Dummy top-up',
        },
      });

      return wallet;
    });
  }

  listWalletTransactions(userId: string) {
    return this.prisma.walletTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  listAddresses(userId: string) {
    return this.prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async createAddress(userId: string, dto: CreateAddressDto) {
    const hasAddress = await this.prisma.address.findFirst({
      where: { userId },
      select: { id: true },
    });

    return this.prisma.address.create({
      data: {
        ...dto,
        userId,
        isDefault: !hasAddress,
      },
    });
  }

  async updateAddress(userId: string, addressId: string, dto: UpdateAddressDto) {
    await this.findOwnedAddress(userId, addressId);
    return this.prisma.address.update({
      where: { id: addressId },
      data: dto,
    });
  }

  async deleteAddress(userId: string, addressId: string) {
    await this.findOwnedAddress(userId, addressId);
    await this.prisma.address.delete({ where: { id: addressId } });
    return { message: 'Address deleted successfully' };
  }

  async getCart(userId: string) {
    const cart = await this.ensureCart(userId);
    return this.prisma.cart.findUnique({
      where: { id: cart.id },
      include: {
        store: true,
        items: {
          include: { product: { include: { store: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async addCartItem(userId: string, dto: AddCartItemDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      include: { store: true },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (product.stock < dto.quantity) {
      throw new ConflictException('Insufficient product stock');
    }

    const cart = await this.ensureCart(userId);

    if (cart.storeId && cart.storeId !== product.storeId) {
      throw new BadRequestException('Cart can only contain one store at a time');
    }

    await this.prisma.cart.update({
      where: { id: cart.id },
      data: { storeId: product.storeId },
    });

    return this.prisma.cartItem.upsert({
      where: {
        cartId_productId: {
          cartId: cart.id,
          productId: product.id,
        },
      },
      update: { quantity: { increment: dto.quantity } },
      create: {
        cartId: cart.id,
        productId: product.id,
        quantity: dto.quantity,
      },
      include: { product: true },
    });
  }

  async updateCartItem(userId: string, itemId: string, dto: UpdateCartItemDto) {
    const item = await this.findOwnedCartItem(userId, itemId);

    if (item.product.stock < dto.quantity) {
      throw new ConflictException('Insufficient product stock');
    }

    return this.prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity: dto.quantity },
      include: { product: true },
    });
  }

  async deleteCartItem(userId: string, itemId: string) {
    const item = await this.findOwnedCartItem(userId, itemId);
    await this.prisma.cartItem.delete({ where: { id: item.id } });
    await this.clearCartStoreIfEmpty(item.cartId);
    return { message: 'Cart item deleted successfully' };
  }

  async checkout(userId: string, dto: CheckoutDto) {
    return this.prisma.$transaction(async (tx) => {
      const cart = await tx.cart.findUnique({
        where: { userId },
        include: {
          items: { include: { product: true } },
        },
      });

      if (!cart || !cart.storeId || cart.items.length === 0) {
        throw new BadRequestException('Cart is empty');
      }

      const address = await tx.address.findFirst({
        where: { id: dto.addressId, userId },
      });

      if (!address) {
        throw new NotFoundException('Address not found');
      }

      const wallet = await this.ensureWallet(userId, tx);
      const subtotal = cart.items.reduce(
        (sum, item) => sum + item.product.price * item.quantity,
        0,
      );
      const discount = await this.resolveDiscount(
        tx,
        dto.discountCode,
        subtotal,
      );
      const discountedSubtotal = Math.max(subtotal - discount.amount, 0);
      const ppnAmount = calculatePpn(discountedSubtotal);
      const deliveryFee = DELIVERY_RULES[dto.deliveryMethod].fee;
      const finalTotal = discountedSubtotal + ppnAmount + deliveryFee;

      if (wallet.balance < finalTotal) {
        throw new BadRequestException('Insufficient wallet balance');
      }

      for (const item of cart.items) {
        const stockUpdate = await tx.product.updateMany({
          where: {
            id: item.productId,
            stock: { gte: item.quantity },
          },
          data: { stock: { decrement: item.quantity } },
        });

        if (stockUpdate.count !== 1) {
          throw new ConflictException(`${item.product.name} is out of stock`);
        }
      }

      const order = await tx.order.create({
        data: {
          buyerId: userId,
          storeId: cart.storeId,
          addressId: address.id,
          status: OrderStatus.SEDANG_DIKEMAS,
          deliveryMethod: dto.deliveryMethod,
          subtotal,
          discountAmount: discount.amount,
          ppnAmount,
          deliveryFee,
          finalTotal,
          discountCode: discount.code,
          discountKind: discount.kind,
          dueAt: addSlaDays(await this.getCurrentTime(tx), dto.deliveryMethod),
          items: {
            create: cart.items.map((item) => ({
              productId: item.productId,
              productName: item.product.name,
              unitPrice: item.product.price,
              quantity: item.quantity,
              total: item.product.price * item.quantity,
            })),
          },
          histories: {
            create: {
              status: OrderStatus.SEDANG_DIKEMAS,
              note: 'Checkout completed',
            },
          },
        },
        include: this.orderInclude(),
      });

      await tx.wallet.update({
        where: { userId },
        data: { balance: { decrement: finalTotal } },
      });

      await tx.walletTransaction.create({
        data: {
          userId,
          type: WalletTransactionType.PAYMENT,
          amount: -finalTotal,
          orderId: order.id,
          note: 'Checkout payment',
        },
      });

      if (discount.kind === DiscountKind.VOUCHER && discount.voucherId) {
        await tx.voucher.update({
          where: { id: discount.voucherId },
          data: { remainingUsage: { decrement: 1 } },
        });
      }

      if (discount.kind && discount.code) {
        await tx.discountRedemption.create({
          data: {
            orderId: order.id,
            voucherId: discount.voucherId,
            promoId: discount.promoId,
            kind: discount.kind,
            code: discount.code,
            amount: discount.amount,
          },
        });
      }

      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      await tx.cart.update({
        where: { id: cart.id },
        data: { storeId: null },
      });

      return order;
    });
  }

  listBuyerOrders(userId: string) {
    return this.prisma.order.findMany({
      where: { buyerId: userId },
      include: this.orderInclude(),
      orderBy: { createdAt: 'desc' },
    });
  }

  async getBuyerOrder(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, buyerId: userId },
      include: this.orderInclude(),
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  async getBuyerSpending(userId: string) {
    const orders = await this.prisma.order.findMany({
      where: { buyerId: userId },
      select: { finalTotal: true, discountAmount: true, status: true },
    });

    return {
      orderCount: orders.length,
      completedOrders: orders.filter(
        (order) => order.status === OrderStatus.PESANAN_SELESAI,
      ).length,
      totalSpent: orders
        .filter((order) => order.status !== OrderStatus.DIKEMBALIKAN)
        .reduce((sum, order) => sum + order.finalTotal, 0),
      totalDiscount: orders.reduce(
        (sum, order) => sum + order.discountAmount,
        0,
      ),
    };
  }

  listSellerOrders(sellerId: string) {
    return this.prisma.order.findMany({
      where: { store: { sellerId } },
      include: this.orderInclude(),
      orderBy: { createdAt: 'desc' },
    });
  }

  async processSellerOrder(sellerId: string, orderId: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: {
          id: orderId,
          status: OrderStatus.SEDANG_DIKEMAS,
          store: { sellerId },
        },
      });

      if (!order) {
        throw new NotFoundException('Packable order not found');
      }

      await tx.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.MENUNGGU_PENGIRIM },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          status: OrderStatus.MENUNGGU_PENGIRIM,
          note: 'Seller processed order',
        },
      });

      await tx.deliveryJob.upsert({
        where: { orderId: order.id },
        update: { status: DeliveryJobStatus.AVAILABLE },
        create: {
          orderId: order.id,
          earning: DELIVERY_RULES[order.deliveryMethod].earning,
        },
      });

      return tx.order.findUnique({
        where: { id: order.id },
        include: this.orderInclude(),
      });
    });
  }

  async getSellerIncome(sellerId: string) {
    const orders = await this.prisma.order.findMany({
      where: {
        store: { sellerId },
        status: { not: OrderStatus.DIKEMBALIKAN },
      },
      select: { subtotal: true, discountAmount: true, status: true },
    });

    return {
      orderCount: orders.length,
      completedOrders: orders.filter(
        (order) => order.status === OrderStatus.PESANAN_SELESAI,
      ).length,
      grossIncome: orders.reduce(
        (sum, order) => sum + order.subtotal - order.discountAmount,
        0,
      ),
    };
  }

  createVoucher(adminId: string, dto: CreateDiscountDto) {
    return this.prisma.voucher.create({
      data: {
        code: dto.code.toUpperCase(),
        type: dto.type,
        amount: dto.amount,
        remainingUsage: dto.remainingUsage ?? 1,
        expiresAt: new Date(dto.expiresAt),
        createdById: adminId,
      },
    });
  }

  createPromo(adminId: string, dto: CreateDiscountDto) {
    return this.prisma.promo.create({
      data: {
        code: dto.code.toUpperCase(),
        type: dto.type,
        amount: dto.amount,
        expiresAt: new Date(dto.expiresAt),
        createdById: adminId,
      },
    });
  }

  listVouchers() {
    return this.prisma.voucher.findMany({ orderBy: { createdAt: 'desc' } });
  }

  listPromos() {
    return this.prisma.promo.findMany({ orderBy: { createdAt: 'desc' } });
  }

  listAvailableJobs() {
    return this.prisma.deliveryJob.findMany({
      where: {
        status: DeliveryJobStatus.AVAILABLE,
        order: { status: OrderStatus.MENUNGGU_PENGIRIM },
      },
      include: { order: { include: { store: true, address: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  listDriverJobs(driverId: string) {
    return this.prisma.deliveryJob.findMany({
      where: { driverId },
      include: { order: { include: this.orderInclude() } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async takeJob(driverId: string, jobId: string) {
    return this.prisma.$transaction(async (tx) => {
      const jobUpdate = await tx.deliveryJob.updateMany({
        where: {
          id: jobId,
          status: DeliveryJobStatus.AVAILABLE,
          driverId: null,
          order: { status: OrderStatus.MENUNGGU_PENGIRIM },
        },
        data: {
          status: DeliveryJobStatus.TAKEN,
          driverId,
          takenAt: await this.getCurrentTime(tx),
        },
      });

      if (jobUpdate.count !== 1) {
        throw new ConflictException('Delivery job is no longer available');
      }

      const job = await tx.deliveryJob.findUniqueOrThrow({
        where: { id: jobId },
      });

      await tx.order.update({
        where: { id: job.orderId },
        data: { status: OrderStatus.SEDANG_DIKIRIM },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: job.orderId,
          status: OrderStatus.SEDANG_DIKIRIM,
          note: 'Driver took delivery job',
        },
      });

      return tx.deliveryJob.findUnique({
        where: { id: jobId },
        include: { order: { include: this.orderInclude() } },
      });
    });
  }

  async completeJob(driverId: string, jobId: string) {
    return this.prisma.$transaction(async (tx) => {
      const now = await this.getCurrentTime(tx);
      const job = await tx.deliveryJob.findFirst({
        where: {
          id: jobId,
          driverId,
          status: DeliveryJobStatus.TAKEN,
          order: { status: OrderStatus.SEDANG_DIKIRIM },
        },
      });

      if (!job) {
        throw new NotFoundException('Active delivery job not found');
      }

      await tx.deliveryJob.update({
        where: { id: job.id },
        data: { status: DeliveryJobStatus.COMPLETED, completedAt: now },
      });

      await tx.order.update({
        where: { id: job.orderId },
        data: {
          status: OrderStatus.PESANAN_SELESAI,
          completedAt: now,
        },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: job.orderId,
          status: OrderStatus.PESANAN_SELESAI,
          note: 'Driver completed delivery',
        },
      });

      await tx.driverEarning.upsert({
        where: { jobId: job.id },
        update: {},
        create: {
          jobId: job.id,
          driverId,
          amount: job.earning,
        },
      });

      return tx.deliveryJob.findUnique({
        where: { id: job.id },
        include: { order: { include: this.orderInclude() } },
      });
    });
  }

  async getDriverEarnings(driverId: string) {
    const earnings = await this.prisma.driverEarning.findMany({
      where: { driverId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      total: earnings.reduce((sum, earning) => sum + earning.amount, 0),
      earnings,
    };
  }

  async getAdminMonitoring() {
    const [
      users,
      stores,
      products,
      orders,
      vouchers,
      promos,
      deliveryJobs,
      overdueOrders,
      clock,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.store.count(),
      this.prisma.product.count(),
      this.prisma.order.count(),
      this.prisma.voucher.count(),
      this.prisma.promo.count(),
      this.prisma.deliveryJob.count(),
      this.prisma.order.count({
        where: {
          status: OrderStatus.SEDANG_DIKIRIM,
          dueAt: { lt: await this.getCurrentTime() },
          overdueLogs: { none: {} },
        },
      }),
      this.getCurrentTime(),
    ]);

    return {
      clock,
      users,
      stores,
      products,
      orders,
      vouchers,
      promos,
      deliveryJobs,
      overdueOrders,
    };
  }

  async advanceTime(dto: AdvanceTimeDto) {
    const current = await this.getCurrentTime();
    const next = new Date(current);
    next.setDate(next.getDate() + dto.days);

    return this.prisma.systemClock.upsert({
      where: { id: 'default' },
      update: { currentAt: next },
      create: { id: 'default', currentAt: next },
    });
  }

  async processOverdueOrders() {
    const now = await this.getCurrentTime();
    const orders = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.SEDANG_DIKIRIM,
        dueAt: { lt: now },
        overdueLogs: { none: {} },
      },
      include: { items: true, deliveryJob: true },
    });

    const processed = [];

    for (const order of orders) {
      const result = await this.prisma.$transaction(async (tx) => {
        const alreadyProcessed = await tx.overdueProcessingLog.findUnique({
          where: { orderId: order.id },
        });

        if (alreadyProcessed) {
          return null;
        }

        await tx.order.update({
          where: { id: order.id },
          data: {
            status: OrderStatus.DIKEMBALIKAN,
            returnedAt: now,
          },
        });

        for (const item of order.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          });
        }

        await tx.wallet.upsert({
          where: { userId: order.buyerId },
          update: { balance: { increment: order.finalTotal } },
          create: { userId: order.buyerId, balance: order.finalTotal },
        });

        await tx.walletTransaction.create({
          data: {
            userId: order.buyerId,
            orderId: order.id,
            type: WalletTransactionType.REFUND,
            amount: order.finalTotal,
            note: 'Overdue delivery refund',
          },
        });

        if (order.deliveryJob) {
          await tx.deliveryJob.update({
            where: { id: order.deliveryJob.id },
            data: { status: DeliveryJobStatus.RETURNED },
          });
        }

        await tx.orderStatusHistory.create({
          data: {
            orderId: order.id,
            status: OrderStatus.DIKEMBALIKAN,
            note: 'Overdue delivery returned and refunded',
          },
        });

        await tx.overdueProcessingLog.create({
          data: {
            orderId: order.id,
            action: OverdueAction.REFUND,
            note: 'Auto refund for overdue delivery',
          },
        });

        return order.id;
      });

      if (result) {
        processed.push(result);
      }
    }

    return { processedCount: processed.length, orderIds: processed };
  }

  async createAdminUser(adminId: string, dto: CreateAdminUserDto) {
    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const roles = dto.roles?.length ? dto.roles : [Role.ADMIN];

    return this.prisma.user.create({
      data: {
        email: dto.email,
        username: dto.username,
        password: hashedPassword,
        roles,
        adminCreatedById: adminId,
        wallet: roles.includes(Role.BUYER) ? { create: {} } : undefined,
        cart: roles.includes(Role.BUYER) ? { create: {} } : undefined,
      },
      select: {
        id: true,
        email: true,
        username: true,
        roles: true,
        createdAt: true,
      },
    });
  }

  private async findOwnedAddress(userId: string, addressId: string) {
    const address = await this.prisma.address.findFirst({
      where: { id: addressId, userId },
    });

    if (!address) {
      throw new NotFoundException('Address not found');
    }

    return address;
  }

  private async findOwnedCartItem(userId: string, itemId: string) {
    const item = await this.prisma.cartItem.findFirst({
      where: {
        id: itemId,
        cart: { userId },
      },
      include: { product: true },
    });

    if (!item) {
      throw new NotFoundException('Cart item not found');
    }

    return item;
  }

  private async clearCartStoreIfEmpty(cartId: string) {
    const remaining = await this.prisma.cartItem.count({ where: { cartId } });

    if (remaining === 0) {
      await this.prisma.cart.update({
        where: { id: cartId },
        data: { storeId: null },
      });
    }
  }

  private async ensureWallet(userId: string, tx: Tx | PrismaService = this.prisma) {
    return tx.wallet.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
  }

  private async ensureCart(userId: string) {
    return this.prisma.cart.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
  }

  private async resolveDiscount(tx: Tx, code: string | undefined, subtotal: number) {
    if (!code) {
      return { amount: 0 };
    }

    const normalized = code.toUpperCase();
    const now = await this.getCurrentTime(tx);
    const voucher = await tx.voucher.findUnique({
      where: { code: normalized },
    });

    if (voucher) {
      if (!voucher.isActive || voucher.expiresAt < now || voucher.remainingUsage < 1) {
        throw new BadRequestException('Voucher is not valid');
      }

      return {
        kind: DiscountKind.VOUCHER,
        code: voucher.code,
        voucherId: voucher.id,
        amount: this.calculateDiscountAmount(voucher.type, voucher.amount, subtotal),
      };
    }

    const promo = await tx.promo.findUnique({ where: { code: normalized } });

    if (promo) {
      if (!promo.isActive || promo.expiresAt < now) {
        throw new BadRequestException('Promo is not valid');
      }

      return {
        kind: DiscountKind.PROMO,
        code: promo.code,
        promoId: promo.id,
        amount: this.calculateDiscountAmount(promo.type, promo.amount, subtotal),
      };
    }

    throw new BadRequestException('Discount code not found');
  }

  private calculateDiscountAmount(
    type: DiscountType,
    amount: number,
    subtotal: number,
  ) {
    const discount =
      type === DiscountType.PERCENTAGE
        ? Math.round((subtotal * amount) / 100)
        : amount;

    return Math.min(discount, subtotal);
  }

  private async getCurrentTime(tx: Tx | PrismaService = this.prisma) {
    const clock = await tx.systemClock.upsert({
      where: { id: 'default' },
      update: {},
      create: { id: 'default' },
    });

    return clock.currentAt;
  }

  private orderInclude() {
    return {
      store: true,
      address: true,
      items: true,
      histories: { orderBy: { createdAt: 'asc' as const } },
      deliveryJob: true,
      discountRedemptions: true,
    };
  }
}
