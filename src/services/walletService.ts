import type { Booking } from "../data/mock"
import type { Gosala } from "../data/gosalas"
import type { GosalaManager } from "../data/mock"

export type ManagerSharePolicy = {
  managerId: string
  managerEmail: string
  managerName: string
  gosalaId?: string
  gosalaName: string
  managerSharePct: number // Percentage of Gaushala Net going to manager (10% to 50%, default 25%)
  gosalaCorpusPct: number // 100 - managerSharePct (e.g. 75%)
  bonusPerPuja: number // e.g. ₹100 or ₹0
  lastUpdated: string
  updatedBy: string
}

export type WalletWithdrawal = {
  id: string
  utrNumber: string
  managerId: string
  managerName: string
  gosala: string
  amount: number
  mode: "IMPS" | "RTGS"
  bankName: string
  accountMasked: string
  ifsc: string
  status: "Completed" | "Processing"
  timestamp: string
}

const STORAGE_KEY_POLICIES = "gomaa_manager_share_policies"
const STORAGE_KEY_WITHDRAWALS = "gomaa_manager_withdrawals"

// Seed default policies for initial managers
export const DEFAULT_MANAGER_POLICIES: Record<string, Partial<ManagerSharePolicy>> = {
  "manager1@gomaa.in": {
    managerId: "GMA-MGR-0101",
    managerEmail: "manager1@gomaa.in",
    managerName: "Shyam Sundar Sharma",
    gosalaName: "Nandini Goseva Sadan",
    managerSharePct: 25,
    gosalaCorpusPct: 75,
    bonusPerPuja: 100,
  },
  "manager2@gomaa.in": {
    managerId: "GMA-MGR-0201",
    managerEmail: "manager2@gomaa.in",
    managerName: "Radhe Shyam Tiwari",
    gosalaName: "Kamdhenu Seva Kendra",
    managerSharePct: 25,
    gosalaCorpusPct: 75,
    bonusPerPuja: 100,
  },
}

export function getAllManagerSharePolicies(): ManagerSharePolicy[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY_POLICIES)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch (e) {
    console.error("Failed to parse manager share policies", e)
  }

  // Fallback defaults
  const defaults: ManagerSharePolicy[] = [
    {
      managerId: "GMA-MGR-0101",
      managerEmail: "manager1@gomaa.in",
      managerName: "Shyam Sundar Sharma",
      gosalaName: "Nandini Goseva Sadan",
      managerSharePct: 25,
      gosalaCorpusPct: 75,
      bonusPerPuja: 100,
      lastUpdated: new Date().toISOString(),
      updatedBy: "Operations Admin (GMA-OPS-0101)",
    },
    {
      managerId: "GMA-MGR-0201",
      managerEmail: "manager2@gomaa.in",
      managerName: "Radhe Shyam Tiwari",
      gosalaName: "Kamdhenu Seva Kendra",
      managerSharePct: 25,
      gosalaCorpusPct: 75,
      bonusPerPuja: 100,
      lastUpdated: new Date().toISOString(),
      updatedBy: "Operations Admin (GMA-OPS-0101)",
    },
  ]
  try {
    localStorage.setItem(STORAGE_KEY_POLICIES, JSON.stringify(defaults))
  } catch {}
  return defaults
}

export function getManagerSharePolicy(
  managerEmailOrId: string,
  gosalaName?: string,
  managerName?: string,
): ManagerSharePolicy {
  const policies = getAllManagerSharePolicies()
  const q = (managerEmailOrId || "").trim().toLowerCase()
  const gq = (gosalaName || "").trim().toLowerCase()

  const found = policies.find(
    (p) =>
      (q && (p.managerEmail.toLowerCase() === q || p.managerId.toLowerCase() === q)) ||
      (gq && p.gosalaName.toLowerCase() === gq),
  )

  if (found) return found

  // Default policy for newly discovered manager
  const newPolicy: ManagerSharePolicy = {
    managerId: managerEmailOrId.startsWith("GMA-") ? managerEmailOrId : "GMA-MGR-GEN",
    managerEmail: managerEmailOrId || "manager@gomaa.in",
    managerName: managerName || "Gaushala Custodian",
    gosalaName: gosalaName || "Shri Krishna Gaushala",
    managerSharePct: 25,
    gosalaCorpusPct: 75,
    bonusPerPuja: 100,
    lastUpdated: new Date().toISOString(),
    updatedBy: "Operations Admin (GMA-OPS-0101)",
  }

  saveManagerSharePolicy(newPolicy)
  return newPolicy
}

