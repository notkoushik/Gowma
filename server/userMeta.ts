import { prisma } from "./prisma.ts"

export interface UserRichMeta {
  password?: string
  customerData?: {
    address?: string
    city?: string
    aadhaarNumber?: string
    preferredCeremony?: string
    gotra?: string
    familyMembers?: string
    specialNotes?: string
    totalBookings?: number
    memberSince?: string
  }
  driverData?: {
    driverId?: string
    vehicleNumber?: string
    vehicleType?: string
    licenseNumber?: string
    gosalaBase?: string
    status?: "Available" | "On Duty" | "Off Duty" | string
    rating?: number
    totalTrips?: number
    phone?: string
  }
  managerData?: {
    managerId?: string
    gosala?: string
    region?: string
    dailySevaCeiling?: number
    restingBufferMin?: number
    assignedGosalas?: string[]
  }
  adminData?: {
    adminId?: string
    designation?: string
    department?: string
    authorityLevel?: string
    treasuryClearanceLevel?: string
  }
}

// In-memory cache backed by PostgreSQL `users.metadata`
let metaStore: Record<string, UserRichMeta> = {}
let isInitialized = false

async function initMetaStore() {
  if (isInitialized) return
  try {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, metadata: true }
    })
    for (const u of users) {
      if (u.metadata && typeof u.metadata === "object") {
        if (u.id) metaStore[u.id.toLowerCase()] = u.metadata as UserRichMeta
        if (u.email) metaStore[u.email.toLowerCase()] = u.metadata as UserRichMeta
      }
    }
    isInitialized = true
  } catch (err) {
    console.warn("[userMeta] Could not preload users metadata from DB:", (err as any)?.message)
  }
}

// Trigger initial load asynchronously
initMetaStore().catch(() => {})

export function getUserMeta(identifier: string): UserRichMeta {
  if (!identifier) return {}
  const key = identifier.trim().toLowerCase()
  return metaStore[key] || {}
}

export function saveUserMeta(identifier: string, patch: Partial<UserRichMeta>) {
  if (!identifier) return
  const key = identifier.trim().toLowerCase()
  const existing = metaStore[key] || {}
  const updated: UserRichMeta = {
    ...existing,
    ...patch,
    customerData: patch.customerData
      ? { ...(existing.customerData || {}), ...patch.customerData }
      : existing.customerData,
    driverData: patch.driverData
      ? { ...(existing.driverData || {}), ...patch.driverData }
      : existing.driverData,
    managerData: patch.managerData
      ? { ...(existing.managerData || {}), ...patch.managerData }
      : existing.managerData,
    adminData: patch.adminData
      ? { ...(existing.adminData || {}), ...patch.adminData }
      : existing.adminData,
  }

  metaStore[key] = updated

  // Asynchronously persist to PostgreSQL
  prisma.user.findFirst({
    where: {
      OR: [
        { email: { equals: identifier, mode: "insensitive" } },
        { id: identifier }
      ]
    }
  }).then(async (user) => {
    if (user) {
      metaStore[user.id.toLowerCase()] = updated
      if (user.email) metaStore[user.email.toLowerCase()] = updated
      await prisma.user.update({
        where: { id: user.id },
        data: { metadata: updated as any }
      })
    }
  }).catch((err) => {
    console.error(`[userMeta] Failed to persist metadata to DB for ${identifier}:`, err.message)
  })
}

export function deleteUserMeta(identifier: string) {
  if (!identifier) return
  const key = identifier.trim().toLowerCase()
  delete metaStore[key]

  prisma.user.findFirst({
    where: {
      OR: [
        { email: { equals: identifier, mode: "insensitive" } },
        { id: identifier }
      ]
    }
  }).then(async (user) => {
    if (user) {
      delete metaStore[user.id.toLowerCase()]
      if (user.email) delete metaStore[user.email.toLowerCase()]
      await prisma.user.update({
        where: { id: user.id },
        data: { metadata: {} }
      })
    }
  }).catch(() => {})
}

export const setUserMeta = saveUserMeta
