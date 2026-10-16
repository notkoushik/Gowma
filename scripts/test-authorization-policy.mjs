import test from "node:test"
import assert from "node:assert/strict"

import {
  canAccessAnimal,
  canAccessBooking,
  canAccessGosala,
  canPublishTelemetry,
  canSubscribeTracking,
  canUseLiveTracking,
  getAllowedGosalaIds,
} from "../server/auth/authorization.ts"

const user = (role, overrides = {}) => ({
  userId: `${role}-user`,
  name: role,
  email: `${role}@example.test`,
  role,
  dbRole: role === "super_admin" ? "SUPER_ADMIN" : role.toUpperCase(),
  gosalaIds: [],
  gosalaNames: [],
  ...overrides,
})

const gosala = { id: "G-1", name: "Gosala One" }
const otherGosala = { id: "G-2", name: "Gosala Two" }
const booking = {
  id: "B-1",
  gosalaId: gosala.id,
  customerId: "customer-1",
  driverId: "driver-1",
}
const otherBooking = {
  id: "B-2",
  gosalaId: otherGosala.id,
  customerId: "customer-2",
  driverId: "driver-2",
}
const animal = { id: "A-1", gosalaId: gosala.id }
const bookedAnimal = { id: "A-2", booking }

test("super_admin has global resource access but no tracking privileges", () => {
  const admin = user("super_admin", { gosalaIds: [], gosalaNames: [] })

  assert.equal(canAccessGosala(admin, otherGosala), true)
  assert.equal(canAccessBooking(admin, otherBooking), true)
  assert.equal(canAccessAnimal(admin, { ...animal, gosalaId: otherGosala.id }), true)
  assert.equal(canUseLiveTracking(admin), false)
  assert.equal(canSubscribeTracking(admin, booking), false)
  assert.equal(canPublishTelemetry(admin, booking), false)
})

test("admin is scoped by gosala IDs and names, while an empty scope denies", () => {
  const scoped = user("admin", { gosalaIds: [" G-1 "], gosalaNames: [" Gosala One "] })
  const empty = user("admin")

  assert.deepEqual(getAllowedGosalaIds(scoped), ["g-1", "gosala one"])
  assert.equal(canAccessGosala(scoped, gosala), true)
  assert.equal(canAccessBooking(scoped, booking), true)
  assert.equal(canAccessAnimal(scoped, animal), true)
  assert.equal(canAccessGosala(scoped, otherGosala), false)
  assert.equal(canAccessBooking(scoped, otherBooking), false)
  assert.equal(canAccessGosala(empty, gosala), false)
  assert.equal(canAccessBooking(empty, booking), false)
  assert.equal(canAccessAnimal(empty, animal), false)
})

test("manager follows the same scoped gosala policy", () => {
  const manager = user("manager", { gosalaIds: ["G-1"], gosalaNames: ["Gosala One"] })

  assert.equal(canAccessGosala(manager, { id: "unrelated", name: " Gosala One " }), true)
  assert.equal(canAccessBooking(manager, booking), true)
  assert.equal(canAccessAnimal(manager, animal), true)
  assert.equal(canAccessGosala(manager, otherGosala), false)
  assert.equal(canAccessBooking(manager, otherBooking), false)
})

test("customers can access only their own bookings and booked animals", () => {
  const customer = user("customer", { userId: " CUSTOMER-1 " })

  assert.equal(canAccessBooking(customer, booking), true)
  assert.equal(canAccessBooking(customer, { ...booking, customerId: "customer-2" }), false)
  assert.equal(canAccessBooking(customer, { ...booking, customerId: null }), false)
  assert.equal(canAccessAnimal(customer, bookedAnimal), true)
  assert.equal(canAccessAnimal(customer, animal), false)
  assert.equal(canSubscribeTracking(customer, booking), true)
  assert.equal(canPublishTelemetry(customer, booking), false)
})

test("drivers can access only assigned bookings and publish their telemetry", () => {
  const driver = user("driver", { userId: " DRIVER-1 " })

  assert.equal(canAccessBooking(driver, booking), true)
  assert.equal(canAccessBooking(driver, otherBooking), false)
  assert.equal(canAccessAnimal(driver, bookedAnimal), true)
  assert.equal(canSubscribeTracking(driver, booking), true)
  assert.equal(canPublishTelemetry(driver, booking), true)
  assert.equal(canPublishTelemetry(driver, { ...booking, driverId: "driver-2" }), false)
})

test("unknown roles are denied everywhere", () => {
  const unknown = user("auditor", { gosalaIds: ["G-1"] })

  assert.equal(canAccessGosala(unknown, gosala), false)
  assert.equal(canAccessBooking(unknown, booking), false)
  assert.equal(canAccessAnimal(unknown, animal), false)
  assert.equal(canUseLiveTracking(unknown), false)
  assert.equal(canSubscribeTracking(unknown, booking), false)
  assert.equal(canPublishTelemetry(unknown, booking), false)
})

test("resource matching normalizes IDs and names and prevents cross-tenant access", () => {
  const manager = user("manager", { gosalaIds: ["  G-1  "] })
  const nameScoped = user("admin", { gosalaNames: ["  GOSALA ONE  "] })

  assert.equal(canAccessGosala(manager, { id: " g-1 " }), true)
  assert.equal(canAccessBooking(nameScoped, { ...booking, gosalaId: null, name: " gosala one " }), true)
  assert.equal(canAccessGosala(manager, { id: "G-2", name: "Gosala Two" }), false)
  assert.equal(canAccessBooking(manager, otherBooking), false)
  assert.equal(canAccessAnimal(manager, { ...animal, gosalaId: "G-2" }), false)
})
