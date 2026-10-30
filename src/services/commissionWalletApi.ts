import { getAuthToken } from "./api"

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getAuthToken()
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  })
  const body: any = await res.json().catch(() => ({}))
  if (!res.ok || body?.ok === false) {
    throw new Error(body?.error || `Request failed (${res.status})`)
  }
  return body as T
}
const post = <T,>(path: string, data?: unknown) => call<T>(path, { method: "POST", body: JSON.stringify(data ?? {}) })
const put = <T,>(path: string, data?: unknown) => call<T>(path, { method: "PUT", body: JSON.stringify(data ?? {}) })

export type SettlementStatus = "HELD" | "READY_FOR_APPROVAL" | "RELEASED" | "REJECTED" | "REFUNDED"

export type PayoutAccount = {
  id: string
  type: "BANK" | "UPI"
  holderName: string
  label: string
  usableFrom: string
  usableNow: boolean
}

export type Withdrawal = {
  id: string
  amountRupees: number
  status: "PROCESSING" | "PAID" | "FAILED"
  mode: string
  utr: string | null
  failureReason: string | null
  account?: string
  requestedAt: string
  completedAt: string | null
}

export type WalletTx = {
  id: string
  type: "CREDIT" | "DEBIT"
  purpose: string
  amountRupees: number
  balanceAfterRupees: number
  bookingId: string | null
  description: string | null
  createdAt: string
}

export type Upcoming = {
  settlementId: string
  bookingId: string
  gosalaName: string
  status: SettlementStatus
  myRupees: number
  eligibleAt: string
}

export type MyWallet = {
  earnsFrom: string[]
  availableRupees: number
  comingRupees: number
  inTransitRupees: number
  upcoming: Upcoming[]
  transactions: WalletTx[]
  accounts: PayoutAccount[]
  withdrawals: Withdrawal[]
  payoutMode: "SANDBOX" | "RAZORPAYX"
  payoutModeNote: string
  delayDays: number
}

export type SettlementRow = {
  id: string
  bookingId: string
  gosalaId: string
  gosalaName: string
  status: SettlementStatus
  paymentSource: string
  grossRupees: number
  taxRupees: number
  platformRupees: number
  adminRupees: number
  managerRupees: number
  platformPct: number
  adminPct: number
  managerPct: number
  paidAt: string
  eligibleAt: string
  decidedByName: string | null
  decisionNote: string | null
  bookingStatus: string | null
  customerName: string | null
  bookingDate: string | null
}

export type SplitPolicyView = {
  platformPct: number
  defaultManagerPct: number
  policies: { gosalaId: string; gosalaName: string; managerPct: number; adminPct: number; isDefault: boolean }[]
  requests: {
    id: string
    gosalaId: string | null
    gosalaName: string | null
    currentManagerPct: number
    proposedManagerPct: number
    status: "PENDING" | "APPROVED" | "REJECTED"
    requestedByName: string
    reason: string | null
    decidedByName: string | null
    decisionNote: string | null
    createdAt: string
  }[]
}

export type Treasury = {
  escrowRupees: number
  platformRupees: number
  taxRupees: number
  withdrawalHoldRupees: number
  platformPct: number
  delayDays: number
  byStatus: { status: SettlementStatus; count: number; grossRupees: number }[]
  payoutMode: "SANDBOX" | "RAZORPAYX"
  payoutModeNote: string
}

export type Reconciliation = {
  walletMismatches: unknown[]
  unbalancedGroups: unknown[]
  escrow: { balanceRupees: number; waitingSettlementsRupees: number; matches: boolean }
  healthy: boolean
}

export type AuditEntry = {
  id: string
  at: string
  actor: string
  role: string
  action: string
  targetType: string
  targetId: string | null
  details: Record<string, unknown> | null
}

export const walletApi = {
  me: () => call<MyWallet & { ok: true }>("/api/wallet/me"),
  addAccount: (data: Record<string, unknown>) => post<{ account: PayoutAccount }>("/api/payout-accounts", data),
  removeAccount: (id: string) => call<{ ok: true }>(`/api/payout-accounts/${id}`, { method: "DELETE" }),
  requestOtp: (amountRupees: number, payoutAccountId: string) =>
    post<{ sent: boolean; maskedTarget: string; devOtp?: string; byEmail?: boolean; byWhatsApp?: boolean; bySms?: boolean; maskedPhone?: string }>("/api/withdrawals/otp", { amountRupees, payoutAccountId }),
  withdraw: (data: { amountRupees: number; payoutAccountId: string; otp: string; idempotencyKey: string }) =>
    post<{ withdrawal: Withdrawal; replay: boolean }>("/api/withdrawals", data),

  splitPolicy: () => call<SplitPolicyView & { ok: true }>("/api/split-policy"),
  requestSplit: (gosalaId: string, managerPct: number, reason: string) =>
    post<{ requestId: string }>("/api/split-policy/requests", { gosalaId, managerPct, reason }),

  treasury: () => call<Treasury & { ok: true }>("/api/superadmin/wallet"),
  settlements: (status?: SettlementStatus) =>
    call<{ settlements: SettlementRow[] }>(`/api/superadmin/settlements${status ? `?status=${status}` : ""}`),
  approve: (ids: string[]) => post<{ released: string[]; failed: { id: string; error: string }[] }>("/api/superadmin/settlements/approve", { ids }),
  reject: (id: string, note: string) => post(`/api/superadmin/settlements/${id}/reject`, { note }),
  refund: (id: string, note: string) => post(`/api/superadmin/settlements/${id}/refund`, { note }),
  backfill: () => post<{ scanned: number; created: number }>("/api/superadmin/settlements/backfill"),
  setPlatformPct: (platformPct: number) => put<{ platformPct: number }>("/api/superadmin/wallet-config", { platformPct }),
  setPolicy: (policyKey: string, managerPct: number) => put("/api/superadmin/split-policy", { policyKey, managerPct }),
  decideSplit: (id: string, approve: boolean, note?: string) => post(`/api/superadmin/split-requests/${id}/decide`, { approve, note }),
  auditLog: (limit = 300) => call<{ entries: AuditEntry[] }>(`/api/superadmin/audit-log?limit=${limit}`),
  reconciliation: () => call<Reconciliation & { ok: true }>("/api/superadmin/reconciliation"),
}

export const money = (n: number) =>
  `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export const dateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "–"

export const dateOnly = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "–"
