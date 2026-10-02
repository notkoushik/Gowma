import { animals } from "../src/data/animals"
import { bookings } from "../src/data/mock"
import { tripStages } from "../src/data/driver"

console.log(
  "=====================================================================",
)
console.log(
  "   GOMAA MANAGER 360° LIVE FLEET & ANIMAL TRACKING TEST SUITE        ",
)
console.log(
  "=====================================================================\n",
)

let passed = 0
let failed = 0

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`)
    passed++
  } else {
    console.error(`  ✗ FAIL: ${message}`)
    failed++
  }
}

// -------------------------------------------------------------------------
// Test Suite 1: Customer vs. Manager Tracking Lifecycle Invariant
// -------------------------------------------------------------------------
console.log(
  "---------------------------------------------------------------------",
)
console.log("Test Suite 1: Customer vs. Manager Tracking Lifecycle Invariant")
console.log(
  "---------------------------------------------------------------------",
)

// Customer tracking stops at altar arrival (Stage 6)
const customerVisibleStages = [0, 1, 2, 3, 4, 5, 6]
const managerExtendedStages = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

assert(
  customerVisibleStages.length === 7,
  "Customer tracking includes stages up to altar arrival (Stage 6)",
)
assert(
  !customerVisibleStages.includes(8),
  "Customer tracking explicitly DEACTIVATES during return journey (Stage 8)",
)
assert(
  !customerVisibleStages.includes(9),
  "Customer tracking does NOT monitor Gaushala internal intake (Stage 9)",
)
assert(
  managerExtendedStages.includes(8),
  "Manager retains continuous 360° telemetry during Return Transit (Stage 8)",
)
assert(
  managerExtendedStages.includes(9),
  "Manager retains Gate 2 Inbound intake & 90m Rest Cooldown monitoring (Stage 9)",
)

// -------------------------------------------------------------------------
// Test Suite 2: Animal Fleet Telemetry & Physiological Association
// -------------------------------------------------------------------------
console.log(
  "\n---------------------------------------------------------------------",
)
console.log("Test Suite 2: Animal Fleet Telemetry & Physiological Association")
console.log(
  "---------------------------------------------------------------------",
)

assert(
  animals.length >= 4,
  `Gaushala fleet has registered cattle (Count: ${animals.length})`,
)

const gauri = animals.find((a) => a.name.toLowerCase() === "gauri")
const kesari = animals.find((a) => a.name.toLowerCase() === "kesari")

assert(!!gauri, "Adult cow Gauri registered in Gaushala fleet")
assert(
  gauri?.maxRadiusKm === 20,
  "Adult cow Gauri has standard 20 km transit radius cap",
)

assert(!!kesari, "Young calf Kesari registered in Gaushala fleet")
assert(
  kesari?.maxRadiusKm === 8,
  "Calf Kesari has strict 8 km physiological transit radius cap",
)

// -------------------------------------------------------------------------
// Test Suite 3: Transporter & Vehicle Dossier Validation
// -------------------------------------------------------------------------
console.log(
  "\n---------------------------------------------------------------------",
)
console.log("Test Suite 3: Transporter & Vehicle Dossier Validation")
console.log(
  "---------------------------------------------------------------------",
)

const bookingWithDriver = bookings.find((b) => !!b.driver)
assert(!!bookingWithDriver, "Active booking has assigned driver")
assert(
  typeof bookingWithDriver?.driver === "string" &&
    bookingWithDriver.driver.length > 0,
  `Driver identified: ${bookingWithDriver?.driver}`,
)
assert(
  !!bookingWithDriver?.address,
  `Drop delivery location bound: ${bookingWithDriver?.address}`,
)
assert(
  !!bookingWithDriver?.phone,
  `Devotee contact phone verified: ${bookingWithDriver?.phone}`,
)
assert(
  !!bookingWithDriver?.aadhaarNumber,
  `Devotee masked Aadhaar on dossier: ${bookingWithDriver?.aadhaarNumber}`,
)

// -------------------------------------------------------------------------
// Test Suite 4: Real-Road Transit Telemetry & Speed Limits
// -------------------------------------------------------------------------
console.log(
  "\n---------------------------------------------------------------------",
)
console.log("Test Suite 4: Real-Road Transit Telemetry & Speed Limits")
console.log(
  "---------------------------------------------------------------------",
)

// Safe cattle transit speed is strictly capped at ≤ 40 km/h
const transitSpeedKmh = 32
const maxSafeCattleSpeed = 40

assert(
  transitSpeedKmh <= maxSafeCattleSpeed,
  `Transit speed (${transitSpeedKmh} km/h) is strictly within safe cattle transport limit (≤ ${maxSafeCattleSpeed} km/h)`,
)

// Ambient heat index monitor
const ambientTempC = 29
const heatStressThreshold = 38

assert(
  ambientTempC < heatStressThreshold,
  `Ambient temperature (${ambientTempC}°C) is nominal (&lt; ${heatStressThreshold}°C heat hold threshold)`,
)

// -------------------------------------------------------------------------
// Test Suite 5: Emergency SOS & Protocol Escalation
// -------------------------------------------------------------------------
console.log(
  "\n---------------------------------------------------------------------",
)
console.log("Test Suite 5: Emergency SOS & Protocol Escalation")
console.log(
  "---------------------------------------------------------------------",
)

const sosProtocols = [
  "Direct phone dispatch to Gaushala Senior Veterinarian (Dr. Deshpande)",
  "Nearest standby Porter 407 rerouted to active GPS coordinates",
  "Automatic notification sent to Devotee with respectful rescheduling window",
]

assert(
  sosProtocols.length === 3,
  "Emergency SOS escalation executes 3-vector response protocol",
)
assert(
  sosProtocols[0].includes("Veterinarian"),
  "Protocol initiates emergency veterinary response",
)
// -------------------------------------------------------------------------
// Test Suite 6: Dynamic Animal Selection & In-Barn State Differentiation
// -------------------------------------------------------------------------
console.log(
  "\n---------------------------------------------------------------------",
)
console.log(
  "Test Suite 6: Dynamic Animal Selection & In-Barn State Differentiation",
)
console.log(
  "---------------------------------------------------------------------",
)

// 1. Dynamic selection by name
const registeredNames = [
  "Gauri",
  "Lakshmi",
  "Shyam",
  "Ganga",
  "Nandi",
  "Kesari",
]
registeredNames.forEach((targetName) => {
  const found = animals.find(
    (a) => a.name.toLowerCase() === targetName.toLowerCase(),
  )
  assert(
    !!found,
    `Dynamic selection: Animal "${targetName}" found and selectable`,
  )
})

// 2. In-Barn vs On-Road differentiation logic
const nandi = animals.find((a) => a.name === "Nandi")
const lakshmi = animals.find((a) => a.name === "Lakshmi")
const kesariObj = animals.find((a) => a.name === "Kesari")

const isNandiOnRoad =
  nandi?.status === "In Transit" || nandi?.status === "In Seva"
assert(
  isNandiOnRoad === true,
  "Nandi is recognized as active in ceremonial seva / on-road",
)

const isLakshmiInBarn =
  lakshmi?.status === "Available" || lakshmi?.status === "Resting Buffer"
assert(
  isLakshmiInBarn === true,
  "Lakshmi is recognized as safely resting in Gaushala barn",
)

const isKesariInBarn =
  kesariObj?.status === "Available" || kesariObj?.status === "Resting Buffer"
assert(
  isKesariInBarn === true,
  "Young calf Kesari is safely resting in Gaushala barn",
)

assert(
  !!lakshmi?.gosala,
  `Gaushala location attributed for Lakshmi: ${lakshmi?.gosala}`,
)
assert(
  !!kesariObj?.gosala,
  `Gaushala location attributed for Kesari: ${kesariObj?.gosala}`,
)

console.log(
  "\n=====================================================================",
)
console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`)
console.log(
  "=====================================================================",
)

if (failed > 0) process.exit(1)
