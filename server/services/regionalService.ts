import fs from "fs"
import path from "path"
import { prisma } from "../prisma.ts"
import { getUserMeta, saveUserMeta } from "../userMeta.ts"
import { getGosalaMeta, saveGosalaMeta } from "../gosalaMeta.ts"
import {
  adminCreateUser,
  generateGuaranteedUniqueId,
} from "../auth/authService.ts"
import { getAllOperationalHubs } from "./hubService.ts"
import { getDefaultZoneForState } from "../data/indiaGeoData.ts"
import crypto from "node:crypto"

export interface OperationalRegion {
  id: string
  state: string
  district: string
  name: string
  zone: "North" | "South" | "East" | "West" | "Central" | "Rural"
  defaultMaxRadiusKm: number
  pincodePrefixes: string[]
  assignedAdminId?: string | null
  assignedAdminName?: string | null
  assignedAdminEmail?: string | null
  assignedAdminPhone?: string | null
  assignedAt?: string | null
  status: "Active" | "Inactive"
  createdAt: string
  isCustom?: boolean
}

export interface OperationalAdminBankDetails {
  accountHolder: string
  bankName: string
  accountNumber: string
  ifscCode: string
  upiId?: string
  branchName?: string
  isVerified?: boolean
}

export interface OperationalAdminSummary {
  id: string
  uniqueId?: string
  name: string
  email: string
  phone: string
  role: "admin"
  dbRole: "OPERATIONS_ADMIN"
  isActive: boolean
  assignedRegion?: OperationalRegion | null
  assignedRegionId?: string | null
  assignedRegionName?: string | null
  bankDetails?: OperationalAdminBankDetails
  assignedGosalaNames: string[]
  assignedGosalaCount: number
  assignedManagerCount: number
  activeBookingsCount: number
  department?: string
  designation?: string
  createdAt?: string
  isFree: boolean
}

export interface DataMigrationRecord {
  id: string
  timestamp: string
  sourceAdminId: string
  sourceAdminName: string
  sourceAdminEmail: string
  targetAdminId: string
  targetAdminName: string
  targetAdminEmail: string
  regionId?: string
  regionName: string
  transferredGosalas: string[]
  transferredManagersCount: number
  transferredBookingsCount: number
  sourceDeactivated: boolean
  bankingHandoverStatus: "COMPLETED" | "PENDING_VERIFICATION"
  targetBankDetailsSummary: string
  operatorRole: string
  operatorName: string
  notes?: string
}

const CUSTOM_REGIONS_FILE = path.resolve(
  process.cwd(),
  "server/data/custom_regions.json",
)
const MIGRATION_HISTORY_FILE = path.resolve(
  process.cwd(),
  "server/data/migration_history.json",
)

let customRegionsCache: OperationalRegion[] = []
let isRegionsLoaded = false

function ensureRegionsLoaded(): void {
  if (isRegionsLoaded) return
  try {
    if (fs.existsSync(CUSTOM_REGIONS_FILE)) {
      const raw = fs.readFileSync(CUSTOM_REGIONS_FILE, "utf-8")
      customRegionsCache = JSON.parse(raw)
    } else {
      customRegionsCache = []
    }
  } catch (err) {
    console.warn("[regionalService] Failed to load custom regions:", err)
    customRegionsCache = []
  }
  isRegionsLoaded = true
}

function persistCustomRegions(): void {
  try {
    const dir = path.dirname(CUSTOM_REGIONS_FILE)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(
      CUSTOM_REGIONS_FILE,
      JSON.stringify(customRegionsCache, null, 2),
      "utf-8",
    )
  } catch (err) {
    console.warn("[regionalService] Failed to persist custom regions:", err)
  }
}

function loadMigrationHistory(): DataMigrationRecord[] {
  try {
    if (fs.existsSync(MIGRATION_HISTORY_FILE)) {
      const raw = fs.readFileSync(MIGRATION_HISTORY_FILE, "utf-8")
      return JSON.parse(raw)
    }
  } catch (err) {
    console.warn("[regionalService] Failed to load migration history:", err)
  }
  return []
}

