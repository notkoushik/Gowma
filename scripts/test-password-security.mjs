import test from "node:test"
import assert from "node:assert/strict"

import {
  hashPassword,
  isPasswordHash,
  verifyPassword,
} from "../server/auth/password.ts"

test("hashes include unique salts", () => {
  const first = hashPassword("correct horse battery staple")
  const second = hashPassword("correct horse battery staple")

  assert.notEqual(first, second)
  assert.equal(isPasswordHash(first), true)
  assert.equal(isPasswordHash(second), true)
  assert.notEqual(first.split("$")[1], second.split("$")[1])
})

test("correct passwords verify and wrong passwords do not", () => {
  const stored = hashPassword("correct horse battery staple")

  assert.equal(verifyPassword("correct horse battery staple", stored), true)
  assert.equal(verifyPassword("wrong horse battery staple", stored), false)
})

test("malformed hashes and plaintext are rejected", () => {
  const valid = hashPassword("correct horse battery staple")
  const [, salt, digest] = valid.split("$")
  const malformed = [
    "",
    "password",
    "scrypt$not-a-salt$not-a-digest",
    `scrypt$${salt}$${digest.slice(0, -2)}`,
    `scrypt$${salt}$${digest}00`,
    `bcrypt$${salt}$${digest}`,
  ]

  for (const value of malformed) {
    assert.equal(isPasswordHash(value), false, `expected rejection: ${value}`)
    assert.equal(verifyPassword("correct horse battery staple", value), false)
  }
})

test("passwords shorter than the minimum are rejected", () => {
  assert.throws(() => hashPassword("short"), /at least 8 characters/)
  assert.doesNotThrow(() => hashPassword("12345678"))
})

test("empty and non-string password input is rejected", () => {
  assert.throws(() => hashPassword(""), /at least 8 characters/)
  assert.throws(() => hashPassword(null), /at least 8 characters/)
  assert.throws(() => hashPassword(undefined), /at least 8 characters/)
})
