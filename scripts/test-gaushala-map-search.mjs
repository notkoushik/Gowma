import assert from "node:assert/strict"
import { searchGaushalaLocations, CURATED_SACRED_INDIAN_GAUSHALAS } from "../src/services/gaushalaSearchService.ts"
import { findNearestIndianHub } from "../src/data/regions.ts"

async function runGaushalaMapSearchQA() {
  console.log("================================================================================")
  console.log("   GOMAA GAUSHALA LIVE MAP SEARCH & PREMISE CONNECTION QA SUITE               ")
  console.log("================================================================================")

  let passed = 0

  // Mock GOMAA Registered Gaushalas from database
  const mockGomaaGaushalas = [
    {
      id: "gosala-db-101",
      name: "Sri Govardhana Sanctuary",
      region: "Hyderabad Central (Banjara Hills / Jubilee Hills)",
      address: "Road No 12, Banjara Hills, Hyderabad, Telangana",
      latitude: 17.4156,
      longitude: 78.4358,
      trustNo: "AWBI-TG-HYD-001",
      capacity: 120,
      caretaker: "Acharya Madhava Sharma",
    },
    {
      id: "gosala-db-102",
      name: "Surya Vrindavan Sanctuary",
      region: "Cyberabad / Gachibowli Zone",
      address: "Near Financial District, Gachibowli, Hyderabad",
      latitude: 17.44,
      longitude: 78.38,
      trustNo: "AWBI-TG-CYB-002",
      capacity: 80,
      caretaker: "Pandit Radhakant",
    },
  ]

  // [TEST 1] Testing Tier 1: Search Registered GOMAA Database Gaushalas
  console.log("\n[TEST 1] Testing Search against Registered GOMAA Gaushalas...")
  const gomaaMatches = await searchGaushalaLocations("Govardhana", {
    localGosalas: mockGomaaGaushalas,
  })

  assert.ok(gomaaMatches.length > 0, "Expected at least 1 match for 'Govardhana'")
  const dbMatch = gomaaMatches.find((m) => m.source === "gomaa_database")
  assert.ok(dbMatch, "Expected GOMAA Database match")
  assert.strictEqual(dbMatch.name, "Sri Govardhana Sanctuary")
  assert.strictEqual(dbMatch.badgeText, "GOMAA Registered")
  assert.strictEqual(dbMatch.lat, 17.4156)
  assert.strictEqual(dbMatch.lng, 78.4358)
  assert.strictEqual(dbMatch.trustNo, "AWBI-TG-HYD-001")
  assert.ok(dbMatch.hubName.length > 0, "Expected closest hub name")
  console.log(`  ✓ PASS: Found registered GOMAA Gaushala: ${dbMatch.name} (${dbMatch.badgeText})`)
  passed++

  // [TEST 2] Testing Tier 2: Search Curated Sacred Indian Gaushala Directory
  console.log("\n[TEST 2] Testing Search across Curated Sacred Indian Gaushalas...")
  const sacredTestCases = [
    { query: "Govardhan Ecovillage", expectedName: "Govardhan Ecovillage Gaushala", expectedState: "Maharashtra" },
    { query: "Kanha Shanti Vanam", expectedName: "Kanha Shanti Vanam Gaushala", expectedState: "Telangana" },
    { query: "Pathmeda", expectedName: "Shri Pathmeda Godham Gaushala", expectedState: "Rajasthan" },
    { query: "Tirupati", expectedName: "TTD Sri Venkateswara Gosamrakshana Shala", expectedState: "Andhra Pradesh" },
    { query: "Keshav Gaushala", expectedName: "Keshav Gaushala & Goseva Kendra", expectedState: "Maharashtra" },
    { query: "Bansi Gir", expectedName: "Bansi Gir Gaushala", expectedState: "Gujarat" },
    { query: "Jagannath Temple", expectedName: "Jagannath Temple Gaushala", expectedState: "Odisha" },
  ]

  for (const tc of sacredTestCases) {
    const results = await searchGaushalaLocations(tc.query, {
      localGosalas: mockGomaaGaushalas,
    })
    assert.ok(results.length > 0, `Expected matches for query '${tc.query}'`)
    const found = results.find((r) => r.name.toLowerCase().includes(tc.expectedName.toLowerCase()))
    assert.ok(found, `Expected to find '${tc.expectedName}' in results for query '${tc.query}'`)
    assert.strictEqual(found.state, tc.expectedState)
    assert.ok(found.lat >= 6 && found.lat <= 38, `Valid Indian latitude: ${found.lat}`)
    assert.ok(found.lng >= 68 && found.lng <= 98, `Valid Indian longitude: ${found.lng}`)
    assert.ok(found.hubName.length > 0, `Resolved hub: ${found.hubName}`)
    console.log(`  ✓ PASS: '${tc.query}' -> ${found.name} [${found.city}, ${found.state}] (Hub: ${found.hubName})`)
    passed++
  }

  // [TEST 3] Testing Coordinate Validation and Indian Boundary Constraints
  console.log("\n[TEST 3] Testing Coordinate Integrity across all Curated Gaushalas...")
  for (const cg of CURATED_SACRED_INDIAN_GAUSHALAS) {
    assert.ok(cg.lat >= 6 && cg.lat <= 38, `Lat inside India: ${cg.name} (${cg.lat})`)
    assert.ok(cg.lng >= 68 && cg.lng <= 98, `Lng inside India: ${cg.name} (${cg.lng})`)
    assert.ok(cg.address.length > 10, `Valid descriptive address: ${cg.name}`)
    assert.ok(cg.capacity > 0, `Valid capacity: ${cg.name}`)
  }
  console.log(`  ✓ PASS: All ${CURATED_SACRED_INDIAN_GAUSHALAS.length} curated sacred Gaushalas have verified Indian coordinates and addresses.`)
  passed++

  // [TEST 4] Testing Distance Calculation with Live GPS Origin
  console.log("\n[TEST 4] Testing Distance Computation from User GPS Coordinates...")
  // GPS near Pune (18.5204, 73.8567)
  const puneGps = { lat: 18.5204, lng: 73.8567 }
  const puneMatches = await searchGaushalaLocations("Keshav Gaushala", {
    currentLat: puneGps.lat,
    currentLng: puneGps.lng,
  })
  assert.ok(puneMatches.length > 0, "Expected matches for Keshav Gaushala")
  const keshav = puneMatches[0]
  assert.ok(typeof keshav.distanceKm === "number", "Expected distanceKm to be computed")
  assert.ok(keshav.distanceKm < 30, `Expected distance < 30km, got ${keshav.distanceKm}km`)
  console.log(`  ✓ PASS: Keshav Gaushala distance computed accurately: ${keshav.distanceKm} km from Pune center`)
  passed++

  // [TEST 5] Testing Form Autocomplete & Multi-Field Connection
  console.log("\n[TEST 5] Testing Form Integration & Field Auto-Population...")
  const govEcovillageResults = await searchGaushalaLocations("Govardhan Ecovillage", {
    localGosalas: mockGomaaGaushalas,
  })
  assert.ok(govEcovillageResults.length > 0, "Expected match for Govardhan Ecovillage")
  const match = govEcovillageResults[0]

  // Simulate parent form state mutation
  const simulatedForm = {
    gFormName: "",
    gFormAddress: "",
    gFormRegion: "",
    gFormLat: 0,
    gFormLng: 0,
    gFormTrustNo: "",
    gFormCapacity: "50",
  }

  // Action: onSelectGaushalaMatch execution
  simulatedForm.gFormName = match.name
  simulatedForm.gFormAddress = match.address
  simulatedForm.gFormRegion = match.suggestedRegion
  simulatedForm.gFormLat = match.lat
  simulatedForm.gFormLng = match.lng
  if (match.trustNo) simulatedForm.gFormTrustNo = match.trustNo
  if (match.capacity) simulatedForm.gFormCapacity = String(match.capacity)

  assert.strictEqual(simulatedForm.gFormName, "Govardhan Ecovillage Gaushala")
  assert.ok(simulatedForm.gFormAddress.includes("Palghar"), "Address populated with Palghar")
  assert.ok(simulatedForm.gFormRegion.includes("Maharashtra"), "Region populated with Maharashtra")
  assert.strictEqual(simulatedForm.gFormLat, 19.8256)
  assert.strictEqual(simulatedForm.gFormLng, 73.0894)
  assert.strictEqual(simulatedForm.gFormCapacity, "350")
  assert.strictEqual(simulatedForm.gFormTrustNo, "MH-THN-2003-4412")
  console.log("  ✓ PASS: Simulated form fields automatically populated:")
  console.log(`    - Name:     ${simulatedForm.gFormName}`)
  console.log(`    - Address:  ${simulatedForm.gFormAddress}`)
  console.log(`    - Region:   ${simulatedForm.gFormRegion}`)
  console.log(`    - Coords:   (${simulatedForm.gFormLat}, ${simulatedForm.gFormLng})`)
  console.log(`    - Trust No: ${simulatedForm.gFormTrustNo}`)
  console.log(`    - Capacity: ${simulatedForm.gFormCapacity}`)
  passed++

  // [TEST 6] Testing Zero-Key Google Maps URL & Coordinates Resolution
  console.log("\n[TEST 6] Testing Google Maps URL & Raw Coordinate Parsing...")
  const { resolveGoogleMapsLinkOrCoords } = await import("../server/services/googlePlacesService.ts")

  // Case 6A: Full Google Maps URL with place name and coordinates
  const gmapsUrl1 = "https://www.google.com/maps/place/Sri+Balaji+Gaushala+Trust/@17.4156,78.4358,17z/data=!4m6"
  const resolvedPlace1 = await resolveGoogleMapsLinkOrCoords(gmapsUrl1)
  assert.ok(resolvedPlace1, "Expected resolved place from Google Maps URL")
  assert.strictEqual(resolvedPlace1.name, "Sri Balaji Gaushala Trust")
  assert.strictEqual(resolvedPlace1.lat, 17.4156)
  assert.strictEqual(resolvedPlace1.lng, 78.4358)
  assert.strictEqual(resolvedPlace1.source, "google_maps_link")
  console.log(`  ✓ PASS: 6A: Google Maps Place URL parsed -> ${resolvedPlace1.name} (${resolvedPlace1.lat}, ${resolvedPlace1.lng})`)
  passed++

  // Case 6B: Direct Decimal Coordinates (copied from Google Maps)
  const rawCoords = "19.8256, 73.0894"
  const resolvedCoords = await resolveGoogleMapsLinkOrCoords(rawCoords)
  assert.ok(resolvedCoords, "Expected resolved place from raw coordinates")
  assert.strictEqual(resolvedCoords.lat, 19.8256)
  assert.strictEqual(resolvedCoords.lng, 73.0894)
  assert.strictEqual(resolvedCoords.source, "coordinates")
  assert.ok(resolvedCoords.hubName?.length > 0, "Closest hub derived")
  console.log(`  ✓ PASS: 6B: Raw Coordinates parsed -> (${resolvedCoords.lat}, ${resolvedCoords.lng}) -> Hub: ${resolvedCoords.hubName}`)
  passed++

  // Case 6C: DMS Coordinate Format
  const dmsCoords = `18°31'13.4"N 73°51'24.1"E`
  const resolvedDms = await resolveGoogleMapsLinkOrCoords(dmsCoords)
  assert.ok(resolvedDms, "Expected resolved place from DMS coordinates")
  assert.ok(Math.abs(resolvedDms.lat - 18.5204) < 0.01, "Lat within range")
  assert.ok(Math.abs(resolvedDms.lng - 73.8567) < 0.01, "Lng within range")
  console.log(`  ✓ PASS: 6C: DMS Coordinates parsed -> (${resolvedDms.lat.toFixed(4)}, ${resolvedDms.lng.toFixed(4)})`)
  passed++

  // [TEST 7] Testing Backend API: POST /api/places/resolve-link
  console.log("\n[TEST 7] Testing Backend Route: POST /api/places/resolve-link...")
  const { handleApiRequest } = await import("../server/router.ts")
  const apiResp = await handleApiRequest(
    "POST",
    "/api/places/resolve-link",
    JSON.stringify({ url: "https://www.google.com/maps/place/Gau+Teerth+Sanctuary/@27.5750,77.6740,17z" }),
  )

  assert.strictEqual(apiResp.status, 200, "Expected HTTP 200 from /api/places/resolve-link")
  assert.strictEqual(apiResp.body.ok, true, "Expected ok: true")
  assert.strictEqual(apiResp.body.place.name, "Gau Teerth Sanctuary")
  assert.strictEqual(apiResp.body.place.lat, 27.575)
  assert.strictEqual(apiResp.body.place.lng, 77.674)
  assert.ok(apiResp.body.place.suggestedRegion, "Expected suggested region")
  console.log(`  ✓ PASS: POST /api/places/resolve-link returned HTTP 200 -> ${apiResp.body.place.name} (${apiResp.body.place.lat}, ${apiResp.body.place.lng})`)
  passed++

  // [TEST 8] Testing Federated Search with Google Maps Link Query
  console.log("\n[TEST 8] Testing searchGaushalaLocations with Google Maps URL input...")
  const federatedResults = await searchGaushalaLocations(
    "https://www.google.com/maps/place/Kanha+Gaushala/@17.1350,78.2750,17z",
    { localGosalas: mockGomaaGaushalas },
  )

  assert.ok(federatedResults.length > 0, "Expected matches for Google Maps URL")
  const topResult = federatedResults[0]
  assert.strictEqual(topResult.source, "google_maps_link")
  assert.strictEqual(topResult.badgeText, "Google Maps Verified")
  assert.strictEqual(topResult.lat, 17.135)
  assert.strictEqual(topResult.lng, 78.275)
  console.log(`  ✓ PASS: Federated search auto-resolved Google Maps link -> ${topResult.name} (${topResult.badgeText})`)
  passed++

  console.log("================================================================================")
  console.log(`QA TEST RESULTS: ${passed} PASSED, 0 FAILED`)
  console.log("================================================================================")
}

runGaushalaMapSearchQA().catch((err) => {
  console.error("Test failed:", err)
  process.exit(1)
})
