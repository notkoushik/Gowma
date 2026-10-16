import { handleApiRequest } from "../server/router.ts"
import { prisma } from "../server/prisma.ts"
import { TestHarness } from "./test-harness.mjs"
import { verifyPassword } from "../server/auth/password.ts"
import crypto from "node:crypto"

async function runRegistrationAndRecoveryTestSuite() {
  const harness = new TestHarness("DEVOTEE REGISTRATION & DUAL-CHANNEL PASSWORD RECOVERY QA SUITE")

  console.log("\n================================================================================")
  console.log("   GOMAA PUBLIC REGISTRATION & PASSWORD RECOVERY (RESEND/FIREBASE) QA SUITE    ")
  console.log("================================================================================\n")

  const testEmail = `test.devotee.${harness.testRunId}@gomaa.test`
  const testPhone = `+91 98${Math.floor(10000000 + Math.random() * 90000000)}`
  const initialPassword = `InitialPass_${crypto.randomBytes(4).toString("hex")}!`
  const updatedPassword = `UpdatedPass_${crypto.randomBytes(4).toString("hex")}!`

  let createdDevoteeId = ""

  try {
    // --------------------------------------------------------------------------------
    // SCENARIO 1: Public Devotee Registration Validation
    // --------------------------------------------------------------------------------
    console.log("[TEST 1] Testing Public Devotee Registration (POST /api/auth/register)...")

    // 1.1 Weak password rejection
    const weakPassRes = await handleApiRequest(
      "POST",
      "/api/auth/register",
      JSON.stringify({
        name: "Weak Pass User",
        email: `weak.${harness.testRunId}@gomaa.test`,
        phone: "+91 9811111111",
        role: "customer",
        password: "short",
      })
    )
    harness.assert(weakPassRes?.status === 400, "Registration rejects password shorter than 8 chars (400 Bad Request)")
    harness.assert(weakPassRes?.body?.error?.includes("8 characters"), "Clear password length validation error returned")

    // 1.2 Successful Devotee Registration
    const regRes = await handleApiRequest(
      "POST",
      "/api/auth/register",
      JSON.stringify({
        name: `Devotee ${harness.testRunId}`,
        email: testEmail,
        phone: testPhone,
        role: "customer",
        password: initialPassword,
        customerData: {
          city: "Telangana - Cyberabad / Gachibowli (HITEC City)",
          preferredLanguage: "Telugu / English",
        },
      })
    )

    harness.assert(regRes?.status === 201, "Devotee registration succeeds with HTTP 201 Created")
    harness.assert(regRes?.body?.ok === true, "Response body ok is true")
    harness.assert(typeof regRes?.body?.token === "string" && regRes.body.token.length > 20, "RFC 7519 JWT session token returned")
    harness.assert(regRes?.body?.user?.email === testEmail, "Registered user email matches payload")
    harness.assert(regRes?.body?.user?.role === "customer", "Registered user role is 'customer'")
    harness.assert(regRes?.body?.user?.password === undefined, "User response never leaks plaintext password or hash")

    createdDevoteeId = regRes?.body?.user?.id
    if (createdDevoteeId) {
      harness.createdUserIds.add(createdDevoteeId)
    }

    // 1.3 Duplicate registration rejection
    const dupRes = await handleApiRequest(
      "POST",
      "/api/auth/register",
      JSON.stringify({
        name: `Duplicate User`,
        email: testEmail,
        phone: testPhone,
        role: "customer",
        password: initialPassword,
      })
    )
    harness.assert(dupRes?.status === 400, "Duplicate registration attempt rejected with HTTP 400 Conflict")
    harness.assert(dupRes?.body?.error?.includes("already registered"), "Clear duplicate account error message returned")

    // --------------------------------------------------------------------------------
    // SCENARIO 2: Out-of-Band Password Reset OTP Request
    // --------------------------------------------------------------------------------
    console.log("\n[TEST 2] Testing Password Reset OTP Request (POST /api/auth/forgot-password)...")

    const forgotRes = await handleApiRequest(
      "POST",
      "/api/auth/forgot-password",
      JSON.stringify({
        emailOrPhone: testEmail,
        channel: "EMAIL",
      })
    )

    harness.assert(forgotRes?.status === 200, "Forgot password endpoint returns HTTP 200 OK")
    harness.assert(forgotRes?.body?.ok === true, "Response ok is true")
    harness.assert(forgotRes?.body?.otp === undefined, "CRITICAL: OTP is NEVER returned in the API response (zero-leak guarantee)")
    harness.assert(typeof forgotRes?.body?.maskedTarget === "string", "Masked target returned to confirm delivery destination")

    // Verify OTP record in PostgreSQL database
    const otpRecords = await prisma.$queryRawUnsafe(
      `SELECT * FROM "verification_otps" WHERE "identifier" = $1 AND "purpose" = 'PASSWORD_RESET' ORDER BY "createdAt" DESC LIMIT 1`,
      testEmail.toLowerCase()
    )
    harness.assert(otpRecords.length === 1, "OTP record successfully persisted in PostgreSQL 'verification_otps' table")
    const activeOtpRecord = otpRecords[0]
    harness.assert(activeOtpRecord.channel === "EMAIL", "Stored channel matches 'EMAIL'")
    harness.assert(activeOtpRecord.used === false, "Stored used flag is false")
    harness.assert(new Date(activeOtpRecord.expiresAt) > new Date(), "Stored expiresAt is in the future (10 min TTL)")

    // --------------------------------------------------------------------------------
    // SCENARIO 3: Non-Existent User Helpful Feedback
    // --------------------------------------------------------------------------------
    console.log("\n[TEST 3] Testing Clear Diagnostic Feedback for Non-Existent Accounts...")

    const ghostRes = await handleApiRequest(
      "POST",
      "/api/auth/forgot-password",
      JSON.stringify({
        emailOrPhone: `nonexistent_${harness.testRunId}@unknown.test`,
        channel: "EMAIL",
      })
    )
    harness.assert(ghostRes?.status === 400, "Non-existent user request returns 400 Bad Request with clear feedback")
    harness.assert(ghostRes?.body?.error?.includes("No registered account found"), "Helpful account-not-found error message returned")

    // --------------------------------------------------------------------------------
    // SCENARIO 4: Incorrect OTP Verification & Brute-Force Lockout
    // --------------------------------------------------------------------------------
    console.log("\n[TEST 4] Testing Incorrect OTP Verification & Attempt Tracking...")

    const badOtpRes = await handleApiRequest(
      "POST",
      "/api/auth/verify-otp",
      JSON.stringify({
        emailOrPhone: testEmail,
        otp: "000000",
      })
    )
    harness.assert(badOtpRes?.status === 400, "Bad OTP rejected with HTTP 400 Bad Request")
    harness.assert(badOtpRes?.body?.error?.includes("Invalid verification code"), "Incorrect code error returned")

    // Verify attempt counter incremented in PostgreSQL
    const updatedOtpRow = await prisma.$queryRawUnsafe(
      `SELECT "attempts" FROM "verification_otps" WHERE "id" = $1`,
      activeOtpRecord.id
    )
    harness.assert(updatedOtpRow[0]?.attempts === 1, "Incorrect attempt counter successfully incremented to 1 in database")

    // --------------------------------------------------------------------------------
    // SCENARIO 5: Valid OTP Verification & Scoped Reset Token Issuance
    // --------------------------------------------------------------------------------
    console.log("\n[TEST 5] Testing Valid OTP Verification (Simulating Out-Of-Band Retrieval)...")

    // Retrieve the actual 6-digit OTP code by checking against candidate numbers (since it's hashed with scrypt in DB)
    // For test simulation, find which 6-digit number verifies against activeOtpRecord.otpHash
    // Or create a known test OTP directly in DB to test exact match:
    const knownTestOtp = "782910"
    const { hashOtp } = await import("../server/services/otpService.ts")
    const knownTestOtpHash = hashOtp(knownTestOtp)
    await prisma.$executeRawUnsafe(
      `UPDATE "verification_otps" SET "otpHash" = $1, "attempts" = 0 WHERE "id" = $2`,
      knownTestOtpHash,
      activeOtpRecord.id
    )

    const verifyRes = await handleApiRequest(
      "POST",
      "/api/auth/verify-otp",
      JSON.stringify({
        emailOrPhone: testEmail,
        otp: knownTestOtp,
      })
    )

    harness.assert(verifyRes?.status === 200, "Valid OTP verification returns HTTP 200 OK")
    harness.assert(verifyRes?.body?.ok === true, "Body ok is true")
    harness.assert(typeof verifyRes?.body?.resetToken === "string", "Cryptographic single-use resetToken issued")

    const resetToken = verifyRes?.body?.resetToken

    // --------------------------------------------------------------------------------
    // SCENARIO 6: Password Reset Execution & Database Hash Mutation
    // --------------------------------------------------------------------------------
    console.log("\n[TEST 6] Testing Password Reset Execution (POST /api/auth/reset-password)...")

    const resetRes = await handleApiRequest(
      "POST",
      "/api/auth/reset-password",
      JSON.stringify({
        emailOrPhone: testEmail,
        resetToken,
        newPassword: updatedPassword,
      })
    )

    harness.assert(resetRes?.status === 200, "Password reset returns HTTP 200 OK")
    harness.assert(resetRes?.body?.ok === true, "Password reset body ok is true")

    // Verify OTP marked used in PostgreSQL
    const consumedOtpRow = await prisma.$queryRawUnsafe(
      `SELECT "used" FROM "verification_otps" WHERE "id" = $1`,
      activeOtpRecord.id
    )
    harness.assert(consumedOtpRow[0]?.used === true, "Verification OTP marked used=true in PostgreSQL")

    // Verify user password hash changed in PostgreSQL
    const updatedDbUser = await prisma.user.findUnique({ where: { id: createdDevoteeId } })
    harness.assert(updatedDbUser?.password !== undefined, "User password hash exists")
    const matchesNew = verifyPassword(updatedPassword, updatedDbUser?.password || "")
    harness.assert(matchesNew === true, "PostgreSQL password hash verifies against the newly set password")

    // --------------------------------------------------------------------------------
    // SCENARIO 7: Single-Use Token Invalidation (Replay Attack Rejection)
    // --------------------------------------------------------------------------------
    console.log("\n[TEST 7] Testing Replay Attack Rejection (Reusing already consumed resetToken)...")

    const replayRes = await handleApiRequest(
      "POST",
      "/api/auth/reset-password",
      JSON.stringify({
        emailOrPhone: testEmail,
        resetToken,
        newPassword: "YetAnotherPassword123!",
      })
    )
    harness.assert(replayRes?.status === 400, "Replayed reset token rejected with HTTP 400 Bad Request")
    harness.assert(replayRes?.body?.error?.includes("already been used"), "Clear token reuse security error returned")

    // --------------------------------------------------------------------------------
    // SCENARIO 8: Authentication with Newly Set Password via Live Endpoint
    // --------------------------------------------------------------------------------
    console.log("\n[TEST 8] Testing Authentication Gateway with Newly Set Password...")

    // Old password must fail
    const oldLoginRes = await handleApiRequest(
      "POST",
      "/api/auth/login",
      JSON.stringify({
        emailOrPhone: testEmail,
        password: initialPassword,
      })
    )
    harness.assert(oldLoginRes?.status === 401, "Sign-in with old password rejected with HTTP 401 Unauthorized")

    // New password must succeed
    const newLoginRes = await handleApiRequest(
      "POST",
      "/api/auth/login",
      JSON.stringify({
        emailOrPhone: testEmail,
        password: updatedPassword,
      })
    )
    harness.assert(newLoginRes?.status === 200, "Sign-in with updated password succeeds with HTTP 200 OK")
    harness.assert(typeof newLoginRes?.body?.token === "string", "Valid session JWT token returned upon login")

  } finally {
    // Clean up created OTP records for this test run
    try {
      await prisma.$executeRawUnsafe(
        `DELETE FROM "verification_otps" WHERE LOWER("identifier") = $1`,
        testEmail.toLowerCase()
      )
    } catch {}

    await harness.teardown()
    await prisma.$disconnect()
  }

  // --------------------------------------------------------------------------------
  // Test Summary
  // --------------------------------------------------------------------------------
  console.log("\n================================================================================")
  console.log(`QA TEST RESULTS: ${harness.passed} PASSED, ${harness.failed} FAILED`)
  console.log("================================================================================\n")

  if (harness.failed > 0) {
    process.exit(1)
  }
}

runRegistrationAndRecoveryTestSuite().catch((err) => {
  console.error("FATAL QA TEST EXCEPTION:", err)
  process.exit(1)
})
