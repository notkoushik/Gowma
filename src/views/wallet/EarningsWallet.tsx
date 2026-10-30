import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowDownToLine, Clock, Landmark, Plus, RefreshCw, ShieldCheck, Smartphone, Trash2 } from "lucide-react"
import { Panel, PanelHead } from "../../lib/ui"
import { useToast } from "../../store/store"
import {
  dateOnly,
  dateTime,
  money,
  walletApi,
  type MyWallet,
  type PayoutAccount,
  type SplitPolicyView,
} from "../../services/commissionWalletApi"

const purposeLabel: Record<string, string> = {
  SETTLEMENT_RELEASE: "Booking earnings",
  WITHDRAWAL_HOLD: "Withdrawal",
  WITHDRAWAL_REVERSAL: "Withdrawal returned",
  ADJUSTMENT: "Adjustment",
}

const statusTone: Record<string, string> = {
  PAID: "bg-ok-soft text-ok",
  PROCESSING: "bg-warn-soft text-warn",
  FAILED: "bg-danger-soft text-danger",
  HELD: "bg-warn-soft text-warn",
  READY_FOR_APPROVAL: "bg-info-soft text-info",
}
const statusText: Record<string, string> = {
  PAID: "Paid",
  PROCESSING: "On its way",
  FAILED: "Failed, returned",
  HELD: "Waiting for T+2",
  READY_FOR_APPROVAL: "Awaiting approval",
}

function Chip({ status }: { status: string }) {
  return <span className={`inline-block rounded-sm px-2 py-0.5 text-[11px] font-medium ${statusTone[status] || "bg-paper-deep text-ink-soft"}`}>{statusText[status] || status}</span>
}

function Balance({ label, value, hint, tone }: { label: string; value: number; hint: string; tone: string }) {
  return (
    <div className="bg-card border border-line rounded-sm p-4 min-w-0">
      <div className="text-[11px] uppercase tracking-wider text-ink-faint">{label}</div>
      <div className={`mt-1 font-mono text-[24px] leading-tight tabular-nums ${tone}`}>{money(value)}</div>
      <div className="text-[12px] text-ink-faint mt-1">{hint}</div>
    </div>
  )
}

