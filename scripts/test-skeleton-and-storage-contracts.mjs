import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync, existsSync } from "node:fs"

const store = readFileSync("src/store/store.tsx", "utf8")
const app = readFileSync("src/App.tsx", "utf8")
const wallet = readFileSync("src/services/walletService.ts", "utf8")
const bookings = readFileSync("src/views/Bookings.tsx", "utf8")
const pricing = readFileSync("src/views/Pricing.tsx", "utf8")

test("localStorage entity syncing is stopped; only JWT auth token is cached", () => {
  // Must NOT sync domain entities to localStorage
  assert.doesNotMatch(store, /localStorage\.setItem\(\s*["']gomaa_gosalas["']/)
  assert.doesNotMatch(store, /localStorage\.setItem\(\s*["']gomaa_sacred_animals["']/)
  assert.doesNotMatch(store, /localStorage\.setItem\(\s*["']gomaa_empanelled_vets["']/)
  assert.doesNotMatch(store, /localStorage\.setItem\(\s*["']gomaa_managers["']/)
  assert.doesNotMatch(store, /localStorage\.setItem\(\s*["']gomaa_settlements["']/)
  assert.doesNotMatch(store, /localStorage\.setItem\(\s*["']gomaa_bookings["']/)
  assert.doesNotMatch(store, /localStorage\.setItem\(\s*["']gomaa_role_profiles["']/)
  assert.doesNotMatch(store, /localStorage\.setItem\(\s*["']gomaa_pricing_config["']/)
  assert.doesNotMatch(store, /localStorage\.setItem\(\s*["']gomaa_active_manager_gosala["']/)

  // Wallet service must not sync policies or withdrawals to localStorage
  assert.doesNotMatch(wallet, /localStorage\.setItem\(STORAGE_KEY_POLICIES/)
  assert.doesNotMatch(wallet, /localStorage\.setItem\(STORAGE_KEY_WITHDRAWALS/)

  // Legacy localStorage keys must be purged on startup
  assert.match(store, /localStorage\.removeItem\(["']gomaa_gosalas["']\)/)
  assert.match(store, /localStorage\.removeItem\(["']gomaa_sacred_animals["']\)/)
  assert.match(store, /localStorage\.removeItem\(["']gomaa_bookings["']\)/)
  assert.match(store, /localStorage\.removeItem\(["']gomaa_settlements["']\)/)
  assert.match(store, /localStorage\.removeItem\(["']gomaa_role_profiles["']\)/)
  assert.match(store, /localStorage\.removeItem\(["']gomaa_pricing_config["']\)/)

  // Auth token MUST be the only cached credential
  assert.match(store, /localStorage\.getItem\(["']gomaa_auth_token["']\)/)
  assert.match(store, /localStorage\.setItem\(["']gomaa_auth_token["']/)
})

test("Store exposes isLoading and isLoadingProfiles state", () => {
  assert.match(store, /isLoading:\s*boolean/)
  assert.match(store, /isLoadingProfiles:\s*boolean/)
  assert.match(store, /setIsLoading\(true\)/)
  assert.match(store, /setIsLoading\(false\)/)
})

test("Skeleton components exist and are integrated into React components", () => {
  assert.ok(existsSync("src/components/common/Skeleton.tsx"), "Skeleton.tsx must exist")
  const skeletonCode = readFileSync("src/components/common/Skeleton.tsx", "utf8")
  assert.match(skeletonCode, /export function Skeleton/)
  assert.match(skeletonCode, /animate-pulse/)

  // App.tsx imports and integrates Skeleton
  assert.match(app, /import\s*\{\s*Skeleton\s*\}\s*from\s*["']\.\/components\/common\/Skeleton["']/)
  
  // App.tsx does NOT use raw static fallback without skeleton/empty-state check
  assert.doesNotMatch(app, /profiles\?\.\[auth\]\?\.name\s*\|\|\s*\(isSuperAdmin\s*\?\s*"Super Admin"\s*:\s*"Operations Admin"\)/)

  // App.tsx uses loading skeleton in profile header
  assert.match(app, /isLoading\s*\?\s*\(\s*<Skeleton variant="circular"/)
  assert.match(app, /isLoading\s*\?\s*\(\s*<Skeleton variant="text"/)

  // Empty state configuration prompt when field is not set in DB
  assert.match(app, /Configure Profile/)
})

test("Domain views integrate skeletons and dynamic database values", () => {
  // Bookings table renders skeleton rows when loading
  assert.match(bookings, /TableRowSkeleton/)
  assert.match(bookings, /isLoading\s*\?\s*\(/)

  // Pricing view replaces hardcoded Devendra Sharma with dynamic admin and skeleton
  assert.doesNotMatch(pricing, /"Devendra Sharma"/)
  assert.match(pricing, /isLoading\s*\?\s*\(\s*<Skeleton/)
  assert.match(pricing, /Configure Admin/)
})
