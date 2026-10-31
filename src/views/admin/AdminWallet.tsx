import React, { useState, useMemo } from "react"
import {
  Wallet,
  Landmark,
  Building2,
  Users,
  Percent,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Save,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  Coins,
  Receipt,
  User,
  Sparkles,
  RefreshCw,
  Search,
  X,
} from "lucide-react"
import { inr } from "../../data/mock"
import { api } from "../../services/api"
import { useStore, useToast } from "../../store/store"
import {
  getAllManagerSharePolicies,
  saveManagerSharePolicy,
  getAllWithdrawals,
  computeManagerWallet,
  simulatePujaSplit,
  type ManagerSharePolicy,
} from "../../services/walletService"

export default function AdminWallet({
  onNavigateToManagers,
  onOpenProfileShareSplit,
}: {
  onNavigateToManagers?: () => void
  onOpenProfileShareSplit?: () => void
}) {
  const { authUser, gosalas, bookings, managers, pricingConfig } = useStore()
  const { notify } = useToast()

  const [refreshKey, setRefreshKey] = useState(0)
  const [selectedManagerId, setSelectedManagerId] =
    useState<string>("manager1@gomaa.in")
  const [editSharePct, setEditSharePct] = useState<number>(25)
  const [editBonusPerPuja, setEditBonusPerPuja] = useState<number>(100)
  const [savingPolicy, setSavingPolicy] = useState(false)
  const [searchFilter, setSearchFilter] = useState("")

  const [creditingTarget, setCreditingTarget] = useState<{
    managerName: string
    managerEmail: string
    managerId: string
    gosalaName: string
  } | null>(null)
  const [creditAmount, setCreditAmount] = useState<string>("2500")
  const [creditPurpose, setCreditPurpose] = useState<string>("OPERATIONAL_TEST")
  const [creditNote, setCreditNote] = useState<string>(
    "Super Admin operational wallet credit",
  )
  const [creditingInProgress, setCreditingInProgress] = useState(false)

  const handleCreditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!creditingTarget) return
    const amt = Number(creditAmount)
    if (isNaN(amt) || amt <= 0) {
      notify("Please enter a valid credit amount in ₹", "warn")
      return
    }
    setCreditingInProgress(true)
    try {
      const res = await api.adminCreditWallet({
        userId: creditingTarget.managerId,
        email: creditingTarget.managerEmail,
        amountRupees: amt,
        purpose: creditPurpose,
        description: creditNote,
      })
      if (res && res.ok) {
        notify(
          `Successfully credited ${inr(amt)} to ${creditingTarget.managerName}'s wallet!`,
          "ok",
        )
        setCreditingTarget(null)
        setRefreshKey((k) => k + 1)
      } else {
        notify(
          `Failed to credit wallet: ${res?.message || "Unknown error"}`,
          "danger",
        )
      }
    } catch (err: any) {
      notify(`Credit error: ${err.message || "Network error"}`, "danger")
    } finally {
      setCreditingInProgress(false)
    }
  }

  const commissionPct = pricingConfig?.commissionPct || 20

  // All policies
  const policies = useMemo(() => {
    return getAllManagerSharePolicies()
  }, [refreshKey])

  // All manager withdrawals
  const allWithdrawals = useMemo(() => {
    return getAllWithdrawals()
  }, [refreshKey])

  // Sync selected manager policy state
  const selectedPolicy = useMemo(() => {
    const p = policies.find(
      (x) =>
        x.managerEmail.toLowerCase() === selectedManagerId.toLowerCase() ||
        x.managerId.toLowerCase() === selectedManagerId.toLowerCase(),
    )
    if (p) return p
    return (
      policies[0] || {
        managerId: managers[0]?.id || "GMA-MGR-0001",
        managerEmail: managers[0]?.email || "manager@gomaa.in",
        managerName: managers[0]?.name || "Gaushala Manager",
        gosalaName: gosalas[0]?.name || "Governed Gaushala",
        managerSharePct: 25,
        gosalaCorpusPct: 75,
        bonusPerPuja: 100,
        lastUpdated: new Date().toISOString(),
        updatedBy: "Operations Admin",
      }
    )
  }, [policies, selectedManagerId])

  // Update slider/input when selected manager changes
  React.useEffect(() => {
    if (selectedPolicy) {
      setEditSharePct(selectedPolicy.managerSharePct)
      setEditBonusPerPuja(selectedPolicy.bonusPerPuja || 0)
    }
  }, [selectedPolicy])

  // Compute live matrix for each governed Gaushala and manager
  const sanctuaryMatrix = useMemo(() => {
    return gosalas.map((g) => {
      // Find assigned manager
      const mgr = managers.find(
        (m) =>
          m.gosala?.toLowerCase() === g.name.toLowerCase() ||
          (m.gosalas &&
            m.gosalas.some(
              (gn) => gn.toLowerCase() === g.name.toLowerCase(),
            )) ||
          m.id === g.managerId ||
          m.name.toLowerCase() === (g.managerName || "").toLowerCase(),
      )

      const managerEmail = mgr?.email || "unassigned@gomaa.in"
      const managerName = mgr?.name || g.managerName || "Unassigned Manager"
      const managerUniqueId = (mgr as any)?.uniqueId || mgr?.id || "N/A"

      const summary = computeManagerWallet(
        managerEmail,
        g.name,
        bookings,
        commissionPct,
        managerName,
      )

      // Calculate Gaushala Net and Sanctuary Corpus
      const targetGosala = g.name.trim().toLowerCase()
      const gBookings = bookings.filter((b) => {
        const bg = (b.gosala || "").trim().toLowerCase()
        return bg === targetGosala
      })

      const gTotalGross = gBookings.reduce(
        (sum, b) => sum + (b.total || (b.base || 0) + (b.extraTime || 0)),
        0,
      )
      const gGaushalaNet = Math.round(
        gTotalGross * ((100 - commissionPct) / 100),
      )
      const sanctuaryCorpus = Math.max(
        0,
        gGaushalaNet - summary.totalLifetimeEarned,
      )

      return {
        gosala: g,
        managerEmail,
        managerName,
        managerUniqueId,
        summary,
        totalBookings: gBookings.length,
        totalGross: gTotalGross,
        gaushalaNet: gGaushalaNet,
        sanctuaryCorpus: sanctuaryCorpus,
        managerWalletAvailable: summary.availableBalance,
        managerLifetimeWithdrawn: summary.totalWithdrawn,
        sharePct: summary.policy.managerSharePct,
        corpusPct: summary.policy.gosalaCorpusPct,
        bonusPerPuja: summary.policy.bonusPerPuja,
      }
    })
  }, [gosalas, managers, bookings, commissionPct, refreshKey])

  // Regional aggregated metrics
  const regionalMetrics = useMemo(() => {
    let totalInflow = 0
    let totalSanctuaryCorpus = 0
    let totalManagerPool = 0
    let totalWithdrawnByManagers = 0

    sanctuaryMatrix.forEach((item) => {
      totalInflow += item.totalGross
      totalSanctuaryCorpus += item.sanctuaryCorpus
      totalManagerPool += item.summary.totalLifetimeEarned
      totalWithdrawnByManagers += item.managerLifetimeWithdrawn
    })

    return {
      totalInflow,
      totalSanctuaryCorpus,
      totalManagerPool,
      totalWithdrawnByManagers,
    }
  }, [sanctuaryMatrix])

  // Interactive Live Calculation Simulation on a sample ₹4,000 seva
  const simulation = useMemo(() => {
    return simulatePujaSplit(
      4000,
      commissionPct,
      editSharePct,
      editBonusPerPuja,
    )
  }, [commissionPct, editSharePct, editBonusPerPuja])

  // Handle Save Share Policy
  const handleSavePolicy = () => {
    setSavingPolicy(true)
    setTimeout(() => {
      try {
        const updatedPolicy: ManagerSharePolicy = {
          ...selectedPolicy,
          managerSharePct: editSharePct,
          gosalaCorpusPct: 100 - editSharePct,
          bonusPerPuja: editBonusPerPuja,
          lastUpdated: new Date().toISOString(),
          updatedBy: `${authUser?.name || "Operations Admin"} (${authUser?.uniqueId || "GMA-OPS-0101"})`,
        }
        saveManagerSharePolicy(updatedPolicy)
        setRefreshKey((k) => k + 1)
        notify(
          `Updated share split for ${selectedPolicy.managerName} to ${editSharePct}% Manager / ${100 - editSharePct}% Sanctuary Corpus!`,
          "ok",
        )
      } catch (err: any) {
        notify(`Failed to update policy: ${err?.message}`, "danger")
      } finally {
        setSavingPolicy(false)
      }
    }, 400)
  }

  const filteredMatrix = useMemo(() => {
    if (!searchFilter.trim()) return sanctuaryMatrix
    const q = searchFilter.trim().toLowerCase()
    return sanctuaryMatrix.filter(
      (m) =>
        m.gosala.name.toLowerCase().includes(q) ||
        m.managerName.toLowerCase().includes(q) ||
        m.managerUniqueId.toLowerCase().includes(q),
    )
  }, [sanctuaryMatrix, searchFilter])

  return (
    <div className="space-y-6">
      {/* Top Banner & Institutional Authority Header */}
      <div className="bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 rounded-xl p-5 sm:p-6 text-white shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 -mr-10 -mt-10 w-48 h-48 bg-sky-500/10 rounded-full pointer-events-none blur-2xl" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[10.5px] bg-sky-500/20 text-sky-300 px-2.5 py-0.5 rounded-full font-bold tracking-wider uppercase border border-sky-400/30">
                Regional Operations Treasury
              </span>
              <span className="font-mono text-[11px] bg-sky-400 text-sky-950 font-bold px-2 py-0.5 rounded shadow-2xs">
                #{authUser?.uniqueId || "GMA-OPS-0101"}
              </span>
              <span className="font-mono text-[11px] text-sky-200 bg-sky-950/60 px-2 py-0.5 rounded border border-sky-400/20">
                Jurisdiction: Regional Sanctuaries
              </span>
            </div>
            <h1 className="font-serif text-[24px] sm:text-[28px] font-bold tracking-tight">
              Regional Treasury &amp; Manager Wallets
            </h1>
            <p className="text-[13px] text-sky-100 max-w-2xl leading-relaxed">
              Supervise regional Gaushala inflows, manage custodian wallets, and
              configure the revenue share split between sanctuary infrastructure
              funds and shed managers.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {onOpenProfileShareSplit && (
              <button
                onClick={onOpenProfileShareSplit}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-[13px] font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition cursor-pointer"
              >
                <User size={15} />
                <span>Adjust in Profile</span>
              </button>
            )}
            {onNavigateToManagers && (
              <button
                onClick={onNavigateToManagers}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-[13px] font-medium bg-sky-500 hover:bg-sky-400 text-white transition cursor-pointer shadow-sm"
              >
                <Users size={15} />
                <span>Manage Roster</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 4 Regional Inflow & Custodian Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Regional Inflow */}
        <div className="p-5 rounded-xl border border-line bg-card shadow-xs">
          <div className="flex items-center justify-between text-ink-faint mb-1">
            <span className="text-[11.5px] font-mono uppercase tracking-wider font-semibold">
              Regional Seva Inflow
            </span>
            <TrendingUp size={16} className="text-forest" />
          </div>
          <div className="font-serif text-[28px] sm:text-[32px] font-bold text-ink">
            {inr(regionalMetrics.totalInflow)}
          </div>
          <div className="mt-2 text-[11.5px] text-forest font-medium">
            100% Platform Verified Gross Sevas
          </div>
        </div>

        {/* Metric 2: Gaushala Sanctuary Corpus */}
        <div className="p-5 rounded-xl border border-line bg-card shadow-xs">
          <div className="flex items-center justify-between text-emerald-700 mb-1">
            <span className="text-[11.5px] font-mono uppercase tracking-wider font-semibold">
              Sanctuary Corpus Reserve
            </span>
            <Building2 size={16} />
          </div>
          <div className="font-serif text-[28px] sm:text-[32px] font-bold text-emerald-800">
            {inr(regionalMetrics.totalSanctuaryCorpus)}
          </div>
          <div className="mt-2 text-[11.5px] text-ink-soft">
            Cattle Fodder &amp; Infrastructure Fund
          </div>
        </div>

        {/* Metric 3: Total Managers' Pool */}
        <div className="p-5 rounded-xl border border-line bg-card shadow-xs">
          <div className="flex items-center justify-between text-purple-700 mb-1">
            <span className="text-[11.5px] font-mono uppercase tracking-wider font-semibold">
              Managers' Earnings Pool
            </span>
            <Coins size={16} />
          </div>
          <div className="font-serif text-[28px] sm:text-[32px] font-bold text-purple-900">
            {inr(regionalMetrics.totalManagerPool)}
          </div>
          <div className="mt-2 text-[11.5px] text-ink-soft">
            Cumulative Custodian Allocation
          </div>
        </div>

        {/* Metric 4: Manager Payouts Disbursed */}
        <div className="p-5 rounded-xl border border-line bg-card shadow-xs">
          <div className="flex items-center justify-between text-sky-700 mb-1">
            <span className="text-[11.5px] font-mono uppercase tracking-wider font-semibold">
              Manager Payouts Disbursed
            </span>
            <CheckCircle2 size={16} />
          </div>
          <div className="font-serif text-[28px] sm:text-[32px] font-bold text-sky-900">
            {inr(regionalMetrics.totalWithdrawnByManagers)}
          </div>
          <div className="mt-2 text-[11.5px] text-ink-soft">
            {allWithdrawals.length} Settled IMPS/RTGS Transfers
          </div>
        </div>
      </div>

      {/* Interactive Manager Share Split Arranger (Core User Requirement) */}
      <div className="rounded-xl border-2 border-forest/30 bg-card p-5 sm:p-6 shadow-xs space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-line pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Percent size={18} className="text-forest" />
              <h2 className="font-serif text-[20px] font-bold text-ink">
                Configure Manager Share Split
              </h2>
            </div>
            <p className="text-[12.5px] text-ink-soft leading-relaxed max-w-2xl">
              As Regional Operations Admin, configure the revenue percentage
              awarded to Gaushala Managers versus retained for Sanctuary
              Maintenance &amp; Fodder.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={selectedManagerId}
              onChange={(e) => setSelectedManagerId(e.target.value)}
              className="px-3.5 py-2 rounded-lg bg-paper border border-line text-[13px] font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-forest cursor-pointer"
            >
              {policies.map((p) => (
                <option key={p.managerEmail} value={p.managerEmail}>
                  {p.managerName} ({p.gosalaName})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Sliders & Controls */}
          <div className="lg:col-span-7 space-y-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[13px]">
                <span className="font-semibold text-ink">
                  Manager Custodian Cut:{" "}
                  <strong className="text-forest text-[15px]">
                    {editSharePct}%
                  </strong>
                </span>
                <span className="font-mono text-[12px] text-ink-faint">
                  Sanctuary Corpus:{" "}
                  <strong className="text-emerald-800">
                    {100 - editSharePct}%
                  </strong>
                </span>
              </div>
              <input
                type="range"
                min="10"
                max="50"
                step="1"
                value={editSharePct}
                onChange={(e) => setEditSharePct(Number(e.target.value))}
                className="w-full accent-forest cursor-pointer h-2 bg-paper-deep rounded-lg"
              />
              <div className="flex justify-between text-[11px] font-mono text-ink-faint">
                <span>10% (Minimum)</span>
                <span>25% (Standard Baseline)</span>
                <span>50% (Equal Split Cap)</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-[13px]">
                <span className="font-semibold text-ink">
                  Puja Completion Bonus (₹)
                </span>
                <span className="font-mono text-forest font-bold text-[14px]">
                  +{inr(editBonusPerPuja)} / Seva
                </span>
              </div>
              <input
                type="number"
                min="0"
                max="1000"
                step="50"
                value={editBonusPerPuja}
                onChange={(e) =>
                  setEditBonusPerPuja(Math.max(0, Number(e.target.value)))
                }
                className="w-full px-3.5 py-2 bg-paper border border-line rounded-lg text-[14px] font-mono font-bold text-ink focus:outline-none focus:ring-2 focus:ring-forest"
              />
              <p className="text-[11.5px] text-ink-faint">
                Direct operational bonus granted to the manager for every
                successfully executed and verified Darshan.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-between">
              <div className="text-[11.5px] text-ink-soft">
                Last updated:{" "}
                {new Date(selectedPolicy.lastUpdated).toLocaleDateString(
                  "en-IN",
                )}
              </div>
              <button
                onClick={handleSavePolicy}
                disabled={savingPolicy}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-forest text-white text-[13.5px] font-bold hover:bg-forest-deep transition cursor-pointer shadow-md"
              >
                {savingPolicy ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Saving Policy...</span>
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    <span>Save Share Policy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Column: Live Dynamic Puja Simulation Preview */}
          <div className="lg:col-span-5 bg-paper rounded-xl p-5 border border-line space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11.5px] font-mono text-forest uppercase font-bold tracking-wider">
                Live Calculation Simulation
              </span>
              <span className="font-mono text-[11px] bg-forest/10 text-forest px-2 py-0.5 rounded font-semibold">
                Sample ₹4,000 Seva
              </span>
            </div>

            <div className="space-y-2 text-[12.5px] font-mono">
              <div className="flex justify-between py-1 border-b border-line">
                <span className="text-ink-soft">Gross Devotee Dakshina:</span>
                <span className="font-bold text-ink">
                  {inr(simulation.grossDakshina)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-line text-ink-soft">
                <span>
                  Platform Commission ({simulation.platformCommissionPct}%):
                </span>
                <span>-{inr(simulation.platformFee)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-line font-semibold text-emerald-800">
                <span>Gaushala Net Seva (80%):</span>
                <span>{inr(simulation.gaushalaNet)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-line text-purple-900 bg-purple-50/50 px-2 rounded">
                <span>
                  Manager Custodian Cut ({simulation.managerSharePct}%):
                </span>
                <span className="font-bold text-forest">
                  +{inr(simulation.managerBaseCut)}
                  {simulation.bonusPerPuja > 0 &&
                    ` (+${inr(simulation.bonusPerPuja)} bonus)`}
                </span>
              </div>
              <div className="flex justify-between py-1.5 font-bold text-emerald-900 bg-emerald-50 px-2 rounded">
                <span>
                  Sanctuary Fodder Corpus ({simulation.shelterCorpusPct}%):
                </span>
                <span>{inr(simulation.shelterCorpusNet)}</span>
              </div>
            </div>

            <div className="text-[11px] text-ink-faint leading-tight">
              ✓ Manager receives{" "}
              <strong>{inr(simulation.managerTotalEarning)}</strong> in their
              personal wallet immediately upon ceremony completion.
            </div>
          </div>
        </div>
      </div>

      {/* Governed Sanctuaries & Manager Wallets Matrix */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-serif text-[18px] font-bold text-ink">
              Regional Sanctuaries &amp; Custodian Wallets Matrix
            </h3>
            <p className="text-[12px] text-ink-soft">
              Real-time balance status for all Gaushalas and their appointed
              shed custodians.
            </p>
          </div>
          <div className="w-full sm:w-64">
            <input
              type="text"
              placeholder="Search Gaushala or Manager..."
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
                  <th className="py-3 px-4">Gaushala Facility</th>
                  <th className="py-3 px-4">Appointed Manager</th>
                  <th className="py-3 px-4 text-center">Sevas Hosted</th>
                  <th className="py-3 px-4 text-right">Sanctuary Corpus</th>
                  <th className="py-3 px-4 text-right">
                    Manager Wallet Balance
                  </th>
                  <th className="py-3 px-4 text-center">Configured Split</th>
                  <th className="py-3 px-4 text-right">Quick Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredMatrix.map((item) => (
                  <tr
                    key={item.gosala.id}
                    className="hover:bg-paper/40 transition-colors"
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-ink">
                        {item.gosala.name}
                      </div>
                      <div className="font-mono text-[11px] text-ink-faint">
                        AWBI:{" "}
                        {item.gosala.trustRegistrationNo || "AWBI-TR-0421"}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-ink flex items-center gap-1.5">
                        <span>{item.managerName}</span>
                        <span className="font-mono text-[10px] bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded font-bold">
                          #{item.managerUniqueId}
                        </span>
                      </div>
                      <div className="text-[11px] text-ink-soft">
                        {item.managerEmail}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono font-medium text-ink">
                      {item.totalBookings}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-800">
                      {inr(item.sanctuaryCorpus)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-forest">
                      {inr(item.managerWalletAvailable)}
                      <span className="block text-[10px] text-ink-faint font-normal">
                        Settled: {inr(item.managerLifetimeWithdrawn)}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono bg-purple-50 text-purple-800 border border-purple-200">
                        {item.sharePct}% Mgr / {item.corpusPct}% Shed
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setCreditingTarget({
                              managerName: item.managerName,
                              managerEmail: item.managerEmail,
                              managerId: item.managerUniqueId || item.managerEmail,
                              gosalaName: item.gosalaName,
                            })
                            setCreditAmount("2500")
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-50 border border-emerald-300 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100 transition shadow-2xs cursor-pointer"
                          title="Credit Manager Wallet"
                        >
                          <Coins size={11} />
                          <span>Credit</span>
                        </button>
                        <button
                          onClick={() => {
                            setSelectedManagerId(item.managerEmail)
                            setEditSharePct(item.sharePct)
                            setEditBonusPerPuja(item.bonusPerPuja || 0)
                            window.scrollTo({ top: 350, behavior: "smooth" })
                            notify(
                              `Selected ${item.managerName} for share split adjustment`,
                              "info",
                            )
                          }}
                          className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-forest hover:underline cursor-pointer"
                        >
                          <Sliders size={12} />
                          <span>Adjust Split</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Recent Manager Bank Withdrawals Audit Feed */}
      <div className="space-y-3">
        <h3 className="font-serif text-[17px] font-bold text-ink">
          Recent Regional Manager Withdrawals
        </h3>
        <div className="rounded-xl border border-line bg-card overflow-hidden shadow-xs">
          {allWithdrawals.length === 0 ? (
            <div className="py-8 text-center text-ink-faint text-[12.5px]">
              No manager withdrawals recorded yet in this regional cycle.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12.5px] border-collapse">
                <thead>
                  <tr className="bg-paper border-b border-line text-[11px] font-mono uppercase tracking-wider text-ink-faint">
                    <th className="py-3 px-4">UTR Reference</th>
                    <th className="py-3 px-4">Manager &amp; Gaushala</th>
                    <th className="py-3 px-4">Destination Bank</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4">Channel</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {allWithdrawals.slice(0, 5).map((w) => (
                    <tr key={w.id} className="hover:bg-paper/40">
                      <td className="py-3 px-4 font-mono font-bold text-ink">
                        {w.utrNumber}
                        <div className="text-[10.5px] text-ink-faint font-normal">
                          {w.timestamp}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-ink">
                          {w.managerName}
                        </div>
                        <div className="text-[11px] text-ink-soft">
                          {w.gosala}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11.5px] text-ink">
                        {w.bankName} ({w.accountMasked})
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-forest text-[13.5px]">
                        {inr(w.amount)}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px]">
                        <span className="px-2 py-0.5 rounded bg-sky-50 text-sky-800 font-semibold">
                          {w.mode} 24x7
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          ✓ Settled
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Credit Manager Modal */}
      {creditingTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div
            className="absolute inset-0 bg-ink/60 backdrop-blur-sm"
            onClick={() => {
              if (!creditingInProgress) setCreditingTarget(null)
            }}
          />
          <div className="relative w-full max-w-md bg-card rounded-xl shadow-2xl border border-emerald-500/30 p-6 overflow-hidden">
            {/* Header */}
            <div className="flex items-start gap-3 pb-4 border-b border-line">
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center justify-center shrink-0">
                <Coins size={20} />
              </div>
              <div className="flex-1">
                <h3 className="font-serif text-[18px] font-bold text-ink leading-snug">
                  Credit Manager Wallet
                </h3>
                <p className="text-[12px] text-ink-soft mt-0.5">
                  Direct ledger test &amp; operational credit granted to sanctuary custodian.
                </p>
              </div>
              <button
                onClick={() => {
                  if (!creditingInProgress) setCreditingTarget(null)
                }}
                disabled={creditingInProgress}
                className="text-ink-faint hover:text-ink p-1 rounded hover:bg-paper-deep cursor-pointer"
              >
                <X size={17} />
              </button>
            </div>

            <form onSubmit={handleCreditSubmit} className="space-y-4 pt-4">
              {/* Manager Badge */}
              <div className="p-3 bg-paper rounded-lg border border-line text-[12.5px] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-ink">{creditingTarget.managerName}</span>
                  <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-paper-deep border border-line text-ink-soft">
                    {creditingTarget.managerId}
                  </span>
                </div>
                <div className="text-[11.5px] text-ink-faint font-mono">
                  {creditingTarget.managerEmail}
                </div>
                <div className="text-[11.5px] text-emerald-700 font-medium">
                  Shelter: {creditingTarget.gosalaName}
                </div>
              </div>

              {/* Amount */}
              <div className="space-y-1.5">
                <label className="block text-[12px] font-semibold text-ink uppercase tracking-wider font-mono">
                  Credit Amount (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint font-semibold text-[15px]">
                    ₹
                  </span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={creditAmount}
                    onChange={(e) => setCreditAmount(e.target.value)}
                    required
                    disabled={creditingInProgress}
                    placeholder="Enter amount in ₹"
                    className="w-full pl-8 pr-4 py-2 bg-paper border border-line rounded-lg text-[15px] font-bold text-ink focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[500, 1000, 2500, 5000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setCreditAmount(String(amt))}
                      disabled={creditingInProgress}
                      className="px-2.5 py-1 rounded bg-paper border border-line text-[11px] font-mono text-ink-soft hover:text-emerald-700 hover:border-emerald-300 transition cursor-pointer"
                    >
                      +{inr(amt)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Purpose */}
              <div className="space-y-1.5">
                <label className="block text-[12px] font-semibold text-ink uppercase tracking-wider font-mono">
                  Credit Purpose
                </label>
                <select
                  value={creditPurpose}
                  onChange={(e) => setCreditPurpose(e.target.value)}
                  disabled={creditingInProgress}
                  className="w-full px-3 py-2 bg-paper border border-line rounded-lg text-[12.5px] font-medium text-ink focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="OPERATIONAL_TEST">Operational Test Credit (Testing End-to-End Flow)</option>
                  <option value="ADJUSTMENT">Super Admin Ledger Adjustment</option>
                  <option value="PUJA_COMMISSION">Manual Seva Commission Settlement</option>
                  <option value="INCENTIVE">Gaushala Custodian Performance Incentive</option>
                </select>
              </div>

              {/* Note / Description */}
              <div className="space-y-1.5">
                <label className="block text-[12px] font-semibold text-ink uppercase tracking-wider font-mono">
                  Description / Audit Memo
                </label>
                <input
                  type="text"
                  value={creditNote}
                  onChange={(e) => setCreditNote(e.target.value)}
                  disabled={creditingInProgress}
                  placeholder="e.g. Test credit granted by Super Admin"
                  className="w-full px-3 py-2 bg-paper border border-line rounded-lg text-[12.5px] text-ink focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-line flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setCreditingTarget(null)}
                  disabled={creditingInProgress}
                  className="px-4 py-2 text-[12.5px] text-ink-soft hover:text-ink border border-line rounded-md hover:bg-paper-deep transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creditingInProgress}
                  className="inline-flex items-center gap-1.5 px-5 py-2 text-[12.5px] font-semibold rounded-md bg-emerald-700 hover:bg-emerald-800 text-white transition cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {creditingInProgress ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Crediting...</span>
                    </>
                  ) : (
                    <>
                      <Coins size={14} />
                      <span>Grant Credit</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
