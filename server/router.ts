import { prisma } from "./prisma.ts"
import { wsHub } from "./ws/hub.ts"
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
import { calculateBookingPrice, updateCachedPricingConfig } from "./services/pricingService.ts"
import { issueQuote, verifyQuote } from "./services/quoteService.ts"
import crypto from "node:crypto"
import { createPaymentOrder, verifyCapturedPayment, verifyWebhookSignature } from "./services/razorpayService.ts"
import {
  getWalletBalance,
  creditWallet,
  debitWallet,
  getWalletTransactions,
} from "./services/walletService.ts"
import {
  getAuthUserFromHeader,
  authenticateOrResolveUser,
  authenticateAdminUser,
  checkAdminRateLimit,
  recordAdminLoginAttempt,
  getDirectoryAccounts,
  registerUser,
  getAllUsers,
  updateUser,
  deleteUser,
  switchUserContext,
  inMemoryPasswords,
} from "./auth/authService.ts"
import {
  requestPasswordResetOtp,
  verifyOtpAndGenerateResetToken,
  resetPasswordWithToken,
} from "./services/otpService.ts"
import { sendOtpEmail } from "./services/resendService.ts"
import { canUseLiveTracking, canAccessBooking } from "./auth/authorization.ts"
import {
  getAllOperationalHubs,
  createOperationalHub,
  findNearestOperationalHub,
} from "./services/hubService.ts"
import {
  searchGooglePlacesApi,
  resolveGoogleMapsLinkOrCoords,
} from "./services/googlePlacesService.ts"
import { hashPassword, isPasswordHash } from "./auth/password.ts"

type HandlerResponse = {
  status: number
  body: any
}

const driverLiveLocations = new Map<string, any>()
const serverAnimals = new Map<string, any>()

async function resolveRoleProfilesFromDB(): Promise<Record<string, any>> {
  try {
    const users = await prisma.user.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
    })

    const roleUsers: Record<string, any> = {
      customer: users.find((u) => u.role === "CUSTOMER"),
      manager: users.find((u) => u.role === "GOSALA_MANAGER"),
      driver: users.find((u) => u.role === "DRIVER"),
      admin: users.find((u) => u.role === "OPERATIONS_ADMIN"),
      super_admin: users.find((u) => u.role === "SUPER_ADMIN"),
    }

    const profiles: Record<string, any> = {}
    for (const [roleKey, user] of Object.entries(roleUsers)) {
      const meta = ((user?.metadata as any) || {})
      profiles[roleKey] = {
        id: user?.id || `USER-${roleKey.toUpperCase()}`,
        uniqueId: user?.uniqueId || undefined,
        role: roleKey,
        name: user?.name || (roleKey === "super_admin" ? "Super Admin" : roleKey === "admin" ? "Operations Admin" : roleKey === "manager" ? "Gaushala Manager" : roleKey === "driver" ? "Transit Pilot" : "Devotee"),
        phone: user?.phone || "+91 98000 00000",
        email: user?.email || (roleKey === "super_admin" ? "superadmin@gomaa.in" : `${roleKey}@gomaa.in`),
        avatar: user?.avatar || undefined,
        customerData: meta.customerData || (roleKey === "customer" ? {
          address: "Devotee Residence",
          aadhaarNumber: "XXXX-XXXX-0000",
          memberSince: "Oct 2026",
          totalBookings: 0,
          preferredCeremony: "Kamadhenu Puja & Gau Seva",
        } : undefined),
        managerData: meta.managerData || (roleKey === "manager" ? {
          managerId: user?.uniqueId || "MGR-0101",
          gosala: "Gaushala_01",
          region: "Operational Hub",
          dailySevaCeiling: 2,
          restingBufferMin: 90,
        } : undefined),
        driverData: meta.driverData || (roleKey === "driver" ? {
          driverId: user?.uniqueId || "DRV-102",
          vehicleNumber: "TS-09-GA-1008",
          vehicleType: "Tata 407 (Hydraulic Cattle Bed)",
          licenseNumber: "DL-PENDING",
          gosalaBase: "Unassigned",
          status: "Available",
        } : undefined),
        adminData: meta.adminData || (roleKey === "admin" || roleKey === "super_admin" ? {
          adminId: user?.uniqueId || (roleKey === "super_admin" ? "SA-0001" : "OPS-0101"),
          designation: roleKey === "super_admin" ? "Platform Sovereign & Master Authority" : "Regional Operations Officer",
          department: roleKey === "super_admin" ? "GOMAA Central Platform Governance" : "Regional Gaushala Operations Hub",
          authorityLevel: roleKey === "super_admin" ? "SUPER_ADMIN" : "OPERATIONS_ADMIN",
          ...(roleKey === "super_admin" ? { treasuryClearanceLevel: "Master Sovereign Authority" } : {}),
        } : undefined),
        bankDetails: meta.bankDetails || undefined,
        settlementSchedule: meta.settlementSchedule || undefined,
      }
    }
    return profiles
  } catch (err) {
    console.warn("[resolveRoleProfilesFromDB] DB lookup fallback:", err)
    return {}
  }
}


function parseUrl(url: string) {
  const [rawPath, search] = (url || "").split("?")
  let pathname = rawPath || "/"
  if (!pathname.startsWith("/")) pathname = "/" + pathname
  if (pathname.length > 1 && pathname.endsWith("/")) {
    pathname = pathname.replace(/\/+$/, "")
  }
  const query = new URLSearchParams(search || "")
  return { pathname, query }
}

function toMinutes(t: string): number {
  if (!t) return 0
  const clean = t.trim().toUpperCase()
  const isPM = clean.endsWith("PM")
  const isAM = clean.endsWith("AM")
  const raw = clean.replace(/[A-Z]/g, "").trim()
  const [hStr, mStr] = raw.split(":")
  let h = parseInt(hStr, 10) || 0
  const m = parseInt(mStr, 10) || 0
  if (isPM && h < 12) h += 12
  if (isAM && h === 12) h = 0
  return h * 60 + m
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

function expandDateCandidates(input: any): string[] {
  if (!input) return []
  const s = String(input).replace(/\+/g, " ").trim()
  const set = new Set<string>([s])
  const normalized = normalizeDateStr(s)
  if (normalized) set.add(normalized)

  const parsed = new Date(s)
  if (!isNaN(parsed.getTime())) {
    const yyyy = parsed.getFullYear()
    const mm = String(parsed.getMonth() + 1).padStart(2, "0")
    const dd = String(parsed.getDate()).padStart(2, "0")
    const d = parsed.getDate()
    const shortMonth = parsed.toLocaleString("en-US", { month: "short" })

    set.add(`${yyyy}-${mm}-${dd}`)
    set.add(`${yyyy} ${mm} ${dd}`)
    set.add(`${d} ${shortMonth} ${yyyy}`)
    set.add(`${dd} ${shortMonth} ${yyyy}`)
    set.add(`${d}-${shortMonth}-${yyyy}`)
    set.add(`${dd}-${shortMonth}-${yyyy}`)
    set.add(`${dd}/${mm}/${yyyy}`)
    set.add(`${d}/${mm}/${yyyy}`)
  }
  return Array.from(set).filter(Boolean)
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
    paymentProvider: b.paymentProvider || "RAZORPAY",
    paymentOrderId: b.paymentOrderId || undefined,
    paymentId: b.paymentId || undefined,
    walletTxId: b.walletTxId || undefined,
  }
}

