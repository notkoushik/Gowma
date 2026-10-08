import fs from "fs"
import path from "path"

const META_FILE_PATH = path.resolve(process.cwd(), "server/data/users_meta.json")

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

// In-memory cache backed by server/data/users_meta.json
let metaStore: Record<string, UserRichMeta> = {}

function loadMetaStore() {
  try {
    if (fs.existsSync(META_FILE_PATH)) {
      const raw = fs.readFileSync(META_FILE_PATH, "utf-8")
      metaStore = JSON.parse(raw)
    }
  } catch (err) {
    console.warn("Could not load users_meta.json:", err)
    metaStore = {}
  }
}

function persistMetaStore() {
  try {
    const dir = path.dirname(META_FILE_PATH)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(META_FILE_PATH, JSON.stringify(metaStore, null, 2), "utf-8")
  } catch (err) {
    console.error("Failed to save users_meta.json:", err)
  }
}

// Initialize on module load
loadMetaStore()

// Seed defaults if empty
if (Object.keys(metaStore).length === 0) {
  metaStore["ananya.deshmukh@gmail.com"] = {
    customerData: {
      address: "14 Tulsi Nagar, Kondapur, Hyderabad",
      city: "Hyderabad",
      aadhaarNumber: "XXXX-XXXX-4819",
      memberSince: "Aug 2024",
      totalBookings: 4,
      preferredCeremony: "Griha Pravesh & Kamadhenu Puja",
    },
  }
  metaStore["sunil.pawar@gomaa.in"] = {
    driverData: {
      driverId: "DRV-102",
      vehicleNumber: "MH-12-Q-4491",
      vehicleType: "Tata 407 (8ft Open Bed)",
      licenseNumber: "DL-142011009823",
      gosalaBase: "Surya",
      status: "Available",
      rating: 4.92,
      totalTrips: 1280,
    },
  }
  persistMetaStore()
}

export function getUserMeta(identifier: string): UserRichMeta {
  const key = identifier.trim().toLowerCase()
  return metaStore[key] || {}
}

export function saveUserMeta(identifier: string, patch: Partial<UserRichMeta>) {
  const key = identifier.trim().toLowerCase()
  const existing = metaStore[key] || {}
  metaStore[key] = {
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
  persistMetaStore()
}

export function deleteUserMeta(identifier: string) {
  const key = identifier.trim().toLowerCase()
  delete metaStore[key]
  persistMetaStore()
}

export const setUserMeta = saveUserMeta
