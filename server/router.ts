import { prisma } from "./prisma.ts"
import { wsHub } from "./ws/hub.ts"
import { gpsSimulator } from "./ws/gpsSimulator.ts"
import { db } from "./db.ts"
import type { GpsTickPayload } from "./ws/types.ts"
import type {
  Booking,
  BookingStatus,
  GosalaManager,
  PricingConfig,
  Settlement,
} from "./types.ts"

type HandlerResponse = {
  status: number
  body: any
}

const driverLiveLocations = new Map<string, any>()
const serverAnimals = new Map<string, any>()
const serverVets = new Map<string, any>()

const serverProfiles: Record<string, any> = {
  customer: {
    id: "USER-CUST-101",
    role: "customer",
    name: "Ananya Deshmukh",
    phone: "+91 98204 11827",
    email: "ananya.deshmukh@gmail.com",
    customerData: {
      address: "14 Tulsi Nagar, Kothrud, Pune",
      aadhaarNumber: "XXXX-XXXX-4819",
      memberSince: "Aug 2024",
      totalBookings: 4,
      preferredCeremony: "Griha Pravesh & Kamadhenu Puja",
    },
  },
  manager: {
    id: "USER-MGR-804",
    role: "manager",
    name: "Rahul Kamble",
    phone: "+91 98230 44910",
    email: "rahul.kamble@gomaa.in",
    managerData: {
      managerId: "MGR-804",
      gosala: "Shri Krishna Gaushala",
      region: "Pune Western Zone",
      dailySevaCeiling: 2,
      restingBufferMin: 90,
    },
  },
  driver: {
    id: "USER-DRV-102",
    role: "driver",
    name: "Sunil Pawar",
    phone: "+91 98201 55432",
    email: "sunil.pawar@gomaa.in",
    driverData: {
      driverId: "DRV-102",
      vehicleNumber: "MH-12-Q-4491",
      vehicleType: "Tata 407 (8ft Open Bed)",
      licenseNumber: "DL-142011009823",
      gosalaBase: "Shri Krishna Gaushala",
      status: "Available",
    },
  },
  admin: {
    id: "USER-ADM-101",
    role: "admin",
    name: "Priya Sharma",
    phone: "+91 98220 77123",
    email: "priya.sharma@gomaa.in",
    adminData: {
      adminId: "ADM-101",
      designation: "Regional Operations Officer",
      department: "Pune Gaushala Operations & Logistics Hub",
      authorityLevel: "OPERATIONS_ADMIN",
    },
  },
  super_admin: {
    id: "USER-SA-001",
    role: "super_admin",
    name: "Vikramaditya Hegde",
    phone: "+91 98110 33456",
    email: "vikramaditya.hegde@gomaa.in",
    adminData: {
      adminId: "SA-001",
      designation: "Chief Treasury Officer & Financial Controller",
      department: "GOMAA Central Treasury & Gaushala Trust Governance",
      authorityLevel: "SUPER_ADMIN",
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
    customer: b.customerName,
    phone: b.customerPhone,
    gosala: b.gosalaName,
    animal: b.animalName,
    animalType:
      b.animalType === "COW"
        ? "Cow"
        : b.animalType === "BULL"
          ? "Bull"
          : "Calf",
    date: b.bookingDate,
    start: b.startTime,
    end: b.endTime,
    durationMin: b.durationMin,
    address: b.address,
    distanceKm: b.distanceKm,
    base: b.baseRate,
    extraTime: b.extraTimeFee,
    transport: b.transportFee,
    addons: b.addonsFee,
    tax: b.taxFee,
    discount: b.discountFee,
    total: b.totalAmount,
    commissionPct: b.commissionPct,
    status: toFrontendStatus(b.status),
    driver: b.driver?.name || null,
    driverStage: b.driverStage,
    paid: b.isPaid,
    managerRemark: b.managerRemark || undefined,
    adminRemark: b.adminRemark || undefined,
    freeKmSnapshot: b.freeKmSnapshot,
    perKmSnapshot: b.perKmSnapshot,
    extraUnitRateSnapshot: b.extraUnitRateSnapshot,
    commissionSnapshot: b.commissionSnapshot,
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

  return {
    id: user.id.startsWith("MGR-")
      ? user.id
      : `MGR-${user.id.slice(0, 4)}`,
    name: user.name,
    email: user.email,
    phone: user.phone,
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
): Promise<HandlerResponse | null> {
  const { pathname, query } = parseUrl(rawUrl)
  if (!pathname.startsWith("/api/")) return null

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

    const base = body.baseRate ?? 3500
    const durationMin = Number(body.durationMin) || cfg.standardMin || 60
    const extraMin = Math.max(0, durationMin - (cfg.standardMin || 60))
    const unitMin = cfg.extraUnitMin || 30
    const unitRate = cfg.extraUnitRate || 500

    const extraUnits = Math.ceil(extraMin / unitMin)
    const extraTime = extraUnits * unitRate

    const distanceKm = Number(body.distanceKm) || 0
    const freeKm = cfg.freeKm || 5
    const perKm = cfg.perKm || 50
    const chargeableKm = Math.max(
      0,
      Math.round((distanceKm - freeKm) * 10) / 10,
    )
    const transport = Math.round(chargeableKm * perKm)

    const addons = Number(body.addonsCost) || 0
    const discount = Number(body.discount) || 0

    const subtotal = base + extraTime + transport + addons - discount
    const taxPct = cfg.taxPct || 12
    const tax = Math.round((subtotal * taxPct) / 100)
    const total = subtotal + tax

    const commissionPct = cfg.commissionPct || 20
    const commission = Math.round(((base + extraTime) * commissionPct) / 100)

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
      let customer = await prisma.user.findFirst({ where: { name: b.customer } })
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

      const gosala = await prisma.gosala.findFirst({ where: { name: b.gosala } })
      const animal = await prisma.animal.findFirst({ where: { name: b.animal } })

      const created = await prisma.booking.create({
        data: {
          id: b.id,
          customerId: customer.id,
          customerName: b.customer,
          customerPhone: b.phone,
          gosalaId: gosala?.id || (await prisma.gosala.findFirst())!.id,
          gosalaName: b.gosala,
          animalId: animal?.id || (await prisma.animal.findFirst())!.id,
          animalName: b.animal,
          animalType:
            b.animalType === "Cow"
              ? "COW"
              : b.animalType === "Bull"
                ? "BULL"
                : "CALF",
          bookingDate: b.date,
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
            b.commissionSnapshot ||
            Math.round(
              (((b.base ?? 0) + (b.extraTime ?? 0)) * (b.commissionPct ?? 20)) /
                100,
            ),
          gosalaPayable: (b.total ?? 0) - (b.commissionSnapshot || 0),
          status: toPrismaStatus(b.status),
          isPaid: true,
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

      const formatted = formatBooking(created)

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
    } catch {
      // In-Memory Fallback
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
    const managerName = body.managerName || "Rahul Kamble"
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
    const adminName = body.adminName || "Priya Sharma"

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
    const driverName = body.driver

    try {
      const driver = await prisma.user.findFirst({ where: { name: driverName } })

      const updated = await prisma.booking.update({
        where: { id },
        data: {
          driverId: driver?.id || null,
          driverStage: 1,
          status: "CONFIRMED",
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
          const stage = Math.min((memB.driverStage ?? 0) + 1, 9)
          memB.driverStage = stage
          memB.status = stage >= 9 ? "Completed" : stage >= 6 ? "In Service" : memB.status
          return { status: 200, body: { booking: memB } }
        }
        return { status: 404, body: { error: "Booking not found" } }
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
    const b: any = await prisma.booking.findUnique({
      where: { id },
      include: {
        customer: true,
        gosala: true,
        animal: true,
        driver: true,
        auditTrails: true,
      },
    })

    if (!b) return { status: 404, body: { error: "Booking not found" } }

    const totalBookings = await prisma.booking.count({
      where: { customerId: b.customerId },
    })

    const dossier = {
      bookingId: b.id,
      customer: {
        id: b.customer?.id || b.customerId,
        name: b.customerName,
        phone: b.customerPhone,
        email:
          b.customer?.email ||
          `${b.customerName.toLowerCase().replace(/\s+/g, ".")}@gmail.com`,
        memberSince: b.customer?.createdAt
          ? new Date(b.customer.createdAt).toLocaleDateString("en-IN", {
              month: "short",
              year: "numeric",
            })
          : "Aug 2024",
        idType: "Aadhaar / National ID Card",
        idNumber: "XXXX-XXXX-4819",
        idStatus: "Submitted by Booker",
        totalBookingsCount: totalBookings || 1,
      },
      ceremony: {
        ritualPurpose: "Griha Pravesh & Kamadhenu Puja",
        animal: b.animalName,
        animalType:
          b.animalType === "COW"
            ? "Cow"
            : b.animalType === "BULL"
              ? "Bull"
              : "Calf",
        gosala: b.gosalaName,
        date: b.bookingDate,
        timeSlot: `${b.startTime} - ${b.endTime}`,
        durationMin: b.durationMin,
        serviceAddress: b.address,
        distanceKm: b.distanceKm,
        specialInstructions:
          "Ground-floor courtyard altar prepared. Water bucket and grass basket kept ready.",
      },
      payment: {
        totalPaid: b.totalAmount,
        baseRate: b.baseRate,
        extraTime: b.extraTimeFee,
        transport: b.transportFee,
        addons: b.addonsFee,
        tax: b.taxFee,
        isPaid: b.isPaid,
        paymentMethod: "UPI Online (Secured in Escrow)",
        transactionRef: `UPI-TXN-${b.id.replace("-", "")}`,
      },
      logistics: {
        driver: b.driver?.name || null,
        driverStage: b.driverStage,
        status: toFrontendStatus(b.status),
      },
    }

    return { status: 200, body: { ok: true, details: dossier } }
  }

  // GET /api/managers
  if (method === "GET" && pathname === "/api/managers") {
    try {
      const managerUsers = await prisma.user.findMany({
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
      let user = await prisma.user.findUnique({ where: { email: body.email } })
      if (!user) {
        user = await prisma.user.create({
          data: {
            name: body.name,
            email: body.email,
            phone: body.phone,
            role: "GOSALA_MANAGER",
            isActive: body.status !== "Inactive",
          },
        })
      } else {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            name: body.name,
            phone: body.phone,
            role: "GOSALA_MANAGER",
            isActive: body.status !== "Inactive",
          },
        })
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
    const user = await prisma.user.findFirst({
      where: { OR: [{ id }, { id: { startsWith: id } }] },
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
    const user = await prisma.user.findFirst({
      where: { OR: [{ id }, { id: { startsWith: id } }] },
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
    const user = await prisma.user.findFirst({
      where: { OR: [{ id }, { id: { startsWith: id } }] },
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
    const callerName = body.updatedByName || body.callerName || "Vikramaditya Hegde"
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
    const batches = await prisma.settlementBatch.findMany({
      orderBy: { createdAt: "desc" },
    })
    return { status: 200, body: { settlements: batches.map(formatSettlement) } }
  }

  // POST /api/settlements/advance
  if (method === "POST" && pathname === "/api/settlements/advance") {
    const gosala = body.gosala
    const batch = await prisma.settlementBatch.findFirst({
      where: { gosalaName: gosala },
    })
    if (!batch) return { status: 404, body: { error: "Settlement not found" } }

    const nextMap: Record<string, any> = {
      PENDING: "APPROVED",
      APPROVED: "PROCESSING",
      PROCESSING: "PAID",
      PAID: "PAID",
      FAILED: "APPROVED",
    }

    const updated = await prisma.settlementBatch.update({
      where: { id: batch.id },
      data: { status: nextMap[batch.status] || "APPROVED" },
    })

    return { status: 200, body: { settlement: formatSettlement(updated) } }
  }

  // POST /api/settlements/batch-approve
  if (method === "POST" && pathname === "/api/settlements/batch-approve") {
    const batch = body.batch || "SEP-W4"
    await prisma.settlementBatch.updateMany({
      where: { batch, status: "PENDING" },
      data: { status: "APPROVED" },
    })
    return { status: 200, body: { success: true, batch } }
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
      const formatted = dbGosalas.map((g: any) => ({
        ...g,
        assignedManagers: (g.managers || []).map((m: any) => ({
          id: m.user.id.startsWith("MGR-")
            ? m.user.id
            : `MGR-${m.user.id.slice(0, 4)}`,
          name: m.user.name,
          phone: m.user.phone,
          email: m.user.email,
        })),
        managerName:
          (g.managers || [])[0]?.user?.name || "None (Admin Acting)",
        managerId: (g.managers || [])[0]?.user?.id || "",
      }))
      return { status: 200, body: { ok: true, gosalas: formatted } }
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

      // Broadcast new sanctuary event on WebSocket
      wsHub.broadcastToChannel("channel:gosalas", "GOSALA_REGISTERED", {
        gosala: created,
        timestamp: new Date().toISOString(),
      })

      return { status: 201, body: { ok: true, gosala: created } }
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
      const finalLat = body.latitude !== undefined ? Number(body.latitude) : body.lat !== undefined ? Number(body.lat) : undefined
      const finalLng = body.longitude !== undefined ? Number(body.longitude) : body.lng !== undefined ? Number(body.lng) : undefined

      const updated = await prisma.gosala.update({
        where: { id },
        data: {
          name: body.name ? body.name.trim() : undefined,
          region: body.region ? body.region.trim() : undefined,
          address: body.address ? body.address.trim() : undefined,
          contactPhone: body.contactPhone || undefined,
          contactEmail: body.email || undefined,
          latitude: finalLat,
          longitude: finalLng,
        },
      })
      return { status: 200, body: { ok: true, gosala: updated } }
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
      const mapped = dbAnimals.map((a: any) => ({
        name: a.name,
        type: a.type === "COW" ? "Cow" : a.type === "BULL" ? "Bull" : "Calf",
        breed: a.breed || "Indigenous Gir",
        gosala: a.gosala?.name || "Operational Sanctuary",
        age: a.ageYears ? `${a.ageYears} Years` : "5 Years",
        ageYears: a.ageYears || 5,
        weight: "420 kg",
        height: "142 cm",
        category: "Puja & Darshan",
        price: 3500,
        status: a.healthStatus === "HEALTHY" ? "Available" : "Resting Buffer",
        todayBookings: 0,
        maxDailyTrips: 2,
        maxRadiusKm: 20,
        cooldownMinutes: 90,
        assignedHandler: "Gaushala Gosevak",
        diet: "Fresh Napier grass + dry roughage",
        photo: "https://images.unsplash.com/photo-1546722228-7baeca4bd0b3?w=600&h=400&fit=crop&auto=format",
        photos: ["https://images.unsplash.com/photo-1546722228-7baeca4bd0b3?w=600&h=400&fit=crop&auto=format"],
        customDetails: [],
      }))
      // Sync memory map with database state
      serverAnimals.clear()
      for (const item of mapped) {
        serverAnimals.set(item.name, item)
      }
      return { status: 200, body: { ok: true, animals: mapped } }
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
      serverAnimals.set(animalData.name, animalData)

      // Try database sync
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
            healthStatus: "HEALTHY",
            isActive: true,
          },
          update: {
            breed: animalData.breed || undefined,
            ageYears: animalData.ageYears || undefined,
            isActive: true,
          },
        })
      } catch (dbErr) {
        console.warn("Database animal upsert warning (retained in serverAnimals):", dbErr)
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
    const existing = serverAnimals.get(name) || { name }
    const updated = { ...existing, ...body }
    serverAnimals.set(name, updated)

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
    try {
      await prisma.animal.deleteMany({ where: { name } })
    } catch {}
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
