// End-to-end test of the commission wallet through the real API handler:
// customer pays -> escrow -> T+2 -> Super Admin approves -> admin/manager wallets -> withdrawal.
//
// Writes real rows, so it only runs against a throwaway schema:
//   DATABASE_URL="postgres://...?sslmode=require&schema=wallet_test" \
//   RESEND_API_KEY= GMAIL_APP_PASSWORD= GMAIL_USER= FAST2SMS_API_KEY= \
//   node --experimental-transform-types --no-warnings scripts/test-wallet-e2e.mjs
import assert from "node:assert/strict"
import crypto from "node:crypto"

const url = process.env.DATABASE_URL || ""
if (!/[?&]schema=[a-z0-9_]*test[a-z0-9_]*(&|$)/i.test(url)) {
  console.error("Refusing to run: DATABASE_URL must include schema=<name containing 'test'>")
  process.exit(2)
}
process.env.NODE_ENV = "test"

// Prisma auto-loads .env, so blank every real provider first: a test must never text, email or pay a real person.
// (Set before the server modules load; dotenv does not override variables that already exist.)
for (const k of [
  "MSG91_AUTH_KEY", "MSG91_WHATSAPP_NAMESPACE", "MSG91_EMAIL_TEMPLATE_ID", "FAST2SMS_API_KEY",
  "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER", "RESEND_API_KEY", "GMAIL_USER", "GMAIL_APP_PASSWORD",
  "RAZORPAYX_KEY_ID", "RAZORPAYX_KEY_SECRET", "RAZORPAYX_ACCOUNT_NUMBER",
]) process.env[k] = ""
// The Razorpay test path signs with the built-in fake keys, never the real test keys from .env
process.env.RAZORPAY_KEY_ID = "rzp_test_gomaa_synthetic"
process.env.RAZORPAY_KEY_SECRET = "gomaa_test_secret_2026"
process.env.GOMAA_PAYOUT_PROVIDER_ENABLED = "false"
process.env.GOMAA_PAYOUT_MODE = "sandbox"

const { prisma } = await import("../server/prisma.ts")
const { handleApiRequest } = await import("../server/router.ts")
const { hashPassword } = await import("../server/auth/password.ts")
const { hashOtp } = await import("../server/services/otpService.ts")
const notify = await import("../server/services/notifyService.ts")

// Capture every email and SMS the wallet would send instead of sending them.
process.env.MSG91_TEMPLATE_EARNINGS = "tmpl_earnings"
process.env.MSG91_TEMPLATE_WITHDRAWAL_PAID = "tmpl_paid"
process.env.MSG91_TEMPLATE_WITHDRAWAL_FAILED = "tmpl_failed"
process.env.MSG91_TEMPLATE_PAYOUT_ACCOUNT = "tmpl_account"
const sentEmails = []
const sentSms = []
notify.__setTransports({
  email: async (m) => {
    sentEmails.push(m)
    return { success: true }
  },
  sms: async (m) => {
    sentSms.push(m)
    return { success: true }
  },
})

let passed = 0
const failed = []
async function step(name, fn) {
  try {
    await fn()
    passed++
    console.log(`  ok   ${name}`)
  } catch (e) {
    failed.push(name)
    console.log(`  FAIL ${name}\n       ${String(e?.message || e).split("\n").slice(0, 4).join("\n       ")}`)
  }
}
const api = async (method, path, body, token) => {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (body) headers["Content-Type"] = "application/json"
  return handleApiRequest(method, path, body ? JSON.stringify(body) : "", headers)
}
const money = (r) => Math.round(Number(r) * 100) / 100
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ------------------------------------------------------------------ fixtures
const tag = Date.now().toString(36)
const PASS = "E2eTest@2026!"
const pwHash = await hashPassword(PASS)
const mk = (role, name) =>
  prisma.user.create({ data: { email: `e2e-${name}-${tag}@example.invalid`, name: `E2E ${name}`, phone: "+91 90000 00000", role, password: pwHash } })

await prisma.masterPricingConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } })
const sa = await mk("SUPER_ADMIN", "sa")
const admin = await mk("OPERATIONS_ADMIN", "admin")
const mgr = await mk("GOSALA_MANAGER", "mgr")
const cust = await mk("CUSTOMER", "cust")
const GOSALA = `E2E Gaushala ${tag}`
const ANIMAL = `E2E Cow ${tag}`
const gosala = await prisma.gosala.create({ data: { name: GOSALA, region: "Test", address: "x", contactPhone: "1", contactEmail: "t@example.invalid", adminId: admin.id } })
await prisma.gosalaManagerAssignment.create({ data: { userId: mgr.id, gosalaId: gosala.id, region: "Test" } })
await prisma.animal.create({ data: { gosalaId: gosala.id, name: ANIMAL, type: "COW" } })

