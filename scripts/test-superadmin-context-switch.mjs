import { handleApiRequest } from "../server/router.ts"
import { prisma } from "../server/prisma.ts"
import { verifyJwt } from "../server/auth/jwt.ts"
import { TestHarness } from "./test-harness.mjs"
import crypto from "node:crypto"

async function runSuperAdminContextSwitchTestSuite() {
  const harness = new TestHarness("SUPER ADMIN CONTEXT SWITCHING & MULTI-TENANT GAUSHALA ISOLATION QA SUITE")

  console.log("\n================================================================================")
  console.log("   SUPER ADMIN CONTEXT SWITCHING & MULTI-TENANT GAUSHALA ISOLATION QA SUITE    ")
  console.log("================================================================================\n")

  try {
    // --------------------------------------------------------------------------------
    // Setup: Dynamically Fetch/Provision Test Users via PostgreSQL
    // --------------------------------------------------------------------------------
    console.log("[SETUP] Resolving test personas dynamically from PostgreSQL database...")

    const saUser = await harness.resolveOrCreateUser("SUPER_ADMIN")
    const opsUser = await harness.resolveOrCreateUser("OPERATIONS_ADMIN")
    const mgrUser = await harness.resolveOrCreateUser("GOSALA_MANAGER")
    const custUser = await harness.resolveOrCreateUser("CUSTOMER")

    console.log(`  • Super Admin:     ${saUser.name} (${saUser.email})`)
    console.log(`  • Operations Admin: ${opsUser.name} (${opsUser.email})`)
    console.log(`  • Gosala Manager:   ${mgrUser.name} (${mgrUser.email})`)
    console.log(`  • Customer:         ${custUser.name} (${custUser.email})`)

    console.log("\n[SETUP] Dynamically authenticating test personas via live API...")

    const saSession = await harness.loginWithDynamicPassword(saUser)
    harness.assert(saSession?.token, "Super Admin dynamically authenticated via live /api/auth/login")
    const saCaptainToken = saSession.token
    const saCaptainHeaders = saSession.headers

    const opsSession = await harness.loginWithDynamicPassword(opsUser)
    harness.assert(opsSession?.token, "Operations Admin dynamically authenticated via live /api/auth/login")
    const opsToken = opsSession.token
    const opsHeaders = opsSession.headers

    const mgrSession = await harness.loginWithDynamicPassword(mgrUser)
    harness.assert(mgrSession?.token, "Gaushala Manager dynamically authenticated via live /api/auth/login")
    const mgrToken = mgrSession.token
    const mgrHeaders = mgrSession.headers

    const custSession = await harness.loginWithDynamicPassword(custUser)
    harness.assert(custSession?.token, "Customer Devotee dynamically authenticated via live /api/auth/login")
    const custToken = custSession.token
    const custHeaders = custSession.headers

    // --------------------------------------------------------------------------------
    // Scenario 1: Super Admin Authentic Step-Down to Operations Admin ("Operations" Mode)
    // --------------------------------------------------------------------------------
    console.log("\n[TEST 1] Testing Super Admin Step-Down Context Switch to Operations Admin...")
    const stepDownRes = await handleApiRequest(
      "POST",
      "/api/auth/switch-context",
      JSON.stringify({ targetRole: "admin" }),
      saCaptainHeaders
    )

    harness.assert(stepDownRes?.status === 200, "Step-down returns HTTP 200 OK", `status=${stepDownRes?.status}`)
    harness.assert(stepDownRes?.body?.ok === true, "Response payload ok is true")
    harness.assert(typeof stepDownRes?.body?.token === "string", "New scoped Context JWT token is issued")

    // Deep Cryptographic & Invariant Token Checks
    const opsContextToken = stepDownRes?.body?.token
    const verifiedOpsJwt = verifyJwt(opsContextToken)
    harness.assert(verifiedOpsJwt.valid === true, "Context token signature verifies successfully via HMAC-SHA256")
    harness.assert(verifiedOpsJwt.payload?.role === "admin", "Scoped token role is 'admin'")
    harness.assert(verifiedOpsJwt.payload?.dbRole === "OPERATIONS_ADMIN", "Scoped token dbRole is 'OPERATIONS_ADMIN'")
    harness.assert(verifiedOpsJwt.payload?.originalRole === "super_admin", "originalRole preserves 'super_admin' provenance")
    harness.assert(verifiedOpsJwt.payload?.isContextSwitched === true, "isContextSwitched flag is true")
    harness.assert(typeof verifiedOpsJwt.payload?.contextSwitchedAt === "number", "contextSwitchedAt timestamp is present")
    harness.assert(stepDownRes?.body?.user?.role === "admin", "User object returned matches active switched role 'admin'")
    harness.assert(stepDownRes?.body?.user?.originalRole === "super_admin", "User object retains originalRole 'super_admin'")

    const opsContextHeaders = { authorization: `Bearer ${opsContextToken}` }

    // --------------------------------------------------------------------------------
    // Scenario 2: Scoped Gaushala Isolation in Switched Operations Mode vs Captain Mode
    // --------------------------------------------------------------------------------
    console.log("\n[TEST 2] Testing Multi-Tenant Gaushala Scoping between Captain and Operations Mode...")

    // Setup distinct dynamic Gaushalas for testing multi-tenant boundaries
    const saGosalaName = `${saUser.name} Personal Sanctuary ${harness.testRunId}`
    const opsGosalaName = `${opsUser.name} Regional Sanctuary ${harness.testRunId}`

    // Super Admin in Operations Mode creates personal Gaushala
    const createSaGosala = await handleApiRequest(
      "POST",
      "/api/gosalas",
      JSON.stringify({
        name: saGosalaName,
        region: "Hyderabad Zone",
        address: `Survey ${Math.floor(100 + Math.random() * 900)}, Divine Valley`,
        governingAdminEmail: saUser.email,
        governingAdminName: saUser.name,
      }),
      opsContextHeaders
    )
    harness.assert(createSaGosala?.status === 201, "Super Admin in Operations mode created personal Gaushala")
    if (createSaGosala?.body?.gosala?.id) {
      harness.createdGosalaIds.add(createSaGosala.body.gosala.id)
    }

    // Regular Operations Admin creates their regional Gaushala
    const createOpsGosala = await handleApiRequest(
      "POST",
      "/api/gosalas",
      JSON.stringify({
        name: opsGosalaName,
        region: "Vijayawada Zone",
        address: `Plot ${Math.floor(10 + Math.random() * 90)}, Regional Sector`,
        governingAdminEmail: opsUser.email,
        governingAdminName: opsUser.name,
      }),
      opsHeaders
    )
    harness.assert(createOpsGosala?.status === 201, "Regular Operations Admin created their regional Gaushala")
    if (createOpsGosala?.body?.gosala?.id) {
      harness.createdGosalaIds.add(createOpsGosala.body.gosala.id)
    }

    // Check 2.1: Switched Operations Mode for Super Admin
    const saOpsView = await handleApiRequest("GET", "/api/gosalas", "", opsContextHeaders)
    harness.assert(saOpsView?.status === 200, "GET /api/gosalas succeeds in switched operations mode")
    const saOpsGosalas = saOpsView?.body?.gosalas || []
    const hasSaPersonal = saOpsGosalas.some(g => g.name === saGosalaName)
    const hasOpsGaushalaInSaOps = saOpsGosalas.some(g => g.name === opsGosalaName)
    harness.assert(hasSaPersonal, "Super Admin in Operations mode can see their own created Gaushala")
    harness.assert(!hasOpsGaushalaInSaOps, "Super Admin in Operations mode CANNOT see other Operations Admin's Gaushala (strict data isolation)")

    // Check 2.2: Regular Operations Admin view
    const regularOpsView = await handleApiRequest("GET", "/api/gosalas", "", opsHeaders)
    const regularOpsGosalas = regularOpsView?.body?.gosalas || []
    const hasOpsInRegular = regularOpsGosalas.some(g => g.name === opsGosalaName)
    const hasSaInRegular = regularOpsGosalas.some(g => g.name === saGosalaName)
    harness.assert(hasOpsInRegular, "Regular Operations Admin can see their own created Gaushala")
    harness.assert(!hasSaInRegular, `Regular Operations Admin CANNOT see ${saUser.name}'s Gaushala (cross-tenant leakage denied)`)

    // Check 2.3: Super Admin in Captain Mode (Global Network Oversight)
    const saCaptainView = await handleApiRequest("GET", "/api/gosalas", "", saCaptainHeaders)
    const saCaptainGosalas = saCaptainView?.body?.gosalas || []
    const hasBothInCaptain =
      saCaptainGosalas.some(g => g.name === saGosalaName) &&
      saCaptainGosalas.some(g => g.name === opsGosalaName)
    harness.assert(hasBothInCaptain, "Super Admin in Captain mode sees ALL Gaushalas across all Operations Admins (Sovereign Platform Authority)")

    // --------------------------------------------------------------------------------
    // Scenario 3: Super Admin Step-Up Back to Sovereign Captain Mode
    // --------------------------------------------------------------------------------
    console.log("\n[TEST 3] Testing Super Admin Step-Up Back to Sovereign Captain Mode...")
    const stepUpRes = await handleApiRequest(
      "POST",
      "/api/auth/switch-context",
      JSON.stringify({ targetRole: "super_admin" }),
      opsContextHeaders
    )

    harness.assert(stepUpRes?.status === 200, "Step-up returns HTTP 200 OK")
    harness.assert(stepUpRes?.body?.ok === true, "Step-up body.ok is true")
    const restoredCaptainToken = stepUpRes?.body?.token
    const verifiedCaptainJwt = verifyJwt(restoredCaptainToken)
    harness.assert(verifiedCaptainJwt.valid === true, "Restored Captain token signature verifies successfully")
    harness.assert(verifiedCaptainJwt.payload?.role === "super_admin", "Role restored to 'super_admin'")
    harness.assert(verifiedCaptainJwt.payload?.dbRole === "SUPER_ADMIN", "dbRole restored to 'SUPER_ADMIN'")
    harness.assert(verifiedCaptainJwt.payload?.isContextSwitched === false, "isContextSwitched flag is false")
    harness.assert(stepUpRes?.body?.user?.assignedGosalaNames?.includes("All Network Gaushalas"), "assignedGosalaNames restores global roster")

    // --------------------------------------------------------------------------------
    // Scenario 4: Privilege Escalation Attack by Regular Operations Admin (Attempt to become Captain)
    // --------------------------------------------------------------------------------
    console.log("\n[TEST 4] Testing Privilege Escalation Attack: Regular Operations Admin -> Captain...")
    const opsEscalateRes = await handleApiRequest(
      "POST",
      "/api/auth/switch-context",
      JSON.stringify({ targetRole: "super_admin" }),
      opsHeaders
    )
    harness.assert(opsEscalateRes?.status === 403, "Privilege escalation attempt rejected with HTTP 403 Forbidden", `status=${opsEscalateRes?.status}`)
    harness.assert(opsEscalateRes?.body?.ok === false, "Response body.ok is false")
    harness.assert(
      opsEscalateRes?.body?.error?.includes("Only genuine Super Admin accounts can switch execution context"),
      "Clear security audit error returned"
    )

    // Verify PostgreSQL DB role remains uncorrupted
    const opsDbUser = await prisma.user.findUnique({ where: { id: opsUser.id } })
    harness.assert(opsDbUser?.role === "OPERATIONS_ADMIN", "PostgreSQL database role is strictly unchanged (OPERATIONS_ADMIN)")

    // --------------------------------------------------------------------------------
    // Scenario 5: Non-Super-Admin Context Switch Denial (Even to 'admin')
    // --------------------------------------------------------------------------------
    console.log("\n[TEST 5] Testing Non-Super-Admin Context Switch Denial (Target: 'admin')...")
    const opsSwitchSelf = await handleApiRequest(
      "POST",
      "/api/auth/switch-context",
      JSON.stringify({ targetRole: "admin" }),
      opsHeaders
    )
    harness.assert(opsSwitchSelf?.status === 403, "Regular Operations Admin cannot call switch-context even for 'admin'", `status=${opsSwitchSelf?.status}`)

    // --------------------------------------------------------------------------------
    // Scenario 6: Privilege Escalation Attack by Gaushala Manager
    // --------------------------------------------------------------------------------
    console.log("\n[TEST 6] Testing Privilege Escalation Attack: Gaushala Manager -> Captain...")
    const mgrEscalate = await handleApiRequest(
      "POST",
      "/api/auth/switch-context",
      JSON.stringify({ targetRole: "super_admin" }),
      mgrHeaders
    )
    harness.assert(mgrEscalate?.status === 403, "Manager context switch rejected with HTTP 403 Forbidden")

    // --------------------------------------------------------------------------------
    // Scenario 7: Privilege Escalation Attack by Devotee / Customer
    // --------------------------------------------------------------------------------
    console.log("\n[TEST 7] Testing Privilege Escalation Attack: Customer Devotee -> Captain...")
    const custEscalate = await handleApiRequest(
      "POST",
      "/api/auth/switch-context",
      JSON.stringify({ targetRole: "super_admin" }),
      custHeaders
    )
    harness.assert(custEscalate?.status === 403, "Customer context switch rejected with HTTP 403 Forbidden")

    // --------------------------------------------------------------------------------
    // Scenario 8: Unauthenticated Session Rejection
    // --------------------------------------------------------------------------------
    console.log("\n[TEST 8] Testing Unauthenticated Session Rejection...")
    const unauthRes = await handleApiRequest(
      "POST",
      "/api/auth/switch-context",
      JSON.stringify({ targetRole: "admin" }),
      {}
    )
    harness.assert(unauthRes?.status === 401, "Unauthenticated request rejected with HTTP 401 Unauthorized")
    harness.assert(unauthRes?.body?.ok === false, "Response body.ok is false")

    // --------------------------------------------------------------------------------
    // Scenario 9: Cryptographic Tampering & Forgery Rejection
    // --------------------------------------------------------------------------------
    console.log("\n[TEST 9] Testing Cryptographic Tampering & Forged Token Rejection...")

    // Create forged token claiming to be Super Admin signed with malicious key
    const maliciousSecret = "completely_wrong_secret_key_used_by_attacker"
    const forgedPayload = {
      userId: saUser.id,
      name: saUser.name,
      email: saUser.email,
      role: "super_admin",
      dbRole: "SUPER_ADMIN",
      gosalaIds: [],
      gosalaNames: ["All Network Gaushalas"],
      originalRole: "super_admin",
      isContextSwitched: false,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    }
    const headerB64 = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")
    const payloadB64 = Buffer.from(JSON.stringify(forgedPayload)).toString("base64url")
    const dataToSign = `${headerB64}.${payloadB64}`
    const forgedSig = crypto.createHmac("sha256", maliciousSecret).update(dataToSign).digest("base64url")
    const forgedToken = `${dataToSign}.${forgedSig}`

    const forgedRes = await handleApiRequest(
      "POST",
      "/api/auth/switch-context",
      JSON.stringify({ targetRole: "admin" }),
      { authorization: `Bearer ${forgedToken}` }
    )
    harness.assert(forgedRes?.status === 401, "Forged token with wrong signature rejected with HTTP 401 Unauthorized")

    // Tamper with valid token payload (e.g. flipping a byte in payload)
    const tokenParts = saCaptainToken.split(".")
    const tamperedPayloadB64 = tokenParts[1].substring(0, tokenParts[1].length - 2) + "=="
    const tamperedToken = `${tokenParts[0]}.${tamperedPayloadB64}.${tokenParts[2]}`

    const tamperedRes = await handleApiRequest(
      "POST",
      "/api/auth/switch-context",
      JSON.stringify({ targetRole: "admin" }),
      { authorization: `Bearer ${tamperedToken}` }
    )
    harness.assert(tamperedRes?.status === 401, "Payload-tampered token rejected with HTTP 401 Unauthorized")

    // --------------------------------------------------------------------------------
    // Scenario 10: Input Boundary & Malformed Payload Validation
    // --------------------------------------------------------------------------------
    console.log("\n[TEST 10] Testing Input Boundary & Malformed Payload Validation...")

    const invalidRoles = ["driver", "manager", "customer", "HACKER", "", null, 12345]
    for (const badRole of invalidRoles) {
      const badRoleRes = await handleApiRequest(
        "POST",
        "/api/auth/switch-context",
        JSON.stringify({ targetRole: badRole }),
        saCaptainHeaders
      )
      harness.assert(badRoleRes?.status === 400, `Invalid targetRole '${badRole}' rejected with HTTP 400 Bad Request`)
    }

    const emptyBodyRes = await handleApiRequest(
      "POST",
      "/api/auth/switch-context",
      "",
      saCaptainHeaders
    )
    harness.assert(emptyBodyRes?.status === 400, "Empty payload body rejected with HTTP 400 Bad Request")

    // --------------------------------------------------------------------------------
    // Scenario 11: Rapid Repeated Context Switching (Idempotency & Lifecycle Stability)
    // --------------------------------------------------------------------------------
    console.log("\n[TEST 11] Testing Rapid Repeated Context Switching Stability (5 roundtrips)...")
    let currentToken = saCaptainToken
    let currentRole = "super_admin"
    let cyclesPassed = 0

    for (let i = 0; i < 5; i++) {
      const nextTarget = currentRole === "super_admin" ? "admin" : "super_admin"
      const cycleRes = await handleApiRequest(
        "POST",
        "/api/auth/switch-context",
        JSON.stringify({ targetRole: nextTarget }),
        { authorization: `Bearer ${currentToken}` }
      )
      if (cycleRes?.status === 200 && cycleRes?.body?.token) {
        currentToken = cycleRes.body.token
        currentRole = nextTarget
        cyclesPassed++
      }
    }
    harness.assert(cyclesPassed === 5, "All 5 rapid context transitions succeeded with 200 OK")

    // Restore back to Captain if ended on admin
    if (currentRole === "admin") {
      const restoreRes = await handleApiRequest(
        "POST",
        "/api/auth/switch-context",
        JSON.stringify({ targetRole: "super_admin" }),
        { authorization: `Bearer ${currentToken}` }
      )
      harness.assert(restoreRes?.status === 200, "Cleanly restored to Captain after stability test")
    }

    // --------------------------------------------------------------------------------
    // Scenario 12: GET /api/auth/me Invariant Verification
    // --------------------------------------------------------------------------------
    console.log("\n[TEST 12] Testing GET /api/auth/me Session Invariant Checks...")

    // In Captain mode:
    const meCaptainRes = await handleApiRequest("GET", "/api/auth/me", "", saCaptainHeaders)
    harness.assert(meCaptainRes?.status === 200, "GET /api/auth/me responds 200 in Captain mode")
    harness.assert(meCaptainRes?.body?.user?.role === "super_admin", "Me user role is 'super_admin' in Captain mode")
    harness.assert(meCaptainRes?.body?.user?.originalRole === "super_admin", "Me user retains originalRole 'super_admin'")

    // In Operations mode:
    const meOpsRes = await handleApiRequest("GET", "/api/auth/me", "", opsContextHeaders)
    harness.assert(meOpsRes?.status === 200, "GET /api/auth/me responds 200 in Operations mode")
    harness.assert(meOpsRes?.body?.user?.role === "admin", "Me user role is 'admin' in Operations mode")
    harness.assert(meOpsRes?.body?.user?.originalRole === "super_admin", "Me user retains originalRole 'super_admin'")
    harness.assert(meOpsRes?.body?.user?.isContextSwitched === true, "Me user has isContextSwitched flag true")

  } finally {
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

runSuperAdminContextSwitchTestSuite().catch((err) => {
  console.error("FATAL QA TEST EXCEPTION:", err)
  process.exit(1)
})
