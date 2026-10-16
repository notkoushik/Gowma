import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const app = readFileSync("src/App.tsx", "utf8")
const realtime = readFileSync("src/hooks/useRealtime.ts", "utf8")
const router = readFileSync("server/router.ts", "utf8")
const hub = readFileSync("server/ws/hub.ts", "utf8")

test("Super Admin navigation excludes live tracking", () => {
  const navSection = app.slice(app.indexOf("const superAdminNav"), app.indexOf("const adminNav"))
  assert.doesNotMatch(navSection, /id:\s*"tracking"/)
  assert.match(app, /view === "tracking" && !isSuperAdmin/)
})

test("Super Admin realtime hook exits before subscribing", () => {
  assert.match(realtime, /currentRole === "super_admin"/) 
  assert.match(realtime, /if \(currentRole === "super_admin"\) return/)
  assert.doesNotMatch(realtime, /subs\.add\("channel:super_admin"\)/)
})

test("Operations Admin Gosala scope fails closed", () => {
  assert.match(router, /const allowedIds = new Set\(authUser\.gosalaIds \|\| \[\]\)/)
  assert.match(router, /const allowedNames = new Set/) 
  assert.match(router, /scopedGosalas = formatted\.filter/)
  assert.doesNotMatch(router, /\|\| \(!g\.governingAdminEmail && g\.governingAdminRole !== "super_admin"\)/)
})

test("Super Admin cannot subscribe to realtime channels", () => {
  assert.match(hub, /identity\.role === "super_admin"\) return false/)
})
