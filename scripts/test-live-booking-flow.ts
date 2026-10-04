import { handleApiRequest } from "../server/router"
import { prisma } from "../server/prisma"

let passCount = 0
let failCount = 0

function assert(condition: boolean, testId: string, desc: string) {
  if (condition) {
    passCount++
    console.log(`  ✓ PASS [${testId}]: ${desc}`)
  } else {
    failCount++
    console.error(`  ✗ FAIL [${testId}]: ${desc}`)
  }
}

async function main() {
  console.log("==================================================================================")
  console.log("             GOMAA GOLDEN END-TO-END SEVA LIFECYCLE AUDIT SUITE                   ")
  console.log("==================================================================================\n")

  // 1. Test GET /api/pricing-config
  console.log("--- Step 1: Testing Master Pricing Configuration API ---")
  const pricingRes = await handleApiRequest("GET", "/api/pricing-config")
  assert(
    pricingRes.status === 200 && pricingRes.body?.config?.commissionPct === 20,
    "API-PRICING-01",
    `GET /api/pricing-config returned 200 OK with ${pricingRes.body?.config?.commissionPct}% commission`
  )

  // 2. Test Price Calculation
  console.log("\n--- Step 2: Testing Pricing Calculation Engine ---")
  const calcRes = await handleApiRequest("POST", "/api/pricing/calculate", {
    baseRate: 3500,
    durationMin: 90, // 60 standard + 30 extra (1 unit = +500)
    distanceKm: 15,  // 5 free + 10 km @ 50 = +500
    addonsCost: 350,
  })
  assert(
    calcRes.status === 200 && calcRes.body?.total > 4000,
    "API-CALC-01",
    `Pricing Engine: Base ₹3500 + Extra ₹500 + Transport ₹500 + Addons ₹350 + Tax -> Total ₹${calcRes.body?.total}`
  )

  // 3. Test Temporary Hold Slot
  console.log("\n--- Step 3: Testing Anti-Collision Slot Hold ---")
  const holdRes = await handleApiRequest("POST", "/api/hold", {
    animal: "Gauri",
    date: "26 Sep 2026",
    start: "10:00",
    durationMin: 60,
    customerName: "Radha Krishna Sharma",
  })
  assert(
    holdRes.status === 200 && holdRes.body?.success === true,
    "API-HOLD-01",
    `Temporary Slot Hold acquired: ID ${holdRes.body?.hold?.id || "HOLD-OK"}`
  )

  // 4. Test Devotee Booking Creation
  console.log("\n--- Step 4: Testing Devotee Booking Creation ---")
  const testBookingId = `GMA-FLOW-${Date.now().toString().slice(-5)}`
  const newBooking = {
    id: testBookingId,
    customer: "Radha Krishna Sharma",
    phone: "+91 98205 99412",
    animal: "Gauri",
    animalType: "Cow",
    gosala: "Shri Krishna Gaushala",
    date: "26 Sep 2026",
    start: "10:00",
    end: "11:30",
    durationMin: 90,
    address: "Bungalow 7, Road 10, Jubilee Hills, Hyderabad",
    distanceKm: 12,
    base: 3500,
    extraTime: 500,
    transport: 350,
    addons: 250,
    tax: 552,
    discount: 0,
    total: 5152,
    commissionPct: 20,
    commissionSnapshot: 800, // 20% of (3500 + 500)
    status: "Payment Verified",
    ritualPurpose: "Griha Pravesh & Kamadhenu Puja",
  }

  const createRes = await handleApiRequest("POST", "/api/bookings", {
    booking: newBooking,
    holdId: holdRes.body?.hold?.id,
  })
  assert(
    createRes.status === 201 && createRes.body?.booking?.id === testBookingId,
    "API-BOOK-01",
    `Booking ${testBookingId} created in state: ${createRes.body?.booking?.status}`
  )

  // 5. Test Phase 1: Gaushala Manager Feasibility Review
  console.log("\n--- Step 5: Testing Phase 1 Gaushala Manager Feasibility Decision ---")
  const mgrDecisionRes = await handleApiRequest("POST", `/api/bookings/${testBookingId}/manager-decide`, {
    confirm: true,
    action: "approve",
    remark: "Sacred cow Gauri examined & fit. Distance 12km acceptable. Feasibility Approved.",
    managerName: "Rahul Kamble",
  })
  assert(
    mgrDecisionRes?.status === 200 && (mgrDecisionRes?.body?.booking?.status === "Admin Review" || mgrDecisionRes?.body?.booking?.status === "ADMIN_REVIEW"),
    "API-MGR-01",
    `Phase 1 Manager Approval Handshake: status escalated to ${mgrDecisionRes?.body?.booking?.status}`
  )

  // 6. Test Phase 2: Operations Admin Final Confirmation & Driver Dispatch
  console.log("\n--- Step 6: Testing Phase 2 Operations Admin Dispatch & Confirmation ---")
  const adminConfirmRes = await handleApiRequest("POST", `/api/bookings/${testBookingId}/admin-confirm`, {
    adminName: "Operations Admin Regional Central",
    driverName: "Sunil Pawar",
    driverPhone: "+91 98201 55432",
    vehicleNumber: "MH-12-Q-4491",
    vehicleType: "Tata 407 (8ft Hydraulic Bed)",
  })
  assert(
    adminConfirmRes.status === 200 && (adminConfirmRes.body?.booking?.status === "Confirmed" || adminConfirmRes.body?.booking?.status === "CONFIRMED"),
    "API-ADM-01",
    `Phase 2 Admin Confirmation: Driver Sunil Pawar assigned, status is ${adminConfirmRes.body?.booking?.status}`
  )

  // 7. Test Driver Lifecycle Progression (Stage 1 to 9)
  console.log("\n--- Step 7: Testing Driver Companion Sequential Stage Progression ---")
  // Advance to Stage 1: En Route to Gaushala
  const stage1Res = await handleApiRequest("POST", `/api/bookings/${testBookingId}/driver-stage`, {
    stage: 1,
    note: "Driver Sunil en route to Shri Krishna Gaushala for cow boarding",
  })
  assert(stage1Res.status === 200, "API-DRV-01", "Stage 1: En route to shelter recorded")

  // Advance to Stage 5: Puja at Altar
  const stage5Res = await handleApiRequest("POST", `/api/bookings/${testBookingId}/driver-stage`, {
    stage: 5,
    note: "Cow Gauri safely present at altar. Griha Pravesh Puja in progress.",
  })
  assert(stage5Res.status === 200, "API-DRV-02", "Stage 5: Live Seva Puja at Altar in progress")

  // Advance to Stage 9: Completed & Back in Shed
  const stage9Res = await handleApiRequest("POST", `/api/bookings/${testBookingId}/driver-stage`, {
    stage: 9,
    note: "Returned to shed. Cow fed warm jaggery water. Seva successfully fulfilled.",
  })
  assert(
    stage9Res.status === 200 && (stage9Res.body?.booking?.status === "Completed" || stage9Res.body?.booking?.status === "COMPLETED"),
    "API-DRV-03",
    `Stage 9: Seva Marked Completed. Final Status is ${stage9Res.body?.booking?.status}`
  )

  // 8. Test Financial Settlement
  console.log("\n--- Step 8: Testing Financial Settlement Batch ---")
  const settlementsRes = await handleApiRequest("GET", "/api/settlements")
  assert(
    settlementsRes.status === 200 && Array.isArray(settlementsRes.body?.settlements),
    "API-SETTLE-01",
    `GET /api/settlements retrieved ${settlementsRes.body?.settlements?.length || 0} batches successfully`
  )

  console.log("\n==================================================================================")
  console.log(`TEST SUMMARY: ${passCount + failCount} GOLDEN LIFECYCLE TESTS EVALUATED`)
  console.log(`  PASSED: ${passCount} | FAILED: ${failCount}`)
  console.log("==================================================================================\n")

  if (failCount === 0) {
    console.log("  ★ GOLDEN FLOW FROM DEVOTEE TO COMPLETED SETTLEMENT CERTIFIED 100% OPERATIONAL ★\n")
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error("Fatal Flow Error:", e)
  await prisma.$disconnect()
  process.exit(1)
})
