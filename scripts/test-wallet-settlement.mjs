// Integration test for the commission wallet: escrow, T+2 maturity, approval split,
// split-policy approval, refunds, withdrawals and the books reconciling.
//
// It writes real rows, so it refuses to run unless DATABASE_URL points at a throwaway schema:
//   DATABASE_URL="postgres://...?sslmode=require&schema=wallet_test" \
//   RESEND_API_KEY= GMAIL_APP_PASSWORD= FAST2SMS_API_KEY= \
//   node --experimental-transform-types scripts/test-wallet-settlement.mjs
import assert from "node:assert/strict"

const url = process.env.DATABASE_URL || ""
if (!/[?&]schema=[a-z0-9_]*test[a-z0-9_]*(&|$)/i.test(url)) {
  console.error("Refusing to run: DATABASE_URL must include schema=<name containing 'test'>")
  process.exit(2)
}
process.env.NODE_ENV = process.env.NODE_ENV || "test"

const { prisma } = await import("../server/prisma.ts")
const ledger = await import("../server/services/ledgerService.ts")
const settle = await import("../server/services/settlementService.ts")
const wd = await import("../server/services/withdrawalService.ts")
const walletSvc = await import("../server/services/walletService.ts")
const { reconcile } = await import("../server/walletRoutes.ts")

let passed = 0
const failures = []
async function test(name, fn) {
  try {
    await fn()
    passed++
    console.log(`  ok   ${name}`)
  } catch (err) {
    failures.push(name)
    console.log(`  FAIL ${name}\n       ${err?.stack?.split("\n").slice(0, 3).join("\n       ")}`)
  }
}

const rupees = (p) => Number(p) / 100
const bal = async (where) => {
  const w = await prisma.wallet.findFirst({ where })
  return w ? rupees(w.balancePaise) : 0
}
const sys = (k) => bal({ systemKey: k })
const usr = (id) => bal({ userId: id })
const sa = { userId: "sa", name: "Test Super Admin" }
let seq = 0
const uid = () => `${Date.now().toString(36)}${(seq++).toString(36)}`

// ---------------------------------------------------------------- fixtures
const mkUser = (role, tag) =>
  prisma.user.create({ data: { email: `wt-${tag}-${uid()}@example.invalid`, name: `${tag} user`, phone: "+91 90000 00000", role } })

await prisma.masterPricingConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } })
const superAdmin = await mkUser("SUPER_ADMIN", "sa")
sa.userId = superAdmin.id
const adminUser = await mkUser("OPERATIONS_ADMIN", "admin")
const mgr1 = await mkUser("GOSALA_MANAGER", "mgr1")
const mgr2 = await mkUser("GOSALA_MANAGER", "mgr2")
const customer = await mkUser("CUSTOMER", "cust")

const gosala = await prisma.gosala.create({
  data: { name: `Test Gaushala ${uid()}`, region: "Test", address: "x", contactPhone: "1", contactEmail: "t@example.invalid", adminId: adminUser.id },
})
await prisma.gosalaManagerAssignment.create({ data: { userId: mgr1.id, gosalaId: gosala.id, region: "Test" } })
const animal = await prisma.animal.create({ data: { gosalaId: gosala.id, name: `Cow ${uid()}`, type: "COW" } })

