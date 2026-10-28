import { describe, it, expect, beforeAll } from "vitest"
import request from "supertest"
import { createTestServer } from "./app.ts"
import { signJwt } from "../server/auth/jwt.ts"
import type { Server } from "node:http"

describe("GOMAA Sovereign RBAC & 80/20 Platform Economics Suite", () => {
  let server: Server

  // Pre-configured cryptographic test tokens for each role hierarchy
  let superAdminToken: string
  let opsAdminToken1: string
  let opsAdminToken2: string
  let managerToken: string
  let customerToken: string

  beforeAll(() => {
    server = createTestServer()

    // 1. Super Admin Captain
    superAdminToken = signJwt({
      userId: "test-superadmin-uuid",
      name: "Master Super Admin",
      email: "superadmin@gomaa.in",
      role: "super_admin",
      dbRole: "SUPER_ADMIN",
      gosalaIds: [],
      gosalaNames: ["All Network Gaushalas"],
      originalRole: "super_admin",
    })

    // 2. Regional Operations Admin 1 (Assigned to Gaushala_01 & Gaushala_02)
    opsAdminToken1 = signJwt({
      userId: "test-ops-admin-1-uuid",
      name: "GOMAA Operations Hub 1",
      email: "gomaa052026@gmail.com",
      role: "admin",
      dbRole: "OPERATIONS_ADMIN",
      adminId: "test-ops-admin-1-uuid",
      gosalaIds: ["gaushala_01_id", "gaushala_02_id"],
      gosalaNames: ["Gaushala_01", "Gaushala_02"],
    })

    // 3. Regional Operations Admin 2 (Assigned to Gaushala_03 only)
    opsAdminToken2 = signJwt({
      userId: "test-ops-admin-2-uuid",
      name: "GOMAA Operations Hub 2",
      email: "alt.ops@gomaa.in",
      role: "admin",
      dbRole: "OPERATIONS_ADMIN",
      adminId: "test-ops-admin-2-uuid",
      gosalaIds: ["gaushala_03_id"],
      gosalaNames: ["Gaushala_03"],
    })

    // 4. Custodian Manager (Assigned to Gaushala_01)
    managerToken = signJwt({
      userId: "test-manager-uuid",
      name: "Gaushala Custodian Manager",
      email: "mgr.surya@gomaa.in",
      role: "manager",
      dbRole: "GOSALA_MANAGER",
      gosalaIds: ["gaushala_01_id"],
      gosalaNames: ["Gaushala_01"],
    })

    // 5. Devotee Customer
    customerToken = signJwt({
      userId: "test-customer-uuid",
      name: "Devotee Ramesh",
      email: "ramesh.devotee@gomaa.test",
      role: "customer",
      dbRole: "CUSTOMER",
      gosalaIds: [],
      gosalaNames: [],
    })
  })

  // ===========================================================================
  // SECTION 1: AUTHENTICATION & SESSION INTEGRITY
  // ===========================================================================
  describe("1. Authentication & Session Gatekeeping", () => {
    it("rejects unauthenticated requests to protected endpoints with 401", async () => {
      const res = await request(server).get("/api/users")
      expect(res.status).toBe(401)
      expect(res.body.ok).toBe(false)
      expect(res.body.error).toMatch(/Authentication required/i)
    })

    it("rejects forged or malformed Authorization headers with 401", async () => {
      const res = await request(server)
        .get("/api/users")
        .set("Authorization", "Bearer invalid-tampered-token-xyz")
      expect(res.status).toBe(401)
      expect(res.body.ok).toBe(false)
    })

    it("allows public access to baseline public endpoints", async () => {
      const res = await request(server).get("/api/health")
      expect(res.status).toBe(200)
      expect(res.body.ok).toBe(true)
    })

    it("identifies Super Admin correctly on /api/auth/me", async () => {
      const res = await request(server)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${superAdminToken}`)
      expect(res.status).toBe(200)
      expect(res.body.ok).toBe(true)
      expect(res.body.user.role).toBe("super_admin")
      expect(res.body.user.email).toBe("superadmin@gomaa.in")
    })

    it("identifies Operations Admin correctly on /api/auth/me", async () => {
      const res = await request(server)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${opsAdminToken1}`)
      expect(res.status).toBe(200)
      expect(res.body.ok).toBe(true)
      expect(res.body.user.role).toBe("admin")
      expect(res.body.user.email).toBe("gomaa052026@gmail.com")
    })

    it("validates login endpoint error responses when fields are missing", async () => {
      const res = await request(server)
        .post("/api/auth/login")
        .send({})
      expect(res.status).toBe(400)
      expect(res.body.ok).toBe(false)
    })
  })

  // ===========================================================================
  // SECTION 2: RBAC HIERARCHY & USER DIRECTORY PRIVACY (SUPER ADMIN ONLY)
  // ===========================================================================
  describe("2. User Directory & RBAC Isolation (Super Admin Exclusivity)", () => {
    it("grants Super Admin exclusive access to view the global user directory", async () => {
      const res = await request(server)
        .get("/api/users")
        .set("Authorization", `Bearer ${superAdminToken}`)
      expect(res.status).toBe(200)
      expect(res.body.ok).toBe(true)
      expect(Array.isArray(res.body.users)).toBe(true)
    })

    it("strictly blocks Operations Admin from reading the global user directory (HTTP 403)", async () => {
      const res = await request(server)
        .get("/api/users")
        .set("Authorization", `Bearer ${opsAdminToken1}`)
      expect(res.status).toBe(403)
      expect(res.body.ok).toBe(false)
      expect(res.body.error).toMatch(/Insufficient privileges/i)
    })

    it("strictly blocks Gaushala Manager from reading the user directory (HTTP 403)", async () => {
      const res = await request(server)
        .get("/api/users")
        .set("Authorization", `Bearer ${managerToken}`)
      expect(res.status).toBe(403)
      expect(res.body.ok).toBe(false)
    })

    it("strictly blocks Devotee/Customer from reading the user directory (HTTP 403)", async () => {
      const res = await request(server)
        .get("/api/users")
        .set("Authorization", `Bearer ${customerToken}`)
      expect(res.status).toBe(403)
      expect(res.body.ok).toBe(false)
    })

    it("strictly blocks Operations Admin from creating a user via POST /api/users (HTTP 403)", async () => {
      const res = await request(server)
        .post("/api/users")
        .set("Authorization", `Bearer ${opsAdminToken1}`)
        .send({
          name: "Rogue User Creation",
          email: "rogue@gomaa.test",
          phone: "+91 99999 88888",
          role: "customer",
          password: "RoguePassword123!",
        })
      expect(res.status).toBe(403)
      expect(res.body.ok).toBe(false)
    })

    it("strictly blocks Operations Admin from deleting a user via DELETE /api/users/:id (HTTP 403)", async () => {
      const res = await request(server)
        .delete("/api/users/any-target-user-id")
        .set("Authorization", `Bearer ${opsAdminToken1}`)
      expect(res.status).toBe(403)
      expect(res.body.ok).toBe(false)
    })
  })

  // ===========================================================================
  // SECTION 3: FINANCIAL GOVERNANCE & SOVEREIGN CAPTAIN POWER
  // ===========================================================================
  describe("3. Financial Controls & Master Treasury Governance", () => {
    it("strictly blocks Operations Admin from modifying Master Pricing Config (HTTP 403)", async () => {
      const res = await request(server)
        .put("/api/pricing-config")
        .set("Authorization", `Bearer ${opsAdminToken1}`)
        .send({
          standardMin: 90,
          commissionPct: 10,
        })
      expect(res.status).toBe(403)
      expect(res.body.ok).toBe(false)
      expect(res.body.error).toMatch(/Insufficient privileges/i)
    })

    it("strictly blocks Custodian Manager from modifying Master Pricing Config (HTTP 403)", async () => {
      const res = await request(server)
        .put("/api/pricing-config")
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ commissionPct: 5 })
      expect(res.status).toBe(403)
      expect(res.body.ok).toBe(false)
    })

    it("strictly blocks Operations Admin from executing batch settlement sweeps (HTTP 403)", async () => {
      const res = await request(server)
        .post("/api/settlements/batch-approve")
        .set("Authorization", `Bearer ${opsAdminToken1}`)
        .send({ batchId: "BATCH-2026-TEST" })
      expect(res.status).toBe(403)
      expect(res.body.ok).toBe(false)
    })

    it("strictly blocks Operations Admin from executing settlement advances (HTTP 403)", async () => {
      const res = await request(server)
        .post("/api/settlements/advance")
        .set("Authorization", `Bearer ${opsAdminToken1}`)
        .send({ amount: 50000, gosalaId: "gaushala_01_id" })
      expect(res.status).toBe(403)
      expect(res.body.ok).toBe(false)
    })
  })

  // ===========================================================================
  // SECTION 4: MULTI-TENANT OPERATIONS ADMIN PORTFOLIO BOUNDARIES
  // ===========================================================================
  describe("4. Multi-Tenant Operations Admin Portfolio Boundaries", () => {
    it("prevents Operations Admin from assigning managers to Gaushalas outside their operational portfolio", async () => {
      // opsAdminToken1 is assigned to ["Gaushala_01", "Gaushala_02"].
      // Attempting to assign a manager to "Gaushala_99_Foreign" must be rejected with 403.
      const res = await request(server)
        .post("/api/managers")
        .set("Authorization", `Bearer ${opsAdminToken1}`)
        .send({
          name: "Intruder Manager",
          email: "intruder.mgr@gomaa.test",
          phone: "+91 91234 56789",
          gosalas: ["Gaushala_99_Foreign_Out_Of_Scope"],
        })
      expect(res.status).toBe(403)
      expect(res.body.ok).toBe(false)
      expect(res.body.error).toMatch(/operational portfolio/i)
    })

    it("strictly scopes bookings retrieval by assigned Gaushala portfolio", async () => {
      const res = await request(server)
        .get("/api/bookings")
        .set("Authorization", `Bearer ${opsAdminToken1}`)
      expect(res.status).toBe(200)
      expect(Array.isArray(res.body.bookings)).toBe(true)
      // Any bookings returned must belong to Gaushala_01 or Gaushala_02
      if (res.body.bookings?.length > 0) {
        for (const booking of res.body.bookings) {
          const gName = booking.gosala || booking.gosalaName
          expect(["Gaushala_01", "Gaushala_02"]).toContain(gName)
        }
      }
    })
  })

  // ===========================================================================
  // SECTION 5: RUGGED 80/20 PLATFORM ECONOMICS & PAYSLIP SPLITTING
  // ===========================================================================
  describe("5. 80/20 Platform Economics & Payslip Splitting Invariants", () => {
    it("calculates exact 80/20 split for baseline standard seva (₹3,500 base)", async () => {
      const res = await request(server)
        .post("/api/pricing/calculate")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          baseRate: 3500,
          durationMin: 60,
          distanceKm: 5, // 5km is within free limit
          addonsCost: 0,
          discount: 0,
          commissionPct: 20,
          taxPct: 12,
        })

      expect(res.status).toBe(200)
      const data = res.body

      // 1. Line item checks
      expect(data.base).toBe(3500)
      expect(data.extraTime).toBe(0)
      expect(data.transport).toBe(0)
      expect(data.addons).toBe(0)
      expect(data.discount).toBe(0)

      // 2. Tax check: 12% of ₹3500 = ₹420
      expect(data.tax).toBe(420)

      // 3. Devotee total check: ₹3500 + ₹420 = ₹3920
      expect(data.total).toBe(3920)

      // 4. Seva fee splitting:
      // Commission (20% of ₹3500) = ₹700
      expect(data.commission).toBe(700)
      expect(data.commissionPct).toBe(20)

      // Gaushala Net Payable (80% of ₹3500) = ₹2800
      expect(data.gosalaPayable).toBe(2800)

      // Rugged Invariant: Zero leakage between platform commission and sanctuary payable
      expect(data.commission + data.gosalaPayable).toBe(3500)
    })

    it("accurately handles extended time, chargeable distance, and 100% pass-through transport", async () => {
      const res = await request(server)
        .post("/api/pricing/calculate")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          baseRate: 3500,
          durationMin: 120,
          extraUnitMin: 30,
          extraUnitRate: 500,
          distanceKm: 25,
          freeKm: 5,
          perKm: 50,
          addonsCost: 200,
          discount: 100,
          commissionPct: 20,
          taxPct: 12,
        })

      expect(res.status).toBe(200)
      const data = res.body

      expect(data.base).toBe(3500)
      expect(data.extraTime).toBe(1000)
      expect(data.transport).toBe(1000)
      expect(data.addons).toBe(200)
      expect(data.discount).toBe(100)
      expect(data.tax).toBe(672)
      expect(data.total).toBe(6272)

      expect(data.commission).toBe(900)
      expect(data.gosalaPayable).toBe(4800)

      // Total untaxed disbursement breakdown:
      // (Commission 900) + (Gosala Net 4800) - (Discount 100) = 5600 (Exact subtotal before tax)
      expect(data.commission + data.gosalaPayable - data.discount).toBe(5600)
    })

    it("supports custom commission tiers (e.g. 15% subsidized rate) with 100 - X exact split", async () => {
      const res = await request(server)
        .post("/api/pricing/calculate")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          baseRate: 4000,
          durationMin: 60,
          distanceKm: 5,
          commissionPct: 15,
          taxPct: 12,
        })

      expect(res.status).toBe(200)
      const data = res.body

      // 15% of 4000 = 600
      expect(data.commission).toBe(600)
      // 85% of 4000 = 3400
      expect(data.gosalaPayable).toBe(3400)
      // Invariant: Zero penny loss
      expect(data.commission + data.gosalaPayable).toBe(4000)
    })

    it("supports Section 80G Tax Exemption (0% GST) for certified Gaushalas", async () => {
      const res = await request(server)
        .post("/api/pricing/calculate")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          baseRate: 5000,
          durationMin: 60,
          distanceKm: 5,
          commissionPct: 20,
          taxPct: 0, // 80G tax exempt
        })

      expect(res.status).toBe(200)
      const data = res.body

      expect(data.tax).toBe(0)
      expect(data.total).toBe(5000)
      expect(data.commission).toBe(1000)
      expect(data.gosalaPayable).toBe(4000)
      expect(data.commission + data.gosalaPayable).toBe(5000)
    })
  })
})
