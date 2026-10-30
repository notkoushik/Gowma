-- Second layer of protection: the database itself refuses money states that should never exist,
-- even if a bug in the app tried to write one. Safe to run more than once.

-- Audit log: who approved, rejected, refunded, changed a percentage or moved money
CREATE TABLE IF NOT EXISTS "wallet_audit_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "wallet_audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "wallet_audit_logs_createdAt_idx" ON "wallet_audit_logs"("createdAt");
CREATE INDEX IF NOT EXISTS "wallet_audit_logs_actorId_idx" ON "wallet_audit_logs"("actorId");
CREATE INDEX IF NOT EXISTS "wallet_audit_logs_targetType_targetId_idx" ON "wallet_audit_logs"("targetType", "targetId");

-- A wallet can never go below zero
DO $$ BEGIN
  ALTER TABLE "wallets" ADD CONSTRAINT "wallets_balance_not_negative" CHECK ("balancePaise" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Every ledger entry and withdrawal is for a positive amount
DO $$ BEGIN
  ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_amount_positive" CHECK ("amountPaise" > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_amount_positive" CHECK ("amountPaise" > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- A settlement's four parts always add up to what the customer paid
DO $$ BEGIN
  ALTER TABLE "booking_settlements" ADD CONSTRAINT "booking_settlements_parts_add_up"
    CHECK ("taxPaise" + "platformPaise" + "adminPaise" + "managerPaise" = "grossPaise"
           AND "taxPaise" >= 0 AND "platformPaise" >= 0 AND "adminPaise" >= 0 AND "managerPaise" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Percentages stay between 0% and 100%
DO $$ BEGIN
  ALTER TABLE "split_policies" ADD CONSTRAINT "split_policies_bp_range" CHECK ("managerBp" >= 0 AND "managerBp" <= 10000);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "wallet_config" ADD CONSTRAINT "wallet_config_bp_range" CHECK ("platformBp" >= 0 AND "platformBp" <= 10000 AND "settlementDelayDays" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
