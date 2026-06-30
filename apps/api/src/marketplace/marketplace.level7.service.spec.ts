import {
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import {
  DeliveryJobStatus,
  DeliveryMethod,
  DiscountKind,
  DiscountType,
  OrderStatus,
  OverdueAction,
  WalletTransactionType,
} from '@prisma/client';
import { MarketplaceService } from './marketplace.service';

describe('MarketplaceService Level 7 verification coverage', () => {
  const now = new Date('2026-06-30T08:00:00.000Z');

  function serviceWith(prisma: object) {
    return new MarketplaceService(prisma as never);
  }

  function transactionPrisma<T extends object>(tx: T) {
    return {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
  }

  function checkoutTx() {
    return {
      cart: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      address: {
        findFirst: jest.fn(),
      },
      wallet: {
        upsert: jest.fn(),
        update: jest.fn(),
      },
      walletTransaction: {
        create: jest.fn(),
      },
      voucher: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      promo: {
        findUnique: jest.fn(),
      },
      product: {
        updateMany: jest.fn(),
      },
      order: {
        create: jest.fn(),
      },
      discountRedemption: {
        create: jest.fn(),
      },
      cartItem: {
        deleteMany: jest.fn(),
      },
      systemClock: {
        upsert: jest.fn().mockResolvedValue({ currentAt: now }),
      },
    };
  }

  const checkoutDto = {
    addressId: 'address-1',
    deliveryMethod: DeliveryMethod.REGULAR,
  };

  const cart = {
    id: 'cart-1',
    storeId: 'store-1',
    items: [
      {
        productId: 'product-1',
        quantity: 2,
        product: {
          id: 'product-1',
          name: 'Seaweed Chips',
          price: 25000,
        },
      },
    ],
  };

  it('rejects products from a second store in the same cart', async () => {
    const prisma = {
      product: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'product-2',
          storeId: 'store-2',
          stock: 10,
          store: { id: 'store-2' },
        }),
      },
      cart: {
        upsert: jest.fn().mockResolvedValue({
          id: 'cart-1',
          storeId: 'store-1',
        }),
        update: jest.fn(),
      },
      cartItem: {
        upsert: jest.fn(),
      },
    };
    const service = serviceWith(prisma);

    await expect(
      service.addCartItem('buyer-1', { productId: 'product-2', quantity: 1 }),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.cart.update).not.toHaveBeenCalled();
    expect(prisma.cartItem.upsert).not.toHaveBeenCalled();
  });

  it('rejects checkout when the wallet cannot cover the final total', async () => {
    const tx = checkoutTx();
    tx.cart.findUnique.mockResolvedValue(cart);
    tx.address.findFirst.mockResolvedValue({ id: 'address-1' });
    tx.wallet.upsert.mockResolvedValue({ userId: 'buyer-1', balance: 1000 });
    const prisma = transactionPrisma(tx);
    const service = serviceWith(prisma);

    await expect(service.checkout('buyer-1', checkoutDto)).rejects.toThrow(
      BadRequestException,
    );

    expect(tx.product.updateMany).not.toHaveBeenCalled();
    expect(tx.order.create).not.toHaveBeenCalled();
  });

  it('rejects checkout when stock is no longer available', async () => {
    const tx = checkoutTx();
    tx.cart.findUnique.mockResolvedValue(cart);
    tx.address.findFirst.mockResolvedValue({ id: 'address-1' });
    tx.wallet.upsert.mockResolvedValue({ userId: 'buyer-1', balance: 1000000 });
    tx.product.updateMany.mockResolvedValue({ count: 0 });
    const prisma = transactionPrisma(tx);
    const service = serviceWith(prisma);

    await expect(service.checkout('buyer-1', checkoutDto)).rejects.toThrow(
      ConflictException,
    );

    expect(tx.order.create).not.toHaveBeenCalled();
    expect(tx.wallet.update).not.toHaveBeenCalled();
  });

  it('rejects checkout with an unknown discount code', async () => {
    const tx = checkoutTx();
    tx.cart.findUnique.mockResolvedValue(cart);
    tx.address.findFirst.mockResolvedValue({ id: 'address-1' });
    tx.wallet.upsert.mockResolvedValue({ userId: 'buyer-1', balance: 1000000 });
    tx.voucher.findUnique.mockResolvedValue(null);
    tx.promo.findUnique.mockResolvedValue(null);
    const prisma = transactionPrisma(tx);
    const service = serviceWith(prisma);

    await expect(
      service.checkout('buyer-1', { ...checkoutDto, discountCode: 'missing' }),
    ).rejects.toThrow(BadRequestException);

    expect(tx.product.updateMany).not.toHaveBeenCalled();
    expect(tx.order.create).not.toHaveBeenCalled();
  });

  it('rejects checkout with an expired voucher', async () => {
    const tx = checkoutTx();
    tx.cart.findUnique.mockResolvedValue(cart);
    tx.address.findFirst.mockResolvedValue({ id: 'address-1' });
    tx.wallet.upsert.mockResolvedValue({ userId: 'buyer-1', balance: 1000000 });
    tx.voucher.findUnique.mockResolvedValue({
      id: 'voucher-1',
      code: 'OLD',
      type: DiscountType.FIXED,
      amount: 10000,
      remainingUsage: 1,
      isActive: true,
      expiresAt: new Date('2026-06-29T08:00:00.000Z'),
    });
    const prisma = transactionPrisma(tx);
    const service = serviceWith(prisma);

    await expect(
      service.checkout('buyer-1', { ...checkoutDto, discountCode: 'old' }),
    ).rejects.toThrow(BadRequestException);

    expect(tx.order.create).not.toHaveBeenCalled();
  });

  it('creates checkout records, decrements stock, records payment, and clears cart', async () => {
    const tx = checkoutTx();
    tx.cart.findUnique.mockResolvedValue(cart);
    tx.address.findFirst.mockResolvedValue({ id: 'address-1' });
    tx.wallet.upsert.mockResolvedValue({ userId: 'buyer-1', balance: 1000000 });
    tx.voucher.findUnique.mockResolvedValue({
      id: 'voucher-1',
      code: 'HEMAT10K',
      type: DiscountType.FIXED,
      amount: 10000,
      remainingUsage: 3,
      isActive: true,
      expiresAt: new Date('2026-07-30T08:00:00.000Z'),
    });
    tx.product.updateMany.mockResolvedValue({ count: 1 });
    tx.order.create.mockResolvedValue({
      id: 'order-1',
      finalTotal: 54800,
      histories: [{ status: OrderStatus.SEDANG_DIKEMAS }],
    });
    const prisma = transactionPrisma(tx);
    const service = serviceWith(prisma);

    await expect(
      service.checkout('buyer-1', { ...checkoutDto, discountCode: 'hemat10k' }),
    ).resolves.toMatchObject({ id: 'order-1', finalTotal: 54800 });

    expect(tx.product.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'product-1',
        stock: { gte: 2 },
      },
      data: { stock: { decrement: 2 } },
    });
    expect(tx.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          buyerId: 'buyer-1',
          storeId: 'store-1',
          status: OrderStatus.SEDANG_DIKEMAS,
          subtotal: 50000,
          discountAmount: 10000,
          ppnAmount: 4800,
          deliveryFee: 10000,
          finalTotal: 54800,
          discountCode: 'HEMAT10K',
          discountKind: DiscountKind.VOUCHER,
          items: {
            create: [
              {
                productId: 'product-1',
                productName: 'Seaweed Chips',
                unitPrice: 25000,
                quantity: 2,
                total: 50000,
              },
            ],
          },
          histories: {
            create: {
              status: OrderStatus.SEDANG_DIKEMAS,
              note: 'Checkout completed',
            },
          },
        }),
      }),
    );
    expect(tx.wallet.update).toHaveBeenCalledWith({
      where: { userId: 'buyer-1' },
      data: { balance: { decrement: 54800 } },
    });
    expect(tx.walletTransaction.create).toHaveBeenCalledWith({
      data: {
        userId: 'buyer-1',
        type: WalletTransactionType.PAYMENT,
        amount: -54800,
        orderId: 'order-1',
        note: 'Checkout payment',
      },
    });
    expect(tx.voucher.update).toHaveBeenCalledWith({
      where: { id: 'voucher-1' },
      data: { remainingUsage: { decrement: 1 } },
    });
    expect(tx.discountRedemption.create).toHaveBeenCalledWith({
      data: {
        orderId: 'order-1',
        voucherId: 'voucher-1',
        promoId: undefined,
        kind: DiscountKind.VOUCHER,
        code: 'HEMAT10K',
        amount: 10000,
      },
    });
    expect(tx.cartItem.deleteMany).toHaveBeenCalledWith({
      where: { cartId: 'cart-1' },
    });
    expect(tx.cart.update).toHaveBeenCalledWith({
      where: { id: 'cart-1' },
      data: { storeId: null },
    });
  });

  it('prevents a delivery job from being double-claimed', async () => {
    const tx = {
      deliveryJob: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUniqueOrThrow: jest.fn(),
      },
      systemClock: {
        upsert: jest.fn().mockResolvedValue({ currentAt: now }),
      },
      order: {
        update: jest.fn(),
      },
      orderStatusHistory: {
        create: jest.fn(),
      },
    };
    const prisma = transactionPrisma(tx);
    const service = serviceWith(prisma);

    await expect(service.takeJob('driver-2', 'job-1')).rejects.toThrow(
      ConflictException,
    );

    expect(tx.deliveryJob.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(tx.order.update).not.toHaveBeenCalled();
  });

  it('processes overdue orders idempotently without double refunding or restoring stock', async () => {
    const overdueOrder = {
      id: 'order-1',
      buyerId: 'buyer-1',
      finalTotal: 54800,
      items: [{ productId: 'product-1', quantity: 2 }],
      deliveryJob: { id: 'job-1' },
    };
    const tx = {
      overdueProcessingLog: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
      order: {
        update: jest.fn(),
      },
      product: {
        update: jest.fn(),
      },
      wallet: {
        upsert: jest.fn(),
      },
      walletTransaction: {
        create: jest.fn(),
      },
      deliveryJob: {
        update: jest.fn(),
      },
      orderStatusHistory: {
        create: jest.fn(),
      },
    };
    const prisma = {
      systemClock: {
        upsert: jest.fn().mockResolvedValue({ currentAt: now }),
      },
      order: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([overdueOrder])
          .mockResolvedValueOnce([]),
      },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const service = serviceWith(prisma);

    await expect(service.processOverdueOrders()).resolves.toEqual({
      processedCount: 1,
      orderIds: ['order-1'],
    });
    await expect(service.processOverdueOrders()).resolves.toEqual({
      processedCount: 0,
      orderIds: [],
    });

    expect(tx.product.update).toHaveBeenCalledTimes(1);
    expect(tx.product.update).toHaveBeenCalledWith({
      where: { id: 'product-1' },
      data: { stock: { increment: 2 } },
    });
    expect(tx.wallet.upsert).toHaveBeenCalledTimes(1);
    expect(tx.wallet.upsert).toHaveBeenCalledWith({
      where: { userId: 'buyer-1' },
      update: { balance: { increment: 54800 } },
      create: { userId: 'buyer-1', balance: 54800 },
    });
    expect(tx.walletTransaction.create).toHaveBeenCalledTimes(1);
    expect(tx.walletTransaction.create).toHaveBeenCalledWith({
      data: {
        userId: 'buyer-1',
        orderId: 'order-1',
        type: WalletTransactionType.REFUND,
        amount: 54800,
        note: 'Overdue delivery refund',
      },
    });
    expect(tx.deliveryJob.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: { status: DeliveryJobStatus.RETURNED },
    });
    expect(tx.overdueProcessingLog.create).toHaveBeenCalledWith({
      data: {
        orderId: 'order-1',
        action: OverdueAction.REFUND,
        note: 'Auto refund for overdue delivery',
      },
    });
  });
});
