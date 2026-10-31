import { prisma } from "../prisma.ts"
import { signJwt, verifyJwt, type JwtPayload } from "./jwt.ts"
import { getUserMeta, saveUserMeta, deleteUserMeta } from "../userMeta.ts"
import { getGosalaMeta, saveGosalaMeta } from "../gosalaMeta.ts"
import { getOrCreateWallet } from "../services/walletService.ts"
import { hashPassword, isPasswordHash, verifyPassword } from "./password.ts"
import crypto from "node:crypto"

 
// In-memory sliding-window rate limiter for administrative login (/api/auth/admin-login)
interface RateLimitEntry {
  attempts: number
  firstAttemptAt: number
  blockedUntil?: number
}
const adminRateLimitMap = new Map<string, RateLimitEntry>()

export function checkAdminRateLimit(ipOrKey: string): void {
  const now = Date.now()
  const entry = adminRateLimitMap.get(ipOrKey)
  if (!entry) return

  if (entry.blockedUntil && now < entry.blockedUntil) {
    const remainingSec = Math.ceil((entry.blockedUntil - now) / 1000)
    throw new Error(`Too many administrative attempts. Locked out for ${remainingSec} seconds.`)
  }

  // Reset window after 15 minutes
  if (now - entry.firstAttemptAt > 15 * 60 * 1000) {
    adminRateLimitMap.delete(ipOrKey)
  }
}

export function recordAdminLoginAttempt(ipOrKey: string, success: boolean): void {
  const now = Date.now()
  if (success) {
    adminRateLimitMap.delete(ipOrKey)
    return
  }
  const entry = adminRateLimitMap.get(ipOrKey) || { attempts: 0, firstAttemptAt: now }
  entry.attempts += 1
  if (entry.attempts >= 5) {
    entry.blockedUntil = now + 15 * 60 * 1000 // 15 minute lockout
  }
  adminRateLimitMap.set(ipOrKey, entry)
}

export const inMemoryPasswords = new Map<string, string>()

export interface UserSessionData {
  token: string
  user: {
    id: string
    uniqueId?: string
    name: string
    email: string
    phone: string
    role: "super_admin" | "admin" | "manager" | "customer" | "driver"
    dbRole: "SUPER_ADMIN" | "OPERATIONS_ADMIN" | "GOSALA_MANAGER" | "CUSTOMER" | "DRIVER"
    avatar?: string | null
    gosalas: { id: string; name: string }[]
    assignedGosalaNames: string[]
    originalRole?: "super_admin" | "admin"
    isContextSwitched?: boolean
    driverData?: any
    customerData?: any
    adminData?: any
  }
}

export function generateUniqueId(role: string, phone?: string): string {
  const cleanDigits = (phone || "").replace(/\D/g, "")
  const suffix = cleanDigits.length >= 4 ? cleanDigits.slice(-4) : Math.floor(1000 + Math.random() * 9000).toString()
  const randomPin = Math.floor(1000 + Math.random() * 9000).toString()

  switch (role) {
    case "SUPER_ADMIN":
    case "super_admin":
      return `GMA-SA-${randomPin}`
    case "OPERATIONS_ADMIN":
    case "admin":
      return `GMA-OPS-${suffix}`
    case "GOSALA_MANAGER":
    case "manager":
      return `GMA-MGR-${suffix}`
    case "DRIVER":
    case "driver":
      return `GMA-DRV-${suffix}`
    case "CUSTOMER":
    case "customer":
    default:
      return `GMA-DEV-${suffix}`
  }
}

export async function generateGuaranteedUniqueId(role: string, phone?: string): Promise<string> {
  const base = generateUniqueId(role, phone)
  let candidate = base
  let attempt = 0
  while (attempt < 10) {
    const existing = await prisma.user.findUnique({ where: { uniqueId: candidate } })
    if (!existing) return candidate
    attempt++
    const prefix = base.slice(0, base.lastIndexOf("-") + 1)
    const randomPin = Math.floor(1000 + Math.random() * 9000).toString()
    candidate = `${prefix}${randomPin}`
  }
  return `${base}-${Date.now().toString().slice(-4)}`
}

export interface RegisterUserPayload {
  name: string
  email: string
  phone: string
  role: "super_admin" | "admin" | "manager" | "customer" | "driver"
  password?: string
  customerData?: any
  driverData?: any
  managerData?: any
  adminData?: any
  gosalaId?: string
  gosalaName?: string
  assignedGosalaNames?: string[]
}

