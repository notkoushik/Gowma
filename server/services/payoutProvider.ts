import crypto from "node:crypto"

/**
 * Payout providers move real money out to a bank account or UPI ID.
 *
 * - SandboxProvider: no money moves. It answers instantly with a clearly marked test UTR.
 *   Used whenever live RazorpayX credentials are not configured.
 * - RazorpayXProvider: calls the RazorpayX Payouts API. It is written from Razorpay's
 *   documented contacts / fund accounts / payouts calls and has not been run against a live account.
 */

export type PayoutTarget =
  | { type: "BANK"; holderName: string; accountNumber: string; ifsc: string }
  | { type: "UPI"; holderName: string; vpa: string }

export type PayoutRequest = {
  requestId: string // our WithdrawalRequest id, used as the provider reference
  amountPaise: bigint
  target: PayoutTarget
  contactName: string
  contactEmail?: string
  contactPhone?: string
  existingContactId?: string | null
  existingFundAccountId?: string | null
}

export type PayoutOutcome =
  | { state: "PAID"; providerPayoutId: string; utr: string; contactId?: string; fundAccountId?: string }
  | { state: "PROCESSING"; providerPayoutId: string; contactId?: string; fundAccountId?: string }
  | { state: "FAILED"; reason: string }

export interface PayoutProvider {
  mode: "SANDBOX" | "RAZORPAYX"
  send(req: PayoutRequest): Promise<PayoutOutcome>
  status(providerPayoutId: string): Promise<PayoutOutcome>
}

export class SandboxProvider implements PayoutProvider {
  mode = "SANDBOX" as const
  async send(req: PayoutRequest): Promise<PayoutOutcome> {
    const id = `sbx_${req.requestId.replace(/-/g, "").slice(0, 14)}`
    return { state: "PAID", providerPayoutId: id, utr: `SANDBOX-${crypto.randomBytes(5).toString("hex").toUpperCase()}` }
  }
  async status(providerPayoutId: string): Promise<PayoutOutcome> {
    return { state: "PAID", providerPayoutId, utr: `SANDBOX-${providerPayoutId.slice(-8).toUpperCase()}` }
  }
}

const API = "https://api.razorpay.com/v1"

export class RazorpayXProvider implements PayoutProvider {
  mode = "RAZORPAYX" as const
  constructor(
    private keyId: string,
    private keySecret: string,
    private accountNumber: string,
    private fetchImpl: typeof fetch = fetch,
  ) {}

  private async call(path: string, method: "GET" | "POST", body?: unknown, extraHeaders: Record<string, string> = {}) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15000)
    try {
      const res = await this.fetchImpl(`${API}${path}`, {
        method,
        signal: controller.signal,
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64")}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...extraHeaders,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      })
      const json: any = await res.json().catch(() => ({}))
      if (!res.ok) {
        const reason = json?.error?.description || `Provider returned ${res.status}`
        const err: any = new Error(reason)
        err.status = res.status
        throw err
      }
      return json
    } finally {
      clearTimeout(timer)
    }
  }

  private mapStatus(p: any): PayoutOutcome {
    const st = String(p?.status || "")
    if (st === "processed") return { state: "PAID", providerPayoutId: p.id, utr: String(p.utr || "") }
    if (st === "failed" || st === "rejected" || st === "cancelled" || st === "reversed") {
      return { state: "FAILED", reason: p?.failure_reason || p?.status_details?.description || `Payout ${st}` }
    }
    return { state: "PROCESSING", providerPayoutId: p.id }
  }

  async send(req: PayoutRequest): Promise<PayoutOutcome> {
    try {
      let contactId = req.existingContactId || undefined
      if (!contactId) {
        const c = await this.call("/contacts", "POST", {
          name: req.contactName,
          email: req.contactEmail,
          contact: req.contactPhone,
          type: "employee",
          // RazorpayX allows at most 40 characters here
          reference_id: `gc_${req.requestId.replace(/-/g, "")}`,
        })
        contactId = c.id
      }
      let fundAccountId = req.existingFundAccountId || undefined
      if (!fundAccountId) {
        const body =
          req.target.type === "BANK"
            ? {
                contact_id: contactId,
                account_type: "bank_account",
                bank_account: { name: req.target.holderName, ifsc: req.target.ifsc, account_number: req.target.accountNumber },
              }
            : { contact_id: contactId, account_type: "vpa", vpa: { address: req.target.vpa } }
        const f = await this.call("/fund_accounts", "POST", body)
        fundAccountId = f.id
      }
      const amountRupees = Number(req.amountPaise) / 100
      const mode = req.target.type === "UPI" ? "UPI" : amountRupees > 500000 ? "NEFT" : "IMPS"
      const p = await this.call(
        "/payouts",
        "POST",
        {
          account_number: this.accountNumber,
          fund_account_id: fundAccountId,
          amount: Number(req.amountPaise),
          currency: "INR",
          mode,
          purpose: "payout",
          queue_if_low_balance: false,
          reference_id: req.requestId,
          narration: "GOMAA wallet withdrawal",
        },
        { "X-Payout-Idempotency": req.requestId },
      )
      const out = this.mapStatus(p)
      return out.state === "FAILED" ? out : { ...out, contactId, fundAccountId }
    } catch (err: any) {
      // A 4xx means the provider refused the payout outright. Anything else is unknown
      // (timeout, network), so we keep the money on hold and let the status check settle it.
      if (err?.status && err.status >= 400 && err.status < 500) {
        return { state: "FAILED", reason: err.message || "Provider rejected the payout" }
      }
      return { state: "PROCESSING", providerPayoutId: `pending_${req.requestId}` }
    }
  }

  async status(providerPayoutId: string): Promise<PayoutOutcome> {
    if (providerPayoutId.startsWith("pending_")) return { state: "PROCESSING", providerPayoutId }
    const p = await this.call(`/payouts/${encodeURIComponent(providerPayoutId)}`, "GET")
    return this.mapStatus(p)
  }
}

export function getPayoutProvider(): PayoutProvider {
  const wantsLive = process.env.GOMAA_PAYOUT_MODE === "razorpayx" && process.env.GOMAA_PAYOUT_PROVIDER_ENABLED === "true"
  const keyId = process.env.RAZORPAYX_KEY_ID || process.env.RAZORPAY_KEY_ID || ""
  const keySecret = process.env.RAZORPAYX_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET || ""
  const account = process.env.RAZORPAYX_ACCOUNT_NUMBER || ""
  const realKeys = /^rzp_(test|live)_[A-Za-z0-9]{10,}$/.test(keyId) && !keyId.includes("synthetic")
  if (wantsLive && realKeys && keySecret && account) {
    return new RazorpayXProvider(keyId, keySecret, account)
  }
  return new SandboxProvider()
}

export function payoutModeReason(): string {
  const p = getPayoutProvider()
  if (p.mode === "RAZORPAYX") return "Live payouts through RazorpayX"
  return "Sandbox: no real money moves. Set GOMAA_PAYOUT_MODE=razorpayx, GOMAA_PAYOUT_PROVIDER_ENABLED=true, real RazorpayX keys and RAZORPAYX_ACCOUNT_NUMBER to go live."
}