async function mkBooking({ total = 11200, tax = 1200, status = "PAYMENT_VERIFIED", provider = "RAZORPAY", createdAt } = {}) {
  const id = `GMA-T${uid()}`.toUpperCase()
  return prisma.booking.create({
    data: {
      id, customerId: customer.id, gosalaId: gosala.id, animalId: animal.id,
      customerName: "c", customerPhone: "1", animalName: animal.name, animalType: "COW", gosalaName: gosala.name,
      bookingDate: "01 Jan 2030", startTime: "10:00", endTime: "11:00", durationMin: 60, address: "a", distanceKm: 0,
      baseRate: total - tax, extraTimeFee: 0, transportFee: 0, addonsFee: 0, taxFee: tax, discountFee: 0, totalAmount: total,
      commissionPct: 20, commissionAmount: 0, gosalaPayable: 0, status, paymentProvider: provider, paymentStatus: "CAPTURED",
      paymentCapturedAt: createdAt ?? new Date(), paymentId: `pay_${id}`, ...(createdAt ? { createdAt } : {}),
    },
  })
}
const record = (b) =>
  settle.recordBookingPayment({
    id: b.id, gosalaId: b.gosalaId, gosalaName: b.gosalaName, customerId: b.customerId,
    totalAmount: b.totalAmount, taxFee: b.taxFee, paymentProvider: b.paymentProvider, paymentCapturedAt: b.paymentCapturedAt, createdAt: b.createdAt,
  })
const settlementOf = (b) => prisma.bookingSettlement.findUniqueOrThrow({ where: { bookingId: b.id } })

console.log("\nShare maths")
await test("₹11,200 paid with ₹1,200 tax → tax 1200 / platform 1000 / manager 3000 / admin 6000", () => {
  const s = settle.computeShares(1120000n, 120000n, 1000, 3000)
  assert.deepEqual([s.taxPaise, s.platformPaise, s.managerPaise, s.adminPaise].map(rupees), [1200, 1000, 3000, 6000])
})
await test("odd paise never go missing (parts always add up)", () => {
  for (const gross of [1n, 99n, 100003n, 1234567n, 99999999n]) {
    const s = settle.computeShares(gross, gross / 9n, 1000, 3333)
    assert.equal(s.platformPaise + s.adminPaise + s.managerPaise + s.taxPaise, gross)
  }
})
await test("manager + platform above 100% is refused", () => {
  assert.throws(() => settle.computeShares(10000n, 0n, 6000, 5000), /more than 100%/)
})
await test("equal split between recipients keeps every paisa", () => {
  const m = settle.splitEqually(1001n, ["a", "b", "c"])
  assert.equal([...m.values()].reduce((a, b) => a + b, 0n), 1001n)
})

console.log("\nEscrow and maturity (T+2)")
const b1 = await mkBooking()
await test("payment lands in escrow and creates a HELD settlement", async () => {
  const before = await sys("ESCROW")
  const r = await record(b1)
  assert.equal(r.created, true)
  assert.equal((await sys("ESCROW")) - before, 11200)
  const s = await settlementOf(b1)
  assert.equal(s.status, "HELD")
  assert.equal(s.eligibleAt.getTime() - s.paidAt.getTime(), 2 * 24 * 3600 * 1000)
})
await test("recording the same payment twice does not double the escrow", async () => {
  const before = await sys("ESCROW")
  const r = await record(b1)
  assert.equal(r.created, false)
  assert.equal(await sys("ESCROW"), before)
})
await test("cannot approve before the 2 days are up", async () => {
  const s = await settlementOf(b1)
  await assert.rejects(settle.approveSettlement(s.id, sa), /Not ready yet/)
})
await test("maturity leaves it alone before T+2, moves it after", async () => {
  assert.equal((await settle.runMaturity(new Date())).moved >= 0, true)
  assert.equal((await settlementOf(b1)).status, "HELD")
  const moved = await settle.runMaturity(new Date(Date.now() + 3 * 24 * 3600 * 1000))
  assert.ok(moved.moved >= 1)
  assert.equal((await settlementOf(b1)).status, "READY_FOR_APPROVAL")
})

