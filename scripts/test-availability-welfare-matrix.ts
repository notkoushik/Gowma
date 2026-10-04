/**
 * GOMAA Manager Availability & Sacred Welfare Protocol Verification Suite
 * Tests per-animal time-slot availability, 90m resting cooldown enforcement,
 * manager 1-click slot locking/unlocking, and daily seva ceilings.
 */

import { animals as seedAnimals } from "../src/data/animals"
import { bookings as seedBookings, type Booking } from "../src/data/mock"

function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number)
  return (h || 0) * 60 + (m || 0)
}

interface SlotCheckResult {
  available: boolean
  status: "Available" | "Booked" | "Buffer" | "Blocked"
  bookingId?: string
  customer?: string
  reason?: string
}

function checkAnimalAvailabilityLogic(
  animal: string,
  date: string,
  time: string,
  durationMin: number = 60,
  blockedSlots: Record<string, string[]>,
  animalsList = seedAnimals,
  bookingsList = seedBookings,
): SlotCheckResult {
  const animalObj = animalsList.find(
    (a) => a.name.toLowerCase() === animal.toLowerCase(),
  )

  if (animalObj) {
    if (animalObj.status === "Vet Care") {
      return {
        available: false,
        status: "Blocked",
        reason: `Animal placed under veterinary care & inspection (${animalObj.healthNotes || "Resting"})`,
      }
    }
    if (animalObj.status === "Heat Hold") {
      return {
        available: false,
        status: "Blocked",
        reason: "Animal on heat stress hold (midday thermal threshold exceeded)",
      }
    }
    if (animalObj.status === "Recovering") {
      return {
        available: false,
        status: "Blocked",
        reason: "Animal undergoing post-treatment rehabilitation (no commercial transit)",
      }
    }
  }

  // 1. Check manual blocks
  const key = `${animal}-${date}`
  const blocked = blockedSlots[key] || []
  if (blocked.includes(time)) {
    return {
      available: false,
      status: "Blocked",
      reason: "Manually blocked by Gosala admin for animal resting / vet inspection",
    }
  }

  // 2. Check Max Daily Welfare Limit
  const isCalfOrSenior =
    (animalObj?.ageYears !== undefined && (animalObj.ageYears < 3 || animalObj.ageYears > 10)) ||
    animal.toLowerCase().includes("kesari") ||
    animal.toLowerCase().includes("calf")
  const maxDailyLimit = animalObj?.maxDailyTrips || (isCalfOrSenior ? 1 : 2)

  const activeSameDayBookings = bookingsList.filter(
    (b) =>
      b.animal.toLowerCase() === animal.toLowerCase() &&
      b.date === date &&
      b.status !== "Rejected" &&
      b.status !== "Cancelled",
  )

  if (activeSameDayBookings.length >= maxDailyLimit) {
    return {
      available: false,
      status: "Blocked",
      reason: `Maximum daily welfare limit reached (${activeSameDayBookings.length}/${maxDailyLimit} sevas scheduled today)`,
    }
  }

  // 3. Sacred Welfare: 90-min Resting Cooldown & 30-min Prep Buffer
  const slotStart = toMinutes(time)
  const slotEnd = slotStart + durationMin
  const welfareBuffer = animalObj?.cooldownMinutes || 90
  const prepBuffer = 30

  for (const b of activeSameDayBookings) {
    const bStart = toMinutes(b.start)
    const bEnd = toMinutes(b.end)
    const bEndWithCooldown = bEnd + welfareBuffer

    // Direct overlap
    if (slotStart < bEnd && slotEnd > bStart) {
      return {
        available: false,
        status: "Booked",
        bookingId: b.id,
        customer: b.customer,
        reason: `Reserved for booking ${b.id} (${b.start}–${b.end})`,
      }
    }

    // Post-trip resting cooldown (90 min)
    if (slotStart >= bEnd && slotStart < bEndWithCooldown) {
      const remaining = bEndWithCooldown - slotStart
      return {
        available: false,
        status: "Buffer",
        bookingId: b.id,
        reason: `Mandatory 90-min resting cooldown after trip ${b.id} (${remaining}m remaining)`,
      }
    }

    // Pre-trip preparation buffer (30 min)
    if (slotEnd > bStart - prepBuffer && slotStart < bStart) {
      return {
        available: false,
        status: "Buffer",
        bookingId: b.id,
        reason: `Pre-dispatch inspection & grooming buffer for trip ${b.id}`,
      }
    }
  }

  return { available: true, status: "Available" }
}

