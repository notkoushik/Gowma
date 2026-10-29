import { prisma } from "../server/prisma.ts"
import { handleApiRequest } from "../server/router.ts"
import { signJwt, verifyJwt, JWT_SECRET } from "../server/auth/jwt.ts"
import { hashPassword, verifyPassword } from "../server/auth/password.ts"
import { getGosalaMeta, saveGosalaMeta, deleteGosalaMeta } from "../server/gosalaMeta.ts"
import crypto from "node:crypto"

/**
 * Modernized GOMAA Dynamic Test Harness
 * Completely eliminates hardcoded users, static credentials, and phantom entities.
 * Interacts directly with PostgreSQL to discover or provision live test fixtures.
 */
export class TestHarness {
  constructor(suiteName = "Test Suite") {
    this.suiteName = suiteName
    this.testRunId = crypto.randomBytes(4).toString("hex")
    this.createdUserIds = new Set()
    this.createdGosalaIds = new Set()
    this.createdAnimalIds = new Set()
    this.createdHoldIds = new Set()
    this.createdBookingIds = new Set()
    this.originalPasswordHashes = new Map()
    this.passed = 0
    this.failed = 0
  }

  assert(condition, name, details = "") {
    if (condition) {
      this.passed++
      console.log(`  ✓ PASS: ${name} ${details ? `(${details})` : ""}`)
    } else {
      this.failed++
      console.error(`  ✗ FAIL: ${name} ${details ? `(${details})` : ""}`)
    }
  }

  mapDbRoleToFrontend(role) {
    switch (role) {
      case "SUPER_ADMIN":
        return "super_admin"
      case "OPERATIONS_ADMIN":
        return "admin"
      case "GOSALA_MANAGER":
        return "manager"
      case "DRIVER":
        return "driver"
      case "CUSTOMER":
      default:
        return "customer"
    }
  }

  mapFrontendToDbRole(role) {
    switch (role) {
      case "super_admin":
        return "SUPER_ADMIN"
      case "admin":
        return "OPERATIONS_ADMIN"
      case "manager":
        return "GOSALA_MANAGER"
      case "driver":
        return "DRIVER"
      case "customer":
      default:
        return "CUSTOMER"
    }
  }

  /**
   * Discovers an existing active user from PostgreSQL by role,
   * or dynamically provisions one if none exists in the database.
   */
  async resolveOrCreateUser(roleOrDbRole, overrides = {}) {
    const dbRole =
      roleOrDbRole.includes("_") && roleOrDbRole === roleOrDbRole.toUpperCase()
        ? roleOrDbRole
        : this.mapFrontendToDbRole(roleOrDbRole)

    let user = await prisma.user.findFirst({
      where: { role: dbRole, isActive: true },
      include: { managerAssignments: { include: { gosala: true } } },
      orderBy: { createdAt: "asc" },
    })

    if (!user) {
      const email = `test.${dbRole.toLowerCase()}.${this.testRunId}@gomaa.test`
      const rawPassword = `TestPass_${crypto.randomBytes(6).toString("hex")}!`
      user = await prisma.user.create({
        data: {
          name: `Test ${dbRole} ${this.testRunId}`,
          email,
          phone: `+91 98${Math.floor(10000000 + Math.random() * 90000000)}`,
          role: dbRole,
          password: hashPassword(rawPassword),
          isActive: true,
          ...overrides,
        },
        include: { managerAssignments: { include: { gosala: true } } },
      })
      user._temporaryPassword = rawPassword
      this.createdUserIds.add(user.id)
    }

    return user
  }

  /**
   * Resolves two distinct users of the same role (critical for cross-tenant isolation testing)
   */
  async resolveTwoDistinctUsers(roleOrDbRole) {
    const dbRole = this.mapFrontendToDbRole(roleOrDbRole)
    const existing = await prisma.user.findMany({
      where: { role: dbRole, isActive: true },
      include: { managerAssignments: { include: { gosala: true } } },
      take: 2,
    })

    const userA = existing[0] || (await this.provisionEphemeralUser(dbRole))
    let userB = existing[1]
    if (!userB || userB.id === userA.id) {
      userB = await this.provisionEphemeralUser(dbRole, {
        name: `Tenant B ${this.testRunId}`,
      })
    }

    return [userA, userB]
  }