console.log("\nApproval and release")
await test("approve releases escrow into tax, platform, admin and manager wallets", async () => {
  const before = { esc: await sys("ESCROW"), tax: await sys("TAX"), plat: await sys("PLATFORM"), adm: await usr(adminUser.id), mgr: await usr(mgr1.id) }
  await settle.approveSettlement((await settlementOf(b1)).id, sa)
  assert.equal(before.esc - (await sys("ESCROW")), 11200)
  assert.equal((await sys("TAX")) - before.tax, 1200)
  assert.equal((await sys("PLATFORM")) - before.plat, 1000)
  assert.equal((await usr(adminUser.id)) - before.adm, 6000)
  assert.equal((await usr(mgr1.id)) - before.mgr, 3000)
  assert.equal((await settlementOf(b1)).status, "RELEASED")
})
await test("approving again is a no-op, not a second payout", async () => {
  const adm = await usr(adminUser.id)
  const r = await settle.approveSettlement((await settlementOf(b1)).id, sa)
  assert.equal(r.replay, true)
  assert.equal(await usr(adminUser.id), adm)
})
await test("8 simultaneous approvals pay out exactly once", async () => {
  const b = await mkBooking({ createdAt: new Date(Date.now() - 3 * 24 * 3600 * 1000) })
  await record(b)
  await settle.runMaturity()
  const id = (await settlementOf(b)).id
  const adm = await usr(adminUser.id)
  const res = await Promise.allSettled(Array.from({ length: 8 }, () => settle.approveSettlement(id, sa)))
  assert.ok(res.some((r) => r.status === "fulfilled"))
  assert.equal((await usr(adminUser.id)) - adm, 6000)
})
await test("two managers share the manager amount equally", async () => {
  await prisma.gosalaManagerAssignment.create({ data: { userId: mgr2.id, gosalaId: gosala.id, region: "Test" } })
  const b = await mkBooking({ createdAt: new Date(Date.now() - 3 * 24 * 3600 * 1000) })
  await record(b)
  await settle.runMaturity()
  const [m1, m2] = [await usr(mgr1.id), await usr(mgr2.id)]
  await settle.approveSettlement((await settlementOf(b)).id, sa)
  assert.equal((await usr(mgr1.id)) - m1, 1500)
  assert.equal((await usr(mgr2.id)) - m2, 1500)
})
await test("a missing admin blocks release instead of losing the share", async () => {
  const g2 = await prisma.gosala.create({ data: { name: `No Admin ${uid()}`, region: "T", address: "x", contactPhone: "1", contactEmail: "t@example.invalid" } })
  const a2 = await prisma.animal.create({ data: { gosalaId: g2.id, name: `C ${uid()}`, type: "COW" } })
  const id = `GMA-N${uid()}`.toUpperCase()
  const b = await prisma.booking.create({
    data: { id, customerId: customer.id, gosalaId: g2.id, animalId: a2.id, customerName: "c", customerPhone: "1", animalName: a2.name, animalType: "COW", gosalaName: g2.name, bookingDate: "x", startTime: "1", endTime: "2", durationMin: 60, address: "a", distanceKm: 0, baseRate: 100, extraTimeFee: 0, transportFee: 0, addonsFee: 0, taxFee: 0, discountFee: 0, totalAmount: 100, commissionPct: 20, commissionAmount: 0, gosalaPayable: 0, paymentStatus: "CAPTURED", paymentId: `pay_${id}`, createdAt: new Date(Date.now() - 3 * 24 * 3600 * 1000) },
  })
  await record(b)
  await settle.runMaturity()
  await assert.rejects(settle.approveSettlement((await settlementOf(b)).id, sa), /no Operations Admin/)
  assert.equal((await settlementOf(b)).status, "READY_FOR_APPROVAL")
})

