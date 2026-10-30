import crypto from "node:crypto"
import { prisma } from "../prisma.ts"
import { JWT_SECRET } from "../auth/jwt.ts"
import { hashOtp, verifyOtpHash } from "./otpService.ts"
import { sendOtpEmail } from "./resendService.ts"
import {
  ensureSystemWallets,
  getSystemWallet,
  getUserWallet,
  LedgerError,
  postGroup,
  runLedgerTx,
} from "./ledgerService.ts"
import { getPayoutProvider, type PayoutOutcome, type PayoutTarget } from "./payoutProvider.ts"
import { audit, SYSTEM_ACTOR } from "./auditService.ts"
import { sendOtpSms, sendWhatsAppTemplate, whatsappConfigured } from "./smsService.ts"
import { inr, messages, notifyUsers } from "./notifyService.ts"

const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/
const ACCOUNT = /^\d{9,18}$/
const VPA = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9]{1,63}$/
const MIN_WITHDRAWAL_PAISE = 100n // ₹1, the smallest amount a payout provider accepts

// ---------------------------------------------------------------------------
// Account number encryption. The full number is only needed for the provider call.
// ---------------------------------------------------------------------------

function dataKey() {
  const key = process.env.GOMAA_DATA_KEY
  if (!key && process.env.NODE_ENV === "production") {
    // Bank account numbers must not be locked with the same secret that signs logins.
    throw new LedgerError("Payout accounts are disabled until GOMAA_DATA_KEY is configured on the server", "CONFLICT")
  }
  return crypto.createHash("sha256").update(key || JWT_SECRET).digest()
}

/** Fake payouts must never run on a live site by accident. */
function assertPayoutsEnabled() {
  const provider = getPayoutProvider()
  if (provider.mode === "SANDBOX" && process.env.NODE_ENV === "production" && process.env.GOMAA_ALLOW_SANDBOX_PAYOUTS !== "true") {
    throw new LedgerError("Withdrawals are not switched on yet. Please contact the Super Admin.", "CONFLICT")
  }
}
function encrypt(plain: string) {
  const iv = crypto.randomBytes(12)
  const c = crypto.createCipheriv("aes-256-gcm", dataKey(), iv)
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()])
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64")).join(".")
}
function decrypt(blob: string) {
  const [iv, tag, enc] = blob.split(".").map((p) => Buffer.from(p, "base64"))
  const d = crypto.createDecipheriv("aes-256-gcm", dataKey(), iv)
  d.setAuthTag(tag)
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8")
}

const coolOffHours = () => {
  const fromEnv = process.env.GOMAA_PAYOUT_ACCOUNT_COOLOFF_HOURS
  if (fromEnv !== undefined && fromEnv !== "") return Math.max(0, Number(fromEnv) || 0)
  return getPayoutProvider().mode === "SANDBOX" ? 0 : 24
}

// ---------------------------------------------------------------------------
// Payout accounts
// ---------------------------------------------------------------------------

export function publicAccount(a: any) {
  return {
    id: a.id,
    type: a.type,
    holderName: a.holderName,
    label: a.type === "BANK" ? `Bank ••••${a.accountLast4} (${a.ifsc})` : a.vpa,
    usableFrom: a.usableFrom.toISOString(),
    usableNow: a.usableFrom.getTime() <= Date.now(),
    createdAt: a.createdAt.toISOString(),
  }
}

export async function listPayoutAccounts(userId: string) {
  const rows = await prisma.payoutAccount.findMany({ where: { userId, isActive: true }, orderBy: { createdAt: "desc" } })
  return rows.map(publicAccount)
}