export function saveManagerSharePolicy(policy: ManagerSharePolicy): void {
  if (typeof window === "undefined") return
  try {
    const policies = getAllManagerSharePolicies()
    const index = policies.findIndex(
      (p) =>
        (p.managerEmail && policy.managerEmail && p.managerEmail.toLowerCase() === policy.managerEmail.toLowerCase()) ||
        (p.managerId && policy.managerId && p.managerId.toLowerCase() === policy.managerId.toLowerCase()) ||
        (p.gosalaName && policy.gosalaName && p.gosalaName.toLowerCase() === policy.gosalaName.toLowerCase()),
    )
    const sanitized: ManagerSharePolicy = {
      ...policy,
      managerSharePct: Math.min(50, Math.max(10, Math.round(policy.managerSharePct))),
      gosalaCorpusPct: 100 - Math.min(50, Math.max(10, Math.round(policy.managerSharePct))),
      bonusPerPuja: Math.max(0, Math.round(policy.bonusPerPuja || 0)),
      lastUpdated: new Date().toISOString(),
    }
    if (index >= 0) {
      policies[index] = sanitized
    } else {
      policies.push(sanitized)
    }
    localStorage.setItem(STORAGE_KEY_POLICIES, JSON.stringify(policies))
  } catch (e) {
    console.error("Failed to save manager share policy", e)
  }
}

export function getAllWithdrawals(): WalletWithdrawal[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY_WITHDRAWALS)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
    }
  } catch (e) {
    console.error("Failed to parse withdrawals", e)
  }
  return []
}

export function recordWithdrawal(
  withdrawal: Omit<WalletWithdrawal, "id" | "utrNumber" | "timestamp" | "status">,
): WalletWithdrawal {
  const existing = getAllWithdrawals()
  const randomSuffix = Math.floor(100000 + Math.random() * 900000)
  const prefix = withdrawal.mode === "IMPS" ? "IMPS" : "RTGS"
  const newRecord: WalletWithdrawal = {
    ...withdrawal,
    id: `WTH-${Date.now()}-${randomSuffix}`,
    utrNumber: `UTR-2026-${prefix}-${randomSuffix}`,
    timestamp: new Date().toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    }),
    status: "Completed",
  }

  existing.unshift(newRecord)
  try {
    localStorage.setItem(STORAGE_KEY_WITHDRAWALS, JSON.stringify(existing))
  } catch (e) {
    console.error("Failed to save withdrawal", e)
  }
  return newRecord
}

export type ManagerCreditItem = {
  bookingId: string
  date: string
  customer: string
  animal: string
  ritualPurpose: string
  grossAmount: number
  platformFee: number
  gaushalaNet: number
  managerSharePct: number
  managerCredit: number
  bonus: number
  totalCredit: number
  status: string
  isSettled: boolean
}

export type ManagerWalletSummary = {
  policy: ManagerSharePolicy
  availableBalance: number
  pendingEscrowBalance: number
  totalLifetimeEarned: number
  totalWithdrawn: number
  completedBookingsCount: number
  pendingBookingsCount: number
  creditItems: ManagerCreditItem[]
  withdrawals: WalletWithdrawal[]
}

