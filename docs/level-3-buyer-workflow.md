# Level 3: Buyer Wallet, Addresses, Cart & Checkout

This document covers the buyer-facing workflow implemented in `MarketplaceController` /
`MarketplaceService` (`apps/api/src/marketplace`). All endpoints below require a `BUYER`
active role: send `Authorization: Bearer <accessToken>` from `POST /auth/login`, with the
account's active role set to `BUYER`.

> **Scope note:** the backend implementation in this branch's base commit also includes
> seller order processing, driver delivery jobs, admin vouchers/promos, and discount
> redemption — those belong to later levels (4-5) and are bundled in the same
> `MarketplaceController`/`MarketplaceService` files for safety (splitting them out without
> a schema rewrite would risk breaking the shared `Order`/`checkout` flow). This document,
> its tests, and its demo UI only cover Level 3 buyer behavior. Treat `seller/*`,
> `driver/*`, `admin/*`, and the `discountCode` field on checkout as out of scope for Level
> 3 acceptance.

## Endpoints

| Method | Path | Body | Notes |
| --- | --- | --- | --- |
| GET | `/buyer/wallet` | – | Creates the wallet on first read (balance starts at 0). |
| POST | `/buyer/wallet/top-up` | `{ amount: number }` (`amount >= 1000`) | Increments balance, logs a `TOP_UP` transaction. |
| GET | `/buyer/wallet/transactions` | – | Newest first. |
| GET | `/buyer/addresses` | – | Default address first, then newest. |
| POST | `/buyer/addresses` | `{ label, recipient, phone, fullAddress, city, postalCode }` | First address for a buyer is auto-marked default. |
| PATCH | `/buyer/addresses/:addressId` | Same shape as create | 404 if the address isn't owned by the caller. |
| DELETE | `/buyer/addresses/:addressId` | – | 404 if not owned. |
| GET | `/buyer/cart` | – | Includes store and product details per line item. |
| POST | `/buyer/cart/items` | `{ productId, quantity }` | 404 if product missing, 409 if `quantity` exceeds stock, 400 if the cart already holds items from a different store. |
| PATCH | `/buyer/cart/items/:itemId` | `{ quantity }` | 404 if not owned, 409 if quantity exceeds stock. |
| DELETE | `/buyer/cart/items/:itemId` | – | Clears the cart's store lock once the last item is removed. |
| POST | `/buyer/checkout` | `{ addressId, deliveryMethod }` (`discountCode` optional, Level 4) | See checkout rules below. |
| GET | `/buyer/orders` | – | Orders for the authenticated buyer only. |
| GET | `/buyer/orders/:orderId` | – | 404 if the order doesn't belong to the caller. |

## Business rules

- **Single-store cart**: a buyer's cart can only hold products from one store at a time.
  Adding a product from a different store fails with 400 until the cart is emptied.
- **Stock checks**: adding or updating a cart item fails with 409 if the requested quantity
  exceeds the product's current stock. Stock is re-checked and decremented atomically during
  checkout; if a concurrent checkout drained the stock first, the whole checkout fails with
  409 and nothing is charged.
- **Checkout total** = `subtotal - discount + ppn(12%) + deliveryFee`, where `deliveryFee`
  comes from `DELIVERY_RULES` (`apps/api/src/common/marketplace.constants.ts`) based on
  `deliveryMethod` (`INSTANT` / `NEXT_DAY` / `REGULAR`). Discounts are Level 4 and default to
  0 when no `discountCode` is sent.
- **Wallet deduction**: checkout fails with 400 (`Insufficient wallet balance`) if the
  buyer's wallet balance is below the computed total. On success, the wallet is decremented
  and a `PAYMENT` wallet transaction is recorded with a negative amount referencing the new
  order.
- **Address ownership**: checkout requires `addressId` to belong to the authenticated buyer,
  otherwise 404.
- **Order creation**: a successful checkout creates one `Order` (status `SEDANG_DIKEMAS`)
  with snapshotted `OrderItem`s, clears the cart, and unlocks the cart's store for the next
  purchase.

## Tests

Unit coverage lives in `apps/api/src/marketplace/marketplace.service.spec.ts`, following the
hand-mocked-Prisma convention used elsewhere in `apps/api/src` (see
`products.service.spec.ts`). It covers:

- wallet top-up and transaction listing
- address create-defaulting, and ownership checks on update/delete
- cart single-store restriction, stock checks, and ownership checks on update/delete
- checkout success (wallet deduction + order creation), and failures for empty cart, missing
  address, insufficient balance, and a stock race during checkout
- buyer order list/detail scoped to the authenticated buyer

`apps/api/src/auth/guards/active-role.guard.spec.ts` covers the role guard used on every
buyer route, including the "wrong role" rejection.

Run with:

```powershell
npm run test:api
```

## Demo UI

`apps/web/src/components/BuyerWorkspace.tsx` renders once a buyer is logged in (visible on
the homepage after login when the account has the `BUYER` role). It covers:

- wallet balance + top-up + transaction history
- address list + create + delete
- public catalog (`GET /products`) with add-to-cart
- cart with quantity controls and item removal
- checkout (address + delivery method) against `POST /buyer/checkout`
- buyer order history

## Manual acceptance flow

1. `npm run dev:api` and `npm run dev:web` (or your usual local setup).
2. Register a buyer account and log in.
3. In the **Buyer demo** card: open **Wallet**, top up at least 50,000.
4. Open **Addresses**, create one address.
5. Open **Catalog**, add a product to the cart (requires at least one seller product to
   exist — create one via the seller flow first if the catalog is empty).
6. Open **Cart**, adjust quantity with +/-, confirm the line total/stock behaves.
7. Select the saved address and a delivery method, click **Checkout**.
8. Confirm:
   - the wallet balance decreased by the order total shown,
   - the cart is now empty,
   - the new order appears under **Orders** with status `SEDANG_DIKEMAS`.

Seller processing, driver delivery, and admin discount/monitoring flows are not required to
exercise or verify this acceptance flow — they belong to Levels 4-6.
