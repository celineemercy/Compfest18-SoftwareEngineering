# Level 4 Discounts and Seller Processing

This page documents the Level 4 acceptance surface that is bundled in commit
`88f0632`. The same backend commit also contains Level 3 buyer workflow and Level
5 driver delivery endpoints, but those are supporting context and are not part of
the Level 4 acceptance scope.

## Public endpoints

| Area | Method | Endpoint | Purpose |
| --- | --- | --- | --- |
| Admin discounts | `POST` | `/admin/vouchers` | Create a voucher code with a limited remaining usage count. |
| Admin discounts | `GET` | `/admin/vouchers` | List vouchers, newest first. |
| Admin discounts | `POST` | `/admin/promos` | Create a promo code without a usage counter. |
| Admin discounts | `GET` | `/admin/promos` | List promo codes, newest first. |
| Buyer checkout | `POST` | `/buyer/checkout` | Checkout with optional `discountCode`. |
| Seller orders | `GET` | `/seller/orders` | List orders for stores owned by the active seller. |
| Seller orders | `POST` | `/seller/orders/:orderId/process` | Move an eligible seller order from packing to waiting for driver. |
| Seller reports | `GET` | `/seller/reports/income` | Return seller order count, completed count, and gross income. |

All endpoints except the public catalog dependencies require JWT authentication
and the matching active role guard.

## Discount business rules

Discount codes are normalized to uppercase before lookup or creation.

Both vouchers and promos support two discount types:

| Type | Behavior |
| --- | --- |
| `FIXED` | Subtracts the configured amount from the cart subtotal. |
| `PERCENTAGE` | Subtracts a rounded percentage of the cart subtotal. |

Discount value is capped at the subtotal, so a code cannot make the discounted
subtotal negative. PPN and delivery fee are calculated after the discount is
applied.

Checkout rejects a discount code when:

- the code does not match any voucher or promo
- the matching voucher or promo is inactive
- the matching voucher or promo is expired
- the matching voucher has no remaining usage

## Voucher vs promo behavior

Vouchers are limited-use discounts. `POST /admin/vouchers` accepts
`remainingUsage`, defaulting to `1` when omitted. When a voucher is successfully
redeemed through `/buyer/checkout`, the backend decrements `remainingUsage` by
one and records a discount redemption linked to the order.

Promos do not have a usage counter. `POST /admin/promos` creates a reusable code
that remains valid until it is inactive or expired. Successful promo checkout
records a discount redemption linked to the order, but does not update voucher
usage.

## Seller processing flow

`GET /seller/orders` scopes results to orders whose store belongs to the active
seller. It does not expose orders from other sellers.

`POST /seller/orders/:orderId/process` only processes an order when all of these
conditions are true:

- the order exists
- the order belongs to one of the active seller stores
- the order status is `SEDANG_DIKEMAS`

When processing succeeds, the order status changes to `MENUNGGU_PENGIRIM`, a
status history entry is created, and a delivery job is created or reopened as
`AVAILABLE`.

## Seller income report

`GET /seller/reports/income` reads non-returned orders for the active seller
stores and returns:

- `orderCount`: count of included non-returned orders
- `completedOrders`: count of included orders with status `PESANAN_SELESAI`
- `grossIncome`: sum of `subtotal - discountAmount`

Returned orders with status `DIKEMBALIKAN` are excluded from the report.

## Demo UI evidence

The web app includes role-gated Level 4 demo surfaces:

- Admin users see an Admin discounts workspace for creating and listing vouchers
  and promos.
- Buyer users see a checkout discount-code input that sends optional
  `discountCode` to `/buyer/checkout`.
- Seller users see a Seller processing workspace for incoming orders, the
  process-order action, and the seller income report summary.

These UI pieces are demonstration coverage for the existing API flows and do not
introduce new Level 4 endpoints.
