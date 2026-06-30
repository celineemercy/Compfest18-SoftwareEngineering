# SEAPEDIA Testing Guide

This guide describes the testing-ready implementation for the COMPFEST 18 SEAPEDIA challenge.

## Local Setup

```bash
npm install
npm run db:up
npm run prisma:migrate
npm run prisma:generate
npm run db:seed
npm run dev:api
npm run dev:web
```

The web app expects the API at `http://localhost:3000` unless `apps/web/.env` sets `VITE_API_URL`.

## Demo Accounts

All seeded accounts use password `password123`.

- Admin: `admin@seapedia.test`
- Seller: `seller@seapedia.test`
- Buyer: `buyer@seapedia.test`
- Driver: `driver@seapedia.test`
- Multi-role: `multi@seapedia.test`

After login, select an active role before using private features. Backend guards authorize against the selected `activeRole` in the JWT, not merely the roles owned by the user.

## Business Rules Implemented

- Guests can browse products/stores and read/create public application reviews.
- Public registration creates buyer accounts; admins can create users through a protected admin endpoint.
- A cart can contain products from one store only.
- Checkout calculates `subtotal - discount + PPN 12% + delivery fee`.
- One checkout discount code is accepted; the code resolves to either a voucher or a promo.
- Delivery defaults:
  - Regular: Rp10,000 fee, 3-day SLA, Rp7,000 driver earning
  - Next Day: Rp18,000 fee, 1-day SLA, Rp12,000 driver earning
  - Instant: Rp30,000 fee, same-day SLA, Rp20,000 driver earning
- Seller processing moves orders from `SEDANG_DIKEMAS` to `MENUNGGU_PENGIRIM`.
- Driver claim moves orders to `SEDANG_DIKIRIM`; completion moves them to `PESANAN_SELESAI`.
- Overdue processing is idempotent and refunds the buyer wallet, restores stock, marks delivery returned, records status history, and writes a processing log.

## Manual Acceptance Flow

1. Open the web app as a guest and confirm catalog/reviews are visible.
2. Submit a public review and confirm it appears in the review list.
3. Login as seller, select `SELLER`, create a store/product, and confirm it appears in the catalog after refresh.
4. Login as buyer, select `BUYER`, top up wallet, add an address, add a catalog product to cart, and checkout with `HEMAT10K` or `PROMO10`.
5. Login as seller, select `SELLER`, process the new order.
6. Login as driver, select `DRIVER`, take the available job, then complete it.
7. Login as admin, select `ADMIN`, inspect monitoring, create a voucher/promo, advance time, and process overdue orders.

## Suggested Automated Checks

- Active-role guard rejects owned-but-inactive roles.
- Public catalog and review endpoints work without authentication.
- Seller ownership prevents cross-store product mutation.
- Cart rejects products from a second store.
- Checkout rejects insufficient wallet balance, insufficient stock, invalid discounts, and expired discounts.
- Checkout transaction creates order, status history, wallet transaction, stock decrement, and cart clearing together.
- Driver job claiming prevents a second driver from claiming the same job.
- Overdue processing can run multiple times without double refunding or double restoring stock.
- Public review text containing HTML/script content renders as text in the React UI.

## Level 7 Verification Evidence

See `docs/level-7-verification-evidence.md` for the follow-up evidence branch notes, added automated coverage, command status, manual checklist status, and known limitations.