function formatManagerUser(user: any): GosalaManager {
  const formattedMgrId = user.id.startsWith("MGR-")
    ? user.id
    : user.id.startsWith("USER-MGR-")
      ? `MGR-${user.id.replace("USER-MGR-", "")}`
      : user.id.startsWith("USER-")
        ? `MGR-${user.id.replace("USER-", "")}`
        : `MGR-${user.id.slice(0, 8)}`

  const rawAssignments = user.managerAssignments || []
  const assignments = rawAssignments.filter((a: any) => {
    if (!a.gosala) return false
    const meta = getGosalaMeta(a.gosala.id, a.gosala.name)
    // If under admin custody or unassigned, this manager does not own it
    if (meta.isActingManager || meta.actAsManagerMyself) return false
    const gMgrId = meta.managerId || ""
    const gMgrName = (meta.managerName || "").toLowerCase()
    const uCleanId = user.id.startsWith("MGR-") ? user.id.replace(/^MGR-/, "") : user.id
    const uName = (user.name || "").toLowerCase()

    if (gMgrId || (gMgrName && !gMgrName.includes("none"))) {
      const idMatch = Boolean(
        gMgrId &&
          (gMgrId === user.id ||
            gMgrId === formattedMgrId ||
            gMgrId === uCleanId ||
            user.id.includes(gMgrId) ||
            gMgrId.includes(user.id)),
      )
      const nameMatch = Boolean(
        gMgrName &&
          uName &&
          (gMgrName === uName || gMgrName.includes(uName) || uName.includes(gMgrName)),
      )
      return idMatch || nameMatch
    }
    return true
  })
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
    id: formattedMgrId,
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

  // Every API route is private by default. Keep only the minimum bootstrap
  // endpoints public; individual mutation groups add stricter role checks below.
  const isPublicRoute =
    (method === "POST" && (
      pathname === "/api/auth/login" ||
      pathname === "/api/auth/admin-login" ||
      pathname === "/api/auth/register" ||
      pathname === "/api/auth/forgot-password" ||
      pathname === "/api/auth/verify-otp" ||
      pathname === "/api/auth/reset-password" ||
      pathname === "/api/payments/webhook" ||
      pathname === "/api/places/resolve-link"
    )) ||
    (method === "GET" && (
      pathname === "/api/health" ||
      pathname === "/api/hubs" ||
      pathname === "/api/places/search" ||
      pathname === "/api/animals" ||
      pathname === "/api/gosalas" ||
      pathname === "/api/vets" ||
      pathname === "/api/pricing-config" ||
      pathname === "/api/pricing/config" ||
      pathname === "/api/availability"
    ))
  if (!isPublicRoute && !authUser) {
    return { status: 401, body: { ok: false, error: "Authentication required" } }
  }

  const requireRole = (...roles: string[]): HandlerResponse | null =>
    authUser && roles.includes(authUser.role)
      ? null
      : { status: 403, body: { ok: false, error: "Insufficient privileges" } }

  if (
    (method === "POST" && pathname === "/api/hold") ||
    (method === "POST" && pathname === "/api/hold/release") ||
    (method === "POST" && pathname === "/api/bookings")
  ) {
    const denied = requireRole("customer", "admin", "super_admin")
    if (denied) return denied
  }

  if (
    ((method === "GET" || method === "POST") && pathname === "/api/users") ||
    (method === "GET" && pathname === "/api/debug/email-status")
  ) {
    const denied = requireRole("super_admin")
    if (denied) return denied
  }

  if (method === "GET" && pathname === "/api/auth/accounts") {
    const denied = requireRole("super_admin", "admin")
    if (denied) return denied
  }

  if ((method === "PUT" || method === "DELETE") && /^\/api\/users\/[^/]+$/.test(pathname)) {
    const denied = requireRole("super_admin")
    if (denied) return denied
  }

  if (
    ((method === "PUT" || method === "PATCH") &&
      (pathname === "/api/pricing-config" || pathname === "/api/pricing/config")) ||
    (method === "POST" && pathname.startsWith("/api/settlements/"))
  ) {
    const denied = requireRole("super_admin")
    if (denied) return denied
  }

  if (
    method === "GET" &&
    (pathname === "/api/settlements" || pathname === "/api/settlements/schedule")
  ) {
    const denied = requireRole("super_admin", "admin", "manager")
    if (denied) return denied
  }

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
      if (err.message?.includes("/admin portal")) {
        return { status: 403, body: { ok: false, error: err.message, requiresAdminPortal: true } }
      }
      const isAuthErr = err.message?.toLowerCase().includes("password") || err.message?.toLowerCase().includes("invalid") || err.message?.toLowerCase().includes("unauthorized")
      return { status: isAuthErr ? 401 : 500, body: { ok: false, error: err.message || "Authentication failed" } }
    }
  }

  // POST /api/auth/admin-login (Isolated Super Admin & Operations Admin Gateway)
  if (method === "POST" && pathname === "/api/auth/admin-login") {
    const clientIp = (headers?.["x-forwarded-for"] as string) || "127.0.0.1"
    try {
      const emailOrPhone = body.email || body.phone || body.username || body.emailOrPhone || ""
      if (!emailOrPhone) {
        return { status: 400, body: { ok: false, error: "Administrative email, phone, or ID is required" } }
      }
      checkAdminRateLimit(clientIp)
      const session = await authenticateAdminUser(emailOrPhone, body.password)
      recordAdminLoginAttempt(clientIp, true)
      console.log(`[ADMIN SECURITY AUDIT] Successful login for ${session.user.email} (${session.user.role}) from ${clientIp}`)
      return { status: 200, body: { ok: true, token: session.token, user: session.user } }
    } catch (err: any) {
      recordAdminLoginAttempt(clientIp, false)
      console.warn(`[ADMIN SECURITY AUDIT] Failed login from ${clientIp}: ${err.message}`)
      const isAccessDenied = err.message?.includes("Access Denied")
      const isRateLimit = err.message?.includes("Too many")
      const isAuthErr = err.message?.toLowerCase().includes("password") || err.message?.toLowerCase().includes("invalid")
      const status = isRateLimit ? 429 : isAccessDenied ? 403 : isAuthErr ? 401 : 500
      return { status, body: { ok: false, error: err.message || "Administrative authentication failed" } }
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

  // POST /api/auth/forgot-password (Request 6-Digit Verification OTP via Resend or Phone)
  if (method === "POST" && pathname === "/api/auth/forgot-password") {
    try {
      const emailOrPhone = body?.emailOrPhone || body?.email || body?.phone || ""
      const channel = body?.channel || (emailOrPhone.includes("@") ? "EMAIL" : "PHONE")
      const result = await requestPasswordResetOtp(emailOrPhone, channel, (headers?.["x-forwarded-for"] as string) || "")
      return { status: 200, body: result }
    } catch (err: any) {
      return { status: 400, body: { ok: false, error: err.message || "Failed to process verification request" } }
    }
  }

  // POST /api/auth/verify-otp (Verify 6-Digit OTP & Issue Scoped Reset Token)
  if (method === "POST" && pathname === "/api/auth/verify-otp") {
    try {
      const emailOrPhone = body?.emailOrPhone || body?.email || body?.phone || ""
      const otp = body?.otp || body?.code || ""
      const result = await verifyOtpAndGenerateResetToken(emailOrPhone, otp)
      return { status: 200, body: result }
    } catch (err: any) {
      return { status: 400, body: { ok: false, error: err.message || "Invalid or expired verification code" } }
    }
  }

  // POST /api/auth/reset-password (Reset Password with Verified Reset Token)
  if (method === "POST" && pathname === "/api/auth/reset-password") {
    try {
      const emailOrPhone = body?.emailOrPhone || body?.email || body?.phone || ""
      const resetToken = body?.resetToken || body?.token || ""
      const newPassword = body?.newPassword || body?.password || ""
      const result = await resetPasswordWithToken(emailOrPhone, resetToken, newPassword)
      return { status: 200, body: result }
    } catch (err: any) {
      return { status: 400, body: { ok: false, error: err.message || "Failed to reset password" } }
    }
  }

  // POST /api/auth/switch-context (Super Admin Context Switching)
  if (method === "POST" && pathname === "/api/auth/switch-context") {
    if (!authUser) {
      return { status: 401, body: { ok: false, error: "Unauthenticated session" } }
    }
    const targetRole = body?.targetRole || body?.role
    if (!targetRole || (targetRole !== "super_admin" && targetRole !== "admin")) {
      return { status: 400, body: { ok: false, error: "Invalid targetRole. Must be 'super_admin' or 'admin'" } }
    }
    try {
      const session = await switchUserContext(authUser, targetRole)
      return { status: 200, body: { ok: true, token: session.token, user: session.user } }
    } catch (err: any) {
      const status = err.status || (err.message?.includes("Forbidden") ? 403 : 500)
      return { status, body: { ok: false, error: err.message || "Failed to switch role context" } }
    }
  }

  // ----------------- OPERATIONAL HUBS DIRECTORY & REGISTRATION API -----------------
  // GET /api/hubs (List all active regional and dynamic hubs)
  if (method === "GET" && pathname === "/api/hubs") {
    try {
      const hubs = getAllOperationalHubs()
      return { status: 200, body: { ok: true, hubs } }
    } catch (err: any) {
      return { status: 500, body: { ok: false, error: err.message } }
    }
  }

  // POST /api/hubs (Create / Register a new operational hub - Admin / Super Admin)
  if (method === "POST" && pathname === "/api/hubs") {
    const denied = requireRole("admin", "super_admin")
    if (denied) return denied

    try {
      const newHub = createOperationalHub(body)
      return { status: 201, body: { ok: true, hub: newHub } }
    } catch (err: any) {
      return { status: 400, body: { ok: false, error: err.message || "Could not register operational hub" } }
    }
  }

  // ----------------- GOOGLE PLACES & MAPS LINK RESOLUTION API -----------------
  // GET /api/places/search?q=... (Searches Google Places if GOOGLE_MAPS_API_KEY is configured)
  if (method === "GET" && pathname === "/api/places/search") {
    try {
      const q = String(query?.get("q") || "").trim()
      const places = await searchGooglePlacesApi(q)
      return { status: 200, body: { ok: true, places } }
    } catch (err: any) {
      return { status: 500, body: { ok: false, error: err.message } }
    }
  }

  // POST /api/places/resolve-link (Resolves any Google Maps URL or coordinates into structured Gaushala premise)
  if (method === "POST" && pathname === "/api/places/resolve-link") {
    try {
      const input = String(body?.url || body?.input || "").trim()
      if (!input) {
        return { status: 400, body: { ok: false, error: "Missing 'url' or 'input' parameter" } }
      }
      const resolved = await resolveGoogleMapsLinkOrCoords(input)
      if (!resolved) {
        return { status: 404, body: { ok: false, error: "Could not extract location or coordinates from the provided Google Maps link." } }
      }
      return { status: 200, body: { ok: true, place: resolved } }
    } catch (err: any) {
      return { status: 500, body: { ok: false, error: err.message } }
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
      console.warn("[DELETE /api/users] notice:", err?.message)
      return { status: 200, body: { ok: true, deleted: id } }
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

  // GET /api/debug/email-status
  if (method === "GET" && pathname === "/api/debug/email-status") {
    const gmailUser = (process.env.GMAIL_USER || "").replace(/["']/g, "").trim()
    const gmailPass = (process.env.GMAIL_APP_PASSWORD || "").replace(/["'\s]/g, "").trim()
    const resendKey = (process.env.RESEND_API_KEY || "").replace(/["']/g, "").trim()

    const diagnostics: any = {
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      platform: process.platform,
      env: {
        GMAIL_USER_set: !!process.env.GMAIL_USER,
        GMAIL_USER_val: gmailUser ? `${gmailUser.slice(0, 3)}***@${gmailUser.split("@")[1] || ""}` : null,
        GMAIL_APP_PASSWORD_set: !!process.env.GMAIL_APP_PASSWORD,
        GMAIL_APP_PASSWORD_len: gmailPass.length,
        RESEND_API_KEY_set: !!process.env.RESEND_API_KEY,
        RESEND_API_KEY_prefix: resendKey ? resendKey.slice(0, 6) + "..." : null,
      },
    }

    try {
      const sendResult = await sendOtpEmail({
        toEmail: "diagnostics@gomaa.in",
        userName: "Diagnostic Check",
        otp: "123456",
        expiryMinutes: 10,
      })
      diagnostics.dispatchResult = sendResult
    } catch (err: any) {
      diagnostics.dispatchError = err.message || String(err)
    }

    return { status: 200, body: diagnostics }
  }

  // GET /api/availability
  if (method === "GET" && pathname === "/api/availability") {
    try {
      const animalParam = (query.get("animal") || "").trim()
      const rawDate = query.get("date") || ""
      const date = rawDate.replace(/\+/g, " ").trim()
      const time = (query.get("time") || "").replace(/\+/g, " ").trim()
      const duration = Number(query.get("duration")) || 60
      const dateCandidates = expandDateCandidates(rawDate || date)

      // Resolve animal record to support lookup by ID, exact name, or partial name
      const animalRecord = await prisma.animal.findFirst({
        where: {
          OR: [
            { id: animalParam },
            { name: { equals: animalParam, mode: "insensitive" } },
            ...(animalParam ? [{ name: { contains: animalParam, mode: "insensitive" } }] : []),
          ],
        },
      })
      const animalId = animalRecord?.id
      const animalName = animalRecord?.name || animalParam

      // Check manual schedule blocks
      const manualBlock = await prisma.animalScheduleBlock.findFirst({
        where: {
          OR: [
            ...(animalId ? [{ animalId }] : []),
            { animalName: { in: [animalName, animalParam] } },
          ],
          date: { in: dateCandidates },
          timeSlot: time,
        },
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
      const activeHolds = await prisma.temporarySlotHold.findMany({
        where: {
          OR: [
            ...(animalId ? [{ animalId }] : []),
            { animal: { name: { equals: animalName, mode: "insensitive" } } },
          ],
          date: { in: dateCandidates },
          status: "ACTIVE",
          expiresAt: { gt: new Date() },
        },
      })
      for (const hold of activeHolds) {
        const holdStart = toMinutes(hold.startTime)
        const holdEnd = holdStart + (hold.durationMin || 60)
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
          OR: [
            ...(animalId ? [{ animalId }] : []),
            { animalName: { equals: animalName, mode: "insensitive" } },
            { animalName: { equals: animalParam, mode: "insensitive" } },
            ...(animalParam ? [{ animalName: { contains: animalParam, mode: "insensitive" } }] : []),
          ],
          bookingDate: { in: dateCandidates },
          status: { notIn: ["REJECTED", "CANCELLED"] },
        },
      })

      const pricing = await prisma.masterPricingConfig.findFirst().catch(() => null)
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
    } catch (err: any) {
      console.warn("[api/availability] Handled error:", err?.message)
      return { status: 200, body: { available: true, status: "Available" } }
    }
  }

  // POST /api/hold
  if (method === "POST" && pathname === "/api/hold") {
    let animal = await prisma.animal.findFirst({
      where: {
        OR: [
          { id: body.animal },
          { name: { equals: body.animal, mode: "insensitive" } },
          ...(body.animal ? [{ name: { contains: body.animal, mode: "insensitive" } }] : []),
        ],
      },
    })
    if (!animal) {
      const firstGosala = await prisma.gosala.findFirst({ where: { isActive: true } })
      if (firstGosala) {
        animal = await prisma.animal.create({
          data: {
            name: body.animal || "Sacred Cow",
            gosalaId: firstGosala.id,
            type: "COW",
            price: 3500,
            healthStatus: "HEALTHY",
            isActive: true,
          },
        })
      }
    }
    if (!animal) return { status: 404, body: { success: false, error: "Animal not found" } }

    // Ensure customer user record exists in database to satisfy foreign key constraint
    if (authUser?.userId) {
      try {
        const u = await prisma.user.findUnique({ where: { id: authUser.userId } })
        if (!u) {
          await prisma.user.create({
            data: {
              id: authUser.userId,
              email: authUser.email || `${authUser.userId}@gomaa.in`,
              name: authUser.name || body.customerName || "Customer",
              phone: authUser.phone || "+91 98000 00000",
              role: "CUSTOMER",
            },
          })
        }
      } catch {}
    }

    const dateCandidates = expandDateCandidates(body.date)
    const ttlSeconds = Math.min(600, Math.max(60, Number(body.ttlSeconds) || 300))
    const ttl = ttlSeconds * 1000
    let hold: any
    try {
      hold = await prisma.$transaction(async (tx) => {
        try {
          await tx.$queryRaw`SELECT id FROM animals WHERE id = ${animal.id} FOR UPDATE`
        } catch {}

        const holdStart = toMinutes(body.start)
        const holdEnd = holdStart + (Number(body.durationMin) || 60)

        // Check if another customer currently reserves an overlapping time window
        const activeHolds = await tx.temporarySlotHold.findMany({
          where: {
            animalId: animal.id,
            date: { in: dateCandidates },
            status: "ACTIVE",
            expiresAt: { gt: new Date() },
          },
        })
        const isSlotHeld = activeHolds.some((h) => {
          if (authUser?.userId && h.customerId === authUser.userId) return false // Allow own hold renewal
          const s = toMinutes(h.startTime)
          const e = s + (h.durationMin || 60)
          return holdStart < e && holdEnd > s
        })
        if (isSlotHeld) throw new Error("This slot is already held by another devotee")

        const bookings = await tx.booking.findMany({
          where: {
            animalId: animal.id,
            bookingDate: { in: dateCandidates },
            status: { notIn: ["REJECTED", "CANCELLED"] },
          },
        })
        if (bookings.some((booking) => holdStart < toMinutes(booking.endTime) && holdEnd > toMinutes(booking.startTime))) {
          throw new Error("This slot is already booked")
        }

        return tx.temporarySlotHold.create({
          data: {
            id: "HOLD-" + crypto.randomUUID().replace(/-/g, "").slice(0, 20).toUpperCase(),
            animalId: animal.id,
            date: body.date,
            startTime: body.start,
            durationMin: Number(body.durationMin) || 60,
            customerName: authUser?.name || body.customerName || "Customer",
            customerId: authUser?.userId,
            status: "ACTIVE",
            expiresAt: new Date(Date.now() + ttl),
          },
        })
      })
    } catch (err: any) {
      console.warn("[POST /api/hold] Execution notice:", err?.message)
      const message = err?.message || "Unable to create hold"
      return {
        status: message.includes("already") ? 409 : 500,
        body: { success: false, reason: message, error: message },
      }
    }
    return { status: 200, body: { success: true, hold } }
  }

  // POST /api/hold/release
  if (method === "POST" && pathname === "/api/hold/release") {
    const hold = await prisma.temporarySlotHold.findUnique({ where: { id: body.holdId } })
    if (!hold) return { status: 404, body: { released: false, error: "Hold not found" } }
    if (hold.customerId !== authUser?.userId && !["admin", "super_admin"].includes(authUser?.role || "")) {
      return { status: 403, body: { released: false, error: "Hold belongs to another customer" } }
    }
    if (hold.status !== "ACTIVE") return { status: 409, body: { released: false, error: "Hold is no longer active" } }
    await prisma.temporarySlotHold.update({ where: { id: hold.id }, data: { status: "RELEASED", releasedAt: new Date() } })
    return { status: 200, body: { released: true } }
  }

  // POST /api/pricing/calculate
  if (method === "POST" && pathname === "/api/pricing/calculate") {
    let cfg: any = null
    try {
      const dbCfg = await prisma.masterPricingConfig.findFirst()
      if (dbCfg) cfg = dbCfg
    } catch (err: any) {
      console.warn("Pricing config fetch error:", err?.message)
    }
    if (!cfg) {
      cfg = {
        standardMin: 60,
        extraUnitMin: 30,
        extraUnitRate: 500,
        freeKm: 5,
        perKm: 50,
        taxPct: 12,
        commissionPct: 20,
      }
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

    const pricingResult = {
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
    const quoteToken = authUser ? issueQuote(authUser.userId, {
      gosalaId: body.gosalaId,
      gosala: body.gosala,
      animal: body.animal,
      durationMin,
      distanceKm,
      ...pricingResult.body,
    }) : undefined
    return { ...pricingResult, body: { ...pricingResult.body, quoteToken } }
  }

  if (method === "POST" && pathname === "/api/payments/razorpay/order") {
    const denied = requireRole("customer")
    if (denied) return denied
    try {
      const quoteToken = String(body.quoteToken || "")
      const quote = verifyQuote(quoteToken, authUser!.userId).values as any
      const amountPaise = Number(quote.total) * 100
      if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) {
        return { status: 400, body: { error: "Quote has an invalid payment amount" } }
      }
      const result = await createPaymentOrder({
        customerId: authUser!.userId,
        quoteToken,
        holdId: String(body.holdId || ""),
        amountPaise,
      })
      return { status: 201, body: { ok: true, ...result, keyId: process.env.RAZORPAY_KEY_ID } }
    } catch (err: any) {
      return { status: 503, body: { ok: false, error: err.message || "Payment provider unavailable" } }
    }
  }

  // GET /api/wallet/balance
  if (method === "GET" && pathname === "/api/wallet/balance") {
    if (!authUser || !authUser.userId) {
      return { status: 401, body: { ok: false, error: "Authentication required" } }
    }
    try {
      const balance = await getWalletBalance(authUser.userId)
      return { status: 200, body: { ok: true, ...balance } }
    } catch (err: any) {
      return { status: 500, body: { ok: false, error: err.message || "Failed to fetch wallet balance" } }
    }
  }

  // GET /api/wallet/transactions
  if (method === "GET" && pathname === "/api/wallet/transactions") {
    if (!authUser || !authUser.userId) {
      return { status: 401, body: { ok: false, error: "Authentication required" } }
    }
    try {
      const limit = Number(query.get("limit")) || 50
      const transactions = await getWalletTransactions(authUser.userId, limit)
      return { status: 200, body: { ok: true, transactions } }
    } catch (err: any) {
      return { status: 500, body: { ok: false, error: err.message || "Failed to fetch transactions" } }
    }
  }

  // POST /api/wallet/topup/order
  if (method === "POST" && pathname === "/api/wallet/topup/order") {
    if (!authUser || !authUser.userId) {
      return { status: 401, body: { ok: false, error: "Authentication required" } }
    }
    const amountRupees = Number(body.amountRupees || body.amount)
    if (!amountRupees || amountRupees < 100 || amountRupees > 50000) {
      return {
        status: 400,
        body: { ok: false, error: "Top-up amount must be between ₹100 and ₹50,000" },
      }
    }
    const amountPaise = Math.round(amountRupees * 100)
    try {
      const result = await createPaymentOrder({
        customerId: authUser.userId,
        quoteToken: `wallet_topup_${authUser.userId}_${Date.now()}`,
        holdId: `topup_hold_${authUser.userId}`,
        amountPaise,
      })
      return {
        status: 201,
        body: {
          ok: true,
          ...result,
          amountRupees,
          keyId: process.env.RAZORPAY_KEY_ID || "rzp_test_gomaa_synthetic",
        },
      }
    } catch (err: any) {
      return { status: 503, body: { ok: false, error: err.message || "Failed to create topup order" } }
    }
  }

  // POST /api/wallet/topup/verify
  if (method === "POST" && pathname === "/api/wallet/topup/verify") {
    if (!authUser || !authUser.userId) {
      return { status: 401, body: { ok: false, error: "Authentication required" } }
    }
    const { paymentId, orderId, signature, amountPaise } = body
    if (!paymentId || !orderId || !signature || !amountPaise) {
      return { status: 400, body: { ok: false, error: "Missing required payment verification parameters" } }
    }

    const expectedPaise = BigInt(amountPaise)
    if (expectedPaise <= 0n) {
      return { status: 400, body: { ok: false, error: "Invalid payment amount" } }
    }

    // Anti-replay check across existing wallet transactions
    const existingTx = await prisma.walletTransaction.findFirst({
      where: { referenceId: paymentId },
    })
    if (existingTx) {
      return {
        status: 409,
        body: { ok: false, error: "This payment has already been credited to a wallet" },
      }
    }

    // Verify HMAC signature
    const secret = process.env.RAZORPAY_KEY_SECRET || "gomaa_test_secret_2026"
    const expected = crypto.createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex")
    if (signature !== expected) {
      return { status: 402, body: { ok: false, error: "Invalid cryptographic payment signature" } }
    }

    try {
      const creditRes = await creditWallet({
        userId: authUser.userId,
        amountPaise: expectedPaise,
        purpose: "TOPUP",
        referenceId: paymentId,
        idempotencyKey: `topup_${paymentId}`,
        description: `Wallet top-up of ₹${Number(expectedPaise) / 100} via Razorpay (${paymentId})`,
        metadata: { orderId, paymentId },
      })

      return {
        status: 200,
        body: {
          ok: true,
          message: "Wallet topped up successfully",
          ...creditRes,
        },
      }
    } catch (err: any) {
      return { status: 500, body: { ok: false, error: err.message || "Failed to credit wallet" } }
    }
  }

  // POST /api/payments/webhook
  if (method === "POST" && pathname === "/api/payments/webhook") {
    const webhookSignature =
      headers?.["x-razorpay-signature"] ||
      headers?.["X-Razorpay-Signature"]
    if (!webhookSignature || typeof webhookSignature !== "string") {
      return { status: 400, body: { ok: false, error: "Missing webhook signature" } }
    }

    try {
      const isValid = verifyWebhookSignature(rawBody, webhookSignature)
      if (!isValid) {
        return { status: 400, body: { ok: false, error: "Invalid webhook signature" } }
      }
    } catch (err: any) {
      return { status: 500, body: { ok: false, error: err?.message || "Webhook verification failed" } }
    }

    let payload: any = {}
    try {
      payload = JSON.parse(rawBody)
    } catch {
      return { status: 400, body: { ok: false, error: "Invalid JSON payload" } }
    }

    const event = payload.event
    const paymentEntity = payload.payload?.payment?.entity
    const orderEntity = payload.payload?.order?.entity

    try {
      if (event === "payment.captured" || event === "order.paid") {
        const orderId = orderEntity?.id || paymentEntity?.order_id
        const paymentId = paymentEntity?.id

        if (orderId) {
          const booking = await prisma.booking.findFirst({
            where: {
              OR: [
                { paymentOrderId: orderId },
                ...(paymentId ? [{ paymentId }] : []),
              ],
            },
          })

          if (booking) {
            await prisma.booking.update({
              where: { id: booking.id },
              data: {
                paymentStatus: "CAPTURED",
                isPaid: true,
                paymentId: paymentId || booking.paymentId,
                paymentOrderId: orderId || booking.paymentOrderId,
                paymentCapturedAt: booking.paymentCapturedAt || new Date(),
              },
            })
          }
        }
      } else if (event === "payment.failed") {
        const orderId = orderEntity?.id || paymentEntity?.order_id
        const paymentId = paymentEntity?.id

        if (orderId) {
          const booking = await prisma.booking.findFirst({
            where: {
              OR: [
                { paymentOrderId: orderId },
                ...(paymentId ? [{ paymentId }] : []),
              ],
            },
          })

          if (booking && booking.paymentStatus !== "CAPTURED") {
            await prisma.booking.update({
              where: { id: booking.id },
              data: {
                paymentStatus: "FAILED",
              },
            })
          }
        }
      }

      return {
        status: 200,
        body: { ok: true, received: true, event },
      }
    } catch (err: any) {
      console.error("[Razorpay Webhook Error]:", err)
      return {
        status: 500,
        body: { ok: false, error: "Webhook reconciliation failed" },
      }
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
              const gEmail = (g.adminEmail || meta.governingAdminEmail || "").toLowerCase()
              const gName = (g.adminName || meta.governingAdminName || meta.adminName || "").toLowerCase()
              const emailMatch = Boolean(gEmail && gEmail === adminEmail)
              const nameMatch = Boolean(adminName && (gName === adminName || gName.includes(adminName)))
              const idMatch = Boolean(authUser.userId && g.adminId === authUser.userId)
              return emailMatch || nameMatch || idMatch
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
    } catch (err: any) {
      console.warn("[GET /api/bookings] DB fallback notice:", err?.message)
      return { status: 200, body: { bookings: [] } }
    }
  }

  // POST /api/bookings
  if (method === "POST" && pathname === "/api/bookings") {
    const b: Booking = body.booking
    if (!b || !b.id)
      return { status: 400, body: { error: "Missing booking payload" } }

    if (authUser?.role !== "customer" && !["admin", "super_admin"].includes(authUser?.role || "")) {
      return { status: 403, body: { error: "Only customers may create bookings" } }
    }

    const quoteToken = body.quoteToken || (b as any).quoteToken
    if (!quoteToken) return { status: 400, body: { error: "A current server quote is required" } }
    let quote: any
    try { quote = verifyQuote(quoteToken, authUser.userId).values }
    catch (err: any) { return { status: 409, body: { error: err.message } } }
    if (quote.gosala !== b.gosala || quote.animal !== b.animal || quote.durationMin !== Number(b.durationMin)) {
      return { status: 409, body: { error: "Booking no longer matches the quoted service" } }
    }

    // Identity and money are server-owned. The browser may provide display data,
    // but it cannot create a booking for another account or alter the quote.
    if (authUser.role === "customer" && b.customer && b.customer.trim().toLowerCase() !== authUser.name.trim().toLowerCase()) {
      return { status: 403, body: { error: "Booking customer does not match authenticated account" } }
    }
    const calculated = calculateBookingPrice({
      baseRate: Number(b.base) || 0,
      durationMin: Number(b.durationMin) || 60,
      distanceKm: Number(b.distanceKm) || 0,
      addonsCost: Number(b.addons) || 0,
      discount: Number(b.discount) || 0,
      commissionPct: Number(b.commissionPct) || 20,
      freeKm: Number(b.freeKmSnapshot) || undefined,
      perKm: Number(b.perKmSnapshot) || undefined,
      extraUnitRate: Number(b.extraUnitRateSnapshot) || undefined,
    })
    const moneyMatches =
      calculated.total === Number(b.total) &&
      calculated.tax === Number(b.tax) &&
      calculated.transport === Number(b.transport) &&
      calculated.extraTime === Number(b.extraTime) &&
      calculated.commission === Number(b.commissionSnapshot)
    if (!moneyMatches) {
      return { status: 400, body: { error: "Booking quote is stale or was modified. Recalculate before submitting." } }
    }

    let payment = body.payment || {}
    const expectedPaise = Math.round(Number(quote.total) * 100)
    const isWalletPayment = body.paymentProvider === "WALLET" || (b as any).paymentProvider === "WALLET"

    if (isWalletPayment) {
      try {
        const debitRes = await debitWallet({
          userId: authUser.userId,
          amountPaise: expectedPaise,
          purpose: "BOOKING_PAYMENT",
          referenceId: b.id,
          idempotencyKey: `booking_pay_${b.id}`,
          description: `Devotional Seva Booking payment for ${b.id}`,
        })
        payment = {
          paymentId: debitRes.transactionId,
          orderId: `wallet_ord_${b.id}`,
          signature: `wallet_sig_${debitRes.transactionId}`,
          amountPaise: expectedPaise,
        }
      } catch (err: any) {
        return { status: 402, body: { error: err.message || "Wallet payment failed" } }
      }
    } else {
      // FAIL-CLOSED PAYMENT ENFORCEMENT:
      // A booking cannot be created without verified payment proof from Razorpay.
      if (!payment.paymentId || !payment.orderId || !payment.signature) {
        return { status: 402, body: { error: "Verified Razorpay payment is required before booking" } }
      }
      if (!Number.isSafeInteger(expectedPaise) || Number(payment.amountPaise) !== expectedPaise) {
        return { status: 402, body: { error: "Payment amount does not match the server quote" } }
      }

      // ANTI-PAYMENT-REPLAY ENFORCEMENT:
      // Prevent reuse of paymentId or paymentOrderId across different bookings.
      const replayedBooking = await prisma.booking.findFirst({
        where: {
          OR: [
            { paymentId: payment.paymentId },
            { paymentOrderId: payment.orderId },
          ],
        },
        select: { id: true, customerId: true },
      })
      if (replayedBooking && replayedBooking.id !== b.id) {
        return {
          status: 409,
          body: { error: "This payment proof has already been applied to an existing booking" },
        }
      }

      try {
        await verifyCapturedPayment({
          paymentId: payment.paymentId,
          orderId: payment.orderId,
          signature: payment.signature,
          customerId: authUser.userId,
          quoteToken,
          amountPaise: expectedPaise,
          holdId: String(body.holdId || (b as any).holdId || ""),
        })
      } catch (err: any) {
        return { status: 402, body: { error: err.message || "Payment verification failed" } }
      }
    }

    try {
      const existingBooking = await prisma.booking.findUnique({ where: { id: b.id } })
      if (existingBooking) {
        if (existingBooking.customerId !== authUser.userId) {
          return { status: 409, body: { error: "Booking ID is already used by another customer" } }
        }
        return { status: 409, body: { error: "Booking request was already processed", booking: formatBooking(existingBooking) } }
      }
      // Locate related entities or default to customer
      let customer: any = null
      if (authUser?.role === "customer" && authUser.userId) {
        customer = await prisma.user.findUnique({ where: { id: authUser.userId } })
      }
      if (!customer) return { status: 401, body: { error: "Authenticated customer account was not found" } }

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

      const created = await prisma.$transaction(async (tx) => {
        const holdId = body.holdId || (b as any).holdId
        if (!holdId) throw new Error("Booking hold is required")
        const ownedHold = await tx.temporarySlotHold.findUnique({ where: { id: holdId } })
        if (!ownedHold || ownedHold.customerId !== authUser.userId || ownedHold.status !== "ACTIVE" || ownedHold.expiresAt <= new Date()) {
          throw new Error("Hold is expired, consumed, or not owned by this customer")
        }
        const createdBooking = await (tx.booking as any).create({
        data: {
          id: b.id,
          customerId: customer.id,
          customerName: b.customer || customer.name || "Devotee",
          customerPhone: b.phone || customer.phone || "+91 98000 00000",
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
          startTime: b.start || "10:00",
          endTime: b.end || "11:00",
          durationMin: Number(b.durationMin) || 60,
          address: b.address || "Devotee Residence Altar, Hyderabad",
          distanceKm: Number(b.distanceKm) || 0,
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
          status: toPrismaStatus(b.status) || "PAYMENT_VERIFIED",
           isPaid: true,
           paymentProvider: isWalletPayment ? "WALLET" : "RAZORPAY",
           paymentOrderId: payment.orderId,
           paymentId: payment.paymentId,
           walletTxId: isWalletPayment ? payment.paymentId : null,
           paymentStatus: "CAPTURED",
           paymentCapturedAt: new Date(),
          handoverOtp: b.handoverOtp || String(Math.floor(1000 + Math.random() * 9000)),
          handoverOtpVerified: false,
          freeKmSnapshot: b.freeKmSnapshot || 5.0,
          perKmSnapshot: b.perKmSnapshot || 50.0,
          extraUnitRateSnapshot: b.extraUnitRateSnapshot || 500,
          commissionSnapshot: b.commissionSnapshot || 0,
        },
        include: { driver: true, auditTrails: true },
      })

        await tx.temporarySlotHold.update({ where: { id: holdId }, data: { status: "CONSUMED", consumedAt: new Date() } })
        return createdBooking
      })

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

      // Broadcast new booking to admin and sanctuary channels for instant UI roster refresh
      wsHub.broadcastToChannel("channel:admin", "BOOKING_UPDATED", {
        booking: formatted,
      })
      wsHub.broadcastToChannel("channel:super_admin", "BOOKING_UPDATED", {
        booking: formatted,
      })
      wsHub.broadcastToChannel(`channel:gosala:${created.gosalaName}`, "BOOKING_UPDATED", {
        booking: formatted,
      })

      return { status: 201, body: { booking: formatted } }
    } catch (err: any) {
      console.error("Booking creation error in PostgreSQL:", err)
      const message = String(err?.message || "")
      if (message.includes("Hold is expired") || message.includes("Booking hold is required")) {
        return { status: 409, body: { error: message } }
      }
      if (message.includes("Unique constraint") || message.includes("Unique constraint failed")) {
        return { status: 409, body: { error: "Booking request conflicts with an existing record" } }
      }
      return { status: 500, body: { error: "Booking could not be persisted; no booking was created" } }
    }
  }

  // POST /api/bookings/:id/manager-decide (or /manager-confirm)
  const mgrDecideMatch = pathname.match(
    /^\/api\/bookings\/([^/]+)\/(manager-decide|manager-confirm)$/,
  )
  if (method === "POST" && mgrDecideMatch) {
    const denied = requireRole("manager", "admin", "super_admin")
    if (denied) return denied
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
      console.error("[manager-decide] DB error:", e?.message)
      return { status: 500, body: { error: e?.message || "Failed to update booking review" } }
    }
  }

  // POST /api/bookings/:id/admin-decide (or /admin-confirm)
  const admDecideMatch = pathname.match(
    /^\/api\/bookings\/([^/]+)\/(admin-decide|admin-confirm)$/,
  )
  if (method === "POST" && admDecideMatch) {
    const denied = requireRole("admin", "super_admin")
    if (denied) return denied
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

    const isPaymentVerified =
      currentStatus === "PAYMENT_VERIFIED" || currentStatus === "Payment Verified"

    const effectiveActAsManager = Boolean(body.actAsManager || (isPaymentVerified && confirm))

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

      // If actAsManager was requested or auto-elevated by admin approval, record acting manager review
      if (isPaymentVerified && effectiveActAsManager) {
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
    } catch (e: any) {
      console.error("[admin-decide] DB error:", e?.message)
      return { status: 500, body: { error: e?.message || "Failed to update booking approval" } }
    }
  }

  // POST /api/bookings/:id/assign-driver
  const assignDriverMatch = pathname.match(
    /^\/api\/bookings\/([^/]+)\/assign-driver$/,
  )
  if (method === "POST" && assignDriverMatch) {
    const denied = requireRole("admin", "super_admin")
    if (denied) return denied
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
    } catch (e: any) {
      console.error("[assign-driver] DB error:", e?.message)
      return { status: 500, body: { error: e?.message || "Failed to assign driver" } }
    }
  }

  // POST /api/bookings/:id/advance-stage
  const advanceStageMatch = pathname.match(
    /^\/api\/bookings\/([^/]+)\/advance-stage$/,
  )
  if (method === "POST" && advanceStageMatch) {
    const denied = requireRole("driver", "admin", "super_admin")
    if (denied) return denied
    const id = advanceStageMatch[1]

    try {
      const b = await prisma.booking.findUnique({ where: { id } })
      if (!b) return { status: 404, body: { error: "Booking not found" } }

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

      return { status: 200, body: { booking: formatted } }
    } catch (e: any) {
      console.error("[advance-stage] DB error:", e?.message)
      return { status: 500, body: { error: e?.message || "Failed to advance stage" } }
    }
  }

  // POST /api/bookings/:id/set-stage (or /driver-stage)
  const setStageMatch = pathname.match(
    /^\/api\/bookings\/([^/]+)\/(set-stage|driver-stage)$/,
  )
  if (method === "POST" && setStageMatch) {
    const denied = requireRole("driver", "admin", "super_admin")
    if (denied) return denied
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

    return { status: 200, body: { booking: formatted } }
  }

  // POST /api/bookings/:id/verify-handover-otp
  const verifyOtpMatch = pathname.match(/^\/api\/bookings\/([^/]+)\/verify-handover-otp$/)
  if (method === "POST" && verifyOtpMatch) {
    const denied = requireRole("driver", "admin", "super_admin")
    if (denied) return denied
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
      return { status: 404, body: { success: false, error: "Booking not found" } }
    }

    const expectedOtp = String(booking.handoverOtp || "4819").trim()
    if (submittedOtp !== expectedOtp) {
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
      console.error("[verify-handover-otp] DB error:", err?.message)
      return { status: 500, body: { success: false, error: err?.message || "Failed to verify OTP" } }
    }
  }

  // POST /api/bookings/:id/telemetry
  const telemetryMatch = pathname.match(/^\/api\/bookings\/([^/]+)\/telemetry$/)
  if (method === "POST" && telemetryMatch) {
    const denied = requireRole("driver", "admin", "super_admin")
    if (denied) return denied
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
    if (!authUser || !canUseLiveTracking(authUser)) {
      return { status: 403, body: { error: "Live tracking is not enabled for this role" } }
    }
    const accessBooking = await prisma.booking.findUnique({ where: { id } })
    if (!accessBooking) return { status: 404, body: { error: "Booking not found" } }
    if (!canAccessBooking(authUser, accessBooking as any)) {
      return { status: 403, body: { error: "You are not authorized to track this booking" } }
    }
    const live = driverLiveLocations.get(id)
    if (live) {
      return { status: 200, body: { ok: true, location: live } }
    }

    // Fallback based on database booking
    const b = accessBooking
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

    if (!b) return { status: 404, body: { error: "Booking not found" } }
    if (!authUser || !canAccessBooking(authUser, b as any)) {
      return { status: 403, body: { error: "You are not authorized to view this customer data" } }
    }

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
        const adminId = authUser.userId || ""

        // Get Gaushalas under this Operations Admin
        const allGosalas = await prisma.gosala.findMany({ where: { isActive: true } })
        const myGosalaIds = allGosalas
          .filter((g: any) => {
            const meta = getGosalaMeta(g.id, g.name)
            const gEmail = (g.adminEmail || meta.governingAdminEmail || meta.adminEmail || "").toLowerCase()
            const gName = (g.adminName || meta.governingAdminName || meta.adminName || "").toLowerCase()
            const idMatch = Boolean(adminId && (g.adminId === adminId || meta.adminId === adminId))
            const emailMatch = Boolean(adminEmail && (gEmail === adminEmail || gEmail.includes(adminEmail)))
            const nameMatch = Boolean(adminName && (gName === adminName || gName.includes(adminName)))
            return idMatch || emailMatch || nameMatch
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
              const govName = (ma.gosala?.adminName || meta.governingAdminName || meta.adminName || "").toLowerCase()
              const govEmail = (ma.gosala?.adminEmail || meta.governingAdminEmail || "").toLowerCase()
              const govId = ma.gosala?.adminId || meta.adminId || ""
              return govName.includes(filterLower) || govEmail.includes(filterLower) || govId === portfolioFilter
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

      const rawPassword = typeof body.password === "string" ? body.password.trim() : ""
      const securePassword = rawPassword
        ? (isPasswordHash(rawPassword) ? rawPassword : hashPassword(rawPassword))
        : undefined

      if (!user) {
        user = await prisma.user.create({
          data: {
            name: cleanName,
            email,
            phone: cleanPhone,
            role: "GOSALA_MANAGER",
            isActive: body.status !== "Inactive",
            password: securePassword,
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
            ...(securePassword ? { password: securePassword } : {}),
          },
        })
      }

      if (body.password) {
        setUserMeta(user.email, { password: body.password })
        inMemoryPasswords.set(user.email.toLowerCase(), body.password)
        inMemoryPasswords.set(user.id, body.password)
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
        if (!targetGosala) {
          if (authUser?.role === "admin") {
            return {
              status: 403,
              body: {
                ok: false,
                error: `Forbidden: Gaushala "${gNameOrId}" is outside your operational portfolio`,
              },
            }
          }
          continue
        }
        if (targetGosala) {
          // Multi-tenant check: Operations Admin can only assign managers to Gaushalas within their operational portfolio
          if (authUser?.role === "admin") {
            const adminEmail = (authUser.email || "").toLowerCase()
            const adminName = (authUser.name || "").toLowerCase()
            const adminId = authUser.userId || ""
            const isMyGosala = targetGosala.adminId === adminId ||
              (targetGosala.adminEmail && targetGosala.adminEmail.toLowerCase() === adminEmail) ||
              (targetGosala.adminName && targetGosala.adminName.toLowerCase().includes(adminName))
            if (!isMyGosala) {
              return {
                status: 403,
                body: { ok: false, error: `Forbidden: You cannot assign managers to ${targetGosala.name} outside your operational portfolio` },
              }
            }
          }
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
              region: body.region || targetGosala.region,
              status: "Active",
            },
            update: {
              status: "Active",
            },
          })
          saveGosalaMeta(targetGosala.id, targetGosala.name, {
            managerId: user.id.startsWith("MGR-") ? user.id : `MGR-${user.id.slice(0, 4)}`,
            managerName: user.name,
            caretaker: user.name,
            isActingManager: false,
            actAsManagerMyself: false,
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
        isActive: body.isActive !== undefined ? Boolean(body.isActive) : user.isActive,
      },
    })

    if (body.password) {
      const raw = typeof body.password === "string" ? body.password.trim() : ""
      const hashed = raw ? (isPasswordHash(raw) ? raw : hashPassword(raw)) : undefined
      setUserMeta(user.email, { password: raw })
      setUserMeta(user.id, { password: raw })
      inMemoryPasswords.set(user.email.toLowerCase(), raw)
      inMemoryPasswords.set(user.id, raw)
      try {
        if (hashed) {
          await prisma.user.update({
            where: { id: user.id },
            data: { password: hashed },
          })
        }
      } catch {}
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

      // Relieve this user from any Gaushalas that are not in targetGosalas
      try {
        const allActiveGosalas = await prisma.gosala.findMany({ where: { isActive: true } })
        const uId = user.id
        const uCleanId = uId.startsWith("MGR-") ? uId.replace(/^MGR-/, "") : uId
        for (const g of allActiveGosalas) {
          const meta = getGosalaMeta(g.id, g.name)
          const isMgr = meta.managerId === uId || meta.managerId === `MGR-${uCleanId.slice(0, 4)}` || meta.managerId === uCleanId
          if (isMgr) {
            const isRetained = targetGosalas.some(tg => tg === g.id || tg.toLowerCase() === g.name.toLowerCase())
            if (!isRetained) {
              saveGosalaMeta(g.id, g.name, {
                managerId: "",
                managerName: "None (Admin Custody)",
                caretaker: "None (Admin Custody)",
                isActingManager: true,
                actAsManagerMyself: true,
              })
            }
          }
        }
      } catch {}

      // Re-create new assignments with single-custodian enforcement
      for (const gNameOrId of targetGosalas) {
        if (!gNameOrId || gNameOrId === "Unassigned") continue
        const targetGosala = await prisma.gosala.findFirst({
          where: {
            OR: [{ id: gNameOrId }, { name: gNameOrId }],
          },
        })
        if (!targetGosala) {
          if (authUser?.role === "admin") {
            return {
              status: 403,
              body: {
                ok: false,
                error: `Forbidden: Gaushala "${gNameOrId}" is outside your operational portfolio`,
              },
            }
          }
          continue
        }
        if (targetGosala) {
          // Relieve any other manager who was previously assigned to this Gaushala
          await prisma.gosalaManagerAssignment.deleteMany({
            where: {
              gosalaId: targetGosala.id,
              NOT: { userId: user.id },
            },
          })
          await prisma.gosalaManagerAssignment.create({
            data: {
              userId: user.id,
              gosalaId: targetGosala.id,
              region: body.region || targetGosala.region,
              status: "Active",
            },
          })
          saveGosalaMeta(targetGosala.id, targetGosala.name, {
            managerId: user.id.startsWith("MGR-") ? user.id : `MGR-${user.id.slice(0, 4)}`,
            managerName: user.name,
            caretaker: user.name,
            isActingManager: false,
            actAsManagerMyself: false,
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
    try {
      const rawParam = delMgrMatch[1]
      const id = decodeURIComponent(rawParam).trim()
      const cleanId = id.startsWith("MGR-") ? id.replace(/^MGR-/, "") : id
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { id },
            { id: cleanId },
            { id: { startsWith: cleanId } },
            { email: { equals: id, mode: "insensitive" } },
            { name: { equals: id, mode: "insensitive" } },
          ],
        },
      })
      if (user) {
        // 1. Relieve manager assignments
        await prisma.gosalaManagerAssignment.deleteMany({
          where: { userId: user.id },
        })

        // 2. Clear this manager from all gaushalas in gosalaMeta & DB metadata so the name doesn't linger on dashboard
        try {
          const allGosalas = await prisma.gosala.findMany({ select: { id: true, name: true, metadata: true } })
          for (const g of allGosalas) {
            const meta = getGosalaMeta(g.id, g.name)
            const matchId = meta.managerId && (meta.managerId === user.id || meta.managerId === cleanId || user.id.includes(meta.managerId))
            const matchName = meta.managerName && (meta.managerName.toLowerCase() === user.name.toLowerCase() || meta.managerName.toLowerCase().includes(user.name.toLowerCase()))
            if (matchId || matchName) {
              saveGosalaMeta(g.id, g.name, {
                managerId: undefined,
                managerName: "None (Admin Custody)",
                isActingManager: true,
              })
              try {
                const currentMeta = (g.metadata && typeof g.metadata === "object") ? { ...(g.metadata as any) } : {}
                delete currentMeta.managerId
                currentMeta.managerName = "None (Admin Custody)"
                currentMeta.isActingManager = true
                await prisma.gosala.update({
                  where: { id: g.id },
                  data: { metadata: currentMeta },
                })
              } catch {}
            }
          }
        } catch {}

        // 3. Clear temporary holds, blocks, audits to satisfy FK constraints
        try {
          await prisma.approvalAuditTrail.deleteMany({ where: { actorId: user.id } })
        } catch {}
        try {
          await prisma.temporarySlotHold.deleteMany({ where: { createdBy: user.id } })
        } catch {}
        try {
          await prisma.animalScheduleBlock.deleteMany({ where: { createdBy: user.id } })
        } catch {}

        // 4. Delete user record or deactivate safely
        try {
          await prisma.user.delete({
            where: { id: user.id },
          })
        } catch (delErr: any) {
          console.warn("[DELETE /api/managers] Foreign constraint fallback to deactivate:", delErr?.message)
          await prisma.user.update({
            where: { id: user.id },
            data: { isActive: false, role: "CUSTOMER" },
          })
        }
      }
      return { status: 200, body: { success: true } }
    } catch (err: any) {
      console.error("[DELETE /api/managers/:id] Error deleting manager:", err?.message)
      return { status: 500, body: { error: err?.message || "Failed to delete manager" } }
    }
  }

  // GET /api/pricing-config
  if (method === "GET" && pathname === "/api/pricing-config") {
    try {
      let cfg = await prisma.masterPricingConfig.findFirst()
      if (!cfg) {
        cfg = await prisma.masterPricingConfig.create({
          data: {
            id: 1,
            standardMin: 60,
            extraUnitMin: 30,
            extraUnitRate: 500,
            freeKm: 5.0,
            perKm: 50.0,
            taxPct: 12.0,
            commissionPct: 20.0,
            maxDurationMin: 240,
            bufferMin: 30,
            rounding: "Nearest ₹10",
            updatedByRole: "SUPER_ADMIN",
            updatedByName: "Super Admin",
          },
        })
      }
      return { status: 200, body: { config: cfg } }
    } catch (err: any) {
      console.warn("[GET /api/pricing-config] DB fallback notice:", err?.message)
      return {
        status: 200,
        body: {
          config: {
            id: 1,
            standardMin: 60,
            extraUnitMin: 30,
            extraUnitRate: 500,
            freeKm: 5.0,
            perKm: 50.0,
            taxPct: 12.0,
            commissionPct: 20.0,
            maxDurationMin: 240,
            bufferMin: 30,
            rounding: "Nearest ₹10",
            samagriGaushalaCutPct: 90.0,
            transportPassThroughPct: 100.0,
            autoSweepEnabled: true,
            disbursementCycle: "CONTINUOUS_T_PLUS_ONE",
            autoSweepHour: 23,
            autoSweepMinute: 59,
            updatedByRole: "SUPER_ADMIN",
            updatedByName: "Super Admin",
          },
        },
      }
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
    const callerName = body.updatedByName || body.callerName || "Super Admin"
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

      updateCachedPricingConfig(cfg)

      return { status: 200, body: { config: cfg } }
    } catch (err: any) {
      console.error("[PUT/PATCH /api/pricing-config] DB error:", err?.message)
      return { status: 500, body: { error: err?.message || "Failed to update pricing config" } }
    }
  }

  // GET /api/settlements
  if (method === "GET" && pathname === "/api/settlements") {
    try {
      const batches = await prisma.settlementBatch.findMany({
        orderBy: { createdAt: "desc" },
      })
      return { status: 200, body: { settlements: batches.map(formatSettlement) } }
    } catch (err: any) {
      console.warn("[GET /api/settlements] DB fallback notice:", err?.message)
      return { status: 200, body: { settlements: [] } }
    }
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

    try {
      const batch = await prisma.settlementBatch.findFirst({
        where: { gosalaName: gosala },
        orderBy: { createdAt: "desc" },
      })
      if (batch) {
        const updated = await prisma.settlementBatch.update({
          where: { id: batch.id },
          data: { status: nextMap[batch.status] || "APPROVED" },
        })
        return { status: 200, body: { settlement: formatSettlement(updated) } }
      }
      return { status: 404, body: { error: "Settlement not found" } }
    } catch (err: any) {
      console.error("[POST /api/settlements/advance] DB error:", err?.message)
      return { status: 500, body: { error: err?.message || "Failed to advance settlement" } }
    }
  }

  // POST /api/settlements/batch-approve
  if (method === "POST" && pathname === "/api/settlements/batch-approve") {
    const batch = body.batch || "SEP-W4"
    try {
      await prisma.settlementBatch.updateMany({
        where: { batch, status: "PENDING" },
        data: { status: "APPROVED" },
      })
      return { status: 200, body: { success: true, batch } }
    } catch (err: any) {
      console.error("[POST /api/settlements/batch-approve] DB error:", err?.message)
      return { status: 500, body: { error: err?.message || "Failed to batch approve settlements" } }
    }
  }

  // POST /api/settlements/sweep - Automated / On-Demand Payout Sweep Engine
  if (method === "POST" && pathname === "/api/settlements/sweep") {
    try {
      const profiles = await resolveRoleProfilesFromDB()
      const result = await executeAutomatedSweep({
        targetGosala: body?.gosala,
        cycleType: body?.cycleType,
        serverProfiles: profiles,
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

      if (autoSweepEnabled !== undefined || disbursementCycle) {
        updateCachedPricingConfig({
          ...(autoSweepEnabled !== undefined ? { autoSweepEnabled } : {}),
          ...(disbursementCycle ? { disbursementCycle } : {}),
        })
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
        const meta = (g.metadata && typeof g.metadata === "object") ? { ...(g.metadata as any) } : getGosalaMeta(g.id, g.name)
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

        const activeMgrId = meta.managerId || ""
        const activeMgrName = (meta.managerName || "").toLowerCase()
        const isUnderAdminCustody = Boolean(
          meta.isActingManager ||
          meta.actAsManagerMyself ||
          activeMgrName.includes("none") ||
          activeMgrName.includes("admin custody") ||
          activeMgrName.includes("acting custodian")
        )

        // Strict single-custodian filter for assignedManagers to prevent zombie associations
        const filteredAssignedMgrs = isUnderAdminCustody
          ? []
          : activeMgrId && !activeMgrId.startsWith("USER-")
            ? assignedMgrs.filter((m: any) =>
                m.id === activeMgrId ||
                m.rawUserId === activeMgrId ||
                activeMgrId.includes(m.rawUserId) ||
                m.id.includes(activeMgrId),
              )
            : activeMgrName && !activeMgrName.includes("none") && !activeMgrName.includes("acting")
              ? assignedMgrs.filter((m: any) => m.name.toLowerCase() === activeMgrName)
              : assignedMgrs

        const primaryAssigned = filteredAssignedMgrs[0] || (isUnderAdminCustody ? undefined : assignedMgrs[0])
        const govRole = meta.governingAdminRole || (g.adminId?.startsWith("USER-SA") ? "super_admin" : "admin")
        const govName = g.adminName || meta.governingAdminName || (govRole === "super_admin" ? "Super Admin" : "Operations Admin")
        const govEmail = g.adminEmail || meta.governingAdminEmail || meta.adminEmail || ""

        return {
          ...meta,
          ...g,
          id: g.id,
          name: g.name,
          baseCowPrice: g.baseCowPrice ?? meta.baseCowPrice ?? 3500,
          baseBullPrice: g.baseBullPrice ?? meta.baseBullPrice ?? 4000,
          baseCalfPrice: g.baseCalfPrice ?? meta.baseCalfPrice ?? 2500,
          baseBuffaloPrice: g.baseBuffaloPrice ?? meta.baseBuffaloPrice ?? 3800,
          basePairPrice: g.basePairPrice ?? meta.basePairPrice ?? 4800,
          partnershipTier: g.partnershipTier ?? meta.partnershipTier ?? "STANDARD",
          commissionType: g.commissionType ?? meta.commissionType ?? "PERCENTAGE",
          commissionValue: g.commissionValue ?? meta.commissionValue ?? meta.customCommissionPct ?? 20,
          customCommissionPct: g.commissionValue ?? meta.customCommissionPct,
          taxTreatment: g.taxTreatment ?? meta.taxTreatment ?? "STANDARD_GST",
          customTaxPct: g.customTaxPct ?? meta.customTaxPct,
          bufferMinutes: g.bufferMinutes ?? meta.bufferMinutes ?? 30,
          partnershipNotes: g.partnershipNotes ?? meta.partnershipNotes ?? "",
          status: meta.status || (g.isActive ? "Active" : "Maintenance"),
          region: g.region,
          address: g.address,
          contactPhone: g.contactPhone,
          contactEmail: g.contactEmail,
          latitude: lat,
          longitude: lng,
          lat,
          lng,
          assignedManagers: filteredAssignedMgrs,
          managerName: isUnderAdminCustody
            ? meta.managerName || "None (Admin Custody)"
            : meta.managerName || primaryAssigned?.name || "None (Admin Acting)",
          managerId: isUnderAdminCustody
            ? ""
            : meta.managerId || primaryAssigned?.id || "",
          caretaker: meta.caretaker || primaryAssigned?.name || "Caretaker In-Charge",
          governingAdminRole: govRole,
          governingAdminName: govName,
          governingAdminEmail: govEmail,
          adminId: g.adminId || meta.adminId || (govRole === "super_admin" ? "USER-SA-001" : ""),
          adminName: g.adminName || meta.adminName || govName,
          adminEmail: govEmail,
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
        const allowedIds = new Set(authUser.gosalaIds || [])
        const allowedNames = new Set((authUser.gosalaNames || []).map((name) => name.trim().toLowerCase()))
        const userEmail = (authUser.email || "").trim().toLowerCase()
        const userId = (authUser.userId || "").trim().toLowerCase()

        // Strict isolation: only Gaushalas assigned to or governed by this Operations Admin
        scopedGosalas = formatted.filter((g: any) => {
          const idMatch = allowedIds.has(g.id)
          const nameMatch = allowedNames.has(String(g.name).trim().toLowerCase())
          const gGovEmail = String(g.governingAdminEmail || g.adminEmail || "").trim().toLowerCase()
          const govEmailMatch = Boolean(userEmail && gGovEmail === userEmail)
          const gAdminId = String(g.adminId || "").trim().toLowerCase()
          const adminIdMatch = Boolean(userId && gAdminId === userId)
          return idMatch || nameMatch || govEmailMatch || adminIdMatch
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
    if (!authUser || (authUser.role !== "super_admin" && authUser.role !== "admin")) {
      return { status: 403, body: { ok: false, error: "Only platform administrators can register new Gaushalas" } }
    }
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

      const isActing = Boolean(body.actAsManagerMyself) || Boolean(restMeta.isActingManager) || (!restMeta.managerId && !restMeta.managerName)
      const finalGovRole = restMeta.governingAdminRole || (authUser?.role === "super_admin" ? "super_admin" : "admin")
      const callerAdminName = restMeta.governingAdminName || authUser?.name || "Operations Admin"
      const callerAdminEmail = restMeta.governingAdminEmail || authUser?.email || "admin@gomaa.in"
      const callerAdminId = restMeta.adminId || authUser?.userId || "USER-ADM-101"

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
          adminId: callerAdminId,
          adminEmail: callerAdminEmail,
          adminName: callerAdminName,
        },
        update: {
          region: region.trim(),
          address: address.trim(),
          contactPhone: contactPhone || undefined,
          contactEmail: email || undefined,
          latitude: finalLat,
          longitude: finalLng,
          isActive: true,
          adminId: callerAdminId,
          adminEmail: callerAdminEmail,
          adminName: callerAdminName,
        },
      })

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
            await prisma.gosalaManagerAssignment.deleteMany({
              where: {
                gosalaId: created.id,
                NOT: { userId: resolvedMgrUser.id },
              },
            })
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
    const rawId = putGosalaMatch[1]
    const decodedId = decodeURIComponent(rawId)
    try {
      const existing = await prisma.gosala.findFirst({
        where: {
          OR: [
            { id: rawId },
            { id: decodedId },
            { name: decodedId },
            { name: { equals: decodedId, mode: "insensitive" } },
          ],
        },
      })
      if (!existing) {
        return { status: 404, body: { error: "Gaushala not found" } }
      }

      if (!authUser || (authUser.role !== "super_admin" && authUser.role !== "admin" && authUser.role !== "manager")) {
        return { status: 403, body: { ok: false, error: "Insufficient privileges to modify sanctuary records" } }
      }

      if (authUser.role === "admin") {
        const allowedIds = new Set(authUser.gosalaIds || [])
        const allowedNames = new Set((authUser.gosalaNames || []).map((n) => n.trim().toLowerCase()))
        const userEmail = (authUser.email || "").trim().toLowerCase()
        const userId = (authUser.userId || "").trim().toLowerCase()
        const existingName = (existing.name || "").trim().toLowerCase()
        const existingAdminEmail = (existing.adminEmail || "").trim().toLowerCase()
        const existingAdminId = (existing.adminId || "").trim().toLowerCase()

        const isOwner =
          allowedIds.has(existing.id) ||
          allowedNames.has(existingName) ||
          (Boolean(userEmail) && existingAdminEmail === userEmail) ||
          (Boolean(userId) && existingAdminId === userId)

        if (!isOwner) {
          return { status: 403, body: { ok: false, error: "Cross-tenant violation: Gaushala outside your operational portfolio" } }
        }
      }

      if (authUser.role === "manager") {
        const allowedIds = new Set(authUser.gosalaIds || [])
        const allowedNames = new Set((authUser.gosalaNames || []).map((n) => n.trim().toLowerCase()))
        const existingName = (existing.name || "").trim().toLowerCase()

        const isAssigned = allowedIds.has(existing.id) || allowedNames.has(existingName)
        if (!isAssigned) {
          return { status: 403, body: { ok: false, error: "Gaushala outside your custodian assignment" } }
        }
      }

      const {
        name,
        region,
        address,
        contactPhone,
        email,
        contactEmail,
        latitude,
        longitude,
        lat,
        lng,
        ...restMeta
      } = body

      const finalLat = latitude !== undefined ? Number(latitude) : lat !== undefined ? Number(lat) : undefined
      const finalLng = longitude !== undefined ? Number(longitude) : lng !== undefined ? Number(lng) : undefined

      const callerAdminName = restMeta.governingAdminName || restMeta.adminName || body.governingAdminName || body.adminName
      const callerAdminEmail = restMeta.governingAdminEmail || restMeta.adminEmail || body.governingAdminEmail || body.adminEmail
      const callerAdminId = restMeta.adminId || body.adminId

      const isActing = body.actAsManagerMyself !== undefined
        ? Boolean(body.actAsManagerMyself)
        : restMeta.isActingManager !== undefined
        ? Boolean(restMeta.isActingManager)
        : undefined

      const effectiveAdminName = callerAdminName || authUser?.name || "Operations Admin"
      const effectiveAdminEmail = callerAdminEmail || authUser?.email || "admin@gomaa.in"
      const effectiveAdminRole = restMeta.governingAdminRole || (authUser?.role === "super_admin" ? "super_admin" : "admin")
      const effectiveAdminId = callerAdminId || authUser?.userId || "USER-ADM-101"

      const currentMeta = (existing.metadata && typeof existing.metadata === "object")
        ? { ...(existing.metadata as any) }
        : getGosalaMeta(existing.id, existing.name)

      const metaPatch: any = {
        ...currentMeta,
        ...restMeta,
        ...(finalLat !== undefined ? { lat: finalLat } : {}),
        ...(finalLng !== undefined ? { lng: finalLng } : {}),
        governingAdminName: effectiveAdminName,
        governingAdminEmail: effectiveAdminEmail,
        governingAdminRole: effectiveAdminRole,
        adminName: effectiveAdminName,
        adminEmail: effectiveAdminEmail,
        adminId: effectiveAdminId,
      }

      if (isActing === true) {
        metaPatch.isActingManager = true
        metaPatch.managerName = `${callerAdminName} (Acting Manager)`
        metaPatch.managerId = callerAdminId
        metaPatch.caretaker = `${callerAdminName} (Acting Custodian)`
        try {
          await prisma.gosalaManagerAssignment.deleteMany({ where: { gosalaId: existing.id } })
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
            if (body.exclusiveManager) {
              await prisma.gosalaManagerAssignment.deleteMany({
                where: {
                  userId: mgrUser.id,
                  NOT: { gosalaId: existing.id },
                },
              })
            }
            await prisma.gosalaManagerAssignment.deleteMany({
              where: {
                gosalaId: existing.id,
                NOT: { userId: mgrUser.id },
              },
            })
            await prisma.gosalaManagerAssignment.upsert({
              where: {
                userId_gosalaId: {
                  userId: mgrUser.id,
                  gosalaId: existing.id
                },
              },
              create: {
                userId: mgrUser.id,
                gosalaId: existing.id,
                region: region ? region.trim() : existing.region,
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

      const parsedCommValue =
        body.commissionValue !== undefined
          ? Number(body.commissionValue)
          : body.customCommissionPct !== undefined
            ? Number(body.customCommissionPct)
            : body.customCommissionFlat !== undefined
              ? Number(body.customCommissionFlat)
              : undefined

      const updated = await prisma.gosala.update({
        where: { id: existing.id },
        data: {
          name: name ? name.trim() : undefined,
          region: region ? region.trim() : undefined,
          address: address ? address.trim() : undefined,
          contactPhone: contactPhone || undefined,
          contactEmail: email || contactEmail || undefined,
          latitude: finalLat,
          longitude: finalLng,
          // Persist Sanctuary Category Base Rates to dedicated PostgreSQL columns
          baseCowPrice: body.baseCowPrice !== undefined ? Number(body.baseCowPrice) : undefined,
          baseBullPrice: body.baseBullPrice !== undefined ? Number(body.baseBullPrice) : undefined,
          baseCalfPrice: body.baseCalfPrice !== undefined ? Number(body.baseCalfPrice) : undefined,
          baseBuffaloPrice: body.baseBuffaloPrice !== undefined ? Number(body.baseBuffaloPrice) : undefined,
          basePairPrice: body.basePairPrice !== undefined ? Number(body.basePairPrice) : undefined,
          // Persist Sanctuary Economics, Commission & Tax Settings
          partnershipTier: body.partnershipTier !== undefined ? String(body.partnershipTier) : undefined,
          commissionType: body.commissionType !== undefined ? String(body.commissionType) : undefined,
          commissionValue: parsedCommValue,
          taxTreatment: body.taxTreatment !== undefined ? String(body.taxTreatment) : undefined,
          customTaxPct: body.customTaxPct !== undefined ? Number(body.customTaxPct) : undefined,
          bufferMinutes: body.bufferMinutes !== undefined ? Number(body.bufferMinutes) : undefined,
          partnershipNotes: body.partnershipNotes !== undefined ? String(body.partnershipNotes) : undefined,
          metadata: metaPatch, // ATOMICALLY PERSIST TO POSTGRESQL!
          ...(callerAdminId ? { adminId: callerAdminId } : {}),
          ...(callerAdminEmail ? { adminEmail: callerAdminEmail } : {}),
          ...(callerAdminName ? { adminName: callerAdminName } : {}),
        },
      })

      // DYNAMIC SYNCHRONIZATION: Update all registered bovines of matching type in this Gaushala
      try {
        if (body.baseCowPrice !== undefined && Number(body.baseCowPrice) > 0) {
          await prisma.animal.updateMany({
            where: { gosalaId: existing.id, type: "COW" },
            data: { price: Number(body.baseCowPrice) },
          })
        }
        if (body.baseCalfPrice !== undefined && Number(body.baseCalfPrice) > 0) {
          await prisma.animal.updateMany({
            where: { gosalaId: existing.id, type: "CALF" },
            data: { price: Number(body.baseCalfPrice) },
          })
        }
        if (body.baseBullPrice !== undefined && Number(body.baseBullPrice) > 0) {
          await prisma.animal.updateMany({
            where: { gosalaId: existing.id, type: "BULL" },
            data: { price: Number(body.baseBullPrice) },
          })
        }
        if (body.baseBuffaloPrice !== undefined && Number(body.baseBuffaloPrice) > 0) {
          await prisma.animal.updateMany({
            where: { gosalaId: existing.id, type: "BUFFALO" },
            data: { price: Number(body.baseBuffaloPrice) },
          })
        }
        if (body.basePairPrice !== undefined && Number(body.basePairPrice) > 0) {
          await prisma.animal.updateMany({
            where: { gosalaId: existing.id, type: "COW_AND_CALF" },
            data: { price: Number(body.basePairPrice) },
          })
        }
      } catch (syncErr) {
        console.warn("[PUT /api/gosalas/:id] Animal price sync notice:", syncErr)
      }

      // If Gaushala name was updated, synchronize any animal and booking relations
      if (name && name.trim() !== existing.name) {
        const newName = name.trim()
        try {
          await prisma.animal.updateMany({
            where: { gosalaId: existing.id },
            data: { gosala: newName } as any,
          })
        } catch {}
        try {
          await prisma.booking.updateMany({
            where: {
              OR: [
                { gosalaId: existing.id },
                { gosala: existing.name },
              ],
            },
            data: {
              gosala: newName,
              gosalaName: newName,
            } as any,
          })
        } catch {}
      }

      saveGosalaMeta(updated.id, updated.name, metaPatch)

      const mergedUpdated = {
        ...updated,
        ...metaPatch,
        id: updated.id,
        name: updated.name,
        region: updated.region,
        address: updated.address,
        contactPhone: updated.contactPhone,
        contactEmail: updated.contactEmail,
        lat: updated.latitude !== null && updated.latitude !== undefined ? Number(updated.latitude) : metaPatch.lat,
        lng: updated.longitude !== null && updated.longitude !== undefined ? Number(updated.longitude) : metaPatch.lng,
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

      if (!authUser || authUser.role !== "super_admin") {
        return { status: 403, body: { ok: false, error: "Only Super Admin Captain can decommission a Gaushala sanctuary" } }
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
          type:
            meta.type ||
            (a.type === "COW"
              ? "Cow"
              : a.type === "BULL"
                ? "Bull"
                : a.type === "BUFFALO"
                  ? "Buffalo"
                  : a.type === "COW_AND_CALF"
                    ? "Cow & Calf"
                    : "Calf"),
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
        if (allowedGosalas.length > 0) {
          finalAnimals = finalAnimals.filter((a: any) => {
            const gName = (a.gosala || "").toLowerCase().trim()
            return allowedGosalas.includes(gName)
          })
        }
      } else if (authUser?.role === "admin") {
        const adminEmail = (authUser.email || "").toLowerCase()
        const adminName = (authUser.name || "").toLowerCase()
        const adminId = authUser.userId || ""

        const myGosalaNames = (authUser.gosalaNames && authUser.gosalaNames.length > 0)
          ? authUser.gosalaNames.map((s: string) => s.toLowerCase().trim())
          : (await prisma.gosala.findMany({ where: { isActive: true } }))
              .filter((g: any) => {
                const meta = getGosalaMeta(g.id, g.name)
                const gEmail = (g.adminEmail || meta.governingAdminEmail || meta.adminEmail || "").toLowerCase()
                const gName = (g.adminName || meta.governingAdminName || meta.adminName || "").toLowerCase()
                return (g.adminId === adminId) || (gEmail && gEmail === adminEmail) || (gName && gName.includes(adminName))
              })
              .map((g: any) => g.name.toLowerCase().trim())

        if (myGosalaNames.length > 0) {
          finalAnimals = finalAnimals.filter((a: any) => {
            const gName = (a.gosala || "").toLowerCase().trim()
            return myGosalaNames.includes(gName)
          })
        }
      } else if (authUser?.role === "super_admin") {
        const filterGosala = query.get("gosala") || query.get("shelter")
        if (filterGosala && filterGosala !== "All" && filterGosala !== "ALL") {
          finalAnimals = finalAnimals.filter((a: any) =>
            (a.gosala || "").toLowerCase() === filterGosala.toLowerCase()
          )
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
        where: {
          OR: [
            { id: name },
            { name: { equals: name, mode: "insensitive" } },
            { name: { contains: name, mode: "insensitive" } },
          ],
        },
        data: {
          breed: updated.breed || undefined,
          ageYears: updated.ageYears !== undefined ? Number(updated.ageYears) : undefined,
          price: updated.price !== undefined ? Number(updated.price) : undefined,
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
    try {
      const gosalaQuery = query.get("gosala") || query.get("gosalaId") || query.get("gosalaName")
      const where: any = {}

      // Multi-Tenant Isolation:
      // Scope strictly to the requester's assigned Gaushala(s) for Managers and Operations Admins
      if (authUser?.role === "manager" && authUser.gosalaNames?.length > 0) {
        where.OR = [
          ...authUser.gosalaNames.map((gn) => ({ gosala: { name: { equals: gn, mode: "insensitive" as const } } })),
          ...authUser.gosalaNames.map((gn) => ({ assignedGosalas: { has: gn } })),
        ]
      } else if (authUser?.role === "admin" && authUser.gosalaNames?.length > 0) {
        where.OR = [
          ...authUser.gosalaNames.map((gn) => ({ gosala: { name: { equals: gn, mode: "insensitive" as const } } })),
          ...authUser.gosalaNames.map((gn) => ({ assignedGosalas: { has: gn } })),
        ]
      } else if (gosalaQuery) {
        where.OR = [
          { gosalaId: gosalaQuery },
          { gosala: { name: { contains: gosalaQuery, mode: "insensitive" as const } } },
          { assignedGosalas: { has: gosalaQuery } },
        ]
      }

      const vets = await prisma.empanelledVet.findMany({
        where,
        include: { gosala: { select: { id: true, name: true, region: true } } },
        orderBy: { createdAt: "asc" },
      })
      return { status: 200, body: { ok: true, vets } }
    } catch (e: any) {
      console.warn("[GET /api/vets] DB fallback notice:", e?.message)
      return { status: 200, body: { ok: true, vets: [] } }
    }
  }

  // POST /api/vets
  if (method === "POST" && pathname === "/api/vets") {
    const denied = requireRole("super_admin", "admin", "manager")
    if (denied) return denied

    const vet = body.vet || body
    const id = vet.id || `VET-${Date.now()}`

    let gosalaId = vet.gosalaId
    if (!gosalaId && vet.gosalaName) {
      const g = await prisma.gosala.findFirst({
        where: { name: { equals: vet.gosalaName, mode: "insensitive" } },
      })
      if (g) gosalaId = g.id
    }
    if (!gosalaId && authUser?.role === "manager" && authUser.gosalaNames?.[0]) {
      const g = await prisma.gosala.findFirst({
        where: { name: { equals: authUser.gosalaNames[0], mode: "insensitive" } },
      })
      if (g) gosalaId = g.id
    }

    try {
      const fullVet = await prisma.empanelledVet.upsert({
        where: { regNo: vet.regNo || id },
        update: {
          gosalaId: gosalaId || undefined,
          name: vet.name,
          qualification: vet.qualification || "B.V.Sc",
          clinic: vet.clinic || "Local Veterinary Clinic",
          phone: vet.phone || "+91 98000 00000",
          address: vet.address || "Veterinary Center",
          specialization: vet.specialization || "General Bovine Care",
          emergency24x7: vet.emergency24x7 ?? true,
          assignedGosalas: vet.assignedGosalas || (vet.gosalaName ? [vet.gosalaName] : ["All Gaushalas"]),
        },
        create: {
          id,
          gosalaId: gosalaId || null,
          name: vet.name,
          qualification: vet.qualification || "B.V.Sc",
          regNo: vet.regNo || `REG-${Date.now()}`,
          clinic: vet.clinic || "Local Veterinary Clinic",
          phone: vet.phone || "+91 98000 00000",
          address: vet.address || "Veterinary Center",
          specialization: vet.specialization || "General Bovine Care",
          emergency24x7: vet.emergency24x7 ?? true,
          assignedGosalas: vet.assignedGosalas || (vet.gosalaName ? [vet.gosalaName] : ["All Gaushalas"]),
        },
        include: { gosala: { select: { id: true, name: true, region: true } } },
      })

      wsHub.broadcastToChannel("channel:animals", "VET_UPDATED", {
        vet: fullVet,
        timestamp: new Date().toISOString(),
      })

      return { status: 201, body: { ok: true, vet: fullVet } }
    } catch (e: any) {
      return { status: 500, body: { error: e.message } }
    }
  }

  // PUT /api/vets/:id
  const putVetMatch = pathname.match(/^\/api\/vets\/([^/]+)$/)
  if (method === "PUT" && putVetMatch) {
    const id = putVetMatch[1]
    try {
      const updated = await prisma.empanelledVet.update({
        where: { id },
        data: { ...body },
      })

      wsHub.broadcastToChannel("channel:animals", "VET_UPDATED", {
        vet: updated,
        timestamp: new Date().toISOString(),
      })

      return { status: 200, body: { ok: true, vet: updated } }
    } catch (e: any) {
      return { status: 500, body: { error: e.message } }
    }
  }

  // DELETE /api/vets/:id
  if (method === "DELETE" && putVetMatch) {
    const id = putVetMatch[1]
    try {
      await prisma.empanelledVet.delete({ where: { id } })
      return { status: 200, body: { ok: true, deleted: id } }
    } catch (e: any) {
      return { status: 500, body: { error: e.message } }
    }
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
    const profiles = await resolveRoleProfilesFromDB()
    return { status: 200, body: { profiles } }
  }

  // GET /api/profiles/:role
  const profileRoleMatch = pathname.match(/^\/api\/profiles\/([^/]+)$/)
  if (method === "GET" && profileRoleMatch) {
    const roleKey = profileRoleMatch[1]
    const profiles = await resolveRoleProfilesFromDB()
    const p = profiles[roleKey]
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
    const profiles = await resolveRoleProfilesFromDB()
    const existing = profiles[roleKey] || {
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

    const roleEnum = (roleKey === "customer"
      ? "CUSTOMER"
      : roleKey === "manager"
        ? "GOSALA_MANAGER"
        : roleKey === "driver"
          ? "DRIVER"
          : roleKey === "super_admin"
            ? "SUPER_ADMIN"
            : "OPERATIONS_ADMIN") as any

    const metadataToSave = {
      customerData: updated.customerData,
      managerData: updated.managerData,
      driverData: updated.driverData,
      adminData: updated.adminData,
      bankDetails: updated.bankDetails,
      settlementSchedule: updated.settlementSchedule,
    }

    // Persist directly to PostgreSQL
    try {
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [
            ...(updated.email ? [{ email: updated.email }] : []),
            { role: roleEnum },
          ],
        },
      })

      if (existingUser) {
        const currentMeta = (existingUser.metadata as any) || {}
        await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            name: updated.name || existingUser.name,
            phone: updated.phone || existingUser.phone,
            metadata: { ...currentMeta, ...metadataToSave },
          },
        })
      } else if (updated.email) {
        await prisma.user.create({
          data: {
            name: updated.name || "User",
            email: updated.email,
            phone: updated.phone || "+91 98000 00000",
            role: roleEnum,
            metadata: metadataToSave,
          },
        })
      }
    } catch (e: any) {
      console.warn("Profile DB update warning:", e?.message)
    }

    return { status: 200, body: { success: true, profile: updated } }
  }

  return { status: 404, body: { error: "Endpoint not found" } }
}
