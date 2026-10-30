-- CreateEnum
CREATE TYPE "WalletTransactionType" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "WalletTransactionPurpose" AS ENUM ('TOPUP', 'BOOKING_PAYMENT', 'BOOKING_REFUND', 'GAUSHALA_SETTLEMENT', 'CASHBACK', 'ADJUSTMENT', 'ESCROW_IN', 'ESCROW_OUT', 'TAX_COLLECTED', 'PLATFORM_FEE', 'SETTLEMENT_RELEASE', 'WITHDRAWAL_HOLD', 'WITHDRAWAL_PAID', 'WITHDRAWAL_REVERSAL');

-- CreateEnum
CREATE TYPE "WalletKind" AS ENUM ('USER', 'ESCROW', 'PLATFORM', 'TAX', 'WITHDRAWAL_HOLD');

-- CreateEnum
CREATE TYPE "BookingSettlementStatus" AS ENUM ('HELD', 'READY_FOR_APPROVAL', 'RELEASED', 'REJECTED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "SplitRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PayoutAccountType" AS ENUM ('BANK', 'UPI');

-- CreateEnum
CREATE TYPE "WithdrawalStatus" AS ENUM ('PROCESSING', 'PAID', 'FAILED');

-- CreateEnum
CREATE TYPE "WalletTransactionStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REVERSED');

-- AlterTable
ALTER TABLE "empanelled_vets" ADD COLUMN     "gosalaId" TEXT;

-- CreateTable
CREATE TABLE "wallets" (
    "id" TEXT NOT NULL,
    "kind" "WalletKind" NOT NULL DEFAULT 'USER',
    "systemKey" TEXT,
    "userId" TEXT,
    "balancePaise" BIGINT NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_transactions" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "amountPaise" BIGINT NOT NULL,
    "type" "WalletTransactionType" NOT NULL,
    "purpose" "WalletTransactionPurpose" NOT NULL,
    "status" "WalletTransactionStatus" NOT NULL DEFAULT 'PENDING',
    "balanceBefore" BIGINT NOT NULL,
    "balanceAfter" BIGINT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "referenceId" TEXT,
    "groupId" TEXT,
    "bookingId" TEXT,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_config" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "platformBp" INTEGER NOT NULL DEFAULT 1000,
    "settlementDelayDays" INTEGER NOT NULL DEFAULT 2,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallet_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "split_policies" (
    "id" TEXT NOT NULL,
    "policyKey" TEXT NOT NULL,
    "gosalaId" TEXT,
    "managerBp" INTEGER NOT NULL,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "split_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "split_policy_requests" (
    "id" TEXT NOT NULL,
    "policyKey" TEXT NOT NULL,
    "gosalaId" TEXT,
    "gosalaName" TEXT,
    "currentManagerBp" INTEGER,
    "proposedManagerBp" INTEGER NOT NULL,
    "status" "SplitRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "requestedByName" TEXT NOT NULL,
    "reason" TEXT,
    "decidedById" TEXT,
    "decidedByName" TEXT,
    "decisionNote" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "split_policy_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_settlements" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "gosalaId" TEXT NOT NULL,
    "gosalaName" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "grossPaise" BIGINT NOT NULL,
    "taxPaise" BIGINT NOT NULL,
    "platformPaise" BIGINT NOT NULL,
    "adminPaise" BIGINT NOT NULL,
    "managerPaise" BIGINT NOT NULL,
    "platformBp" INTEGER NOT NULL,
    "managerBp" INTEGER NOT NULL,
    "adminBp" INTEGER NOT NULL,
    "paymentSource" TEXT NOT NULL,
    "status" "BookingSettlementStatus" NOT NULL DEFAULT 'HELD',
    "paidAt" TIMESTAMP(3) NOT NULL,
    "eligibleAt" TIMESTAMP(3) NOT NULL,
    "readyAt" TIMESTAMP(3),
    "decidedById" TEXT,
    "decidedByName" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "releaseGroupId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booking_settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payout_accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "PayoutAccountType" NOT NULL,
    "holderName" TEXT NOT NULL,
    "accountLast4" TEXT,
    "ifsc" TEXT,
    "vpa" TEXT,
    "accountNumberEnc" TEXT,
    "providerContactId" TEXT,
    "providerFundAccountId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "usableFrom" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payout_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "withdrawal_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "payoutAccountId" TEXT NOT NULL,
    "amountPaise" BIGINT NOT NULL,
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'PROCESSING',
    "mode" TEXT NOT NULL DEFAULT 'SANDBOX',
    "providerPayoutId" TEXT,
    "utr" TEXT,
    "failureReason" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "withdrawal_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "withdrawal_otps" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "otpHash" TEXT NOT NULL,
    "amountPaise" BIGINT NOT NULL,
    "payoutAccountId" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "withdrawal_otps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_events" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wallets_systemKey_key" ON "wallets"("systemKey");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_userId_key" ON "wallets"("userId");

-- CreateIndex
CREATE INDEX "wallets_userId_idx" ON "wallets"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_transactions_idempotencyKey_key" ON "wallet_transactions"("idempotencyKey");

-- CreateIndex
CREATE INDEX "wallet_transactions_walletId_createdAt_idx" ON "wallet_transactions"("walletId", "createdAt");

-- CreateIndex
CREATE INDEX "wallet_transactions_referenceId_idx" ON "wallet_transactions"("referenceId");

-- CreateIndex
CREATE INDEX "wallet_transactions_groupId_idx" ON "wallet_transactions"("groupId");

-- CreateIndex
CREATE INDEX "wallet_transactions_bookingId_idx" ON "wallet_transactions"("bookingId");

-- CreateIndex
CREATE INDEX "wallet_transactions_purpose_status_idx" ON "wallet_transactions"("purpose", "status");

-- CreateIndex
CREATE UNIQUE INDEX "split_policies_policyKey_key" ON "split_policies"("policyKey");

-- CreateIndex
CREATE INDEX "split_policy_requests_status_idx" ON "split_policy_requests"("status");

-- CreateIndex
CREATE INDEX "split_policy_requests_policyKey_idx" ON "split_policy_requests"("policyKey");

-- CreateIndex
CREATE UNIQUE INDEX "booking_settlements_bookingId_key" ON "booking_settlements"("bookingId");

-- CreateIndex
CREATE INDEX "booking_settlements_status_eligibleAt_idx" ON "booking_settlements"("status", "eligibleAt");

-- CreateIndex
CREATE INDEX "booking_settlements_gosalaId_idx" ON "booking_settlements"("gosalaId");

-- CreateIndex
CREATE INDEX "payout_accounts_userId_idx" ON "payout_accounts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "withdrawal_requests_idempotencyKey_key" ON "withdrawal_requests"("idempotencyKey");

-- CreateIndex
CREATE INDEX "withdrawal_requests_userId_requestedAt_idx" ON "withdrawal_requests"("userId", "requestedAt");

-- CreateIndex
CREATE INDEX "withdrawal_requests_status_idx" ON "withdrawal_requests"("status");

-- CreateIndex
CREATE INDEX "withdrawal_otps_userId_used_idx" ON "withdrawal_otps"("userId", "used");

-- CreateIndex
CREATE UNIQUE INDEX "provider_events_eventId_key" ON "provider_events"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_paymentId_key" ON "bookings"("paymentId");

-- CreateIndex
CREATE INDEX "empanelled_vets_gosalaId_idx" ON "empanelled_vets"("gosalaId");

-- AddForeignKey
ALTER TABLE "empanelled_vets" ADD CONSTRAINT "empanelled_vets_gosalaId_fkey" FOREIGN KEY ("gosalaId") REFERENCES "gosalas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

