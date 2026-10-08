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

export type BankAccountDetails = {
  accountBeneficiary: string
  bankName: string
  branchName: string
  accountNumber: string // Full account number stored safely
  ifscCode: string
  accountType: "CURRENT_TRUST" | "SAVINGS" | "NODAL_ESCROW" | "SALARY"
  verificationStatus: "VERIFIED" | "PENDING_PENNY_DROP" | "REJECTED"
  badgeLabel?: string // e.g. "Active Direct Credit", "Sovereign Nodal Escrow", "Operational Reimbursement"
  upiId?: string
  lastVerifiedAt?: string
}

export type SettlementSchedule = {
  disbursementCycle: string // e.g. "Every Sunday at 23:59 IST"
  disbursementMode: string // e.g. "Direct RBI NEFT / Instant IMPS"
  escrowCustodianPool: string // e.g. "ICICI Nodal Trust Escrow"
  nextScheduledBatch: string // e.g. "Upcoming Sunday Midnight"
  badgeLabel?: string // e.g. "Weekly Auto-Sweep", "Continuous Escrow Sweep"
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
  bankDetails?: BankAccountDetails
  settlementSchedule?: SettlementSchedule
}

export const initialProfiles: Record<RoleId, RoleProfile> = {
  customer: {
    id: "USER-CUST-NEW",
    role: "customer",
    name: "Devotee",
    phone: "+91 98000 00000",
    email: "devotee@gmail.com",
    customerData: {
      address: "Devotee Residence",
      defaultAddress: "Devotee Residence",
      aadhaarNumber: "XXXX-XXXX-0000",
      gotra: "Kashyapa",
      familyMembers: "Devotee Family",
      specialNotes: "Courtyard prepared for sacred Gau Seva.",
      memberSince: "Oct 2026",
      totalBookings: 0,
      preferredCeremony: "Kamadhenu Puja & Gau Seva",
    },
    // No hardcoded bank details - dynamic user input
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
      gosalaName: "Unassigned",
      region: "Operational Hub",
      dailySevaCeiling: 2,
      restingBufferMin: 90,
      defaultBufferMin: 90,
    },
    // No hardcoded bank details - dynamic user input
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
      assignedGaushala: "Unassigned",
      status: "Available",
    },
    // No hardcoded bank details - dynamic user input
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
    // No hardcoded bank details - dynamic user input
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
    // No hardcoded bank details - dynamic user input
  },
}
