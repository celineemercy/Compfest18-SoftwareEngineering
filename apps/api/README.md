# SEAPEDIA API

NestJS backend for the SEAPEDIA marketplace demo.

## Main Modules

- `auth`: registration, login, JWT payloads, active-role selection, and guards.
- `stores` and `products`: public catalog plus seller-owned mutations.
- `marketplace`: reviews, buyer wallet/cart/checkout/orders, discounts, seller processing, driver jobs, admin monitoring, and overdue processing.
- `prisma`: Prisma client integration and database schema.

## Local Commands

Run from the repository root unless you are working directly inside `apps/api`.

```powershell
npm run dev:api
npm run build:api
npm run test:api
npm run prisma:migrate
npm run prisma:generate
npm run db:seed
```

## API Documentation

See `../../docs/seapedia-api-reference.md` for endpoint groups, role requirements, and business rules.