console.log("\nRefund and reject")
await test("refund before release returns the full amount to the customer's wallet", async () => {
  const b = await mkBooking({ total: 5000, tax: 0 })
  await record(b)
  const esc = await sys("ESCROW")
  const cust = await usr(customer.id)
  await settle.refundSettlement((await settlementOf(b)).id, sa, "Customer cancelled")
  assert.equal(esc - (await sys("ESCROW")), 5000)
  assert.equal((await usr(customer.id)) - cust, 5000)
})
await test("a released booking cannot be refunded from escrow", async () => {
  await assert.rejects(settle.refundSettlement((await settlementOf(b1)).id, sa, "late"), /already released/)
})
await test("rejecting needs a reason and keeps the money in escrow", async () => {
  const b = await mkBooking({ total: 2000, tax: 0 })
  await record(b)
  const id = (await settlementOf(b)).id
  await assert.rejects(settle.rejectSettlement(id, sa, " "), /reason/)
  const esc = await sys("ESCROW")
  await settle.rejectSettlement(id, sa, "Under dispute")
  assert.equal(await sys("ESCROW"), esc)
  assert.equal((await settlementOf(b)).status, "REJECTED")
})
await test("a rejected or cancelled booking is not moved to the approval queue", async () => {
  const b = await mkBooking({ status: "CANCELLED", createdAt: new Date(Date.now() - 3 * 24 * 3600 * 1000) })
  await record(b)
  await settle.runMaturity()
  assert.equal((await settlementOf(b)).status, "HELD")
})

console.log("\nSplit percentage changes need Super Admin approval")
await test("admin request does not change anything until approved", async () => {
  const req = await settle.requestSplitChange({ actor: { userId: adminUser.id, name: "Admin" }, gosalaId: gosala.id, managerBp: 4000, reason: "More work" })
  assert.equal(req.status, "PENDING")
  assert.equal((await settle.getManagerBpFor(gosala.id)).managerBp, 3000)
  await assert.rejects(settle.requestSplitChange({ actor: { userId: adminUser.id, name: "Admin" }, gosalaId: gosala.id, managerBp: 5000 }), /already waiting/)
  globalThis.__req = req
})
await test("approval makes it live, but old bookings keep the old percentage", async () => {
  const old = await mkBooking()
  await record(old)
  await settle.decideSplitChange(globalThis.__req.id, sa, true, "ok")
  assert.equal((await settle.getManagerBpFor(gosala.id)).managerBp, 4000)
  const fresh = await mkBooking()
  await record(fresh)
  assert.equal((await settlementOf(old)).managerBp, 3000)
  const f = await settlementOf(fresh)
  assert.deepEqual([f.managerBp, f.adminBp, rupees(f.managerPaise), rupees(f.adminPaise)], [4000, 5000, 4000, 5000])
})
await test("rejected request leaves the policy unchanged", async () => {
  const r = await settle.requestSplitChange({ actor: { userId: adminUser.id, name: "Admin" }, gosalaId: gosala.id, managerBp: 2500 })
  await settle.decideSplitChange(r.id, sa, false, "no")
  assert.equal((await settle.getManagerBpFor(gosala.id)).managerBp, 4000)
})
await test("manager % above what is left after platform is refused", async () => {
  await assert.rejects(settle.requestSplitChange({ actor: { userId: adminUser.id, name: "A" }, gosalaId: gosala.id, managerBp: 9500 }), /at most 90%/)
})
await test("platform % cannot be raised past an existing manager share", async () => {
  await assert.rejects(settle.setPlatformBp(7000, sa), /negative share/)
  assert.equal((await settle.getWalletConfig()).platformBp, 1000)
})

console.log("\nLedger safety")
await test("50 parallel ₹30 debits on ₹100 → exactly 3 succeed, balance never negative", async () => {
  const u = await mkUser("CUSTOMER", "race")
  await walletSvc.creditWallet({ userId: u.id, amountPaise: 10000, purpose: "TOPUP", idempotencyKey: `seed_${u.id}` })
  const res = await Promise.allSettled(
    Array.from({ length: 50 }, (_, i) => walletSvc.debitWallet({ userId: u.id, amountPaise: 3000, purpose: "BOOKING_PAYMENT", idempotencyKey: `race_${u.id}_${i}` })),
  )
  const okCount = res.filter((r) => r.status === "fulfilled").length
  assert.equal(okCount, 3)
  assert.equal(await usr(u.id), 10)
})
await test("same idempotency key sent 10 times at once credits once", async () => {
  const u = await mkUser("CUSTOMER", "idem")
  const res = await Promise.allSettled(Array.from({ length: 10 }, () => walletSvc.creditWallet({ userId: u.id, amountPaise: 5000, purpose: "TOPUP", idempotencyKey: `same_${u.id}` })))
  assert.ok(res.every((r) => r.status === "fulfilled"), JSON.stringify(res.filter((r) => r.status === "rejected").map((r) => String(r.reason))))
  assert.equal(await usr(u.id), 50)
})
await test("an unbalanced ledger group is refused", async () => {
  const e = await prisma.wallet.findUniqueOrThrow({ where: { systemKey: "ESCROW" } })
  await assert.rejects(
    ledger.runLedgerTx((tx) => ledger.postGroup(tx, [{ walletId: e.id, type: "CREDIT", amountPaise: 100n, purpose: "ADJUSTMENT", idempotencyKey: `unbal_${uid()}` }], { balanced: true })),
    /Unbalanced/,
  )
})