export async function addPayoutAccount(userId: string, input: any) {
  const type = input?.type === "UPI" ? "UPI" : input?.type === "BANK" ? "BANK" : null
  if (!type) throw new LedgerError("Choose bank account or UPI", "INVALID")
  const holderName = String(input.holderName || "").trim()
  if (holderName.length < 2 || holderName.length > 80) throw new LedgerError("Enter the account holder's name", "INVALID")

  const count = await prisma.payoutAccount.count({ where: { userId, isActive: true } })
  if (count >= 5) throw new LedgerError("You can keep at most 5 payout accounts. Remove one first.", "CONFLICT")

  const usableFrom = new Date(Date.now() + coolOffHours() * 3600 * 1000)
  if (type === "BANK") {
    const accountNumber = String(input.accountNumber || "").replace(/\s+/g, "")
    const ifsc = String(input.ifsc || "").trim().toUpperCase()
    if (!ACCOUNT.test(accountNumber)) throw new LedgerError("Account number must be 9 to 18 digits", "INVALID")
    if (!IFSC.test(ifsc)) throw new LedgerError("IFSC looks wrong. It is 4 letters, a zero, then 6 letters or digits", "INVALID")
    const dup = await prisma.payoutAccount.findFirst({ where: { userId, isActive: true, ifsc, accountLast4: accountNumber.slice(-4) } })
    if (dup) throw new LedgerError("This bank account is already saved", "CONFLICT")
    const row = await prisma.payoutAccount.create({
      data: { userId, type, holderName, accountLast4: accountNumber.slice(-4), ifsc, accountNumberEnc: encrypt(accountNumber), usableFrom },
    })
    return publicAccount(row)
  }
  const vpa = String(input.vpa || "").trim().toLowerCase()
  if (!VPA.test(vpa)) throw new LedgerError("UPI ID should look like name@bank", "INVALID")
  const dup = await prisma.payoutAccount.findFirst({ where: { userId, isActive: true, vpa } })
  if (dup) throw new LedgerError("This UPI ID is already saved", "CONFLICT")
  const row = await prisma.payoutAccount.create({ data: { userId, type, holderName, vpa, usableFrom } })
  return publicAccount(row)
}

export async function removePayoutAccount(userId: string, id: string) {
  const res = await prisma.payoutAccount.updateMany({ where: { id, userId, isActive: true }, data: { isActive: false } })
  if (res.count !== 1) throw new LedgerError("Account not found", "INVALID")
}

// ---------------------------------------------------------------------------
// Withdrawal OTP and request
// ---------------------------------------------------------------------------

export async function requestWithdrawalOtp(userId: string, amountPaise: bigint, payoutAccountId: string) {
  assertPayoutsEnabled()
  await assertCanWithdraw(userId, amountPaise, payoutAccountId)
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw new LedgerError("Account not found", "INVALID")

  const recent = await prisma.withdrawalOtp.count({ where: { userId, createdAt: { gt: new Date(Date.now() - 15 * 60 * 1000) } } })
  if (recent >= 5) throw new LedgerError("Too many codes requested. Wait 15 minutes and try again.", "CONFLICT")

  const otp = crypto.randomInt(100000, 1000000).toString()
  await prisma.withdrawalOtp.updateMany({ where: { userId, used: false }, data: { used: true } })
  await prisma.withdrawalOtp.create({
    data: { userId, otpHash: hashOtp(otp), amountPaise, payoutAccountId, expiresAt: new Date(Date.now() + 10 * 60 * 1000) },
  })

  // The code goes by email, and by WhatsApp once an approved Authentication template is named in
  // MSG91_WHATSAPP_OTP_TEMPLATE. SMS is opt-in (GOMAA_WITHDRAWAL_OTP_SMS=true) because it needs DLT-approved templates.
  const detail = inr(amountPaise)
  const waTemplate = (process.env.MSG91_WHATSAPP_OTP_TEMPLATE || "").trim()
  const none = { success: false, error: "not used" }
  const [emailRes, waRes, smsRes] = await Promise.all([
    sendOtpEmail({ toEmail: user.email, userName: user.name, otp, expiryMinutes: 10, purpose: "WITHDRAWAL", detail }).catch((e: any) => ({ success: false, error: e?.message })),
    user.phone && waTemplate && whatsappConfigured()
      ? sendWhatsAppTemplate({ toPhone: user.phone, template: waTemplate, vars: [otp], urlButtonValue: otp }).catch((e: any) => ({ success: false, error: e?.message }))
      : Promise.resolve(none),
    user.phone && process.env.GOMAA_WITHDRAWAL_OTP_SMS === "true"
      ? sendOtpSms({ toPhone: user.phone, otp, expiryMinutes: 10, purpose: "WITHDRAWAL" }).catch((e: any) => ({ success: false, error: e?.message }))
      : Promise.resolve(none),
  ])
  const delivered = Boolean(emailRes.success) || Boolean(waRes.success) || Boolean(smsRes.success)
  if (!delivered) {
    // Outside production the code is returned so the flow can be tried without email or SMS set up.
    if (process.env.NODE_ENV !== "production") return { sent: false, maskedTarget: user.email, devOtp: otp }
    throw new LedgerError("We could not send the verification code. Try again in a moment.", "CONFLICT")
  }
  const digits = String(user.phone || "").replace(/\D/g, "")
  return {
    sent: true,
    maskedTarget: user.email.replace(/^(.).*(@.*)$/, "$1***$2"),
    byEmail: Boolean(emailRes.success),
    byWhatsApp: Boolean(waRes.success),
    bySms: Boolean(smsRes.success),
    maskedPhone: (waRes.success || smsRes.success) && digits.length >= 4 ? `••••••${digits.slice(-4)}` : undefined,
  }
}

