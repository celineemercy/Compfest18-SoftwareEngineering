# Level 7 Verification Evidence

Date/time prepared: 2026-06-30, Asia/Jakarta.

Branch under verification: `feature/level-7-verification-evidence`.

Baseline references:

- Final Level 7 feature base: `feature/level-7-hardening-demo-docs`
- Repository reference branch: `main`

## Scope

This follow-up branch adds verification proof for the Level 7 demo, seed data, reporting surfaces, and hardening flows. It does not rewrite the Level 7 feature scope.

Implementation changes are limited to:

- focused Level 7 automated coverage;
- verification documentation;
- one defect hardening in `ActiveRoleGuard`, so a forged or stale token cannot use an active role that the current user no longer owns.

Existing reporting surfaces remain in scope and unchanged:

- buyer wallet transactions and spending report;
- seller income report;
- driver earnings report;
- admin monitoring and overdue controls.

## Automated Coverage Added

The new tests cover the highest-risk Level 7 claims:

- `apps/api/src/auth/guards/active-role.guard.spec.ts`
  - allows the selected active role when it is owned by the user;
  - rejects an owned role when it is not selected as the active role;
  - rejects an active role that is not owned by the current user.
- `apps/api/src/products/products.controller.spec.ts`
  - public product catalog list/detail endpoints have no auth guard metadata and delegate successfully.
- `apps/api/src/stores/stores.controller.spec.ts`
  - public store catalog list/detail endpoints have no auth guard metadata and delegate successfully.
- `apps/api/src/marketplace/marketplace.controller.spec.ts`
  - public review list/create endpoints have no auth guard metadata and delegate successfully.
- `apps/api/src/marketplace/marketplace.level7.service.spec.ts`
  - cart rejects products from a second store;
  - checkout rejects insufficient wallet balance;
  - checkout rejects insufficient stock;
  - checkout rejects unknown discounts;
  - checkout rejects expired vouchers;
  - successful checkout creates the order payload, status history payload, wallet payment transaction, stock decrement, voucher redemption, discount redemption, and cart clear operations;
  - driver job claiming rejects an already-claimed/unavailable job;
  - overdue processing can be called repeatedly without double-refunding the wallet or double-restoring stock.

## Commands

Not run in this branch update because the user explicitly instructed: "dont build, run, or test anything, just change the code."

Commands to run when allowed:

```bash
npm install
npm run build:api
npm run build:web
npm run test:api
npm run db:up
npm run prisma:migrate
npm run prisma:generate
npm run db:seed
npm run dev:api
npm run dev:web
```

## Manual Demo Checklist

Not run in this branch update because manual app startup was not allowed.

Checklist to execute when allowed:

- Guest browses catalog.
- Guest submits a public review.
- Seller creates a product.
- Buyer tops up wallet, creates an address, adds one cart item, and checks out with a discount.
- Seller processes the order.
- Driver takes and completes delivery.
- Admin checks monitoring, creates a voucher or promo, advances time, and processes overdue orders.
- Buyer spending, buyer wallet transactions, seller income, and driver earnings report surfaces show expected values.

## Known Limitations

- Build, test, database setup, seed, API startup, web startup, and browser/manual verification are pending explicit permission.
- The added tests are code-level verification with mocked dependencies; they prove service/controller behavior and expected Prisma side effects, but they do not replace a seeded end-to-end demo run.
