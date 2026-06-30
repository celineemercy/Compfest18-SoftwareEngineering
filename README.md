# SEAPEDIA

SEAPEDIA is a full-stack marketplace demo built for the COMPFEST 18 Software Engineering Academy challenge. It supports guest browsing, multi-role authentication, seller store management, buyer checkout, driver delivery, and admin monitoring in one local monorepo.

The project is designed around the challenge's progressive levels through Level 7, with backend authorization driven by the user's selected active role.

## Features

- Public marketplace: guests can browse products, stores, product details, and public application reviews.
- Authentication: registration, login, JWT authentication, and active-role selection.
- Multi-role users: one account can own multiple roles, but protected workflows authorize against the selected `activeRole`.
- Seller workflow: create stores, manage products, process incoming orders, and view income reports.
- Buyer workflow: wallet top-up, transaction history, addresses, single-store cart, checkout, order history, and spending reports.
- Checkout rules: subtotal, one voucher or promo code, PPN 12%, delivery fee, stock updates, and wallet payment.
- Driver workflow: discover available delivery jobs, claim jobs, complete deliveries, and view earnings.
- Admin workflow: monitoring, voucher/promo management, user creation, simulated time advance, and overdue order processing.
- Order lifecycle: `SEDANG_DIKEMAS`, `MENUNGGU_PENGIRIM`, `SEDANG_DIKIRIM`, `PESANAN_SELESAI`, and `DIKEMBALIKAN`.

## Tech Stack

- Monorepo: npm workspaces
- Frontend: React, Vite, TypeScript, Tailwind CSS, lucide-react
- Backend: NestJS, TypeScript, JWT, class-validator
- Database: PostgreSQL 15 through Docker Compose
- ORM: Prisma
- Testing: Jest and Supertest for the API

## Project Structure

```text
.
|-- apps
|   |-- api                 # NestJS API, Prisma schema, migrations, seed data
|   `-- web                 # React/Vite single-page application
|-- docs                    # Requirements, API reference, and testing guide
|-- docker-compose.yaml     # Local PostgreSQL service
|-- package.json            # Root workspace scripts
`-- README.md
```

## Prerequisites

- Node.js and npm
- Docker Desktop or another Docker Compose-compatible runtime
- Git

## Local Setup

1. Install dependencies.

   ```powershell
   npm install
   ```

2. Create the root environment file.

   ```powershell
   Copy-Item .env.example .env
   ```

3. Start PostgreSQL.

   ```powershell
   npm run db:up
   ```

4. Run Prisma migration, generate the client, and seed demo data.

   ```powershell
   npm run prisma:migrate
   npm run prisma:generate
   npm run db:seed
   ```

5. Start the API and web app in separate terminals.

   ```powershell
   npm run dev:api
   ```

   ```powershell
   npm run dev:web
   ```

By default, the API runs on `http://localhost:3000`. The Vite dev server prints the web URL in the terminal, usually `http://localhost:5173`.

## Environment Variables

The root `.env` is used by Docker Compose and the API's local database connection.

```env
POSTGRES_USER=seapedia_admin
POSTGRES_PASSWORD=seapedia_secret
POSTGRES_DB=seapedia_db
DATABASE_URL="postgresql://seapedia_admin:seapedia_secret@localhost:5432/seapedia_db?schema=public"
PORT=3000
JWT_SECRET=change-me-in-local-development
```

The web app reads `VITE_API_URL`. If it is not set, it defaults to `http://localhost:3000`.

## Demo Accounts

All seeded demo accounts use password `password123`.

| Role | Email |
| --- | --- |
| Admin | `admin@seapedia.test` |
| Seller | `seller@seapedia.test` |
| Buyer | `buyer@seapedia.test` |
| Driver | `driver@seapedia.test` |
| Multi-role | `multi@seapedia.test` |

After login, choose an active role before using private dashboards or role-protected API endpoints.

## Useful Scripts

| Command | Purpose |
| --- | --- |
| `npm run db:up` | Start the PostgreSQL container |
| `npm run db:down` | Stop Docker Compose services |
| `npm run db:logs` | Stream PostgreSQL logs |
| `npm run dev:api` | Start the NestJS API in watch mode |
| `npm run dev:web` | Start the Vite web app |
| `npm run build:api` | Build the API |
| `npm run build:web` | Build the web app |
| `npm run test:api` | Run API unit tests |
| `npm run lint:api` | Lint and fix API files |
| `npm run lint:web` | Lint the web app |
| `npm run prisma:migrate` | Apply Prisma migrations in development |
| `npm run prisma:generate` | Generate Prisma Client |
| `npm run db:seed` | Seed demo users, products, discounts, and related data |
| `npm run setup:check` | Validate Docker Compose configuration |

## Core API Areas

- `POST /auth/register`, `POST /auth/login`, `POST /auth/select-role`, `GET /auth/me`
- `GET /products`, `GET /stores`, `GET /reviews`, `POST /reviews`
- Seller endpoints for stores, products, order processing, and income reports
- Buyer endpoints for wallet, addresses, cart, checkout, orders, and spending reports
- Driver endpoints for available jobs, claimed jobs, completion, and earnings
- Admin endpoints for monitoring, vouchers, promos, users, simulated time, and overdue processing

See [docs/seapedia-api-reference.md](docs/seapedia-api-reference.md) for endpoint details.

## Business Rules

- Protected role APIs authorize against the JWT's selected `activeRole`.
- Guests can browse catalog data and create public application reviews.
- A cart can contain products from one store only.
- Checkout calculates `subtotal - discount + PPN 12% + delivery fee`.
- One checkout discount code is accepted and resolved as either a voucher or promo.
- Seller order processing creates the delivery job.
- A driver can claim an available delivery job only once.
- Overdue processing is idempotent: it refunds the buyer wallet, restores stock, marks delivery returned, writes status history, and records the processing log.

## Testing and Demo Flow

Run the API tests with:

```powershell
npm run test:api
```

For manual acceptance testing:

1. Browse products, stores, and reviews as a guest.
2. Submit a public review.
3. Login as seller, select `SELLER`, create a store/product, then confirm it appears in the public catalog.
4. Login as buyer, select `BUYER`, top up wallet, add an address, add a product to cart, and checkout with `HEMAT10K` or `PROMO10`.
5. Login as seller again and process the new order.
6. Login as driver, select `DRIVER`, claim the available job, then complete it.
7. Login as admin, select `ADMIN`, inspect monitoring, create discounts, advance simulated time, and process overdue orders.

See [docs/seapedia-testing-guide.md](docs/seapedia-testing-guide.md) for the full testing guide.

## Documentation

- [Requirements analysis](docs/seapedia-requirements-analysis.md)
- [API reference](docs/seapedia-api-reference.md)
- [Testing guide](docs/seapedia-testing-guide.md)
- [Day 1 setup notes](docs/day-1-setup.md)

## Branch Workflow

Feature branches are organized by challenge milestone:

- `feature/foundation-active-role-schema`
- `feature/level-3-buyer-checkout`
- `feature/level-4-discounts-seller-processing`
- `feature/level-5-driver-delivery`
- `feature/level-6-admin-overdue`
- `feature/level-7-hardening-demo-docs`

`backup/integrated-level-7-demo` preserves the integrated local Level 7 demo state.
