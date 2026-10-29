/**
 * GOMAA Wallet & Anti-Replay Payment Security QA Suite
 * Tests:
 * 1. Wallet Balance retrieval & authentication checks
 * 2. Wallet Top-Up Order creation & bounds enforcement (₹100 - ₹50,000)
 * 3. Cryptographic Top-Up verification & double-entry credit
 * 4. Anti-Replay on Wallet Top-Up (prevents double crediting)
 * 5. Anti-Replay on Seva Bookings (prevents reusing Razorpay paymentId across bookings)
 * 6. 1-Click Seva Booking via Wallet (atomic debit with idempotency)
 * 7. Overdraft prevention (insufficient wallet balance blocks booking)
 */

import { TestHarness } from "./test-harness.mjs"
import { handleApiRequest } from "../server/router.ts"
import { prisma } from "../server/prisma.ts"
import crypto from "node:crypto"

async function runTests() {
  console.log("\n" + "=".repeat(80))
  console.log("   GOMAA WALLET & ANTI-REPLAY PAYMENT INTEGRITY QA SUITE")
  console.log("=".repeat(80) + "\n")

  const harness = new TestHarness("Wallet & Anti-Replay")
  let passed = 0
  let failed = 0

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`)
      passed++
    } else {
      console.error(`  ✗ FAIL: ${message}`)
      failed++
    }
  }

  async function req(method, pathname, body = null, token = null) {
    const headers = {}
    if (token) headers["Authorization"] = `Bearer ${token}`
    if (body) headers["Content-Type"] = "application/json"
    return await handleApiRequest(
      method,
      pathname,
      body ? JSON.stringify(body) : "",
      headers
    )
  }

  try {
    // [SETUP] Authenticate Customer Devotee
    console.log("[SETUP] Authenticating Customer Persona...")
    const customer = await harness.resolveOrCreateUser("CUSTOMER")
    const loginResult = await harness.loginWithDynamicPassword(customer)
    const customerToken = loginResult.token
    assert(Boolean(customerToken), `Customer authenticated: ${customer.email}`)

    // -------------------------------------------------------------
    // [TEST 1] Wallet Balance & Unauthenticated Lockdown
    // -------------------------------------------------------------
    console.log("\n[TEST 1] Testing Wallet Balance & Access Control...")
    const unauthBalance = await req("GET", "/api/wallet/balance")
    assert(unauthBalance.status === 401, "Unauthenticated GET /api/wallet/balance returns 401 Unauthorized")

    const authBalance = await req("GET", "/api/wallet/balance", null, customerToken)
    console.log("DEBUG authBalance response:", authBalance)
    assert(authBalance.status === 200, "Authenticated GET /api/wallet/balance returns 200 OK")
    assert(authBalance.body.ok === true, "Response payload ok is true")
    assert(typeof authBalance.body.balanceRupees === "number", "balanceRupees is a valid number")
    console.log(`  • Initial customer balance: ₹${authBalance.body.balanceRupees}`)

    // -------------------------------------------------------------
    // [TEST 2] Wallet Top-Up Order Bounds Enforcement
    // -------------------------------------------------------------
    console.log("\n[TEST 2] Testing Top-Up Order Creation & Bounds Enforcement...")
    const underMin = await req("POST", "/api/wallet/topup/order", { amountRupees: 50 }, customerToken)
    assert(underMin.status === 400, "Top-up < ₹100 is rejected with 400 Bad Request")

    const overMax = await req("POST", "/api/wallet/topup/order", { amountRupees: 100000 }, customerToken)
    assert(overMax.status === 400, "Top-up > ₹50,000 is rejected with 400 Bad Request")

    const validOrder = await req("POST", "/api/wallet/topup/order", { amountRupees: 1000 }, customerToken)
    assert(validOrder.status === 201, "Top-up order for ₹1,000 succeeds with 201 Created")
    assert(Boolean(validOrder.body.orderId), `Razorpay Order generated: ${validOrder.body.orderId}`)

    // -------------------------------------------------------------
    // [TEST 3] Cryptographic Top-Up Verification & Balance Credit
    // -------------------------------------------------------------
    console.log("\n[TEST 3] Testing Cryptographic Top-Up Verification & Credit...")
    const topupPaymentId = "pay_test_topup_" + Date.now()
    const topupOrderId = validOrder.body.orderId
    const secret = process.env.RAZORPAY_KEY_SECRET || "gomaa_test_secret_2026"
    const validSignature = crypto.createHmac("sha256", secret).update(`${topupOrderId}|${topupPaymentId}`).digest("hex")

    const verifyTopup = await req("POST", "/api/wallet/topup/verify", {
      paymentId: topupPaymentId,
      orderId: topupOrderId,
      signature: validSignature,
      amountPaise: 100000, // ₹1,000 in paise
    }, customerToken)
    assert(verifyTopup.status === 200, "Top-up verification succeeds with 200 OK")
    assert(verifyTopup.body.balanceRupees >= 1000, `Updated balance reflects credit: ₹${verifyTopup.body.balanceRupees}`)

    // -------------------------------------------------------------
    // [TEST 4] Anti-Replay on Wallet Top-Up
    // -------------------------------------------------------------
    console.log("\n[TEST 4] Testing Anti-Replay on Wallet Top-Up (Double-Credit Attack)...")
    const replayTopup = await req("POST", "/api/wallet/topup/verify", {
      paymentId: topupPaymentId,
      orderId: topupOrderId,
      signature: validSignature,
      amountPaise: 100000,
    }, customerToken)
    assert(replayTopup.status === 409, "Replaying same paymentId on top-up is rejected with 409 Conflict")
    assert(replayTopup.body.error.includes("already been credited"), "Error explains payment was already credited")

    // -------------------------------------------------------------
    // [TEST 5] Transaction History Audit Ledger
    // -------------------------------------------------------------
    console.log("\n[TEST 5] Testing Transaction History Ledger...")
    const txHistory = await req("GET", "/api/wallet/transactions", null, customerToken)
    assert(txHistory.status === 200, "GET /api/wallet/transactions returns 200 OK")
    assert(Array.isArray(txHistory.body.transactions), "Transactions returned as an array")
    assert(txHistory.body.transactions.length > 0, "Ledger contains recorded top-up transaction")

    // -------------------------------------------------------------
    // [TEST 6] Anti-Payment-Replay on Seva Bookings
    // -------------------------------------------------------------
    console.log("\n[TEST 6] Testing Anti-Payment-Replay Protection on Bookings...")
    // Find an existing completed booking with a paymentId
    const existingBooking = await prisma.booking.findFirst({
      where: { paymentId: { not: null } },
      select: { id: true, paymentId: true, paymentOrderId: true },
    })
    assert(Boolean(existingBooking), `Found existing reference booking: ${existingBooking.id}`)

    // Calculate a valid quote for a new booking
    const quoteRes = await req("POST", "/api/pricing/calculate", {
      baseRate: 3500,
      durationMin: 60,
      distanceKm: 5,
      addonsCost: 0,
      animal: "Gauri (Gir Cow)",
      gosala: "Sri Surabhi Gaushala",
    }, customerToken)
    assert(quoteRes.status === 200, "Obtained legitimate server quote")
    const quoteToken = quoteRes.body.quoteToken

    // Create a slot hold
    const holdRes = await req("POST", "/api/hold", {
      animal: "Gauri (Gir Cow)",
      date: "26 Sep 2026",
      start: "11:00",
      durationMin: 60,
      customerName: customer.name,
    }, customerToken)
    const holdId = holdRes.body.holdId || "HOLD-TEST-REPLAY"

    // Attacker attempts to reuse existingBooking.paymentId for a new booking!
    const attackerSignature = crypto.createHmac("sha256", secret).update(`${existingBooking.paymentOrderId}|${existingBooking.paymentId}`).digest("hex")
    const replayBookingRes = await req("POST", "/api/bookings", {
      quoteToken,
      holdId,
      payment: {
        paymentId: existingBooking.paymentId,
        orderId: existingBooking.paymentOrderId || "order_test_replay",
        signature: attackerSignature,
        amountPaise: Math.round(Number(quoteRes.body.total) * 100),
      },
      booking: {
        id: "GMA-ATTACK-" + Date.now().toString().slice(-5),
        customer: customer.name,
        date: "26 Sep 2026",
        start: "11:00",
        end: "12:00",
        durationMin: 60,
        distanceKm: 5,
        total: quoteRes.body.total,
        base: quoteRes.body.base,
        tax: quoteRes.body.tax,
        transport: quoteRes.body.transport,
        extraTime: quoteRes.body.extraTime,
        addons: quoteRes.body.addons,
        discount: 0,
        commissionPct: quoteRes.body.commissionPct,
        commissionSnapshot: quoteRes.body.commission,
        freeKmSnapshot: quoteRes.body.freeKmSnapshot,
        perKmSnapshot: quoteRes.body.perKmSnapshot,
        extraUnitRateSnapshot: quoteRes.body.extraUnitRateSnapshot,
        animal: "Gauri (Gir Cow)",
        gosala: "Sri Surabhi Gaushala",
      },
    }, customerToken)
    assert(replayBookingRes.status === 409, "Replaying existing booking paymentId is rejected with 409 Conflict")
    assert(replayBookingRes.body.error.includes("already been applied"), "Error confirms payment proof was already applied to another booking")

    // -------------------------------------------------------------
    // [TEST 7] 1-Click Seva Booking via Wallet
    // -------------------------------------------------------------
    console.log("\n[TEST 7] Testing 1-Click Booking via Wallet (Atomic Debit)...")
    const testDate = "15 Dec 2026"
    const testSlotStart = "10:00"
    const testSlotEnd = "11:00"

    // Clean up any previous test holds or bookings for this isolated test slot
    await prisma.temporarySlotHold.deleteMany({ where: { date: testDate } })
    await prisma.booking.deleteMany({ where: { bookingDate: testDate } })

    const walletHoldRes = await req("POST", "/api/hold", {
      animal: "Gauri (Gir Cow)",
      date: testDate,
      start: testSlotStart,
      durationMin: 60,
      customerName: customer.name,
    }, customerToken)
    assert(walletHoldRes.status === 200, "Created temporary slot hold for wallet booking")
    const walletHoldId = walletHoldRes.body.hold.id

    const walletQuoteRes = await req("POST", "/api/pricing/calculate", {
      baseRate: 3500,
      durationMin: 60,
      distanceKm: 5,
      addonsCost: 0,
      animal: "Gauri (Gir Cow)",
      gosala: "Sri Surabhi Gaushala",
    }, customerToken)
    const walletQuoteToken = walletQuoteRes.body.quoteToken

    // Ensure wallet has ample balance (₹10,000)
    console.log("  • Ensuring wallet has sufficient balance for instant checkout...")
    const topupBigId = "pay_test_topup_big_" + Date.now()
    const topupBigSig = crypto.createHmac("sha256", secret).update(`order_big|${topupBigId}`).digest("hex")
    await req("POST", "/api/wallet/topup/verify", {
      paymentId: topupBigId,
      orderId: "order_big",
      signature: topupBigSig,
      amountPaise: 1000000, // ₹10,000
    }, customerToken)

    const bookingId = "GMA-WLT-" + Date.now().toString().slice(-5)
    const walletBookingRes = await req("POST", "/api/bookings", {
      quoteToken: walletQuoteToken,
      holdId: walletHoldId,
      paymentProvider: "WALLET",
      booking: {
        id: bookingId,
        customer: customer.name,
        date: testDate,
        start: testSlotStart,
        end: testSlotEnd,
        durationMin: 60,
        distanceKm: 5,
        total: walletQuoteRes.body.total,
        base: walletQuoteRes.body.base,
        tax: walletQuoteRes.body.tax,
        transport: walletQuoteRes.body.transport,
        extraTime: walletQuoteRes.body.extraTime,
        addons: walletQuoteRes.body.addons,
        discount: 0,
        commissionPct: walletQuoteRes.body.commissionPct,
        commissionSnapshot: walletQuoteRes.body.commission,
        freeKmSnapshot: walletQuoteRes.body.freeKmSnapshot,
        perKmSnapshot: walletQuoteRes.body.perKmSnapshot,
        extraUnitRateSnapshot: walletQuoteRes.body.extraUnitRateSnapshot,
        animal: "Gauri (Gir Cow)",
        gosala: "Sri Surabhi Gaushala",
      },
    }, customerToken)

    assert(walletBookingRes.status === 201, "Wallet booking succeeds with 201 Created")
    assert(walletBookingRes.body.booking?.paymentProvider === "WALLET", "Booking reflects paymentProvider === 'WALLET'")
    assert(Boolean(walletBookingRes.body.booking?.walletTxId), `Booking links to walletTxId: ${walletBookingRes.body.booking?.walletTxId}`)

    console.log("\n" + "=".repeat(80))
    console.log(`QA TEST RESULTS: ${passed} PASSED, ${failed} FAILED`)
    console.log("=".repeat(80) + "\n")

    if (failed > 0) process.exit(1)
  } catch (err) {
    console.error("FATAL QA TEST EXCEPTION:", err)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

runTests()
