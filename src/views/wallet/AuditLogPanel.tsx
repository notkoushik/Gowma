import { useCallback, useEffect, useMemo, useState } from "react"
import { RefreshCw, ScrollText } from "lucide-react"
import { Panel, PanelHead } from "../../lib/ui"
import { dateTime, walletApi, type AuditEntry } from "../../services/commissionWalletApi"

const label: Record<string, string> = {
  SETTLEMENT_APPROVED: "Settlement approved",
  SETTLEMENT_REJECTED: "Settlement rejected",
  SETTLEMENT_REFUNDED: "Customer refunded",
  SETTLEMENTS_IMPORTED: "Earlier bookings imported",
  PLATFORM_PERCENT_CHANGED: "Platform commission changed",
  SPLIT_POLICY_SET: "Manager share set directly",
  SPLIT_CHANGE_REQUESTED: "Manager share change requested",
  SPLIT_CHANGE_APPROVED: "Manager share change approved",
  SPLIT_CHANGE_DECLINED: "Manager share change declined",
  PAYOUT_ACCOUNT_ADDED: "Payout account added",
  PAYOUT_ACCOUNT_REMOVED: "Payout account removed",
  WITHDRAWAL_CODE_SENT: "Withdrawal code sent",
  WITHDRAWAL_REQUESTED: "Withdrawal requested",
  WITHDRAWAL_PAID: "Withdrawal paid",
  WITHDRAWAL_FAILED: "Withdrawal failed",
}

const tone = (action: string) =>
  /FAILED|REJECTED|DECLINED|REMOVED|REFUNDED/.test(action)
    ? "bg-danger-soft text-danger"
    : /APPROVED|PAID|ADDED/.test(action)
      ? "bg-ok-soft text-ok"
      : "bg-info-soft text-info"

const roleName: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Operations Admin",
  manager: "Manager",
  customer: "Customer",
  system: "System",
}

function Details({ d }: { d: Record<string, unknown> | null }) {
  const pairs = Object.entries(d || {}).filter(([, v]) => v !== null && v !== undefined && v !== "")
  if (!pairs.length) return <span className="text-ink-faint">–</span>
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-0.5">
      {pairs.map(([k, v]) => (
        <span key={k} className="text-[12px] text-ink-soft">
          <span className="text-ink-faint">{k}:</span> {typeof v === "object" ? JSON.stringify(v) : String(v)}
        </span>
      ))}
    </div>
  )
}

/** Super Admin only. The server refuses this list to every other role. */
export default function AuditLogPanel() {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState("")
  const [action, setAction] = useState("")
  const [shown, setShown] = useState(25)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setEntries((await walletApi.auditLog()).entries)
      setError("")
    } catch (e: any) {
      setError(e.message || "Could not load the audit log")
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  const actions = useMemo(() => [...new Set((entries || []).map((e) => e.action))].sort(), [entries])
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return (entries || []).filter(
      (e) =>
        (!action || e.action === action) &&
        (!needle || `${e.actor} ${e.role} ${label[e.action] || e.action} ${e.targetId || ""} ${JSON.stringify(e.details || {})}`.toLowerCase().includes(needle)),
    )
  }, [entries, q, action])

  return (
    <Panel>
      <PanelHead
        title="Audit log"
        desc="Every approval, refund, percentage change, payout account and withdrawal, with who did it. Only you can see this."
        right={
          <button onClick={load} className="inline-flex items-center gap-1.5 border border-line rounded-sm px-3 py-1.5 text-[12.5px] text-ink-soft hover:bg-paper-deep" aria-label="Refresh audit log">
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        }
      />
      {error ? (
        <div className="px-5 py-4 text-[13px] text-danger">{error}</div>
      ) : (
        <>
          <div className="px-5 py-3 flex flex-wrap gap-2 border-b border-line">
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                setShown(25)
              }}
              placeholder="Search by person, booking or detail"
              aria-label="Search the audit log"
              className="flex-1 min-w-[200px] border border-line-strong bg-white rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:border-saffron"
            />
            <select
              value={action}
              onChange={(e) => {
                setAction(e.target.value)
                setShown(25)
              }}
              aria-label="Filter by action"
              className="border border-line-strong bg-white rounded-sm px-3 py-2 text-[13px]"
            >
              <option value="">All actions</option>
              {actions.map((a) => (
                <option key={a} value={a}>
                  {label[a] || a}
                </option>
              ))}
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] min-w-[760px]">
              <thead className="text-left text-[11px] uppercase tracking-wider text-ink-faint">
                <tr>
                  <th className="px-5 py-2 font-medium">When</th>
                  <th className="px-2 py-2 font-medium">Who</th>
                  <th className="px-2 py-2 font-medium">What</th>
                  <th className="px-2 py-2 font-medium">On</th>
                  <th className="px-5 py-2 font-medium">Details</th>
                </tr>
              </thead>
              <tbody>
                {entries === null && (
                  <tr>
                    <td colSpan={5} className="px-5 py-5 text-ink-faint">Loading…</td>
                  </tr>
                )}
                {entries !== null && filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-5 text-ink-faint">
                      <span className="inline-flex items-center gap-2">
                        <ScrollText size={14} /> {entries.length ? "Nothing matches that search." : "No activity recorded yet."}
                      </span>
                    </td>
                  </tr>
                )}
                {filtered.slice(0, shown).map((e) => (
                  <tr key={e.id} className="border-t border-line align-top">
                    <td className="px-5 py-2 whitespace-nowrap">{dateTime(e.at)}</td>
                    <td className="px-2 py-2">
                      <div>{e.actor}</div>
                      <div className="text-[11.5px] text-ink-faint">{roleName[e.role] || e.role}</div>
                    </td>
                    <td className="px-2 py-2">
                      <span className={`inline-block rounded-sm px-2 py-0.5 text-[11.5px] font-medium ${tone(e.action)}`}>{label[e.action] || e.action}</span>
                    </td>
                    <td className="px-2 py-2 font-mono text-[11.5px] break-all max-w-[200px]">{e.targetId ? `${e.targetType} ${e.targetId.slice(0, 18)}` : e.targetType}</td>
                    <td className="px-5 py-2">
                      <Details d={e.details} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length > shown && (
            <div className="px-5 py-3 border-t border-line">
              <button onClick={() => setShown(shown + 50)} className="text-[13px] text-saffron-deep">
                Show more ({filtered.length - shown} left)
              </button>
            </div>
          )}
        </>
      )}
    </Panel>
  )
}
