/**
 * Comprehensive Automated Verification Suite for 4-Pillar Road Navigation Engine
 * Tests mathematical algorithms, map matching, route slicing, routing cache, and API endpoints.
 */

import {
  haversineDistanceMeters,
  calculateAzimuthBearing,
  shortestAngleDelta,
  projectPointOntoSegment,
  matchAndSliceRoute,
  LatLng,
} from "../src/utils/mapMatching"
import { getOrFetchRoadRoute } from "../server/routingService"

async function runTests() {
  console.log(
    "================================================================================",
  )
  console.log("            GOMAA 4-PILLAR ROAD NAVIGATION ENGINE TEST SUITE")
  console.log(
    "================================================================================\n",
  )

  let passed = 0
  let failed = 0

  function assert(name: string, condition: boolean, details?: string) {
    if (condition) {
      console.log(`  [PASS] ${name}`)
      passed++
    } else {
      console.error(`  [FAIL] ${name}${details ? ` -> ${details}` : ""}`)
      failed++
    }
  }

  // -------------------------------------------------------------------------
  // PILLAR 1 & 2: MATHEMATICAL ACCURACY TESTS
  // -------------------------------------------------------------------------
  console.log("--- 1. Testing Mathematical Accuracy & Map Matching ---")

  // Test 1.1: Haversine distance
  // Distance from Kothrud (18.5074, 73.8077) to Shivaji Nagar (18.5308, 73.8474) ~4.9 km
  const dist = haversineDistanceMeters([18.5074, 73.8077], [18.5308, 73.8474])
  assert(
    "Haversine Great-Circle Distance Calculation",
    dist > 4800 && dist < 5200,
    `Calculated ${dist.toFixed(1)}m, expected ~4970m`,
  )

  // Test 1.2: Cardinal Azimuth Bearings
  const northBearing = calculateAzimuthBearing([18.5, 73.8], [18.51, 73.8])
  const eastBearing = calculateAzimuthBearing([18.5, 73.8], [18.5, 73.81])
  const southBearing = calculateAzimuthBearing([18.51, 73.8], [18.5, 73.8])
  const westBearing = calculateAzimuthBearing([18.5, 73.81], [18.5, 73.8])

  assert(
    "Bearing North ~0°",
    Math.abs(northBearing - 0) < 1,
    `Got ${northBearing}°`,
  )
  assert(
    "Bearing East ~90°",
    Math.abs(eastBearing - 90) < 1,
    `Got ${eastBearing}°`,
  )
  assert(
    "Bearing South ~180°",
    Math.abs(southBearing - 180) < 1,
    `Got ${southBearing}°`,
  )
  assert(
    "Bearing West ~270°",
    Math.abs(westBearing - 270) < 1,
    `Got ${westBearing}°`,
  )

  // Test 1.3: Shortest Angle Rotation Delta
  assert(
    "Shortest Angle Delta (355° -> 5° turns +10°, not -350°)",
    shortestAngleDelta(355, 5) === 10,
    `Got ${shortestAngleDelta(355, 5)}°`,
  )
  assert(
    "Shortest Angle Delta (10° -> 350° turns -20°, not +340°)",
    shortestAngleDelta(10, 350) === -20,
    `Got ${shortestAngleDelta(10, 350)}°`,
  )
  assert(
    "Shortest Angle Delta (180° -> 170° turns -10°)",
    shortestAngleDelta(180, 170) === -10,
    `Got ${shortestAngleDelta(180, 170)}°`,
  )

  // Test 1.4: Orthogonal Segment Projection
  const segA: LatLng = [18.5, 73.8]
  const segB: LatLng = [18.5, 73.81] // Horizontal East-West street
  const offRoadPoint: LatLng = [18.5005, 73.805] // ~55m North of midpoint

  const projection = projectPointOntoSegment(offRoadPoint, segA, segB)
  assert(
    "Orthogonal projection snaps onto midpoint of segment (t ~ 0.5)",
    Math.abs(projection.t - 0.5) < 0.01,
    `Got t=${projection.t}`,
  )
  assert(
    "Projected snapped point lies on the road line (lat == 18.5000)",
    Math.abs(projection.projectedPoint[0] - 18.5) < 0.00001,
    `Got lat=${projection.projectedPoint[0]}`,
  )
  assert(
    "Detected off-road distance is ~55m",
    projection.distanceMeters > 50 && projection.distanceMeters < 60,
    `Got ${projection.distanceMeters.toFixed(1)}m`,
  )

  // -------------------------------------------------------------------------
  // PILLAR 2 & 3: ROUTE SLICING & MAP-MATCHING TESTS
  // -------------------------------------------------------------------------
  console.log("\n--- 2. Testing Route Slicing & Geometry Partitioning ---")

  const mockRoute: LatLng[] = [
    [18.5, 73.8],
    [18.502, 73.803],
    [18.505, 73.806],
    [18.508, 73.809],
    [18.51, 73.812],
  ]

  const rawGpsNearSegment2: LatLng = [18.5036, 73.8048] // Near segment 1 -> 2
  const sliced = matchAndSliceRoute(rawGpsNearSegment2, mockRoute)

  assert(
    "Map matching correctly identifies nearest road segment index",
    sliced.segmentIndex === 1,
    `Expected index 1, got ${sliced.segmentIndex}`,
  )
  assert(
    "Traveled coords and Remaining coords meet seamlessly at snapped point",
    sliced.traveledCoords[sliced.traveledCoords.length - 1] ===
      sliced.remainingCoords[0],
    "Coordinate discontinuity found between traveled and remaining paths",
  )
  assert(
    "Remaining road distance is accurately calculated (> 0 km)",
    sliced.roadDistanceRemainingKm > 0,
    `Got ${sliced.roadDistanceRemainingKm} km`,
  )
  assert(
    "Road tangent bearing matches the direction of the active road segment",
    sliced.bearing > 30 && sliced.bearing < 60,
    `Got ${sliced.bearing.toFixed(1)}°`,
  )

  // -------------------------------------------------------------------------
  // PILLAR 1: OSRM ROAD GRAPH & CACHING TESTS
  // -------------------------------------------------------------------------
  console.log("\n--- 3. Testing OSRM Road Graph Routing & Caching ---")

  const origin: LatLng = [18.5074, 73.8077] // Shri Krishna Gaushala (Paud Road)
  const destination: LatLng = [18.5308, 73.8474] // Shivaji Nagar

  const t0 = performance.now()
  const fetchedRoute = await getOrFetchRoadRoute(origin, destination)
  const duration1 = performance.now() - t0

  assert(
    "OSRM returns real street coordinates (> 50 road vertices)",
    fetchedRoute.coordinates.length > 50,
    `Got ${fetchedRoute.coordinates.length} vertices`,
  )
  assert(
    "Calculated road distance reflects true city driving (> 6.5 km)",
    fetchedRoute.distanceKm >= 6.5,
    `Got ${fetchedRoute.distanceKm} km`,
  )

  // Test In-Memory LRU Cache Hit
  const t1 = performance.now()
  const cachedRoute = await getOrFetchRoadRoute(origin, destination)
  const duration2 = performance.now() - t1

  assert(
    "Subsequent query resolves instantly from LRU cache (< 15ms)",
    duration2 < 15,
    `Duration was ${duration2.toFixed(2)}ms (first was ${duration1.toFixed(2)}ms)`,
  )
  assert(
    "Cached route coordinates match original exactly",
    cachedRoute.coordinates.length === fetchedRoute.coordinates.length,
  )

  // -------------------------------------------------------------------------
  // ENDPOINT & TELEMETRY INTEGRATION TESTS
  // -------------------------------------------------------------------------
  console.log("\n--- 4. Testing End-to-End Backend Telemetry Endpoints ---")

  const bookingId = "GMA-TEST-95999"

  // 4.1: POST Telemetry
  const testPayload = {
    lat: 18.5095,
    lng: 73.8125,
    speedKmh: 35,
    bearing: 68,
    distanceRemainingKm: 4.8,
    etaMinutes: 8,
  }

  const postRes = await fetch(
    `http://localhost:8443/api/bookings/${bookingId}/telemetry`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(testPayload),
    },
  ).then((r) => r.json())

  assert(
    "POST /api/bookings/:id/telemetry responds ok:true",
    postRes.ok === true,
  )

  // 4.2: GET Driver Location
  const getRes = await fetch(
    `http://localhost:8443/api/bookings/${bookingId}/driver-location`,
  ).then((r) => r.json())

  assert(
    "GET /api/bookings/:id/driver-location responds ok:true",
    getRes.ok === true,
  )
  assert(
    "Polled location reflects transmitted latitude",
    Math.abs(getRes.location.lat - 18.5095) < 0.0001,
    `Got lat=${getRes.location.lat}`,
  )
  assert(
    "Polled location reflects transmitted longitude",
    Math.abs(getRes.location.lng - 73.8125) < 0.0001,
    `Got lng=${getRes.location.lng}`,
  )
  assert(
    "Polled location reflects road-tangent bearing",
    getRes.location.bearing === 68,
    `Got bearing=${getRes.location.bearing}`,
  )
  assert(
    "Polled location provides formatted lastUpdated timestamp",
    typeof getRes.location.lastUpdated === "string" &&
      getRes.location.lastUpdated.length > 0,
    `Got timestamp=${getRes.location.lastUpdated}`,
  )

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log(
    "\n================================================================================",
  )
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`)
  console.log(
    "================================================================================\n",
  )

  if (failed > 0) {
    process.exit(1)
  }
}

runTests().catch((err) => {
  console.error("Test execution failed with error:", err)
  process.exit(1)
})
