import { Prisma } from "@prisma/client"
import { prisma } from "../prisma.ts"

export type Tx = Prisma.TransactionClient

export type SystemWalletKey = "ESCROW" | "PLATFORM" | "TAX" | "WITHDRAWAL_HOLD"

export type EntryPurpose =
  | "TOPUP"
  | "BOOKING_PAYMENT"
  | "BOOKING_REFUND"
  | "GAUSHALA_SETTLEMENT"
  | "CASHBACK"
  | "ADJUSTMENT"
  | "ESCROW_IN"
  | "ESCROW_OUT"
  | "TAX_COLLECTED"
  | "PLATFORM_FEE"
  | "SETTLEMENT_RELEASE"
  | "WITHDRAWAL_HOLD"
  | "WITHDRAWAL_PAID"
  | "WITHDRAWAL_REVERSAL"

export type EntryInput = {
  walletId: string
  type: "CREDIT" | "DEBIT"
  amountPaise: bigint
  purpose: EntryPurpose
  idempotencyKey: string
  groupId?: string
  bookingId?: string
  referenceId?: string
  description?: string
  metadata?: Record<string, unknown>
}

export type EntryResult = {
  id: string
  replay: boolean
  balanceBefore: bigint
  balanceAfter: bigint
}

export class LedgerError extends Error {
  constructor(
    message: string,
    public code: "INSUFFICIENT_FUNDS" | "WALLET_INACTIVE" | "INVALID" | "CONFLICT",
  ) {
    super(message)
  }
}

export const formatRupees = (paise: bigint | number) => `₹${(Number(paise) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`

// Generous on purpose: one approval makes dozens of queries, and a far-away database (about 0.5s per query) must not abort it midway
const TX_OPTIONS = { timeout: 120000, maxWait: 20000 } as const

/**
 * Runs a ledger transaction. If two requests race on the same idempotency key (or
 * Postgres reports a serialization conflict) the loser retries and sees the winner's rows.
 */
export async function runLedgerTx<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  let lastErr: unknown
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(fn, TX_OPTIONS)
    } catch (err: any) {
      lastErr = err
      const code = err?.code
      if (code === "P2002" || code === "P2034") continue
      throw err
    }
  }
  throw lastErr
}

/** System wallets (escrow, platform, tax, withdrawal hold) are created on first use. */
export async function getSystemWallet(tx: Tx, key: SystemWalletKey) {
  const existing = await tx.wallet.findUnique({ where: { systemKey: key } })
  if (existing) return existing
  try {
    return await tx.wallet.create({ data: { kind: key, systemKey: key, userId: null } })
  } catch (err: any) {
    // Lost a creation race. The failed insert poisons this transaction, so let the caller retry.
    if (err?.code === "P2002") throw err
    throw err
  }
}

export async function getUserWallet(tx: Tx, userId: string) {
  if (!userId) throw new LedgerError("User ID is required to access a wallet", "INVALID")
  // One atomic INSERT ... ON CONFLICT, so simultaneous first uses cannot collide.
  return tx.wallet.upsert({ where: { userId }, update: {}, create: { kind: "USER", userId } })
}

/**
 * Writes one ledger entry. The balance is changed by a single guarded UPDATE, so two
 * parallel debits can never both pass the balance check.
 */
export async function postEntry(tx: Tx, e: EntryInput): Promise<EntryResult> {
  if (typeof e.amountPaise !== "bigint" || e.amountPaise <= 0n) {
    throw new LedgerError("Amount must be a positive number of paise", "INVALID")
  }
  if (!e.idempotencyKey) throw new LedgerError("An idempotencyKey is required", "INVALID")

  const existing = await tx.walletTransaction.findUnique({ where: { idempotencyKey: e.idempotencyKey } })
  if (existing) {
    if (existing.status !== "SUCCESS") {
      throw new LedgerError(`Entry ${e.idempotencyKey} previously ended in ${existing.status}`, "CONFLICT")
    }
    return {
      id: existing.id,
      replay: true,
      balanceBefore: BigInt(existing.balanceBefore),
      balanceAfter: BigInt(existing.balanceAfter),
    }
  }

  let changed: { count: number }
  if (e.type === "CREDIT") {
    changed = await tx.wallet.updateMany({
      where: { id: e.walletId, isActive: true },
      data: { balancePaise: { increment: e.amountPaise } },
    })
  } else {
    changed = await tx.wallet.updateMany({
      where: { id: e.walletId, isActive: true, balancePaise: { gte: e.amountPaise } },
      data: { balancePaise: { decrement: e.amountPaise } },
    })
  }

  if (changed.count === 0) {
    const w = await tx.wallet.findUnique({ where: { id: e.walletId } })
    if (!w) throw new LedgerError("Wallet not found", "INVALID")
    if (!w.isActive) throw new LedgerError("Wallet account is suspended or inactive", "WALLET_INACTIVE")
    throw new LedgerError(
      `Insufficient wallet balance. Available: ${formatRupees(BigInt(w.balancePaise))}, required: ${formatRupees(e.amountPaise)}`,
      "INSUFFICIENT_FUNDS",
    )
  }

  // The row is locked by the UPDATE above until this transaction ends, so this read is exact.
  const after = BigInt((await tx.wallet.findUniqueOrThrow({ where: { id: e.walletId } })).balancePaise)
  const before = e.type === "CREDIT" ? after - e.amountPaise : after + e.amountPaise

  const row = await tx.walletTransaction.create({
    data: {
      walletId: e.walletId,
      amountPaise: e.amountPaise,
      type: e.type,
      purpose: e.purpose,
      status: "SUCCESS",
      balanceBefore: before,
      balanceAfter: after,
      idempotencyKey: e.idempotencyKey,
      groupId: e.groupId ?? null,
      bookingId: e.bookingId ?? null,
      referenceId: e.referenceId ?? null,
      description: e.description ?? null,
      metadata: e.metadata ? (e.metadata as Prisma.InputJsonValue) : undefined,
    },
  })
  return { id: row.id, replay: false, balanceBefore: before, balanceAfter: after }
}

/**
 * Posts several entries as one event. With `balanced: true` the credits and debits must
 * match exactly, which is what keeps internal moves from creating or losing money.
 * Entries are applied in wallet order so concurrent groups cannot deadlock each other.
 */
export async function postGroup(tx: Tx, entries: EntryInput[], opts: { balanced?: boolean } = {}) {
  if (!entries.length) throw new LedgerError("A ledger group needs at least one entry", "INVALID")
  if (opts.balanced) {
    let credit = 0n
    let debit = 0n
    for (const e of entries) {
      if (e.type === "CREDIT") credit += e.amountPaise
      else debit += e.amountPaise
    }
    if (credit !== debit) {
      throw new LedgerError(
        `Unbalanced ledger group: credits ${formatRupees(credit)} vs debits ${formatRupees(debit)}`,
        "INVALID",
      )
    }
  }
  const ordered = [...entries].sort((a, b) => (a.walletId < b.walletId ? -1 : a.walletId > b.walletId ? 1 : 0))
  const results: EntryResult[] = []
  for (const e of ordered) results.push(await postEntry(tx, e))
  return results
}

let systemWalletsReady = false
/** Creates the four system wallets once per process, outside any transaction. */
export async function ensureSystemWallets() {
  if (systemWalletsReady) return
  for (const key of ["ESCROW", "PLATFORM", "TAX", "WITHDRAWAL_HOLD"] as SystemWalletKey[]) {
    await prisma.wallet.upsert({
      where: { systemKey: key },
      update: {},
      create: { kind: key, systemKey: key },
    })
  }
  systemWalletsReady = true
}