function mapDbRoleToFrontend(role: string): "super_admin" | "admin" | "manager" | "customer" | "driver" {
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

function mapFrontendToDbRole(role: string): "SUPER_ADMIN" | "OPERATIONS_ADMIN" | "GOSALA_MANAGER" | "CUSTOMER" | "DRIVER" {
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
 * Extract and verify JWT token from Authorization header
 */
export function getAuthUserFromHeader(authHeader?: string | string[]): JwtPayload | null {
  if (!authHeader) return null
  const headerValue = Array.isArray(authHeader) ? authHeader[0] : authHeader
  if (!headerValue || !headerValue.startsWith("Bearer ")) return null

  const token = headerValue.slice(7).trim()
  const result = verifyJwt(token)
  return result.valid && result.payload ? result.payload : null
}

/**
 * Build rich UserSessionData & issue signed JWT for an authenticated user
 */
export async function buildUserSession(user: any): Promise<UserSessionData> {
  // Resolve assigned Gaushalas strictly verifying active custody
  const assignedGosalas = (user.managerAssignments || [])
    .filter((a: any) => {
      if (!a.gosala) return false
      if (user.role === "GOSALA_MANAGER") {
        const meta = getGosalaMeta(a.gosala.id, a.gosala.name)
        if (meta.isActingManager || meta.actAsManagerMyself) return false
        const gMgrId = meta.managerId || ""
        const gMgrName = (meta.managerName || "").toLowerCase()
        const uCleanId = user.id.startsWith("MGR-") ? user.id.replace(/^MGR-/, "") : user.id
        const uName = (user.name || "").toLowerCase()
        if (gMgrId || (gMgrName && !gMgrName.includes("none"))) {
          const idMatch = Boolean(
            gMgrId &&
              (gMgrId === user.id ||
                gMgrId === user.uniqueId ||
                gMgrId === `MGR-${uCleanId.slice(0, 4)}` ||
                gMgrId === `MGR-${uCleanId.slice(0, 8)}` ||
                gMgrId === uCleanId ||
                user.id.includes(gMgrId) ||
                gMgrId.includes(uCleanId) ||
                user.id.startsWith(gMgrId.replace(/^MGR-/, ""))),
          )
          const nameMatch = Boolean(
            gMgrName &&
              uName &&
              (gMgrName === uName || gMgrName.includes(uName) || uName.includes(gMgrName)),
          )
          return idMatch || nameMatch
        }
      }
      return true
    })
    .map((a: any) => ({
      id: a.gosala.id,
      name: a.gosala.name,
    }))

  // If Operations Admin, link their specific portfolio Gaushalas dynamically
  if (user.role === "OPERATIONS_ADMIN") {
    try {
      const adminEmail = (user.email || "").toLowerCase()
      const adminName = (user.name || "").toLowerCase()
      const allGosalas = await prisma.gosala.findMany({ where: { isActive: true } })
      allGosalas.forEach((g: any) => {
        const meta = getGosalaMeta(g.id, g.name)
        const govEmail = (g.adminEmail || meta.governingAdminEmail || meta.adminEmail || "").toLowerCase()
        const govName = (g.adminName || meta.governingAdminName || meta.adminName || "").toLowerCase()
        const isDirectMatch =
          (g.adminId && g.adminId === user.id) ||
          (govEmail && govEmail === adminEmail) ||
          (govName && govName.includes(adminName))
        if (isDirectMatch) {
          if (!assignedGosalas.some((x: any) => x.id === g.id)) {
            assignedGosalas.push({ id: g.id, name: g.name })
          }
        }
      })
    } catch {}
  }

  const feRole = mapDbRoleToFrontend(user.role)
  const gosalaIds = assignedGosalas.map((g: any) => g.id)
  const gosalaNames = assignedGosalas.map((g: any) => g.name)

  // Retrieve rich metadata from persistent userMeta store
  const userMeta = getUserMeta(user.email || user.id)

  const driverData =
    feRole === "driver"
      ? userMeta.driverData || {
          driverId: user.id.startsWith("DRV-") ? user.id : `DRV-${user.id.slice(0, 4)}`,
          vehicleNumber: "MH-12-Q-4491",
          vehicleType: "Tata 407 (8ft Open Bed)",
          licenseNumber: "DL-142011009823",
          gosalaBase: "Surya",
          status: "Available",
          rating: 4.92,
          totalTrips: 1280,
          phone: user.phone,
        }
      : undefined

  const customerData =
    feRole === "customer"
      ? userMeta.customerData || {
          address: "14 Tulsi Nagar, Kondapur, Hyderabad",
          city: "Hyderabad",
          aadhaarNumber: "XXXX-XXXX-4819",
          memberSince: "Aug 2024",
          totalBookings: 4,
          preferredCeremony: "Griha Pravesh & Kamadhenu Puja",
        }
      : undefined

  const isSuper = feRole === "super_admin"

  const token = signJwt({
    userId: user.id,
    uniqueId: user.uniqueId,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: feRole,
    dbRole: user.role as any,
    gosalaIds,
    gosalaNames,
    adminId: feRole === "admin" ? user.id : undefined,
    originalRole: isSuper ? "super_admin" : undefined,
    isContextSwitched: false,
    driverData,
    customerData,
  })

  return {
    token,
    user: {
      id: user.id,
      uniqueId: user.uniqueId,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: feRole,
      dbRole: user.role as any,
      avatar: user.avatar,
      gosalas: assignedGosalas,
      assignedGosalaNames: gosalaNames,
      originalRole: isSuper ? "super_admin" : undefined,
      isContextSwitched: false,
      driverData,
      customerData,
      adminData: userMeta.adminData,
    },
  }
}

/**
 * Authenticate standard accounts (Customers, Drivers, Gaushala Managers).
 * Administrative accounts (SUPER_ADMIN, OPERATIONS_ADMIN) are strictly rejected
 * and directed to the isolated /admin portal.
 */
export async function authenticateOrResolveUser(
  emailOrPhone: string,
  roleHint?: string,
  password?: string,
): Promise<UserSessionData | null> {
  const query = (emailOrPhone || "").trim().toLowerCase()
  if (!query) throw new Error("Email, phone, or user ID is required")
  const rawDigits = emailOrPhone.replace(/\D/g, "").slice(-10)

  const user: any = await prisma.user.findFirst({
    where: {
      OR: [
        { id: query },
        { uniqueId: { equals: query, mode: "insensitive" } },
        { email: { equals: query, mode: "insensitive" } },
        { phone: { equals: query, mode: "insensitive" } },
        ...(rawDigits.length === 10
          ? [
              { phone: { contains: rawDigits } },
              { phone: { equals: `+91 ${rawDigits}` } },
              { phone: { equals: `+91${rawDigits}` } },
            ]
          : []),
      ],
    },
    include: { managerAssignments: { include: { gosala: true } } },
  })
  if (!user) throw new Error("Invalid credentials or user not found")
  if (user.isActive === false) throw new Error("Account is inactive")

  // ZERO-TRUST ISOLATION: Reject administrative logins on the public portal
  if (user.role === "SUPER_ADMIN" || user.role === "OPERATIONS_ADMIN") {
    throw new Error("Administrative accounts must sign in via the secure /admin portal.")
  }

  // Ensure user has their unique identity code populated
  if (!user.uniqueId) {
    const autoId = generateUniqueId(user.role, user.phone)
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: { uniqueId: autoId },
      })
      user.uniqueId = autoId
    } catch {}
  }

  if (!password) throw new Error("Password is required")
  if (!isPasswordHash(user.password) || !verifyPassword(password, user.password)) {
    throw new Error("Invalid credentials")
  }

  return buildUserSession(user)
}