const login = async (path, email, extra = {}) => {
  const r = await api("POST", path, { email, password: PASS, ...extra })
  assert.equal(r.status, 200, `login ${email}: ${JSON.stringify(r.body).slice(0, 150)}`)
  return r.body.token
}

console.log("\nLogin")
let tSA, tAdmin, tMgr, tCust
await step("all four roles can log in", async () => {
  tSA = await login("/api/auth/admin-login", sa.email)
  tAdmin = await login("/api/auth/admin-login", admin.email)
  tMgr = await login("/api/auth/login", mgr.email, { roleHint: "manager" })
  tCust = await login("/api/auth/login", cust.email, { roleHint: "customer" })
})

console.log("\nWho can see what")
await step("customer cannot open the treasury, admin cannot approve, manager has no split-policy view", async () => {
  assert.equal((await api("GET", "/api/superadmin/wallet", null, tCust)).status, 403)
  assert.equal((await api("POST", "/api/superadmin/settlements/approve", { ids: ["x"] }, tAdmin)).status, 403)
  assert.equal((await api("GET", "/api/split-policy", null, tMgr)).status, 403)
  assert.equal((await api("GET", "/api/wallet/me", null, tCust)).status, 403)
  assert.equal((await api("GET", "/api/wallet/me")).status, 401)
})

