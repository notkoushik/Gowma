# GOMAA Role Isolation, Payment, Tracking, and Full QA Plan

## Source of truth

This plan is based on:

- The revised requirements PDF: `.opencode/omnirush/inbox/pdf-pages/cf25ef9eda8e4b31-GOMAA_Customer_Booking_Manager_Admin_Approval_Payment_Flow_Revised _1_/text.md`
- The current React/Vite frontend, Node/Vite API, Prisma schema, JWT/authentication, booking, hold, payment, settlement, WebSocket, and GPS code.

The PDF defines the booking lifecycle as:

```text
Customer selection
→ availability check
→ temporary hold
→ payment
→ server payment verification
→ manager review
→ admin final confirmation
→ driver assignment
→ trip/service
→ completion
→ settlement
```

## Critical authority clarification

The role model must distinguish **identity** from **operational scope**:

### Super Admin / Captain

Has complete application authority over data, pricing, users, Gosalas, animals, bookings, payments, settlements, audit records, and configuration.

The Super Admin must **not automatically subscribe to or render live GPS tracking**. Financial/governance authority and high-volume realtime map access are separate capabilities.

Required capability split:

```text
SUPER_ADMIN_FINANCE_AND_GOVERNANCE = allowed
SUPER_ADMIN_LIVE_TRACKING = denied by default
```

If an explicit incident-support action is later needed, it should be an audited, time-limited opt-in rather than normal navigation access.

### Operations Admin

Can access only the Gosalas in the admin's maintained portfolio.

The scope must come from database relationships, not:

- browser local storage
- URL role
- `callerRole`
- `callerGosala`
- `adminName`
- arbitrary request body fields

Required authorization condition:

```text
adminPortfolio.contains(resource.gosalaId)
```

If the admin has no assigned portfolio, the default must be an empty result, not all Gosalas.

### Super Admin acting operationally

The Super Admin may have an operational-admin identity/scope for a limited portfolio. This must be represented as a separate, explicit scope or actor context.

When acting as Operations Admin:

```text
visible Gosalas = acting operational portfolio only
live tracking = still disabled unless explicitly authorized
pricing/settlement authority = not inherited by the acting operational view
```

When returning to Super Admin:

```text
visible data = complete application authority
live tracking = still not rendered/subscribed by default
```

Do not implement this as silently changing the JWT role in the browser. Use a server-issued, audited context such as `activeScopeId` or an impersonation/assumption token with:

- actor user ID
- effective role
- effective Gosala IDs
- reason
- issued/expiry timestamps
- audit record

## Current code gaps to resolve before P3

These are requirements mismatches that must become tracked defects:

1. `src/App.tsx` currently exposes Live Tracking in the Super Admin navigation. This conflicts with the no-live-tracking rule.
2. `src/hooks/useRealtime.ts` subscribes Super Admins to `channel:super_admin`; the Live Tracking screen must not mount or open GPS channels for Super Admin.
3. Server-side role filtering is partly based on JWT claims and metadata/name matching. Portfolio authorization needs a database-backed scope service.
4. The Operations Admin empty-scope case must fail closed. It must not fall through to an unscoped `findMany` or in-memory global list.
5. The previous frontend role switcher contained embedded credentials and was removed; any future role/context switch must be server-authorized and audited.
6. Razorpay verification service exists, but browser Checkout, webhook processing, payment persistence, provider-event idempotency, and refund handling are not complete.
7. Booking currently stores payment fields, but payment lifecycle needs a first-class model/state machine before production.
8. The application has broad fallback behavior between PostgreSQL and in-memory state. Production business operations must fail closed instead of returning success from memory after database failure.
9. GPS must be active only during the relevant trip/service window. Driver assignment, booking status, stage, and tracking subscription must all be checked server-side.
10. The revised PDF requires notifications, audit records, refunds/cancellations, and settlement reversal rules; these are not yet fully validated.

# Target authorization model

## Capability matrix