/**
 * Authenticate administrative accounts exclusively for the isolated /admin portal.
 * Permitted roles: SUPER_ADMIN and OPERATIONS_ADMIN only.
 */
export async function authenticateAdminUser(
  emailOrPhone: string,
  password?: string,
): Promise<UserSessionData> {
  const query = (emailOrPhone || "").trim().toLowerCase()
  if (!query) throw new Error("Administrative email, phone, or ID is required")
  const rawDigits = emailOrPhone.replace(/\D/g, "").slice(-10)

  const user: any = await prisma.user.findFirst({
    where: {
      OR: [
        { id: query },
        { uniqueId: { equals: query, mode: "insensitive" } },
        { email: { equals: query, mode: "insensitive" } },
        { phone: { equals: query, mode: "insensitive" } },
        ...(rawDigits.length === 10
          ? [
              { phone: { contains: rawDigits } },
              { phone: { equals: `+91 ${rawDigits}` } },
              { phone: { equals: `+91${rawDigits}` } },
            ]
          : []),
      ],
    },
    include: { managerAssignments: { include: { gosala: true } } },
  })

  if (!user) throw new Error("Invalid administrative credentials")
  if (user.isActive === false) throw new Error("Account is inactive")

  // STRICT ACCESS CONTROL: Only SUPER_ADMIN and OPERATIONS_ADMIN permitted
  if (user.role !== "SUPER_ADMIN" && user.role !== "OPERATIONS_ADMIN") {
    throw new Error("Access Denied: Administrative credentials required.")
  }

  if (!password) throw new Error("Password is required")
  if (!isPasswordHash(user.password) || !verifyPassword(password, user.password)) {
    throw new Error("Invalid administrative credentials")
  }

  if (!user.uniqueId) {
    const autoId = generateUniqueId(user.role, user.phone)
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: { uniqueId: autoId },
      })
      user.uniqueId = autoId
    } catch {}
  }

  return buildUserSession(user)
}

