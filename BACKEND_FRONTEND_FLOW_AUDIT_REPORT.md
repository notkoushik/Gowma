# GOMAA Backend and Frontend Flow Audit

**Review date:** 10 Oct 2026  
**Scope:** React/Vite frontend, Node/Vercel API, Prisma schema, authentication, booking/availability/pricing/settlement logic, GPS/WebSocket flow, and mathematical calculations.  
**Review type:** Static code review with build/type validation. No application code was changed.

## Executive summary

The application has a clear high-level flow, but it is not safe to treat the current API as production-ready. The most urgent problem is authorization: JWTs are parsed, but many mutating and data-export endpoints do not require a valid JWT or verify that the token role is allowed to perform the operation. A browser can therefore call sensitive routes directly, and several routes trust a caller-supplied role or identity.

Authentication also has structural problems: passwords are stored and returned in plaintext, default credentials are committed to the repository, the JWT secret has a predictable fallback, inactive users can authenticate, and the browser stores the bearer token in `localStorage`. These issues combine into account takeover and privilege-escalation risk.

The financial model is internally understandable but has important reconciliation and settlement defects. Customer pricing is calculated by the API, yet booking creation accepts the client-supplied price breakdown and marks the booking paid without a payment-provider verification. Settlement sweeps can create a `PAID` record with a locally generated UTR without an external bank transaction, and can generate a nominal ₹45,000 payout when there are no eligible bookings.

## System flow reconstructed

1. **Frontend startup:** `src/store/store.tsx` loads cached local state and then concurrently calls many API endpoints, including bookings, pricing, users, profiles, and settlements. Errors are frequently converted to `null` and the UI continues with cached/in-memory state.
2. **Login:** `src/views/Login.tsx` sends credentials to `POST /api/auth/login`. `server/auth/authService.ts` resolves a Prisma user or auto-provisions known accounts, then signs a custom HS256 JWT. The frontend stores it in `localStorage` and routes using a hash such as `#manager/queue`.
3. **API request:** `src/services/api.ts` adds `Authorization: Bearer <token>`. `server/router.ts` parses the token once into `authUser`, but only some GET and workflow branches use it for filtering.
4. **Booking:** the frontend calculates a quote, checks availability, acquires a hold, simulates payment in the UI, and calls `POST /api/bookings`. The backend persists the submitted booking values, removes the hold, and broadcasts alerts.
5. **Operations:** manager/admin actions update booking state and audit trails; driver stage endpoints update GPS/service stages; handover OTP advances a booking to service.
6. **Settlement:** eligible bookings are grouped by Gaushala. The payout engine computes ritual share, transport share, add-on share, creates a settlement row, emits WebSocket alerts, and reports the batch as paid.
7. **Realtime:** unauthenticated WebSocket clients can subscribe to arbitrary channels and send `DRIVER_TELEMETRY` payloads to any channel. The frontend subscribes according to the local role state.

## Mathematical model

The primary quote formula in `server/services/pricingService.ts` and the inline API implementation is:

```text
extraMinutes = max(0, duration - standardMinutes)
extraUnits   = ceil(extraMinutes / extraUnitMinutes)
extraTime    = extraUnits * extraUnitRate

chargeableKm = max(0, round((distanceKm - freeKm) * 10) / 10)
transport    = round((chargeableKm * perKm) / 10) * 10

subtotal = max(0, base + extraTime + transport + addons - discount)
tax      = round(subtotal * taxPct / 100)
total    = subtotal + tax

sevaTotal     = base + extraTime
commission    = fixedCommission OR round(sevaTotal * commissionPct / 100)
gosalaPayable = max(0, sevaTotal - commission) + transport + addons
```

The intended reconciliation is:

```text
total = tax + commission + gosalaPayable
```

