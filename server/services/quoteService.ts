import crypto from "node:crypto"
import { JWT_SECRET } from "../auth/jwt.ts"

type QuotePayload = { customerId: string; values: Record<string, unknown>; exp: number }

function encode(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url")
}

export function issueQuote(customerId: string, values: Record<string, unknown>, ttlSeconds = 300) {
  const payload: QuotePayload = { customerId, values, exp: Math.floor(Date.now() / 1000) + ttlSeconds }
  const body = encode(payload)
  const signature = crypto.createHmac("sha256", JWT_SECRET).update(body).digest("base64url")
  return `${body}.${signature}`
}

export function verifyQuote(token: string, customerId: string): QuotePayload {
  const [body, signature] = String(token || "").split(".")
  if (!body || !signature) throw new Error("Invalid quote")
  const expected = crypto.createHmac("sha256", JWT_SECRET).update(body).digest("base64url")
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new Error("Invalid quote signature")
  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as QuotePayload
  if (payload.exp < Math.floor(Date.now() / 1000) || payload.customerId !== customerId) throw new Error("Quote expired or not owned by customer")
  return payload
}
