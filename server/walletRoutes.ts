import crypto from "node:crypto"
import { prisma } from "./prisma.ts"
import { wsHub } from "./ws/hub.ts"
import type { JwtPayload } from "./auth/jwt.ts"
import { ensureSystemWallets, LedgerError, runLedgerTx } from "./services/ledgerService.ts"
import {
  approveSettlement,
  backfillSettlements,
  decideSplitChange,
  getReleaseCredits,
  getManagerBpFor,
  getWalletConfig,
  refundSettlement,
  rejectSettlement,
  requestSplitChange,
  runMaturity,
  setPlatformBp,
  setSplitPolicyDirect,
  BP_TOTAL,
  DEFAULT_MANAGER_BP,
  type Actor,
} from "./services/settlementService.ts"
import {
  addPayoutAccount,
  createWithdrawal,
  handlePayoutWebhook,
  listPayoutAccounts,
  listWithdrawals,
  refreshProcessing,
  removePayoutAccount,
  requestWithdrawalOtp,
} from "./services/withdrawalService.ts"
import { getPayoutProvider, payoutModeReason } from "./services/payoutProvider.ts"
import { verifyWebhookSignature } from "./services/razorpayService.ts"
import { audit } from "./services/auditService.ts"
import { messages, notifySuperAdmins, notifyUsers } from "./services/notifyService.ts"

type HandlerResponse = { status: number; body: any }

const ok = (body: any = {}, status = 200): HandlerResponse => ({ status, body: { ok: true, ...body } })
const fail = (status: number, error: string): HandlerResponse => ({ status, body: { ok: false, error } })

const rupees = (p: bigint | number) => Number(p) / 100
const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null)

