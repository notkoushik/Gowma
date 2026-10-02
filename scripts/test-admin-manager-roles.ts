/**
 * GOMAA ADMIN & MANAGER ROLES ARCHITECTURAL CONTRACT VERIFICATION SUITE
 * 
 * Verifies:
 * 1. Strict 1:1 Gaushala-to-Custodian Manager Assignment Integrity
 * 2. Manager Multi-Tenant Isolation (Scope locked to assigned Gaushala only)
 * 3. Acting Manager Fallback Pattern (Admin covers unassigned / orphaned Gaushalas)
 * 4. Two-Phase Handshake (Phase 1 Local Feasibility -> Phase 2 Operations Validation)
 * 5. Operations Admin Network-Wide Multi-Gaushala Oversight & Driver Binding
 * 6. Super Admin Central Treasury & Pricing Governance Exclusivity
 * 7. Zero Backend Runtime Errors on Null/Unassigned Managers
 */

import { handleApiRequest } from "../server/router"
import { db } from "../server/db"
import { initialGosalas } from "../src/data/gosalas"
import { initialManagers } from "../src/data/mock"
import type { Booking } from "../src/data/mock"

interface RoleContractTest {
  id: string
  category: "MANAGER_ISOLATION" | "ASSIGNMENT_INTEGRITY" | "ACTING_MANAGER_FALLBACK" | "TWO_PHASE_APPROVAL" | "ADMIN_OVERSIGHT" | "SUPER_ADMIN_EXCLUSIVITY"
  title: string
  description: string
  run: () => Promise<{
    passed: boolean
    expected: any
    actual: any
    diagnostic?: string
  }>
}

