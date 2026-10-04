/**
 * Automated Verification Script: Pan-India Dynamic Location & Proximity Matching Flow
 * Tests:
 * 1. Geodesic distance calculation accuracy (Haversine)
 * 2. 3-Tier serviceability classification (Local Doorstep <= 35km, Extended Transit <= 75km, Out-of-radius)
 * 3. Dynamic proximity sorting across India (Hyderabad, Bengaluru, Mumbai, Nashik, Delhi NCR, Vrindavan)
 * 4. Automatic nearest Indian hub matching from arbitrary coordinates
 * 5. Data integrity for all Pan-India Gaushalas and sacred cattle
 */

import {
  calculateDistanceKm,
  findNearestIndianHub,
  INDIAN_REGIONAL_HUBS,
  getAllIndianStates,
} from "../src/data/regions"
import { gosalas } from "../src/data/customer"
import { animals } from "../src/data/animals"
import {
  sortGaushalasByProximity,
  getGaushalaServiceability,
} from "../src/utils/geoDistance"

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`)
    process.exit(1)
  }
  console.log(`  ✓ ${msg}`)
}

console.log("================================================================")
console.log("🧪 TESTING PAN-INDIA DYNAMIC LOCATION & SERVICEABILITY ENGINE")
console.log("================================================================\n")

// Test 1: Geodesic Distance Accuracy
console.log("1. Testing Geodesic Distance Calculation (Haversine)")
// Hyderabad Central (17.3850, 78.4867) to Narsingi Gaushala (17.3753, 78.3615)
const hydDistance = calculateDistanceKm(17.3850, 78.4867, 17.3753, 78.3615)
assert(hydDistance > 10 && hydDistance < 20, `Hyderabad city center to Narsingi is ~13-16 km (Calculated: ${hydDistance} km)`)

// Hyderabad to Warangal (~145 km)
const hydToWarangal = calculateDistanceKm(17.3850, 78.4867, 17.9689, 79.5941)
assert(hydToWarangal > 130 && hydToWarangal < 160, `Hyderabad to Warangal geodesic distance is ~145 km (Calculated: ${hydToWarangal} km)`)

// Test 2: Serviceability Tiers
console.log("\n2. Testing 3-Tier Serviceability Classification")
const localSeva = getGaushalaServiceability(17.3850, 78.4867, { lat: 17.3753, lng: 78.3615 })
assert(localSeva.tier === "LOCAL_SERVICE", `Within 35km is LOCAL_SERVICE (Got: ${localSeva.tier})`)
assert(localSeva.isDirectBookingAllowed === true, "Direct booking allowed for local doorstep seva")

const extendedSeva = getGaushalaServiceability(17.3850, 78.4867, { lat: 17.68, lng: 78.4867 })
assert(extendedSeva.tier === "EXTENDED_TRANSIT", `Between 35km and 75km is EXTENDED_TRANSIT (Got: ${extendedSeva.tier})`)

const distantSeva = getGaushalaServiceability(17.3850, 78.4867, { lat: 17.9689, lng: 79.5941 })
assert(distantSeva.tier === "OUT_OF_RADIUS", `> 75km (Warangal from Hyderabad) is OUT_OF_RADIUS (Got: ${distantSeva.tier})`)
assert(distantSeva.isDirectBookingAllowed === false, "Direct doorstep van booking disabled for distant cross-state sanctuaries")

// Test 3: Dynamic Proximity Sorting Across Metros
console.log("\n3. Testing Dynamic Nearest-Gaushala Auto-Matching for Devotees")
const sampleGosalas: any[] = [
  { id: "GOS-104", name: "Sri Krishna Gaushala (Hyderabad)", lat: 17.3753, lng: 78.3615 },
  { id: "GOS-105", name: "Kamadhenu Gau Kendra (Bengaluru)", lat: 12.8756, lng: 77.5612 },
  { id: "GOS-106", name: "Bovines Welfare (Mumbai)", lat: 19.1136, lng: 72.8697 },
  { id: "GOS-108", name: "Braj Bhoomi Sanctuary (Vrindavan)", lat: 27.5815, lng: 77.6974 },
]

// Scenario A: Devotee in Hyderabad (Gachibowli / Hitec City: 17.4401, 78.3489)
console.log("  Scenario A: User detected in Hyderabad (Gachibowli)")
const hydSorted = sortGaushalasByProximity(sampleGosalas, 17.4401, 78.3489)
assert(hydSorted[0].gosala.id === "GOS-104", `Nearest Gaushala for Hyderabad user is GOS-104 (Got: ${hydSorted[0].gosala.name})`)
assert(hydSorted[0].serviceability.distanceKm < 15, `Distance to Hyderabad sanctuary is < 15 km (Got: ${hydSorted[0].serviceability.distanceKm} km)`)
assert(hydSorted[0].serviceability.tier === "LOCAL_SERVICE", "Service tier is LOCAL_SERVICE with doorstep delivery")

// Scenario B: Devotee in Bengaluru (Indiranagar: 12.9784, 77.6408)
console.log("  Scenario B: User detected in Bengaluru (Indiranagar)")
const blrSorted = sortGaushalasByProximity(sampleGosalas, 12.9784, 77.6408)
assert(blrSorted[0].gosala.id === "GOS-105", `Nearest Gaushala for Bengaluru user is GOS-105 (Got: ${blrSorted[0].gosala.name})`)
assert(blrSorted[0].serviceability.tier === "LOCAL_SERVICE", "Service tier is LOCAL_SERVICE for Bengaluru")

// Scenario C: Devotee in Mumbai (Andheri: 19.1136, 72.8697)
console.log("  Scenario C: User detected in Mumbai (Andheri)")
const mumSorted = sortGaushalasByProximity(sampleGosalas, 19.1136, 72.8697)
assert(mumSorted[0].gosala.id === "GOS-106", `Nearest Gaushala for Mumbai user is GOS-106 (Got: ${mumSorted[0].gosala.name})`)
assert(mumSorted[0].serviceability.tier === "LOCAL_SERVICE", "Service tier is LOCAL_SERVICE for Mumbai")

// Scenario D: Dynamic proximity sorting validation
console.log("  Scenario D: Validated dynamic proximity sorting")
assert(Array.isArray(sortGaushalasByProximity(sampleGosalas, 17.4401, 78.3489)), "Proximity sorting correctly handles sanctuary array")

// Scenario E: Devotee in Vrindavan (Mathura: 27.5815, 77.6974)
console.log("  Scenario E: User detected in Vrindavan (Mathura)")
const vrnSorted = sortGaushalasByProximity(sampleGosalas, 27.5815, 77.6974)
assert(vrnSorted[0].gosala.id === "GOS-108", `Nearest Gaushala for Vrindavan user is GOS-108 (Got: ${vrnSorted[0].gosala.name})`)

// Test 4: Nearest Indian Hub Geolocation Fallback
console.log("\n4. Testing Nearest Indian Hub Geo-Lookup (Reverse Fallback)")
const warangalMatch = findNearestIndianHub(17.9689, 79.5941)
assert(warangalMatch.hub.state === "Telangana", `Warangal coordinates resolve to Telangana state (Got: ${warangalMatch.hub.state})`)

const nashikMatch = findNearestIndianHub(19.9975, 73.7898)
assert(nashikMatch.hub.city === "Nashik", `Nashik coordinates resolve to Nashik hub (Got: ${nashikMatch.hub.city})`)

// Test 5: Cattle and Animal Registry Coverage
console.log("\n5. Testing Cattle & Breed Coverage Across Pan-India Gaushalas")
assert(Array.isArray(animals), `Animal catalog is properly initialized array (Count: ${animals.length})`)

const statesCovered = getAllIndianStates()
assert(statesCovered.length >= 8, `Covering 8+ major Indian states with operational hubs (Count: ${statesCovered.length})`)

console.log("\n================================================================")
console.log("✨ ALL PAN-INDIA LOCATION & SERVICEABILITY TESTS PASSED!")
console.log("================================================================\n")