That identity is true only when there is no discount and when add-ons are treated as 100% pass-through. With a discount, the customer total is reduced but the commission and payout are not reduced. Example using the default configuration: base ₹3,500, discount ₹1,000, no tax, no transport. `total = ₹2,500`, while `commission + gosalaPayable = ₹3,500`; the system is off by ₹1,000. The repository’s monetary test suite does not include a non-zero discount scenario, so this defect can pass the current audit.

Settlement uses a second allocation formula:

```text
ritualShare       = ritualBaseTotal * (100 - commissionPct) / 100
transportShare    = transport * transportPassThroughPct / 100
samagriShare      = addons * samagriGaushalaCutPct / 100
bookingPayable    = ritualShare + transportShare + samagriShare
bookingCommission = (ritualBaseTotal - ritualShare) + (addons - samagriShare)
```

This deliberately differs from the quote formula for add-ons and means the displayed booking commission, settlement commission, and platform revenue are not necessarily the same ledger value. That needs an explicit accounting contract rather than separate formulas in different modules.

## Critical findings

### C-1 — Sensitive routes are callable without authentication or role enforcement

**Evidence:** `server/router.ts:485-547`, `:668-696`, `:904-1109`, `:1586-1633`, `:1635-1724`, `:2298-2545`, `:3328-3407`.

`authUser` is extracted at line 444, but routes such as `/api/users`, `/api/hold`, `/api/hold/release`, booking creation, stage updates, OTP verification, pricing updates, settlement approval/sweep/configuration, and profile updates do not consistently reject a missing token or enforce the required role. The pricing update checks `body.role` rather than the verified JWT role, and defaults a missing role to `SUPER_ADMIN`.

**Impact:** an unauthenticated or ordinary customer can potentially mutate pricing, approve/sweep settlements, change profiles, advance stages, verify handovers, or create operational records.

**Correction:** create centralized middleware such as `requireAuth()` and `requireRole()`. Never use `body.role`, `callerRole`, or client profile fields as authority. Enforce resource ownership/scope from database relationships in every handler.

### C-2 — Plaintext passwords and default credentials are exposed

**Evidence:** `server/auth/authService.ts:6-17`, `:119-120`, `:242-256`, `:357-431`; `server/data/users_meta.json`; `server/userMeta.ts:6-7`; `server/auth/authService.ts:584-621`.

Passwords are hard-coded, stored directly in Prisma and JSON metadata, compared with `===`, and returned by `getAllUsers()` as a `password` field. The repository includes multiple working credentials. Registration accepts a password and persists it without hashing.

**Impact:** repository/database/read access becomes immediate account compromise. Admin APIs also disclose credentials to any caller because `/api/users` is not protected.

**Correction:** rotate all exposed credentials immediately; remove them from source and metadata; use Argon2id or bcrypt hashes; never return password fields; enforce password policy and rate-limit login. Existing accounts require a migration/reset flow.

### C-3 — Predictable JWT fallback secret and browser token storage

**Evidence:** `server/auth/jwt.ts:3-5`, `src/services/api.ts:10-27`, `src/App.tsx:149-163`.

If `GOMAA_JWT_SECRET` is absent, a published constant is used. The token is stored in `localStorage`, where any XSS can read it. The application trusts the token payload for role and scope without a server-side user revalidation on most requests.

**Impact:** anyone who knows the fallback secret can forge a super-admin token. XSS or a malicious dependency can steal the seven-day bearer token.

**Correction:** fail startup when the secret is missing or too short; rotate it; use an established JWT library; prefer short-lived access tokens plus refresh tokens in secure, HttpOnly, SameSite cookies. Revalidate user activity/role server-side for privileged operations.

### C-4 — Inactive users are not rejected during login

**Evidence:** `server/auth/authService.ts:123-159`, `:174-187`, `:238-256`.

The user lookup does not require `isActive: true`, and the password validation path never checks `user.isActive`.

**Impact:** disabling an account in the user directory does not reliably revoke login access.

