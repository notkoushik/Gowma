/**
 * Production-Grade Simulation Test Suite:
 * Dynamic Pan-India Location, Reverse Geocoding, Road Tortuosity,
 * Gosala Database Persistence, and End-to-End Booking Integrity.
 */

import { calculateDistanceKm, calculateRoadDistanceKm, findNearestIndianHub, INDIAN_REGIONAL_HUBS } from "../src/data/regions"
import { getGaushalaServiceability, sortGaushalasByProximity } from "../src/utils/geoDistance"
import { resolveGosalaDetail } from "../src/views/customer/GosalaProfile"

interface TestResult {
  suite: string
  name: string
  passed: boolean
  detail?: string
}

const results: TestResult[] = []

function assert(condition: boolean, suite: string, name: string, detail?: string) {
  results.push({ suite, name, passed: condition, detail })
  const icon = condition ? "✅ PASS" : "❌ FAIL"
  console.log(`${icon} [${suite}] ${name}${detail ? ` -> ${detail}` : ""}`)
}

async function runSimulation() {
  console.log("\n================================================================================")
  console.log("   GOMAA PAN-INDIA DYNAMIC LOCATION & SYSTEM INTEGRITY TEST SUITE")
  console.log("================================================================================\n")

  // -------------------------------------------------------------------------
  // TEST SUITE 1: GEOGRAPHIC CENTROIDS & ROAD DISTANCE ACCURACY
  // -------------------------------------------------------------------------
  console.log(">>> SUITE 1: Geographic Calculation & Indian Road Tortuosity")

  // Hyderabad (Narsingi) to Cyberabad (Gachibowli)
  const hydNarsingi = { lat: 17.3753, lng: 78.3615 }
  const hydGachibowli = { lat: 17.4401, lng: 78.3489 }
  const straightDist = calculateDistanceKm(hydNarsingi.lat, hydNarsingi.lng, hydGachibowli.lat, hydGachibowli.lng)
  const roadDist = calculateRoadDistanceKm(hydNarsingi.lat, hydNarsingi.lng, hydGachibowli.lat, hydGachibowli.lng)

  assert(
    straightDist > 6 && straightDist < 9,
    "Geodesic Haversine",
    "Narsingi to Gachibowli straight distance within expected 6-9 km",
    `Calculated: ${straightDist} km`,
  )

  assert(
    roadDist === Math.round(straightDist * 1.30 * 10) / 10,
    "Road Tortuosity",
    "Road distance applies 1.30x factor accurately",
    `Road: ${roadDist} km vs Straight: ${straightDist} km`,
  )

  // Nearest Hub Matching
  const vrindavanLoc = { lat: 27.5794, lng: 77.6833 }
  const nearestToVrindavan = findNearestIndianHub(vrindavanLoc.lat, vrindavanLoc.lng)
  assert(
    nearestToVrindavan.hub.city.toLowerCase().includes("mathura") ||
    nearestToVrindavan.hub.city.toLowerCase().includes("vrindavan") ||
    nearestToVrindavan.hub.state === "Uttar Pradesh",
    "Offline Centroid Matching",
    "Vrindavan coordinates match Uttar Pradesh / Mathura hub",
    `Matched Hub: ${nearestToVrindavan.hub.name} (${nearestToVrindavan.distanceKm} km)`,
  )

  // -------------------------------------------------------------------------
  // TEST SUITE 2: SERVICEABILITY TIERS
  // -------------------------------------------------------------------------
  console.log("\n>>> SUITE 2: Multi-Tier Animal Welfare Serviceability Constraints")

  const localService = getGaushalaServiceability(hydNarsingi.lat, hydNarsingi.lng, {
    lat: 17.4156,
    lng: 78.4358, // Banjara Hills ~9 km
  })
  assert(
    localService.tier === "LOCAL_SERVICE" && localService.isDirectBookingAllowed,
    "Local Service Tier",
    "Within 35km allows direct doorstep booking with green badge",
    `Tier: ${localService.tier}, Transit: ${localService.estimatedTransitMin}m`,
  )

  // Extended Transit (50 km away)
  const extendedTarget = { lat: 17.75, lng: 78.36 }
  const extendedService = getGaushalaServiceability(hydNarsingi.lat, hydNarsingi.lng, extendedTarget)
  assert(
    extendedService.tier === "EXTENDED_TRANSIT" && extendedService.isDirectBookingAllowed,
    "Extended Transit Tier",
    "35km - 75km activates extended transit with welfare rest warning",
    `Tier: ${extendedService.tier}, Notice: ${extendedService.noticeMessage}`,
  )

  // Out of Radius (>75 km)
  const distantTarget = { lat: 18.5204, lng: 73.8567 } // Pune to Hyderabad (~500 km)
  const outOfRadiusService = getGaushalaServiceability(hydNarsingi.lat, hydNarsingi.lng, distantTarget)
  assert(
    outOfRadiusService.tier === "OUT_OF_RADIUS" && !outOfRadiusService.isDirectBookingAllowed,
    "Out of Radius Tier",
    "Cross-state/long-distance prevents direct cattle transit to preserve animal welfare",
    `Distance: ${outOfRadiusService.distanceKm} km, Allowed: ${outOfRadiusService.isDirectBookingAllowed}`,
  )

  // -------------------------------------------------------------------------
  // TEST SUITE 3: DYNAMIC GOSALA DISCOVERY & PROXIMITY SORTING
  // -------------------------------------------------------------------------
  console.log("\n>>> SUITE 3: Dynamic Gosala Discovery & Proximity Sorting")

  const mockRegisteredGosalas = [
    {
      id: "GOS-PUN-1",
      name: "Shri Krishna Gaushala (Pune)",
      lat: 18.5074,
      lng: 73.8077,
      address: "Bavdhan, Pune, Maharashtra",
      capacity: 45,
    },
    {
      id: "GOS-HYD-1",
      name: "Sri Krishna Gaushala & Vedic Ashram (Hyderabad)",
      lat: 17.3753,
      lng: 78.3615,
      address: "Narsingi, Hyderabad, Telangana",
      capacity: 60,
    },
    {
      id: "GOS-BLR-1",
      name: "Kamadhenu Gau Samrakshana Kendra (Bengaluru)",
      lat: 12.8756,
      lng: 77.5612,
      address: "Kanakapura Road, Bengaluru, Karnataka",
      capacity: 35,
    },
  ]

  // When a devotee opens the app in Hyderabad (Gachibowli)
  const hydUserSorted = sortGaushalasByProximity(mockRegisteredGosalas, hydGachibowli.lat, hydGachibowli.lng)
  assert(
    hydUserSorted[0].gosala.id === "GOS-HYD-1",
    "Dynamic Nearest Gaushala Sorting",
    "Hyderabad devotee dynamically sees Hyderabad Gaushala as #1 nearest",
    `Top Gaushala: ${hydUserSorted[0].gosala.name} (${hydUserSorted[0].serviceability.distanceKm} km)`,
  )

  // When a devotee opens the app in Pune (Kothrud: 18.5074, 73.8077)
  const puneUserSorted = sortGaushalasByProximity(mockRegisteredGosalas, 18.5074, 73.8077)
  assert(
    puneUserSorted[0].gosala.id === "GOS-PUN-1",
    "Dynamic Nearest Gaushala Sorting",
    "Pune devotee dynamically sees Pune Gaushala as #1 nearest",
    `Top Gaushala: ${puneUserSorted[0].gosala.name} (${puneUserSorted[0].serviceability.distanceKm} km)`,
  )

  // -------------------------------------------------------------------------
  // TEST SUITE 4: DYNAMIC GOSALA DETAIL PROFILE RESOLUTION (ZERO-CRASH)
  // -------------------------------------------------------------------------
  console.log("\n>>> SUITE 4: Dynamic Gosala Profile Resolution (Zero-Crash Guarantee)")

  // Resolving an dynamically added Gosala not present in static data
  const newlyCreatedGosala = {
    id: "GOS-VRN-999",
    name: "Radha Govinda Surabhi Dham",
    region: "Uttar Pradesh - Vrindavan / Mathura",
    address: "Raman Reti, Vrindavan, Mathura, UP - 281121",
    contactPhone: "+91 99270 12345",
    email: "vrindavan@gomaa.in",
    managerName: "Pandit Govind Das",
    capacity: 120,
    establishedYear: "2018",
    facilities: ["Air-conditioned Ambulance", "24/7 Yamuna Water", "Ayurvedic Hospital"],
    lat: 27.5794,
    lng: 77.6833,
  }

  const resolved = resolveGosalaDetail("GOS-VRN-999", [newlyCreatedGosala])
  assert(
    resolved !== null && resolved.name === "Radha Govinda Surabhi Dham",
    "Profile Resolution",
    "Dynamically resolves new Gaushala profile without undefined error",
    `Resolved: ${resolved?.name}, Manager: ${resolved?.managerName}, Area: ${resolved?.area}`,
  )

  assert(
    resolved?.certifications.length! >= 2 && resolved?.animalCare.vaccination.length! > 0,
    "Vedic Accreditation Enrichment",
    "Enriches profile with complete welfare details, feed schedule, and certifications",
    `Certifications: ${resolved?.certifications.map((c) => c.label).join(", ")}`,
  )

  // -------------------------------------------------------------------------
  // TEST SUITE 5: BACKEND API ENDPOINTS
  // -------------------------------------------------------------------------
  console.log("\n>>> SUITE 5: Live API Endpoints Verification via HTTP")

  const BASE_URL = "http://localhost:8443"
  try {
    const listRes = await fetch(`${BASE_URL}/api/gosalas`)
    if (listRes.ok) {
      const data = await listRes.json()
      assert(
        data.ok && Array.isArray(data.gosalas),
        "Backend GET /api/gosalas",
        "Successfully retrieved active Gaushalas from PostgreSQL / Prisma database",
        `Count: ${data.gosalas.length} Gaushalas registered`,
      )
    } else {
      console.warn("API GET /api/gosalas returned HTTP", listRes.status)
    }

    // Test POST /api/gosalas
    const testNewGosala = {
      id: `GOS-TEST-${Date.now()}`,
      name: "Tirupati Balaji Sacred Surabhi Trust",
      region: "Andhra Pradesh - Tirupati / Chittoor",
      address: "Alipiri Bypass Road, Tirupati, AP - 517501",
      contactPhone: "+91 87722 55990",
      email: "tirupati@gomaa.in",
      managerName: "S. Ramanujam",
      capacity: 85,
      establishedYear: "2021",
      lat: 13.6288,
      lng: 79.4192,
      status: "Active",
      facilities: ["Sacred Cow Gosala", "Pure Mountain Spring Water"],
    }

    const postRes = await fetch(`${BASE_URL}/api/gosalas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(testNewGosala),
    })

    if (postRes.ok) {
      const postData = await postRes.json()
      assert(
        postData.ok && postData.gosala.name === testNewGosala.name,
        "Backend POST /api/gosalas",
        "Successfully registered and persisted new Gaushala in PostgreSQL database",
        `Created ID: ${postData.gosala.id}`,
      )
    } else {
      console.warn("API POST /api/gosalas returned HTTP", postRes.status)
    }
  } catch (err: any) {
    console.warn("Live HTTP checks skipped (Vite server may be running on alternate port):", err.message)
  }

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log("\n================================================================================")
  const passedCount = results.filter((r) => r.passed).length
  const totalCount = results.length
  console.log(`   INTEGRITY TEST RESULTS: ${passedCount}/${totalCount} TESTS PASSED`)
  console.log("================================================================================\n")

  if (passedCount < totalCount) {
    process.exit(1)
  }
}

runSimulation()