| Capability | Customer | Driver | Manager | Operations Admin | Super Admin |
|---|---:|---:|---:|---:|---:|
| Own profile | RW | RW | RW | RW | RW |
| Own bookings | Read/create | Assigned only | Assigned Gosala | Portfolio | All |
| Create/release own hold | RW | No | No | Support only | Support only |
| View animal catalog | Serviceable only | Assigned Gosala | Assigned Gosala | Portfolio | All |
| Manage animals | No | No | Assigned Gosala | Portfolio | All |
| Manager booking decision | No | No | Assigned Gosala | Portfolio/acting scope | All |
| Admin final confirmation | No | No | No | Portfolio/acting scope | All |
| Assign drivers | No | No | No or assigned policy | Portfolio | All |
| GPS own/assigned trip | Own booking | Assigned trip | Assigned Gosala if needed | No by default | No by default |
| Pricing read | Checkout-safe fields | No | Operational read | Portfolio-safe read | All |
| Pricing write | No | No | No | No | Yes |
| Settlement read | Own payment status | No | Limited operational | Portfolio | All |
| Settlement write | No | No | No | No | Yes |
| User directory | No | No | No | Restricted | All |
| Audit log | Own relevant events | Own relevant events | Scope | Portfolio | All |

## Resource-scope policy

Implement one server policy module with functions equivalent to:

```ts
canReadGosala(user, gosalaId)
canReadBooking(user, booking)
canMutateBooking(user, booking, action)
canReadAnimal(user, animal)
canSubscribeTracking(user, booking)
canViewSettlement(user, settlement)
```

Every endpoint and WebSocket subscription must call the policy. No handler may infer authorization from request body values.

# Implementation phases

## Phase 1 — Scope and capability data model

Add/verify database-backed entities:

```text
AdminGosalaScope
UserSession / SessionVersion
Payment
PaymentEvent
SettlementBatchBooking
AuditEvent
```

Minimum scope fields:

```text
userId
gosalaId
scopeType: OPERATIONAL_ADMIN | MANAGER
active
createdBy
createdAt
revokedAt
```

Do not derive scope by matching admin names or metadata strings.

Acceptance criteria:

- An Operations Admin with zero assignments sees zero Gosalas.
- An admin with Gosala A assigned cannot read, mutate, or subscribe to Gosala B.
- Scope revocation takes effect on the next request.
- Super Admin can see all non-GPS resources.
- Operational context is explicit, time-limited, and audited.

## Phase 2 — Frontend role and navigation isolation

### Super Admin UI

- Remove Live Tracking from Super Admin navigation.
- Do not mount `LiveTracking` for Super Admin even through a direct hash URL.
- Do not call location/GPS APIs for Super Admin.
- Do not subscribe to booking/GPS channels from the Super Admin shell.
- Preserve financial, pricing, settlement, user, Gosala, animal, audit, and booking authority.

### Operations Admin UI

- Load only server-returned portfolio Gosalas.
- Remove local-storage-only scope decisions.
- Direct navigation to another Gosala must show `403`/not authorized.
- Empty portfolio must show an explicit empty state.
- Switching to the Super Admin context must reload server-authorized data rather than mutate only local role state.

### UI acceptance tests

```text
Super Admin login -> no Live Tracking nav item
Super Admin direct #super_admin/tracking -> access denied/no GPS request
Operations Admin login -> only assigned Gosalas shown
Operations Admin direct URL for unassigned Gosala -> denied
Super Admin acting operationally -> only acting portfolio shown
Return to Super Admin -> all non-GPS information shown
```

## Phase 3 — Booking and payment state machine

Use separate payment and booking states.

### Payment states

```text
CREATED
AUTHORIZED
CAPTURED
FAILED
REFUNDED
PARTIALLY_REFUNDED
```

### Booking states

```text
PENDING_PAYMENT
PAYMENT_VERIFIED
MANAGER_REVIEW
MANAGER_CONFIRMED
ADMIN_REVIEW
CONFIRMED
DRIVER_ASSIGNED
IN_SERVICE
COMPLETED
REJECTED
CANCELLED
```

Implement:

