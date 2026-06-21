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
});
