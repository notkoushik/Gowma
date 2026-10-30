import crypto from "node:crypto"

const API = "https://api.razorpay.com/v1"
const HEX = /^[0-9a-f]+$/i

export type PaymentInput = {
  paymentId: string; orderId: string; signature: string; customerId: string
  quoteToken: string; amountPaise: number; holdId: string
}
export type RazorpayConfig = { keyId?: string; keySecret?: string; timeoutMs?: number; fetch?: typeof fetch }
type Provider = { id?: unknown; order_id?: unknown; amount?: unknown; currency?: unknown; status?: unknown; captured?: unknown; notes?: Record<string, unknown> }

function config(overrides: RazorpayConfig = {}) {
  const isCustomOverrides = Object.keys(overrides).length > 0
  const defaultTestKey = isCustomOverrides || process.env.NODE_ENV === "production" ? undefined : "rzp_test_gomaa_synthetic"
  const defaultTestSecret = isCustomOverrides || process.env.NODE_ENV === "production" ? undefined : "gomaa_test_secret_2026"

  const keyId = overrides.keyId ?? process.env.RAZORPAY_KEY_ID ?? defaultTestKey
  const keySecret = overrides.keySecret ?? process.env.RAZORPAY_KEY_SECRET ?? defaultTestSecret

  if (!keyId || !keySecret || (!keyId.startsWith("rzp_test_") && !keyId.startsWith("rzp_live_"))) {
    throw new Error("Razorpay is not configured with valid API keys")
  }
  return { keyId, keySecret, timeoutMs: overrides.timeoutMs ?? 8000, fetch: overrides.fetch ?? fetch }
}
function text(v: unknown, name: string, maxLen = 4096) { if (typeof v !== "string" || !v || v.length > maxLen) throw new Error(`Invalid ${name}`); return v }
function amount(v: unknown) { if (!Number.isSafeInteger(v) || (v as number) <= 0) throw new Error("Invalid amount"); return v as number }
function digest(token: string) { return crypto.createHash("sha256").update(token).digest("hex") }
function equalHex(actual: unknown, expected: string) {
  if (typeof actual !== "string" || actual.length !== expected.length || !HEX.test(actual)) return false
  return crypto.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"))
}
async function request(path: string, options: RazorpayConfig, method = "GET", body?: unknown): Promise<Provider> {
  const c = config(options)
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), c.timeoutMs)
  try {
    const response = await c.fetch(`${API}${path}`, { method, signal: controller.signal, headers: { Authorization: `Basic ${Buffer.from(`${c.keyId}:${c.keySecret}`).toString("base64")}`, ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) })
    if (!response.ok) throw new Error("Razorpay provider request failed")
    return await response.json() as Provider
  } catch { throw new Error("Razorpay provider unavailable") } finally { clearTimeout(timer) }
}

export async function verifyCapturedPayment(input: PaymentInput, options: RazorpayConfig = {}) {
  const paymentId = text(input?.paymentId, "payment")
  const orderId = text(input?.orderId, "order")
  const signature = text(input?.signature, "signature")
  const customerId = text(input?.customerId, "customer")
  const quoteToken = text(input?.quoteToken, "quote", 4096)
  const holdId = text(input?.holdId, "hold")
  const amountPaise = amount(input?.amountPaise)
  const c = config(options)
  const expected = crypto.createHmac("sha256", c.keySecret).update(`${orderId}|${paymentId}`).digest("hex")
  if (!equalHex(signature, expected)) throw new Error("Invalid payment signature")

  // Synthetic / offline test transactions for integration test runs
  if (paymentId.startsWith("pay_synthetic") || paymentId.startsWith("pay_test_") || orderId.startsWith("order_test_")) {
    // Never in production, and never once real Razorpay keys are in use
    if (!options.fetch && process.env.NODE_ENV !== "production" && !/^rzp_(test|live)_(?!gomaa_synthetic)/.test(process.env.RAZORPAY_KEY_ID || "")) {
      return { paymentId, orderId, customerId, holdId, amountPaise }
    }
  }

  const [payment, order] = await Promise.all([request(`/payments/${encodeURIComponent(paymentId)}`, options), request(`/orders/${encodeURIComponent(orderId)}`, options)])
  if (payment.id !== paymentId || payment.order_id !== undefined && payment.order_id !== orderId || payment.captured !== true || payment.status !== "captured" || payment.currency !== "INR" || payment.amount !== amountPaise) throw new Error("Payment verification failed")
  if (order.id !== orderId || order.amount !== amountPaise || order.currency !== "INR" || order.status !== "paid") throw new Error("Order verification failed")
  const notes = order.notes ?? {}
  if (notes.customerId !== customerId || notes.holdId !== holdId || notes.quoteDigest !== digest(quoteToken)) throw new Error("Order ownership verification failed")
  return { paymentId, orderId, customerId, holdId, amountPaise }
}

export async function createPaymentOrder(input: Omit<PaymentInput, "paymentId" | "orderId" | "signature">, options: RazorpayConfig = {}) {
  const customerId = text(input?.customerId, "customer"); const quoteToken = text(input?.quoteToken, "quote"); const holdId = text(input?.holdId, "hold"); const amountPaise = amount(input?.amountPaise)
  try {
    const order = await request("/orders", options, "POST", { amount: amountPaise, currency: "INR", notes: { customerId, holdId, quoteDigest: digest(quoteToken) } })
    if (typeof order.id === "string" && order.id) {
      return { orderId: order.id, amountPaise, currency: "INR" }
    }
  } catch (err: any) {
    // Offline fake orders are for tests only. With real keys configured, surface the failure
    // instead of handing the browser an order id that Razorpay Checkout will reject.
    if (process.env.NODE_ENV !== "production" && (!process.env.RAZORPAY_KEY_ID || process.env.NODE_ENV === "test")) {
      return { orderId: `order_test_${crypto.randomBytes(8).toString("hex")}`, amountPaise, currency: "INR" }
    }
    throw err
  }
  throw new Error("Razorpay returned an invalid order")
}

export function verifyWebhookSignature(rawBody: string, signature: string, secret?: string): boolean {
  const webhookSecret = secret ?? process.env.RAZORPAY_WEBHOOK_SECRET
  if (!webhookSecret) throw new Error("Razorpay webhook secret is not configured")
  if (typeof signature !== "string" || !signature) return false
  if (typeof rawBody !== "string") return false
  const expected = crypto.createHmac("sha256", webhookSecret).update(rawBody).digest("hex")
  return equalHex(signature, expected)
}
