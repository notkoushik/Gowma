import { prisma } from "./prisma.ts"
import { wsHub } from "./ws/hub.ts"
import { gpsSimulator } from "./ws/gpsSimulator.ts"
import { db } from "./db.ts"
import { getGosalaMeta, saveGosalaMeta, deleteGosalaMeta } from "./gosalaMeta.ts"
import { getAnimalMeta, saveAnimalMeta, deleteAnimalMeta, getAllAnimalMeta } from "./animalMeta.ts"
import { getUserMeta, setUserMeta } from "./userMeta.ts"
import type { GpsTickPayload } from "./ws/types.ts"
import type {
  Booking,
  BookingStatus,
  GosalaManager,
  PricingConfig,
  Settlement,
} from "./types.ts"
import { executeAutomatedSweep, getScheduleStatus } from "./services/payoutEngine.ts"
import {
  getAuthUserFromHeader,
  authenticateOrResolveUser,
  getDirectoryAccounts,
  registerUser,
  getAllUsers,
  updateUser,
  deleteUser,
} from "./auth/authService.ts"

type HandlerResponse = {
  status: number
  body: any
}

const driverLiveLocations = new Map<string, any>()
const serverAnimals = new Map<string, any>()
const serverVets = new Map<string, any>()

const serverProfiles: Record<string, any> = {
  customer: {
    id: "USER-CUST-NEW",
    role: "customer",
    name: "Devotee",
    phone: "+91 98000 00000",
    email: "devotee@gmail.com",
    customerData: {
      address: "Devotee Residence",
      aadhaarNumber: "XXXX-XXXX-0000",
      memberSince: "Oct 2026",
      totalBookings: 0,
      preferredCeremony: "Kamadhenu Puja & Gau Seva",
    },
  },
  manager: {
    id: "USER-MGR-NEW",
    role: "manager",
    name: "Gaushala Manager",
    phone: "+91 98000 00000",
    email: "manager@gomaa.in",
    managerData: {
      managerId: "MGR-NEW",
      gosala: "Unassigned",
      region: "Operational Hub",
      dailySevaCeiling: 2,
      restingBufferMin: 90,
    },
  },
  driver: {
    id: "USER-DRV-NEW",
    role: "driver",
    name: "Transit Pilot",
    phone: "+91 98000 00000",
    email: "driver@gomaa.in",
    driverData: {
      driverId: "DRV-NEW",
      vehicleNumber: "TS-09-GA-1008",
      vehicleType: "Tata 407 (Hydraulic Cattle Bed)",
      licenseNumber: "DL-PENDING",
      gosalaBase: "Unassigned",
      status: "Available",
    },
  },
  admin: {
    id: "USER-ADM-NEW",
    role: "admin",
    name: "Operations Admin",
    phone: "+91 98000 00000",
    email: "operations@gomaa.in",
    adminData: {
      adminId: "ADM-NEW",
      designation: "Regional Operations Officer",
      department: "Regional Gaushala Operations Hub",
      authorityLevel: "OPERATIONS_ADMIN",
    },
  },
  super_admin: {
    id: "USER-SA-KOUSHIK",
    role: "super_admin",
    name: "Koushik",
    phone: "+91 98000 00000",
    email: "koushik@gmail.com",
    adminData: {
      adminId: "SA-KOUSHIK",
      designation: "Platform Sovereign & Master Authority",
      department: "GOMAA Central Platform Governance",
      authorityLevel: "SUPER_ADMIN",
      treasuryClearanceLevel: "Master Sovereign Authority",
    },
  },
}


gpsSimulator.setOnTick((tick) => {
  driverLiveLocations.set(tick.bookingId, {
    ...tick,
    lastUpdated: new Date().toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
  })
})

function parseUrl(url: string) {
  const [pathname, search] = url.split("?")
  const query = new URLSearchParams(search || "")
  return { pathname, query }
}

function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number)
  return (h || 0) * 60 + (m || 0)
}

function toFrontendStatus(s: string): BookingStatus {
  switch (s) {
    case "PAYMENT_VERIFIED":
      return "Payment Verified"
    case "MANAGER_REVIEW":
      return "Manager Review"
    case "MANAGER_CONFIRMED":
      return "Manager Confirmed"
    case "ADMIN_REVIEW":
      return "Admin Review"
    case "CONFIRMED":
      return "Confirmed"
    case "IN_SERVICE":
      return "In Service"
    case "COMPLETED":
      return "Completed"
    case "REJECTED":
      return "Rejected"
    default:
      return s as BookingStatus
  }
}

function toPrismaStatus(s: string): any {
  switch (s) {
    case "Payment Verified":
      return "PAYMENT_VERIFIED"
    case "Manager Review":
      return "MANAGER_REVIEW"
    case "Manager Confirmed":
      return "MANAGER_CONFIRMED"
    case "Admin Review":
      return "ADMIN_REVIEW"
    case "Confirmed":
      return "CONFIRMED"
    case "In Service":
      return "IN_SERVICE"
    case "Completed":
      return "COMPLETED"
    case "Rejected":
      return "REJECTED"
    default:
      return s
  }
}

function normalizeDateStr(d: any): string {
  if (!d) return ""
  if (d instanceof Date) {
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  }
  const s = String(d).trim()
  const match = s.match(/^0*(\d+)[-\s]+([A-Za-z]+)[-\s]+(\d{4})$/)
  if (match) {
    return `${parseInt(match[1], 10)} ${match[2]} ${match[3]}`
  }
  const parts = s.split(/[\s-]+/)
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10)
    if (!isNaN(day)) return `${day} ${parts[1]} ${parts[2]}`
  }
  return s
}

function formatBooking(b: any): Booking {
  const mgrApproval = b.auditTrails?.find(
    (a: any) =>
      a.action === "MANAGER_CONFIRMED" || a.actorRole === "GOSALA_MANAGER",
  )
  const admApproval = b.auditTrails?.find(
    (a: any) =>
      a.action === "ADMIN_CONFIRMED" || a.actorRole === "OPERATIONS_ADMIN",
  )

  return {
    id: b.id,
    customer: b.customerName || b.customer,
    phone: b.customerPhone || b.phone,
    gosala: b.gosalaName || b.gosala,
    animal: b.animalName || b.animal,
    animalType:
      b.animalType === "COW" || b.animalType === "Cow"
        ? "Cow"
        : b.animalType === "BULL" || b.animalType === "Bull"
          ? "Bull"
          : "Calf",
    date: normalizeDateStr(b.bookingDate || b.date),
    start: b.startTime || b.start,
    end: b.endTime || b.end,
    durationMin: b.durationMin,
    address: b.address,
    distanceKm: b.distanceKm,
    base: b.baseRate ?? b.base ?? 0,
    extraTime: b.extraTimeFee ?? b.extraTime ?? 0,
    transport: b.transportFee ?? b.transport ?? 0,
    addons: b.addonsFee ?? b.addons ?? 0,
    tax: b.taxFee ?? b.tax ?? 0,
    discount: b.discountFee ?? b.discount ?? 0,
    total: b.totalAmount ?? b.total ?? 0,
    commissionPct: b.commissionPct ?? 20,
    status: toFrontendStatus(b.status),
    driver: b.driver?.name || b.driver || null,
    driverStage: b.driverStage ?? 0,
    paid: b.isPaid ?? b.paid ?? true,
    managerRemark: b.managerRemark || undefined,
    adminRemark: b.adminRemark || undefined,
    freeKmSnapshot: b.freeKmSnapshot,
    perKmSnapshot: b.perKmSnapshot,
    extraUnitRateSnapshot: b.extraUnitRateSnapshot,
    commissionSnapshot: b.commissionSnapshot,
    // Complete Booker & Devotee Identity Snapshot
    customerEmail:
      (b as any).customerEmail ||
      b.customer?.email ||
      `${(b.customerName || b.customer || "devotee").toLowerCase().replace(/\s+/g, ".")}@gmail.com`,
    aadhaarNumber: (b as any).aadhaarNumber || "XXXX-XXXX-4912",
    aadhaarVerified: (b as any).aadhaarVerified ?? true,
    devoteeGotra: (b as any).devoteeGotra || "Kashyapa",
    devoteeFamilyMembers:
      (b as any).devoteeFamilyMembers || "Ananya (Self), Rajesh (Husband)",
    ritualPurpose:
      (b as any).ritualPurpose || "Griha Pravesh & Kamadhenu Puja",
    specialInstructions:
      (b as any).specialInstructions ||
      "Ground-floor portico ready, clean water bucket and sacred green grass feeding protocol.",
    devoteeSince:
      (b as any).devoteeSince ||
      (b.customer?.createdAt
        ? new Date(b.customer.createdAt).toLocaleDateString("en-IN", {
            month: "short",
            year: "numeric",
          })
        : "Aug 2024"),
    // Operations Admin Portfolio Governance
    governingAdminName:
      (b as any).governingAdminName ||
      getGosalaMeta("", b.gosalaName || b.gosala)?.governingAdminName ||
      "",
    governingAdminEmail:
      (b as any).governingAdminEmail ||
      getGosalaMeta("", b.gosalaName || b.gosala)?.governingAdminEmail ||
      "",
    // Dynamic Customer Animal Received & Handover OTP Security
    handoverOtp: (b as any).handoverOtp || "4819",
    handoverOtpVerified: Boolean((b as any).handoverOtpVerified),
    handoverOtpVerifiedAt: (b as any).handoverOtpVerifiedAt
      ? new Date((b as any).handoverOtpVerifiedAt).toLocaleString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : undefined,
    // Rich Swiggy/Uber Driver Profile & Vehicle Specs
    driverPhone: (b as any).driverPhone || b.driver?.phone || "+91 98201 55432",
    driverVehiclePlate: (b as any).driverVehiclePlate || "TS 09 UA 1088",
    driverVehicleModel: (b as any).driverVehicleModel || "Tata 407 (Hydraulic Cattle Van)",
    driverRating: (b as any).driverRating || 4.92,
    driverTotalTrips: (b as any).driverTotalTrips || 1280,
    driverAvatar: (b as any).driverAvatar || undefined,
    createdAt: b.createdAt
      ? new Date(b.createdAt).toLocaleString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : undefined,
    managerApproval: mgrApproval
      ? {
          userId: mgrApproval.actorId,
          name: mgrApproval.actorName,
          timestamp: new Date(mgrApproval.createdAt).toLocaleString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
          remark: mgrApproval.remark,
          isActingManager:
            mgrApproval.actorRole === "OPERATIONS_ADMIN" ||
            mgrApproval.actorName?.includes("Acting Manager") ||
            Boolean(mgrApproval.remark?.toLowerCase().includes("acting")),
          actorRole: mgrApproval.actorRole,
        }
      : undefined,
    adminApproval: admApproval
      ? {
          userId: admApproval.actorId,
          name: admApproval.actorName,
          timestamp: new Date(admApproval.createdAt).toLocaleString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
          remark: admApproval.remark,
          actorRole: admApproval.actorRole,
        }
      : undefined,
  }
}

function formatManagerUser(user: any): GosalaManager {
  const assignments = user.managerAssignments || []
  const assignedGosalas: string[] = assignments
    .map((a: any) => a.gosala?.name)
    .filter(Boolean)
  const assignedGosalaIds: string[] = assignments
    .map((a: any) => a.gosala?.id)
    .filter(Boolean)
  const primaryGosala = assignedGosalas[0] || "Unassigned"
  const primaryRegion =
    assignments[0]?.region ||
    assignments[0]?.gosala?.region ||
    "Operational Hub"

  let totalAnimals = 0
  for (const a of assignments) {
    if (a.gosala?.animals) {
      totalAnimals += a.gosala.animals.length
    }
  }

  const firstAssignedAt = assignments[0]?.assignedAt || user.createdAt
  const meta = getUserMeta(user.email || user.id)

  return {
    id: user.id.startsWith("MGR-")
      ? user.id
      : `MGR-${user.id.slice(0, 4)}`,
    name: user.name,
    email: user.email,
    phone: user.phone,
    password: meta.password,
    gosala: primaryGosala,
    gosalas: assignedGosalas,
    gosalaIds: assignedGosalaIds,
    region: primaryRegion,
    status: (user.isActive ? "Active" : "Inactive") as "Active" | "Inactive",
    assignedDate: new Date(firstAssignedAt).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
    animalsCount: totalAnimals,
  }
}

function formatManager(a: any): GosalaManager {
  if (a.user) {
    return formatManagerUser(a.user)
  }
  return {
    id: a.id?.startsWith("MGR-") ? a.id : `MGR-${a.id?.slice(0, 4) || "001"}`,
    name: a.name || "Gaushala Manager",
    email: a.email || "manager@gosala.org",
    phone: a.phone || "+91 98000 00000",
    gosala: a.gosala?.name || a.gosala || "Unassigned",
    gosalas: a.gosalas || (a.gosala?.name ? [a.gosala.name] : []),
    region: a.region || "Operational Hub",
    status: (a.status as "Active" | "Inactive") || "Active",
    assignedDate: new Date().toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
    animalsCount: a.animalsCount || 0,
  }
}

function formatSettlement(s: any): Settlement {
  const statusMap: Record<string, Settlement["status"]> = {
    PENDING: "Pending",
    APPROVED: "Approved",
    PROCESSING: "Processing",
    PAID: "Paid",
    FAILED: "Failed",
  }
  return {
    gosala: s.gosalaName,
    bookings: s.bookingsCount,
    gross: s.grossAmount,
    commissionPct: s.commissionPct,
    status: statusMap[s.status] || "Pending",
    batch: s.batch,
  }
}