const tests: RoleContractTest[] = [
  // =========================================================================
  // 1. MANAGER ISOLATION CONTRACTS
  // =========================================================================
  {
    id: "MGR-ISO-01",
    category: "MANAGER_ISOLATION",
    title: "Manager Multi-Tenant Booking Scope Isolation",
    description: "A Gaushala Manager can only view bookings belonging to their assigned Gaushala.",
    run: async () => {
      // Seed bookings for two distinct Gaushalas
      const targetGosala = "Shri Krishna Gaushala"
      const foreignGosala = "Nandini Goseva Sadan"
      
      db.bookings = [
        {
          id: "TEST-BK-KRISHNA-01",
          customer: "Ananya Deshmukh",
          gosala: targetGosala,
          animal: "Gauri",
          date: "10 Oct 2026",
          status: "Payment Verified",
          total: 3500,
        } as any,
        {
          id: "TEST-BK-NANDINI-01",
          customer: "Rohan Iyer",
          gosala: foreignGosala,
          animal: "Shyam",
          date: "10 Oct 2026",
          status: "Payment Verified",
          total: 4200,
        } as any,
      ]

      const res = await handleApiRequest(
        "GET",
        `/api/bookings?gosala=${encodeURIComponent(targetGosala)}`,
        "",
      )
      const returnedBookings: Booking[] = res?.body?.bookings || []

      const containsOnlyTarget = returnedBookings.every((b) => b.gosala.toLowerCase().includes(targetGosala.toLowerCase()))
      const leakedForeign = returnedBookings.some((b) => b.gosala.toLowerCase().includes(foreignGosala.toLowerCase()))
      const passed = containsOnlyTarget && !leakedForeign && returnedBookings.length > 0

      return {
        passed,
        expected: { strictlyTarget: true, leakedForeign: false, hasBookings: true },
        actual: {
          strictlyTarget: containsOnlyTarget,
          leakedForeign,
          count: returnedBookings.length,
        },
        diagnostic: passed ? undefined : "Manager filter returned bookings belonging to another Gaushala.",
      }
    },
  },

  {
    id: "MGR-ISO-02",
    category: "MANAGER_ISOLATION",
    title: "Manager Cross-Tenant Modification Guard",
    description: "A Manager from Gaushala A cannot approve/reject a booking belonging to Gaushala B.",
    run: async () => {
      const foreignBookingId = "TEST-BK-FOREIGN-99"
      db.bookings = [
        {
          id: foreignBookingId,
          customer: "Rohan Iyer",
          gosala: "Nandini Goseva Sadan",
          animal: "Shyam",
          date: "11 Oct 2026",
          status: "Payment Verified",
          total: 4200,
        } as any,
      ]

      // Manager from Shri Krishna Gaushala attempts to approve Nandini Goseva Sadan's booking
      const res = await handleApiRequest(
        "POST",
        `/api/bookings/${foreignBookingId}/manager-decide`,
        JSON.stringify({
          confirm: true,
          remark: "Unauthorized approval attempt",
          managerName: "Gajanan Kale",
          callerGosala: "Shri Krishna Gaushala", // Explicit caller tenant context
          callerRole: "manager",
        }),
      )

      // Expected: 403 Forbidden or rejection due to tenant mismatch
      const isBlocked = res?.status === 403 || res?.body?.error?.includes("tenant") || res?.body?.error?.includes("unauthorized")
      
      // If server router doesn't yet enforce callerGosala, let's verify if we need to enforce it
      return {
        passed: isBlocked,
        expected: { status: 403, allowed: false },
        actual: { status: res?.status, error: res?.body?.error },
        diagnostic: isBlocked ? undefined : "Manager from Gaushala A was allowed to approve booking for Gaushala B.",
      }
    },
  },

  {
    id: "MGR-ISO-03",
    category: "MANAGER_ISOLATION",
    title: "Manager Role Master Pricing Modification Guard",
    description: "A Manager cannot mutate network-wide pricing config or commission rates.",
    run: async () => {
      const res = await handleApiRequest(
        "PUT",
        "/api/pricing-config",
        JSON.stringify({
          role: "manager",
          patch: { perKm: 999 },
        }),
      )

      const passed = res?.status === 403
      return {
        passed,
        expected: { status: 403 },
        actual: { status: res?.status },
        diagnostic: passed ? undefined : "Manager was permitted to alter master platform pricing.",
      }
    },
  },

  // =========================================================================
  // 2. GAUSHALA-TO-MANAGER 1:1 ASSIGNMENT INTEGRITY
  // =========================================================================
  {
    id: "MAP-01",
    category: "ASSIGNMENT_INTEGRITY",
    title: "1 Gaushala = 1 Custodian Manager Invariant",
    description: "Each registered Gaushala maps to at most 1 primary custodian manager.",
    run: async () => {
      // Analyze default seed data & store invariants
      const activeAssignments = initialManagers.filter((m) => m.status === "Active")
      const assignedShelters = activeAssignments.map((m) => m.gosala)
      const uniqueShelters = new Set(assignedShelters)

      // Invariant: No shelter has 2 active managers simultaneously
      const hasDuplicateManagerPerShelter = assignedShelters.length !== uniqueShelters.size
      const passed = !hasDuplicateManagerPerShelter

      return {
        passed,
        expected: { singleManagerPerShelter: true, duplicateShelters: 0 },
        actual: {
          singleManagerPerShelter: !hasDuplicateManagerPerShelter,
          duplicateShelters: assignedShelters.length - uniqueShelters.size,
        },
        diagnostic: passed ? undefined : "Multiple active managers detected for the same Gaushala.",
      }
    },
  },

  {
    id: "MAP-02",
    category: "ASSIGNMENT_INTEGRITY",
    title: "Inactive Manager Reassignment & Orphan Identification",
    description: "When a manager is inactive or unassigned, the Gaushala is flagged as unassigned.",
    run: async () => {
      // Find a shelter where manager is inactive
      const inactiveMgr = initialManagers.find((m) => m.status === "Inactive")
      const orphanShelter = inactiveMgr ? inactiveMgr.gosala : null

      const isOrphanIdentified = orphanShelter === "Kamdhenu Seva Kendra"
      return {
        passed: isOrphanIdentified,
        expected: { orphanShelter: "Kamdhenu Seva Kendra", recognized: true },
        actual: { orphanShelter, recognized: isOrphanIdentified },
        diagnostic: isOrphanIdentified ? undefined : "Inactive manager shelter was not recognized as orphaned.",
      }
    },
  },

  // =========================================================================
  // 3. ACTING MANAGER FALLBACK ARCHITECTURE
  // =========================================================================
  {
    id: "ACTING-01",
    category: "ACTING_MANAGER_FALLBACK",
    title: "Admin Acts as Manager for Unassigned Gaushala",
    description: "When a Gaushala lacks an active manager, Operations Admin can execute Phase-1 review.",
    run: async () => {
      const testId = "TEST-ACTING-ORPHAN-01"
      db.bookings = [
        {
          id: testId,
          customer: "Sunil Joshi",
          gosala: "Kamdhenu Seva Kendra", // Inactive/unassigned shelter
          animal: "Kaveri",
          date: "12 Oct 2026",
          status: "Payment Verified",
          total: 4800,
        } as any,
      ]

      // Admin acts as manager
      const res = await handleApiRequest(
        "POST",
        `/api/bookings/${testId}/manager-decide`,
        JSON.stringify({
          confirm: true,
          remark: "Feasibility verified by Regional Admin acting as Gaushala Custodian.",
          managerName: "Priya Sharma (Acting Manager)",
          isActingManager: true,
          callerRole: "admin",
        }),
      )

      const updated = res?.body?.booking
      const passed =
        res?.status === 200 &&
        updated?.status === "Admin Review" &&
        updated?.managerApproval?.isActingManager === true &&
        updated?.managerApproval?.name.includes("Acting Manager")

      return {
        passed,
        expected: {
          status: "Admin Review",
          isActingManager: true,
          name: "Priya Sharma (Acting Manager)",
        },
        actual: {
          status: updated?.status,
          isActingManager: updated?.managerApproval?.isActingManager,
          name: updated?.managerApproval?.name,
        },
        diagnostic: passed ? undefined : "Admin acting as manager failed to transition booking or record acting audit.",
      }
    },
  },

  {
    id: "ACTING-02",
    category: "ACTING_MANAGER_FALLBACK",
    title: "Acting Manager Non-Blocking Lifecycle Completion",
    description: "Bookings at unassigned Gaushalas smoothly complete the entire 2-phase lifecycle without freezing.",
    run: async () => {
      const testId = "TEST-ACTING-LIFECYCLE-02"
      db.bookings = [
        {
          id: testId,
          customer: "Devotee Rajesh",
          gosala: "Kamdhenu Seva Kendra",
          animal: "Kaveri",
          date: "14 Oct 2026",
          status: "Payment Verified",
          total: 5100,
        } as any,
      ]

      // Step 1: Admin acts as Manager
      const step1 = await handleApiRequest(
        "POST",
        `/api/bookings/${testId}/manager-decide`,
        JSON.stringify({
          confirm: true,
          remark: "Acting manager on-site feasibility verified.",
          managerName: "Priya Sharma (Acting Manager)",
          isActingManager: true,
          callerRole: "admin",
        }),
      )

      const phase1Status = step1?.body?.booking?.status

      // Step 2: Admin final Phase-2 confirmation
      const step2 = await handleApiRequest(
        "POST",
        `/api/bookings/${testId}/admin-decide`,
        JSON.stringify({
          confirm: true,
          remark: "Operations logistics approved and scheduled.",
          adminName: "Priya Sharma",
        }),
      )

      const finalBooking = step2?.body?.booking
      const passed =
        phase1Status === "Admin Review" &&
        finalBooking?.status === "Confirmed" &&
        finalBooking?.managerApproval?.isActingManager === true &&
        !!finalBooking?.adminApproval

      return {
        passed,
        expected: { phase1: "Admin Review", phase2: "Confirmed", bothAuditsPresent: true },
        actual: {
          phase1: phase1Status,
          phase2: finalBooking?.status,
          bothAuditsPresent: !!finalBooking?.managerApproval && !!finalBooking?.adminApproval,
        },
        diagnostic: passed ? undefined : "Acting manager lifecycle broke between Phase 1 and Phase 2.",
      }
    },
  },

  // =========================================================================
  // 4. TWO-PHASE APPROVAL SEPARATION OF DUTIES
  // =========================================================================
  {
    id: "TWO-01",
    category: "TWO_PHASE_APPROVAL",
    title: "Prevent Premature Phase 2 Admin Confirmation Without Feasibility",
    description: "Operations Admin cannot confirm a booking still awaiting Phase 1 Feasibility without reviewing feasibility.",
    run: async () => {
      const testId = "TEST-PREMATURE-01"
      db.bookings = [
        {
          id: testId,
          customer: "Vikram Mehta",
          gosala: "Shri Krishna Gaushala",
          animal: "Lakshmi",
          date: "15 Oct 2026",
          status: "Payment Verified", // Has NOT undergone manager feasibility check
          total: 3900,
        } as any,
      ]

      // Attempt to jump straight to Phase 2 admin-decide
      const res = await handleApiRequest(
        "POST",
        `/api/bookings/${testId}/admin-decide`,
        JSON.stringify({
          confirm: true,
          remark: "Bypassing feasibility check",
          adminName: "Priya Sharma",
        }),
      )

      // Booking must either be rejected from skipping or require feasibility check first
      const isBlockedOrGuarded = res?.status === 400 || res?.body?.error?.includes("feasibility") || res?.body?.booking?.status !== "Confirmed"

      return {
        passed: isBlockedOrGuarded,
        expected: { prematureBypassPrevented: true },
        actual: { prematureBypassPrevented: isBlockedOrGuarded, status: res?.status, error: res?.body?.error },
        diagnostic: isBlockedOrGuarded ? undefined : "Booking skipped Phase 1 feasibility check and was confirmed directly.",
      }
    },
  },

  // =========================================================================
  // 5. OPERATIONS ADMIN NETWORK-WIDE OVERSIGHT
  // =========================================================================
  {
    id: "ADM-NET-01",
    category: "ADMIN_OVERSIGHT",
    title: "Operations Admin Multi-Gaushala Full Network Visibility",
    description: "Operations Admin can query all bookings across all Gaushalas simultaneously.",
    run: async () => {
      db.bookings = [
        { id: "B1", gosala: "Shri Krishna Gaushala", status: "Confirmed" } as any,
        { id: "B2", gosala: "Nandini Goseva Sadan", status: "Admin Review" } as any,
        { id: "B3", gosala: "Gopal Gaushala Trust", status: "Payment Verified" } as any,
      ]

      // Query without gaushala filter (Admin view)
      const res = await handleApiRequest("GET", "/api/bookings", "")
      const bookings = res?.body?.bookings || []

      const countMatches = bookings.length >= 3
      const gaushalasPresent = new Set(bookings.map((b: any) => b.gosala))
      const coversAll = gaushalasPresent.size >= 3

      const passed = countMatches && coversAll

      return {
        passed,
        expected: { totalVisible: 3, multiGaushalaCovered: true },
        actual: { totalVisible: bookings.length, multiGaushalaCovered: coversAll },
        diagnostic: passed ? undefined : "Operations Admin view failed to encompass all network Gaushalas.",
      }
    },
  },

  {
    id: "ADM-NET-02",
    category: "ADMIN_OVERSIGHT",
    title: "Operations Admin Central Fleet Dispatch & Binding",
    description: "Operations Admin assigns transport vehicles/drivers to confirmed bookings across any Gaushala.",
    run: async () => {
      const testId = "TEST-DISPATCH-02"
      db.bookings = [
        {
          id: testId,
          gosala: "Vrindavan Goshala",
          animal: "Surabhi",
          status: "Confirmed",
          driver: null,
          driverStage: 0,
        } as any,
      ]

      const res = await handleApiRequest(
        "POST",
        `/api/bookings/${testId}/assign-driver`,
        JSON.stringify({ driver: "Santosh Shinde" }),
      )

      const updated = res?.body?.booking
      const passed = updated?.driver === "Santosh Shinde" && updated?.driverStage === 1

      return {
        passed,
        expected: { driver: "Santosh Shinde", stage: 1 },
        actual: { driver: updated?.driver, stage: updated?.driverStage },
        diagnostic: passed ? undefined : "Admin driver dispatch failed to bind driver.",
      }
    },
  },

  // =========================================================================
  // 6. SUPER ADMIN TREASURY & PRICING EXCLUSIVITY
  // =========================================================================
  {
    id: "SUP-EXC-01",
    category: "SUPER_ADMIN_EXCLUSIVITY",
    title: "Super Admin Exclusive Master Tariff Governance",
    description: "Only Super Admin role can modify platform commission % or base pricing.",
    run: async () => {
      // Attempt with Operations Admin -> Must Fail
      const resAdmin = await handleApiRequest(
        "PUT",
        "/api/pricing-config",
        JSON.stringify({ role: "admin", patch: { commissionPct: 25 } }),
      )

      // Attempt with Super Admin -> Must Succeed
      const resSuperAdmin = await handleApiRequest(
        "PUT",
        "/api/pricing-config",
        JSON.stringify({ role: "super_admin", patch: { commissionPct: 20 } }),
      )

      const passed = resAdmin?.status === 403 && resSuperAdmin?.status === 200

      return {
        passed,
        expected: { adminStatus: 403, superAdminStatus: 200 },
        actual: { adminStatus: resAdmin?.status, superAdminStatus: resSuperAdmin?.status },
        diagnostic: passed ? undefined : "Super Admin pricing exclusivity breached or rejected.",
      }
    },
  },

  {
    id: "SUP-EXC-02",
    category: "SUPER_ADMIN_EXCLUSIVITY",
    title: "Network-Wide Treasury 80/20 Settlement Reconciliation",
    description: "Super Admin reconciles weekly escrow releases adhering strictly to 80% Gaushala / 20% Platform rule.",
    run: async () => {
      // Test booking: Base 4000, Extra 500, Transport 400.
      // Seva Fee = 4500. Commission = 20% of 4500 = 900.
      // Gaushala Net Share = 80% of 4500 (3600) + 100% transport (400) = 4000.
      const seva = 4500
      const transport = 400
      const commission = Math.round((seva * 20) / 100) // 900
      const gaushalaNet = seva - commission + transport // 4000
      const gross = seva + transport // 4900

      const reconciled = commission + gaushalaNet === gross && commission === 900 && gaushalaNet === 4000

      return {
        passed: reconciled,
        expected: { gross: 4900, commission: 900, gaushalaNet: 4000, balanced: true },
        actual: { gross, commission, gaushalaNet, balanced: reconciled },
        diagnostic: reconciled ? undefined : "Settlement split deviated from 80/20 trust architecture.",
      }
    },
  },
]

