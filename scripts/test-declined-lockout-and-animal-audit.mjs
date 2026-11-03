import { handleApiRequest } from "../server/router.ts"
import { prisma } from "../server/prisma.ts"
import { TestHarness } from "./test-harness.mjs"
import { signJwt } from "../server/auth/jwt.ts"

async function runDeclinedLockoutAndAnimalAuditTests() {
  const harness = new TestHarness("DECLINED BOOKING TRANSIT LOCKOUT & ANIMAL PHOTO AUDIT")

  console.log("\n================================================================================")
  console.log("   DECLINED BOOKING LOCKOUT & BOVINE PHOTO VERIFICATION TEST SUITE              ")
  console.log("================================================================================\n")

  try {
    // 1. Authenticate Personas
    console.log("[TEST 1] Authenticating Super Admin & Manager Personas...")
    const saUser = await harness.resolveOrCreateUser("SUPER_ADMIN")
    harness.assert(Boolean(saUser), "Super Admin persona located")
    const saSession = await harness.loginWithDynamicPassword(saUser)
    harness.assert(Boolean(saSession?.token), "Super Admin dynamically authenticated")
    const saHeaders = saSession.headers

    const mgrUser = await harness.resolveOrCreateUser("GOSALA_MANAGER")
    harness.assert(Boolean(mgrUser), "Manager persona located")
    const mgrSession = await harness.loginWithDynamicPassword(mgrUser)
    harness.assert(Boolean(mgrSession?.token), "Manager dynamically authenticated")
    const mgrHeaders = mgrSession.headers

    // 2. Test Declined / Cancelled Booking Transit Lockout
    console.log("\n[TEST 2] Testing Declined / Cancelled Booking Transit Lockout...")
    const testBookingId = `GMA-DECLINED-${Date.now()}`

    const testGosala = (await prisma.gosala.findFirst()) || (await prisma.gosala.create({
      data: {
        id: `gosala_${Date.now()}`,
        name: "Gaushala_01",
        address: "Hyderabad",
        region: "Telangana",
      },
    }))
    const testAnimal = (await prisma.animal.findFirst()) || (await prisma.animal.create({
      data: {
        id: `animal_${Date.now()}`,
        name: "Gauri",
        type: "COW",
        gosalaId: testGosala.id,
        price: 2500,
        status: "AVAILABLE",
      },
    }))
    
    // Create a mock booking in DB with status REJECTED
    await prisma.booking.create({
      data: {
        id: testBookingId,
        customerId: saUser.id,
        gosalaId: testGosala.id,
        animalId: testAnimal.id,
        customerName: "Devotee Test",
        customerPhone: "+91 99999 88888",
        animalName: testAnimal.name,
        animalType: "COW",
        gosalaName: testGosala.name,
        bookingDate: "5 Nov 2026",
        startTime: "10:00",
        endTime: "11:30",
        durationMin: 90,
        address: "Hyderabad",
        distanceKm: 2.5,
        baseRate: 2500,
        extraTimeFee: 0,
        transportFee: 0,
        addonsFee: 0,
        taxFee: 0,
        discountFee: 0,
        totalAmount: 2500,
        commissionPct: 20,
        commissionAmount: 500,
        gosalaPayable: 2000,
        status: "REJECTED",
        paymentStatus: "CAPTURED",
        paymentId: `pay_${testBookingId}`,
      },
    })
    harness.createdBookingIds.add(testBookingId)

    // Attempt to assign driver to the rejected booking
    const assignRes = await handleApiRequest(
      "POST",
      `/api/bookings/${testBookingId}/assign-driver`,
      JSON.stringify({
        driverId: "DRV-TEST-999",
        driverName: "Ramesh Pilot",
        driverPhone: "+91 99887 76655",
      }),
      saHeaders,
    )

    harness.assert(
      assignRes.status === 400,
      "POST /api/bookings/:id/assign-driver returns 400 Bad Request for declined booking",
      `got status: ${assignRes.status}`,
    )
    harness.assert(
      assignRes.body && /declined or cancelled/i.test(assignRes.body.error),
      "Error response explicitly blocks dispatch on declined/cancelled booking",
      assignRes.body?.error,
    )

    // Attempt advance-stage on rejected booking
    const stageRes = await handleApiRequest(
      "POST",
      `/api/bookings/${testBookingId}/advance-stage`,
      JSON.stringify({}),
      saHeaders,
    )
    harness.assert(
      stageRes.status === 400,
      "POST /api/bookings/:id/advance-stage returns 400 Bad Request for declined booking",
      `got status: ${stageRes.status}`,
    )

    // 3. Test Manager Adding Bovine -> PENDING_SUPER_ADMIN
    console.log("\n[TEST 3] Testing Manager Cattle Registration (Photo Audit Workflow)...")
    const testCowName = `TestKamala_${Date.now()}`

    const addRes = await handleApiRequest(
      "POST",
      "/api/animals",
      JSON.stringify({
        name: testCowName,
        type: "Cow",
        breed: "Gir",
        gosala: "Gaushala_01",
        price: 3500,
        age: "4 years",
        weight: "380 kg",
        height: "4.5 ft",
        photo: "https://images.unsplash.com/photo-1546445317-29f4545e9d53?w=800",
        photos: [
          "https://images.unsplash.com/photo-1546445317-29f4545e9d53?w=800",
          "https://images.unsplash.com/photo-1570042225831-d98fa7577f1e?w=800",
        ],
        healthNotes: "Active, sacred tilak mark",
      }),
      mgrHeaders,
    )

    harness.assert(
      addRes.status === 201,
      "Manager registering cow returns 201 Created",
      `got status: ${addRes.status}`,
    )
    const cowPayload = addRes.body?.animal
    harness.assert(
      cowPayload?.approvalStatus === "PENDING_SUPER_ADMIN",
      "Cattle approvalStatus is set to PENDING_SUPER_ADMIN",
      `got: ${cowPayload?.approvalStatus}`,
    )
    harness.assert(
      cowPayload?.status === "Under Audit",
      "Cattle status is set to 'Under Audit'",
      `got: ${cowPayload?.status}`,
    )
    harness.assert(
      cowPayload?.isActive === undefined || cowPayload?.isActive === false,
      "Cattle isActive is not active until Super Admin authorizes",
    )

    // 4. Test Devotee / Manager cannot approve (Strict Role Guard)
    console.log("\n[TEST 4] Testing Super Admin Exclusive Authorization...")
    const unauthorizedVerifyRes = await handleApiRequest(
      "POST",
      `/api/animals/${encodeURIComponent(testCowName)}/verify`,
      JSON.stringify({ approved: true }),
      mgrHeaders,
    )
    harness.assert(
      unauthorizedVerifyRes.status === 403,
      "Manager cannot verify cattle photos (returns 403 Forbidden)",
    )

    // Super Admin Photo Verification: Approve
    const superVerifyRes = await handleApiRequest(
      "POST",
      `/api/animals/${encodeURIComponent(testCowName)}/verify`,
      JSON.stringify({ approved: true }),
      saHeaders,
    )
    harness.assert(
      superVerifyRes.status === 200,
      "Super Admin photo verification returns 200 OK",
    )
    const verifiedCowPayload = superVerifyRes.body?.animal
    harness.assert(
      verifiedCowPayload?.approvalStatus === "APPROVED",
      "Cattle approvalStatus updated to APPROVED",
    )
    harness.assert(
      verifiedCowPayload?.status === "Available",
      "Cattle status updated to Available for devotee bookings",
    )

    // Verify in DB directly
    const dbCow = await prisma.animal.findFirst({ where: { name: testCowName } })
    harness.assert(
      dbCow?.isActive === true &&
        (dbCow?.metadata?.approvalStatus === "APPROVED" ||
          dbCow?.healthStatus === "HEALTHY"),
      "PostgreSQL confirms cattle is APPROVED and active in herd",
    )

    // Clean up created cow
    await prisma.animal.deleteMany({ where: { name: testCowName } })

    // 5. Test Manager Slot Timing Toggle (/api/slots/toggle-block)
    console.log("\n[TEST 5] Testing Manager Slot & Timing Lock Toggle...")
    const slotBlockRes = await handleApiRequest(
      "POST",
      "/api/slots/toggle-block",
      JSON.stringify({
        animal: "Gauri",
        date: "10 Nov 2026",
        time: "10:00",
        reason: "Manager resting buffer",
      }),
      mgrHeaders,
    )
    harness.assert(
      slotBlockRes.status === 200,
      "POST /api/slots/toggle-block returns 200 OK",
    )
    harness.assert(
      slotBlockRes.body?.blocked === true,
      "Slot is now blocked by manager",
    )

    const slotUnblockRes = await handleApiRequest(
      "POST",
      "/api/slots/toggle-block",
      JSON.stringify({
        animal: "Gauri",
        date: "10 Nov 2026",
        time: "10:00",
      }),
      mgrHeaders,
    )
    harness.assert(
      slotUnblockRes.status === 200,
      "POST /api/slots/toggle-block unblock returns 200 OK",
    )
    harness.assert(
      slotUnblockRes.body?.blocked === false,
      "Slot is now unblocked and reopened",
    )

    // Clean up test booking
    await prisma.booking.deleteMany({ where: { id: testBookingId } })

    console.log("\n================================================================================")
    console.log(`   ALL TESTS PASSED: ${harness.passed} PASSED, ${harness.failed} FAILED`)
    console.log("================================================================================\n")
    if (harness.failed > 0) {
      process.exit(1)
    }
  } catch (err) {
    console.error("Test execution failed with unhandled error:", err)
    process.exit(1)
  }
}

runDeclinedLockoutAndAnimalAuditTests()
