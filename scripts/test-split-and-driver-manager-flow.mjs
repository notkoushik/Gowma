import assert from "node:assert/strict"
import { prisma } from "../server/prisma.ts"
import { handleApiRequest as router } from "../server/router.ts"
import { TestHarness } from "./test-harness.mjs"

console.log("\n================================================================================")
console.log("   TESTING 90/10 COMMISSION SPLIT DYNAMICS & MANAGER DRIVER ONBOARDING FLOW    ")
console.log("================================================================================\n")

async function main() {
  const harness = new TestHarness("SPLIT DYNAMICS & MANAGER DRIVER TEST")

  // 1. Authenticate as Super Admin
  const saUser = await harness.resolveOrCreateUser("SUPER_ADMIN")
  assert.ok(saUser, "Super Admin user exists")
  const saSession = await harness.loginWithDynamicPassword(saUser)
  assert.ok(saSession?.token, "Super Admin session token obtained")
  const saHeaders = saSession.headers

  // 2. Create or find test Gaushala
  const gName = "Test Dynamic Sanctuary 9010"
  let testG = await prisma.gosala.findFirst({ where: { name: gName } })
  if (!testG) {
    testG = await prisma.gosala.create({
      data: {
        name: gName,
        region: "Cyberabad / Gachibowli",
        address: "Survey 120, Sanctuary Lane",
        contactPhone: "+91 98111 22334",
        contactEmail: "dynamic9010@gomaa.test",
        isActive: true,
      },
    })
  }

  // 3. Test Super Admin setting 90/10 split (Platform fee 10%, Gaushala gets 90%)
  // Internal Gaushala ratio: 75% Manager, 25% District Ops Admin
  console.log("[TEST 1] Super Admin configuring 90/10 split and 75/25 Manager-Admin ratio...")
  const updateRes = await router(
    "PUT",
    `/api/gosalas/${encodeURIComponent(testG.id)}`,
    JSON.stringify({
      name: testG.name,
      partnershipTier: "PREFERRED",
      commissionType: "percentage",
      commissionValue: 10,
      customCommissionPct: 10,
      managerSharePct: 75,
      taxTreatment: "section_80g_exempt",
      customTaxPct: 0,
      partnershipNotes: "90/10 Preferred Sanctuary Agreement with 75% Manager cut",
    }),
    saHeaders,
  )

  console.log("[TEST 1] Response body:", JSON.stringify(updateRes))
  assert.equal(updateRes?.status, 200, "PUT /api/gosalas/:id succeeds with 200")
  assert.ok(updateRes.body.ok, "Response ok is true")
  assert.equal(updateRes.body.gosala.customCommissionPct, 10, "Gaushala customCommissionPct is 10%")
  assert.equal(updateRes.body.gosala.managerSharePct, 75, "Gaushala managerSharePct is 75%")

  // Verify in PostgreSQL DB
  const dbG = await prisma.gosala.findUnique({ where: { id: testG.id } })
  assert.equal(dbG.commissionValue, 10, "PostgreSQL confirms commissionValue is 10")

  // Verify in SplitPolicy
  const sp = await prisma.splitPolicy.findUnique({ where: { policyKey: testG.id } })
  assert.ok(sp, "SplitPolicy created for Gaushala")
  // 90% gaushala share = 9000 bp. 75% of 9000 = 6750 bp
  assert.equal(sp.managerBp, 6750, "SplitPolicy managerBp correctly computed: 6750 bp (67.5% of gross)")
  console.log("  ✓ PASS: 90/10 split saved to DB and SplitPolicy verified (10% platform, 67.5% manager, 22.5% admin)")

  // 4. Test GET /api/gosalas returns the 90/10 split without reverting to 80/20
  console.log("\n[TEST 2] Verifying GET /api/gosalas retains 90/10 split without reverting...")
  const getRes = await router("GET", "/api/gosalas", "", saHeaders)
  assert.equal(getRes?.status, 200)
  const fetchedG = getRes.body.gosalas.find((g) => g.id === testG.id)
  assert.ok(fetchedG, "Gaushala present in GET /api/gosalas")
  assert.equal(fetchedG.customCommissionPct, 10, "customCommissionPct is strictly 10% (NOT 20% / 80-20)")
  assert.equal(fetchedG.managerSharePct, 75, "managerSharePct is strictly 75%")
  console.log("  ✓ PASS: GET /api/gosalas confirms persistent 90/10 split")

  // 5. Create a Gaushala Manager account
  console.log("\n[TEST 3] Creating Gaushala Manager for this sanctuary...")
  const mgrUser = await harness.resolveOrCreateUser("GOSALA_MANAGER", {
    name: "Shed Custodian Murthy",
    email: "manager.dynamic9010@gomaa.test",
  })

  // Assign manager to Gaushala
  await prisma.gosalaManagerAssignment.upsert({
    where: { userId_gosalaId: { userId: mgrUser.id, gosalaId: testG.id } },
    create: { userId: mgrUser.id, gosalaId: testG.id, region: testG.region, status: "Active" },
    update: { status: "Active" },
  })

  const mgrSession = await harness.loginWithDynamicPassword(mgrUser)
  assert.ok(mgrSession?.token, "Manager token obtained")
  const mgrHeaders = mgrSession.headers

  // 6. Test Manager adding a Transit Pilot (Driver) with a custom van company
  console.log("\n[TEST 4] Gaushala Manager adding driver with custom van company (Force Motors)...")
  const driverEmail = `pilot.force.${Date.now()}@gomaa.test`
  const driverPhone = `+91 977${Math.floor(1000000 + Math.random() * 9000000)}`
  const addDriverRes = await router(
    "POST",
    "/api/users",
    JSON.stringify({
      name: "Ramesh Sharma",
      email: driverEmail,
      phone: driverPhone,
      role: "driver",
      password: "PilotPassword123!",
      driverData: {
        vehicleNumber: "TS-09-UA-7788",
        vehicleType: "Force Motors Traveller 3350 (Hydraulic Cattle Ambulance)",
        vehicleCompany: "Force Motors",
        licenseNumber: "DL-TS-2026-992",
        gosalaBase: testG.name,
        status: "Available",
      },
    }),
    mgrHeaders,
  )

  console.log("[TEST 4] addDriverRes body:", JSON.stringify(addDriverRes.body))
  assert.equal(addDriverRes?.status, 201, "POST /api/users by Manager succeeds with 201 Created")
  assert.ok(addDriverRes.body.ok, "Driver registration confirmed")
  assert.equal(addDriverRes.body.user.role, "driver", "Role is strictly driver")
  console.log("  ✓ PASS: Gaushala Manager successfully authorized driver without 403 permission error")

  // 7. Test Manager fetching user directory
  console.log("\n[TEST 5] Gaushala Manager fetching users in their Gaushala...")
  const getMgrUsersRes = await router("GET", "/api/users", "", mgrHeaders)
  assert.equal(getMgrUsersRes?.status, 200, "GET /api/users by Manager succeeds with 200 OK")
  console.log("driverEmail expected:", driverEmail)
  console.log("returned emails:", getMgrUsersRes.body.users.map((u) => u.email))
  const driverInList = getMgrUsersRes.body.users.find((u) => (u.email || "").toLowerCase() === driverEmail.toLowerCase())
  assert.ok(driverInList, "Registered driver appears in Manager's user directory")
  assert.equal(
    driverInList.driverData?.vehicleType,
    "Force Motors Traveller 3350 (Hydraulic Cattle Ambulance)",
    "Custom van company & model preserved",
  )
  console.log("  ✓ PASS: Custom vehicle company and model verified in driver profile")

  // 8. Test Manager forbidden from creating Super Admin or Ops Admin
  console.log("\n[TEST 6] Verifying Manager security boundaries...")
  const rogueAdminRes = await router(
    "POST",
    "/api/users",
    JSON.stringify({
      name: "Rogue Admin",
      email: "rogue@gomaa.test",
      role: "super_admin",
    }),
    mgrHeaders,
  )
  assert.equal(rogueAdminRes?.status, 403, "Manager cannot create admin or super_admin")
  console.log("  ✓ PASS: Manager security boundaries strictly enforced")

  // Cleanup test entities
  await prisma.user.deleteMany({ where: { email: driverEmail } })
  await prisma.splitPolicy.deleteMany({ where: { policyKey: testG.id } })
  await prisma.gosala.deleteMany({ where: { id: testG.id } })

  console.log("\n================================================================================")
  console.log("   ALL SPLIT & MANAGER DRIVER ONBOARDING TESTS PASSED PERFECTLY!               ")
  console.log("================================================================================\n")
}

main().catch((err) => {
  console.error("Test failed:", err)
  process.exit(1)
})
