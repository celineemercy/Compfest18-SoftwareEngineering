import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { OrdersService } from './orders.service';

describe('OrdersService', () => {
  const store = { id: 'store-1', name: 'Store A', sellerId: 'seller-1' };
  const order = {
    id: 'order-1',
    buyerId: 'buyer-1',
    storeId: store.id,
    store: { sellerId: store.sellerId },
    status: 'SEDANG_DIKEMAS',
    items: [],
    createdAt: new Date('2026-06-23T00:00:00.000Z'),
    updatedAt: new Date('2026-06-23T00:00:00.000Z'),
  };

  const prisma = {
    store: {
      findFirst: jest.fn(),
    },
    order: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  let service: OrdersService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new OrdersService(prisma as never);
  });

  // ─── findByStore ─────────────────────────────────────────────────────────────

  it('findByStore: returns orders when store belongs to seller', async () => {
    prisma.store.findFirst.mockResolvedValue(store);
    prisma.order.findMany.mockResolvedValue([order]);

    const result = await service.findByStore('seller-1', store.id);

    expect(result).toEqual([order]);
    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { storeId: store.id } }),
    );
  });

  it('findByStore: throws ForbiddenException when store does not belong to seller', async () => {
    prisma.store.findFirst.mockResolvedValue(null);

    await expect(service.findByStore('other-seller', store.id)).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.order.findMany).not.toHaveBeenCalled();
  });

  // ─── processOrder ─────────────────────────────────────────────────────────────

  it('processOrder: updates status to MENUNGGU_PENGIRIM when order is SEDANG_DIKEMAS', async () => {
    prisma.order.findFirst.mockResolvedValue(order);
    prisma.order.update.mockResolvedValue({ ...order, status: 'MENUNGGU_PENGIRIM' });

    const result = await service.processOrder('seller-1', order.id);

    expect(result.status).toBe('MENUNGGU_PENGIRIM');
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: order.id },
      data: { status: 'MENUNGGU_PENGIRIM' },
      include: { items: true },
    });
  });

  it('processOrder: throws BadRequestException when order is already MENUNGGU_PENGIRIM', async () => {
    prisma.order.findFirst.mockResolvedValue({
      ...order,
      status: 'MENUNGGU_PENGIRIM',
    });

    await expect(service.processOrder('seller-1', order.id)).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.order.update).not.toHaveBeenCalled();
  });

  it('processOrder: throws NotFoundException when order belongs to a different seller', async () => {
    prisma.order.findFirst.mockResolvedValue({
      ...order,
      store: { sellerId: 'another-seller' },
    });

    await expect(service.processOrder('seller-1', order.id)).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.order.update).not.toHaveBeenCalled();
  });
});