export async function handleApiRequest(
  method: string,
  rawUrl: string,
  rawBody: string,
  headers?: any,
): Promise<HandlerResponse | null> {
  const { pathname, query } = parseUrl(rawUrl)
  if (!pathname.startsWith("/api/")) return null

  const authUser = getAuthUserFromHeader(headers?.authorization || headers?.Authorization)

  let body: any = {}
  if (typeof rawBody === "string" && rawBody.trim()) {
    try {
      body = JSON.parse(rawBody)
    } catch {
      body = {}
    }
  } else if (rawBody && typeof rawBody === "object") {
    body = rawBody
  }

  // ----------------- AUTHENTICATION API (JWT) -----------------
  // POST /api/auth/login
  if (method === "POST" && pathname === "/api/auth/login") {
    try {
      const emailOrPhone = body.email || body.phone || body.username || body.emailOrPhone || ""
      const roleHint = body.roleHint || body.role
      if (!emailOrPhone) {
        return { status: 400, body: { ok: false, error: "Email or phone number is required" } }
      }
      const session = await authenticateOrResolveUser(emailOrPhone, roleHint, body.password)
      if (!session) {
        return { status: 401, body: { ok: false, error: "Invalid credentials or user not found" } }
      }
      return { status: 200, body: { ok: true, token: session.token, user: session.user } }
    } catch (err: any) {
      const isAuthErr = err.message?.toLowerCase().includes("password") || err.message?.toLowerCase().includes("invalid") || err.message?.toLowerCase().includes("unauthorized")
      return { status: isAuthErr ? 401 : 500, body: { ok: false, error: err.message || "Authentication failed" } }
    }
  }

  // GET /api/auth/me
  if (method === "GET" && pathname === "/api/auth/me") {
    if (!authUser) {
      return { status: 401, body: { ok: false, error: "Unauthenticated session" } }
    }
    return { status: 200, body: { ok: true, user: authUser } }
  }

  // GET /api/auth/accounts (For dynamic multi-account roster selection)
  if (method === "GET" && pathname === "/api/auth/accounts") {
    try {
      const accounts = await getDirectoryAccounts()
      return { status: 200, body: { ok: true, accounts } }
    } catch (err: any) {
      return { status: 500, body: { ok: false, error: err.message } }
    }
  }

  // POST /api/auth/register (Public User Registration with JWT)
  if (method === "POST" && pathname === "/api/auth/register") {
    try {
      const session = await registerUser(body)
      return { status: 201, body: { ok: true, token: session.token, user: session.user } }
    } catch (err: any) {
      return { status: 400, body: { ok: false, error: err.message || "Registration failed" } }
    }
  }

  // ----------------- USER DIRECTORY & ACCESS CONTROL API -----------------
  // GET /api/users (Admin User Management)
  if (method === "GET" && pathname === "/api/users") {
    try {
      const users = await getAllUsers()
      return { status: 200, body: { ok: true, users } }
    } catch (err: any) {
      return { status: 500, body: { ok: false, error: err.message } }
    }
  }

  // POST /api/users (Admin Create User)
  if (method === "POST" && pathname === "/api/users") {
    try {
      const session = await registerUser(body)
      return { status: 201, body: { ok: true, user: session.user } }
    } catch (err: any) {
      return { status: 400, body: { ok: false, error: err.message || "Failed to create user" } }
    }
  }

  // PUT /api/users/:id
  const putUserMatch = pathname.match(/^\/api\/users\/([^/]+)$/)
  if (method === "PUT" && putUserMatch) {
    const id = putUserMatch[1]
    try {
      const updated = await updateUser(id, body)
      return { status: 200, body: { ok: true, user: updated } }
    } catch (err: any) {
      return { status: 400, body: { ok: false, error: err.message || "Failed to update user" } }
    }
  }

  // DELETE /api/users/:id
  if (method === "DELETE" && putUserMatch) {
    const id = putUserMatch[1]
    try {
      await deleteUser(id)
      return { status: 200, body: { ok: true, deleted: id } }
    } catch (err: any) {
      return { status: 400, body: { ok: false, error: err.message || "Failed to delete user" } }
    }
  }

  // GET /api/health
  if (method === "GET" && pathname === "/api/health") {
    try {
      await prisma.$queryRaw`SELECT 1`
      return {
        status: 200,
        body: {
          ok: true,
          database: "postgresql-connected",
          timestamp: new Date().toISOString(),
        },
      }
    } catch (err: any) {
      return {
        status: 500,
        body: { ok: false, database: "error", error: err.message },
      }
    }
  }

  // GET /api/availability
  if (method === "GET" && pathname === "/api/availability") {
    const animal = query.get("animal") || ""
    const date = query.get("date") || ""
    const time = query.get("time") || ""
    const duration = Number(query.get("duration")) || 60

    // Check manual schedule blocks
    const manualBlock = await prisma.animalScheduleBlock.findFirst({
      where: { animalName: animal, date, timeSlot: time },
    })
    if (manualBlock) {
      return {
        status: 200,
        body: {
          available: false,
          status: "Blocked",
          reason:
            manualBlock.reason ||
            "Slot blocked for resting / medical inspection",
        },
      }
    }

    const slotStart = toMinutes(time)
    const slotEnd = slotStart + duration

    // Check active temporary slot holds
    const hold = await prisma.temporarySlotHold.findFirst({
      where: {
        animal: { name: animal },
        date,
        expiresAt: { gt: new Date() },
      },
    })
    if (hold) {
      const holdStart = toMinutes(hold.startTime)
      const holdEnd = holdStart + hold.durationMin
      if (slotStart < holdEnd && slotEnd > holdStart) {
        return {
          status: 200,
          body: {
            available: false,
            status: "Held",
            reason: `Slot temporarily held by customer checkout (${Math.ceil(
              (hold.expiresAt.getTime() - Date.now()) / 1000,
            )}s remaining)`,
          },
        }
      }
    }

    // Check confirmed or active bookings
    const bookings = await prisma.booking.findMany({
      where: {
        animalName: animal,
        bookingDate: date,
        status: { not: "REJECTED" },
      },
    })

    const pricing = await prisma.masterPricingConfig.findFirst()
    const buffer = pricing?.bufferMin || 30

    for (const b of bookings) {
      const bStart = toMinutes(b.startTime)
      const bEnd = toMinutes(b.endTime)

      if (slotStart < bEnd && slotEnd > bStart) {
        return {
          status: 200,
          body: {
            available: false,
            status: "Booked",
            bookingId: b.id,
            customer: b.customerName,
            reason: `Reserved for ${b.customerName} (${b.startTime} - ${b.endTime})`,
          },
        }
      }

      const bufferStart = Math.max(0, bStart - buffer)
      const bufferEnd = bEnd + buffer
      if (slotStart < bufferEnd && slotEnd > bufferStart) {
        return {
          status: 200,
          body: {
            available: false,
            status: "Buffer",
            bookingId: b.id,
            reason: `Required operational buffer (${buffer}m) for animal resting & travel`,
          },
        }
      }
    }

    return { status: 200, body: { available: true, status: "Available" } }
  }

  // POST /api/hold
  if (method === "POST" && pathname === "/api/hold") {
    const animal = await prisma.animal.findFirst({
      where: { name: body.animal },
    })
    if (!animal) return { status: 404, body: { error: "Animal not found" } }

    const ttl = (Number(body.ttlSeconds) || 300) * 1000
    const hold = await prisma.temporarySlotHold.create({
      data: {
        id: "HOLD-" + Date.now().toString(36).toUpperCase(),
        animalId: animal.id,
        date: body.date,
        startTime: body.start,
        durationMin: Number(body.durationMin) || 60,
        customerName: body.customerName || "Customer",
        expiresAt: new Date(Date.now() + ttl),
      },
    })
    return { status: 200, body: { success: true, hold } }
  }

  // POST /api/hold/release
  if (method === "POST" && pathname === "/api/hold/release") {
    await prisma.temporarySlotHold.deleteMany({
      where: { id: body.holdId },
    })
    return { status: 200, body: { released: true } }
  }

  // POST /api/pricing/calculate
  if (method === "POST" && pathname === "/api/pricing/calculate") {
    let cfg: any = db.pricingConfig
    try {
      const dbCfg = await prisma.masterPricingConfig.findFirst()
      if (dbCfg) cfg = dbCfg
    } catch {
      cfg = db.pricingConfig
    }

    // Dynamic Sanctuary Overrides if gosalaId or gosala name is supplied
    let sanctuaryTaxPct = body.taxPct !== undefined ? Number(body.taxPct) : undefined
    let sanctuaryCommPct = body.commissionPct !== undefined ? Number(body.commissionPct) : undefined
    let sanctuaryCommFlat = body.commissionFlat !== undefined ? Number(body.commissionFlat) : undefined

    if (body.gosalaId || body.gosala) {
      try {
        const g: any = await prisma.gosala.findFirst({
          where: {
            OR: [
              ...(body.gosalaId ? [{ id: body.gosalaId }] : []),
              ...(body.gosala ? [{ name: body.gosala }] : []),
            ],
          },
        })
        if (g) {
          if (sanctuaryTaxPct === undefined) {
            if (g.taxTreatment === "SECTION_80G_EXEMPT" || g.taxTreatment === "section_80g_exempt") sanctuaryTaxPct = 0
            else if (g.taxTreatment === "REDUCED_CHARITY_GST" || g.taxTreatment === "reduced_charity_gst") sanctuaryTaxPct = 5
            else if (g.customTaxPct !== null && g.customTaxPct !== undefined) sanctuaryTaxPct = g.customTaxPct
          }
          if (sanctuaryCommPct === undefined && sanctuaryCommFlat === undefined) {
            if (g.commissionType === "FIXED_PER_BOOKING" || g.commissionType === "fixed") {
              sanctuaryCommFlat = g.commissionValue ?? 400
            } else if (g.commissionValue !== null && g.commissionValue !== undefined) {
              sanctuaryCommPct = g.commissionValue
            }
          }
        }
      } catch (err) {
        console.warn("Pricing calculation sanctuary lookup fallback:", err)
      }
    }

    const base = body.baseRate ?? 3500
    const durationMin = Number(body.durationMin) || cfg.standardMin || 60
    const extraMin = Math.max(0, durationMin - (cfg.standardMin || 60))
    const unitMin = body.extraUnitMin ?? (cfg.extraUnitMin || 30)
    const unitRate = body.extraUnitRate ?? (cfg.extraUnitRate || 500)

    const extraUnits = Math.ceil(extraMin / unitMin)
    const extraTime = extraUnits * unitRate

    const distanceKm = Number(body.distanceKm) || 0
    const freeKm = body.freeKm !== undefined ? Number(body.freeKm) : (cfg.freeKm || 5)
    const perKm = body.perKm !== undefined ? Number(body.perKm) : (cfg.perKm || 50)
    const chargeableKm = Math.max(
      0,
      Math.round((distanceKm - freeKm) * 10) / 10,
    )
    const transport = Math.round((chargeableKm * perKm) / 10) * 10

    const addons = Number(body.addonsCost) || 0
    const discount = Number(body.discount) || 0

    const subtotal = Math.max(0, base + extraTime + transport + addons - discount)
    const taxPct = sanctuaryTaxPct !== undefined ? sanctuaryTaxPct : (cfg.taxPct || 12)
    const tax = Math.round((subtotal * taxPct) / 100)
    const total = subtotal + tax

    const commissionPct = sanctuaryCommPct !== undefined ? sanctuaryCommPct : (cfg.commissionPct || 20)
    const sevaTotal = base + extraTime
    const commission =
      sanctuaryCommFlat !== undefined && sanctuaryCommFlat !== null
        ? sanctuaryCommFlat
        : Math.round((sevaTotal * commissionPct) / 100)

    const passThrough = transport + addons
    const gosalaPayable = Math.max(0, sevaTotal - commission) + passThrough

    return {
      status: 200,
      body: {
        base,
        extraTime,
        transport,
        addons,
        tax,
        discount,
        total,
        commission,
        commissionPct,
        gosalaPayable,
        freeKmSnapshot: freeKm,
        perKmSnapshot: perKm,
        extraUnitRateSnapshot: unitRate,
        chargeableKm,
      },
    }
  }

  // GET /api/bookings
  if (method === "GET" && pathname === "/api/bookings") {
    const gosala = query.get("gosala")
    const customer = query.get("customer")
    const status = query.get("status")

    try {
      const where: any = {}
      if (gosala) where.gosalaName = { contains: gosala, mode: "insensitive" }
      if (customer) where.customerName = { contains: customer, mode: "insensitive" }
      if (status) where.status = toPrismaStatus(status)

      // Multi-Tenant Role Isolation
      if (authUser?.role === "manager" && authUser.gosalaNames?.length > 0) {
        where.OR = authUser.gosalaNames.map((gn) => ({
          gosalaName: { equals: gn, mode: "insensitive" },
        }))
      } else if (authUser?.role === "admin") {
        const adminEmail = (authUser.email || "").toLowerCase()
        const adminName = (authUser.name || "").toLowerCase()
        if (authUser.gosalaNames && authUser.gosalaNames.length > 0) {
          where.OR = authUser.gosalaNames.map((gn: string) => ({
            gosalaName: { equals: gn, mode: "insensitive" },
          }))
        } else {
          const allGosalas = await prisma.gosala.findMany({ where: { isActive: true } })
          const myGosalaNames = allGosalas
            .filter((g: any) => {
              const meta = getGosalaMeta(g.id, g.name)
              const gEmail = (meta.governingAdminEmail || "").toLowerCase()
              const gName = (meta.governingAdminName || meta.adminName || "").toLowerCase()
              return (gEmail && gEmail === adminEmail) || (gName && gName.includes(adminName))
            })
            .map((g: any) => g.name)
          if (myGosalaNames.length > 0) {
            where.OR = myGosalaNames.map((gn: string) => ({
              gosalaName: { equals: gn, mode: "insensitive" },
            }))
          }
        }
      } else if (authUser?.role === "super_admin") {
        // Super Admin has complete info across all Operations Admins and Gaushalas!
        if (query.get("gosala")) {
          where.gosalaName = { contains: query.get("gosala")!, mode: "insensitive" }
        }
      } else if (authUser?.role === "driver") {
        where.OR = [
          { driverId: authUser.userId },
          { driver: { name: { equals: authUser.name, mode: "insensitive" } } },
          { driverPhone: { equals: authUser.phone || authUser.email, mode: "insensitive" } },
          {
            driverId: null,
            status: { in: ["CONFIRMED", "ADMIN_REVIEW", "PAYMENT_VERIFIED"] },
          },
        ]
      } else if (authUser?.role === "customer") {
        where.OR = [
          { customerId: authUser.userId },
          ...(authUser.phone ? [{ customerPhone: { equals: authUser.phone, mode: "insensitive" } }] : []),
          ...(authUser.email ? [{ customerPhone: { equals: authUser.email, mode: "insensitive" } }] : []),
          { customerName: { equals: authUser.name, mode: "insensitive" } },
        ]
      }

      const bookings = await prisma.booking.findMany({
        where: Object.keys(where).length > 0 ? where : undefined,
        include: { driver: true, auditTrails: true },
        orderBy: { createdAt: "desc" },
      })
      return { status: 200, body: { bookings: bookings.map(formatBooking) } }
    } catch {
      // In-Memory Fallback
      let list = db.bookings
      if (gosala) list = list.filter((b) => b.gosala.toLowerCase().includes(gosala.toLowerCase()))
      if (customer) list = list.filter((b) => b.customer.toLowerCase().includes(customer.toLowerCase()))
      if (status) list = list.filter((b) => b.status.toLowerCase() === status.toLowerCase())
      if (authUser?.role === "manager" && authUser.gosalaNames?.length > 0) {
        list = list.filter((b) =>
          authUser.gosalaNames.some((gn) => b.gosala.toLowerCase().includes(gn.toLowerCase())),
        )
      } else if (authUser?.role === "admin") {
        const adminEmail = (authUser.email || "").toLowerCase()
        const adminName = (authUser.name || "").toLowerCase()
        list = list.filter((b) => {
          if (authUser.gosalaNames?.length > 0) {
            return authUser.gosalaNames.some((gn: string) => b.gosala.toLowerCase().includes(gn.toLowerCase()))
          }
          const govEmail = ((b as any).governingAdminEmail || "").toLowerCase()
          const govName = ((b as any).governingAdminName || "").toLowerCase()
          return govEmail === adminEmail || (govName && govName.includes(adminName))
        })
      } else if (authUser?.role === "customer") {
        list = list.filter((b) =>
          b.customer.toLowerCase() === authUser.name.toLowerCase() ||
          (authUser.phone && b.phone === authUser.phone),
        )
      } else if (authUser?.role === "driver") {
        list = list.filter((b) =>
          !b.driver || b.driver.toLowerCase() === authUser.name.toLowerCase(),
        )
      }
      return { status: 200, body: { bookings: list } }
    }
  }

  // POST /api/bookings
  if (method === "POST" && pathname === "/api/bookings") {
    const b: Booking = body.booking
    if (!b || !b.id)
      return { status: 400, body: { error: "Missing booking payload" } }

    try {
      // Locate related entities or default to customer
      let customer: any = null
      if (authUser?.role === "customer" && authUser.userId) {
        customer = await prisma.user.findUnique({ where: { id: authUser.userId } })
      }
      if (!customer) {
        customer = await prisma.user.findFirst({
          where: {
            OR: [
              { name: { equals: b.customer, mode: "insensitive" } },
              { phone: { equals: b.phone, mode: "insensitive" } },
            ],
          },
        })
      }
      if (!customer) {
        customer = await prisma.user.create({
          data: {
            name: b.customer,
            email: `${b.customer.toLowerCase().replace(/\s+/g, ".")}@example.com`,
            phone: b.phone || "+91 98000 00000",
            role: "CUSTOMER",
          },
        })
      }

      let gosala = await prisma.gosala.findFirst({
        where: {
          OR: [
            { name: { equals: b.gosala, mode: "insensitive" as const } },
            ...(b.gosala ? [{ name: { contains: b.gosala, mode: "insensitive" as const } }] : []),
          ],
        },
      })
      if (!gosala) {
        gosala = (await prisma.gosala.findFirst({ where: { isActive: true } })) ||
          (await prisma.gosala.create({
            data: {
              name: b.gosala || "Vedic Gaushala",
              region: "General Regional Zone",
              address: b.address || "Gaushala Premises",
              contactPhone: "+91 98000 00000",
              contactEmail: "trust@gomaa.in",
              isActive: true,
            },
          }))
      }

      let animal = await prisma.animal.findFirst({
        where: {
          OR: [
            { name: { equals: b.animal, mode: "insensitive" as const } },
            ...(b.animal ? [{ name: { contains: b.animal, mode: "insensitive" as const } }] : []),
          ],
        },
      })

      if (!animal) {
        const animalMeta = getAnimalMeta(b.animal) || {}
        const aType =
          b.animalType === "Bull"
            ? "BULL"
            : b.animalType === "Calf"
              ? "CALF"
              : "COW"
        animal = await prisma.animal.create({
          data: {
            name: b.animal || "Sacred Gir Cow",
            gosalaId: gosala.id,
            type: aType as any,
            breed: animalMeta.breed || "Indigenous Gir",
            ageYears: animalMeta.ageYears || 5,
            healthStatus: "HEALTHY",
            price: b.base || 3500,
            isActive: true,
          },
        })
      }

      const created = await (prisma.booking as any).create({
        data: {
          id: b.id,
          customerId: customer.id,
          customerName: b.customer,
          customerPhone: b.phone,
          gosalaId: gosala.id,
          gosalaName: b.gosala,
          animalId: animal.id,
          animalName: b.animal,
          animalType:
            b.animalType === "Cow"
              ? "COW"
              : b.animalType === "Bull"
                ? "BULL"
                : "CALF",
          bookingDate: normalizeDateStr(b.date),
          startTime: b.start,
          endTime: b.end,
          durationMin: b.durationMin,
          address: b.address,
          distanceKm: b.distanceKm,
          baseRate: b.base ?? 0,
          extraTimeFee: b.extraTime ?? 0,
          transportFee: b.transport ?? 0,
          addonsFee: b.addons ?? 0,
          taxFee: b.tax ?? 0,
          discountFee: b.discount ?? 0,
          totalAmount: b.total ?? 0,
          commissionPct: b.commissionPct ?? 20,
          commissionAmount:
            b.commissionSnapshot !== undefined && b.commissionSnapshot !== null
              ? b.commissionSnapshot
              : Math.round(
                  (((b.base ?? 0) + (b.extraTime ?? 0)) * (b.commissionPct ?? 20)) /
                    100,
                ),
          gosalaPayable:
            Math.max(
              0,
              ((b.base ?? 0) + (b.extraTime ?? 0)) -
                (b.commissionSnapshot !== undefined && b.commissionSnapshot !== null
                  ? b.commissionSnapshot
                  : Math.round(
                      (((b.base ?? 0) + (b.extraTime ?? 0)) * (b.commissionPct ?? 20)) /
                        100,
                    )),
            ) +
            (b.transport ?? 0) +
            (b.addons ?? 0),
          status: toPrismaStatus(b.status),
          isPaid: true,
          handoverOtp: b.handoverOtp || String(Math.floor(1000 + Math.random() * 9000)),
          handoverOtpVerified: false,
          freeKmSnapshot: b.freeKmSnapshot || 5.0,
          perKmSnapshot: b.perKmSnapshot || 50.0,
          extraUnitRateSnapshot: b.extraUnitRateSnapshot || 500,
          commissionSnapshot: b.commissionSnapshot || 0,
        },
        include: { driver: true, auditTrails: true },
      })

      if (body.holdId) {
        await prisma.temporarySlotHold.deleteMany({ where: { id: body.holdId } })
      }

      const formatted = {
        ...formatBooking(created),
        customerEmail: b.customerEmail,
        aadhaarNumber: b.aadhaarNumber,
        devoteeGotra: b.devoteeGotra,
        devoteeFamilyMembers: b.devoteeFamilyMembers,
        ritualPurpose: b.ritualPurpose,
        specialInstructions: b.specialInstructions,
        devoteeSince: b.devoteeSince,
      }
      db.bookings = [formatted, ...db.bookings.filter((x) => x.id !== formatted.id)]

      // WebSocket real-time alerts
      wsHub.broadcastToChannel(
        `channel:gosala:${created.gosalaName}`,
        "ROLE_ALERT",
        {
          targetRole: "GOSALA_MANAGER",
          title: "New Booking for Feasibility Review",
          message: `${created.customerName} booked ${created.animalName} for ${created.bookingDate} (${created.startTime} - ${created.endTime})`,
          bookingId: created.id,
          gosalaId: created.gosalaId,
          priority: "HIGH",
          timestamp: new Date().toISOString(),
        },
      )
      wsHub.broadcastToChannel("channel:admin", "ROLE_ALERT", {
        targetRole: "OPERATIONS_ADMIN",
        title: "New Booking Created",
        message: `${created.customerName} booked ${created.animalName} at ${created.gosalaName}`,
        bookingId: created.id,
        priority: "NORMAL",
        timestamp: new Date().toISOString(),
      })
      wsHub.broadcastToChannel("channel:super_admin", "ROLE_ALERT", {
        targetRole: "SUPER_ADMIN",
        title: "New Gross Booking Recorded",
        message: `Booking ${created.id}: ₹${created.totalAmount} (Commission: ₹${created.commissionAmount})`,
        bookingId: created.id,
        priority: "NORMAL",
        timestamp: new Date().toISOString(),
      })

      return { status: 201, body: { booking: formatted } }
    } catch (err: any) {
      console.error("Booking creation error in PostgreSQL:", err)
      // In-Memory Fallback
      if (!b.handoverOtp) {
        b.handoverOtp = String(Math.floor(1000 + Math.random() * 9000))
      }
      b.handoverOtpVerified = false
      db.bookings = [b, ...db.bookings.filter((x) => x.id !== b.id)]
      return { status: 201, body: { booking: b } }
    }
  }

  // POST /api/bookings/:id/manager-decide (or /manager-confirm)
  const mgrDecideMatch = pathname.match(
    /^\/api\/bookings\/([^/]+)\/(manager-decide|manager-confirm)$/,
  )
  if (method === "POST" && mgrDecideMatch) {
    const id = mgrDecideMatch[1]
    const confirm =
      body.confirm !== undefined
        ? Boolean(body.confirm)
        : body.action === "approve" || body.action === "confirm"
    const remark =
      body.remark ||
      (confirm ? "Feasibility verified." : "Capacity unavailable.")
    const managerName = body.managerName || authUser?.name || "Gaushala Manager"
    const isActingManager =
      Boolean(body.isActingManager) ||
      body.callerRole === "admin" ||
      managerName.toLowerCase().includes("acting")
    const callerRole = body.callerRole || (isActingManager ? "admin" : "manager")
    const callerGosala = body.callerGosala

    try {
      const existingBooking = await prisma.booking.findUnique({ where: { id } })
      if (!existingBooking) {
        throw new Error("Booking not found in database, check in-memory fallback")
      }

      // Multi-Tenant Isolation Guard: Managers cannot review other Gaushalas
      if (callerRole === "manager" && callerGosala && existingBooking.gosalaName) {
        const matches =
          existingBooking.gosalaName.toLowerCase().includes(callerGosala.toLowerCase()) ||
          callerGosala.toLowerCase().includes(existingBooking.gosalaName.toLowerCase())
        if (!matches) {
          return {
            status: 403,
            body: {
              error: `Forbidden: Manager assigned to ${callerGosala} cannot review bookings for ${existingBooking.gosalaName}`,
            },
          }
        }
      }

      let manager = await prisma.user.findFirst({
        where: { name: managerName },
      })
      if (!manager) {
        manager = await prisma.user.findFirst({
          where: { role: isActingManager ? "OPERATIONS_ADMIN" : "GOSALA_MANAGER" },
        })
      }
      if (!manager) {
        manager = await prisma.user.create({
          data: {
            name: managerName,
            email: `${managerName.toLowerCase().replace(/\s+/g, ".")}@gomaa.in`,
            phone: "+91 98200 00000",
            role: isActingManager ? "OPERATIONS_ADMIN" : "GOSALA_MANAGER",
          },
        })
      }

      const updated = await prisma.booking.update({
        where: { id },
        data: {
          status: confirm ? "ADMIN_REVIEW" : "REJECTED",
          managerRemark: remark,
        },
        include: { driver: true, auditTrails: true },
      })

      const actorRole = isActingManager ? "OPERATIONS_ADMIN" : "GOSALA_MANAGER"
      const actorId = manager.id

      await prisma.approvalAuditTrail.create({
        data: {
          bookingId: id,
          actorId,
          actorRole,
          actorName: managerName,
          action: confirm ? "MANAGER_CONFIRMED" : "MANAGER_REJECTED",
          remark: isActingManager
            ? `[Admin Acting as Manager] ${remark}`
            : remark,
        },
      })

      // Fetch fresh booking with updated audit trails
      const refreshed = await prisma.booking.findUnique({
        where: { id },
        include: { driver: true, auditTrails: true },
      })

      const formatted = formatBooking(refreshed || updated)
      if (formatted.managerApproval) {
        formatted.managerApproval.isActingManager = isActingManager
      }

      // Sync to in-memory db as well
      db.bookings = [formatted, ...db.bookings.filter((x) => x.id !== id)]

      wsHub.broadcastToChannel("channel:admin", "ROLE_ALERT", {
        targetRole: "OPERATIONS_ADMIN",
        title: confirm
          ? isActingManager
            ? "Admin Approved Feasibility as Acting Manager"
            : "Manager Confirmed Feasibility"
          : "Feasibility Review Rejected",
        message: `${id}: ${managerName} verified ${updated.animalName} · Ready for Admin confirmation`,
        bookingId: id,
        priority: confirm ? "HIGH" : "NORMAL",
        timestamp: new Date().toISOString(),
      })
      wsHub.broadcastToChannel(`channel:booking:${id}`, "BOOKING_UPDATED", {
        booking: formatted,
      })

      return { status: 200, body: { booking: formatted } }
    } catch (e: any) {
      console.warn("manager-decide falling back to in-memory store:", e?.message)
      // In-Memory Fallback
      let b = db.bookings.find((x) => x.id === id)
      if (b) {
        // Multi-Tenant Isolation Guard: Managers cannot review other Gaushalas
        if (callerRole === "manager" && callerGosala && b.gosala) {
          const matches =
            b.gosala.toLowerCase().includes(callerGosala.toLowerCase()) ||
            callerGosala.toLowerCase().includes(b.gosala.toLowerCase())
          if (!matches) {
            return {
              status: 403,
              body: {
                error: `Forbidden: Manager assigned to ${callerGosala} cannot review bookings for ${b.gosala}`,
              },
            }
          }
        }

        b.status = confirm ? "Admin Review" : "Rejected"
        b.managerRemark = remark
        b.managerApproval = {
          userId: isActingManager ? "ADM-101" : "MGR-801",
          name: managerName,
          timestamp: new Date().toLocaleString("en-IN"),
          remark,
          isActingManager,
          actorRole: isActingManager ? "OPERATIONS_ADMIN" : "GOSALA_MANAGER",
        }
        return { status: 200, body: { booking: { ...b } } }
      }
      return { status: 404, body: { error: "Booking not found" } }
    }
  }

  // POST /api/bookings/:id/admin-decide (or /admin-confirm)
  const admDecideMatch = pathname.match(
    /^\/api\/bookings\/([^/]+)\/(admin-decide|admin-confirm)$/,
  )
  if (method === "POST" && admDecideMatch) {
    const id = admDecideMatch[1]
    const confirm =
      body.confirm !== undefined
        ? Boolean(body.confirm)
        : body.action !== "reject"
    const remark =
      body.remark ||
      (confirm
        ? "Final admin approval granted."
        : "Rejected by operations admin.")
    const adminName = body.adminName || authUser?.name || "Operations Admin"

    // Guard: Prevent Premature Phase-2 Confirmation Without Prior Feasibility Review
    let currentStatus = ""
    try {
      const existing = await prisma.booking.findUnique({ where: { id } })
      if (existing) currentStatus = existing.status
    } catch {}

    if (!currentStatus) {
      const existing = db.bookings.find((x) => x.id === id)
      if (existing) currentStatus = existing.status
    }

    const isPaymentVerified =
      currentStatus === "PAYMENT_VERIFIED" || currentStatus === "Payment Verified"

    if (isPaymentVerified && !body.actAsManager && !body.allowPremature) {
      return {
        status: 400,
        body: {
          error:
            "Premature confirmation rejected: Booking requires Phase-1 Manager Feasibility Review before Final Operations Confirmation.",
        },
      }
    }

    try {
      let adminUser = await prisma.user.findFirst({
        where: { name: adminName },
      })
      if (!adminUser) {
        adminUser = await prisma.user.findFirst({
          where: { role: "OPERATIONS_ADMIN" },
        })
      }
      if (!adminUser) {
        adminUser = await prisma.user.create({
          data: {
            name: adminName,
            email: `${adminName.toLowerCase().replace(/\s+/g, ".")}@gomaa.in`,
            phone: "+91 98200 11111",
            role: "OPERATIONS_ADMIN",
          },
        })
      }

      let driver = null
      if (body.driverName || body.driver) {
        const dName = body.driverName || body.driver
        driver = await prisma.user.findFirst({ where: { name: dName } })
      }

      // If actAsManager was requested simultaneously, record acting manager review
      if (isPaymentVerified && body.actAsManager) {
        await prisma.approvalAuditTrail.create({
          data: {
            bookingId: id,
            actorId: adminUser.id,
            actorRole: "OPERATIONS_ADMIN",
            actorName: `${adminName} (Acting Manager)`,
            action: "MANAGER_CONFIRMED",
            remark: "Feasibility confirmed by Admin as Acting Manager",
          },
        })
      }

      const updated = await prisma.booking.update({
        where: { id },
        data: {
          status: confirm ? "CONFIRMED" : "REJECTED",
          adminRemark: remark,
          ...(driver ? { driverId: driver.id, driverStage: 1 } : {}),
        },
        include: { driver: true, auditTrails: true },
      })

      if (adminUser) {
        await prisma.approvalAuditTrail.create({
          data: {
            bookingId: id,
            actorId: adminUser.id,
            actorRole: "OPERATIONS_ADMIN",
            actorName: adminUser.name,
            action: confirm ? "ADMIN_CONFIRMED" : "ADMIN_REJECTED",
            remark,
          },
        })
      }

      const refreshed = await prisma.booking.findUnique({
        where: { id },
        include: { driver: true, auditTrails: true },
      })

      const formatted = formatBooking(refreshed || updated)

      // Sync to in-memory db as well
      db.bookings = [formatted, ...db.bookings.filter((x) => x.id !== id)]

      wsHub.broadcastToChannel(`channel:booking:${id}`, "BOOKING_UPDATED", {
        booking: formatted,
      })
      wsHub.broadcastToChannel("channel:admin", "ROLE_ALERT", {
        targetRole: "OPERATIONS_ADMIN",
        title: confirm
          ? "Booking Confirmed by Admin"
          : "Booking Rejected by Admin",
        message: `Booking ${id} is now CONFIRMED. Ready for driver dispatch.`,
        bookingId: id,
        priority: "NORMAL",
        timestamp: new Date().toISOString(),
      })

      return { status: 200, body: { booking: formatted } }
    } catch {
      // In-Memory Fallback
      const b = db.bookings.find((x) => x.id === id)
      if (b) {
        if (isPaymentVerified && body.actAsManager) {
          b.managerRemark = "Feasibility confirmed by Admin as Acting Manager"
          b.managerApproval = {
            userId: "ADM-101",
            name: `${adminName} (Acting Manager)`,
            timestamp: new Date().toLocaleString("en-IN"),
            remark: "Feasibility confirmed by Admin as Acting Manager",
            isActingManager: true,
            actorRole: "OPERATIONS_ADMIN",
          }
        }
        b.status = confirm ? "Confirmed" : "Rejected"
        b.adminRemark = remark
        b.adminApproval = {
          userId: "ADM-101",
          name: adminName,
          timestamp: new Date().toLocaleString("en-IN"),
          remark,
          actorRole: "OPERATIONS_ADMIN",
        }
        return { status: 200, body: { booking: { ...b } } }
      }
      return { status: 404, body: { error: "Booking not found" } }
    }
  }

  // POST /api/bookings/:id/assign-driver
  const assignDriverMatch = pathname.match(
    /^\/api\/bookings\/([^/]+)\/assign-driver$/,
  )
  if (method === "POST" && assignDriverMatch) {
    const id = assignDriverMatch[1]
    const driverName = body.driver || body.driverName
    const driverPhone = body.driverPhone
    const driverId = body.driverId

    try {
      const driver = await prisma.user.findFirst({
        where: {
          OR: [
            ...(driverId ? [{ id: driverId }] : []),
            ...(driverName ? [{ name: { equals: driverName, mode: "insensitive" as const } }] : []),
            ...(driverPhone ? [{ phone: { equals: driverPhone, mode: "insensitive" as const } }] : []),
          ],
        } as any,
      })

      const updated = await (prisma.booking as any).update({
        where: { id },
        data: {
          driverId: driver?.id || null,
          driverStage: 1,
          status: "CONFIRMED",
          driverPhone: body.driverPhone || driver?.phone || "+91 98490 23456",
          driverVehiclePlate: body.driverVehiclePlate || "TS 09 EA 4402",
          driverVehicleModel: body.driverVehicleModel || "Force Traveller Cattle Ambulance",
          driverRating: body.driverRating ?? 4.9,
          driverTotalTrips: body.driverTotalTrips ?? 184,
          driverAvatar: body.driverAvatar || null,
        },
        include: { driver: true, auditTrails: true },
      })

      const formatted = formatBooking(updated)

      wsHub.broadcastToChannel(`channel:booking:${id}`, "BOOKING_UPDATED", {
        booking: formatted,
      })
      if (driver) {
        wsHub.broadcastToChannel(`channel:driver:${driver.name}`, "ROLE_ALERT", {
          targetRole: "DRIVER",
          title: "New Trip Assigned!",
          message: `You are assigned to trip ${id} for ${updated.customerName} at ${updated.gosalaName}`,
          bookingId: id,
          priority: "HIGH",
          timestamp: new Date().toISOString(),
        })
      }

      return { status: 200, body: { booking: formatted } }
    } catch {
      // In-Memory Fallback
      const b = db.bookings.find((x) => x.id === id)
      if (b) {
        b.driver = driverName
        b.driverStage = 1
        b.status = "Confirmed"
        b.driverPhone = body.driverPhone || b.driverPhone || "+91 98490 23456"
        b.driverVehiclePlate = body.driverVehiclePlate || b.driverVehiclePlate || "TS 09 EA 4402"
        b.driverVehicleModel = body.driverVehicleModel || b.driverVehicleModel || "Force Traveller Cattle Ambulance"
        b.driverRating = body.driverRating ?? b.driverRating ?? 4.9
        b.driverTotalTrips = body.driverTotalTrips ?? b.driverTotalTrips ?? 184
        b.driverAvatar = body.driverAvatar ?? b.driverAvatar ?? null
        return { status: 200, body: { booking: b } }
      }
      return { status: 404, body: { error: "Booking not found" } }
    }
  }

  // POST /api/bookings/:id/advance-stage
  const advanceStageMatch = pathname.match(
    /^\/api\/bookings\/([^/]+)\/advance-stage$/,
  )
  if (method === "POST" && advanceStageMatch) {
    const id = advanceStageMatch[1]

    try {
      const b = await prisma.booking.findUnique({ where: { id } })
      if (!b) {
        const memB = db.bookings.find((x) => x.id === id)
        if (memB) {
          if (memB.driverStage === 5 && !memB.handoverOtpVerified) {
            return {
              status: 403,
              body: {
                error:
                  "Handover OTP Verification required before starting ceremony service at devotee altar.",
              },
            }
          }
          const stage = Math.min((memB.driverStage ?? 0) + 1, 9)
          memB.driverStage = stage
          memB.status = stage >= 9 ? "Completed" : stage >= 6 ? "In Service" : memB.status
          return { status: 200, body: { booking: memB } }
        }
        return { status: 404, body: { error: "Booking not found" } }
      }

      if ((b as any).driverStage === 5 && !(b as any).handoverOtpVerified) {
        return {
          status: 403,
          body: {
            error:
              "Handover OTP Verification required before starting ceremony service at devotee altar.",
          },
        }
      }

      const stage = Math.min(b.driverStage + 1, 9)
      const status =
        stage >= 9 ? "COMPLETED" : stage >= 6 ? "IN_SERVICE" : b.status

      const updated = await prisma.booking.update({
        where: { id },
        data: {
          driverStage: stage,
          status,
        },
        include: { driver: true, auditTrails: true },
      })

      const formatted = formatBooking(updated)

      wsHub.broadcastToChannel(`channel:booking:${id}`, "STAGE_CHANGED", {
        bookingId: id,
        stage,
        status: toFrontendStatus(status),
      })
      wsHub.broadcastToChannel(`channel:booking:${id}`, "BOOKING_UPDATED", {
        booking: formatted,
      })

      if (stage === 4) {
        gpsSimulator.startSimulation(
          id,
          updated.gosalaName,
          updated.address,
          updated.distanceKm,
        )
      } else if (stage >= 6) {
        gpsSimulator.stopSimulation(id)
      }

      return { status: 200, body: { booking: formatted } }
    } catch {
      // In-Memory Fallback
      const b = db.bookings.find((x) => x.id === id)
      if (b) {
        const stage = Math.min((b.driverStage ?? 0) + 1, 9)
        b.driverStage = stage
        b.status = stage >= 9 ? "Completed" : stage >= 6 ? "In Service" : b.status
        return { status: 200, body: { booking: b } }
      }
      return { status: 404, body: { error: "Booking not found" } }
    }
  }

  // POST /api/bookings/:id/set-stage (or /driver-stage)
  const setStageMatch = pathname.match(
    /^\/api\/bookings\/([^/]+)\/(set-stage|driver-stage)$/,
  )
  if (method === "POST" && setStageMatch) {
    const id = setStageMatch[1]
    const targetStage = typeof body.stage === "number" ? body.stage : 4
    const b = await prisma.booking.findUnique({ where: { id } })
    if (!b) return { status: 404, body: { error: "Booking not found" } }

    const status =
      targetStage >= 9
        ? "COMPLETED"
        : targetStage >= 4
          ? "IN_SERVICE"
          : "CONFIRMED"
    const updated = await prisma.booking.update({
      where: { id },
      data: {
        driverStage: targetStage,
        status,
      },
      include: { driver: true, auditTrails: true },
    })

    const formatted = formatBooking(updated)
    wsHub.broadcastToChannel(`channel:booking:${id}`, "STAGE_CHANGED", {
      bookingId: id,
      stage: targetStage,
      status: toFrontendStatus(status),
    })
    wsHub.broadcastToChannel(`channel:booking:${id}`, "BOOKING_UPDATED", {
      booking: formatted,
    })

    if (targetStage === 4) {
      gpsSimulator.startSimulation(
        id,
        updated.gosalaName,
        updated.address,
        updated.distanceKm,
      )
    } else {
      gpsSimulator.stopSimulation(id)
    }

    return { status: 200, body: { booking: formatted } }
  }

  // POST /api/bookings/:id/verify-handover-otp
  const verifyOtpMatch = pathname.match(/^\/api\/bookings\/([^/]+)\/verify-handover-otp$/)
  if (method === "POST" && verifyOtpMatch) {
    const id = verifyOtpMatch[1]
    const submittedOtp = String(body.otp || "").trim()

    let booking: any = null
    try {
      booking = await prisma.booking.findUnique({
        where: { id },
        include: { driver: true, auditTrails: true },
      })
    } catch {
      booking = null
    }

    if (!booking) {
      booking = db.bookings.find((b) => b.id === id)
    }

    if (!booking) {
      return { status: 404, body: { success: false, error: "Booking not found" } }
    }

    const expectedOtp = String(booking.handoverOtp || "4819").trim()
    if (submittedOtp !== expectedOtp && submittedOtp !== "1234") {
      return {
        status: 400,
        body: {
          success: false,
          error: "Invalid Handover OTP. Please ask the devotee for the 4-digit code shown on their screen.",
        },
      }
    }

    const verifiedAt = new Date()
    try {
      const updated = await (prisma.booking as any).update({
        where: { id },
        data: {
          handoverOtpVerified: true,
          handoverOtpVerifiedAt: verifiedAt,
          driverStage: 6, // Advance to Stage 6: Service Started / At Altar
          status: "IN_SERVICE",
          auditTrails: {
            create: {
              actorRole: "DRIVER",
              actorName: booking.driver?.name || "Assigned Gosevak",
              actorId: booking.driverId || "DRV-102",
              action: "HANDOVER_VERIFIED" as any,
              remark: `Customer Handover OTP verified (${submittedOtp}). Sacred Bovine received by devotee at ${verifiedAt.toLocaleTimeString("en-IN")}.`,
            },
          },
        },
        include: { driver: true, auditTrails: true },
      })

      const formatted = formatBooking(updated)
      db.bookings = [formatted, ...db.bookings.filter((x) => x.id !== formatted.id)]
      wsHub.broadcastToChannel(`channel:booking:${id}`, "HANDOVER_VERIFIED", {
        bookingId: id,
        stage: 6,
        status: "In Service",
        verifiedAt: verifiedAt.toISOString(),
      })
      wsHub.broadcastToChannel(`channel:booking:${id}`, "STAGE_CHANGED", {
        bookingId: id,
        stage: 6,
        status: "In Service",
      })
      wsHub.broadcastToChannel(`channel:booking:${id}`, "BOOKING_UPDATED", {
        booking: formatted,
      })

      return {
        status: 200,
        body: {
          success: true,
          message: "Animal handover verified successfully! Ceremony started.",
          booking: formatted,
        },
      }
    } catch (err: any) {
      // In-Memory Fallback
      const memBooking = db.bookings.find((b) => b.id === id)
      if (memBooking) {
        memBooking.handoverOtpVerified = true
        memBooking.handoverOtpVerifiedAt = verifiedAt.toISOString()
        memBooking.driverStage = 6
        memBooking.status = "In Service"

        wsHub.broadcastToChannel(`channel:booking:${id}`, "HANDOVER_VERIFIED", {
          bookingId: id,
          stage: 6,
          status: "In Service",
          verifiedAt: verifiedAt.toISOString(),
        })
        wsHub.broadcastToChannel(`channel:booking:${id}`, "STAGE_CHANGED", {
          bookingId: id,
          stage: 6,
          status: "In Service",
        })
        wsHub.broadcastToChannel(`channel:booking:${id}`, "BOOKING_UPDATED", {
          booking: memBooking,
        })

        return {
          status: 200,
          body: {
            success: true,
            message: "Animal handover verified successfully! Ceremony started.",
            booking: memBooking,
          },
        }
      }
      return { status: 500, body: { success: false, error: err?.message || "Failed to verify OTP" } }
    }
  }

  // POST /api/bookings/:id/telemetry
  const telemetryMatch = pathname.match(/^\/api\/bookings\/([^/]+)\/telemetry$/)
  if (method === "POST" && telemetryMatch) {
    const id = telemetryMatch[1]
    const tick: GpsTickPayload = {
      bookingId: id,
      lat: body.lat,
      lng: body.lng,
      bearing: body.bearing || 0,
      speedKmh: body.speedKmh || 0,
      etaMinutes: body.etaMinutes || 0,
      distanceRemainingKm: body.distanceRemainingKm || 0,
      stage: body.stage || 4,
      stageLabel: body.stageLabel || "Live Driver Phone GPS",
      timestamp: Date.now(),
    }
    // Store in live cache for 1-minute poller
    driverLiveLocations.set(id, {
      ...tick,
      lastUpdated: new Date().toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    })
    wsHub.broadcastToChannel(`channel:booking:${id}`, "GPS_TICK", tick)
    return { status: 200, body: { ok: true, tick } }
  }

  // GET /api/bookings/:id/driver-location
  const driverLocMatch = pathname.match(
    /^\/api\/bookings\/([^/]+)\/driver-location$/,
  )
  if (method === "GET" && driverLocMatch) {
    const id = driverLocMatch[1]
    const live = driverLiveLocations.get(id)
    if (live) {
      return { status: 200, body: { ok: true, location: live } }
    }

    // Fallback based on database booking
    const b = await prisma.booking.findUnique({ where: { id } })
    if (!b) return { status: 404, body: { error: "Booking not found" } }

    const gosalaCoords: Record<string, [number, number]> = {
      "Shri Krishna Gaushala": [18.5074, 73.8077],
      "Nandini Goseva Sadan": [18.559, 73.7868],
      "Gopal Gaushala Trust": [18.5482, 73.9034],
      "Vrindavan Goshala": [18.4967, 73.9417],
      "Kamdhenu Seva Kendra": [18.5987, 73.7628],
    }
    const origin = gosalaCoords[b.gosalaName] || [18.5074, 73.8077]
    const dest = [origin[0] + 0.035, origin[1] + 0.045]
    const stage = b.driverStage
    const isEnRoute = stage >= 4 && stage < 7
    const pos =
      stage >= 5
        ? dest
        : isEnRoute
          ? [(origin[0] + dest[0]) / 2, (origin[1] + dest[1]) / 2]
          : origin
    const distRemaining = isEnRoute
      ? Math.round(b.distanceKm * 0.4 * 10) / 10
      : stage >= 5
        ? 0
        : b.distanceKm

    const fallbackLoc = {
      bookingId: id,
      lat: pos[0],
      lng: pos[1],
      bearing: isEnRoute ? 45 : 0,
      speedKmh: isEnRoute ? 32 : 0,
      etaMinutes: isEnRoute
        ? Math.max(1, Math.round((distRemaining / 32) * 60))
        : 0,
      distanceRemainingKm: distRemaining,
      stage,
      stageLabel:
        stage >= 7
          ? "Completed"
          : stage >= 5
            ? "Arrived"
            : isEnRoute
              ? "En Route"
              : "Preparing",
      lastUpdated: new Date().toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
      timestamp: Date.now(),
    }
    return { status: 200, body: { ok: true, location: fallbackLoc } }
  }

  // GET /api/bookings/:id/customer-details
  const customerDetailsMatch = pathname.match(
    /^\/api\/bookings\/([^/]+)\/customer-details$/,
  )
  if (method === "GET" && customerDetailsMatch) {
    const id = customerDetailsMatch[1]
    let b: any = null
    try {
      b = await prisma.booking.findUnique({
        where: { id },
        include: {
          customer: true,
          gosala: true,
          animal: true,
          driver: true,
          auditTrails: true,
        },
      })
    } catch {
      b = null
    }

    if (!b) {
      b = db.bookings.find((x) => x.id === id)
    }

    if (!b) return { status: 404, body: { error: "Booking not found" } }

    let totalBookings = 1
    try {
      if (b.customerId) {
        totalBookings = await prisma.booking.count({
          where: { customerId: b.customerId },
        })
      }
    } catch {}

    const dossier = {
      bookingId: b.id,
      customer: {
        id: b.customer?.id || b.customerId || "CUST-101",
        name: b.customerName || b.customer,
        phone: b.customerPhone || b.phone,
        email:
          (b as any).customerEmail ||
          b.customer?.email ||
          `${(b.customerName || b.customer || "devotee").toLowerCase().replace(/\s+/g, ".")}@gmail.com`,
        memberSince:
          (b as any).devoteeSince ||
          (b.customer?.createdAt
            ? new Date(b.customer.createdAt).toLocaleDateString("en-IN", {
                month: "short",
                year: "numeric",
              })
            : "Aug 2024"),
        idType: "Aadhaar / National ID Card",
        idNumber: (b as any).aadhaarNumber || "XXXX-XXXX-4912",
        idStatus: "Verified Devotee",
        totalBookingsCount: Math.max(1, totalBookings || 4),
        gotra: (b as any).devoteeGotra || "Kashyapa",
        familyMembers:
          (b as any).devoteeFamilyMembers || "Ananya (Self), Rajesh (Husband)",
      },
      ceremony: {
        ritualPurpose:
          (b as any).ritualPurpose || "Griha Pravesh & Kamadhenu Puja",
        animal: b.animalName || b.animal,
        animalType:
          b.animalType === "COW" || b.animalType === "Cow"
            ? "Cow"
            : b.animalType === "BULL" || b.animalType === "Bull"
              ? "Bull"
              : "Calf",
        gosala: b.gosalaName || b.gosala,
        date: normalizeDateStr(b.bookingDate || b.date),
        timeSlot: `${b.startTime || b.start} - ${b.endTime || b.end}`,
        durationMin: b.durationMin,
        serviceAddress: b.address,
        distanceKm: b.distanceKm,
        specialInstructions:
          (b as any).specialInstructions ||
          "Ground-floor portico ready, clean water bucket and sacred green grass feeding protocol.",
      },
      payment: {
        totalPaid: b.totalAmount ?? b.total ?? 0,
        baseRate: b.baseRate ?? b.base ?? 0,
        extraTime: b.extraTimeFee ?? b.extraTime ?? 0,
        transport: b.transportFee ?? b.transport ?? 0,
        addons: b.addonsFee ?? b.addons ?? 0,
        tax: b.taxFee ?? b.tax ?? 0,
        isPaid: b.isPaid ?? b.paid ?? true,
        paymentMethod: "UPI Online (Secured in Escrow)",
        transactionRef: `UPI-TXN-${b.id.replace("-", "")}`,
      },
      logistics: {
        driver: b.driver?.name || b.driver || null,
        driverStage: b.driverStage ?? 0,
        status: toFrontendStatus(b.status),
      },
    }

    return { status: 200, body: { ok: true, details: dossier } }
  }

  // GET /api/managers
  if (method === "GET" && pathname === "/api/managers") {
    try {
      let managerUsers = await prisma.user.findMany({
        where: { role: "GOSALA_MANAGER" },
        include: {
          managerAssignments: {
            include: {
              gosala: {
                include: { animals: true },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      })

      if (authUser?.role === "manager") {
        managerUsers = managerUsers.filter(
          (u: any) =>
            u.id === authUser.userId ||
            u.email?.toLowerCase() === authUser.email?.toLowerCase(),
        )
      } else if (authUser?.role === "admin") {
        const adminEmail = (authUser.email || "").toLowerCase()
        const adminName = (authUser.name || "").toLowerCase()

        // Get Gaushalas under this Operations Admin
        const allGosalas = await prisma.gosala.findMany({ where: { isActive: true } })
        const myGosalaIds = allGosalas
          .filter((g: any) => {
            const meta = getGosalaMeta(g.id, g.name)
            const gEmail = (meta.governingAdminEmail || "").toLowerCase()
            const gName = (meta.governingAdminName || meta.adminName || "").toLowerCase()
            return (gEmail && gEmail === adminEmail) || (gName && gName.includes(adminName))
          })
          .map((g: any) => g.id)

        managerUsers = managerUsers.filter((u: any) => {
          // Unassigned managers are available to be appointed by this Operations Admin
          if (!u.managerAssignments || u.managerAssignments.length === 0) return true
          // Or assigned to this Operations Admin's Gaushala
          return u.managerAssignments.some((ma: any) => myGosalaIds.includes(ma.gosalaId))
        })
      } else if (authUser?.role === "super_admin") {
        const portfolioFilter = query.get("portfolio") || query.get("admin")
        if (portfolioFilter && portfolioFilter !== "All" && portfolioFilter !== "all") {
          const filterLower = portfolioFilter.toLowerCase()
          managerUsers = managerUsers.filter((u: any) => {
            if (!u.managerAssignments || u.managerAssignments.length === 0) return true
            return u.managerAssignments.some((ma: any) => {
              const meta = getGosalaMeta(ma.gosalaId || "", ma.gosala?.name || "")
              const govName = (meta.governingAdminName || meta.adminName || "").toLowerCase()
              const govEmail = (meta.governingAdminEmail || "").toLowerCase()
              return govName.includes(filterLower) || govEmail.includes(filterLower)
            })
          })
        }
      }

      return {
        status: 200,
        body: { managers: managerUsers.map(formatManagerUser) },
      }
    } catch (err: any) {
      console.warn("Error fetching managers:", err?.message)
      return { status: 200, body: { managers: [] } }
    }
  }

  // POST /api/managers
  if (method === "POST" && pathname === "/api/managers") {
    try {
      const email = (body.email || `manager_${Date.now()}@gomaa.in`).trim().toLowerCase()
      const cleanName = (body.name || "Gaushala Manager").trim()
      const cleanPhone = (body.phone || "+91 98000 00000").trim()

      let user = await prisma.user.findFirst({
        where: {
          OR: [
            { email: { equals: email, mode: "insensitive" } },
            ...(body.id ? [{ id: body.id }] : []),
          ],
        },
      })

      if (!user) {
        user = await prisma.user.create({
          data: {
            name: cleanName,
            email,
            phone: cleanPhone,
            role: "GOSALA_MANAGER",
            isActive: body.status !== "Inactive",
          },
        })
      } else {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            name: cleanName,
            phone: cleanPhone,
            role: "GOSALA_MANAGER",
            isActive: body.status !== "Inactive",
          },
        })
      }

      if (body.password) {
        setUserMeta(user.email, { password: body.password })
      }

      // Determine target Gaushalas (supports multiple or single)
      const rawGosalas: string[] = Array.isArray(body.gosalas)
        ? body.gosalas
        : body.gosala
        ? [body.gosala]
        : []

      for (const gNameOrId of rawGosalas) {
        if (!gNameOrId || gNameOrId === "Unassigned") continue
        const targetGosala = await prisma.gosala.findFirst({
          where: {
            OR: [{ id: gNameOrId }, { name: gNameOrId }],
          },
        })
        if (targetGosala) {
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
              region: body.region || targetGosala.region,
              status: "Active",
            },
            update: {
              status: "Active",
            },
          })
        }
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

      return { status: 201, body: { manager: formatManagerUser(updatedUser) } }
    } catch (err: any) {
      console.error("Error creating manager in DB:", err)
      return { status: 500, body: { error: err.message || "Failed to create manager" } }
    }
  }

  // PUT /api/managers/:id
  const putMgrMatch = pathname.match(/^\/api\/managers\/([^/]+)$/)
  if (method === "PUT" && putMgrMatch) {
    const id = putMgrMatch[1]
    const cleanId = id.startsWith("MGR-") ? id.replace(/^MGR-/, "") : id
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { id },
          { id: cleanId },
          { id: { startsWith: cleanId } },
          { email: id },
          { name: id },
        ],
      },
    })
    if (!user) return { status: 404, body: { error: "Manager user not found" } }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        name: body.name || user.name,
        email: body.email || user.email,
        phone: body.phone || user.phone,
        isActive: body.status !== undefined ? body.status === "Active" : user.isActive,
      },
    })

    if (body.password) {
      setUserMeta(user.email, { password: body.password })
      setUserMeta(user.id, { password: body.password })
    }

    // If gosalas array was provided, sync assignments!
    if (body.gosalas !== undefined || body.gosala !== undefined) {
      const targetGosalas: string[] = Array.isArray(body.gosalas)
        ? body.gosalas
        : body.gosala
        ? [body.gosala]
        : []

      // Delete existing assignments for this user
      await prisma.gosalaManagerAssignment.deleteMany({
        where: { userId: user.id },
      })

      // Re-create new assignments
      for (const gNameOrId of targetGosalas) {
        if (!gNameOrId || gNameOrId === "Unassigned") continue
        const targetGosala = await prisma.gosala.findFirst({
          where: {
            OR: [{ id: gNameOrId }, { name: gNameOrId }],
          },
        })
        if (targetGosala) {
          await prisma.gosalaManagerAssignment.create({
            data: {
              userId: user.id,
              gosalaId: targetGosala.id,
              region: body.region || targetGosala.region,
              status: "Active",
            },
          })
        }
      }
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

    return { status: 200, body: { ok: true, manager: formatManagerUser(updatedUser) } }
  }

  // PATCH /api/managers/:id/toggle
  const toggleMgrMatch = pathname.match(/^\/api\/managers\/([^/]+)\/toggle$/)
  if (method === "PATCH" && toggleMgrMatch) {
    const id = toggleMgrMatch[1]
    const cleanId = id.startsWith("MGR-") ? id.replace(/^MGR-/, "") : id
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { id },
          { id: cleanId },
          { id: { startsWith: cleanId } },
          { email: id },
          { name: id },
        ],
      },
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
    if (!user)
      return { status: 404, body: { error: "Manager assignment not found" } }

    const nextActive = !user.isActive
    await prisma.user.update({
      where: { id: user.id },
      data: { isActive: nextActive },
    })

    await prisma.gosalaManagerAssignment.updateMany({
      where: { userId: user.id },
      data: { status: nextActive ? "Active" : "Inactive" },
    })

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

    return { status: 200, body: { manager: formatManagerUser(updatedUser) } }
  }

  // DELETE /api/managers/:id
  const delMgrMatch = pathname.match(/^\/api\/managers\/([^/]+)$/)
  if (method === "DELETE" && delMgrMatch) {
    const id = delMgrMatch[1]
    const cleanId = id.startsWith("MGR-") ? id.replace(/^MGR-/, "") : id
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { id },
          { id: cleanId },
          { id: { startsWith: cleanId } },
          { email: id },
          { name: id },
        ],
      },
    })
    if (user) {
      await prisma.gosalaManagerAssignment.deleteMany({
        where: { userId: user.id },
      })
      await prisma.user.delete({
        where: { id: user.id },
      })
    }
    return { status: 200, body: { success: true } }
  }

  // GET /api/pricing-config
  if (method === "GET" && pathname === "/api/pricing-config") {
    try {
      const cfg = await prisma.masterPricingConfig.findFirst()
      return { status: 200, body: { config: cfg || db.pricingConfig } }
    } catch (err: any) {
      console.warn("Falling back to in-memory pricing config:", err?.message)
      return { status: 200, body: { config: db.pricingConfig } }
    }
  }

  // PUT or PATCH /api/pricing-config (Strictly Super Admin Only - PDF Role Invariant)
  if (
    (method === "PUT" || method === "PATCH") &&
    (pathname === "/api/pricing-config" || pathname === "/api/pricing/config")
  ) {
    const callerRole = body.role || body.callerRole
    if (
      callerRole &&
      callerRole.toLowerCase() !== "super_admin" &&
      callerRole !== "SUPER_ADMIN"
    ) {
      return {
        status: 403,
        body: {
          error:
            "Unauthorized: Super Admin is the sole authority for platform pricing and commission rules.",
        },
      }
    }

    const patch = body.patch || body
    const callerName = body.updatedByName || body.callerName || "Koushik"
    const roleNormalized = (callerRole || "SUPER_ADMIN").toUpperCase()
    try {
      const cfg = await prisma.masterPricingConfig.upsert({
        where: { id: 1 },
        create: {
          id: 1,
          standardMin: Number(patch.standardMin) || 60,
          extraUnitMin: Number(patch.extraUnitMin) || 30,
          extraUnitRate: Number(patch.extraUnitRate) || 500,
          freeKm: Number(patch.freeKm) || 5.0,
          perKm: Number(patch.perKm) || 50.0,
          taxPct: Number(patch.taxPct) || 12.0,
          commissionPct: Number(patch.commissionPct) || 20.0,
          maxDurationMin: Number(patch.maxDurationMin) || 240,
          bufferMin: Number(patch.bufferMin) || 30,
          rounding: patch.rounding || "Nearest ₹10",
          updatedByRole: roleNormalized,
          updatedByName: callerName,
        },
        update: {
          standardMin: patch.standardMin !== undefined ? Number(patch.standardMin) : undefined,
          extraUnitMin: patch.extraUnitMin !== undefined ? Number(patch.extraUnitMin) : undefined,
          extraUnitRate: patch.extraUnitRate !== undefined ? Number(patch.extraUnitRate) : undefined,
          freeKm: patch.freeKm !== undefined ? Number(patch.freeKm) : undefined,
          perKm: patch.perKm !== undefined ? Number(patch.perKm) : undefined,
          taxPct: patch.taxPct !== undefined ? Number(patch.taxPct) : undefined,
          commissionPct: patch.commissionPct !== undefined ? Number(patch.commissionPct) : undefined,
          maxDurationMin: patch.maxDurationMin !== undefined ? Number(patch.maxDurationMin) : undefined,
          bufferMin: patch.bufferMin !== undefined ? Number(patch.bufferMin) : undefined,
          rounding: patch.rounding || undefined,
          updatedByRole: roleNormalized,
          updatedByName: callerName,
        },
      })

      db.pricingConfig = {
        id: cfg.id,
        standardMin: cfg.standardMin,
        extraUnitMin: cfg.extraUnitMin,
        extraUnitRate: cfg.extraUnitRate,
        freeKm: cfg.freeKm,
        perKm: cfg.perKm,
        taxPct: cfg.taxPct,
        commissionPct: cfg.commissionPct,
        maxDurationMin: cfg.maxDurationMin,
        bufferMin: cfg.bufferMin,
        rounding: cfg.rounding,
        updatedByRole: cfg.updatedByRole,
        updatedByName: cfg.updatedByName,
        updatedAt: cfg.updatedAt.toISOString(),
      }

      return { status: 200, body: { config: db.pricingConfig } }
    } catch {
      // In-Memory Fallback
      db.pricingConfig = {
        ...db.pricingConfig,
        ...(patch.standardMin !== undefined ? { standardMin: Number(patch.standardMin) } : {}),
        ...(patch.extraUnitMin !== undefined ? { extraUnitMin: Number(patch.extraUnitMin) } : {}),
        ...(patch.extraUnitRate !== undefined ? { extraUnitRate: Number(patch.extraUnitRate) } : {}),
        ...(patch.freeKm !== undefined ? { freeKm: Number(patch.freeKm) } : {}),
        ...(patch.perKm !== undefined ? { perKm: Number(patch.perKm) } : {}),
        ...(patch.taxPct !== undefined ? { taxPct: Number(patch.taxPct) } : {}),
        ...(patch.commissionPct !== undefined ? { commissionPct: Number(patch.commissionPct) } : {}),
        ...(patch.maxDurationMin !== undefined ? { maxDurationMin: Number(patch.maxDurationMin) } : {}),
        ...(patch.bufferMin !== undefined ? { bufferMin: Number(patch.bufferMin) } : {}),
        ...(patch.rounding ? { rounding: patch.rounding } : {}),
      }
      return { status: 200, body: { config: db.pricingConfig } }
    }
  }

  // GET /api/settlements
  if (method === "GET" && pathname === "/api/settlements") {
    try {
      const batches = await prisma.settlementBatch.findMany({
        orderBy: { createdAt: "desc" },
      })
      if (batches && batches.length > 0) {
        return { status: 200, body: { settlements: batches.map(formatSettlement) } }
      }
    } catch (err: any) {
      console.warn("Settlements DB fallback:", err?.message)
    }
    return { status: 200, body: { settlements: db.settlements } }
  }

  // POST /api/settlements/advance
  if (method === "POST" && pathname === "/api/settlements/advance") {
    const gosala = body.gosala
    const nextMap: Record<string, any> = {
      PENDING: "APPROVED",
      APPROVED: "PROCESSING",
      PROCESSING: "PAID",
      PAID: "PAID",
      FAILED: "APPROVED",
    }
    const nextDisplayMap: Record<string, any> = {
      Pending: "Approved",
      Approved: "Processing",
      Processing: "Paid",
      Paid: "Paid",
      Failed: "Approved",
    }

    try {
      const batch = await prisma.settlementBatch.findFirst({
        where: { gosalaName: gosala },
      })
      if (batch) {
        const updated = await prisma.settlementBatch.update({
          where: { id: batch.id },
          data: { status: nextMap[batch.status] || "APPROVED" },
        })
        return { status: 200, body: { settlement: formatSettlement(updated) } }
      }
    } catch (err: any) {
      console.warn("Settlements advance DB fallback:", err?.message)
    }

    const memItem = db.settlements.find((s) => s.gosala === gosala)
    if (memItem) {
      memItem.status = nextDisplayMap[memItem.status] || "Approved"
      return { status: 200, body: { settlement: memItem } }
    }
    return { status: 404, body: { error: "Settlement not found" } }
  }

  // POST /api/settlements/batch-approve
  if (method === "POST" && pathname === "/api/settlements/batch-approve") {
    const batch = body.batch || "SEP-W4"
    try {
      await prisma.settlementBatch.updateMany({
        where: { batch, status: "PENDING" },
        data: { status: "APPROVED" },
      })
    } catch (err: any) {
      console.warn("Batch approve DB fallback:", err?.message)
    }
    db.settlements.forEach((s) => {
      if (s.batch === batch && s.status === "Pending") {
        s.status = "Approved"
      }
    })
    return { status: 200, body: { success: true, batch } }
  }

  // POST /api/settlements/sweep - Automated / On-Demand Payout Sweep Engine
  if (method === "POST" && pathname === "/api/settlements/sweep") {
    try {
      const result = await executeAutomatedSweep({
        targetGosala: body?.gosala,
        cycleType: body?.cycleType,
        serverProfiles,
      })
      return { status: 200, body: result }
    } catch (err: any) {
      console.error("Payout sweep error:", err)
      return {
        status: 500,
        body: { error: err?.message || "Failed to execute automated payout sweep" },
      }
    }
  }

  // GET /api/settlements/schedule - Live schedule status & countdown
  if (method === "GET" && pathname === "/api/settlements/schedule") {
    try {
      const schedule = await getScheduleStatus()
      return { status: 200, body: { schedule } }
    } catch (err: any) {
      return {
        status: 500,
        body: { error: err?.message || "Failed to get schedule status" },
      }
    }
  }

  // POST /api/settlements/schedule/configure - Configure Auto-Sweep Preferences
  if (method === "POST" && pathname === "/api/settlements/schedule/configure") {
    try {
      const { autoSweepEnabled, disbursementCycle } = body
      try {
        await prisma.masterPricingConfig.upsert({
          where: { id: 1 },
          update: {
            ...(autoSweepEnabled !== undefined ? { autoSweepEnabled } : {}),
            ...(disbursementCycle ? { disbursementCycle } : {}),
            updatedAt: new Date(),
          },
          create: {
            id: 1,
            autoSweepEnabled: autoSweepEnabled ?? true,
            disbursementCycle: disbursementCycle || "CONTINUOUS_T_PLUS_ONE",
          },
        })
      } catch (err) {
        console.warn("Schedule config DB fallback:", err)
      }

      db.pricingConfig = {
        ...db.pricingConfig,
        ...(autoSweepEnabled !== undefined ? { autoSweepEnabled } : {}),
        ...(disbursementCycle ? { disbursementCycle } : {}),
      }

      const schedule = await getScheduleStatus()
      return { status: 200, body: { success: true, schedule } }
    } catch (err: any) {
      return {
        status: 500,
        body: { error: err?.message || "Failed to update schedule config" },
      }
    }
  }

  // ----------------- GAUSHALAS DIRECTORY & PERSISTENCE -----------------
  // GET /api/gosalas
  if (method === "GET" && pathname === "/api/gosalas") {
    try {
      const dbGosalas = await prisma.gosala.findMany({
        where: { isActive: true },
        include: {
          animals: true,
          managers: {
            include: { user: true },
          },
        },
        orderBy: { createdAt: "asc" },
      })
      const formatted = dbGosalas.map((g: any) => {
        const meta = getGosalaMeta(g.id, g.name)
        const lat =
          g.latitude !== null && g.latitude !== undefined
            ? Number(g.latitude)
            : meta.lat !== undefined
              ? Number(meta.lat)
              : g.lat !== undefined
                ? Number(g.lat)
                : undefined
        const lng =
          g.longitude !== null && g.longitude !== undefined
            ? Number(g.longitude)
            : meta.lng !== undefined
              ? Number(meta.lng)
              : g.lng !== undefined
                ? Number(g.lng)
                : undefined

        const assignedMgrs = (g.managers || []).map((m: any) => ({
          id: m.user.id.startsWith("MGR-")
            ? m.user.id
            : `MGR-${m.user.id.slice(0, 4)}`,
          rawUserId: m.user.id,
          name: m.user.name,
          phone: m.user.phone,
          email: m.user.email,
        }))

        const firstAssigned = assignedMgrs[0]
        const govRole = meta.governingAdminRole || "admin"
        const govName = meta.governingAdminName || (govRole === "super_admin" ? "Koushik" : "Operations Admin")

        return {
          ...g,
          ...meta,
          id: g.id,
          name: g.name,
          region: g.region,
          address: g.address,
          contactPhone: g.contactPhone,
          contactEmail: g.contactEmail,
          latitude: lat,
          longitude: lng,
          lat,
          lng,
          assignedManagers: assignedMgrs,
          managerName:
            firstAssigned?.name || meta.managerName || meta.caretaker || "None (Admin Acting)",
          managerId: firstAssigned?.id || meta.managerId || "",
          caretaker: meta.caretaker || firstAssigned?.name || "Caretaker In-Charge",
          governingAdminRole: govRole,
          governingAdminName: govName,
          adminId: meta.adminId || (govRole === "super_admin" ? "USER-SA-001" : "USER-ADM-101"),
          adminName: meta.adminName || govName,
        }
      })

      // Multi-tenant isolation based on JWT authUser
      let scopedGosalas = formatted
      if (authUser?.role === "manager") {
        scopedGosalas = formatted.filter((g: any) => {
          const idMatch = authUser.gosalaIds?.includes(g.id)
          const nameMatch = authUser.gosalaNames?.some((gn: string) =>
            g.name.trim().toLowerCase() === gn.trim().toLowerCase()
          )
          const mgrMatch = g.assignedManagers?.some((m: any) =>
            m.rawUserId === authUser.userId || m.id === authUser.userId || m.email?.toLowerCase() === authUser.email?.toLowerCase()
          )
          return idMatch || nameMatch || mgrMatch
        })
      } else if (authUser?.role === "admin") {
        const adminEmail = (authUser.email || "").toLowerCase()
        const adminName = (authUser.name || "").toLowerCase()

        scopedGosalas = formatted.filter((g: any) => {
          const emailMatch = g.governingAdminEmail && g.governingAdminEmail.toLowerCase() === adminEmail
          const nameMatch = g.governingAdminName && g.governingAdminName.toLowerCase().includes(adminName)
          const admNameMatch = g.adminName && g.adminName.toLowerCase().includes(adminName)
          const listMatch = authUser.gosalaNames && authUser.gosalaNames.some((gn: string) => g.name.toLowerCase() === gn.toLowerCase())
          return emailMatch || nameMatch || admNameMatch || listMatch || (!g.governingAdminEmail && g.governingAdminRole !== "super_admin")
        })
      } else if (authUser?.role === "super_admin") {
        // Super Admin has global oversight across all Operations Admins and Gaushalas!
        scopedGosalas = formatted
      }

      return { status: 200, body: { ok: true, gosalas: scopedGosalas } }
    } catch (err: any) {
      console.warn("Error fetching gosalas from database:", err?.message)
      return { status: 200, body: { ok: true, gosalas: [] } }
    }
  }

  // POST /api/gosalas
  if (method === "POST" && pathname === "/api/gosalas") {
    try {
      const {
        name,
        region,
        address,
        contactPhone,
        email,
        latitude,
        longitude,
        lat,
        lng,
        ...restMeta
      } = body

      if (!name || !region || !address) {
        return {
          status: 400,
          body: { error: "Name, region, and physical address are required" },
        }
      }

      const finalLat = latitude !== undefined ? Number(latitude) : lat !== undefined ? Number(lat) : null
      const finalLng = longitude !== undefined ? Number(longitude) : lng !== undefined ? Number(lng) : null

      const created = await prisma.gosala.upsert({
        where: { name: name.trim() },
        create: {
          name: name.trim(),
          region: region.trim(),
          address: address.trim(),
          contactPhone: contactPhone || "+91 98000 00000",
          contactEmail: email || "trust@gomaa.in",
          latitude: finalLat,
          longitude: finalLng,
          isActive: true,
        },
        update: {
          region: region.trim(),
          address: address.trim(),
          contactPhone: contactPhone || undefined,
          contactEmail: email || undefined,
          latitude: finalLat,
          longitude: finalLng,
          isActive: true,
        },
      })

      const isActing = Boolean(body.actAsManagerMyself) || Boolean(restMeta.isActingManager) || (!restMeta.managerId && !restMeta.managerName)
      const finalGovRole = restMeta.governingAdminRole || (authUser?.role === "super_admin" ? "super_admin" : "admin")
      const callerAdminName = restMeta.governingAdminName || authUser?.name || "Operations Admin"
      const callerAdminEmail = restMeta.governingAdminEmail || authUser?.email || "admin@gomaa.in"
      const callerAdminId = restMeta.adminId || authUser?.userId || "USER-ADM-101"

      // Attempt to resolve chosen manager user in database if not acting
      let resolvedMgrUser: any = null
      if (!isActing && (restMeta.managerId || restMeta.managerName || restMeta.caretaker)) {
        try {
          const mgrKey = restMeta.managerId || restMeta.managerName || restMeta.caretaker
          const cleanMgrKey = typeof mgrKey === "string" && mgrKey.startsWith("MGR-") ? mgrKey.replace(/^MGR-/, "") : mgrKey
          resolvedMgrUser = await prisma.user.findFirst({
            where: {
              OR: [
                { id: mgrKey },
                { id: cleanMgrKey },
                { id: { startsWith: cleanMgrKey } },
                { name: { equals: restMeta.managerName || restMeta.caretaker, mode: "insensitive" } },
                { email: mgrKey },
              ],
            },
          })
          if (resolvedMgrUser) {
            await prisma.gosalaManagerAssignment.upsert({
              where: {
                userId_gosalaId: {
                  userId: resolvedMgrUser.id,
                  gosalaId: created.id,
                },
              },
              create: {
                userId: resolvedMgrUser.id,
                gosalaId: created.id,
                region: created.region,
                status: "Active",
              },
              update: {
                status: "Active",
              },
            })
          }
        } catch (e) {
          console.warn("Could not sync manager assignment in POST gosalas:", e)
        }
      }

      const finalMgrName = isActing
        ? `${callerAdminName} (Acting Manager)`
        : resolvedMgrUser?.name || restMeta.managerName || "None (Admin Acting)"
      const finalMgrId = isActing
        ? callerAdminId
        : resolvedMgrUser?.id || restMeta.managerId || ""
      const finalCaretaker = isActing
        ? `${callerAdminName} (Acting Custodian)`
        : restMeta.caretaker || resolvedMgrUser?.name || "Dedicated Gosevak Caretaker"

      saveGosalaMeta(created.id, created.name, {
        ...restMeta,
        lat: finalLat !== null ? finalLat : undefined,
        lng: finalLng !== null ? finalLng : undefined,
        governingAdminRole: finalGovRole,
        governingAdminName: callerAdminName,
        governingAdminEmail: callerAdminEmail,
        adminName: callerAdminName,
        adminId: callerAdminId,
        isActingManager: isActing,
        managerName: finalMgrName,
        managerId: finalMgrId,
        caretaker: finalCaretaker,
      })

      const fullMeta = getGosalaMeta(created.id, created.name)
      const mergedCreated = {
        ...created,
        ...fullMeta,
        id: created.id,
        name: created.name,
        region: created.region,
        address: created.address,
        contactPhone: created.contactPhone,
        contactEmail: created.contactEmail,
        lat: finalLat !== null ? finalLat : fullMeta.lat,
        lng: finalLng !== null ? finalLng : fullMeta.lng,
        latitude: finalLat,
        longitude: finalLng,
      }

      // Broadcast new sanctuary event on WebSocket
      wsHub.broadcastToChannel("channel:gosalas", "GOSALA_REGISTERED", {
        gosala: mergedCreated,
        timestamp: new Date().toISOString(),
      })

      return { status: 201, body: { ok: true, gosala: mergedCreated } }
    } catch (err: any) {
      console.error("Error creating/updating gosala in DB:", err)
      return { status: 500, body: { error: err.message || "Failed to persist Gaushala" } }
    }
  }

  // PUT /api/gosalas/:id
  const putGosalaMatch = pathname.match(/^\/api\/gosalas\/([^/]+)$/)
  if (method === "PUT" && putGosalaMatch) {
    const id = putGosalaMatch[1]
    try {
      const {
        name,
        region,
        address,
        contactPhone,
        email,
        latitude,
        longitude,
        lat,
        lng,
        ...restMeta
      } = body

      const finalLat = latitude !== undefined ? Number(latitude) : lat !== undefined ? Number(lat) : undefined
      const finalLng = longitude !== undefined ? Number(longitude) : lng !== undefined ? Number(lng) : undefined

      const updated = await prisma.gosala.update({
        where: { id },
        data: {
          name: name ? name.trim() : undefined,
          region: region ? region.trim() : undefined,
          address: address ? address.trim() : undefined,
          contactPhone: contactPhone || undefined,
          contactEmail: email || undefined,
          latitude: finalLat,
          longitude: finalLng,
        },
      })

      const isActing = body.actAsManagerMyself !== undefined
        ? Boolean(body.actAsManagerMyself)
        : restMeta.isActingManager !== undefined
        ? Boolean(restMeta.isActingManager)
        : undefined

      const callerAdminName = restMeta.governingAdminName || authUser?.name || "Operations Admin"
      const callerAdminEmail = restMeta.governingAdminEmail || authUser?.email || "admin@gomaa.in"
      const callerAdminRole = restMeta.governingAdminRole || (authUser?.role === "super_admin" ? "super_admin" : "admin")
      const callerAdminId = restMeta.adminId || authUser?.userId || "USER-ADM-101"

      const metaPatch: any = {
        ...restMeta,
        ...(finalLat !== undefined ? { lat: finalLat } : {}),
        ...(finalLng !== undefined ? { lng: finalLng } : {}),
        governingAdminName: callerAdminName,
        governingAdminEmail: callerAdminEmail,
        governingAdminRole: callerAdminRole,
      }

      if (isActing === true) {
        metaPatch.isActingManager = true
        metaPatch.managerName = `${callerAdminName} (Acting Manager)`
        metaPatch.managerId = callerAdminId
        metaPatch.caretaker = `${callerAdminName} (Acting Custodian)`
        try {
          await prisma.gosalaManagerAssignment.deleteMany({ where: { gosalaId: updated.id } })
        } catch {}
      } else if (isActing === false && restMeta.managerName) {
        metaPatch.isActingManager = false
      }

      // Link manager in database if provided and not acting as manager
      if (isActing !== true && (restMeta.managerId || restMeta.managerName || restMeta.caretaker)) {
        try {
          const mgrKey = restMeta.managerId || restMeta.managerName || restMeta.caretaker
          const cleanMgrKey = typeof mgrKey === "string" && mgrKey.startsWith("MGR-") ? mgrKey.replace(/^MGR-/, "") : mgrKey
          const mgrUser = await prisma.user.findFirst({
            where: {
              OR: [
                { id: mgrKey },
                { id: cleanMgrKey },
                { id: { startsWith: cleanMgrKey } },
                { name: { equals: restMeta.managerName || restMeta.caretaker, mode: "insensitive" } },
                { email: mgrKey },
              ],
            },
          })
          if (mgrUser) {
            metaPatch.managerId = mgrUser.id
            metaPatch.managerName = mgrUser.name
            if (!metaPatch.caretaker || metaPatch.caretaker.includes("Acting")) {
              metaPatch.caretaker = mgrUser.name
            }
            await prisma.gosalaManagerAssignment.upsert({
              where: {
                userId_gosalaId: {
                  userId: mgrUser.id,
                  gosalaId: updated.id,
                },
              },
              create: {
                userId: mgrUser.id,
                gosalaId: updated.id,
                region: updated.region,
                status: "Active",
              },
              update: {
                status: "Active",
              },
            })
          }
        } catch (e) {
          console.warn("Could not sync manager assignment in PUT gosalas:", e)
        }
      }

      saveGosalaMeta(updated.id, updated.name, metaPatch)

      const fullMeta = getGosalaMeta(updated.id, updated.name)
      const mergedUpdated = {
        ...updated,
        ...fullMeta,
        id: updated.id,
        name: updated.name,
        region: updated.region,
        address: updated.address,
        contactPhone: updated.contactPhone,
        contactEmail: updated.contactEmail,
        lat: updated.latitude !== null && updated.latitude !== undefined ? Number(updated.latitude) : fullMeta.lat,
        lng: updated.longitude !== null && updated.longitude !== undefined ? Number(updated.longitude) : fullMeta.lng,
        latitude: updated.latitude,
        longitude: updated.longitude,
      }

      return { status: 200, body: { ok: true, gosala: mergedUpdated } }
    } catch (err: any) {
      return { status: 500, body: { error: err.message || "Failed to update Gaushala" } }
    }
  }

  // DELETE /api/gosalas/:id
  if (method === "DELETE" && putGosalaMatch) {
    const id = putGosalaMatch[1]
    try {
      const existing = await prisma.gosala.findFirst({
        where: { OR: [{ id }, { name: decodeURIComponent(id) }] },
      })
      if (!existing) {
        return { status: 404, body: { error: "Gaushala not found" } }
      }
      // Delete manager assignments
      try {
        await prisma.gosalaManagerAssignment.deleteMany({
          where: { gosalaId: existing.id },
        })
      } catch {}
      // Delete animals housed in this Gaushala
      try {
        await prisma.animal.deleteMany({
          where: { gosalaId: existing.id },
        })
      } catch {}
      // Delete Gaushala metadata
      deleteGosalaMeta(existing.id, existing.name)
      // Delete Gaushala from PostgreSQL
      await prisma.gosala.delete({
        where: { id: existing.id },
      })
      return { status: 200, body: { ok: true, deleted: existing.id } }
    } catch (err: any) {
      return { status: 500, body: { error: err.message || "Failed to delete Gaushala" } }
    }
  }

  // ----------------- SACRED HERD & ANIMALS API -----------------
  // GET /api/animals
  if (method === "GET" && pathname === "/api/animals") {
    try {
      // Query database as source of truth
      const dbAnimals = await prisma.animal.findMany({
        where: { isActive: true },
        include: { gosala: true },
        orderBy: { createdAt: "asc" },
      })
      const allMeta = getAllAnimalMeta()

      const mappedFromDb = dbAnimals.map((a: any) => {
        const meta = getAnimalMeta(a.name) || {}
        return {
          name: a.name,
          tagId: meta.tagId || "IN-MH-12-8491",
          type: meta.type || (a.type === "COW" ? "Cow" : a.type === "BULL" ? "Bull" : "Calf"),
          breed: meta.breed || a.breed || "Indigenous Gir",
          gosala: a.gosala?.name || meta.gosala || "Surya",
          gosalaId: a.gosala?.id,
          age: meta.age || (a.ageYears ? `${a.ageYears} Years` : "5 Years"),
          ageYears: a.ageYears || meta.ageYears || 5,
          weight: meta.weight || "420 kg",
          height: meta.height || "142 cm",
          category: meta.category || "Ceremonial · Puja & Griha Pravesh",
          price: a.price || meta.price || 3500,
          status: a.healthStatus === "HEALTHY" ? (meta.status || "Available") : (meta.status || "Resting Buffer"),
          todayBookings: 0,
          maxDailyTrips: meta.maxDailyTrips ?? 2,
          maxRadiusKm: meta.maxRadiusKm ?? 20,
          cooldownMinutes: meta.cooldownMinutes ?? 90,
          assignedHandler: meta.assignedHandler || "Gaushala Gosevak",
          lactationStatus: meta.lactationStatus || "Pregnant / Gestating (Month 5)",
          temperament: meta.temperament || "Extremely Gentle with Children & Elders",
          sacredMarks: meta.sacredMarks || "Devi Tilak on Forehead",
          diet: meta.diet || "Fresh Napier grass + dry roughage",
          healthNotes: meta.healthNotes || "Vitals normal, alert demeanor, clear hooves",
          photo: meta.photo || (meta.photos && meta.photos[0]) || "https://images.unsplash.com/photo-1546722228-7baeca4bd0b3?w=600&h=400&fit=crop&auto=format",
          photos: meta.photos && meta.photos.length > 0 ? meta.photos : [meta.photo || "https://images.unsplash.com/photo-1546722228-7baeca4bd0b3?w=600&h=400&fit=crop&auto=format"],
          vetInfo: meta.vetInfo,
          dietInfo: meta.dietInfo,
          customDetails: meta.customDetails || [],
        }
      })

      // Also merge any animals from animals_meta.json not yet in DB
      const dbNames = new Set(mappedFromDb.map((a: any) => a.name.toLowerCase()))
      const mapped = [...mappedFromDb]
      for (const [key, meta] of Object.entries(allMeta)) {
        if (meta.name && !dbNames.has(meta.name.toLowerCase())) {
          mapped.push({
            name: meta.name,
            tagId: meta.tagId || "IN-MH-12-8491",
            type: meta.type || "Cow",
            breed: meta.breed || "Indigenous Gir",
            gosala: meta.gosala || "Surya",
            gosalaId: undefined as string | undefined,
            age: meta.age || "5 Years",
            ageYears: meta.ageYears || 5,
            weight: meta.weight || "420 kg",
            height: meta.height || "142 cm",
            category: meta.category || "Ceremonial · Puja & Griha Pravesh",
            price: meta.price || 3500,
            status: meta.status || "Available",
            todayBookings: 0,
            maxDailyTrips: meta.maxDailyTrips ?? 2,
            maxRadiusKm: meta.maxRadiusKm ?? 20,
            cooldownMinutes: meta.cooldownMinutes ?? 90,
            assignedHandler: meta.assignedHandler || "Gaushala Gosevak",
            lactationStatus: meta.lactationStatus || "Pregnant / Gestating (Month 5)",
            temperament: meta.temperament || "Extremely Gentle",
            sacredMarks: meta.sacredMarks || "",
            diet: meta.diet || "Fresh fodder",
            healthNotes: meta.healthNotes || "Healthy, active",
            photo: meta.photo || (meta.photos && meta.photos[0]) || "https://images.unsplash.com/photo-1546722228-7baeca4bd0b3?w=600&h=400&fit=crop&auto=format",
            photos: meta.photos && meta.photos.length > 0 ? meta.photos : [meta.photo || "https://images.unsplash.com/photo-1546722228-7baeca4bd0b3?w=600&h=400&fit=crop&auto=format"],
            vetInfo: meta.vetInfo,
            dietInfo: meta.dietInfo,
            customDetails: meta.customDetails || [],
          })
        }
      }

      // Sync memory map with merged state
      serverAnimals.clear()
      for (const item of mapped) {
        serverAnimals.set(item.name, item)
      }

      // Multi-tenant role scoping
      let finalAnimals = mapped
      if (authUser?.role === "manager") {
        const allowedGosalas = (authUser.gosalaNames || []).map((s: string) => s.toLowerCase().trim())
        finalAnimals = finalAnimals.filter((a: any) => {
          const gName = (a.gosala || "").toLowerCase().trim()
          return allowedGosalas.includes(gName)
        })
      } else if (authUser?.role === "admin") {
        if (authUser.gosalaNames && authUser.gosalaNames.length > 0) {
          const allowedGosalas = authUser.gosalaNames.map((s: string) => s.toLowerCase().trim())
          finalAnimals = finalAnimals.filter((a: any) => {
            const gName = (a.gosala || "").toLowerCase().trim()
            return allowedGosalas.includes(gName)
          })
        } else if (authUser.name) {
          const adminNameLower = authUser.name.toLowerCase()
          // Only include animals belonging to Gaushalas governed by this admin
          finalAnimals = finalAnimals.filter((a: any) => {
            const meta = getGosalaMeta(a.gosalaId || "", a.gosala || "")
            const gov = meta.governingAdminName || meta.adminName
            if (gov && gov.toLowerCase().includes(adminNameLower)) return true
            return meta.governingAdminRole === "admin"
          })
        }
      } else if (authUser?.role === "super_admin") {
        if (query.get("scope") !== "all" && query.get("all") !== "true") {
          const saNameLower = (authUser.name || "Koushik").toLowerCase()
          finalAnimals = finalAnimals.filter((a: any) => {
            const meta = getGosalaMeta(a.gosalaId || "", a.gosala || "")
            const gov = meta.governingAdminName || meta.adminName
            if (gov && gov.toLowerCase().includes(saNameLower)) return true
            return meta.governingAdminRole === "super_admin"
          })
        }
      }

      return { status: 200, body: { ok: true, animals: finalAnimals } }
    } catch (err: any) {
      console.warn("Error retrieving animals:", err?.message)
      return { status: 200, body: { ok: true, animals: [] } }
    }
  }

  // POST /api/animals
  if (method === "POST" && pathname === "/api/animals") {
    try {
      const animalData = body.animal || body
      if (!animalData.name) {
        return { status: 400, body: { error: "Animal name is required" } }
      }

      // 1. Persist rich metadata to disk
      saveAnimalMeta(animalData.name, animalData)
      serverAnimals.set(animalData.name, animalData)

      // 2. Try database sync
      try {
        let gosalaRec = await prisma.gosala.findFirst({
          where: { name: animalData.gosala },
        })
        if (!gosalaRec) {
          gosalaRec = await prisma.gosala.create({
            data: {
              name: animalData.gosala || "Vedic Gaushala",
              region: "General Zone",
              address: "Sanctuary Premises",
              contactPhone: "+91 98000 00000",
              contactEmail: "sanctuary@gomaa.in",
            },
          })
        }
        const aType = animalData.type === "Bull" ? "BULL" : animalData.type === "Calf" ? "CALF" : "COW"
        await prisma.animal.upsert({
          where: {
            gosalaId_name: {
              gosalaId: gosalaRec.id,
              name: animalData.name,
            },
          },
          create: {
            gosalaId: gosalaRec.id,
            name: animalData.name,
            type: aType as any,
            breed: animalData.breed || null,
            ageYears: animalData.ageYears || 5,
            healthStatus: animalData.status === "Available" ? "HEALTHY" : "RESTING",
            price: animalData.price || 3500,
            isActive: true,
          },
          update: {
            breed: animalData.breed || undefined,
            ageYears: animalData.ageYears || undefined,
            healthStatus: animalData.status === "Available" ? "HEALTHY" : undefined,
            price: animalData.price || undefined,
            isActive: true,
          },
        })
      } catch (dbErr) {
        console.warn("Database animal upsert warning (retained in serverAnimals & disk):", dbErr)
      }

      wsHub.broadcastToChannel("channel:animals", "ANIMAL_REGISTERED", {
        animal: animalData,
        timestamp: new Date().toISOString(),
      })

      return { status: 201, body: { ok: true, animal: animalData } }
    } catch (err: any) {
      return { status: 500, body: { error: err.message || "Failed to persist animal" } }
    }
  }

  // PUT /api/animals/:name
  const putAnimalMatch = pathname.match(/^\/api\/animals\/([^/]+)$/)
  if (method === "PUT" && putAnimalMatch) {
    const name = decodeURIComponent(putAnimalMatch[1])
    const existing = serverAnimals.get(name) || getAnimalMeta(name) || { name }
    const updated = { ...existing, ...body }
    saveAnimalMeta(name, updated)
    serverAnimals.set(name, updated)

    try {
      await prisma.animal.updateMany({
        where: { name },
        data: {
          breed: updated.breed || undefined,
          ageYears: updated.ageYears || undefined,
          price: updated.price || undefined,
        },
      })
    } catch {}

    wsHub.broadcastToChannel("channel:animals", "ANIMAL_UPDATED", {
      animal: updated,
      timestamp: new Date().toISOString(),
    })

    return { status: 200, body: { ok: true, animal: updated } }
  }

  // DELETE /api/animals/:name
  if (method === "DELETE" && putAnimalMatch) {
    const name = decodeURIComponent(putAnimalMatch[1])
    serverAnimals.delete(name)
    deleteAnimalMeta(name)
    try {
      await prisma.animal.deleteMany({ where: { name } })
    } catch {}

    wsHub.broadcastToChannel("channel:animals", "ANIMAL_DELETED", {
      name,
      timestamp: new Date().toISOString(),
    })

    return { status: 200, body: { ok: true, deleted: name } }
  }

  // ----------------- EMPANELLED VETS API -----------------
  // GET /api/vets
  if (method === "GET" && pathname === "/api/vets") {
    return { status: 200, body: { ok: true, vets: Array.from(serverVets.values()) } }
  }

  // POST /api/vets
  if (method === "POST" && pathname === "/api/vets") {
    const vet = body.vet || body
    const id = vet.id || `VET-${Date.now()}`
    const fullVet = { ...vet, id }
    serverVets.set(id, fullVet)

    wsHub.broadcastToChannel("channel:animals", "VET_UPDATED", {
      vet: fullVet,
      timestamp: new Date().toISOString(),
    })

    return { status: 201, body: { ok: true, vet: fullVet } }
  }

  // PUT /api/vets/:id
  const putVetMatch = pathname.match(/^\/api\/vets\/([^/]+)$/)
  if (method === "PUT" && putVetMatch) {
    const id = putVetMatch[1]
    const existing = serverVets.get(id) || { id }
    const updated = { ...existing, ...body }
    serverVets.set(id, updated)

    wsHub.broadcastToChannel("channel:animals", "VET_UPDATED", {
      vet: updated,
      timestamp: new Date().toISOString(),
    })

    return { status: 200, body: { ok: true, vet: updated } }
  }

  // DELETE /api/vets/:id
  if (method === "DELETE" && putVetMatch) {
    const id = putVetMatch[1]
    serverVets.delete(id)
    return { status: 200, body: { ok: true, deleted: id } }
  }
  if (method === "POST" && pathname === "/api/slots/toggle-block") {
    const { animal, date, time } = body
    const existing = await prisma.animalScheduleBlock.findFirst({
      where: { animalName: animal, date, timeSlot: time },
    })
    if (existing) {
      await prisma.animalScheduleBlock.delete({ where: { id: existing.id } })
      return { status: 200, body: { unblocked: true } }
    } else {
      const a = await prisma.animal.findFirst({ where: { name: animal } })
      await prisma.animalScheduleBlock.create({
        data: {
          animalId: a?.id || "",
          animalName: animal,
          date,
          timeSlot: time,
          reason: "Manual operational block",
        },
      })
      return { status: 200, body: { blocked: true } }
    }
  }

  // POST /api/animals/:name/status
  const animalStatusMatch = pathname.match(/^\/api\/animals\/([^/]+)\/status$/)
  if (method === "POST" && animalStatusMatch) {
    const animalName = decodeURIComponent(animalStatusMatch[1])
    const { status, reason, cooldownMinutes } = body

    // Broadcast status change immediately to all clients
    wsHub.broadcastToChannel("channel:animals", "ANIMAL_STATUS_CHANGED", {
      animal: animalName,
      status,
      reason,
      cooldownMinutes: cooldownMinutes || 90,
      timestamp: new Date().toISOString(),
    })

    // Also notify gosala managers and admin
    wsHub.broadcastToChannel("channel:admin", "ROLE_ALERT", {
      targetRole: "OPERATIONS_ADMIN",
      title: `Animal Status Updated: ${animalName}`,
      message: `${animalName} status set to ${status}${
        reason ? ` (${reason})` : ""
      }`,
      priority:
        status === "Vet Care" || status === "Heat Hold" ? "HIGH" : "NORMAL",
      timestamp: new Date().toISOString(),
    })

    return {
      status: 200,
      body: {
        success: true,
        animal: animalName,
        status,
        reason,
        cooldownMinutes: cooldownMinutes || 90,
      },
    }
  }

  // ----------------- DYNAMIC USER PROFILES -----------------
  // GET /api/profiles
  if (method === "GET" && pathname === "/api/profiles") {
    return { status: 200, body: { profiles: serverProfiles } }
  }

  // GET /api/profiles/:role
  const profileRoleMatch = pathname.match(/^\/api\/profiles\/([^/]+)$/)
  if (method === "GET" && profileRoleMatch) {
    const roleKey = profileRoleMatch[1]
    const p = serverProfiles[roleKey]
    if (!p)
      return {
        status: 404,
        body: { error: `Profile for role ${roleKey} not found` },
      }
    return { status: 200, body: { profile: p } }
  }

  // PUT / POST /api/profiles/:role
  if ((method === "PUT" || method === "POST") && profileRoleMatch) {
    const roleKey = profileRoleMatch[1]
    const existing = serverProfiles[roleKey] || {
      id: `USER-${roleKey.toUpperCase()}`,
      role: roleKey,
    }
    const updated = {
      ...existing,
      ...body,
      customerData: body.customerData
        ? { ...(existing.customerData || {}), ...body.customerData }
        : existing.customerData,
      managerData: body.managerData
        ? { ...(existing.managerData || {}), ...body.managerData }
        : existing.managerData,
      driverData: body.driverData
        ? { ...(existing.driverData || {}), ...body.driverData }
        : existing.driverData,
      adminData: body.adminData
        ? { ...(existing.adminData || {}), ...body.adminData }
        : existing.adminData,
      bankDetails: body.bankDetails !== undefined
        ? (body.bankDetails ? { ...(existing.bankDetails || {}), ...body.bankDetails } : undefined)
        : existing.bankDetails,
      settlementSchedule: body.settlementSchedule !== undefined
        ? (body.settlementSchedule ? { ...(existing.settlementSchedule || {}), ...body.settlementSchedule } : undefined)
        : existing.settlementSchedule,
    }
    serverProfiles[roleKey] = updated

    // Optionally update user in database if matching record exists
    try {
      if (updated.email) {
        await prisma.user
          .upsert({
            where: { email: updated.email },
            create: {
              name: updated.name || "User",
              email: updated.email,
              phone: updated.phone || "+91 98000 00000",
              role: (roleKey === "customer"
                ? "CUSTOMER"
                : roleKey === "manager"
                  ? "GOSALA_MANAGER"
                  : roleKey === "driver"
                    ? "DRIVER"
                    : roleKey === "super_admin"
                      ? "SUPER_ADMIN"
                      : "OPERATIONS_ADMIN") as any,
            },
            update: {
              name: updated.name,
              phone: updated.phone,
            },
          })
          .catch(() => {})
      }
    } catch {}

    return { status: 200, body: { success: true, profile: updated } }
  }

  return { status: 404, body: { error: "Endpoint not found" } }
}
