import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const router = readFileSync("server/router.ts", "utf8")
const schema = readFileSync("prisma/schema.prisma", "utf8")
const api = readFileSync("src/services/api.ts", "utf8")
const flow = readFileSync("src/views/customer/BookingFlow.tsx", "utf8")

test("hold schema records ownership and lifecycle", () => {
  assert.match(schema, /customerId\s+String\?/) 
  assert.match(schema, /status\s+String\s+@default\("ACTIVE"\)/)
  assert.match(schema, /consumedAt\s+DateTime\?/) 
  assert.match(schema, /releasedAt\s+DateTime\?/) 
})

test("hold creation binds authenticated identity and bounds TTL", () => {
  assert.match(router, /customerId:\s+authUser\?\.userId/)
  assert.match(router, /Math\.min\(600, Math\.max\(60/)
  assert.match(router, /status:\s+"ACTIVE"/)
  assert.match(router, /already held/)
})

test("hold release checks ownership and lifecycle instead of deleting blindly", () => {
  assert.match(router, /hold\.customerId !== authUser\?\.userId/)
  assert.match(router, /Hold belongs to another customer/)
  assert.match(router, /hold\.status !== "ACTIVE"/)
  assert.match(router, /status:\s+"RELEASED"/)
})

test("booking consumes the owned hold in the same Prisma transaction", () => {
  assert.match(router, /prisma\.\$transaction\(async \(tx\)/)
  assert.match(router, /ownedHold\.customerId !== authUser\.userId/)
  assert.match(router, /ownedHold\.status !== "ACTIVE"/)
  assert.match(router, /ownedHold\.expiresAt <= new Date\(\)/)
  assert.match(router, /status:\s+"CONSUMED"/)
  assert.match(router, /consumedAt:\s+new Date\(\)/)
  assert.match(router, /Booking could not be persisted; no booking was created/)
})

test("booking retries are deterministic conflicts, not server errors", () => {
  assert.match(router, /existingBooking = await prisma\.booking\.findUnique/) 
  assert.match(router, /Booking request was already processed/)
  assert.match(router, /Booking ID is already used by another customer/)
  assert.match(router, /message\.includes\("Unique constraint/) 
})

test("frontend uses one hold identifier and sends the quote with booking", () => {
  assert.match(api, /body: JSON\.stringify\(\{ holdId \}\)/)
  assert.match(flow, /setHoldId\(res\.hold\.id\)/)
  assert.match(flow, /quoteToken: backendPricing\?\.quoteToken/)
})
