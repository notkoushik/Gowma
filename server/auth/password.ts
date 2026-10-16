import crypto from "node:crypto"

const KEY_LENGTH = 64

export function hashPassword(password: string): string {
  if (!password || password.length < 8) throw new Error("Password must be at least 8 characters")
  const salt = crypto.randomBytes(16).toString("hex")
  const derived = crypto.scryptSync(password, salt, KEY_LENGTH)
  return `scrypt$${salt}$${derived.toString("hex")}`
}

export function isPasswordHash(value: unknown): value is string {
  return typeof value === "string" && /^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(value)
}

export function verifyPassword(password: string, stored: string): boolean {
  if (!isPasswordHash(stored)) return false
  const [, salt, expectedHex] = stored.split("$")
  const actual = crypto.scryptSync(password, salt, KEY_LENGTH)
  const expected = Buffer.from(expectedHex, "hex")
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual)
}
