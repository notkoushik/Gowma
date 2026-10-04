import { prisma } from "../prisma.ts"
import { signJwt, verifyJwt, type JwtPayload } from "./jwt.ts"

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
  }
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
): Promise<UserSessionData | null> {
  const query = emailOrPhone.trim().toLowerCase()

  let user: any = await prisma.user.findFirst({
    where: {
      OR: [
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

  // If user doesn't exist and role hint provided, check fallback or create
  if (!user && roleHint) {
    const defaultName =
      roleHint === "super_admin"
        ? "Vikramaditya Hegde"
        : roleHint === "admin"
          ? "Priya Sharma"
          : roleHint === "manager"
            ? "Rahul Kamble"
            : roleHint === "driver"
              ? "Sunil Pawar"
              : "Ananya Deshmukh"

    const dbRole =
      roleHint === "super_admin"
        ? "SUPER_ADMIN"
        : roleHint === "admin"
          ? "OPERATIONS_ADMIN"
          : roleHint === "manager"
            ? "GOSALA_MANAGER"
            : roleHint === "driver"
              ? "DRIVER"
              : "CUSTOMER"

    try {
      user = await prisma.user.create({
        data: {
          email: query.includes("@") ? query : `${roleHint}@gomaa.in`,
          name: defaultName,
          phone: "+91 98230 44910",
          role: dbRole as any,
          isActive: true,
        },
        include: {
          managerAssignments: {
            include: { gosala: true },
          },
        },
      })
    } catch {
      user = await prisma.user.findFirst({
        where: { email: { equals: query, mode: "insensitive" } },
        include: { managerAssignments: { include: { gosala: true } } },
      })
    }
  }

  if (!user) return null

  // Resolve assigned Gaushalas
  const assignedGosalas = (user.managerAssignments || []).map((a: any) => ({
    id: a.gosala.id,
    name: a.gosala.name,
  }))

  // If this is Rahul Kamble or manager for Surya and assignment is missing, link to Surya
  if (
    user.role === "GOSALA_MANAGER" &&
    assignedGosalas.length === 0 &&
    (user.email.toLowerCase().includes("rahul") || user.name.toLowerCase().includes("rahul"))
  ) {
    const surya = await prisma.gosala.findFirst({
      where: { name: { contains: "Surya", mode: "insensitive" } },
    })
    if (surya) {
      try {
        await prisma.gosalaManagerAssignment.create({
          data: {
            userId: user.id,
            gosalaId: surya.id,
            region: surya.region || "Cyberabad / Gachibowli",
            status: "Active",
          },
        })
        assignedGosalas.push({ id: surya.id, name: surya.name })
      } catch {}
    }
  }

  const feRole = mapDbRoleToFrontend(user.role)
  const gosalaIds = assignedGosalas.map((g: any) => g.id)
  const gosalaNames = assignedGosalas.map((g: any) => g.name)

  const token = signJwt({
    userId: user.id,
    name: user.name,
    email: user.email,
    role: feRole,
    dbRole: user.role as any,
    gosalaIds,
    gosalaNames,
    adminId: feRole === "admin" ? user.id : undefined,
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
    const assignedGosalas = (u.managerAssignments || []).map((a: any) => ({
      id: a.gosala.id,
      name: a.gosala.name,
    }))
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: mapDbRoleToFrontend(u.role),
      dbRole: u.role,
      assignedGosalaNames: assignedGosalas.map((g: any) => g.name),
      primaryGosala: assignedGosalas[0]?.name || "General Roster",
    }
  })
}
