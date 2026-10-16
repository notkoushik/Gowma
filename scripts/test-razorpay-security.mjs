import test from "node:test"
import assert from "node:assert/strict"
import crypto from "node:crypto"
import { verifyCapturedPayment, createPaymentOrder, verifyWebhookSignature } from "../server/services/razorpayService.ts"

const keyId = "rzp_test_synthetic_key"
const keySecret = "synthetic_secret_only_for_tests"
const base = { paymentId: "pay_synthetic", orderId: "order_synthetic", customerId: "cust_1", quoteToken: "quote-token", amountPaise: 1250, holdId: "hold_1" }
const sig = (x = base) => crypto.createHmac("sha256", keySecret).update(`${x.orderId}|${x.paymentId}`).digest("hex")
function mock(payment = {}, order = {}) { return async (url) => ({ ok: true, async json() { return url.includes("payments") ? { id: base.paymentId, order_id: base.orderId, captured: true, status: "captured", currency: "INR", amount: 1250, ...payment } : { id: base.orderId, amount: 1250, currency: "INR", status: "paid", notes: { customerId: base.customerId, holdId: base.holdId, quoteDigest: crypto.createHash("sha256").update(base.quoteToken).digest("hex") }, ...order } } }) }
const opts = (fetch) => ({ keyId, keySecret, fetch })
test("captured payment verifies", async () => assert.deepEqual(await verifyCapturedPayment({ ...base, signature: sig() }, opts(mock())), { paymentId: base.paymentId, orderId: base.orderId, customerId: base.customerId, holdId: base.holdId, amountPaise: 1250 }))
for (const [name, payment, order] of [["bad signature", {}, {}], ["payment mismatch", { amount: 1 }, {}], ["not captured", { captured: false }, {}], ["order mismatch", {}, { status: "created" }], ["currency mismatch", {}, { currency: "USD" }], ["ownership mismatch", {}, { notes: {} }]]) test(name, async () => assert.rejects(() => verifyCapturedPayment({ ...base, signature: name === "bad signature" ? "00".repeat(32) : sig() }, opts(mock(payment, order)))))
test("missing configuration fails closed", async () => assert.rejects(() => verifyCapturedPayment({ ...base, signature: sig() }, { keySecret })))
test("provider failures are safe", async () => assert.rejects(() => verifyCapturedPayment({ ...base, signature: sig() }, opts(async () => ({ ok: false, json: async () => ({}) })))))
test("order creation sends canonical notes", async () => { const result = await createPaymentOrder(base, opts(async (_, request) => { assert.equal(request.method, "POST"); const body = JSON.parse(request.body); assert.equal(body.currency, "INR"); assert.equal(body.notes.customerId, base.customerId); return { ok: true, async json() { return { id: "order_new" } } } })); assert.equal(result.orderId, "order_new") })

test("valid webhook signature verifies", () => {
  const secret = "test_webhook_secret_key"
  const body = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_123" } } } })
  const validSig = crypto.createHmac("sha256", secret).update(body).digest("hex")
  assert.equal(verifyWebhookSignature(body, validSig, secret), true)
})

test("bad webhook signature is rejected", () => {
  const secret = "test_webhook_secret_key"
  const body = JSON.stringify({ event: "payment.captured" })
  const invalidSig = "00".repeat(32)
  assert.equal(verifyWebhookSignature(body, invalidSig, secret), false)
})

test("tampered webhook body is rejected", () => {
  const secret = "test_webhook_secret_key"
  const originalBody = JSON.stringify({ event: "payment.captured", amount: 1000 })
  const tamperedBody = JSON.stringify({ event: "payment.captured", amount: 100 })
  const originalSig = crypto.createHmac("sha256", secret).update(originalBody).digest("hex")
  assert.equal(verifyWebhookSignature(tamperedBody, originalSig, secret), false)
})

test("missing webhook secret fails closed", () => {
  const original = process.env.RAZORPAY_WEBHOOK_SECRET
  delete process.env.RAZORPAY_WEBHOOK_SECRET
  try {
    assert.throws(() => verifyWebhookSignature("{}", "sig"), /webhook secret is not configured/)
  } finally {
    if (original) process.env.RAZORPAY_WEBHOOK_SECRET = original
  }
})
