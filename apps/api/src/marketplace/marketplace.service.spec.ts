import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { DeliveryMethod, OrderStatus, WalletTransactionType } from '@prisma/client';
import { MarketplaceService } from './marketplace.service';

describe('MarketplaceService - buyer workflows', () => {
  const prisma = {
    wallet: {
      upsert: jest.fn(),
      update: jest.fn(),
    },
    walletTransaction: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    address: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    cart: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    cartItem: {
      upsert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
    },
    product: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    order: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    systemClock: {
      upsert: jest.fn(),
    },
    $transaction: jest.fn((callback: (tx: typeof prisma) => unknown) =>
      callback(prisma),
    ),
  };

  let service: MarketplaceService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation((callback) => callback(prisma));
    prisma.systemClock.upsert.mockResolvedValue({
      id: 'default',
      currentAt: new Date('2024-01-01T00:00:00.000Z'),
    });
    service = new MarketplaceService(prisma as never);
  });

  describe('wallet', () => {
    it('tops up the wallet and records a transaction', async () => {
      prisma.wallet.upsert.mockResolvedValue({ userId: 'buyer-1', balance: 50000 });

      const result = await service.topUpWallet('buyer-1', { amount: 50000 });

      expect(result).toEqual({ userId: 'buyer-1', balance: 50000 });
      expect(prisma.wallet.upsert).toHaveBeenCalledWith({
        where: { userId: 'buyer-1' },
        update: { balance: { increment: 50000 } },
        create: { userId: 'buyer-1', balance: 50000 },
      });
      expect(prisma.walletTransaction.create).toHaveBeenCalledWith({
        data: {
          userId: 'buyer-1',
          type: WalletTransactionType.TOP_UP,
          amount: 50000,
          note: 'Dummy top-up',
        },
      });
    });

    it('lists wallet transactions for the buyer, newest first', async () => {
      prisma.walletTransaction.findMany.mockResolvedValue([]);

      await service.listWalletTransactions('buyer-1');

      expect(prisma.walletTransaction.findMany).toHaveBeenCalledWith({
        where: { userId: 'buyer-1' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('addresses', () => {
    it('marks the first address created as default', async () => {
      prisma.address.findFirst.mockResolvedValue(null);
      prisma.address.create.mockResolvedValue({ id: 'address-1', isDefault: true });

      await service.createAddress('buyer-1', {
        label: 'Home',
        recipient: 'Alya',
        phone: '08123456789',
        fullAddress: 'Jl. Mangga No. 1',
        city: 'Jakarta',
        postalCode: '12345',
      });

      expect(prisma.address.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: 'buyer-1', isDefault: true }),
      });
    });

    it('does not default subsequent addresses', async () => {
      prisma.address.findFirst.mockResolvedValue({ id: 'address-1' });
      prisma.address.create.mockResolvedValue({ id: 'address-2', isDefault: false });

      await service.createAddress('buyer-1', {
        label: 'Office',
        recipient: 'Alya',
        phone: '08123456789',
        fullAddress: 'Jl. Pisang No. 2',
        city: 'Jakarta',
        postalCode: '12345',
      });

      expect(prisma.address.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ isDefault: false }),
      });
    });

    it('rejects updating an address owned by another buyer', async () => {
      prisma.address.findFirst.mockResolvedValue(null);

      await expect(
        service.updateAddress('buyer-1', 'address-99', {
          label: 'Home',
          recipient: 'Alya',
          phone: '08123456789',
          fullAddress: 'Jl. Mangga No. 1',
          city: 'Jakarta',
          postalCode: '12345',
        }),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.address.update).not.toHaveBeenCalled();
    });

    it('rejects deleting an address owned by another buyer', async () => {
      prisma.address.findFirst.mockResolvedValue(null);

      await expect(service.deleteAddress('buyer-1', 'address-99')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.address.delete).not.toHaveBeenCalled();
    });

    it('deletes an owned address', async () => {
      prisma.address.findFirst.mockResolvedValue({ id: 'address-1', userId: 'buyer-1' });

      const result = await service.deleteAddress('buyer-1', 'address-1');

      expect(prisma.address.delete).toHaveBeenCalledWith({ where: { id: 'address-1' } });
      expect(result).toEqual({ message: 'Address deleted successfully' });
    });
  });

  describe('cart', () => {
    it('restricts the cart to a single store', async () => {
      prisma.product.findUnique.mockResolvedValue({
        id: 'product-1',
        storeId: 'store-B',
        stock: 10,
      });
      prisma.cart.upsert.mockResolvedValue({ id: 'cart-1', storeId: 'store-A' });

      await expect(
        service.addCartItem('buyer-1', { productId: 'product-1', quantity: 1 }),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.cartItem.upsert).not.toHaveBeenCalled();
    });

    it('rejects adding more items than are in stock', async () => {
      prisma.product.findUnique.mockResolvedValue({
        id: 'product-1',
        storeId: 'store-A',
        stock: 2,
      });

      await expect(
        service.addCartItem('buyer-1', { productId: 'product-1', quantity: 5 }),
      ).rejects.toThrow(ConflictException);
    });

    it('adds an item to an empty cart', async () => {
      prisma.product.findUnique.mockResolvedValue({
        id: 'product-1',
        storeId: 'store-A',
        stock: 10,
      });
      prisma.cart.upsert.mockResolvedValue({ id: 'cart-1', storeId: null });
      prisma.cartItem.upsert.mockResolvedValue({ id: 'item-1', quantity: 2 });

      const result = await service.addCartItem('buyer-1', {
        productId: 'product-1',
        quantity: 2,
      });

      expect(prisma.cart.update).toHaveBeenCalledWith({
        where: { id: 'cart-1' },
        data: { storeId: 'store-A' },
      });
      expect(result).toEqual({ id: 'item-1', quantity: 2 });
    });

    it('rejects updating a cart item owned by another buyer', async () => {
      prisma.cartItem.findFirst.mockResolvedValue(null);

      await expect(
        service.updateCartItem('buyer-1', 'item-99', { quantity: 1 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects updating a cart item beyond available stock', async () => {
      prisma.cartItem.findFirst.mockResolvedValue({
        id: 'item-1',
        cartId: 'cart-1',
        product: { stock: 1 },
      });

      await expect(
        service.updateCartItem('buyer-1', 'item-1', { quantity: 5 }),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects deleting a cart item owned by another buyer', async () => {
      prisma.cartItem.findFirst.mockResolvedValue(null);

      await expect(service.deleteCartItem('buyer-1', 'item-99')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('clears the cart store once the last item is removed', async () => {
      prisma.cartItem.findFirst.mockResolvedValue({
        id: 'item-1',
        cartId: 'cart-1',
        product: { stock: 1 },
      });
      prisma.cartItem.count.mockResolvedValue(0);

      const result = await service.deleteCartItem('buyer-1', 'item-1');

      expect(prisma.cartItem.delete).toHaveBeenCalledWith({ where: { id: 'item-1' } });
      expect(prisma.cart.update).toHaveBeenCalledWith({
        where: { id: 'cart-1' },
        data: { storeId: null },
      });
      expect(result).toEqual({ message: 'Cart item deleted successfully' });
    });
  });

  describe('checkout', () => {
    function mockCart(overrides: Partial<{ storeId: string | null; items: unknown[] }> = {}) {
      prisma.cart.findUnique.mockResolvedValue({
        id: 'cart-1',
        userId: 'buyer-1',
        storeId: 'store-A',
        items: [
          {
            productId: 'product-1',
            quantity: 2,
            product: { id: 'product-1', name: 'Seaweed Chips', price: 25000 },
          },
        ],
        ...overrides,
      });
    }

    it('rejects checkout with an empty cart', async () => {
      mockCart({ items: [] });

      await expect(
        service.checkout('buyer-1', {
          addressId: 'address-1',
          deliveryMethod: DeliveryMethod.REGULAR,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects checkout when the cart has no selected store', async () => {
      mockCart({ storeId: null });

      await expect(
        service.checkout('buyer-1', {
          addressId: 'address-1',
          deliveryMethod: DeliveryMethod.REGULAR,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects checkout with an address the buyer does not own', async () => {
      mockCart();
      prisma.address.findFirst.mockResolvedValue(null);

      await expect(
        service.checkout('buyer-1', {
          addressId: 'address-99',
          deliveryMethod: DeliveryMethod.REGULAR,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects checkout when the wallet balance is insufficient', async () => {
      mockCart();
      prisma.address.findFirst.mockResolvedValue({ id: 'address-1', userId: 'buyer-1' });
      prisma.wallet.upsert.mockResolvedValue({ userId: 'buyer-1', balance: 1000 });

      await expect(
        service.checkout('buyer-1', {
          addressId: 'address-1',
          deliveryMethod: DeliveryMethod.REGULAR,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.order.create).not.toHaveBeenCalled();
    });

    it('checks out successfully: deducts the wallet and creates the order', async () => {
      mockCart();
      prisma.address.findFirst.mockResolvedValue({ id: 'address-1', userId: 'buyer-1' });
      prisma.wallet.upsert.mockResolvedValue({ userId: 'buyer-1', balance: 100000 });
      prisma.product.updateMany.mockResolvedValue({ count: 1 });
      prisma.order.create.mockResolvedValue({
        id: 'order-1',
        status: OrderStatus.SEDANG_DIKEMAS,
      });

      const result = await service.checkout('buyer-1', {
        addressId: 'address-1',
        deliveryMethod: DeliveryMethod.REGULAR,
      });

      // subtotal 50000, ppn 6000 (12%), delivery fee 10000 => total 66000
      expect(prisma.wallet.update).toHaveBeenCalledWith({
        where: { userId: 'buyer-1' },
        data: { balance: { decrement: 66000 } },
      });
      expect(prisma.walletTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'buyer-1',
          type: WalletTransactionType.PAYMENT,
          amount: -66000,
          orderId: 'order-1',
        }),
      });
      expect(prisma.cartItem.deleteMany).toHaveBeenCalledWith({
        where: { cartId: 'cart-1' },
      });
      expect(prisma.cart.update).toHaveBeenCalledWith({
        where: { id: 'cart-1' },
        data: { storeId: null },
      });
      expect(result).toEqual({ id: 'order-1', status: OrderStatus.SEDANG_DIKEMAS });
    });

    it('rejects checkout when a product goes out of stock mid-transaction', async () => {
      mockCart();
      prisma.address.findFirst.mockResolvedValue({ id: 'address-1', userId: 'buyer-1' });
      prisma.wallet.upsert.mockResolvedValue({ userId: 'buyer-1', balance: 100000 });
      prisma.product.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.checkout('buyer-1', {
          addressId: 'address-1',
          deliveryMethod: DeliveryMethod.REGULAR,
        }),
      ).rejects.toThrow(ConflictException);

      expect(prisma.order.create).not.toHaveBeenCalled();
    });
  });

  describe('buyer orders', () => {
    it('only lists orders that belong to the buyer', async () => {
      prisma.order.findMany.mockResolvedValue([]);

      await service.listBuyerOrders('buyer-1');

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { buyerId: 'buyer-1' } }),
      );
    });

    it('returns order detail scoped to the requesting buyer', async () => {
      prisma.order.findFirst.mockResolvedValue({ id: 'order-1', buyerId: 'buyer-1' });

      const result = await service.getBuyerOrder('buyer-1', 'order-1');

      expect(prisma.order.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'order-1', buyerId: 'buyer-1' } }),
      );
      expect(result).toEqual({ id: 'order-1', buyerId: 'buyer-1' });
    });

    it('rejects fetching an order that belongs to another buyer', async () => {
      prisma.order.findFirst.mockResolvedValue(null);

      await expect(service.getBuyerOrder('buyer-1', 'order-99')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