/**
 * Register a new devotee user in PostgreSQL and issue verified JWT.
 * DEFENSE-IN-DEPTH: Public registration is strictly locked down to CUSTOMER role only.
 */
export async function registerUser(payload: RegisterUserPayload): Promise<UserSessionData> {
  const emailNorm = payload.email.trim().toLowerCase()
  const rawDigits = (payload.phone || "").replace(/\D/g, "").slice(-10)
  const hasValidPhone = rawDigits.length === 10
  // Generate random 10-digit number starting with 98 if no valid phone provided to avoid duplicate key or fallback collision
  const phoneFormatted = hasValidPhone ? `+91 ${rawDigits}` : `+91 98${Math.floor(10000000 + Math.random() * 90000000)}`

  if (!payload.name || !payload.email) {
    throw new Error("Full name and email address are required for registration")
  }

  // Check if user already exists
  const phoneQuery = hasValidPhone
    ? [
        { phone: { equals: `+91 ${rawDigits}` } },
        { phone: { equals: `+91${rawDigits}` } },
        { phone: { contains: rawDigits } },
      ]
    : []

  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { equals: emailNorm, mode: "insensitive" } },
        ...phoneQuery,
      ],
    },
  })

  if (existing) {
    const isEmailMatch = existing.email.toLowerCase() === emailNorm
    const exDigits = (existing.phone || "").replace(/\D/g, "").slice(-10)
    const isPhoneMatch = hasValidPhone && exDigits === rawDigits

    if (isEmailMatch && isPhoneMatch) {
      throw new Error(`An account with email "${emailNorm}" is already registered. Please sign in or use "Forgot Password".`)
    } else if (isEmailMatch) {
      throw new Error(`An account with email "${emailNorm}" is already registered. Please sign in with your password or use "Forgot Password" to reset it.`)
    } else if (isPhoneMatch) {
      throw new Error(`The mobile number "${payload.phone.trim()}" is already registered with another account. Please use a different phone number or sign in with your registered email.`)
    } else {
      throw new Error(`An account with matching credentials is already registered. Please sign in instead.`)
    }
  }

  // DEFENSE-IN-DEPTH: Public registration unconditionally creates CUSTOMER accounts.
  // Any role passed from the client is safely ignored to prevent privilege escalation.
  const dbRole = "CUSTOMER"
  const feRole = "customer"

  if (!payload.password || payload.password.length < 8) {
    throw new Error("Password must be at least 8 characters")
  }
  const passwordHash = hashPassword(payload.password)

  const uniqueId = generateUniqueId("CUSTOMER", phoneFormatted)

  // Create new user in PostgreSQL
  const user = await prisma.user.create({
    data: {
      uniqueId,
      name: payload.name.trim(),
      email: emailNorm,
      phone: phoneFormatted,
      role: dbRole as any,
      password: passwordHash,
      isActive: true,
    },
  })

  // Save devotee rich metadata to persistent store
  const metaPatch: any = {
    customerData: {
      ...(payload.customerData || {}),
      memberSince: new Date().toLocaleDateString("en-IN", { month: "short", year: "numeric" }),
      totalBookings: 0,
    },
  }

  saveUserMeta(user.email, metaPatch)
  saveUserMeta(user.id, metaPatch)

  const token = signJwt({
    userId: user.id,
    uniqueId: user.uniqueId || uniqueId,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: feRole,
    dbRole: user.role as any,
    gosalaIds: [],
    gosalaNames: [],
    customerData: metaPatch.customerData,
  })

  return {
    token,
    user: {
      id: user.id,
      uniqueId: user.uniqueId || uniqueId,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: feRole,
      dbRole: user.role as any,
      avatar: user.avatar,
      gosalas: [],
      assignedGosalaNames: [],
      customerData: metaPatch.customerData,
    },
  }
}

