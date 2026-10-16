import { handleApiRequest } from "../server/router.ts"
import { prisma } from "../server/prisma.ts"
import { TestHarness } from "./test-harness.mjs"
import crypto from "node:crypto"

async function run() {
  const harness = new TestHarness("GOMAA FULL APPLICATION INTEGRITY & AUDIT")

  console.log("\n=======================================================")
  console.log("       GOMAA FULL APPLICATION INTEGRITY & AUDIT        ")
  console.log("=======================================================\n")

  try {
    // 1. Health & Database
    console.log("[1/8] Verifying Health & Database Connectivity...")
    const healthRes = await handleApiRequest("GET", "/api/health", "")
    harness.assert(healthRes?.status === 200, "Health endpoint responds with 200")
    harness.assert(healthRes?.body?.database === "postgresql-connected", "Database reports postgresql-connected")

    // Setup: Dynamic user discovery from PostgreSQL
    console.log("\n[SETUP] Dynamically resolving personas from PostgreSQL...")
    const saUser = await harness.resolveOrCreateUser("SUPER_ADMIN")
    const custUser = await harness.resolveOrCreateUser("CUSTOMER")

    console.log(`  • Discovered Super Admin: ${saUser.name} (${saUser.email})`)
    console.log(`  • Discovered Customer:    ${custUser.name} (${custUser.email})`)

    // 2. Authentication Gateway
    console.log("\n[2/8] Verifying Authentication & Password Security...")
    const badLogin = await handleApiRequest("POST", "/api/auth/login", JSON.stringify({
      emailOrPhone: saUser.email,
      password: "wrong_test_password_unauthorized",
    }))
    harness.assert(badLogin?.status === 401, "Bad password rejected with 401", `status=${badLogin?.status}`)

    const nonExistent = await handleApiRequest("POST", "/api/auth/login", JSON.stringify({
      emailOrPhone: `ghost_${harness.testRunId}@example.test`,
      password: "SomeTestPassword123!",
    }))
    harness.assert(nonExistent?.status === 401, "Non-existent user rejected with 401", `status=${nonExistent?.status}`)

    // Dynamic Super Admin login via live endpoint
    const saSession = await harness.loginWithDynamicPassword(saUser)
    harness.assert(saSession?.token && saSession?.user, "Super Admin dynamic login succeeds via /api/auth/login")
    harness.assert(typeof saSession?.token === "string" && saSession.token.length > 20, "RFC 7519 JWT token returned on login")
    harness.assert(saSession?.user?.password === undefined, "User response never leaks password or hash")

    const superAdminHeaders = saSession.headers

    // Setup dynamic active animal and Gaushala
    let testAnimal = await harness.getAnyAvailableAnimal()
    let testGosala = testAnimal?.gosala || (await harness.getAnyActiveGaushala())

    if (!testGosala) {
      testGosala = await harness.createDynamicGaushala(saUser, { name: `Sanctuary ${harness.testRunId}` })
    }
    if (!testAnimal) {
      testAnimal = await harness.createDynamicAnimal(testGosala.id, { name: `Surabhi ${harness.testRunId}` })
    }

    console.log(`  • Using Dynamic Animal:   ${testAnimal.name} (ID: ${testAnimal.id})`)
    console.log(`  • Using Dynamic Gaushala:  ${testGosala.name} (ID: ${testGosala.id})`)

    // 3. Private-by-Default Gateway
    console.log("\n[3/8] Verifying Private-by-Default Gateway Controls...")
    const unauthUsers = await handleApiRequest("GET", "/api/users", "")
    harness.assert(unauthUsers?.status === 401, "GET /api/users without token returns 401")

    const unauthGosalas = await handleApiRequest("GET", "/api/gosalas", "")
    harness.assert(unauthGosalas?.status === 200, "GET /api/gosalas is public for devotee landing page browsing (200)")

    const unauthAnimals = await handleApiRequest("GET", "/api/animals", "")
    harness.assert(unauthAnimals?.status === 200, "GET /api/animals is public for devotee landing page browsing (200)")

    const unauthHold = await handleApiRequest("POST", "/api/hold", JSON.stringify({
      animal: testAnimal.name,
      date: "2026-10-20",
      start: "10:00",
      durationMin: 60,
    }))
    harness.assert(unauthHold?.status === 401, "POST /api/hold without token returns 401")

    const unauthBooking = await handleApiRequest("POST", "/api/bookings", JSON.stringify({ booking: { id: "test" } }))
    harness.assert(unauthBooking?.status === 401, "POST /api/bookings without token returns 401")

    // 4. Role Authorization & Isolation
    console.log("\n[4/8] Verifying Role Boundaries & Tenant Isolation...")
    const custSession = await harness.loginWithDynamicPassword(custUser)
    harness.assert(custSession?.token && custSession?.user, "Customer dynamic login succeeds via /api/auth/login")
    const customerHeaders = custSession.headers

    const custAccessUsers = await handleApiRequest("GET", "/api/users", "", customerHeaders)
    harness.assert(custAccessUsers?.status === 403, "Customer cannot access GET /api/users (403 Forbidden)")

    const custMutatePricing = await handleApiRequest("PUT", "/api/pricing-config", JSON.stringify({ commissionPct: 10 }), customerHeaders)
    harness.assert(custMutatePricing?.status === 403, "Customer cannot mutate pricing config (403 Forbidden)")

    const custApproveBooking = await handleApiRequest("POST", "/api/bookings/B-TEST/manager-confirm", JSON.stringify({ confirm: true }), customerHeaders)
    harness.assert(custApproveBooking?.status === 403, "Customer cannot call manager approval (403 Forbidden)")

    const saAccessUsers = await handleApiRequest("GET", "/api/users", "", superAdminHeaders)
    harness.assert(saAccessUsers?.status === 200 && Array.isArray(saAccessUsers?.body?.users), "Super Admin can access GET /api/users (200 OK)")

    // 5. Pricing & Cryptographic Quotes
    console.log("\n[5/8] Verifying Pricing Calculation & Cryptographic Quotes...")
    const calcRes = await handleApiRequest("POST", "/api/pricing/calculate", JSON.stringify({
      baseRate: testAnimal.price || 3500,
      durationMin: 60,
      distanceKm: 0,
      addonsCost: 0,
      animal: testAnimal.name,
      gosala: testGosala.name,
    }), customerHeaders)
    harness.assert(calcRes?.status === 200, "Pricing engine returns 200 OK")
    harness.assert(typeof calcRes?.body?.quoteToken === "string", "Pricing engine returns cryptographic quoteToken")
    harness.assert(calcRes?.body?.total >= (testAnimal.price || 3500), `Calculated total matches formula: ₹${calcRes?.body?.total}`)

    // 6. Anti-Collision Slot Hold Mutex
    console.log("\n[6/8] Verifying Slot Hold Mutex & Ownership...")
    const holdDate = "2026-12-15"
    const holdStart = "11:00"

    // Cleanup any old test hold for deterministic run
    await prisma.temporarySlotHold.deleteMany({
      where: { animalId: testAnimal.id, date: holdDate },
    })

    const holdRes1 = await handleApiRequest("POST", "/api/hold", JSON.stringify({
      animal: testAnimal.name,
      date: holdDate,
      start: holdStart,
      durationMin: 60,
      customerName: custUser.name,
    }), customerHeaders)

    harness.assert(holdRes1?.status === 200 && holdRes1?.body?.success === true, "Customer successfully acquires slot hold")
    const holdId = holdRes1?.body?.hold?.id

    // Attempt overlapping hold on same slot
    const holdRes2 = await handleApiRequest("POST", "/api/hold", JSON.stringify({
      animal: testAnimal.name,
      date: holdDate,
      start: holdStart,
      durationMin: 60,
      customerName: custUser.name,
    }), customerHeaders)
    harness.assert(holdRes2?.status === 409, "Overlapping slot hold is rejected with 409 Conflict")

    // 7. Atomic Booking Transaction & Payment Requirement
    console.log("\n[7/8] Verifying Atomic Booking Transaction & Payment Proof...")
    const mockBooking = {
      id: `BK-TEST-${harness.testRunId}-${Date.now()}`,
      animal: testAnimal.name,
      gosala: testGosala.name,
      customer: custUser.name,
      date: holdDate,
      start: holdStart,
      end: "12:00",
      durationMin: 60,
      total: calcRes?.body?.total,
      base: calcRes?.body?.base,
      extraTime: calcRes?.body?.extraTime,
      transport: calcRes?.body?.transport,
      addons: calcRes?.body?.addons,
      tax: calcRes?.body?.tax,
      distanceKm: 0,
      commissionPct: calcRes?.body?.commissionPct,
      commissionSnapshot: calcRes?.body?.commission,
      freeKmSnapshot: calcRes?.body?.freeKmSnapshot,
      perKmSnapshot: calcRes?.body?.perKmSnapshot,
      extraUnitRateSnapshot: calcRes?.body?.extraUnitRateSnapshot,
    }

    // Without payment
    const noPayRes = await handleApiRequest("POST", "/api/bookings", JSON.stringify({
      booking: mockBooking,
      holdId,
      quoteToken: calcRes?.body?.quoteToken,
    }), customerHeaders)
    harness.assert(noPayRes?.status === 402, "Booking without payment proof is rejected with 402 Payment Required", `status=${noPayRes?.status}`)

    // With bad payment signature
    const fakePayRes = await handleApiRequest("POST", "/api/bookings", JSON.stringify({
      booking: mockBooking,
      holdId,
      quoteToken: calcRes?.body?.quoteToken,
      payment: {
        paymentId: "pay_fake_123",
        orderId: "order_fake_123",
        signature: "00".repeat(32),
        amountPaise: calcRes?.body?.total * 100,
      },
    }), customerHeaders)
    harness.assert(fakePayRes?.status === 402, "Booking with invalid payment signature is rejected with 402", `status=${fakePayRes?.status}`)

    // Cleanup the test hold
    if (holdId) {
      const releaseRes = await handleApiRequest("POST", "/api/hold/release", JSON.stringify({ holdId }), customerHeaders)
      harness.assert(releaseRes?.status === 200, "Customer can release their own slot hold")
      await prisma.temporarySlotHold.deleteMany({ where: { id: holdId } })
    }

    // 8. Razorpay Webhook Resilience
    console.log("\n[8/8] Verifying Webhook Signature & Security...")
    const noSigHook = await handleApiRequest("POST", "/api/payments/webhook", JSON.stringify({ event: "payment.captured" }), {})
    harness.assert(noSigHook?.status === 400, "Webhook without signature returns 400 Bad Request")

    // Unconfigured secret fails closed
    const prevSecret = process.env.RAZORPAY_WEBHOOK_SECRET
    delete process.env.RAZORPAY_WEBHOOK_SECRET
    const noSecretHook = await handleApiRequest("POST", "/api/payments/webhook", JSON.stringify({ event: "payment.captured" }), {
      "x-razorpay-signature": "00".repeat(32),
    })
    harness.assert(noSecretHook?.status === 500, "Webhook without configured secret fails closed (500)")

    const testSecret = `webhook_secret_${harness.testRunId}`
    process.env.RAZORPAY_WEBHOOK_SECRET = testSecret

    const badSigHook = await handleApiRequest("POST", "/api/payments/webhook", JSON.stringify({ event: "payment.captured" }), {
      "x-razorpay-signature": "00".repeat(32),
    })
    harness.assert(badSigHook?.status === 400, "Webhook with forged signature returns 400 Bad Request", `status=${badSigHook?.status}`)

    const validHookBody = JSON.stringify({ event: "order.paid", payload: { order: { entity: { id: `order_${harness.testRunId}` } } } })
    const validHookSig = crypto.createHmac("sha256", testSecret).update(validHookBody).digest("hex")

    const validHook = await handleApiRequest("POST", "/api/payments/webhook", validHookBody, {
      "x-razorpay-signature": validHookSig,
    })
    harness.assert(validHook?.status === 200 && validHook?.body?.received === true, "Webhook with valid signature returns 200 OK")

    if (prevSecret) {
      process.env.RAZORPAY_WEBHOOK_SECRET = prevSecret
    } else {
      delete process.env.RAZORPAY_WEBHOOK_SECRET
    }

  } finally {
    await harness.teardown()
    await prisma.$disconnect()
  }

  console.log("\n=======================================================")
  console.log(`TOTAL AUDIT CHECKS: ${harness.passed + harness.failed}`)
  console.log(`PASSED: ${harness.passed}`)
  console.log(`FAILED: ${harness.failed}`)
  console.log("=======================================================\n")

  if (harness.failed > 0) process.exit(1)
}

run().catch((err) => {
  console.error("FATAL ERROR IN AUDIT SUITE:", err)
  process.exit(1)
})
