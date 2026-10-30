import { prisma } from "../prisma.ts"
import { sendNotificationEmail } from "./resendService.ts"
import { sendTemplateSms, sendWhatsAppTemplate, whatsappConfigured } from "./smsService.ts"

/**
 * Tells people about money events by email and, where an approved MSG91 template is set up, SMS.
 * Nothing here can fail or slow down the action it reports: every send is best-effort.
 *
 * SMS only goes out for a message when its template id is set in .env:
 *   MSG91_TEMPLATE_EARNINGS, MSG91_TEMPLATE_WITHDRAWAL_PAID,
 *   MSG91_TEMPLATE_WITHDRAWAL_FAILED, MSG91_TEMPLATE_PAYOUT_ACCOUNT
 */

type Transports = { email: typeof sendNotificationEmail; sms: typeof sendTemplateSms; whatsapp: typeof sendWhatsAppTemplate }
let transports: Transports = { email: sendNotificationEmail, sms: sendTemplateSms, whatsapp: sendWhatsAppTemplate }
let overridden = false

/** For tests: capture what would be sent. Pass null to go back to the real senders. */
export function __setTransports(t: Partial<Transports> | null) {
  overridden = Boolean(t)
  transports = { email: t?.email ?? sendNotificationEmail, sms: t?.sms ?? sendTemplateSms, whatsapp: t?.whatsapp ?? sendWhatsAppTemplate }
}