**Correction:** include `isActive: true` in login queries and reject inactive users. Add token revocation/versioning so already-issued tokens are invalidated after deactivation or role change.

### C-5 — Booking and payment values are client-authoritative

**Evidence:** `src/views/customer/BookingFlow.tsx:588-600`, `:639-668`; `server/router.ts:904-1048`.

The frontend only displays a nested timeout-based “payment verified” animation; no payment provider call or webhook verification occurs. `POST /api/bookings` accepts `base`, `extraTime`, `transport`, `tax`, `total`, `commissionPct`, and snapshots from the browser and persists them. It also sets `isPaid: true` unconditionally.

**Impact:** a caller can submit a ₹1 booking, alter commission/payout values, bypass payment, or create inconsistent ledger data.

**Correction:** create a server-side quote identified by a signed/opaque quote ID, recalculate from canonical animal/Gaushala/config records at booking time, and accept only provider webhook/payment intent IDs. Mark payment verified only after signature and amount/currency checks. Recheck the hold atomically inside the booking transaction.

### C-6 — Settlement sweep can fabricate paid money movement

**Evidence:** `server/router.ts:2478-2493`; `server/services/payoutEngine.ts:198-204`, `:258-307`.

The sweep endpoint has no visible authorization check. `generateRbiUtr()` creates a random-looking reference locally, then the engine persists a `PAID` batch and broadcasts “successfully disbursed” without calling a bank/payment provider. If no eligible bookings exist, it creates a nominal ₹45,000 batch with six sevas.

**Impact:** unauthorized or repeated requests can create false paid settlements and misleading UTR records; accounting and beneficiary notifications can claim money was sent when it was not.

**Correction:** remove nominal fallback from production; require eligible immutable booking IDs; use a real payout provider adapter; persist `PENDING` before submission, use an idempotency key derived from the batch contents, mark `PAID` only from verified provider status, and reconcile provider webhooks.

## High-priority findings

### H-1 — WebSocket has no authentication or channel authorization

**Evidence:** `server/ws/server.ts:8-19`, `server/ws/hub.ts:52-73`, `:114-132`.

Any WebSocket client can subscribe to arbitrary role, booking, admin, or Gaushala channels. Any client can send `DRIVER_TELEMETRY` to a chosen channel. The server does not inspect an Authorization token during upgrade or bind a connection to permitted channels.

**Impact:** private booking/GPS/role alerts can be read or spoofed.

**Correction:** authenticate during upgrade, authorize each subscription against JWT scope, whitelist channel patterns, and accept telemetry only from the assigned driver for the booking. Validate payload ranges and rate-limit messages.

### H-2 — Hold ownership and overlap are not enforced consistently

**Evidence:** `server/router.ts:668-696`, `src/views/customer/BookingFlow.tsx:501-539`, `server/services/holdService.ts:22-61`.

The active API route writes directly to Prisma and does not associate `customerId` with a hold. Release deletes by `holdId` without checking ownership. The route’s hold check is not an atomic transaction with booking creation. The frontend reads `res.hold.id`, while the in-memory service creates `holdId`, indicating two incompatible hold contracts.

**Impact:** a user can release another user’s hold; concurrent requests can both pass availability and create overlapping bookings; some hold responses may fail to release correctly.

**Correction:** use one hold service and one DTO (`id` or `holdId`, not both), require authenticated customer ownership, and perform hold validation/deletion plus booking creation in a transaction with a database uniqueness/overlap strategy.

### H-3 — Availability rules differ between frontend, in-memory service, and API

**Evidence:** `server/services/availabilityService.ts:67-119`; `server/router.ts:569-665`; `src/views/customer/BookingFlow.tsx:450-479`.

The in-memory service applies daily welfare ceilings and a 90-minute post-trip cooldown, while the Prisma API path checks bookings, a configurable buffer, and manual blocks but does not apply the same daily ceiling or 90-minute invariant. Frontend behavior can therefore disagree with the server.