  /**
   * Provisions an ephemeral test user guaranteed to be unique and tracks for cleanup
   */
  async provisionEphemeralUser(roleOrDbRole, overrides = {}) {
    const dbRole = this.mapFrontendToDbRole(roleOrDbRole)
    const email = `ephemeral.${dbRole.toLowerCase()}.${crypto.randomBytes(6).toString("hex")}@gomaa.test`
    const rawPassword = `EphemeralPass_${crypto.randomBytes(6).toString("hex")}!`

    const user = await prisma.user.create({
      data: {
        name: overrides.name || `Ephemeral ${dbRole}`,
        email,
        phone:
          overrides.phone ||
          `+91 97${Math.floor(10000000 + Math.random() * 90000000)}`,
        role: dbRole,
        password: hashPassword(rawPassword),
        isActive: true,
        ...overrides,
      },
      include: { managerAssignments: { include: { gosala: true } } },
    })

    user._temporaryPassword = rawPassword
    this.createdUserIds.add(user.id)
    return user
  }

  /**
   * Issue a signed, verified JWT token directly for a database user entity
   */
  issueTokenForUser(user, tokenOverrides = {}) {
    const feRole = this.mapDbRoleToFrontend(user.role)
    const isSuper = user.role === "SUPER_ADMIN"
    const assigned = (user.managerAssignments || []).map((a) => ({
      id: a.gosala.id,
      name: a.gosala.name,
    }))

    const token = signJwt({
      userId: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: feRole,
      dbRole: user.role,
      gosalaIds: assigned.map((g) => g.id),
      gosalaNames: isSuper
        ? ["All Network Gaushalas"]
        : assigned.map((g) => g.name),
      adminId: feRole === "admin" ? user.id : undefined,
      originalRole: isSuper ? "super_admin" : undefined,
      isContextSwitched: false,
      ...tokenOverrides,
    })

    return {
      token,
      headers: { authorization: `Bearer ${token}` },
      user,
    }
  }

