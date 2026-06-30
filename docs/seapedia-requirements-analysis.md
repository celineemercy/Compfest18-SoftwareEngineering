# SEAPEDIA Requirements Analysis

This document summarizes the COMPFEST 18 Software Engineering Academy technical challenge and translates the brief into planning-ready requirements. It is not the implementation plan yet; it is the map the implementation plan should be built from.

## Challenge Shape

SEAPEDIA is a multi-role marketplace with four roles:

- `ADMIN`
- `SELLER`
- `BUYER`
- `DRIVER`

The system must be fullstack. The client may be web or mobile, but the backend must be API-based and support the required business flows.

The assessment is progressive. A claimed level is evaluated from Level 1 through that level. Higher-level features are not required for lower-level completion, but the architecture should expect them.

## Current Repository Baseline

The current repository already contains:

- NestJS API in `apps/api`
- React/Vite web app in `apps/web`
- PostgreSQL via Docker Compose
- Prisma schema and migrations
- Existing `User`, `Store`, `Product`, and `Role` schema
- Authentication module with registration, login, password hashing, JWT, and `/auth/me`
- Seller store/product modules started
- Frontend single-page shell with auth calls and public review form behavior

Important current gap:

- Authorization currently appears to check whether a user owns a role. The assignment requires authorization based on the user's selected active role for the current session.

## Non-Negotiable Business Rules

These rules affect multiple levels and should be treated as architectural constraints:

- One non-admin username may own multiple roles.
- A multi-role non-admin user must choose an active role after login.
- Backend authorization must follow the active role, not merely the user's full role list.
- Guests may browse products, product details, and public application reviews.
- Guests cannot checkout or access private dashboards.
- Guests or logged-in users may submit public application reviews.
- Seller store names must be unique.
- Buyers need wallet balance, delivery address, cart, and checkout flow.
- Cart checkout is single-store only: one cart may contain products from only one store.
- Checkout must calculate subtotal, discount, delivery fee, PPN 12%, and final total.
- Discounts must support both vouchers and promos.
- Delivery methods must include Instant, Next Day, and Regular.
- Every order must store status history with timestamps.
- Sellers must process an order before a driver can take it.
- Drivers can find jobs, take jobs, complete jobs, and view earnings.
- Overdue handling must support auto refund or auto return based on delivery method.
- The app must provide a way to simulate the next day or time progression.
- Public user-generated content must be rendered safely.

## Main Order Lifecycle

The user-facing lifecycle must include these statuses:

- `Sedang Dikemas`
- `Menunggu Pengirim`
- `Sedang Dikirim`
- `Pesanan Selesai`
- `Dikembalikan`

Recommended status transitions:

1. Buyer checks out successfully: `Sedang Dikemas`
2. Seller processes order: `Menunggu Pengirim`
3. Driver takes job: `Sedang Dikirim`
4. Driver confirms completion: `Pesanan Selesai`
5. Overdue return/refund: `Dikembalikan`

Additional internal statuses are acceptable if the main statuses remain visible in the UI.

## Level-by-Level Requirements

### Level 1: Public Marketplace, Authentication, Reviews

Required backend/API capabilities:

- Register user
- Login user
- Logout/session clearing behavior
- Password hashing
- Token, JWT, or session authentication
- Data model for Admin, Seller, Buyer, Driver
- Multi-role support for non-admin users
- Active role selection flow
- Authenticated profile endpoint
- Private endpoint protection by active role

Required frontend capabilities:

- Landing or home page
- Product listing page accessible by guests
- Read-only product detail page
- Login page
- Register page
- Role selection page or modal for multi-role users
- Dashboard/profile summary showing owned roles and active role
- Balance/financial summary placeholder
- Public application review form with name, rating, comment
- Public review display
- Reusable UI components and responsive navigation
- Dashboard placeholders for Admin, Seller, Buyer, Driver

Primary risk:

- Active role must be implemented early, because all later dashboards and APIs depend on it.

### Level 2: Seller Experience

Required backend/API capabilities:

- Store model/resource
- Unique store name validation
- Seller store create/update
- Public store summary or store info block
- Product model/resource with name, description, price, stock, store owner
- Seller product create/update/delete
- Seller-owned product listing
- Public product list and product detail endpoints

Required frontend capabilities:

- Seller dashboard
- Store management form
- Product management UI
- Public catalog backed by real products
- Product detail showing store information

Primary risks:

- Public product endpoints should not require seller authentication.
- Seller mutation endpoints must enforce ownership.

### Level 3: Buyer Wallet, Cart, Checkout

Required backend/API capabilities:

- Buyer wallet/balance resource
- Dummy top-up flow
- Wallet transaction history
- Buyer delivery address resource
- Cart and cart item resources
- Single-store cart enforcement
- Checkout endpoint
- Delivery method support: Instant, Next Day, Regular
- Subtotal, delivery fee, PPN 12%, final total calculation
- Wallet balance check
- Safe stock reduction
- Order and order item creation
- Order status history
- Buyer order history/detail
- Seller incoming order list

Required frontend capabilities:

- Buyer dashboard with wallet and top-up history
- Address management
- Cart page
- Checkout summary page
- Buyer order history/detail
- Seller incoming orders

Primary risks:

- Stock reduction must not allow negative stock.
- Checkout should be transactional: wallet debit, stock reduction, cart clearing, order creation, and status history should succeed or fail together.

### Level 4: Discounts and Seller Order Processing

Required backend/API capabilities:

- Voucher resource
- Promo resource
- Admin endpoints to generate vouchers/promos
- Voucher/promo list and detail endpoints
- Voucher expiry and remaining usage
- Promo expiry
- Checkout discount validation
- Seller order processing action
- Buyer spending report
- Seller income report

Required frontend capabilities:

- Discount code field and validation feedback in checkout
- Checkout summary showing subtotal, discount, delivery fee, PPN 12%, final total
- Seller action to move order from `Sedang Dikemas` to `Menunggu Pengirim`
- Buyer and seller order timeline/status tracker
- Buyer and seller report pages

Planning decisions to document:

- Whether vouchers and promos can be combined
- Whether discount applies before or after PPN
- How seller income is counted

### Level 5: Delivery and Driver Workflow

Required backend/API capabilities:

- Delivery job resource
- Available job list for drivers
- Job detail
- Take job action
- Completion action
- One active driver per order
- Driver job history
- Driver earning calculation

Required frontend capabilities:

- Driver dashboard
- Available job list
- Active job detail
- Complete job action
- Driver earnings summary
- Buyer and seller delivery tracking

Primary risks:

- Taking a job must be concurrency-safe so two drivers cannot take the same order.
- Drivers must only see/take orders in `Menunggu Pengirim`.

### Level 6: Admin Monitoring and Overdue Handling

Required backend/API capabilities:

- Admin monitoring data for users, stores, products, orders, vouchers, promos, delivery jobs, overdue orders
- Admin voucher/promo management APIs if not complete earlier
- Delivery SLA rules for Instant, Next Day, Regular
- Overdue detection
- Auto refund or auto return
- Wallet refund transaction
- Seller income reversal or adjusted reporting
- Stock restoration
- Idempotency guard against double refund, double reversal, and double stock restoration
- Manual admin trigger or scheduler/worker/command for time simulation

Required frontend capabilities:

- Admin dashboard
- Monitoring pages or summaries
- Voucher/promo generation UI
- Voucher/promo list/detail UI
- Overdue order view
- Time simulation trigger/view

Primary risks:

- Overdue handling touches money, stock, order status, and reports. It should be implemented transactionally and leave visible history.

### Level 7: Security Hardening and Finalization

Required backend/API capabilities:

- SQL injection prevention through Prisma/ORM-safe access or parameterized queries
- Required-field validation
- Validation for email, phone, rating, quantity, price, stock, and discount values
- Server-side active-role verification
- Resource ownership enforcement
- Token/session expiration behavior
- Logout behavior documented

Required frontend/documentation capabilities:

- Safe rendering of public reviews/comments
- Clear error messages for invalid input
- API documentation: Swagger/OpenAPI, Postman, or equivalent
- Seed data or demo accounts for all roles
- README instructions
- Security notes
- End-to-end testing guide

Required documented rules:

- Single-store checkout behavior
- Discount combination rule
- PPN 12% calculation rule
- Driver earning rule
- Overdue SLA and time simulation
- SQL injection handling
- XSS handling
- Input validation
- Session behavior
- Role-based access control

## Suggested Domain Model

Core identity and authorization:

- `User`
- `Role`
- `ActiveSession` or JWT payload containing active role

Marketplace:

- `Store`
- `Product`
- `ApplicationReview`

Buyer:

- `BuyerProfile` or buyer-specific fields
- `Wallet`
- `WalletTransaction`
- `Address`
- `Cart`
- `CartItem`

Orders:

- `Order`
- `OrderItem`
- `OrderStatusHistory`

Discounts:

- `Voucher`
- `Promo`
- `DiscountRedemption` if usage tracking needs auditability

Delivery:

- `DeliveryJob`
- `DriverEarning`

Operations:

- `SystemClock` or `TimeSimulation`
- `OverdueProcessingLog`

## Recommended Planning Order

1. Fix authentication foundation and active-role authorization.
2. Complete Level 1 UI routes and public review behavior.
3. Finish Level 2 seller/store/product/public catalog integration.
4. Add Level 3 buyer wallet, address, cart, checkout, orders, and status history.
5. Add Level 4 vouchers/promos, seller processing, reports, and timelines.
6. Add Level 5 driver jobs, take/complete workflow, and earnings.
7. Add Level 6 admin monitoring, discount UI, overdue handling, and time simulation.
8. Finish Level 7 security, API docs, seed data, README, and demo checklist.

## Implementation Plan Inputs

Before writing the implementation plan, decide:

- Claimed target level for the first submission milestone.
- Whether admin users are seed-only or registerable through a protected flow.
- How active role is stored: JWT after role selection or server-side session.
- Whether each non-admin role has a profile table or uses role-specific resources only.
- Delivery fees for Instant, Next Day, and Regular.
- PPN calculation base.
- Voucher/promo combination rule.
- Driver earning formula.
- Overdue SLA per delivery method.
- Time simulation approach.
- Deployment target.

## Demo Flow to Preserve

The final project should be demonstrable as one integrated journey:

1. Guest browses catalog and product detail.
2. Guest submits public application review.
3. User registers/logs in.
4. Multi-role user selects active role.
5. Seller creates store and products.
6. Buyer tops up wallet, manages address, adds product to cart, checks out.
7. Seller processes order.
8. Driver takes and completes delivery.
9. Admin monitors system and triggers/verifies overdue handling.
10. Security test cases show XSS and SQL injection attempts are handled safely.

## High-Risk Areas

- Active-role authorization
- Resource ownership checks
- Single-store cart enforcement
- Transactional checkout
- Stock race conditions
- Discount validation and usage decrement
- Delivery job concurrency
- Overdue refund/return idempotency
- Public review XSS safety
- Documentation completeness

