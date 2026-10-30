import { randomUUID } from "node:crypto"
import { prisma } from "../prisma.ts"
import {
  ensureSystemWallets,
  getSystemWallet,
  getUserWallet,
  LedgerError,
  postEntry,
  postGroup,
  runLedgerTx,
  type EntryInput,
  type Tx,
} from "./ledgerService.ts"
import { messages, notifySuperAdmins } from "./notifyService.ts"

export const BP_TOTAL = 10000
export const DEFAULT_PLATFORM_BP = 1000 // 10%
export const DEFAULT_MANAGER_BP = 3000 // 30%
export const DEFAULT_DELAY_DAYS = 2

const DAY_MS = 24 * 60 * 60 * 1000

export type Shares = {
  grossPaise: bigint
  taxPaise: bigint
  platformPaise: bigint
  adminPaise: bigint
  managerPaise: bigint
  platformBp: number
  adminBp: number
  managerBp: number
}

/**
 * Splits what a customer paid. Tax goes to the tax wallet in full. The rest (pre-tax amount)
 * is split by percentage: manager and admin shares are rounded down and any leftover paisa
 * goes to the platform, so the four parts always add up to the amount paid.
 */
export function computeShares(grossPaise: bigint, taxPaise: bigint, platformBp: number, managerBp: number): Shares {
  if (grossPaise < 0n || taxPaise < 0n || taxPaise > grossPaise) {
    throw new LedgerError("Tax cannot exceed the amount paid", "INVALID")
  }
  const adminBp = BP_TOTAL - platformBp - managerBp
  if (platformBp < 0 || managerBp < 0 || adminBp < 0) {
    throw new LedgerError("Platform and manager percentages cannot add up to more than 100%", "INVALID")
  }
  const net = grossPaise - taxPaise
  const managerPaise = (net * BigInt(managerBp)) / BigInt(BP_TOTAL)
  const adminPaise = (net * BigInt(adminBp)) / BigInt(BP_TOTAL)
  const platformPaise = net - managerPaise - adminPaise
  return { grossPaise, taxPaise, platformPaise, adminPaise, managerPaise, platformBp, adminBp, managerBp }
}

/** Divides an amount equally between recipients. Leftover paisa go to the first recipients. */
export function splitEqually(totalPaise: bigint, recipients: string[]): Map<string, bigint> {
  const out = new Map<string, bigint>()
  if (!recipients.length) return out
  const n = BigInt(recipients.length)
  const base = totalPaise / n
  let extra = totalPaise - base * n
  for (const id of recipients) {
    const add = extra > 0n ? 1n : 0n
    if (extra > 0n) extra -= 1n
    out.set(id, base + add)
  }
  return out
}

// ---------------------------------------------------------------------------
// Settings and policy
// ---------------------------------------------------------------------------

export async function getWalletConfig() {
  const row = await prisma.walletConfig.findUnique({ where: { id: 1 } })
  return {
    platformBp: row?.platformBp ?? DEFAULT_PLATFORM_BP,
    settlementDelayDays: row?.settlementDelayDays ?? DEFAULT_DELAY_DAYS,
  }
}

/** Manager share in force for a gaushala: its own approved policy, else the default one. */
export async function getManagerBpFor(gosalaId: string): Promise<{ managerBp: number; policyKey: string; isDefault: boolean }> {
  const own = await prisma.splitPolicy.findUnique({ where: { policyKey: gosalaId } })
  if (own) return { managerBp: own.managerBp, policyKey: own.policyKey, isDefault: false }
  const def = await prisma.splitPolicy.findUnique({ where: { policyKey: "DEFAULT" } })
  return { managerBp: def?.managerBp ?? DEFAULT_MANAGER_BP, policyKey: "DEFAULT", isDefault: true }
}

// ---------------------------------------------------------------------------
// Creating a settlement when a customer pays
// ---------------------------------------------------------------------------

export type PaidBooking = {
  id: string
  gosalaId: string
  gosalaName: string
  customerId: string
  totalAmount: number // whole rupees, tax included
  taxFee: number // whole rupees
  paymentProvider?: string | null
  paymentCapturedAt?: Date | null
  createdAt?: Date
}

/**
 * Puts the customer's money in escrow and records how it will be shared. Safe to call twice
 * for the same booking. Percentages are frozen here, so later policy changes never touch it.
 */
