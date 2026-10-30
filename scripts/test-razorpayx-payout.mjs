// Sends a real API call to RazorpayX in TEST mode: withdraws ₹1 from a throwaway user's wallet.
// Test mode moves no real money. Runs only on a scratch schema, so your real wallets are untouched.
//   DATABASE_URL="...&schema=wallet_test" GOMAA_PAYOUT_ACCOUNT_COOLOFF_HOURS=0 \
//   node --env-file=.env --experimental-transform-types --no-warnings scripts/test-razorpayx-payout.mjs
import assert from "node:assert/strict"

if (!/[?&]schema=[a-z0-9_]*test[a-z0-9_]*(&|$)/i.test(process.env.DATABASE_URL || "")) {
  console.error("Refusing to run: DATABASE_URL must include schema=<name containing 'test'>")
  process.exit(2)
}
if (!/^rzp_test_/.test(process.env.RAZORPAYX_KEY_ID || "")) {
  console.error("Refusing to run: RAZORPAYX_KEY_ID must be a rzp_test_ key")
  process.exit(2)
}

const { prisma } = await import("../server/prisma.ts")
const { getPayoutProvider } = await import("../server/services/payoutProvider.ts")
const { creditWallet } = await import("../server/services/walletService.ts")
const wd = await import("../server/services/withdrawalService.ts")
const { hashOtp } = await import("../server/services/otpService.ts")

const provider = getPayoutProvider()
console.log("payout provider mode :", provider.mode)
assert.equal(provider.mode, "RAZORPAYX", "RazorpayX is not switched on. Check GOMAA_PAYOUT_MODE, GOMAA_PAYOUT_PROVIDER_ENABLED, the key, secret and account number in .env")

const tag = Date.now().toString(36)
const user = await prisma.user.create({ data: { email: `rzpx-${tag}@example.invalid`, name: "RazorpayX Test", phone: "+91 90000 00000", role: "GOSALA_MANAGER" } })
await creditWallet({ userId: user.id, amountPaise: 500, purpose: "ADJUSTMENT", idempotencyKey: `seed_${user.id}` })

const account = await wd.addPayoutAccount(user.id, { type: "UPI", holderName: "Test Manager", vpa: "success@razorpay" })
console.log("saved account        :", account.label)

const paise = 100n // ₹1
await wd.requestWithdrawalOtp(user.id, paise, account.id)
const row = await prisma.withdrawalOtp.findFirstOrThrow({ where: { userId: user.id, used: false }, orderBy: { createdAt: "desc" } })
await prisma.withdrawalOtp.update({ where: { id: row.id }, data: { otpHash: hashOtp("424242") } })

console.log("requesting ₹1 payout from RazorpayX (test mode)...")
const res = await wd.createWithdrawal({ userId: user.id, amountPaise: paise, payoutAccountId: account.id, otp: "424242", idempotencyKey: `rzpx-${tag}` })
let w = res.withdrawal
console.log("status right away    :", w.status, w.failureReason ? `(${w.failureReason})` : "", w.utr ? `UTR ${w.utr}` : "")

for (let i = 0; i < 6 && w.status === "PROCESSING"; i++) {
  await new Promise((r) => setTimeout(r, 5000))
  await wd.refreshProcessing(user.id)
  const fresh = await prisma.withdrawalRequest.findUniqueOrThrow({ where: { id: w.id } })
  w = { ...w, status: fresh.status, utr: fresh.utr, failureReason: fresh.failureReason }
  console.log(`status after ${(i + 1) * 5}s    :`, w.status, w.failureReason ? `(${w.failureReason})` : "", w.utr ? `UTR ${w.utr}` : "")
}

const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: user.id } })
const hold = await prisma.wallet.findUniqueOrThrow({ where: { systemKey: "WITHDRAWAL_HOLD" } })
const fresh = await prisma.withdrawalRequest.findUniqueOrThrow({ where: { id: w.id } })
console.log("provider payout id   :", fresh.providerPayoutId)
console.log("wallet after         : ₹" + Number(wallet.balancePaise) / 100, "(started with ₹5.00)")
console.log("held for withdrawals : ₹" + Number(hold.balancePaise) / 100, "(all users on this scratch schema)")
await prisma.$disconnect()
