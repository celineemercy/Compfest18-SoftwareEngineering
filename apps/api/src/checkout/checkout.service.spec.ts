import { BadRequestException } from '@nestjs/common';
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
  const prisma = {
    cart: {
      findUnique: jest.fn(),
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
});