console.log("\nWithdrawals")
let account
await test("adding a bank account validates and hides the full number", async () => {
  await assert.rejects(wd.addPayoutAccount(mgr1.id, { type: "BANK", holderName: "M One", accountNumber: "12", ifsc: "HDFC0001234" }), /9 to 18 digits/)
  await assert.rejects(wd.addPayoutAccount(mgr1.id, { type: "BANK", holderName: "M One", accountNumber: "123456789012", ifsc: "BAD" }), /IFSC/)
  account = await wd.addPayoutAccount(mgr1.id, { type: "BANK", holderName: "M One", accountNumber: "123456789012", ifsc: "HDFC0001234" })
  assert.match(account.label, /••••9012/)
  assert.ok(!JSON.stringify(account).includes("123456789012"))
})
await test("UPI id is validated", async () => {
  await assert.rejects(wd.addPayoutAccount(mgr1.id, { type: "UPI", holderName: "M One", vpa: "nope" }), /name@bank/)
  const u = await wd.addPayoutAccount(mgr1.id, { type: "UPI", holderName: "M One", vpa: "mone@okhdfc" })
  assert.equal(u.label, "mone@okhdfc")
})
async function withdraw(userId, amount, key, acct = account) {
  const paise = BigInt(Math.round(amount * 100))
  await wd.requestWithdrawalOtp(userId, paise, acct.id)
  // The code is emailed (or printed to the server log when email is not set up), so the test swaps in a known one.
  const { hashOtp } = await import("../server/services/otpService.ts")
  const row = await prisma.withdrawalOtp.findFirstOrThrow({ where: { userId, used: false }, orderBy: { createdAt: "desc" } })
  await prisma.withdrawalOtp.update({ where: { id: row.id }, data: { otpHash: hashOtp("424242") } })
  return wd.createWithdrawal({ userId, amountPaise: paise, payoutAccountId: acct.id, otp: "424242", idempotencyKey: key })
}
await test("withdrawing ₹1,000 pays out and reduces the wallet", async () => {
  const before = await usr(mgr1.id)
  const r = await withdraw(mgr1.id, 1000, `wd_${uid()}`)
  assert.equal(r.withdrawal.status, "PAID")
  assert.equal(r.withdrawal.mode, "SANDBOX")
  assert.match(r.withdrawal.utr, /^SANDBOX-/)
  assert.equal(before - (await usr(mgr1.id)), 1000)
  assert.equal(await sys("WITHDRAWAL_HOLD"), 0)
})
await test("same withdrawal key twice does not pay twice", async () => {
  const key = `wd_${uid()}`
  const before = await usr(mgr1.id)
  const a = await withdraw(mgr1.id, 100, key)
  const bRes = await wd.createWithdrawal({ userId: mgr1.id, amountPaise: 10000n, payoutAccountId: account.id, otp: "000000", idempotencyKey: key })
  assert.equal(bRes.replay, true)
  assert.equal(bRes.withdrawal.id, a.withdrawal.id)
  assert.equal(before - (await usr(mgr1.id)), 100)
})
await test("wrong code is refused and nothing moves", async () => {
  const before = await usr(mgr1.id)
  await wd.requestWithdrawalOtp(mgr1.id, 10000n, account.id)
  await assert.rejects(wd.createWithdrawal({ userId: mgr1.id, amountPaise: 10000n, payoutAccountId: account.id, otp: "123456", idempotencyKey: `wd_${uid()}` }), /not correct/)
  assert.equal(await usr(mgr1.id), before)
})
await test("code issued for ₹100 cannot be used for ₹500", async () => {
  await wd.requestWithdrawalOtp(mgr1.id, 10000n, account.id)
  const { hashOtp } = await import("../server/services/otpService.ts")
  const row = await prisma.withdrawalOtp.findFirstOrThrow({ where: { userId: mgr1.id, used: false }, orderBy: { createdAt: "desc" } })
  await prisma.withdrawalOtp.update({ where: { id: row.id }, data: { otpHash: hashOtp("424242") } })
  await assert.rejects(wd.createWithdrawal({ userId: mgr1.id, amountPaise: 50000n, payoutAccountId: account.id, otp: "424242", idempotencyKey: `wd_${uid()}` }), /different amount/)
})
await test("cannot withdraw more than the balance, and balance stays above zero", async () => {
  const bal0 = await usr(mgr1.id)
  await assert.rejects(wd.requestWithdrawalOtp(mgr1.id, BigInt(Math.round((bal0 + 1) * 100)), account.id), /at most/)
})
await test("someone else's account cannot be used", async () => {
  await assert.rejects(wd.requestWithdrawalOtp(adminUser.id, 10000n, account.id), /Choose a saved/)
})
await test("a failed payout returns the money, and a repeat notice does nothing", async () => {
  const before = await usr(mgr1.id)
  const hold = await prisma.wallet.findUniqueOrThrow({ where: { systemKey: "WITHDRAWAL_HOLD" } })
  const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: mgr1.id } })
  const row = await prisma.withdrawalRequest.create({ data: { userId: mgr1.id, walletId: wallet.id, payoutAccountId: account.id, amountPaise: 20000n, idempotencyKey: `f_${uid()}`, providerPayoutId: "pout_x" } })
  await ledger.runLedgerTx((tx) =>
    ledger.postGroup(tx, [
      { walletId: wallet.id, type: "DEBIT", amountPaise: 20000n, purpose: "WITHDRAWAL_HOLD", idempotencyKey: `wd_${row.id}:wallet`, groupId: `wd_${row.id}` },
      { walletId: hold.id, type: "CREDIT", amountPaise: 20000n, purpose: "WITHDRAWAL_HOLD", idempotencyKey: `wd_${row.id}:hold`, groupId: `wd_${row.id}` },
    ], { balanced: true }),
  )
  assert.equal(before - (await usr(mgr1.id)), 200)
  await wd.applyOutcome(row.id, { state: "FAILED", reason: "Bank rejected" })
  assert.equal(await usr(mgr1.id), before)
  await wd.applyOutcome(row.id, { state: "FAILED", reason: "again" })
  await wd.applyOutcome(row.id, { state: "PAID", providerPayoutId: "pout_x", utr: "LATE" })
  assert.equal(await usr(mgr1.id), before)
  assert.equal((await prisma.withdrawalRequest.findUniqueOrThrow({ where: { id: row.id } })).status, "FAILED")
})

console.log("\nBooks balance")
await test("every wallet equals its entries, every group nets to zero, escrow equals unreleased settlements", async () => {
  const r = await reconcile()
  assert.deepEqual(r.walletMismatches, [])
  assert.deepEqual(r.unbalancedGroups, [])
  assert.equal(r.escrow.matches, true, JSON.stringify(r.escrow))
  assert.equal(r.healthy, true)
})

await prisma.$disconnect()
console.log(`\n${passed} passed, ${failures.length} failed`)
if (failures.length) {
  console.log("Failed:", failures.join(" | "))
  process.exit(1)
}
