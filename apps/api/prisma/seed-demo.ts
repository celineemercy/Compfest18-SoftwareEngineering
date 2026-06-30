import { PrismaClient, DeliveryJobStatus, DeliveryMethod, OrderStatus, Role, WalletTransactionType } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import { config } from 'dotenv';
import { Pool } from 'pg';

config({ path: '../../.env', override: false });
config({ path: '.env', override: false });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
const password = 'Demo123!';

async function main() {
  const hashedPassword = await bcrypt.hash(password, 10);
  const clock = await prisma.systemClock.upsert({
    where: { id: 'default' },
    update: {},
    create: { id: 'default', currentAt: new Date('2026-06-30T09:00:00.000Z') },
  });

  const [buyer, seller, driver, admin] = await Promise.all([
    upsertUser('buyer.demo@seapedia.test', 'buyer_demo', [Role.BUYER], hashedPassword),
    upsertUser('seller.demo@seapedia.test', 'seller_demo', [Role.SELLER], hashedPassword),
    upsertUser('driver.demo@seapedia.test', 'driver_demo', [Role.DRIVER], hashedPassword),
    upsertUser('admin.demo@seapedia.test', 'admin_demo', [Role.ADMIN], hashedPassword),
  ]);

  const store = await prisma.store.upsert({
    where: { name: 'Level 6 Demo Store' },
    update: {
      description: 'Seeded store for admin monitoring and overdue processing evidence.',
      sellerId: seller.id,
    },
    create: {
      name: 'Level 6 Demo Store',
      description: 'Seeded store for admin monitoring and overdue processing evidence.',
      sellerId: seller.id,
    },
  });

  const overdueProduct = await upsertProduct(store.id, {
    name: 'Overdue Demo Package',
    description: 'Use this product to explain the order that can be refunded after demo time advances.',
    price: 125000,
    stock: 8,
  });

  await upsertProduct(store.id, {
    name: 'Role Switch Sample Item',
    description: 'Extra catalog item for buyer, seller, and admin dashboard visibility.',
    price: 45000,
    stock: 12,
  });

  const address = await prisma.address.upsert({
    where: { id: 'level-6-demo-address' },
    update: {
      userId: buyer.id,
      label: 'Level 6 Demo Address',
      recipient: 'Buyer Demo',
      phone: '+6281234567890',
      fullAddress: 'Jl. Demo Level 6 No. 18',
      city: 'Jakarta',
      postalCode: '10270',
      isDefault: true,
    },
    create: {
      id: 'level-6-demo-address',
      userId: buyer.id,
      label: 'Level 6 Demo Address',
      recipient: 'Buyer Demo',
      phone: '+6281234567890',
      fullAddress: 'Jl. Demo Level 6 No. 18',
      city: 'Jakarta',
      postalCode: '10270',
      isDefault: true,
    },
  });

  await prisma.wallet.upsert({
    where: { userId: buyer.id },
    update: { balance: 350000 },
    create: { userId: buyer.id, balance: 350000 },
  });

  await prisma.cart.upsert({
    where: { userId: buyer.id },
    update: {},
    create: { userId: buyer.id },
  });

  const existingDemoOrder = await prisma.order.findFirst({
    where: {
      buyerId: buyer.id,
      storeId: store.id,
      status: { not: OrderStatus.DIKEMBALIKAN },
      histories: { some: { note: 'Level 6 demo checkout path' } },
    },
  });

  if (!existingDemoOrder) {
    const dueAt = new Date(clock.currentAt);
    dueAt.setHours(dueAt.getHours() + 1);
    const subtotal = overdueProduct.price;
    const ppnAmount = Math.round(subtotal * 0.12);
    const deliveryFee = 10000;
    const finalTotal = subtotal + ppnAmount + deliveryFee;

    const order = await prisma.order.create({
      data: {
        buyer: { connect: { id: buyer.id } },
        store: { connect: { id: store.id } },
        address: { connect: { id: address.id } },
        status: OrderStatus.SEDANG_DIKIRIM,
        deliveryMethod: DeliveryMethod.REGULAR,
        subtotal,
        ppnAmount,
        deliveryFee,
        finalTotal,
        dueAt,
        items: {
          create: {
            productId: overdueProduct.id,
            productName: overdueProduct.name,
            unitPrice: overdueProduct.price,
            quantity: 1,
            total: overdueProduct.price,
          },
        },
        histories: {
          create: [
            { status: OrderStatus.SEDANG_DIKEMAS, note: 'Level 6 demo checkout path' },
            { status: OrderStatus.MENUNGGU_PENGIRIM, note: 'Seeded seller processing evidence' },
            { status: OrderStatus.SEDANG_DIKIRIM, note: 'Seeded driver delivery evidence' },
          ],
        },
        deliveryJob: {
          create: {
            driver: { connect: { id: driver.id } },
            status: DeliveryJobStatus.TAKEN,
            earning: 7000,
            takenAt: clock.currentAt,
          },
        },
      },
    });

    await prisma.walletTransaction.create({
      data: {
        user: { connect: { id: buyer.id } },
        order: { connect: { id: order.id } },
        type: WalletTransactionType.PAYMENT,
        amount: -finalTotal,
        note: 'Seeded Level 6 checkout payment',
      },
    });

    console.log(`Created Level 6 overdue demo order ${order.id}`);
  } else {
    console.log(`Level 6 overdue demo order already exists ${existingDemoOrder.id}`);
  }

  console.log('Demo accounts seeded with password Demo123!');
  console.table([
    { role: 'BUYER', email: buyer.email },
    { role: 'SELLER', email: seller.email },
    { role: 'DRIVER', email: driver.email },
    { role: 'ADMIN', email: admin.email },
  ]);
}

async function upsertUser(email: string, username: string, roles: Role[], hashedPassword: string) {
  return prisma.user.upsert({
    where: { email },
    update: {
      username,
      password: hashedPassword,
      roles,
    },
    create: {
      email,
      username,
      password: hashedPassword,
      roles,
      wallet: roles.includes(Role.BUYER) ? { create: {} } : undefined,
      cart: roles.includes(Role.BUYER) ? { create: {} } : undefined,
    },
  });
}

async function upsertProduct(
  storeId: string,
  data: { name: string; description: string; price: number; stock: number },
) {
  const product = await prisma.product.findFirst({
    where: { storeId, name: data.name },
  });

  if (product) {
    return prisma.product.update({
      where: { id: product.id },
      data,
    });
  }

  return prisma.product.create({
    data: {
      ...data,
      storeId,
    },
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