- Razorpay order creation from a server quote.
- Browser Checkout using only the returned test public key/order ID.
- Razorpay signature verification.
- Webhook signature verification.
- Provider event idempotency.
- Exact amount/currency/order/customer/quote/hold checks.
- Payment persistence before booking transition.
- Reconciliation if browser callback and webhook arrive in either order.
- Refund/cancellation handling.

Never accept `isPaid: true` or `status: PAYMENT_VERIFIED` as client authority.

## Phase 4 — Tracking isolation and performance safety

Tracking must be a capability, not a role-only UI assumption.

### Server rules

- A customer can track only their own booking while tracking is enabled.
- A driver can publish only for assigned active trips.
- A manager can read only relevant assigned Gosala trips if business policy permits.
- Operations Admin does not automatically receive live tracking.
- Super Admin does not receive live tracking by default.
- GPS channels open only for active trip stages and configured tracking windows.
- Tracking channels close after completion/cancellation/timeout.

### Performance tests

- Super Admin session creates zero GPS subscriptions.
- Operations Admin session creates zero GPS subscriptions unless an explicit feature flag allows it.
- Customer/driver tracking has bounded tick frequency and payload size.
- Repeated mount/unmount does not leak WebSocket handlers or intervals.
- 1, 10, 50, and 100 concurrent active trips stay within memory/CPU thresholds.
- GPS provider/API calls are cached, throttled, and cancelled when the view unmounts.
- Map updates do not execute for non-tracking roles.

## Phase 5 — Availability and transaction integrity

Required tests:

- Same animal/date/start/duration concurrent holds: exactly one succeeds.
- Overlapping duration 60/120 minutes blocks the complete interval.
- Non-overlapping slot after event plus configured buffer behaves correctly.
- Completed historical booking does not block future slots after end/buffer.
- Cancelled, failed, and expired bookings release availability according to policy.
- Expired/released/consumed holds cannot create bookings.
- Cross-customer hold release fails.
- Replayed booking request returns deterministic `409` or original booking.
- Database rollback leaves the hold and booking state consistent.
- Animal inactive/medical/resting status blocks booking.
- Maximum duration and operating hours are enforced server-side.

## Phase 6 — Manager/Admin workflow and audit

Test complete workflow:

```text
payment captured
→ manager queue
→ manager approve/reject
→ admin queue
→ admin confirm/reject
→ driver assignment
→ active trip
→ completion
→ settlement eligibility
```

For every approval/rejection verify:

```text
actor user ID
actor role
effective scope
timestamp
old state
new state
remark
request correlation ID
```

Negative tests:

- Manager for Gosala A cannot approve Gosala B.
- Operations Admin for portfolio A cannot confirm portfolio B.
- Super Admin can confirm across all Gosalas but cannot open GPS by default.
- Customer cannot approve, assign, advance, settle, or alter a booking.
- Driver cannot advance another driver's booking.
- A stale state transition returns `409`, not silent overwrite.

## Phase 7 — Settlement and refund safety

Settlement eligibility:

```text
booking COMPLETED
payment CAPTURED
not already settled
not refunded
approved operationally
```

Required tests:

- Empty sweep creates no settlement.
- Same booking cannot settle twice.
- Settlement references exact booking IDs.
- Historical commission and payout snapshots do not change after pricing edits.
- Failed payout becomes `FAILED`, not `PAID`.
- Provider timeout remains retryable.
- Refund updates payment and settlement eligibility correctly.
- A beneficiary change does not alter existing settlement snapshots.

# Automation strategy

## Layer 1 — Unit/property tests

Run on every change:

- JWT/role claims
- scope policy
- password hashing
- quote signing and expiry
- price calculation and rounding
- discount allocation
- interval overlap
- hold state transitions
- payment signature validation
- webhook idempotency
- settlement allocation
- tracking capability policy

## Layer 2 — API integration tests

Use a disposable PostgreSQL database and seeded test tenants:

```text
super-admin
operations-admin-A
operations-admin-B
manager-A
manager-B
driver-A
driver-B
customer-A
customer-B
gosala-A
gosala-B
animal-A1
animal-B1
```

