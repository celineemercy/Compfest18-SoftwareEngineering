import { CatalogService } from './catalog.service';

describe('CatalogService', () => {
  const prisma = {
    product: {
      findMany: jest.fn(),
    },
  };
  let service: CatalogService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CatalogService(prisma as never);
  });

  it('returns newest products with store summaries', async () => {
    prisma.product.findMany.mockResolvedValue([
      {
        id: 'product-1',
        name: 'Seaweed Chips',
        store: { id: 'store-1', name: 'Ocean Snacks' },
      },
    ]);

    await expect(service.findProducts()).resolves.toEqual([
      {
        id: 'product-1',
        name: 'Seaweed Chips',
        store: { id: 'store-1', name: 'Ocean Snacks' },
      },
    ]);

    expect(prisma.product.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
      include: {
        store: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  });
});
