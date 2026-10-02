import { inr, type Settlement } from "../data/mock"
import { useStore } from "../store/store"
import { Panel, PanelHead, Tag } from "../lib/ui"

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
  const { settlements, advanceSettlement, approveSettlementBatch } = useStore()

  const advance = (gosala: string) => advanceSettlement(gosala)

  const approveBatch = () => approveSettlementBatch("SEP-W4")

  const totalPayable = settlements.reduce(
    (a, s) => a + Math.round(s.gross * (1 - s.commissionPct / 100)),
    0,
  )
  const totalCommission = settlements.reduce(
    (a, s) => a + Math.round(s.gross * (s.commissionPct / 100)),
    0,
  )

  return (
    <div className="space-y-6">
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
                className="bg-forest text-white rounded-sm px-3.5 py-2 text-[12.5px] font-medium hover:opacity-90 transition-opacity cursor-pointer"
              >
                Approve batch SEP-W4
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
                              className="shrink-0 text-[11.5px] font-medium text-forest hover:underline whitespace-nowrap cursor-pointer"
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
    </div>
  )
}
