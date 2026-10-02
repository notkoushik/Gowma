import { initialProfiles, type RoleProfile } from "../src/data/profiles"

console.log(
  "=====================================================================",
)
console.log(
  "     GOMAA DYNAMIC PROFILES & ZERO-HARDCODING TEST SUITE             ",
)
console.log(
  "=====================================================================\n",
)

let passed = 0
let failed = 0

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`)
    passed++
  } else {
    console.error(`  ✗ FAIL: ${message}`)
    failed++
  }
}

// -------------------------------------------------------------------------
// Test Suite 1: Initial Profile Schemas & Role Coverage
// -------------------------------------------------------------------------
console.log(
  "---------------------------------------------------------------------",
)
console.log("Test Suite 1: Initial Profile Schemas & Role Coverage")
console.log(
  "---------------------------------------------------------------------",
)

const roles = ["customer", "manager", "driver", "admin", "super_admin"] as const

roles.forEach((r) => {
  const p = initialProfiles[r]
  assert(!!p, `Role profile exists for '${r}'`)
  assert(
    typeof p.name === "string" && p.name.length > 0,
    `Profile '${r}' has non-empty name (${p.name})`,
  )
  assert(
    typeof p.email === "string" && p.email.includes("@"),
    `Profile '${r}' has valid email (${p.email})`,
  )
  assert(
    typeof p.phone === "string" && p.phone.length > 0,
    `Profile '${r}' has phone (${p.phone})`,
  )
})

// Customer data structure check
assert(
  !!initialProfiles.customer.customerData?.aadhaarNumber,
  "Customer profile includes masked Aadhaar",
)
assert(
  !!initialProfiles.customer.customerData?.gotra,
  "Customer profile includes Devotee Gotra",
)

// Manager data structure check
assert(
  !!initialProfiles.manager.managerData?.gosalaName,
  "Manager profile includes Gaushala name",
)
assert(
  typeof initialProfiles.manager.managerData?.defaultBufferMin === "number",
  "Manager profile includes configurable buffer minutes",
)

// Driver data structure check
assert(
  !!initialProfiles.driver.driverData?.vehicleNumber,
  "Driver profile includes Vehicle registration plate",
)
assert(
  !!initialProfiles.driver.driverData?.licenseNumber,
  "Driver profile includes Driver DL number",
)

// Admin & Super Admin data structure check
assert(
  !!initialProfiles.admin.adminData?.department,
  "Admin profile includes Department",
)
assert(
  !!initialProfiles.super_admin.adminData?.treasuryClearanceLevel,
  "Super Admin profile includes Treasury Clearance Level",
)

// -------------------------------------------------------------------------
// Test Suite 2: Profile Update Mutability & Persistence Emulation
// -------------------------------------------------------------------------
console.log(
  "\n---------------------------------------------------------------------",
)
console.log("Test Suite 2: Profile Update Mutability & Persistence Emulation")
console.log(
  "---------------------------------------------------------------------",
)

let profilesState: Record<string, RoleProfile> = JSON.parse(
  JSON.stringify(initialProfiles),
)

function updateProfile(role: string, updates: Partial<RoleProfile>) {
  const current = profilesState[role]
  if (!current) return
  profilesState[role] = {
    ...current,
    ...updates,
    customerData: updates.customerData
      ? { ...current.customerData, ...updates.customerData }
      : current.customerData,
    managerData: updates.managerData
      ? { ...current.managerData, ...updates.managerData }
      : current.managerData,
    driverData: updates.driverData
      ? { ...current.driverData, ...updates.driverData }
      : current.driverData,
    adminData: updates.adminData
      ? { ...current.adminData, ...updates.adminData }
      : current.adminData,
  }
}

// Emulate user updating Customer profile
updateProfile("customer", {
  name: "Radha Krishnan",
  phone: "+91 99201 55210",
  customerData: {
    gotra: "Vashishta",
    aadhaarNumber: "•••• •••• 8821",
    defaultAddress: "Bavdhan, Pune, Maharashtra 411021",
  },
})

assert(
  profilesState.customer.name === "Radha Krishnan",
  "Customer name successfully updated to 'Radha Krishnan'",
)
assert(
  profilesState.customer.customerData?.gotra === "Vashishta",
  "Customer Gotra updated to 'Vashishta'",
)
assert(
  profilesState.customer.customerData?.aadhaarNumber === "•••• •••• 8821",
  "Customer Aadhaar updated",
)

// Emulate user updating Manager profile
updateProfile("manager", {
  name: "Suresh Patil",
  managerData: {
    gosalaName: "Bhakti Vedant Gaushala",
    defaultBufferMin: 45,
  },
})

assert(
  profilesState.manager.name === "Suresh Patil",
  "Manager name successfully updated to 'Suresh Patil'",
)
assert(
  profilesState.manager.managerData?.gosalaName === "Bhakti Vedant Gaushala",
  "Manager Gaushala name updated",
)
assert(
  profilesState.manager.managerData?.defaultBufferMin === 45,
  "Manager default buffer updated to 45 mins",
)

// Emulate user updating Driver profile
updateProfile("driver", {
  name: "Santosh Yadav",
  driverData: {
    vehicleNumber: "MH 14 BG 9911",
    vehicleType: "Tata 407 (Custom Hydraulic Ramp)",
  },
})

assert(
  profilesState.driver.name === "Santosh Yadav",
  "Driver name successfully updated to 'Santosh Yadav'",
)
assert(
  profilesState.driver.driverData?.vehicleNumber === "MH 14 BG 9911",
  "Driver vehicle plate updated",
)

console.log(
  "\n=====================================================================",
)
console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`)
console.log(
  "=====================================================================",
)

if (failed > 0) process.exit(1)
