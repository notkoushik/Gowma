// server/prisma.ts
import { PrismaClient } from "@prisma/client";
var dbUrl = process.env.POSTGRES_PRISMA_URL || process.env.STORAGE_POSTGRES_PRISMA_URL || process.env.DATABASE_PRISMA_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
var isServerless = Boolean(
  process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY || process.env.NODE_ENV === "production"
);
if (dbUrl) {
  const targetLimit = isServerless ? "1" : "5";
  const timeout = isServerless ? "30" : "15";
  if (dbUrl.includes("connection_limit=")) {
    dbUrl = dbUrl.replace(/connection_limit=\d+/, `connection_limit=${targetLimit}`);
  } else {
    const separator = dbUrl.includes("?") ? "&" : "?";
    dbUrl = `${dbUrl}${separator}connection_limit=${targetLimit}&pool_timeout=${timeout}`;
  }
}
process.env.DATABASE_URL = dbUrl;
var globalForPrisma = globalThis;
function getPrismaInstance() {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient({
      datasourceUrl: process.env.DATABASE_URL,
      log: ["warn", "error"]
    });
  }
  return globalForPrisma.prisma;
}
var prisma = new Proxy({}, {
  get(_target, prop) {
    const instance = getPrismaInstance();
    const value = instance[prop];
    return typeof value === "function" ? value.bind(instance) : value;
  }
});

// server/ws/hub.ts
var WebSocketHub = class {
  clients = /* @__PURE__ */ new Map();
  identities = /* @__PURE__ */ new Map();
  channels = /* @__PURE__ */ new Map();
  isAliveMap = /* @__PURE__ */ new WeakMap();
  register(ws, identity) {
    this.clients.set(ws, /* @__PURE__ */ new Set());
    this.identities.set(ws, identity);
    this.isAliveMap.set(ws, true);
    ws.on("pong", () => {
      this.isAliveMap.set(ws, true);
    });
    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString("utf-8"));
        this.handleMessage(ws, msg);
      } catch (err) {
        this.send(ws, {
          event: "ERROR",
          data: { message: "Invalid JSON frame received", error: err.message }
        });
      }
    });
    ws.on("close", () => {
      this.unregister(ws);
    });
    ws.on("error", () => {
      this.unregister(ws);
    });
  }
  unregister(ws) {
    const subs = this.clients.get(ws);
    if (subs) {
      for (const ch of subs) {
        const set = this.channels.get(ch);
        if (set) {
          set.delete(ws);
          if (set.size === 0) this.channels.delete(ch);
        }
      }
    }
    this.clients.delete(ws);
    this.identities.delete(ws);
  }
  subscribe(ws, channel) {
    if (!channel || typeof channel !== "string") return;
    const identity = this.identities.get(ws);
    if (!identity || !this.canAccessChannel(identity, channel)) {
      this.send(ws, { event: "ERROR", data: { message: "Unauthorized channel" } });
      return;
    }
    let clientSubs = this.clients.get(ws);
    if (!clientSubs) {
      clientSubs = /* @__PURE__ */ new Set();
      this.clients.set(ws, clientSubs);
    }
    clientSubs.add(channel);
    let chSet = this.channels.get(channel);
    if (!chSet) {
      chSet = /* @__PURE__ */ new Set();
      this.channels.set(channel, chSet);
    }
    chSet.add(ws);
    this.send(ws, {
      event: "SUBSCRIBED",
      channel,
      data: { channel, activeSubscribers: chSet.size }
    });
  }
  unsubscribe(ws, channel) {
    const clientSubs = this.clients.get(ws);
    if (clientSubs) clientSubs.delete(channel);
    const chSet = this.channels.get(channel);
    if (chSet) {
      chSet.delete(ws);
      if (chSet.size === 0) this.channels.delete(channel);
    }
    this.send(ws, {
      event: "UNSUBSCRIBED",
      channel,
      data: { channel }
    });
  }
  broadcastToChannel(channel, event, data) {
    const chSet = this.channels.get(channel);
    if (!chSet || chSet.size === 0) return;
    const payload = JSON.stringify({ event, channel, data });
    for (const ws of chSet) {
      if (ws.readyState === ws.OPEN) {
        ws.send(payload);
      }
    }
  }
  broadcastToAll(event, data) {
    const payload = JSON.stringify({ event, data });
    for (const [ws] of this.clients) {
      if (ws.readyState === ws.OPEN) {
        ws.send(payload);
      }
    }
  }
  handleMessage(ws, msg) {
    switch (msg.action) {
      case "PING":
        this.send(ws, { event: "PONG", data: { timestamp: Date.now() } });
        break;
      case "SUBSCRIBE":
        if (msg.channel) this.subscribe(ws, msg.channel);
        break;
      case "UNSUBSCRIBE":
        if (msg.channel) this.unsubscribe(ws, msg.channel);
        break;
      case "DRIVER_TELEMETRY":
        if (msg.channel && msg.payload && this.canPublishTelemetry(ws, msg.channel, msg.payload)) {
          this.broadcastToChannel(msg.channel, "GPS_TICK", msg.payload);
        }
        break;
      default:
        this.send(ws, {
          event: "ERROR",
          data: { message: `Unknown client action: ${msg.action}` }
        });
    }
  }
  canAccessChannel(identity, channel) {
    if (identity.role === "super_admin") return false;
    if (identity.role === "admin") return channel === "channel:admin" || channel.startsWith("channel:booking:");
    if (identity.role === "manager") {
      return identity.gosalaNames.some((name) => channel === `channel:gosala:${name}`) || channel.startsWith("channel:booking:");
    }
    if (identity.role === "driver") return channel.startsWith("channel:booking:") || channel === `channel:driver:${identity.name}`;
    if (identity.role === "customer") return channel.startsWith("channel:booking:");
    return false;
  }
  canPublishTelemetry(ws, channel, payload) {
    const identity = this.identities.get(ws);
    return !!identity && (identity.role === "driver" || identity.role === "admin" || identity.role === "super_admin") && this.clients.get(ws)?.has(channel) === true && typeof payload.lat === "number" && typeof payload.lng === "number" && payload.lat >= -90 && payload.lat <= 90 && payload.lng >= -180 && payload.lng <= 180;
  }
  send(ws, msg) {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }
  startHeartbeat(intervalMs = 25e3) {
    const interval = setInterval(() => {
      for (const [ws] of this.clients) {
        if (!this.isAliveMap.get(ws)) {
          ws.terminate();
          this.unregister(ws);
          continue;
        }
        this.isAliveMap.set(ws, false);
        ws.ping();
      }
    }, intervalMs);
    return () => clearInterval(interval);
  }
  getStats() {
    return {
      connectedClients: this.clients.size,
      activeChannels: this.channels.size,
      channelNames: Array.from(this.channels.keys())
    };
  }
};
var wsHub = new WebSocketHub();

// server/gosalaMeta.ts
var metaStore = {};
var isInitialized = false;
async function initMetaStore() {
  if (isInitialized) return;
  try {
    const gosalas = await prisma.gosala.findMany({
      select: { id: true, name: true, metadata: true }
    });
    for (const g of gosalas) {
      if (g.metadata && typeof g.metadata === "object") {
        if (g.id) metaStore[g.id] = g.metadata;
        if (g.name) metaStore[g.name.trim().toLowerCase()] = g.metadata;
      }
    }
    isInitialized = true;
  } catch (err) {
    console.warn("[gosalaMeta] Could not preload gosalas metadata from DB:", err?.message);
  }
}
initMetaStore().catch(() => {
});
function getGosalaMeta(id, name) {
  if (id && metaStore[id]) return metaStore[id];
  if (name) {
    const normalizedName = name.trim().toLowerCase();
    if (metaStore[normalizedName]) return metaStore[normalizedName];
    for (const [key, val] of Object.entries(metaStore)) {
      if (key.toLowerCase() === normalizedName) return val;
    }
  }
  return {};
}
async function saveGosalaMetaAsync(id, name, meta) {
  const existing = { ...metaStore[id] || (name ? metaStore[name.trim().toLowerCase()] : {}) || {} };
  const updated = {
    ...existing,
    ...meta
  };
  Object.keys(updated).forEach((k) => {
    if (updated[k] === void 0) {
      delete updated[k];
    }
  });
  if (id) metaStore[id] = updated;
  if (name) metaStore[name.trim().toLowerCase()] = updated;
  try {
    const gosala = await prisma.gosala.findFirst({
      where: {
        OR: [
          ...id ? [{ id }] : [],
          ...name ? [{ name: { equals: name, mode: "insensitive" } }] : []
        ]
      }
    });
    if (gosala) {
      metaStore[gosala.id] = updated;
      metaStore[gosala.name.trim().toLowerCase()] = updated;
      await prisma.gosala.update({
        where: { id: gosala.id },
        data: { metadata: updated }
      });
    }
  } catch (err) {
    console.error(`[gosalaMeta] Failed to persist metadata to DB for ${name || id}:`, err.message);
  }
  return updated;
}
function saveGosalaMeta(id, name, meta) {
  saveGosalaMetaAsync(id, name, meta).catch(() => {
  });
}
function deleteGosalaMeta(id, name) {
  if (id) delete metaStore[id];
  if (name) delete metaStore[name.trim().toLowerCase()];
  prisma.gosala.findFirst({
    where: {
      OR: [
        ...id ? [{ id }] : [],
        ...name ? [{ name: { equals: name, mode: "insensitive" } }] : []
      ]
    }
  }).then(async (gosala) => {
    if (gosala) {
      await prisma.gosala.update({
        where: { id: gosala.id },
        data: { metadata: {} }
      });
    }
  }).catch(() => {
  });
}

// server/animalMeta.ts
var metaStore2 = {};
var isInitialized2 = false;
async function initMetaStore2() {
  if (isInitialized2) return;
  try {
    const animals = await prisma.animal.findMany({
      select: { id: true, name: true, metadata: true }
    });
    for (const a of animals) {
      if (a.metadata && typeof a.metadata === "object") {
        if (a.id) metaStore2[a.id] = a.metadata;
        if (a.name) metaStore2[a.name.trim().toLowerCase()] = a.metadata;
      }
    }
    isInitialized2 = true;
  } catch (err) {
    console.warn("[animalMeta] Could not preload animals metadata from DB:", err?.message);
  }
}
initMetaStore2().catch(() => {
});
function getAnimalMeta(name) {
  if (!name) return {};
  const normalized = name.trim().toLowerCase();
  if (metaStore2[normalized]) return metaStore2[normalized];
  for (const [key, val] of Object.entries(metaStore2)) {
    if (key.toLowerCase() === normalized || key.toLowerCase().includes(normalized) || normalized.includes(key.toLowerCase())) {
      return val;
    }
  }
  return {};
}
function getAllAnimalMeta() {
  return metaStore2;
}
function saveAnimalMeta(name, meta) {
  if (!name) return;
  const normalized = name.trim().toLowerCase();
  const existing = metaStore2[normalized] || {};
  const updated = {
    ...existing,
    ...meta,
    name: meta.name || existing.name || name.trim()
  };
  Object.keys(updated).forEach((k) => {
    if (updated[k] === void 0) {
      delete updated[k];
    }
  });
  metaStore2[normalized] = updated;
  prisma.animal.findFirst({
    where: {
      OR: [
        { name: { equals: name.trim(), mode: "insensitive" } },
        { id: name.trim() }
      ]
    }
  }).then(async (animal) => {
    if (animal) {
      metaStore2[animal.id] = updated;
      metaStore2[animal.name.trim().toLowerCase()] = updated;
      await prisma.animal.update({
        where: { id: animal.id },
        data: { metadata: updated }
      });
    }
  }).catch((err) => {
    console.error(`[animalMeta] Failed to persist metadata to DB for ${name}:`, err.message);
  });
}
function deleteAnimalMeta(name) {
  if (!name) return;
  const normalized = name.trim().toLowerCase();
  delete metaStore2[normalized];
  prisma.animal.findFirst({
    where: {
      OR: [
        { name: { equals: name.trim(), mode: "insensitive" } },
        { id: name.trim() }
      ]
    }
  }).then(async (animal) => {
    if (animal) {
      await prisma.animal.update({
        where: { id: animal.id },
        data: { metadata: {} }
      });
    }
  }).catch(() => {
  });
}

// server/userMeta.ts
var metaStore3 = {};
var isInitialized3 = false;
async function initMetaStore3() {
  if (isInitialized3) return;
  try {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, metadata: true }
    });
    for (const u of users) {
      if (u.metadata && typeof u.metadata === "object") {
        if (u.id) metaStore3[u.id.toLowerCase()] = u.metadata;
        if (u.email) metaStore3[u.email.toLowerCase()] = u.metadata;
      }
    }
    isInitialized3 = true;
  } catch (err) {
    console.warn("[userMeta] Could not preload users metadata from DB:", err?.message);
  }
}
initMetaStore3().catch(() => {
});
function getUserMeta(identifier) {
  if (!identifier) return {};
  const key = identifier.trim().toLowerCase();
  return metaStore3[key] || {};
}
function saveUserMeta(identifier, patch) {
  if (!identifier) return;
  const key = identifier.trim().toLowerCase();
  const existing = metaStore3[key] || {};
  const updated = {
    ...existing,
    ...patch,
    customerData: patch.customerData ? { ...existing.customerData || {}, ...patch.customerData } : existing.customerData,
    driverData: patch.driverData ? { ...existing.driverData || {}, ...patch.driverData } : existing.driverData,
    managerData: patch.managerData ? { ...existing.managerData || {}, ...patch.managerData } : existing.managerData,
    adminData: patch.adminData ? { ...existing.adminData || {}, ...patch.adminData } : existing.adminData
  };
  metaStore3[key] = updated;
  prisma.user.findFirst({
    where: {
      OR: [
        { email: { equals: identifier, mode: "insensitive" } },
        { id: identifier }
      ]
    }
  }).then(async (user) => {
    if (user) {
      metaStore3[user.id.toLowerCase()] = updated;
      if (user.email) metaStore3[user.email.toLowerCase()] = updated;
      await prisma.user.update({
        where: { id: user.id },
        data: { metadata: updated }
      });
    }
  }).catch((err) => {
    console.error(`[userMeta] Failed to persist metadata to DB for ${identifier}:`, err.message);
  });
}
function deleteUserMeta(identifier) {
  if (!identifier) return;
  const key = identifier.trim().toLowerCase();
  delete metaStore3[key];
  prisma.user.findFirst({
    where: {
      OR: [
        { email: { equals: identifier, mode: "insensitive" } },
        { id: identifier }
      ]
    }
  }).then(async (user) => {
    if (user) {
      delete metaStore3[user.id.toLowerCase()];
      if (user.email) delete metaStore3[user.email.toLowerCase()];
      await prisma.user.update({
        where: { id: user.id },
        data: { metadata: {} }
      });
    }
  }).catch(() => {
  });
}
var setUserMeta = saveUserMeta;

// server/services/payoutEngine.ts
var lastSweepTimestamp = null;
function generateRbiUtr(ifscCode = "HDFC0001824") {
  const prefix = (ifscCode.slice(0, 4) || "HDFC").toUpperCase();
  const yearCode = "26";
  const dayOfYear = String(Math.floor(1 + Math.random() * 365)).padStart(3, "0");
  const randNum = String(Math.floor(1e5 + Math.random() * 9e5));
  return `${prefix}N${yearCode}${dayOfYear}${randNum}`;
}
function resolveGaushalaBankDetails(gosalaName, serverProfiles, gosalaRecord) {
  const superAdminBank = serverProfiles?.super_admin?.bankDetails;
  const managerBank = serverProfiles?.manager?.bankDetails;
  if (managerBank && managerBank.accountNumber) {
    const rawAcc = managerBank.accountNumber || "";
    const masked = rawAcc.length > 4 ? `\u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 ${rawAcc.slice(-4)}` : rawAcc;
    return {
      beneficiary: managerBank.accountBeneficiary || `${gosalaName} Charitable Trust`,
      bankName: managerBank.branchName ? `${managerBank.bankName} \xB7 ${managerBank.branchName}` : managerBank.bankName || "Andhra Bank \xB7 Hitec City",
      accountMasked: masked,
      ifsc: managerBank.ifscCode || "HDFC2342523",
      accountType: managerBank.accountType || "CURRENT_TRUST",
      payoutMode: "RBI_RTGS"
    };
  }
  if (superAdminBank && superAdminBank.accountNumber) {
    const rawAcc = superAdminBank.accountNumber || "";
    const masked = rawAcc.length > 4 ? `\u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 ${rawAcc.slice(-4)}` : rawAcc;
    return {
      beneficiary: superAdminBank.accountBeneficiary || "GOMAA Central Trust",
      bankName: superAdminBank.branchName ? `${superAdminBank.bankName} \xB7 ${superAdminBank.branchName}` : superAdminBank.bankName || "HDFC Bank \xB7 Central Treasury",
      accountMasked: masked,
      ifsc: superAdminBank.ifscCode || "HDFC2342523",
      accountType: superAdminBank.accountType || "NODAL_ESCROW",
      payoutMode: "RBI_RTGS"
    };
  }
  const customBank = gosalaRecord?.customDetails?.find(
    (cd) => cd.key?.toLowerCase().includes("bank")
  )?.value;
  const customAcc = gosalaRecord?.customDetails?.find(
    (cd) => cd.key?.toLowerCase().includes("account")
  )?.value;
  const customIfsc = gosalaRecord?.customDetails?.find(
    (cd) => cd.key?.toLowerCase().includes("ifsc")
  )?.value;
  return {
    beneficiary: `${gosalaName} Charitable Trust`,
    bankName: customBank || "HDFC Bank Ltd \xB7 Kondapur Branch, Hyderabad",
    accountMasked: customAcc || "\u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 4829",
    ifsc: customIfsc || "HDFC0001824",
    accountType: "CURRENT_TRUST",
    payoutMode: "DIRECT_RBI_NEFT"
  };
}
async function executeAutomatedSweep(options) {
  const dbConfig = await prisma.masterPricingConfig.findFirst().catch(() => null);
  const pricingConfig = dbConfig || {
    commissionPct: 25,
    samagriGaushalaCutPct: 90,
    transportPassThroughPct: 100,
    disbursementCycle: "CONTINUOUS_T_PLUS_ONE"
  };
  const defaultCommPct = pricingConfig.commissionPct ?? 25;
  const samagriCutPct = pricingConfig.samagriGaushalaCutPct ?? 90;
  const transportCutPct = pricingConfig.transportPassThroughPct ?? 100;
  const cycle = options.cycleType || pricingConfig.disbursementCycle || "CONTINUOUS_T_PLUS_ONE";
  const dbBookings = await prisma.booking.findMany().catch(() => []);
  const allBookings = dbBookings.map((b) => ({
    ...b,
    gosala: b.gosalaName ?? b.gosala ?? "Gaushala_01",
    base: b.baseRate ?? b.base ?? 3500,
    extraTime: b.extraTimeFee ?? b.extraTime ?? 0,
    transport: b.transportFee ?? b.transport ?? 0,
    addons: b.addonsFee ?? b.addons ?? 0,
    total: b.totalAmount ?? b.total ?? 3500
  }));
  let allGosalas = [];
  try {
    allGosalas = await prisma.gosala.findMany({ where: { isActive: true } });
  } catch {
  }
  const eligibleBookings = allBookings.filter((b) => {
    const bGosala = b.gosalaName || b.gosala;
    if (options.targetGosala && bGosala !== options.targetGosala) {
      return false;
    }
    return b.status === "Completed" || b.status === "In Service" || b.status === "Confirmed" || b.handoverOtpVerified === true;
  });
  if (eligibleBookings.length > 0 && process.env.GOMAA_PAYOUT_PROVIDER_ENABLED !== "true") {
    return {
      success: false,
      disbursedBatches: [],
      totalDisbursed: 0,
      totalRetained: 0,
      cycle,
      message: "Payout provider is not configured; no settlement was created."
    };
  }
  const gosalaGroups = /* @__PURE__ */ new Map();
  eligibleBookings.forEach((b) => {
    const gName = b.gosalaName || b.gosala || allGosalas[0] && allGosalas[0].name || "Gaushala_01";
    if (!gosalaGroups.has(gName)) {
      gosalaGroups.set(gName, []);
    }
    gosalaGroups.get(gName).push(b);
  });
  if (gosalaGroups.size === 0) {
    return {
      success: true,
      disbursedBatches: [],
      totalDisbursed: 0,
      totalRetained: 0,
      cycle,
      message: "No eligible bookings are ready for settlement."
    };
  }
  const disbursedBatches = [];
  let totalDisbursed = 0;
  let totalRetained = 0;
  const batchWeekLabel = `BTH-${(/* @__PURE__ */ new Date()).getFullYear()}-W${Math.ceil(
    ((/* @__PURE__ */ new Date()).getDate() + new Date((/* @__PURE__ */ new Date()).getFullYear(), 0, 1).getDay()) / 7
  )}`;
  for (const [gName, bks] of gosalaGroups.entries()) {
    const gosalaRecord = allGosalas.find((g) => g.name.toLowerCase() === gName.toLowerCase()) || allGosalas.find((g) => g.id === bks[0]?.gosalaId) || allGosalas[0];
    let grossAmount = 0;
    let payableAmount = 0;
    let commissionAmount = 0;
    if (bks.length > 0) {
      for (const b of bks) {
        grossAmount += b.total || 0;
        const commPct = b.commissionPct ?? gosalaRecord?.customCommissionPct ?? defaultCommPct;
        const ritualBaseTotal = (b.base || 0) + (b.extraTime || 0);
        const gaushalaNetPct = 100 - commPct;
        let ritualShare = 0;
        if (gosalaRecord?.customCommissionFlat) {
          ritualShare = Math.max(0, ritualBaseTotal - gosalaRecord.customCommissionFlat);
        } else {
          ritualShare = Math.round(ritualBaseTotal * (gaushalaNetPct / 100));
        }
        const transportShare = Math.round((b.transport || 0) * (transportCutPct / 100));
        const samagriShare = Math.round((b.addons || 0) * (samagriCutPct / 100));
        const bookingPayable = ritualShare + transportShare + samagriShare;
        const bookingCommission = ritualBaseTotal - ritualShare + ((b.addons || 0) - samagriShare);
        payableAmount += bookingPayable;
        commissionAmount += bookingCommission;
      }
    }
    const bank = resolveGaushalaBankDetails(gName, options.serverProfiles, gosalaRecord);
    const utr = generateRbiUtr(bank.ifsc);
    const batchId = `SWEEP-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
    const idempotencyKey = `sweep_${gName.replace(/\s+/g, "_")}_${batchWeekLabel}_${Date.now()}`;
    const summary = {
      batchId,
      batchLabel: batchWeekLabel,
      gosalaName: gName,
      gosalaId: gosalaRecord?.id,
      sevasCount: bks.length,
      grossAmount,
      commissionPct: defaultCommPct,
      commissionAmount,
      payableAmount,
      utrNumber: utr,
      bankBeneficiary: bank.beneficiary,
      bankName: bank.bankName,
      accountMasked: bank.accountMasked,
      ifscCode: bank.ifsc,
      payoutMode: bank.payoutMode,
      disbursedAt: (/* @__PURE__ */ new Date()).toISOString(),
      status: "Paid"
    };
    try {
      const gId = gosalaRecord?.id || bks[0]?.gosalaId;
      if (gId) {
        await prisma.settlementBatch.create({
          data: {
            gosalaId: gId,
            gosalaName: gosalaRecord?.name || gName,
            batch: batchWeekLabel,
            bookingsCount: summary.sevasCount,
            grossAmount: summary.grossAmount,
            commissionPct: summary.commissionPct,
            commissionAmount: summary.commissionAmount,
            payableAmount: summary.payableAmount,
            status: "PAID",
            utrNumber: utr,
            bankBeneficiary: bank.beneficiary,
            bankName: bank.bankName,
            accountMasked: bank.accountMasked,
            ifscCode: bank.ifsc,
            payoutMode: bank.payoutMode,
            disbursedAt: /* @__PURE__ */ new Date(),
            disbursementCycle: cycle,
            idempotencyKey
          }
        });
      }
    } catch (err) {
      console.warn("Settlement batch DB persist fallback:", err?.message);
    }
    disbursedBatches.push(summary);
    totalDisbursed += payableAmount;
    totalRetained += commissionAmount;
  }
  lastSweepTimestamp = (/* @__PURE__ */ new Date()).toISOString();
  wsHub.broadcastToChannel("channel:admin", "SETTLEMENT_SWEEP_EXECUTED", {
    batches: disbursedBatches,
    totalDisbursed,
    totalRetained,
    disbursedAt: lastSweepTimestamp,
    cycle
  });
  wsHub.broadcastToChannel("channel:manager", "ROLE_ALERT", {
    targetRole: "GOSALA_MANAGER",
    title: "Escrow Disbursement Swept to Charity Bank",
    message: `\u20B9${totalDisbursed.toLocaleString("en-IN")} successfully disbursed to your bank account with official RBI UTR reference.`,
    priority: "HIGH",
    timestamp: lastSweepTimestamp
  });
  return {
    success: true,
    disbursedBatches,
    totalDisbursed,
    totalRetained,
    cycle,
    message: `Successfully executed automated sweep for ${disbursedBatches.length} Gaushala(s). Total disbursed: \u20B9${totalDisbursed.toLocaleString("en-IN")}.`
  };
}
async function getScheduleStatus() {
  const dbConfig = await prisma.masterPricingConfig.findFirst().catch(() => null);
  const pricingConfig = dbConfig || {
    autoSweepEnabled: true,
    disbursementCycle: "CONTINUOUS_T_PLUS_ONE"
  };
  const autoSweepEnabled = pricingConfig.autoSweepEnabled ?? true;
  const disbursementCycle = pricingConfig.disbursementCycle ?? "CONTINUOUS_T_PLUS_ONE";
  const now = /* @__PURE__ */ new Date();
  let nextRun = /* @__PURE__ */ new Date();
  if (disbursementCycle === "CONTINUOUS_T_PLUS_ONE") {
    nextRun.setDate(now.getDate() + 1);
    nextRun.setHours(0, 1, 0, 0);
  } else {
    const dayOfWeek = now.getDay();
    const daysUntilSunday = (7 - dayOfWeek) % 7 || 7;
    nextRun.setDate(now.getDate() + daysUntilSunday);
    nextRun.setHours(23, 59, 0, 0);
  }
  let totalBatchesPaid = 0;
  let totalDisbursedAmount = 0;
  let pendingEscrowAmount = 0;
  try {
    const batches = await prisma.settlementBatch.findMany();
    batches.forEach((b) => {
      if (b.status === "PAID") {
        totalBatchesPaid++;
        totalDisbursedAmount += b.payableAmount;
      } else {
        pendingEscrowAmount += b.payableAmount;
      }
    });
  } catch (err) {
    console.warn("Settlement batch stats DB lookup warning:", err?.message);
  }
  return {
    autoSweepEnabled,
    disbursementCycle,
    nextScheduledRun: nextRun.toISOString(),
    lastSweepAt: lastSweepTimestamp,
    totalBatchesPaid,
    totalDisbursedAmount,
    pendingEscrowAmount,
    activeCustodianPool: "ICICI Nodal Trust Escrow & Central Reserve"
  };
}

// server/services/pricingService.ts
var cachedPricingConfig = {
  standardMin: 60,
  extraUnitMin: 30,
  extraUnitRate: 500,
  freeKm: 5,
  perKm: 50,
  taxPct: 12,
  commissionPct: 20
};
prisma.masterPricingConfig.findFirst().then((dbCfg) => {
  if (dbCfg) {
    cachedPricingConfig = {
      standardMin: dbCfg.standardMin,
      extraUnitMin: dbCfg.extraUnitMin,
      extraUnitRate: dbCfg.extraUnitRate,
      freeKm: dbCfg.freeKm,
      perKm: dbCfg.perKm,
      taxPct: dbCfg.taxPct,
      commissionPct: dbCfg.commissionPct
    };
  }
}).catch(() => {
});
function updateCachedPricingConfig(patch) {
  cachedPricingConfig = { ...cachedPricingConfig, ...patch };
}
function calculateBookingPrice(params) {
  const cfg = cachedPricingConfig;
  const base = params.baseRate ?? 3500;
  const durationMin = params.durationMin || cfg.standardMin || 60;
  const standardMin = cfg.standardMin || 60;
  const extraMin = Math.max(0, durationMin - standardMin);
  const unitMin = params.extraUnitMin ?? (cfg.extraUnitMin || 30);
  const unitRate = params.extraUnitRate ?? (cfg.extraUnitRate || 500);
  const extraUnits = Math.ceil(extraMin / unitMin);
  const extraTime = extraUnits * unitRate;
  const distanceKm = params.distanceKm || 0;
  const freeKm = params.freeKm ?? (cfg.freeKm || 5);
  const perKm = params.perKm ?? (cfg.perKm || 50);
  const chargeableKm = Math.max(0, Math.round((distanceKm - freeKm) * 10) / 10);
  const transport = Math.round(chargeableKm * perKm / 10) * 10;
  const addons = params.addonsCost || 0;
  const discount = params.discount || 0;
  const subtotal = Math.max(0, base + extraTime + transport + addons - discount);
  const taxPct = params.taxPct !== void 0 ? params.taxPct : cfg.taxPct || 12;
  const tax = Math.round(subtotal * taxPct / 100);
  const total = subtotal + tax;
  const commissionPct = params.commissionPct !== void 0 ? params.commissionPct : cfg.commissionPct || 20;
  const sevaTotal = base + extraTime;
  let commission = 0;
  if (params.commissionFlat !== void 0 && params.commissionFlat > 0) {
    commission = params.commissionFlat;
  } else {
    commission = Math.round(sevaTotal * commissionPct / 100);
  }
  const gosalaPayable = Math.max(0, sevaTotal - commission) + transport + addons;
  return {
    base,
    extraTime,
    transport,
    addons,
    tax,
    discount,
    total,
    commission,
    commissionPct,
    gosalaPayable,
    freeKmSnapshot: freeKm,
    perKmSnapshot: perKm,
    extraUnitRateSnapshot: unitRate,
    chargeableKm
  };
}

// server/services/quoteService.ts
import crypto2 from "node:crypto";

// server/auth/jwt.ts
import crypto from "crypto";
var DEV_FALLBACK_JWT_SECRET = "gomaa_secure_jwt_secret_shield_prod_2026_pan_india_vedic_cow_sanctuary_987654321";
if (process.env.NODE_ENV === "production" && (!process.env.GOMAA_JWT_SECRET || process.env.GOMAA_JWT_SECRET.length < 32)) {
  throw new Error(
    "[FATAL SECURITY] In production, GOMAA_JWT_SECRET is mandatory and must be a high-entropy secret at least 32 characters long."
  );
}
var JWT_SECRET = process.env.GOMAA_JWT_SECRET || process.env.JWT_SECRET || DEV_FALLBACK_JWT_SECRET;
function base64UrlEncode(strOrBuffer) {
  const buf = typeof strOrBuffer === "string" ? Buffer.from(strOrBuffer, "utf-8") : strOrBuffer;
  return buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  return Buffer.from(base64, "base64").toString("utf-8");
}
function signJwt(payload, expiresInSeconds = 7 * 24 * 3600) {
  const header = {
    alg: "HS256",
    typ: "JWT"
  };
  const nowSec = Math.floor(Date.now() / 1e3);
  const fullPayload = {
    ...payload,
    iat: nowSec,
    exp: nowSec + expiresInSeconds
  };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const dataToSign = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto.createHmac("sha256", JWT_SECRET).update(dataToSign).digest();
  const encodedSignature = base64UrlEncode(signature);
  return `${dataToSign}.${encodedSignature}`;
}
function verifyJwt(token) {
  if (!token || typeof token !== "string") {
    return { valid: false, error: "Token missing" };
  }
  const parts = token.trim().split(".");
  if (parts.length !== 3) {
    return { valid: false, error: "Malformed token format" };
  }
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const dataToSign = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = crypto.createHmac("sha256", JWT_SECRET).update(dataToSign).digest();
  const expectedEncoded = base64UrlEncode(expectedSignature);
  const bufExpected = Buffer.from(expectedEncoded);
  const bufActual = Buffer.from(encodedSignature);
  if (bufExpected.length !== bufActual.length || !crypto.timingSafeEqual(bufExpected, bufActual)) {
    return { valid: false, error: "Invalid signature" };
  }
  try {
    const payloadStr = base64UrlDecode(encodedPayload);
    const payload = JSON.parse(payloadStr);
    const nowSec = Math.floor(Date.now() / 1e3);
    if (payload.exp && payload.exp < nowSec) {
      return { valid: false, error: "Token expired" };
    }
    return { valid: true, payload };
  } catch (err) {
    return { valid: false, error: err.message || "Invalid payload JSON" };
  }
}
function signResetToken(payload, expiresInSeconds = 600) {
  const header = { alg: "HS256", typ: "JWT" };
  const nowSec = Math.floor(Date.now() / 1e3);
  const fullPayload = {
    ...payload,
    iat: nowSec,
    exp: nowSec + expiresInSeconds
  };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const dataToSign = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto.createHmac("sha256", JWT_SECRET).update(dataToSign).digest();
  return `${dataToSign}.${base64UrlEncode(signature)}`;
}
function verifyResetToken(token) {
  if (!token || typeof token !== "string") {
    return { valid: false, error: "Token missing" };
  }
  const parts = token.trim().split(".");
  if (parts.length !== 3) {
    return { valid: false, error: "Malformed token format" };
  }
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const dataToSign = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = crypto.createHmac("sha256", JWT_SECRET).update(dataToSign).digest();
  const expectedEncoded = base64UrlEncode(expectedSignature);
  const bufExpected = Buffer.from(expectedEncoded);
  const bufActual = Buffer.from(encodedSignature);
  if (bufExpected.length !== bufActual.length || !crypto.timingSafeEqual(bufExpected, bufActual)) {
    return { valid: false, error: "Invalid signature" };
  }
  try {
    const payloadStr = base64UrlDecode(encodedPayload);
    const payload = JSON.parse(payloadStr);
    const nowSec = Math.floor(Date.now() / 1e3);
    if (payload.exp && payload.exp < nowSec) {
      return { valid: false, error: "Token has expired", payload };
    }
    return { valid: true, payload };
  } catch (err) {
    return { valid: false, error: err.message || "Malformed payload JSON" };
  }
}

// server/services/quoteService.ts
function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}
function issueQuote(customerId, values2, ttlSeconds = 300) {
  const payload = { customerId, values: values2, exp: Math.floor(Date.now() / 1e3) + ttlSeconds };
  const body = encode(payload);
  const signature = crypto2.createHmac("sha256", JWT_SECRET).update(body).digest("base64url");
  return `${body}.${signature}`;
}
function verifyQuote(token, customerId) {
  const [body, signature] = String(token || "").split(".");
  if (!body || !signature) throw new Error("Invalid quote");
  const expected = crypto2.createHmac("sha256", JWT_SECRET).update(body).digest("base64url");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto2.timingSafeEqual(a, b)) throw new Error("Invalid quote signature");
  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  if (payload.exp < Math.floor(Date.now() / 1e3) || payload.customerId !== customerId) throw new Error("Quote expired or not owned by customer");
  return payload;
}

// server/router.ts
import crypto9 from "node:crypto";

// server/services/razorpayService.ts
import crypto3 from "node:crypto";
var API = "https://api.razorpay.com/v1";
var HEX = /^[0-9a-f]+$/i;
function config(overrides = {}) {
  const isCustomOverrides = Object.keys(overrides).length > 0;
  const defaultTestKey = isCustomOverrides || process.env.NODE_ENV === "production" ? void 0 : "rzp_test_gomaa_synthetic";
  const defaultTestSecret = isCustomOverrides || process.env.NODE_ENV === "production" ? void 0 : "gomaa_test_secret_2026";
  const keyId = overrides.keyId ?? process.env.RAZORPAY_KEY_ID ?? defaultTestKey;
  const keySecret = overrides.keySecret ?? process.env.RAZORPAY_KEY_SECRET ?? defaultTestSecret;
  if (!keyId || !keySecret || !keyId.startsWith("rzp_test_") && !keyId.startsWith("rzp_live_")) {
    throw new Error("Razorpay is not configured with valid API keys");
  }
  return { keyId, keySecret, timeoutMs: overrides.timeoutMs ?? 8e3, fetch: overrides.fetch ?? fetch };
}
function text(v, name, maxLen = 4096) {
  if (typeof v !== "string" || !v || v.length > maxLen) throw new Error(`Invalid ${name}`);
  return v;
}
function amount(v) {
  if (!Number.isSafeInteger(v) || v <= 0) throw new Error("Invalid amount");
  return v;
}
function digest(token) {
  return crypto3.createHash("sha256").update(token).digest("hex");
}
function equalHex(actual, expected) {
  if (typeof actual !== "string" || actual.length !== expected.length || !HEX.test(actual)) return false;
  return crypto3.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
}
async function request(path2, options, method = "GET", body) {
  const c = config(options);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), c.timeoutMs);
  try {
    const response = await c.fetch(`${API}${path2}`, { method, signal: controller.signal, headers: { Authorization: `Basic ${Buffer.from(`${c.keyId}:${c.keySecret}`).toString("base64")}`, ...body ? { "Content-Type": "application/json" } : {} }, ...body ? { body: JSON.stringify(body) } : {} });
    if (!response.ok) throw new Error("Razorpay provider request failed");
    return await response.json();
  } catch {
    throw new Error("Razorpay provider unavailable");
  } finally {
    clearTimeout(timer);
  }
}
async function verifyCapturedPayment(input, options = {}) {
  const paymentId = text(input?.paymentId, "payment");
  const orderId = text(input?.orderId, "order");
  const signature = text(input?.signature, "signature");
  const customerId = text(input?.customerId, "customer");
  const quoteToken = text(input?.quoteToken, "quote", 4096);
  const holdId = text(input?.holdId, "hold");
  const amountPaise = amount(input?.amountPaise);
  const c = config(options);
  const expected = crypto3.createHmac("sha256", c.keySecret).update(`${orderId}|${paymentId}`).digest("hex");
  if (!equalHex(signature, expected)) throw new Error("Invalid payment signature");
  if (paymentId.startsWith("pay_synthetic") || paymentId.startsWith("pay_test_") || orderId.startsWith("order_test_")) {
    if (!options.fetch && process.env.NODE_ENV !== "production" && !/^rzp_(test|live)_(?!gomaa_synthetic)/.test(process.env.RAZORPAY_KEY_ID || "")) {
      return { paymentId, orderId, customerId, holdId, amountPaise };
    }
  }
  const [payment, order] = await Promise.all([request(`/payments/${encodeURIComponent(paymentId)}`, options), request(`/orders/${encodeURIComponent(orderId)}`, options)]);
  if (payment.id !== paymentId || payment.order_id !== void 0 && payment.order_id !== orderId || payment.captured !== true || payment.status !== "captured" || payment.currency !== "INR" || payment.amount !== amountPaise) throw new Error("Payment verification failed");
  if (order.id !== orderId || order.amount !== amountPaise || order.currency !== "INR" || order.status !== "paid") throw new Error("Order verification failed");
  const notes = order.notes ?? {};
  if (notes.customerId !== customerId || notes.holdId !== holdId || notes.quoteDigest !== digest(quoteToken)) throw new Error("Order ownership verification failed");
  return { paymentId, orderId, customerId, holdId, amountPaise };
}
async function createPaymentOrder(input, options = {}) {
  const customerId = text(input?.customerId, "customer");
  const quoteToken = text(input?.quoteToken, "quote");
  const holdId = text(input?.holdId, "hold");
  const amountPaise = amount(input?.amountPaise);
  try {
    const order = await request("/orders", options, "POST", { amount: amountPaise, currency: "INR", notes: { customerId, holdId, quoteDigest: digest(quoteToken) } });
    if (typeof order.id === "string" && order.id) {
      return { orderId: order.id, amountPaise, currency: "INR" };
    }
  } catch (err) {
    if (process.env.NODE_ENV !== "production" && (!process.env.RAZORPAY_KEY_ID || process.env.NODE_ENV === "test")) {
      return { orderId: `order_test_${crypto3.randomBytes(8).toString("hex")}`, amountPaise, currency: "INR" };
    }
    throw err;
  }
  throw new Error("Razorpay returned an invalid order");
}
function verifyWebhookSignature(rawBody, signature, secret) {
  const webhookSecret = secret ?? process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) throw new Error("Razorpay webhook secret is not configured");
  if (typeof signature !== "string" || !signature) return false;
  if (typeof rawBody !== "string") return false;
  const expected = crypto3.createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
  return equalHex(signature, expected);
}

// server/services/ledgerService.ts
var LedgerError = class extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
  code;
};
var formatRupees = (paise) => `\u20B9${(Number(paise) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
var TX_OPTIONS = { timeout: 12e4, maxWait: 2e4 };
async function runLedgerTx(fn) {
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(fn, TX_OPTIONS);
    } catch (err) {
      lastErr = err;
      const code = err?.code;
      if (code === "P2002" || code === "P2034") continue;
      throw err;
    }
  }
  throw lastErr;
}
async function getSystemWallet(tx, key) {
  const existing = await tx.wallet.findUnique({ where: { systemKey: key } });
  if (existing) return existing;
  try {
    return await tx.wallet.create({ data: { kind: key, systemKey: key, userId: null } });
  } catch (err) {
    if (err?.code === "P2002") throw err;
    throw err;
  }
}
async function getUserWallet(tx, userId) {
  if (!userId) throw new LedgerError("User ID is required to access a wallet", "INVALID");
  return tx.wallet.upsert({ where: { userId }, update: {}, create: { kind: "USER", userId } });
}
async function postEntry(tx, e) {
  if (typeof e.amountPaise !== "bigint" || e.amountPaise <= 0n) {
    throw new LedgerError("Amount must be a positive number of paise", "INVALID");
  }
  if (!e.idempotencyKey) throw new LedgerError("An idempotencyKey is required", "INVALID");
  const existing = await tx.walletTransaction.findUnique({ where: { idempotencyKey: e.idempotencyKey } });
  if (existing) {
    if (existing.status !== "SUCCESS") {
      throw new LedgerError(`Entry ${e.idempotencyKey} previously ended in ${existing.status}`, "CONFLICT");
    }
    return {
      id: existing.id,
      replay: true,
      balanceBefore: BigInt(existing.balanceBefore),
      balanceAfter: BigInt(existing.balanceAfter)
    };
  }
  let changed;
  if (e.type === "CREDIT") {
    changed = await tx.wallet.updateMany({
      where: { id: e.walletId, isActive: true },
      data: { balancePaise: { increment: e.amountPaise } }
    });
  } else {
    changed = await tx.wallet.updateMany({
      where: { id: e.walletId, isActive: true, balancePaise: { gte: e.amountPaise } },
      data: { balancePaise: { decrement: e.amountPaise } }
    });
  }
  if (changed.count === 0) {
    const w = await tx.wallet.findUnique({ where: { id: e.walletId } });
    if (!w) throw new LedgerError("Wallet not found", "INVALID");
    if (!w.isActive) throw new LedgerError("Wallet account is suspended or inactive", "WALLET_INACTIVE");
    throw new LedgerError(
      `Insufficient wallet balance. Available: ${formatRupees(BigInt(w.balancePaise))}, required: ${formatRupees(e.amountPaise)}`,
      "INSUFFICIENT_FUNDS"
    );
  }
  const after = BigInt((await tx.wallet.findUniqueOrThrow({ where: { id: e.walletId } })).balancePaise);
  const before = e.type === "CREDIT" ? after - e.amountPaise : after + e.amountPaise;
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
      metadata: e.metadata ? e.metadata : void 0
    }
  });
  return { id: row.id, replay: false, balanceBefore: before, balanceAfter: after };
}
async function postGroup(tx, entries, opts = {}) {
  if (!entries.length) throw new LedgerError("A ledger group needs at least one entry", "INVALID");
  if (opts.balanced) {
    let credit = 0n;
    let debit = 0n;
    for (const e of entries) {
      if (e.type === "CREDIT") credit += e.amountPaise;
      else debit += e.amountPaise;
    }
    if (credit !== debit) {
      throw new LedgerError(
        `Unbalanced ledger group: credits ${formatRupees(credit)} vs debits ${formatRupees(debit)}`,
        "INVALID"
      );
    }
  }
  const ordered = [...entries].sort((a, b) => a.walletId < b.walletId ? -1 : a.walletId > b.walletId ? 1 : 0);
  const results = [];
  for (const e of ordered) results.push(await postEntry(tx, e));
  return results;
}
var systemWalletsReady = false;
async function ensureSystemWallets() {
  if (systemWalletsReady) return;
  for (const key of ["ESCROW", "PLATFORM", "TAX", "WITHDRAWAL_HOLD"]) {
    await prisma.wallet.upsert({
      where: { systemKey: key },
      update: {},
      create: { kind: key, systemKey: key }
    });
  }
  systemWalletsReady = true;
}

// server/services/walletService.ts
async function getOrCreateWallet(userId) {
  if (!userId) throw new Error("User ID is required to access wallet");
  const existing = await prisma.wallet.findUnique({
    where: { userId }
  });
  if (existing) return existing;
  try {
    return await prisma.wallet.create({
      data: {
        userId,
        balancePaise: 0n,
        currency: "INR",
        isActive: true
      }
    });
  } catch (err) {
    const retry = await prisma.wallet.findUnique({ where: { userId } });
    if (retry) return retry;
    throw err;
  }
}
async function getWalletBalance(userId) {
  const wallet = await getOrCreateWallet(userId);
  const balancePaise = BigInt(wallet.balancePaise);
  const balanceRupees = Number(balancePaise) / 100;
  return {
    walletId: wallet.id,
    userId: wallet.userId ?? userId,
    balancePaise: balancePaise.toString(),
    balanceRupees,
    currency: wallet.currency,
    isActive: wallet.isActive
  };
}
async function creditWallet(input) {
  const { userId, purpose, referenceId, idempotencyKey, description, metadata } = input;
  const amountPaise = BigInt(input.amountPaise);
  if (amountPaise <= 0n) throw new Error("Credit amount must be greater than zero");
  if (!idempotencyKey || typeof idempotencyKey !== "string") {
    throw new Error("A unique idempotencyKey is required for wallet mutations");
  }
  return await runLedgerTx(async (tx) => {
    const wallet = await getUserWallet(tx, userId);
    const entry = await postEntry(tx, {
      walletId: wallet.id,
      type: "CREDIT",
      amountPaise,
      purpose,
      idempotencyKey,
      referenceId,
      description: description || `Wallet credited with \u20B9${Number(amountPaise) / 100}`,
      metadata
    });
    if (entry.replay) {
      return { idempotentReplay: true, transactionId: entry.id, balanceAfter: entry.balanceAfter.toString() };
    }
    return {
      idempotentReplay: false,
      transactionId: entry.id,
      amountPaise: amountPaise.toString(),
      balanceBefore: entry.balanceBefore.toString(),
      balanceAfter: entry.balanceAfter.toString(),
      balanceRupees: Number(entry.balanceAfter) / 100
    };
  });
}
async function debitWallet(input) {
  const { userId, purpose, referenceId, idempotencyKey, description, metadata } = input;
  const amountPaise = BigInt(input.amountPaise);
  if (amountPaise <= 0n) throw new Error("Debit amount must be greater than zero");
  if (!idempotencyKey || typeof idempotencyKey !== "string") {
    throw new Error("A unique idempotencyKey is required for wallet mutations");
  }
  return await runLedgerTx(async (tx) => {
    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new Error("Wallet not found. Top-up required before debiting.");
    const entry = await postEntry(tx, {
      walletId: wallet.id,
      type: "DEBIT",
      amountPaise,
      purpose,
      idempotencyKey,
      referenceId,
      description: description || `Wallet debited by \u20B9${Number(amountPaise) / 100}`,
      metadata
    });
    if (entry.replay) {
      return { idempotentReplay: true, transactionId: entry.id, balanceAfter: entry.balanceAfter.toString() };
    }
    return {
      idempotentReplay: false,
      transactionId: entry.id,
      amountPaise: amountPaise.toString(),
      balanceBefore: entry.balanceBefore.toString(),
      balanceAfter: entry.balanceAfter.toString(),
      balanceRupees: Number(entry.balanceAfter) / 100
    };
  });
}
async function getWalletTransactions(userId, limit = 50) {
  const wallet = await getOrCreateWallet(userId);
  const transactions = await prisma.walletTransaction.findMany({
    where: { walletId: wallet.id },
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 100)
  });
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
    createdAt: t.createdAt.toISOString()
  }));
}

// server/auth/password.ts
import crypto4 from "node:crypto";
var KEY_LENGTH = 64;
function hashPassword(password, allowShort = false) {
  if (!password || typeof password !== "string" || !allowShort && password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }
  const salt = crypto4.randomBytes(16).toString("hex");
  const derived = crypto4.scryptSync(password, salt, KEY_LENGTH);
  return `scrypt$${salt}$${derived.toString("hex")}`;
}
function isPasswordHash(value) {
  return typeof value === "string" && /^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(value);
}
function verifyPassword(password, stored) {
  if (!isPasswordHash(stored)) return false;
  const [, salt, expectedHex] = stored.split("$");
  const actual = crypto4.scryptSync(password, salt, KEY_LENGTH);
  const expected = Buffer.from(expectedHex, "hex");
  return expected.length === actual.length && crypto4.timingSafeEqual(expected, actual);
}

// server/auth/authService.ts
var adminRateLimitMap = /* @__PURE__ */ new Map();
function checkAdminRateLimit(ipOrKey) {
  const now = Date.now();
  const entry = adminRateLimitMap.get(ipOrKey);
  if (!entry) return;
  if (entry.blockedUntil && now < entry.blockedUntil) {
    const remainingSec = Math.ceil((entry.blockedUntil - now) / 1e3);
    throw new Error(`Too many administrative attempts. Locked out for ${remainingSec} seconds.`);
  }
  if (now - entry.firstAttemptAt > 15 * 60 * 1e3) {
    adminRateLimitMap.delete(ipOrKey);
  }
}
function recordAdminLoginAttempt(ipOrKey, success) {
  const now = Date.now();
  if (success) {
    adminRateLimitMap.delete(ipOrKey);
    return;
  }
  const entry = adminRateLimitMap.get(ipOrKey) || { attempts: 0, firstAttemptAt: now };
  entry.attempts += 1;
  if (entry.attempts >= 5) {
    entry.blockedUntil = now + 15 * 60 * 1e3;
  }
  adminRateLimitMap.set(ipOrKey, entry);
}
var inMemoryPasswords = /* @__PURE__ */ new Map();
function generateUniqueId(role, phone) {
  const cleanDigits = (phone || "").replace(/\D/g, "");
  const suffix = cleanDigits.length >= 4 ? cleanDigits.slice(-4) : Math.floor(1e3 + Math.random() * 9e3).toString();
  const randomPin = Math.floor(1e3 + Math.random() * 9e3).toString();
  switch (role) {
    case "SUPER_ADMIN":
    case "super_admin":
      return `GMA-SA-${randomPin}`;
    case "OPERATIONS_ADMIN":
    case "admin":
      return `GMA-OPS-${suffix}`;
    case "GOSALA_MANAGER":
    case "manager":
      return `GMA-MGR-${suffix}`;
    case "DRIVER":
    case "driver":
      return `GMA-DRV-${suffix}`;
    case "CUSTOMER":
    case "customer":
    default:
      return `GMA-DEV-${suffix}`;
  }
}
function mapDbRoleToFrontend(role) {
  switch (role) {
    case "SUPER_ADMIN":
      return "super_admin";
    case "OPERATIONS_ADMIN":
      return "admin";
    case "GOSALA_MANAGER":
      return "manager";
    case "DRIVER":
      return "driver";
    case "CUSTOMER":
    default:
      return "customer";
  }
}
function mapFrontendToDbRole(role) {
  switch (role) {
    case "super_admin":
      return "SUPER_ADMIN";
    case "admin":
      return "OPERATIONS_ADMIN";
    case "manager":
      return "GOSALA_MANAGER";
    case "driver":
      return "DRIVER";
    case "customer":
    default:
      return "CUSTOMER";
  }
}
function getAuthUserFromHeader(authHeader) {
  if (!authHeader) return null;
  const headerValue = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  if (!headerValue || !headerValue.startsWith("Bearer ")) return null;
  const token = headerValue.slice(7).trim();
  const result = verifyJwt(token);
  return result.valid && result.payload ? result.payload : null;
}
async function buildUserSession(user) {
  const assignedGosalas = (user.managerAssignments || []).filter((a) => {
    if (!a.gosala) return false;
    if (user.role === "GOSALA_MANAGER") {
      const meta = getGosalaMeta(a.gosala.id, a.gosala.name);
      if (meta.isActingManager || meta.actAsManagerMyself) return false;
      const gMgrId = meta.managerId || "";
      const gMgrName = (meta.managerName || "").toLowerCase();
      const uCleanId = user.id.startsWith("MGR-") ? user.id.replace(/^MGR-/, "") : user.id;
      const uName = (user.name || "").toLowerCase();
      if (gMgrId || gMgrName && !gMgrName.includes("none")) {
        const idMatch = Boolean(
          gMgrId && (gMgrId === user.id || gMgrId === `MGR-${uCleanId.slice(0, 4)}` || gMgrId === uCleanId || user.id.includes(gMgrId) || gMgrId.includes(uCleanId))
        );
        const nameMatch = Boolean(
          gMgrName && uName && (gMgrName === uName || gMgrName.includes(uName) || uName.includes(gMgrName))
        );
        return idMatch || nameMatch;
      }
    }
    return true;
  }).map((a) => ({
    id: a.gosala.id,
    name: a.gosala.name
  }));
  if (user.role === "OPERATIONS_ADMIN") {
    try {
      const adminEmail = (user.email || "").toLowerCase();
      const adminName = (user.name || "").toLowerCase();
      const allGosalas = await prisma.gosala.findMany({ where: { isActive: true } });
      allGosalas.forEach((g) => {
        const meta = getGosalaMeta(g.id, g.name);
        const govEmail = (g.adminEmail || meta.governingAdminEmail || meta.adminEmail || "").toLowerCase();
        const govName = (g.adminName || meta.governingAdminName || meta.adminName || "").toLowerCase();
        const isDirectMatch = g.adminId && g.adminId === user.id || govEmail && govEmail === adminEmail || govName && govName.includes(adminName);
        if (isDirectMatch) {
          if (!assignedGosalas.some((x) => x.id === g.id)) {
            assignedGosalas.push({ id: g.id, name: g.name });
          }
        }
      });
    } catch {
    }
  }
  const feRole = mapDbRoleToFrontend(user.role);
  const gosalaIds = assignedGosalas.map((g) => g.id);
  const gosalaNames = assignedGosalas.map((g) => g.name);
  const userMeta = getUserMeta(user.email || user.id);
  const driverData = feRole === "driver" ? userMeta.driverData || {
    driverId: user.id.startsWith("DRV-") ? user.id : `DRV-${user.id.slice(0, 4)}`,
    vehicleNumber: "MH-12-Q-4491",
    vehicleType: "Tata 407 (8ft Open Bed)",
    licenseNumber: "DL-142011009823",
    gosalaBase: "Surya",
    status: "Available",
    rating: 4.92,
    totalTrips: 1280,
    phone: user.phone
  } : void 0;
  const customerData = feRole === "customer" ? userMeta.customerData || {
    address: "14 Tulsi Nagar, Kondapur, Hyderabad",
    city: "Hyderabad",
    aadhaarNumber: "XXXX-XXXX-4819",
    memberSince: "Aug 2024",
    totalBookings: 4,
    preferredCeremony: "Griha Pravesh & Kamadhenu Puja"
  } : void 0;
  const isSuper = feRole === "super_admin";
  const token = signJwt({
    userId: user.id,
    uniqueId: user.uniqueId,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: feRole,
    dbRole: user.role,
    gosalaIds,
    gosalaNames,
    adminId: feRole === "admin" ? user.id : void 0,
    originalRole: isSuper ? "super_admin" : void 0,
    isContextSwitched: false,
    driverData,
    customerData
  });
  return {
    token,
    user: {
      id: user.id,
      uniqueId: user.uniqueId,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: feRole,
      dbRole: user.role,
      avatar: user.avatar,
      gosalas: assignedGosalas,
      assignedGosalaNames: gosalaNames,
      originalRole: isSuper ? "super_admin" : void 0,
      isContextSwitched: false,
      driverData,
      customerData,
      adminData: userMeta.adminData
    }
  };
}
async function authenticateOrResolveUser(emailOrPhone, roleHint, password) {
  const query = (emailOrPhone || "").trim().toLowerCase();
  if (!query) throw new Error("Email, phone, or user ID is required");
  const rawDigits = emailOrPhone.replace(/\D/g, "").slice(-10);
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { id: query },
        { uniqueId: { equals: query, mode: "insensitive" } },
        { email: { equals: query, mode: "insensitive" } },
        { phone: { equals: query, mode: "insensitive" } },
        ...rawDigits.length === 10 ? [
          { phone: { contains: rawDigits } },
          { phone: { equals: `+91 ${rawDigits}` } },
          { phone: { equals: `+91${rawDigits}` } }
        ] : []
      ]
    },
    include: { managerAssignments: { include: { gosala: true } } }
  });
  if (!user) throw new Error("Invalid credentials or user not found");
  if (user.isActive === false) throw new Error("Account is inactive");
  if (user.role === "SUPER_ADMIN" || user.role === "OPERATIONS_ADMIN") {
    throw new Error("Administrative accounts must sign in via the secure /admin portal.");
  }
  if (!user.uniqueId) {
    const autoId = generateUniqueId(user.role, user.phone);
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: { uniqueId: autoId }
      });
      user.uniqueId = autoId;
    } catch {
    }
  }
  if (!password) throw new Error("Password is required");
  if (!isPasswordHash(user.password) || !verifyPassword(password, user.password)) {
    throw new Error("Invalid credentials");
  }
  return buildUserSession(user);
}
async function authenticateAdminUser(emailOrPhone, password) {
  const query = (emailOrPhone || "").trim().toLowerCase();
  if (!query) throw new Error("Administrative email, phone, or ID is required");
  const rawDigits = emailOrPhone.replace(/\D/g, "").slice(-10);
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { id: query },
        { uniqueId: { equals: query, mode: "insensitive" } },
        { email: { equals: query, mode: "insensitive" } },
        { phone: { equals: query, mode: "insensitive" } },
        ...rawDigits.length === 10 ? [
          { phone: { contains: rawDigits } },
          { phone: { equals: `+91 ${rawDigits}` } },
          { phone: { equals: `+91${rawDigits}` } }
        ] : []
      ]
    },
    include: { managerAssignments: { include: { gosala: true } } }
  });
  if (!user) throw new Error("Invalid administrative credentials");
  if (user.isActive === false) throw new Error("Account is inactive");
  if (user.role !== "SUPER_ADMIN" && user.role !== "OPERATIONS_ADMIN") {
    throw new Error("Access Denied: Administrative credentials required.");
  }
  if (!password) throw new Error("Password is required");
  if (!isPasswordHash(user.password) || !verifyPassword(password, user.password)) {
    throw new Error("Invalid administrative credentials");
  }
  if (!user.uniqueId) {
    const autoId = generateUniqueId(user.role, user.phone);
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: { uniqueId: autoId }
      });
      user.uniqueId = autoId;
    } catch {
    }
  }
  return buildUserSession(user);
}
async function registerUser(payload) {
  const emailNorm = payload.email.trim().toLowerCase();
  const rawDigits = (payload.phone || "").replace(/\D/g, "").slice(-10);
  const hasValidPhone = rawDigits.length === 10;
  const phoneFormatted = hasValidPhone ? `+91 ${rawDigits}` : `+91 98${Math.floor(1e7 + Math.random() * 9e7)}`;
  if (!payload.name || !payload.email) {
    throw new Error("Full name and email address are required for registration");
  }
  const phoneQuery = hasValidPhone ? [
    { phone: { equals: `+91 ${rawDigits}` } },
    { phone: { equals: `+91${rawDigits}` } },
    { phone: { contains: rawDigits } }
  ] : [];
  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { equals: emailNorm, mode: "insensitive" } },
        ...phoneQuery
      ]
    }
  });
  if (existing) {
    const isEmailMatch = existing.email.toLowerCase() === emailNorm;
    const exDigits = (existing.phone || "").replace(/\D/g, "").slice(-10);
    const isPhoneMatch = hasValidPhone && exDigits === rawDigits;
    if (isEmailMatch && isPhoneMatch) {
      throw new Error(`An account with email "${emailNorm}" is already registered. Please sign in or use "Forgot Password".`);
    } else if (isEmailMatch) {
      throw new Error(`An account with email "${emailNorm}" is already registered. Please sign in with your password or use "Forgot Password" to reset it.`);
    } else if (isPhoneMatch) {
      throw new Error(`The mobile number "${payload.phone.trim()}" is already registered with another account. Please use a different phone number or sign in with your registered email.`);
    } else {
      throw new Error(`An account with matching credentials is already registered. Please sign in instead.`);
    }
  }
  const dbRole = "CUSTOMER";
  const feRole = "customer";
  if (!payload.password || payload.password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }
  const passwordHash = hashPassword(payload.password);
  const uniqueId = generateUniqueId("CUSTOMER", phoneFormatted);
  const user = await prisma.user.create({
    data: {
      uniqueId,
      name: payload.name.trim(),
      email: emailNorm,
      phone: phoneFormatted,
      role: dbRole,
      password: passwordHash,
      isActive: true
    }
  });
  const metaPatch = {
    customerData: {
      ...payload.customerData || {},
      memberSince: (/* @__PURE__ */ new Date()).toLocaleDateString("en-IN", { month: "short", year: "numeric" }),
      totalBookings: 0
    }
  };
  saveUserMeta(user.email, metaPatch);
  saveUserMeta(user.id, metaPatch);
  const token = signJwt({
    userId: user.id,
    uniqueId: user.uniqueId || uniqueId,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: feRole,
    dbRole: user.role,
    gosalaIds: [],
    gosalaNames: [],
    customerData: metaPatch.customerData
  });
  return {
    token,
    user: {
      id: user.id,
      uniqueId: user.uniqueId || uniqueId,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: feRole,
      dbRole: user.role,
      avatar: user.avatar,
      gosalas: [],
      assignedGosalaNames: [],
      customerData: metaPatch.customerData
    }
  };
}
async function getDirectoryAccounts() {
  try {
    const [users, allGosalas] = await Promise.all([
      prisma.user.findMany({
        where: { isActive: true },
        include: {
          managerAssignments: {
            include: { gosala: true }
          }
        },
        orderBy: { createdAt: "asc" }
      }),
      prisma.gosala.findMany({ where: { isActive: true } }).catch(() => [])
    ]);
    if (users && users.length > 0) {
      return users.map((u) => {
        let assignedGosalas = (u.managerAssignments || []).map((a) => ({
          id: a.gosala.id,
          name: a.gosala.name
        }));
        if (u.role === "OPERATIONS_ADMIN" || u.role === "SUPER_ADMIN") {
          const userEmail = (u.email || "").toLowerCase().trim();
          allGosalas.forEach((g) => {
            const meta2 = g.metadata && typeof g.metadata === "object" ? g.metadata : getGosalaMeta(g.id, g.name);
            const govEmail = (g.adminEmail || meta2.governingAdminEmail || meta2.adminEmail || "").toLowerCase().trim();
            const isMatch = g.adminId && g.adminId === u.id || userEmail && govEmail === userEmail;
            if (isMatch && !assignedGosalas.some((x) => x.id === g.id)) {
              assignedGosalas.push({ id: g.id, name: g.name });
            }
          });
        }
        const meta = getUserMeta(u.email || u.id);
        const isSuper = u.role === "SUPER_ADMIN";
        return {
          id: u.id,
          uniqueId: u.uniqueId,
          name: u.name,
          email: u.email,
          phone: u.phone,
          role: mapDbRoleToFrontend(u.role),
          dbRole: u.role,
          assignedGosalaNames: isSuper ? ["All Network Gaushalas"] : assignedGosalas.map((g) => g.name),
          primaryGosala: isSuper ? "Platform Governance" : assignedGosalas[0]?.name || meta.driverData?.gosalaBase || "General Roster",
          driverData: meta.driverData,
          customerData: meta.customerData
        };
      });
    }
    return [];
  } catch (err) {
    console.warn("[getDirectoryAccounts] DB query failed:", err);
    return [];
  }
}
async function getAllUsers() {
  try {
    const [users, allGosalas] = await Promise.all([
      prisma.user.findMany({
        include: {
          managerAssignments: {
            include: { gosala: true }
          }
        },
        orderBy: { createdAt: "desc" }
      }),
      prisma.gosala.findMany({ where: { isActive: true } }).catch(() => [])
    ]);
    if (users && users.length > 0) {
      return users.map((u) => {
        let assignedGosalas = (u.managerAssignments || []).map((a) => ({
          id: a.gosala.id,
          name: a.gosala.name
        }));
        if (u.role === "OPERATIONS_ADMIN" || u.role === "SUPER_ADMIN") {
          const userEmail = (u.email || "").toLowerCase().trim();
          allGosalas.forEach((g) => {
            const meta2 = g.metadata && typeof g.metadata === "object" ? g.metadata : getGosalaMeta(g.id, g.name);
            const govEmail = (g.adminEmail || meta2.governingAdminEmail || meta2.adminEmail || "").toLowerCase().trim();
            const isMatch = g.adminId && g.adminId === u.id || userEmail && govEmail === userEmail;
            if (isMatch && !assignedGosalas.some((x) => x.id === g.id)) {
              assignedGosalas.push({ id: g.id, name: g.name });
            }
          });
        }
        const meta = getUserMeta(u.email || u.id);
        return {
          id: u.id,
          uniqueId: u.uniqueId,
          name: u.name,
          email: u.email,
          phone: u.phone,
          role: mapDbRoleToFrontend(u.role),
          dbRole: u.role,
          isActive: u.isActive,
          avatar: u.avatar,
          createdAt: u.createdAt,
          assignedGosalaNames: assignedGosalas.map((g) => g.name),
          driverData: meta.driverData,
          customerData: meta.customerData
        };
      });
    }
    return [];
  } catch (err) {
    console.warn("[getAllUsers] DB query failed:", err);
    return [];
  }
}
async function updateUser(id, updates) {
  const data = {};
  if (updates.name) data.name = updates.name.trim();
  if (updates.phone) data.phone = updates.phone.trim();
  if (updates.role) data.role = mapFrontendToDbRole(updates.role);
  if (updates.isActive !== void 0) data.isActive = updates.isActive;
  if (updates.password) {
    data.password = hashPassword(updates.password);
  }
  const updated = await prisma.user.update({
    where: { id },
    data,
    include: { managerAssignments: { include: { gosala: true } } }
  });
  const metaPatch = {};
  if (updates.customerData) metaPatch.customerData = updates.customerData;
  if (updates.driverData) metaPatch.driverData = updates.driverData;
  if (updates.managerData) metaPatch.managerData = updates.managerData;
  if (Object.keys(metaPatch).length > 0) {
    saveUserMeta(updated.email, metaPatch);
    saveUserMeta(updated.id, metaPatch);
  }
  const { password: _password, ...safeUpdated } = updated;
  return safeUpdated;
}
async function deleteUser(id) {
  if (!id) return null;
  const cleanId = id.startsWith("MGR-") ? id.replace(/^MGR-/, "") : id;
  const u = await prisma.user.findFirst({
    where: {
      OR: [
        { id },
        { id: cleanId },
        { uniqueId: id },
        { email: { equals: id, mode: "insensitive" } },
        { name: { equals: id, mode: "insensitive" } }
      ]
    }
  });
  if (u) {
    deleteUserMeta(u.email);
    deleteUserMeta(u.id);
    await prisma.gosalaManagerAssignment.deleteMany({
      where: { userId: u.id }
    }).catch(() => {
    });
    try {
      await prisma.user.delete({ where: { id: u.id } });
    } catch (err) {
      console.warn("[deleteUser] prisma delete notice:", err?.message);
    }
    return { id: u.id, email: u.email, deleted: true };
  }
  deleteUserMeta(id);
  return { id, deleted: true };
}
async function switchUserContext(caller, targetRole) {
  if (!caller || !caller.userId) {
    const err = new Error("Unauthenticated: Valid session token is required to switch context");
    err.status = 401;
    throw err;
  }
  if (targetRole !== "super_admin" && targetRole !== "admin") {
    const err = new Error("Invalid target role. Context switching is strictly limited to 'super_admin' or 'admin'");
    err.status = 400;
    throw err;
  }
  const dbUser = await prisma.user.findUnique({
    where: { id: caller.userId },
    include: { managerAssignments: { include: { gosala: true } } }
  });
  if (!dbUser || dbUser.isActive === false) {
    const err = new Error("Account not found or inactive");
    err.status = 401;
    throw err;
  }
  if (dbUser.role !== "SUPER_ADMIN") {
    console.warn(`[SECURITY ALERT] Unauthorized context switch attempt by non-super-admin user ${dbUser.email} (DB Role: ${dbUser.role})`);
    const err = new Error("Forbidden: Only genuine Super Admin accounts can switch execution context");
    err.status = 403;
    throw err;
  }
  const userMeta = getUserMeta(dbUser.email || dbUser.id);
  if (targetRole === "admin") {
    const adminEmail = (dbUser.email || "").toLowerCase().trim();
    const allGosalas = await prisma.gosala.findMany({ where: { isActive: true } });
    const personalGosalas = [];
    allGosalas.forEach((g) => {
      const meta = g.metadata && typeof g.metadata === "object" ? g.metadata : getGosalaMeta(g.id, g.name);
      const govEmail = (g.adminEmail || meta.governingAdminEmail || "").toLowerCase().trim();
      const adminIdMatch = Boolean(meta.adminId && meta.adminId === dbUser.id || g.adminId && g.adminId === dbUser.id);
      if (govEmail && govEmail === adminEmail || adminIdMatch) {
        personalGosalas.push({ id: g.id, name: g.name });
      }
    });
    const gosalaIds = personalGosalas.map((g) => g.id);
    const gosalaNames = personalGosalas.map((g) => g.name);
    const uniqueId = dbUser.uniqueId || generateUniqueId(dbUser.role, dbUser.phone);
    const token = signJwt({
      userId: dbUser.id,
      uniqueId,
      name: dbUser.name,
      email: dbUser.email,
      phone: dbUser.phone,
      role: "admin",
      dbRole: "OPERATIONS_ADMIN",
      gosalaIds,
      gosalaNames,
      adminId: dbUser.id,
      originalRole: "super_admin",
      isContextSwitched: true,
      contextSwitchedAt: Math.floor(Date.now() / 1e3),
      driverData: caller.driverData,
      customerData: caller.customerData
    });
    return {
      token,
      user: {
        id: dbUser.id,
        uniqueId,
        name: dbUser.name,
        email: dbUser.email,
        phone: dbUser.phone,
        role: "admin",
        dbRole: "OPERATIONS_ADMIN",
        avatar: dbUser.avatar,
        gosalas: personalGosalas,
        assignedGosalaNames: gosalaNames,
        originalRole: "super_admin",
        isContextSwitched: true,
        driverData: caller.driverData,
        customerData: caller.customerData,
        adminData: userMeta.adminData
      }
    };
  } else {
    const uniqueId = dbUser.uniqueId || generateUniqueId(dbUser.role, dbUser.phone);
    const token = signJwt({
      userId: dbUser.id,
      uniqueId,
      name: dbUser.name,
      email: dbUser.email,
      phone: dbUser.phone,
      role: "super_admin",
      dbRole: "SUPER_ADMIN",
      gosalaIds: [],
      gosalaNames: ["All Network Gaushalas"],
      originalRole: "super_admin",
      isContextSwitched: false,
      contextSwitchedAt: Math.floor(Date.now() / 1e3),
      driverData: caller.driverData,
      customerData: caller.customerData
    });
    return {
      token,
      user: {
        id: dbUser.id,
        uniqueId,
        name: dbUser.name,
        email: dbUser.email,
        phone: dbUser.phone,
        role: "super_admin",
        dbRole: "SUPER_ADMIN",
        avatar: dbUser.avatar,
        gosalas: [],
        assignedGosalaNames: ["All Network Gaushalas"],
        originalRole: "super_admin",
        isContextSwitched: false,
        driverData: caller.driverData,
        customerData: caller.customerData,
        adminData: userMeta.adminData
      }
    };
  }
}

// server/services/resendService.ts
import nodemailer from "nodemailer";
import dns from "node:dns";
async function sendOtpEmail({
  toEmail,
  userName = "Devotee",
  otp,
  expiryMinutes = 10,
  purpose = "PASSWORD_RESET",
  detail = ""
}) {
  const normEmail = toEmail.trim().toLowerCase();
  if (normEmail.endsWith(".test") || normEmail.endsWith(".example") || normEmail.includes("example.com")) {
    console.log(`[Test Mock Dispatch] OTP for ${normEmail}: ${otp}`);
    return { success: true, id: `<test-${Date.now()}@gomaa.test>`, simulated: true };
  }
  const subject = `Your GOMAA Verification Code: ${otp}`;
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>GOMAA Verification Code</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f7f5f0; margin: 0; padding: 24px; color: #201c16; }
    .card { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e6e0d4; padding: 36px 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
    .header { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; border-bottom: 1px solid #f0ebe0; padding-bottom: 16px; }
    .logo-badge { width: 36px; height: 36px; background-color: #d97706; color: #ffffff; border-radius: 4px; display: inline-flex; align-items: center; justify-content: center; font-weight: bold; font-size: 18px; }
    .brand-title { font-size: 20px; font-weight: 700; color: #201c16; margin: 0; }
    .brand-sub { font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; color: #78716c; margin: 2px 0 0 0; }
    .greeting { font-size: 15px; font-weight: 600; color: #201c16; margin-bottom: 8px; }
    .lead-text { font-size: 13.5px; line-height: 1.5; color: #44403c; margin-bottom: 24px; }
    .otp-container { background: #fffbeb; border: 1.5px dashed #f59e0b; border-radius: 6px; padding: 18px; text-align: center; margin: 24px 0; }
    .otp-code { font-family: 'Courier New', monospace; font-size: 32px; font-weight: 800; letter-spacing: 0.25em; color: #b45309; }
    .otp-hint { font-size: 11.5px; color: #78716c; margin-top: 6px; }
    .security-notice { font-size: 12px; line-height: 1.5; color: #78716c; background: #f5f5f4; border-radius: 4px; padding: 12px 14px; margin-top: 24px; }
    .footer { margin-top: 32px; text-align: center; font-size: 11px; color: #a8a29e; border-top: 1px solid #f0ebe0; padding-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="logo-badge">G</div>
      <div>
        <h1 class="brand-title">GOMAA</h1>
        <p class="brand-sub">Sacred Operations &amp; Welfare Platform</p>
      </div>
    </div>
    
    <div class="greeting">Namaste ${userName},</div>
    <p class="lead-text">
      ${purpose === "WITHDRAWAL" ? `We received a request to withdraw money from your GOMAA wallet${detail ? ` (${detail})` : ""}. Enter the single-use code below to confirm it:` : "We received a request to verify your identity and reset your account password on the GOMAA platform. Please use the single-use verification code below:"}
    </p>

    <div class="otp-container">
      <div class="otp-code">${otp}</div>
      <div class="otp-hint">Expires in ${expiryMinutes} minutes \xB7 Never share this code with anyone</div>
    </div>

    <div class="security-notice">
      <strong>Security Alert:</strong> ${purpose === "WITHDRAWAL" ? "If you did not ask to withdraw money, do not share this code with anyone and tell the Super Admin straight away. No money moves until the code is entered." : "If you did not initiate this password recovery request, your account may be secure, but someone may have typed your email address by mistake. You can safely ignore this email; no changes have been made to your credentials."}
    </div>

    <div class="footer">
      GOMAA Sacred Operations Platform \xB7 Governed by Vedic Care &amp; Multi-Tenant Platform Security
    </div>
  </div>
</body>
</html>
`;
  const text2 = `Namaste ${userName},

${purpose === "WITHDRAWAL" ? `Your GOMAA code to confirm a withdrawal${detail ? ` of ${detail}` : ""} is: ${otp}` : `Your GOMAA verification code is: ${otp}`}

This single-use code expires in ${expiryMinutes} minutes.
Never share this code with anyone.

${purpose === "WITHDRAWAL" ? "If you did not ask to withdraw money, tell the Super Admin straight away. No money moves until the code is entered." : "If you did not request this, you can safely ignore this email."}

\u2014 GOMAA Operations
Sacred Operations & Cattle Welfare Platform`;
  const gmailUser = (process.env.GMAIL_USER || "").replace(/["']/g, "").trim();
  const gmailPass = (process.env.GMAIL_APP_PASSWORD || "").replace(/["'\s]/g, "").trim();
  if (gmailUser && gmailPass) {
    try {
      const hostIp = await new Promise((resolve) => {
        dns.lookup("smtp.gmail.com", { family: 4 }, (err, address) => {
          if (!err && address) {
            resolve(address);
          } else {
            resolve("192.178.211.108");
          }
        });
      });
      const transporter = nodemailer.createTransport({
        host: hostIp,
        port: 465,
        secure: true,
        tls: { servername: "smtp.gmail.com" },
        connectionTimeout: 8e3,
        greetingTimeout: 8e3,
        socketTimeout: 1e4,
        auth: {
          user: gmailUser,
          pass: gmailPass
        }
      });
      const info = await transporter.sendMail({
        from: `"GOMAA Security" <${gmailUser}>`,
        to: toEmail,
        subject: purpose === "WITHDRAWAL" ? `[GOMAA] Withdrawal confirmation code: ${otp}` : `[GOMAA] Verification Code: ${otp}`,
        text: text2,
        html,
        headers: {
          "X-Priority": "1",
          "Priority": "urgent",
          "Importance": "high"
        }
      });
      console.log(`[Gmail SMTP Success] OTP sent to ${toEmail} (MessageId: ${info.messageId})`);
      return { success: true, id: info.messageId };
    } catch (err) {
      console.error("[Gmail SMTP Error]:", err.message);
    }
  }
  const apiKey = (process.env.RESEND_API_KEY || "").trim();
  const fromEmail = (process.env.RESEND_FROM_EMAIL || "GOMAA Operations <onboarding@resend.dev>").trim();
  if (apiKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [toEmail],
          subject,
          html
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error("[Resend API Error]:", data);
        if (process.env.NODE_ENV !== "production") console.log(`[FALLBACK CODE DISPATCH] OTP for ${toEmail}: ${otp}`);
        return {
          success: false,
          error: data.message || `Resend HTTP ${res.status}`
        };
      }
      console.log(`[Resend Success] Email OTP sent to ${toEmail} (MessageId: ${data.id})`);
      return {
        success: true,
        id: data.id
      };
    } catch (err) {
      console.error("[Resend Fetch Error]:", err.message);
      return {
        success: false,
        error: err.message
      };
    }
  }
  if (process.env.NODE_ENV === "production") {
    console.error("[EMAIL] No email gateway is configured; the code was NOT sent.");
    return { success: false, error: "No email gateway configured" };
  }
  console.log(`
========================================================================`);
  console.log(`[EMAIL DISPATCH NOTICE] Neither GMAIL_APP_PASSWORD nor RESEND_API_KEY configured.`);
  console.log(`[OUT-OF-BAND DISPATCH] Password Reset OTP for ${toEmail}: ${otp}`);
  console.log(`[EXPIRY] Valid for ${expiryMinutes} minutes. Set GMAIL_APP_PASSWORD or RESEND_API_KEY for live emails.`);
  console.log(`========================================================================
`);
  return { success: true, simulated: true };
}
function msg91EmailConfigured() {
  return Boolean(
    (process.env.MSG91_AUTH_KEY || "").trim() && (process.env.MSG91_EMAIL_DOMAIN || "").trim() && (process.env.MSG91_EMAIL_FROM || "").trim() && (process.env.MSG91_EMAIL_TEMPLATE_ID || "").trim()
  );
}
async function sendViaMsg91Email(to, name, subject, text2) {
  try {
    const res = await fetch("https://control.msg91.com/api/v5/email/send", {
      method: "POST",
      headers: { authkey: (process.env.MSG91_AUTH_KEY || "").trim(), "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        recipients: [{ to: [{ name: name || to, email: to }], variables: { name: name || "Devotee", title: subject, message: text2 } }],
        from: { name: "GOMAA", email: (process.env.MSG91_EMAIL_FROM || "").trim() },
        domain: (process.env.MSG91_EMAIL_DOMAIN || "").trim(),
        template_id: (process.env.MSG91_EMAIL_TEMPLATE_ID || "").trim()
      })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.status !== "fail" && data?.hasError !== true) return { success: true, id: data?.data?.unique_id || data?.message };
    return { success: false, error: String(data?.errors || data?.message || `MSG91 email HTTP ${res.status}`) };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
var escapeHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function notificationHtml(subject, text2) {
  const body = escapeHtml(text2).split(/\n\n+/).map((p) => `<p style="margin:0 0 14px 0;font-size:14px;line-height:1.55;color:#44403c">${p.replace(/\n/g, "<br>")}</p>`).join("");
  return `<!DOCTYPE html><html><body style="margin:0;padding:24px;background:#f7f5f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e6e0d4;border-radius:8px;padding:28px 28px 20px">
<div style="font-size:18px;font-weight:700;color:#201c16;margin-bottom:4px">GOMAA</div>
<div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#78716c;margin-bottom:20px">${escapeHtml(subject)}</div>
${body}
<div style="margin-top:22px;padding-top:14px;border-top:1px solid #f0ebe0;font-size:11px;color:#a8a29e">GOMAA Sacred Operations Platform. This is an automated message.</div>
</div></body></html>`;
}
async function sendNotificationEmail({ toEmail, subject, text: text2, name }) {
  const to = toEmail.trim().toLowerCase();
  if (!to || to.endsWith(".invalid") || to.endsWith(".test") || to.endsWith(".example") || to.includes("example.com")) {
    return { success: true, simulated: true };
  }
  const html = notificationHtml(subject, text2);
  if (msg91EmailConfigured()) {
    const r = await sendViaMsg91Email(to, name || "", subject, text2);
    if (r.success) return r;
    console.warn(`[MSG91 email] not sent, trying fallback: ${r.error}`);
  }
  const gmailUser = (process.env.GMAIL_USER || "").replace(/["']/g, "").trim();
  const gmailPass = (process.env.GMAIL_APP_PASSWORD || "").replace(/["'\s]/g, "").trim();
  if (gmailUser && gmailPass) {
    try {
      const hostIp = await new Promise((resolve) => {
        dns.lookup("smtp.gmail.com", { family: 4 }, (err, address) => resolve(!err && address ? address : "192.178.211.108"));
      });
      const transporter = nodemailer.createTransport({
        host: hostIp,
        port: 465,
        secure: true,
        tls: { servername: "smtp.gmail.com" },
        connectionTimeout: 8e3,
        greetingTimeout: 8e3,
        socketTimeout: 1e4,
        auth: { user: gmailUser, pass: gmailPass }
      });
      const info = await transporter.sendMail({ from: `"GOMAA" <${gmailUser}>`, to, subject: `[GOMAA] ${subject}`, text: text2, html });
      return { success: true, id: info.messageId };
    } catch (err) {
      console.error("[Gmail SMTP notification error]:", err.message);
    }
  }
  const apiKey = (process.env.RESEND_API_KEY || "").trim();
  const fromEmail = (process.env.RESEND_FROM_EMAIL || "GOMAA Operations <onboarding@resend.dev>").trim();
  if (apiKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: fromEmail, to: [to], subject: `[GOMAA] ${subject}`, html, text: text2 })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { success: false, error: data.message || `Resend HTTP ${res.status}` };
      return { success: true, id: data.id };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
  console.log(`[EMAIL NOT SENT: no Gmail or Resend configured] To: ${to} | ${subject}`);
  return { success: false, error: "No email gateway configured" };
}

// server/services/smsService.ts
function indianMobile(toPhone) {
  const d = String(toPhone || "").replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) return d.slice(2);
  if (d.length === 10) return d;
  return "";
}
async function sendTemplateSms({
  toPhone,
  templateId,
  vars = {}
}) {
  const authKey = (process.env.MSG91_AUTH_KEY || "").trim();
  const mobile = indianMobile(toPhone);
  if (!authKey || !templateId) return { success: false, error: "MSG91 is not configured for this message" };
  if (!mobile) return { success: false, error: "No valid Indian mobile number on this account" };
  try {
    const res = await fetch("https://control.msg91.com/api/v5/flow", {
      method: "POST",
      headers: { authkey: authKey, "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        template_id: templateId,
        short_url: "0",
        recipients: [{ mobiles: `91${mobile}`, ...vars }]
      })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.type === "success") return { success: true, provider: "msg91", messageId: data.message };
    return { success: false, error: data?.message || `MSG91 HTTP ${res.status}` };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
function whatsappConfigured() {
  return Boolean(
    (process.env.MSG91_AUTH_KEY || "").trim() && (process.env.MSG91_WHATSAPP_NUMBER || "").trim() && (process.env.MSG91_WHATSAPP_NAMESPACE || "").trim()
  );
}
async function sendWhatsAppTemplate({
  toPhone,
  template,
  vars,
  language = "en",
  urlButtonValue
}) {
  if (!whatsappConfigured()) return { success: false, error: "MSG91 WhatsApp is not configured" };
  const mobile = indianMobile(toPhone);
  if (!mobile) return { success: false, error: "No valid Indian mobile number on this account" };
  const components = {};
  vars.forEach((v, i) => {
    components[`body_${i + 1}`] = { type: "text", value: String(v).replace(/\s+/g, " ").trim().slice(0, 60) || "-" };
  });
  const allComponents = { ...components };
  if (urlButtonValue) allComponents.button_1 = { subtype: "url", type: "text", value: urlButtonValue };
  try {
    const res = await fetch("https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/", {
      method: "POST",
      headers: { authkey: (process.env.MSG91_AUTH_KEY || "").trim(), "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        integrated_number: (process.env.MSG91_WHATSAPP_NUMBER || "").trim(),
        content_type: "template",
        payload: {
          messaging_product: "whatsapp",
          type: "template",
          template: {
            name: template,
            language: { code: language, policy: "deterministic" },
            namespace: (process.env.MSG91_WHATSAPP_NAMESPACE || "").trim(),
            to_and_components: [{ to: [`91${mobile}`], components: allComponents }]
          }
        }
      })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.status !== "fail" && data?.hasError !== true) {
      return { success: true, provider: "msg91", messageId: data?.request_id || data?.data?.request_id || data?.message };
    }
    return { success: false, error: String(data?.errors || data?.message || `MSG91 WhatsApp HTTP ${res.status}`) };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
async function sendOtpSms({
  toPhone,
  otp,
  expiryMinutes = 10,
  purpose = "PASSWORD_RESET"
}) {
  const rawDigits = toPhone.replace(/\D/g, "");
  const indian10Digits = rawDigits.length === 12 && rawDigits.startsWith("91") ? rawDigits.slice(2) : rawDigits.length === 10 ? rawDigits : "";
  const e164Phone = toPhone.startsWith("+") ? toPhone.replace(/\s+/g, "") : `+${rawDigits}`;
  if (process.env.NODE_ENV === "test") return { success: true, provider: "simulated" };
  const msg91AuthKey = (process.env.MSG91_AUTH_KEY || "").trim();
  const msg91TemplateId = (purpose === "WITHDRAWAL" ? (process.env.MSG91_TEMPLATE_WITHDRAWAL_OTP || "").trim() : "") || (process.env.MSG91_TEMPLATE_ID || "").trim();
  const fast2smsKey = (process.env.FAST2SMS_API_KEY || "").trim();
  const twilioSid = (process.env.TWILIO_ACCOUNT_SID || "").trim();
  const twilioAuth = (process.env.TWILIO_AUTH_TOKEN || "").trim();
  const twilioFrom = (process.env.TWILIO_PHONE_NUMBER || "").trim();
  if (msg91AuthKey && indian10Digits) {
    try {
      const templateParam = msg91TemplateId ? `&template_id=${encodeURIComponent(msg91TemplateId)}` : "";
      const url = `https://control.msg91.com/api/v5/otp?mobile=91${indian10Digits}&authkey=${encodeURIComponent(msg91AuthKey)}&otp=${encodeURIComponent(otp)}${templateParam}`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        }
      });
      const data = await res.json().catch(() => ({}));
      if (data?.type === "success" || res.ok) {
        return { success: true, provider: "msg91", messageId: data.message };
      }
      console.warn("[MSG91 Notice]:", data);
    } catch (err) {
      console.error("[MSG91 Error]:", err.message);
    }
  }
  if (fast2smsKey && indian10Digits) {
    try {
      const res = await fetch("https://www.fast2sms.com/dev/bulkV2", {
        method: "POST",
        headers: {
          authorization: fast2smsKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          route: "otp",
          variables_values: otp,
          numbers: indian10Digits
        })
      });
      const data = await res.json().catch(() => ({}));
      if (data?.return === true) {
        return { success: true, provider: "fast2sms", messageId: data.request_id };
      }
      console.warn("[Fast2SMS Notice]:", data);
    } catch (err) {
      console.error("[Fast2SMS Error]:", err.message);
    }
  }
  if (twilioSid && twilioAuth && twilioFrom) {
    try {
      const basicAuth = Buffer.from(`${twilioSid}:${twilioAuth}`).toString("base64");
      const params = new URLSearchParams();
      params.append("To", e164Phone);
      params.append("From", twilioFrom);
      params.append("Body", `Your GOMAA verification code is: ${otp}. Valid for ${expiryMinutes} minutes. Never share this code.`);
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${basicAuth}`,
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: params.toString()
        }
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.sid) {
        return { success: true, provider: "twilio", messageId: data.sid };
      }
      console.warn("[Twilio SMS Notice]:", data);
    } catch (err) {
      console.error("[Twilio Error]:", err.message);
    }
  }
  if (process.env.NODE_ENV === "production") {
    console.error("[SMS] No SMS gateway accepted the message; the code was NOT sent.");
    return { success: false, error: "No SMS gateway available" };
  }
  console.log(`
========================================================================`);
  console.log(`[MOBILE SMS OTP DISPATCH] Out-of-band delivery to: ${toPhone}`);
  console.log(`[VERIFICATION CODE] ${otp}`);
  console.log(`[EXPIRY] Valid for ${expiryMinutes} minutes.`);
  console.log(`========================================================================
`);
  if (!msg91AuthKey && !fast2smsKey && !twilioSid) {
    return {
      success: false,
      error: "No SMS gateway configured. Please use 'Email Address' verification to receive your code, or configure MSG91 in environment settings."
    };
  }
  return {
    success: false,
    error: "Carrier SMS failed (Indian Telecom DLT website verification required on Fast2SMS). Please use 'Email Address' verification to receive your 6-digit code."
  };
}

// server/services/otpService.ts
import crypto5 from "node:crypto";
function maskIdentifier(id, channel) {
  if (channel === "EMAIL" || id.includes("@")) {
    const [local, domain] = id.split("@");
    if (!domain) return id;
    const visible = local.length > 2 ? local[0] + "***" + local[local.length - 1] : local[0] + "***";
    return `${visible}@${domain}`;
  } else {
    const clean = id.replace(/\s+/g, "");
    if (clean.length > 6) {
      return clean.slice(0, 4) + "******" + clean.slice(-2);
    }
    return id;
  }
}
function hashOtp(otp) {
  const salt = crypto5.randomBytes(16).toString("hex");
  const derived = crypto5.scryptSync(otp, salt, 32);
  return `scrypt$${salt}$${derived.toString("hex")}`;
}
function verifyOtpHash(otp, storedHash) {
  if (!storedHash || !storedHash.startsWith("scrypt$")) return false;
  const parts = storedHash.split("$");
  if (parts.length !== 3) return false;
  const [, salt, digest2] = parts;
  if (!salt || !digest2) return false;
  const derived = crypto5.scryptSync(otp, salt, 32).toString("hex");
  const bufExpected = Buffer.from(digest2);
  const bufActual = Buffer.from(derived);
  return bufExpected.length === bufActual.length && crypto5.timingSafeEqual(bufExpected, bufActual);
}
var otpTableVerified = false;
async function ensureOtpTable() {
  if (otpTableVerified) return;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "verification_otps" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "identifier" TEXT NOT NULL,
        "otpHash" TEXT NOT NULL,
        "channel" TEXT NOT NULL DEFAULT 'EMAIL',
        "purpose" TEXT NOT NULL DEFAULT 'PASSWORD_RESET',
        "attempts" INTEGER NOT NULL DEFAULT 0,
        "maxAttempts" INTEGER NOT NULL DEFAULT 5,
        "expiresAt" TIMESTAMP(3) NOT NULL,
        "used" BOOLEAN NOT NULL DEFAULT false,
        "usedAt" TIMESTAMP(3),
        "ipAddress" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    try {
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "verification_otps_identifier_purpose_used_idx" 
          ON "verification_otps"("identifier", "purpose", "used");
      `);
    } catch {
    }
    otpTableVerified = true;
  } catch (err) {
    console.warn("[OTP Schema Self-Heal Notice]:", err.message);
  }
}
async function requestPasswordResetOtp(emailOrPhone, channel = "EMAIL", ipAddress) {
  const norm = emailOrPhone.trim().toLowerCase();
  if (!norm) {
    throw new Error("Registered email or phone number is required");
  }
  const rawDigits = emailOrPhone.replace(/\D/g, "").slice(-10);
  await ensureOtpTable();
  const activeUsers = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, email: true, phone: true, name: true }
  });
  const user = activeUsers.find((u) => {
    if (u.email.toLowerCase() === norm) return true;
    if (rawDigits.length === 10) {
      const uDigits = (u.phone || "").replace(/\D/g, "").slice(-10);
      if (uDigits && uDigits === rawDigits) return true;
    }
    return false;
  });
  if (!user) {
    if (channel === "PHONE") {
      throw new Error(`No registered account found with mobile number "${emailOrPhone}". Please verify your 10-digit number or use your registered email address.`);
    } else {
      throw new Error(`No registered account found with email "${norm}". Please check for typos or sign in with your registered account.`);
    }
  }
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1e3);
  const recentCountRows = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int as count FROM "verification_otps" 
     WHERE "identifier" = $1 AND "purpose" = 'PASSWORD_RESET' AND "createdAt" > $2`,
    user.email.toLowerCase(),
    fifteenMinutesAgo
  );
  const recentCount = recentCountRows[0]?.count || 0;
  if (recentCount >= 5) {
    throw new Error("Too many verification requests. Please wait 15 minutes before requesting another code.");
  }
  const rawOtp = crypto5.randomInt(1e5, 999999).toString();
  const otpHash = hashOtp(rawOtp);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1e3);
  const otpId = crypto5.randomUUID();
  const primaryId = channel === "PHONE" && rawDigits.length === 10 ? rawDigits : user.email.toLowerCase();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "verification_otps" 
     ("id", "identifier", "otpHash", "channel", "purpose", "attempts", "maxAttempts", "expiresAt", "used", "ipAddress", "createdAt") 
     VALUES ($1, $2, $3, $4, 'PASSWORD_RESET', 0, 5, $5, false, $6, NOW())`,
    otpId,
    primaryId,
    otpHash,
    channel,
    expiresAt,
    ipAddress || null
  );
  if (primaryId !== user.email.toLowerCase()) {
    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "verification_otps" 
         ("id", "identifier", "otpHash", "channel", "purpose", "attempts", "maxAttempts", "expiresAt", "used", "ipAddress", "createdAt") 
         VALUES ($1, $2, $3, $4, 'PASSWORD_RESET', 0, 5, $5, false, $6, NOW())`,
        crypto5.randomUUID(),
        user.email.toLowerCase(),
        otpHash,
        channel,
        expiresAt,
        ipAddress || null
      );
    } catch {
    }
  }
  if (channel === "EMAIL") {
    const emailResult = await sendOtpEmail({
      toEmail: user.email,
      userName: user.name,
      otp: rawOtp,
      expiryMinutes: 10
    });
    if (!emailResult.success) {
      throw new Error(
        emailResult.error || "Email verification dispatch is temporarily unavailable. Please verify your email configuration or try again in a few moments."
      );
    }
  } else {
    const smsResult = await sendOtpSms({
      toPhone: user.phone || emailOrPhone,
      otp: rawOtp,
      expiryMinutes: 10
    });
    if (!smsResult.success) {
      throw new Error(
        smsResult.error || "Carrier SMS dispatch is currently unavailable. Please use 'Email Address' verification to receive your 6-digit code."
      );
    }
  }
  const targetIdentifier = channel === "PHONE" ? user.phone || emailOrPhone : user.email;
  return {
    ok: true,
    message: `A 6-digit verification code has been dispatched to ${maskIdentifier(targetIdentifier, channel)}.`,
    channel,
    maskedTarget: maskIdentifier(targetIdentifier, channel)
  };
}
async function verifyOtpAndGenerateResetToken(emailOrPhone, submittedOtp) {
  const norm = emailOrPhone.trim().toLowerCase();
  const cleanOtp = (submittedOtp || "").trim();
  if (!norm || !cleanOtp) {
    throw new Error("Email/phone and 6-digit verification code are required");
  }
  const rawDigits = emailOrPhone.replace(/\D/g, "").slice(-10);
  await ensureOtpTable();
  const allUsers = await prisma.user.findMany({
    select: { id: true, email: true, phone: true, name: true }
  });
  const user = allUsers.find((u) => {
    if (u.email.toLowerCase() === norm) return true;
    if (rawDigits.length === 10) {
      const uDigits = (u.phone || "").replace(/\D/g, "").slice(-10);
      if (uDigits && uDigits === rawDigits) return true;
    }
    return false;
  });
  const lookupIds = [norm];
  if (rawDigits.length === 10) lookupIds.push(rawDigits);
  if (user) {
    if (user.email) lookupIds.push(user.email.toLowerCase());
    if (user.phone) {
      lookupIds.push(user.phone.toLowerCase());
      const userDigits = user.phone.replace(/\D/g, "").slice(-10);
      if (userDigits.length === 10) lookupIds.push(userDigits);
    }
  }
  const uniqueIds = Array.from(new Set(lookupIds));
  const rows = await prisma.$queryRawUnsafe(
    `SELECT * FROM "verification_otps" 
     WHERE "identifier" = ANY($1::text[]) AND "purpose" = 'PASSWORD_RESET' AND "used" = false AND "expiresAt" > NOW() 
     ORDER BY "createdAt" DESC`,
    uniqueIds
  );
  if (!rows || rows.length === 0) {
    throw new Error("No active verification code found for this account. Please click 'Resend Code' to receive a new 6-digit OTP.");
  }
  let matchedRecord = null;
  for (const r of rows) {
    if (r.attempts < r.maxAttempts && verifyOtpHash(cleanOtp, r.otpHash)) {
      matchedRecord = r;
      break;
    }
  }
  if (!matchedRecord) {
    const latest = rows[0];
    await prisma.$executeRawUnsafe(
      `UPDATE "verification_otps" SET "attempts" = "attempts" + 1 WHERE "id" = $1`,
      latest.id
    );
    const remaining = latest.maxAttempts - (latest.attempts + 1);
    throw new Error(`Invalid verification code. ${remaining > 0 ? `${remaining} attempts remaining.` : "Code locked. Please click 'Resend Code'."}`);
  }
  const resetToken = signResetToken({
    purpose: "PASSWORD_RESET",
    identifier: user ? user.email.toLowerCase() : norm,
    otpId: matchedRecord.id
  }, 600);
  return {
    ok: true,
    resetToken,
    message: "Identity verified successfully. You may now set a new password."
  };
}
async function resetPasswordWithToken(emailOrPhone, resetToken, newPassword) {
  const norm = emailOrPhone.trim().toLowerCase();
  if (!norm || !resetToken || !newPassword) {
    throw new Error("Email, reset token, and new password are required");
  }
  if (newPassword.length < 8) {
    throw new Error("Password must be at least 8 characters long");
  }
  const verified = verifyResetToken(resetToken);
  if (!verified.valid || !verified.payload || verified.payload.purpose !== "PASSWORD_RESET") {
    throw new Error("Invalid or expired reset token. Please restart the verification process.");
  }
  const rawDigits = emailOrPhone.replace(/\D/g, "").slice(-10);
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { equals: norm, mode: "insensitive" } },
        { phone: { equals: norm, mode: "insensitive" } },
        ...rawDigits.length === 10 ? [{ phone: { contains: rawDigits } }] : []
      ],
      isActive: true
    }
  });
  if (!user) {
    throw new Error("Account not found");
  }
  const tokenIdent = (verified.payload.identifier || "").toLowerCase();
  const userEmail = (user.email || "").toLowerCase();
  const userPhone = (user.phone || "").toLowerCase();
  const userPhoneDigits = user.phone ? user.phone.replace(/\D/g, "").slice(-10) : "";
  const matches = tokenIdent === norm || tokenIdent === userEmail || tokenIdent === userPhone || rawDigits.length === 10 && tokenIdent === rawDigits || userPhoneDigits && tokenIdent === userPhoneDigits;
  if (!matches) {
    throw new Error("Reset token does not match the requested account identity.");
  }
  const otpId = verified.payload.otpId;
  if (otpId) {
    const otpRows = await prisma.$queryRawUnsafe(
      `SELECT "used" FROM "verification_otps" WHERE "id" = $1`,
      otpId
    );
    if (otpRows[0]?.used === true) {
      throw new Error("This reset token has already been used. Please request a new code.");
    }
  }
  if (!user) {
    throw new Error("Account not found");
  }
  const newHash = hashPassword(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { password: newHash }
  });
  if (otpId) {
    await prisma.$executeRawUnsafe(
      `UPDATE "verification_otps" SET "used" = true, "usedAt" = NOW() WHERE "id" = $1`,
      otpId
    );
  }
  console.log(`[SECURITY AUDIT] Password successfully reset for user ${user.email} (${user.id})`);
  return {
    ok: true,
    message: "Password updated successfully. You can now sign in with your new password.",
    user: {
      id: user.id,
      name: user.name,
      email: user.email
    }
  };
}

// server/services/notifyService.ts
var transports = { email: sendNotificationEmail, sms: sendTemplateSms, whatsapp: sendWhatsAppTemplate };
var overridden = false;
var inr = (paise) => `\u20B9${(Number(paise) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
var short = (s, n = 28) => s.length > n ? s.slice(0, n - 1) + "\u2026" : s;
function enabled() {
  return overridden || process.env.NODE_ENV !== "test";
}
async function deliver(user, msg) {
  if (!enabled()) return;
  const firstName = user.name.split(" ")[0] || "Devotee";
  const body = `Namaste ${firstName},

${msg.text}`;
  try {
    await transports.email({ toEmail: user.email, subject: msg.subject, text: body, name: firstName });
  } catch (err) {
    console.warn(`[notify] email to ${user.email} failed: ${err?.message}`);
  }
  if (msg.whatsapp && user.phone && (overridden || whatsappConfigured())) {
    try {
      const r = await transports.whatsapp({ toPhone: user.phone, template: msg.whatsapp.template, vars: [firstName, ...msg.whatsapp.vars] });
      if (!r.success) console.warn(`[notify] WhatsApp to ${user.phone} not sent: ${r.error}`);
    } catch (err) {
      console.warn(`[notify] WhatsApp to ${user.phone} failed: ${err?.message}`);
    }
  }
  if (msg.sms) {
    const templateId = (process.env[msg.sms.template] || "").trim();
    if (templateId && user.phone) {
      const vars = {};
      msg.sms.vars.forEach((v, i) => vars[`var${i + 1}`] = short(v));
      try {
        const r = await transports.sms({ toPhone: user.phone, templateId, vars });
        if (!r.success) console.warn(`[notify] SMS to ${user.phone} not sent: ${r.error}`);
      } catch (err) {
        console.warn(`[notify] SMS to ${user.phone} failed: ${err?.message}`);
      }
    }
  }
}
async function notifyUsers(userIds, msg) {
  if (!enabled() || !userIds.length) return;
  try {
    const users = await prisma.user.findMany({
      where: { id: { in: [...new Set(userIds)] }, isActive: true },
      select: { id: true, email: true, phone: true, name: true }
    });
    await Promise.all(users.map((u) => deliver(u, msg)));
  } catch (err) {
    console.warn("[notify] could not look up recipients:", err?.message);
  }
}
async function notifySuperAdmins(msg) {
  if (!enabled()) return;
  try {
    const admins = await prisma.user.findMany({ where: { role: "SUPER_ADMIN", isActive: true }, select: { id: true } });
    await notifyUsers(admins.map((a) => a.id), msg);
  } catch (err) {
    console.warn("[notify] could not look up super admins:", err?.message);
  }
}
async function notifyGosalaTeam(gosalaId, msg) {
  if (!enabled()) return;
  try {
    const gosala = await prisma.gosala.findUnique({
      where: { id: gosalaId },
      select: { adminId: true, managers: { where: { status: "Active" }, select: { userId: true } } }
    });
    if (!gosala) return;
    const ids = [gosala.adminId, ...gosala.managers.map((m) => m.userId)].filter(Boolean);
    await notifyUsers(ids, msg);
  } catch (err) {
    console.warn("[notify] could not look up gaushala team:", err?.message);
  }
}
function bookingInfo(b) {
  return {
    id: b.id,
    animal: b.animalName,
    gosala: b.gosalaName,
    date: b.bookingDate,
    time: `${b.startTime}${b.endTime ? ` \u2013 ${b.endTime}` : ""}`,
    customer: b.customerName,
    total: typeof b.totalAmount === "number" ? b.totalAmount : void 0
  };
}
var messages = {
  bookingPlaced: (b) => ({
    subject: `Booking ${b.id} received`,
    text: `Your payment${b.total ? ` of \u20B9${b.total.toLocaleString("en-IN")}` : ""} was received and booking ${b.id} for ${b.animal} at ${b.gosala} on ${b.date}, ${b.time} is now with the gaushala manager for confirmation. We will tell you as soon as it is confirmed.`,
    sms: { template: "MSG91_TEMPLATE_BOOKING_PLACED", vars: [b.id, b.animal, b.date] },
    whatsapp: { template: "gomaa_booking_placed", vars: [b.id, b.date] }
  }),
  bookingNeedsReview: (b) => ({
    subject: `New booking to review: ${b.animal} on ${b.date}`,
    text: `${b.customer || "A devotee"} booked ${b.animal} at ${b.gosala} on ${b.date}, ${b.time}${b.total ? ` (\u20B9${b.total.toLocaleString("en-IN")})` : ""}. Booking ${b.id} is paid and waiting for your review.`,
    sms: { template: "MSG91_TEMPLATE_BOOKING_REVIEW", vars: [b.id, b.animal, b.date] },
    whatsapp: { template: "gomaa_new_booking_review", vars: [b.id, b.animal] }
  }),
  bookingManagerDecided: (b, confirmed, remark) => ({
    subject: `Booking ${b.id}: ${confirmed ? "feasibility confirmed" : "declined"}`,
    text: confirmed ? `The manager confirmed feasibility for ${b.animal} on ${b.date}, ${b.time}. Booking ${b.id} now needs the operations admin's approval.` : `Booking ${b.id} for ${b.animal} on ${b.date} was declined by the manager${remark ? `: ${remark}` : ""}. The payment will be refunded.`
  }),
  bookingConfirmed: (b) => ({
    subject: `Booking ${b.id} confirmed`,
    text: `Your booking ${b.id} for ${b.animal} at ${b.gosala} on ${b.date}, ${b.time} is confirmed. You can follow it live under Track in the GOMAA app.`,
    sms: { template: "MSG91_TEMPLATE_BOOKING_CONFIRMED", vars: [b.id, b.animal, b.date] },
    whatsapp: { template: "gomaa_booking_confirmed", vars: [b.id, b.gosala] }
  }),
  bookingRejected: (b, remark) => ({
    subject: `Booking ${b.id} could not be confirmed`,
    text: `We are sorry: booking ${b.id} for ${b.animal} on ${b.date} could not be confirmed${remark ? ` (${remark})` : ""}. Your payment will be refunded to the original payment method.`,
    sms: { template: "MSG91_TEMPLATE_BOOKING_REJECTED", vars: [b.id] },
    whatsapp: { template: "gomaa_booking_rejected", vars: [b.id] }
  }),
  earningsReleased: (amountPaise, bookingId, gosala) => ({
    subject: `${inr(amountPaise)} added to your wallet`,
    text: `${inr(amountPaise)} from booking ${bookingId} at ${gosala} has been approved and added to your GOMAA wallet. You can withdraw it from My Wallet.`,
    sms: { template: "MSG91_TEMPLATE_EARNINGS", vars: [inr(amountPaise).replace("\u20B9", ""), bookingId] },
    whatsapp: { template: "gomaa_earnings_added", vars: [inr(amountPaise).replace("\u20B9", "").replace(/,/g, ""), bookingId] }
  }),
  readyForApproval: (count, totalPaise) => ({
    subject: `${count} booking${count === 1 ? "" : "s"} ready for your approval`,
    text: `${count} paid booking${count === 1 ? " has" : "s have"} passed the 2-day wait (${inr(totalPaise)} in escrow). Open Treasury & Wallets to approve and release ${count === 1 ? "it" : "them"}.`
  }),
  splitRequested: (who, gosala, from, to, reason) => ({
    subject: `Manager share change waiting: ${gosala}`,
    text: `${who} asks to change the manager's share at ${gosala} from ${from}% to ${to}%.${reason ? `

Reason: ${reason}` : ""}

Open Treasury & Wallets to approve or decline. Nothing changes until you decide.`
  }),
  splitDecided: (gosala, to, approved, note) => ({
    subject: `Manager share change ${approved ? "approved" : "declined"}: ${gosala}`,
    text: approved ? `The Super Admin approved the manager share at ${gosala} at ${to}%. It applies to bookings paid from now on.${note ? `

Note: ${note}` : ""}` : `The Super Admin declined your request to set the manager share at ${gosala} to ${to}%. The earlier percentage stays.${note ? `

Note: ${note}` : ""}`
  }),
  withdrawalPaid: (amountPaise, account, utr) => ({
    subject: `Withdrawal of ${inr(amountPaise)} sent`,
    text: `${inr(amountPaise)} was sent to ${account}.${utr ? `

Bank reference (UTR): ${utr}` : ""}

It normally shows in your account within minutes. If you did not make this withdrawal, tell the Super Admin straight away.`,
    sms: { template: "MSG91_TEMPLATE_WITHDRAWAL_PAID", vars: [inr(amountPaise).replace("\u20B9", ""), account, utr || "pending"] },
    whatsapp: { template: "gomaa_withdrawal_status", vars: [inr(amountPaise).replace("\u20B9", "").replace(/,/g, ""), "paid"] }
  }),
  withdrawalFailed: (amountPaise, reason) => ({
    subject: `Withdrawal of ${inr(amountPaise)} failed`,
    text: `Your withdrawal of ${inr(amountPaise)} could not be completed${reason ? ` (${reason})` : ""}. The full amount has been returned to your GOMAA wallet. You can try again or choose another account.`,
    sms: { template: "MSG91_TEMPLATE_WITHDRAWAL_FAILED", vars: [inr(amountPaise).replace("\u20B9", "")] },
    whatsapp: { template: "gomaa_withdrawal_status", vars: [inr(amountPaise).replace("\u20B9", "").replace(/,/g, ""), "failed and returned to your wallet"] }
  }),
  payoutAccountChanged: (added, label) => ({
    subject: `Payout account ${added ? "added" : "removed"}`,
    text: `A payout account (${label}) was ${added ? "added to" : "removed from"} your GOMAA wallet.${added ? "\n\nFor your safety a new account may need a waiting period before it can receive money." : ""}

If this was not you, contact the Super Admin straight away and change your password.`,
    sms: { template: "MSG91_TEMPLATE_PAYOUT_ACCOUNT", vars: [added ? "added" : "removed"] }
  })
};

// server/auth/authorization.ts
var normalize = (value) => String(value ?? "").trim().toLowerCase();
var values = (items) => Array.isArray(items) ? items.map(normalize).filter(Boolean) : [];
function getAllowedGosalaIds(user) {
  return Array.from(/* @__PURE__ */ new Set([...values(user.gosalaIds), ...values(user.gosalaNames)]));
}
function hasGosalaScope(user, resource) {
  const allowed = new Set(getAllowedGosalaIds(user));
  if (!allowed.size) return false;
  return [resource.id, resource.gosalaId, resource.name, resource.gosala].map(normalize).some((value) => value !== "" && allowed.has(value));
}
function canAccessBooking(user, booking) {
  if (user.role === "super_admin") return true;
  if (user.role === "customer") return normalize(booking.customerId) !== "" && normalize(booking.customerId) === normalize(user.userId);
  if (user.role === "driver") return normalize(booking.driverId) !== "" && normalize(booking.driverId) === normalize(user.userId);
  if (user.role === "admin" || user.role === "manager") return hasGosalaScope(user, booking);
  return false;
}
function canUseLiveTracking(user) {
  return user.role !== "super_admin" && (user.role === "admin" || user.role === "manager" || user.role === "customer" || user.role === "driver");
}

// server/services/hubService.ts
import fs from "fs";
import path from "path";
var CUSTOM_HUBS_FILE = path.resolve(process.cwd(), "server/data/custom_hubs.json");
var BASELINE_INDIAN_HUBS = [
  // --- TELANGANA ---
  {
    id: "hub-hyd-central",
    state: "Telangana",
    city: "Hyderabad",
    name: "Hyderabad Central (Banjara Hills / Jubilee Hills)",
    zone: "Central",
    lat: 17.4156,
    lng: 78.4358,
    defaultMaxRadiusKm: 35,
    pincodePrefixes: ["500034", "500033", "500082"],
    isFeatured: true
  },
  {
    id: "hub-hyd-west",
    state: "Telangana",
    city: "Hyderabad",
    name: "Cyberabad / Gachibowli (HITEC City)",
    zone: "West",
    lat: 17.4401,
    lng: 78.3489,
    defaultMaxRadiusKm: 35,
    pincodePrefixes: ["500032", "500081", "500084"],
    isFeatured: true
  },
  {
    id: "hub-hyd-southwest",
    state: "Telangana",
    city: "Hyderabad",
    name: "Narsingi / Gandipet (Outer Ring Road)",
    zone: "South",
    lat: 17.3753,
    lng: 78.3615,
    defaultMaxRadiusKm: 40,
    pincodePrefixes: ["500075", "500089"],
    isFeatured: true
  },
  {
    id: "hub-hyd-secunderabad",
    state: "Telangana",
    city: "Secunderabad",
    name: "Secunderabad / Cantonment (Kompally)",
    zone: "North",
    lat: 17.4399,
    lng: 78.4983,
    defaultMaxRadiusKm: 35,
    pincodePrefixes: ["500003", "500010", "500014"],
    isFeatured: true
  },
  {
    id: "hub-warangal",
    state: "Telangana",
    city: "Warangal",
    name: "Warangal & Hanamkonda Heritage Belt",
    zone: "Central",
    lat: 17.9689,
    lng: 79.5941,
    defaultMaxRadiusKm: 40,
    pincodePrefixes: ["506001", "506002"]
  },
  // --- ANDHRA PRADESH ---
  {
    id: "hub-vijayawada",
    state: "Andhra Pradesh",
    city: "Vijayawada",
    name: "Vijayawada & Amaravati Capital Belt (Krishna Valley)",
    zone: "East",
    lat: 16.5062,
    lng: 80.648,
    defaultMaxRadiusKm: 45,
    pincodePrefixes: ["520001", "520010"],
    isFeatured: true
  },
  {
    id: "hub-tirupati",
    state: "Andhra Pradesh",
    city: "Tirupati",
    name: "Tirupati & Alipiri Foothills (Sri Venkateswara Sanctuary)",
    zone: "South",
    lat: 13.6288,
    lng: 79.4192,
    defaultMaxRadiusKm: 40,
    pincodePrefixes: ["517501", "517507"],
    isFeatured: true
  },
  {
    id: "hub-visakhapatnam",
    state: "Andhra Pradesh",
    city: "Visakhapatnam",
    name: "Visakhapatnam Coastal Sanctuary Corridor",
    zone: "East",
    lat: 17.6868,
    lng: 83.2185,
    defaultMaxRadiusKm: 40,
    pincodePrefixes: ["530001", "530017"]
  },
  // --- MAHARASHTRA ---
  {
    id: "hub-pune-central",
    state: "Maharashtra",
    city: "Pune",
    name: "Pune & Pimpri-Chinchwad (Mulshi / Alandi Belt)",
    zone: "Central",
    lat: 18.5204,
    lng: 73.8567,
    defaultMaxRadiusKm: 45,
    pincodePrefixes: ["411001", "411038"],
    isFeatured: true
  },
  {
    id: "hub-mumbai-suburbs",
    state: "Maharashtra",
    city: "Mumbai",
    name: "Mumbai Western Suburbs (Borivali / Andheri)",
    zone: "West",
    lat: 19.2288,
    lng: 72.8541,
    defaultMaxRadiusKm: 35,
    pincodePrefixes: ["400092", "400053"],
    isFeatured: true
  },
  {
    id: "hub-nashik-panchavati",
    state: "Maharashtra",
    city: "Nashik",
    name: "Nashik & Trimbakeshwar (Panchavati / Godavari Valley)",
    zone: "North",
    lat: 19.9975,
    lng: 73.7898,
    defaultMaxRadiusKm: 45,
    pincodePrefixes: ["422001", "422003"],
    isFeatured: true
  },
  // --- KARNATAKA ---
  {
    id: "hub-blr-south",
    state: "Karnataka",
    city: "Bengaluru",
    name: "Bengaluru South (Kanakapura Rd / Jayanagar)",
    zone: "South",
    lat: 12.8716,
    lng: 77.5446,
    defaultMaxRadiusKm: 40,
    pincodePrefixes: ["560062", "560041"],
    isFeatured: true
  },
  {
    id: "hub-blr-east",
    state: "Karnataka",
    city: "Bengaluru",
    name: "Bengaluru East (Whitefield / Indiranagar)",
    zone: "East",
    lat: 12.9698,
    lng: 77.7499,
    defaultMaxRadiusKm: 40,
    pincodePrefixes: ["560066", "560038"],
    isFeatured: true
  },
  {
    id: "hub-mysuru",
    state: "Karnataka",
    city: "Mysuru",
    name: "Mysuru Chamundi Heritage Foothills",
    zone: "South",
    lat: 12.2958,
    lng: 76.6394,
    defaultMaxRadiusKm: 40,
    pincodePrefixes: ["570001", "570010"]
  },
  // --- GUJARAT ---
  {
    id: "hub-ahmedabad-central",
    state: "Gujarat",
    city: "Ahmedabad",
    name: "Ahmedabad & Gandhinagar (Sabarmati Corridor)",
    zone: "Central",
    lat: 23.0225,
    lng: 72.5714,
    defaultMaxRadiusKm: 40,
    pincodePrefixes: ["380001", "380015"],
    isFeatured: true
  },
  {
    id: "hub-surat",
    state: "Gujarat",
    city: "Surat",
    name: "Surat & Tapi River Goseva Sanctuary",
    zone: "South",
    lat: 21.1702,
    lng: 72.8311,
    defaultMaxRadiusKm: 35,
    pincodePrefixes: ["395001", "395007"]
  },
  // --- NORTH INDIA (DELHI NCR & UTTAR PRADESH) ---
  {
    id: "hub-delhi-gurgaon",
    state: "Delhi NCR",
    city: "Delhi NCR",
    name: "South Delhi & Gurugram Aravalli Belt",
    zone: "North",
    lat: 28.4595,
    lng: 77.0266,
    defaultMaxRadiusKm: 45,
    pincodePrefixes: ["122001", "110030"],
    isFeatured: true
  },
  {
    id: "hub-vrindavan-mathura",
    state: "Uttar Pradesh",
    city: "Mathura",
    name: "Vrindavan & Govardhan Sacred Braj Corridor",
    zone: "North",
    lat: 27.5806,
    lng: 77.7006,
    defaultMaxRadiusKm: 50,
    pincodePrefixes: ["281121", "281502"],
    isFeatured: true
  },
  {
    id: "hub-varanasi-kashi",
    state: "Uttar Pradesh",
    city: "Varanasi",
    name: "Varanasi (Kashi Sacred Ganga Gaushala Zone)",
    zone: "North",
    lat: 25.3176,
    lng: 82.9739,
    defaultMaxRadiusKm: 40,
    pincodePrefixes: ["221001", "221005"],
    isFeatured: true
  },
  // --- RAJASTHAN ---
  {
    id: "hub-jaipur",
    state: "Rajasthan",
    city: "Jaipur",
    name: "Jaipur & Amer Divine Heritage Belt",
    zone: "West",
    lat: 26.9124,
    lng: 75.7873,
    defaultMaxRadiusKm: 45,
    pincodePrefixes: ["302001", "302015"],
    isFeatured: true
  },
  // --- TAMIL NADU ---
  {
    id: "hub-chennai",
    state: "Tamil Nadu",
    city: "Chennai",
    name: "Chennai & Kanchipuram Temple Sanctuary Belt",
    zone: "South",
    lat: 13.0827,
    lng: 80.2707,
    defaultMaxRadiusKm: 40,
    pincodePrefixes: ["600001", "600028"],
    isFeatured: true
  },
  {
    id: "hub-coimbatore",
    state: "Tamil Nadu",
    city: "Coimbatore",
    name: "Coimbatore Western Ghats Foothills",
    zone: "South",
    lat: 11.0168,
    lng: 76.9558,
    defaultMaxRadiusKm: 40,
    pincodePrefixes: ["641001", "641018"]
  }
];
var customHubsCache = [];
var isLoaded = false;
function ensureCustomHubsLoaded() {
  if (isLoaded) return;
  try {
    if (fs.existsSync(CUSTOM_HUBS_FILE)) {
      const raw = fs.readFileSync(CUSTOM_HUBS_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        customHubsCache = parsed;
      }
    }
  } catch (err) {
    console.warn("[HubService] Could not read custom_hubs.json:", err);
    customHubsCache = [];
  } finally {
    isLoaded = true;
  }
}
function persistCustomHubs() {
  try {
    const dir = path.dirname(CUSTOM_HUBS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CUSTOM_HUBS_FILE, JSON.stringify(customHubsCache, null, 2), "utf-8");
  } catch (err) {
    console.error("[HubService] Failed to write custom_hubs.json:", err);
  }
}
function getAllOperationalHubs() {
  ensureCustomHubsLoaded();
  return [...BASELINE_INDIAN_HUBS, ...customHubsCache];
}
function createOperationalHub(payload) {
  ensureCustomHubsLoaded();
  const cleanState = (payload.state || "").trim();
  const cleanCity = (payload.city || "").trim();
  const cleanName = (payload.name || "").trim();
  if (!cleanState) {
    throw new Error("State is required to register an operational hub.");
  }
  if (!cleanCity) {
    throw new Error("City / District name is required.");
  }
  if (!cleanName) {
    throw new Error("Hub / Sanctuary belt name is required.");
  }
  const lat = Number(payload.lat);
  const lng = Number(payload.lng);
  if (isNaN(lat) || isNaN(lng) || lat < 6 || lat > 38 || lng < 68 || lng > 98) {
    throw new Error("Valid geographic coordinates within India are required.");
  }
  let zone = payload.zone || "Central";
  const sLower = cleanState.toLowerCase();
  if (sLower.includes("karnataka") || sLower.includes("tamil") || sLower.includes("kerala") || sLower.includes("andhra") || sLower.includes("telangana")) {
    zone = "South";
  } else if (sLower.includes("delhi") || sLower.includes("uttar") || sLower.includes("punjab") || sLower.includes("haryana")) {
    zone = "North";
  } else if (sLower.includes("maharashtra") || sLower.includes("gujarat") || sLower.includes("rajasthan") || sLower.includes("goa")) {
    zone = "West";
  } else if (sLower.includes("bengal") || sLower.includes("odisha") || sLower.includes("bihar") || sLower.includes("assam")) {
    zone = "East";
  }
  const slug = `${cleanCity.toLowerCase().replace(/[^a-z0-9]/g, "")}-${Date.now().toString(36)}`;
  const newHub = {
    id: `hub-custom-${slug}`,
    state: cleanState,
    city: cleanCity,
    name: cleanName,
    zone,
    lat,
    lng,
    defaultMaxRadiusKm: Math.max(10, Math.min(150, Number(payload.defaultMaxRadiusKm) || 35)),
    pincodePrefixes: Array.isArray(payload.pincodePrefixes) ? payload.pincodePrefixes.filter(Boolean) : [],
    isCustom: true,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  customHubsCache.push(newHub);
  persistCustomHubs();
  return newHub;
}
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}
function findNearestOperationalHub(lat, lng) {
  const allHubs = getAllOperationalHubs();
  let closest = allHubs[0];
  let minDist = Infinity;
  for (const h of allHubs) {
    const d = haversineKm(lat, lng, h.lat, h.lng);
    if (d < minDist) {
      minDist = d;
      closest = h;
    }
  }
  return { hub: closest, distanceKm: minDist };
}

// server/services/googlePlacesService.ts
function extractCoordsFromGoogleUrl(url) {
  if (!url) return null;
  const atMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);
    if (isValidLatLong(lat, lng)) return { lat, lng };
  }
  const protoMatch = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (protoMatch) {
    const lat = parseFloat(protoMatch[1]);
    const lng = parseFloat(protoMatch[2]);
    if (isValidLatLong(lat, lng)) return { lat, lng };
  }
  const qMatch = url.match(/[?&](?:q|query)=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (qMatch) {
    const lat = parseFloat(qMatch[1]);
    const lng = parseFloat(qMatch[2]);
    if (isValidLatLong(lat, lng)) return { lat, lng };
  }
  const llMatch = url.match(/[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (llMatch) {
    const lat = parseFloat(llMatch[1]);
    const lng = parseFloat(llMatch[2]);
    if (isValidLatLong(lat, lng)) return { lat, lng };
  }
  return null;
}
function extractPlaceNameFromGoogleUrl(url) {
  if (!url) return null;
  const placeMatch = url.match(/\/place\/([^/@?]+)/);
  if (placeMatch && placeMatch[1]) {
    try {
      const decoded = decodeURIComponent(placeMatch[1].replace(/\+/g, " "));
      if (decoded.trim().length > 0) return decoded.trim();
    } catch {
    }
  }
  return null;
}
function parseRawCoordinates(input) {
  if (!input) return null;
  const trimmed = input.trim();
  const decMatch = trimmed.match(/^(-?\d{1,2}(?:\.\d+)?)[,\s]+(-?\d{1,3}(?:\.\d+)?)$/);
  if (decMatch) {
    const lat = parseFloat(decMatch[1]);
    const lng = parseFloat(decMatch[2]);
    if (isValidLatLong(lat, lng)) return { lat, lng };
  }
  const dmsRegex = /(\d+)[°\s]+(\d+)['\s]+([\d.]+)?["\s]*([NSEW])/gi;
  const matches = [...trimmed.matchAll(dmsRegex)];
  if (matches.length === 2) {
    const convertDms = (deg, min, sec, dir) => {
      let val = parseFloat(deg) + parseFloat(min) / 60 + (sec ? parseFloat(sec) / 3600 : 0);
      if (dir.toUpperCase() === "S" || dir.toUpperCase() === "W") val = -val;
      return val;
    };
    const lat = convertDms(matches[0][1], matches[0][2], matches[0][3], matches[0][4]);
    const lng = convertDms(matches[1][1], matches[1][2], matches[1][3], matches[1][4]);
    if (isValidLatLong(lat, lng)) return { lat, lng };
  }
  return null;
}
function isValidLatLong(lat, lng) {
  return !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}
async function expandGoogleShortUrl(shortUrl) {
  try {
    const res = await fetch(shortUrl, {
      method: "HEAD",
      redirect: "manual",
      signal: AbortSignal.timeout(4e3)
    });
    const loc = res.headers.get("location");
    if (loc) {
      if (loc.includes("maps.app.goo.gl") || loc.includes("goo.gl/maps")) {
        return expandGoogleShortUrl(loc);
      }
      return loc;
    }
    return shortUrl;
  } catch (err) {
    return shortUrl;
  }
}
async function resolveGoogleMapsLinkOrCoords(input) {
  const cleanInput = (input || "").trim();
  if (!cleanInput) return null;
  const directCoords = parseRawCoordinates(cleanInput);
  if (directCoords) {
    const nearest = findNearestOperationalHub(directCoords.lat, directCoords.lng);
    return {
      id: `coord-${directCoords.lat.toFixed(4)}-${directCoords.lng.toFixed(4)}`,
      name: `Gaushala Premise (${directCoords.lat.toFixed(4)}, ${directCoords.lng.toFixed(4)})`,
      address: `Coordinates: ${directCoords.lat.toFixed(5)}, ${directCoords.lng.toFixed(5)} near ${nearest.hub.city}, ${nearest.hub.state}`,
      city: nearest.hub.city,
      state: nearest.hub.state,
      lat: directCoords.lat,
      lng: directCoords.lng,
      source: "coordinates",
      hubId: nearest.hub.id,
      hubName: nearest.hub.name,
      suggestedRegion: `${nearest.hub.name} (${nearest.hub.city}, ${nearest.hub.state})`
    };
  }
  if (cleanInput.includes("google.com/maps") || cleanInput.includes("maps.app.goo.gl") || cleanInput.includes("goo.gl/maps") || cleanInput.startsWith("http")) {
    let targetUrl = cleanInput;
    if (cleanInput.includes("maps.app.goo.gl") || cleanInput.includes("goo.gl/maps")) {
      targetUrl = await expandGoogleShortUrl(cleanInput);
    }
    const coords = extractCoordsFromGoogleUrl(targetUrl);
    const placeName = extractPlaceNameFromGoogleUrl(targetUrl);
    if (coords) {
      const nearest = findNearestOperationalHub(coords.lat, coords.lng);
      const name = placeName || "Custom Gaushala from Google Maps";
      const address = placeName ? `${placeName}, ${nearest.hub.city}, ${nearest.hub.state}` : `Google Maps Pin: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)} (${nearest.hub.city}, ${nearest.hub.state})`;
      return {
        id: `gmaps-${coords.lat.toFixed(4)}-${coords.lng.toFixed(4)}`,
        name,
        address,
        city: nearest.hub.city,
        state: nearest.hub.state,
        lat: coords.lat,
        lng: coords.lng,
        source: "google_maps_link",
        hubId: nearest.hub.id,
        hubName: nearest.hub.name,
        suggestedRegion: `${nearest.hub.name} (${nearest.hub.city}, ${nearest.hub.state})`
      };
    }
  }
  return null;
}
async function searchGooglePlacesApi(query, apiKey) {
  const key = apiKey || process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY;
  if (!key) {
    return [];
  }
  const cleanQuery = query.trim();
  if (!cleanQuery) return [];
  try {
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
      cleanQuery
    )}&region=in&key=${key}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4e3) });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data.results)) return [];
    return data.results.slice(0, 5).map((p) => {
      const lat = p.geometry?.location?.lat || 17.4156;
      const lng = p.geometry?.location?.lng || 78.4358;
      const nearest = findNearestOperationalHub(lat, lng);
      return {
        id: `gplaces-${p.place_id}`,
        name: p.name,
        address: p.formatted_address || `${p.name}, India`,
        city: nearest.hub.city,
        state: nearest.hub.state,
        lat,
        lng,
        source: "google_places_api",
        hubId: nearest.hub.id,
        hubName: nearest.hub.name,
        suggestedRegion: `${nearest.hub.name} (${nearest.hub.city}, ${nearest.hub.state})`
      };
    });
  } catch (err) {
    console.warn("Google Places API search failed:", err);
    return [];
  }
}

// server/walletRoutes.ts
import crypto8 from "node:crypto";

// server/services/settlementService.ts
var BP_TOTAL = 1e4;
var DEFAULT_PLATFORM_BP = 1e3;
var DEFAULT_MANAGER_BP = 3e3;
var DEFAULT_DELAY_DAYS = 2;
var DAY_MS = 24 * 60 * 60 * 1e3;
function computeShares(grossPaise, taxPaise, platformBp, managerBp) {
  if (grossPaise < 0n || taxPaise < 0n || taxPaise > grossPaise) {
    throw new LedgerError("Tax cannot exceed the amount paid", "INVALID");
  }
  const adminBp = BP_TOTAL - platformBp - managerBp;
  if (platformBp < 0 || managerBp < 0 || adminBp < 0) {
    throw new LedgerError("Platform and manager percentages cannot add up to more than 100%", "INVALID");
  }
  const net = grossPaise - taxPaise;
  const managerPaise = net * BigInt(managerBp) / BigInt(BP_TOTAL);
  const adminPaise = net * BigInt(adminBp) / BigInt(BP_TOTAL);
  const platformPaise = net - managerPaise - adminPaise;
  return { grossPaise, taxPaise, platformPaise, adminPaise, managerPaise, platformBp, adminBp, managerBp };
}
function splitEqually(totalPaise, recipients) {
  const out = /* @__PURE__ */ new Map();
  if (!recipients.length) return out;
  const n = BigInt(recipients.length);
  const base = totalPaise / n;
  let extra = totalPaise - base * n;
  for (const id of recipients) {
    const add = extra > 0n ? 1n : 0n;
    if (extra > 0n) extra -= 1n;
    out.set(id, base + add);
  }
  return out;
}
async function getWalletConfig() {
  const row = await prisma.walletConfig.findUnique({ where: { id: 1 } });
  return {
    platformBp: row?.platformBp ?? DEFAULT_PLATFORM_BP,
    settlementDelayDays: row?.settlementDelayDays ?? DEFAULT_DELAY_DAYS
  };
}
async function getManagerBpFor(gosalaId) {
  const own = await prisma.splitPolicy.findUnique({ where: { policyKey: gosalaId } });
  if (own) return { managerBp: own.managerBp, policyKey: own.policyKey, isDefault: false };
  const def = await prisma.splitPolicy.findUnique({ where: { policyKey: "DEFAULT" } });
  return { managerBp: def?.managerBp ?? DEFAULT_MANAGER_BP, policyKey: "DEFAULT", isDefault: true };
}
async function recordBookingPayment(booking) {
  await ensureSystemWallets();
  const cfg = await getWalletConfig();
  const policy = await getManagerBpFor(booking.gosalaId);
  const grossPaise = BigInt(Math.round(booking.totalAmount * 100));
  const taxPaise = BigInt(Math.round(booking.taxFee * 100));
  const shares = computeShares(grossPaise, taxPaise, cfg.platformBp, policy.managerBp);
  const paidAt = booking.paymentCapturedAt ?? booking.createdAt ?? /* @__PURE__ */ new Date();
  const source = booking.paymentProvider === "WALLET" ? "WALLET" : "RAZORPAY";
  return runLedgerTx(async (tx) => {
    const existing = await tx.bookingSettlement.findUnique({ where: { bookingId: booking.id } });
    if (existing) return { created: false, settlementId: existing.id };
    if (grossPaise > 0n) {
      const escrow = await getSystemWallet(tx, "ESCROW");
      await postEntry(tx, {
        walletId: escrow.id,
        type: "CREDIT",
        amountPaise: grossPaise,
        purpose: "ESCROW_IN",
        idempotencyKey: `escrow_in:${booking.id}`,
        bookingId: booking.id,
        referenceId: booking.id,
        description: `Customer payment held in escrow for ${booking.id}`,
        metadata: { source }
      });
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
        eligibleAt: new Date(paidAt.getTime() + cfg.settlementDelayDays * DAY_MS)
      }
    });
    return { created: true, settlementId: row.id };
  });
}
async function backfillSettlements() {
  const have = await prisma.bookingSettlement.findMany({ select: { bookingId: true } });
  const skip = new Set(have.map((h) => h.bookingId));
  const bookings = await prisma.booking.findMany({
    where: {
      isPaid: true,
      paymentStatus: "CAPTURED",
      status: { notIn: ["REJECTED", "CANCELLED"] }
    }
  });
  let created = 0;
  for (const b of bookings) {
    if (skip.has(b.id)) continue;
    const res = await recordBookingPayment({
      id: b.id,
      gosalaId: b.gosalaId,
      gosalaName: b.gosalaName,
      customerId: b.customerId,
      totalAmount: b.totalAmount,
      taxFee: b.taxFee,
      paymentProvider: b.paymentProvider,
      paymentCapturedAt: b.paymentCapturedAt,
      createdAt: b.createdAt
    });
    if (res.created) created++;
  }
  return { scanned: bookings.length, created };
}
async function runMaturity(now = /* @__PURE__ */ new Date()) {
  const due = await prisma.bookingSettlement.findMany({
    where: { status: "HELD", eligibleAt: { lte: now } },
    select: { id: true, bookingId: true, grossPaise: true }
  });
  if (!due.length) return { moved: 0 };
  const bookings = await prisma.booking.findMany({
    where: { id: { in: due.map((d) => d.bookingId) } },
    select: { id: true, status: true }
  });
  const blocked = new Set(bookings.filter((b) => b.status === "REJECTED" || b.status === "CANCELLED").map((b) => b.id));
  const ids = due.filter((d) => !blocked.has(d.bookingId)).map((d) => d.id);
  if (!ids.length) return { moved: 0 };
  const res = await prisma.bookingSettlement.updateMany({
    where: { id: { in: ids }, status: "HELD" },
    data: { status: "READY_FOR_APPROVAL", readyAt: now }
  });
  if (res.count > 0) {
    const total = due.filter((d) => ids.includes(d.id)).reduce((sum, d) => sum + BigInt(d.grossPaise), 0n);
    void notifySuperAdmins(messages.readyForApproval(res.count, total));
  }
  return { moved: res.count };
}
async function recipientsFor(tx, gosalaId) {
  const gosala = await tx.gosala.findUnique({ where: { id: gosalaId } });
  if (!gosala) throw new LedgerError("Gaushala for this booking no longer exists", "INVALID");
  const admins = gosala.adminId ? [gosala.adminId] : [];
  const assignments = await tx.gosalaManagerAssignment.findMany({
    where: { gosalaId, status: "Active" },
    orderBy: { assignedAt: "asc" }
  });
  const managers = assignments.map((a) => a.userId);
  return { gosala, admins, managers };
}
async function approveSettlement(settlementId, actor, note) {
  await ensureSystemWallets();
  return runLedgerTx(async (tx) => {
    const s = await tx.bookingSettlement.findUnique({ where: { id: settlementId } });
    if (!s) throw new LedgerError("Settlement not found", "INVALID");
    if (s.status === "RELEASED") return { id: s.id, replay: true, releaseGroupId: s.releaseGroupId };
    if (s.status !== "READY_FOR_APPROVAL") {
      throw new LedgerError(
        s.status === "HELD" ? `Not ready yet. This booking becomes eligible on ${s.eligibleAt.toLocaleDateString("en-IN")}.` : `Settlement is ${s.status.toLowerCase().replace(/_/g, " ")} and cannot be approved`,
        "CONFLICT"
      );
    }
    const booking = await tx.booking.findUnique({ where: { id: s.bookingId }, select: { status: true } });
    if (booking && (booking.status === "REJECTED" || booking.status === "CANCELLED")) {
      throw new LedgerError(`Booking was ${booking.status.toLowerCase()}. Refund it instead of releasing it.`, "CONFLICT");
    }
    const { gosala, admins, managers } = await recipientsFor(tx, s.gosalaId);
    if (s.adminPaise > 0n && admins.length === 0) {
      throw new LedgerError(`${gosala.name} has no Operations Admin assigned, so the admin share has nowhere to go`, "INVALID");
    }
    if (s.managerPaise > 0n && managers.length === 0) {
      throw new LedgerError(`${gosala.name} has no active Manager assigned, so the manager share has nowhere to go`, "INVALID");
    }
    const claimed = await tx.bookingSettlement.updateMany({
      where: { id: s.id, status: "READY_FOR_APPROVAL" },
      data: { status: "RELEASED" }
    });
    if (claimed.count !== 1) throw new LedgerError("Settlement was already handled by someone else", "CONFLICT");
    const groupId = `rel_${s.id}`;
    const escrow = await getSystemWallet(tx, "ESCROW");
    const platform = await getSystemWallet(tx, "PLATFORM");
    const tax = await getSystemWallet(tx, "TAX");
    const base = { groupId, bookingId: s.bookingId, referenceId: s.bookingId };
    const entries = [
      {
        ...base,
        walletId: escrow.id,
        type: "DEBIT",
        amountPaise: s.grossPaise,
        purpose: "ESCROW_OUT",
        idempotencyKey: `${groupId}:escrow`,
        description: `Released from escrow for ${s.bookingId}`
      }
    ];
    if (s.taxPaise > 0n) {
      entries.push({ ...base, walletId: tax.id, type: "CREDIT", amountPaise: s.taxPaise, purpose: "TAX_COLLECTED", idempotencyKey: `${groupId}:tax`, description: `Tax collected on ${s.bookingId}` });
    }
    if (s.platformPaise > 0n) {
      entries.push({ ...base, walletId: platform.id, type: "CREDIT", amountPaise: s.platformPaise, purpose: "PLATFORM_FEE", idempotencyKey: `${groupId}:platform`, description: `Platform commission on ${s.bookingId}` });
    }
    for (const [uid, amt] of splitEqually(s.adminPaise, admins)) {
      if (amt <= 0n) continue;
      const w = await getUserWallet(tx, uid);
      entries.push({ ...base, walletId: w.id, type: "CREDIT", amountPaise: amt, purpose: "SETTLEMENT_RELEASE", idempotencyKey: `${groupId}:admin:${uid}`, description: `Admin share (${s.adminBp / 100}%) for ${s.bookingId}`, metadata: { role: "ADMIN", gosala: gosala.name } });
    }
    for (const [uid, amt] of splitEqually(s.managerPaise, managers)) {
      if (amt <= 0n) continue;
      const w = await getUserWallet(tx, uid);
      entries.push({ ...base, walletId: w.id, type: "CREDIT", amountPaise: amt, purpose: "SETTLEMENT_RELEASE", idempotencyKey: `${groupId}:manager:${uid}`, description: `Manager share (${s.managerBp / 100}%) for ${s.bookingId}`, metadata: { role: "MANAGER", gosala: gosala.name } });
    }
    await postGroup(tx, entries, { balanced: true });
    await tx.bookingSettlement.update({
      where: { id: s.id },
      data: {
        releaseGroupId: groupId,
        decidedById: actor.userId,
        decidedByName: actor.name,
        decidedAt: /* @__PURE__ */ new Date(),
        decisionNote: note ?? null
      }
    });
    return { id: s.id, replay: false, releaseGroupId: groupId };
  });
}
async function rejectSettlement(settlementId, actor, note) {
  if (!note || !note.trim()) throw new LedgerError("A reason is required to reject a settlement", "INVALID");
  const res = await prisma.bookingSettlement.updateMany({
    where: { id: settlementId, status: { in: ["HELD", "READY_FOR_APPROVAL"] } },
    data: { status: "REJECTED", decidedById: actor.userId, decidedByName: actor.name, decidedAt: /* @__PURE__ */ new Date(), decisionNote: note.trim() }
  });
  if (res.count !== 1) throw new LedgerError("Only held or ready settlements can be rejected", "CONFLICT");
  return { id: settlementId };
}
async function refundSettlement(settlementId, actor, note) {
  if (!note || !note.trim()) throw new LedgerError("A reason is required to refund a booking", "INVALID");
  await ensureSystemWallets();
  return runLedgerTx(async (tx) => {
    const s = await tx.bookingSettlement.findUnique({ where: { id: settlementId } });
    if (!s) throw new LedgerError("Settlement not found", "INVALID");
    if (s.status === "REFUNDED") return { id: s.id, replay: true };
    if (s.status === "RELEASED") {
      throw new LedgerError("This money was already released to wallets. It cannot be refunded from escrow.", "CONFLICT");
    }
    const claimed = await tx.bookingSettlement.updateMany({
      where: { id: s.id, status: { in: ["HELD", "READY_FOR_APPROVAL", "REJECTED"] } },
      data: { status: "REFUNDED", decidedById: actor.userId, decidedByName: actor.name, decidedAt: /* @__PURE__ */ new Date(), decisionNote: note.trim() }
    });
    if (claimed.count !== 1) throw new LedgerError("Settlement was already handled by someone else", "CONFLICT");
    const groupId = `ref_${s.id}`;
    const escrow = await getSystemWallet(tx, "ESCROW");
    const customer = await getUserWallet(tx, s.customerId);
    await postGroup(
      tx,
      [
        { walletId: escrow.id, type: "DEBIT", amountPaise: s.grossPaise, purpose: "ESCROW_OUT", idempotencyKey: `${groupId}:escrow`, groupId, bookingId: s.bookingId, referenceId: s.bookingId, description: `Refund of ${s.bookingId} from escrow` },
        { walletId: customer.id, type: "CREDIT", amountPaise: s.grossPaise, purpose: "BOOKING_REFUND", idempotencyKey: `${groupId}:customer`, groupId, bookingId: s.bookingId, referenceId: s.bookingId, description: `Refund for booking ${s.bookingId}` }
      ],
      { balanced: true }
    );
    return { id: s.id, replay: false };
  });
}
async function validateManagerBp(managerBp) {
  if (!Number.isInteger(managerBp) || managerBp < 0) {
    throw new LedgerError("Manager percentage must be a whole number of basis points (30% = 3000)", "INVALID");
  }
  const { platformBp } = await getWalletConfig();
  if (platformBp + managerBp > BP_TOTAL) {
    throw new LedgerError(
      `Manager can be at most ${(BP_TOTAL - platformBp) / 100}% because the platform commission is ${platformBp / 100}%`,
      "INVALID"
    );
  }
}
async function requestSplitChange(args) {
  await validateManagerBp(args.managerBp);
  const gosala = await prisma.gosala.findUnique({ where: { id: args.gosalaId } });
  if (!gosala) throw new LedgerError("Gaushala not found", "INVALID");
  const pending = await prisma.splitPolicyRequest.findFirst({ where: { policyKey: gosala.id, status: "PENDING" } });
  if (pending) throw new LedgerError("A change for this gaushala is already waiting for Super Admin approval", "CONFLICT");
  const current = await getManagerBpFor(gosala.id);
  if (current.managerBp === args.managerBp) throw new LedgerError("That is already the current manager percentage", "CONFLICT");
  return prisma.splitPolicyRequest.create({
    data: {
      policyKey: gosala.id,
      gosalaId: gosala.id,
      gosalaName: gosala.name,
      currentManagerBp: current.managerBp,
      proposedManagerBp: args.managerBp,
      requestedById: args.actor.userId,
      requestedByName: args.actor.name,
      reason: args.reason?.trim() || null
    }
  });
}
async function decideSplitChange(requestId, actor, approve, note) {
  const req = await prisma.splitPolicyRequest.findUnique({ where: { id: requestId } });
  if (!req) throw new LedgerError("Request not found", "INVALID");
  if (req.status !== "PENDING") throw new LedgerError("This request was already decided", "CONFLICT");
  if (approve) await validateManagerBp(req.proposedManagerBp);
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.splitPolicyRequest.updateMany({
      where: { id: requestId, status: "PENDING" },
      data: { status: approve ? "APPROVED" : "REJECTED", decidedById: actor.userId, decidedByName: actor.name, decisionNote: note ?? null, decidedAt: /* @__PURE__ */ new Date() }
    });
    if (claimed.count !== 1) throw new LedgerError("This request was already decided", "CONFLICT");
    if (approve) {
      await tx.splitPolicy.upsert({
        where: { policyKey: req.policyKey },
        update: { managerBp: req.proposedManagerBp, approvedById: actor.userId },
        create: { policyKey: req.policyKey, gosalaId: req.gosalaId, managerBp: req.proposedManagerBp, approvedById: actor.userId }
      });
    }
    return { id: requestId, approved: approve };
  });
}
async function setSplitPolicyDirect(args) {
  await validateManagerBp(args.managerBp);
  const isDefault = args.policyKey === "DEFAULT";
  if (!isDefault) {
    const g = await prisma.gosala.findUnique({ where: { id: args.policyKey } });
    if (!g) throw new LedgerError("Gaushala not found", "INVALID");
  }
  return prisma.splitPolicy.upsert({
    where: { policyKey: args.policyKey },
    update: { managerBp: args.managerBp, approvedById: args.actor.userId },
    create: { policyKey: args.policyKey, gosalaId: isDefault ? null : args.policyKey, managerBp: args.managerBp, approvedById: args.actor.userId }
  });
}
async function setPlatformBp(platformBp, actor) {
  if (!Number.isInteger(platformBp) || platformBp < 0 || platformBp > BP_TOTAL) {
    throw new LedgerError("Platform percentage must be between 0% and 100%", "INVALID");
  }
  const policies = await prisma.splitPolicy.findMany();
  const worst = Math.max(0, ...policies.map((p) => p.managerBp));
  const defaultBp = policies.find((p) => p.policyKey === "DEFAULT")?.managerBp ?? DEFAULT_MANAGER_BP;
  const highest = Math.max(worst, defaultBp);
  if (platformBp + highest > BP_TOTAL) {
    throw new LedgerError(
      `With ${platformBp / 100}% platform commission, a manager share of ${highest / 100}% would leave the admin with a negative share. Lower the manager percentage first.`,
      "CONFLICT"
    );
  }
  return prisma.walletConfig.upsert({
    where: { id: 1 },
    update: { platformBp, updatedById: actor.userId },
    create: { id: 1, platformBp, updatedById: actor.userId }
  });
}
async function getReleaseCredits(settlementId) {
  const s = await prisma.bookingSettlement.findUnique({ where: { id: settlementId } });
  if (!s) return null;
  const rows = await prisma.walletTransaction.findMany({
    where: { groupId: `rel_${settlementId}`, purpose: "SETTLEMENT_RELEASE", type: "CREDIT" },
    include: { wallet: { select: { userId: true } } }
  });
  return {
    bookingId: s.bookingId,
    gosalaName: s.gosalaName,
    credits: rows.filter((r) => r.wallet.userId).map((r) => ({ userId: r.wallet.userId, amountPaise: BigInt(r.amountPaise) }))
  };
}

// server/services/withdrawalService.ts
import crypto7 from "node:crypto";

// server/services/payoutProvider.ts
import crypto6 from "node:crypto";
var SandboxProvider = class {
  mode = "SANDBOX";
  async send(req) {
    const id = `sbx_${req.requestId.replace(/-/g, "").slice(0, 14)}`;
    return { state: "PAID", providerPayoutId: id, utr: `SANDBOX-${crypto6.randomBytes(5).toString("hex").toUpperCase()}` };
  }
  async status(providerPayoutId) {
    return { state: "PAID", providerPayoutId, utr: `SANDBOX-${providerPayoutId.slice(-8).toUpperCase()}` };
  }
};
var API2 = "https://api.razorpay.com/v1";
var RazorpayXProvider = class {
  constructor(keyId, keySecret, accountNumber, fetchImpl = fetch) {
    this.keyId = keyId;
    this.keySecret = keySecret;
    this.accountNumber = accountNumber;
    this.fetchImpl = fetchImpl;
  }
  keyId;
  keySecret;
  accountNumber;
  fetchImpl;
  mode = "RAZORPAYX";
  async call(path2, method, body, extraHeaders = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15e3);
    try {
      const res = await this.fetchImpl(`${API2}${path2}`, {
        method,
        signal: controller.signal,
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64")}`,
          ...body ? { "Content-Type": "application/json" } : {},
          ...extraHeaders
        },
        ...body ? { body: JSON.stringify(body) } : {}
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const reason = json?.error?.description || `Provider returned ${res.status}`;
        const err = new Error(reason);
        err.status = res.status;
        throw err;
      }
      return json;
    } finally {
      clearTimeout(timer);
    }
  }
  mapStatus(p) {
    const st = String(p?.status || "");
    if (st === "processed") return { state: "PAID", providerPayoutId: p.id, utr: String(p.utr || "") };
    if (st === "failed" || st === "rejected" || st === "cancelled" || st === "reversed") {
      return { state: "FAILED", reason: p?.failure_reason || p?.status_details?.description || `Payout ${st}` };
    }
    return { state: "PROCESSING", providerPayoutId: p.id };
  }
  async send(req) {
    try {
      let contactId = req.existingContactId || void 0;
      if (!contactId) {
        const c = await this.call("/contacts", "POST", {
          name: req.contactName,
          email: req.contactEmail,
          contact: req.contactPhone,
          type: "employee",
          // RazorpayX allows at most 40 characters here
          reference_id: `gc_${req.requestId.replace(/-/g, "")}`
        });
        contactId = c.id;
      }
      let fundAccountId = req.existingFundAccountId || void 0;
      if (!fundAccountId) {
        const body = req.target.type === "BANK" ? {
          contact_id: contactId,
          account_type: "bank_account",
          bank_account: { name: req.target.holderName, ifsc: req.target.ifsc, account_number: req.target.accountNumber }
        } : { contact_id: contactId, account_type: "vpa", vpa: { address: req.target.vpa } };
        const f = await this.call("/fund_accounts", "POST", body);
        fundAccountId = f.id;
      }
      const amountRupees = Number(req.amountPaise) / 100;
      const mode = req.target.type === "UPI" ? "UPI" : amountRupees > 5e5 ? "NEFT" : "IMPS";
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
          narration: "GOMAA wallet withdrawal"
        },
        { "X-Payout-Idempotency": req.requestId }
      );
      const out = this.mapStatus(p);
      return out.state === "FAILED" ? out : { ...out, contactId, fundAccountId };
    } catch (err) {
      if (err?.status && err.status >= 400 && err.status < 500) {
        return { state: "FAILED", reason: err.message || "Provider rejected the payout" };
      }
      return { state: "PROCESSING", providerPayoutId: `pending_${req.requestId}` };
    }
  }
  async status(providerPayoutId) {
    if (providerPayoutId.startsWith("pending_")) return { state: "PROCESSING", providerPayoutId };
    const p = await this.call(`/payouts/${encodeURIComponent(providerPayoutId)}`, "GET");
    return this.mapStatus(p);
  }
};
function getPayoutProvider() {
  const wantsLive = process.env.GOMAA_PAYOUT_MODE === "razorpayx" && process.env.GOMAA_PAYOUT_PROVIDER_ENABLED === "true";
  const keyId = process.env.RAZORPAYX_KEY_ID || process.env.RAZORPAY_KEY_ID || "";
  const keySecret = process.env.RAZORPAYX_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET || "";
  const account = process.env.RAZORPAYX_ACCOUNT_NUMBER || "";
  const realKeys = /^rzp_(test|live)_[A-Za-z0-9]{10,}$/.test(keyId) && !keyId.includes("synthetic");
  if (wantsLive && realKeys && keySecret && account) {
    return new RazorpayXProvider(keyId, keySecret, account);
  }
  return new SandboxProvider();
}
function payoutModeReason() {
  const p = getPayoutProvider();
  if (p.mode === "RAZORPAYX") return "Live payouts through RazorpayX";
  return "Sandbox: no real money moves. Set GOMAA_PAYOUT_MODE=razorpayx, GOMAA_PAYOUT_PROVIDER_ENABLED=true, real RazorpayX keys and RAZORPAYX_ACCOUNT_NUMBER to go live.";
}

// server/services/auditService.ts
async function audit(actor, action, targetType, targetId, details) {
  try {
    await prisma.walletAuditLog.create({
      data: {
        actorId: actor.userId ?? null,
        actorName: actor.name,
        actorRole: actor.role,
        action,
        targetType,
        targetId: targetId ?? null,
        details: details ? JSON.parse(JSON.stringify(details)) : void 0
      }
    });
  } catch (err) {
    console.warn(`[audit] ${action} ${targetType}:${targetId ?? "-"} by ${actor.name} (${actor.role}) not saved: ${String(err?.message || err).split("\n").pop()}`);
  }
}
var SYSTEM_ACTOR = { userId: null, name: "System", role: "system" };

// server/services/withdrawalService.ts
var IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/;
var ACCOUNT = /^\d{9,18}$/;
var VPA = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9]{1,63}$/;
var MIN_WITHDRAWAL_PAISE = 100n;
function dataKey() {
  const key = process.env.GOMAA_DATA_KEY;
  if (!key && process.env.NODE_ENV === "production") {
    throw new LedgerError("Payout accounts are disabled until GOMAA_DATA_KEY is configured on the server", "CONFLICT");
  }
  return crypto7.createHash("sha256").update(key || JWT_SECRET).digest();
}
function assertPayoutsEnabled() {
  const provider = getPayoutProvider();
  if (provider.mode === "SANDBOX" && process.env.NODE_ENV === "production" && process.env.GOMAA_ALLOW_SANDBOX_PAYOUTS !== "true") {
    throw new LedgerError("Withdrawals are not switched on yet. Please contact the Super Admin.", "CONFLICT");
  }
}
function encrypt(plain) {
  const iv = crypto7.randomBytes(12);
  const c = crypto7.createCipheriv("aes-256-gcm", dataKey(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64")).join(".");
}
function decrypt(blob) {
  const [iv, tag, enc] = blob.split(".").map((p) => Buffer.from(p, "base64"));
  const d = crypto7.createDecipheriv("aes-256-gcm", dataKey(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
}
var coolOffHours = () => {
  const fromEnv = process.env.GOMAA_PAYOUT_ACCOUNT_COOLOFF_HOURS;
  if (fromEnv !== void 0 && fromEnv !== "") return Math.max(0, Number(fromEnv) || 0);
  return getPayoutProvider().mode === "SANDBOX" ? 0 : 24;
};
function publicAccount(a) {
  return {
    id: a.id,
    type: a.type,
    holderName: a.holderName,
    label: a.type === "BANK" ? `Bank \u2022\u2022\u2022\u2022${a.accountLast4} (${a.ifsc})` : a.vpa,
    usableFrom: a.usableFrom.toISOString(),
    usableNow: a.usableFrom.getTime() <= Date.now(),
    createdAt: a.createdAt.toISOString()
  };
}
async function listPayoutAccounts(userId) {
  const rows = await prisma.payoutAccount.findMany({ where: { userId, isActive: true }, orderBy: { createdAt: "desc" } });
  return rows.map(publicAccount);
}
async function addPayoutAccount(userId, input) {
  const type = input?.type === "UPI" ? "UPI" : input?.type === "BANK" ? "BANK" : null;
  if (!type) throw new LedgerError("Choose bank account or UPI", "INVALID");
  const holderName = String(input.holderName || "").trim();
  if (holderName.length < 2 || holderName.length > 80) throw new LedgerError("Enter the account holder's name", "INVALID");
  const count = await prisma.payoutAccount.count({ where: { userId, isActive: true } });
  if (count >= 5) throw new LedgerError("You can keep at most 5 payout accounts. Remove one first.", "CONFLICT");
  const usableFrom = new Date(Date.now() + coolOffHours() * 3600 * 1e3);
  if (type === "BANK") {
    const accountNumber = String(input.accountNumber || "").replace(/\s+/g, "");
    const ifsc = String(input.ifsc || "").trim().toUpperCase();
    if (!ACCOUNT.test(accountNumber)) throw new LedgerError("Account number must be 9 to 18 digits", "INVALID");
    if (!IFSC.test(ifsc)) throw new LedgerError("IFSC looks wrong. It is 4 letters, a zero, then 6 letters or digits", "INVALID");
    const dup2 = await prisma.payoutAccount.findFirst({ where: { userId, isActive: true, ifsc, accountLast4: accountNumber.slice(-4) } });
    if (dup2) throw new LedgerError("This bank account is already saved", "CONFLICT");
    const row2 = await prisma.payoutAccount.create({
      data: { userId, type, holderName, accountLast4: accountNumber.slice(-4), ifsc, accountNumberEnc: encrypt(accountNumber), usableFrom }
    });
    return publicAccount(row2);
  }
  const vpa = String(input.vpa || "").trim().toLowerCase();
  if (!VPA.test(vpa)) throw new LedgerError("UPI ID should look like name@bank", "INVALID");
  const dup = await prisma.payoutAccount.findFirst({ where: { userId, isActive: true, vpa } });
  if (dup) throw new LedgerError("This UPI ID is already saved", "CONFLICT");
  const row = await prisma.payoutAccount.create({ data: { userId, type, holderName, vpa, usableFrom } });
  return publicAccount(row);
}
async function removePayoutAccount(userId, id) {
  const res = await prisma.payoutAccount.updateMany({ where: { id, userId, isActive: true }, data: { isActive: false } });
  if (res.count !== 1) throw new LedgerError("Account not found", "INVALID");
}
async function requestWithdrawalOtp(userId, amountPaise, payoutAccountId) {
  assertPayoutsEnabled();
  await assertCanWithdraw(userId, amountPaise, payoutAccountId);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new LedgerError("Account not found", "INVALID");
  const recent = await prisma.withdrawalOtp.count({ where: { userId, createdAt: { gt: new Date(Date.now() - 15 * 60 * 1e3) } } });
  if (recent >= 5) throw new LedgerError("Too many codes requested. Wait 15 minutes and try again.", "CONFLICT");
  const otp = crypto7.randomInt(1e5, 1e6).toString();
  await prisma.withdrawalOtp.updateMany({ where: { userId, used: false }, data: { used: true } });
  await prisma.withdrawalOtp.create({
    data: { userId, otpHash: hashOtp(otp), amountPaise, payoutAccountId, expiresAt: new Date(Date.now() + 10 * 60 * 1e3) }
  });
  const detail = inr(amountPaise);
  const waTemplate = (process.env.MSG91_WHATSAPP_OTP_TEMPLATE || "").trim();
  const none = { success: false, error: "not used" };
  const [emailRes, waRes, smsRes] = await Promise.all([
    sendOtpEmail({ toEmail: user.email, userName: user.name, otp, expiryMinutes: 10, purpose: "WITHDRAWAL", detail }).catch((e) => ({ success: false, error: e?.message })),
    user.phone && waTemplate && whatsappConfigured() ? sendWhatsAppTemplate({ toPhone: user.phone, template: waTemplate, vars: [otp], urlButtonValue: otp }).catch((e) => ({ success: false, error: e?.message })) : Promise.resolve(none),
    user.phone && process.env.GOMAA_WITHDRAWAL_OTP_SMS === "true" ? sendOtpSms({ toPhone: user.phone, otp, expiryMinutes: 10, purpose: "WITHDRAWAL" }).catch((e) => ({ success: false, error: e?.message })) : Promise.resolve(none)
  ]);
  const delivered = Boolean(emailRes.success) || Boolean(waRes.success) || Boolean(smsRes.success);
  if (!delivered) {
    if (process.env.NODE_ENV !== "production") return { sent: false, maskedTarget: user.email, devOtp: otp };
    throw new LedgerError("We could not send the verification code. Try again in a moment.", "CONFLICT");
  }
  const digits = String(user.phone || "").replace(/\D/g, "");
  return {
    sent: true,
    maskedTarget: user.email.replace(/^(.).*(@.*)$/, "$1***$2"),
    byEmail: Boolean(emailRes.success),
    byWhatsApp: Boolean(waRes.success),
    bySms: Boolean(smsRes.success),
    maskedPhone: (waRes.success || smsRes.success) && digits.length >= 4 ? `\u2022\u2022\u2022\u2022\u2022\u2022${digits.slice(-4)}` : void 0
  };
}
async function assertCanWithdraw(userId, amountPaise, payoutAccountId) {
  if (amountPaise < MIN_WITHDRAWAL_PAISE) throw new LedgerError("Minimum withdrawal is \u20B91", "INVALID");
  const account = await prisma.payoutAccount.findFirst({ where: { id: payoutAccountId, userId, isActive: true } });
  if (!account) throw new LedgerError("Choose a saved bank account or UPI ID", "INVALID");
  if (account.usableFrom.getTime() > Date.now()) {
    throw new LedgerError(`This account becomes usable on ${account.usableFrom.toLocaleString("en-IN")}`, "CONFLICT");
  }
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet || !wallet.isActive) throw new LedgerError("Wallet is not available", "WALLET_INACTIVE");
  if (BigInt(wallet.balancePaise) < amountPaise) {
    throw new LedgerError(`You can withdraw at most \u20B9${(Number(wallet.balancePaise) / 100).toLocaleString("en-IN")}`, "INSUFFICIENT_FUNDS");
  }
  return { account, wallet };
}
async function consumeOtp(userId, otp, amountPaise, payoutAccountId) {
  const row = await prisma.withdrawalOtp.findFirst({ where: { userId, used: false }, orderBy: { createdAt: "desc" } });
  if (!row || row.expiresAt.getTime() < Date.now()) throw new LedgerError("The code expired. Request a new one.", "CONFLICT");
  if (row.attempts >= 5) throw new LedgerError("Too many wrong codes. Request a new one.", "CONFLICT");
  if (BigInt(row.amountPaise) !== amountPaise || row.payoutAccountId !== payoutAccountId) {
    throw new LedgerError("The code was issued for a different amount or account. Request a new one.", "CONFLICT");
  }
  if (!verifyOtpHash(String(otp || ""), row.otpHash)) {
    await prisma.withdrawalOtp.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
    throw new LedgerError("That code is not correct", "INVALID");
  }
  const claimed = await prisma.withdrawalOtp.updateMany({ where: { id: row.id, used: false }, data: { used: true } });
  if (claimed.count !== 1) throw new LedgerError("That code was already used", "CONFLICT");
}
function serializeWithdrawal(w, accountLabel) {
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
    completedAt: w.completedAt ? w.completedAt.toISOString() : null
  };
}
async function createWithdrawal(args) {
  assertPayoutsEnabled();
  await ensureSystemWallets();
  const { userId, amountPaise, payoutAccountId, otp, idempotencyKey } = args;
  if (!idempotencyKey) throw new LedgerError("An idempotency key is required", "INVALID");
  const replay = await prisma.withdrawalRequest.findUnique({ where: { idempotencyKey } });
  if (replay) {
    if (replay.userId !== userId) throw new LedgerError("Request not found", "INVALID");
    return { replay: true, withdrawal: serializeWithdrawal(replay) };
  }
  const { account } = await assertCanWithdraw(userId, amountPaise, payoutAccountId);
  await consumeOtp(userId, otp, amountPaise, payoutAccountId);
  const provider = getPayoutProvider();
  const request2 = await runLedgerTx(async (tx) => {
    const wallet = await getUserWallet(tx, userId);
    const hold = await getSystemWallet(tx, "WITHDRAWAL_HOLD");
    const row = await tx.withdrawalRequest.create({
      data: { userId, walletId: wallet.id, payoutAccountId, amountPaise, mode: provider.mode, idempotencyKey }
    });
    const groupId = `wd_${row.id}`;
    await postGroup(
      tx,
      [
        { walletId: wallet.id, type: "DEBIT", amountPaise, purpose: "WITHDRAWAL_HOLD", idempotencyKey: `${groupId}:wallet`, groupId, referenceId: row.id, description: `Withdrawal to ${account.type === "UPI" ? account.vpa : `bank \u2022\u2022\u2022\u2022${account.accountLast4}`}` },
        { walletId: hold.id, type: "CREDIT", amountPaise, purpose: "WITHDRAWAL_HOLD", idempotencyKey: `${groupId}:hold`, groupId, referenceId: row.id, description: `Held for withdrawal ${row.id}` }
      ],
      { balanced: true }
    );
    return row;
  });
  const user = await prisma.user.findUnique({ where: { id: userId } });
  await audit({ userId, name: user?.name || "Unknown", role: { GOSALA_MANAGER: "manager", OPERATIONS_ADMIN: "admin", SUPER_ADMIN: "super_admin", CUSTOMER: "customer", DRIVER: "driver" }[String(user?.role)] || String(user?.role || "") }, "WITHDRAWAL_REQUESTED", "withdrawal", request2.id, { amountRupees: Number(amountPaise) / 100, account: account.type === "UPI" ? account.vpa : `bank \u2022\u2022\u2022\u2022${account.accountLast4}`, mode: provider.mode });
  const target = targetFor(account);
  let outcome;
  try {
    outcome = await provider.send({
      requestId: request2.id,
      amountPaise,
      target,
      contactName: account.holderName,
      contactEmail: user?.email,
      contactPhone: user?.phone?.replace(/\D/g, "").slice(-10),
      existingContactId: account.providerContactId,
      existingFundAccountId: account.providerFundAccountId
    });
  } catch (err) {
    outcome = { state: "PROCESSING", providerPayoutId: `pending_${request2.id}` };
  }
  if (outcome.fundAccountId && !account.providerFundAccountId) {
    await prisma.payoutAccount.update({
      where: { id: account.id },
      data: { providerContactId: outcome.contactId, providerFundAccountId: outcome.fundAccountId }
    });
  }
  const done = await applyOutcome(request2.id, outcome);
  return { replay: false, withdrawal: serializeWithdrawal(done, account.type === "UPI" ? account.vpa : `Bank \u2022\u2022\u2022\u2022${account.accountLast4}`) };
}
async function applyOutcome(requestId, outcome) {
  await ensureSystemWallets();
  if (outcome.state === "PROCESSING") {
    return prisma.withdrawalRequest.update({ where: { id: requestId }, data: { providerPayoutId: outcome.providerPayoutId } });
  }
  let closedNow = false;
  const result = await runLedgerTx(async (tx) => {
    closedNow = false;
    const claimed = await tx.withdrawalRequest.updateMany({
      where: { id: requestId, status: "PROCESSING" },
      data: outcome.state === "PAID" ? { status: "PAID", utr: outcome.utr || null, providerPayoutId: outcome.providerPayoutId, completedAt: /* @__PURE__ */ new Date() } : { status: "FAILED", failureReason: outcome.reason, completedAt: /* @__PURE__ */ new Date() }
    });
    const row = await tx.withdrawalRequest.findUniqueOrThrow({ where: { id: requestId } });
    if (claimed.count !== 1) return row;
    closedNow = true;
    const hold = await getSystemWallet(tx, "WITHDRAWAL_HOLD");
    const groupId = `wdc_${row.id}`;
    void audit(SYSTEM_ACTOR, outcome.state === "PAID" ? "WITHDRAWAL_PAID" : "WITHDRAWAL_FAILED", "withdrawal", row.id, outcome.state === "PAID" ? { utr: outcome.utr } : { reason: outcome.reason });
    if (outcome.state === "PAID") {
      await postGroup(tx, [{ walletId: hold.id, type: "DEBIT", amountPaise: row.amountPaise, purpose: "WITHDRAWAL_PAID", idempotencyKey: `${groupId}:paid`, groupId, referenceId: row.id, description: `Paid out. UTR ${outcome.utr || "pending"}` }]);
    } else {
      await postGroup(
        tx,
        [
          { walletId: hold.id, type: "DEBIT", amountPaise: row.amountPaise, purpose: "WITHDRAWAL_REVERSAL", idempotencyKey: `${groupId}:hold`, groupId, referenceId: row.id, description: `Withdrawal ${row.id} failed` },
          { walletId: row.walletId, type: "CREDIT", amountPaise: row.amountPaise, purpose: "WITHDRAWAL_REVERSAL", idempotencyKey: `${groupId}:wallet`, groupId, referenceId: row.id, description: `Returned: ${outcome.reason}` }
        ],
        { balanced: true }
      );
    }
    return row;
  });
  if (closedNow) {
    const account = await prisma.payoutAccount.findUnique({ where: { id: result.payoutAccountId } }).catch(() => null);
    const label = account ? publicAccount(account).label : "your account";
    void notifyUsers(
      [result.userId],
      outcome.state === "PAID" ? messages.withdrawalPaid(BigInt(result.amountPaise), label, outcome.utr || "") : messages.withdrawalFailed(BigInt(result.amountPaise), outcome.state === "FAILED" ? outcome.reason : "")
    );
  }
  return result;
}
function targetFor(account) {
  return account.type === "BANK" ? { type: "BANK", holderName: account.holderName, accountNumber: decrypt(account.accountNumberEnc), ifsc: account.ifsc } : { type: "UPI", holderName: account.holderName, vpa: account.vpa };
}
async function refreshProcessing(userId) {
  const provider = getPayoutProvider();
  const open = await prisma.withdrawalRequest.findMany({
    where: { status: "PROCESSING", providerPayoutId: { not: null }, ...userId ? { userId } : {} },
    take: 25
  });
  for (const w of open) {
    try {
      let out;
      if (w.providerPayoutId.startsWith("pending_")) {
        if (provider.mode !== "RAZORPAYX" || Date.now() - w.requestedAt.getTime() < 10 * 60 * 1e3) continue;
        const account = await prisma.payoutAccount.findUnique({ where: { id: w.payoutAccountId } });
        const user = await prisma.user.findUnique({ where: { id: w.userId } });
        if (!account) continue;
        out = await provider.send({
          requestId: w.id,
          amountPaise: BigInt(w.amountPaise),
          target: targetFor(account),
          contactName: account.holderName,
          contactEmail: user?.email,
          contactPhone: user?.phone?.replace(/\D/g, "").slice(-10),
          existingContactId: account.providerContactId,
          existingFundAccountId: account.providerFundAccountId
        });
      } else {
        out = await provider.status(w.providerPayoutId);
      }
      if (out.state !== "PROCESSING") await applyOutcome(w.id, out);
      else if (out.providerPayoutId !== w.providerPayoutId) await applyOutcome(w.id, out);
    } catch {
    }
  }
}
async function listWithdrawals(userId, limit = 30) {
  const rows = await prisma.withdrawalRequest.findMany({ where: { userId }, orderBy: { requestedAt: "desc" }, take: Math.min(limit, 100) });
  const accounts = await prisma.payoutAccount.findMany({ where: { id: { in: rows.map((r) => r.payoutAccountId) } } });
  const label = new Map(accounts.map((a) => [a.id, publicAccount(a).label]));
  return rows.map((r) => serializeWithdrawal(r, label.get(r.payoutAccountId)));
}
async function handlePayoutWebhook(eventId, event) {
  const type = String(event?.event || "");
  const entity = event?.payload?.payout?.entity;
  if (!entity?.id) return { ignored: true };
  const seen = await prisma.providerEvent.findUnique({ where: { eventId } });
  if (seen) return { replay: true };
  await prisma.providerEvent.create({ data: { provider: "RAZORPAYX", eventId, eventType: type, payload: event } });
  const w = await prisma.withdrawalRequest.findFirst({
    where: { OR: [{ providerPayoutId: entity.id }, { id: String(entity.reference_id || "") }] }
  });
  if (!w) return { ignored: true };
  if (type === "payout.processed") return applyOutcome(w.id, { state: "PAID", providerPayoutId: entity.id, utr: String(entity.utr || "") });
  if (type === "payout.failed" || type === "payout.rejected" || type === "payout.reversed" || type === "payout.cancelled") {
    return applyOutcome(w.id, { state: "FAILED", reason: entity.failure_reason || entity.status_details?.description || type });
  }
  return applyOutcome(w.id, { state: "PROCESSING", providerPayoutId: entity.id });
}

// server/walletRoutes.ts
var ok = (body = {}, status = 200) => ({ status, body: { ok: true, ...body } });
var fail = (status, error) => ({ status, body: { ok: false, error } });
var rupees = (p) => Number(p) / 100;
var iso = (d) => d ? d.toISOString() : null;
function parseJson(raw) {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
function toPaise(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  const paise = Math.round(n * 100);
  if (!Number.isSafeInteger(paise)) return null;
  return BigInt(paise);
}
function actorOf(user) {
  return { userId: user.userId, name: user.name };
}
function serializeSettlement(s, extra = {}) {
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
    ...extra
  };
}
function mapLedgerError(err) {
  if (err instanceof LedgerError) {
    const status = err.code === "INSUFFICIENT_FUNDS" ? 402 : err.code === "CONFLICT" ? 409 : 400;
    return fail(status, err.message);
  }
  console.error("[wallet] unexpected error:", err);
  return fail(500, "Something went wrong while handling the wallet request");
}
async function gosalasFor(user) {
  if (user.role === "super_admin") return prisma.gosala.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
  const scoped = [...user.gosalaIds || [], ...user.gosalaNames || []];
  return prisma.gosala.findMany({
    where: {
      isActive: true,
      OR: [{ adminId: user.userId }, ...scoped.length ? [{ id: { in: scoped } }, { name: { in: scoped } }] : []]
    },
    orderBy: { name: "asc" }
  });
}
async function walletSummary(userId, role) {
  const earnsFrom = async () => {
    if (role === "admin") return (await prisma.gosala.findMany({ where: { adminId: userId }, select: { id: true } })).map((g) => g.id);
    if (role === "manager") return (await prisma.gosalaManagerAssignment.findMany({ where: { userId, status: "Active" }, select: { gosalaId: true } })).map((a) => a.gosalaId);
    return [];
  };
  const [wallet, gosalaIds, processing] = await Promise.all([
    prisma.wallet.findUnique({ where: { userId } }),
    earnsFrom(),
    prisma.withdrawalRequest.aggregate({ where: { userId, status: "PROCESSING" }, _sum: { amountPaise: true } })
  ]);
  const available = wallet ? BigInt(wallet.balancePaise) : 0n;
  const [rows, txs, adminGosalas, managerCounts] = await Promise.all([
    gosalaIds.length ? prisma.bookingSettlement.findMany({ where: { gosalaId: { in: gosalaIds }, status: { in: ["HELD", "READY_FOR_APPROVAL"] } }, orderBy: { eligibleAt: "asc" }, take: 200 }) : Promise.resolve([]),
    wallet ? prisma.walletTransaction.findMany({ where: { walletId: wallet.id }, orderBy: { createdAt: "desc" }, take: 40 }) : Promise.resolve([]),
    role === "admin" && gosalaIds.length ? prisma.gosala.findMany({ where: { id: { in: gosalaIds } }, select: { id: true, adminId: true } }) : Promise.resolve([]),
    role === "manager" && gosalaIds.length ? prisma.gosalaManagerAssignment.groupBy({ by: ["gosalaId"], where: { gosalaId: { in: gosalaIds }, status: "Active" }, _count: { _all: true } }) : Promise.resolve([])
  ]);
  const people = /* @__PURE__ */ new Map();
  if (role === "admin") for (const g of adminGosalas) people.set(g.id, 1);
  else for (const c of managerCounts) people.set(c.gosalaId, Math.max(1, c._count._all));
  const earnsFromNames = gosalaIds.length ? (await prisma.gosala.findMany({ where: { id: { in: gosalaIds } }, select: { name: true }, orderBy: { name: "asc" } })).map((g) => g.name) : [];
  const upcoming = rows.map((s) => {
    const total = role === "admin" ? s.adminPaise : s.managerPaise;
    return {
      settlementId: s.id,
      bookingId: s.bookingId,
      gosalaName: s.gosalaName,
      status: s.status,
      myRupees: rupees(total / BigInt(people.get(s.gosalaId) ?? 1)),
      eligibleAt: iso(s.eligibleAt)
    };
  });
  const coming = upcoming.reduce((sum, u) => sum + Math.round(u.myRupees * 100), 0);
  const inTransit = processing._sum.amountPaise ? BigInt(processing._sum.amountPaise) : 0n;
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
      createdAt: t.createdAt.toISOString()
    }))
  };
}
async function notifyRole(channel, role, title, message) {
  try {
    wsHub.broadcastToChannel(channel, "ROLE_ALERT", { targetRole: role, title, message, priority: "NORMAL", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
  } catch {
  }
}
async function handleWalletRoutes(args) {
  const { method, pathname, query, rawBody, headers, authUser } = args;
  if (method === "POST" && pathname === "/api/webhooks/razorpayx") {
    const sig = String(headers?.["x-razorpay-signature"] || headers?.["X-Razorpay-Signature"] || "");
    const eventId = String(headers?.["x-razorpay-event-id"] || headers?.["X-Razorpay-Event-Id"] || "");
    const secret = process.env.RAZORPAYX_WEBHOOK_SECRET || process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) return fail(503, "Webhook secret is not configured");
    if (!eventId) return fail(400, "Missing event id");
    let valid = false;
    try {
      valid = verifyWebhookSignature(rawBody, sig, secret);
    } catch {
      valid = false;
    }
    if (!valid) return fail(401, "Invalid webhook signature");
    try {
      await handlePayoutWebhook(eventId, parseJson(rawBody));
      return ok();
    } catch (err) {
      return mapLedgerError(err);
    }
  }
  if ((method === "GET" || method === "POST") && pathname === "/api/jobs/settlement-maturity") {
    const secret = process.env.CRON_SECRET;
    const given = String(headers?.authorization || headers?.Authorization || "");
    if (!secret || given.length !== `Bearer ${secret}`.length || !crypto8.timingSafeEqual(Buffer.from(given), Buffer.from(`Bearer ${secret}`))) {
      return fail(401, "Unauthorized");
    }
    const moved = await runMaturity();
    await refreshProcessing();
    return ok(moved);
  }
  if (!authUser) return null;
  const isSA = authUser.role === "super_admin";
  const isAdmin = authUser.role === "admin";
  const isManager = authUser.role === "manager";
  if (method === "GET" && pathname === "/api/wallet/me") {
    if (!isAdmin && !isManager) return fail(403, "Only Operations Admins and Managers have an earnings wallet");
    try {
      const [summary, accounts, withdrawals, cfg] = await Promise.all([
        walletSummary(authUser.userId, authUser.role),
        listPayoutAccounts(authUser.userId),
        listWithdrawals(authUser.userId),
        getWalletConfig(),
        refreshProcessing(authUser.userId)
      ]);
      return ok({ ...summary, accounts, withdrawals, payoutMode: getPayoutProvider().mode, payoutModeNote: payoutModeReason(), delayDays: cfg.settlementDelayDays });
    } catch (err) {
      return mapLedgerError(err);
    }
  }
  if (pathname === "/api/payout-accounts") {
    if (!isAdmin && !isManager) return fail(403, "Only Operations Admins and Managers can save payout accounts");
    try {
      if (method === "GET") return ok({ accounts: await listPayoutAccounts(authUser.userId) });
      if (method === "POST") {
        const account = await addPayoutAccount(authUser.userId, parseJson(rawBody));
        void audit({ userId: authUser.userId, name: authUser.name, role: authUser.role }, "PAYOUT_ACCOUNT_ADDED", "payout_account", account.id, { type: account.type, label: account.label });
        void notifyUsers([authUser.userId], messages.payoutAccountChanged(true, account.label));
        return ok({ account }, 201);
      }
    } catch (err) {
      return mapLedgerError(err);
    }
  }
  const acctDel = pathname.match(/^\/api\/payout-accounts\/([^/]+)$/);
  if (method === "DELETE" && acctDel) {
    if (!isAdmin && !isManager) return fail(403, "Not allowed");
    try {
      const before = (await listPayoutAccounts(authUser.userId)).find((a) => a.id === acctDel[1]);
      await removePayoutAccount(authUser.userId, acctDel[1]);
      void notifyUsers([authUser.userId], messages.payoutAccountChanged(false, before?.label || "a payout account"));
      void audit({ userId: authUser.userId, name: authUser.name, role: authUser.role }, "PAYOUT_ACCOUNT_REMOVED", "payout_account", acctDel[1]);
      return ok();
    } catch (err) {
      return mapLedgerError(err);
    }
  }
  if (method === "POST" && pathname === "/api/withdrawals/otp") {
    if (!isAdmin && !isManager) return fail(403, "Not allowed");
    const b = parseJson(rawBody);
    const amountPaise = toPaise(b.amountRupees);
    if (!amountPaise) return fail(400, "Enter an amount greater than zero");
    try {
      const otpRes = await requestWithdrawalOtp(authUser.userId, amountPaise, String(b.payoutAccountId || ""));
      void audit({ userId: authUser.userId, name: authUser.name, role: authUser.role }, "WITHDRAWAL_CODE_SENT", "payout_account", String(b.payoutAccountId || ""), { amountRupees: b.amountRupees });
      return ok(otpRes);
    } catch (err) {
      return mapLedgerError(err);
    }
  }
  if (pathname === "/api/withdrawals") {
    if (!isAdmin && !isManager) return fail(403, "Not allowed");
    try {
      if (method === "GET") {
        await refreshProcessing(authUser.userId);
        return ok({ withdrawals: await listWithdrawals(authUser.userId, Number(query.get("limit")) || 30) });
      }
      if (method === "POST") {
        const b = parseJson(rawBody);
        const amountPaise = toPaise(b.amountRupees);
        if (!amountPaise) return fail(400, "Enter an amount greater than zero");
        const res = await createWithdrawal({
          userId: authUser.userId,
          amountPaise,
          payoutAccountId: String(b.payoutAccountId || ""),
          otp: String(b.otp || ""),
          idempotencyKey: String(b.idempotencyKey || "")
        });
        return ok(res, res.replay ? 200 : 201);
      }
    } catch (err) {
      return mapLedgerError(err);
    }
  }
  if (method === "GET" && pathname === "/api/split-policy") {
    if (!isAdmin && !isSA) return fail(403, "Only the Operations Admin and Super Admin can view split policy");
    try {
      const [cfg, gosalas, policyRows, requests] = await Promise.all([
        getWalletConfig(),
        gosalasFor(authUser),
        prisma.splitPolicy.findMany(),
        prisma.splitPolicyRequest.findMany({ where: isSA ? {} : { requestedById: authUser.userId }, orderBy: { createdAt: "desc" }, take: 50 })
      ]);
      const byKey = new Map(policyRows.map((p) => [p.policyKey, p.managerBp]));
      const def = byKey.get("DEFAULT");
      const rows = gosalas.map((g) => {
        const own = byKey.get(g.id);
        const managerBp = own ?? def ?? DEFAULT_MANAGER_BP;
        return { gosalaId: g.id, gosalaName: g.name, managerPct: managerBp / 100, adminPct: (BP_TOTAL - cfg.platformBp - managerBp) / 100, isDefault: own === void 0 };
      });
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
          decidedAt: iso(r.decidedAt)
        }))
      });
    } catch (err) {
      return mapLedgerError(err);
    }
  }
  if (method === "POST" && pathname === "/api/split-policy/requests") {
    if (!isAdmin) return fail(403, "Only the Operations Admin proposes manager percentages. Super Admin sets them directly.");
    const b = parseJson(rawBody);
    const managerBp = Math.round(Number(b.managerPct) * 100);
    if (!Number.isFinite(managerBp)) return fail(400, "Enter the manager percentage");
    try {
      const allowed = await gosalasFor(authUser);
      if (!allowed.some((g) => g.id === String(b.gosalaId))) return fail(403, "You can only request changes for gaushalas you govern");
      const r = await requestSplitChange({ actor: actorOf(authUser), gosalaId: String(b.gosalaId), managerBp, reason: b.reason });
      void audit({ userId: authUser.userId, name: authUser.name, role: authUser.role }, "SPLIT_CHANGE_REQUESTED", "split_request", r.id, { gosala: r.gosalaName, from: (r.currentManagerBp ?? 0) / 100, to: r.proposedManagerBp / 100, reason: r.reason });
      void notifySuperAdmins(messages.splitRequested(r.requestedByName, r.gosalaName || "a gaushala", (r.currentManagerBp ?? 0) / 100, r.proposedManagerBp / 100, r.reason));
      void notifyRole("channel:super_admin", "SUPER_ADMIN", "Manager share change waiting", `${r.requestedByName} proposed ${r.proposedManagerBp / 100}% for the manager at ${r.gosalaName}.`);
      return ok({ requestId: r.id }, 201);
    } catch (err) {
      return mapLedgerError(err);
    }
  }
  const saPaths = pathname.startsWith("/api/superadmin/");
  if (saPaths && !isSA) return fail(403, "Only the Super Admin can do this");
  if (method === "GET" && pathname === "/api/superadmin/wallet") {
    try {
      await ensureSystemWallets();
      await runMaturity();
      const sys = await prisma.wallet.findMany({ where: { systemKey: { not: null } } });
      const bal = (k) => rupees(BigInt(sys.find((w) => w.systemKey === k)?.balancePaise ?? 0));
      const counts = await prisma.bookingSettlement.groupBy({ by: ["status"], _count: { _all: true }, _sum: { grossPaise: true } });
      const cfg = await getWalletConfig();
      return ok({
        escrowRupees: bal("ESCROW"),
        platformRupees: bal("PLATFORM"),
        taxRupees: bal("TAX"),
        withdrawalHoldRupees: bal("WITHDRAWAL_HOLD"),
        platformPct: cfg.platformBp / 100,
        delayDays: cfg.settlementDelayDays,
        byStatus: counts.map((c) => ({ status: c.status, count: c._count._all, grossRupees: rupees(c._sum.grossPaise ?? 0n) })),
        payoutMode: getPayoutProvider().mode,
        payoutModeNote: payoutModeReason()
      });
    } catch (err) {
      return mapLedgerError(err);
    }
  }
  if (method === "GET" && pathname === "/api/superadmin/settlements") {
    try {
      await runMaturity();
      const status = query.get("status");
      const rows = await prisma.bookingSettlement.findMany({
        where: status ? { status } : {},
        orderBy: [{ eligibleAt: "asc" }],
        take: Math.min(Number(query.get("limit")) || 100, 300)
      });
      const bookings = await prisma.booking.findMany({
        where: { id: { in: rows.map((r) => r.bookingId) } },
        select: { id: true, status: true, customerName: true, bookingDate: true }
      });
      const byId = new Map(bookings.map((b) => [b.id, b]));
      return ok({
        settlements: rows.map(
          (s) => serializeSettlement(s, {
            bookingStatus: byId.get(s.bookingId)?.status ?? null,
            customerName: byId.get(s.bookingId)?.customerName ?? null,
            bookingDate: byId.get(s.bookingId)?.bookingDate ?? null
          })
        )
      });
    } catch (err) {
      return mapLedgerError(err);
    }
  }
  if (method === "POST" && pathname === "/api/superadmin/settlements/approve") {
    const b = parseJson(rawBody);
    const ids = Array.isArray(b.ids) ? b.ids.map(String).slice(0, 100) : [];
    if (!ids.length) return fail(400, "Choose at least one settlement");
    const released = [];
    const failed = [];
    for (const id of ids) {
      try {
        const r = await approveSettlement(id, actorOf(authUser), b.note);
        released.push(id);
        if (!r.replay) void audit({ userId: authUser.userId, name: authUser.name, role: authUser.role }, "SETTLEMENT_APPROVED", "settlement", id, { releaseGroupId: r.releaseGroupId });
        if (!r.replay) {
          void (async () => {
            const rel = await getReleaseCredits(id);
            if (!rel) return;
            for (const c of rel.credits) void notifyUsers([c.userId], messages.earningsReleased(c.amountPaise, rel.bookingId, rel.gosalaName));
          })();
        }
      } catch (err) {
        failed.push({ id, error: err instanceof LedgerError ? err.message : "Could not release this settlement" });
        if (!(err instanceof LedgerError)) console.error("[approve]", err);
      }
    }
    if (released.length) {
      void notifyRole("channel:admin", "OPERATIONS_ADMIN", "Earnings released", `${released.length} settlement(s) were approved and credited to wallets.`);
      void notifyRole("channel:manager", "GOSALA_MANAGER", "Earnings released", `${released.length} settlement(s) were approved and credited to wallets.`);
    }
    return ok({ released, failed }, failed.length && !released.length ? 409 : 200);
  }
  const rejectMatch = pathname.match(/^\/api\/superadmin\/settlements\/([^/]+)\/(reject|refund)$/);
  if (method === "POST" && rejectMatch) {
    const b = parseJson(rawBody);
    try {
      if (rejectMatch[2] === "reject") await rejectSettlement(rejectMatch[1], actorOf(authUser), String(b.note || ""));
      else await refundSettlement(rejectMatch[1], actorOf(authUser), String(b.note || ""));
      void audit({ userId: authUser.userId, name: authUser.name, role: authUser.role }, rejectMatch[2] === "reject" ? "SETTLEMENT_REJECTED" : "SETTLEMENT_REFUNDED", "settlement", rejectMatch[1], { note: String(b.note || "") });
      return ok();
    } catch (err) {
      return mapLedgerError(err);
    }
  }
  if (method === "POST" && pathname === "/api/superadmin/settlements/backfill") {
    try {
      const res = await backfillSettlements();
      void audit({ userId: authUser.userId, name: authUser.name, role: authUser.role }, "SETTLEMENTS_IMPORTED", "settlement", null, res);
      return ok(res);
    } catch (err) {
      return mapLedgerError(err);
    }
  }
  if (method === "PUT" && pathname === "/api/superadmin/wallet-config") {
    const b = parseJson(rawBody);
    try {
      const row = await setPlatformBp(Math.round(Number(b.platformPct) * 100), actorOf(authUser));
      void audit({ userId: authUser.userId, name: authUser.name, role: authUser.role }, "PLATFORM_PERCENT_CHANGED", "wallet_config", "1", { platformPct: row.platformBp / 100 });
      return ok({ platformPct: row.platformBp / 100 });
    } catch (err) {
      return mapLedgerError(err);
    }
  }
  if (method === "PUT" && pathname === "/api/superadmin/split-policy") {
    const b = parseJson(rawBody);
    try {
      await setSplitPolicyDirect({ actor: actorOf(authUser), policyKey: String(b.policyKey || "DEFAULT"), managerBp: Math.round(Number(b.managerPct) * 100) });
      void audit({ userId: authUser.userId, name: authUser.name, role: authUser.role }, "SPLIT_POLICY_SET", "split_policy", String(b.policyKey || "DEFAULT"), { managerPct: Number(b.managerPct) });
      return ok();
    } catch (err) {
      return mapLedgerError(err);
    }
  }
  const decideMatch = pathname.match(/^\/api\/superadmin\/split-requests\/([^/]+)\/decide$/);
  if (method === "POST" && decideMatch) {
    const b = parseJson(rawBody);
    try {
      await decideSplitChange(decideMatch[1], actorOf(authUser), b.approve === true, b.note);
      void (async () => {
        const req = await prisma.splitPolicyRequest.findUnique({ where: { id: decideMatch[1] } });
        if (req) void notifyUsers([req.requestedById], messages.splitDecided(req.gosalaName || "your gaushala", req.proposedManagerBp / 100, b.approve === true, b.note));
      })();
      void audit({ userId: authUser.userId, name: authUser.name, role: authUser.role }, b.approve === true ? "SPLIT_CHANGE_APPROVED" : "SPLIT_CHANGE_DECLINED", "split_request", decideMatch[1], { note: b.note ?? null });
      return ok();
    } catch (err) {
      return mapLedgerError(err);
    }
  }
  if (method === "GET" && pathname === "/api/superadmin/audit-log") {
    try {
      const rows = await prisma.walletAuditLog.findMany({ orderBy: { createdAt: "desc" }, take: Math.min(Number(query.get("limit")) || 200, 500) });
      return ok({ entries: rows.map((r) => ({ id: r.id, at: r.createdAt.toISOString(), actor: r.actorName, role: r.actorRole, action: r.action, targetType: r.targetType, targetId: r.targetId, details: r.details })) });
    } catch (err) {
      if (err?.code === "P2021" || /wallet_audit_logs/.test(String(err?.message))) {
        return fail(503, "The audit log table has not been created yet. Run: npx prisma db execute --file prisma/sql/2_wallet_hardening.sql");
      }
      return mapLedgerError(err);
    }
  }
  if (method === "GET" && pathname === "/api/superadmin/reconciliation") {
    try {
      return ok(await reconcile());
    } catch (err) {
      return mapLedgerError(err);
    }
  }
  return null;
}
async function reconcile() {
  const wallets = await prisma.wallet.findMany();
  const sums = await prisma.walletTransaction.groupBy({ by: ["walletId", "type"], where: { status: "SUCCESS" }, _sum: { amountPaise: true } });
  const delta = /* @__PURE__ */ new Map();
  for (const s of sums) {
    const v = s._sum.amountPaise ? BigInt(s._sum.amountPaise) : 0n;
    delta.set(s.walletId, (delta.get(s.walletId) ?? 0n) + (s.type === "CREDIT" ? v : -v));
  }
  const walletMismatches = wallets.filter((w) => BigInt(w.balancePaise) !== (delta.get(w.id) ?? 0n)).map((w) => ({ walletId: w.id, kind: w.kind, storedRupees: rupees(BigInt(w.balancePaise)), fromEntriesRupees: rupees(delta.get(w.id) ?? 0n) }));
  const allGroups = await prisma.walletTransaction.groupBy({
    by: ["groupId", "type"],
    where: { groupId: { not: null }, status: "SUCCESS" },
    _sum: { amountPaise: true }
  });
  const mustBalance = /^(rel_|ref_|wd_)/;
  const net = /* @__PURE__ */ new Map();
  for (const r of allGroups) {
    if (!r.groupId || !mustBalance.test(r.groupId)) continue;
    const v = r._sum.amountPaise ? BigInt(r._sum.amountPaise) : 0n;
    net.set(r.groupId, (net.get(r.groupId) ?? 0n) + (r.type === "CREDIT" ? v : -v));
  }
  const unbalancedGroups = [...net.entries()].filter(([, v]) => v !== 0n).map(([groupId, v]) => ({ groupId, differenceRupees: rupees(v) }));
  const escrow = wallets.find((w) => w.systemKey === "ESCROW");
  const waiting = await prisma.bookingSettlement.aggregate({
    where: { status: { in: ["HELD", "READY_FOR_APPROVAL", "REJECTED"] } },
    _sum: { grossPaise: true }
  });
  const escrowBal = escrow ? BigInt(escrow.balancePaise) : 0n;
  const waitingPaise = waiting._sum.grossPaise ? BigInt(waiting._sum.grossPaise) : 0n;
  return {
    walletMismatches,
    unbalancedGroups,
    escrow: { balanceRupees: rupees(escrowBal), waitingSettlementsRupees: rupees(waitingPaise), matches: escrowBal === waitingPaise },
    healthy: walletMismatches.length === 0 && unbalancedGroups.length === 0 && escrowBal === waitingPaise
  };
}

// server/router.ts
var driverLiveLocations = /* @__PURE__ */ new Map();
var serverAnimals = /* @__PURE__ */ new Map();
async function resolveRoleProfilesFromDB() {
  try {
    const users = await prisma.user.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "asc" }
    });
    const roleUsers = {
      customer: users.find((u) => u.role === "CUSTOMER"),
      manager: users.find((u) => u.role === "GOSALA_MANAGER"),
      driver: users.find((u) => u.role === "DRIVER"),
      admin: users.find((u) => u.role === "OPERATIONS_ADMIN"),
      super_admin: users.find((u) => u.role === "SUPER_ADMIN")
    };
    const profiles = {};
    for (const [roleKey, user] of Object.entries(roleUsers)) {
      const meta = user?.metadata || {};
      profiles[roleKey] = {
        id: user?.id || `USER-${roleKey.toUpperCase()}`,
        uniqueId: user?.uniqueId || void 0,
        role: roleKey,
        name: user?.name || (roleKey === "super_admin" ? "Super Admin" : roleKey === "admin" ? "Operations Admin" : roleKey === "manager" ? "Gaushala Manager" : roleKey === "driver" ? "Transit Pilot" : "Devotee"),
        phone: user?.phone || "+91 98000 00000",
        email: user?.email || (roleKey === "super_admin" ? "superadmin@gomaa.in" : `${roleKey}@gomaa.in`),
        avatar: user?.avatar || void 0,
        customerData: meta.customerData || (roleKey === "customer" ? {
          address: "Devotee Residence",
          aadhaarNumber: "XXXX-XXXX-0000",
          memberSince: "Oct 2026",
          totalBookings: 0,
          preferredCeremony: "Kamadhenu Puja & Gau Seva"
        } : void 0),
        managerData: meta.managerData || (roleKey === "manager" ? {
          managerId: user?.uniqueId || "MGR-0101",
          gosala: "Gaushala_01",
          region: "Operational Hub",
          dailySevaCeiling: 2,
          restingBufferMin: 90
        } : void 0),
        driverData: meta.driverData || (roleKey === "driver" ? {
          driverId: user?.uniqueId || "DRV-102",
          vehicleNumber: "TS-09-GA-1008",
          vehicleType: "Tata 407 (Hydraulic Cattle Bed)",
          licenseNumber: "DL-PENDING",
          gosalaBase: "Unassigned",
          status: "Available"
        } : void 0),
        adminData: meta.adminData || (roleKey === "admin" || roleKey === "super_admin" ? {
          adminId: user?.uniqueId || (roleKey === "super_admin" ? "SA-0001" : "OPS-0101"),
          designation: roleKey === "super_admin" ? "Platform Sovereign & Master Authority" : "Regional Operations Officer",
          department: roleKey === "super_admin" ? "GOMAA Central Platform Governance" : "Regional Gaushala Operations Hub",
          authorityLevel: roleKey === "super_admin" ? "SUPER_ADMIN" : "OPERATIONS_ADMIN",
          ...roleKey === "super_admin" ? { treasuryClearanceLevel: "Master Sovereign Authority" } : {}
        } : void 0),
        bankDetails: meta.bankDetails || void 0,
        settlementSchedule: meta.settlementSchedule || void 0
      };
    }
    return profiles;
  } catch (err) {
    console.warn("[resolveRoleProfilesFromDB] DB lookup fallback:", err);
    return {};
  }
}
function parseUrl(url) {
  const [rawPath, search] = (url || "").split("?");
  let pathname = rawPath || "/";
  if (!pathname.startsWith("/")) pathname = "/" + pathname;
  if (pathname.length > 1 && pathname.endsWith("/")) {
    pathname = pathname.replace(/\/+$/, "");
  }
  const query = new URLSearchParams(search || "");
  return { pathname, query };
}
function toMinutes(t) {
  if (!t) return 0;
  const clean = t.trim().toUpperCase();
  const isPM = clean.endsWith("PM");
  const isAM = clean.endsWith("AM");
  const raw = clean.replace(/[A-Z]/g, "").trim();
  const [hStr, mStr] = raw.split(":");
  let h = parseInt(hStr, 10) || 0;
  const m = parseInt(mStr, 10) || 0;
  if (isPM && h < 12) h += 12;
  if (isAM && h === 12) h = 0;
  return h * 60 + m;
}
function toFrontendStatus(s) {
  switch (s) {
    case "PAYMENT_VERIFIED":
      return "Payment Verified";
    case "MANAGER_REVIEW":
      return "Manager Review";
    case "MANAGER_CONFIRMED":
      return "Manager Confirmed";
    case "ADMIN_REVIEW":
      return "Admin Review";
    case "CONFIRMED":
      return "Confirmed";
    case "IN_SERVICE":
      return "In Service";
    case "COMPLETED":
      return "Completed";
    case "REJECTED":
      return "Rejected";
    default:
      return s;
  }
}
function toPrismaStatus(s) {
  switch (s) {
    case "Payment Verified":
      return "PAYMENT_VERIFIED";
    case "Manager Review":
      return "MANAGER_REVIEW";
    case "Manager Confirmed":
      return "MANAGER_CONFIRMED";
    case "Admin Review":
      return "ADMIN_REVIEW";
    case "Confirmed":
      return "CONFIRMED";
    case "In Service":
      return "IN_SERVICE";
    case "Completed":
      return "COMPLETED";
    case "Rejected":
      return "REJECTED";
    default:
      return s;
  }
}
function normalizeDateStr(d) {
  if (!d) return "";
  if (d instanceof Date) {
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  }
  const s = String(d).trim();
  const match = s.match(/^0*(\d+)[-\s]+([A-Za-z]+)[-\s]+(\d{4})$/);
  if (match) {
    return `${parseInt(match[1], 10)} ${match[2]} ${match[3]}`;
  }
  const parts = s.split(/[\s-]+/);
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    if (!isNaN(day)) return `${day} ${parts[1]} ${parts[2]}`;
  }
  return s;
}
function expandDateCandidates(input) {
  if (!input) return [];
  const s = String(input).replace(/\+/g, " ").trim();
  const set = /* @__PURE__ */ new Set([s]);
  const normalized = normalizeDateStr(s);
  if (normalized) set.add(normalized);
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    const yyyy = parsed.getFullYear();
    const mm = String(parsed.getMonth() + 1).padStart(2, "0");
    const dd = String(parsed.getDate()).padStart(2, "0");
    const d = parsed.getDate();
    const shortMonth = parsed.toLocaleString("en-US", { month: "short" });
    set.add(`${yyyy}-${mm}-${dd}`);
    set.add(`${yyyy} ${mm} ${dd}`);
    set.add(`${d} ${shortMonth} ${yyyy}`);
    set.add(`${dd} ${shortMonth} ${yyyy}`);
    set.add(`${d}-${shortMonth}-${yyyy}`);
    set.add(`${dd}-${shortMonth}-${yyyy}`);
    set.add(`${dd}/${mm}/${yyyy}`);
    set.add(`${d}/${mm}/${yyyy}`);
  }
  return Array.from(set).filter(Boolean);
}
function formatBooking(b) {
  const mgrApproval = b.auditTrails?.find(
    (a) => a.action === "MANAGER_CONFIRMED" || a.actorRole === "GOSALA_MANAGER"
  );
  const admApproval = b.auditTrails?.find(
    (a) => a.action === "ADMIN_CONFIRMED" || a.actorRole === "OPERATIONS_ADMIN"
  );
  return {
    id: b.id,
    customer: b.customerName || b.customer,
    phone: b.customerPhone || b.phone,
    gosala: b.gosalaName || b.gosala,
    animal: b.animalName || b.animal,
    animalType: b.animalType === "COW" || b.animalType === "Cow" ? "Cow" : b.animalType === "BULL" || b.animalType === "Bull" ? "Bull" : "Calf",
    date: normalizeDateStr(b.bookingDate || b.date),
    start: b.startTime || b.start,
    end: b.endTime || b.end,
    durationMin: b.durationMin,
    address: b.address,
    distanceKm: b.distanceKm,
    base: b.baseRate ?? b.base ?? 0,
    extraTime: b.extraTimeFee ?? b.extraTime ?? 0,
    transport: b.transportFee ?? b.transport ?? 0,
    addons: b.addonsFee ?? b.addons ?? 0,
    tax: b.taxFee ?? b.tax ?? 0,
    discount: b.discountFee ?? b.discount ?? 0,
    total: b.totalAmount ?? b.total ?? 0,
    commissionPct: b.commissionPct ?? 20,
    status: toFrontendStatus(b.status),
    driver: b.driver?.name || b.driver || null,
    driverStage: b.driverStage ?? 0,
    paid: b.isPaid ?? b.paid ?? true,
    managerRemark: b.managerRemark || void 0,
    adminRemark: b.adminRemark || void 0,
    freeKmSnapshot: b.freeKmSnapshot,
    perKmSnapshot: b.perKmSnapshot,
    extraUnitRateSnapshot: b.extraUnitRateSnapshot,
    commissionSnapshot: b.commissionSnapshot,
    // Complete Booker & Devotee Identity Snapshot
    customerEmail: b.customerEmail || b.customer?.email || `${(b.customerName || b.customer || "devotee").toLowerCase().replace(/\s+/g, ".")}@gmail.com`,
    aadhaarNumber: b.aadhaarNumber || "XXXX-XXXX-4912",
    aadhaarVerified: b.aadhaarVerified ?? true,
    devoteeGotra: b.devoteeGotra || "Kashyapa",
    devoteeFamilyMembers: b.devoteeFamilyMembers || "Ananya (Self), Rajesh (Husband)",
    ritualPurpose: b.ritualPurpose || "Griha Pravesh & Kamadhenu Puja",
    specialInstructions: b.specialInstructions || "Ground-floor portico ready, clean water bucket and sacred green grass feeding protocol.",
    devoteeSince: b.devoteeSince || (b.customer?.createdAt ? new Date(b.customer.createdAt).toLocaleDateString("en-IN", {
      month: "short",
      year: "numeric"
    }) : "Aug 2024"),
    // Operations Admin Portfolio Governance
    governingAdminName: b.governingAdminName || getGosalaMeta("", b.gosalaName || b.gosala)?.governingAdminName || "",
    governingAdminEmail: b.governingAdminEmail || getGosalaMeta("", b.gosalaName || b.gosala)?.governingAdminEmail || "",
    // Dynamic Customer Animal Received & Handover OTP Security
    handoverOtp: b.handoverOtp || "4819",
    handoverOtpVerified: Boolean(b.handoverOtpVerified),
    handoverOtpVerifiedAt: b.handoverOtpVerifiedAt ? new Date(b.handoverOtpVerifiedAt).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }) : void 0,
    // Rich Swiggy/Uber Driver Profile & Vehicle Specs
    driverPhone: b.driverPhone || b.driver?.phone || "+91 98201 55432",
    driverVehiclePlate: b.driverVehiclePlate || "TS 09 UA 1088",
    driverVehicleModel: b.driverVehicleModel || "Tata 407 (Hydraulic Cattle Van)",
    driverRating: b.driverRating || 4.92,
    driverTotalTrips: b.driverTotalTrips || 1280,
    driverAvatar: b.driverAvatar || void 0,
    createdAt: b.createdAt ? new Date(b.createdAt).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }) : void 0,
    managerApproval: mgrApproval ? {
      userId: mgrApproval.actorId,
      name: mgrApproval.actorName,
      timestamp: new Date(mgrApproval.createdAt).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }),
      remark: mgrApproval.remark,
      isActingManager: mgrApproval.actorRole === "OPERATIONS_ADMIN" || mgrApproval.actorName?.includes("Acting Manager") || Boolean(mgrApproval.remark?.toLowerCase().includes("acting")),
      actorRole: mgrApproval.actorRole
    } : void 0,
    adminApproval: admApproval ? {
      userId: admApproval.actorId,
      name: admApproval.actorName,
      timestamp: new Date(admApproval.createdAt).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }),
      remark: admApproval.remark,
      actorRole: admApproval.actorRole
    } : void 0,
    paymentProvider: b.paymentProvider || "RAZORPAY",
    paymentOrderId: b.paymentOrderId || void 0,
    paymentId: b.paymentId || void 0,
    walletTxId: b.walletTxId || void 0
  };
}
function formatManagerUser(user) {
  const formattedMgrId = user.id.startsWith("MGR-") ? user.id : user.id.startsWith("USER-MGR-") ? `MGR-${user.id.replace("USER-MGR-", "")}` : user.id.startsWith("USER-") ? `MGR-${user.id.replace("USER-", "")}` : `MGR-${user.id.slice(0, 8)}`;
  const rawAssignments = user.managerAssignments || [];
  const assignments = rawAssignments.filter((a) => {
    if (!a.gosala) return false;
    const meta2 = getGosalaMeta(a.gosala.id, a.gosala.name);
    if (meta2.isActingManager || meta2.actAsManagerMyself) return false;
    const gMgrId = meta2.managerId || "";
    const gMgrName = (meta2.managerName || "").toLowerCase();
    const uCleanId = user.id.startsWith("MGR-") ? user.id.replace(/^MGR-/, "") : user.id;
    const uName = (user.name || "").toLowerCase();
    if (gMgrId || gMgrName && !gMgrName.includes("none")) {
      const idMatch = Boolean(
        gMgrId && (gMgrId === user.id || gMgrId === formattedMgrId || gMgrId === uCleanId || user.id.includes(gMgrId) || gMgrId.includes(user.id))
      );
      const nameMatch = Boolean(
        gMgrName && uName && (gMgrName === uName || gMgrName.includes(uName) || uName.includes(gMgrName))
      );
      return idMatch || nameMatch;
    }
    return true;
  });
  const assignedGosalas = assignments.map((a) => a.gosala?.name).filter(Boolean);
  const assignedGosalaIds = assignments.map((a) => a.gosala?.id).filter(Boolean);
  const primaryGosala = assignedGosalas[0] || "Unassigned";
  const primaryRegion = assignments[0]?.region || assignments[0]?.gosala?.region || "Operational Hub";
  let totalAnimals = 0;
  for (const a of assignments) {
    if (a.gosala?.animals) {
      totalAnimals += a.gosala.animals.length;
    }
  }
  const firstAssignedAt = assignments[0]?.assignedAt || user.createdAt;
  const meta = getUserMeta(user.email || user.id);
  return {
    id: formattedMgrId,
    name: user.name,
    email: user.email,
    phone: user.phone,
    password: meta.password,
    gosala: primaryGosala,
    gosalas: assignedGosalas,
    gosalaIds: assignedGosalaIds,
    region: primaryRegion,
    status: user.isActive ? "Active" : "Inactive",
    assignedDate: new Date(firstAssignedAt).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }),
    animalsCount: totalAnimals
  };
}
function formatSettlement(s) {
  const statusMap = {
    PENDING: "Pending",
    APPROVED: "Approved",
    PROCESSING: "Processing",
    PAID: "Paid",
    FAILED: "Failed"
  };
  return {
    gosala: s.gosalaName,
    bookings: s.bookingsCount,
    gross: s.grossAmount,
    commissionPct: s.commissionPct,
    status: statusMap[s.status] || "Pending",
    batch: s.batch
  };
}
async function handleApiRequest(method, rawUrl, rawBody, headers) {
  const { pathname, query } = parseUrl(rawUrl);
  if (!pathname.startsWith("/api/")) return null;
  const authUser = getAuthUserFromHeader(headers?.authorization || headers?.Authorization);
  const isPublicRoute = method === "POST" && (pathname === "/api/auth/login" || pathname === "/api/auth/admin-login" || pathname === "/api/auth/register" || pathname === "/api/auth/forgot-password" || pathname === "/api/auth/verify-otp" || pathname === "/api/auth/reset-password" || pathname === "/api/payments/webhook" || pathname === "/api/webhooks/razorpayx" || pathname === "/api/jobs/settlement-maturity" || pathname === "/api/places/resolve-link") || method === "GET" && (pathname === "/api/jobs/settlement-maturity" || pathname === "/api/health" || pathname === "/api/hubs" || pathname === "/api/places/search" || pathname === "/api/animals" || pathname === "/api/gosalas" || pathname === "/api/vets" || pathname === "/api/pricing-config" || pathname === "/api/pricing/config" || pathname === "/api/availability");
  if (!isPublicRoute && !authUser) {
    return { status: 401, body: { ok: false, error: "Authentication required" } };
  }
  const requireRole = (...roles) => authUser && roles.includes(authUser.role) ? null : { status: 403, body: { ok: false, error: "Insufficient privileges" } };
  const walletResponse = await handleWalletRoutes({ method, pathname, query, rawBody, headers, authUser });
  if (walletResponse) return walletResponse;
  if (method === "POST" && pathname === "/api/hold" || method === "POST" && pathname === "/api/hold/release" || method === "POST" && pathname === "/api/bookings") {
    const denied = requireRole("customer", "admin", "super_admin");
    if (denied) return denied;
  }
  if ((method === "GET" || method === "POST") && pathname === "/api/users" || method === "GET" && pathname === "/api/debug/email-status") {
    const denied = requireRole("super_admin");
    if (denied) return denied;
  }
  if (method === "GET" && pathname === "/api/auth/accounts") {
    const denied = requireRole("super_admin", "admin");
    if (denied) return denied;
  }
  if ((method === "PUT" || method === "DELETE") && /^\/api\/users\/[^/]+$/.test(pathname)) {
    const denied = requireRole("super_admin");
    if (denied) return denied;
  }
  if ((method === "PUT" || method === "PATCH") && (pathname === "/api/pricing-config" || pathname === "/api/pricing/config") || method === "POST" && pathname.startsWith("/api/settlements/")) {
    const denied = requireRole("super_admin");
    if (denied) return denied;
  }
  if (method === "GET" && (pathname === "/api/settlements" || pathname === "/api/settlements/schedule")) {
    const denied = requireRole("super_admin", "admin", "manager");
    if (denied) return denied;
  }
  let body = {};
  if (typeof rawBody === "string" && rawBody.trim()) {
    try {
      body = JSON.parse(rawBody);
    } catch {
      body = {};
    }
  } else if (rawBody && typeof rawBody === "object") {
    body = rawBody;
  }
  if (method === "POST" && pathname === "/api/auth/login") {
    try {
      const emailOrPhone = body.email || body.phone || body.username || body.emailOrPhone || "";
      const roleHint = body.roleHint || body.role;
      if (!emailOrPhone) {
        return { status: 400, body: { ok: false, error: "Email or phone number is required" } };
      }
      const session = await authenticateOrResolveUser(emailOrPhone, roleHint, body.password);
      if (!session) {
        return { status: 401, body: { ok: false, error: "Invalid credentials or user not found" } };
      }
      return { status: 200, body: { ok: true, token: session.token, user: session.user } };
    } catch (err) {
      if (err.message?.includes("/admin portal")) {
        return { status: 403, body: { ok: false, error: err.message, requiresAdminPortal: true } };
      }
      const isAuthErr = err.message?.toLowerCase().includes("password") || err.message?.toLowerCase().includes("invalid") || err.message?.toLowerCase().includes("unauthorized");
      return { status: isAuthErr ? 401 : 500, body: { ok: false, error: err.message || "Authentication failed" } };
    }
  }
  if (method === "POST" && pathname === "/api/auth/admin-login") {
    const clientIp = headers?.["x-forwarded-for"] || "127.0.0.1";
    try {
      const emailOrPhone = body.email || body.phone || body.username || body.emailOrPhone || "";
      if (!emailOrPhone) {
        return { status: 400, body: { ok: false, error: "Administrative email, phone, or ID is required" } };
      }
      checkAdminRateLimit(clientIp);
      const session = await authenticateAdminUser(emailOrPhone, body.password);
      recordAdminLoginAttempt(clientIp, true);
      console.log(`[ADMIN SECURITY AUDIT] Successful login for ${session.user.email} (${session.user.role}) from ${clientIp}`);
      return { status: 200, body: { ok: true, token: session.token, user: session.user } };
    } catch (err) {
      recordAdminLoginAttempt(clientIp, false);
      console.warn(`[ADMIN SECURITY AUDIT] Failed login from ${clientIp}: ${err.message}`);
      const isAccessDenied = err.message?.includes("Access Denied");
      const isRateLimit = err.message?.includes("Too many");
      const isAuthErr = err.message?.toLowerCase().includes("password") || err.message?.toLowerCase().includes("invalid");
      const status = isRateLimit ? 429 : isAccessDenied ? 403 : isAuthErr ? 401 : 500;
      return { status, body: { ok: false, error: err.message || "Administrative authentication failed" } };
    }
  }
  if (method === "GET" && pathname === "/api/auth/me") {
    if (!authUser) {
      return { status: 401, body: { ok: false, error: "Unauthenticated session" } };
    }
    return { status: 200, body: { ok: true, user: authUser } };
  }
  if (method === "GET" && pathname === "/api/auth/accounts") {
    try {
      const accounts = await getDirectoryAccounts();
      return { status: 200, body: { ok: true, accounts } };
    } catch (err) {
      return { status: 500, body: { ok: false, error: err.message } };
    }
  }
  if (method === "POST" && pathname === "/api/auth/register") {
    try {
      const session = await registerUser(body);
      return { status: 201, body: { ok: true, token: session.token, user: session.user } };
    } catch (err) {
      return { status: 400, body: { ok: false, error: err.message || "Registration failed" } };
    }
  }
  if (method === "POST" && pathname === "/api/auth/forgot-password") {
    try {
      const emailOrPhone = body?.emailOrPhone || body?.email || body?.phone || "";
      const channel = body?.channel || (emailOrPhone.includes("@") ? "EMAIL" : "PHONE");
      const result = await requestPasswordResetOtp(emailOrPhone, channel, headers?.["x-forwarded-for"] || "");
      return { status: 200, body: result };
    } catch (err) {
      return { status: 400, body: { ok: false, error: err.message || "Failed to process verification request" } };
    }
  }
  if (method === "POST" && pathname === "/api/auth/verify-otp") {
    try {
      const emailOrPhone = body?.emailOrPhone || body?.email || body?.phone || "";
      const otp = body?.otp || body?.code || "";
      const result = await verifyOtpAndGenerateResetToken(emailOrPhone, otp);
      return { status: 200, body: result };
    } catch (err) {
      return { status: 400, body: { ok: false, error: err.message || "Invalid or expired verification code" } };
    }
  }
  if (method === "POST" && pathname === "/api/auth/reset-password") {
    try {
      const emailOrPhone = body?.emailOrPhone || body?.email || body?.phone || "";
      const resetToken = body?.resetToken || body?.token || "";
      const newPassword = body?.newPassword || body?.password || "";
      const result = await resetPasswordWithToken(emailOrPhone, resetToken, newPassword);
      return { status: 200, body: result };
    } catch (err) {
      return { status: 400, body: { ok: false, error: err.message || "Failed to reset password" } };
    }
  }
  if (method === "POST" && pathname === "/api/auth/switch-context") {
    if (!authUser) {
      return { status: 401, body: { ok: false, error: "Unauthenticated session" } };
    }
    const targetRole = body?.targetRole || body?.role;
    if (!targetRole || targetRole !== "super_admin" && targetRole !== "admin") {
      return { status: 400, body: { ok: false, error: "Invalid targetRole. Must be 'super_admin' or 'admin'" } };
    }
    try {
      const session = await switchUserContext(authUser, targetRole);
      return { status: 200, body: { ok: true, token: session.token, user: session.user } };
    } catch (err) {
      const status = err.status || (err.message?.includes("Forbidden") ? 403 : 500);
      return { status, body: { ok: false, error: err.message || "Failed to switch role context" } };
    }
  }
  if (method === "GET" && pathname === "/api/hubs") {
    try {
      const hubs = getAllOperationalHubs();
      return { status: 200, body: { ok: true, hubs } };
    } catch (err) {
      return { status: 500, body: { ok: false, error: err.message } };
    }
  }
  if (method === "POST" && pathname === "/api/hubs") {
    const denied = requireRole("admin", "super_admin");
    if (denied) return denied;
    try {
      const newHub = createOperationalHub(body);
      return { status: 201, body: { ok: true, hub: newHub } };
    } catch (err) {
      return { status: 400, body: { ok: false, error: err.message || "Could not register operational hub" } };
    }
  }
  if (method === "GET" && pathname === "/api/places/search") {
    try {
      const q = String(query?.get("q") || "").trim();
      const places = await searchGooglePlacesApi(q);
      return { status: 200, body: { ok: true, places } };
    } catch (err) {
      return { status: 500, body: { ok: false, error: err.message } };
    }
  }
  if (method === "POST" && pathname === "/api/places/resolve-link") {
    try {
      const input = String(body?.url || body?.input || "").trim();
      if (!input) {
        return { status: 400, body: { ok: false, error: "Missing 'url' or 'input' parameter" } };
      }
      const resolved = await resolveGoogleMapsLinkOrCoords(input);
      if (!resolved) {
        return { status: 404, body: { ok: false, error: "Could not extract location or coordinates from the provided Google Maps link." } };
      }
      return { status: 200, body: { ok: true, place: resolved } };
    } catch (err) {
      return { status: 500, body: { ok: false, error: err.message } };
    }
  }
  if (method === "GET" && pathname === "/api/users") {
    try {
      const users = await getAllUsers();
      return { status: 200, body: { ok: true, users } };
    } catch (err) {
      return { status: 500, body: { ok: false, error: err.message } };
    }
  }
  if (method === "POST" && pathname === "/api/users") {
    try {
      const session = await registerUser(body);
      return { status: 201, body: { ok: true, user: session.user } };
    } catch (err) {
      return { status: 400, body: { ok: false, error: err.message || "Failed to create user" } };
    }
  }
  const putUserMatch = pathname.match(/^\/api\/users\/([^/]+)$/);
  if (method === "PUT" && putUserMatch) {
    const id = putUserMatch[1];
    try {
      const updated = await updateUser(id, body);
      return { status: 200, body: { ok: true, user: updated } };
    } catch (err) {
      return { status: 400, body: { ok: false, error: err.message || "Failed to update user" } };
    }
  }
  if (method === "DELETE" && putUserMatch) {
    const id = putUserMatch[1];
    try {
      await deleteUser(id);
      return { status: 200, body: { ok: true, deleted: id } };
    } catch (err) {
      console.warn("[DELETE /api/users] notice:", err?.message);
      return { status: 200, body: { ok: true, deleted: id } };
    }
  }
  if (method === "GET" && pathname === "/api/health") {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return {
        status: 200,
        body: {
          ok: true,
          database: "postgresql-connected",
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        }
      };
    } catch (err) {
      return {
        status: 500,
        body: { ok: false, database: "error", error: err.message }
      };
    }
  }
  if (method === "GET" && pathname === "/api/debug/email-status") {
    const gmailUser = (process.env.GMAIL_USER || "").replace(/["']/g, "").trim();
    const gmailPass = (process.env.GMAIL_APP_PASSWORD || "").replace(/["'\s]/g, "").trim();
    const resendKey = (process.env.RESEND_API_KEY || "").replace(/["']/g, "").trim();
    const diagnostics = {
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      nodeVersion: process.version,
      platform: process.platform,
      env: {
        GMAIL_USER_set: !!process.env.GMAIL_USER,
        GMAIL_USER_val: gmailUser ? `${gmailUser.slice(0, 3)}***@${gmailUser.split("@")[1] || ""}` : null,
        GMAIL_APP_PASSWORD_set: !!process.env.GMAIL_APP_PASSWORD,
        GMAIL_APP_PASSWORD_len: gmailPass.length,
        RESEND_API_KEY_set: !!process.env.RESEND_API_KEY,
        RESEND_API_KEY_prefix: resendKey ? resendKey.slice(0, 6) + "..." : null
      }
    };
    try {
      const sendResult = await sendOtpEmail({
        toEmail: "diagnostics@gomaa.in",
        userName: "Diagnostic Check",
        otp: "123456",
        expiryMinutes: 10
      });
      diagnostics.dispatchResult = sendResult;
    } catch (err) {
      diagnostics.dispatchError = err.message || String(err);
    }
    return { status: 200, body: diagnostics };
  }
  if (method === "GET" && pathname === "/api/availability") {
    try {
      const animalParam = (query.get("animal") || "").trim();
      const rawDate = query.get("date") || "";
      const date = rawDate.replace(/\+/g, " ").trim();
      const time = (query.get("time") || "").replace(/\+/g, " ").trim();
      const duration = Number(query.get("duration")) || 60;
      const dateCandidates = expandDateCandidates(rawDate || date);
      const animalRecord = await prisma.animal.findFirst({
        where: {
          OR: [
            { id: animalParam },
            { name: { equals: animalParam, mode: "insensitive" } },
            ...animalParam ? [{ name: { contains: animalParam, mode: "insensitive" } }] : []
          ]
        }
      });
      const animalId = animalRecord?.id;
      const animalName = animalRecord?.name || animalParam;
      const manualBlock = await prisma.animalScheduleBlock.findFirst({
        where: {
          OR: [
            ...animalId ? [{ animalId }] : [],
            { animalName: { in: [animalName, animalParam] } }
          ],
          date: { in: dateCandidates },
          timeSlot: time
        }
      });
      if (manualBlock) {
        return {
          status: 200,
          body: {
            available: false,
            status: "Blocked",
            reason: manualBlock.reason || "Slot blocked for resting / medical inspection"
          }
        };
      }
      const slotStart = toMinutes(time);
      const slotEnd = slotStart + duration;
      const activeHolds = await prisma.temporarySlotHold.findMany({
        where: {
          OR: [
            ...animalId ? [{ animalId }] : [],
            { animal: { name: { equals: animalName, mode: "insensitive" } } }
          ],
          date: { in: dateCandidates },
          status: "ACTIVE",
          expiresAt: { gt: /* @__PURE__ */ new Date() }
        }
      });
      for (const hold of activeHolds) {
        const holdStart = toMinutes(hold.startTime);
        const holdEnd = holdStart + (hold.durationMin || 60);
        if (slotStart < holdEnd && slotEnd > holdStart) {
          return {
            status: 200,
            body: {
              available: false,
              status: "Held",
              reason: `Slot temporarily held by customer checkout (${Math.ceil(
                (hold.expiresAt.getTime() - Date.now()) / 1e3
              )}s remaining)`
            }
          };
        }
      }
      const bookings = await prisma.booking.findMany({
        where: {
          OR: [
            ...animalId ? [{ animalId }] : [],
            { animalName: { equals: animalName, mode: "insensitive" } },
            { animalName: { equals: animalParam, mode: "insensitive" } },
            ...animalParam ? [{ animalName: { contains: animalParam, mode: "insensitive" } }] : []
          ],
          bookingDate: { in: dateCandidates },
          status: { notIn: ["REJECTED", "CANCELLED"] }
        }
      });
      const pricing = await prisma.masterPricingConfig.findFirst().catch(() => null);
      const buffer = pricing?.bufferMin || 30;
      for (const b of bookings) {
        const bStart = toMinutes(b.startTime);
        const bEnd = toMinutes(b.endTime);
        if (slotStart < bEnd && slotEnd > bStart) {
          return {
            status: 200,
            body: {
              available: false,
              status: "Booked",
              bookingId: b.id,
              customer: b.customerName,
              reason: `Reserved for ${b.customerName} (${b.startTime} - ${b.endTime})`
            }
          };
        }
        const bufferStart = Math.max(0, bStart - buffer);
        const bufferEnd = bEnd + buffer;
        if (slotStart < bufferEnd && slotEnd > bufferStart) {
          return {
            status: 200,
            body: {
              available: false,
              status: "Buffer",
              bookingId: b.id,
              reason: `Required operational buffer (${buffer}m) for animal resting & travel`
            }
          };
        }
      }
      return { status: 200, body: { available: true, status: "Available" } };
    } catch (err) {
      console.warn("[api/availability] Handled error:", err?.message);
      return { status: 200, body: { available: true, status: "Available" } };
    }
  }
  if (method === "POST" && pathname === "/api/hold") {
    let animal = await prisma.animal.findFirst({
      where: {
        ...body.gosala ? { gosala: { name: body.gosala } } : {},
        OR: [
          { id: body.animal },
          { name: { equals: body.animal, mode: "insensitive" } },
          ...body.animal ? [{ name: { contains: body.animal, mode: "insensitive" } }] : []
        ]
      }
    });
    if (!animal) {
      const firstGosala = await prisma.gosala.findFirst({ where: { isActive: true } });
      if (firstGosala) {
        animal = await prisma.animal.create({
          data: {
            name: body.animal || "Sacred Cow",
            gosalaId: firstGosala.id,
            type: "COW",
            price: 3500,
            healthStatus: "HEALTHY",
            isActive: true
          }
        });
      }
    }
    if (!animal) return { status: 404, body: { success: false, error: "Animal not found" } };
    if (authUser?.userId) {
      try {
        const u = await prisma.user.findUnique({ where: { id: authUser.userId } });
        if (!u) {
          await prisma.user.create({
            data: {
              id: authUser.userId,
              email: authUser.email || `${authUser.userId}@gomaa.in`,
              name: authUser.name || body.customerName || "Customer",
              phone: authUser.phone || "+91 98000 00000",
              role: "CUSTOMER"
            }
          });
        }
      } catch {
      }
    }
    const dateCandidates = expandDateCandidates(body.date);
    const ttlSeconds = Math.min(600, Math.max(60, Number(body.ttlSeconds) || 300));
    const ttl = ttlSeconds * 1e3;
    let hold;
    try {
      hold = await prisma.$transaction(async (tx) => {
        try {
          await tx.$queryRaw`SELECT id FROM animals WHERE id = ${animal.id} FOR UPDATE`;
        } catch {
        }
        const holdStart = toMinutes(body.start);
        const holdEnd = holdStart + (Number(body.durationMin) || 60);
        const activeHolds = await tx.temporarySlotHold.findMany({
          where: {
            animalId: animal.id,
            date: { in: dateCandidates },
            status: "ACTIVE",
            expiresAt: { gt: /* @__PURE__ */ new Date() }
          }
        });
        const isSlotHeld = activeHolds.some((h) => {
          if (authUser?.userId && h.customerId === authUser.userId) return false;
          const s = toMinutes(h.startTime);
          const e = s + (h.durationMin || 60);
          return holdStart < e && holdEnd > s;
        });
        if (isSlotHeld) throw new Error("This slot is already held by another devotee");
        const bookings = await tx.booking.findMany({
          where: {
            animalId: animal.id,
            bookingDate: { in: dateCandidates },
            status: { notIn: ["REJECTED", "CANCELLED"] }
          }
        });
        if (bookings.some((booking) => holdStart < toMinutes(booking.endTime) && holdEnd > toMinutes(booking.startTime))) {
          throw new Error("This slot is already booked");
        }
        return tx.temporarySlotHold.create({
          data: {
            id: "HOLD-" + crypto9.randomUUID().replace(/-/g, "").slice(0, 20).toUpperCase(),
            animalId: animal.id,
            date: body.date,
            startTime: body.start,
            durationMin: Number(body.durationMin) || 60,
            customerName: authUser?.name || body.customerName || "Customer",
            customerId: authUser?.userId,
            status: "ACTIVE",
            expiresAt: new Date(Date.now() + ttl)
          }
        });
      }, { timeout: 2e4, maxWait: 1e4 });
    } catch (err) {
      console.warn("[api/hold] failed:", err?.code || "", err?.message);
      const message = err?.message || "Unable to create hold";
      return {
        status: message.includes("already") ? 409 : 500,
        body: { success: false, reason: message, error: message }
      };
    }
    return { status: 200, body: { success: true, hold } };
  }
  if (method === "POST" && pathname === "/api/hold/release") {
    const hold = await prisma.temporarySlotHold.findUnique({ where: { id: body.holdId } });
    if (!hold) return { status: 404, body: { released: false, error: "Hold not found" } };
    if (hold.customerId !== authUser?.userId && !["admin", "super_admin"].includes(authUser?.role || "")) {
      return { status: 403, body: { released: false, error: "Hold belongs to another customer" } };
    }
    if (hold.status !== "ACTIVE") return { status: 409, body: { released: false, error: "Hold is no longer active" } };
    await prisma.temporarySlotHold.update({ where: { id: hold.id }, data: { status: "RELEASED", releasedAt: /* @__PURE__ */ new Date() } });
    return { status: 200, body: { released: true } };
  }
  if (method === "POST" && pathname === "/api/pricing/calculate") {
    let cfg = null;
    try {
      const dbCfg = await prisma.masterPricingConfig.findFirst();
      if (dbCfg) cfg = dbCfg;
    } catch (err) {
      console.warn("Pricing config fetch error:", err?.message);
    }
    if (!cfg) {
      cfg = {
        standardMin: 60,
        extraUnitMin: 30,
        extraUnitRate: 500,
        freeKm: 5,
        perKm: 50,
        taxPct: 12,
        commissionPct: 20
      };
    }
    let sanctuaryTaxPct = body.taxPct !== void 0 ? Number(body.taxPct) : void 0;
    let sanctuaryCommPct = body.commissionPct !== void 0 ? Number(body.commissionPct) : void 0;
    let sanctuaryCommFlat = body.commissionFlat !== void 0 ? Number(body.commissionFlat) : void 0;
    if (body.gosalaId || body.gosala) {
      try {
        const g = await prisma.gosala.findFirst({
          where: {
            OR: [
              ...body.gosalaId ? [{ id: body.gosalaId }] : [],
              ...body.gosala ? [{ name: body.gosala }] : []
            ]
          }
        });
        if (g) {
          if (sanctuaryTaxPct === void 0) {
            if (g.taxTreatment === "SECTION_80G_EXEMPT" || g.taxTreatment === "section_80g_exempt") sanctuaryTaxPct = 0;
            else if (g.taxTreatment === "REDUCED_CHARITY_GST" || g.taxTreatment === "reduced_charity_gst") sanctuaryTaxPct = 5;
            else if (g.customTaxPct !== null && g.customTaxPct !== void 0) sanctuaryTaxPct = g.customTaxPct;
          }
          if (sanctuaryCommPct === void 0 && sanctuaryCommFlat === void 0) {
            if (g.commissionType === "FIXED_PER_BOOKING" || g.commissionType === "fixed") {
              sanctuaryCommFlat = g.commissionValue ?? 400;
            } else if (g.commissionValue !== null && g.commissionValue !== void 0) {
              sanctuaryCommPct = g.commissionValue;
            }
          }
        }
      } catch (err) {
        console.warn("Pricing calculation sanctuary lookup fallback:", err);
      }
    }
    const base = body.baseRate ?? 3500;
    const durationMin = Number(body.durationMin) || cfg.standardMin || 60;
    const extraMin = Math.max(0, durationMin - (cfg.standardMin || 60));
    const unitMin = body.extraUnitMin ?? (cfg.extraUnitMin || 30);
    const unitRate = body.extraUnitRate ?? (cfg.extraUnitRate || 500);
    const extraUnits = Math.ceil(extraMin / unitMin);
    const extraTime = extraUnits * unitRate;
    const distanceKm = Number(body.distanceKm) || 0;
    const freeKm = body.freeKm !== void 0 ? Number(body.freeKm) : cfg.freeKm || 5;
    const perKm = body.perKm !== void 0 ? Number(body.perKm) : cfg.perKm || 50;
    const chargeableKm = Math.max(
      0,
      Math.round((distanceKm - freeKm) * 10) / 10
    );
    const transport = Math.round(chargeableKm * perKm / 10) * 10;
    const addons = Number(body.addonsCost) || 0;
    const discount = Number(body.discount) || 0;
    const subtotal = Math.max(0, base + extraTime + transport + addons - discount);
    const taxPct = sanctuaryTaxPct !== void 0 ? sanctuaryTaxPct : cfg.taxPct || 12;
    const tax = Math.round(subtotal * taxPct / 100);
    const total = subtotal + tax;
    const commissionPct = sanctuaryCommPct !== void 0 ? sanctuaryCommPct : cfg.commissionPct || 20;
    const sevaTotal = base + extraTime;
    const commission = sanctuaryCommFlat !== void 0 && sanctuaryCommFlat !== null ? sanctuaryCommFlat : Math.round(sevaTotal * commissionPct / 100);
    const passThrough = transport + addons;
    const gosalaPayable = Math.max(0, sevaTotal - commission) + passThrough;
    const pricingResult = {
      status: 200,
      body: {
        base,
        extraTime,
        transport,
        addons,
        tax,
        discount,
        total,
        commission,
        commissionPct,
        gosalaPayable,
        freeKmSnapshot: freeKm,
        perKmSnapshot: perKm,
        extraUnitRateSnapshot: unitRate,
        chargeableKm
      }
    };
    const quoteToken = authUser ? issueQuote(authUser.userId, {
      gosalaId: body.gosalaId,
      gosala: body.gosala,
      animal: body.animal,
      durationMin,
      distanceKm,
      ...pricingResult.body
    }) : void 0;
    return { ...pricingResult, body: { ...pricingResult.body, quoteToken } };
  }
  if (method === "POST" && pathname === "/api/payments/razorpay/order") {
    const denied = requireRole("customer");
    if (denied) return denied;
    try {
      const quoteToken = String(body.quoteToken || "");
      const quote = verifyQuote(quoteToken, authUser.userId).values;
      const amountPaise = Number(quote.total) * 100;
      if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) {
        return { status: 400, body: { error: "Quote has an invalid payment amount" } };
      }
      const result = await createPaymentOrder({
        customerId: authUser.userId,
        quoteToken,
        holdId: String(body.holdId || ""),
        amountPaise
      });
      return { status: 201, body: { ok: true, ...result, keyId: process.env.RAZORPAY_KEY_ID } };
    } catch (err) {
      return { status: 503, body: { ok: false, error: err.message || "Payment provider unavailable" } };
    }
  }
  if (method === "GET" && pathname === "/api/wallet/balance") {
    if (!authUser || !authUser.userId) {
      return { status: 401, body: { ok: false, error: "Authentication required" } };
    }
    try {
      const balance = await getWalletBalance(authUser.userId);
      return { status: 200, body: { ok: true, ...balance } };
    } catch (err) {
      return { status: 500, body: { ok: false, error: err.message || "Failed to fetch wallet balance" } };
    }
  }
  if (method === "GET" && pathname === "/api/wallet/transactions") {
    if (!authUser || !authUser.userId) {
      return { status: 401, body: { ok: false, error: "Authentication required" } };
    }
    try {
      const limit = Number(query.get("limit")) || 50;
      const transactions = await getWalletTransactions(authUser.userId, limit);
      return { status: 200, body: { ok: true, transactions } };
    } catch (err) {
      return { status: 500, body: { ok: false, error: err.message || "Failed to fetch transactions" } };
    }
  }
  if (method === "POST" && pathname === "/api/wallet/topup/order") {
    if (!authUser || !authUser.userId) {
      return { status: 401, body: { ok: false, error: "Authentication required" } };
    }
    const amountRupees = Number(body.amountRupees || body.amount);
    if (!amountRupees || amountRupees < 100 || amountRupees > 5e4) {
      return {
        status: 400,
        body: { ok: false, error: "Top-up amount must be between \u20B9100 and \u20B950,000" }
      };
    }
    const amountPaise = Math.round(amountRupees * 100);
    try {
      const result = await createPaymentOrder({
        customerId: authUser.userId,
        quoteToken: `wallet_topup_${authUser.userId}_${Date.now()}`,
        holdId: `topup_hold_${authUser.userId}`,
        amountPaise
      });
      return {
        status: 201,
        body: {
          ok: true,
          ...result,
          amountRupees,
          keyId: process.env.RAZORPAY_KEY_ID || "rzp_test_gomaa_synthetic"
        }
      };
    } catch (err) {
      return { status: 503, body: { ok: false, error: err.message || "Failed to create topup order" } };
    }
  }
  if (method === "POST" && pathname === "/api/wallet/topup/verify") {
    if (!authUser || !authUser.userId) {
      return { status: 401, body: { ok: false, error: "Authentication required" } };
    }
    const { paymentId, orderId, signature, amountPaise } = body;
    if (!paymentId || !orderId || !signature || !amountPaise) {
      return { status: 400, body: { ok: false, error: "Missing required payment verification parameters" } };
    }
    const expectedPaise = BigInt(amountPaise);
    if (expectedPaise <= 0n) {
      return { status: 400, body: { ok: false, error: "Invalid payment amount" } };
    }
    const existingTx = await prisma.walletTransaction.findFirst({
      where: { referenceId: paymentId }
    });
    if (existingTx) {
      return {
        status: 409,
        body: { ok: false, error: "This payment has already been credited to a wallet" }
      };
    }
    const secret = process.env.RAZORPAY_KEY_SECRET || "gomaa_test_secret_2026";
    const expected = crypto9.createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
    if (signature !== expected) {
      return { status: 402, body: { ok: false, error: "Invalid cryptographic payment signature" } };
    }
    try {
      const creditRes = await creditWallet({
        userId: authUser.userId,
        amountPaise: expectedPaise,
        purpose: "TOPUP",
        referenceId: paymentId,
        idempotencyKey: `topup_${paymentId}`,
        description: `Wallet top-up of \u20B9${Number(expectedPaise) / 100} via Razorpay (${paymentId})`,
        metadata: { orderId, paymentId }
      });
      return {
        status: 200,
        body: {
          ok: true,
          message: "Wallet topped up successfully",
          ...creditRes
        }
      };
    } catch (err) {
      return { status: 500, body: { ok: false, error: err.message || "Failed to credit wallet" } };
    }
  }
  if (method === "POST" && pathname === "/api/payments/webhook") {
    const webhookSignature = headers?.["x-razorpay-signature"] || headers?.["X-Razorpay-Signature"];
    if (!webhookSignature || typeof webhookSignature !== "string") {
      return { status: 400, body: { ok: false, error: "Missing webhook signature" } };
    }
    try {
      const isValid = verifyWebhookSignature(rawBody, webhookSignature);
      if (!isValid) {
        return { status: 400, body: { ok: false, error: "Invalid webhook signature" } };
      }
    } catch (err) {
      return { status: 500, body: { ok: false, error: err?.message || "Webhook verification failed" } };
    }
    let payload = {};
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return { status: 400, body: { ok: false, error: "Invalid JSON payload" } };
    }
    const event = payload.event;
    const paymentEntity = payload.payload?.payment?.entity;
    const orderEntity = payload.payload?.order?.entity;
    try {
      if (event === "payment.captured" || event === "order.paid") {
        const orderId = orderEntity?.id || paymentEntity?.order_id;
        const paymentId = paymentEntity?.id;
        if (orderId) {
          const booking = await prisma.booking.findFirst({
            where: {
              OR: [
                { paymentOrderId: orderId },
                ...paymentId ? [{ paymentId }] : []
              ]
            }
          });
          if (booking) {
            await prisma.booking.update({
              where: { id: booking.id },
              data: {
                paymentStatus: "CAPTURED",
                isPaid: true,
                paymentId: paymentId || booking.paymentId,
                paymentOrderId: orderId || booking.paymentOrderId,
                paymentCapturedAt: booking.paymentCapturedAt || /* @__PURE__ */ new Date()
              }
            });
          }
        }
      } else if (event === "payment.failed") {
        const orderId = orderEntity?.id || paymentEntity?.order_id;
        const paymentId = paymentEntity?.id;
        if (orderId) {
          const booking = await prisma.booking.findFirst({
            where: {
              OR: [
                { paymentOrderId: orderId },
                ...paymentId ? [{ paymentId }] : []
              ]
            }
          });
          if (booking && booking.paymentStatus !== "CAPTURED") {
            await prisma.booking.update({
              where: { id: booking.id },
              data: {
                paymentStatus: "FAILED"
              }
            });
          }
        }
      }
      return {
        status: 200,
        body: { ok: true, received: true, event }
      };
    } catch (err) {
      console.error("[Razorpay Webhook Error]:", err);
      return {
        status: 500,
        body: { ok: false, error: "Webhook reconciliation failed" }
      };
    }
  }
  if (method === "GET" && pathname === "/api/bookings") {
    const gosala = query.get("gosala");
    const customer = query.get("customer");
    const status = query.get("status");
    try {
      const where = {};
      if (gosala) where.gosalaName = { contains: gosala, mode: "insensitive" };
      if (customer) where.customerName = { contains: customer, mode: "insensitive" };
      if (status) where.status = toPrismaStatus(status);
      if (authUser?.role === "manager" && authUser.gosalaNames?.length > 0) {
        where.OR = authUser.gosalaNames.map((gn) => ({
          gosalaName: { equals: gn, mode: "insensitive" }
        }));
      } else if (authUser?.role === "admin") {
        const adminEmail = (authUser.email || "").toLowerCase();
        const adminName = (authUser.name || "").toLowerCase();
        if (authUser.gosalaNames && authUser.gosalaNames.length > 0) {
          where.OR = authUser.gosalaNames.map((gn) => ({
            gosalaName: { equals: gn, mode: "insensitive" }
          }));
        } else {
          const allGosalas = await prisma.gosala.findMany({ where: { isActive: true } });
          const myGosalaNames = allGosalas.filter((g) => {
            const meta = getGosalaMeta(g.id, g.name);
            const gEmail = (g.adminEmail || meta.governingAdminEmail || "").toLowerCase();
            const gName = (g.adminName || meta.governingAdminName || meta.adminName || "").toLowerCase();
            const emailMatch = Boolean(gEmail && gEmail === adminEmail);
            const nameMatch = Boolean(adminName && (gName === adminName || gName.includes(adminName)));
            const idMatch = Boolean(authUser.userId && g.adminId === authUser.userId);
            return emailMatch || nameMatch || idMatch;
          }).map((g) => g.name);
          if (myGosalaNames.length > 0) {
            where.OR = myGosalaNames.map((gn) => ({
              gosalaName: { equals: gn, mode: "insensitive" }
            }));
          }
        }
      } else if (authUser?.role === "super_admin") {
        if (query.get("gosala")) {
          where.gosalaName = { contains: query.get("gosala"), mode: "insensitive" };
        }
      } else if (authUser?.role === "driver") {
        where.OR = [
          { driverId: authUser.userId },
          { driver: { name: { equals: authUser.name, mode: "insensitive" } } },
          { driverPhone: { equals: authUser.phone || authUser.email, mode: "insensitive" } },
          {
            driverId: null,
            status: { in: ["CONFIRMED", "ADMIN_REVIEW", "PAYMENT_VERIFIED"] }
          }
        ];
      } else if (authUser?.role === "customer") {
        where.OR = [
          { customerId: authUser.userId },
          ...authUser.phone ? [{ customerPhone: { equals: authUser.phone, mode: "insensitive" } }] : [],
          ...authUser.email ? [{ customerPhone: { equals: authUser.email, mode: "insensitive" } }] : [],
          { customerName: { equals: authUser.name, mode: "insensitive" } }
        ];
      }
      const bookings = await prisma.booking.findMany({
        where: Object.keys(where).length > 0 ? where : void 0,
        include: { driver: true, auditTrails: true },
        orderBy: { createdAt: "desc" }
      });
      return { status: 200, body: { bookings: bookings.map(formatBooking) } };
    } catch (err) {
      console.warn("[GET /api/bookings] DB fallback notice:", err?.message);
      return { status: 200, body: { bookings: [] } };
    }
  }
  if (method === "POST" && pathname === "/api/bookings") {
    const b = body.booking;
    if (!b || !b.id)
      return { status: 400, body: { error: "Missing booking payload" } };
    if (authUser?.role !== "customer" && !["admin", "super_admin"].includes(authUser?.role || "")) {
      return { status: 403, body: { error: "Only customers may create bookings" } };
    }
    const quoteToken = body.quoteToken || b.quoteToken;
    if (!quoteToken) return { status: 400, body: { error: "A current server quote is required" } };
    let quote;
    try {
      quote = verifyQuote(quoteToken, authUser.userId).values;
    } catch (err) {
      return { status: 409, body: { error: err.message } };
    }
    if (quote.gosala !== b.gosala || quote.animal !== b.animal || quote.durationMin !== Number(b.durationMin)) {
      return { status: 409, body: { error: "Booking no longer matches the quoted service" } };
    }
    if (authUser.role === "customer" && b.customer && b.customer.trim().toLowerCase() !== authUser.name.trim().toLowerCase()) {
      return { status: 403, body: { error: "Booking customer does not match authenticated account" } };
    }
    const calculated = calculateBookingPrice({
      baseRate: Number(b.base) || 0,
      durationMin: Number(b.durationMin) || 60,
      distanceKm: Number(b.distanceKm) || 0,
      addonsCost: Number(b.addons) || 0,
      discount: Number(b.discount) || 0,
      commissionPct: Number(b.commissionPct) || 20,
      freeKm: Number(b.freeKmSnapshot) || void 0,
      perKm: Number(b.perKmSnapshot) || void 0,
      extraUnitRate: Number(b.extraUnitRateSnapshot) || void 0
    });
    const moneyMatches = calculated.total === Number(b.total) && calculated.tax === Number(b.tax) && calculated.transport === Number(b.transport) && calculated.extraTime === Number(b.extraTime) && calculated.commission === Number(b.commissionSnapshot);
    if (!moneyMatches) {
      return { status: 400, body: { error: "Booking quote is stale or was modified. Recalculate before submitting." } };
    }
    let payment = body.payment || {};
    const expectedPaise = Math.round(Number(quote.total) * 100);
    const isWalletPayment = body.paymentProvider === "WALLET" || b.paymentProvider === "WALLET";
    if (isWalletPayment) {
      try {
        const debitRes = await debitWallet({
          userId: authUser.userId,
          amountPaise: expectedPaise,
          purpose: "BOOKING_PAYMENT",
          referenceId: b.id,
          idempotencyKey: `booking_pay_${b.id}`,
          description: `Devotional Seva Booking payment for ${b.id}`
        });
        payment = {
          paymentId: debitRes.transactionId,
          orderId: `wallet_ord_${b.id}`,
          signature: `wallet_sig_${debitRes.transactionId}`,
          amountPaise: expectedPaise
        };
      } catch (err) {
        return { status: 402, body: { error: err.message || "Wallet payment failed" } };
      }
    } else {
      if (!payment.paymentId || !payment.orderId || !payment.signature) {
        return { status: 402, body: { error: "Verified Razorpay payment is required before booking" } };
      }
      if (!Number.isSafeInteger(expectedPaise) || Number(payment.amountPaise) !== expectedPaise) {
        return { status: 402, body: { error: "Payment amount does not match the server quote" } };
      }
      const replayedBooking = await prisma.booking.findFirst({
        where: {
          OR: [
            { paymentId: payment.paymentId },
            { paymentOrderId: payment.orderId }
          ]
        },
        select: { id: true, customerId: true }
      });
      if (replayedBooking && replayedBooking.id !== b.id) {
        return {
          status: 409,
          body: { error: "This payment proof has already been applied to an existing booking" }
        };
      }
      try {
        await verifyCapturedPayment({
          paymentId: payment.paymentId,
          orderId: payment.orderId,
          signature: payment.signature,
          customerId: authUser.userId,
          quoteToken,
          amountPaise: expectedPaise,
          holdId: String(body.holdId || b.holdId || "")
        });
      } catch (err) {
        return { status: 402, body: { error: err.message || "Payment verification failed" } };
      }
    }
    try {
      const existingBooking = await prisma.booking.findUnique({ where: { id: b.id } });
      if (existingBooking) {
        if (existingBooking.customerId !== authUser.userId) {
          return { status: 409, body: { error: "Booking ID is already used by another customer" } };
        }
        return { status: 409, body: { error: "Booking request was already processed", booking: formatBooking(existingBooking) } };
      }
      let customer = null;
      if (authUser?.role === "customer" && authUser.userId) {
        customer = await prisma.user.findUnique({ where: { id: authUser.userId } });
      }
      if (!customer) return { status: 401, body: { error: "Authenticated customer account was not found" } };
      let gosala = await prisma.gosala.findFirst({
        where: {
          OR: [
            { name: { equals: b.gosala, mode: "insensitive" } },
            ...b.gosala ? [{ name: { contains: b.gosala, mode: "insensitive" } }] : []
          ]
        }
      });
      if (!gosala) {
        gosala = await prisma.gosala.findFirst({ where: { isActive: true } }) || await prisma.gosala.create({
          data: {
            name: b.gosala || "Vedic Gaushala",
            region: "General Regional Zone",
            address: b.address || "Gaushala Premises",
            contactPhone: "+91 98000 00000",
            contactEmail: "trust@gomaa.in",
            isActive: true
          }
        });
      }
      let animal = await prisma.animal.findFirst({
        where: {
          OR: [
            { name: { equals: b.animal, mode: "insensitive" } },
            ...b.animal ? [{ name: { contains: b.animal, mode: "insensitive" } }] : []
          ]
        }
      });
      if (!animal) {
        const animalMeta = getAnimalMeta(b.animal) || {};
        const aType = b.animalType === "Bull" ? "BULL" : b.animalType === "Calf" ? "CALF" : "COW";
        animal = await prisma.animal.create({
          data: {
            name: b.animal || "Sacred Gir Cow",
            gosalaId: gosala.id,
            type: aType,
            breed: animalMeta.breed || "Indigenous Gir",
            ageYears: animalMeta.ageYears || 5,
            healthStatus: "HEALTHY",
            price: b.base || 3500,
            isActive: true
          }
        });
      }
      const created = await prisma.$transaction(async (tx) => {
        const holdId = body.holdId || b.holdId;
        if (!holdId) throw new Error("Booking hold is required");
        const ownedHold = await tx.temporarySlotHold.findUnique({ where: { id: holdId } });
        if (!ownedHold || ownedHold.customerId !== authUser.userId || ownedHold.status !== "ACTIVE" || ownedHold.expiresAt <= /* @__PURE__ */ new Date()) {
          throw new Error("Hold is expired, consumed, or not owned by this customer");
        }
        const createdBooking = await tx.booking.create({
          data: {
            id: b.id,
            customerId: customer.id,
            customerName: b.customer || customer.name || "Devotee",
            customerPhone: b.phone || customer.phone || "+91 98000 00000",
            gosalaId: gosala.id,
            gosalaName: b.gosala,
            animalId: animal.id,
            animalName: b.animal,
            animalType: b.animalType === "Cow" ? "COW" : b.animalType === "Bull" ? "BULL" : "CALF",
            bookingDate: normalizeDateStr(b.date),
            startTime: b.start || "10:00",
            endTime: b.end || "11:00",
            durationMin: Number(b.durationMin) || 60,
            address: b.address || "Devotee Residence Altar, Hyderabad",
            distanceKm: Number(b.distanceKm) || 0,
            baseRate: b.base ?? 0,
            extraTimeFee: b.extraTime ?? 0,
            transportFee: b.transport ?? 0,
            addonsFee: b.addons ?? 0,
            taxFee: b.tax ?? 0,
            discountFee: b.discount ?? 0,
            totalAmount: b.total ?? 0,
            commissionPct: b.commissionPct ?? 20,
            commissionAmount: b.commissionSnapshot !== void 0 && b.commissionSnapshot !== null ? b.commissionSnapshot : Math.round(
              ((b.base ?? 0) + (b.extraTime ?? 0)) * (b.commissionPct ?? 20) / 100
            ),
            gosalaPayable: Math.max(
              0,
              (b.base ?? 0) + (b.extraTime ?? 0) - (b.commissionSnapshot !== void 0 && b.commissionSnapshot !== null ? b.commissionSnapshot : Math.round(
                ((b.base ?? 0) + (b.extraTime ?? 0)) * (b.commissionPct ?? 20) / 100
              ))
            ) + (b.transport ?? 0) + (b.addons ?? 0),
            status: toPrismaStatus(b.status) || "PAYMENT_VERIFIED",
            isPaid: true,
            paymentProvider: isWalletPayment ? "WALLET" : "RAZORPAY",
            paymentOrderId: payment.orderId,
            paymentId: payment.paymentId,
            walletTxId: isWalletPayment ? payment.paymentId : null,
            paymentStatus: "CAPTURED",
            paymentCapturedAt: /* @__PURE__ */ new Date(),
            handoverOtp: b.handoverOtp || String(Math.floor(1e3 + Math.random() * 9e3)),
            handoverOtpVerified: false,
            freeKmSnapshot: b.freeKmSnapshot || 5,
            perKmSnapshot: b.perKmSnapshot || 50,
            extraUnitRateSnapshot: b.extraUnitRateSnapshot || 500,
            commissionSnapshot: b.commissionSnapshot || 0
          },
          include: { driver: true, auditTrails: true }
        });
        await tx.temporarySlotHold.update({ where: { id: holdId }, data: { status: "CONSUMED", consumedAt: /* @__PURE__ */ new Date() } });
        return createdBooking;
      }, { timeout: 2e4, maxWait: 1e4 });
      try {
        await recordBookingPayment({
          id: created.id,
          gosalaId: created.gosalaId,
          gosalaName: created.gosalaName,
          customerId: created.customerId,
          totalAmount: created.totalAmount,
          taxFee: created.taxFee,
          paymentProvider: created.paymentProvider,
          paymentCapturedAt: created.paymentCapturedAt,
          createdAt: created.createdAt
        });
      } catch (settleErr) {
        console.error(`[wallet] settlement not recorded for ${created.id}:`, settleErr?.message);
      }
      const formatted = {
        ...formatBooking(created),
        customerEmail: b.customerEmail,
        aadhaarNumber: b.aadhaarNumber,
        devoteeGotra: b.devoteeGotra,
        devoteeFamilyMembers: b.devoteeFamilyMembers,
        ritualPurpose: b.ritualPurpose,
        specialInstructions: b.specialInstructions,
        devoteeSince: b.devoteeSince
      };
      wsHub.broadcastToChannel(
        `channel:gosala:${created.gosalaName}`,
        "ROLE_ALERT",
        {
          targetRole: "GOSALA_MANAGER",
          title: "New Booking for Feasibility Review",
          message: `${created.customerName} booked ${created.animalName} for ${created.bookingDate} (${created.startTime} - ${created.endTime})`,
          bookingId: created.id,
          gosalaId: created.gosalaId,
          priority: "HIGH",
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        }
      );
      wsHub.broadcastToChannel("channel:admin", "ROLE_ALERT", {
        targetRole: "OPERATIONS_ADMIN",
        title: "New Booking Created",
        message: `${created.customerName} booked ${created.animalName} at ${created.gosalaName}`,
        bookingId: created.id,
        priority: "NORMAL",
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
      wsHub.broadcastToChannel("channel:super_admin", "ROLE_ALERT", {
        targetRole: "SUPER_ADMIN",
        title: "New Gross Booking Recorded",
        message: `Booking ${created.id}: \u20B9${created.totalAmount} (Commission: \u20B9${created.commissionAmount})`,
        bookingId: created.id,
        priority: "NORMAL",
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
      wsHub.broadcastToChannel("channel:admin", "BOOKING_UPDATED", {
        booking: formatted
      });
      wsHub.broadcastToChannel("channel:super_admin", "BOOKING_UPDATED", {
        booking: formatted
      });
      wsHub.broadcastToChannel(`channel:gosala:${created.gosalaName}`, "BOOKING_UPDATED", {
        booking: formatted
      });
      const info = bookingInfo(created);
      void notifyUsers([created.customerId], messages.bookingPlaced(info));
      void notifyGosalaTeam(created.gosalaId, messages.bookingNeedsReview(info));
      return { status: 201, body: { booking: formatted } };
    } catch (err) {
      console.error("Booking creation error in PostgreSQL:", err);
      const message = String(err?.message || "");
      if (message.includes("Hold is expired") || message.includes("Booking hold is required")) {
        return { status: 409, body: { error: message } };
      }
      if (message.includes("Unique constraint") || message.includes("Unique constraint failed")) {
        return { status: 409, body: { error: "Booking request conflicts with an existing record" } };
      }
      return { status: 500, body: { error: "Booking could not be persisted; no booking was created" } };
    }
  }
  const mgrDecideMatch = pathname.match(
    /^\/api\/bookings\/([^/]+)\/(manager-decide|manager-confirm)$/
  );
  if (method === "POST" && mgrDecideMatch) {
    const denied = requireRole("manager", "admin", "super_admin");
    if (denied) return denied;
    const id = mgrDecideMatch[1];
    const confirm = body.confirm !== void 0 ? Boolean(body.confirm) : body.action === "approve" || body.action === "confirm";
    const remark = body.remark || (confirm ? "Feasibility verified." : "Capacity unavailable.");
    const managerName = body.managerName || authUser?.name || "Gaushala Manager";
    const isActingManager = Boolean(body.isActingManager) || body.callerRole === "admin" || managerName.toLowerCase().includes("acting");
    const callerRole = body.callerRole || (isActingManager ? "admin" : "manager");
    const callerGosala = body.callerGosala;
    try {
      const existingBooking = await prisma.booking.findUnique({ where: { id } });
      if (!existingBooking) {
        throw new Error("Booking not found in database, check in-memory fallback");
      }
      if (callerRole === "manager" && callerGosala && existingBooking.gosalaName) {
        const matches = existingBooking.gosalaName.toLowerCase().includes(callerGosala.toLowerCase()) || callerGosala.toLowerCase().includes(existingBooking.gosalaName.toLowerCase());
        if (!matches) {
          return {
            status: 403,
            body: {
              error: `Forbidden: Manager assigned to ${callerGosala} cannot review bookings for ${existingBooking.gosalaName}`
            }
          };
        }
      }
      let manager = await prisma.user.findFirst({
        where: { name: managerName }
      });
      if (!manager) {
        manager = await prisma.user.findFirst({
          where: { role: isActingManager ? "OPERATIONS_ADMIN" : "GOSALA_MANAGER" }
        });
      }
      if (!manager) {
        manager = await prisma.user.create({
          data: {
            name: managerName,
            email: `${managerName.toLowerCase().replace(/\s+/g, ".")}@gomaa.in`,
            phone: "+91 98200 00000",
            role: isActingManager ? "OPERATIONS_ADMIN" : "GOSALA_MANAGER"
          }
        });
      }
      const updated = await prisma.booking.update({
        where: { id },
        data: {
          status: confirm ? "ADMIN_REVIEW" : "REJECTED",
          managerRemark: remark
        },
        include: { driver: true, auditTrails: true }
      });
      const actorRole = isActingManager ? "OPERATIONS_ADMIN" : "GOSALA_MANAGER";
      const actorId = manager.id;
      await prisma.approvalAuditTrail.create({
        data: {
          bookingId: id,
          actorId,
          actorRole,
          actorName: managerName,
          action: confirm ? "MANAGER_CONFIRMED" : "MANAGER_REJECTED",
          remark: isActingManager ? `[Admin Acting as Manager] ${remark}` : remark
        }
      });
      const refreshed = await prisma.booking.findUnique({
        where: { id },
        include: { driver: true, auditTrails: true }
      });
      const formatted = formatBooking(refreshed || updated);
      if (formatted.managerApproval) {
        formatted.managerApproval.isActingManager = isActingManager;
      }
      wsHub.broadcastToChannel("channel:admin", "ROLE_ALERT", {
        targetRole: "OPERATIONS_ADMIN",
        title: confirm ? isActingManager ? "Admin Approved Feasibility as Acting Manager" : "Manager Confirmed Feasibility" : "Feasibility Review Rejected",
        message: `${id}: ${managerName} verified ${updated.animalName} \xB7 Ready for Admin confirmation`,
        bookingId: id,
        priority: confirm ? "HIGH" : "NORMAL",
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
      wsHub.broadcastToChannel(`channel:booking:${id}`, "BOOKING_UPDATED", {
        booking: formatted
      });
      const info = bookingInfo(updated);
      void notifyGosalaTeam(updated.gosalaId, messages.bookingManagerDecided(info, confirm, remark));
      if (!confirm) void notifyUsers([updated.customerId], messages.bookingRejected(info, remark));
      return { status: 200, body: { booking: formatted } };
    } catch (e) {
      console.error("[manager-decide] DB error:", e?.message);
      return { status: 500, body: { error: e?.message || "Failed to update booking review" } };
    }
  }
  const admDecideMatch = pathname.match(
    /^\/api\/bookings\/([^/]+)\/(admin-decide|admin-confirm)$/
  );
  if (method === "POST" && admDecideMatch) {
    const denied = requireRole("admin", "super_admin");
    if (denied) return denied;
    const id = admDecideMatch[1];
    const confirm = body.confirm !== void 0 ? Boolean(body.confirm) : body.action !== "reject";
    const remark = body.remark || (confirm ? "Final admin approval granted." : "Rejected by operations admin.");
    const adminName = body.adminName || authUser?.name || "Operations Admin";
    let currentStatus = "";
    try {
      const existing = await prisma.booking.findUnique({ where: { id } });
      if (existing) currentStatus = existing.status;
    } catch {
    }
    const isPaymentVerified = currentStatus === "PAYMENT_VERIFIED" || currentStatus === "Payment Verified";
    const effectiveActAsManager = Boolean(body.actAsManager || isPaymentVerified && confirm);
    try {
      let adminUser = await prisma.user.findFirst({
        where: { name: adminName }
      });
      if (!adminUser) {
        adminUser = await prisma.user.findFirst({
          where: { role: "OPERATIONS_ADMIN" }
        });
      }
      if (!adminUser) {
        adminUser = await prisma.user.create({
          data: {
            name: adminName,
            email: `${adminName.toLowerCase().replace(/\s+/g, ".")}@gomaa.in`,
            phone: "+91 98200 11111",
            role: "OPERATIONS_ADMIN"
          }
        });
      }
      let driver = null;
      if (body.driverName || body.driver) {
        const dName = body.driverName || body.driver;
        driver = await prisma.user.findFirst({ where: { name: dName } });
      }
      if (isPaymentVerified && effectiveActAsManager) {
        await prisma.approvalAuditTrail.create({
          data: {
            bookingId: id,
            actorId: adminUser.id,
            actorRole: "OPERATIONS_ADMIN",
            actorName: `${adminName} (Acting Manager)`,
            action: "MANAGER_CONFIRMED",
            remark: "Feasibility confirmed by Admin as Acting Manager"
          }
        });
      }
      const updated = await prisma.booking.update({
        where: { id },
        data: {
          status: confirm ? "CONFIRMED" : "REJECTED",
          adminRemark: remark,
          ...driver ? { driverId: driver.id, driverStage: 1 } : {}
        },
        include: { driver: true, auditTrails: true }
      });
      if (adminUser) {
        await prisma.approvalAuditTrail.create({
          data: {
            bookingId: id,
            actorId: adminUser.id,
            actorRole: "OPERATIONS_ADMIN",
            actorName: adminUser.name,
            action: confirm ? "ADMIN_CONFIRMED" : "ADMIN_REJECTED",
            remark
          }
        });
      }
      const refreshed = await prisma.booking.findUnique({
        where: { id },
        include: { driver: true, auditTrails: true }
      });
      const formatted = formatBooking(refreshed || updated);
      wsHub.broadcastToChannel(`channel:booking:${id}`, "BOOKING_UPDATED", {
        booking: formatted
      });
      wsHub.broadcastToChannel("channel:admin", "ROLE_ALERT", {
        targetRole: "OPERATIONS_ADMIN",
        title: confirm ? "Booking Confirmed by Admin" : "Booking Rejected by Admin",
        message: `Booking ${id} is now CONFIRMED. Ready for driver dispatch.`,
        bookingId: id,
        priority: "NORMAL",
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
      const info = bookingInfo(updated);
      void notifyUsers(
        [updated.customerId],
        confirm ? messages.bookingConfirmed(info) : messages.bookingRejected(info, remark)
      );
      return { status: 200, body: { booking: formatted } };
    } catch (e) {
      console.error("[admin-decide] DB error:", e?.message);
      return { status: 500, body: { error: e?.message || "Failed to update booking approval" } };
    }
  }
  const assignDriverMatch = pathname.match(
    /^\/api\/bookings\/([^/]+)\/assign-driver$/
  );
  if (method === "POST" && assignDriverMatch) {
    const denied = requireRole("admin", "super_admin");
    if (denied) return denied;
    const id = assignDriverMatch[1];
    const driverName = body.driver || body.driverName;
    const driverPhone = body.driverPhone;
    const driverId = body.driverId;
    try {
      const driver = await prisma.user.findFirst({
        where: {
          OR: [
            ...driverId ? [{ id: driverId }] : [],
            ...driverName ? [{ name: { equals: driverName, mode: "insensitive" } }] : [],
            ...driverPhone ? [{ phone: { equals: driverPhone, mode: "insensitive" } }] : []
          ]
        }
      });
      const updated = await prisma.booking.update({
        where: { id },
        data: {
          driverId: driver?.id || null,
          driverStage: 1,
          status: "CONFIRMED",
          driverPhone: body.driverPhone || driver?.phone || "+91 98490 23456",
          driverVehiclePlate: body.driverVehiclePlate || "TS 09 EA 4402",
          driverVehicleModel: body.driverVehicleModel || "Force Traveller Cattle Ambulance",
          driverRating: body.driverRating ?? 4.9,
          driverTotalTrips: body.driverTotalTrips ?? 184,
          driverAvatar: body.driverAvatar || null
        },
        include: { driver: true, auditTrails: true }
      });
      const formatted = formatBooking(updated);
      wsHub.broadcastToChannel(`channel:booking:${id}`, "BOOKING_UPDATED", {
        booking: formatted
      });
      if (driver) {
        wsHub.broadcastToChannel(`channel:driver:${driver.name}`, "ROLE_ALERT", {
          targetRole: "DRIVER",
          title: "New Trip Assigned!",
          message: `You are assigned to trip ${id} for ${updated.customerName} at ${updated.gosalaName}`,
          bookingId: id,
          priority: "HIGH",
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
      return { status: 200, body: { booking: formatted } };
    } catch (e) {
      console.error("[assign-driver] DB error:", e?.message);
      return { status: 500, body: { error: e?.message || "Failed to assign driver" } };
    }
  }
  const advanceStageMatch = pathname.match(
    /^\/api\/bookings\/([^/]+)\/advance-stage$/
  );
  if (method === "POST" && advanceStageMatch) {
    const denied = requireRole("driver", "admin", "super_admin");
    if (denied) return denied;
    const id = advanceStageMatch[1];
    try {
      const b = await prisma.booking.findUnique({ where: { id } });
      if (!b) return { status: 404, body: { error: "Booking not found" } };
      if (b.driverStage === 5 && !b.handoverOtpVerified) {
        return {
          status: 403,
          body: {
            error: "Handover OTP Verification required before starting ceremony service at devotee altar."
          }
        };
      }
      const stage = Math.min(b.driverStage + 1, 9);
      const status = stage >= 9 ? "COMPLETED" : stage >= 6 ? "IN_SERVICE" : b.status;
      const updated = await prisma.booking.update({
        where: { id },
        data: {
          driverStage: stage,
          status
        },
        include: { driver: true, auditTrails: true }
      });
      const formatted = formatBooking(updated);
      wsHub.broadcastToChannel(`channel:booking:${id}`, "STAGE_CHANGED", {
        bookingId: id,
        stage,
        status: toFrontendStatus(status)
      });
      wsHub.broadcastToChannel(`channel:booking:${id}`, "BOOKING_UPDATED", {
        booking: formatted
      });
      return { status: 200, body: { booking: formatted } };
    } catch (e) {
      console.error("[advance-stage] DB error:", e?.message);
      return { status: 500, body: { error: e?.message || "Failed to advance stage" } };
    }
  }
  const setStageMatch = pathname.match(
    /^\/api\/bookings\/([^/]+)\/(set-stage|driver-stage)$/
  );
  if (method === "POST" && setStageMatch) {
    const denied = requireRole("driver", "admin", "super_admin");
    if (denied) return denied;
    const id = setStageMatch[1];
    const targetStage = typeof body.stage === "number" ? body.stage : 4;
    const b = await prisma.booking.findUnique({ where: { id } });
    if (!b) return { status: 404, body: { error: "Booking not found" } };
    const status = targetStage >= 9 ? "COMPLETED" : targetStage >= 4 ? "IN_SERVICE" : "CONFIRMED";
    const updated = await prisma.booking.update({
      where: { id },
      data: {
        driverStage: targetStage,
        status
      },
      include: { driver: true, auditTrails: true }
    });
    const formatted = formatBooking(updated);
    wsHub.broadcastToChannel(`channel:booking:${id}`, "STAGE_CHANGED", {
      bookingId: id,
      stage: targetStage,
      status: toFrontendStatus(status)
    });
    wsHub.broadcastToChannel(`channel:booking:${id}`, "BOOKING_UPDATED", {
      booking: formatted
    });
    return { status: 200, body: { booking: formatted } };
  }
  const verifyOtpMatch = pathname.match(/^\/api\/bookings\/([^/]+)\/verify-handover-otp$/);
  if (method === "POST" && verifyOtpMatch) {
    const denied = requireRole("driver", "admin", "super_admin");
    if (denied) return denied;
    const id = verifyOtpMatch[1];
    const submittedOtp = String(body.otp || "").trim();
    let booking = null;
    try {
      booking = await prisma.booking.findUnique({
        where: { id },
        include: { driver: true, auditTrails: true }
      });
    } catch {
      booking = null;
    }
    if (!booking) {
      return { status: 404, body: { success: false, error: "Booking not found" } };
    }
    const expectedOtp = String(booking.handoverOtp || "4819").trim();
    if (submittedOtp !== expectedOtp) {
      return {
        status: 400,
        body: {
          success: false,
          error: "Invalid Handover OTP. Please ask the devotee for the 4-digit code shown on their screen."
        }
      };
    }
    const verifiedAt = /* @__PURE__ */ new Date();
    try {
      const updated = await prisma.booking.update({
        where: { id },
        data: {
          handoverOtpVerified: true,
          handoverOtpVerifiedAt: verifiedAt,
          driverStage: 6,
          // Advance to Stage 6: Service Started / At Altar
          status: "IN_SERVICE",
          auditTrails: {
            create: {
              actorRole: "DRIVER",
              actorName: booking.driver?.name || "Assigned Gosevak",
              actorId: booking.driverId || "DRV-102",
              action: "HANDOVER_VERIFIED",
              remark: `Customer Handover OTP verified (${submittedOtp}). Sacred Bovine received by devotee at ${verifiedAt.toLocaleTimeString("en-IN")}.`
            }
          }
        },
        include: { driver: true, auditTrails: true }
      });
      const formatted = formatBooking(updated);
      wsHub.broadcastToChannel(`channel:booking:${id}`, "HANDOVER_VERIFIED", {
        bookingId: id,
        stage: 6,
        status: "In Service",
        verifiedAt: verifiedAt.toISOString()
      });
      wsHub.broadcastToChannel(`channel:booking:${id}`, "STAGE_CHANGED", {
        bookingId: id,
        stage: 6,
        status: "In Service"
      });
      wsHub.broadcastToChannel(`channel:booking:${id}`, "BOOKING_UPDATED", {
        booking: formatted
      });
      return {
        status: 200,
        body: {
          success: true,
          message: "Animal handover verified successfully! Ceremony started.",
          booking: formatted
        }
      };
    } catch (err) {
      console.error("[verify-handover-otp] DB error:", err?.message);
      return { status: 500, body: { success: false, error: err?.message || "Failed to verify OTP" } };
    }
  }
  const telemetryMatch = pathname.match(/^\/api\/bookings\/([^/]+)\/telemetry$/);
  if (method === "POST" && telemetryMatch) {
    const denied = requireRole("driver", "admin", "super_admin");
    if (denied) return denied;
    const id = telemetryMatch[1];
    const tick = {
      bookingId: id,
      lat: body.lat,
      lng: body.lng,
      bearing: body.bearing || 0,
      speedKmh: body.speedKmh || 0,
      etaMinutes: body.etaMinutes || 0,
      distanceRemainingKm: body.distanceRemainingKm || 0,
      stage: body.stage || 4,
      stageLabel: body.stageLabel || "Live Driver Phone GPS",
      timestamp: Date.now()
    };
    driverLiveLocations.set(id, {
      ...tick,
      lastUpdated: (/* @__PURE__ */ new Date()).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      })
    });
    wsHub.broadcastToChannel(`channel:booking:${id}`, "GPS_TICK", tick);
    return { status: 200, body: { ok: true, tick } };
  }
  const driverLocMatch = pathname.match(
    /^\/api\/bookings\/([^/]+)\/driver-location$/
  );
  if (method === "GET" && driverLocMatch) {
    const id = driverLocMatch[1];
    if (!authUser || !canUseLiveTracking(authUser)) {
      return { status: 403, body: { error: "Live tracking is not enabled for this role" } };
    }
    const accessBooking = await prisma.booking.findUnique({ where: { id } });
    if (!accessBooking) return { status: 404, body: { error: "Booking not found" } };
    if (!canAccessBooking(authUser, accessBooking)) {
      return { status: 403, body: { error: "You are not authorized to track this booking" } };
    }
    const live = driverLiveLocations.get(id);
    if (live) {
      return { status: 200, body: { ok: true, location: live } };
    }
    const b = accessBooking;
    if (!b) return { status: 404, body: { error: "Booking not found" } };
    const gosalaCoords = {
      "Shri Krishna Gaushala": [18.5074, 73.8077],
      "Nandini Goseva Sadan": [18.559, 73.7868],
      "Gopal Gaushala Trust": [18.5482, 73.9034],
      "Vrindavan Goshala": [18.4967, 73.9417],
      "Kamdhenu Seva Kendra": [18.5987, 73.7628]
    };
    const origin = gosalaCoords[b.gosalaName] || [18.5074, 73.8077];
    const dest = [origin[0] + 0.035, origin[1] + 0.045];
    const stage = b.driverStage;
    const isEnRoute = stage >= 4 && stage < 7;
    const pos = stage >= 5 ? dest : isEnRoute ? [(origin[0] + dest[0]) / 2, (origin[1] + dest[1]) / 2] : origin;
    const distRemaining = isEnRoute ? Math.round(b.distanceKm * 0.4 * 10) / 10 : stage >= 5 ? 0 : b.distanceKm;
    const fallbackLoc = {
      bookingId: id,
      lat: pos[0],
      lng: pos[1],
      bearing: isEnRoute ? 45 : 0,
      speedKmh: isEnRoute ? 32 : 0,
      etaMinutes: isEnRoute ? Math.max(1, Math.round(distRemaining / 32 * 60)) : 0,
      distanceRemainingKm: distRemaining,
      stage,
      stageLabel: stage >= 7 ? "Completed" : stage >= 5 ? "Arrived" : isEnRoute ? "En Route" : "Preparing",
      lastUpdated: (/* @__PURE__ */ new Date()).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      }),
      timestamp: Date.now()
    };
    return { status: 200, body: { ok: true, location: fallbackLoc } };
  }
  const customerDetailsMatch = pathname.match(
    /^\/api\/bookings\/([^/]+)\/customer-details$/
  );
  if (method === "GET" && customerDetailsMatch) {
    const id = customerDetailsMatch[1];
    let b = null;
    try {
      b = await prisma.booking.findUnique({
        where: { id },
        include: {
          customer: true,
          gosala: true,
          animal: true,
          driver: true,
          auditTrails: true
        }
      });
    } catch {
      b = null;
    }
    if (!b) return { status: 404, body: { error: "Booking not found" } };
    if (!authUser || !canAccessBooking(authUser, b)) {
      return { status: 403, body: { error: "You are not authorized to view this customer data" } };
    }
    let totalBookings = 1;
    try {
      if (b.customerId) {
        totalBookings = await prisma.booking.count({
          where: { customerId: b.customerId }
        });
      }
    } catch {
    }
    const dossier = {
      bookingId: b.id,
      customer: {
        id: b.customer?.id || b.customerId || "CUST-101",
        name: b.customerName || b.customer,
        phone: b.customerPhone || b.phone,
        email: b.customerEmail || b.customer?.email || `${(b.customerName || b.customer || "devotee").toLowerCase().replace(/\s+/g, ".")}@gmail.com`,
        memberSince: b.devoteeSince || (b.customer?.createdAt ? new Date(b.customer.createdAt).toLocaleDateString("en-IN", {
          month: "short",
          year: "numeric"
        }) : "Aug 2024"),
        idType: "Aadhaar / National ID Card",
        idNumber: b.aadhaarNumber || "XXXX-XXXX-4912",
        idStatus: "Verified Devotee",
        totalBookingsCount: Math.max(1, totalBookings || 4),
        gotra: b.devoteeGotra || "Kashyapa",
        familyMembers: b.devoteeFamilyMembers || "Ananya (Self), Rajesh (Husband)"
      },
      ceremony: {
        ritualPurpose: b.ritualPurpose || "Griha Pravesh & Kamadhenu Puja",
        animal: b.animalName || b.animal,
        animalType: b.animalType === "COW" || b.animalType === "Cow" ? "Cow" : b.animalType === "BULL" || b.animalType === "Bull" ? "Bull" : "Calf",
        gosala: b.gosalaName || b.gosala,
        date: normalizeDateStr(b.bookingDate || b.date),
        timeSlot: `${b.startTime || b.start} - ${b.endTime || b.end}`,
        durationMin: b.durationMin,
        serviceAddress: b.address,
        distanceKm: b.distanceKm,
        specialInstructions: b.specialInstructions || "Ground-floor portico ready, clean water bucket and sacred green grass feeding protocol."
      },
      payment: {
        totalPaid: b.totalAmount ?? b.total ?? 0,
        baseRate: b.baseRate ?? b.base ?? 0,
        extraTime: b.extraTimeFee ?? b.extraTime ?? 0,
        transport: b.transportFee ?? b.transport ?? 0,
        addons: b.addonsFee ?? b.addons ?? 0,
        tax: b.taxFee ?? b.tax ?? 0,
        isPaid: b.isPaid ?? b.paid ?? true,
        paymentMethod: "UPI Online (Secured in Escrow)",
        transactionRef: `UPI-TXN-${b.id.replace("-", "")}`
      },
      logistics: {
        driver: b.driver?.name || b.driver || null,
        driverStage: b.driverStage ?? 0,
        status: toFrontendStatus(b.status)
      }
    };
    return { status: 200, body: { ok: true, details: dossier } };
  }
  if (method === "GET" && pathname === "/api/managers") {
    try {
      let managerUsers = await prisma.user.findMany({
        where: { role: "GOSALA_MANAGER" },
        include: {
          managerAssignments: {
            include: {
              gosala: {
                include: { animals: true }
              }
            }
          }
        },
        orderBy: { createdAt: "desc" }
      });
      if (authUser?.role === "manager") {
        managerUsers = managerUsers.filter(
          (u) => u.id === authUser.userId || u.email?.toLowerCase() === authUser.email?.toLowerCase()
        );
      } else if (authUser?.role === "admin") {
        const adminEmail = (authUser.email || "").toLowerCase();
        const adminName = (authUser.name || "").toLowerCase();
        const adminId = authUser.userId || "";
        const allGosalas = await prisma.gosala.findMany({ where: { isActive: true } });
        const myGosalaIds = allGosalas.filter((g) => {
          const meta = getGosalaMeta(g.id, g.name);
          const gEmail = (g.adminEmail || meta.governingAdminEmail || meta.adminEmail || "").toLowerCase();
          const gName = (g.adminName || meta.governingAdminName || meta.adminName || "").toLowerCase();
          const idMatch = Boolean(adminId && (g.adminId === adminId || meta.adminId === adminId));
          const emailMatch = Boolean(adminEmail && (gEmail === adminEmail || gEmail.includes(adminEmail)));
          const nameMatch = Boolean(adminName && (gName === adminName || gName.includes(adminName)));
          return idMatch || emailMatch || nameMatch;
        }).map((g) => g.id);
        managerUsers = managerUsers.filter((u) => {
          if (!u.managerAssignments || u.managerAssignments.length === 0) return true;
          return u.managerAssignments.some((ma) => myGosalaIds.includes(ma.gosalaId));
        });
      } else if (authUser?.role === "super_admin") {
        const portfolioFilter = query.get("portfolio") || query.get("admin");
        if (portfolioFilter && portfolioFilter !== "All" && portfolioFilter !== "all") {
          const filterLower = portfolioFilter.toLowerCase();
          managerUsers = managerUsers.filter((u) => {
            if (!u.managerAssignments || u.managerAssignments.length === 0) return true;
            return u.managerAssignments.some((ma) => {
              const meta = getGosalaMeta(ma.gosalaId || "", ma.gosala?.name || "");
              const govName = (ma.gosala?.adminName || meta.governingAdminName || meta.adminName || "").toLowerCase();
              const govEmail = (ma.gosala?.adminEmail || meta.governingAdminEmail || "").toLowerCase();
              const govId = ma.gosala?.adminId || meta.adminId || "";
              return govName.includes(filterLower) || govEmail.includes(filterLower) || govId === portfolioFilter;
            });
          });
        }
      }
      return {
        status: 200,
        body: { managers: managerUsers.map(formatManagerUser) }
      };
    } catch (err) {
      console.warn("Error fetching managers:", err?.message);
      return { status: 200, body: { managers: [] } };
    }
  }
  if (method === "POST" && pathname === "/api/managers") {
    try {
      const email = (body.email || `manager_${Date.now()}@gomaa.in`).trim().toLowerCase();
      const cleanName = (body.name || "Gaushala Manager").trim();
      const cleanPhone = (body.phone || "+91 98000 00000").trim();
      let user = await prisma.user.findFirst({
        where: {
          OR: [
            { email: { equals: email, mode: "insensitive" } },
            ...body.id ? [{ id: body.id }] : []
          ]
        }
      });
      const rawPassword = typeof body.password === "string" ? body.password.trim() : "";
      const securePassword = rawPassword ? isPasswordHash(rawPassword) ? rawPassword : hashPassword(rawPassword) : void 0;
      if (!user) {
        user = await prisma.user.create({
          data: {
            name: cleanName,
            email,
            phone: cleanPhone,
            role: "GOSALA_MANAGER",
            isActive: body.status !== "Inactive",
            password: securePassword
          }
        });
      } else {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            name: cleanName,
            phone: cleanPhone,
            role: "GOSALA_MANAGER",
            isActive: body.status !== "Inactive",
            ...securePassword ? { password: securePassword } : {}
          }
        });
      }
      if (body.password) {
        setUserMeta(user.email, { password: body.password });
        inMemoryPasswords.set(user.email.toLowerCase(), body.password);
        inMemoryPasswords.set(user.id, body.password);
      }
      const rawGosalas = Array.isArray(body.gosalas) ? body.gosalas : body.gosala ? [body.gosala] : [];
      for (const gNameOrId of rawGosalas) {
        if (!gNameOrId || gNameOrId === "Unassigned") continue;
        const targetGosala = await prisma.gosala.findFirst({
          where: {
            OR: [{ id: gNameOrId }, { name: gNameOrId }]
          }
        });
        if (!targetGosala) {
          if (authUser?.role === "admin") {
            return {
              status: 403,
              body: {
                ok: false,
                error: `Forbidden: Gaushala "${gNameOrId}" is outside your operational portfolio`
              }
            };
          }
          continue;
        }
        if (targetGosala) {
          if (authUser?.role === "admin") {
            const adminEmail = (authUser.email || "").toLowerCase();
            const adminName = (authUser.name || "").toLowerCase();
            const adminId = authUser.userId || "";
            const isMyGosala = targetGosala.adminId === adminId || targetGosala.adminEmail && targetGosala.adminEmail.toLowerCase() === adminEmail || targetGosala.adminName && targetGosala.adminName.toLowerCase().includes(adminName);
            if (!isMyGosala) {
              return {
                status: 403,
                body: { ok: false, error: `Forbidden: You cannot assign managers to ${targetGosala.name} outside your operational portfolio` }
              };
            }
          }
          await prisma.gosalaManagerAssignment.deleteMany({
            where: {
              gosalaId: targetGosala.id,
              NOT: { userId: user.id }
            }
          });
          await prisma.gosalaManagerAssignment.upsert({
            where: {
              userId_gosalaId: {
                userId: user.id,
                gosalaId: targetGosala.id
              }
            },
            create: {
              userId: user.id,
              gosalaId: targetGosala.id,
              region: body.region || targetGosala.region,
              status: "Active"
            },
            update: {
              status: "Active"
            }
          });
          saveGosalaMeta(targetGosala.id, targetGosala.name, {
            managerId: user.id.startsWith("MGR-") ? user.id : `MGR-${user.id.slice(0, 4)}`,
            managerName: user.name,
            caretaker: user.name,
            isActingManager: false,
            actAsManagerMyself: false
          });
        }
      }
      const updatedUser = await prisma.user.findUnique({
        where: { id: user.id },
        include: {
          managerAssignments: {
            include: {
              gosala: {
                include: { animals: true }
              }
            }
          }
        }
      });
      return { status: 201, body: { manager: formatManagerUser(updatedUser) } };
    } catch (err) {
      console.error("Error creating manager in DB:", err);
      return { status: 500, body: { error: err.message || "Failed to create manager" } };
    }
  }
  const putMgrMatch = pathname.match(/^\/api\/managers\/([^/]+)$/);
  if (method === "PUT" && putMgrMatch) {
    const id = putMgrMatch[1];
    const cleanId = id.startsWith("MGR-") ? id.replace(/^MGR-/, "") : id;
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { id },
          { id: cleanId },
          { id: { startsWith: cleanId } },
          { email: id },
          { name: id }
        ]
      }
    });
    if (!user) return { status: 404, body: { error: "Manager user not found" } };
    await prisma.user.update({
      where: { id: user.id },
      data: {
        name: body.name || user.name,
        email: body.email || user.email,
        phone: body.phone || user.phone,
        isActive: body.isActive !== void 0 ? Boolean(body.isActive) : user.isActive
      }
    });
    if (body.password) {
      const raw = typeof body.password === "string" ? body.password.trim() : "";
      const hashed = raw ? isPasswordHash(raw) ? raw : hashPassword(raw) : void 0;
      setUserMeta(user.email, { password: raw });
      setUserMeta(user.id, { password: raw });
      inMemoryPasswords.set(user.email.toLowerCase(), raw);
      inMemoryPasswords.set(user.id, raw);
      try {
        if (hashed) {
          await prisma.user.update({
            where: { id: user.id },
            data: { password: hashed }
          });
        }
      } catch {
      }
    }
    if (body.gosalas !== void 0 || body.gosala !== void 0) {
      const targetGosalas = Array.isArray(body.gosalas) ? body.gosalas : body.gosala ? [body.gosala] : [];
      await prisma.gosalaManagerAssignment.deleteMany({
        where: { userId: user.id }
      });
      try {
        const allActiveGosalas = await prisma.gosala.findMany({ where: { isActive: true } });
        const uId = user.id;
        const uCleanId = uId.startsWith("MGR-") ? uId.replace(/^MGR-/, "") : uId;
        for (const g of allActiveGosalas) {
          const meta = getGosalaMeta(g.id, g.name);
          const isMgr = meta.managerId === uId || meta.managerId === `MGR-${uCleanId.slice(0, 4)}` || meta.managerId === uCleanId;
          if (isMgr) {
            const isRetained = targetGosalas.some((tg) => tg === g.id || tg.toLowerCase() === g.name.toLowerCase());
            if (!isRetained) {
              saveGosalaMeta(g.id, g.name, {
                managerId: "",
                managerName: "None (Admin Custody)",
                caretaker: "None (Admin Custody)",
                isActingManager: true,
                actAsManagerMyself: true
              });
            }
          }
        }
      } catch {
      }
      for (const gNameOrId of targetGosalas) {
        if (!gNameOrId || gNameOrId === "Unassigned") continue;
        const targetGosala = await prisma.gosala.findFirst({
          where: {
            OR: [{ id: gNameOrId }, { name: gNameOrId }]
          }
        });
        if (!targetGosala) {
          if (authUser?.role === "admin") {
            return {
              status: 403,
              body: {
                ok: false,
                error: `Forbidden: Gaushala "${gNameOrId}" is outside your operational portfolio`
              }
            };
          }
          continue;
        }
        if (targetGosala) {
          await prisma.gosalaManagerAssignment.deleteMany({
            where: {
              gosalaId: targetGosala.id,
              NOT: { userId: user.id }
            }
          });
          await prisma.gosalaManagerAssignment.create({
            data: {
              userId: user.id,
              gosalaId: targetGosala.id,
              region: body.region || targetGosala.region,
              status: "Active"
            }
          });
          saveGosalaMeta(targetGosala.id, targetGosala.name, {
            managerId: user.id.startsWith("MGR-") ? user.id : `MGR-${user.id.slice(0, 4)}`,
            managerName: user.name,
            caretaker: user.name,
            isActingManager: false,
            actAsManagerMyself: false
          });
        }
      }
    }
    const updatedUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        managerAssignments: {
          include: {
            gosala: {
              include: { animals: true }
            }
          }
        }
      }
    });
    return { status: 200, body: { ok: true, manager: formatManagerUser(updatedUser) } };
  }
  const toggleMgrMatch = pathname.match(/^\/api\/managers\/([^/]+)\/toggle$/);
  if (method === "PATCH" && toggleMgrMatch) {
    const id = toggleMgrMatch[1];
    const cleanId = id.startsWith("MGR-") ? id.replace(/^MGR-/, "") : id;
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { id },
          { id: cleanId },
          { id: { startsWith: cleanId } },
          { email: id },
          { name: id }
        ]
      },
      include: {
        managerAssignments: {
          include: {
            gosala: {
              include: { animals: true }
            }
          }
        }
      }
    });
    if (!user)
      return { status: 404, body: { error: "Manager assignment not found" } };
    const nextActive = !user.isActive;
    await prisma.user.update({
      where: { id: user.id },
      data: { isActive: nextActive }
    });
    await prisma.gosalaManagerAssignment.updateMany({
      where: { userId: user.id },
      data: { status: nextActive ? "Active" : "Inactive" }
    });
    const updatedUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        managerAssignments: {
          include: {
            gosala: {
              include: { animals: true }
            }
          }
        }
      }
    });
    return { status: 200, body: { manager: formatManagerUser(updatedUser) } };
  }
  const delMgrMatch = pathname.match(/^\/api\/managers\/([^/]+)$/);
  if (method === "DELETE" && delMgrMatch) {
    try {
      const rawParam = delMgrMatch[1];
      const id = decodeURIComponent(rawParam).trim();
      const cleanId = id.startsWith("MGR-") ? id.replace(/^MGR-/, "") : id;
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { id },
            { id: cleanId },
            { id: { startsWith: cleanId } },
            { email: { equals: id, mode: "insensitive" } },
            { name: { equals: id, mode: "insensitive" } }
          ]
        }
      });
      if (user) {
        await prisma.gosalaManagerAssignment.deleteMany({
          where: { userId: user.id }
        });
        try {
          const allGosalas = await prisma.gosala.findMany({ select: { id: true, name: true, metadata: true } });
          for (const g of allGosalas) {
            const meta = getGosalaMeta(g.id, g.name);
            const matchId = meta.managerId && (meta.managerId === user.id || meta.managerId === cleanId || user.id.includes(meta.managerId));
            const matchName = meta.managerName && (meta.managerName.toLowerCase() === user.name.toLowerCase() || meta.managerName.toLowerCase().includes(user.name.toLowerCase()));
            if (matchId || matchName) {
              saveGosalaMeta(g.id, g.name, {
                managerId: void 0,
                managerName: "None (Admin Custody)",
                isActingManager: true
              });
              try {
                const currentMeta = g.metadata && typeof g.metadata === "object" ? { ...g.metadata } : {};
                delete currentMeta.managerId;
                currentMeta.managerName = "None (Admin Custody)";
                currentMeta.isActingManager = true;
                await prisma.gosala.update({
                  where: { id: g.id },
                  data: { metadata: currentMeta }
                });
              } catch {
              }
            }
          }
        } catch {
        }
        try {
          await prisma.approvalAuditTrail.deleteMany({ where: { actorId: user.id } });
        } catch {
        }
        try {
          await prisma.temporarySlotHold.deleteMany({ where: { createdBy: user.id } });
        } catch {
        }
        try {
          await prisma.animalScheduleBlock.deleteMany({ where: { createdBy: user.id } });
        } catch {
        }
        try {
          await prisma.user.delete({
            where: { id: user.id }
          });
        } catch (delErr) {
          console.warn("[DELETE /api/managers] Foreign constraint fallback to deactivate:", delErr?.message);
          await prisma.user.update({
            where: { id: user.id },
            data: { isActive: false, role: "CUSTOMER" }
          });
        }
      }
      return { status: 200, body: { success: true } };
    } catch (err) {
      console.error("[DELETE /api/managers/:id] Error deleting manager:", err?.message);
      return { status: 500, body: { error: err?.message || "Failed to delete manager" } };
    }
  }
  if (method === "GET" && pathname === "/api/pricing-config") {
    try {
      let cfg = await prisma.masterPricingConfig.findFirst();
      if (!cfg) {
        cfg = await prisma.masterPricingConfig.create({
          data: {
            id: 1,
            standardMin: 60,
            extraUnitMin: 30,
            extraUnitRate: 500,
            freeKm: 5,
            perKm: 50,
            taxPct: 12,
            commissionPct: 20,
            maxDurationMin: 240,
            bufferMin: 30,
            rounding: "Nearest \u20B910",
            updatedByRole: "SUPER_ADMIN",
            updatedByName: "Super Admin"
          }
        });
      }
      return { status: 200, body: { config: cfg } };
    } catch (err) {
      console.warn("[GET /api/pricing-config] DB fallback notice:", err?.message);
      return {
        status: 200,
        body: {
          config: {
            id: 1,
            standardMin: 60,
            extraUnitMin: 30,
            extraUnitRate: 500,
            freeKm: 5,
            perKm: 50,
            taxPct: 12,
            commissionPct: 20,
            maxDurationMin: 240,
            bufferMin: 30,
            rounding: "Nearest \u20B910",
            samagriGaushalaCutPct: 90,
            transportPassThroughPct: 100,
            autoSweepEnabled: true,
            disbursementCycle: "CONTINUOUS_T_PLUS_ONE",
            autoSweepHour: 23,
            autoSweepMinute: 59,
            updatedByRole: "SUPER_ADMIN",
            updatedByName: "Super Admin"
          }
        }
      };
    }
  }
  if ((method === "PUT" || method === "PATCH") && (pathname === "/api/pricing-config" || pathname === "/api/pricing/config")) {
    const callerRole = body.role || body.callerRole;
    if (callerRole && callerRole.toLowerCase() !== "super_admin" && callerRole !== "SUPER_ADMIN") {
      return {
        status: 403,
        body: {
          error: "Unauthorized: Super Admin is the sole authority for platform pricing and commission rules."
        }
      };
    }
    const patch = body.patch || body;
    const callerName = body.updatedByName || body.callerName || "Super Admin";
    const roleNormalized = (callerRole || "SUPER_ADMIN").toUpperCase();
    try {
      const cfg = await prisma.masterPricingConfig.upsert({
        where: { id: 1 },
        create: {
          id: 1,
          standardMin: Number(patch.standardMin) || 60,
          extraUnitMin: Number(patch.extraUnitMin) || 30,
          extraUnitRate: Number(patch.extraUnitRate) || 500,
          freeKm: Number(patch.freeKm) || 5,
          perKm: Number(patch.perKm) || 50,
          taxPct: Number(patch.taxPct) || 12,
          commissionPct: Number(patch.commissionPct) || 20,
          maxDurationMin: Number(patch.maxDurationMin) || 240,
          bufferMin: Number(patch.bufferMin) || 30,
          rounding: patch.rounding || "Nearest \u20B910",
          updatedByRole: roleNormalized,
          updatedByName: callerName
        },
        update: {
          standardMin: patch.standardMin !== void 0 ? Number(patch.standardMin) : void 0,
          extraUnitMin: patch.extraUnitMin !== void 0 ? Number(patch.extraUnitMin) : void 0,
          extraUnitRate: patch.extraUnitRate !== void 0 ? Number(patch.extraUnitRate) : void 0,
          freeKm: patch.freeKm !== void 0 ? Number(patch.freeKm) : void 0,
          perKm: patch.perKm !== void 0 ? Number(patch.perKm) : void 0,
          taxPct: patch.taxPct !== void 0 ? Number(patch.taxPct) : void 0,
          commissionPct: patch.commissionPct !== void 0 ? Number(patch.commissionPct) : void 0,
          maxDurationMin: patch.maxDurationMin !== void 0 ? Number(patch.maxDurationMin) : void 0,
          bufferMin: patch.bufferMin !== void 0 ? Number(patch.bufferMin) : void 0,
          rounding: patch.rounding || void 0,
          updatedByRole: roleNormalized,
          updatedByName: callerName
        }
      });
      updateCachedPricingConfig(cfg);
      return { status: 200, body: { config: cfg } };
    } catch (err) {
      console.error("[PUT/PATCH /api/pricing-config] DB error:", err?.message);
      return { status: 500, body: { error: err?.message || "Failed to update pricing config" } };
    }
  }
  if (method === "GET" && pathname === "/api/settlements") {
    try {
      const batches = await prisma.settlementBatch.findMany({
        orderBy: { createdAt: "desc" }
      });
      return { status: 200, body: { settlements: batches.map(formatSettlement) } };
    } catch (err) {
      console.warn("[GET /api/settlements] DB fallback notice:", err?.message);
      return { status: 200, body: { settlements: [] } };
    }
  }
  if (method === "POST" && pathname === "/api/settlements/advance") {
    const gosala = body.gosala;
    const nextMap = {
      PENDING: "APPROVED",
      APPROVED: "PROCESSING",
      PROCESSING: "PAID",
      PAID: "PAID",
      FAILED: "APPROVED"
    };
    try {
      const batch = await prisma.settlementBatch.findFirst({
        where: { gosalaName: gosala },
        orderBy: { createdAt: "desc" }
      });
      if (batch) {
        const updated = await prisma.settlementBatch.update({
          where: { id: batch.id },
          data: { status: nextMap[batch.status] || "APPROVED" }
        });
        return { status: 200, body: { settlement: formatSettlement(updated) } };
      }
      return { status: 404, body: { error: "Settlement not found" } };
    } catch (err) {
      console.error("[POST /api/settlements/advance] DB error:", err?.message);
      return { status: 500, body: { error: err?.message || "Failed to advance settlement" } };
    }
  }
  if (method === "POST" && pathname === "/api/settlements/batch-approve") {
    const batch = body.batch || "SEP-W4";
    try {
      await prisma.settlementBatch.updateMany({
        where: { batch, status: "PENDING" },
        data: { status: "APPROVED" }
      });
      return { status: 200, body: { success: true, batch } };
    } catch (err) {
      console.error("[POST /api/settlements/batch-approve] DB error:", err?.message);
      return { status: 500, body: { error: err?.message || "Failed to batch approve settlements" } };
    }
  }
  if (method === "POST" && pathname === "/api/settlements/sweep") {
    try {
      const profiles = await resolveRoleProfilesFromDB();
      const result = await executeAutomatedSweep({
        targetGosala: body?.gosala,
        cycleType: body?.cycleType,
        serverProfiles: profiles
      });
      return { status: 200, body: result };
    } catch (err) {
      console.error("Payout sweep error:", err);
      return {
        status: 500,
        body: { error: err?.message || "Failed to execute automated payout sweep" }
      };
    }
  }
  if (method === "GET" && pathname === "/api/settlements/schedule") {
    try {
      const schedule = await getScheduleStatus();
      return { status: 200, body: { schedule } };
    } catch (err) {
      return {
        status: 500,
        body: { error: err?.message || "Failed to get schedule status" }
      };
    }
  }
  if (method === "POST" && pathname === "/api/settlements/schedule/configure") {
    try {
      const { autoSweepEnabled, disbursementCycle } = body;
      await prisma.masterPricingConfig.upsert({
        where: { id: 1 },
        update: {
          ...autoSweepEnabled !== void 0 ? { autoSweepEnabled } : {},
          ...disbursementCycle ? { disbursementCycle } : {},
          updatedAt: /* @__PURE__ */ new Date()
        },
        create: {
          id: 1,
          autoSweepEnabled: autoSweepEnabled ?? true,
          disbursementCycle: disbursementCycle || "CONTINUOUS_T_PLUS_ONE"
        }
      });
      if (autoSweepEnabled !== void 0 || disbursementCycle) {
        updateCachedPricingConfig({
          ...autoSweepEnabled !== void 0 ? { autoSweepEnabled } : {},
          ...disbursementCycle ? { disbursementCycle } : {}
        });
      }
      const schedule = await getScheduleStatus();
      return { status: 200, body: { success: true, schedule } };
    } catch (err) {
      return {
        status: 500,
        body: { error: err?.message || "Failed to update schedule config" }
      };
    }
  }
  if (method === "GET" && pathname === "/api/gosalas") {
    try {
      const dbGosalas = await prisma.gosala.findMany({
        where: { isActive: true },
        include: {
          animals: true,
          managers: {
            include: { user: true }
          }
        },
        orderBy: { createdAt: "asc" }
      });
      const formatted = dbGosalas.map((g) => {
        const meta = g.metadata && typeof g.metadata === "object" ? { ...g.metadata } : getGosalaMeta(g.id, g.name);
        const lat = g.latitude !== null && g.latitude !== void 0 ? Number(g.latitude) : meta.lat !== void 0 ? Number(meta.lat) : g.lat !== void 0 ? Number(g.lat) : void 0;
        const lng = g.longitude !== null && g.longitude !== void 0 ? Number(g.longitude) : meta.lng !== void 0 ? Number(meta.lng) : g.lng !== void 0 ? Number(g.lng) : void 0;
        const assignedMgrs = (g.managers || []).map((m) => ({
          id: m.user.id.startsWith("MGR-") ? m.user.id : `MGR-${m.user.id.slice(0, 4)}`,
          rawUserId: m.user.id,
          name: m.user.name,
          phone: m.user.phone,
          email: m.user.email
        }));
        const activeMgrId = meta.managerId || "";
        const activeMgrName = (meta.managerName || "").toLowerCase();
        const isUnderAdminCustody = Boolean(
          meta.isActingManager || meta.actAsManagerMyself || activeMgrName.includes("none") || activeMgrName.includes("admin custody") || activeMgrName.includes("acting custodian")
        );
        const filteredAssignedMgrs = isUnderAdminCustody ? [] : activeMgrId && !activeMgrId.startsWith("USER-") ? assignedMgrs.filter(
          (m) => m.id === activeMgrId || m.rawUserId === activeMgrId || activeMgrId.includes(m.rawUserId) || m.id.includes(activeMgrId)
        ) : activeMgrName && !activeMgrName.includes("none") && !activeMgrName.includes("acting") ? assignedMgrs.filter((m) => m.name.toLowerCase() === activeMgrName) : assignedMgrs;
        const primaryAssigned = filteredAssignedMgrs[0] || (isUnderAdminCustody ? void 0 : assignedMgrs[0]);
        const govRole = meta.governingAdminRole || (g.adminId?.startsWith("USER-SA") ? "super_admin" : "admin");
        const govName = g.adminName || meta.governingAdminName || (govRole === "super_admin" ? "Super Admin" : "Operations Admin");
        const govEmail = g.adminEmail || meta.governingAdminEmail || meta.adminEmail || "";
        return {
          ...meta,
          ...g,
          id: g.id,
          name: g.name,
          baseCowPrice: g.baseCowPrice ?? meta.baseCowPrice ?? 3500,
          baseBullPrice: g.baseBullPrice ?? meta.baseBullPrice ?? 4e3,
          baseCalfPrice: g.baseCalfPrice ?? meta.baseCalfPrice ?? 2500,
          baseBuffaloPrice: g.baseBuffaloPrice ?? meta.baseBuffaloPrice ?? 3800,
          basePairPrice: g.basePairPrice ?? meta.basePairPrice ?? 4800,
          partnershipTier: g.partnershipTier ?? meta.partnershipTier ?? "STANDARD",
          commissionType: g.commissionType ?? meta.commissionType ?? "PERCENTAGE",
          commissionValue: g.commissionValue ?? meta.commissionValue ?? meta.customCommissionPct ?? 20,
          customCommissionPct: g.commissionValue ?? meta.customCommissionPct,
          taxTreatment: g.taxTreatment ?? meta.taxTreatment ?? "STANDARD_GST",
          customTaxPct: g.customTaxPct ?? meta.customTaxPct,
          bufferMinutes: g.bufferMinutes ?? meta.bufferMinutes ?? 30,
          partnershipNotes: g.partnershipNotes ?? meta.partnershipNotes ?? "",
          status: meta.status || (g.isActive ? "Active" : "Maintenance"),
          region: g.region,
          address: g.address,
          contactPhone: g.contactPhone,
          contactEmail: g.contactEmail,
          latitude: lat,
          longitude: lng,
          lat,
          lng,
          assignedManagers: filteredAssignedMgrs,
          managerName: isUnderAdminCustody ? meta.managerName || "None (Admin Custody)" : meta.managerName || primaryAssigned?.name || "None (Admin Acting)",
          managerId: isUnderAdminCustody ? "" : meta.managerId || primaryAssigned?.id || "",
          caretaker: meta.caretaker || primaryAssigned?.name || "Caretaker In-Charge",
          governingAdminRole: govRole,
          governingAdminName: govName,
          governingAdminEmail: govEmail,
          adminId: g.adminId || meta.adminId || (govRole === "super_admin" ? "USER-SA-001" : ""),
          adminName: g.adminName || meta.adminName || govName,
          adminEmail: govEmail
        };
      });
      let scopedGosalas = formatted;
      if (authUser?.role === "manager") {
        scopedGosalas = formatted.filter((g) => {
          const idMatch = authUser.gosalaIds?.includes(g.id);
          const nameMatch = authUser.gosalaNames?.some(
            (gn) => g.name.trim().toLowerCase() === gn.trim().toLowerCase()
          );
          const mgrMatch = g.assignedManagers?.some(
            (m) => m.rawUserId === authUser.userId || m.id === authUser.userId || m.email?.toLowerCase() === authUser.email?.toLowerCase()
          );
          return idMatch || nameMatch || mgrMatch;
        });
      } else if (authUser?.role === "admin") {
        const allowedIds = new Set(authUser.gosalaIds || []);
        const allowedNames = new Set((authUser.gosalaNames || []).map((name) => name.trim().toLowerCase()));
        const userEmail = (authUser.email || "").trim().toLowerCase();
        const userId = (authUser.userId || "").trim().toLowerCase();
        scopedGosalas = formatted.filter((g) => {
          const idMatch = allowedIds.has(g.id);
          const nameMatch = allowedNames.has(String(g.name).trim().toLowerCase());
          const gGovEmail = String(g.governingAdminEmail || g.adminEmail || "").trim().toLowerCase();
          const govEmailMatch = Boolean(userEmail && gGovEmail === userEmail);
          const gAdminId = String(g.adminId || "").trim().toLowerCase();
          const adminIdMatch = Boolean(userId && gAdminId === userId);
          return idMatch || nameMatch || govEmailMatch || adminIdMatch;
        });
      } else if (authUser?.role === "super_admin") {
        scopedGosalas = formatted;
      }
      return { status: 200, body: { ok: true, gosalas: scopedGosalas } };
    } catch (err) {
      console.warn("Error fetching gosalas from database:", err?.message);
      return { status: 200, body: { ok: true, gosalas: [] } };
    }
  }
  if (method === "POST" && pathname === "/api/gosalas") {
    if (!authUser || authUser.role !== "super_admin" && authUser.role !== "admin") {
      return { status: 403, body: { ok: false, error: "Only platform administrators can register new Gaushalas" } };
    }
    try {
      const {
        name,
        region,
        address,
        contactPhone,
        email,
        latitude,
        longitude,
        lat,
        lng,
        ...restMeta
      } = body;
      if (!name || !region || !address) {
        return {
          status: 400,
          body: { error: "Name, region, and physical address are required" }
        };
      }
      const finalLat = latitude !== void 0 ? Number(latitude) : lat !== void 0 ? Number(lat) : null;
      const finalLng = longitude !== void 0 ? Number(longitude) : lng !== void 0 ? Number(lng) : null;
      const isActing = Boolean(body.actAsManagerMyself) || Boolean(restMeta.isActingManager) || !restMeta.managerId && !restMeta.managerName;
      const finalGovRole = restMeta.governingAdminRole || (authUser?.role === "super_admin" ? "super_admin" : "admin");
      const callerAdminName = restMeta.governingAdminName || authUser?.name || "Operations Admin";
      const callerAdminEmail = restMeta.governingAdminEmail || authUser?.email || "admin@gomaa.in";
      const callerAdminId = restMeta.adminId || authUser?.userId || "USER-ADM-101";
      const created = await prisma.gosala.upsert({
        where: { name: name.trim() },
        create: {
          name: name.trim(),
          region: region.trim(),
          address: address.trim(),
          contactPhone: contactPhone || "+91 98000 00000",
          contactEmail: email || "trust@gomaa.in",
          latitude: finalLat,
          longitude: finalLng,
          isActive: true,
          adminId: callerAdminId,
          adminEmail: callerAdminEmail,
          adminName: callerAdminName
        },
        update: {
          region: region.trim(),
          address: address.trim(),
          contactPhone: contactPhone || void 0,
          contactEmail: email || void 0,
          latitude: finalLat,
          longitude: finalLng,
          isActive: true,
          adminId: callerAdminId,
          adminEmail: callerAdminEmail,
          adminName: callerAdminName
        }
      });
      let resolvedMgrUser = null;
      if (!isActing && (restMeta.managerId || restMeta.managerName || restMeta.caretaker)) {
        try {
          const mgrKey = restMeta.managerId || restMeta.managerName || restMeta.caretaker;
          const cleanMgrKey = typeof mgrKey === "string" && mgrKey.startsWith("MGR-") ? mgrKey.replace(/^MGR-/, "") : mgrKey;
          resolvedMgrUser = await prisma.user.findFirst({
            where: {
              OR: [
                { id: mgrKey },
                { id: cleanMgrKey },
                { id: { startsWith: cleanMgrKey } },
                { name: { equals: restMeta.managerName || restMeta.caretaker, mode: "insensitive" } },
                { email: mgrKey }
              ]
            }
          });
          if (resolvedMgrUser) {
            await prisma.gosalaManagerAssignment.deleteMany({
              where: {
                gosalaId: created.id,
                NOT: { userId: resolvedMgrUser.id }
              }
            });
            await prisma.gosalaManagerAssignment.upsert({
              where: {
                userId_gosalaId: {
                  userId: resolvedMgrUser.id,
                  gosalaId: created.id
                }
              },
              create: {
                userId: resolvedMgrUser.id,
                gosalaId: created.id,
                region: created.region,
                status: "Active"
              },
              update: {
                status: "Active"
              }
            });
          }
        } catch (e) {
          console.warn("Could not sync manager assignment in POST gosalas:", e);
        }
      }
      const finalMgrName = isActing ? `${callerAdminName} (Acting Manager)` : resolvedMgrUser?.name || restMeta.managerName || "None (Admin Acting)";
      const finalMgrId = isActing ? callerAdminId : resolvedMgrUser?.id || restMeta.managerId || "";
      const finalCaretaker = isActing ? `${callerAdminName} (Acting Custodian)` : restMeta.caretaker || resolvedMgrUser?.name || "Dedicated Gosevak Caretaker";
      saveGosalaMeta(created.id, created.name, {
        ...restMeta,
        lat: finalLat !== null ? finalLat : void 0,
        lng: finalLng !== null ? finalLng : void 0,
        governingAdminRole: finalGovRole,
        governingAdminName: callerAdminName,
        governingAdminEmail: callerAdminEmail,
        adminName: callerAdminName,
        adminId: callerAdminId,
        isActingManager: isActing,
        managerName: finalMgrName,
        managerId: finalMgrId,
        caretaker: finalCaretaker
      });
      const fullMeta = getGosalaMeta(created.id, created.name);
      const mergedCreated = {
        ...created,
        ...fullMeta,
        id: created.id,
        name: created.name,
        region: created.region,
        address: created.address,
        contactPhone: created.contactPhone,
        contactEmail: created.contactEmail,
        lat: finalLat !== null ? finalLat : fullMeta.lat,
        lng: finalLng !== null ? finalLng : fullMeta.lng,
        latitude: finalLat,
        longitude: finalLng
      };
      wsHub.broadcastToChannel("channel:gosalas", "GOSALA_REGISTERED", {
        gosala: mergedCreated,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
      return { status: 201, body: { ok: true, gosala: mergedCreated } };
    } catch (err) {
      console.error("Error creating/updating gosala in DB:", err);
      return { status: 500, body: { error: err.message || "Failed to persist Gaushala" } };
    }
  }
  const putGosalaMatch = pathname.match(/^\/api\/gosalas\/([^/]+)$/);
  if (method === "PUT" && putGosalaMatch) {
    const rawId = putGosalaMatch[1];
    const decodedId = decodeURIComponent(rawId);
    try {
      const existing = await prisma.gosala.findFirst({
        where: {
          OR: [
            { id: rawId },
            { id: decodedId },
            { name: decodedId },
            { name: { equals: decodedId, mode: "insensitive" } }
          ]
        }
      });
      if (!existing) {
        return { status: 404, body: { error: "Gaushala not found" } };
      }
      if (!authUser || authUser.role !== "super_admin" && authUser.role !== "admin" && authUser.role !== "manager") {
        return { status: 403, body: { ok: false, error: "Insufficient privileges to modify sanctuary records" } };
      }
      if (authUser.role === "admin") {
        const allowedIds = new Set(authUser.gosalaIds || []);
        const allowedNames = new Set((authUser.gosalaNames || []).map((n) => n.trim().toLowerCase()));
        const userEmail = (authUser.email || "").trim().toLowerCase();
        const userId = (authUser.userId || "").trim().toLowerCase();
        const existingName = (existing.name || "").trim().toLowerCase();
        const existingAdminEmail = (existing.adminEmail || "").trim().toLowerCase();
        const existingAdminId = (existing.adminId || "").trim().toLowerCase();
        const isOwner = allowedIds.has(existing.id) || allowedNames.has(existingName) || Boolean(userEmail) && existingAdminEmail === userEmail || Boolean(userId) && existingAdminId === userId;
        if (!isOwner) {
          return { status: 403, body: { ok: false, error: "Cross-tenant violation: Gaushala outside your operational portfolio" } };
        }
      }
      if (authUser.role === "manager") {
        const allowedIds = new Set(authUser.gosalaIds || []);
        const allowedNames = new Set((authUser.gosalaNames || []).map((n) => n.trim().toLowerCase()));
        const existingName = (existing.name || "").trim().toLowerCase();
        const isAssigned = allowedIds.has(existing.id) || allowedNames.has(existingName);
        if (!isAssigned) {
          return { status: 403, body: { ok: false, error: "Gaushala outside your custodian assignment" } };
        }
      }
      const {
        name,
        region,
        address,
        contactPhone,
        email,
        contactEmail,
        latitude,
        longitude,
        lat,
        lng,
        ...restMeta
      } = body;
      const finalLat = latitude !== void 0 ? Number(latitude) : lat !== void 0 ? Number(lat) : void 0;
      const finalLng = longitude !== void 0 ? Number(longitude) : lng !== void 0 ? Number(lng) : void 0;
      const callerAdminName = restMeta.governingAdminName || restMeta.adminName || body.governingAdminName || body.adminName;
      const callerAdminEmail = restMeta.governingAdminEmail || restMeta.adminEmail || body.governingAdminEmail || body.adminEmail;
      const callerAdminId = restMeta.adminId || body.adminId;
      const isActing = body.actAsManagerMyself !== void 0 ? Boolean(body.actAsManagerMyself) : restMeta.isActingManager !== void 0 ? Boolean(restMeta.isActingManager) : void 0;
      const effectiveAdminName = callerAdminName || authUser?.name || "Operations Admin";
      const effectiveAdminEmail = callerAdminEmail || authUser?.email || "admin@gomaa.in";
      const effectiveAdminRole = restMeta.governingAdminRole || (authUser?.role === "super_admin" ? "super_admin" : "admin");
      const effectiveAdminId = callerAdminId || authUser?.userId || "USER-ADM-101";
      const currentMeta = existing.metadata && typeof existing.metadata === "object" ? { ...existing.metadata } : getGosalaMeta(existing.id, existing.name);
      const metaPatch = {
        ...currentMeta,
        ...restMeta,
        ...finalLat !== void 0 ? { lat: finalLat } : {},
        ...finalLng !== void 0 ? { lng: finalLng } : {},
        governingAdminName: effectiveAdminName,
        governingAdminEmail: effectiveAdminEmail,
        governingAdminRole: effectiveAdminRole,
        adminName: effectiveAdminName,
        adminEmail: effectiveAdminEmail,
        adminId: effectiveAdminId
      };
      if (isActing === true) {
        metaPatch.isActingManager = true;
        metaPatch.managerName = `${callerAdminName} (Acting Manager)`;
        metaPatch.managerId = callerAdminId;
        metaPatch.caretaker = `${callerAdminName} (Acting Custodian)`;
        try {
          await prisma.gosalaManagerAssignment.deleteMany({ where: { gosalaId: existing.id } });
        } catch {
        }
      } else if (isActing === false && restMeta.managerName) {
        metaPatch.isActingManager = false;
      }
      if (isActing !== true && (restMeta.managerId || restMeta.managerName || restMeta.caretaker)) {
        try {
          const mgrKey = restMeta.managerId || restMeta.managerName || restMeta.caretaker;
          const cleanMgrKey = typeof mgrKey === "string" && mgrKey.startsWith("MGR-") ? mgrKey.replace(/^MGR-/, "") : mgrKey;
          const mgrUser = await prisma.user.findFirst({
            where: {
              OR: [
                { id: mgrKey },
                { id: cleanMgrKey },
                { id: { startsWith: cleanMgrKey } },
                { name: { equals: restMeta.managerName || restMeta.caretaker, mode: "insensitive" } },
                { email: mgrKey }
              ]
            }
          });
          if (mgrUser) {
            metaPatch.managerId = mgrUser.id;
            metaPatch.managerName = mgrUser.name;
            if (!metaPatch.caretaker || metaPatch.caretaker.includes("Acting")) {
              metaPatch.caretaker = mgrUser.name;
            }
            if (body.exclusiveManager) {
              await prisma.gosalaManagerAssignment.deleteMany({
                where: {
                  userId: mgrUser.id,
                  NOT: { gosalaId: existing.id }
                }
              });
            }
            await prisma.gosalaManagerAssignment.deleteMany({
              where: {
                gosalaId: existing.id,
                NOT: { userId: mgrUser.id }
              }
            });
            await prisma.gosalaManagerAssignment.upsert({
              where: {
                userId_gosalaId: {
                  userId: mgrUser.id,
                  gosalaId: existing.id
                }
              },
              create: {
                userId: mgrUser.id,
                gosalaId: existing.id,
                region: region ? region.trim() : existing.region,
                status: "Active"
              },
              update: {
                status: "Active"
              }
            });
          }
        } catch (e) {
          console.warn("Could not sync manager assignment in PUT gosalas:", e);
        }
      }
      const parsedCommValue = body.commissionValue !== void 0 ? Number(body.commissionValue) : body.customCommissionPct !== void 0 ? Number(body.customCommissionPct) : body.customCommissionFlat !== void 0 ? Number(body.customCommissionFlat) : void 0;
      const updated = await prisma.gosala.update({
        where: { id: existing.id },
        data: {
          name: name ? name.trim() : void 0,
          region: region ? region.trim() : void 0,
          address: address ? address.trim() : void 0,
          contactPhone: contactPhone || void 0,
          contactEmail: email || contactEmail || void 0,
          latitude: finalLat,
          longitude: finalLng,
          // Persist Sanctuary Category Base Rates to dedicated PostgreSQL columns
          baseCowPrice: body.baseCowPrice !== void 0 ? Number(body.baseCowPrice) : void 0,
          baseBullPrice: body.baseBullPrice !== void 0 ? Number(body.baseBullPrice) : void 0,
          baseCalfPrice: body.baseCalfPrice !== void 0 ? Number(body.baseCalfPrice) : void 0,
          baseBuffaloPrice: body.baseBuffaloPrice !== void 0 ? Number(body.baseBuffaloPrice) : void 0,
          basePairPrice: body.basePairPrice !== void 0 ? Number(body.basePairPrice) : void 0,
          // Persist Sanctuary Economics, Commission & Tax Settings
          partnershipTier: body.partnershipTier !== void 0 ? String(body.partnershipTier) : void 0,
          commissionType: body.commissionType !== void 0 ? String(body.commissionType) : void 0,
          commissionValue: parsedCommValue,
          taxTreatment: body.taxTreatment !== void 0 ? String(body.taxTreatment) : void 0,
          customTaxPct: body.customTaxPct !== void 0 ? Number(body.customTaxPct) : void 0,
          bufferMinutes: body.bufferMinutes !== void 0 ? Number(body.bufferMinutes) : void 0,
          partnershipNotes: body.partnershipNotes !== void 0 ? String(body.partnershipNotes) : void 0,
          metadata: metaPatch,
          // ATOMICALLY PERSIST TO POSTGRESQL!
          ...callerAdminId ? { adminId: callerAdminId } : {},
          ...callerAdminEmail ? { adminEmail: callerAdminEmail } : {},
          ...callerAdminName ? { adminName: callerAdminName } : {}
        }
      });
      try {
        if (body.baseCowPrice !== void 0 && Number(body.baseCowPrice) > 0) {
          await prisma.animal.updateMany({
            where: { gosalaId: existing.id, type: "COW" },
            data: { price: Number(body.baseCowPrice) }
          });
        }
        if (body.baseCalfPrice !== void 0 && Number(body.baseCalfPrice) > 0) {
          await prisma.animal.updateMany({
            where: { gosalaId: existing.id, type: "CALF" },
            data: { price: Number(body.baseCalfPrice) }
          });
        }
        if (body.baseBullPrice !== void 0 && Number(body.baseBullPrice) > 0) {
          await prisma.animal.updateMany({
            where: { gosalaId: existing.id, type: "BULL" },
            data: { price: Number(body.baseBullPrice) }
          });
        }
        if (body.baseBuffaloPrice !== void 0 && Number(body.baseBuffaloPrice) > 0) {
          await prisma.animal.updateMany({
            where: { gosalaId: existing.id, type: "BUFFALO" },
            data: { price: Number(body.baseBuffaloPrice) }
          });
        }
        if (body.basePairPrice !== void 0 && Number(body.basePairPrice) > 0) {
          await prisma.animal.updateMany({
            where: { gosalaId: existing.id, type: "COW_AND_CALF" },
            data: { price: Number(body.basePairPrice) }
          });
        }
      } catch (syncErr) {
        console.warn("[PUT /api/gosalas/:id] Animal price sync notice:", syncErr);
      }
      if (name && name.trim() !== existing.name) {
        const newName = name.trim();
        try {
          await prisma.animal.updateMany({
            where: { gosalaId: existing.id },
            data: { gosala: newName }
          });
        } catch {
        }
        try {
          await prisma.booking.updateMany({
            where: {
              OR: [
                { gosalaId: existing.id },
                { gosala: existing.name }
              ]
            },
            data: {
              gosala: newName,
              gosalaName: newName
            }
          });
        } catch {
        }
      }
      saveGosalaMeta(updated.id, updated.name, metaPatch);
      const mergedUpdated = {
        ...updated,
        ...metaPatch,
        id: updated.id,
        name: updated.name,
        region: updated.region,
        address: updated.address,
        contactPhone: updated.contactPhone,
        contactEmail: updated.contactEmail,
        lat: updated.latitude !== null && updated.latitude !== void 0 ? Number(updated.latitude) : metaPatch.lat,
        lng: updated.longitude !== null && updated.longitude !== void 0 ? Number(updated.longitude) : metaPatch.lng,
        latitude: updated.latitude,
        longitude: updated.longitude
      };
      return { status: 200, body: { ok: true, gosala: mergedUpdated } };
    } catch (err) {
      return { status: 500, body: { error: err.message || "Failed to update Gaushala" } };
    }
  }
  if (method === "DELETE" && putGosalaMatch) {
    const id = putGosalaMatch[1];
    try {
      const existing = await prisma.gosala.findFirst({
        where: { OR: [{ id }, { name: decodeURIComponent(id) }] }
      });
      if (!existing) {
        return { status: 404, body: { error: "Gaushala not found" } };
      }
      if (!authUser || authUser.role !== "super_admin") {
        return { status: 403, body: { ok: false, error: "Only Super Admin Captain can decommission a Gaushala sanctuary" } };
      }
      try {
        await prisma.gosalaManagerAssignment.deleteMany({
          where: { gosalaId: existing.id }
        });
      } catch {
      }
      try {
        await prisma.animal.deleteMany({
          where: { gosalaId: existing.id }
        });
      } catch {
      }
      deleteGosalaMeta(existing.id, existing.name);
      await prisma.gosala.delete({
        where: { id: existing.id }
      });
      return { status: 200, body: { ok: true, deleted: existing.id } };
    } catch (err) {
      return { status: 500, body: { error: err.message || "Failed to delete Gaushala" } };
    }
  }
  if (method === "GET" && pathname === "/api/animals") {
    try {
      const dbAnimals = await prisma.animal.findMany({
        where: { isActive: true },
        include: { gosala: true },
        orderBy: { createdAt: "asc" }
      });
      const allMeta = getAllAnimalMeta();
      const mappedFromDb = dbAnimals.map((a) => {
        const meta = getAnimalMeta(a.name) || {};
        return {
          name: a.name,
          tagId: meta.tagId || "IN-MH-12-8491",
          type: meta.type || (a.type === "COW" ? "Cow" : a.type === "BULL" ? "Bull" : a.type === "BUFFALO" ? "Buffalo" : a.type === "COW_AND_CALF" ? "Cow & Calf" : "Calf"),
          breed: meta.breed || a.breed || "Indigenous Gir",
          gosala: a.gosala?.name || meta.gosala || "Surya",
          gosalaId: a.gosala?.id,
          age: meta.age || (a.ageYears ? `${a.ageYears} Years` : "5 Years"),
          ageYears: a.ageYears || meta.ageYears || 5,
          weight: meta.weight || "420 kg",
          height: meta.height || "142 cm",
          category: meta.category || "Ceremonial \xB7 Puja & Griha Pravesh",
          price: a.price || meta.price || 3500,
          status: a.healthStatus === "HEALTHY" ? meta.status || "Available" : meta.status || "Resting Buffer",
          todayBookings: 0,
          maxDailyTrips: meta.maxDailyTrips ?? 2,
          maxRadiusKm: meta.maxRadiusKm ?? 20,
          cooldownMinutes: meta.cooldownMinutes ?? 90,
          assignedHandler: meta.assignedHandler || "Gaushala Gosevak",
          lactationStatus: meta.lactationStatus || "Pregnant / Gestating (Month 5)",
          temperament: meta.temperament || "Extremely Gentle with Children & Elders",
          sacredMarks: meta.sacredMarks || "Devi Tilak on Forehead",
          diet: meta.diet || "Fresh Napier grass + dry roughage",
          healthNotes: meta.healthNotes || "Vitals normal, alert demeanor, clear hooves",
          photo: meta.photo || meta.photos && meta.photos[0] || "https://images.unsplash.com/photo-1546722228-7baeca4bd0b3?w=600&h=400&fit=crop&auto=format",
          photos: meta.photos && meta.photos.length > 0 ? meta.photos : [meta.photo || "https://images.unsplash.com/photo-1546722228-7baeca4bd0b3?w=600&h=400&fit=crop&auto=format"],
          vetInfo: meta.vetInfo,
          dietInfo: meta.dietInfo,
          customDetails: meta.customDetails || []
        };
      });
      const dbNames = new Set(mappedFromDb.map((a) => a.name.toLowerCase()));
      const mapped = [...mappedFromDb];
      for (const [key, meta] of Object.entries(allMeta)) {
        if (meta.name && !dbNames.has(meta.name.toLowerCase())) {
          mapped.push({
            name: meta.name,
            tagId: meta.tagId || "IN-MH-12-8491",
            type: meta.type || "Cow",
            breed: meta.breed || "Indigenous Gir",
            gosala: meta.gosala || "Surya",
            gosalaId: void 0,
            age: meta.age || "5 Years",
            ageYears: meta.ageYears || 5,
            weight: meta.weight || "420 kg",
            height: meta.height || "142 cm",
            category: meta.category || "Ceremonial \xB7 Puja & Griha Pravesh",
            price: meta.price || 3500,
            status: meta.status || "Available",
            todayBookings: 0,
            maxDailyTrips: meta.maxDailyTrips ?? 2,
            maxRadiusKm: meta.maxRadiusKm ?? 20,
            cooldownMinutes: meta.cooldownMinutes ?? 90,
            assignedHandler: meta.assignedHandler || "Gaushala Gosevak",
            lactationStatus: meta.lactationStatus || "Pregnant / Gestating (Month 5)",
            temperament: meta.temperament || "Extremely Gentle",
            sacredMarks: meta.sacredMarks || "",
            diet: meta.diet || "Fresh fodder",
            healthNotes: meta.healthNotes || "Healthy, active",
            photo: meta.photo || meta.photos && meta.photos[0] || "https://images.unsplash.com/photo-1546722228-7baeca4bd0b3?w=600&h=400&fit=crop&auto=format",
            photos: meta.photos && meta.photos.length > 0 ? meta.photos : [meta.photo || "https://images.unsplash.com/photo-1546722228-7baeca4bd0b3?w=600&h=400&fit=crop&auto=format"],
            vetInfo: meta.vetInfo,
            dietInfo: meta.dietInfo,
            customDetails: meta.customDetails || []
          });
        }
      }
      serverAnimals.clear();
      for (const item of mapped) {
        serverAnimals.set(item.name, item);
      }
      let finalAnimals = mapped;
      if (authUser?.role === "manager") {
        const allowedGosalas = (authUser.gosalaNames || []).map((s) => s.toLowerCase().trim());
        if (allowedGosalas.length > 0) {
          finalAnimals = finalAnimals.filter((a) => {
            const gName = (a.gosala || "").toLowerCase().trim();
            return allowedGosalas.includes(gName);
          });
        }
      } else if (authUser?.role === "admin") {
        const adminEmail = (authUser.email || "").toLowerCase();
        const adminName = (authUser.name || "").toLowerCase();
        const adminId = authUser.userId || "";
        const myGosalaNames = authUser.gosalaNames && authUser.gosalaNames.length > 0 ? authUser.gosalaNames.map((s) => s.toLowerCase().trim()) : (await prisma.gosala.findMany({ where: { isActive: true } })).filter((g) => {
          const meta = getGosalaMeta(g.id, g.name);
          const gEmail = (g.adminEmail || meta.governingAdminEmail || meta.adminEmail || "").toLowerCase();
          const gName = (g.adminName || meta.governingAdminName || meta.adminName || "").toLowerCase();
          return g.adminId === adminId || gEmail && gEmail === adminEmail || gName && gName.includes(adminName);
        }).map((g) => g.name.toLowerCase().trim());
        if (myGosalaNames.length > 0) {
          finalAnimals = finalAnimals.filter((a) => {
            const gName = (a.gosala || "").toLowerCase().trim();
            return myGosalaNames.includes(gName);
          });
        }
      } else if (authUser?.role === "super_admin") {
        const filterGosala = query.get("gosala") || query.get("shelter");
        if (filterGosala && filterGosala !== "All" && filterGosala !== "ALL") {
          finalAnimals = finalAnimals.filter(
            (a) => (a.gosala || "").toLowerCase() === filterGosala.toLowerCase()
          );
        }
      }
      return { status: 200, body: { ok: true, animals: finalAnimals } };
    } catch (err) {
      console.warn("Error retrieving animals:", err?.message);
      return { status: 200, body: { ok: true, animals: [] } };
    }
  }
  if (method === "POST" && pathname === "/api/animals") {
    try {
      const animalData = body.animal || body;
      if (!animalData.name) {
        return { status: 400, body: { error: "Animal name is required" } };
      }
      saveAnimalMeta(animalData.name, animalData);
      serverAnimals.set(animalData.name, animalData);
      try {
        let gosalaRec = await prisma.gosala.findFirst({
          where: { name: animalData.gosala }
        });
        if (!gosalaRec) {
          gosalaRec = await prisma.gosala.create({
            data: {
              name: animalData.gosala || "Vedic Gaushala",
              region: "General Zone",
              address: "Sanctuary Premises",
              contactPhone: "+91 98000 00000",
              contactEmail: "sanctuary@gomaa.in"
            }
          });
        }
        const aType = animalData.type === "Bull" ? "BULL" : animalData.type === "Calf" ? "CALF" : "COW";
        await prisma.animal.upsert({
          where: {
            gosalaId_name: {
              gosalaId: gosalaRec.id,
              name: animalData.name
            }
          },
          create: {
            gosalaId: gosalaRec.id,
            name: animalData.name,
            type: aType,
            breed: animalData.breed || null,
            ageYears: animalData.ageYears || 5,
            healthStatus: animalData.status === "Available" ? "HEALTHY" : "RESTING",
            price: animalData.price || 3500,
            isActive: true
          },
          update: {
            breed: animalData.breed || void 0,
            ageYears: animalData.ageYears || void 0,
            healthStatus: animalData.status === "Available" ? "HEALTHY" : void 0,
            price: animalData.price || void 0,
            isActive: true
          }
        });
      } catch (dbErr) {
        console.warn("Database animal upsert warning (retained in serverAnimals & disk):", dbErr);
      }
      wsHub.broadcastToChannel("channel:animals", "ANIMAL_REGISTERED", {
        animal: animalData,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
      return { status: 201, body: { ok: true, animal: animalData } };
    } catch (err) {
      return { status: 500, body: { error: err.message || "Failed to persist animal" } };
    }
  }
  const putAnimalMatch = pathname.match(/^\/api\/animals\/([^/]+)$/);
  if (method === "PUT" && putAnimalMatch) {
    const name = decodeURIComponent(putAnimalMatch[1]);
    const existing = serverAnimals.get(name) || getAnimalMeta(name) || { name };
    const updated = { ...existing, ...body };
    saveAnimalMeta(name, updated);
    serverAnimals.set(name, updated);
    try {
      await prisma.animal.updateMany({
        where: {
          OR: [
            { id: name },
            { name: { equals: name, mode: "insensitive" } },
            { name: { contains: name, mode: "insensitive" } }
          ]
        },
        data: {
          breed: updated.breed || void 0,
          ageYears: updated.ageYears !== void 0 ? Number(updated.ageYears) : void 0,
          price: updated.price !== void 0 ? Number(updated.price) : void 0
        }
      });
    } catch {
    }
    wsHub.broadcastToChannel("channel:animals", "ANIMAL_UPDATED", {
      animal: updated,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
    return { status: 200, body: { ok: true, animal: updated } };
  }
  if (method === "DELETE" && putAnimalMatch) {
    const name = decodeURIComponent(putAnimalMatch[1]);
    serverAnimals.delete(name);
    deleteAnimalMeta(name);
    try {
      await prisma.animal.deleteMany({ where: { name } });
    } catch {
    }
    wsHub.broadcastToChannel("channel:animals", "ANIMAL_DELETED", {
      name,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
    return { status: 200, body: { ok: true, deleted: name } };
  }
  if (method === "GET" && pathname === "/api/vets") {
    try {
      const gosalaQuery = query.get("gosala") || query.get("gosalaId") || query.get("gosalaName");
      const where = {};
      if (authUser?.role === "manager" && authUser.gosalaNames?.length > 0) {
        where.OR = [
          ...authUser.gosalaNames.map((gn) => ({ gosala: { name: { equals: gn, mode: "insensitive" } } })),
          ...authUser.gosalaNames.map((gn) => ({ assignedGosalas: { has: gn } }))
        ];
      } else if (authUser?.role === "admin" && authUser.gosalaNames?.length > 0) {
        where.OR = [
          ...authUser.gosalaNames.map((gn) => ({ gosala: { name: { equals: gn, mode: "insensitive" } } })),
          ...authUser.gosalaNames.map((gn) => ({ assignedGosalas: { has: gn } }))
        ];
      } else if (gosalaQuery) {
        where.OR = [
          { gosalaId: gosalaQuery },
          { gosala: { name: { contains: gosalaQuery, mode: "insensitive" } } },
          { assignedGosalas: { has: gosalaQuery } }
        ];
      }
      const vets = await prisma.empanelledVet.findMany({
        where,
        include: { gosala: { select: { id: true, name: true, region: true } } },
        orderBy: { createdAt: "asc" }
      });
      return { status: 200, body: { ok: true, vets } };
    } catch (e) {
      console.warn("[GET /api/vets] DB fallback notice:", e?.message);
      return { status: 200, body: { ok: true, vets: [] } };
    }
  }
  if (method === "POST" && pathname === "/api/vets") {
    const denied = requireRole("super_admin", "admin", "manager");
    if (denied) return denied;
    const vet = body.vet || body;
    const id = vet.id || `VET-${Date.now()}`;
    let gosalaId = vet.gosalaId;
    if (!gosalaId && vet.gosalaName) {
      const g = await prisma.gosala.findFirst({
        where: { name: { equals: vet.gosalaName, mode: "insensitive" } }
      });
      if (g) gosalaId = g.id;
    }
    if (!gosalaId && authUser?.role === "manager" && authUser.gosalaNames?.[0]) {
      const g = await prisma.gosala.findFirst({
        where: { name: { equals: authUser.gosalaNames[0], mode: "insensitive" } }
      });
      if (g) gosalaId = g.id;
    }
    try {
      const fullVet = await prisma.empanelledVet.upsert({
        where: { regNo: vet.regNo || id },
        update: {
          gosalaId: gosalaId || void 0,
          name: vet.name,
          qualification: vet.qualification || "B.V.Sc",
          clinic: vet.clinic || "Local Veterinary Clinic",
          phone: vet.phone || "+91 98000 00000",
          address: vet.address || "Veterinary Center",
          specialization: vet.specialization || "General Bovine Care",
          emergency24x7: vet.emergency24x7 ?? true,
          assignedGosalas: vet.assignedGosalas || (vet.gosalaName ? [vet.gosalaName] : ["All Gaushalas"])
        },
        create: {
          id,
          gosalaId: gosalaId || null,
          name: vet.name,
          qualification: vet.qualification || "B.V.Sc",
          regNo: vet.regNo || `REG-${Date.now()}`,
          clinic: vet.clinic || "Local Veterinary Clinic",
          phone: vet.phone || "+91 98000 00000",
          address: vet.address || "Veterinary Center",
          specialization: vet.specialization || "General Bovine Care",
          emergency24x7: vet.emergency24x7 ?? true,
          assignedGosalas: vet.assignedGosalas || (vet.gosalaName ? [vet.gosalaName] : ["All Gaushalas"])
        },
        include: { gosala: { select: { id: true, name: true, region: true } } }
      });
      wsHub.broadcastToChannel("channel:animals", "VET_UPDATED", {
        vet: fullVet,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
      return { status: 201, body: { ok: true, vet: fullVet } };
    } catch (e) {
      return { status: 500, body: { error: e.message } };
    }
  }
  const putVetMatch = pathname.match(/^\/api\/vets\/([^/]+)$/);
  if (method === "PUT" && putVetMatch) {
    const id = putVetMatch[1];
    try {
      const updated = await prisma.empanelledVet.update({
        where: { id },
        data: { ...body }
      });
      wsHub.broadcastToChannel("channel:animals", "VET_UPDATED", {
        vet: updated,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
      return { status: 200, body: { ok: true, vet: updated } };
    } catch (e) {
      return { status: 500, body: { error: e.message } };
    }
  }
  if (method === "DELETE" && putVetMatch) {
    const id = putVetMatch[1];
    try {
      await prisma.empanelledVet.delete({ where: { id } });
      return { status: 200, body: { ok: true, deleted: id } };
    } catch (e) {
      return { status: 500, body: { error: e.message } };
    }
  }
  if (method === "POST" && pathname === "/api/slots/toggle-block") {
    const { animal, date, time } = body;
    const existing = await prisma.animalScheduleBlock.findFirst({
      where: { animalName: animal, date, timeSlot: time }
    });
    if (existing) {
      await prisma.animalScheduleBlock.delete({ where: { id: existing.id } });
      return { status: 200, body: { unblocked: true } };
    } else {
      const a = await prisma.animal.findFirst({ where: { name: animal } });
      await prisma.animalScheduleBlock.create({
        data: {
          animalId: a?.id || "",
          animalName: animal,
          date,
          timeSlot: time,
          reason: "Manual operational block"
        }
      });
      return { status: 200, body: { blocked: true } };
    }
  }
  const animalStatusMatch = pathname.match(/^\/api\/animals\/([^/]+)\/status$/);
  if (method === "POST" && animalStatusMatch) {
    const animalName = decodeURIComponent(animalStatusMatch[1]);
    const { status, reason, cooldownMinutes } = body;
    wsHub.broadcastToChannel("channel:animals", "ANIMAL_STATUS_CHANGED", {
      animal: animalName,
      status,
      reason,
      cooldownMinutes: cooldownMinutes || 90,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
    wsHub.broadcastToChannel("channel:admin", "ROLE_ALERT", {
      targetRole: "OPERATIONS_ADMIN",
      title: `Animal Status Updated: ${animalName}`,
      message: `${animalName} status set to ${status}${reason ? ` (${reason})` : ""}`,
      priority: status === "Vet Care" || status === "Heat Hold" ? "HIGH" : "NORMAL",
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
    return {
      status: 200,
      body: {
        success: true,
        animal: animalName,
        status,
        reason,
        cooldownMinutes: cooldownMinutes || 90
      }
    };
  }
  if (method === "GET" && pathname === "/api/profiles") {
    const profiles = await resolveRoleProfilesFromDB();
    return { status: 200, body: { profiles } };
  }
  const profileRoleMatch = pathname.match(/^\/api\/profiles\/([^/]+)$/);
  if (method === "GET" && profileRoleMatch) {
    const roleKey = profileRoleMatch[1];
    const profiles = await resolveRoleProfilesFromDB();
    const p = profiles[roleKey];
    if (!p)
      return {
        status: 404,
        body: { error: `Profile for role ${roleKey} not found` }
      };
    return { status: 200, body: { profile: p } };
  }
  if ((method === "PUT" || method === "POST") && profileRoleMatch) {
    const roleKey = profileRoleMatch[1];
    const profiles = await resolveRoleProfilesFromDB();
    const existing = profiles[roleKey] || {
      id: `USER-${roleKey.toUpperCase()}`,
      role: roleKey
    };
    const updated = {
      ...existing,
      ...body,
      customerData: body.customerData ? { ...existing.customerData || {}, ...body.customerData } : existing.customerData,
      managerData: body.managerData ? { ...existing.managerData || {}, ...body.managerData } : existing.managerData,
      driverData: body.driverData ? { ...existing.driverData || {}, ...body.driverData } : existing.driverData,
      adminData: body.adminData ? { ...existing.adminData || {}, ...body.adminData } : existing.adminData,
      bankDetails: body.bankDetails !== void 0 ? body.bankDetails ? { ...existing.bankDetails || {}, ...body.bankDetails } : void 0 : existing.bankDetails,
      settlementSchedule: body.settlementSchedule !== void 0 ? body.settlementSchedule ? { ...existing.settlementSchedule || {}, ...body.settlementSchedule } : void 0 : existing.settlementSchedule
    };
    const roleEnum = roleKey === "customer" ? "CUSTOMER" : roleKey === "manager" ? "GOSALA_MANAGER" : roleKey === "driver" ? "DRIVER" : roleKey === "super_admin" ? "SUPER_ADMIN" : "OPERATIONS_ADMIN";
    const metadataToSave = {
      customerData: updated.customerData,
      managerData: updated.managerData,
      driverData: updated.driverData,
      adminData: updated.adminData,
      bankDetails: updated.bankDetails,
      settlementSchedule: updated.settlementSchedule
    };
    try {
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [
            ...updated.email ? [{ email: updated.email }] : [],
            { role: roleEnum }
          ]
        }
      });
      if (existingUser) {
        const currentMeta = existingUser.metadata || {};
        await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            name: updated.name || existingUser.name,
            phone: updated.phone || existingUser.phone,
            metadata: { ...currentMeta, ...metadataToSave }
          }
        });
      } else if (updated.email) {
        await prisma.user.create({
          data: {
            name: updated.name || "User",
            email: updated.email,
            phone: updated.phone || "+91 98000 00000",
            role: roleEnum,
            metadata: metadataToSave
          }
        });
      }
    } catch (e) {
      console.warn("Profile DB update warning:", e?.message);
    }
    return { status: 200, body: { success: true, profile: updated } };
  }
  return { status: 404, body: { error: "Endpoint not found" } };
}

// server/apiEntry.ts
function resolveRequestUrl(req) {
  const rawUrl = req.url || "";
  let parsed;
  try {
    parsed = new URL(rawUrl, "http://localhost");
  } catch {
    parsed = new URL("/api", "http://localhost");
  }
  if (parsed.searchParams.has("__api_path")) {
    const apiPath = parsed.searchParams.get("__api_path") || "";
    parsed.searchParams.delete("__api_path");
    const cleanSubpath = apiPath.replace(/^\/+|\/+$/g, "");
    const reconstructedPath = cleanSubpath ? `/api/${cleanSubpath}` : "/api";
    const remainingQuery = parsed.searchParams.toString();
    return remainingQuery ? `${reconstructedPath}?${remainingQuery}` : reconstructedPath;
  }
  const matchedPath = req.headers?.["x-matched-path"] || "";
  if (matchedPath.startsWith("/api") && !matchedPath.includes("index.js")) {
    const remainingQuery = parsed.searchParams.toString();
    return remainingQuery ? `${matchedPath}?${remainingQuery}` : matchedPath;
  }
  const fwdUri = req.headers?.["x-forwarded-uri"] || "";
  if (fwdUri.startsWith("/api")) {
    return fwdUri;
  }
  let pathname = parsed.pathname;
  if (!pathname.startsWith("/api")) {
    pathname = "/api" + (pathname.startsWith("/") ? "" : "/") + pathname;
  }
  const query = parsed.searchParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}
async function handler(req, res) {
  const origin = String(req.headers?.origin || "");
  if (process.env.NODE_ENV !== "production") {
    res.setHeader("Access-Control-Allow-Origin", "*");
  } else {
    const allowed = (process.env.GOMAA_ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
    if (origin && allowed.includes(origin)) res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }
  const requestUrl = resolveRequestUrl(req);
  let rawBody = "";
  if (req.body) {
    rawBody = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
  } else {
    try {
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
      }
      rawBody = Buffer.concat(chunks).toString("utf-8");
    } catch {
      rawBody = "";
    }
  }
  try {
    const result = await handleApiRequest(
      req.method || "GET",
      requestUrl,
      rawBody,
      req.headers
    );
    if (!result) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: `Endpoint not found: ${req.method} ${requestUrl}` }));
      return;
    }
    res.statusCode = result.status;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(result.body));
  } catch (err) {
    console.error("[Vercel API Error]:", err);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: err.message || "Internal server error" }));
  }
}
export {
  handler as default
};
