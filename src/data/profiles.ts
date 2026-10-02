import type { RoleId } from "./roles"

export type CustomerProfileData = {
  address: string
  defaultAddress?: string
  aadhaarNumber: string
  gotra?: string
  familyMembers?: string
  specialNotes?: string
  memberSince: string
  totalBookings: number
  preferredCeremony?: string
}

export type ManagerProfileData = {
  managerId: string
  gosala: string // active / current gaushala
  gosalaName?: string
  assignedGosalas?: string[] // list of all assigned gaushalas
  region: string
  dailySevaCeiling: number
  restingBufferMin: number
  defaultBufferMin?: number
}

export type DriverProfileData = {
  driverId: string
  vehicleNumber: string
  vehicleType: string
  licenseNumber: string
  gosalaBase: string
  assignedGaushala?: string
  status: "Available" | "On Trip" | "Resting"
}

export type AdminProfileData = {
  adminId: string
  designation: string
  department: string
  authorityLevel: "SUPER_ADMIN" | "OPERATIONS_ADMIN"
  treasuryClearanceLevel?: string
}

export type RoleProfile = {
  id: string
  role: RoleId
  name: string
  phone: string
  email: string
  avatar?: string
  customerData?: CustomerProfileData
  managerData?: ManagerProfileData
  driverData?: DriverProfileData
  adminData?: AdminProfileData
}

export const initialProfiles: Record<RoleId, RoleProfile> = {
  customer: {
    id: "USER-CUST-101",
    role: "customer",
    name: "Ananya Deshmukh",
    phone: "+91 98204 11827",
    email: "ananya.deshmukh@gmail.com",
    customerData: {
      address: "14 Tulsi Nagar, Kothrud, Pune",
      defaultAddress: "14 Tulsi Nagar, Kothrud, Pune",
      aadhaarNumber: "XXXX-XXXX-4819",
      gotra: "Kashyapa",
      familyMembers: "Ananya (Self), Rajesh (Husband)",
      specialNotes:
        "Ground-floor courtyard altar prepared. Water bucket and fresh grass kept ready.",
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
      gosalaName: "Shri Krishna Gaushala",
      region: "Pune Western Zone",
      dailySevaCeiling: 2,
      restingBufferMin: 90,
      defaultBufferMin: 90,
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
      assignedGaushala: "Shri Krishna Gaushala",
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
      treasuryClearanceLevel: "Level-3 Master Authority",
    },
  },
}
