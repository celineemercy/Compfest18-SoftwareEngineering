import '../src/config/env';
import { PrismaClient, Role, DiscountType } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function upsertUser(
  email: string,
  username: string,
  roles: Role[],
  password = 'password123',
) {
  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: { username, roles },
    create: {
      email,
      username,
      password: hashedPassword,
      roles,
      wallet: roles.includes(Role.BUYER) ? { create: { balance: 500000 } } : undefined,
      cart: roles.includes(Role.BUYER) ? { create: {} } : undefined,
    },
  });

  if (roles.includes(Role.BUYER)) {
    await prisma.wallet.upsert({
      where: { userId: user.id },
      update: { balance: 500000 },
      create: { userId: user.id, balance: 500000 },
    });
    await prisma.cart.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id },
    });
  }

  return user;
}

async function main() {
  const admin = await upsertUser('admin@seapedia.test', 'admin', [Role.ADMIN]);
  const seller = await upsertUser('seller@seapedia.test', 'seller', [Role.SELLER]);
  const buyer = await upsertUser('buyer@seapedia.test', 'buyer', [Role.BUYER]);
  await upsertUser('driver@seapedia.test', 'driver', [Role.DRIVER]);
  await upsertUser('multi@seapedia.test', 'multi_role', [
    Role.BUYER,
    Role.SELLER,
    Role.DRIVER,
  ]);

  const store = await prisma.store.upsert({
    where: { name: 'Lautan Segar' },
    update: {
      description: 'Seafood and coastal pantry supplies for SEAPEDIA demos.',
      sellerId: seller.id,
    },
    create: {
      name: 'Lautan Segar',
      description: 'Seafood and coastal pantry supplies for SEAPEDIA demos.',
      sellerId: seller.id,
    },
  });

  const sampleProducts = [
    {
      name: 'Frozen Tuna Pack',
      description: 'Vacuum-packed tuna for family meals.',
      price: 65000,
      stock: 25,
    },
    {
      name: 'Seaweed Snack Bundle',
      description: 'Crispy seaweed snacks in assorted flavors.',
      price: 32000,
      stock: 40,
    },
    {
      name: 'Coastal Spice Mix',
      description: 'Aromatic seasoning blend for grilled seafood.',
      price: 28000,
      stock: 30,
    },
  ];

  for (const product of sampleProducts) {
    const existing = await prisma.product.findFirst({
      where: { name: product.name, storeId: store.id },
    });

    if (existing) {
      await prisma.product.update({
        where: { id: existing.id },
        data: product,
      });
    } else {
      await prisma.product.create({
        data: { ...product, storeId: store.id },
      });
    }
  }

  await prisma.address.upsert({
    where: { id: 'demo-buyer-address' },
    update: {},
    create: {
      id: 'demo-buyer-address',
      userId: buyer.id,
      label: 'Rumah',
      recipient: 'Buyer Demo',
      phone: '+6281234567890',
      fullAddress: 'Jl. Demo SEAPEDIA No. 1',
      city: 'Jakarta',
      postalCode: '10110',
      isDefault: true,
    },
  });

  const reviewCount = await prisma.applicationReview.count();
  if (reviewCount === 0) {
    await prisma.applicationReview.createMany({
      data: [
        {
          name: 'Alya',
          rating: 5,
          category: 'guest',
          comment: 'Catalog browsing is clear and quick.',
        },
        {
          name: 'Bima',
          rating: 4,
          category: 'buyer',
          comment: 'The checkout summary makes fees easy to inspect.',
        },
      ],
    });
  }

  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + 1);

  await prisma.voucher.upsert({
    where: { code: 'HEMAT10K' },
    update: { amount: 10000, remainingUsage: 25, expiresAt, isActive: true },
    create: {
      code: 'HEMAT10K',
      type: DiscountType.FIXED,
      amount: 10000,
      remainingUsage: 25,
      expiresAt,
      createdById: admin.id,
    },
  });

  await prisma.promo.upsert({
    where: { code: 'PROMO10' },
    update: { amount: 10, expiresAt, isActive: true },
    create: {
      code: 'PROMO10',
      type: DiscountType.PERCENTAGE,
      amount: 10,
      expiresAt,
      createdById: admin.id,
    },
  });

  await prisma.systemClock.upsert({
    where: { id: 'default' },
    update: {},
    create: { id: 'default' },
  });
}

main()
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
