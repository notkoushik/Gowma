import WebSocket from "ws"

const API_BASE = "http://localhost:8443"
const WS_URL = "ws://localhost:8443/ws"

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function runTestSuite() {
  console.log(
    "=================================================================",
  )
  console.log(
    "       GOMAA REAL-TIME WEBSOCKET & GPS VERIFICATION SUITE       ",
  )
  console.log(
    "=================================================================",
  )

  let passed = 0
  let failed = 0

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`)
      passed++
    } else {
      console.error(`  [FAIL] ${message}`)
      failed++
    }
  }

  // --- LEVEL 1: WebSocket Handshake & Heartbeat Ping-Pong ---
  console.log("\n[LEVEL 1] Testing WebSocket Handshake & Ping-Pong...")
  const ws1 = new WebSocket(WS_URL)

  await new Promise((resolve, reject) => {
    ws1.on("open", resolve)
    ws1.on("error", reject)
  })
  assert(
    ws1.readyState === WebSocket.OPEN,
    "WebSocket connection opened to " + WS_URL,
  )

  let pongReceived = false
  const pongPromise = new Promise((resolve) => {
    ws1.on("message", (raw) => {
      const msg = JSON.parse(raw.toString("utf-8"))
      if (msg.event === "PONG") {
        pongReceived = true
        resolve(msg)
      }
    })
  })

  ws1.send(JSON.stringify({ action: "PING" }))
  const pongData = await pongPromise
  assert(
    pongReceived && pongData.data?.timestamp,
    "Server responded to PING with PONG frame and timestamp",
  )

  // --- LEVEL 2: Room Subscription & Isolation ---
  console.log("\n[LEVEL 2] Testing Room Subscription & Channel Isolation...")
  const wsManager = new WebSocket(WS_URL)
  const wsAuditor = new WebSocket(WS_URL)

  await Promise.all([
    new Promise((res) => wsManager.on("open", res)),
    new Promise((res) => wsAuditor.on("open", res)),
  ])

  // Manager subscribes to Shri Krishna Gaushala channel
  wsManager.send(
    JSON.stringify({
      action: "SUBSCRIBE",
      channel: "channel:gosala:Shri Krishna Gaushala",
    }),
  )
  // Auditor subscribes only to admin channel
  wsAuditor.send(
    JSON.stringify({ action: "SUBSCRIBE", channel: "channel:admin" }),
  )

  await sleep(100)

  let managerGotAlert = false
  let auditorGotAlert = false

  wsManager.on("message", (raw) => {
    const msg = JSON.parse(raw.toString("utf-8"))
    if (
      msg.event === "ROLE_ALERT" &&
      msg.channel === "channel:gosala:Shri Krishna Gaushala"
    ) {
      managerGotAlert = true
    }
  })

  wsAuditor.on("message", (raw) => {
    const msg = JSON.parse(raw.toString("utf-8"))
    if (
      msg.event === "ROLE_ALERT" &&
      msg.channel === "channel:gosala:Shri Krishna Gaushala"
    ) {
      auditorGotAlert = true // Isolation breach!
    }
  })

  // Trigger a test booking creation via REST
  const testBookingId = "GMA-TEST-" + Math.floor(10000 + Math.random() * 90000)
  const createRes = await fetch(`${API_BASE}/api/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      booking: {
        id: testBookingId,
        customer: "Ananya Deshmukh",
        phone: "+91 98204 11827",
        gosala: "Shri Krishna Gaushala",
        animal: "Gauri",
        animalType: "Cow",
        date: "29 Sep 2026",
        start: "14:00",
        end: "15:00",
        durationMin: 60,
        address: "Kothrud, Pune",
        distanceKm: 6.5,
        base: 2400,
        extraTime: 0,
        transport: 75,
        addons: 250,
        tax: 136,
        discount: 0,
        total: 2861,
        commissionPct: 20,
        status: "Payment Verified",
        driver: null,
        driverStage: 0,
        paid: true,
      },
    }),
  })

  assert(
    createRes.status === 201,
    `Created booking ${testBookingId} via POST /api/bookings`,
  )
  await sleep(300)

  assert(
    managerGotAlert,
    "Manager client received targeted ROLE_ALERT for Shri Krishna Gaushala",
  )
  assert(
    !auditorGotAlert,
    "Auditor client did NOT receive Gaushala-private channel message (Room isolation verified)",
  )

  // --- LEVEL 3: End-to-End Persona Workflow & Real-Time GPS Tracking ---
  console.log(
    "\n[LEVEL 3] Testing End-to-End Persona Workflow & Real-Time GPS Streaming...",
  )

  // Setup Customer Tracking WebSocket client for this specific booking
  const wsCustomer = new WebSocket(WS_URL)
  await new Promise((res) => wsCustomer.on("open", res))
  wsCustomer.send(
    JSON.stringify({
      action: "SUBSCRIBE",
      channel: `channel:booking:${testBookingId}`,
    }),
  )

  let receivedBookingUpdates = []
  let receivedGpsTicks = []

  wsCustomer.on("message", (raw) => {
    const msg = JSON.parse(raw.toString("utf-8"))
    if (msg.event === "BOOKING_UPDATED") {
      receivedBookingUpdates.push(msg.data.booking)
    }
    if (msg.event === "GPS_TICK") {
      receivedGpsTicks.push(msg.data)
    }
  })

  // 1. Manager Decides (approves feasibility)
  const mgrRes = await fetch(
    `${API_BASE}/api/bookings/${testBookingId}/manager-decide`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        confirm: true,
        remark: "Gauri is well fed, groomed, and fully fit for evening puja",
        managerName: "Ramesh Shinde",
      }),
    },
  )
  const mgrData = await mgrRes.json()
  assert(
    mgrData.booking?.status === "Admin Review",
    "Step 1: Gosala Manager approved -> status transitioned to 'Admin Review'",
  )

  // 2. Admin Confirms
  const admRes = await fetch(
    `${API_BASE}/api/bookings/${testBookingId}/admin-decide`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        confirm: true,
        remark: "Confirmed by Operations Hub",
        adminName: "Rajesh Kulkarni",
      }),
    },
  )
  const admData = await admRes.json()
  assert(
    admData.booking?.status === "Confirmed",
    "Step 2: Admin approved -> status transitioned to 'Confirmed'",
  )

  // 3. Admin Assigns Driver Sunil Pawar
  const drvRes = await fetch(
    `${API_BASE}/api/bookings/${testBookingId}/assign-driver`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ driver: "Sunil Pawar" }),
    },
  )
  const drvData = await drvRes.json()
  assert(
    drvData.booking?.driver === "Sunil Pawar" &&
      drvData.booking?.driverStage === 1,
    "Step 3: Driver assigned -> Sunil Pawar with stage 1 (Assigned)",
  )

  // 4. Driver advances through stages to Stage 4 (Start transport)
  await fetch(`${API_BASE}/api/bookings/${testBookingId}/advance-stage`, {
    method: "POST",
  }) // Stage 2: Vehicle Departed Gosala
  await fetch(`${API_BASE}/api/bookings/${testBookingId}/advance-stage`, {
    method: "POST",
  }) // Stage 3: Reached Pickup Point
  const stage4Res = await fetch(
    `${API_BASE}/api/bookings/${testBookingId}/advance-stage`,
    { method: "POST" },
  ) // Stage 4: Transport Started
  const stage4Data = await stage4Res.json()
  assert(
    stage4Data.booking?.driverStage === 4,
    "Step 4: Driver marked Stage 4 ('Transport started / on the way')",
  )

  console.log("  Waiting for live GPS ticks stream (sampling 3 ticks)...")
  const startWait = Date.now()
  while (receivedGpsTicks.length < 3 && Date.now() - startWait < 6000) {
    await sleep(200)
  }

  assert(
    receivedGpsTicks.length >= 3,
    `Received ${receivedGpsTicks.length} live GPS tick frames over WebSocket`,
  )

  if (receivedGpsTicks.length > 0) {
    const tick = receivedGpsTicks[0]
    console.log(
      `    Sample GPS Tick: lat=${tick.lat}, lng=${tick.lng}, bearing=${tick.bearing}°, speed=${tick.speedKmh} km/h, dist=${tick.distanceRemainingKm} km, ETA=${tick.etaMinutes} min`,
    )
    assert(
      typeof tick.lat === "number" && tick.lat > 18.0 && tick.lat < 19.0,
      "Tick latitude is valid for Pune region (" + tick.lat + ")",
    )
    assert(
      typeof tick.lng === "number" && tick.lng > 73.0 && tick.lng < 74.0,
      "Tick longitude is valid for Pune region (" + tick.lng + ")",
    )
    assert(
      tick.bearing >= 0 && tick.bearing <= 360,
      `Bearing angle θ is in [0, 360] range (${tick.bearing}°)`,
    )
    assert(
      tick.speedKmh >= 20 && tick.speedKmh <= 60,
      `Vehicle speed is in realistic transit range (${tick.speedKmh} km/h)`,
    )
    assert(
      typeof tick.etaMinutes === "number" && tick.etaMinutes > 0,
      `ETA countdown is valid (${tick.etaMinutes} min)`,
    )
  }

  // Advance stage to stop simulation
  await fetch(`${API_BASE}/api/bookings/${testBookingId}/advance-stage`, {
    method: "POST",
  }) // Stage 5: Arrived at Customer

  // Close all sockets
  ws1.close()
  wsManager.close()
  wsAuditor.close()
  wsCustomer.close()

  console.log(
    "\n=================================================================",
  )
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`)
  console.log(
    "=================================================================\n",
  )

  if (failed > 0) {
    process.exit(1)
  }
}

runTestSuite().catch((err) => {
  console.error("Test execution failed:", err)
  process.exit(1)
})
