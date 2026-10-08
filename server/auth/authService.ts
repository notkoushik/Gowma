import { prisma } from "../prisma.ts"
import { signJwt, verifyJwt, type JwtPayload } from "./jwt.ts"
import { getUserMeta, saveUserMeta, deleteUserMeta } from "../userMeta.ts"
import { getGosalaMeta } from "../gosalaMeta.ts"

export interface UserSessionData {
  token: string
  user: {
    id: string
    name: string
    email: string
    phone: string
    role: "super_admin" | "admin" | "manager" | "customer" | "driver"
    dbRole: "SUPER_ADMIN" | "OPERATIONS_ADMIN" | "GOSALA_MANAGER" | "CUSTOMER" | "DRIVER"
    avatar?: string | null
    gosalas: { id: string; name: string }[]
    assignedGosalaNames: string[]
    driverData?: any
    customerData?: any
    adminData?: any
  }
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
 * Authenticate or switch to a user account and issue a verified JWT
 */
export async function authenticateOrResolveUser(
  emailOrPhone: string,
  roleHint?: string,
  password?: string,
): Promise<UserSessionData | null> {
  const query = (emailOrPhone || "").trim().toLowerCase()

  const isSuperAdminTarget =
    query === "koushik@gmail.com" ||
    (roleHint === "super_admin" && (query === "" || query === "koushik@gmail.com"))

  let user: any = null

  if (isSuperAdminTarget) {
    if (password && password !== "Koushik.git") {
      throw new Error("Invalid password for Super Admin account")
    }

    user = await prisma.user.findFirst({
      where: {
        OR: [
          { id: "USER-SA-KOUSHIK" },
          { email: { equals: "koushik@gmail.com", mode: "insensitive" } },
        ],
      },
      include: {
        managerAssignments: {
          include: { gosala: true },
        },
      },
    })

    if (!user) {
      user = await prisma.user.upsert({
        where: { email: "koushik@gmail.com" },
        create: {
          id: "USER-SA-KOUSHIK",
          email: "koushik@gmail.com",
          name: "Koushik",
          phone: "+91 98000 00000",
          role: "SUPER_ADMIN",
          isActive: true,
        },
        update: {
          role: "SUPER_ADMIN",
          isActive: true,
        },
        include: {
          managerAssignments: {
            include: { gosala: true },
          },
        },
      })
    }
  } else {
    // Standard role lookup (Gosala Manager, Operations Admin, Driver, Devotee Customer)
    user = await prisma.user.findFirst({
      where: {
        OR: [
          { id: query },
          { email: { equals: query, mode: "insensitive" } },
          { phone: { equals: query, mode: "insensitive" } },
        ],
      },
      include: {
        managerAssignments: {
          include: { gosala: true },
        },
      },
    })

    if (!user) return null

    // Validate password for accounts if configured
    if (user.role === "SUPER_ADMIN") {
      if (password && password !== "Koushik.git") {
        throw new Error("Invalid password for Super Admin account")
      }
    } else {
      const meta = getUserMeta(user.email || user.id)
      if (meta.password && password && meta.password !== password) {
        throw new Error("Invalid credentials")
      }
    }
  }

  if (!user) return null

  // Resolve assigned Gaushalas
  const assignedGosalas = (user.managerAssignments || []).map((a: any) => ({
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
        const govEmail = (meta.governingAdminEmail || "").toLowerCase()
        const govName = (meta.governingAdminName || meta.adminName || "").toLowerCase()
        if ((govEmail && govEmail === adminEmail) || (govName && govName.includes(adminName))) {
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

  const token = signJwt({
    userId: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: feRole,
    dbRole: user.role as any,
    gosalaIds,
    gosalaNames,
    adminId: feRole === "admin" ? user.id : undefined,
    driverData,
    customerData,
  })

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: feRole,
      dbRole: user.role as any,
      avatar: user.avatar,
      gosalas: assignedGosalas,
      assignedGosalaNames: gosalaNames,
      driverData,
      customerData,
      adminData: userMeta.adminData,
    },
  }
}

/**
 * Register a new user in PostgreSQL and issue verified JWT
 */
export async function registerUser(payload: RegisterUserPayload): Promise<UserSessionData> {
  const emailNorm = payload.email.trim().toLowerCase()
  const phoneNorm = payload.phone.trim()

  if (!payload.name || !payload.email || !payload.role) {
    throw new Error("Full name, email address, and role are required for registration")
  }

  // Check if user already exists
  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { equals: emailNorm, mode: "insensitive" } },
        { phone: { equals: phoneNorm, mode: "insensitive" } },
      ],
    },
  })

  if (existing) {
    throw new Error(`An account with email "${emailNorm}" or phone "${phoneNorm}" is already registered. Please sign in instead.`)
  }

  const dbRole = mapFrontendToDbRole(payload.role)

  // Create new user in PostgreSQL
  const user = await prisma.user.create({
    data: {
      name: payload.name.trim(),
      email: emailNorm,
      phone: phoneNorm || "+91 98000 00000",
      role: dbRole as any,
      isActive: true,
    },
  })

  // Assign Gaushala if manager
  const assignedGosalas: { id: string; name: string }[] = []
  if (dbRole === "GOSALA_MANAGER") {
    let targetGosalaId = payload.gosalaId
    let gRec: any = null
    if (targetGosalaId) {
      gRec = await prisma.gosala.findUnique({ where: { id: targetGosalaId } })
    } else if (payload.gosalaName) {
      gRec = await prisma.gosala.findFirst({
        where: { name: { contains: payload.gosalaName, mode: "insensitive" } },
      })
      if (gRec) targetGosalaId = gRec.id
    }
    if (targetGosalaId && gRec) {
      try {
        const assignment: any = await prisma.gosalaManagerAssignment.create({
          data: {
            userId: user.id,
            gosalaId: targetGosalaId,
            region: gRec.region || "Cyberabad / Gachibowli Zone",
            status: "Active",
          },
          include: { gosala: true },
        })
        if (assignment.gosala) {
          assignedGosalas.push({ id: assignment.gosala.id, name: assignment.gosala.name })
        }
      } catch (err) {
        console.warn("Could not create manager assignment during registration:", err)
      }
    }
  }

  // Save role-specific rich metadata to persistent store
  const metaPatch: any = {}
  if (payload.password) {
    metaPatch.password = payload.password
  }
  if (payload.role === "customer" && payload.customerData) {
    metaPatch.customerData = {
      ...payload.customerData,
      memberSince: new Date().toLocaleDateString("en-IN", { month: "short", year: "numeric" }),
      totalBookings: 0,
    }
  } else if (payload.role === "driver" && payload.driverData) {
    metaPatch.driverData = {
      driverId: `DRV-${user.id.slice(0, 4)}`,
      status: "Available",
      rating: 5.0,
      totalTrips: 0,
      phone: user.phone,
      ...payload.driverData,
    }
  } else if (payload.role === "manager" && payload.managerData) {
    metaPatch.managerData = payload.managerData
  }

  if (Object.keys(metaPatch).length > 0) {
    saveUserMeta(user.email, metaPatch)
    saveUserMeta(user.id, metaPatch)
  }

  const feRole = mapDbRoleToFrontend(user.role)
  const gosalaIds = assignedGosalas.map((g) => g.id)
  const gosalaNames = assignedGosalas.map((g) => g.name)

  const token = signJwt({
    userId: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: feRole,
    dbRole: user.role as any,
    gosalaIds,
    gosalaNames,
    driverData: metaPatch.driverData,
    customerData: metaPatch.customerData,
  })

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: feRole,
      dbRole: user.role as any,
      avatar: user.avatar,
      gosalas: assignedGosalas,
      assignedGosalaNames: gosalaNames,
      driverData: metaPatch.driverData,
      customerData: metaPatch.customerData,
    },
  }
}

