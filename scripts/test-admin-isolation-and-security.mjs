import { handleApiRequest } from "../server/router.ts"
import { prisma } from "../server/prisma.ts"
import { TestHarness } from "./test-harness.mjs"
import crypto from "node:crypto"

async function runSecurityIsolationTestSuite() {
  const harness = new TestHarness("ADMIN ISOLATION & VULNERABILITY REMEDIATION QA SUITE")

  console.log("\n================================================================================")
  console.log("   GOMAA ADMIN ISOLATION & VULNERABILITY HARDENING QA SUITE                     ")
  console.log("================================================================================\n")

  const testEmail = `attacker.privilege.${harness.testRunId}@gomaa.test`
  const testPhone = `+91 98${Math.floor(10000000 + Math.random() * 90000000)}`
  const testPassword = `SecurePass_${crypto.randomBytes(4).toString("hex")}!`

  try {
    // --------------------------------------------------------------------------------
    // 1. PRIVILEGE ESCALATION PREVENTION ON REGISTRATION
    // --------------------------------------------------------------------------------
    console.log("[TEST 1] Testing Public Registration Privilege Escalation Lock...")

    const attackRes = await handleApiRequest(
      "POST",
      "/api/auth/register",
      JSON.stringify({
        name: "Malicious Attacker",
        email: testEmail,
        phone: testPhone,
        role: "super_admin", // Attacker specifies super_admin
        password: testPassword,
      })
    )

    harness.assert(attackRes?.status === 201, "Registration succeeds with 201 Created")
    harness.assert(attackRes?.body?.user?.role === "customer", "Role is strictly forced to 'customer' despite attacker payload")
    harness.assert(attackRes?.body?.user?.dbRole === "CUSTOMER", "DB Role is strictly 'CUSTOMER'")

    // Verify directly in PostgreSQL
    const dbRecord = await prisma.user.findUnique({ where: { email: testEmail } })
    harness.assert(dbRecord?.role === "CUSTOMER", "PostgreSQL database confirms user role is immutable CUSTOMER")

    // --------------------------------------------------------------------------------
    // 2. PORTAL SEGREGATION: ADMIN ON PUBLIC LOGIN IS REJECTED
    // --------------------------------------------------------------------------------
    console.log("\n[TEST 2] Testing Portal Isolation (Super Admin on Public /api/auth/login)...")

    const saUser = await harness.resolveOrCreateUser("SUPER_ADMIN")
    harness.assert(Boolean(saUser), "Super Admin persona located in PostgreSQL")

    const publicLoginAdminRes = await handleApiRequest(
      "POST",
      "/api/auth/login",
      JSON.stringify({
        email: saUser.email,
        password: "test_password",
      })
    )

    harness.assert(publicLoginAdminRes?.status === 403, "Super Admin login on public /api/auth/login is rejected with 403 Forbidden")
    harness.assert(
      publicLoginAdminRes?.body?.error?.includes("/admin portal"),
      "Helpful error directs administrative users to the isolated /admin portal"
    )

    // --------------------------------------------------------------------------------
    // 3. ISOLATED ADMIN GATEWAY: NON-ADMINS ARE REJECTED
    // --------------------------------------------------------------------------------
    console.log("\n[TEST 3] Testing Isolated Admin Gateway (Non-Admin on /api/auth/admin-login)...")

    const nonAdminRes = await handleApiRequest(
      "POST",
      "/api/auth/admin-login",
      JSON.stringify({
        email: testEmail, // Customer registered in Test 1
        password: testPassword,
      })
    )

    harness.assert(nonAdminRes?.status === 403, "Customer on /api/auth/admin-login rejected with 403 Forbidden")
    harness.assert(
      nonAdminRes?.body?.error?.includes("Administrative credentials required"),
      "Clear Access Denied error returned"
    )

    // --------------------------------------------------------------------------------
    // 4. RATE LIMITING ON ADMIN GATEWAY
    // --------------------------------------------------------------------------------
    console.log("\n[TEST 4] Testing Brute-Force Rate Limiting on /api/auth/admin-login...")

    const testAttackerIp = `192.168.100.${Math.floor(10 + Math.random() * 80)}`
    let rateLimited = false

    for (let i = 1; i <= 6; i++) {
      const bruteRes = await handleApiRequest(
        "POST",
        "/api/auth/admin-login",
        JSON.stringify({
          email: saUser.email,
          password: `wrong_pass_${i}`,
        }),
        { "x-forwarded-for": testAttackerIp }
      )

      if (bruteRes?.status === 429) {
        rateLimited = true
        break
      }
    }

    harness.assert(rateLimited, "Brute-force attempts against admin-login trigger 429 Too Many Requests")

    // --------------------------------------------------------------------------------
    // 5. RESTRICTED ENDPOINTS (GET /api/auth/accounts & GET /api/settlements)
    // --------------------------------------------------------------------------------
    console.log("\n[TEST 5] Testing Protection of Sensitive Endpoints...")

    // 5.1 /api/auth/accounts without auth
    const anonAccountsRes = await handleApiRequest("GET", "/api/auth/accounts", "")
    harness.assert(anonAccountsRes?.status === 401, "Unauthenticated GET /api/auth/accounts returns 401 Unauthorized")

    // 5.2 /api/auth/accounts with Customer auth
    const customerToken = attackRes?.body?.token
    const custAccountsRes = await handleApiRequest(
      "GET",
      "/api/auth/accounts",
      "",
      { authorization: `Bearer ${customerToken}` }
    )
    harness.assert(custAccountsRes?.status === 403, "Customer GET /api/auth/accounts returns 403 Insufficient Privileges")

    // 5.3 /api/settlements without auth
    const anonSettlementsRes = await handleApiRequest("GET", "/api/settlements", "")
    harness.assert(anonSettlementsRes?.status === 401, "Unauthenticated GET /api/settlements returns 401 Unauthorized")

    // 5.4 /api/settlements with Customer auth
    const custSettlementsRes = await handleApiRequest(
      "GET",
      "/api/settlements",
      "",
      { authorization: `Bearer ${customerToken}` }
    )
    harness.assert(custSettlementsRes?.status === 403, "Customer GET /api/settlements returns 403 Insufficient Privileges")

    // 5.5 /api/debug/email-status without auth
    const anonDebugRes = await handleApiRequest("GET", "/api/debug/email-status", "")
    harness.assert(anonDebugRes?.status === 401, "Unauthenticated GET /api/debug/email-status returns 401 Unauthorized")

    // --------------------------------------------------------------------------------
    // 6. PAYMENT BYPASS ELIMINATION
    // --------------------------------------------------------------------------------
    console.log("\n[TEST 6] Testing Fail-Closed Booking Payment Enforcement...")

    // Calculate a legitimate quote first
    const calcRes = await handleApiRequest(
      "POST",
      "/api/pricing/calculate",
      JSON.stringify({
        baseRate: 3500,
        gosala: "Surya",
        animal: "Gauri",
        durationMin: 60,
        distanceKm: 0,
        addonsCost: 0,
      }),
      { authorization: `Bearer ${customerToken}` }
    )

    harness.assert(Boolean(calcRes?.body?.quoteToken), "Legitimate server quote token obtained")

    const registeredUserName = attackRes?.body?.user?.name || "Malicious Attacker"

    const noPayBookingRes = await handleApiRequest(
      "POST",
      "/api/bookings",
      JSON.stringify({
        booking: {
          id: `GMA-${Date.now()}`,
          customer: registeredUserName,
          phone: testPhone,
          gosala: "Surya",
          animal: "Gauri",
          durationMin: 60,
          total: calcRes?.body?.total,
          base: calcRes?.body?.base,
          tax: calcRes?.body?.tax,
          transport: calcRes?.body?.transport,
          extraTime: calcRes?.body?.extraTime,
          addons: calcRes?.body?.addons,
          discount: 0,
          commissionPct: calcRes?.body?.commissionPct,
          commissionSnapshot: calcRes?.body?.commission,
          freeKmSnapshot: calcRes?.body?.freeKmSnapshot,
          perKmSnapshot: calcRes?.body?.perKmSnapshot,
          extraUnitRateSnapshot: calcRes?.body?.extraUnitRateSnapshot,
        },
        quoteToken: calcRes?.body?.quoteToken,
        // payment omitted entirely!
      }),
      { authorization: `Bearer ${customerToken}` }
    )

    harness.assert(noPayBookingRes?.status === 402, "Booking without payment proof is fail-closed rejected with 402 Payment Required", `status=${noPayBookingRes?.status}`)
    harness.assert(noPayBookingRes?.body?.error?.includes("Verified Razorpay payment is required"), "Clear Razorpay proof requirement error returned")

  } finally {
    // Teardown test user
    await prisma.user.deleteMany({ where: { email: testEmail } })
    await harness.teardown()
    await prisma.$disconnect()
  }

  console.log("\n================================================================================")
  console.log(`QA TEST RESULTS: ${harness.passed} PASSED, ${harness.failed} FAILED`)
  console.log("================================================================================\n")

  if (harness.failed > 0) {
    process.exit(1)
  }
}

runSecurityIsolationTestSuite().catch((err) => {
  console.error("FATAL ERROR IN SECURITY SUITE:", err)
  process.exit(1)
})