export const inr = (paise: bigint | number) =>
  `₹${(Number(paise) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** Short enough for a DLT template variable (30 characters). */
const short = (s: string, n = 28) => (s.length > n ? s.slice(0, n - 1) + "…" : s)

type Message = {
  subject: string
  text: string
  /** Name of the .env setting that holds the MSG91 template id, and the template's values in order. */
  sms?: { template: string; vars: string[] }
  /** Approved WhatsApp template name and its values for {{2}}, {{3}}, ... ({{1}} is always the first name). */
  whatsapp?: { template: string; vars: string[] }
}

function enabled() {
  // Keep tests and local runs from emailing or texting real people unless told to.
  return overridden || process.env.NODE_ENV !== "test"
}

async function deliver(user: { id: string; email: string; phone: string; name: string }, msg: Message) {
  if (!enabled()) return
  const firstName = user.name.split(" ")[0] || "Devotee"
  const body = `Namaste ${firstName},\n\n${msg.text}`
  try {
    await transports.email({ toEmail: user.email, subject: msg.subject, text: body, name: firstName })
  } catch (err: any) {
    console.warn(`[notify] email to ${user.email} failed: ${err?.message}`)
  }
  if (msg.whatsapp && user.phone && (overridden || whatsappConfigured())) {
    try {
      const r = await transports.whatsapp({ toPhone: user.phone, template: msg.whatsapp.template, vars: [firstName, ...msg.whatsapp.vars] })
      if (!r.success) console.warn(`[notify] WhatsApp to ${user.phone} not sent: ${r.error}`)
    } catch (err: any) {
      console.warn(`[notify] WhatsApp to ${user.phone} failed: ${err?.message}`)
    }
  }
  if (msg.sms) {
    const templateId = (process.env[msg.sms.template] || "").trim()
    if (templateId && user.phone) {
      const vars: Record<string, string> = {}
      msg.sms.vars.forEach((v, i) => (vars[`var${i + 1}`] = short(v)))
      try {
        const r = await transports.sms({ toPhone: user.phone, templateId, vars })
        if (!r.success) console.warn(`[notify] SMS to ${user.phone} not sent: ${r.error}`)
      } catch (err: any) {
        console.warn(`[notify] SMS to ${user.phone} failed: ${err?.message}`)
      }
    }
  }
}

async function notifyUsersNow(userIds: string[], msg: Message) {
  if (!enabled() || !userIds.length) return
  try {
    const users = await prisma.user.findMany({
      where: { id: { in: [...new Set(userIds)] }, isActive: true },
      select: { id: true, email: true, phone: true, name: true },
    })
    await Promise.all(users.map((u) => deliver(u, msg)))
  } catch (err: any) {
    console.warn("[notify] could not look up recipients:", err?.message)
  }
}

async function notifySuperAdminsNow(msg: Message) {
  if (!enabled()) return
  try {
    const admins = await prisma.user.findMany({ where: { role: "SUPER_ADMIN", isActive: true }, select: { id: true } })
    await notifyUsersNow(admins.map((a) => a.id), msg)
  } catch (err: any) {
    console.warn("[notify] could not look up super admins:", err?.message)
  }
}

/** The gaushala's operations admin plus its active managers. */
async function notifyGosalaTeamNow(gosalaId: string, msg: Message) {
  if (!enabled()) return
  try {
    const gosala = await prisma.gosala.findUnique({
      where: { id: gosalaId },
      select: { adminId: true, managers: { where: { status: "Active" }, select: { userId: true } } },
    })
    if (!gosala) return
    const ids = [gosala.adminId, ...gosala.managers.map((m) => m.userId)].filter(Boolean) as string[]
    await notifyUsersNow(ids, msg)
  } catch (err: any) {
    console.warn("[notify] could not look up gaushala team:", err?.message)
  }
}

// Serverless hosts (Vercel) freeze a function as soon as it responds, which would cut off messages still being sent.
// Every send is registered here so the API entry can wait for them before it ends the response.
const pending = new Set<Promise<unknown>>()
function track<T>(p: Promise<T>): Promise<T> {
  pending.add(p)
  const done = () => pending.delete(p)
  p.then(done, done)
  return p
}
/** Waits (up to a few seconds) for notifications started during this request. */
export async function flushNotifications(timeoutMs = 8000) {
  if (!pending.size) return
  await Promise.race([Promise.allSettled([...pending]), new Promise((r) => setTimeout(r, timeoutMs))])
}
export const notifyUsers = (userIds: string[], msg: Message) => track(notifyUsersNow(userIds, msg))
export const notifySuperAdmins = (msg: Message) => track(notifySuperAdminsNow(msg))
export const notifyGosalaTeam = (gosalaId: string, msg: Message) => track(notifyGosalaTeamNow(gosalaId, msg))

// ----------------------------------------------------------------------------
// The messages
// ----------------------------------------------------------------------------

type BookingInfo = { id: string; animal: string; gosala: string; date: string; time: string; customer?: string; total?: number }

/** Reads the fields the messages need from a booking row. */
export function bookingInfo(b: any): BookingInfo {
  return {
    id: b.id,
    animal: b.animalName,
    gosala: b.gosalaName,
    date: b.bookingDate,
    time: `${b.startTime}${b.endTime ? ` – ${b.endTime}` : ""}`,
    customer: b.customerName,
    total: typeof b.totalAmount === "number" ? b.totalAmount : undefined,
  }
}

export const messages = {
  bookingPlaced: (b: BookingInfo): Message => ({
    subject: `Booking ${b.id} received`,
    text: `Your payment${b.total ? ` of ₹${b.total.toLocaleString("en-IN")}` : ""} was received and booking ${b.id} for ${b.animal} at ${b.gosala} on ${b.date}, ${b.time} is now with the gaushala manager for confirmation. We will tell you as soon as it is confirmed.`,
    sms: { template: "MSG91_TEMPLATE_BOOKING_PLACED", vars: [b.id, b.animal, b.date] },
    whatsapp: { template: "gomaa_booking_placed", vars: [b.id, b.animal, b.date] },
  }),

  bookingNeedsReview: (b: BookingInfo): Message => ({
    subject: `New booking to review: ${b.animal} on ${b.date}`,
    text: `${b.customer || "A devotee"} booked ${b.animal} at ${b.gosala} on ${b.date}, ${b.time}${b.total ? ` (₹${b.total.toLocaleString("en-IN")})` : ""}. Booking ${b.id} is paid and waiting for your review.`,
    sms: { template: "MSG91_TEMPLATE_BOOKING_REVIEW", vars: [b.id, b.animal, b.date] },
    whatsapp: { template: "gomaa_new_booking_review", vars: [b.id, b.animal] },
  }),

  bookingManagerDecided: (b: BookingInfo, confirmed: boolean, remark?: string | null): Message => ({
    subject: `Booking ${b.id}: ${confirmed ? "feasibility confirmed" : "declined"}`,
    text: confirmed
      ? `The manager confirmed feasibility for ${b.animal} on ${b.date}, ${b.time}. Booking ${b.id} now needs the operations admin's approval.`
      : `Booking ${b.id} for ${b.animal} on ${b.date} was declined by the manager${remark ? `: ${remark}` : ""}. The payment will be refunded.`,
  }),

  bookingConfirmed: (b: BookingInfo): Message => ({
    subject: `Booking ${b.id} confirmed`,
    text: `Your booking ${b.id} for ${b.animal} at ${b.gosala} on ${b.date}, ${b.time} is confirmed. You can follow it live under Track in the GOMAA app.`,
    sms: { template: "MSG91_TEMPLATE_BOOKING_CONFIRMED", vars: [b.id, b.animal, b.date] },
    whatsapp: { template: "gomaa_booking_confirmed", vars: [b.id, b.gosala] },
  }),

  bookingRejected: (b: BookingInfo, remark?: string | null): Message => ({
    subject: `Booking ${b.id} could not be confirmed`,
    text: `We are sorry: booking ${b.id} for ${b.animal} on ${b.date} could not be confirmed${remark ? ` (${remark})` : ""}. Your payment will be refunded to the original payment method.`,
    sms: { template: "MSG91_TEMPLATE_BOOKING_REJECTED", vars: [b.id] },
    whatsapp: { template: "gomaa_booking_rejected", vars: [b.id] },
  }),

  earningsReleased: (amountPaise: bigint, bookingId: string, gosala: string): Message => ({
    subject: `${inr(amountPaise)} added to your wallet`,
    text: `${inr(amountPaise)} from booking ${bookingId} at ${gosala} has been approved and added to your GOMAA wallet. You can withdraw it from My Wallet.`,
    sms: { template: "MSG91_TEMPLATE_EARNINGS", vars: [inr(amountPaise).replace("₹", ""), bookingId] },
    whatsapp: { template: "gomaa_earnings_added", vars: [inr(amountPaise).replace("₹", "").replace(/,/g, ""), bookingId] },
  }),

  readyForApproval: (count: number, totalPaise: bigint): Message => ({
    subject: `${count} booking${count === 1 ? "" : "s"} ready for your approval`,
    text: `${count} paid booking${count === 1 ? " has" : "s have"} passed the 2-day wait (${inr(totalPaise)} in escrow). Open Treasury & Wallets to approve and release ${count === 1 ? "it" : "them"}.`,
  }),

  splitRequested: (who: string, gosala: string, from: number, to: number, reason?: string | null): Message => ({
    subject: `Manager share change waiting: ${gosala}`,
    text: `${who} asks to change the manager's share at ${gosala} from ${from}% to ${to}%.${reason ? `\n\nReason: ${reason}` : ""}\n\nOpen Treasury & Wallets to approve or decline. Nothing changes until you decide.`,
  }),

  splitDecided: (gosala: string, to: number, approved: boolean, note?: string | null): Message => ({
    subject: `Manager share change ${approved ? "approved" : "declined"}: ${gosala}`,
    text: approved
      ? `The Super Admin approved the manager share at ${gosala} at ${to}%. It applies to bookings paid from now on.${note ? `\n\nNote: ${note}` : ""}`
      : `The Super Admin declined your request to set the manager share at ${gosala} to ${to}%. The earlier percentage stays.${note ? `\n\nNote: ${note}` : ""}`,
  }),

  withdrawalPaid: (amountPaise: bigint, account: string, utr: string): Message => ({
    subject: `Withdrawal of ${inr(amountPaise)} sent`,
    text: `${inr(amountPaise)} was sent to ${account}.${utr ? `\n\nBank reference (UTR): ${utr}` : ""}\n\nIt normally shows in your account within minutes. If you did not make this withdrawal, tell the Super Admin straight away.`,
    sms: { template: "MSG91_TEMPLATE_WITHDRAWAL_PAID", vars: [inr(amountPaise).replace("₹", ""), account, utr || "pending"] },
    whatsapp: { template: "gomaa_withdrawal_status", vars: [inr(amountPaise).replace("₹", "").replace(/,/g, ""), "paid"] },
  }),

  withdrawalFailed: (amountPaise: bigint, reason: string): Message => ({
    subject: `Withdrawal of ${inr(amountPaise)} failed`,
    text: `Your withdrawal of ${inr(amountPaise)} could not be completed${reason ? ` (${reason})` : ""}. The full amount has been returned to your GOMAA wallet. You can try again or choose another account.`,
    sms: { template: "MSG91_TEMPLATE_WITHDRAWAL_FAILED", vars: [inr(amountPaise).replace("₹", "")] },
    whatsapp: { template: "gomaa_withdrawal_status", vars: [inr(amountPaise).replace("₹", "").replace(/,/g, ""), "failed and returned to your wallet"] },
  }),

  payoutAccountChanged: (added: boolean, label: string): Message => ({
    subject: `Payout account ${added ? "added" : "removed"}`,
    text: `A payout account (${label}) was ${added ? "added to" : "removed from"} your GOMAA wallet.${added ? "\n\nFor your safety a new account may need a waiting period before it can receive money." : ""}\n\nIf this was not you, contact the Super Admin straight away and change your password.`,
    sms: { template: "MSG91_TEMPLATE_PAYOUT_ACCOUNT", vars: [added ? "added" : "removed"] },
  }),
}
