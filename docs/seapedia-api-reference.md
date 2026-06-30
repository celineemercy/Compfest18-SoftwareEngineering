# SEAPEDIA API Reference

This is the lightweight API documentation for the current SEAPEDIA demo. Protected endpoints require a bearer token. Role-protected endpoints require that the token contains the matching selected `activeRole`.

## Authentication

- `POST /auth/register`: public buyer registration with `email`, `username`, and `password`.
- `POST /auth/login`: returns `accessToken` and user data for `email` and `password`.
- `POST /auth/select-role`: protected role selection with `role`; returns a token with `activeRole`.
- `GET /auth/me`: protected authenticated user payload.

## Public Marketplace

- `GET /products`: public product list with store data.
- `GET /products/:productId`: public product detail.
- `GET /stores`: public store list with products.
- `GET /stores/:storeId`: public store detail.
- `GET /stores/:storeId/products`: public products for one store.
- `GET /reviews`: public application reviews.
- `POST /reviews`: public review submission with `name`, `rating`, `category`, and `comment`.

## Seller

Requires active role `SELLER`.

- `POST /stores`: create store with `name` and optional `description`.
- `GET /stores/me`: list stores owned by the seller.
- `PATCH /stores/:storeId`: update owned store.
- `POST /stores/:storeId/products`: create product in an owned store.
- `GET /seller/stores/:storeId/products`: list owned store products.
- `GET /seller/products/:productId`: get owned product.
- `PATCH /products/:productId`: update owned product.
- `DELETE /products/:productId`: delete owned product.
- `GET /seller/orders`: list orders for seller stores.
- `POST /seller/orders/:orderId/process`: move an order to `MENUNGGU_PENGIRIM` and create an available delivery job.
- `GET /seller/reports/income`: seller income report.

## Buyer

Requires active role `BUYER`.

- `GET /buyer/wallet`: buyer wallet balance.
- `POST /buyer/wallet/top-up`: dummy top-up with `amount`.
- `GET /buyer/wallet/transactions`: wallet transaction history.
- `GET /buyer/addresses`: list buyer addresses.
- `POST /buyer/addresses`: create address.
- `PATCH /buyer/addresses/:addressId`: update owned address.
- `DELETE /buyer/addresses/:addressId`: delete owned address.
- `GET /buyer/cart`: current cart.
- `POST /buyer/cart/items`: add product to cart with `productId` and `quantity`.
- `PATCH /buyer/cart/items/:itemId`: update cart quantity.
- `DELETE /buyer/cart/items/:itemId`: remove cart item.
- `POST /buyer/checkout`: checkout cart with `addressId`, `deliveryMethod`, and optional `discountCode`.
- `GET /buyer/orders`: buyer order history.
- `GET /buyer/orders/:orderId`: buyer order detail.
- `GET /buyer/reports/spending`: buyer spending report.

## Driver

Requires active role `DRIVER`.

- `GET /driver/jobs/available`: list available jobs for orders in `MENUNGGU_PENGIRIM`.
- `GET /driver/jobs`: driver job history.
- `POST /driver/jobs/:jobId/take`: claim an available job and move the order to `SEDANG_DIKIRIM`.
- `POST /driver/jobs/:jobId/complete`: complete a taken job and move the order to `PESANAN_SELESAI`.
- `GET /driver/earnings`: driver earning summary and history.

## Admin

Requires active role `ADMIN`.

- `GET /admin/monitoring`: counts for users, stores, products, orders, vouchers, promos, delivery jobs, overdue orders, and current simulated clock.
- `POST /admin/vouchers`: create voucher with `code`, `type`, `amount`, optional `remainingUsage`, and `expiresAt`.
- `GET /admin/vouchers`: list vouchers.
- `POST /admin/promos`: create promo with `code`, `type`, `amount`, and `expiresAt`.
- `GET /admin/promos`: list promos.
- `POST /admin/time/advance`: advance simulated clock with `days`.
- `POST /admin/overdue/process`: process overdue in-delivery orders idempotently.
- `POST /admin/users`: create admin-managed users with `email`, `username`, `password`, and optional `roles`.

## Business Rules

- Protected role APIs authorize against the selected `activeRole`.
- A cart may contain products from one store only.
- Checkout calculates `subtotal - discount + PPN 12% + delivery fee`.
- A checkout accepts one discount code, resolved as either voucher or promo.
- Seller processing creates the delivery job.
- Driver job claiming is guarded so an available job can only be taken once.
- Overdue processing refunds the buyer wallet, restores stock, marks delivery returned, and writes an idempotency log.
