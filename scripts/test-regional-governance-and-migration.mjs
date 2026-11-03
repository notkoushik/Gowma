import { handleApiRequest } from "../server/router.ts"
import { prisma } from "../server/prisma.ts"
import { TestHarness } from "./test-harness.mjs"
import {
  getAllIndianStates,
  getDistrictsForIndianState,
} from "../src/data/indiaGeoData.ts"
import crypto from "node:crypto"

async function runRegionalGovernanceTestSuite() {
  const harness = new TestHarness(
    "SUPER ADMIN REGIONAL GOVERNANCE & DATA MIGRATION E2E TEST",
  )

  console.log(
    "\n================================================================================",
  )
  console.log(
    "   SUPER ADMIN REGIONAL GOVERNANCE & DATA MIGRATION VERIFICATION SUITE         ",
  )
  console.log(
    "================================================================================\n",
  )

  try {
    // --------------------------------------------------------------------------------
    // 1. PAN-INDIA GEOGRAPHIC ADMINISTRATIVE DIRECTORY TEST
    // --------------------------------------------------------------------------------
    console.log("[TEST 1] Verifying Pan-India Geographic Directory (States & Districts)...")
    const states = getAllIndianStates()
    harness.assert(
      states.length === 36,
      `All 36 Indian States & Union Territories registered (found: ${states.length})`,
    )
    harness.assert(
      states.includes("Telangana") &&
        states.includes("Karnataka") &&
        states.includes("Maharashtra") &&
        states.includes("Uttar Pradesh") &&
        states.includes("Delhi NCR"),
      "Key metropolitan & pilgrimage states verified",
    )

    const telanganaDistricts = getDistrictsForIndianState("Telangana")
    harness.assert(
      telanganaDistricts.length >= 30,
      `Telangana cascading districts verified (found: ${telanganaDistricts.length})`,
    )
    harness.assert(
      telanganaDistricts.includes("Hyderabad") &&
        telanganaDistricts.includes("Warangal") &&
        telanganaDistricts.includes("Ranga Reddy"),
      "Telangana core districts present",
    )

    const upDistricts = getDistrictsForIndianState("Uttar Pradesh")
    harness.assert(
      upDistricts.length >= 70,
      `Uttar Pradesh cascading districts verified (found: ${upDistricts.length})`,
    )
    harness.assert(
      upDistricts.some((d) => d.includes("Varanasi")) &&
        upDistricts.some((d) => d.includes("Mathura")) &&
        upDistricts.some((d) => d.includes("Ayodhya")),
      "Uttar Pradesh sacred sanctuary hubs present",
    )

    // --------------------------------------------------------------------------------
    // 2. RESOLVE SUPER ADMIN CLEARANCE & AUTHENTICATION
    // --------------------------------------------------------------------------------
    console.log("\n[TEST 2] Authenticating as Super Admin (The Captain)...")
    const saUser = await harness.resolveOrCreateUser("SUPER_ADMIN")
    harness.assert(Boolean(saUser), "Super Admin persona located")

    const saSession = await harness.loginWithDynamicPassword(saUser)
    harness.assert(Boolean(saSession?.token), "Super Admin dynamically authenticated via TestHarness")
    const saToken = saSession.token
    const saHeaders = saSession.headers

    // --------------------------------------------------------------------------------
    // 3. REGIONAL ADDITION FLOW (State -> District Cascading & Zone Assignment)
    // --------------------------------------------------------------------------------
    console.log("\n[TEST 3] Testing Regional Addition (/api/regions)...")
    const testDistrict = "Warangal"
    const testState = "Telangana"
    const newRegionName = `Warangal Heritage Gaushala Belt ${harness.testRunId}`

    const addRegionRes = await handleApiRequest(
      "POST",
      "/api/regions",
      JSON.stringify({
        state: testState,
        district: testDistrict,
        name: newRegionName,
        zone: "South",
        defaultMaxRadiusKm: 45,
        pincodePrefixes: ["506001", "506002"],
      }),
      saHeaders,
    )

    harness.assert(
      addRegionRes?.status === 201,
      `Region creation succeeds with 201 Created (got: ${addRegionRes?.status})`,
    )
    harness.assert(
      addRegionRes?.body?.ok === true,
      "Response payload confirms ok: true",
    )
    const createdRegion = addRegionRes?.body?.region
    harness.assert(
      createdRegion?.name === newRegionName,
      "Created region matches specified title",
    )
    harness.assert(
      createdRegion?.district === testDistrict,
      "Created region binds selected District",
    )
    harness.assert(
      createdRegion?.state === testState,
      "Created region binds selected State",
    )

    // Verify retrieval via GET /api/regions
    const listRegionsRes = await handleApiRequest("GET", "/api/regions", "", saHeaders)
    harness.assert(
      listRegionsRes?.status === 200,
      "GET /api/regions returns 200 OK",
    )
    const regionsList = listRegionsRes?.body?.regions || []
    harness.assert(
      regionsList.some((r) => r.id === createdRegion.id),
      "Newly created operational region appears in active directory",
    )

    // --------------------------------------------------------------------------------
    // 4. OPERATIONAL ADMIN ADDITION (With Complete Banking Details)
    // --------------------------------------------------------------------------------
    console.log("\n[TEST 4] Testing Operational Admin Onboarding (/api/operational-admins)...")
    const oldAdminEmail = `ops.old.${harness.testRunId}@gomaa.test`
    const oldAdminPhone = `+91 98${Math.floor(10000000 + Math.random() * 90000000)}`
    const oldAdminName = `Old Regional Officer ${harness.testRunId}`

    const createOldAdminRes = await handleApiRequest(
      "POST",
      "/api/operational-admins",
      JSON.stringify({
        name: oldAdminName,
        email: oldAdminEmail,
        phone: oldAdminPhone,
        password: "SecureOpsPass123!",
        designation: "Senior Regional Officer",
        department: "Warangal Operations Hub",
        bankDetails: {
          accountHolder: oldAdminName,
          bankName: "State Bank of India",
          accountNumber: "910248190001",
          ifscCode: "SBIN0001042",
          upiId: `oldops.${harness.testRunId}@sbi`,
          branchName: "Warangal Central Branch",
        },
        assignedRegionId: createdRegion.id,
      }),
      saHeaders,
    )

    harness.assert(
      createOldAdminRes?.status === 201,
      `Operational Admin created with 201 Created (got: ${createOldAdminRes?.status})`,
    )
    const oldAdmin = createOldAdminRes?.body?.admin
    harness.assert(
      oldAdmin?.role === "admin" && oldAdmin?.dbRole === "OPERATIONS_ADMIN",
      "Role is strictly bound to OPERATIONS_ADMIN",
    )
    harness.assert(
      oldAdmin?.bankDetails?.bankName === "State Bank of India",
      "Banking details persisted: State Bank of India",
    )
    harness.assert(
      oldAdmin?.bankDetails?.ifscCode === "SBIN0001042",
      "Banking details persisted: IFSC code verified",
    )
    harness.assert(
      oldAdmin?.assignedRegion?.id === createdRegion.id,
      "Operational Admin appointed to region on creation",
    )

    // Create a New Candidate Operational Admin (Free in Pool)
    const newAdminEmail = `ops.new.${harness.testRunId}@gomaa.test`
    const newAdminPhone = `+91 97${Math.floor(10000000 + Math.random() * 90000000)}`
    const newAdminName = `New Regional Officer ${harness.testRunId}`

    const createNewAdminRes = await handleApiRequest(
      "POST",
      "/api/operational-admins",
      JSON.stringify({
        name: newAdminName,
        email: newAdminEmail,
        phone: newAdminPhone,
        password: "NewSecureOpsPass123!",
        designation: "Regional Operations Custodian",
        department: "Central Roster",
        bankDetails: {
          accountHolder: newAdminName,
          bankName: "HDFC Bank",
          accountNumber: "501004819999",
          ifscCode: "HDFC0000123",
          upiId: `newops.${harness.testRunId}@okhdfcbank`,
          branchName: "Cyberabad Tech Hub Branch",
        },
        // No assignedRegionId -> should be in FREE POOL
      }),
      saHeaders,
    )

    harness.assert(
      createNewAdminRes?.status === 201,
      "New Candidate Operational Admin created in Free Pool",
    )
    const newAdmin = createNewAdminRes?.body?.admin
    harness.assert(
      newAdmin?.isFree === true,
      "New Candidate Admin correctly flagged as isFree: true (available in pool)",
    )

    // --------------------------------------------------------------------------------
    // 5. ACTIVE / DEACTIVATION STATUS LIFECYCLE
    // --------------------------------------------------------------------------------
    console.log("\n[TEST 5] Testing Active / Deactivate Status Toggle (/api/operational-admins/:id/status)...")
    const deactivateRes = await handleApiRequest(
      "PATCH",
      `/api/operational-admins/${oldAdmin.id}/status`,
      JSON.stringify({ isActive: false }),
      saHeaders,
    )
    harness.assert(
      deactivateRes?.status === 200,
      "Deactivation request succeeds with 200 OK",
    )
    harness.assert(
      deactivateRes?.body?.isActive === false,
      "Operational Admin status is set to isActive: false",
    )

    // Reactivate
    const reactivateRes = await handleApiRequest(
      "PATCH",
      `/api/operational-admins/${oldAdmin.id}/status`,
      JSON.stringify({ isActive: true }),
      saHeaders,
    )
    harness.assert(
      reactivateRes?.body?.isActive === true,
      "Operational Admin status reactivated to isActive: true",
    )

    // --------------------------------------------------------------------------------
    // 6. SETUP SOURCE ADMIN PORTFOLIO (Gaushalas, Managers, Active Bookings)
    // --------------------------------------------------------------------------------
    console.log("\n[TEST 6] Setting up Old Admin Regional Portfolio for Migration...")
    const testGosalaName = `Shri Krishna Gaushala ${harness.testRunId}`
    const testGosala = await prisma.gosala.create({
      data: {
        name: testGosalaName,
        region: `${testDistrict}, ${testState}`,
        address: `Temple Road, ${testDistrict}`,
        contactPhone: oldAdminPhone,
        contactEmail: oldAdminEmail,
        adminId: oldAdmin.id,
        adminEmail: oldAdmin.email,
        adminName: oldAdmin.name,
      },
    })
    harness.assert(Boolean(testGosala), `Gaushala created and governed by Old Admin (${oldAdmin.name})`)

    // Create Booking under this Gaushala
    const testBookingId = `GMA-MIG-${Math.floor(10000 + Math.random() * 90000)}`
    const testAnimal = await prisma.animal.create({
      data: {
        gosalaId: testGosala.id,
        name: `Nandi Bovine ${harness.testRunId}`,
        type: "COW",
        price: 3500,
      },
    })

    const devoteeUser = await harness.resolveOrCreateUser("CUSTOMER")

    const testBooking = await prisma.booking.create({
      data: {
        id: testBookingId,
        customerId: devoteeUser.id,
        gosalaId: testGosala.id,
        animalId: testAnimal.id,
        customerName: devoteeUser.name,
        customerPhone: devoteeUser.phone,
        animalName: testAnimal.name,
        animalType: "COW",
        gosalaName: testGosala.name,
        bookingDate: "2026-11-05",
        startTime: "10:00",
        endTime: "12:00",
        durationMin: 120,
        address: "Devotee Temple Villa",
        distanceKm: 8.5,
        baseRate: 3500,
        extraTimeFee: 0,
        transportFee: 400,
        addonsFee: 0,
        taxFee: 420,
        discountFee: 0,
        totalAmount: 4320,
        commissionPct: 20,
        commissionAmount: 864,
        gosalaPayable: 3456,
        status: "ADMIN_REVIEW",
      },
    })
    harness.assert(Boolean(testBooking), `Active Booking ${testBookingId} established under portfolio`)

    // --------------------------------------------------------------------------------
    // 7. DEEP DATA MIGRATION FLOW (Old Operational Admin -> New Operational Admin)
    // --------------------------------------------------------------------------------
    console.log("\n[TEST 7] Executing Atomic Data Migration (/api/operational-admins/migrate)...")
    const migrationRes = await handleApiRequest(
      "POST",
      "/api/operational-admins/migrate",
      JSON.stringify({
        sourceAdminId: oldAdmin.id,
        targetAdminId: newAdmin.id,
        deactivateSource: true,
        transferRegion: true,
        targetBankDetails: {
          accountHolder: newAdminName,
          bankName: "HDFC Bank",
          accountNumber: "501004819999",
          ifscCode: "HDFC0000123",
          upiId: `newops.${harness.testRunId}@okhdfcbank`,
        },
        notes: "Full regional handover and banking transition executed by Super Admin Captain",
      }),
      saHeaders,
    )

    harness.assert(
      migrationRes?.status === 200,
      `Data migration succeeds with 200 OK (got: ${migrationRes?.status})`,
    )
    harness.assert(
      migrationRes?.body?.ok === true,
      "Migration payload returns ok: true",
    )
    const cert = migrationRes?.body?.certificate
    harness.assert(
      Boolean(cert?.id && cert.id.startsWith("MIG-")),
      `Tamper-evident Migration Certificate generated: ${cert?.id}`,
    )
    harness.assert(
      cert?.transferredGosalas?.includes(testGosalaName),
      `Certificate confirms Gaushala '${testGosalaName}' transferred`,
    )
    harness.assert(
      cert?.sourceDeactivated === true,
      "Certificate confirms Old Admin deactivated",
    )
    harness.assert(
      cert?.bankingHandoverStatus === "COMPLETED",
      "Certificate confirms banking separation protocol completed",
    )

    // --------------------------------------------------------------------------------
    // 8. POST-MIGRATION INTEGRITY AUDIT
    // --------------------------------------------------------------------------------
    console.log("\n[TEST 8] Validating Post-Migration Database & Entity Consistency...")

    // 1. Gaushala governing admin check
    const updatedGosala = await prisma.gosala.findUnique({
      where: { id: testGosala.id },
    })
    harness.assert(
      updatedGosala?.adminId === newAdmin.id,
      "PostgreSQL confirms Gaushala adminId updated to New Admin ID",
    )
    harness.assert(
      updatedGosala?.adminEmail === newAdminEmail,
      "PostgreSQL confirms Gaushala adminEmail updated to New Admin Email",
    )
    harness.assert(
      updatedGosala?.adminName === newAdminName,
      "PostgreSQL confirms Gaushala adminName updated to New Admin Name",
    )

    // 2. Old Admin Deactivation check
    const dbOldAdmin = await prisma.user.findUnique({
      where: { id: oldAdmin.id },
    })
    harness.assert(
      dbOldAdmin?.isActive === false,
      "PostgreSQL confirms Old Operational Admin is now deactivated (isActive: false)",
    )

    // 3. New Admin Region Binding check
    const updatedRegions = await handleApiRequest("GET", "/api/regions", "", saHeaders)
    const targetRegionInList = updatedRegions?.body?.regions?.find(
      (r) => r.id === createdRegion.id,
    )
    harness.assert(
      targetRegionInList?.assignedAdminId === newAdmin.id,
      "Operational Region is now bound to New Admin",
    )
    harness.assert(
      targetRegionInList?.assignedAdminEmail === newAdminEmail,
      "Operational Region assignedAdminEmail confirms New Admin",
    )

    // 4. Migration History Retrieval
    const historyRes = await handleApiRequest(
      "GET",
      "/api/operational-admins/migrations",
      "",
      saHeaders,
    )
    harness.assert(
      historyRes?.status === 200,
      "GET /api/operational-admins/migrations returns 200 OK",
    )
    const history = historyRes?.body?.history || []
    harness.assert(
      history.some((h) => h.id === cert.id),
      "Audit trail ledger records Migration Certificate in history",
    )

    // --------------------------------------------------------------------------------
    // 9. SECURITY & BOUNDARY VIOLATION PREVENTION
    // --------------------------------------------------------------------------------
    console.log("\n[TEST 9] Testing Security Isolation & Role Access Restrictions...")

    // Customer cannot execute migration
    const custSession = await harness.loginWithDynamicPassword(devoteeUser)
    const devToken = custSession.token

    const devForbiddenRes = await handleApiRequest(
      "POST",
      "/api/operational-admins/migrate",
      JSON.stringify({
        sourceAdminId: oldAdmin.id,
        targetAdminId: newAdmin.id,
      }),
      { authorization: `Bearer ${devToken}` },
    )
    harness.assert(
      devForbiddenRes?.status === 403,
      "Devotee / Customer role is strictly forbidden (403) from data migration",
    )

    // Unauthenticated rejected
    const unauthRes = await handleApiRequest(
      "POST",
      "/api/operational-admins/migrate",
      JSON.stringify({ sourceAdminId: oldAdmin.id, targetAdminId: newAdmin.id }),
    )
    harness.assert(
      unauthRes?.status === 401,
      "Unauthenticated caller is strictly rejected (401)",
    )

    // Cannot migrate to same admin
    const selfMigRes = await handleApiRequest(
      "POST",
      "/api/operational-admins/migrate",
      JSON.stringify({ sourceAdminId: newAdmin.id, targetAdminId: newAdmin.id }),
      saHeaders,
    )
    harness.assert(
      selfMigRes?.status === 400,
      "Self-migration (source === target) is rejected with 400 Bad Request",
    )

    // --------------------------------------------------------------------------------
    // 10. STRICT OPERATIONAL ADMIN & MANAGER BOUNDARY ISOLATION + SUPER ADMIN REASSIGNMENT
    // --------------------------------------------------------------------------------
    console.log("\n[TEST 10] Testing Strict Operational Admin & Manager Boundary Isolation...")

    const opsNorth = await harness.provisionEphemeralUser("OPERATIONS_ADMIN", {
      name: `Ops Admin North ${harness.testRunId}`,
    })
    const opsSouth = await harness.provisionEphemeralUser("OPERATIONS_ADMIN", {
      name: `Ops Admin South ${harness.testRunId}`,
    })

    const gosalaNorth = await prisma.gosala.create({
      data: {
        id: `GOSALA-N-${harness.testRunId}`,
        name: `Gaushala North Sanctuary ${harness.testRunId}`,
        region: "Varanasi (Uttar Pradesh)",
        address: "Kashi Ghat, Varanasi",
        contactPhone: "+91 98765 43210",
        contactEmail: opsNorth.email,
        adminId: opsNorth.id,
        adminEmail: opsNorth.email,
        adminName: opsNorth.name,
        isActive: true,
      },
    })

    const gosalaSouth = await prisma.gosala.create({
      data: {
        id: `GOSALA-S-${harness.testRunId}`,
        name: `Gaushala South Sanctuary ${harness.testRunId}`,
        region: "Hyderabad (Telangana)",
        address: "Gowliguda, Hyderabad",
        contactPhone: "+91 98765 43211",
        contactEmail: opsSouth.email,
        adminId: opsSouth.id,
        adminEmail: opsSouth.email,
        adminName: opsSouth.name,
        isActive: true,
      },
    })

    const mgrNorth = await harness.provisionEphemeralUser("GOSALA_MANAGER", {
      name: `Manager North ${harness.testRunId}`,
    })
    const mgrSouth = await harness.provisionEphemeralUser("GOSALA_MANAGER", {
      name: `Manager South ${harness.testRunId}`,
    })

    await prisma.gosalaManagerAssignment.createMany({
      data: [
        {
          userId: mgrNorth.id,
          gosalaId: gosalaNorth.id,
          region: "Varanasi (Uttar Pradesh)",
          status: "Active",
        },
        {
          userId: mgrSouth.id,
          gosalaId: gosalaSouth.id,
          region: "Hyderabad (Telangana)",
          status: "Active",
        },
      ],
    })

    const animalNorth = await prisma.animal.create({
      data: {
        id: `ANIMAL-N-${harness.testRunId}`,
        name: `Surabhi North ${harness.testRunId}`,
        type: "COW",
        gosalaId: gosalaNorth.id,
        price: 3600,
        isActive: true,
      },
    })
    const animalSouth = await prisma.animal.create({
      data: {
        id: `ANIMAL-S-${harness.testRunId}`,
        name: `Kamadhenu South ${harness.testRunId}`,
        type: "COW",
        gosalaId: gosalaSouth.id,
        price: 3800,
        isActive: true,
      },
    })

    // Authenticate as Ops Admin North
    const opsNorthSession = await harness.loginWithDynamicPassword(opsNorth)
    const northHeaders = { authorization: `Bearer ${opsNorthSession.token}` }

    // 1. Ops Admin North GET /api/gosalas
    const northGosalasRes = await handleApiRequest("GET", "/api/gosalas", "", northHeaders)
    const northGosalaIds = (northGosalasRes?.body?.gosalas || []).map((g) => g.id)
    harness.assert(
      northGosalaIds.includes(gosalaNorth.id),
      "Ops Admin North strictly sees their own maintained Gaushala North",
    )
    harness.assert(
      !northGosalaIds.includes(gosalaSouth.id),
      "Ops Admin North CANNOT see Gaushala South maintained by Ops Admin South",
    )

    // 2. Ops Admin North GET /api/managers
    const northMgrsRes = await handleApiRequest("GET", "/api/managers", "", northHeaders)
    const northMgrs = northMgrsRes?.body?.managers || []
    const isNorthMgrPresent = northMgrs.some(
      (m) => m.id === mgrNorth.id || m.userId === mgrNorth.id || m.email === mgrNorth.email
    )
    const isSouthMgrPresent = northMgrs.some(
      (m) => m.id === mgrSouth.id || m.userId === mgrSouth.id || m.email === mgrSouth.email
    )
    harness.assert(
      isNorthMgrPresent,
      "Ops Admin North strictly sees Manager North assigned to their maintained Gaushala",
    )
    harness.assert(
      !isSouthMgrPresent,
      "Ops Admin North CANNOT see Manager South assigned to Ops Admin South's Gaushala",
    )

    // 3. Ops Admin North GET /api/animals
    const northAnimalsRes = await handleApiRequest("GET", "/api/animals", "", northHeaders)
    const northAnimalNames = (northAnimalsRes?.body?.animals || []).map((a) => a.name)
    harness.assert(
      northAnimalNames.includes(animalNorth.name),
      "Ops Admin North strictly sees animals in Gaushala North",
    )
    harness.assert(
      !northAnimalNames.includes(animalSouth.name),
      "Ops Admin North CANNOT see animals in Gaushala South",
    )

    // 4. Manager North Isolation
    const mgrNorthSession = await harness.loginWithDynamicPassword(mgrNorth)
    const mgrNorthHeaders = { authorization: `Bearer ${mgrNorthSession.token}` }

    const mgrGosalasRes = await handleApiRequest("GET", "/api/gosalas", "", mgrNorthHeaders)
    const mgrGosalaIds = (mgrGosalasRes?.body?.gosalas || []).map((g) => g.id)
    harness.assert(
      mgrGosalaIds.includes(gosalaNorth.id),
      "Manager North can only view their own assigned Gaushala North",
    )
    harness.assert(
      !mgrGosalaIds.includes(gosalaSouth.id),
      "Manager North CANNOT view Gaushala South",
    )

    const mgrListRes = await handleApiRequest("GET", "/api/managers", "", mgrNorthHeaders)
    const mgrList = mgrListRes?.body?.managers || []
    harness.assert(
      mgrList.length === 1 && (mgrList[0].id === mgrNorth.id || mgrList[0].userId === mgrNorth.id || mgrList[0].email === mgrNorth.email),
      "Manager North can only view their own manager account record",
    )

    // 5. Unauthorized Reassignment attempt by Operational Admin
    const unauthorizedReassign = await handleApiRequest(
      "PATCH",
      `/api/gosalas/${gosalaNorth.id}/admin`,
      JSON.stringify({ adminId: opsSouth.id }),
      northHeaders,
    )
    harness.assert(
      unauthorizedReassign?.status === 403,
      "Operational Admin is strictly forbidden (403) from reassigning Gaushala governing admin",
    )

    // 6. Super Admin Reassigns Gaushala North to Ops Admin South
    console.log("\n[TEST 10b] Super Admin executing Gaushala Reassignment...")
    const reassignRes = await handleApiRequest(
      "PATCH",
      `/api/gosalas/${gosalaNorth.id}/admin`,
      JSON.stringify({
        adminId: opsSouth.id,
        adminEmail: opsSouth.email,
        adminName: opsSouth.name,
      }),
      saHeaders,
    )
    harness.assert(
      reassignRes?.status === 200,
      "Super Admin reassigns Gaushala North to Ops Admin South with 200 OK",
    )

    // 7. Post-reassignment boundary verification
    const opsSouthSession = await harness.loginWithDynamicPassword(opsSouth)
    const southHeaders = { authorization: `Bearer ${opsSouthSession.token}` }

    const postSouthGosalas = await handleApiRequest("GET", "/api/gosalas", "", southHeaders)
    const postSouthIds = (postSouthGosalas?.body?.gosalas || []).map((g) => g.id)
    harness.assert(
      postSouthIds.includes(gosalaNorth.id),
      "Ops Admin South immediately receives Gaushala North in their portfolio",
    )

    const postNorthGosalas = await handleApiRequest("GET", "/api/gosalas", "", northHeaders)
    const postNorthIds = (postNorthGosalas?.body?.gosalas || []).map((g) => g.id)
    harness.assert(
      !postNorthIds.includes(gosalaNorth.id),
      "Ops Admin North access to Gaushala North is immediately revoked upon Super Admin reassignment",
    )

    const postSouthMgrs = await handleApiRequest("GET", "/api/managers", "", southHeaders)
    const postSouthMgrsList = postSouthMgrs?.body?.managers || []
    const southSeesNorthMgr = postSouthMgrsList.some(
      (m) => m.id === mgrNorth.id || m.userId === mgrNorth.id || m.email === mgrNorth.email
    )
    harness.assert(
      southSeesNorthMgr,
      "Ops Admin South now sees Manager North (shares money/revenue under new portfolio)",
    )

    const postNorthMgrs = await handleApiRequest("GET", "/api/managers", "", northHeaders)
    const postNorthMgrsList = postNorthMgrs?.body?.managers || []
    const northSeesNorthMgr = postNorthMgrsList.some(
      (m) => m.id === mgrNorth.id || m.userId === mgrNorth.id || m.email === mgrNorth.email
    )
    harness.assert(
      !northSeesNorthMgr,
      "Ops Admin North no longer sees Manager North after Gaushala reassignment",
    )

    // Cleanup test data
    console.log("\n[CLEANUP] Cleaning up transient test entities...")
    await prisma.booking.deleteMany({ where: { id: testBookingId } }).catch(() => {})
    await prisma.gosalaManagerAssignment.deleteMany({
      where: { userId: { in: [mgrNorth.id, mgrSouth.id] } },
    }).catch(() => {})
    await prisma.animal.deleteMany({
      where: { id: { in: [animalNorth.id, animalSouth.id, testAnimal.id] } },
    }).catch(() => {})
    await prisma.gosala.deleteMany({
      where: { id: { in: [gosalaNorth.id, gosalaSouth.id, testGosala.id] } },
    }).catch(() => {})
    await prisma.user.deleteMany({
      where: { id: { in: [oldAdmin.id, newAdmin.id, opsNorth.id, opsSouth.id, mgrNorth.id, mgrSouth.id] } },
    }).catch(() => {})

    console.log("\n" + "=".repeat(80))
    console.log("   ALL REGIONAL GOVERNANCE & DATA MIGRATION TESTS PASSED CLEANLY!  ")
    console.log("=".repeat(80) + "\n")
  } catch (err) {
    console.error("\n❌ TEST FAILED WITH EXCEPTION:", err)
    process.exit(1)
  }
}

runRegionalGovernanceTestSuite()