export async function recordBookingPayment(booking: PaidBooking) {
  await ensureSystemWallets()
  const cfg = await getWalletConfig()
  const policy = await getManagerBpFor(booking.gosalaId)
  const grossPaise = BigInt(Math.round(booking.totalAmount * 100))
  const taxPaise = BigInt(Math.round(booking.taxFee * 100))
  const shares = computeShares(grossPaise, taxPaise, cfg.platformBp, policy.managerBp)
  const paidAt = booking.paymentCapturedAt ?? booking.createdAt ?? new Date()
  const source = booking.paymentProvider === "WALLET" ? "WALLET" : "RAZORPAY"

  return runLedgerTx(async (tx) => {
    const existing = await tx.bookingSettlement.findUnique({ where: { bookingId: booking.id } })
    if (existing) return { created: false, settlementId: existing.id }

    if (grossPaise > 0n) {
      const escrow = await getSystemWallet(tx, "ESCROW")
      await postEntry(tx, {
        walletId: escrow.id,
        type: "CREDIT",
        amountPaise: grossPaise,
        purpose: "ESCROW_IN",
        idempotencyKey: `escrow_in:${booking.id}`,
        bookingId: booking.id,
        referenceId: booking.id,
        description: `Customer payment held in escrow for ${booking.id}`,
        metadata: { source },
      })
    }

    const row = await tx.bookingSettlement.create({
      data: {
        bookingId: booking.id,
        gosalaId: booking.gosalaId,
        gosalaName: booking.gosalaName,
        customerId: booking.customerId,
        grossPaise: shares.grossPaise,
        taxPaise: shares.taxPaise,
        platformPaise: shares.platformPaise,
        adminPaise: shares.adminPaise,
        managerPaise: shares.managerPaise,
        platformBp: shares.platformBp,
        managerBp: shares.managerBp,
        adminBp: shares.adminBp,
        paymentSource: source,
        status: "HELD",
        paidAt,
        eligibleAt: new Date(paidAt.getTime() + cfg.settlementDelayDays * DAY_MS),
      },
    })
    return { created: true, settlementId: row.id }
  })
}

/** Records escrow for paid bookings that existed before the wallet system. Super Admin triggers it. */
export async function backfillSettlements() {
  const have = await prisma.bookingSettlement.findMany({ select: { bookingId: true } })
  const skip = new Set(have.map((h) => h.bookingId))
  const bookings = await prisma.booking.findMany({
    where: {
      isPaid: true,
      paymentStatus: "CAPTURED",
      status: { notIn: ["REJECTED", "CANCELLED"] },
    },
  })
  let created = 0
  for (const b of bookings) {
    if (skip.has(b.id)) continue
    const res = await recordBookingPayment({
      id: b.id,
      gosalaId: b.gosalaId,
      gosalaName: b.gosalaName,
      customerId: b.customerId,
      totalAmount: b.totalAmount,
      taxFee: b.taxFee,
      paymentProvider: b.paymentProvider,
      paymentCapturedAt: b.paymentCapturedAt,
      createdAt: b.createdAt,
    })
    if (res.created) created++
  }
  return { scanned: bookings.length, created }
}

// ---------------------------------------------------------------------------
// Maturity (T+2), approval, rejection, refund
// ---------------------------------------------------------------------------

/** Moves settlements whose waiting period is over into the Super Admin queue. */
export async function runMaturity(now = new Date()) {
  const due = await prisma.bookingSettlement.findMany({
    where: { status: "HELD", eligibleAt: { lte: now } },
    select: { id: true, bookingId: true, grossPaise: true },
  })
  if (!due.length) return { moved: 0 }
  const bookings = await prisma.booking.findMany({
    where: { id: { in: due.map((d) => d.bookingId) } },
    select: { id: true, status: true },
  })
  const blocked = new Set(bookings.filter((b) => b.status === "REJECTED" || b.status === "CANCELLED").map((b) => b.id))
  const ids = due.filter((d) => !blocked.has(d.bookingId)).map((d) => d.id)
  if (!ids.length) return { moved: 0 }
  const res = await prisma.bookingSettlement.updateMany({
    where: { id: { in: ids }, status: "HELD" },
    data: { status: "READY_FOR_APPROVAL", readyAt: now },
  })
  if (res.count > 0) {
    const total = due.filter((d) => ids.includes(d.id)).reduce((sum, d) => sum + BigInt(d.grossPaise), 0n)
    void notifySuperAdmins(messages.readyForApproval(res.count, total))
  }
  return { moved: res.count }
}

export type Actor = { userId: string; name: string }

