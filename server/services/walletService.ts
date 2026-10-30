import { prisma } from "../prisma.ts"
import { getUserWallet, postEntry, runLedgerTx } from "./ledgerService.ts"

export type WalletBalanceResponse = {
  walletId: string
  userId: string
  balancePaise: string
  balanceRupees: number
  currency: string
  isActive: boolean
}

export type WalletMutationInput = {
  userId: string
  amountPaise: bigint | number
  purpose: "TOPUP" | "BOOKING_PAYMENT" | "BOOKING_REFUND" | "GAUSHALA_SETTLEMENT" | "CASHBACK" | "ADJUSTMENT"
  referenceId?: string
  idempotencyKey: string
  description?: string
  metadata?: Record<string, unknown>
}

/**
 * Ensures a user has a wallet record. Creates one atomically if absent.
 */
export async function getOrCreateWallet(userId: string) {
  if (!userId) throw new Error("User ID is required to access wallet")

  const existing = await prisma.wallet.findUnique({
    where: { userId },
  })
  if (existing) return existing

  try {
    return await prisma.wallet.create({
      data: {
        userId,
        balancePaise: 0n,
        currency: "INR",
        isActive: true,
      },
    })
  } catch (err: any) {
    // In case of a race condition on creation, fetch the one created by concurrent request
    const retry = await prisma.wallet.findUnique({ where: { userId } })
    if (retry) return retry
    throw err
  }
}

/**
 * Retrieves the current balance and active status of a user's wallet.
 */
export async function getWalletBalance(userId: string): Promise<WalletBalanceResponse> {
  const wallet = await getOrCreateWallet(userId)
  const balancePaise = BigInt(wallet.balancePaise)
  const balanceRupees = Number(balancePaise) / 100

  return {
    walletId: wallet.id,
    userId: wallet.userId ?? userId,
    balancePaise: balancePaise.toString(),
    balanceRupees,
    currency: wallet.currency,
    isActive: wallet.isActive,
  }
}

/**
 * Credits a user's wallet. Idempotent through idempotencyKey.
 */
export async function creditWallet(input: WalletMutationInput) {
  const { userId, purpose, referenceId, idempotencyKey, description, metadata } = input
  const amountPaise = BigInt(input.amountPaise)
  if (amountPaise <= 0n) throw new Error("Credit amount must be greater than zero")
  if (!idempotencyKey || typeof idempotencyKey !== "string") {
    throw new Error("A unique idempotencyKey is required for wallet mutations")
  }

  return await runLedgerTx(async (tx) => {
    const wallet = await getUserWallet(tx, userId)
    const entry = await postEntry(tx, {
      walletId: wallet.id,
      type: "CREDIT",
      amountPaise,
      purpose,
      idempotencyKey,
      referenceId,
      description: description || `Wallet credited with ₹${Number(amountPaise) / 100}`,
      metadata,
    })
    if (entry.replay) {
      return { idempotentReplay: true, transactionId: entry.id, balanceAfter: entry.balanceAfter.toString() }
    }
    return {
      idempotentReplay: false,
      transactionId: entry.id,
      amountPaise: amountPaise.toString(),
      balanceBefore: entry.balanceBefore.toString(),
      balanceAfter: entry.balanceAfter.toString(),
      balanceRupees: Number(entry.balanceAfter) / 100,
    }
  })
}

/**
 * Debits a user's wallet with one guarded update, so concurrent debits cannot overspend
 * and the balance can never go negative.
 */
export async function debitWallet(input: WalletMutationInput) {
  const { userId, purpose, referenceId, idempotencyKey, description, metadata } = input
  const amountPaise = BigInt(input.amountPaise)
  if (amountPaise <= 0n) throw new Error("Debit amount must be greater than zero")
  if (!idempotencyKey || typeof idempotencyKey !== "string") {
    throw new Error("A unique idempotencyKey is required for wallet mutations")
  }

  return await runLedgerTx(async (tx) => {
    const wallet = await tx.wallet.findUnique({ where: { userId } })
    if (!wallet) throw new Error("Wallet not found. Top-up required before debiting.")
    const entry = await postEntry(tx, {
      walletId: wallet.id,
      type: "DEBIT",
      amountPaise,
      purpose,
      idempotencyKey,
      referenceId,
      description: description || `Wallet debited by ₹${Number(amountPaise) / 100}`,
      metadata,
    })
    if (entry.replay) {
      return { idempotentReplay: true, transactionId: entry.id, balanceAfter: entry.balanceAfter.toString() }
    }
    return {
      idempotentReplay: false,
      transactionId: entry.id,
      amountPaise: amountPaise.toString(),
      balanceBefore: entry.balanceBefore.toString(),
      balanceAfter: entry.balanceAfter.toString(),
      balanceRupees: Number(entry.balanceAfter) / 100,
    }
  })
}

/**
 * Retrieves transaction history for a user's wallet.
 */
export async function getWalletTransactions(userId: string, limit = 50) {
  const wallet = await getOrCreateWallet(userId)

  const transactions = await prisma.walletTransaction.findMany({
    where: { walletId: wallet.id },
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 100),
  })

  return transactions.map((t) => ({
    id: t.id,
    amountPaise: t.amountPaise.toString(),
    amountRupees: Number(t.amountPaise) / 100,
    type: t.type,
    purpose: t.purpose,
    status: t.status,
    balanceBefore: t.balanceBefore.toString(),
    balanceAfter: t.balanceAfter.toString(),
    referenceId: t.referenceId,
    description: t.description,
    createdAt: t.createdAt.toISOString(),
  }))
}
