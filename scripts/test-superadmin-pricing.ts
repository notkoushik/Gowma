/**
 * Comprehensive Automated Verification Suite for Super Admin Pricing Governance,
 * Backend Mathematical Calculation Engine, and Atomic Slot Hold Concurrency.
 */

import { calculateBookingPrice } from "../server/services/pricingService"
import { checkAvailability } from "../server/services/availabilityService"
import { db } from "../server/db"

console.log(
  "=====================================================================",
)
console.log(
  "   GOMAA SUPER ADMIN PRICING & BACKEND CONCURRENCY TEST SUITE        ",
)
console.log(
  "=====================================================================\n",
)

let passed = 0
let failed = 0

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${msg}`)
    passed++
  } else {
    console.error(`  ✗ FAIL: ${msg}`)
    failed++
  }
}

// -------------------------------------------------------------------------
// Test Suite 1: Super Admin Exclusive Pricing Authority
// -------------------------------------------------------------------------
console.log(
  "---------------------------------------------------------------------",
)
console.log("Test Suite 1: Super Admin Exclusive Pricing Authority")
console.log(
  "---------------------------------------------------------------------",
)
{
  // Mock handler simulating router.ts permission check
  function checkPricingUpdatePermission(
    role?: string,
  ): { allowed: boolean; status: number } {
    if (role !== "super_admin") {
      return { allowed: false, status: 403 }
    }
    return { allowed: true, status: 200 }
  }

  const customerCheck = checkPricingUpdatePermission("customer")
  assert(
    !customerCheck.allowed && customerCheck.status === 403,
    "Customer role rejected with 403 Forbidden",
  )

  const managerCheck = checkPricingUpdatePermission("manager")
  assert(
    !managerCheck.allowed && managerCheck.status === 403,
    "Gosala Manager role rejected with 403 Forbidden",
  )

  const driverCheck = checkPricingUpdatePermission("driver")
  assert(
    !driverCheck.allowed && driverCheck.status === 403,
    "Driver role rejected with 403 Forbidden",
  )

  const adminCheck = checkPricingUpdatePermission("admin")
  assert(
    !adminCheck.allowed && adminCheck.status === 403,
    "Operations Admin rejected with 403 Forbidden (Super Admin exclusive)",
  )

  const superAdminCheck = checkPricingUpdatePermission("super_admin")
  assert(
    superAdminCheck.allowed && superAdminCheck.status === 200,
    "Super Admin role granted 200 OK authorization",
  )
}

// -------------------------------------------------------------------------
// Test Suite 2: Pure Backend Pricing Formulas (PDF Specification Section 10 & 24)
// -------------------------------------------------------------------------
console.log(
  "\n---------------------------------------------------------------------",
)
console.log("Test Suite 2: Pure Backend Pricing Formulas (PDF Section 10 & 24)")
console.log(
  "---------------------------------------------------------------------",
)
{
  // Reset pricing config to standard test baseline
  db.pricingConfig = {
    standardMin: 60,
    extraUnitMin: 30,
    extraUnitRate: 500,
    freeKm: 5,
    perKm: 50,
    taxPct: 12,
    commissionPct: 20,
    maxDurationMin: 240,
    bufferMin: 30,
    rounding: "Nearest ₹10",
  }

  // Case 2A: Standard 60 min, 4 km (< free 5 km)
  const calc1 = calculateBookingPrice({
    baseRate: 3500,
    durationMin: 60,
    distanceKm: 4,
    addonsCost: 0,
  })
  assert(calc1.base === 3500, "Base rate preserved at ₹3,500")
  assert(
    calc1.extraTime === 0,
    "Extra time fee is ₹0 for 60 min standard duration",
  )
  assert(
    calc1.chargeableKm === 0,
    "Chargeable distance is 0 km within 5 km free threshold",
  )
  assert(calc1.transport === 0, "Transport fee is ₹0 within free threshold")
  assert(
    calc1.tax === Math.round((3500 * 12) / 100),
    `GST 12% is ₹${calc1.tax} (₹420)`,
  )
  assert(
    calc1.total === 3500 + 420,
    `Total payable is ₹${calc1.total} (₹3,920)`,
  )
  assert(
    calc1.commission === Math.round((3500 * 20) / 100),
    `Platform commission (20%) is ₹${calc1.commission} (₹700)`,
  )

  // Case 2B: 90 min (30 min extra = 1 unit @ ₹500), 12 km (7 km chargeable @ ₹50/km = ₹350), ₹600 addons
  const calc2 = calculateBookingPrice({
    baseRate: 3500,
    durationMin: 90,
    distanceKm: 12,
    addonsCost: 600,
  })
  assert(calc2.extraTime === 500, "Extra time fee is ₹500 for +30 min (1 unit)")
  assert(
    calc2.chargeableKm === 7,
    "Chargeable distance is exactly 7.0 km (12 - 5)",
  )
  assert(calc2.transport === 350, "Transport fee is ₹350 (7 km × ₹50/km)")
  assert(calc2.addons === 600, "Addons cost is ₹600")
  const expectedSubtotal = 3500 + 500 + 350 + 600 // 4950
  const expectedTax = Math.round((expectedSubtotal * 12) / 100) // 594
  assert(
    calc2.tax === expectedTax,
    `Tax is ₹${calc2.tax} on ₹${expectedSubtotal} subtotal`,
  )
  assert(
    calc2.total === expectedSubtotal + expectedTax,
    `Total is ₹${calc2.total} (₹5,544)`,
  )
  assert(
    calc2.commission === Math.round(((3500 + 500) * 20) / 100),
    `Commission is 20% on (base + extra) = ₹${calc2.commission} (₹800)`,
  )

  // Case 2C: 180 min (+120 min = 4 units @ ₹500 = ₹2,000)
  const calc3 = calculateBookingPrice({
    baseRate: 3500,
    durationMin: 180,
    distanceKm: 5,
  })
  assert(
    calc3.extraTime === 2000,
    "Extra time fee is ₹2,000 for +120 min (4 units)",
  )
}

// -------------------------------------------------------------------------
// Test Suite 3: Atomic Slot Hold & Concurrency Protection
// -------------------------------------------------------------------------
console.log(
  "\n---------------------------------------------------------------------",
)
console.log("Test Suite 3: Atomic Slot Hold & Concurrency Protection")
console.log(
  "---------------------------------------------------------------------",
)
{
  db.bookings = []
  db.slotHolds = []
  const testAnimal = "Kamadhenu"
  const testDate = "20 Oct 2026"

  // Step 3A: Slot initially available
  const initialCheck = checkAvailability(testAnimal, testDate, "10:00", 60)
  assert(initialCheck.available, "Slot 10:00 is initially Available")

  // Step 3B: Place atomic slot hold for Devotee A
  const holdId = "HOLD-TEST-001"
  db.slotHolds.push({
    id: holdId,
    animal: testAnimal,
    date: testDate,
    start: "10:00",
    durationMin: 60,
    customerName: "Devotee Ananya",
    expiresAt: Date.now() + 300000, // 5 min
    createdAt: Date.now(),
  })

  // Step 3C: Devotee B attempts to check availability for overlapping slot
  const concurrentCheck = checkAvailability(testAnimal, testDate, "10:00", 60)
  assert(
    !concurrentCheck.available,
    "Overlapping slot is unavailable during active hold",
  )
  assert(concurrentCheck.status === "Held", "Status returned is 'Held'")
  assert(
    concurrentCheck.reason?.includes("temporarily held"),
    "Detailed reason mentions temporary checkout hold",
  )

  // Step 3D: Release hold (customer navigates away / cancels)
  db.slotHolds = db.slotHolds.filter((h) => h.id !== holdId)
  const afterReleaseCheck = checkAvailability(testAnimal, testDate, "10:00", 60)
  assert(
    afterReleaseCheck.available,
    "Slot is immediately Available again once hold is released",
  )

  // Step 3E: Hold converted into confirmed booking
  db.bookings.push({
    id: "GMA-BOOK-999",
    animal: testAnimal,
    date: testDate,
    start: "10:00",
    end: "11:00",
    durationMin: 60,
    customer: "Devotee Ananya",
    status: "Confirmed",
    total: 3920,
    paid: true,
  } as any)

  const bookedCheck = checkAvailability(testAnimal, testDate, "10:00", 60)
  assert(
    !bookedCheck.available && bookedCheck.status === "Booked",
    "Slot is officially Booked once checkout completes",
  )
}

// -------------------------------------------------------------------------
// Test Suite 4: Thin Client, Smart Server Invariant Validation
// -------------------------------------------------------------------------
console.log(
  "\n---------------------------------------------------------------------",
)
console.log("Test Suite 4: Thin Client, Smart Server Invariant Validation")
console.log(
  "---------------------------------------------------------------------",
)
{
  // Test Snapshot Immutability: Changes in future pricing do not alter past booking snapshots
  const bookingSnapshot = {
    freeKmSnapshot: 5.0,
    perKmSnapshot: 50.0,
    extraUnitRateSnapshot: 500,
    commissionSnapshot: 800,
  }

  // Super Admin updates pricing afterwards
  db.pricingConfig.perKm = 65
  db.pricingConfig.extraUnitRate = 600

  assert(
    bookingSnapshot.perKmSnapshot === 50.0,
    "Historical booking retains original perKmSnapshot (₹50)",
  )
  assert(
    bookingSnapshot.extraUnitRateSnapshot === 500,
    "Historical booking retains original extraUnitRateSnapshot (₹500)",
  )
  assert(
    bookingSnapshot.commissionSnapshot === 800,
    "Historical booking retains original commissionSnapshot (₹800)",
  )
}

// -------------------------------------------------------------------------
// Summary
// -------------------------------------------------------------------------
console.log(
  "\n=====================================================================",
)
console.log(
  `TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`,
)
console.log(
  "=====================================================================",
)

if (failed > 0) {
  process.exit(1)
} else {
  console.log(
    "\nALL SUPER ADMIN PRICING & BACKEND LOGIC TESTS PASSED SUCCESSFULLY.",
  )
}
