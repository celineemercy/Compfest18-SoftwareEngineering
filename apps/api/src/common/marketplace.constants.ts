import { DeliveryMethod } from '@prisma/client';

export const PPN_RATE = 0.12;

export const DELIVERY_RULES: Record<
  DeliveryMethod,
  { fee: number; earning: number; slaDays: number }
> = {
  INSTANT: { fee: 30000, earning: 20000, slaDays: 0 },
  NEXT_DAY: { fee: 18000, earning: 12000, slaDays: 1 },
  REGULAR: { fee: 10000, earning: 7000, slaDays: 3 },
};

export function addSlaDays(date: Date, method: DeliveryMethod) {
  const dueAt = new Date(date);
  const days = DELIVERY_RULES[method].slaDays;

  if (days === 0) {
    dueAt.setHours(23, 59, 59, 999);
    return dueAt;
  }

  dueAt.setDate(dueAt.getDate() + days);
  return dueAt;
}

export function calculatePpn(amountAfterDiscount: number) {
  return Math.round(amountAfterDiscount * PPN_RATE);
}