**Impact:** a slot shown as available may be rejected later, or an operational welfare limit may be bypassed through the API.

**Correction:** centralize availability in one server-side implementation and make the frontend display only server-certified results. Store animal-specific ceiling/cooldown values in the database instead of identifying animals by names such as “kesari”.

### H-4 — Customer data filtering contains an email/phone field mismatch

**Evidence:** `server/router.ts:854-860`.

The customer email is compared against `customerPhone`. This is likely a copy/paste defect. Fallback filtering only checks name and phone, so identity matching is inconsistent across database and fallback modes.

**Impact:** customers may see missing bookings or, when names/phones collide, potentially receive another customer’s data.

**Correction:** filter by `customerId` as the authoritative key; use email only against an email field and remove name-based identity fallback for authenticated access.

### H-5 — Booking fallback hides database failures and returns success

**Evidence:** `server/router.ts:990-1109`; `src/store/store.tsx:1275-1299`.

On any Prisma error, booking creation falls back to in-memory state and returns HTTP 201. The frontend shows a success notification immediately before the API result is known and does not surface failure to the user.

**Impact:** a booking can appear confirmed in one process/browser while never reaching PostgreSQL; production restarts lose it.

**Correction:** return 5xx for persistence failure, use an explicit offline/demo mode, and show success only after the server returns a durable booking/payment state.

### H-6 — Profiles and rich metadata are mutable through unsafe endpoints

**Evidence:** `server/router.ts:3328-3407`, `server/userMeta.ts:104-129`.

Profile routes accept arbitrary role keys and merge arbitrary body fields into server profiles, including bank details and settlement schedule. They also write JSON files from request-driven code. There is no verified-user ownership or admin authorization in the shown handler.

**Impact:** profile spoofing, bank-detail tampering, sensitive-data disclosure, race conditions, and serverless filesystem inconsistency.

**Correction:** use typed allowlists and database-backed fields; separate self-service profile updates from admin-only bank/role fields; authorize by `authUser.userId`; never use local JSON as the source of truth in deployed serverless environments.

### H-7 — Build deployment mutates the production database with data-loss permission

**Evidence:** `package.json:8`, `scripts/db-deploy.js:11-21`.

`npm run build` executes `prisma db push --accept-data-loss` against any non-local `DATABASE_URL` and then seeds baseline accounts. This makes a normal build a schema/data mutation and can erase incompatible production data.

**Correction:** use reviewed Prisma migrations in deployment; never pass `--accept-data-loss` in production; separate schema migration, seed, and frontend build steps; fail rather than silently continuing after migration/seeding errors.

## Medium-priority findings and maintainability risks

- **Role switching embeds credentials in the browser:** `src/App.tsx:376-401` contains super-admin/admin and other passwords. Remove quick-switch login or replace it with a server-authorized impersonation flow with audit logs.
- **Fallback pricing distance differs:** `src/services/routing.ts:37-39` uses a 1.42 road factor, while `server/routingService.ts:67-76` falls back to a fixed 6.5 km. Pricing should use one authoritative distance source.
- **GPS simulation ignores the booking destination:** `server/ws/gpsSimulator.ts` derives a synthetic endpoint from the Gaushala and does not use `destinationAddress`; displayed tracking can be materially wrong.
- **JWT payload carries sensitive profile data:** customer Aadhaar and driver/license-related metadata are placed in the signed token (`server/auth/authService.ts:321-333`, `server/auth/jwt.ts:35-50`). JWTs are readable by the bearer; do not put sensitive data in them.
- **OTP security is bypassable:** `server/router.ts:1659-1661` accepts universal OTP `1234`, and the schema default is `4819`. Remove backdoors, hash OTPs, expire them, rate-limit attempts, and authorize the driver/customer involved.
- **Audit trail actor identity is caller/body-derived in places:** examples around `server/router.ts:1125-1146` and `:1280`. Derive actor ID/role from the verified token and enforce allowed state transitions.
- **State-machine integrity is incomplete:** `set-stage` accepts arbitrary numeric stages and does not enforce OTP before jumping to stage 6/9. Validate monotonic transitions and role-specific transitions server-side.
- **Sensitive information is sent to the frontend:** `getAllUsers()` returns credentials and profile data; `/api/profiles` returns all role profiles. Apply response DTOs and least privilege.
- **Large client bundle:** the direct Vite build succeeds but reports a ~1.98 MB minified JS asset. Code-split admin/customer/driver areas with dynamic imports after security issues are addressed.

