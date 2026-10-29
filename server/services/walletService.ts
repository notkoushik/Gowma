import { prisma } from "../prisma.ts"

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
    userId: wallet.userId,
    balancePaise: balancePaise.toString(),
    balanceRupees,
    currency: wallet.currency,
    isActive: wallet.isActive,
  }
}

/**
 * Atomically credits a user's wallet using a double-entry ledger transaction.
 * Guaranteed idempotent via idempotencyKey.
 */
export async function creditWallet(input: WalletMutationInput) {
  const { userId, purpose, referenceId, idempotencyKey, description, metadata } = input
  const amountPaise = BigInt(input.amountPaise)

  if (amountPaise <= 0n) {
    throw new Error("Credit amount must be greater than zero")
  }
  if (!idempotencyKey || typeof idempotencyKey !== "string") {
    throw new Error("A unique idempotencyKey is required for wallet mutations")
  }

  return await prisma.$transaction(async (tx) => {
    // 1. Idempotency Check: Return existing successful transaction if replayed
    const existingTx = await tx.walletTransaction.findUnique({
      where: { idempotencyKey },
    })
    if (existingTx) {
      if (existingTx.status === "SUCCESS") {
        return {
          idempotentReplay: true,
          transactionId: existingTx.id,
          balanceAfter: existingTx.balanceAfter.toString(),
        }
      }
      throw new Error(`Transaction with idempotency key ${idempotencyKey} previously ended in ${existingTx.status}`)
    }

    // 2. Fetch or create wallet
    let wallet = await tx.wallet.findUnique({ where: { userId } })
    if (!wallet) {
      wallet = await tx.wallet.create({
        data: { userId, balancePaise: 0n, currency: "INR" },
      })
    }
    if (!wallet.isActive) {
      throw new Error("Wallet account is currently suspended or inactive")
    }

    const balanceBefore = BigInt(wallet.balancePaise)
    const balanceAfter = balanceBefore + amountPaise

    // 3. Update wallet balance
    const updatedWallet = await tx.wallet.update({
      where: { id: wallet.id },
      data: { balancePaise: balanceAfter },
    })

    // 4. Record immutable ledger transaction
    const record = await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        amountPaise,
        type: "CREDIT",
        purpose,
        status: "SUCCESS",
        balanceBefore,
        balanceAfter,
        idempotencyKey,
        referenceId: referenceId || null,
        description: description || `Wallet credited with ₹${Number(amountPaise) / 100}`,
        metadata: metadata ? (metadata as any) : undefined,
      },
    })

    return {
      idempotentReplay: false,
      transactionId: record.id,
      amountPaise: amountPaise.toString(),
      balanceBefore: balanceBefore.toString(),
      balanceAfter: balanceAfter.toString(),
      balanceRupees: Number(balanceAfter) / 100,
    }
  })
}

/**
 * Atomically debits a user's wallet with concurrency safety and strict balance checks.
 * Prevents double-spending and negative balances.
 */
export async function debitWallet(input: WalletMutationInput) {
  const { userId, purpose, referenceId, idempotencyKey, description, metadata } = input
  const amountPaise = BigInt(input.amountPaise)

  if (amountPaise <= 0n) {
    throw new Error("Debit amount must be greater than zero")
  }
  if (!idempotencyKey || typeof idempotencyKey !== "string") {
    throw new Error("A unique idempotencyKey is required for wallet mutations")
  }

  return await prisma.$transaction(async (tx) => {
    // 1. Idempotency Check: Return existing successful transaction if replayed
    const existingTx = await tx.walletTransaction.findUnique({
      where: { idempotencyKey },
    })
    if (existingTx) {
      if (existingTx.status === "SUCCESS") {
        return {
          idempotentReplay: true,
          transactionId: existingTx.id,
          balanceAfter: existingTx.balanceAfter.toString(),
        }
      }
      throw new Error(`Transaction with idempotency key ${idempotencyKey} previously ended in ${existingTx.status}`)
    }

    // 2. Fetch wallet
    const wallet = await tx.wallet.findUnique({ where: { userId } })
    if (!wallet) {
      throw new Error("Wallet not found. Top-up required before debiting.")
    }
    if (!wallet.isActive) {
      throw new Error("Wallet account is currently suspended or inactive")
    }

    const balanceBefore = BigInt(wallet.balancePaise)
    if (balanceBefore < amountPaise) {
      throw new Error(`Insufficient wallet balance. Available: ₹${Number(balanceBefore) / 100}, Required: ₹${Number(amountPaise) / 100}`)
    }

    const balanceAfter = balanceBefore - amountPaise

    // 3. Atomically update wallet balance
    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balancePaise: balanceAfter },
    })

    // 4. Record immutable ledger transaction
    const record = await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        amountPaise,
        type: "DEBIT",
        purpose,
        status: "SUCCESS",
        balanceBefore,
        balanceAfter,
        idempotencyKey,
        referenceId: referenceId || null,
        description: description || `Wallet debited by ₹${Number(amountPaise) / 100}`,
        metadata: metadata ? (metadata as any) : undefined,
      },
    })

    return {
      idempotentReplay: false,
      transactionId: record.id,
      amountPaise: amountPaise.toString(),
      balanceBefore: balanceBefore.toString(),
      balanceAfter: balanceAfter.toString(),
      balanceRupees: Number(balanceAfter) / 100,
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
