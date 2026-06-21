import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { StoresService } from './stores.service';

describe('StoresService', () => {
  const prisma = {
    store: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  };
  let service: StoresService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new StoresService(prisma as never);
  });

  it('creates a store for the seller', async () => {
    prisma.store.create.mockResolvedValue({ id: 'store-1' });

    await expect(
      service.create('seller-1', {
        name: 'Ocean Snacks',
        description: 'Fresh goods',
      }),
    ).resolves.toEqual({ id: 'store-1' });

    expect(prisma.store.create).toHaveBeenCalledWith({
      data: {
        name: 'Ocean Snacks',
        description: 'Fresh goods',
        sellerId: 'seller-1',
      },
    });
  });

  it('throws conflict for duplicate store names', async () => {
    prisma.store.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(
      service.create('seller-1', { name: 'Ocean Snacks' }),
    ).rejects.toThrow(ConflictException);
  });
});