async function recipientsFor(tx: Tx, gosalaId: string) {
  const gosala = await tx.gosala.findUnique({ where: { id: gosalaId } })
  if (!gosala) throw new LedgerError("Gaushala for this booking no longer exists", "INVALID")
  const admins = gosala.adminId ? [gosala.adminId] : []
  const assignments = await tx.gosalaManagerAssignment.findMany({
    where: { gosalaId, status: "Active" },
    orderBy: { assignedAt: "asc" },
  })
  const managers = assignments.map((a) => a.userId)
  return { gosala, admins, managers }
}

/**
 * Releases one settlement: escrow is debited and the tax, platform, admin and manager
 * wallets are credited together in a single transaction. Nothing moves unless all of it does.
 */
export async function approveSettlement(settlementId: string, actor: Actor, note?: string) {
  await ensureSystemWallets()
  return runLedgerTx(async (tx) => {
    const s = await tx.bookingSettlement.findUnique({ where: { id: settlementId } })
    if (!s) throw new LedgerError("Settlement not found", "INVALID")
    if (s.status === "RELEASED") return { id: s.id, replay: true, releaseGroupId: s.releaseGroupId }
    if (s.status !== "READY_FOR_APPROVAL") {
      throw new LedgerError(
        s.status === "HELD"
          ? `Not ready yet. This booking becomes eligible on ${s.eligibleAt.toLocaleDateString("en-IN")}.`
          : `Settlement is ${s.status.toLowerCase().replace(/_/g, " ")} and cannot be approved`,
        "CONFLICT",
      )
    }
    const booking = await tx.booking.findUnique({ where: { id: s.bookingId }, select: { status: true } })
    if (booking && (booking.status === "REJECTED" || booking.status === "CANCELLED")) {
      throw new LedgerError(`Booking was ${booking.status.toLowerCase()}. Refund it instead of releasing it.`, "CONFLICT")
    }

    const { gosala, admins, managers } = await recipientsFor(tx, s.gosalaId)
    if (s.adminPaise > 0n && admins.length === 0) {
      throw new LedgerError(`${gosala.name} has no Operations Admin assigned, so the admin share has nowhere to go`, "INVALID")
    }
    if (s.managerPaise > 0n && managers.length === 0) {
      throw new LedgerError(`${gosala.name} has no active Manager assigned, so the manager share has nowhere to go`, "INVALID")
    }

    // Claim the row first. A second approval at the same moment finds it already claimed.
    const claimed = await tx.bookingSettlement.updateMany({
      where: { id: s.id, status: "READY_FOR_APPROVAL" },
      data: { status: "RELEASED" },
    })
    if (claimed.count !== 1) throw new LedgerError("Settlement was already handled by someone else", "CONFLICT")

    const groupId = `rel_${s.id}`
    const escrow = await getSystemWallet(tx, "ESCROW")
    const platform = await getSystemWallet(tx, "PLATFORM")
    const tax = await getSystemWallet(tx, "TAX")
    const base = { groupId, bookingId: s.bookingId, referenceId: s.bookingId }
    const entries: EntryInput[] = [
      {
        ...base,
        walletId: escrow.id,
        type: "DEBIT",
        amountPaise: s.grossPaise,
        purpose: "ESCROW_OUT",
        idempotencyKey: `${groupId}:escrow`,
        description: `Released from escrow for ${s.bookingId}`,
      },
    ]
    if (s.taxPaise > 0n) {
      entries.push({ ...base, walletId: tax.id, type: "CREDIT", amountPaise: s.taxPaise, purpose: "TAX_COLLECTED", idempotencyKey: `${groupId}:tax`, description: `Tax collected on ${s.bookingId}` })
    }
    if (s.platformPaise > 0n) {
      entries.push({ ...base, walletId: platform.id, type: "CREDIT", amountPaise: s.platformPaise, purpose: "PLATFORM_FEE", idempotencyKey: `${groupId}:platform`, description: `Platform commission on ${s.bookingId}` })
    }
    for (const [uid, amt] of splitEqually(s.adminPaise, admins)) {
      if (amt <= 0n) continue
      const w = await getUserWallet(tx, uid)
      entries.push({ ...base, walletId: w.id, type: "CREDIT", amountPaise: amt, purpose: "SETTLEMENT_RELEASE", idempotencyKey: `${groupId}:admin:${uid}`, description: `Admin share (${s.adminBp / 100}%) for ${s.bookingId}`, metadata: { role: "ADMIN", gosala: gosala.name } })
    }
    for (const [uid, amt] of splitEqually(s.managerPaise, managers)) {
      if (amt <= 0n) continue
      const w = await getUserWallet(tx, uid)
      entries.push({ ...base, walletId: w.id, type: "CREDIT", amountPaise: amt, purpose: "SETTLEMENT_RELEASE", idempotencyKey: `${groupId}:manager:${uid}`, description: `Manager share (${s.managerBp / 100}%) for ${s.bookingId}`, metadata: { role: "MANAGER", gosala: gosala.name } })
    }
    await postGroup(tx, entries, { balanced: true })

    await tx.bookingSettlement.update({
      where: { id: s.id },
      data: {
        releaseGroupId: groupId,
        decidedById: actor.userId,
        decidedByName: actor.name,
        decidedAt: new Date(),
        decisionNote: note ?? null,
      },
    })
    return { id: s.id, replay: false, releaseGroupId: groupId }
  })
}

