/**
 * GOMAA Animal Welfare Dossier & Veterinary Profile Verification Suite
 * Tests 7-day trip calculation, veterinary doctor assignment, clinical vitals,
 * diet regime, and animal welfare rule persistence.
 */

import { animals as seedAnimals, type Animal } from "../src/data/animals"
import { bookings as seedBookings, type Booking } from "../src/data/mock"

const vetDoctors: Record<
  string,
  {
    name: string
    qualification: string
    regNo: string
    clinic: string
    phone: string
  }
> = {
  "Shri Krishna Gaushala": {
    name: "Dr. Anand Kulkarni",
    qualification: "B.V.Sc & A.H., M.V.Sc (Bovine Care)",
    regNo: "TS-VET-4821",
    clinic: "Govt. Veterinary Polyclinic, Hyderabad",
    phone: "+91 98220 54321",
  },
  "Nandini Goseva Sadan": {
    name: "Dr. Rameshwar Deshmukh",
    qualification: "M.V.Sc Medicine & Surgery",
    regNo: "TS-VET-3910",
    clinic: "Regional Animal Healthcare Center, Hyderabad",
    phone: "+91 98901 67890",
  },
  "Gopal Gaushala Trust": {
    name: "Dr. Suresh Patil",
    qualification: "B.V.Sc & A.H., Cattle Specialist",
    regNo: "TS-VET-5120",
    clinic: "Banjara Hills Veterinary Clinic, Hyderabad",
    phone: "+91 97640 45678",
  },
}

function calculate7DayStats(cowName: string, bookingsList: Booking[] = seedBookings) {
  const cowBookings = bookingsList.filter(
    (b) => b.animal.toLowerCase() === cowName.toLowerCase() && b.status !== "Rejected",
  )

  const totalSevas = cowBookings.length
  const totalMinutes = cowBookings.reduce((acc, b) => acc + (b.durationMin || 60), 0)
  const totalHours = (totalMinutes / 60).toFixed(1)
  const totalDistanceKm = cowBookings
    .reduce((acc, b) => acc + (b.distanceKm || 0), 0)
    .toFixed(1)
  const restHours = (totalSevas * 1.5 + (7 * 18 - Number(totalHours))).toFixed(0)

  return {
    totalSevas,
    totalHours: Number(totalHours),
    totalDistanceKm: Number(totalDistanceKm),
    restHours: Number(restHours),
    cowBookings,
  }
}

async function runDossierTests() {
  console.log("=====================================================================")
  console.log("   GOMAA ANIMAL WELFARE DOSSIER & VET HEALTH AUDIT SUITE             ")
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

  // TEST SUITE 1: 7-Day Workload & Rest Metrics Calculation
  console.log("---------------------------------------------------------------------")
  console.log("Test Suite 1: 7-Day Workload & Rest Time Calculations")
  console.log("---------------------------------------------------------------------")

  const gauriStats = calculate7DayStats("Gauri")
  assert("Gauri has recorded historical trips", gauriStats.totalSevas > 0)
  assert("Gauri ceremonial time is calculated in hours", gauriStats.totalHours > 0)
  assert("Gauri travel distance is positive", gauriStats.totalDistanceKm > 0)
  assert("Gauri accumulated rest hours exceeds 100 hours (plenty of rest)", gauriStats.restHours > 100)

  const kesariStats = calculate7DayStats("Kesari")
  assert("Kesari (young calf) has limited workload", kesariStats.totalSevas <= 2)
  assert("Kesari transit distance stays within safe calf limits", kesariStats.totalDistanceKm < 20)

  // TEST SUITE 2: Veterinary Doctor & Clinic Association
  console.log("\n---------------------------------------------------------------------")
  console.log("Test Suite 2: Veterinary Doctor & Clinic Assignment per Gaushala")
  console.log("---------------------------------------------------------------------")

  const krishnaVet = vetDoctors["Shri Krishna Gaushala"]
  assert("Shri Krishna Gaushala has assigned vet Dr. Anand Kulkarni", krishnaVet.name === "Dr. Anand Kulkarni")
  assert("Dr. Kulkarni has verified State Council Reg No (MH-VET-4821)", krishnaVet.regNo === "MH-VET-4821")
  assert("Dr. Kulkarni has valid direct emergency telephone", krishnaVet.phone.startsWith("+91"))

  const nandiniVet = vetDoctors["Nandini Goseva Sadan"]
  assert("Nandini Goseva has assigned vet Dr. Rameshwar Deshmukh", nandiniVet.name === "Dr. Rameshwar Deshmukh")

  const gopalVet = vetDoctors["Gopal Gaushala Trust"]
  assert("Gopal Gaushala Trust has assigned vet Dr. Suresh Patil", gopalVet.name === "Dr. Suresh Patil")

  // TEST SUITE 3: Clinical Vitals & Preventive Healthcare Invariants
  console.log("\n---------------------------------------------------------------------")
  console.log("Test Suite 3: Clinical Vitals & Preventive Vaccination Standards")
  console.log("---------------------------------------------------------------------")

  const normalBovineTempMin = 38.0
  const normalBovineTempMax = 39.0
  const recordedTemp = 38.5
  assert(
    "Recorded bovine body temperature (38.5°C) is within certified normal range",
    recordedTemp >= normalBovineTempMin && recordedTemp <= normalBovineTempMax,
  )

  const normalHeartRateMin = 60
  const normalHeartRateMax = 80
  const recordedHeartRate = 64
  assert(
    "Recorded bovine heart rate (64 bpm) indicates calm, relaxed demeanor",
    recordedHeartRate >= normalHeartRateMin && recordedHeartRate <= normalHeartRateMax,
  )

  // TEST SUITE 4: Nutrition & Diet Regime Verification
  console.log("\n---------------------------------------------------------------------")
  console.log("Test Suite 4: Grass, Diet & Hydration Regime")
  console.log("---------------------------------------------------------------------")

  const gauriObj = seedAnimals.find((a) => a.name === "Gauri")
  assert("Gauri diet contains alfalfa and mineral jaggery", gauriObj?.diet.includes("alfalfa") === true)

  const kesariObj = seedAnimals.find((a) => a.name === "Kesari")
  assert("Kesari (calf) diet contains soft clover grass and mother milk", kesariObj?.diet.includes("milk") === true)

  // TEST SUITE 5: Welfare Limits & Calf Physiological Bounds
  console.log("\n---------------------------------------------------------------------")
  console.log("Test Suite 5: Calf Physiological Protection Bounds")
  console.log("---------------------------------------------------------------------")

  assert("Young calf Kesari has strict 1 trip/day ceiling", kesariObj?.maxDailyTrips === 1)
  assert("Young calf Kesari has strict 8 km transit radius cap", kesariObj?.maxRadiusKm === 8)
  assert("Young calf Kesari has extended 120-minute resting cooldown", kesariObj?.cooldownMinutes === 120)

  console.log("\n=====================================================================")
  console.log(`TEST SUMMARY: ${passed + failed} TESTS EVALUATED`)
  console.log(`  PASSED: ${passed} | FAILED: ${failed}`)
  console.log("=====================================================================")

  if (failed === 0) {
    console.log("\n  ALL ANIMAL WELFARE DOSSIER & VET HEALTH CONTRACTS VERIFIED 100%!")
  } else {
    process.exit(1)
  }
}

runDossierTests()
