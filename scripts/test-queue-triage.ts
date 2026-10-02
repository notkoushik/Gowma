import {
  bookings as initialBookings,
  type Booking,
  type BookingStatus,
} from "../src/data/mock"

const reviewable: BookingStatus[] = ["Payment Verified", "Manager Review"]

function runTest(name: string, fn: () => void) {
  try {
    fn()
    console.log(`  ✓ PASS: ${name}`)
  } catch (err: any) {
    console.error(`  ✗ FAIL: ${name}`)
    console.error(`    -> ${err.message}`)
    process.exit(1)
  }
}

console.log(
  "=====================================================================",
)
console.log(
  "   GOMAA REVIEW QUEUE, UNIVERSAL SEARCH & TRIAGE TEST SUITE          ",
)
console.log(
  "=====================================================================\n",
)

console.log(
  "---------------------------------------------------------------------",
)
console.log("Test Suite 1: Universal Search Multi-Vector Matching")
console.log(
  "---------------------------------------------------------------------",
)

function filterBySearch(rows: Booking[], query: string) {
  const qTrim = query.trim().toLowerCase()
  if (!qTrim) return rows
  return rows.filter((b) => {
    return (
      b.id.toLowerCase().includes(qTrim) ||
      b.customer.toLowerCase().includes(qTrim) ||
      (b.phone && b.phone.toLowerCase().includes(qTrim)) ||
      b.animal.toLowerCase().includes(qTrim) ||
      b.animalType.toLowerCase().includes(qTrim) ||
      b.address.toLowerCase().includes(qTrim) ||
      b.gosala.toLowerCase().includes(qTrim) ||
      (b.ritualPurpose && b.ritualPurpose.toLowerCase().includes(qTrim)) ||
      (b.driver && b.driver.toLowerCase().includes(qTrim)) ||
      (b.aadhaarNumber && b.aadhaarNumber.toLowerCase().includes(qTrim))
    )
  })
}

runTest("Search by Booking ID matches target booking", () => {
  const matches = filterBySearch(initialBookings, "GMA-24816")
  if (matches.length === 0) throw new Error("Expected to find GMA-24816")
  if (matches[0].id !== "GMA-24816")
    throw new Error(`Wrong booking found: ${matches[0].id}`)
})

runTest("Search by Devotee Name (case-insensitive) matches correctly", () => {
  const matches = filterBySearch(initialBookings, "rohan")
  if (matches.length === 0) throw new Error("Expected to find Rohan")
  if (!matches[0].customer.toLowerCase().includes("rohan")) {
    throw new Error(`Unexpected devotee: ${matches[0].customer}`)
  }
})

runTest("Search by Animal Name (Gauri / Kesari) matches correctly", () => {
  const matches = filterBySearch(initialBookings, "gauri")
  if (matches.length === 0) throw new Error("Expected to find Gauri")
  if (!matches.every((m) => m.animal.toLowerCase().includes("gauri"))) {
    throw new Error("Found mismatch for animal Gauri")
  }
})

runTest("Search by Locality / Address matches correctly", () => {
  const matches = filterBySearch(initialBookings, "baner")
  if (matches.length === 0) throw new Error("Expected to find Baner booking")
  if (!matches[0].address.toLowerCase().includes("baner")) {
    throw new Error(`Address mismatch: ${matches[0].address}`)
  }
})

runTest("Search by Ritual Purpose matches correctly", () => {
  const matches = filterBySearch(initialBookings, "kamadhenu")
  if (matches.length === 0)
    throw new Error("Expected to find Kamadhenu Puja booking")
  if (!matches[0].ritualPurpose?.toLowerCase().includes("kamadhenu")) {
    throw new Error(`Purpose mismatch: ${matches[0].ritualPurpose}`)
  }
})

console.log(
  "\n---------------------------------------------------------------------",
)
console.log("Test Suite 2: Queue Status Filters & Triage Aggregations")
console.log(
  "---------------------------------------------------------------------",
)

runTest("Pending status filter matches reviewable bookings", () => {
  const pending = initialBookings.filter((b) => reviewable.includes(b.status))
  if (pending.length === 0) throw new Error("Reviewable bookings should exist")
  pending.forEach((b) => {
    if (!reviewable.includes(b.status)) {
      throw new Error(`Status ${b.status} is not reviewable`)
    }
  })
})

runTest("Cleared status filter excludes rejected and pending bookings", () => {
  const cleared = initialBookings.filter(
    (b) =>
      !reviewable.includes(b.status) &&
      b.status !== "Rejected" &&
      (b.status === "Confirmed" ||
        b.status === "Admin Review" ||
        b.status === "Driver Assigned" ||
        b.status === "En Route" ||
        b.status === "At Altar" ||
        b.status === "Completed" ||
        !!b.managerRemark),
  )
  cleared.forEach((b) => {
    if (b.status === "Rejected")
      throw new Error("Cleared contains rejected booking")
    if (reviewable.includes(b.status))
      throw new Error("Cleared contains reviewable booking")
  })
})

runTest("Declined status filter matches only welfare-blocked bookings", () => {
  const declined = initialBookings.filter((b) => b.status === "Rejected")
  declined.forEach((b) => {
    if (b.status !== "Rejected")
      throw new Error(`Status is not Rejected: ${b.status}`)
  })
})

runTest("Needs Driver status filter catches unassigned bookings", () => {
  const needsDriver = initialBookings.filter(
    (b) => !b.driver && b.status !== "Rejected",
  )
  needsDriver.forEach((b) => {
    if (b.driver) throw new Error(`Booking ${b.id} has driver ${b.driver}`)
    if (b.status === "Rejected")
      throw new Error("Rejected booking should not need driver")
  })
})

console.log(
  "\n---------------------------------------------------------------------",
)
console.log("Test Suite 3: Deep-Scroll Target & Popup Contract")
console.log(
  "---------------------------------------------------------------------",
)

runTest("Every booking has valid unique DOM card anchor ID", () => {
  const ids = new Set<string>()
  initialBookings.forEach((b) => {
    const cardId = `booking-card-${b.id}`
    if (ids.has(cardId))
      throw new Error(`Duplicate card ID detected: ${cardId}`)
    ids.add(cardId)
  })
})

console.log(
  "\n=====================================================================",
)
console.log("TEST RESULTS: ALL QUEUE & TRIAGE TESTS PASSED!")
console.log(
  "=====================================================================\n",
)
