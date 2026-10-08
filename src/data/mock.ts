export type BookingStatus =
  | "Payment Verified"
  | "Manager Review"
  | "Manager Confirmed"
  | "Admin Review"
  | "Confirmed"
  | "In Service"
  | "Completed"
  | "Rejected"
  | "Cancelled"
  | "Driver Assigned"
  | "En Route"
  | "At Altar"

export type ApprovalRecord = {
  userId: string
  name: string
  timestamp: string
  remark: string
  isActingManager?: boolean
  actorRole?: string
}

export type Booking = {
  id: string
  customer: string
  phone: string
  gosala: string
  animal: string
  animalType: "Cow" | "Calf" | "Bull" | "Buffalo" | "Cow & Calf"
  date: string
  start: string
  end: string
  durationMin: number
  address: string
  distanceKm: number
  base: number
  extraTime: number
  transport: number
  addons: number
  tax: number
  discount: number
  total: number
  commissionPct: number
  status: BookingStatus
  driver: string | null
  driverStage: number
  paid: boolean
  managerRemark?: string
  adminRemark?: string
  managerApproval?: ApprovalRecord
  adminApproval?: ApprovalRecord
  freeKmSnapshot?: number
  perKmSnapshot?: number
  extraUnitRateSnapshot?: number
  commissionSnapshot?: number
  createdAt?: string
  // Booker Identity & Aadhaar KYC
  aadhaarNumber?: string
  aadhaarVerified?: boolean
  customerEmail?: string
  ritualPurpose?: string
  devoteeSince?: string
  devoteeGotra?: string
  devoteeFamilyMembers?: string
  specialInstructions?: string
  // Operations Admin Portfolio Governance
  governingAdminName?: string
  governingAdminEmail?: string
  // 3rd-Party Porter Logistics
  isPorter?: boolean
  porterBookingId?: string
  porterVehicleType?: string
  porterFare?: number
  porterDriverName?: string
  porterDriverPhone?: string
  porterStatus?: string

  // Dynamic Customer Animal Received & Handover OTP Security
  handoverOtp?: string
  handoverOtpVerified?: boolean
  handoverOtpVerifiedAt?: string | null

  // Rich Swiggy/Uber Driver Profile & Cattle Ambulance Specs
  driverPhone?: string | null
  driverVehiclePlate?: string | null
  driverVehicleModel?: string | null
  driverRating?: number | null
  driverTotalTrips?: number | null
  driverAvatar?: string | null
}

export type GaushalaDriver = {
  id: string
  name: string
  phone: string
  vehicleModel: string
  vehiclePlate: string
  status: "Available" | "On Trip" | "Resting"
  etaMins?: number
}

// 0 hardcoded drivers - populated dynamically
export const inHouseDrivers: GaushalaDriver[] = []

export const drivers: string[] = []

// Current logged in devotee reference label
export const CURRENT_CUSTOMER = "Devotee"

export const inr = (n: number) =>
  "₹" + (n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })

// 0 hardcoded bookings - populated dynamically via devotee booking engine and backend sync
export const bookings: Booking[] = []

export type KpiItem = {
  label: string
  value: string
  delta: string
  trend: "up" | "down" | "flat"
  sub: string
}

export const kpis: KpiItem[] = [
  {
    label: "Bookings today",
    value: "0",
    delta: "Live",
    trend: "flat",
    sub: "Awaiting new bookings",
  },
  {
    label: "Awaiting review",
    value: "0",
    delta: "Queue clear",
    trend: "flat",
    sub: "Manager + Admin queue",
  },
  {
    label: "Gross bookings (MTD)",
    value: "₹0",
    delta: "Current period",
    trend: "flat",
    sub: "Current cycle",
  },
  {
    label: "Pending settlement",
    value: "₹0",
    delta: "0 Gosalas",
    trend: "flat",
    sub: "Batches up to date",
  },
]

export const revenueSeries: Array<{ day: string; gross: number; commission: number }> = [
  { day: "Mon", gross: 0, commission: 0 },
  { day: "Tue", gross: 0, commission: 0 },
  { day: "Wed", gross: 0, commission: 0 },
  { day: "Thu", gross: 0, commission: 0 },
  { day: "Fri", gross: 0, commission: 0 },
  { day: "Sat", gross: 0, commission: 0 },
  { day: "Sun", gross: 0, commission: 0 },
]

export const bookingMix: Array<{ name: string; value: number; color: string }> = [
  { name: "Cow", value: 0, color: "var(--color-saffron)" },
  { name: "Bull", value: 0, color: "var(--color-forest)" },
  { name: "Calf", value: 0, color: "var(--color-info)" },
]

export const pipeline: Array<{ stage: string; count: number }> = []

export const availabilityAnimals: Array<{ name: string; gosala: string; type: string }> = []

export const slots = [
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
]

export const availabilityGrid: number[][] = []

export type Settlement = {
  gosala: string
  bookings: number
  gross: number
  commissionPct: number
  status: "Pending" | "Approved" | "Processing" | "Paid" | "Failed"
  batch: string
}

// 0 hardcoded settlements
export const settlements: Settlement[] = []

// 0 hardcoded gaushalas list
export const gosalasList: any[] = []

export type PricingConfig = {
  id?: number
  standardMin: number
  extraUnitMin: number
  extraUnitRate: number
  freeKm: number
  perKm: number
  taxPct: number
  commissionPct: number
  maxDurationMin: number
  bufferMin: number
  rounding: string
  updatedByRole?: string
  updatedByName?: string
  updatedAt?: string
}

export type GosalaManager = {
  id: string
  name: string
  email: string
  phone: string
  password?: string
  gosala: string // Primary / display Gaushala name
  gosalas?: string[] // All assigned Gaushala names
  gosalaIds?: string[] // All assigned Gaushala IDs
  region: string
  status: "Active" | "Inactive"
  assignedDate: string
  animalsCount: number
}

// 0 hardcoded managers
export const initialManagers: GosalaManager[] = []