/**
 * Super Admin user creation endpoint: Authorize devotees, transit pilots, managers, or operations admins.
 * Fully provisions roles, unique identifiers, and Gaushala manager assignments.
 */
export async function adminCreateUser(
  payload: RegisterUserPayload,
  adminUser?: any,
): Promise<UserSessionData> {
  const emailNorm = (payload.email || "").trim().toLowerCase()
  const rawDigits = (payload.phone || "").replace(/\D/g, "").slice(-10)
  const hasValidPhone = rawDigits.length === 10
  const phoneFormatted = hasValidPhone
    ? `+91 ${rawDigits}`
    : `+91 98${Math.floor(10000000 + Math.random() * 90000000)}`

  if (!payload.name || !payload.email) {
    throw new Error("Full name and email address are required for user creation")
  }

  const role = payload.role || "customer"
  const dbRole = mapFrontendToDbRole(role)
  const feRole = mapDbRoleToFrontend(dbRole)

  const passwordRaw = payload.password && payload.password.length >= 6
    ? payload.password
    : "Manager@Gomaa2026!"
  const passwordHash = hashPassword(passwordRaw)

  // Check if user already exists
  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { equals: emailNorm, mode: "insensitive" } },
        ...(hasValidPhone ? [{ phone: { contains: rawDigits } }] : []),
      ],
    },
  })

  let user: any

  if (existing) {
    user = await prisma.user.update({
      where: { id: existing.id },
      data: {
        name: payload.name.trim(),
        phone: phoneFormatted,
        role: dbRole as any,
        password: passwordHash,
        isActive: true,
      },
    })
  } else {
    const uniqueId = await generateGuaranteedUniqueId(dbRole, phoneFormatted)
    user = await prisma.user.create({
      data: {
        uniqueId,
        name: payload.name.trim(),
        email: emailNorm,
        phone: phoneFormatted,
        role: dbRole as any,
        password: passwordHash,
        isActive: true,
      },
    })
  }

  // Persist password in memory & metadata
  saveUserMeta(user.email, { password: passwordRaw })
  saveUserMeta(user.id, { password: passwordRaw })
  inMemoryPasswords.set(user.email.toLowerCase(), passwordRaw)
  inMemoryPasswords.set(user.id, passwordRaw)

  // Ensure wallet exists
  try {
    await getOrCreateWallet(user.id)
  } catch {}

  // Handle Role-Specific Assignments & Metadata
  if (dbRole === "GOSALA_MANAGER") {
    const rawGosalas: string[] =
      Array.isArray(payload.assignedGosalaNames) && payload.assignedGosalaNames.length > 0
        ? payload.assignedGosalaNames
        : payload.gosalaName
        ? [payload.gosalaName]
        : payload.gosalaId
        ? [payload.gosalaId]
        : []

    for (const gNameOrId of rawGosalas) {
      if (!gNameOrId || gNameOrId === "Unassigned") continue
      const targetGosala = await prisma.gosala.findFirst({
        where: {
          OR: [{ id: gNameOrId }, { name: gNameOrId }],
        },
      })
      if (targetGosala) {
        // Relieve any prior managers for this Gaushala to enforce 1:1 invariant
        await prisma.gosalaManagerAssignment.deleteMany({
          where: {
            gosalaId: targetGosala.id,
            NOT: { userId: user.id },
          },
        })
        await prisma.gosalaManagerAssignment.upsert({
          where: {
            userId_gosalaId: {
              userId: user.id,
              gosalaId: targetGosala.id,
            },
          },
          create: {
            userId: user.id,
            gosalaId: targetGosala.id,
            region: targetGosala.region,
            status: "Active",
          },
          update: {
            status: "Active",
          },
        })

        const canonicalMgrId = user.uniqueId || `MGR-${user.id.slice(0, 8)}`
        saveGosalaMeta(targetGosala.id, targetGosala.name, {
          managerId: canonicalMgrId,
          managerName: user.name,
          caretaker: user.name,
          isActingManager: false,
          actAsManagerMyself: false,
        })
      }
    }

    const canonicalMgrId = user.uniqueId || `MGR-${user.id.slice(0, 8)}`
    const metaPatch: any = {
      managerData: {
        ...(payload.managerData || {}),
        managerId: canonicalMgrId,
        assignedDate: new Date().toISOString(),
      },
    }
    saveUserMeta(user.email, metaPatch)
    saveUserMeta(user.id, metaPatch)
  } else if (dbRole === "DRIVER") {
    const metaPatch: any = {
      driverData: {
        ...(payload.driverData || {}),
        status: "Active",
        joinedDate: new Date().toISOString(),
      },
    }
    saveUserMeta(user.email, metaPatch)
    saveUserMeta(user.id, metaPatch)
  } else if (dbRole === "CUSTOMER") {
    const metaPatch: any = {
      customerData: {
        ...(payload.customerData || {}),
        memberSince: new Date().toLocaleDateString("en-IN", { month: "short", year: "numeric" }),
        totalBookings: 0,
      },
    }
    saveUserMeta(user.email, metaPatch)
    saveUserMeta(user.id, metaPatch)
  }

  const updatedUser = await prisma.user.findUnique({
    where: { id: user.id },
    include: {
      managerAssignments: {
        include: {
          gosala: {
            include: { animals: true },
          },
        },
      },
    },
  })

  return buildUserSession(updatedUser || user)
}

