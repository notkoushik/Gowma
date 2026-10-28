import { readFileSync } from "node:fs"

const payout = readFileSync("server/services/payoutEngine.ts", "utf8")
const deploy = readFileSync("scripts/db-deploy.js", "utf8")
const auth = readFileSync("server/auth/jwt.ts", "utf8")
const app = readFileSync("src/App.tsx", "utf8")
const router = readFileSync("server/router.ts", "utf8")

const checks = [
  ["API defaults to authentication", router.includes('error: "Authentication required"')],
  ["OTP universal bypass removed", !router.includes('submittedOtp !== "1234"')],
  ["Empty settlements do not manufacture batches", payout.includes("No eligible bookings are ready for settlement.")],
  ["Payout provider is required before settlement", payout.includes("GOMAA_PAYOUT_PROVIDER_ENABLED")],
  ["Production migration is non-destructive", deploy.includes("prisma migrate deploy") && !deploy.includes("--accept-data-loss")],
  ["JWT secret is not hard-coded", auth.includes("process.env.GOMAA_JWT_SECRET") && !auth.includes("gomaa_sacred_enterprise_jwt_secret")],
  ["Frontend contains no role-switch password", !app.includes("SuperAdmin@2026!") && !app.includes("OpsAdmin@2026!")],
  ["Booking requires Razorpay payment proof", router.includes("Verified Razorpay payment is required before booking")],
  ["Payment amount is quote-bound", router.includes("Payment amount does not match the server quote")],
  ["Razorpay order endpoint exists", router.includes("/api/payments/razorpay/order")],
  ["Razorpay webhook endpoint exists with signature verification", router.includes("/api/payments/webhook") && router.includes("verifyWebhookSignature")],
]

const failures = checks.filter(([, passed]) => !passed)
for (const [name, passed] of checks) console.log(`${passed ? "PASS" : "FAIL"} ${name}`)
if (failures.length) process.exit(1)