  /**
   * Authenticate a user via the live HTTP login endpoint using a dynamically set test password
   */
  /**
   * Authenticate a user via the live HTTP login endpoint using a dynamically set test password
   */
  async loginWithDynamicPassword(user) {
    if (user.password && !this.originalPasswordHashes.has(user.id)) {
      this.originalPasswordHashes.set(user.id, user.password)
    }

    const testPassword = `DynLoginPass_${crypto.randomBytes(6).toString("hex")}!`
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashPassword(testPassword) },
    })

    const endpoint =
      user.role === "SUPER_ADMIN" || user.role === "OPERATIONS_ADMIN"
        ? "/api/auth/admin-login"
        : "/api/auth/login"

    const loginRes = await handleApiRequest(
      "POST",
      endpoint,
      JSON.stringify({ emailOrPhone: user.email, password: testPassword })
    )

    if (loginRes?.status !== 200 || !loginRes?.body?.token) {
      throw new Error(
        `Dynamic login failed for ${user.email}: ${JSON.stringify(loginRes?.body)}`
      )
    }

    return {
      token: loginRes.body.token,
      headers: { authorization: `Bearer ${loginRes.body.token}` },
      user: loginRes.body.user,
    }
  }

  /**
   * Create a dynamic Gaushala in PostgreSQL, linked to an admin, and track for teardown
   */
  async createDynamicGaushala(adminUser, overrides = {}) {
    const name =
      overrides.name || `Dynamic Sanctuary ${this.testRunId} ${Date.now()}`
    const region = overrides.region || "Central Hub"
    const address =
      overrides.address ||
      `Survey ${Math.floor(100 + Math.random() * 900)}, Divine Valley`

    const gosala = await prisma.gosala.create({
      data: {
        name,
        region,
        address,
        contactPhone: overrides.contactPhone || "+91 98000 00000",
        contactEmail: adminUser.email || "trust@gomaa.in",
        latitude: overrides.latitude || 17.385,
        longitude: overrides.longitude || 78.486,
        isActive: true,
      },
    })

    saveGosalaMeta(gosala.id, gosala.name, {
      governingAdminEmail: adminUser.email,
      governingAdminName: adminUser.name,
      adminId: adminUser.id,
      adminName: adminUser.name,
      governingAdminRole: this.mapDbRoleToFrontend(adminUser.role),
      ...overrides.meta,
    })

    this.createdGosalaIds.add(gosala.id)
    return { ...gosala, ...getGosalaMeta(gosala.id, gosala.name) }
  }

  /**
   * Create a dynamic Animal in PostgreSQL and track for teardown
   */
  async createDynamicAnimal(gosalaId, overrides = {}) {
    const animal = await prisma.animal.create({
      data: {
        gosalaId,
        name: overrides.name || `Dynamic Sacred Cow ${this.testRunId} ${Date.now()}`,
        type: overrides.type || "COW",
        breed: overrides.breed || "Gir",
        ageYears: overrides.ageYears || 4,
        healthStatus: overrides.healthStatus || "HEALTHY",
        price: overrides.price || 3500,
        isActive: true,
        ...overrides,
      },
      include: { gosala: true },
    })
    this.createdAnimalIds.add(animal.id)
    return animal
  }

  /**
   * Retrieve any active Gaushala from PostgreSQL
   */
  async getAnyActiveGaushala() {
    return prisma.gosala.findFirst({
      where: { isActive: true },
      include: { animals: true },
    })
  }

  /**
   * Retrieve any available Sacred Animal from PostgreSQL
   */
  async getAnyAvailableAnimal() {
    return prisma.animal.findFirst({
      where: { isActive: true },
      include: { gosala: true },
    })
  }

  /**
   * Teardown: Safely cleans up all test-created entities and restores user passwords
   */
  async teardown() {
    console.log(`\n[TEARDOWN] Cleaning up test run fixtures (${this.testRunId})...`)

    // Restore any modified passwords for pre-existing users
    for (const [uid, originalHash] of this.originalPasswordHashes) {
      if (!this.createdUserIds.has(uid)) {
        try {
          await prisma.user.update({
            where: { id: uid },
            data: { password: originalHash },
          })
        } catch (err) {
          console.warn(`[Teardown] Could not restore password for User ${uid}:`, err.message)
        }
      }
    }

    // Clean up created animals
    for (const aid of this.createdAnimalIds) {
      try {
        await prisma.temporarySlotHold.deleteMany({ where: { animalId: aid } })
        await prisma.animal.delete({ where: { id: aid } })
      } catch (err) {
        console.warn(`[Teardown] Could not delete Animal ${aid}:`, err.message)
      }
    }

    // Clean up created Gaushalas & their metadata
    for (const gid of this.createdGosalaIds) {
      try {
        const g = await prisma.gosala.findUnique({ where: { id: gid } })
        if (g) {
          deleteGosalaMeta(g.id, g.name)
          await prisma.temporarySlotHold.deleteMany({
            where: { animal: { gosalaId: gid } },
          })
          await prisma.animal.deleteMany({ where: { gosalaId: gid } })
          await prisma.gosalaManagerAssignment.deleteMany({
            where: { gosalaId: gid },
          })
          await prisma.gosala.delete({ where: { id: gid } })
        }
      } catch (err) {
        console.warn(`[Teardown] Could not delete Gaushala ${gid}:`, err.message)
      }
    }

    // Clean up created ephemeral users
    for (const uid of this.createdUserIds) {
      try {
        await prisma.gosalaManagerAssignment.deleteMany({ where: { userId: uid } })
        await prisma.user.delete({ where: { id: uid } })
      } catch (err) {
        console.warn(`[Teardown] Could not delete User ${uid}:`, err.message)
      }
    }

    console.log(`[TEARDOWN] Cleanup complete for run ${this.testRunId}.`)
  }
}