async function runAvailabilityTests() {
  console.log("=====================================================================")
  console.log("   GOMAA AVAILABILITY & SACRED WELFARE GRID AUDIT SUITE              ")
  console.log("=====================================================================\n")

  let passed = 0
  let failed = 0

  function assert(desc: string, cond: boolean, details?: string) {
    if (cond) {
      console.log(`  ✓ PASS: ${desc}`)
      passed++
    } else {
      console.error(`  ✗ FAIL: ${desc}`)
      if (details) console.error(`    ↳ Reason: ${details}`)
      failed++
    }
  }

  const blockedSlots: Record<string, string[]> = {
    "Shyam-26 Sep 2026": ["11:00", "12:00"],
  }

  // TEST SUITE 1: Basic Slot Resolution & State
  console.log("---------------------------------------------------------------------")
  console.log("Test Suite 1: Slot Resolution on Resting & Active Cattle")
  console.log("---------------------------------------------------------------------")

  const gauri28Sep08 = checkAnimalAvailabilityLogic("Gauri", "28 Sep 2026", "08:00", 60, blockedSlots)
  assert("Gauri 08:00 on 28 Sep 2026 is Available", gauri28Sep08.status === "Available" && gauri28Sep08.available === true)

  // Direct booked overlap test
  const gauri26Sep10 = checkAnimalAvailabilityLogic("Gauri", "26 Sep 2026", "10:00", 60, blockedSlots)
  assert("Gauri 10:00 on 26 Sep 2026 returns 'Booked'", gauri26Sep10.status === "Booked" && gauri26Sep10.available === false)
  assert("Gauri 10:00 correctly attributes Devotee 'Ananya Deshmukh'", gauri26Sep10.customer === "Ananya Deshmukh")

  // TEST SUITE 2: Mandatory 90-Minute Resting Cooldown
  console.log("\n---------------------------------------------------------------------")
  console.log("Test Suite 2: Sacred Welfare 90-Minute Resting Buffer Invariant")
  console.log("---------------------------------------------------------------------")

  // Gauri has booking GMA-24817 (10:00 - 12:00) on 26 Sep 2026
  // Post-trip cooldown is 12:00 + 90m = 13:30.
  // Therefore 12:00 and 13:00 slots must be 'Buffer'
  const gauri26Sep12 = checkAnimalAvailabilityLogic("Gauri", "26 Sep 2026", "12:00", 60, blockedSlots)
  assert("Gauri 12:00 immediately post-trip is protected with 'Buffer'", gauri26Sep12.status === "Buffer")
  assert("Buffer reason specifies 90-min cooldown", gauri26Sep12.reason?.includes("90-min resting cooldown") === true)

  const gauri26Sep13 = checkAnimalAvailabilityLogic("Gauri", "26 Sep 2026", "13:00", 60, blockedSlots)
  assert("Gauri 13:00 is within 90-min resting cooldown", gauri26Sep13.status === "Buffer")

  // At 14:00 (after 13:30), Gauri should be Available (subject to daily limit)
  const gauri26Sep14 = checkAnimalAvailabilityLogic("Gauri", "26 Sep 2026", "14:00", 60, blockedSlots)
  assert("Gauri 14:00 (after 90m cooldown expires) is Available", gauri26Sep14.status === "Available")

  // TEST SUITE 3: Manager 1-Click Slot Lock & Unlock
  console.log("\n---------------------------------------------------------------------")
  console.log("Test Suite 3: Manager 1-Click Slot Lock & Unlock")
  console.log("---------------------------------------------------------------------")

  // Pre-configured block in blockedSlots
  const shyam26Sep11 = checkAnimalAvailabilityLogic("Shyam", "26 Sep 2026", "11:00", 60, blockedSlots)
  assert("Pre-configured manual block returns 'Blocked'", shyam26Sep11.status === "Blocked")
  assert("Blocked reason specifies manual manager action", shyam26Sep11.reason?.includes("Manually blocked") === true)

  // Dynamic lock action
  const key = "Lakshmi-28 Sep 2026"
  blockedSlots[key] = ["15:00"]
  const lakshmi28Sep15Locked = checkAnimalAvailabilityLogic("Lakshmi", "28 Sep 2026", "15:00", 60, blockedSlots)
  assert("Locking slot 15:00 on Lakshmi dynamically returns 'Blocked'", lakshmi28Sep15Locked.status === "Blocked")

  // Dynamic unlock action
  blockedSlots[key] = blockedSlots[key].filter((t) => t !== "15:00")
  const lakshmi28Sep15Unlocked = checkAnimalAvailabilityLogic("Lakshmi", "28 Sep 2026", "15:00", 60, blockedSlots)
  assert("Unlocking slot 15:00 restores status to 'Available'", lakshmi28Sep15Unlocked.status === "Available")

  // TEST SUITE 4: Cross-Animal & Cross-Date Isolation
  console.log("\n---------------------------------------------------------------------")
  console.log("Test Suite 4: Multi-Animal & Date Boundary Isolation")
  console.log("---------------------------------------------------------------------")

  blockedSlots["Gauri-28 Sep 2026"] = ["09:00"]
  const gauriBlocked = checkAnimalAvailabilityLogic("Gauri", "28 Sep 2026", "09:00", 60, blockedSlots)
  const lakshmiNotBlocked = checkAnimalAvailabilityLogic("Lakshmi", "28 Sep 2026", "09:00", 60, blockedSlots)
  assert("Gauri 09:00 is Blocked", gauriBlocked.status === "Blocked")
  assert("Lakshmi 09:00 remains Available (Zero cross-animal bleed)", lakshmiNotBlocked.status === "Available")

  const gauriNextDay = checkAnimalAvailabilityLogic("Gauri", "29 Sep 2026", "09:00", 60, blockedSlots)
  assert("Gauri on next day 29 Sep 09:00 remains Available (Zero date bleed)", gauriNextDay.status === "Available")

  // TEST SUITE 5: Daily Seva Ceiling Protocol
  console.log("\n---------------------------------------------------------------------")
  console.log("Test Suite 5: Daily Seva Ceiling Protocol (Max 2 Sevas/Day)")
  console.log("---------------------------------------------------------------------")

  // Mock a cow with 2 active bookings on 29 Sep 2026
  const mockBookings: Booking[] = [
    {
      id: "TEST-BK-1",
      customer: "Devotee 1",
      phone: "+91 90000 11111",
      gosala: "Shri Krishna Gaushala",
      animal: "Gauri",
      animalType: "Cow",
      date: "29 Sep 2026",
      start: "08:00",
      end: "09:00",
      durationMin: 60,
      address: "Hyderabad",
      distanceKm: 5,
      base: 3500,
      extraTime: 0,
      transport: 0,
      addons: 0,
      tax: 420,
      discount: 0,
      total: 3920,
      commissionPct: 20,
      status: "Confirmed",
      driver: null,
      driverStage: 0,
      paid: true,
    },
    {
      id: "TEST-BK-2",
      customer: "Devotee 2",
      phone: "+91 90000 22222",
      gosala: "Shri Krishna Gaushala",
      animal: "Gauri",
      animalType: "Cow",
      date: "29 Sep 2026",
      start: "14:00",
      end: "15:00",
      durationMin: 60,
      address: "Hyderabad",
      distanceKm: 5,
      base: 3500,
      extraTime: 0,
      transport: 0,
      addons: 0,
      tax: 420,
      discount: 0,
      total: 3920,
      commissionPct: 20,
      status: "Confirmed",
      driver: null,
      driverStage: 0,
      paid: true,
    },
  ]

  const gauri29SepSlotAfterLimit = checkAnimalAvailabilityLogic(
    "Gauri",
    "29 Sep 2026",
    "17:00",
    60,
    {},
    seedAnimals,
    mockBookings,
  )
  assert("Gauri with 2/2 sevas booked has remaining slots blocked", gauri29SepSlotAfterLimit.status === "Blocked")
  assert("Ceiling reason mentions Maximum daily welfare limit reached", gauri29SepSlotAfterLimit.reason?.includes("Maximum daily welfare limit reached") === true)

  console.log("\n=====================================================================")
  console.log(`TEST SUMMARY: ${passed + failed} TESTS EVALUATED`)
  console.log(`  PASSED: ${passed} | FAILED: ${failed}`)
  console.log("=====================================================================")

  if (failed === 0) {
    console.log("\n  ALL AVAILABILITY & SACRED WELFARE PROTOCOL CONTRACTS VERIFIED 100%!")
  } else {
    process.exit(1)
  }
}

runAvailabilityTests()
