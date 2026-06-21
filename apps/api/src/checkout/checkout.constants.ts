export const DELIVERY_FEES = {
  INSTANT: 15000,
  NEXT_DAY: 8000,
  REGULAR: 5000,
} as const;

export const DELIVERY_METHODS = Object.keys(DELIVERY_FEES);

export type DeliveryMethod = keyof typeof DELIVERY_FEES;

export const PPN_RATE = 0.12;
