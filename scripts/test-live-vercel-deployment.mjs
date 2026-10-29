const PROD_BASE = "https://gowma.vercel.app"

async function runTests() {
  console.log(`\n================================================================================`)
  console.log(`   LIVE VERCEL PRODUCTION VERIFICATION SUITE: ${PROD_BASE}`)
  console.log(`================================================================================\n`)

  let passed = 0
  let failed = 0

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`)
      passed++
    } else {
      console.error(`  ✗ FAIL: ${message}`)
      failed++
    }
  }

  // 1. Health check
  try {
    const res = await fetch(`${PROD_BASE}/api/health`)
    const data = await res.json()
    assert(res.status === 200 && data.ok === true, "GET /api/health returns 200 with ok: true")
  } catch (e) {
    assert(false, `GET /api/health failed: ${e.message}`)
  }

  // 2. Public Pricing Config (No 401)
  try {
    const res = await fetch(`${PROD_BASE}/api/pricing-config`)
    const data = await res.json()
    assert(res.status === 200 && data.config && data.config.standardMin, "GET /api/pricing-config is publicly accessible without 401")
  } catch (e) {
    assert(false, `GET /api/pricing-config failed: ${e.message}`)
  }

  // 3. Public Availability (No 401)
  try {
    const res = await fetch(`${PROD_BASE}/api/availability?animal=Kapila&date=2026-11-10&time=10:00&duration=60`)
    const data = await res.json()
    assert(res.status === 200 && typeof data.available === "boolean", "GET /api/availability is publicly accessible without 401")
  } catch (e) {
    assert(false, `GET /api/availability failed: ${e.message}`)
  }

  // 4. Public Gaushalas List with Economics Columns
  let sampleGosalaId = ""
  try {
    const res = await fetch(`${PROD_BASE}/api/gosalas`)
    const data = await res.json()
    assert(res.status === 200 && Array.isArray(data.gosalas) && data.gosalas.length > 0, "GET /api/gosalas returns active sanctuaries")
    if (data.gosalas && data.gosalas.length > 0) {
      const g = data.gosalas[0]
      sampleGosalaId = g.id
      assert(g.baseCowPrice !== undefined, `Gaushala "${g.name}" contains baseCowPrice: ₹${g.baseCowPrice}`)
      assert(g.partnershipTier !== undefined, `Gaushala "${g.name}" contains partnershipTier: ${g.partnershipTier}`)
    }
  } catch (e) {
    assert(false, `GET /api/gosalas failed: ${e.message}`)
  }

  // 5. Public Animals List
  try {
    const res = await fetch(`${PROD_BASE}/api/animals`)
    const data = await res.json()
    assert(res.status === 200 && Array.isArray(data.animals) && data.animals.length > 0, "GET /api/animals returns registered sacred cattle")
  } catch (e) {
    assert(false, `GET /api/animals failed: ${e.message}`)
  }

  // 6. Super Admin Isolated Login
  let superAdminToken = ""
  try {
    const res = await fetch(`${PROD_BASE}/api/auth/admin-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "superadmin@gomaa.in", password: "SuperAdmin@2026!" }),
    })
    const data = await res.json()
    assert(res.status === 200 && data.ok === true && data.user.role === "super_admin", "Super Admin signs in via /api/auth/admin-login")
    superAdminToken = data.token
  } catch (e) {
    assert(false, `Super Admin login failed: ${e.message}`)
  }

  // 7. Operations Admin Isolated Login
  let opsAdminToken = ""
  try {
    const res = await fetch(`${PROD_BASE}/api/auth/admin-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "operations@gomaa.in", password: "GomaaAdmin@2026!" }),
    })
    const data = await res.json()
    assert(res.status === 200 && data.ok === true && data.user.role === "admin", "Operations Admin signs in via /api/auth/admin-login")
    opsAdminToken = data.token
  } catch (e) {
    assert(false, `Operations Admin login failed: ${e.message}`)
  }

  // 8. Devotee Customer Login
  let customerToken = ""
  let customerUserId = ""
  try {
    const res = await fetch(`${PROD_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "devpulseorg@gmail.com", password: "GomaaAdmin@2026!" }),
    })
    const data = await res.json()
    assert(res.status === 200 && data.ok === true && data.user.role === "customer", "Devotee Customer signs in via /api/auth/login")
    customerToken = data.token
    customerUserId = data.user.id
  } catch (e) {
    assert(false, `Customer login failed: ${e.message}`)
  }

  // 9. Devotee Slot Hold Creation on /api/hold (Verifying resolution of 500 error)
  let holdId = ""
  try {
    const res = await fetch(`${PROD_BASE}/api/hold`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        animal: "Kapila",
        date: "2026-11-12",
        start: "10:00",
        durationMin: 60,
        customerName: "Devotee Automated QA",
      }),
    })
    const data = await res.json()
    assert(res.status === 200 && data.success === true && data.hold && data.hold.id, `POST /api/hold succeeds with 200 OK: Hold ID ${data.hold?.id}`)
    holdId = data.hold?.id
  } catch (e) {
    assert(false, `POST /api/hold failed: ${e.message}`)
  }

  // 10. Releasing Hold
  if (holdId) {
    try {
      const res = await fetch(`${PROD_BASE}/api/hold/release`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${customerToken}`,
        },
        body: JSON.stringify({ holdId }),
      })
      const data = await res.json()
      assert(res.status === 200 && data.released === true, `POST /api/hold/release successfully released hold ${holdId}`)
    } catch (e) {
      assert(false, `POST /api/hold/release failed: ${e.message}`)
    }
  }

  // 11. Sanctuary Economics Update by Super Admin
  if (sampleGosalaId && superAdminToken) {
    try {
      const res = await fetch(`${PROD_BASE}/api/gosalas/${sampleGosalaId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({
          partnershipTier: "PREFERRED",
          customCommissionPct: 8,
          taxTreatment: "section_80g_exempt",
          bufferMinutes: 30,
          partnershipNotes: "Automated Live QA test: 8% preferential commission",
        }),
      })
      const data = await res.json()
      assert(res.status === 200 && data.ok === true, "PUT /api/gosalas/:id updates economics dynamically in cloud database")
    } catch (e) {
      assert(false, `PUT /api/gosalas/:id failed: ${e.message}`)
    }
  }

  console.log(`\n================================================================================`)
  console.log(`   LIVE PRODUCTION QA SUMMARY: ${passed} PASSED, ${failed} FAILED`)
  console.log(`================================================================================\n`)

  if (failed > 0) {
    process.exit(1)
  }
}

runTests().catch(console.error)