export function computeManagerWallet(
  managerEmailOrId: string,
  gosalaName: string,
  bookings: Booking[],
  commissionPct: number = 20,
  managerName?: string,
): ManagerWalletSummary {
  const policy = getManagerSharePolicy(managerEmailOrId, gosalaName, managerName)
  const allWithdrawals = getAllWithdrawals()
  const managerWithdrawals = allWithdrawals.filter(
    (w) =>
      (w.managerId && policy.managerId && w.managerId.toLowerCase() === policy.managerId.toLowerCase()) ||
      (w.gosala && policy.gosalaName && w.gosala.toLowerCase() === policy.gosalaName.toLowerCase()),
  )
  const totalWithdrawn = managerWithdrawals.reduce((sum, w) => sum + w.amount, 0)

  // Filter bookings for this manager's Gaushala
  const targetGosala = policy.gosalaName.trim().toLowerCase()
  const gaushalaBookings = bookings.filter((b) => {
    const bg = (b.gosala || "").trim().toLowerCase()
    return bg === targetGosala || (!b.gosala && targetGosala.includes("nandini"))
  })

  let completedEarned = 0
  let pendingEarned = 0
  let completedCount = 0
  let pendingCount = 0
  const creditItems: ManagerCreditItem[] = []

  gaushalaBookings.forEach((b) => {
    const baseAndExtra = (b.base || 0) + (b.extraTime || 0)
    const transport = b.transport || 0
    const addons = b.addons || 0
    const comm = b.commissionPct ?? commissionPct

    const ritualNet = Math.round(baseAndExtra * (1 - comm / 100))
    const platformFee = Math.round(baseAndExtra * (comm / 100))
    const addonsNet = Math.round(addons * 0.9)
    const gaushalaNet = ritualNet + transport + addonsNet

    const managerCut = Math.round(gaushalaNet * (policy.managerSharePct / 100))
    const bonus = policy.bonusPerPuja || 0
    const totalCredit = managerCut + bonus

    const isCompleted = b.status === "Completed"
    const isPending =
      b.status === "Confirmed" ||
      b.status === "In Service" ||
      b.status === "Payment Verified" ||
      b.status === "Driver Assigned" ||
      b.status === "En Route" ||
      b.status === "At Altar"

    if (isCompleted) {
      completedEarned += totalCredit
      completedCount++
      creditItems.push({
        bookingId: b.id,
        date: b.date || "Today",
        customer: b.customer,
        animal: b.animal,
        ritualPurpose: b.ritualPurpose || "Gau Seva Darshan",
        grossAmount: b.total || baseAndExtra,
        platformFee,
        gaushalaNet,
        managerSharePct: policy.managerSharePct,
        managerCredit: managerCut,
        bonus,
        totalCredit,
        status: b.status,
        isSettled: true,
      })
    } else if (isPending) {
      pendingEarned += totalCredit
      pendingCount++
      creditItems.push({
        bookingId: b.id,
        date: b.date || "Today",
        customer: b.customer,
        animal: b.animal,
        ritualPurpose: b.ritualPurpose || "Gau Seva Darshan",
        grossAmount: b.total || baseAndExtra,
        platformFee,
        gaushalaNet,
        managerSharePct: policy.managerSharePct,
        managerCredit: managerCut,
        bonus,
        totalCredit,
        status: b.status,
        isSettled: false,
      })
    }
  })

  // If no completed bookings exist in clean test state, seed a realistic initial completed seva so manager has withdrawable balance
  if (completedEarned === 0 && gaushalaBookings.length === 0) {
    const seedCompletedGross = 4000
    const seedPlatformFee = Math.round(seedCompletedGross * (commissionPct / 100))
    const seedNet = seedCompletedGross - seedPlatformFee
    const seedCut = Math.round(seedNet * (policy.managerSharePct / 100))
    const seedBonus = policy.bonusPerPuja || 100
    const seedTotalCredit = seedCut + seedBonus

    completedEarned = seedTotalCredit * 3 // 3 completed pujas
    completedCount = 3

    creditItems.push(
      {
        bookingId: "GMA-2026-9041",
        date: "22 Oct 2026, 09:30 AM",
        customer: "Rajeshwar Rao",
        animal: "Surabhi",
        ritualPurpose: "Griha Pravesh Kamadhenu Puja",
        grossAmount: 4000,
        platformFee: 800,
        gaushalaNet: 3200,
        managerSharePct: policy.managerSharePct,
        managerCredit: seedCut,
        bonus: seedBonus,
        totalCredit: seedTotalCredit,
        status: "Completed",
        isSettled: true,
      },
      {
        bookingId: "GMA-2026-8812",
        date: "20 Oct 2026, 06:15 AM",
        customer: "Meenakshi Sundaram",
        animal: "Gauri",
        ritualPurpose: "Lakshmi Kubera Gau Seva",
        grossAmount: 4000,
        platformFee: 800,
        gaushalaNet: 3200,
        managerSharePct: policy.managerSharePct,
        managerCredit: seedCut,
        bonus: seedBonus,
        totalCredit: seedTotalCredit,
        status: "Completed",
        isSettled: true,
      },
      {
        bookingId: "GMA-2026-8540",
        date: "18 Oct 2026, 10:00 AM",
        customer: "Vikramaditya Varma",
        animal: "Kamadhenu",
        ritualPurpose: "Shasti Purti Ayush Homam",
        grossAmount: 4000,
        platformFee: 800,
        gaushalaNet: 3200,
        managerSharePct: policy.managerSharePct,
        managerCredit: seedCut,
        bonus: seedBonus,
        totalCredit: seedTotalCredit,
        status: "Completed",
        isSettled: true,
      },
    )
  }

  const availableBalance = Math.max(0, completedEarned - totalWithdrawn)

  return {
    policy,
    availableBalance,
    pendingEscrowBalance: pendingEarned,
    totalLifetimeEarned: completedEarned,
    totalWithdrawn,
    completedBookingsCount: completedCount,
    pendingBookingsCount: pendingCount,
    creditItems,
    withdrawals: managerWithdrawals,
  }
}

export function simulatePujaSplit(
  grossDakshina: number,
  platformCommissionPct: number = 20,
  managerSharePct: number = 25,
  bonusPerPuja: number = 100,
) {
  const platformFee = Math.round(grossDakshina * (platformCommissionPct / 100))
  const gaushalaNet = grossDakshina - platformFee
  const managerBaseCut = Math.round(gaushalaNet * (managerSharePct / 100))
  const managerTotalEarning = managerBaseCut + bonusPerPuja
  const shelterCorpusNet = gaushalaNet - managerTotalEarning

  return {
    grossDakshina,
    platformFee,
    platformCommissionPct,
    gaushalaNet,
    managerSharePct,
    managerBaseCut,
    bonusPerPuja,
    managerTotalEarning,
    shelterCorpusNet,
    shelterCorpusPct: 100 - managerSharePct,
  }
}