/**
 * Return all registered managers and admins for dynamic switcher / multi-account selection
 */
export async function getDirectoryAccounts() {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    include: {
      managerAssignments: {
        include: { gosala: true },
      },
    },
    orderBy: { createdAt: "asc" },
  })

  return users.map((u: any) => {
    let assignedGosalas = (u.managerAssignments || []).map((a: any) => ({
      id: a.gosala.id,
      name: a.gosala.name,
    }))

    const meta = getUserMeta(u.email || u.id)
    const isSuper = u.role === "SUPER_ADMIN"
    return {
      id: u.id,
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

/**
 * Return all users with complete details for Admin User Management
 */
export async function getAllUsers() {
  const users = await prisma.user.findMany({
    include: {
      managerAssignments: {
        include: { gosala: true },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  return users.map((u: any) => {
    const assignedGosalas = (u.managerAssignments || []).map((a: any) => ({
      id: a.gosala.id,
      name: a.gosala.name,
    }))
    const meta = getUserMeta(u.email || u.id)
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: mapDbRoleToFrontend(u.role),
      dbRole: u.role,
      isActive: u.isActive,
      avatar: u.avatar,
      createdAt: u.createdAt,
      assignedGosalaNames: assignedGosalas.map((g: any) => g.name),
      password: meta.password,
      driverData: meta.driverData,
      customerData: meta.customerData,
    }
  })
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

  const updated = await prisma.user.update({
    where: { id },
    data,
    include: { managerAssignments: { include: { gosala: true } } },
  })

  // Update metadata
  const metaPatch: any = {}
  if (updates.password) metaPatch.password = updates.password
  if (updates.customerData) metaPatch.customerData = updates.customerData
  if (updates.driverData) metaPatch.driverData = updates.driverData
  if (updates.managerData) metaPatch.managerData = updates.managerData
  if (Object.keys(metaPatch).length > 0) {
    saveUserMeta(updated.email, metaPatch)
    saveUserMeta(updated.id, metaPatch)
  }

  return updated
}

/**
 * Delete a user from PostgreSQL
 */
export async function deleteUser(id: string) {
  const u = await prisma.user.findUnique({ where: { id } })
  if (u) {
    deleteUserMeta(u.email)
    deleteUserMeta(u.id)
  }
  return prisma.user.delete({ where: { id } })
}
