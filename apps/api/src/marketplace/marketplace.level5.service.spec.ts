import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DeliveryJobStatus, DeliveryMethod, OrderStatus, Role } from '@prisma/client';
import { ActiveRoleGuard } from '../auth/guards/active-role.guard';
import { DELIVERY_RULES } from '../common/marketplace.constants';
import { MarketplaceService } from './marketplace.service';

describe('MarketplaceService Level 5 driver delivery', () => {
  const now = new Date('2026-06-30T10:00:00.000Z');
  const prisma = {
    $transaction: jest.fn(),
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
      findMany: jest.fn(),
      updateMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
    driverEarning: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    systemClock: {
      upsert: jest.fn(),
    },
    voucher: {
      findUnique: jest.fn(),
    },
    promo: {
      findUnique: jest.fn(),
    },
    discountRedemption: {
      create: jest.fn(),
    },
    cartItem: {
      deleteMany: jest.fn(),
    },
  };
  let service: MarketplaceService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation((callback: (tx: typeof prisma) => Promise<unknown>) =>
      callback(prisma),
    );
    prisma.systemClock.upsert.mockResolvedValue({ id: 'default', currentAt: now });
    prisma.voucher.findUnique.mockResolvedValue(null);
    prisma.promo.findUnique.mockResolvedValue(null);
    service = new MarketplaceService(prisma as never);
  });

  it('checkout stores the correct delivery fee and seller processing opens a job with the correct earning', async () => {
    const product = {
      id: 'product-1',
      name: 'Sea Salt',
      price: 50000,
      stock: 10,
    };
    prisma.cart.findUnique.mockResolvedValue({
      id: 'cart-1',
      storeId: 'store-1',
      items: [{ productId: product.id, quantity: 2, product }],
    });
    prisma.address.findFirst.mockResolvedValue({ id: 'address-1', userId: 'buyer-1' });
    prisma.wallet.upsert.mockResolvedValue({ userId: 'buyer-1', balance: 200000 });
    prisma.product.updateMany.mockResolvedValue({ count: 1 });
    prisma.order.create.mockResolvedValue({ id: 'order-1', deliveryFee: DELIVERY_RULES.REGULAR.fee });

    await service.checkout('buyer-1', {
      addressId: 'address-1',
      deliveryMethod: DeliveryMethod.REGULAR,
    });

    expect(prisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          deliveryFee: DELIVERY_RULES.REGULAR.fee,
          finalTotal: 122000,
        }),
      }),
    );

    prisma.order.findFirst.mockResolvedValue({
      id: 'order-1',
      deliveryMethod: DeliveryMethod.REGULAR,
    });
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      deliveryJob: {
        id: 'job-1',
        earning: DELIVERY_RULES.REGULAR.earning,
        status: DeliveryJobStatus.AVAILABLE,
      },
    });

    await service.processSellerOrder('seller-1', 'order-1');

    expect(prisma.deliveryJob.upsert).toHaveBeenCalledWith({
      where: { orderId: 'order-1' },
      update: { status: DeliveryJobStatus.AVAILABLE },
      create: {
        orderId: 'order-1',
        earning: DELIVERY_RULES.REGULAR.earning,
      },
    });
  });

  it('driver lists available delivery jobs', async () => {
    prisma.deliveryJob.findMany.mockResolvedValue([{ id: 'job-1' }]);

    await expect(service.listAvailableJobs()).resolves.toEqual([{ id: 'job-1' }]);

    expect(prisma.deliveryJob.findMany).toHaveBeenCalledWith({
      where: {
        status: DeliveryJobStatus.AVAILABLE,
        order: { status: OrderStatus.MENUNGGU_PENGIRIM },
      },
      include: { order: { include: { store: true, address: true } } },
      orderBy: { createdAt: 'asc' },
    });
  });

  it('driver takes only available jobs', async () => {
    prisma.deliveryJob.updateMany.mockResolvedValue({ count: 1 });
    prisma.deliveryJob.findUniqueOrThrow.mockResolvedValue({ id: 'job-1', orderId: 'order-1' });
    prisma.deliveryJob.findUnique.mockResolvedValue({
      id: 'job-1',
      driverId: 'driver-1',
      status: DeliveryJobStatus.TAKEN,
    });

    await expect(service.takeJob('driver-1', 'job-1')).resolves.toEqual(
      expect.objectContaining({
        id: 'job-1',
        driverId: 'driver-1',
        status: DeliveryJobStatus.TAKEN,
      }),
    );

    expect(prisma.deliveryJob.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'job-1',
        status: DeliveryJobStatus.AVAILABLE,
        driverId: null,
        order: { status: OrderStatus.MENUNGGU_PENGIRIM },
      },
      data: {
        status: DeliveryJobStatus.TAKEN,
        driverId: 'driver-1',
        takenAt: now,
      },
    });
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: { status: OrderStatus.SEDANG_DIKIRIM },
    });
  });

  it('job cannot be taken twice', async () => {
    prisma.deliveryJob.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.takeJob('driver-2', 'job-1')).rejects.toThrow(ConflictException);
  });

  it('driver sees only their assigned jobs', async () => {
    prisma.deliveryJob.findMany.mockResolvedValue([{ id: 'job-1', driverId: 'driver-1' }]);

    await service.listDriverJobs('driver-1');

    expect(prisma.deliveryJob.findMany).toHaveBeenCalledWith({
      where: { driverId: 'driver-1' },
      include: { order: { include: expect.any(Object) } },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('driver completes an assigned job and records completed delivery state', async () => {
    prisma.deliveryJob.findFirst.mockResolvedValue({
      id: 'job-1',
      orderId: 'order-1',
      earning: DELIVERY_RULES.INSTANT.earning,
    });
    prisma.deliveryJob.findUnique.mockResolvedValue({
      id: 'job-1',
      status: DeliveryJobStatus.COMPLETED,
      completedAt: now,
    });

    await expect(service.completeJob('driver-1', 'job-1')).resolves.toEqual(
      expect.objectContaining({
        id: 'job-1',
        status: DeliveryJobStatus.COMPLETED,
      }),
    );

    expect(prisma.deliveryJob.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'job-1',
        driverId: 'driver-1',
        status: DeliveryJobStatus.TAKEN,
        order: { status: OrderStatus.SEDANG_DIKIRIM },
      },
    });
    expect(prisma.deliveryJob.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: { status: DeliveryJobStatus.COMPLETED, completedAt: now },
    });
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: {
        status: OrderStatus.PESANAN_SELESAI,
        completedAt: now,
      },
    });
    expect(prisma.driverEarning.upsert).toHaveBeenCalledWith({
      where: { jobId: 'job-1' },
      update: {},
      create: {
        jobId: 'job-1',
        driverId: 'driver-1',
        amount: DELIVERY_RULES.INSTANT.earning,
      },
    });
  });

  it('driver cannot complete a job assigned to another driver', async () => {
    prisma.deliveryJob.findFirst.mockResolvedValue(null);

    await expect(service.completeJob('driver-2', 'job-1')).rejects.toThrow(NotFoundException);
  });

  it('driver earnings total reflects completed jobs only', async () => {
    prisma.driverEarning.findMany.mockResolvedValue([
      { id: 'earning-1', amount: 20000 },
      { id: 'earning-2', amount: 7000 },
    ]);

    await expect(service.getDriverEarnings('driver-1')).resolves.toEqual({
      total: 27000,
      earnings: [
        { id: 'earning-1', amount: 20000 },
        { id: 'earning-2', amount: 7000 },
      ],
    });

    expect(prisma.driverEarning.findMany).toHaveBeenCalledWith({
      where: { driverId: 'driver-1' },
      orderBy: { createdAt: 'desc' },
    });
  });
});

describe('Level 5 driver endpoint active-role guard', () => {
  it('blocks non-driver roles from driver endpoints', () => {
    const Guard = ActiveRoleGuard(Role.DRIVER);
    const guard = new Guard();
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: {
            id: 'buyer-1',
            activeRole: Role.BUYER,
          },
        }),
      }),
    };

    expect(() => guard.canActivate(context as never)).toThrow(ForbiddenException);
  });

  it('allows driver role access to driver endpoints', () => {
    const Guard = ActiveRoleGuard(Role.DRIVER);
    const guard = new Guard();
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: {
            id: 'driver-1',
            activeRole: Role.DRIVER,
          },
        }),
      }),
    };

    expect(guard.canActivate(context as never)).toBe(true);
  });
});