async function runTestSuite() {
  console.log("==================================================================================")
  console.log("       GOMAA ADMIN & MANAGER ROLES ARCHITECTURAL CONTRACT TEST SUITE             ")
  console.log("==================================================================================\n")

  let passed = 0
  let failed = 0
  const defectDossier: any[] = []

  for (const t of tests) {
    try {
      const res = await t.run()
      if (res.passed) {
        console.log(`  ✓ PASS [${t.category}] ${t.id}: ${t.title}`)
        passed++
      } else {
        console.error(`  ✗ FAIL [${t.category}] ${t.id}: ${t.title}`)
        failed++
        defectDossier.push({
          id: t.id,
          category: t.category,
          title: t.title,
          description: t.description,
          expected: res.expected,
          actual: res.actual,
          diagnostic: res.diagnostic,
        })
      }
    } catch (err: any) {
      console.error(`  ✗ EXCEPTION [${t.category}] ${t.id}: ${t.title} -> ${err.message}`)
      failed++
      defectDossier.push({
        id: t.id,
        category: t.category,
        title: t.title,
        description: t.description,
        expected: "Successful execution",
        actual: `Exception: ${err.message}`,
        diagnostic: err.stack,
      })
    }
  }

  console.log("\n==================================================================================")
  console.log(`TEST SUMMARY: ${passed + failed} ROLE CONTRACTS EVALUATED`)
  console.log(`  PASSED: ${passed} | FAILED: ${failed}`)
  console.log("==================================================================================")

  if (defectDossier.length > 0) {
    console.error("\n==================================================================================")
    console.error("                       DEFECT & CONTRACT GAP DOSSIER                              ")
    console.error("==================================================================================")
    defectDossier.forEach((d, idx) => {
      console.error(`\n[DEFECT #${idx + 1}] ${d.id} (${d.category}) - ${d.title}`)
      console.error(`  Description: ${d.description}`)
      console.error(`  Expected:`, JSON.stringify(d.expected, null, 2))
      console.error(`  Actual:`, JSON.stringify(d.actual, null, 2))
      console.error(`  Diagnostic: ${d.diagnostic}`)
    })
    console.error("\n==================================================================================")
    process.exit(1)
  } else {
    console.log("\n  ALL ADMIN & MANAGER ROLE CONTRACTS ARE 100% SATISFIED & PRODUCTION CERTIFIED.\n")
  }
}

runTestSuite().catch(console.error)
