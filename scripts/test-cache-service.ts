/**
 * Test Suite for Lightweight In-Memory Redis-Compatible Cache Service
 */

import { cacheService } from "../server/services/cacheService"
import { acquireSlotHold, releaseSlotHold } from "../server/services/holdService"

console.log("=====================================================================")
console.log("   GOMAA LIGHTWEIGHT COST-FREE CACHE SERVICE TEST SUITE              ")
console.log("=====================================================================\n")

let passed = 0
let failed = 0

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${msg}`)
    passed++
  } else {
    console.error(`  ✗ FAIL: ${msg}`)
    failed++
  }
}

async function runTests() {
  await cacheService.flushAll()

  // 1. Basic SET and GET
  await cacheService.set("test:greeting", "Jai Shree Krishna")
  const greeting = await cacheService.get("test:greeting")
  assert(greeting === "Jai Shree Krishna", "Basic SET and GET work correctly")

  // 2. EXISTS and DEL
  assert((await cacheService.exists("test:greeting")) === true, "EXISTS returns true for active key")
  await cacheService.del("test:greeting")
  assert((await cacheService.exists("test:greeting")) === false, "DEL removes the key")
  assert((await cacheService.get("test:greeting")) === null, "GET returns null after DEL")

  // 3. SETNX (Atomic Lock Semantics)
  const lock1 = await cacheService.set("lock:slot:gauri", "user1", { ttlSeconds: 60, nx: true })
  assert(lock1 === true, "First SETNX acquires lock successfully")

  const lock2 = await cacheService.set("lock:slot:gauri", "user2", { ttlSeconds: 60, nx: true })
  assert(lock2 === false, "Second concurrent SETNX fails (atomic lock protects slot)")

  // 4. TTL and SETEX
  await cacheService.setex("gps:driver:102", 2, { lat: 18.5204, lng: 73.8567, speed: 28 })
  const gpsBefore = await cacheService.get<any>("gps:driver:102")
  assert(gpsBefore?.speed === 28, "SETEX stores ephemeral GPS data")
  const ttl = await cacheService.ttl("gps:driver:102")
  assert(ttl > 0 && ttl <= 2, `TTL returns remaining seconds (${ttl}s)`)

  // 5. Pattern matching KEYS
  await cacheService.set("fleet:pune:1", "MH-12-Q-4491")
  await cacheService.set("fleet:pune:2", "MH-12-RN-8821")
  await cacheService.set("fleet:mumbai:1", "MH-01-AB-1234")
  const puneFleet = await cacheService.keys("fleet:pune:*")
  assert(puneFleet.length === 2, `KEYS pattern match returns correct subset (${puneFleet.length} items)`)

  // 6. Integrated Slot Hold Service test
  const hold1 = await acquireSlotHold({
    animal: "Gauri",
    date: "12 Nov 2026",
    start: "11:00",
    durationMin: 60,
    customerName: "Devotee Rajesh",
  })
  assert(hold1.success === true, "acquireSlotHold acquires slot hold with cache lock")

  const hold2 = await acquireSlotHold({
    animal: "Gauri",
    date: "12 Nov 2026",
    start: "11:00",
    durationMin: 60,
    customerName: "Devotee Suresh",
  })
  assert(hold2.success === false, "acquireSlotHold rejects overlapping slot hold due to active cache lock")

  if (hold1.success) {
    const released = await releaseSlotHold(hold1.hold.holdId)
    assert(released === true, "releaseSlotHold successfully frees the hold and clears cache lock")
  }

  // 7. Stats telemetry
  const stats = cacheService.getStats()
  assert(stats.memoryMode === "in-memory-cost-free", "Cache service identifies as cost-free in-memory mode")
  assert(stats.hits > 0, `Cache telemetry tracks hits correctly (${stats.hits} hits)`)

  console.log("\n=====================================================================")
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`)
  console.log("=====================================================================")

  if (failed > 0) process.exit(1)
}

runTests().catch(console.error)