async function assertCanWithdraw(userId: string, amountPaise: bigint, payoutAccountId: string) {
  if (amountPaise < MIN_WITHDRAWAL_PAISE) throw new LedgerError("Minimum withdrawal is ₹1", "INVALID")
  const account = await prisma.payoutAccount.findFirst({ where: { id: payoutAccountId, userId, isActive: true } })
  if (!account) throw new LedgerError("Choose a saved bank account or UPI ID", "INVALID")
  if (account.usableFrom.getTime() > Date.now()) {
    throw new LedgerError(`This account becomes usable on ${account.usableFrom.toLocaleString("en-IN")}`, "CONFLICT")
  }
  const wallet = await prisma.wallet.findUnique({ where: { userId } })
  if (!wallet || !wallet.isActive) throw new LedgerError("Wallet is not available", "WALLET_INACTIVE")
  if (BigInt(wallet.balancePaise) < amountPaise) {
    throw new LedgerError(`You can withdraw at most ₹${(Number(wallet.balancePaise) / 100).toLocaleString("en-IN")}`, "INSUFFICIENT_FUNDS")
  }
  return { account, wallet }
}

async function consumeOtp(userId: string, otp: string, amountPaise: bigint, payoutAccountId: string) {
  const row = await prisma.withdrawalOtp.findFirst({ where: { userId, used: false }, orderBy: { createdAt: "desc" } })
  if (!row || row.expiresAt.getTime() < Date.now()) throw new LedgerError("The code expired. Request a new one.", "CONFLICT")
  if (row.attempts >= 5) throw new LedgerError("Too many wrong codes. Request a new one.", "CONFLICT")
  if (BigInt(row.amountPaise) !== amountPaise || row.payoutAccountId !== payoutAccountId) {
    throw new LedgerError("The code was issued for a different amount or account. Request a new one.", "CONFLICT")
  }
  if (!verifyOtpHash(String(otp || ""), row.otpHash)) {
    await prisma.withdrawalOtp.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } })
    throw new LedgerError("That code is not correct", "INVALID")
  }
  const claimed = await prisma.withdrawalOtp.updateMany({ where: { id: row.id, used: false }, data: { used: true } })
  if (claimed.count !== 1) throw new LedgerError("That code was already used", "CONFLICT")
}

export function serializeWithdrawal(w: any, accountLabel?: string) {
  return {
    id: w.id,
    amountPaise: w.amountPaise.toString(),
    amountRupees: Number(w.amountPaise) / 100,
    status: w.status,
    mode: w.mode,
    utr: w.utr,
    failureReason: w.failureReason,
    account: accountLabel,
    requestedAt: w.requestedAt.toISOString(),
    completedAt: w.completedAt ? w.completedAt.toISOString() : null,
  }
}