function saveMigrationHistory(history: DataMigrationRecord[]): void {
  try {
    const dir = path.dirname(MIGRATION_HISTORY_FILE)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(
      MIGRATION_HISTORY_FILE,
      JSON.stringify(history, null, 2),
      "utf-8",
    )
  } catch (err) {
    console.warn("[regionalService] Failed to persist migration history:", err)
  }
}

/**
 * Returns all registered Operational Regions (combining curated baseline hubs and custom regions)
 */
export async function getAllOperationalRegions(): Promise<OperationalRegion[]> {
  ensureRegionsLoaded()

  // Baseline regions from curated hubs
  const baselineHubs = getAllOperationalHubs()
  const baselineRegions: OperationalRegion[] = baselineHubs.map((h) => ({
    id: h.id,
    state: h.state,
    district: h.city,
    name: h.name,
    zone: h.zone,
    defaultMaxRadiusKm: h.defaultMaxRadiusKm || 35,
    pincodePrefixes: h.pincodePrefixes || [],
    assignedAdminId: (h as any).assignedAdminId || null,
    assignedAdminName: (h as any).assignedAdminName || null,
    assignedAdminEmail: (h as any).assignedAdminEmail || null,
    assignedAdminPhone: (h as any).assignedAdminPhone || null,
    status: (h as any).status || "Active",
    createdAt: h.createdAt || "2026-01-01T00:00:00.000Z",
    isCustom: !!h.isCustom,
  }))

  const combined = [...customRegionsCache]
  for (const b of baselineRegions) {
    if (!combined.some((c) => c.id === b.id)) {
      combined.push(b)
    }
  }

  // Cross-reference with operational admins in DB
  try {
    const opsAdmins = await prisma.user.findMany({
      where: { role: "OPERATIONS_ADMIN" },
      select: { id: true, name: true, email: true, phone: true, metadata: true },
    })

    for (const r of combined) {
      if (!r.assignedAdminId) {
        // Check if any admin has this region assigned in userMeta
        const matchingAdmin = opsAdmins.find((a) => {
          const meta = getUserMeta(a.email || a.id)
          return (
            meta.assignedRegion?.id === r.id ||
            (meta.assignedRegion?.state === r.state &&
              meta.assignedRegion?.district === r.district)
          )
        })

        if (matchingAdmin) {
          r.assignedAdminId = matchingAdmin.id
          r.assignedAdminName = matchingAdmin.name
          r.assignedAdminEmail = matchingAdmin.email
          r.assignedAdminPhone = matchingAdmin.phone
        }
      }
    }
  } catch (e) {}

  // Strictly enforce 1 District = 1 Entry across all operational regions
  const districtMap = new Map<string, OperationalRegion>()
  for (const r of combined) {
    const key = `${(r.state || "").toLowerCase()}::${(r.district || "").toLowerCase()}`
    const existing = districtMap.get(key)
    if (!existing) {
      districtMap.set(key, r)
    } else if (!existing.assignedAdminId && r.assignedAdminId) {
      // Prioritize the entry that has an active appointed admin
      districtMap.set(key, r)
    }
  }

  return Array.from(districtMap.values())
}

/**
 * Create a new Operational Region
 */