/**
 * Return all registered managers and admins for dynamic switcher / multi-account selection
 */
export async function getDirectoryAccounts() {
  try {
    const [users, allGosalas] = await Promise.all([
      prisma.user.findMany({
        where: { isActive: true },
        include: {
          managerAssignments: {
            include: { gosala: true },
          },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.gosala.findMany({ where: { isActive: true } }).catch(() => []),
    ])

    if (users && users.length > 0) {
      return users.map((u: any) => {
        let assignedGosalas = (u.managerAssignments || []).map((a: any) => ({
          id: a.gosala.id,
          name: a.gosala.name,
        }))

        if (u.role === "OPERATIONS_ADMIN" || u.role === "SUPER_ADMIN") {
          const userEmail = (u.email || "").toLowerCase().trim()
          allGosalas.forEach((g: any) => {
            const meta = (g.metadata && typeof g.metadata === "object") ? (g.metadata as any) : getGosalaMeta(g.id, g.name)
            const govEmail = (g.adminEmail || meta.governingAdminEmail || meta.adminEmail || "").toLowerCase().trim()
            const isMatch = (g.adminId && g.adminId === u.id) || (userEmail && govEmail === userEmail)
            if (isMatch && !assignedGosalas.some((x: any) => x.id === g.id)) {
              assignedGosalas.push({ id: g.id, name: g.name })
            }
          })
        }

        const meta = getUserMeta(u.email || u.id)
        const isSuper = u.role === "SUPER_ADMIN"
        return {
          id: u.id,
          uniqueId: u.uniqueId,
          name: u.name,
          email: u.email,
          phone: u.phone,
          role: mapDbRoleToFrontend(u.role),
          dbRole: u.role,
          assignedGosalaNames: isSuper ? ["All Network Gaushalas"] : assignedGosalas.map((g: any) => g.name),
          primaryGosala: isSuper
            ? "Platform Governance"
            : assignedGosalas[0]?.name || meta.driverData?.gosalaBase || "General Roster",
          driverData: meta.driverData,
          customerData: meta.customerData,
        }
      })
    }
    return []
  } catch (err) {
    console.warn("[getDirectoryAccounts] DB query failed:", err)
    return []
  }
}

/**
 * Return all users with complete details for Admin User Management
 */
export async function getAllUsers() {
  try {
    const [users, allGosalas] = await Promise.all([
      prisma.user.findMany({
        include: {
          managerAssignments: {
            include: { gosala: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.gosala.findMany({ where: { isActive: true } }).catch(() => []),
    ])

    if (users && users.length > 0) {
      return users.map((u: any) => {
        let assignedGosalas = (u.managerAssignments || []).map((a: any) => ({
          id: a.gosala.id,
          name: a.gosala.name,
        }))
        if (u.role === "OPERATIONS_ADMIN" || u.role === "SUPER_ADMIN") {
          const userEmail = (u.email || "").toLowerCase().trim()
          allGosalas.forEach((g: any) => {
            const meta = (g.metadata && typeof g.metadata === "object") ? (g.metadata as any) : getGosalaMeta(g.id, g.name)
            const govEmail = (g.adminEmail || meta.governingAdminEmail || meta.adminEmail || "").toLowerCase().trim()
            const isMatch = (g.adminId && g.adminId === u.id) || (userEmail && govEmail === userEmail)
            if (isMatch && !assignedGosalas.some((x: any) => x.id === g.id)) {
              assignedGosalas.push({ id: g.id, name: g.name })
            }
          })
        }
        const meta = getUserMeta(u.email || u.id)
        return {
          id: u.id,
          uniqueId: u.uniqueId,
          name: u.name,
          email: u.email,
          phone: u.phone,
          role: mapDbRoleToFrontend(u.role),
          dbRole: u.role,
          isActive: u.isActive,
          avatar: u.avatar,
          createdAt: u.createdAt,
          assignedGosalaNames: assignedGosalas.map((g: any) => g.name),
          driverData: meta.driverData,
          customerData: meta.customerData,
        }
      })
    }
    return []
  } catch (err) {
    console.warn("[getAllUsers] DB query failed:", err)
    return []
  }
}

/**
 * Update an existing user in PostgreSQL
 */
export async function updateUser(id: string, updates: Partial<RegisterUserPayload> & { isActive?: boolean }) {
  const data: any = {}
  if (updates.name) data.name = updates.name.trim()
  if (updates.phone) data.phone = updates.phone.trim()
  if (updates.role) data.role = mapFrontendToDbRole(updates.role) as any
  if (updates.isActive !== undefined) data.isActive = updates.isActive
  if (updates.password) {
    data.password = hashPassword(updates.password)
  }

  const updated = await prisma.user.update({
    where: { id },
    data,
    include: { managerAssignments: { include: { gosala: true } } },
  })

  // Update metadata
  const metaPatch: any = {}
  if (updates.customerData) metaPatch.customerData = updates.customerData
  if (updates.driverData) metaPatch.driverData = updates.driverData
  if (updates.managerData) metaPatch.managerData = updates.managerData
  if (Object.keys(metaPatch).length > 0) {
    saveUserMeta(updated.email, metaPatch)
    saveUserMeta(updated.id, metaPatch)
  }

  const { password: _password, ...safeUpdated } = updated as any
  return safeUpdated
}

/**
 * Delete a user from PostgreSQL (idempotent & supports ID, uniqueId, or email)
 */
export async function deleteUser(id: string) {
  if (!id) return null
  const cleanId = id.startsWith("MGR-") ? id.replace(/^MGR-/, "") : id

  // 1. Locate user by any valid identifier
  const u = await prisma.user.findFirst({
    where: {
      OR: [
        { id },
        { id: cleanId },
        { uniqueId: id },
        { email: { equals: id, mode: "insensitive" } },
        { name: { equals: id, mode: "insensitive" } },
      ],
    },
  })

  if (u) {
    deleteUserMeta(u.email)
    deleteUserMeta(u.id)

    // Clean up manager assignments before deleting
    await prisma.gosalaManagerAssignment.deleteMany({
      where: { userId: u.id },
    }).catch(() => {})

    try {
      await prisma.user.delete({ where: { id: u.id } })
    } catch (err: any) {
      console.warn("[deleteUser] prisma delete notice:", err?.message)
    }
    return { id: u.id, email: u.email, deleted: true }
  }

  // Idempotent: If user already does not exist in DB, treat as successful removal
  deleteUserMeta(id)
  return { id, deleted: true }
}

/**
 * Cryptographically switch execution context exclusively for Super Admin accounts.
 * Allows toggling between Sovereign Platform Captain ("super_admin") and Scoped Operations Admin ("admin").
 * Strictly enforces that only users whose PostgreSQL database role is SUPER_ADMIN can switch contexts.
 */
export async function switchUserContext(
  caller: JwtPayload,
  targetRole: "super_admin" | "admin"
): Promise<UserSessionData> {
  if (!caller || !caller.userId) {
    const err: any = new Error("Unauthenticated: Valid session token is required to switch context")
    err.status = 401
    throw err
  }

  if (targetRole !== "super_admin" && targetRole !== "admin") {
    const err: any = new Error("Invalid target role. Context switching is strictly limited to 'super_admin' or 'admin'")
    err.status = 400
    throw err
  }

  // 1. Verify caller in PostgreSQL database - never trust client payload alone
  const dbUser = await prisma.user.findUnique({
    where: { id: caller.userId },
    include: { managerAssignments: { include: { gosala: true } } },
  })

  if (!dbUser || dbUser.isActive === false) {
    const err: any = new Error("Account not found or inactive")
    err.status = 401
    throw err
  }

  // 2. Ironclad Security Rule: ONLY genuine Super Admin accounts can switch execution context
  if (dbUser.role !== "SUPER_ADMIN") {
    console.warn(`[SECURITY ALERT] Unauthorized context switch attempt by non-super-admin user ${dbUser.email} (DB Role: ${dbUser.role})`)
    const err: any = new Error("Forbidden: Only genuine Super Admin accounts can switch execution context")
    err.status = 403
    throw err
  }

  const userMeta = getUserMeta(dbUser.email || dbUser.id)

  if (targetRole === "admin") {
    // Switching down to Operations Admin ("Operations" mode)
    // Dynamic portfolio discovery: locate strictly Gaushalas created or governed by this Super Admin
    const adminEmail = (dbUser.email || "").toLowerCase().trim()
    const allGosalas = await prisma.gosala.findMany({ where: { isActive: true } })
    const personalGosalas: { id: string; name: string }[] = []

    allGosalas.forEach((g: any) => {
      const meta = (g.metadata && typeof g.metadata === "object") ? (g.metadata as any) : getGosalaMeta(g.id, g.name)
      const govEmail = (g.adminEmail || meta.governingAdminEmail || "").toLowerCase().trim()
      const adminIdMatch = Boolean((meta.adminId && meta.adminId === dbUser.id) || (g.adminId && g.adminId === dbUser.id))
      if ((govEmail && govEmail === adminEmail) || adminIdMatch) {
        personalGosalas.push({ id: g.id, name: g.name })
      }
    })

    // Strict multi-tenant isolation: Super Admin in stepped-down Operations mode only sees their own assigned Gaushalas.
    // Under NO circumstances do other Operations Admins' Gaushalas leak into this portfolio.
    const gosalaIds = personalGosalas.map((g) => g.id)
    const gosalaNames = personalGosalas.map((g) => g.name)
    const uniqueId = dbUser.uniqueId || generateUniqueId(dbUser.role, dbUser.phone)

    const token = signJwt({
      userId: dbUser.id,
      uniqueId,
      name: dbUser.name,
      email: dbUser.email,
      phone: dbUser.phone,
      role: "admin",
      dbRole: "OPERATIONS_ADMIN",
      gosalaIds,
      gosalaNames,
      adminId: dbUser.id,
      originalRole: "super_admin",
      isContextSwitched: true,
      contextSwitchedAt: Math.floor(Date.now() / 1000),
      driverData: caller.driverData,
      customerData: caller.customerData,
    })

    return {
      token,
      user: {
        id: dbUser.id,
        uniqueId,
        name: dbUser.name,
        email: dbUser.email,
        phone: dbUser.phone,
        role: "admin",
        dbRole: "OPERATIONS_ADMIN",
        avatar: dbUser.avatar,
        gosalas: personalGosalas,
        assignedGosalaNames: gosalaNames,
        originalRole: "super_admin",
        isContextSwitched: true,
        driverData: caller.driverData,
        customerData: caller.customerData,
        adminData: userMeta.adminData,
      },
    }
  } else {
    // Returning to Super Admin ("Captain" mode)
    // Global Platform oversight across all Gaushalas
    const uniqueId = dbUser.uniqueId || generateUniqueId(dbUser.role, dbUser.phone)
    const token = signJwt({
      userId: dbUser.id,
      uniqueId,
      name: dbUser.name,
      email: dbUser.email,
      phone: dbUser.phone,
      role: "super_admin",
      dbRole: "SUPER_ADMIN",
      gosalaIds: [],
      gosalaNames: ["All Network Gaushalas"],
      originalRole: "super_admin",
      isContextSwitched: false,
      contextSwitchedAt: Math.floor(Date.now() / 1000),
      driverData: caller.driverData,
      customerData: caller.customerData,
    })

    return {
      token,
      user: {
        id: dbUser.id,
        uniqueId,
        name: dbUser.name,
        email: dbUser.email,
        phone: dbUser.phone,
        role: "super_admin",
        dbRole: "SUPER_ADMIN",
        avatar: dbUser.avatar,
        gosalas: [],
        assignedGosalaNames: ["All Network Gaushalas"],
        originalRole: "super_admin",
        isContextSwitched: false,
        driverData: caller.driverData,
        customerData: caller.customerData,
        adminData: userMeta.adminData,
      },
    }
  }
}