export async function createWithdrawal(args: { userId: string; amountPaise: bigint; payoutAccountId: string; otp: string; idempotencyKey: string }) {
  assertPayoutsEnabled()
  await ensureSystemWallets()
  const { userId, amountPaise, payoutAccountId, otp, idempotencyKey } = args
  if (!idempotencyKey) throw new LedgerError("An idempotency key is required", "INVALID")

  const replay = await prisma.withdrawalRequest.findUnique({ where: { idempotencyKey } })
  if (replay) {
    if (replay.userId !== userId) throw new LedgerError("Request not found", "INVALID")
    return { replay: true, withdrawal: serializeWithdrawal(replay) }
  }

  const { account } = await assertCanWithdraw(userId, amountPaise, payoutAccountId)
  await consumeOtp(userId, otp, amountPaise, payoutAccountId)

  const provider = getPayoutProvider()
  // Money leaves the wallet and sits in the hold wallet in the same transaction as the request row.
  const request = await runLedgerTx(async (tx) => {
    const wallet = await getUserWallet(tx, userId)
    const hold = await getSystemWallet(tx, "WITHDRAWAL_HOLD")
    const row = await tx.withdrawalRequest.create({
      data: { userId, walletId: wallet.id, payoutAccountId, amountPaise, mode: provider.mode, idempotencyKey },
    })
    const groupId = `wd_${row.id}`
    await postGroup(
      tx,
      [
        { walletId: wallet.id, type: "DEBIT", amountPaise, purpose: "WITHDRAWAL_HOLD", idempotencyKey: `${groupId}:wallet`, groupId, referenceId: row.id, description: `Withdrawal to ${account.type === "UPI" ? account.vpa : `bank ••••${account.accountLast4}`}` },
        { walletId: hold.id, type: "CREDIT", amountPaise, purpose: "WITHDRAWAL_HOLD", idempotencyKey: `${groupId}:hold`, groupId, referenceId: row.id, description: `Held for withdrawal ${row.id}` },
      ],
      { balanced: true },
    )
    return row
  })

  const user = await prisma.user.findUnique({ where: { id: userId } })
  await audit({ userId, name: user?.name || "Unknown", role: ({ GOSALA_MANAGER: "manager", OPERATIONS_ADMIN: "admin", SUPER_ADMIN: "super_admin", CUSTOMER: "customer", DRIVER: "driver" } as Record<string, string>)[String(user?.role)] || String(user?.role || "") }, "WITHDRAWAL_REQUESTED", "withdrawal", request.id, { amountRupees: Number(amountPaise) / 100, account: account.type === "UPI" ? account.vpa : `bank ••••${account.accountLast4}`, mode: provider.mode })
  const target: PayoutTarget = targetFor(account)

  let outcome: PayoutOutcome
  try {
    outcome = await provider.send({
      requestId: request.id,
      amountPaise,
      target,
      contactName: account.holderName,
      contactEmail: user?.email,
      contactPhone: user?.phone?.replace(/\D/g, "").slice(-10),
      existingContactId: account.providerContactId,
      existingFundAccountId: account.providerFundAccountId,
    })
  } catch (err: any) {
    outcome = { state: "PROCESSING", providerPayoutId: `pending_${request.id}` }
  }

  if ((outcome as any).fundAccountId && !account.providerFundAccountId) {
    await prisma.payoutAccount.update({
      where: { id: account.id },
      data: { providerContactId: (outcome as any).contactId, providerFundAccountId: (outcome as any).fundAccountId },
    })
  }
  const done = await applyOutcome(request.id, outcome)
  return { replay: false, withdrawal: serializeWithdrawal(done, account.type === "UPI" ? account.vpa! : `Bank ••••${account.accountLast4}`) }
}

/**
 * Closes a withdrawal. Safe to call many times, from the API response, the webhook, and the
 * status check: only the call that finds it still PROCESSING changes anything.
 */
export async function applyOutcome(requestId: string, outcome: PayoutOutcome) {
  await ensureSystemWallets()
  if (outcome.state === "PROCESSING") {
    return prisma.withdrawalRequest.update({ where: { id: requestId }, data: { providerPayoutId: outcome.providerPayoutId } })
  }
  let closedNow = false
  const result = await runLedgerTx(async (tx) => {
    closedNow = false
    const claimed = await tx.withdrawalRequest.updateMany({
      where: { id: requestId, status: "PROCESSING" },
      data:
        outcome.state === "PAID"
          ? { status: "PAID", utr: outcome.utr || null, providerPayoutId: outcome.providerPayoutId, completedAt: new Date() }
          : { status: "FAILED", failureReason: outcome.reason, completedAt: new Date() },
    })
    const row = await tx.withdrawalRequest.findUniqueOrThrow({ where: { id: requestId } })
    if (claimed.count !== 1) return row // someone else already closed it
    closedNow = true

    const hold = await getSystemWallet(tx, "WITHDRAWAL_HOLD")
    const groupId = `wdc_${row.id}`
    void audit(SYSTEM_ACTOR, outcome.state === "PAID" ? "WITHDRAWAL_PAID" : "WITHDRAWAL_FAILED", "withdrawal", row.id, outcome.state === "PAID" ? { utr: outcome.utr } : { reason: outcome.reason })
    if (outcome.state === "PAID") {
      // The held money leaves the system. This is the only entry, matching the real bank transfer.
      await postGroup(tx, [{ walletId: hold.id, type: "DEBIT", amountPaise: row.amountPaise, purpose: "WITHDRAWAL_PAID", idempotencyKey: `${groupId}:paid`, groupId, referenceId: row.id, description: `Paid out. UTR ${outcome.utr || "pending"}` }])
    } else {
      await postGroup(
        tx,
        [
          { walletId: hold.id, type: "DEBIT", amountPaise: row.amountPaise, purpose: "WITHDRAWAL_REVERSAL", idempotencyKey: `${groupId}:hold`, groupId, referenceId: row.id, description: `Withdrawal ${row.id} failed` },
          { walletId: row.walletId, type: "CREDIT", amountPaise: row.amountPaise, purpose: "WITHDRAWAL_REVERSAL", idempotencyKey: `${groupId}:wallet`, groupId, referenceId: row.id, description: `Returned: ${outcome.reason}` },
        ],
        { balanced: true },
      )
    }
    return row
  })
  if (closedNow) {
    const account = await prisma.payoutAccount.findUnique({ where: { id: result.payoutAccountId } }).catch(() => null)
    const label = account ? publicAccount(account).label : "your account"
    void notifyUsers(
      [result.userId],
      outcome.state === "PAID"
        ? messages.withdrawalPaid(BigInt(result.amountPaise), label, outcome.utr || "")
        : messages.withdrawalFailed(BigInt(result.amountPaise), outcome.state === "FAILED" ? outcome.reason : ""),
    )
  }
  return result
}

