import { BadRequestException, ConflictException } from '@nestjs/common';
import { CartService } from './cart.service';

describe('CartService', () => {
  const cart = {
    id: 'cart-1',
    userId: 'buyer-1',
    storeId: null,
    store: null,
    items: [],
    createdAt: new Date('2026-06-21T00:00:00.000Z'),
    updatedAt: new Date('2026-06-21T00:00:00.000Z'),
  };
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
  const prisma = {
    $transaction: jest.fn(async (callback) => callback(prisma)),
    cart: {
      findUnique: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
    cartItem: {
      count: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    product: {
      findUnique: jest.fn(),
    },
  };
  let service: CartService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CartService(prisma as never);
  });

  it('creates an empty cart for the buyer', async () => {
    prisma.cart.upsert.mockResolvedValue(cart);

    await expect(service.findMine('buyer-1')).resolves.toMatchObject({
      userId: 'buyer-1',
      storeId: null,
      items: [],
      totalItems: 0,
      subtotal: 0,
    });
    expect(prisma.cart.upsert).toHaveBeenCalledWith({
      where: { userId: 'buyer-1' },
      update: {},
      create: { userId: 'buyer-1' },
      include: expect.any(Object),
    });
  });

  it('adds the first item and locks the cart to the product store', async () => {
    prisma.product.findUnique.mockResolvedValue(product);
    prisma.cart.upsert.mockResolvedValue(cart);
    prisma.cart.findUnique.mockResolvedValue({
      ...cart,
      storeId: store.id,
      store,
      items: [
        {
          id: 'item-1',
          cartId: cart.id,
          productId: product.id,
          quantity: 2,
          snapshotPrice: product.price,
          product,
          createdAt: cart.createdAt,
          updatedAt: cart.updatedAt,
        },
      ],
    });

    await expect(
      service.addItem('buyer-1', { productId: product.id, quantity: 2 }),
    ).resolves.toMatchObject({
      storeId: store.id,
      totalItems: 2,
      subtotal: 50000,
    });
    expect(prisma.cart.update).toHaveBeenCalledWith({
      where: { id: cart.id },
      data: { storeId: store.id },
    });
    expect(prisma.cartItem.create).toHaveBeenCalledWith({
      data: {
        cartId: cart.id,
        productId: product.id,
        quantity: 2,
        snapshotPrice: product.price,
      },
    });
  });

  it('blocks products from another store', async () => {
    prisma.product.findUnique.mockResolvedValue({
      ...product,
      id: 'product-2',
      storeId: 'store-2',
      store: { id: 'store-2', name: 'Store B' },
    });
    prisma.cart.upsert.mockResolvedValue({
      ...cart,
      storeId: store.id,
      store,
      items: [],
    });

    await expect(
      service.addItem('buyer-1', { productId: 'product-2', quantity: 1 }),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects out-of-stock products', async () => {
    prisma.product.findUnique.mockResolvedValue({ ...product, stock: 0 });

    await expect(
      service.addItem('buyer-1', { productId: product.id, quantity: 1 }),
    ).rejects.toThrow(BadRequestException);
  });

  it('resets cart store when the last item is removed', async () => {
    prisma.cartItem.findFirst.mockResolvedValue({
      id: 'item-1',
      cartId: cart.id,
      product,
    });
    prisma.cartItem.count.mockResolvedValue(0);
    prisma.cart.findUnique.mockResolvedValue(cart);

    await expect(service.removeItem('buyer-1', 'item-1')).resolves.toMatchObject({
      storeId: null,
      items: [],
    });
    expect(prisma.cart.update).toHaveBeenCalledWith({
      where: { id: cart.id },
      data: { storeId: null },
    });
  });
});