function parseJson(raw: string): any {
  if (!raw) return {}
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function toPaise(value: unknown): bigint | null {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return null
  const paise = Math.round(n * 100)
  if (!Number.isSafeInteger(paise)) return null
  return BigInt(paise)
}

function actorOf(user: JwtPayload): Actor {
  return { userId: user.userId, name: user.name }
}

function serializeSettlement(s: any, extra: Record<string, unknown> = {}) {
  return {
    id: s.id,
    bookingId: s.bookingId,
    gosalaId: s.gosalaId,
    gosalaName: s.gosalaName,
    status: s.status,
    paymentSource: s.paymentSource,
    grossRupees: rupees(s.grossPaise),
    taxRupees: rupees(s.taxPaise),
    platformRupees: rupees(s.platformPaise),
    adminRupees: rupees(s.adminPaise),
    managerRupees: rupees(s.managerPaise),
    platformPct: s.platformBp / 100,
    adminPct: s.adminBp / 100,
    managerPct: s.managerBp / 100,
    paidAt: iso(s.paidAt),
    eligibleAt: iso(s.eligibleAt),
    decidedByName: s.decidedByName,
    decidedAt: iso(s.decidedAt),
    decisionNote: s.decisionNote,
    ...extra,
  }
}

function mapLedgerError(err: any): HandlerResponse {
  if (err instanceof LedgerError) {
    const status = err.code === "INSUFFICIENT_FUNDS" ? 402 : err.code === "CONFLICT" ? 409 : 400
    return fail(status, err.message)
  }
  console.error("[wallet] unexpected error:", err)
  return fail(500, "Something went wrong while handling the wallet request")
}

/** Gaushalas this user may act for. Super Admin: all. Admin: those they govern or are scoped to. */
async function gosalasFor(user: JwtPayload) {
  if (user.role === "super_admin") return prisma.gosala.findMany({ where: { isActive: true }, orderBy: { name: "asc" } })
  const scoped = [...(user.gosalaIds || []), ...(user.gosalaNames || [])]
  return prisma.gosala.findMany({
    where: {
      isActive: true,
      OR: [{ adminId: user.userId }, ...(scoped.length ? [{ id: { in: scoped } }, { name: { in: scoped } }] : [])],
    },
    orderBy: { name: "asc" },
  })
}

async function walletSummary(userId: string, role: JwtPayload["role"]) {
  // Everything below is independent, so it runs at the same time. The database is remote and
  // each query costs a round trip, so running them one by one made this screen take seconds.
  const earnsFrom = async (): Promise<string[]> => {
    if (role === "admin") return (await prisma.gosala.findMany({ where: { adminId: userId }, select: { id: true } })).map((g) => g.id)
    if (role === "manager") return (await prisma.gosalaManagerAssignment.findMany({ where: { userId, status: "Active" }, select: { gosalaId: true } })).map((a) => a.gosalaId)
    return []
  }
  const [wallet, gosalaIds, processing] = await Promise.all([
    prisma.wallet.findUnique({ where: { userId } }),
    earnsFrom(),
    prisma.withdrawalRequest.aggregate({ where: { userId, status: "PROCESSING" }, _sum: { amountPaise: true } }),
  ])
  const available = wallet ? BigInt(wallet.balancePaise) : 0n

  const [rows, txs, adminGosalas, managerCounts] = await Promise.all([
    gosalaIds.length
      ? prisma.bookingSettlement.findMany({ where: { gosalaId: { in: gosalaIds }, status: { in: ["HELD", "READY_FOR_APPROVAL"] } }, orderBy: { eligibleAt: "asc" }, take: 200 })
      : Promise.resolve([]),
    wallet ? prisma.walletTransaction.findMany({ where: { walletId: wallet.id }, orderBy: { createdAt: "desc" }, take: 40 }) : Promise.resolve([]),
    role === "admin" && gosalaIds.length ? prisma.gosala.findMany({ where: { id: { in: gosalaIds } }, select: { id: true, adminId: true } }) : Promise.resolve([]),
    role === "manager" && gosalaIds.length
      ? prisma.gosalaManagerAssignment.groupBy({ by: ["gosalaId"], where: { gosalaId: { in: gosalaIds }, status: "Active" }, _count: { _all: true } })
      : Promise.resolve([]),
  ])

  // How many people share each gaushala's admin or manager portion. An admin share goes to one admin.
  const people = new Map<string, number>()
  if (role === "admin") for (const g of adminGosalas) people.set(g.id, 1)
  else for (const c of managerCounts) people.set(c.gosalaId, Math.max(1, c._count._all))

  const earnsFromNames = gosalaIds.length
    ? (await prisma.gosala.findMany({ where: { id: { in: gosalaIds } }, select: { name: true }, orderBy: { name: "asc" } })).map((g) => g.name)
    : []

  const upcoming = rows.map((s) => {
    const total = role === "admin" ? s.adminPaise : s.managerPaise
    return {
      settlementId: s.id,
      bookingId: s.bookingId,
      gosalaName: s.gosalaName,
      status: s.status,
      myRupees: rupees(total / BigInt(people.get(s.gosalaId) ?? 1)),
      eligibleAt: iso(s.eligibleAt),
    }
  })
  const coming = upcoming.reduce((sum, u) => sum + Math.round(u.myRupees * 100), 0)
  const inTransit = processing._sum.amountPaise ? BigInt(processing._sum.amountPaise) : 0n

  return {
    earnsFrom: earnsFromNames,
    availableRupees: rupees(available),
    comingRupees: coming / 100,
    inTransitRupees: rupees(inTransit),
    upcoming,
    transactions: txs.map((t) => ({
      id: t.id,
      type: t.type,
      purpose: t.purpose,
      amountRupees: rupees(t.amountPaise),
      balanceAfterRupees: rupees(t.balanceAfter),
      bookingId: t.bookingId,
      description: t.description,
      createdAt: t.createdAt.toISOString(),
    })),
  }
}

async function notifyRole(channel: string, role: string, title: string, message: string) {
  try {
    wsHub.broadcastToChannel(channel, "ROLE_ALERT", { targetRole: role, title, message, priority: "NORMAL", timestamp: new Date().toISOString() })
  } catch {
    /* alerts are best-effort */
  }
}

export async function handleWalletRoutes(args: {
  method: string
  pathname: string
  query: URLSearchParams
  rawBody: string
  headers?: any
  authUser: JwtPayload | null
}): Promise<HandlerResponse | null> {
  const { method, pathname, query, rawBody, headers, authUser } = args

  // ---- Public: payout provider webhook and scheduled job ------------------------------------
  if (method === "POST" && pathname === "/api/webhooks/razorpayx") {
    const sig = String(headers?.["x-razorpay-signature"] || headers?.["X-Razorpay-Signature"] || "")
    const eventId = String(headers?.["x-razorpay-event-id"] || headers?.["X-Razorpay-Event-Id"] || "")
    const secret = process.env.RAZORPAYX_WEBHOOK_SECRET || process.env.RAZORPAY_WEBHOOK_SECRET
    if (!secret) return fail(503, "Webhook secret is not configured")
    if (!eventId) return fail(400, "Missing event id")
    let valid = false
    try {
      valid = verifyWebhookSignature(rawBody, sig, secret)
    } catch {
      valid = false
    }
    if (!valid) return fail(401, "Invalid webhook signature")
    try {
      await handlePayoutWebhook(eventId, parseJson(rawBody))
      return ok()
    } catch (err) {
      return mapLedgerError(err)
    }
  }

  if ((method === "GET" || method === "POST") && pathname === "/api/jobs/settlement-maturity") {
    const secret = process.env.CRON_SECRET
    const given = String(headers?.authorization || headers?.Authorization || "")
    if (!secret || given.length !== `Bearer ${secret}`.length || !crypto.timingSafeEqual(Buffer.from(given), Buffer.from(`Bearer ${secret}`))) {
      return fail(401, "Unauthorized")
    }
    const moved = await runMaturity()
    await refreshProcessing()
    return ok(moved)
  }

  if (!authUser) return null
  const isSA = authUser.role === "super_admin"
  const isAdmin = authUser.role === "admin"
  const isManager = authUser.role === "manager"

  // ---- Admin / Manager wallet ----------------------------------------------------------------
  if (method === "GET" && pathname === "/api/wallet/me") {
    if (!isAdmin && !isManager) return fail(403, "Only Operations Admins and Managers have an earnings wallet")
    try {
      const [summary, accounts, withdrawals, cfg] = await Promise.all([
        walletSummary(authUser.userId, authUser.role),
        listPayoutAccounts(authUser.userId),
        listWithdrawals(authUser.userId),
        getWalletConfig(),
        refreshProcessing(authUser.userId),
      ])
      return ok({ ...summary, accounts, withdrawals, payoutMode: getPayoutProvider().mode, payoutModeNote: payoutModeReason(), delayDays: cfg.settlementDelayDays })
    } catch (err) {
      return mapLedgerError(err)
    }
  }

  if (pathname === "/api/payout-accounts") {
    if (!isAdmin && !isManager) return fail(403, "Only Operations Admins and Managers can save payout accounts")
    try {
      if (method === "GET") return ok({ accounts: await listPayoutAccounts(authUser.userId) })
      if (method === "POST") {
        const account = await addPayoutAccount(authUser.userId, parseJson(rawBody))
        void audit({ userId: authUser.userId, name: authUser.name, role: authUser.role }, "PAYOUT_ACCOUNT_ADDED", "payout_account", account.id, { type: account.type, label: account.label })
        void notifyUsers([authUser.userId], messages.payoutAccountChanged(true, account.label))
        return ok({ account }, 201)
      }
    } catch (err) {
      return mapLedgerError(err)
    }
  }
  const acctDel = pathname.match(/^\/api\/payout-accounts\/([^/]+)$/)
  if (method === "DELETE" && acctDel) {
    if (!isAdmin && !isManager) return fail(403, "Not allowed")
    try {
      const before = (await listPayoutAccounts(authUser.userId)).find((a) => a.id === acctDel[1])
      await removePayoutAccount(authUser.userId, acctDel[1])
      void notifyUsers([authUser.userId], messages.payoutAccountChanged(false, before?.label || "a payout account"))
      void audit({ userId: authUser.userId, name: authUser.name, role: authUser.role }, "PAYOUT_ACCOUNT_REMOVED", "payout_account", acctDel[1])
      return ok()
    } catch (err) {
      return mapLedgerError(err)
    }
  }

  if (method === "POST" && pathname === "/api/withdrawals/otp") {
    if (!isAdmin && !isManager) return fail(403, "Not allowed")
    const b = parseJson(rawBody)
    const amountPaise = toPaise(b.amountRupees)
    if (!amountPaise) return fail(400, "Enter an amount greater than zero")
    try {
      const otpRes = await requestWithdrawalOtp(authUser.userId, amountPaise, String(b.payoutAccountId || ""))
      void audit({ userId: authUser.userId, name: authUser.name, role: authUser.role }, "WITHDRAWAL_CODE_SENT", "payout_account", String(b.payoutAccountId || ""), { amountRupees: b.amountRupees })
      return ok(otpRes)
    } catch (err) {
      return mapLedgerError(err)
    }
  }

  if (pathname === "/api/withdrawals") {
    if (!isAdmin && !isManager) return fail(403, "Not allowed")
    try {
      if (method === "GET") {
        await refreshProcessing(authUser.userId)
        return ok({ withdrawals: await listWithdrawals(authUser.userId, Number(query.get("limit")) || 30) })
      }
      if (method === "POST") {
        const b = parseJson(rawBody)
        const amountPaise = toPaise(b.amountRupees)
        if (!amountPaise) return fail(400, "Enter an amount greater than zero")
        const res = await createWithdrawal({
          userId: authUser.userId,
          amountPaise,
          payoutAccountId: String(b.payoutAccountId || ""),
          otp: String(b.otp || ""),
          idempotencyKey: String(b.idempotencyKey || ""),
        })
        return ok(res, res.replay ? 200 : 201)
      }
    } catch (err) {
      return mapLedgerError(err)
    }
  }

  // ---- Split policy ---------------------------------------------------------------------------
  if (method === "GET" && pathname === "/api/split-policy") {
    if (!isAdmin && !isSA) return fail(403, "Only the Operations Admin and Super Admin can view split policy")
    try {
      const [cfg, gosalas, policyRows, requests] = await Promise.all([
        getWalletConfig(),
        gosalasFor(authUser),
        prisma.splitPolicy.findMany(),
        prisma.splitPolicyRequest.findMany({ where: isSA ? {} : { requestedById: authUser.userId }, orderBy: { createdAt: "desc" }, take: 50 }),
      ])
      const byKey = new Map(policyRows.map((p) => [p.policyKey, p.managerBp]))
      const def = byKey.get("DEFAULT")
      const rows = gosalas.map((g) => {
        const own = byKey.get(g.id)
        const managerBp = own ?? def ?? DEFAULT_MANAGER_BP
        return { gosalaId: g.id, gosalaName: g.name, managerPct: managerBp / 100, adminPct: (BP_TOTAL - cfg.platformBp - managerBp) / 100, isDefault: own === undefined }
      })
      return ok({
        platformPct: cfg.platformBp / 100,
        defaultManagerPct: (def ?? DEFAULT_MANAGER_BP) / 100,
        policies: rows,
        requests: requests.map((r) => ({
          id: r.id,
          gosalaId: r.gosalaId,
          gosalaName: r.gosalaName,
          currentManagerPct: (r.currentManagerBp ?? 0) / 100,
          proposedManagerPct: r.proposedManagerBp / 100,
          status: r.status,
          requestedByName: r.requestedByName,
          reason: r.reason,
          decidedByName: r.decidedByName,
          decisionNote: r.decisionNote,
          createdAt: r.createdAt.toISOString(),
          decidedAt: iso(r.decidedAt),
        })),
      })
    } catch (err) {
      return mapLedgerError(err)
    }
  }

  if (method === "POST" && pathname === "/api/split-policy/requests") {
    if (!isAdmin) return fail(403, "Only the Operations Admin proposes manager percentages. Super Admin sets them directly.")
    const b = parseJson(rawBody)
    const managerBp = Math.round(Number(b.managerPct) * 100)
    if (!Number.isFinite(managerBp)) return fail(400, "Enter the manager percentage")
    try {
      const allowed = await gosalasFor(authUser)
      if (!allowed.some((g) => g.id === String(b.gosalaId))) return fail(403, "You can only request changes for gaushalas you govern")
      const r = await requestSplitChange({ actor: actorOf(authUser), gosalaId: String(b.gosalaId), managerBp, reason: b.reason })
      void audit({ userId: authUser.userId, name: authUser.name, role: authUser.role }, "SPLIT_CHANGE_REQUESTED", "split_request", r.id, { gosala: r.gosalaName, from: (r.currentManagerBp ?? 0) / 100, to: r.proposedManagerBp / 100, reason: r.reason })
      void notifySuperAdmins(messages.splitRequested(r.requestedByName, r.gosalaName || "a gaushala", (r.currentManagerBp ?? 0) / 100, r.proposedManagerBp / 100, r.reason))
      void notifyRole("channel:super_admin", "SUPER_ADMIN", "Manager share change waiting", `${r.requestedByName} proposed ${r.proposedManagerBp / 100}% for the manager at ${r.gosalaName}.`)
      return ok({ requestId: r.id }, 201)
    } catch (err) {
      return mapLedgerError(err)
    }
  }

  // ---- Super Admin only -----------------------------------------------------------------------
  const saPaths = pathname.startsWith("/api/superadmin/")
  if (saPaths && !isSA) return fail(403, "Only the Super Admin can do this")

  if (method === "GET" && pathname === "/api/superadmin/wallet") {
    try {
      await ensureSystemWallets()
      await runMaturity()
      const sys = await prisma.wallet.findMany({ where: { systemKey: { not: null } } })
      const bal = (k: string) => rupees(BigInt(sys.find((w) => w.systemKey === k)?.balancePaise ?? 0))
      const counts = await prisma.bookingSettlement.groupBy({ by: ["status"], _count: { _all: true }, _sum: { grossPaise: true } })
      const cfg = await getWalletConfig()
      return ok({
        escrowRupees: bal("ESCROW"),
        platformRupees: bal("PLATFORM"),
        taxRupees: bal("TAX"),
        withdrawalHoldRupees: bal("WITHDRAWAL_HOLD"),
        platformPct: cfg.platformBp / 100,
        delayDays: cfg.settlementDelayDays,
        byStatus: counts.map((c) => ({ status: c.status, count: c._count._all, grossRupees: rupees(c._sum.grossPaise ?? 0n) })),
        payoutMode: getPayoutProvider().mode,
        payoutModeNote: payoutModeReason(),
      })
    } catch (err) {
      return mapLedgerError(err)
    }
  }

  if (method === "GET" && pathname === "/api/superadmin/settlements") {
    try {
      await runMaturity()
      const status = query.get("status")
      const rows = await prisma.bookingSettlement.findMany({
        where: status ? { status: status as any } : {},
        orderBy: [{ eligibleAt: "asc" }],
        take: Math.min(Number(query.get("limit")) || 100, 300),
      })
      const bookings = await prisma.booking.findMany({
        where: { id: { in: rows.map((r) => r.bookingId) } },
        select: { id: true, status: true, customerName: true, bookingDate: true },
      })
      const byId = new Map(bookings.map((b) => [b.id, b]))
      return ok({
        settlements: rows.map((s) =>
          serializeSettlement(s, {
            bookingStatus: byId.get(s.bookingId)?.status ?? null,
            customerName: byId.get(s.bookingId)?.customerName ?? null,
            bookingDate: byId.get(s.bookingId)?.bookingDate ?? null,
          }),
        ),
      })
    } catch (err) {
      return mapLedgerError(err)
    }
  }

  if (method === "POST" && pathname === "/api/superadmin/settlements/approve") {
    const b = parseJson(rawBody)
    const ids: string[] = Array.isArray(b.ids) ? b.ids.map(String).slice(0, 100) : []
    if (!ids.length) return fail(400, "Choose at least one settlement")
    const released: string[] = []
    const failed: { id: string; error: string }[] = []
    for (const id of ids) {
      try {
        const r = await approveSettlement(id, actorOf(authUser), b.note)
        released.push(id)
        if (!r.replay) void audit({ userId: authUser.userId, name: authUser.name, role: authUser.role }, "SETTLEMENT_APPROVED", "settlement", id, { releaseGroupId: r.releaseGroupId })
        if (!r.replay) {
          void (async () => {
            const rel = await getReleaseCredits(id)
            if (!rel) return
            for (const c of rel.credits) void notifyUsers([c.userId], messages.earningsReleased(c.amountPaise, rel.bookingId, rel.gosalaName))
          })()
        }
      } catch (err: any) {
        failed.push({ id, error: err instanceof LedgerError ? err.message : "Could not release this settlement" })
        if (!(err instanceof LedgerError)) console.error("[approve]", err)
      }
    }
    if (released.length) {
      void notifyRole("channel:admin", "OPERATIONS_ADMIN", "Earnings released", `${released.length} settlement(s) were approved and credited to wallets.`)
      void notifyRole("channel:manager", "GOSALA_MANAGER", "Earnings released", `${released.length} settlement(s) were approved and credited to wallets.`)
    }
    return ok({ released, failed }, failed.length && !released.length ? 409 : 200)
  }

  const rejectMatch = pathname.match(/^\/api\/superadmin\/settlements\/([^/]+)\/(reject|refund)$/)
  if (method === "POST" && rejectMatch) {
    const b = parseJson(rawBody)
    try {
      if (rejectMatch[2] === "reject") await rejectSettlement(rejectMatch[1], actorOf(authUser), String(b.note || ""))
      else await refundSettlement(rejectMatch[1], actorOf(authUser), String(b.note || ""))
      void audit({ userId: authUser.userId, name: authUser.name, role: authUser.role }, rejectMatch[2] === "reject" ? "SETTLEMENT_REJECTED" : "SETTLEMENT_REFUNDED", "settlement", rejectMatch[1], { note: String(b.note || "") })
      return ok()
    } catch (err) {
      return mapLedgerError(err)
    }
  }

  if (method === "POST" && pathname === "/api/superadmin/settlements/backfill") {
    try {
      const res = await backfillSettlements()
      void audit({ userId: authUser.userId, name: authUser.name, role: authUser.role }, "SETTLEMENTS_IMPORTED", "settlement", null, res)
      return ok(res)
    } catch (err) {
      return mapLedgerError(err)
    }
  }

  if (method === "PUT" && pathname === "/api/superadmin/wallet-config") {
    const b = parseJson(rawBody)
    try {
      const row = await setPlatformBp(Math.round(Number(b.platformPct) * 100), actorOf(authUser))
      void audit({ userId: authUser.userId, name: authUser.name, role: authUser.role }, "PLATFORM_PERCENT_CHANGED", "wallet_config", "1", { platformPct: row.platformBp / 100 })
      return ok({ platformPct: row.platformBp / 100 })
    } catch (err) {
      return mapLedgerError(err)
    }
  }

  if (method === "PUT" && pathname === "/api/superadmin/split-policy") {
    const b = parseJson(rawBody)
    try {
      await setSplitPolicyDirect({ actor: actorOf(authUser), policyKey: String(b.policyKey || "DEFAULT"), managerBp: Math.round(Number(b.managerPct) * 100) })
      void audit({ userId: authUser.userId, name: authUser.name, role: authUser.role }, "SPLIT_POLICY_SET", "split_policy", String(b.policyKey || "DEFAULT"), { managerPct: Number(b.managerPct) })
      return ok()
    } catch (err) {
      return mapLedgerError(err)
    }
  }

  const decideMatch = pathname.match(/^\/api\/superadmin\/split-requests\/([^/]+)\/decide$/)
  if (method === "POST" && decideMatch) {
    const b = parseJson(rawBody)
    try {
      await decideSplitChange(decideMatch[1], actorOf(authUser), b.approve === true, b.note)
      void (async () => {
        const req = await prisma.splitPolicyRequest.findUnique({ where: { id: decideMatch[1] } })
        if (req) void notifyUsers([req.requestedById], messages.splitDecided(req.gosalaName || "your gaushala", req.proposedManagerBp / 100, b.approve === true, b.note))
      })()
      void audit({ userId: authUser.userId, name: authUser.name, role: authUser.role }, b.approve === true ? "SPLIT_CHANGE_APPROVED" : "SPLIT_CHANGE_DECLINED", "split_request", decideMatch[1], { note: b.note ?? null })
      return ok()
    } catch (err) {
      return mapLedgerError(err)
    }
  }

  if (method === "GET" && pathname === "/api/superadmin/audit-log") {
    try {
      const rows = await prisma.walletAuditLog.findMany({ orderBy: { createdAt: "desc" }, take: Math.min(Number(query.get("limit")) || 200, 500) })
      return ok({ entries: rows.map((r) => ({ id: r.id, at: r.createdAt.toISOString(), actor: r.actorName, role: r.actorRole, action: r.action, targetType: r.targetType, targetId: r.targetId, details: r.details })) })
    } catch (err: any) {
      if (err?.code === "P2021" || /wallet_audit_logs/.test(String(err?.message))) {
        return fail(503, "The audit log table has not been created yet. Run: npx prisma db execute --file prisma/sql/2_wallet_hardening.sql")
      }
      return mapLedgerError(err)
    }
  }

  if (method === "GET" && pathname === "/api/superadmin/reconciliation") {
    try {
      return ok(await reconcile())
    } catch (err) {
      return mapLedgerError(err)
    }
  }

  return null
}

/**
 * Proves the books agree with themselves:
 *  1. every wallet balance equals the sum of its entries
 *  2. every release/refund/withdrawal group nets to zero
 *  3. escrow equals the money still waiting in unreleased settlements
 */
export async function reconcile() {
  const wallets = await prisma.wallet.findMany()
  const sums = await prisma.walletTransaction.groupBy({ by: ["walletId", "type"], where: { status: "SUCCESS" }, _sum: { amountPaise: true } })
  const delta = new Map<string, bigint>()
  for (const s of sums) {
    const v = s._sum.amountPaise ? BigInt(s._sum.amountPaise) : 0n
    delta.set(s.walletId, (delta.get(s.walletId) ?? 0n) + (s.type === "CREDIT" ? v : -v))
  }
  const walletMismatches = wallets
    .filter((w) => BigInt(w.balancePaise) !== (delta.get(w.id) ?? 0n))
    .map((w) => ({ walletId: w.id, kind: w.kind, storedRupees: rupees(BigInt(w.balancePaise)), fromEntriesRupees: rupees(delta.get(w.id) ?? 0n) }))

  // Filter group names in code: in a SQL LIKE pattern "_" matches any character, which would
  // wrongly pull in "wdc_" (paid withdrawals, which are meant to leave the system) with "wd_".
  const allGroups = await prisma.walletTransaction.groupBy({
    by: ["groupId", "type"],
    where: { groupId: { not: null }, status: "SUCCESS" },
    _sum: { amountPaise: true },
  })
  const mustBalance = /^(rel_|ref_|wd_)/
  const net = new Map<string, bigint>()
  for (const r of allGroups) {
    if (!r.groupId || !mustBalance.test(r.groupId)) continue
    const v = r._sum.amountPaise ? BigInt(r._sum.amountPaise) : 0n
    net.set(r.groupId, (net.get(r.groupId) ?? 0n) + (r.type === "CREDIT" ? v : -v))
  }
  const unbalancedGroups = [...net.entries()].filter(([, v]) => v !== 0n).map(([groupId, v]) => ({ groupId, differenceRupees: rupees(v) }))

  const escrow = wallets.find((w) => w.systemKey === "ESCROW")
  const waiting = await prisma.bookingSettlement.aggregate({
    where: { status: { in: ["HELD", "READY_FOR_APPROVAL", "REJECTED"] } },
    _sum: { grossPaise: true },
  })
  const escrowBal = escrow ? BigInt(escrow.balancePaise) : 0n
  const waitingPaise = waiting._sum.grossPaise ? BigInt(waiting._sum.grossPaise) : 0n

  return {
    walletMismatches,
    unbalancedGroups,
    escrow: { balanceRupees: rupees(escrowBal), waitingSettlementsRupees: rupees(waitingPaise), matches: escrowBal === waitingPaise },
    healthy: walletMismatches.length === 0 && unbalancedGroups.length === 0 && escrowBal === waitingPaise,
  }
}

// Exposed for tests
export const __test = { runLedgerTx }