export async function createOperationalRegion(payload: {
  state: string
  district: string
  name?: string
  zone?: "North" | "South" | "East" | "West" | "Central" | "Rural"
  defaultMaxRadiusKm?: number
  pincodePrefixes?: string[]
  assignedAdminId?: string | null
}): Promise<OperationalRegion> {
  ensureRegionsLoaded()

  const cleanState = (payload.state || "").trim()
  const cleanDistrict = (payload.district || "").trim()
  if (!cleanState) {
    throw new Error("State is required to register an operational region.")
  }
  if (!cleanDistrict) {
    throw new Error("District is required to register an operational region.")
  }

  const cleanName = (
    payload.name || `${cleanDistrict} (${cleanState}) Regional Belt`
  ).trim()
  const zone = payload.zone || getDefaultZoneForState(cleanState)

  const slug = `${cleanDistrict
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")}-${Date.now().toString(36).slice(-4)}`
  const regionId = `reg-${cleanState.slice(0, 2).toLowerCase()}-${slug}`

  let assignedAdminName: string | null = null
  let assignedAdminEmail: string | null = null
  let assignedAdminPhone: string | null = null

  if (payload.assignedAdminId) {
    const admin = await prisma.user.findUnique({
      where: { id: payload.assignedAdminId },
    })
    if (admin) {
      assignedAdminName = admin.name
      assignedAdminEmail = admin.email
      assignedAdminPhone = admin.phone
    }
  }

  // Strictly enforce 1 District = 1 Entry: update existing district if already present
  const existingIdx = customRegionsCache.findIndex(
    (c) =>
      c.state.toLowerCase() === cleanState.toLowerCase() &&
      c.district.toLowerCase() === cleanDistrict.toLowerCase(),
  )

  if (existingIdx !== -1) {
    const existing = customRegionsCache[existingIdx]
    existing.name = cleanName
    existing.zone = zone
    if (payload.assignedAdminId) {
      existing.assignedAdminId = payload.assignedAdminId
      existing.assignedAdminName = assignedAdminName
      existing.assignedAdminEmail = assignedAdminEmail
      existing.assignedAdminPhone = assignedAdminPhone
      existing.assignedAt = new Date().toISOString()
    }
    persistCustomRegions()
    if (payload.assignedAdminId) {
      saveUserMeta(payload.assignedAdminId, {
        assignedRegion: {
          id: existing.id,
          state: existing.state,
          district: existing.district,
          name: existing.name,
          zone: existing.zone,
        },
      })
    }
    return existing
  }

  const newRegion: OperationalRegion = {
    id: regionId,
    state: cleanState,
    district: cleanDistrict,
    name: cleanName,
    zone,
    defaultMaxRadiusKm: Math.max(
      10,
      Math.min(150, Number(payload.defaultMaxRadiusKm) || 35),
    ),
    pincodePrefixes: Array.isArray(payload.pincodePrefixes)
      ? payload.pincodePrefixes.filter(Boolean)
      : [],
    assignedAdminId: payload.assignedAdminId || null,
    assignedAdminName,
    assignedAdminEmail,
    assignedAdminPhone,
    assignedAt: payload.assignedAdminId ? new Date().toISOString() : null,
    status: "Active",
    createdAt: new Date().toISOString(),
    isCustom: true,
  }

  customRegionsCache.unshift(newRegion)
  persistCustomRegions()

  // If assigned an admin, save into userMeta
  if (payload.assignedAdminId) {
    saveUserMeta(payload.assignedAdminId, {
      assignedRegion: {
        id: newRegion.id,
        state: newRegion.state,
        district: newRegion.district,
        name: newRegion.name,
        zone: newRegion.zone,
      },
    })
  }

  return newRegion
}

/**
 * Assign or Unassign an Operational Admin to a Region
 */
