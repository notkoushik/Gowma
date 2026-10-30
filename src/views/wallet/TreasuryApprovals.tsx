import { useCallback, useEffect, useMemo, useState } from "react"
import { Check, Clock, DatabaseZap, RefreshCw, ShieldAlert, ShieldCheck, X } from "lucide-react"
import { Panel, PanelHead } from "../../lib/ui"
import { useToast } from "../../store/store"
import AuditLogPanel from "./AuditLogPanel"
import {
  dateOnly,
  dateTime,
  money,
  walletApi,
  type Reconciliation,
  type SettlementRow,
  type SettlementStatus,
  type SplitPolicyView,
  type Treasury,
} from "../../services/commissionWalletApi"

const tabs: { id: SettlementStatus | "ALL"; label: string }[] = [
  { id: "READY_FOR_APPROVAL", label: "Ready to approve" },
  { id: "HELD", label: "Waiting (under 2 days)" },
  { id: "REJECTED", label: "Rejected" },
  { id: "RELEASED", label: "Released" },
  { id: "REFUNDED", label: "Refunded" },
]

const inputCls = "border border-line-strong bg-white rounded-sm px-3 py-2 text-[14px] text-ink focus:outline-none focus:border-saffron"

function Stat({ label, value, hint, tone = "text-ink" }: { label: string; value: number; hint: string; tone?: string }) {
  return (
    <div className="bg-card border border-line rounded-sm p-4 min-w-0">
      <div className="text-[11px] uppercase tracking-wider text-ink-faint">{label}</div>
      <div className={`mt-1 font-mono text-[22px] leading-tight tabular-nums ${tone}`}>{money(value)}</div>
      <div className="text-[12px] text-ink-faint mt-1">{hint}</div>
    </div>
  )
}

