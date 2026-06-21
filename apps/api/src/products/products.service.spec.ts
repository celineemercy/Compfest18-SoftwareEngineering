import { NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service';

describe('ProductsService', () => {
  const prisma = {
    store: {
      findFirst: jest.fn(),
    },
    product: {
      create: jest.fn(),
      delete: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };
  let service: ProductsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProductsService(prisma as never);
  });

  it('creates products only inside seller-owned stores', async () => {
    prisma.store.findFirst.mockResolvedValue({ id: 'store-1' });
    prisma.product.create.mockResolvedValue({ id: 'product-1' });

    await expect(
      service.create('seller-1', 'store-1', {
        name: 'Seaweed Chips',
        price: 25000,
        stock: 20,
      }),
    ).resolves.toEqual({ id: 'product-1' });

    expect(prisma.store.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'store-1',
        sellerId: 'seller-1',
      },
      select: { id: true },
    });
    expect(prisma.product.create).toHaveBeenCalledWith({
      data: {
        name: 'Seaweed Chips',
        price: 25000,
        stock: 20,
        storeId: 'store-1',
      },
    });
  });

  it('rejects product creation for stores not owned by the seller', async () => {
    prisma.store.findFirst.mockResolvedValue(null);

    await expect(
      service.create('seller-1', 'store-2', {
        name: 'Seaweed Chips',
        price: 25000,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('updates only seller-owned products', async () => {
    prisma.product.findFirst.mockResolvedValue({ id: 'product-1' });
    prisma.product.update.mockResolvedValue({ id: 'product-1', stock: 8 });

    await expect(
      service.update('seller-1', 'product-1', { stock: 8 }),
    ).resolves.toEqual({ id: 'product-1', stock: 8 });

    expect(prisma.product.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'product-1',
        store: { sellerId: 'seller-1' },
      },
    });
  });
});
