export type BookingStatus = "Payment Verified" | "Manager Review" | "Manager Confirmed" | "Admin Review" | "Confirmed" | "In Service" | "Completed" | "Rejected"

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
  animalType: "Cow" | "Calf" | "Bull"
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
  gosala: string
  gosalas?: string[]
  gosalaIds?: string[]
  region: string
  status: "Active" | "Inactive"
  assignedDate: string
  animalsCount: number
}

export type Settlement = {
  gosala: string
  bookings: number
  gross: number
  commissionPct: number
  status: "Pending" | "Approved" | "Processing" | "Paid" | "Failed"
  batch: string
}

export type SlotHold = {
  holdId: string
  animal: string
  date: string
  start: string
  durationMin: number
  expiresAt: number // unix epoch ms
  customerName: string
}