export async function rejectSettlement(settlementId: string, actor: Actor, note: string) {
  if (!note || !note.trim()) throw new LedgerError("A reason is required to reject a settlement", "INVALID")
  const res = await prisma.bookingSettlement.updateMany({
    where: { id: settlementId, status: { in: ["HELD", "READY_FOR_APPROVAL"] } },
    data: { status: "REJECTED", decidedById: actor.userId, decidedByName: actor.name, decidedAt: new Date(), decisionNote: note.trim() },
  })
  if (res.count !== 1) throw new LedgerError("Only held or ready settlements can be rejected", "CONFLICT")
  return { id: settlementId }
}

/** Returns the customer's money from escrow to their wallet. Only before release. */
export async function refundSettlement(settlementId: string, actor: Actor, note: string) {
  if (!note || !note.trim()) throw new LedgerError("A reason is required to refund a booking", "INVALID")
  await ensureSystemWallets()
  return runLedgerTx(async (tx) => {
    const s = await tx.bookingSettlement.findUnique({ where: { id: settlementId } })
    if (!s) throw new LedgerError("Settlement not found", "INVALID")
    if (s.status === "REFUNDED") return { id: s.id, replay: true }
    if (s.status === "RELEASED") {
      throw new LedgerError("This money was already released to wallets. It cannot be refunded from escrow.", "CONFLICT")
    }
    const claimed = await tx.bookingSettlement.updateMany({
      where: { id: s.id, status: { in: ["HELD", "READY_FOR_APPROVAL", "REJECTED"] } },
      data: { status: "REFUNDED", decidedById: actor.userId, decidedByName: actor.name, decidedAt: new Date(), decisionNote: note.trim() },
    })
    if (claimed.count !== 1) throw new LedgerError("Settlement was already handled by someone else", "CONFLICT")

    const groupId = `ref_${s.id}`
    const escrow = await getSystemWallet(tx, "ESCROW")
    const customer = await getUserWallet(tx, s.customerId)
    await postGroup(
      tx,
      [
        { walletId: escrow.id, type: "DEBIT", amountPaise: s.grossPaise, purpose: "ESCROW_OUT", idempotencyKey: `${groupId}:escrow`, groupId, bookingId: s.bookingId, referenceId: s.bookingId, description: `Refund of ${s.bookingId} from escrow` },
        { walletId: customer.id, type: "CREDIT", amountPaise: s.grossPaise, purpose: "BOOKING_REFUND", idempotencyKey: `${groupId}:customer`, groupId, bookingId: s.bookingId, referenceId: s.bookingId, description: `Refund for booking ${s.bookingId}` },
      ],
      { balanced: true },
    )
    return { id: s.id, replay: false }
  })
}

// ---------------------------------------------------------------------------
// Split policy changes (Admin proposes, Super Admin approves)
// ---------------------------------------------------------------------------

export async function validateManagerBp(managerBp: number) {
  if (!Number.isInteger(managerBp) || managerBp < 0) {
    throw new LedgerError("Manager percentage must be a whole number of basis points (30% = 3000)", "INVALID")
  }
  const { platformBp } = await getWalletConfig()
  if (platformBp + managerBp > BP_TOTAL) {
    throw new LedgerError(
      `Manager can be at most ${(BP_TOTAL - platformBp) / 100}% because the platform commission is ${platformBp / 100}%`,
      "INVALID",
    )
  }
}