function targetFor(account: any): PayoutTarget {
  return account.type === "BANK"
    ? { type: "BANK", holderName: account.holderName, accountNumber: decrypt(account.accountNumberEnc!), ifsc: account.ifsc! }
    : { type: "UPI", holderName: account.holderName, vpa: account.vpa! }
}

/**
 * Asks the provider about withdrawals that are still open and closes any that have finished.
 * A withdrawal whose provider call timed out has no payout id yet. After 10 minutes it is sent
 * again with the same idempotency key, so the provider returns the original payout if one was
 * created and creates it exactly once if not.
 */
export async function refreshProcessing(userId?: string) {
  const provider = getPayoutProvider()
  const open = await prisma.withdrawalRequest.findMany({
    where: { status: "PROCESSING", providerPayoutId: { not: null }, ...(userId ? { userId } : {}) },
    take: 25,
  })
  for (const w of open) {
    try {
      let out: PayoutOutcome
      if (w.providerPayoutId!.startsWith("pending_")) {
        if (provider.mode !== "RAZORPAYX" || Date.now() - w.requestedAt.getTime() < 10 * 60 * 1000) continue
        const account = await prisma.payoutAccount.findUnique({ where: { id: w.payoutAccountId } })
        const user = await prisma.user.findUnique({ where: { id: w.userId } })
        if (!account) continue
        out = await provider.send({
          requestId: w.id,
          amountPaise: BigInt(w.amountPaise),
          target: targetFor(account),
          contactName: account.holderName,
          contactEmail: user?.email,
          contactPhone: user?.phone?.replace(/\D/g, "").slice(-10),
          existingContactId: account.providerContactId,
          existingFundAccountId: account.providerFundAccountId,
        })
      } else {
        out = await provider.status(w.providerPayoutId!)
      }
      if (out.state !== "PROCESSING") await applyOutcome(w.id, out)
      else if (out.providerPayoutId !== w.providerPayoutId) await applyOutcome(w.id, out)
    } catch {
      /* try again next time */
    }
  }
}

export async function listWithdrawals(userId: string, limit = 30) {
  const rows = await prisma.withdrawalRequest.findMany({ where: { userId }, orderBy: { requestedAt: "desc" }, take: Math.min(limit, 100) })
  const accounts = await prisma.payoutAccount.findMany({ where: { id: { in: rows.map((r) => r.payoutAccountId) } } })
  const label = new Map(accounts.map((a) => [a.id, publicAccount(a).label]))
  return rows.map((r) => serializeWithdrawal(r, label.get(r.payoutAccountId)))
}

// ---------------------------------------------------------------------------
// Provider webhook
// ---------------------------------------------------------------------------

export async function handlePayoutWebhook(eventId: string, event: any) {
  const type = String(event?.event || "")
  const entity = event?.payload?.payout?.entity
  if (!entity?.id) return { ignored: true }
  const seen = await prisma.providerEvent.findUnique({ where: { eventId } })
  if (seen) return { replay: true }
  await prisma.providerEvent.create({ data: { provider: "RAZORPAYX", eventId, eventType: type, payload: event } })

  const w = await prisma.withdrawalRequest.findFirst({
    where: { OR: [{ providerPayoutId: entity.id }, { id: String(entity.reference_id || "") }] },
  })
  if (!w) return { ignored: true }
  if (type === "payout.processed") return applyOutcome(w.id, { state: "PAID", providerPayoutId: entity.id, utr: String(entity.utr || "") })
  if (type === "payout.failed" || type === "payout.rejected" || type === "payout.reversed" || type === "payout.cancelled") {
    return applyOutcome(w.id, { state: "FAILED", reason: entity.failure_reason || entity.status_details?.description || type })
  }
  return applyOutcome(w.id, { state: "PROCESSING", providerPayoutId: entity.id })
}
