import { TestHarness } from "./test-harness.mjs"
import { handleApiRequest } from "../server/router.ts"
import fs from "node:fs"
import path from "node:path"

async function runDynamicHubsSuite() {
  const harness = new TestHarness("Dynamic Operational Hubs & Geocoding Suite")
  console.log("================================================================================")
  console.log("   GOMAA DYNAMIC OPERATIONAL HUBS & PAN-INDIA LOCATION REGISTRATION QA SUITE   ")
  console.log("================================================================================")

  try {
    // 1. Resolve Super Admin & Customer for RBAC verification
    console.log("\n[TEST 1] Setting up personas for Hubs RBAC verification...")
    const superAdmin = await harness.resolveOrCreateUser("super_admin")
    const customer = await harness.resolveOrCreateUser("customer")
    const { headers: adminHeaders } = harness.issueTokenForUser(superAdmin)
    const { headers: customerHeaders } = harness.issueTokenForUser(customer)
    harness.assert(!!superAdmin, "Super Admin persona resolved from PostgreSQL")
    harness.assert(!!customer, "Customer persona resolved from PostgreSQL")

    // 2. Test GET /api/hubs public access
    console.log("\n[TEST 2] Testing Public Hubs Discovery (GET /api/hubs)...")
    const publicHubsRes = await handleApiRequest("GET", "/api/hubs", null, {})
    harness.assert(publicHubsRes?.status === 200, "GET /api/hubs responds with HTTP 200 OK without token")
    harness.assert(publicHubsRes?.body?.ok === true, "Response ok is true")
    harness.assert(Array.isArray(publicHubsRes?.body?.hubs), "Hubs is returned as an array")
    harness.assert(publicHubsRes?.body?.hubs.length >= 10, `Returned ${publicHubsRes?.body?.hubs.length} operational hubs across India`)

    // Verify presence of baseline hubs
    const hubNames = publicHubsRes?.body?.hubs.map((h) => h.name.toLowerCase()).join(" ")
    harness.assert(hubNames.includes("hyderabad"), "Hyderabad metropolitan hubs present")
    harness.assert(hubNames.includes("pune"), "Pune & Maharashtra hubs present")
    harness.assert(hubNames.includes("vrindavan") || hubNames.includes("mathura"), "Vrindavan & Govardhan sacred hubs present")

    // 3. Test RBAC: Unauthenticated POST /api/hubs rejected
    console.log("\n[TEST 3] Testing Security Gateway for Hub Registration...")
    const unauthRes = await handleApiRequest(
      "POST",
      "/api/hubs",
      JSON.stringify({
        state: "Andhra Pradesh",
        city: "Tirupati",
        name: "Test Unauth Hub",
        lat: 13.6288,
        lng: 79.4192,
      }),
      {}
    )
    harness.assert(unauthRes?.status === 401, "Unauthenticated POST /api/hubs rejected with HTTP 401")

    // 4. Test RBAC: Customer cannot register operational hubs
    console.log("\n[TEST 4] Testing Role Boundary (Customer cannot register hubs)...")
    const custRes = await handleApiRequest(
      "POST",
      "/api/hubs",
      JSON.stringify({
        state: "Andhra Pradesh",
        city: "Tirupati",
        name: "Test Customer Hub",
        lat: 13.6288,
        lng: 79.4192,
      }),
      customerHeaders
    )
    harness.assert(custRes?.status === 403, "Customer POST /api/hubs rejected with HTTP 403 Forbidden")

    // 5. Test Payload Validation
    console.log("\n[TEST 5] Testing Hub Registration Payload Validation...")
    const emptyRes = await handleApiRequest("POST", "/api/hubs", JSON.stringify({}), adminHeaders)
    harness.assert(emptyRes?.status === 400, "Empty payload rejected with HTTP 400 Bad Request")

    const invalidCoordsRes = await handleApiRequest(
      "POST",
      "/api/hubs",
      JSON.stringify({
        state: "Karnataka",
        city: "Bengaluru",
        name: "Invalid Coords Hub",
        lat: 999, // Invalid latitude
        lng: 77.5946,
      }),
      adminHeaders
    )
    harness.assert(invalidCoordsRes?.status === 400, "Out-of-bounds coordinates rejected with HTTP 400")

    // 6. Test Successful Dynamic Hub Creation by Super Admin
    console.log("\n[TEST 6] Testing Dynamic Hub Creation & Database/File Persistence...")
    const uniqueCity = `Tirupati_${harness.testRunId}`
    const uniqueHubName = `Sri Venkateswara Alipiri Foothills Sanctuary ${harness.testRunId}`
    const createRes = await handleApiRequest(
      "POST",
      "/api/hubs",
      JSON.stringify({
        state: "Andhra Pradesh",
        city: uniqueCity,
        name: uniqueHubName,
        lat: 13.6288,
        lng: 79.4192,
        defaultMaxRadiusKm: 45,
        pincodePrefixes: ["517501", "517507"],
      }),
      adminHeaders
    )

    harness.assert(createRes?.status === 201, "POST /api/hubs creates new hub with HTTP 201 Created")
    harness.assert(createRes?.body?.ok === true, "Response ok is true")
    const createdHub = createRes?.body?.hub
    harness.assert(!!createdHub?.id, `Created hub ID: ${createdHub?.id}`)
    harness.assert(createdHub?.city === uniqueCity, "Created hub city matches payload")
    harness.assert(createdHub?.name === uniqueHubName, "Created hub name matches payload")
    harness.assert(createdHub?.isCustom === true, "Created hub is flagged as isCustom: true")
    harness.assert(createdHub?.zone === "South", "Zone auto-derived as 'South' for Andhra Pradesh")

    // 7. Verify Immediate Availability in GET /api/hubs
    console.log("\n[TEST 7] Verifying Instant Cross-Platform Discovery...")
    const refreshHubsRes = await handleApiRequest("GET", "/api/hubs", null, {})
    const foundNewHub = refreshHubsRes?.body?.hubs?.find((h) => h.id === createdHub?.id)
    harness.assert(!!foundNewHub, "Newly created hub is immediately returned in GET /api/hubs")
    harness.assert(foundNewHub?.name === uniqueHubName, "Retrieved hub name matches newly created entity")
  } catch (err) {
    console.error("Test execution threw error:", err)
    harness.failed++
  } finally {
    // Teardown ephemeral users
    await harness.teardown()

    // Clean up test custom hub from custom_hubs.json
    try {
      const customHubsFile = path.resolve(process.cwd(), "server/data/custom_hubs.json")
      if (fs.existsSync(customHubsFile)) {
        const raw = fs.readFileSync(customHubsFile, "utf-8")
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter((h) => !h.city?.includes(harness.testRunId) && !h.name?.includes(harness.testRunId))
          fs.writeFileSync(customHubsFile, JSON.stringify(cleaned, null, 2), "utf-8")
        }
      }
    } catch {}
  }

  console.log("\n================================================================================")
  console.log(`QA TEST RESULTS: ${harness.passed} PASSED, ${harness.failed} FAILED`)
  console.log("================================================================================")

  if (harness.failed > 0) {
    process.exit(1)
  }
}

runDynamicHubsSuite().catch((err) => {
  console.error("Test runner failed:", err)
  process.exit(1)
})
