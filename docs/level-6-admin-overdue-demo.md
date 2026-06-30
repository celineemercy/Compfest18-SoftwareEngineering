# Level 6 Admin Overdue Demo Evidence

This branch completes Level 6 evidence on top of `feature/level-6-admin-overdue` at `89f82f2`. It does not add backend endpoints or rewrite earlier Level 3-5 history.

## Demo Accounts

Seed the demo data manually after the database is available:

```bash
npm --prefix apps/api run seed:demo
```

All demo accounts use password `Demo123!`.

| Role | Email |
| --- | --- |
| Buyer | `buyer.demo@seapedia.test` |
| Seller | `seller.demo@seapedia.test` |
| Driver | `driver.demo@seapedia.test` |
| Admin | `admin.demo@seapedia.test` |

The seed creates:

- Buyer wallet/cart/address data with enough balance to explain checkout and refund behavior.
- A seller, store, and products visible in the public catalog and seller dashboard.
- A driver account and a delivery job already attached to the seeded overdue candidate.
- One order in `SEDANG_DIKIRIM` with a due time one hour after the seeded demo clock, so the admin `Advance 1 day` action makes it overdue.

## Role Switching

1. Sign in with any demo account.
2. Select the visible role button after login.
3. Confirm the active-role badge changes in the header.
4. Repeat with buyer, seller, driver, and admin accounts.

The protected dashboard shown on the right side is role-aware:

- Buyer sees wallet, addresses, cart, checkout, and orders.
- Seller sees store/product controls and seller orders.
- Driver sees available jobs and assigned jobs.
- Admin sees monitoring, voucher/promo/admin user controls, and Level 6 overdue operations.

## Admin Monitoring

The admin dashboard documents and exercises these Level 6 endpoints through the UI:

- `GET /admin/monitoring`
- `POST /admin/time/advance`
- `POST /admin/overdue/process`

Monitoring displays the demo clock plus counts for users, stores, products, orders, vouchers, promos, delivery jobs, and overdue orders. The overdue order count is the key Level 6 signal before processing.

## Acceptance Flow

1. Sign in as `admin.demo@seapedia.test`.
2. Select `ADMIN`.
3. Confirm monitoring metrics load, including `Clock` and `Overdue orders`.
4. Click `Advance 1 day`.
5. Confirm the UI records the new clock from `POST /admin/time/advance`.
6. Click `Process overdue`.
7. Confirm the UI records the processed count and affected order ids from `POST /admin/overdue/process`.
8. Refresh monitoring and confirm the overdue count changes after processing.
9. Sign in as the buyer and select `BUYER`.
10. Confirm the order list shows the refunded/returned outcome with status history containing `Overdue delivery returned and refunded`.

The seeded order starts in delivery and becomes overdue after the clock advances. Processing overdue orders changes it to `DIKEMBALIKAN`, creates a refund wallet transaction, restores product stock, marks the delivery job as returned, and records an overdue processing log.

## Level 7 Boundary

Richer reporting evidence such as buyer spending reports, wallet transaction drill-downs, seller income reports, and driver earnings reports remains Level 7 follow-up evidence. Level 6 evidence here is intentionally focused on admin monitoring, time advancement, overdue processing, visible refund/return outcomes, and active-role dashboard continuity.