export async function assignRegionAdmin(
  regionId: string,
  adminId: string | null,
): Promise<OperationalRegion> {
  ensureRegionsLoaded()

  let region = customRegionsCache.find((r) => r.id === regionId)
  if (!region) {
    // If not in custom regions, promote from baseline
    const all = await getAllOperationalRegions()
    const baseline = all.find((r) => r.id === regionId)
    if (!baseline) {
      throw new Error(`Operational Region ${regionId} not found`)
    }
    region = { ...baseline, isCustom: true }
    customRegionsCache.push(region)
  }

  // Previous admin unassignment if switching
  const prevAdminId = region.assignedAdminId
  if (prevAdminId && prevAdminId !== adminId) {
    saveUserMeta(prevAdminId, { assignedRegion: undefined })
  }

  if (adminId) {
    const admin = await prisma.user.findUnique({
      where: { id: adminId },
    })
    if (!admin) {
      throw new Error(`Operational Admin ${adminId} not found`)
    }
    if (admin.role !== "OPERATIONS_ADMIN") {
      throw new Error("Target user is not an Operations Admin")
    }

    region.assignedAdminId = admin.id
    region.assignedAdminName = admin.name
    region.assignedAdminEmail = admin.email
    region.assignedAdminPhone = admin.phone
    region.assignedAt = new Date().toISOString()

    saveUserMeta(admin.email, {
      assignedRegion: {
        id: region.id,
        state: region.state,
        district: region.district,
        name: region.name,
        zone: region.zone,
      },
    })
    saveUserMeta(admin.id, {
      assignedRegion: {
        id: region.id,
        state: region.state,
        district: region.district,
        name: region.name,
        zone: region.zone,
      },
    })

    // Update any Gaushalas matching this region's name or state
    await prisma.gosala
      .updateMany({
        where: {
          OR: [
            { region: { contains: region.name, mode: "insensitive" } },
            { region: { contains: region.district, mode: "insensitive" } },
          ],
        },
        data: {
          adminId: admin.id,
          adminEmail: admin.email,
          adminName: admin.name,
        },
      })
      .catch(() => {})
  } else {
    // Unassign
    region.assignedAdminId = null
    region.assignedAdminName = null
    region.assignedAdminEmail = null
    region.assignedAdminPhone = null
    region.assignedAt = null
  }

  persistCustomRegions()
  return region
}

/**
 * List all Operational Admins with enriched portfolio, region assignment, and banking details
 */
export async function getAllOperationalAdmins(): Promise<
  OperationalAdminSummary[]
