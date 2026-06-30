# Level 5 Driver Delivery Evidence

This Level 5 completion branch keeps the bundled Level 3-5 backend from `88f0632` intact and adds focused proof for the driver delivery workflow: API tests, documentation, and demo UI coverage.

## Public endpoints

All Level 5 driver endpoints require a valid JWT whose active role is `DRIVER`.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/driver/jobs/available` | Lists delivery jobs that are open for manual driver acceptance. |
| `GET` | `/driver/jobs` | Lists only the jobs assigned to the authenticated driver. |
| `POST` | `/driver/jobs/:jobId/take` | Assigns an available job to the authenticated driver. |
| `POST` | `/driver/jobs/:jobId/complete` | Completes an assigned active delivery job. |
| `GET` | `/driver/earnings` | Returns completed delivery earnings for the authenticated driver. |

## Delivery job lifecycle

1. A buyer checks out with a delivery method.
2. Checkout records the order delivery fee from `DELIVERY_RULES`.
3. The seller processes the order through the bundled seller workflow when required by the current backend flow.
4. Seller processing moves the order to `MENUNGGU_PENGIRIM` and creates or reopens the delivery job as `AVAILABLE`.
5. A driver manually accepts the job with `POST /driver/jobs/:jobId/take`.
6. Taking the job assigns `driverId`, marks the job `TAKEN`, and moves the order to `SEDANG_DIKIRIM`.
7. The assigned driver completes the job with `POST /driver/jobs/:jobId/complete`.
8. Completion marks the job `COMPLETED`, moves the order to `PESANAN_SELESAI`, writes `completedAt`, and creates a driver earning.

## Driver role requirements

Driver endpoints are protected by `JwtAuthGuard` and `ActiveRoleGuard(Role.DRIVER)`.

A user may have the `DRIVER` role in `roles`, but the token must also carry `activeRole: DRIVER`. Use `POST /auth/select-role` with `{ "role": "DRIVER" }` before calling driver endpoints in the demo UI or manual checks.

Non-driver active roles such as `BUYER`, `SELLER`, or `ADMIN` are rejected by the active-role guard.

## Delivery fee and earning behavior

The order delivery fee is charged during checkout and is stored on the order. The driver earning is stored on the delivery job when seller processing opens the job.

| Delivery method | Buyer delivery fee | Driver earning |
| --- | ---: | ---: |
| `INSTANT` | 30000 | 20000 |
| `NEXT_DAY` | 18000 | 12000 |
| `REGULAR` | 10000 | 7000 |

Driver earnings totals are based only on rows in `DriverEarning`, which are written when assigned jobs are completed. Available or taken jobs do not increase the earnings total.

## Job ownership rules

- Only jobs with status `AVAILABLE`, no `driverId`, and an order status of `MENUNGGU_PENGIRIM` can be taken.
- Taking uses an atomic `updateMany` filter so a job cannot be taken twice.
- `GET /driver/jobs` filters by the authenticated driver's id.
- Completion requires the same authenticated driver, job status `TAKEN`, and order status `SEDANG_DIKIRIM`.
- A driver cannot complete another driver's job.
- Completing the same job again fails because completed jobs no longer match the active completion filter.

## Manual acceptance flow

1. Login as a buyer and create a checkout order with a delivery method.
2. Login as the seller and process the order if the current backend flow still has the order in `SEDANG_DIKEMAS`.
3. Login as a driver.
4. Activate the `DRIVER` role through `POST /auth/select-role`.
5. Open the driver dashboard in the demo UI and refresh jobs.
6. Confirm the job appears in available jobs.
7. Take the job and confirm it moves to assigned jobs.
8. Complete the delivery and confirm the earnings total increases.
9. Login as another driver and confirm the same job is no longer available and cannot be taken or completed again.

## Demo UI evidence

The web demo includes a Level 5 driver dashboard with:

- driver active-role controls
- available delivery jobs list
- assigned jobs list
- take job action
- complete delivery action
- driver earnings summary

## Bundled backend note

The bundled `88f0632` backend includes Level 3 buyer checkout and Level 4 discount/seller processing endpoints because the Level 5 driver workflow depends on an order being checked out and processed before delivery work is available. Those bundled Level 3 and Level 4 flows are supporting setup for Level 5 acceptance and are not the focus of this completion evidence.