export async function requestSplitChange(args: { actor: Actor; gosalaId: string; managerBp: number; reason?: string }) {
  await validateManagerBp(args.managerBp)
  const gosala = await prisma.gosala.findUnique({ where: { id: args.gosalaId } })
  if (!gosala) throw new LedgerError("Gaushala not found", "INVALID")
  const pending = await prisma.splitPolicyRequest.findFirst({ where: { policyKey: gosala.id, status: "PENDING" } })
  if (pending) throw new LedgerError("A change for this gaushala is already waiting for Super Admin approval", "CONFLICT")
  const current = await getManagerBpFor(gosala.id)
  if (current.managerBp === args.managerBp) throw new LedgerError("That is already the current manager percentage", "CONFLICT")
  return prisma.splitPolicyRequest.create({
    data: {
      policyKey: gosala.id,
      gosalaId: gosala.id,
      gosalaName: gosala.name,
      currentManagerBp: current.managerBp,
      proposedManagerBp: args.managerBp,
      requestedById: args.actor.userId,
      requestedByName: args.actor.name,
      reason: args.reason?.trim() || null,
    },
  })
}

export async function decideSplitChange(requestId: string, actor: Actor, approve: boolean, note?: string) {
  const req = await prisma.splitPolicyRequest.findUnique({ where: { id: requestId } })
  if (!req) throw new LedgerError("Request not found", "INVALID")
  if (req.status !== "PENDING") throw new LedgerError("This request was already decided", "CONFLICT")
  if (approve) await validateManagerBp(req.proposedManagerBp)
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.splitPolicyRequest.updateMany({
      where: { id: requestId, status: "PENDING" },
      data: { status: approve ? "APPROVED" : "REJECTED", decidedById: actor.userId, decidedByName: actor.name, decisionNote: note ?? null, decidedAt: new Date() },
    })
    if (claimed.count !== 1) throw new LedgerError("This request was already decided", "CONFLICT")
    if (approve) {
      await tx.splitPolicy.upsert({
        where: { policyKey: req.policyKey },
        update: { managerBp: req.proposedManagerBp, approvedById: actor.userId },
        create: { policyKey: req.policyKey, gosalaId: req.gosalaId, managerBp: req.proposedManagerBp, approvedById: actor.userId },
      })
    }
    return { id: requestId, approved: approve }
  })
}

/** Super Admin sets a policy directly (they are the approver, so no request is needed). */
export async function setSplitPolicyDirect(args: { actor: Actor; policyKey: string; managerBp: number }) {
  await validateManagerBp(args.managerBp)
  const isDefault = args.policyKey === "DEFAULT"
  if (!isDefault) {
    const g = await prisma.gosala.findUnique({ where: { id: args.policyKey } })
    if (!g) throw new LedgerError("Gaushala not found", "INVALID")
  }
  return prisma.splitPolicy.upsert({
    where: { policyKey: args.policyKey },
    update: { managerBp: args.managerBp, approvedById: args.actor.userId },
    create: { policyKey: args.policyKey, gosalaId: isDefault ? null : args.policyKey, managerBp: args.managerBp, approvedById: args.actor.userId },
  })
}

/** Platform commission. Refused if it would leave an existing manager share with no room. */
export async function setPlatformBp(platformBp: number, actor: Actor) {
  if (!Number.isInteger(platformBp) || platformBp < 0 || platformBp > BP_TOTAL) {
    throw new LedgerError("Platform percentage must be between 0% and 100%", "INVALID")
  }
  const policies = await prisma.splitPolicy.findMany()
  const worst = Math.max(0, ...policies.map((p) => p.managerBp))
  const defaultBp = policies.find((p) => p.policyKey === "DEFAULT")?.managerBp ?? DEFAULT_MANAGER_BP
  const highest = Math.max(worst, defaultBp)
  if (platformBp + highest > BP_TOTAL) {
    throw new LedgerError(
      `With ${platformBp / 100}% platform commission, a manager share of ${highest / 100}% would leave the admin with a negative share. Lower the manager percentage first.`,
      "CONFLICT",
    )
  }
  return prisma.walletConfig.upsert({
    where: { id: 1 },
    update: { platformBp, updatedById: actor.userId },
    create: { id: 1, platformBp, updatedById: actor.userId },
  })
}

export const newId = () => randomUUID()

/** Who was credited, and how much, when a settlement was released. Read back from the ledger. */
export async function getReleaseCredits(settlementId: string) {
  const s = await prisma.bookingSettlement.findUnique({ where: { id: settlementId } })
  if (!s) return null
  const rows = await prisma.walletTransaction.findMany({
    where: { groupId: `rel_${settlementId}`, purpose: "SETTLEMENT_RELEASE", type: "CREDIT" },
    include: { wallet: { select: { userId: true } } },
  })
  return {
    bookingId: s.bookingId,
    gosalaName: s.gosalaName,
    credits: rows.filter((r) => r.wallet.userId).map((r) => ({ userId: r.wallet.userId as string, amountPaise: BigInt(r.amountPaise) })),
  }
}