Every test must clean its data or use an isolated schema/run ID.

## Layer 3 — Browser end-to-end tests

Use Playwright or an equivalent browser runner for:

- Customer booking UI
- Razorpay test checkout boundary
- Manager queue
- Admin portfolio view
- Super Admin governance view
- No-GPS Super Admin rule
- Direct URL tampering
- Logout/session expiry
- Responsive/mobile flow

## Layer 4 — WebSocket tests

- Unauthenticated upgrade rejected.
- Customer cannot subscribe to another booking.
- Driver cannot publish to an unassigned booking.
- Manager cannot subscribe to unrelated Gosala.
- Super Admin cannot subscribe to GPS under default policy.
- Valid active trip telemetry accepted.
- Invalid coordinates/stage/rate rejected.
- Completion closes tracking.

## Layer 5 — Performance and soak tests

Measure:

- API p50/p95/p99 latency.
- Database connection count.
- WebSocket connections and messages/second.
- Memory before/after map mount cycles.
- GPS provider calls/minute.
- CPU during 100 active trips.
- Error rate during concurrent holds and payment callbacks.

Suggested gates:

```text
No unauthorized data in any response
0 duplicate active holds under race test
0 duplicate paid bookings under replay/race test
0 GPS subscriptions for Super Admin default session
0 settlement marked PAID without provider confirmation
0 plaintext password/hash returned by API
No unbounded memory growth during 30-minute tracking soak
```

# Required test command set

Add scripts so testing is repeatable:

```json
{
  "test": "node --test scripts/**/*.test.mjs",
  "test:unit": "node --test scripts/test-password-security.mjs scripts/test-razorpay-security.mjs scripts/test-hold-booking-contracts.mjs",
  "test:api": "node scripts/qa-api-role-isolation.mjs",
  "test:payments": "node scripts/qa-payment-lifecycle.mjs",
  "test:tracking": "node scripts/qa-tracking-isolation.mjs",
  "test:concurrency": "node scripts/qa-concurrency.mjs",
  "test:e2e": "playwright test",
  "typecheck": "tsc --noEmit",
  "build": "vite build"
}
```

The test runner must redact:

- passwords
- JWTs
- Razorpay secrets
- customer Aadhaar/identity documents
- bank account data

# Release gates before P3

P3 development should not start until all of these are true:

1. The PDF workflow passes from customer selection through settlement in sandbox mode.
2. Super Admin sees all non-GPS data and zero GPS subscriptions by default.
3. Operations Admin sees only assigned/maintained Gosalas.
4. Super Admin operational context sees only its explicit portfolio.
5. Direct URL, query, body, and JWT tampering cannot cross scope boundaries.
6. Payment callback and webhook ordering is idempotent.
7. No booking becomes paid from a client-only success screen.
8. Hold, booking, payment, and settlement state transitions are atomic or compensating-safe.
9. Concurrent slot and payment tests pass repeatedly.
10. No database failure returns false business success.
11. Production build performs no destructive schema mutation.
12. Performance soak shows no tracking/map memory leak.

## Recommended execution order

```text
1. Build authoritative scope/capability policy
2. Remove Super Admin GPS navigation/subscriptions
3. Enforce Operations Admin portfolio isolation on every API/resource
4. Add explicit Super Admin operational context
5. Complete Razorpay Checkout + webhook + Payment model
6. Complete booking/payment/hold state machine
7. Complete manager/admin audit workflow tests
8. Add WebSocket resource authorization and tracking performance tests
9. Run disposable PostgreSQL API suite
10. Run browser E2E suite
11. Run concurrency and 30-minute tracking soak
12. Only then begin P3 feature development
```

## Final assessment

The application has a useful foundation, but it should not yet be described as fully payment-ready or role-isolated. The biggest remaining risks are authoritative portfolio scope, the Super Admin no-GPS rule, explicit operational context, browser/webhook payment completion, and test automation across the whole lifecycle. This plan makes those requirements executable and gives each one a measurable release gate.