console.log("\nCustomer pays ₹ by wallet and by Razorpay (test payment)")
const secret = process.env.RAZORPAY_KEY_SECRET || "gomaa_test_secret_2026"
let walletBooking, rzpBooking
async function book(provider, day) {
  const quote = await api("POST", "/api/pricing/calculate", { baseRate: 3500, durationMin: 60, distanceKm: 5, addonsCost: 0, animal: ANIMAL, gosala: GOSALA }, tCust)
  assert.equal(quote.status, 200, "quote " + JSON.stringify(quote.body).slice(0, 150))
  const date = `${day} Dec 2031`
  const hold = await api("POST", "/api/hold", { animal: ANIMAL, date, start: "10:00", durationMin: 60, customerName: cust.name }, tCust)
  assert.equal(hold.status, 200, "hold " + JSON.stringify(hold.body).slice(0, 150))
  const q = quote.body
  const id = `GMA-E${tag.slice(-5)}${day}`.toUpperCase()
  const booking = { id, customer: cust.name, date, start: "10:00", end: "11:00", durationMin: 60, distanceKm: 5, total: q.total, base: q.base, tax: q.tax, transport: q.transport, extraTime: q.extraTime, addons: q.addons, discount: 0, commissionPct: q.commissionPct, commissionSnapshot: q.commission, freeKmSnapshot: q.freeKmSnapshot, perKmSnapshot: q.perKmSnapshot, extraUnitRateSnapshot: q.extraUnitRateSnapshot, animal: ANIMAL, gosala: GOSALA }
  let payload = { quoteToken: q.quoteToken, holdId: hold.body.hold.id, booking }
  if (provider === "WALLET") {
    payload.paymentProvider = "WALLET"
  } else {
    const orderId = `order_test_${tag}${day}`
    const paymentId = `pay_test_${tag}${day}`
    payload.payment = { paymentId, orderId, signature: crypto.createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex"), amountPaise: Math.round(Number(q.total) * 100) }
  }
  const res = await api("POST", "/api/bookings", payload, tCust)
  assert.equal(res.status, 201, "booking " + JSON.stringify(res.body).slice(0, 200))
  return { id, total: Number(q.total), tax: Number(q.tax) }
}

let t0
await step("customer tops up ₹10,000 (test payment) and pays a booking from the wallet", async () => {
  t0 = (await api("GET", "/api/superadmin/wallet", null, tSA)).body
  const order = await api("POST", "/api/wallet/topup/order", { amountRupees: 10000 }, tCust)
  assert.equal(order.status, 201)
  const paymentId = `pay_test_topup_${tag}`
  const signature = crypto.createHmac("sha256", secret).update(`${order.body.orderId}|${paymentId}`).digest("hex")
  const v = await api("POST", "/api/wallet/topup/verify", { paymentId, orderId: order.body.orderId, signature, amountPaise: 1000000 }, tCust)
  assert.equal(v.status, 200)
  walletBooking = await book("WALLET", "11")
  const bal = await api("GET", "/api/wallet/balance", null, tCust)
  assert.equal(money(bal.body.balanceRupees), money(10000 - walletBooking.total))
})
await step("customer pays a second booking through the Razorpay test path", async () => {
  rzpBooking = await book("RAZORPAY", "12")
})

console.log("\nEscrow")
await step("both payments are held in escrow, and nothing is paid out yet", async () => {
  const t = await api("GET", "/api/superadmin/wallet", null, tSA)
  assert.equal(t.status, 200)
  const added = money(t.body.escrowRupees - t0.escrowRupees)
  const expected = money(walletBooking.total + rzpBooking.total)
  assert.equal(added, expected, `escrow grew by ${added}, expected ${expected}`)
  assert.equal(t.body.platformRupees, t0.platformRupees, "platform unchanged until approval")
  assert.equal(t.body.taxRupees, t0.taxRupees, "tax unchanged until approval")
  const a = await api("GET", "/api/wallet/me", null, tAdmin)
  const m = await api("GET", "/api/wallet/me", null, tMgr)
  assert.equal(a.body.availableRupees, 0)
  assert.equal(m.body.availableRupees, 0)
  assert.ok(a.body.comingRupees > 0 && m.body.comingRupees > 0, "admin and manager both see money coming")
})
await step("approving before T+2 is refused with the date", async () => {
  const list = await api("GET", "/api/superadmin/settlements", null, tSA)
  const row = list.body.settlements.find((s) => s.bookingId === walletBooking.id)
  assert.equal(row.status, "HELD")
  const r = await api("POST", "/api/superadmin/settlements/approve", { ids: [row.id] }, tSA)
  assert.equal(r.status, 409)
  assert.match(r.body.failed[0].error, /Not ready yet/)
})

console.log("\nT+2 passes, Super Admin approves")
await step("after 2 days the booking appears under 'ready to approve'", async () => {
  await prisma.bookingSettlement.updateMany({ where: { bookingId: { in: [walletBooking.id, rzpBooking.id] } }, data: { paidAt: new Date(Date.now() - 3 * 86400000), eligibleAt: new Date(Date.now() - 86400000) } })
  const list = await api("GET", "/api/superadmin/settlements?status=READY_FOR_APPROVAL", null, tSA)
  const ids = list.body.settlements.map((s) => s.bookingId)
  assert.ok(ids.includes(walletBooking.id) && ids.includes(rzpBooking.id), ids.join(","))
})
let before
await step("approving the wallet-paid booking splits it: tax / 10% platform / 30% manager / 60% admin", async () => {
  const list = await api("GET", "/api/superadmin/settlements?status=READY_FOR_APPROVAL", null, tSA)
  const row = list.body.settlements.find((s) => s.bookingId === walletBooking.id)
  const net = walletBooking.total - walletBooking.tax
  const mgrShare = Math.floor(net * 0.3), admShare = Math.floor(net * 0.6)
  assert.equal(money(row.taxRupees), walletBooking.tax)
  assert.equal(money(row.managerRupees), mgrShare)
  assert.equal(money(row.adminRupees), admShare)
  assert.equal(money(row.platformRupees), money(net - mgrShare - admShare))
  before = await api("GET", "/api/superadmin/wallet", null, tSA)
  const r = await api("POST", "/api/superadmin/settlements/approve", { ids: [row.id] }, tSA)
  assert.equal(r.status, 200, JSON.stringify(r.body))
  assert.equal(r.body.released.length, 1)
  const after = await api("GET", "/api/superadmin/wallet", null, tSA)
  assert.equal(money(after.body.escrowRupees), money(before.body.escrowRupees - walletBooking.total))
  assert.equal(money(after.body.taxRupees - before.body.taxRupees), walletBooking.tax)
  assert.equal(money(after.body.platformRupees - before.body.platformRupees), money(net - mgrShare - admShare))
  const a = await api("GET", "/api/wallet/me", null, tAdmin)
  const m = await api("GET", "/api/wallet/me", null, tMgr)
  assert.equal(money(a.body.availableRupees), admShare)
  assert.equal(money(m.body.availableRupees), mgrShare)
  assert.equal(a.body.transactions[0].purpose, "SETTLEMENT_RELEASE")
})
await step("approving the same booking again does not pay twice", async () => {
  const list = await api("GET", "/api/superadmin/settlements?status=RELEASED", null, tSA)
  const row = list.body.settlements.find((s) => s.bookingId === walletBooking.id)
  const m1 = (await api("GET", "/api/wallet/me", null, tMgr)).body.availableRupees
  await api("POST", "/api/superadmin/settlements/approve", { ids: [row.id] }, tSA)
  assert.equal((await api("GET", "/api/wallet/me", null, tMgr)).body.availableRupees, m1)
})

console.log("\nManager share change needs Super Admin approval")
await step("admin proposes 40%, nothing changes until approved, then new bookings use it", async () => {
  const req = await api("POST", "/api/split-policy/requests", { gosalaId: gosala.id, managerPct: 40, reason: "Extra duties" }, tAdmin)
  assert.equal(req.status, 201, JSON.stringify(req.body))
  let pol = await api("GET", "/api/split-policy", null, tAdmin)
  assert.equal(pol.body.policies.find((p) => p.gosalaId === gosala.id).managerPct, 30)
  const reqs = await api("GET", "/api/split-policy", null, tSA)
  const pending = reqs.body.requests.find((r) => r.status === "PENDING")
  assert.ok(pending, "Super Admin sees the pending request")
  assert.equal((await api("POST", `/api/superadmin/split-requests/${pending.id}/decide`, { approve: true }, tAdmin)).status, 403)
  assert.equal((await api("POST", `/api/superadmin/split-requests/${pending.id}/decide`, { approve: true, note: "ok" }, tSA)).status, 200)
  pol = await api("GET", "/api/split-policy", null, tAdmin)
  const p = pol.body.policies.find((p) => p.gosalaId === gosala.id)
  assert.deepEqual([p.managerPct, p.adminPct], [40, 50])
  const old = await prisma.bookingSettlement.findUniqueOrThrow({ where: { bookingId: rzpBooking.id } })
  assert.equal(old.managerBp, 3000, "the earlier booking keeps its 30%")
})
await step("admin cannot propose a percentage for a gaushala that is not theirs, or above the room left", async () => {
  assert.equal((await api("POST", "/api/split-policy/requests", { gosalaId: "not-mine", managerPct: 20 }, tAdmin)).status, 403)
  assert.equal((await api("POST", "/api/split-policy/requests", { gosalaId: gosala.id, managerPct: 95 }, tAdmin)).status, 400)
})

console.log("\nManager withdraws")
let acct
await step("manager saves a UPI id and a bank account", async () => {
  const bad = await api("POST", "/api/payout-accounts", { type: "UPI", holderName: "E2E Mgr", vpa: "bad" }, tMgr)
  assert.equal(bad.status, 400)
  const up = await api("POST", "/api/payout-accounts", { type: "UPI", holderName: "E2E Mgr", vpa: "e2emgr@okhdfc" }, tMgr)
  assert.equal(up.status, 201)
  acct = up.body.account
  const bank = await api("POST", "/api/payout-accounts", { type: "BANK", holderName: "E2E Mgr", accountNumber: "123456789012", ifsc: "HDFC0001234" }, tMgr)
  assert.equal(bank.status, 201)
  assert.ok(!JSON.stringify(bank.body).includes("123456789012"), "full account number is never returned")
})
const withdrawRupees = 500
async function withdraw(amount, key, otp = "424242") {
  const r = await api("POST", "/api/withdrawals/otp", { amountRupees: amount, payoutAccountId: acct.id }, tMgr)
  if (r.status !== 200) return r
  const row = await prisma.withdrawalOtp.findFirstOrThrow({ where: { userId: mgr.id, used: false }, orderBy: { createdAt: "desc" } })
  await prisma.withdrawalOtp.update({ where: { id: row.id }, data: { otpHash: hashOtp("424242") } })
  return api("POST", "/api/withdrawals", { amountRupees: amount, payoutAccountId: acct.id, otp, idempotencyKey: key }, tMgr)
}
await step("a wrong code is refused", async () => {
  const r = await withdraw(withdrawRupees, `k-${tag}-bad`, "000000")
  assert.equal(r.status, 400)
})
await step(`withdrawing ₹${withdrawRupees} pays out (sandbox) and lowers the balance`, async () => {
  const b0 = (await api("GET", "/api/wallet/me", null, tMgr)).body.availableRupees
  const r = await withdraw(withdrawRupees, `k-${tag}-1`)
  assert.equal(r.status, 201, JSON.stringify(r.body))
  assert.equal(r.body.withdrawal.status, "PAID")
  assert.match(r.body.withdrawal.utr, /^SANDBOX-/)
  const me = (await api("GET", "/api/wallet/me", null, tMgr)).body
  assert.equal(money(me.availableRupees), money(b0 - withdrawRupees))
  assert.equal(me.withdrawals[0].amountRupees, withdrawRupees)
  assert.equal(me.payoutMode, "SANDBOX")
})
await step("sending the same withdrawal twice pays once", async () => {
  const b0 = (await api("GET", "/api/wallet/me", null, tMgr)).body.availableRupees
  const r = await api("POST", "/api/withdrawals", { amountRupees: withdrawRupees, payoutAccountId: acct.id, otp: "424242", idempotencyKey: `k-${tag}-1` }, tMgr)
  assert.equal(r.status, 200)
  assert.equal(r.body.replay, true)
  assert.equal((await api("GET", "/api/wallet/me", null, tMgr)).body.availableRupees, b0)
})
await step("cannot withdraw more than the balance", async () => {
  const r = await api("POST", "/api/withdrawals/otp", { amountRupees: 9999999, payoutAccountId: acct.id }, tMgr)
  assert.equal(r.status, 402)
})

console.log("\nRefund path and books")
await step("Super Admin can refund the unreleased Razorpay booking back to the customer's wallet", async () => {
  const list = await api("GET", "/api/superadmin/settlements?status=READY_FOR_APPROVAL", null, tSA)
  const row = list.body.settlements.find((s) => s.bookingId === rzpBooking.id)
  assert.equal((await api("POST", `/api/superadmin/settlements/${row.id}/refund`, { note: "" }, tSA)).status, 400)
  const bal0 = (await api("GET", "/api/wallet/balance", null, tCust)).body.balanceRupees
  assert.equal((await api("POST", `/api/superadmin/settlements/${row.id}/refund`, { note: "Customer asked" }, tSA)).status, 200)
  const bal1 = (await api("GET", "/api/wallet/balance", null, tCust)).body.balanceRupees
  assert.equal(money(bal1 - bal0), rzpBooking.total)
})
await step("reconciliation reports the books healthy", async () => {
  const r = await api("GET", "/api/superadmin/reconciliation", null, tSA)
  assert.equal(r.body.healthy, true, JSON.stringify(r.body))
  assert.equal(r.body.escrow.matches, true)
})

console.log("\nNotifications (captured, nothing real was sent)")
await sleep(3000)
const mailTo = (u, re) => sentEmails.filter((m) => m.toEmail === u.email && re.test(m.subject))
await step("Super Admin is emailed when a booking is ready, and when the admin asks to change a percentage", async () => {
  assert.ok(mailTo(sa, /ready for your approval/).length >= 1, "ready-for-approval email")
  assert.equal(mailTo(sa, /Manager share change waiting/).length, 1, "percentage request email")
})
await step("admin and manager are each told what was added to their wallet, by email and by SMS", async () => {
  const a = mailTo(admin, /added to your wallet/)
  const m = mailTo(mgr, /added to your wallet/)
  assert.equal(a.length, 1)
  assert.equal(m.length, 1)
  assert.match(a[0].text, /GMA-E/)
  assert.match(a[0].text, /E2E Gaushala/)
  const smsA = sentSms.filter((x) => x.templateId === "tmpl_earnings")
  assert.equal(smsA.length, 2, "one SMS each")
  assert.ok(smsA.every((x) => x.vars.var1 && /^GMA-E/.test(x.vars.var2)), JSON.stringify(smsA[0]))
})
await step("the admin is told when the Super Admin approves the percentage", async () => {
  assert.equal(mailTo(admin, /Manager share change approved/).length, 1)
})
await step("the manager gets a security notice by email and SMS when a payout account is added", async () => {
  assert.equal(mailTo(mgr, /Payout account added/).length, 2, "UPI and bank")
  assert.equal(sentSms.filter((x) => x.templateId === "tmpl_account" && x.toPhone === mgr.phone).length, 2)
})
await step("the manager is told when the withdrawal is paid, with the bank reference", async () => {
  const paid = mailTo(mgr, /Withdrawal of .* sent/)
  assert.equal(paid.length, 1)
  assert.match(paid[0].text, /SANDBOX-/)
  const sms = sentSms.filter((x) => x.templateId === "tmpl_paid")
  assert.equal(sms.length, 1)
  assert.match(sms[0].vars.var3, /SANDBOX-/)
})
await step("the customer is not told about earnings that are not theirs", async () => {
  assert.equal(sentEmails.filter((m) => m.toEmail === cust.email && /wallet/.test(m.subject)).length, 0)
})
await step("a failing email or SMS service never breaks the money action", async () => {
  notify.__setTransports({
    email: async () => {
      throw new Error("mail server down")
    },
    sms: async () => {
      throw new Error("sms down")
    },
  })
  await notify.notifyUsers([mgr.id], notify.messages.withdrawalPaid(100n, "x", "u"))
  notify.__setTransports(null)
})

await prisma.$disconnect()
console.log(`\n${passed} passed, ${failed.length} failed`)
if (failed.length) {
  console.log("Failed:", failed.join(" | "))
  process.exit(1)
}
