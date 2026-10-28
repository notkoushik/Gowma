import { describe, it, expect, beforeAll } from "vitest"
import request from "supertest"
import { createTestServer } from "./app.ts"
import { signJwt } from "../server/auth/jwt.ts"
import { generateUniqueId } from "../server/auth/authService.ts"
import type { Server } from "node:http"

describe("GOMAA Sovereign RBAC & 80/20 Platform Economics Suite", () => {
  let server: Server

  // Pre-configured cryptographic test tokens for each role hierarchy
  let superAdminToken: string
  let opsAdminToken1: string
  let opsAdminToken2: string
  let managerToken: string
  let customerToken: string
  let driverToken: string
  let steppedDownSuperAdminToken: string

  beforeAll(() => {
    server = createTestServer()

    // 1. Super Admin Captain
    superAdminToken = signJwt({
      userId: "USER-SA-SUPERADMIN",
      uniqueId: "GMA-SA-0001",
      name: "Super Admin",
      email: "superadmin@gomaa.in",
      role: "super_admin",
      dbRole: "SUPER_ADMIN",
      gosalaIds: [],
      gosalaNames: ["All Network Gaushalas"],
      originalRole: "super_admin",
    })

    // 2. Regional Operations Admin 1 (Assigned to Gaushala_01 & Gaushala_02)
    opsAdminToken1 = signJwt({
      userId: "df236242-0fb5-485c-988c-52336db502be",
      uniqueId: "GMA-OPS-0104",
      name: "GOMAA Operations",
      email: "gomaa052026@gmail.com",
      role: "admin",
      dbRole: "OPERATIONS_ADMIN",
      adminId: "df236242-0fb5-485c-988c-52336db502be",
      gosalaIds: ["6e187fdc-aab8-42e4-9370-8f607a7830f9", "d25c8f21-b5c5-4119-81b0-a0f7f7273911"],
      gosalaNames: ["Gaushala_01", "Gaushala_02"],
    })

    // 3. Regional Operations Admin 2 (Assigned to Gaushala_03 only)
    opsAdminToken2 = signJwt({
      userId: "c1076b48-1898-4cda-852a-73d108a5c30b",
      uniqueId: "GMA-OPS-0101",
      name: "Admin_1",
      email: "alt.yq-fs88dj2@yopmail.com",
      role: "admin",
      dbRole: "OPERATIONS_ADMIN",
      adminId: "c1076b48-1898-4cda-852a-73d108a5c30b",
      gosalaIds: ["c2b8b8de-0eef-43a8-b8c5-f98c8e1e9e09"],
      gosalaNames: ["Gaushala_03"],
    })

    // 4. Custodian Manager (Assigned to Gaushala_01)
    managerToken = signJwt({
      userId: "USER-MGR-01",
      uniqueId: "GMA-MGR-0101",
      name: "Manager 1",
      email: "manager1@gomaa.in",
      role: "manager",
      dbRole: "GOSALA_MANAGER",
      gosalaIds: ["6e187fdc-aab8-42e4-9370-8f607a7830f9"],
      gosalaNames: ["Gaushala_01"],
    })

    // 5. Devotee Customer
    customerToken = signJwt({
      userId: "f83d42a8-4dd7-42ff-bbc2-1381f39c8064",
      uniqueId: "GMA-DEV-0223",
      name: "Devotee (devpulseorg)",
      email: "devpulseorg@gmail.com",
      role: "customer",
      dbRole: "CUSTOMER",
      gosalaIds: [],
      gosalaNames: [],
    })

    // 6. Transit Driver
    driverToken = signJwt({
      userId: "ccc0e044-0b2d-4ee4-b13a-9bf7894d8ae3",
      uniqueId: "GMA-DRV-3001",
      name: "Sunil Pawar (Transit Pilot)",
      email: "driver@gomaa.in",
      role: "driver",
      dbRole: "DRIVER",
      gosalaIds: [],
      gosalaNames: [],
    })

    // 7. Super Admin stepped down into Operations context
    steppedDownSuperAdminToken = signJwt({
      userId: "USER-SA-SUPERADMIN",
      uniqueId: "GMA-SA-0001",
      name: "Super Admin",
      email: "superadmin@gomaa.in",
      role: "admin",
      dbRole: "OPERATIONS_ADMIN",
      originalRole: "super_admin",
      isContextSwitched: true,
      contextSwitchedAt: Date.now(),
      adminId: "USER-SA-SUPERADMIN",
      gosalaIds: [],
      gosalaNames: [],
    })
  })

  // ===========================================================================
  // SECTION 1: AUTHENTICATION, CRYPTOGRAPHIC UNIQUE ID & SESSION INTEGRITY
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

    it("identifies Super Admin correctly on /api/auth/me with GMA-SA-* uniqueId", async () => {
      const res = await request(server)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${superAdminToken}`)
      expect(res.status).toBe(200)
      expect(res.body.ok).toBe(true)
      expect(res.body.user.role).toBe("super_admin")
      expect(res.body.user.email).toBe("superadmin@gomaa.in")
      expect(res.body.user.uniqueId).toBe("GMA-SA-0001")
      expect(res.body.user.uniqueId).toMatch(/^GMA-SA-/)
    })

    it("identifies Operations Admin correctly on /api/auth/me with GMA-OPS-* uniqueId", async () => {
      const res = await request(server)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${opsAdminToken1}`)
      expect(res.status).toBe(200)
      expect(res.body.ok).toBe(true)
      expect(res.body.user.role).toBe("admin")
      expect(res.body.user.email).toBe("gomaa052026@gmail.com")
      expect(res.body.user.uniqueId).toBe("GMA-OPS-0104")
      expect(res.body.user.uniqueId).toMatch(/^GMA-OPS-/)
    })

    it("identifies Gaushala Manager correctly on /api/auth/me with GMA-MGR-* uniqueId", async () => {
      const res = await request(server)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${managerToken}`)
      expect(res.status).toBe(200)
      expect(res.body.ok).toBe(true)
      expect(res.body.user.role).toBe("manager")
      expect(res.body.user.email).toBe("manager1@gomaa.in")
      expect(res.body.user.uniqueId).toBe("GMA-MGR-0101")
      expect(res.body.user.uniqueId).toMatch(/^GMA-MGR-/)
    })

    it("identifies Customer Devotee correctly on /api/auth/me with GMA-DEV-* uniqueId", async () => {
      const res = await request(server)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${customerToken}`)
      expect(res.status).toBe(200)
      expect(res.body.ok).toBe(true)
      expect(res.body.user.role).toBe("customer")
      expect(res.body.user.uniqueId).toBe("GMA-DEV-0223")
      expect(res.body.user.uniqueId).toMatch(/^GMA-DEV-/)
    })

    it("identifies Transit Driver correctly on /api/auth/me with GMA-DRV-* uniqueId", async () => {
      const res = await request(server)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${driverToken}`)
      expect(res.status).toBe(200)
      expect(res.body.ok).toBe(true)
      expect(res.body.user.role).toBe("driver")
      expect(res.body.user.uniqueId).toBe("GMA-DRV-3001")
      expect(res.body.user.uniqueId).toMatch(/^GMA-DRV-/)
    })

    it("verifies generateUniqueId produces cryptographic prefixes for each role hierarchy", () => {
      const saId = generateUniqueId("super_admin")
      expect(saId).toMatch(/^GMA-SA-\d{4}$/)

      const opsId = generateUniqueId("admin", "+91 98765 43210")
      expect(opsId).toBe("GMA-OPS-3210")

      const mgrId = generateUniqueId("manager", "+91 91234 56789")
      expect(mgrId).toBe("GMA-MGR-6789")

      const drvId = generateUniqueId("driver", "+91 99887 76655")
      expect(drvId).toBe("GMA-DRV-6655")

      const devId = generateUniqueId("customer", "+91 95544 33221")
      expect(devId).toBe("GMA-DEV-3221")
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
      expect(res.body.users.length).toBeGreaterThan(0)
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

    it("strictly blocks Transit Driver from reading the user directory (HTTP 403)", async () => {
      const res = await request(server)
        .get("/api/users")
        .set("Authorization", `Bearer ${driverToken}`)
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
  // SECTION 4: MULTI-TENANT GAUSHALA ISOLATION & ROLE TREE BOUNDARIES
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

    it("GET /api/gosalas strictly isolates Gaushala_01 and Gaushala_02 to Operations Admin 1 (gomaa052026@gmail.com)", async () => {
      const res = await request(server)
        .get("/api/gosalas")
        .set("Authorization", `Bearer ${opsAdminToken1}`)
      expect(res.status).toBe(200)
      expect(res.body.ok).toBe(true)
      const names = res.body.gosalas.map((g: any) => g.name)
      expect(names).toContain("Gaushala_01")
      expect(names).toContain("Gaushala_02")
      expect(names).not.toContain("Gaushala_03")
    })

    it("GET /api/gosalas strictly isolates Gaushala_03 to Operations Admin 2 (alt.yq-fs88dj2@yopmail.com)", async () => {
      const res = await request(server)
        .get("/api/gosalas")
        .set("Authorization", `Bearer ${opsAdminToken2}`)
      expect(res.status).toBe(200)
      expect(res.body.ok).toBe(true)
      const names = res.body.gosalas.map((g: any) => g.name)
      expect(names).toContain("Gaushala_03")
      expect(names).not.toContain("Gaushala_01")
      expect(names).not.toContain("Gaushala_02")
    })

    it("Super Admin in stepped-down Operations context has zero foreign Gaushala leakage", async () => {
      const res = await request(server)
        .get("/api/gosalas")
        .set("Authorization", `Bearer ${steppedDownSuperAdminToken}`)
      expect(res.status).toBe(200)
      expect(res.body.ok).toBe(true)
      const names = res.body.gosalas.map((g: any) => g.name)
      expect(names).not.toContain("Gaushala_01")
      expect(names).not.toContain("Gaushala_02")
      expect(names).not.toContain("Gaushala_03")
    })

    it("Super Admin in Captain mode has sovereign global visibility across ALL Gaushalas", async () => {
      const res = await request(server)
        .get("/api/gosalas")
        .set("Authorization", `Bearer ${superAdminToken}`)
      expect(res.status).toBe(200)
      expect(res.body.ok).toBe(true)
      const names = res.body.gosalas.map((g: any) => g.name)
      expect(names).toContain("Gaushala_01")
      expect(names).toContain("Gaushala_02")
      expect(names).toContain("Gaushala_03")
    })

    it("strictly denies cross-tenant Gaushala modification (Operations Admin 2 trying to update Gaushala_01)", async () => {
      const res = await request(server)
        .put("/api/gosalas/Gaushala_01")
        .set("Authorization", `Bearer ${opsAdminToken2}`)
        .send({ capacity: 999 })
      expect(res.status).toBe(403)
      expect(res.body.ok).toBe(false)
      expect(res.body.error).toMatch(/operational portfolio/i)
    })

    it("strictly blocks unauthorized roles (Customer & Driver) from modifying Gaushala (HTTP 403)", async () => {
      const resCust = await request(server)
        .put("/api/gosalas/Gaushala_01")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ capacity: 500 })
      expect(resCust.status).toBe(403)

      const resDrv = await request(server)
        .put("/api/gosalas/Gaushala_01")
        .set("Authorization", `Bearer ${driverToken}`)
        .send({ capacity: 500 })
      expect(resDrv.status).toBe(403)
    })

    it("allows Operations Admin 1 to update Gaushala_01 with metadata persisting directly into PostgreSQL", async () => {
      const testCapacity = 450
      const testTrustNo = "TRUST-MH-VET-2026-QA"
      const testVisitingHours = "06:30 AM - 07:30 PM"

      const res = await request(server)
        .put("/api/gosalas/Gaushala_01")
        .set("Authorization", `Bearer ${opsAdminToken1}`)
        .send({
          capacity: testCapacity,
          trustRegistrationNo: testTrustNo,
          visitingHours: testVisitingHours,
          contactEmail: "gomaa052026@gmail.com",
        })
      expect(res.status).toBe(200)
      expect(res.body.ok).toBe(true)
      expect(res.body.gosala.capacity).toBe(testCapacity)
      expect(res.body.gosala.trustRegistrationNo).toBe(testTrustNo)
      expect(res.body.gosala.visitingHours).toBe(testVisitingHours)

      // Query GET /api/gosalas to verify atomic DB persistence
      const fetchRes = await request(server)
        .get("/api/gosalas")
        .set("Authorization", `Bearer ${opsAdminToken1}`)
      expect(fetchRes.status).toBe(200)
      const g1 = fetchRes.body.gosalas.find((g: any) => g.name === "Gaushala_01")
      expect(g1).toBeDefined()
      expect(g1.capacity).toBe(testCapacity)
      expect(g1.trustRegistrationNo).toBe(testTrustNo)
      expect(g1.visitingHours).toBe(testVisitingHours)
    })

    it("strictly blocks non-super-admins from deleting Gaushalas via DELETE /api/gosalas/:id (HTTP 403)", async () => {
      const resAdmin = await request(server)
        .delete("/api/gosalas/Gaushala_01")
        .set("Authorization", `Bearer ${opsAdminToken1}`)
      expect(resAdmin.status).toBe(403)
      expect(resAdmin.body.error).toMatch(/Only Super Admin Captain can decommission/i)

      const resCust = await request(server)
        .delete("/api/gosalas/Gaushala_01")
        .set("Authorization", `Bearer ${customerToken}`)
      expect(resCust.status).toBe(403)
    })

    it("strictly blocks Customers and Drivers from registering Gaushalas via POST /api/gosalas (HTTP 403)", async () => {
      const resCust = await request(server)
        .post("/api/gosalas")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          name: "Rogue Unauthorized Sanctuary",
          region: "Mumbai Western Suburbs (Borivali / Andheri)",
          address: "Unauthorized Path 123",
        })
      expect(resCust.status).toBe(403)
      expect(resCust.body.error).toMatch(/Only platform administrators/i)

      const resDrv = await request(server)
        .post("/api/gosalas")
        .set("Authorization", `Bearer ${driverToken}`)
        .send({
          name: "Rogue Driver Sanctuary",
          region: "Pune Metropolitan (Shivajinagar / Kothrud)",
          address: "Driver Depot 456",
        })
      expect(resDrv.status).toBe(403)
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

    it("guarantees mathematical precision and zero fractional penny leakage across high-volume seva amounts", async () => {
      // Test 10 distinct amounts and verify commission + gosalaPayable always strictly equals gross - transport
      const testAmounts = [1500, 2750, 3333, 4999, 7500, 10000, 25000, 50000, 75555, 100000]

      for (const amount of testAmounts) {
        const res = await request(server)
          .post("/api/pricing/calculate")
          .set("Authorization", `Bearer ${customerToken}`)
          .send({
            baseRate: amount,
            durationMin: 60,
            distanceKm: 5,
            commissionPct: 20,
            taxPct: 18,
          })

        expect(res.status).toBe(200)
        const d = res.body
        expect(d.commission + d.gosalaPayable).toBe(amount)
        expect(d.total).toBe(Math.round(amount * 1.18))
      }
    })
  })
})
