import { BadRequestException } from '@nestjs/common';
import { NotFoundException } from '@nestjs/common';
import { CheckoutService } from './checkout.service';

describe('CheckoutService', () => {
  const store = { id: 'store-1', name: 'Store A' };
  const product = {
    id: 'product-1',
    name: 'Seaweed Chips',
    description: null,
    price: 25000,
    imageUrl: null,
    stock: 5,
    storeId: store.id,
    store,
    createdAt: new Date('2026-06-21T00:00:00.000Z'),
    updatedAt: new Date('2026-06-21T00:00:00.000Z'),
  };
  const cart = {
    id: 'cart-1',
    userId: 'buyer-1',
    storeId: store.id,
    store,
    items: [
      {
        id: 'item-1',
        cartId: 'cart-1',
        productId: product.id,
        quantity: 2,
        snapshotPrice: product.price,
        product,
        createdAt: new Date('2026-06-21T00:00:00.000Z'),
        updatedAt: new Date('2026-06-21T00:00:00.000Z'),
      },
    ],
    createdAt: new Date('2026-06-21T00:00:00.000Z'),
    updatedAt: new Date('2026-06-21T00:00:00.000Z'),
  };
  const address = {
    id: 'address-1',
    userId: 'buyer-1',
    label: 'Home',
    recipientName: 'Alya',
    phone: '+628123',
    street: 'Jl. Sudirman No. 1',
    city: 'Jakarta',
    province: 'DKI Jakarta',
    postalCode: '10210',
    isDefault: true,
    createdAt: new Date('2026-06-21T00:00:00.000Z'),
    updatedAt: new Date('2026-06-21T00:00:00.000Z'),
  };

  // Base discount code fixture (PROMO type — unlimited usage)
  const promoCode = {
    id: 'dc-1',
    code: 'SAVE10',
    type: 'PROMO',
    discountPct: 0.1,
    usageLimit: null,
    usageCount: 0,
    expiresAt: null,
    isActive: true,
    createdAt: new Date('2026-06-21T00:00:00.000Z'),
    updatedAt: new Date('2026-06-21T00:00:00.000Z'),
  };

  // Voucher type — limited usage
  const voucherCode = {
    ...promoCode,
    id: 'dc-2',
    code: 'VOUCHER5',
    type: 'VOUCHER',
    discountPct: 0.05,
    usageLimit: 100,
    usageCount: 0,
  };

  const prisma = {
    $transaction: jest.fn(async (callback) => callback(prisma)),
    address: {
      findFirst: jest.fn(),
    },
    cart: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    cartItem: {
      deleteMany: jest.fn(),
    },
    discountCode: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    order: {
      create: jest.fn(),
    },
    product: {
      updateMany: jest.fn(),
    },
    wallet: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };
  let service: CheckoutService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CheckoutService(prisma as never);
  });

  // ─── Existing tests ───────────────────────────────────────────────────────────

  it('calculates instant checkout totals with PPN on subtotal only', async () => {
    prisma.cart.findUnique.mockResolvedValue(cart);

    await expect(
      service.calculate('buyer-1', { deliveryMethod: 'INSTANT' }),
    ).resolves.toMatchObject({
      store,
      subtotal: 50000,
      deliveryMethod: 'INSTANT',
      deliveryFee: 15000,
      ppnRate: 0.12,
      ppn: 6000,
      finalTotal: 71000,
    });
  });

  it('uses next day and regular delivery fees', async () => {
    prisma.cart.findUnique.mockResolvedValue(cart);

    await expect(
      service.calculate('buyer-1', { deliveryMethod: 'NEXT_DAY' }),
    ).resolves.toMatchObject({
      deliveryFee: 8000,
      finalTotal: 64000,
    });
    await expect(
      service.calculate('buyer-1', { deliveryMethod: 'REGULAR' }),
    ).resolves.toMatchObject({
      deliveryFee: 5000,
      finalTotal: 61000,
    });
  });

  it('rejects an empty cart', async () => {
    prisma.cart.findUnique.mockResolvedValue({ ...cart, items: [] });

    await expect(
      service.calculate('buyer-1', { deliveryMethod: 'REGULAR' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a missing cart', async () => {
    prisma.cart.findUnique.mockResolvedValue(null);

    await expect(
      service.calculate('buyer-1', { deliveryMethod: 'REGULAR' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('creates an order, deducts wallet, decrements stock, and clears cart', async () => {
    prisma.cart.findUnique.mockResolvedValue(cart);
    prisma.address.findFirst.mockResolvedValue(address);
    prisma.wallet.findUnique.mockResolvedValue({ userId: 'buyer-1', balance: 100000 });
    prisma.product.updateMany.mockResolvedValue({ count: 1 });
    prisma.wallet.update.mockResolvedValue({ userId: 'buyer-1', balance: 29000 });
    prisma.order.create.mockResolvedValue({
      id: 'order-1',
      status: 'SEDANG_DIKEMAS',
      finalTotal: 71000,
      items: [],
    });

    await expect(
      service.pay('buyer-1', {
        deliveryMethod: 'INSTANT',
        addressId: address.id,
      }),
    ).resolves.toEqual({
      order: {
        id: 'order-1',
        status: 'SEDANG_DIKEMAS',
        finalTotal: 71000,
        items: [],
      },
      remainingWalletBalance: 29000,
    });
    expect(prisma.wallet.update).toHaveBeenCalledWith({
      where: { userId: 'buyer-1' },
      data: {
        balance: {
          decrement: 71000,
        },
      },
    });
    expect(prisma.product.updateMany).toHaveBeenCalledWith({
      where: {
        id: product.id,
        stock: {
          gte: 2,
        },
      },
      data: {
        stock: {
          decrement: 2,
        },
      },
    });
    expect(prisma.order.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        buyerId: 'buyer-1',
        storeId: store.id,
        addressId: address.id,
        status: 'SEDANG_DIKEMAS',
        finalTotal: 71000,
        shippingRecipientName: address.recipientName,
      }),
      include: expect.any(Object),
    });
    expect(prisma.cartItem.deleteMany).toHaveBeenCalledWith({
      where: { cartId: cart.id },
    });
    expect(prisma.cart.update).toHaveBeenCalledWith({
      where: { id: cart.id },
      data: { storeId: null },
    });
  });

  it('rejects payment when wallet balance is insufficient', async () => {
    prisma.cart.findUnique.mockResolvedValue(cart);
    prisma.address.findFirst.mockResolvedValue(address);
    prisma.wallet.findUnique.mockResolvedValue({ userId: 'buyer-1', balance: 1000 });

    await expect(
      service.pay('buyer-1', {
        deliveryMethod: 'INSTANT',
        addressId: address.id,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.order.create).not.toHaveBeenCalled();
  });

  it('rejects payment when address is not owned by buyer', async () => {
    prisma.cart.findUnique.mockResolvedValue(cart);
    prisma.address.findFirst.mockResolvedValue(null);
    prisma.wallet.findUnique.mockResolvedValue({ userId: 'buyer-1', balance: 100000 });

    await expect(
      service.pay('buyer-1', {
        deliveryMethod: 'REGULAR',
        addressId: address.id,
      }),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.order.create).not.toHaveBeenCalled();
  });

  it('rejects payment when stock changed below cart quantity', async () => {
    prisma.cart.findUnique.mockResolvedValue({
      ...cart,
      items: [
        {
          ...cart.items[0],
          product: {
            ...product,
            stock: 1,
          },
        },
      ],
    });
    prisma.address.findFirst.mockResolvedValue(address);
    prisma.wallet.findUnique.mockResolvedValue({ userId: 'buyer-1', balance: 100000 });

    await expect(
      service.pay('buyer-1', {
        deliveryMethod: 'REGULAR',
        addressId: address.id,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.order.create).not.toHaveBeenCalled();
  });

  // ─── New discount code tests ──────────────────────────────────────────────────

  // subtotal = 50000, PROMO 10% → discount=5000, ppn=6000, delivery(INSTANT)=15000
  // finalTotal = 50000 - 5000 + 15000 + 6000 = 66000
  it('calculate: applies PROMO code discount to finalTotal', async () => {
    prisma.cart.findUnique.mockResolvedValue(cart);
    prisma.discountCode.findFirst.mockResolvedValue(promoCode);

    await expect(
      service.calculate('buyer-1', { deliveryMethod: 'INSTANT', discountCode: 'SAVE10' }),
    ).resolves.toMatchObject({
      subtotal: 50000,
      discount: 5000,
      ppn: 6000,
      deliveryFee: 15000,
      finalTotal: 66000,
      discountCode: { code: 'SAVE10', discountPct: 0.1 },
    });
  });

  // subtotal = 50000, VOUCHER 5% → discount=2500, ppn=6000, delivery(REGULAR)=5000
  // finalTotal = 50000 - 2500 + 5000 + 6000 = 58500
  it('calculate: applies VOUCHER code discount when usage is not exhausted', async () => {
    prisma.cart.findUnique.mockResolvedValue(cart);
    prisma.discountCode.findFirst.mockResolvedValue(voucherCode);

    await expect(
      service.calculate('buyer-1', { deliveryMethod: 'REGULAR', discountCode: 'VOUCHER5' }),
    ).resolves.toMatchObject({
      discount: 2500,
      finalTotal: 58500,
    });
  });

  it('calculate: rejects an exhausted VOUCHER code', async () => {
    prisma.cart.findUnique.mockResolvedValue(cart);
    prisma.discountCode.findFirst.mockResolvedValue({
      ...voucherCode,
      usageCount: 100, // equals usageLimit
    });

    await expect(
      service.calculate('buyer-1', { deliveryMethod: 'REGULAR', discountCode: 'VOUCHER5' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('calculate: rejects an expired code', async () => {
    prisma.cart.findUnique.mockResolvedValue(cart);
    prisma.discountCode.findFirst.mockResolvedValue({
      ...promoCode,
      expiresAt: new Date('2020-01-01T00:00:00.000Z'), // past date
    });

    await expect(
      service.calculate('buyer-1', { deliveryMethod: 'INSTANT', discountCode: 'SAVE10' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('calculate: rejects an inactive code', async () => {
    prisma.cart.findUnique.mockResolvedValue(cart);
    prisma.discountCode.findFirst.mockResolvedValue({
      ...promoCode,
      isActive: false,
    });

    await expect(
      service.calculate('buyer-1', { deliveryMethod: 'INSTANT', discountCode: 'SAVE10' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('calculate: rejects an unknown discount code', async () => {
    prisma.cart.findUnique.mockResolvedValue(cart);
    prisma.discountCode.findFirst.mockResolvedValue(null);

    await expect(
      service.calculate('buyer-1', { deliveryMethod: 'INSTANT', discountCode: 'INVALID' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('pay: with valid PROMO code increments usageCount, stores discountCodeId, deducts discounted total', async () => {
    // finalTotal with SAVE10 (10%): 50000–5000+15000+6000 = 66000
    prisma.cart.findUnique.mockResolvedValue(cart);
    prisma.address.findFirst.mockResolvedValue(address);
    prisma.discountCode.findFirst.mockResolvedValue(promoCode);
    prisma.wallet.findUnique.mockResolvedValue({ userId: 'buyer-1', balance: 100000 });
    prisma.product.updateMany.mockResolvedValue({ count: 1 });
    prisma.discountCode.update.mockResolvedValue({ ...promoCode, usageCount: 1 });
    prisma.wallet.update.mockResolvedValue({ userId: 'buyer-1', balance: 34000 });
    prisma.order.create.mockResolvedValue({
      id: 'order-2',
      status: 'SEDANG_DIKEMAS',
      finalTotal: 66000,
      items: [],
    });

    const result = await service.pay('buyer-1', {
      deliveryMethod: 'INSTANT',
      addressId: address.id,
      discountCode: 'SAVE10',
    });

    expect(result.order.finalTotal).toBe(66000);

    expect(prisma.discountCode.update).toHaveBeenCalledWith({
      where: { id: promoCode.id },
      data: { usageCount: { increment: 1 } },
    });

    expect(prisma.order.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        finalTotal: 66000,
        discount: 5000,
        discountCodeId: promoCode.id,
      }),
      include: expect.any(Object),
    });

    expect(prisma.wallet.update).toHaveBeenCalledWith({
      where: { userId: 'buyer-1' },
      data: { balance: { decrement: 66000 } },
    });
  });

  it('pay: without discount code does not call discountCode.update and behaves as before', async () => {
    prisma.cart.findUnique.mockResolvedValue(cart);
    prisma.address.findFirst.mockResolvedValue(address);
    prisma.wallet.findUnique.mockResolvedValue({ userId: 'buyer-1', balance: 100000 });
    prisma.product.updateMany.mockResolvedValue({ count: 1 });
    prisma.wallet.update.mockResolvedValue({ userId: 'buyer-1', balance: 29000 });
    prisma.order.create.mockResolvedValue({
      id: 'order-3',
      status: 'SEDANG_DIKEMAS',
      finalTotal: 71000,
      items: [],
    });

    const result = await service.pay('buyer-1', {
      deliveryMethod: 'INSTANT',
      addressId: address.id,
    });

    expect(result.order.finalTotal).toBe(71000);
    expect(prisma.discountCode.update).not.toHaveBeenCalled();
    expect(prisma.order.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        finalTotal: 71000,
        discount: 0,
        discountCodeId: null,
      }),
      include: expect.any(Object),
    });
  });
});
