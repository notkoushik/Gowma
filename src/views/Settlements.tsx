import { useState } from "react"
import { inr, type Settlement } from "../data/mock"
import { useStore } from "../store/store"
import { Panel, PanelHead, Tag } from "../lib/ui"
import {
  Crown,
  ShieldCheck,
  Landmark,
  Zap,
  RefreshCw,
  CheckCircle2,
  Clock,
  X,
  ArrowUpRight,
  Send,
} from "lucide-react"

const nextStatus: Record<Settlement["status"], Settlement["status"]> = {
  Pending: "Approved",
  Approved: "Processing",
  Processing: "Paid",
  Paid: "Paid",
  Failed: "Approved",
}

const stageOrder: Settlement["status"][] = [
  "Pending",
  "Approved",
  "Processing",
  "Paid",
]

function SettleStatus({ s }: { s: Settlement["status"] }) {
  if (s === "Failed") return <Tag tone="danger">Failed</Tag>
  const idx = stageOrder.indexOf(s)
  return (
    <div className="flex items-center gap-1.5">
      {stageOrder.map((st, i) => (
        <div key={st} className="flex items-center gap-1.5">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              i <= idx ? "bg-forest" : "bg-line-strong"
            }`}
          />
          {i < stageOrder.length - 1 && (
            <span
              className={`h-px w-4 ${i < idx ? "bg-forest" : "bg-line-strong"}`}
            />
          )}
        </div>
      ))}
      <span className="ml-2 text-[12px] text-ink-soft font-medium">{s}</span>
    </div>
  )
}

export default function Settlements() {
  const {
    settlements,
    advanceSettlement,
    approveSettlementBatch,
    executeSettlementSweep,
    settlementSchedule,
    currentRole,
    pricingConfig,
    profiles,
  } = useStore()
  const isSuperAdmin = currentRole === "super_admin"
  const defaultCommPct = pricingConfig?.commissionPct ?? 20
  const defaultGaushalaPct = 100 - defaultCommPct

  const [isSweeping, setIsSweeping] = useState(false)
  const [sweepModalOpen, setSweepModalOpen] = useState(false)

  const advance = (gosala: string) => {
    if (!isSuperAdmin) return
    advanceSettlement(gosala)
  }

  const approveBatch = () => {
    if (!isSuperAdmin) return
    approveSettlementBatch("SEP-W4")
  }

  const handleRunImmediateSweep = async () => {
    if (!isSuperAdmin) return
    setIsSweeping(true)
    try {
      await executeSettlementSweep()
      setSweepModalOpen(false)
    } catch (err) {
      console.error(err)
    } finally {
      setIsSweeping(false)
    }
  }

  const totalGrossAmount = settlements.reduce((a, s) => a + s.gross, 0)
  const totalCommission = settlements.reduce(
    (a, s) => a + Math.round(s.gross * (s.commissionPct / 100)),
    0,
  )
  const totalPayable = settlements.reduce(
    (a, s) => a + (s.gross - Math.round(s.gross * (s.commissionPct / 100))),
    0,
  )

  // Target bank details from Super Admin / Manager profile
  const superAdminBank = profiles?.super_admin?.bankDetails
  const managerBank = profiles?.manager?.bankDetails
  const activeTargetBank = superAdminBank?.accountNumber
    ? superAdminBank
    : managerBank?.accountNumber
      ? managerBank
      : {
          accountBeneficiary: "Koushik Botcha",
          bankName: "Andhra Bank",
          branchName: "Hitec City",
          accountNumber: "•••• •••• •••• 4414",
          ifscCode: "HDFC2342523",
        }

  return (
    <div className="space-y-6">
      {/* Super Admin Captain Disbursement Authority & Auto-Sweep Controller */}
      <div className="rounded-sm border border-amber-300/80 bg-linear-to-r from-amber-50 via-amber-100/50 to-amber-50/20 p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-start gap-3.5">
            <div className="h-10 w-10 rounded-sm bg-gradient-to-br from-amber-500 to-amber-700 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Crown size={20} className="stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-serif text-[17px] font-semibold text-amber-950">
                  Treasury Payout & Disbursement Authority
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-600 text-white shadow-2xs">
                  <ShieldCheck size={11} /> Super Admin Captain
                </span>
              </div>
              <p className="text-[12px] text-amber-900/80 mt-1 max-w-2xl leading-relaxed">
                Only the Super Admin holds financial disbursement authority to release funds from escrow, approve batch payouts,
                and enforce the platform {defaultGaushalaPct}/{defaultCommPct} split between trust accounts and Gaushala trusts.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
            <div className="flex items-center gap-2 bg-white/95 border border-amber-200/80 rounded px-3 py-1.5 text-[11px] font-mono text-ink shadow-2xs">
              <Landmark size={13} className="text-forest shrink-0" />
              <span>Escrow: <strong className="text-forest font-semibold">ICICI Nodal Trust</strong></span>
            </div>

            {isSuperAdmin && (
              <button
                type="button"
                onClick={() => setSweepModalOpen(true)}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded bg-forest hover:bg-forest-deep text-white text-[12px] font-semibold transition cursor-pointer shadow-xs active:scale-[0.98]"
              >
                <Zap size={14} className="fill-amber-300 text-amber-300" />
                <span>Run Immediate Auto-Sweep</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Automated Settlement Schedule Controller Card */}
      <div className="rounded-xl border border-line bg-card p-4.5 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <h4 className="font-serif text-[15px] font-bold text-ink">
                Automated Settlement Sweep Engine
              </h4>
              <span className="text-[10.5px] font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold border border-emerald-200">
                Continuous T+1 Auto-Sweep
              </span>
            </div>
            <p className="text-[12px] text-ink-soft">
              Real-time sweep daemon processes escrow releases into verified Gaushala accounts via direct RBI RTGS/NEFT routing with zero manual lag.
            </p>
          </div>

          <div className="flex items-center gap-4 text-[12px] font-mono text-ink-soft divide-x divide-line pt-2 md:pt-0">
            <div>
              <span className="text-[10px] uppercase text-ink-faint block">Target Beneficiary</span>
              <strong className="text-ink font-medium">{activeTargetBank.accountBeneficiary}</strong>
            </div>
            <div className="pl-4">
              <span className="text-[10px] uppercase text-ink-faint block">Destination Bank</span>
              <span className="text-ink font-medium">{activeTargetBank.bankName}</span>
            </div>
            <div className="pl-4">
              <span className="text-[10px] uppercase text-ink-faint block">IFSC Code</span>
              <span className="text-forest font-bold">{activeTargetBank.ifscCode}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          [
            "Total gross settled",
            inr(settlements.reduce((a, s) => a + s.gross, 0)),
            `${settlements.length} Gosalas · Verified batches`,
          ],
          ["GOMAA commission", inr(totalCommission), "Snapshot at booking"],
          ["Gosala payable", inr(totalPayable), "After deductions"],
        ].map(([label, val, sub]) => (
          <Panel key={label} className="p-5">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink-faint">
              {label}
            </div>
            <div className="font-serif text-[28px] text-ink mt-2 tabular">
              {val}
            </div>
            <div className="text-[12px] text-ink-faint mt-1">{sub}</div>
          </Panel>
        ))}
      </div>

      <Panel>
        <PanelHead
          title="Gosala settlement workflow"
          desc="Pending → Approved → Processing → Paid / Failed"
          right={
            settlements.length > 0 ? (
              <button
                onClick={approveBatch}
                disabled={!isSuperAdmin}
                className={`rounded-sm px-3.5 py-2 text-[12.5px] font-medium transition-opacity ${
                  isSuperAdmin
                    ? "bg-forest text-white hover:opacity-90 cursor-pointer shadow-2xs"
                    : "bg-paper-deep text-ink-faint border border-line cursor-not-allowed opacity-60"
                }`}
              >
                {isSuperAdmin ? "Approve batch SEP-W4" : "Captain Approval Required"}
              </button>
            ) : null
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[860px]">
            <thead>
              <tr>
                {[
                  "Gosala",
                  "Batch",
                  "Bookings",
                  "Gross",
                  "Commission",
                  "Payable",
                  "Settlement status",
                ].map((h) => (
                  <th
                    key={h}
                    className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-faint font-medium px-5 py-3 border-b border-line text-left"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {settlements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-ink-faint">
                    <div className="max-w-sm mx-auto space-y-1.5">
                      <p className="font-serif text-[17px] text-ink font-medium">
                        No pending settlement batches
                      </p>
                      <p className="text-[12px] text-ink-soft">
                        Settlement batches are calculated automatically when devotee ceremonial bookings reach Completed status.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                settlements.map((s) => {
                  const comm = Math.round(s.gross * (s.commissionPct / 100))
                  return (
                    <tr
                      key={s.gosala}
                      className="border-b border-line/70 hover:bg-paper/70 transition-colors"
                    >
                      <td className="px-5 py-3.5 text-[13.5px] text-ink">
                        {s.gosala}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-[12px] text-ink-soft">
                        {s.batch}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-[13px] text-ink-soft tabular">
                        {s.bookings}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-[13px] text-ink tabular">
                        {inr(s.gross)}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-[13px] text-saffron-deep tabular">
                        − {inr(comm)}
                        <span className="text-ink-faint ml-1">
                          ({s.commissionPct}%)
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-[13px] text-forest tabular">
                        {inr(s.gross - comm)}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-between gap-3">
                          <SettleStatus s={s.status} />
                          {s.status !== "Paid" && (
                            <button
                              onClick={() => advance(s.gosala)}
                              disabled={!isSuperAdmin}
                              className={`shrink-0 text-[11.5px] font-medium whitespace-nowrap ${
                                isSuperAdmin
                                  ? "text-forest hover:underline cursor-pointer"
                                  : "text-ink-faint opacity-50 cursor-not-allowed"
                              }`}
                            >
                              {s.status === "Failed"
                                ? "Retry"
                                : `→ ${nextStatus[s.status]}`}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-line text-[11.5px] text-ink-faint">
          Commission and Gosala payable are stored as historical snapshots.
          Reversal and refund rules apply to cancellations and failed bookings.
        </div>
      </Panel>

      {/* Immediate Settlement Sweep Confirmation Modal */}
      {sweepModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-card rounded-2xl border border-line shadow-2xl max-w-lg w-full overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between px-6 py-4 bg-paper-deep/80 border-b border-line">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-forest/15 text-forest">
                  <Zap size={20} className="fill-forest" />
                </div>
                <div>
                  <h3 className="font-serif text-[17px] text-ink font-bold">
                    Authorize Instant Settlement Sweep
                  </h3>
                  <p className="text-[11.5px] text-ink-faint">
                    Direct RBI RTGS Escrow Sweep to Gaushala Accounts
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSweepModalOpen(false)}
                disabled={isSweeping}
                className="p-1.5 rounded-lg text-ink-faint hover:text-ink hover:bg-paper transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4 text-[13px]">
              <div className="p-4 rounded-xl bg-forest/5 border border-forest/20 space-y-2">
                <div className="flex justify-between">
                  <span className="text-ink-soft">Escrow Gross Volume:</span>
                  <strong className="font-mono text-ink text-[14px]">
                    {inr(totalGrossAmount || 45000)}
                  </strong>
                </div>
                <div className="flex justify-between text-saffron-deep">
                  <span>GOMAA Platform Fee ({defaultCommPct}%):</span>
                  <span className="font-mono">
                    −{inr(totalCommission || Math.round((totalGrossAmount || 45000) * (defaultCommPct / 100)))}
                  </span>
                </div>
                <div className="pt-2 border-t border-forest/20 flex justify-between font-bold text-forest text-[15px]">
                  <span>Total Net Disbursed ({defaultGaushalaPct}%):</span>
                  <span className="font-mono">
                    {inr(totalPayable || Math.round((totalGrossAmount || 45000) * (defaultGaushalaPct / 100)))}
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-paper border border-line space-y-1 text-[12px]">
                <div className="text-[10.5px] uppercase font-mono text-ink-faint">Target Beneficiary</div>
                <div className="font-bold text-ink">
                  {activeTargetBank.accountBeneficiary} ({activeTargetBank.bankName})
                </div>
                <div className="text-ink-soft font-mono">
                  A/C: {activeTargetBank.accountNumber} · IFSC: {activeTargetBank.ifscCode}
                </div>
              </div>

              <div className="text-[11.5px] text-ink-faint flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-forest shrink-0" />
                <span>
                  Disbursement is verified against ICICI Nodal Trust Escrow and generates an authentic RBI UTR code.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-paper-deep/80 border-t border-line">
              <button
                type="button"
                onClick={() => setSweepModalOpen(false)}
                disabled={isSweeping}
                className="px-4 py-2 text-[12.5px] font-semibold text-ink-soft hover:text-ink transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRunImmediateSweep}
                disabled={isSweeping}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-forest hover:bg-forest-deep text-white text-[13px] font-semibold transition cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isSweeping ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" />
                    <span>Executing RBI Sweep...</span>
                  </>
                ) : (
                  <>
                    <Send size={15} />
                    <span>Confirm & Disburse Now</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