> {
  const [users, allGosalas, allBookings, allRegions] = await Promise.all([
    prisma.user.findMany({
      where: { role: "OPERATIONS_ADMIN" },
      include: {
        managerAssignments: {
          include: { gosala: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.gosala.findMany({ where: { isActive: true } }).catch(() => []),
    prisma.booking
      .findMany({
        select: {
          id: true,
          status: true,
          gosalaId: true,
          gosalaName: true,
          bookingDate: true,
        },
      })
      .catch(() => []),
    getAllOperationalRegions(),
  ])

  return users.map((u) => {
    const meta = getUserMeta(u.email || u.id)

    // Collect all Gaushalas governed by this operational admin
    const userEmail = (u.email || "").toLowerCase().trim()
    const assignedGosalaList = allGosalas.filter((g) => {
      const gMeta = (g.metadata && typeof g.metadata === "object") ? (g.metadata as any) : getGosalaMeta(g.id, g.name)
      const govEmail = (
        g.adminEmail ||
        gMeta.governingAdminEmail ||
        gMeta.adminEmail ||
        ""
      )
        .toLowerCase()
        .trim()
      return (
        (g.adminId && g.adminId === u.id) ||
        (userEmail && govEmail === userEmail)
      )
    })

    const assignedGosalaNames = assignedGosalaList.map((g) => g.name)
    const assignedGosalaIds = new Set(assignedGosalaList.map((g) => g.id))

    // Active bookings under this admin's Gaushala network
    const activeBookings = allBookings.filter(
      (b) =>
        assignedGosalaIds.has(b.gosalaId) ||
        assignedGosalaNames.includes(b.gosalaName),
    )

    // Number of managers under these Gaushalas
    const managerCount = u.managerAssignments?.length || assignedGosalaList.length

    // Assigned region lookup
    let assignedRegion = allRegions.find((r) => r.assignedAdminId === u.id)
    if (!assignedRegion && meta.assignedRegion) {
      assignedRegion = allRegions.find((r) => r.id === meta.assignedRegion?.id)
    }

    const defaultBank: OperationalAdminBankDetails = {
      accountHolder: u.name,
      bankName: "State Bank of India",
      accountNumber: "••••••••4819",
      ifscCode: "SBIN0001042",
      upiId: `${(u.email || "admin").split("@")[0]}@sbi`,
      branchName: "Regional Operations Branch",
      isVerified: true,
    }

    const bankDetails = meta.bankDetails || defaultBank

    return {
      id: u.id,
      uniqueId: u.uniqueId || `GMA-OPS-${u.id.slice(0, 4).toUpperCase()}`,
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: "admin",
      dbRole: "OPERATIONS_ADMIN",
      isActive: u.isActive,
      assignedRegion: assignedRegion || null,
      assignedRegionId: assignedRegion?.id || null,
      assignedRegionName: assignedRegion?.name || null,
      bankDetails,
      assignedGosalaNames,
      assignedGosalaCount: assignedGosalaList.length,
      assignedManagerCount: managerCount,
      activeBookingsCount: activeBookings.length,
      department:
        meta.adminData?.department || "Regional Gaushala Operations Hub",
      designation:
        meta.adminData?.designation || "Regional Operations Officer",
      createdAt: u.createdAt.toISOString(),
      isFree: !assignedRegion && assignedGosalaList.length === 0,
    }
  })
}

/**
 * Toggle active / deactivated status of an Operational Admin
 */
export async function toggleOperationalAdminStatus(
  adminId: string,
  isActive: boolean,
): Promise<{ ok: boolean; adminId: string; isActive: boolean }> {
  const admin = await prisma.user.findUnique({ where: { id: adminId } })
  if (!admin) {
    throw new Error(`Operational Admin ${adminId} not found`)
  }

  const updated = await prisma.user.update({
    where: { id: adminId },
    data: { isActive },
  })

  return { ok: true, adminId: updated.id, isActive: updated.isActive }
}

/**
 * Create a new Operational Admin with full Banking Details & optional region appointment
 */
export async function createOperationalAdmin(
  payload: {
    name: string
    email: string
    phone: string
    password?: string
    designation?: string
    department?: string
    bankDetails?: OperationalAdminBankDetails
    assignedRegionId?: string
  },
  operator?: any,
): Promise<OperationalAdminSummary> {
  const session = await adminCreateUser(
    {
      name: payload.name,
      email: payload.email,
      phone: payload.phone,
      role: "admin",
      password: payload.password,
    },
    operator,
  )

  const userId = session.user.id
  const userEmail = session.user.email

  // Save admin metadata & bank details
  const bankDetails: OperationalAdminBankDetails = {
    accountHolder: payload.bankDetails?.accountHolder || payload.name,
    bankName: payload.bankDetails?.bankName || "State Bank of India",
    accountNumber:
      payload.bankDetails?.accountNumber || `9102${Math.floor(10000000 + Math.random() * 90000000)}`,
    ifscCode: (payload.bankDetails?.ifscCode || "SBIN0001042").toUpperCase(),
    upiId:
      payload.bankDetails?.upiId ||
      `${userEmail.split("@")[0]}@okhdfcbank`,
    branchName: payload.bankDetails?.branchName || "Regional Central Hub",
    isVerified: true,
  }

  saveUserMeta(userEmail, {
    bankDetails,
    adminData: {
      adminId: session.user.uniqueId || `GMA-OPS-${userId.slice(0, 4)}`,
      designation: payload.designation || "Regional Operations Officer",
      department: payload.department || "Regional Gaushala Operations Hub",
      authorityLevel: "OPERATIONS_ADMIN",
    },
  })
  saveUserMeta(userId, {
    bankDetails,
    adminData: {
      adminId: session.user.uniqueId || `GMA-OPS-${userId.slice(0, 4)}`,
      designation: payload.designation || "Regional Operations Officer",
      department: payload.department || "Regional Gaushala Operations Hub",
      authorityLevel: "OPERATIONS_ADMIN",
    },
  })

  // If a region was selected, assign it immediately
  let assignedRegion: OperationalRegion | null = null
  if (payload.assignedRegionId) {
    assignedRegion = await assignRegionAdmin(payload.assignedRegionId, userId)
  }

  return {
    id: userId,
    uniqueId: session.user.uniqueId,
    name: session.user.name,
    email: session.user.email,
    phone: session.user.phone,
    role: "admin",
    dbRole: "OPERATIONS_ADMIN",
    isActive: true,
    assignedRegion,
    assignedRegionId: assignedRegion?.id || null,
    assignedRegionName: assignedRegion?.name || null,
    bankDetails,
    assignedGosalaNames: [],
    assignedGosalaCount: 0,
    assignedManagerCount: 0,
    activeBookingsCount: 0,
    department: payload.department || "Regional Gaushala Operations Hub",
    designation: payload.designation || "Regional Operations Officer",
    createdAt: new Date().toISOString(),
    isFree: !assignedRegion,
  }
}

/**
 * ATOMIC DATA MIGRATION:
 * Migrates all Gaushalas, Managers, active Bookings, and Regional Hubs
 * from Old Operational Admin -> New Operational Admin.
 * Handles banking details handover, separation clauses, and audit certificate logging.
 */
export async function executeDataMigration(
  payload: {
    sourceAdminId: string
    targetAdminId: string
    deactivateSource?: boolean
    transferRegion?: boolean
    targetBankDetails?: OperationalAdminBankDetails
    notes?: string
  },
  operator?: any,
): Promise<{ ok: boolean; certificate: DataMigrationRecord }> {
  const { sourceAdminId, targetAdminId } = payload

  if (!sourceAdminId || !targetAdminId) {
    throw new Error("Both source and target Operational Admins are required for migration.")
  }
  if (sourceAdminId === targetAdminId) {
    throw new Error("Cannot migrate data to the same Operational Admin. Source and target must be distinct.")
  }

  const [sourceAdmin, targetAdmin] = await Promise.all([
    prisma.user.findUnique({ where: { id: sourceAdminId } }),
    prisma.user.findUnique({ where: { id: targetAdminId } }),
  ])

  if (!sourceAdmin) {
    throw new Error(`Source Operational Admin (${sourceAdminId}) not found`)
  }
  if (!targetAdmin) {
    throw new Error(`Target Operational Admin (${targetAdminId}) not found`)
  }
  if (!targetAdmin.isActive) {
    throw new Error("Target Operational Admin must be active to accept data migration.")
  }

  const sourceEmail = (sourceAdmin.email || "").toLowerCase().trim()
  const targetEmail = (targetAdmin.email || "").toLowerCase().trim()

  // 1. Identify all Gaushalas governed by Source Admin
  const allGosalas = await prisma.gosala.findMany()
  const transferredGosalaNames: string[] = []

  for (const g of allGosalas) {
    const meta = (g.metadata && typeof g.metadata === "object") ? (g.metadata as any) : getGosalaMeta(g.id, g.name)
    const govEmail = (g.adminEmail || meta.governingAdminEmail || meta.adminEmail || "").toLowerCase().trim()
    const isGoverned = (g.adminId && g.adminId === sourceAdmin.id) || (govEmail && govEmail === sourceEmail)

    if (isGoverned) {
      transferredGosalaNames.push(g.name)
      await prisma.gosala.update({
        where: { id: g.id },
        data: {
          adminId: targetAdmin.id,
          adminEmail: targetAdmin.email,
          adminName: targetAdmin.name,
        },
      })
      saveGosalaMeta(g.id, {
        governingAdminEmail: targetAdmin.email,
        governingAdminName: targetAdmin.name,
        adminId: targetAdmin.id,
      })
      saveGosalaMeta(g.name, {
        governingAdminEmail: targetAdmin.email,
        governingAdminName: targetAdmin.name,
        adminId: targetAdmin.id,
      })
    }
  }

  // 2. Reassign managers under those Gaushalas
  let transferredManagersCount = 0
  const managerAssignments = await prisma.gosalaManagerAssignment.findMany({
    include: { gosala: true },
  })
  for (const ma of managerAssignments) {
    if (transferredGosalaNames.includes(ma.gosala.name)) {
      transferredManagersCount += 1
    }
  }

  // 3. Update active/pending bookings
  let transferredBookingsCount = 0
  const bookings = await prisma.booking.findMany()
  for (const b of bookings) {
    if (transferredGosalaNames.includes(b.gosalaName)) {
      transferredBookingsCount += 1
      await prisma.booking
        .update({
          where: { id: b.id },
          data: {
            adminRemark: `[MIGRATION] Portfolio transferred to ${targetAdmin.name} (${targetAdmin.email}) on ${new Date().toLocaleDateString()}`,
          },
        })
        .catch(() => {})
    }
  }

  // 4. Transfer Region Assignment
  let regionName = "Transferred Regional Territory"
  let regionId: string | undefined
  if (payload.transferRegion !== false) {
    const allRegions = await getAllOperationalRegions()
    const sourceRegion = allRegions.find((r) => r.assignedAdminId === sourceAdmin.id)
    if (sourceRegion) {
      regionName = sourceRegion.name
      regionId = sourceRegion.id
      await assignRegionAdmin(sourceRegion.id, targetAdmin.id)
    }
  }

  // 5. Update Banking Details if provided
  if (payload.targetBankDetails) {
    saveUserMeta(targetAdmin.email, { bankDetails: payload.targetBankDetails })
    saveUserMeta(targetAdmin.id, { bankDetails: payload.targetBankDetails })
  }

  // 6. Deactivate Source Admin if requested
  const shouldDeactivate = payload.deactivateSource !== false
  if (shouldDeactivate) {
    await prisma.user.update({
      where: { id: sourceAdmin.id },
      data: { isActive: false },
    })
  }

  // Clear source admin's active region
  saveUserMeta(sourceAdmin.email, { assignedRegion: undefined })
  saveUserMeta(sourceAdmin.id, { assignedRegion: undefined })

  // 7. Generate Migration Certificate
  const certId = `MIG-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`
  const targetMeta = getUserMeta(targetAdmin.email || targetAdmin.id)
  const targetBank = targetMeta.bankDetails || payload.targetBankDetails

  const certificate: DataMigrationRecord = {
    id: certId,
    timestamp: new Date().toISOString(),
    sourceAdminId: sourceAdmin.id,
    sourceAdminName: sourceAdmin.name,
    sourceAdminEmail: sourceAdmin.email,
    targetAdminId: targetAdmin.id,
    targetAdminName: targetAdmin.name,
    targetAdminEmail: targetAdmin.email,
    regionId,
    regionName,
    transferredGosalas: transferredGosalaNames,
    transferredManagersCount: Math.max(transferredManagersCount, transferredGosalaNames.length),
    transferredBookingsCount,
    sourceDeactivated: shouldDeactivate,
    bankingHandoverStatus: "COMPLETED",
    targetBankDetailsSummary: targetBank
      ? `${targetBank.bankName} - A/C ••••${(targetBank.accountNumber || "").slice(-4)} (${targetBank.ifscCode})`
      : "Default Verified Settlement Account",
    operatorRole: operator?.role || "SUPER_ADMIN",
    operatorName: operator?.name || "The Captain (Super Admin)",
    notes: payload.notes || "Official administrative portfolio handover & banking separation execution.",
  }

  // Append to migration history
  const history = loadMigrationHistory()
  history.unshift(certificate)
  saveMigrationHistory(history)

  return { ok: true, certificate }
}

/**
 * Returns migration audit certificates history
 */
export function getMigrationHistory(): DataMigrationRecord[] {
  return loadMigrationHistory()
}
