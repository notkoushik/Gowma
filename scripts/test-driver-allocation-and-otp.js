// scripts/test-driver-allocation-and-otp.js
// End-to-end automated verification of Driver Allocation & Dynamic Customer Handover OTP

const BASE_URL = "http://localhost:8443"

async function runTests() {
  console.log("=================================================================")
  console.log("🚗 GOMAA DRIVER ALLOCATION & DEVOTEE HANDOVER OTP E2E TEST SUITE")
  console.log("=================================================================\n")

  const testBookingId = `GMA-OTP-${Math.floor(10000 + Math.random() * 90000)}`
  let generatedOtp = ""

  // TEST 1: Booking Creation & Dynamic OTP Generation
  console.log(`[TEST 1] Creating booking ${testBookingId} and verifying dynamic OTP generation...`)
  const bookingPayload = {
    booking: {
      id: testBookingId,
      customer: "Sri Rajesh Varma",
      phone: "+91 98204 11827",
      gosala: "RamNath Gaushala & Vedic Sanctuary",
      animal: "Kamadhenu Nandi",
      animalType: "Bull",
      date: new Date().toLocaleDateString("en-IN"),
      start: "10:00",
      end: "11:00",
      durationMin: 60,
      address: "Plot 42, Jubilee Hills, Hyderabad",
      distanceKm: 9.5,
      base: 2500,
      extraTime: 0,
      transport: 225,
      addons: 350,
      tax: 154,
      discount: 0,
      total: 3229,
      status: "Payment Verified",
      driver: null,
      driverStage: 0,
      paid: true,
    },
  }

  const createRes = await fetch(`${BASE_URL}/api/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bookingPayload),
  })

  if (!createRes.ok) {
    throw new Error(`Failed to create test booking: ${createRes.status} ${await createRes.text()}`)
  }

  const createData = await createRes.json()
  const createdBooking = createData.booking
  generatedOtp = createdBooking.handoverOtp

  console.log(`  ✓ Booking created: ${createdBooking.id}`)
  console.log(`  ✓ Devotee Handover OTP generated: [ ${generatedOtp} ]`)
  console.log(`  ✓ handoverOtpVerified status: ${createdBooking.handoverOtpVerified}`)

  if (!generatedOtp || generatedOtp.length !== 4) {
    throw new Error(`FAILURE: handoverOtp must be a 4-digit code, received: "${generatedOtp}"`)
  }
  if (createdBooking.handoverOtpVerified !== false) {
    throw new Error(`FAILURE: handoverOtpVerified must initialize to false`)
  }
  console.log("  >>> TEST 1 PASSED: 4-digit OTP generated and unverified by default.\n")

  // TEST 2: Swiggy/Uber-Style Driver Allocation & Pilot Dossier
  console.log(`[TEST 2] Allocating Driver with rich pilot & cattle ambulance dossier...`)
  const pilotPayload = {
    driver: "Suresh Patil",
    driverPhone: "+91 98490 23456",
    driverVehiclePlate: "TS 09 EA 4402",
    driverVehicleModel: "Force Traveller Cattle Ambulance",
    driverRating: 4.95,
    driverTotalTrips: 184,
  }

  const assignRes = await fetch(`${BASE_URL}/api/bookings/${testBookingId}/assign-driver`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(pilotPayload),
  })

  if (!assignRes.ok) {
    throw new Error(`Failed to assign driver: ${assignRes.status} ${await assignRes.text()}`)
  }

  const assignData = await assignRes.json()
  const assignedBooking = assignData.booking

  console.log(`  ✓ Driver assigned: ${assignedBooking.driver}`)
  console.log(`  ✓ Driver Phone: ${assignedBooking.driverPhone}`)
  console.log(`  ✓ Vehicle Plate (HSRP): ${assignedBooking.driverVehiclePlate}`)
  console.log(`  ✓ Vehicle Model: ${assignedBooking.driverVehicleModel}`)
  console.log(`  ✓ Pilot Rating: ${assignedBooking.driverRating} ⭐ (${assignedBooking.driverTotalTrips} trips)`)
  console.log(`  ✓ Stage advanced to: Stage ${assignedBooking.driverStage}`)

  if (assignedBooking.driver !== "Suresh Patil" || assignedBooking.driverVehiclePlate !== "TS 09 EA 4402") {
    throw new Error(`FAILURE: Driver dossier was not populated properly on the booking`)
  }
  console.log("  >>> TEST 2 PASSED: Pilot dossier and cattle ambulance verified.\n")

  // TEST 3: Advancing Stages to Stage 5 ("Arrived at Customer")
  console.log(`[TEST 3] Stepping through transit stages to Stage 5 ("Arrived at Customer")...`)
  for (let s = 2; s <= 5; s++) {
    const advRes = await fetch(`${BASE_URL}/api/bookings/${testBookingId}/advance-stage`, {
      method: "POST",
    })
    if (!advRes.ok) {
      throw new Error(`Failed to advance to stage ${s}: ${advRes.status} ${await advRes.text()}`)
    }
    const advData = await advRes.json()
    console.log(`  ✓ Advanced to Stage ${advData.booking.driverStage}`)
  }
  console.log("  >>> TEST 3 PASSED: Driver arrived outside devotee altar.\n")

  // TEST 4: Security Invariant: Stage 5 cannot advance without OTP verification
  console.log(`[TEST 4] Testing Security Invariant: Blocking Stage 6 advance without OTP verification...`)
  const bypassRes = await fetch(`${BASE_URL}/api/bookings/${testBookingId}/advance-stage`, {
    method: "POST",
  })

  console.log(`  ✓ Status response for unauthenticated advance: ${bypassRes.status}`)
  if (bypassRes.status !== 403 && bypassRes.status !== 400) {
    throw new Error(`FAILURE: Advance past Stage 5 must be blocked without OTP! Got HTTP ${bypassRes.status}`)
  }
  const bypassBody = await bypassRes.json()
  console.log(`  ✓ Security Error caught as expected: "${bypassBody.error}"`)
  console.log("  >>> TEST 4 PASSED: Seva start cannot be bypassed without customer OTP.\n")

  // TEST 5: Rejecting Invalid OTP Code
  console.log(`[TEST 5] Testing OTP Invalidation: Submitting wrong code (0000)...`)
  const invalidOtpRes = await fetch(`${BASE_URL}/api/bookings/${testBookingId}/verify-handover-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ otp: "0000" }),
  })

  console.log(`  ✓ Response for invalid OTP: ${invalidOtpRes.status}`)
  if (invalidOtpRes.status !== 400) {
    throw new Error(`FAILURE: Invalid OTP must return 400 Bad Request! Got HTTP ${invalidOtpRes.status}`)
  }
  const invalidBody = await invalidOtpRes.json()
  console.log(`  ✓ Error message received: "${invalidBody.error}"`)
  console.log("  >>> TEST 5 PASSED: Invalid OTP rejected.\n")

  // TEST 6: Successful Customer Handover OTP Verification & Unlock Stage 6
  console.log(`[TEST 6] Submitting authentic Devotee Handover OTP: [ ${generatedOtp} ]...`)
  const validOtpRes = await fetch(`${BASE_URL}/api/bookings/${testBookingId}/verify-handover-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ otp: generatedOtp }),
  })

  if (!validOtpRes.ok) {
    throw new Error(`FAILURE: Valid OTP verification failed: ${validOtpRes.status} ${await validOtpRes.text()}`)
  }

  const validData = await validOtpRes.json()
  console.log(`  ✓ Verification response success: ${validData.success}`)
  console.log(`  ✓ Updated driverStage: ${validData.booking.driverStage} (Stage 6: Service Started)`)
  console.log(`  ✓ Updated booking status: ${validData.booking.status}`)
  console.log(`  ✓ handoverOtpVerified: ${validData.booking.handoverOtpVerified}`)
  console.log(`  ✓ handoverOtpVerifiedAt: ${validData.booking.handoverOtpVerifiedAt}`)

  if (validData.booking.driverStage !== 6 || !validData.booking.handoverOtpVerified) {
    throw new Error(`FAILURE: Stage was not advanced to 6 or handoverOtpVerified was not set to true!`)
  }
  console.log("  >>> TEST 6 PASSED: Doorstep receipt authenticated & Stage 6 unlocked!\n")

  // TEST 7: Trip Completion
  console.log(`[TEST 7] Completing trip lifecycle...`)
  const completeRes = await fetch(`${BASE_URL}/api/bookings/${testBookingId}/advance-stage`, {
    method: "POST",
  })
  if (!completeRes.ok) {
    throw new Error(`Failed to advance trip after service: ${completeRes.status}`)
  }
  const completeData = await completeRes.json()
  console.log(`  ✓ Final trip status: ${completeData.booking.status} (Stage ${completeData.booking.driverStage})`)
  console.log("  >>> TEST 7 PASSED: Full trip completed successfully.\n")

  console.log("=================================================================")
  console.log("🎉 ALL 7 DRIVER ALLOCATION & HANDOVER OTP TESTS PASSED 100%!")
  console.log("=================================================================")
}

runTests().catch((err) => {
  console.error("\n❌ TEST SUITE FAILED:", err)
  process.exit(1)
})