export default function EarningsWallet({ role }: { role: "admin" | "manager" }) {
  const { notify } = useToast()
  const [data, setData] = useState<MyWallet | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [showWithdraw, setShowWithdraw] = useState(false)
  const [showAccount, setShowAccount] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await walletApi.me()
      setData(d)
      setError("")
    } catch (e: any) {
      setError(e.message || "Could not load your wallet")
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  if (error && !data) {
    return (
      <Panel className="p-6">
        <p className="text-danger text-[14px]">{error}</p>
        <button onClick={load} className="mt-3 text-[13px] text-saffron-deep underline">Try again</button>
      </Panel>
    )
  }
  if (!data) return <Panel className="p-6 text-ink-faint text-[14px]">Loading your wallet…</Panel>

  return (
    <div className="space-y-5 min-w-0">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-serif text-[24px] text-ink">My wallet</h2>
          <p className="text-[13px] text-ink-faint">
            Your share of each booking arrives here {data.delayDays} days after the customer pays, once the Super Admin approves it.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="inline-flex items-center gap-1.5 border border-line rounded-sm px-3 py-2 text-[13px] text-ink-soft hover:bg-paper-deep" aria-label="Refresh">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
          <button
            onClick={() => setShowWithdraw(true)}
            disabled={data.availableRupees < 1 || data.accounts.length === 0}
            className="inline-flex items-center gap-1.5 bg-forest text-white rounded-sm px-4 py-2 text-[13px] font-medium disabled:opacity-40"
          >
            <ArrowDownToLine size={14} /> Withdraw
          </button>
        </div>
      </div>

      <div className={`rounded-sm px-4 py-2.5 text-[12.5px] border ${data.earnsFrom.length ? "border-line bg-card text-ink-soft" : "border-warn bg-warn-soft text-warn"}`}>
        {data.earnsFrom.length ? (
          <>You earn from: <b className="text-ink">{data.earnsFrom.join(", ")}</b>. Money from bookings at other gaushalas does not arrive in this wallet.</>
        ) : (
          <>
            <b>This account is not linked to any gaushala, so no earnings can arrive here.</b>{" "}
            {role === "admin"
              ? "A gaushala pays its Operations Admin only when that gaushala has you set as its admin."
              : "A gaushala pays its Manager only when you are assigned to it as an active manager."}{" "}
            Ask the Super Admin to assign you, or log in with the account that is assigned.
          </>
        )}
      </div>

      {data.payoutMode === "SANDBOX" && (
        <div className="border border-warn bg-warn-soft text-warn rounded-sm px-4 py-2.5 text-[12.5px]">
          <b>Test mode.</b> Withdrawals here are recorded but no real money is sent to a bank. {data.payoutModeNote}
        </div>
      )}

      <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
        <Balance label="Available" value={data.availableRupees} hint="You can withdraw this now" tone="text-forest" />
        <Balance label="Coming" value={data.comingRupees} hint="Paid by customers, not released yet" tone="text-warn" />
        <Balance label="In transit" value={data.inTransitRupees} hint="Withdrawals being paid to your bank" tone="text-info" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <PanelHead
            title="Payout accounts"
            desc="Where your withdrawals are sent"
            right={
              <button onClick={() => setShowAccount(true)} className="inline-flex items-center gap-1 text-[12.5px] text-saffron-deep">
                <Plus size={14} /> Add
              </button>
            }
          />
          <ul className="divide-y divide-line">
            {data.accounts.length === 0 && <li className="px-5 py-4 text-[13px] text-ink-faint">Add a bank account or UPI ID to withdraw.</li>}
            {data.accounts.map((a) => (
              <li key={a.id} className="px-5 py-3 flex items-center gap-3">
                {a.type === "BANK" ? <Landmark size={16} className="text-ink-faint shrink-0" /> : <Smartphone size={16} className="text-ink-faint shrink-0" />}
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] text-ink truncate">{a.label}</div>
                  <div className="text-[12px] text-ink-faint">
                    {a.holderName}
                    {!a.usableNow && ` · usable from ${dateTime(a.usableFrom)}`}
                  </div>
                </div>
                <button
                  onClick={async () => {
                    try {
                      await walletApi.removeAccount(a.id)
                      notify("Account removed", "info")
                      void load()
                    } catch (e: any) {
                      notify(e.message, "warn")
                    }
                  }}
                  className="text-ink-faint hover:text-danger"
                  aria-label={`Remove ${a.label}`}
                >
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel>
          <PanelHead title="Coming soon" desc="Bookings that will credit this wallet" />
          <div className="max-h-[320px] overflow-auto">
            <table className="w-full text-[13px]">
              <thead className="text-left text-[11px] uppercase tracking-wider text-ink-faint">
                <tr>
                  <th className="px-5 py-2 font-medium">Booking</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                  <th className="px-2 py-2 font-medium">Due</th>
                  <th className="px-5 py-2 font-medium text-right">Your share</th>
                </tr>
              </thead>
              <tbody>
                {data.upcoming.length === 0 && (
                  <tr><td colSpan={4} className="px-5 py-4 text-ink-faint">Nothing pending.</td></tr>
                )}
                {data.upcoming.map((u) => (
                  <tr key={u.settlementId} className="border-t border-line">
                    <td className="px-5 py-2"><div className="font-mono text-[12px]">{u.bookingId}</div><div className="text-[11.5px] text-ink-faint">{u.gosalaName}</div></td>
                    <td className="px-2 py-2"><Chip status={u.status} /></td>
                    <td className="px-2 py-2 whitespace-nowrap">{dateOnly(u.eligibleAt)}</td>
                    <td className="px-5 py-2 text-right font-mono tabular-nums">{money(u.myRupees)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      {role === "admin" && <SplitPolicyPanel />}

      <Panel>
        <PanelHead title="Withdrawals" desc="Money you have asked to be sent out" />
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] min-w-[560px]">
            <thead className="text-left text-[11px] uppercase tracking-wider text-ink-faint">
              <tr>
                <th className="px-5 py-2 font-medium">Requested</th>
                <th className="px-2 py-2 font-medium">To</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 font-medium">Bank reference (UTR)</th>
                <th className="px-5 py-2 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.withdrawals.length === 0 && <tr><td colSpan={5} className="px-5 py-4 text-ink-faint">No withdrawals yet.</td></tr>}
              {data.withdrawals.map((w) => (
                <tr key={w.id} className="border-t border-line align-top">
                  <td className="px-5 py-2 whitespace-nowrap">{dateTime(w.requestedAt)}</td>
                  <td className="px-2 py-2">{w.account || "–"}</td>
                  <td className="px-2 py-2"><Chip status={w.status} />{w.failureReason && <div className="text-[11.5px] text-danger mt-1">{w.failureReason}</div>}</td>
                  <td className="px-2 py-2 font-mono text-[12px]">{w.utr || "–"}</td>
                  <td className="px-5 py-2 text-right font-mono tabular-nums">{money(w.amountRupees)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel>
        <PanelHead title="Wallet history" desc="Every credit and debit, newest first" />
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] min-w-[560px]">
            <thead className="text-left text-[11px] uppercase tracking-wider text-ink-faint">
              <tr>
                <th className="px-5 py-2 font-medium">When</th>
                <th className="px-2 py-2 font-medium">What</th>
                <th className="px-2 py-2 font-medium text-right">Amount</th>
                <th className="px-5 py-2 font-medium text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {data.transactions.length === 0 && <tr><td colSpan={4} className="px-5 py-4 text-ink-faint">No activity yet.</td></tr>}
              {data.transactions.map((t) => (
                <tr key={t.id} className="border-t border-line align-top">
                  <td className="px-5 py-2 whitespace-nowrap">{dateTime(t.createdAt)}</td>
                  <td className="px-2 py-2">
                    <div>{purposeLabel[t.purpose] || t.purpose}</div>
                    <div className="text-[11.5px] text-ink-faint">{t.description}</div>
                  </td>
                  <td className={`px-2 py-2 text-right font-mono tabular-nums ${t.type === "CREDIT" ? "text-ok" : "text-ink"}`}>
                    {t.type === "CREDIT" ? "+" : "−"}{money(t.amountRupees)}
                  </td>
                  <td className="px-5 py-2 text-right font-mono tabular-nums text-ink-faint">{money(t.balanceAfterRupees)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {showAccount && <AccountModal onClose={() => setShowAccount(false)} onDone={() => { setShowAccount(false); void load() }} />}
      {showWithdraw && (
        <WithdrawModal
          available={data.availableRupees}
          accounts={data.accounts}
          sandbox={data.payoutMode === "SANDBOX"}
          onClose={() => setShowWithdraw(false)}
          onDone={() => { setShowWithdraw(false); void load() }}
        />
      )}
    </div>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 bg-ink/50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="bg-card border border-line rounded-sm w-full max-w-md max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-line flex items-center justify-between">
          <h3 className="font-serif text-[18px] text-ink">{title}</h3>
          <button onClick={onClose} className="text-ink-faint text-[13px]">Close</button>
        </div>
        <div className="p-5 space-y-4">{children}</div>
      </div>
    </div>
  )
}

const inputCls = "w-full border border-line-strong bg-white rounded-sm px-3 py-2 text-[14px] text-ink focus:outline-none focus:border-saffron"
function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="block text-[12px] text-ink-soft mb-1">{label}</span>
      {children}
      {hint && <span className="block text-[11.5px] text-ink-faint mt-1">{hint}</span>}
    </label>
  )
}

function AccountModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { notify } = useToast()
  const [type, setType] = useState<"BANK" | "UPI">("BANK")
  const [f, setF] = useState({ holderName: "", accountNumber: "", ifsc: "", vpa: "" })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })
  return (
    <Modal title="Add payout account" onClose={onClose}>
      <div className="grid grid-cols-2 gap-2">
        {(["BANK", "UPI"] as const).map((t) => (
          <button key={t} onClick={() => setType(t)} className={`rounded-sm border px-3 py-2 text-[13px] ${type === t ? "border-saffron bg-saffron-soft text-saffron-deep" : "border-line text-ink-soft"}`}>
            {t === "BANK" ? "Bank account" : "UPI ID"}
          </button>
        ))}
      </div>
      <Field label="Name on the account"><input className={inputCls} value={f.holderName} onChange={set("holderName")} autoComplete="off" /></Field>
      {type === "BANK" ? (
        <>
          <Field label="Account number"><input className={inputCls} inputMode="numeric" value={f.accountNumber} onChange={set("accountNumber")} autoComplete="off" /></Field>
          <Field label="IFSC code"><input className={inputCls} value={f.ifsc} onChange={set("ifsc")} placeholder="HDFC0001234" autoComplete="off" /></Field>
        </>
      ) : (
        <Field label="UPI ID"><input className={inputCls} value={f.vpa} onChange={set("vpa")} placeholder="name@bank" autoComplete="off" /></Field>
      )}
      <p className="text-[11.5px] text-ink-faint">Only the last four digits are shown after saving. A new account may need a waiting period before it can receive money.</p>
      {err && <p className="text-[13px] text-danger">{err}</p>}
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          setErr("")
          try {
            await walletApi.addAccount({ type, ...f })
            notify("Payout account saved", "success")
            onDone()
          } catch (e: any) {
            setErr(e.message)
          } finally {
            setBusy(false)
          }
        }}
        className="w-full bg-forest text-white rounded-sm py-2.5 text-[14px] font-medium disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save account"}
      </button>
    </Modal>
  )
}

function WithdrawModal({ available, accounts, sandbox, onClose, onDone }: { available: number; accounts: PayoutAccount[]; sandbox: boolean; onClose: () => void; onDone: () => void }) {
  const { notify } = useToast()
  const usable = accounts.filter((a) => a.usableNow)
  const [accountId, setAccountId] = useState(usable[0]?.id || "")
  const [amount, setAmount] = useState("")
  const [otp, setOtp] = useState("")
  const [step, setStep] = useState<"details" | "code">("details")
  const [hint, setHint] = useState("")
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")
  const idem = useMemo(() => `wd-${Date.now()}-${Math.random().toString(36).slice(2)}`, [])
  const value = Number(amount)
  const valid = Number.isFinite(value) && value >= 1 && value <= available && !!accountId

  async function sendCode() {
    setBusy(true)
    setErr("")
    try {
      const r = await walletApi.requestOtp(value, accountId)
      setHint(
        r.devOtp
          ? `Email and SMS are not set up here, so your code is ${r.devOtp}`
          : `We sent a 6-digit code ${[r.byEmail ? `by email to ${r.maskedTarget}` : "", r.byWhatsApp ? `on WhatsApp to ${r.maskedPhone || "your mobile"}` : "", r.bySms ? `by SMS to ${r.maskedPhone || "your mobile"}` : ""].filter(Boolean).join(" and ")}.`,
      )
      setStep("code")
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }
  async function confirm() {
    setBusy(true)
    setErr("")
    try {
      const r = await walletApi.withdraw({ amountRupees: value, payoutAccountId: accountId, otp, idempotencyKey: idem })
      notify(r.withdrawal.status === "PAID" ? `${money(value)} sent${sandbox ? " (test mode)" : ""}` : `${money(value)} is on its way`, "success")
      onDone()
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Withdraw to your account" onClose={onClose}>
      {usable.length === 0 ? (
        <p className="text-[13px] text-ink-soft">Your saved accounts are still in their waiting period. Try again once one becomes usable.</p>
      ) : step === "details" ? (
        <>
          <Field label="Send to">
            <select className={inputCls} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {usable.map((a) => <option key={a.id} value={a.id}>{a.label} · {a.holderName}</option>)}
            </select>
          </Field>
          <Field label="Amount (₹)" hint={`Available: ${money(available)}`}>
            <div className="flex gap-2">
              <input className={inputCls} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
              <button type="button" onClick={() => setAmount(String(available))} className="border border-line rounded-sm px-3 text-[12.5px] text-ink-soft whitespace-nowrap">All</button>
            </div>
          </Field>
          {err && <p className="text-[13px] text-danger">{err}</p>}
          <button disabled={!valid || busy} onClick={sendCode} className="w-full bg-forest text-white rounded-sm py-2.5 text-[14px] font-medium disabled:opacity-40 inline-flex items-center justify-center gap-2">
            <ShieldCheck size={15} /> {busy ? "Sending code…" : "Send verification code"}
          </button>
        </>
      ) : (
        <>
          <p className="text-[13px] text-ink-soft">Withdrawing <b>{money(value)}</b>. {hint}</p>
          <Field label="6-digit code"><input className={`${inputCls} font-mono tracking-widest`} inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} autoFocus /></Field>
          {err && <p className="text-[13px] text-danger">{err}</p>}
          <div className="flex gap-2">
            <button onClick={() => { setStep("details"); setOtp(""); setErr("") }} className="border border-line rounded-sm px-4 py-2.5 text-[13px] text-ink-soft">Back</button>
            <button disabled={otp.length !== 6 || busy} onClick={confirm} className="flex-1 bg-forest text-white rounded-sm py-2.5 text-[14px] font-medium disabled:opacity-40">
              {busy ? "Sending…" : `Withdraw ${money(value)}`}
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}

/** Operations Admin: propose the manager's percentage. It only takes effect after Super Admin approves. */
function SplitPolicyPanel() {
  const { notify } = useToast()
  const [view, setView] = useState<SplitPolicyView | null>(null)
  const [edit, setEdit] = useState<{ gosalaId: string; name: string; current: number } | null>(null)
  const [pct, setPct] = useState("")
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")

  const load = useCallback(() => walletApi.splitPolicy().then(setView).catch(() => setView(null)), [])
  useEffect(() => { void load() }, [load])
  if (!view) return null
  const pending = new Set(view.requests.filter((r) => r.status === "PENDING").map((r) => r.gosalaId))

  return (
    <Panel>
      <PanelHead title="Manager share" desc={`Platform commission is ${view.platformPct}% (set by Super Admin). You decide the manager's share; you keep what remains. Changes need Super Admin approval.`} />
      <div className="overflow-x-auto">
        <table className="w-full text-[13px] min-w-[520px]">
          <thead className="text-left text-[11px] uppercase tracking-wider text-ink-faint">
            <tr>
              <th className="px-5 py-2 font-medium">Gaushala</th>
              <th className="px-2 py-2 font-medium text-right">Manager</th>
              <th className="px-2 py-2 font-medium text-right">You</th>
              <th className="px-5 py-2 font-medium text-right"> </th>
            </tr>
          </thead>
          <tbody>
            {view.policies.length === 0 && <tr><td colSpan={4} className="px-5 py-4 text-ink-faint">No gaushalas are assigned to you.</td></tr>}
            {view.policies.map((p) => (
              <tr key={p.gosalaId} className="border-t border-line">
                <td className="px-5 py-2">{p.gosalaName}{p.isDefault && <span className="ml-2 text-[11px] text-ink-faint">default</span>}</td>
                <td className="px-2 py-2 text-right font-mono">{p.managerPct}%</td>
                <td className="px-2 py-2 text-right font-mono">{p.adminPct}%</td>
                <td className="px-5 py-2 text-right">
                  {pending.has(p.gosalaId) ? (
                    <span className="inline-flex items-center gap-1 text-warn text-[12px]"><Clock size={12} /> Waiting for approval</span>
                  ) : (
                    <button onClick={() => { setEdit({ gosalaId: p.gosalaId, name: p.gosalaName, current: p.managerPct }); setPct(String(p.managerPct)); setReason(""); setErr("") }} className="text-saffron-deep text-[12.5px]">Change</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {view.requests.length > 0 && (
        <div className="border-t border-line px-5 py-3 space-y-1.5">
          <div className="text-[11px] uppercase tracking-wider text-ink-faint">Your requests</div>
          {view.requests.slice(0, 5).map((r) => (
            <div key={r.id} className="text-[12.5px] flex flex-wrap gap-x-3 text-ink-soft">
              <span>{r.gosalaName}: {r.currentManagerPct}% → {r.proposedManagerPct}%</span>
              <span className={r.status === "APPROVED" ? "text-ok" : r.status === "REJECTED" ? "text-danger" : "text-warn"}>{r.status === "PENDING" ? "Waiting" : r.status === "APPROVED" ? "Approved" : "Declined"}</span>
              {r.decisionNote && <span className="text-ink-faint">“{r.decisionNote}”</span>}
            </div>
          ))}
        </div>
      )}
      {edit && (
        <Modal title={`Manager share · ${edit.name}`} onClose={() => setEdit(null)}>
          <Field label="Manager percentage" hint={`Now ${edit.current}%. You would keep ${Math.max(0, +(100 - view.platformPct - Number(pct || 0)).toFixed(2))}% after the ${view.platformPct}% platform commission.`}>
            <input className={inputCls} inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value)} />
          </Field>
          <Field label="Reason for the Super Admin"><input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional" /></Field>
          {err && <p className="text-[13px] text-danger">{err}</p>}
          <button
            disabled={busy || !pct}
            onClick={async () => {
              setBusy(true)
              setErr("")
              try {
                await walletApi.requestSplit(edit.gosalaId, Number(pct), reason)
                notify("Sent to the Super Admin for approval", "success")
                setEdit(null)
                void load()
              } catch (e: any) {
                setErr(e.message)
              } finally {
                setBusy(false)
              }
            }}
            className="w-full bg-forest text-white rounded-sm py-2.5 text-[14px] font-medium disabled:opacity-40"
          >
            {busy ? "Sending…" : "Send for approval"}
          </button>
        </Modal>
      )}
    </Panel>
  )
}