## Recommended remediation order

### P0 — Before exposing the API

1. Disable or protect every route except health/login/register as explicitly intended.
2. Rotate all repository/database credentials and remove plaintext password responses and files.
3. Replace the JWT fallback secret and invalidate existing tokens.
4. Remove universal OTP and client-side role switching credentials.
5. Disable settlement sweep and profile/bank mutation until authenticated, role-checked workflows exist.
6. Stop accepting client totals/payment status; make booking creation server-authoritative.

### P1 — Correct transactional integrity

1. Implement a central authorization/resource-scope layer.
2. Implement quote IDs, payment webhook verification, and transactional hold-to-booking conversion.
3. Add immutable booking price snapshots and a single accounting allocation function used by quote, booking, and settlement.
4. Use provider-backed payout states and idempotency; remove synthetic payouts and UTRs.
5. Unify Prisma and in-memory/offline behavior or isolate demo mode from production.

### P2 — Quality and operations

1. Add integration tests for every role × endpoint and unauthenticated access.
2. Add property tests for pricing reconciliation, discounts, fixed commissions, tax treatments, and settlement allocation.
3. Add concurrency tests for two customers claiming the same animal slot.
4. Add WebSocket authentication/channel tests and state-machine transition tests.
5. Replace build-time `db push --accept-data-loss` with migrations and deployment checks.
6. Add structured audit logs, error monitoring, rate limits, and secret scanning in CI.

## Suggested acceptance tests

- Anonymous `GET /api/bookings`, `GET /api/users`, `PUT /api/pricing-config`, `POST /api/settlements/sweep`, and `PUT /api/profiles/super_admin` return 401/403.
- A customer token cannot read another customer’s booking or release another customer’s hold.
- A manager cannot mutate a booking outside assigned Gaushalas.
- A forged body `role: "super_admin"` does not elevate a customer token.
- Inactive users cannot log in; changing a role/deactivating a user invalidates old privileged tokens.
- A booking with altered client `total`, `commission`, or `isPaid` is rejected or recalculated.
- Duplicate/concurrent booking attempts for one slot produce exactly one success.
- Discounted quotes reconcile under the chosen accounting policy.
- A sweep with no eligible bookings creates no paid batch.
- A settlement is not `PAID` until a provider-confirmed transaction exists.
- WebSocket clients cannot subscribe to channels outside their role/resource scope.

## Checks performed

- `tsc --noEmit` — passed with no diagnostics.
- `vite build` — passed. Warnings: native config-loader compatibility notices and a large minified chunk (~1.98 MB).
- Static inspection of the relevant frontend, API, auth, Prisma, pricing, availability, payout, WebSocket, and deployment files.
- The repository contains `scripts/verify_monetary_math.ts`, but it was not executed because the package does not provide a configured TypeScript runtime script. Its current assertions also omit non-zero discount reconciliation.

## Overall assessment

The UI flow and domain vocabulary are fairly coherent, and the pricing formulas are documented in code and partially tested. However, the current backend boundary is not secure: authentication is present as a token format, not consistently enforced as authorization. Financial and booking state is also not authoritative because the browser can supply core monetary/payment fields and settlement code can synthesize paid outcomes. Remediation should begin with access control, credential hygiene, server-authoritative booking/payment logic, and real settlement state transitions before further feature or visual work.
