import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  DeliveryJobStatus,
  DeliveryMethod,
  DiscountKind,
  DiscountType,
  OrderStatus,
  WalletTransactionType,
} from '@prisma/client';
import { MarketplaceService } from './marketplace.service';

type DiscountValidityOverride = {
  expiresAt: Date;
  isActive: boolean;
  remainingUsage?: number;
};

describe('MarketplaceService - level 4 discounts and seller processing', () => {
  const now = new Date('2026-07-01T00:00:00.000Z');
  const future = new Date('2026-08-01T00:00:00.000Z');
  const past = new Date('2026-06-01T00:00:00.000Z');

  const prisma = {
    voucher: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    promo: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    discountRedemption: {
      create: jest.fn(),
    },
    cart: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    cartItem: {
      deleteMany: jest.fn(),
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
    product: {
      updateMany: jest.fn(),
    },
    order: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    orderStatusHistory: {
      create: jest.fn(),
    },
    deliveryJob: {
      upsert: jest.fn(),
    },
    systemClock: {
      upsert: jest.fn(),
    },
    $transaction: jest.fn((callback: (tx: typeof prisma) => unknown) =>
      callback(prisma),
    ),
  };

  let service: MarketplaceService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation((callback) => callback(prisma));
    prisma.systemClock.upsert.mockResolvedValue({
      id: 'default',
      currentAt: now,
    });
    prisma.cart.findUnique.mockResolvedValue({
      id: 'cart-1',
      storeId: 'store-1',
      items: [
        {
          productId: 'product-1',
          quantity: 2,
          product: { id: 'product-1', name: 'Seaweed Chips', price: 50000 },
        },
      ],
    });
    prisma.address.findFirst.mockResolvedValue({ id: 'address-1', userId: 'buyer-1' });
    prisma.wallet.upsert.mockResolvedValue({ userId: 'buyer-1', balance: 250000 });
    prisma.product.updateMany.mockResolvedValue({ count: 1 });
    prisma.order.create.mockResolvedValue({
      id: 'order-1',
      status: OrderStatus.SEDANG_DIKEMAS,
    });
    prisma.voucher.findUnique.mockResolvedValue(null);
    prisma.promo.findUnique.mockResolvedValue(null);
    service = new MarketplaceService(prisma as never);
  });

  it('lets an admin create and list vouchers', async () => {
    const dto = {
      code: 'hemat10',
      type: DiscountType.PERCENTAGE,
      amount: 10,
      remainingUsage: 3,
      expiresAt: future.toISOString(),
    };
    prisma.voucher.create.mockResolvedValue({ id: 'voucher-1', code: 'HEMAT10' });
    prisma.voucher.findMany.mockResolvedValue([{ id: 'voucher-1', code: 'HEMAT10' }]);

    await expect(service.createVoucher('admin-1', dto)).resolves.toEqual({
      id: 'voucher-1',
      code: 'HEMAT10',
    });
    await service.listVouchers();

    expect(prisma.voucher.create).toHaveBeenCalledWith({
      data: {
        code: 'HEMAT10',
        type: DiscountType.PERCENTAGE,
        amount: 10,
        remainingUsage: 3,
        expiresAt: future,
        createdById: 'admin-1',
      },
    });
    expect(prisma.voucher.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
    });
  });

  it('lets an admin create and list promo codes', async () => {
    const dto = {
      code: 'promo25',
      type: DiscountType.FIXED,
      amount: 25000,
      expiresAt: future.toISOString(),
    };
    prisma.promo.create.mockResolvedValue({ id: 'promo-1', code: 'PROMO25' });
    prisma.promo.findMany.mockResolvedValue([{ id: 'promo-1', code: 'PROMO25' }]);

    await expect(service.createPromo('admin-1', dto)).resolves.toEqual({
      id: 'promo-1',
      code: 'PROMO25',
    });
    await service.listPromos();

    expect(prisma.promo.create).toHaveBeenCalledWith({
      data: {
        code: 'PROMO25',
        type: DiscountType.FIXED,
        amount: 25000,
        expiresAt: future,
        createdById: 'admin-1',
      },
    });
    expect(prisma.promo.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
    });
  });

  it('applies a valid voucher at checkout and decrements usage after redemption', async () => {
    prisma.voucher.findUnique.mockResolvedValue({
      id: 'voucher-1',
      code: 'HEMAT10',
      type: DiscountType.PERCENTAGE,
      amount: 10,
      remainingUsage: 2,
      expiresAt: future,
      isActive: true,
    });

    await service.checkout('buyer-1', {
      addressId: 'address-1',
      deliveryMethod: DeliveryMethod.REGULAR,
      discountCode: 'hemat10',
    });

    expect(prisma.order.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        subtotal: 100000,
        discountAmount: 10000,
        ppnAmount: 10800,
        deliveryFee: 10000,
        finalTotal: 110800,
        discountCode: 'HEMAT10',
        discountKind: DiscountKind.VOUCHER,
      }),
      include: expect.any(Object),
    });
    expect(prisma.wallet.update).toHaveBeenCalledWith({
      where: { userId: 'buyer-1' },
      data: { balance: { decrement: 110800 } },
    });
    expect(prisma.voucher.update).toHaveBeenCalledWith({
      where: { id: 'voucher-1' },
      data: { remainingUsage: { decrement: 1 } },
    });
    expect(prisma.discountRedemption.create).toHaveBeenCalledWith({
      data: {
        orderId: 'order-1',
        voucherId: 'voucher-1',
        promoId: undefined,
        kind: DiscountKind.VOUCHER,
        code: 'HEMAT10',
        amount: 10000,
      },
    });
  });

  it('applies a valid promo at checkout without decrementing voucher usage', async () => {
    prisma.promo.findUnique.mockResolvedValue({
      id: 'promo-1',
      code: 'PROMO25',
      type: DiscountType.FIXED,
      amount: 25000,
      expiresAt: future,
      isActive: true,
    });

    await service.checkout('buyer-1', {
      addressId: 'address-1',
      deliveryMethod: DeliveryMethod.REGULAR,
      discountCode: 'promo25',
    });

    expect(prisma.order.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        discountAmount: 25000,
        finalTotal: 94000,
        discountCode: 'PROMO25',
        discountKind: DiscountKind.PROMO,
      }),
      include: expect.any(Object),
    });
    expect(prisma.voucher.update).not.toHaveBeenCalled();
    expect(prisma.discountRedemption.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        promoId: 'promo-1',
        kind: DiscountKind.PROMO,
        code: 'PROMO25',
        amount: 25000,
      }),
    });
  });

  const invalidDiscountCases: Array<
    [string, DiscountValidityOverride | null, DiscountValidityOverride | null, string]
  > = [
    [
      'expired voucher',
      { expiresAt: past, isActive: true, remainingUsage: 1 },
      null,
      'Voucher is not valid',
    ],
    [
      'inactive voucher',
      { expiresAt: future, isActive: false, remainingUsage: 1 },
      null,
      'Voucher is not valid',
    ],
    [
      'exhausted voucher',
      { expiresAt: future, isActive: true, remainingUsage: 0 },
      null,
      'Voucher is not valid',
    ],
    [
      'expired promo',
      null,
      { expiresAt: past, isActive: true },
      'Promo is not valid',
    ],
    [
      'inactive promo',
      null,
      { expiresAt: future, isActive: false },
      'Promo is not valid',
    ],
    ['unknown code', null, null, 'Discount code not found'],
  ];

  it.each(invalidDiscountCases)(
    'rejects checkout with %s',
    async (_case, voucherOverride, promoOverride, message) => {
      if (voucherOverride) {
        prisma.voucher.findUnique.mockResolvedValue({
          id: 'voucher-1',
          code: 'BADCODE',
          type: DiscountType.FIXED,
          amount: 10000,
          ...voucherOverride,
        });
      }
      if (promoOverride) {
        prisma.promo.findUnique.mockResolvedValue({
          id: 'promo-1',
          code: 'BADCODE',
          type: DiscountType.FIXED,
          amount: 10000,
          ...promoOverride,
        });
      }

      await expect(
        service.checkout('buyer-1', {
          addressId: 'address-1',
          deliveryMethod: DeliveryMethod.REGULAR,
          discountCode: 'BADCODE',
        }),
      ).rejects.toThrow(message);

      expect(prisma.order.create).not.toHaveBeenCalled();
    },
  );

  it('lists only orders for the seller owned stores', async () => {
    prisma.order.findMany.mockResolvedValue([]);

    await service.listSellerOrders('seller-1');

    expect(prisma.order.findMany).toHaveBeenCalledWith({
      where: { store: { sellerId: 'seller-1' } },
      include: expect.any(Object),
      orderBy: { createdAt: 'desc' },
    });
  });

  it('lets a seller process an eligible packed order', async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: 'order-1',
      deliveryMethod: DeliveryMethod.REGULAR,
      status: OrderStatus.SEDANG_DIKEMAS,
    });
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      status: OrderStatus.MENUNGGU_PENGIRIM,
    });

    await expect(
      service.processSellerOrder('seller-1', 'order-1'),
    ).resolves.toEqual({
      id: 'order-1',
      status: OrderStatus.MENUNGGU_PENGIRIM,
    });

    expect(prisma.order.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'order-1',
        status: OrderStatus.SEDANG_DIKEMAS,
        store: { sellerId: 'seller-1' },
      },
    });
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: { status: OrderStatus.MENUNGGU_PENGIRIM },
    });
    expect(prisma.deliveryJob.upsert).toHaveBeenCalledWith({
      where: { orderId: 'order-1' },
      update: { status: DeliveryJobStatus.AVAILABLE },
      create: {
        orderId: 'order-1',
        earning: 7000,
      },
    });
  });

  it('rejects seller processing for ineligible or unowned orders', async () => {
    prisma.order.findFirst.mockResolvedValue(null);

    await expect(
      service.processSellerOrder('seller-1', 'order-99'),
    ).rejects.toThrow(NotFoundException);

    expect(prisma.order.update).not.toHaveBeenCalled();
    expect(prisma.deliveryJob.upsert).not.toHaveBeenCalled();
  });

  it('reports seller income from non-returned processed and completed orders', async () => {
    prisma.order.findMany.mockResolvedValue([
      {
        subtotal: 100000,
        discountAmount: 10000,
        status: OrderStatus.MENUNGGU_PENGIRIM,
      },
      {
        subtotal: 50000,
        discountAmount: 0,
        status: OrderStatus.PESANAN_SELESAI,
      },
    ]);

    await expect(service.getSellerIncome('seller-1')).resolves.toEqual({
      orderCount: 2,
      completedOrders: 1,
      grossIncome: 140000,
    });

    expect(prisma.order.findMany).toHaveBeenCalledWith({
      where: {
        store: { sellerId: 'seller-1' },
        status: { not: OrderStatus.DIKEMBALIKAN },
      },
      select: { subtotal: true, discountAmount: true, status: true },
    });
  });

  it('records payment transaction using the discounted checkout total', async () => {
    prisma.promo.findUnique.mockResolvedValue({
      id: 'promo-1',
      code: 'PROMO25',
      type: DiscountType.FIXED,
      amount: 25000,
      expiresAt: future,
      isActive: true,
    });

    await service.checkout('buyer-1', {
      addressId: 'address-1',
      deliveryMethod: DeliveryMethod.REGULAR,
      discountCode: 'PROMO25',
    });

    expect(prisma.walletTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'buyer-1',
        type: WalletTransactionType.PAYMENT,
        amount: -94000,
        orderId: 'order-1',
      }),
    });
  });
});
