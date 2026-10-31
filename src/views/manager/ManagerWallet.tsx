import React, { useState, useMemo, useEffect } from "react"
import {
  Wallet,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Download,
  Building2,
  Landmark,
  CreditCard,
  Check,
  X,
  FileText,
  AlertCircle,
  HelpCircle,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Coins,
  Receipt,
  User,
  Percent,
} from "lucide-react"
import { inr } from "../../data/mock"
import { useStore, useToast } from "../../store/store"
import { api } from "../../services/api"
import {
  computeManagerWallet,
  recordWithdrawal,
  type ManagerWalletSummary,
  type WalletWithdrawal,
  type ManagerCreditItem,
} from "../../services/walletService"
import { getGaushalaBankDetails } from "./ManagerLedger"
import EditProfileModal from "../../components/EditProfileModal"

export default function ManagerWallet() {
  const {
    authUser,
    profiles,
    bookings,
    gosalas,
    pricingConfig,
    activeManagerGosala,
  } = useStore()
  const { notify } = useToast()

  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false)
  const [editBankOpen, setEditBankOpen] = useState(false)
  const [withdrawAmount, setWithdrawAmount] = useState<string>("")
  const [withdrawMode, setWithdrawMode] = useState<"IMPS" | "RTGS">("IMPS")
  const [processingWithdrawal, setProcessingWithdrawal] = useState(false)
  const [completedWithdrawal, setCompletedWithdrawal] =
    useState<WalletWithdrawal | null>(null)
  const [activeTab, setActiveTab] =
    useState<"credits" | "withdrawals" | "policy">("credits")
  const [searchFilter, setSearchFilter] = useState("")

  // Identify current manager identity and assigned Gaushala
  const managerProfile = profiles?.manager
  const managerEmail =
    authUser?.email || managerProfile?.email || "manager1@gomaa.in"
  const managerName =
    authUser?.name || managerProfile?.name || "Shyam Sundar Sharma"
  const managerUniqueId =
    authUser?.uniqueId || (managerProfile as any)?.uniqueId || "GMA-MGR-0101"

  const currentGosalaName = useMemo(() => {
    if (activeManagerGosala && activeManagerGosala !== "Unassigned") {
      return activeManagerGosala
    }
    if (authUser?.gosalaNames && authUser.gosalaNames.length > 0) {
      return authUser.gosalaNames[0]
    }
    if (
      managerProfile?.managerData?.gosala &&
      managerProfile.managerData.gosala !== "Unassigned"
    ) {
      return managerProfile.managerData.gosala
    }
    return gosalas[0]?.name || ""
  }, [activeManagerGosala, authUser, managerProfile, gosalas])

  const currentGosalaObj = useMemo(() => {
    return gosalas.find(
      (g) =>
        g.name.toLowerCase() === currentGosalaName.toLowerCase() ||
        g.id === currentGosalaName,
    )
  }, [gosalas, currentGosalaName])

  // Bank details for the manager / gaushala
  const bankDetails = useMemo(() => {
    return getGaushalaBankDetails(
      currentGosalaName,
      currentGosalaObj,
      managerProfile,
    )
  }, [currentGosalaName, currentGosalaObj, managerProfile])

  // Compute live wallet state (credits, available balance, withdrawals)
  const [refreshKey, setRefreshKey] = useState(0)
  const [dbBalance, setDbBalance] = useState<number | null>(null)
  const [dbTransactions, setDbTransactions] = useState<any[]>([])

  useEffect(() => {
    let isMounted = true
    api
      .getWalletBalance()
      .then((res) => {
        if (isMounted && res && res.ok && typeof res.balanceRupees === "number") {
          setDbBalance(res.balanceRupees)
        }
      })
      .catch(() => {})

    api
      .getWalletTransactions(50)
      .then((res) => {
        if (isMounted && res && res.ok && Array.isArray(res.transactions)) {
          setDbTransactions(res.transactions)
        }
      })
      .catch(() => {})

    return () => {
      isMounted = false
    }
  }, [refreshKey])

  const walletSummary: ManagerWalletSummary = useMemo(() => {
    return computeManagerWallet(
      managerEmail,
      currentGosalaName,
      bookings,
      pricingConfig?.commissionPct || 20,
      managerName,
    )
  }, [
    managerEmail,
    currentGosalaName,
    bookings,
    pricingConfig,
    managerName,
    refreshKey,
  ])

  // Effective available balance includes both Gaushala commission pool and direct database credits
  const effectiveAvailableBalance = useMemo(() => {
    const directCredit = dbBalance !== null ? dbBalance : 0
    return Math.max(0, walletSummary.availableBalance + directCredit)
  }, [walletSummary.availableBalance, dbBalance])

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const amountNum = Number(withdrawAmount)
    if (isNaN(amountNum) || amountNum <= 0) {
      notify("Please enter a valid withdrawal amount", "warn")
      return
    }
    if (amountNum > effectiveAvailableBalance) {
      notify(
        `Insufficient wallet balance. You can withdraw up to ${inr(effectiveAvailableBalance)}`,
        "danger",
      )
      return
    }

    setProcessingWithdrawal(true)
    try {
      if (dbBalance !== null && dbBalance > 0) {
        const debitAmt = Math.min(amountNum, dbBalance)
        await api
          .withdrawWallet({
            amountRupees: debitAmt,
            mode: withdrawMode,
            bankName: bankDetails.bankName,
            accountMasked: bankDetails.accountMasked,
            ifsc: bankDetails.ifsc,
          })
          .catch((err) => {
            console.warn("DB wallet withdraw note:", err)
          })
      }

      const newRecord = recordWithdrawal({
        managerId: managerUniqueId,
        managerName,
        gosala: currentGosalaName,
        amount: amountNum,
        mode: withdrawMode,
        bankName: bankDetails.bankName,
        accountMasked: bankDetails.accountMasked,
        ifsc: bankDetails.ifsc,
      })

      setCompletedWithdrawal(newRecord)
      setRefreshKey((k) => k + 1)
      notify(
        `Withdrawal of ${inr(amountNum)} disbursed via Instant ${withdrawMode}! UTR: ${newRecord.utrNumber}`,
        "ok",
      )
    } catch (err: any) {
      notify(
        `Withdrawal failed: ${err?.message || "Internal error"}`,
        "danger",
      )
    } finally {
      setProcessingWithdrawal(false)
    }
  }

  const handleQuickAmount = (pct: number) => {
    if (pct === 1) {
      setWithdrawAmount(String(effectiveAvailableBalance))
    } else {
      const amt = Math.floor(effectiveAvailableBalance * pct)
      setWithdrawAmount(String(amt))
    }
  }

  const allCreditItems = useMemo(() => {
    const items = [...walletSummary.creditItems]
    dbTransactions
      .filter((t) => t.type === "CREDIT")
      .forEach((t) => {
        const txDate = t.createdAt
          ? new Date(t.createdAt).toLocaleDateString("en-IN", {
              dateStyle: "medium",
            })
          : "Today"
        items.unshift({
          bookingId: t.referenceId || `TX-${t.id.slice(0, 8)}`,
          date: txDate,
          customer: t.description || "Super Admin Operational Credit",
          animal: "Direct DB Credit",
          ritualPurpose:
            t.purpose === "ADJUSTMENT"
              ? "Operational Adjustment / Test Credit"
              : t.purpose || "Direct Ledger Credit",
          grossAmount: t.amountRupees,
          platformFee: 0,
          gaushalaNet: t.amountRupees,
          managerSharePct: 100,
          managerCredit: t.amountRupees,
          bonus: 0,
          totalCredit: t.amountRupees,
          status: "Completed",
          isSettled: true,
        })
      })
    return items
  }, [walletSummary.creditItems, dbTransactions])

  const filteredCredits = useMemo(() => {
    if (!searchFilter.trim()) return allCreditItems
    const q = searchFilter.trim().toLowerCase()
    return allCreditItems.filter(
      (c) =>
        c.bookingId.toLowerCase().includes(q) ||
        c.customer.toLowerCase().includes(q) ||
        c.animal.toLowerCase().includes(q) ||
        c.ritualPurpose.toLowerCase().includes(q),
    )
  }, [allCreditItems, searchFilter])

  return (
    <div className="space-y-6">
      {/* Edit Profile / Bank modal fallback */}
      {editBankOpen && (
        <EditProfileModal
          role="manager"
          isOpen={true}
          onClose={() => setEditBankOpen(false)}
        />
      )}

      {/* Top Banner & Identity Header */}
      <div className="bg-gradient-to-r from-forest-deep via-forest to-emerald-800 rounded-xl p-5 sm:p-6 text-white shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 -mr-10 -mt-10 w-48 h-48 bg-white/5 rounded-full pointer-events-none blur-2xl" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[10.5px] bg-white/20 px-2.5 py-0.5 rounded-full font-bold tracking-wider uppercase border border-white/30 backdrop-blur-xs">
                Shed Custodian Wallet
              </span>
              <span className="font-mono text-[11px] bg-amber-400 text-amber-950 font-bold px-2 py-0.5 rounded shadow-2xs">
                #{managerUniqueId}
              </span>
              <span className="font-mono text-[11px] text-emerald-200 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-400/30">
                {currentGosalaName}
              </span>
            </div>
            <h1 className="font-serif text-[24px] sm:text-[28px] font-bold tracking-tight">
              {managerName}'s Custodian Wallet
            </h1>
            <p className="text-[13px] text-emerald-100 max-w-2xl leading-relaxed">
              Your personal manager earnings from conducted sacred pujas, direct
              IMPS bank payout gateway, and regional trust share split.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={() => {
                setCompletedWithdrawal(null)
                setWithdrawAmount("")
                setWithdrawModalOpen(true)
              }}
              disabled={effectiveAvailableBalance <= 0}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-[13.5px] font-bold shadow-md transition cursor-pointer ${
                effectiveAvailableBalance > 0
                  ? "bg-amber-400 hover:bg-amber-300 text-amber-950 hover:scale-[1.02] active:scale-[0.98]"
                  : "bg-white/20 text-white/50 cursor-not-allowed"
              }`}
            >
              <Wallet size={16} />
              <span>Withdraw to Bank</span>
            </button>
            <button
              onClick={() => setEditBankOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-[13px] font-medium bg-white/10 hover:bg-white/20 text-white border border-white/20 transition cursor-pointer"
            >
              <Landmark size={15} />
              <span>Bank Settings</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4 Core Financial Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Available Withdrawable Balance */}
        <div className="p-5 rounded-xl border-2 border-forest/30 bg-card shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-forest mb-1">
            <span className="text-[11.5px] font-mono uppercase tracking-wider font-semibold">
              Available For Withdrawal
            </span>
            <span className="h-2 w-2 rounded-full bg-forest animate-pulse" />
          </div>
          <div className="font-serif text-[28px] sm:text-[32px] font-bold text-forest">
            {inr(effectiveAvailableBalance)}
          </div>
          <div className="mt-2 flex items-center justify-between text-[11.5px] text-ink-soft">
            <span>Instant IMPS / RTGS 24x7</span>
            <button
              onClick={() => {
                setCompletedWithdrawal(null)
                setWithdrawAmount("")
                setWithdrawModalOpen(true)
              }}
              className="text-forest hover:underline font-semibold cursor-pointer"
            >
              Withdraw Now →
            </button>
          </div>
        </div>

        {/* Card 2: In-Escrow Pending Earnings */}
        <div className="p-5 rounded-xl border border-line bg-card shadow-xs">
          <div className="flex items-center justify-between text-amber-600 mb-1">
            <span className="text-[11.5px] font-mono uppercase tracking-wider font-semibold">
              In-Escrow Pending
            </span>
            <Clock size={15} />
          </div>
          <div className="font-serif text-[28px] sm:text-[32px] font-bold text-ink">
            {inr(walletSummary.pendingEscrowBalance)}
          </div>
          <div className="mt-2 text-[11.5px] text-ink-soft">
            {walletSummary.pendingBookingsCount} Sevas in Service / Dispatch
          </div>
        </div>

        {/* Card 3: Lifetime Paid Out */}
        <div className="p-5 rounded-xl border border-line bg-card shadow-xs">
          <div className="flex items-center justify-between text-sky-600 mb-1">
            <span className="text-[11.5px] font-mono uppercase tracking-wider font-semibold">
              Total Withdrawn to Bank
            </span>
            <CheckCircle2 size={15} />
          </div>
          <div className="font-serif text-[28px] sm:text-[32px] font-bold text-ink">
            {inr(walletSummary.totalWithdrawn)}
          </div>
          <div className="mt-2 text-[11.5px] text-ink-soft">
            {walletSummary.withdrawals.length} Settled IMPS/RTGS Payouts
          </div>
        </div>

        {/* Card 4: Active Manager Share Split */}
        <div className="p-5 rounded-xl border border-line bg-card shadow-xs">
          <div className="flex items-center justify-between text-purple-600 mb-1">
            <span className="text-[11.5px] font-mono uppercase tracking-wider font-semibold">
              Your Revenue Share Split
            </span>
            <Percent size={15} />
          </div>
          <div className="font-serif text-[28px] sm:text-[32px] font-bold text-ink">
            {walletSummary.policy.managerSharePct}%
          </div>
          <div className="mt-2 text-[11.5px] text-ink-soft flex items-center justify-between">
            <span>+{inr(walletSummary.policy.bonusPerPuja)} Bonus / Seva</span>
            <span className="text-[10.5px] text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded font-mono font-medium">
              Regional Policy
            </span>
          </div>
        </div>
      </div>

      {/* Linked Bank Account Card */}
      <div className="p-4 sm:p-5 rounded-xl border border-line bg-card shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-forest/10 text-forest flex items-center justify-center shrink-0">
            <Landmark size={24} />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-ink text-[14.5px]">
                {bankDetails.beneficiary}
              </span>
              <span className="font-mono text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded font-bold">
                ✓ {bankDetails.statusBadge || "Verified Bank Account"}
              </span>
            </div>
            <div className="text-[12.5px] text-ink-soft flex flex-wrap items-center gap-3 font-mono">
              <span>{bankDetails.bankName}</span>
              <span>•</span>
              <span className="font-semibold text-ink">
                {bankDetails.accountMasked}
              </span>
              <span>•</span>
              <span>IFSC: {bankDetails.ifsc}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
          <button
            onClick={() => setEditBankOpen(true)}
            className="px-3.5 py-1.5 rounded text-[12px] font-medium border border-line bg-paper hover:bg-paper-deep text-ink transition cursor-pointer"
          >
            Change Account
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-line flex items-center gap-2">
        <button
          onClick={() => setActiveTab("credits")}
          className={`px-4 py-2.5 text-[13.5px] font-semibold border-b-2 transition cursor-pointer flex items-center gap-2 ${
            activeTab === "credits"
              ? "border-forest text-forest bg-forest/5"
              : "border-transparent text-ink-soft hover:text-ink"
          }`}
        >
          <Receipt size={16} />
          <span>Seva Earnings Ledger ({walletSummary.creditItems.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("withdrawals")}
          className={`px-4 py-2.5 text-[13.5px] font-semibold border-b-2 transition cursor-pointer flex items-center gap-2 ${
            activeTab === "withdrawals"
              ? "border-forest text-forest bg-forest/5"
              : "border-transparent text-ink-soft hover:text-ink"
          }`}
        >
          <CreditCard size={16} />
          <span>
            Payouts & Bank Withdrawals ({walletSummary.withdrawals.length})
          </span>
        </button>
        <button
          onClick={() => setActiveTab("policy")}
          className={`px-4 py-2.5 text-[13.5px] font-semibold border-b-2 transition cursor-pointer flex items-center gap-2 ${
            activeTab === "policy"
              ? "border-forest text-forest bg-forest/5"
              : "border-transparent text-ink-soft hover:text-ink"
          }`}
        >
          <Percent size={16} />
          <span>Share Policy & Terms</span>
        </button>
      </div>

      {/* TAB 1: Seva Earnings Ledger */}
      {activeTab === "credits" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-serif text-[17px] font-bold text-ink">
                Itemized Seva Credits Breakdown
              </h3>
              <p className="text-[12px] text-ink-soft">
                Showing every seva booking at {currentGosalaName} with net split
                calculation.
              </p>
            </div>
            <div className="w-full sm:w-64">
              <input
                type="text"
                placeholder="Search by devotee, cow, seva..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full px-3 py-1.5 bg-card border border-line rounded text-[12.5px] text-ink focus:outline-none focus:ring-1 focus:ring-forest"
              />
            </div>
          </div>

          <div className="rounded-xl border border-line bg-card overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12.5px] border-collapse">
                <thead>
                  <tr className="bg-paper border-b border-line text-[11px] font-mono uppercase tracking-wider text-ink-faint">
                    <th className="py-3 px-4">Seva ID &amp; Date</th>
                    <th className="py-3 px-4">Devotee &amp; Sacred Cow</th>
                    <th className="py-3 px-4">Ceremony Type</th>
                    <th className="py-3 px-4 text-right">Gross Seva</th>
                    <th className="py-3 px-4 text-right">Gaushala Net (80%)</th>
                    <th className="py-3 px-4 text-center">Your Share %</th>
                    <th className="py-3 px-4 text-right">Manager Net Credit</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filteredCredits.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="py-8 text-center text-ink-faint"
                      >
                        No seva credits match your query.
                      </td>
                    </tr>
                  ) : (
                    filteredCredits.map((item) => (
                      <tr
                        key={item.bookingId}
                        className="hover:bg-paper/40 transition-colors"
                      >
                        <td className="py-3.5 px-4 font-mono">
                          <div className="font-bold text-ink">
                            {item.bookingId}
                          </div>
                          <div className="text-[11px] text-ink-faint">
                            {item.date}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-ink">
                            {item.customer}
                          </div>
                          <div className="text-[11.5px] text-forest font-medium">
                            Cow: {item.animal}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-ink-soft max-w-[180px] truncate">
                          {item.ritualPurpose}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-medium text-ink">
                          {inr(item.grossAmount)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-medium text-emerald-700">
                          {inr(item.gaushalaNet)}
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono">
                          <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 font-bold text-[11px]">
                            {item.managerSharePct}%
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-forest">
                          +{inr(item.totalCredit)}
                          {item.bonus > 0 && (
                            <span className="block text-[10px] text-amber-700 font-normal">
                              incl. {inr(item.bonus)} bonus
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10.5px] font-semibold font-mono ${
                              item.isSettled
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                : "bg-amber-100 text-amber-900 border border-amber-300"
                            }`}
                          >
                            {item.isSettled ? "Available" : "In-Escrow"}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Payouts & Bank Withdrawals */}
      {activeTab === "withdrawals" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-serif text-[17px] font-bold text-ink">
                Bank Withdrawal &amp; Disbursal History
              </h3>
              <p className="text-[12px] text-ink-soft">
                All payouts disbursed directly to your verified bank account via
                RBI IMPS/RTGS.
              </p>
            </div>
            <button
              onClick={() => {
                setCompletedWithdrawal(null)
                setWithdrawAmount("")
                setWithdrawModalOpen(true)
              }}
              disabled={effectiveAvailableBalance <= 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-forest text-white text-[12.5px] font-semibold hover:bg-forest-deep transition cursor-pointer self-start sm:self-auto"
            >
              <Wallet size={14} />
              <span>Initiate New Withdrawal</span>
            </button>
          </div>

          <div className="rounded-xl border border-line bg-card overflow-hidden shadow-xs">
            {walletSummary.withdrawals.length === 0 ? (
              <div className="py-12 px-4 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-paper-deep text-ink-faint mx-auto flex items-center justify-center">
                  <CreditCard size={24} />
                </div>
                <h4 className="font-semibold text-ink text-[15px]">
                  No Withdrawals Yet
                </h4>
                <p className="text-[12.5px] text-ink-soft max-w-sm mx-auto">
                  You have not initiated any bank withdrawals yet. Click
                  "Withdraw to Bank" above to transfer your available balance of{" "}
                  {inr(effectiveAvailableBalance)} instantly.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[12.5px] border-collapse">
                  <thead>
                    <tr className="bg-paper border-b border-line text-[11px] font-mono uppercase tracking-wider text-ink-faint">
                      <th className="py-3 px-4">Payout ID &amp; Date</th>
                      <th className="py-3 px-4">Bank Destination</th>
                      <th className="py-3 px-4">Banking Reference (UTR)</th>
                      <th className="py-3 px-4">Transfer Channel</th>
                      <th className="py-3 px-4 text-right">Disbursed Amount</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {walletSummary.withdrawals.map((w) => (
                      <tr
                        key={w.id}
                        className="hover:bg-paper/40 transition-colors"
                      >
                        <td className="py-3.5 px-4 font-mono">
                          <div className="font-bold text-ink">{w.id}</div>
                          <div className="text-[11px] text-ink-faint">
                            {w.timestamp}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-ink">
                            {w.bankName}
                          </div>
                          <div className="font-mono text-[11px] text-ink-soft">
                            {w.accountMasked} • {w.ifsc}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-ink font-semibold">
                          {w.utrNumber}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[11.5px]">
                          <span className="px-2 py-0.5 rounded bg-sky-50 text-sky-800 font-semibold border border-sky-200">
                            {w.mode} 24x7
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-[14px] font-bold text-forest">
                          {inr(w.amount)}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            ✓ {w.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => {
                              notify(
                                `Downloaded payout voucher for ${w.utrNumber}`,
                                "info",
                              )
                            }}
                            className="inline-flex items-center gap-1 text-[11.5px] text-forest hover:underline font-medium cursor-pointer"
                          >
                            <Download size={13} />
                            <span>Voucher</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: Share Policy & Terms */}
      {activeTab === "policy" && (
        <div className="rounded-xl border border-line bg-card p-6 space-y-6 shadow-xs">
          <div className="space-y-1">
            <h3 className="font-serif text-[18px] font-bold text-ink">
              Revenue Split Policy &amp; Escrow Governance
            </h3>
            <p className="text-[13px] text-ink-soft max-w-3xl leading-relaxed">
              Every ceremonial booking on GOMAA adheres to the transparent 80/20
              platform protocol, with custodian revenue splits configured by
              your Regional Operations Admin.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg border border-line bg-paper space-y-2">
              <div className="text-[11px] font-mono text-ink-faint uppercase font-semibold">
                Platform Seva Fee (20%)
              </div>
              <div className="font-serif text-[24px] font-bold text-ink">
                20%
              </div>
              <p className="text-[11.5px] text-ink-soft leading-snug">
                Covers server infrastructure, live cow GPS tracking, platform
                KYC verification, and 24x7 helpline.
              </p>
            </div>

            <div className="p-4 rounded-lg border border-forest/30 bg-emerald-50/50 space-y-2">
              <div className="text-[11px] font-mono text-emerald-800 uppercase font-semibold">
                Gaushala Sanctuary Corpus (75% of Net)
              </div>
              <div className="font-serif text-[24px] font-bold text-forest">
                {walletSummary.policy.gosalaCorpusPct}%
              </div>
              <p className="text-[11.5px] text-ink-soft leading-snug">
                Dedicated funds directly credited for cattle green fodder,
                veterinary care, shed maintenance, and cow welfare.
              </p>
            </div>

            <div className="p-4 rounded-lg border border-purple-300 bg-purple-50/50 space-y-2">
              <div className="text-[11px] font-mono text-purple-800 uppercase font-semibold">
                Manager Custodian Share (25% of Net)
              </div>
              <div className="font-serif text-[24px] font-bold text-purple-900">
                {walletSummary.policy.managerSharePct}%
              </div>
              <p className="text-[11.5px] text-ink-soft leading-snug">
                Direct personal custodian compensation credited into your
                wallet, plus {inr(walletSummary.policy.bonusPerPuja)} bonus per
                completed seva.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-paper-deep border border-line text-[12px] text-ink-soft space-y-1.5">
            <div className="font-semibold text-ink flex items-center gap-1.5">
              <ShieldCheck size={16} className="text-forest" />
              <span>Operations Admin Jurisdiction</span>
            </div>
            <p>
              Your current revenue split of{" "}
              <strong>{walletSummary.policy.managerSharePct}%</strong> was
              authorized by your Regional Operations Admin on{" "}
              {new Date(walletSummary.policy.lastUpdated).toLocaleDateString(
                "en-IN",
              )}
              . If you require changes to your split or seva bonus, please
              contact your Regional Operations Admin.
            </p>
          </div>
        </div>
      )}

      {/* WITHDRAWAL MODAL */}
      {withdrawModalOpen && (
        <div className="fixed inset-0 z-50 bg-ink/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-card border border-line rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
            {completedWithdrawal ? (
              // Success Screen
              <div className="p-6 sm:p-8 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-forest mx-auto flex items-center justify-center shadow-xs">
                  <CheckCircle2 size={36} />
                </div>
                <h3 className="font-serif text-[22px] font-bold text-ink">
                  Payout Successfully Disbursed!
                </h3>
                <p className="text-[13px] text-ink-soft">
                  {inr(completedWithdrawal.amount)} has been transferred
                  directly to your bank account via Instant{" "}
                  {completedWithdrawal.mode}.
                </p>

                <div className="p-4 rounded-xl bg-paper border border-line text-left text-[12.5px] space-y-2 font-mono">
                  <div className="flex justify-between">
                    <span className="text-ink-faint">UTR Banking Number:</span>
                    <span className="font-bold text-forest">
                      {completedWithdrawal.utrNumber}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-faint">Destination Bank:</span>
                    <span className="text-ink">
                      {completedWithdrawal.bankName}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-faint">Account Target:</span>
                    <span className="text-ink">
                      {completedWithdrawal.accountMasked}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-faint">Disbursed Timestamp:</span>
                    <span className="text-ink">
                      {completedWithdrawal.timestamp}
                    </span>
                  </div>
                </div>

                <div className="flex gap-3 justify-center pt-2">
                  <button
                    onClick={() => {
                      setWithdrawModalOpen(false)
                      setActiveTab("withdrawals")
                    }}
                    className="px-6 py-2.5 rounded-lg bg-forest text-white text-[13.5px] font-bold hover:bg-forest-deep transition cursor-pointer"
                  >
                    View Withdrawal Ledger
                  </button>
                  <button
                    onClick={() => {
                      notify(
                        `Payout voucher downloaded for ${completedWithdrawal.utrNumber}`,
                        "info",
                      )
                    }}
                    className="px-4 py-2.5 rounded-lg bg-paper-deep text-ink border border-line text-[13px] font-medium hover:bg-paper transition cursor-pointer flex items-center gap-1.5"
                  >
                    <Download size={14} />
                    <span>Download Receipt</span>
                  </button>
                </div>
              </div>
            ) : (
              // Form Screen
              <form onSubmit={handleWithdrawSubmit}>
                <div className="px-6 py-4 border-b border-line flex items-center justify-between bg-paper">
                  <div className="flex items-center gap-2">
                    <Wallet size={18} className="text-forest" />
                    <h3 className="font-serif text-[17px] font-bold text-ink">
                      Withdraw to Bank Account
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setWithdrawModalOpen(false)}
                    className="p-1 rounded text-ink-faint hover:text-ink transition cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="p-6 space-y-5">
                  {/* Available Balance Box */}
                  <div className="p-4 rounded-xl bg-forest-soft border border-forest/20 flex items-center justify-between">
                    <div>
                      <div className="text-[11.5px] font-mono text-forest uppercase font-semibold">
                        Available Balance
                      </div>
                      <div className="font-serif text-[24px] font-bold text-forest">
                        {inr(effectiveAvailableBalance)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleQuickAmount(1)}
                      className="px-3 py-1 rounded bg-forest text-white text-[11.5px] font-semibold hover:bg-forest-deep transition cursor-pointer"
                    >
                      Use Max
                    </button>
                  </div>

                  {/* Amount Input */}
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-semibold text-ink uppercase tracking-wider font-mono">
                      Withdrawal Amount (₹)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint font-semibold text-[16px]">
                        ₹
                      </span>
                      <input
                        type="number"
                        min="100"
                        max={effectiveAvailableBalance}
                        placeholder="Enter amount"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        className="w-full pl-8 pr-4 py-2.5 bg-paper border border-line rounded-lg text-[16px] font-bold text-ink focus:outline-none focus:ring-2 focus:ring-forest"
                        required
                      />
                    </div>
                    {/* Quick chips */}
                    <div className="flex gap-2 pt-1">
                      {[1000, 2000, 5000].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setWithdrawAmount(String(amt))}
                          disabled={amt > effectiveAvailableBalance}
                          className="px-2.5 py-1 rounded bg-paper-deep border border-line text-[11px] font-mono text-ink-soft hover:text-ink disabled:opacity-40 transition cursor-pointer"
                        >
                          +{inr(amt)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Transfer Channel Mode */}
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-semibold text-ink uppercase tracking-wider font-mono">
                      Transfer Speed &amp; Channel
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <label
                        className={`p-3 rounded-lg border text-left cursor-pointer transition flex items-start gap-2.5 ${
                          withdrawMode === "IMPS"
                            ? "border-forest bg-forest/5 text-forest"
                            : "border-line bg-paper text-ink-soft hover:text-ink"
                        }`}
                      >
                        <input
                          type="radio"
                          name="mode"
                          checked={withdrawMode === "IMPS"}
                          onChange={() => setWithdrawMode("IMPS")}
                          className="mt-1"
                        />
                        <div>
                          <div className="font-bold text-[12.5px] text-ink">
                            Instant IMPS
                          </div>
                          <div className="text-[11px] text-ink-faint">
                            Immediate 24x7 Settlement (Zero Fee)
                          </div>
                        </div>
                      </label>

                      <label
                        className={`p-3 rounded-lg border text-left cursor-pointer transition flex items-start gap-2.5 ${
                          withdrawMode === "RTGS"
                            ? "border-forest bg-forest/5 text-forest"
                            : "border-line bg-paper text-ink-soft hover:text-ink"
                        }`}
                      >
                        <input
                          type="radio"
                          name="mode"
                          checked={withdrawMode === "RTGS"}
                          onChange={() => setWithdrawMode("RTGS")}
                          className="mt-1"
                        />
                        <div>
                          <div className="font-bold text-[12.5px] text-ink">
                            RBI RTGS / NEFT
                          </div>
                          <div className="text-[11px] text-ink-faint">
                            Direct Reserve Bank Route
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Destination Bank Preview */}
                  <div className="p-3.5 rounded-lg border border-line bg-paper text-[12px] space-y-1 font-mono">
                    <div className="text-ink-faint text-[10.5px] uppercase">
                      Destination Bank Account:
                    </div>
                    <div className="font-bold text-ink">
                      {bankDetails.beneficiary}
                    </div>
                    <div className="text-ink-soft">
                      {bankDetails.bankName} • {bankDetails.accountMasked}
                    </div>
                  </div>
                </div>

                <div className="px-6 py-4 border-t border-line bg-paper flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setWithdrawModalOpen(false)}
                    className="px-4 py-2 rounded text-[13px] font-medium text-ink-soft hover:text-ink transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={
                      processingWithdrawal ||
                      !withdrawAmount ||
                      Number(withdrawAmount) <= 0
                    }
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-forest text-white text-[13.5px] font-bold hover:bg-forest-deep disabled:opacity-50 transition cursor-pointer shadow-md"
                  >
                    {processingWithdrawal ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Disbursing via Bank Gateway...</span>
                      </>
                    ) : (
                      <>
                        <ArrowUpRight size={16} />
                        <span>Confirm Transfer</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