export default function TreasuryApprovals() {
  const { notify } = useToast()
  const [treasury, setTreasury] = useState<Treasury | null>(null)
  const [rows, setRows] = useState<SettlementRow[]>([])
  const [tab, setTab] = useState<SettlementStatus>("READY_FOR_APPROVAL")
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [recon, setRecon] = useState<Reconciliation | null>(null)
  const [noteFor, setNoteFor] = useState<{ row: SettlementRow; kind: "reject" | "refund" } | null>(null)
  const [note, setNote] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [t, s] = await Promise.all([walletApi.treasury(), walletApi.settlements(tab)])
      setTreasury(t)
      setRows(s.settlements)
      setPicked(new Set())
      setError("")
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [tab])
  useEffect(() => {
    void load()
  }, [load])

  const count = (st: SettlementStatus) => treasury?.byStatus.find((b) => b.status === st)?.count ?? 0
  const selectable = rows.filter((r) => r.status === "READY_FOR_APPROVAL" && r.bookingStatus !== "REJECTED" && r.bookingStatus !== "CANCELLED")
  const pickedRows = rows.filter((r) => picked.has(r.id))
  const pickedTotals = useMemo(
    () => pickedRows.reduce((a, r) => ({ gross: a.gross + r.grossRupees, platform: a.platform + r.platformRupees, tax: a.tax + r.taxRupees, admin: a.admin + r.adminRupees, manager: a.manager + r.managerRupees }), { gross: 0, platform: 0, tax: 0, admin: 0, manager: 0 }),
    [pickedRows],
  )

  async function approve(ids: string[]) {
    setBusy(true)
    try {
      const r = await walletApi.approve(ids)
      if (r.released.length) notify(`${r.released.length} settlement(s) released to wallets`, "success")
      if (r.failed.length) notify(r.failed[0].error + (r.failed.length > 1 ? ` (+${r.failed.length - 1} more)` : ""), "warn")
    } catch (e: any) {
      notify(e.message, "warn")
    } finally {
      setBusy(false)
      void load()
    }
  }

  if (error && !treasury) {
    return (
      <Panel className="p-6">
        <p className="text-danger text-[14px]">{error}</p>
        <button onClick={load} className="mt-3 text-[13px] text-saffron-deep underline">Try again</button>
      </Panel>
    )
  }

  return (
    <div className="space-y-5 min-w-0">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-serif text-[24px] text-ink">Treasury and approvals</h2>
          <p className="text-[13px] text-ink-faint">Customer payments are held in escrow. {treasury?.delayDays ?? 2} days after payment you approve each one, and it is split into the wallets.</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-1.5 border border-line rounded-sm px-3 py-2 text-[13px] text-ink-soft hover:bg-paper-deep">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {treasury?.payoutMode === "SANDBOX" && (
        <div className="border border-warn bg-warn-soft text-warn rounded-sm px-4 py-2.5 text-[12.5px]">
          <b>Payouts are in test mode.</b> {treasury.payoutModeNote}
        </div>
      )}

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Stat label="Escrow" value={treasury?.escrowRupees ?? 0} hint="Customer money not yet released" tone="text-warn" />
        <Stat label="Platform commission" value={treasury?.platformRupees ?? 0} hint={`${treasury?.platformPct ?? 10}% of the pre-tax amount`} tone="text-forest" />
        <Stat label="Tax collected" value={treasury?.taxRupees ?? 0} hint="Kept by you in full" tone="text-forest" />
        <Stat label="Withdrawals in flight" value={treasury?.withdrawalHoldRupees ?? 0} hint="Being paid to banks now" tone="text-info" />
      </div>

      <Panel>
        <PanelHead
          title="Settlements"
          desc="Approve to release escrow into tax, platform, admin and manager wallets in one step"
          right={
            tab === "READY_FOR_APPROVAL" ? (
              <button
                disabled={busy || picked.size === 0}
                onClick={() => approve([...picked])}
                className="inline-flex items-center gap-1.5 bg-forest text-white rounded-sm px-4 py-2 text-[13px] font-medium disabled:opacity-40"
              >
                <Check size={14} /> Approve {picked.size || ""} selected
              </button>
            ) : undefined
          }
        />
        <div className="flex flex-wrap gap-1.5 px-5 pt-3">
          {tabs.map((t) => {
            const n = t.id === "ALL" ? 0 : count(t.id)
            return (
              <button key={t.id} onClick={() => setTab(t.id as SettlementStatus)} className={`rounded-sm px-3 py-1.5 text-[12.5px] ${tab === t.id ? "bg-saffron-soft text-saffron-deep font-medium" : "text-ink-soft hover:bg-paper-deep"}`}>
                {t.label} <span className="font-mono text-[11px] opacity-70">{n}</span>
              </button>
            )
          })}
        </div>

        {picked.size > 0 && (
          <div className="mx-5 mt-3 grid grid-cols-2 sm:grid-cols-5 gap-2 text-[12px] bg-paper-deep rounded-sm p-3 font-mono tabular-nums">
            <div><span className="text-ink-faint block text-[10.5px] uppercase">Escrow out</span>{money(pickedTotals.gross)}</div>
            <div><span className="text-ink-faint block text-[10.5px] uppercase">Tax</span>{money(pickedTotals.tax)}</div>
            <div><span className="text-ink-faint block text-[10.5px] uppercase">Platform</span>{money(pickedTotals.platform)}</div>
            <div><span className="text-ink-faint block text-[10.5px] uppercase">Admin wallets</span>{money(pickedTotals.admin)}</div>
            <div><span className="text-ink-faint block text-[10.5px] uppercase">Manager wallets</span>{money(pickedTotals.manager)}</div>
          </div>
        )}

        <div className="overflow-x-auto mt-3">
          <table className="w-full text-[13px] min-w-[860px]">
            <thead className="text-left text-[11px] uppercase tracking-wider text-ink-faint">
              <tr>
                <th className="px-5 py-2 w-8">
                  {tab === "READY_FOR_APPROVAL" && (
                    <input
                      type="checkbox"
                      aria-label="Select all"
                      checked={selectable.length > 0 && picked.size === selectable.length}
                      onChange={(e) => setPicked(e.target.checked ? new Set(selectable.map((r) => r.id)) : new Set())}
                    />
                  )}
                </th>
                <th className="px-2 py-2 font-medium">Booking</th>
                <th className="px-2 py-2 font-medium">Paid / due</th>
                <th className="px-2 py-2 font-medium text-right">Paid</th>
                <th className="px-2 py-2 font-medium text-right">Tax</th>
                <th className="px-2 py-2 font-medium text-right">Platform</th>
                <th className="px-2 py-2 font-medium text-right">Admin</th>
                <th className="px-2 py-2 font-medium text-right">Manager</th>
                <th className="px-5 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={9} className="px-5 py-6 text-ink-faint">{loading ? "Loading…" : "Nothing here."}</td></tr>
              )}
              {rows.map((r) => {
                const blocked = r.bookingStatus === "REJECTED" || r.bookingStatus === "CANCELLED"
                return (
                  <tr key={r.id} className="border-t border-line align-top">
                    <td className="px-5 py-2">
                      {r.status === "READY_FOR_APPROVAL" && !blocked && (
                        <input
                          type="checkbox"
                          aria-label={`Select ${r.bookingId}`}
                          checked={picked.has(r.id)}
                          onChange={(e) => {
                            const next = new Set(picked)
                            e.target.checked ? next.add(r.id) : next.delete(r.id)
                            setPicked(next)
                          }}
                        />
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <div className="font-mono text-[12px]">{r.bookingId}</div>
                      <div className="text-[11.5px] text-ink-faint">{r.gosalaName}{r.customerName ? ` · ${r.customerName}` : ""}</div>
                      {r.bookingStatus && <div className={`text-[11px] ${blocked ? "text-danger" : "text-ink-faint"}`}>Booking: {r.bookingStatus.replace(/_/g, " ").toLowerCase()}</div>}
                      {r.decisionNote && <div className="text-[11px] text-ink-faint">“{r.decisionNote}”</div>}
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      <div>{dateOnly(r.paidAt)}</div>
                      <div className="text-[11.5px] text-ink-faint inline-flex items-center gap-1"><Clock size={11} /> {dateOnly(r.eligibleAt)}</div>
                    </td>
                    <td className="px-2 py-2 text-right font-mono tabular-nums">{money(r.grossRupees)}</td>
                    <td className="px-2 py-2 text-right font-mono tabular-nums">{money(r.taxRupees)}</td>
                    <td className="px-2 py-2 text-right font-mono tabular-nums">{money(r.platformRupees)}<div className="text-[10.5px] text-ink-faint">{r.platformPct}%</div></td>
                    <td className="px-2 py-2 text-right font-mono tabular-nums">{money(r.adminRupees)}<div className="text-[10.5px] text-ink-faint">{r.adminPct}%</div></td>
                    <td className="px-2 py-2 text-right font-mono tabular-nums">{money(r.managerRupees)}<div className="text-[10.5px] text-ink-faint">{r.managerPct}%</div></td>
                    <td className="px-5 py-2 text-right whitespace-nowrap">
                      {r.status === "READY_FOR_APPROVAL" && !blocked && (
                        <button disabled={busy} onClick={() => approve([r.id])} className="text-ok text-[12.5px] mr-3 disabled:opacity-40">Approve</button>
                      )}
                      {(r.status === "READY_FOR_APPROVAL" || r.status === "HELD") && (
                        <button onClick={() => { setNoteFor({ row: r, kind: "reject" }); setNote("") }} className="text-warn text-[12.5px] mr-3">Reject</button>
                      )}
                      {(r.status === "READY_FOR_APPROVAL" || r.status === "HELD" || r.status === "REJECTED") && (
                        <button onClick={() => { setNoteFor({ row: r, kind: "refund" }); setNote("") }} className="text-danger text-[12.5px]">Refund</button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <SplitControls onChanged={load} platformPct={treasury?.platformPct ?? 10} />

      <Panel>
        <PanelHead
          title="Books and tools"
          desc="Check that every balance matches its entries, and import bookings that were paid before wallets existed"
        />
        <div className="px-5 py-4 flex flex-wrap items-center gap-3">
          <button
            onClick={async () => {
              try {
                setRecon(await walletApi.reconciliation())
              } catch (e: any) {
                notify(e.message, "warn")
              }
            }}
            className="inline-flex items-center gap-1.5 border border-line rounded-sm px-3 py-2 text-[13px] text-ink-soft hover:bg-paper-deep"
          >
            <ShieldCheck size={14} /> Run reconciliation
          </button>
          <button
            onClick={async () => {
              try {
                const r = await walletApi.backfill()
                notify(`Checked ${r.scanned} paid bookings, added ${r.created} to escrow`, "success")
                void load()
              } catch (e: any) {
                notify(e.message, "warn")
              }
            }}
            className="inline-flex items-center gap-1.5 border border-line rounded-sm px-3 py-2 text-[13px] text-ink-soft hover:bg-paper-deep"
          >
            <DatabaseZap size={14} /> Import earlier paid bookings
          </button>
          {recon && (
            <span className={`inline-flex items-center gap-1.5 text-[13px] ${recon.healthy ? "text-ok" : "text-danger"}`}>
              {recon.healthy ? <ShieldCheck size={14} /> : <ShieldAlert size={14} />}
              {recon.healthy
                ? `Books agree. Escrow ${money(recon.escrow.balanceRupees)} equals unreleased settlements.`
                : `Mismatch found: ${recon.walletMismatches.length} wallet(s), ${recon.unbalancedGroups.length} group(s), escrow ${money(recon.escrow.balanceRupees)} vs ${money(recon.escrow.waitingSettlementsRupees)}.`}
            </span>
          )}
        </div>
      </Panel>

      <AuditLogPanel />

      {noteFor && (
        <div className="fixed inset-0 z-50 bg-ink/50 flex items-center justify-center p-4" role="dialog" aria-modal="true" onClick={() => setNoteFor(null)}>
          <div className="bg-card border border-line rounded-sm w-full max-w-md p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-serif text-[18px] text-ink">{noteFor.kind === "reject" ? "Reject settlement" : "Refund customer"} · {noteFor.row.bookingId}</h3>
            <p className="text-[13px] text-ink-soft">
              {noteFor.kind === "reject"
                ? "The money stays in escrow. You can approve or refund it later."
                : `${money(noteFor.row.grossRupees)} goes back to the customer's wallet and no one else is paid.`}
            </p>
            <input className={`${inputCls} w-full`} placeholder="Reason (required)" value={note} onChange={(e) => setNote(e.target.value)} autoFocus />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setNoteFor(null)} className="border border-line rounded-sm px-4 py-2 text-[13px] text-ink-soft">Cancel</button>
              <button
                disabled={!note.trim()}
                onClick={async () => {
                  try {
                    if (noteFor.kind === "reject") await walletApi.reject(noteFor.row.id, note)
                    else await walletApi.refund(noteFor.row.id, note)
                    notify(noteFor.kind === "reject" ? "Settlement rejected" : "Customer refunded", "success")
                    setNoteFor(null)
                    void load()
                  } catch (e: any) {
                    notify(e.message, "warn")
                  }
                }}
                className="bg-danger text-white rounded-sm px-4 py-2 text-[13px] font-medium disabled:opacity-40 inline-flex items-center gap-1.5"
              >
                <X size={14} /> {noteFor.kind === "reject" ? "Reject" : "Refund"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** Platform percentage, default manager share, and the admins' pending change requests. */
function SplitControls({ platformPct, onChanged }: { platformPct: number; onChanged: () => void }) {
  const { notify } = useToast()
  const [view, setView] = useState<SplitPolicyView | null>(null)
  const [plat, setPlat] = useState(String(platformPct))
  const [defMgr, setDefMgr] = useState("")
  const [declineNote, setDeclineNote] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    try {
      const v = await walletApi.splitPolicy()
      setView(v)
      setDefMgr(String(v.defaultManagerPct))
      setPlat(String(v.platformPct))
    } catch {
      setView(null)
    }
  }, [])
  useEffect(() => { void load() }, [load])
  if (!view) return null
  const pending = view.requests.filter((r) => r.status === "PENDING")

  return (
    <Panel>
      <PanelHead title="Commission and manager share" desc="You fix the platform commission. The Operations Admin proposes the manager share per gaushala and you approve it." />
      <div className="px-5 py-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-[12px] text-ink-soft mb-1" htmlFor="plat-pct">Platform commission (% of pre-tax amount)</label>
          <div className="flex gap-2">
            <input id="plat-pct" className={`${inputCls} w-28`} inputMode="decimal" value={plat} onChange={(e) => setPlat(e.target.value)} />
            <button
              onClick={async () => {
                try {
                  await walletApi.setPlatformPct(Number(plat))
                  notify("Platform commission updated. It applies to bookings paid from now on.", "success")
                  void load()
                  onChanged()
                } catch (e: any) {
                  notify(e.message, "warn")
                }
              }}
              className="bg-forest text-white rounded-sm px-4 text-[13px]"
            >
              Save
            </button>
          </div>
          <p className="text-[11.5px] text-ink-faint mt-1">Tax is separate and is always kept by you in full.</p>
        </div>
        <div>
          <label className="block text-[12px] text-ink-soft mb-1" htmlFor="def-mgr">Default manager share (%)</label>
          <div className="flex gap-2">
            <input id="def-mgr" className={`${inputCls} w-28`} inputMode="decimal" value={defMgr} onChange={(e) => setDefMgr(e.target.value)} />
            <button
              onClick={async () => {
                try {
                  await walletApi.setPolicy("DEFAULT", Number(defMgr))
                  notify("Default manager share updated", "success")
                  void load()
                } catch (e: any) {
                  notify(e.message, "warn")
                }
              }}
              className="border border-line rounded-sm px-4 text-[13px] text-ink-soft hover:bg-paper-deep"
            >
              Save
            </button>
          </div>
          <p className="text-[11.5px] text-ink-faint mt-1">Used for gaushalas with no approved percentage of their own.</p>
        </div>
      </div>

      <div className="border-t border-line">
        <div className="px-5 py-2 text-[11px] uppercase tracking-wider text-ink-faint">Waiting for your decision ({pending.length})</div>
        {pending.length === 0 && <div className="px-5 pb-4 text-[13px] text-ink-faint">No change requests.</div>}
        {pending.map((r) => (
          <div key={r.id} className="px-5 py-3 border-t border-line flex flex-wrap items-center gap-x-6 gap-y-2">
            <div className="min-w-0 flex-1 basis-60">
              <div className="text-[13.5px] text-ink">{r.gosalaName}: manager {r.currentManagerPct}% → <b>{r.proposedManagerPct}%</b></div>
              <div className="text-[12px] text-ink-faint">Requested by {r.requestedByName} on {dateTime(r.createdAt)}{r.reason ? ` · “${r.reason}”` : ""}</div>
            </div>
            <input className={`${inputCls} w-44`} placeholder="Note (optional)" value={declineNote[r.id] || ""} onChange={(e) => setDeclineNote({ ...declineNote, [r.id]: e.target.value })} />
            {(["approve", "decline"] as const).map((k) => (
              <button
                key={k}
                onClick={async () => {
                  try {
                    await walletApi.decideSplit(r.id, k === "approve", declineNote[r.id])
                    notify(k === "approve" ? "Approved. New bookings use it." : "Request declined", "success")
                    void load()
                  } catch (e: any) {
                    notify(e.message, "warn")
                  }
                }}
                className={k === "approve" ? "bg-ok text-white rounded-sm px-4 py-2 text-[13px]" : "border border-line rounded-sm px-4 py-2 text-[13px] text-ink-soft"}
              >
                {k === "approve" ? "Approve" : "Decline"}
              </button>
            ))}
          </div>
        ))}
      </div>
    </Panel>
  )
}
