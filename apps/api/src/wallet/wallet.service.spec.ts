import { WalletService } from './wallet.service';

describe('WalletService', () => {
  const prisma = {
    wallet: {
      update: jest.fn(),
      upsert: jest.fn(),
    },
  };
  let service: WalletService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WalletService(prisma as never);
  });

  it('creates a missing wallet with zero balance', async () => {
    prisma.wallet.upsert.mockResolvedValue({ userId: 'buyer-1', balance: 0 });

    await expect(service.findMine('buyer-1')).resolves.toEqual({
      userId: 'buyer-1',
      balance: 0,
    });
    expect(prisma.wallet.upsert).toHaveBeenCalledWith({
      where: { userId: 'buyer-1' },
      update: {},
      create: { userId: 'buyer-1', balance: 0 },
    });
  });

  it('increments wallet balance on top up', async () => {
    prisma.wallet.upsert.mockResolvedValue({ userId: 'buyer-1', balance: 0 });
    prisma.wallet.update.mockResolvedValue({ userId: 'buyer-1', balance: 50000 });

    await expect(service.topUp('buyer-1', { amount: 50000 })).resolves.toEqual({
      userId: 'buyer-1',
      balance: 50000,
    });
    expect(prisma.wallet.update).toHaveBeenCalledWith({
      where: { userId: 'buyer-1' },
      data: {
        balance: {
          increment: 50000,
        },
      },
    });
  });
});
