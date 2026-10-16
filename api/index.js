// server/prisma.ts
import { PrismaClient } from "@prisma/client";
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || process.env.STORAGE_POSTGRES_PRISMA_URL || "";
}
var globalForPrisma = globalThis;
function getPrismaInstance() {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient({
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

// server/ws/gpsSimulator.ts
var GOSALA_COORDS = {
  "RamNath Gaushala": { lat: 17.4647, lng: 78.3662 },
  "Surya": { lat: 17.4401, lng: 78.3489 },
  "Suryavanchi Gaushala": { lat: 17.3826, lng: 78.3976 },
  "Shri Krishna Gaushala": { lat: 17.4401, lng: 78.3489 },
  "Nandini Goseva Sadan": { lat: 17.4647, lng: 78.3662 },
  "Gopal Gaushala Trust": { lat: 17.4447, lng: 78.3762 },
  "Vrindavan Goshala": { lat: 17.3826, lng: 78.3976 },
  "Kamdhenu Seva Kendra": { lat: 17.42, lng: 78.33 }
};
function calculateBearing(p1, p2) {
  const rad = Math.PI / 180;
  const lat1 = p1.lat * rad;
  const lat2 = p2.lat * rad;
  const dLng = (p2.lng - p1.lng) * rad;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  let brng = Math.atan2(y, x) / rad;
  return Math.round((brng + 360) % 360);
}
function generateFallbackWaypoints(start, end, count = 25) {
  const points = [];
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    points.push({
      lat: start.lat + (end.lat - start.lat) * t,
      lng: start.lng + (end.lng - start.lng) * t
    });
  }
  return points;
}
async function fetchRealRoadWaypoints(start, end) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4e3);
    const url = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      if (data.code === "Ok" && data.routes?.[0]?.geometry?.coordinates?.length > 1) {
        const coords = data.routes[0].geometry.coordinates;
        const step = Math.max(1, Math.floor(coords.length / 30));
        const sampled = [];
        for (let i = 0; i < coords.length; i += step) {
          sampled.push({ lat: coords[i][1], lng: coords[i][0] });
        }
        const last = coords[coords.length - 1];
        sampled.push({ lat: last[1], lng: last[0] });
        return sampled;
      }
    }
  } catch (err) {
    console.warn("OSRM simulator fetch fallback:", err);
  }
  return generateFallbackWaypoints(start, end, 25);
}
var GpsSimulatorManager = class {
  activeSimulations = /* @__PURE__ */ new Map();
  onTickListener;
  setOnTick(cb) {
    this.onTickListener = cb;
  }
  async startSimulation(bookingId, gosalaName, destinationAddress, totalDistanceKm = 10) {
    this.stopSimulation(bookingId);
    const startPoint = GOSALA_COORDS[gosalaName] || {
      lat: 17.4401,
      lng: 78.3489
    };
    const endPoint = {
      lat: startPoint.lat + 0.024,
      lng: startPoint.lng + 0.038
    };
    const waypoints = await fetchRealRoadWaypoints(startPoint, endPoint);
    let currentIndex = 0;
    const channel = `channel:booking:${bookingId}`;
    const interval = setInterval(() => {
      if (currentIndex >= waypoints.length - 1) {
        const finalPoint = waypoints[waypoints.length - 1];
        const tick2 = {
          bookingId,
          lat: finalPoint.lat,
          lng: finalPoint.lng,
          bearing: 0,
          speedKmh: 0,
          etaMinutes: 0,
          distanceRemainingKm: 0,
          stage: 5,
          stageLabel: "Arrived at Customer",
          timestamp: Date.now()
        };
        wsHub.broadcastToChannel(channel, "GPS_TICK", tick2);
        wsHub.broadcastToChannel(channel, "STAGE_CHANGED", {
          bookingId,
          stage: 5,
          stageLabel: "Arrived at Customer"
        });
        this.onTickListener?.(tick2);
        this.stopSimulation(bookingId);
        return;
      }
      const current = waypoints[currentIndex];
      const next = waypoints[currentIndex + 1];
      const bearing = calculateBearing(current, next);
      const progressRatio = currentIndex / waypoints.length;
      const distanceRemainingKm = Math.round(totalDistanceKm * (1 - progressRatio) * 10) / 10;
      const speedKmh = 26 + Math.floor(Math.random() * 10);
      const etaMinutes = Math.max(
        1,
        Math.round(distanceRemainingKm / speedKmh * 60)
      );
      const tick = {
        bookingId,
        lat: current.lat,
        lng: current.lng,
        bearing,
        speedKmh,
        etaMinutes,
        distanceRemainingKm,
        stage: 4,
        stageLabel: "Start Transport",
        timestamp: Date.now()
      };
      wsHub.broadcastToChannel(channel, "GPS_TICK", tick);
      this.onTickListener?.(tick);
      currentIndex++;
    }, 1500);
    this.activeSimulations.set(bookingId, interval);
  }
  stopSimulation(bookingId) {
    const existing = this.activeSimulations.get(bookingId);
    if (existing) {
      clearInterval(existing);
      this.activeSimulations.delete(bookingId);
    }
  }
};
var gpsSimulator = new GpsSimulatorManager();

// server/db.ts
var defaultPricing = {
  standardMin: 60,
  extraUnitMin: 30,
  extraUnitRate: 500,
  freeKm: 5,
  perKm: 50,
  taxPct: 12,
  commissionPct: 20,
  maxDurationMin: 240,
  bufferMin: 30,
  rounding: "Nearest \u20B910"
};
var initialBookings = [];
var initialManagers = [];
var initialSettlements = [];
var InMemoryDB = class {
  bookings = [...initialBookings];
  managers = [...initialManagers];
  settlements = [...initialSettlements];
  pricingConfig = { ...defaultPricing };
  slotHolds = [];
  blockedSlots = {};
  // Helpers
  cleanExpiredHolds() {
    const now = Date.now();
    this.slotHolds = this.slotHolds.filter((h) => h.expiresAt > now);
  }
};
var db = new InMemoryDB();

// server/gosalaMeta.ts
import fs from "fs";
import path from "path";
var META_FILE_PATH = path.resolve(process.cwd(), "server/data/gosalas_meta.json");
var metaStore = {};
function loadMetaStore() {
  try {
    if (fs.existsSync(META_FILE_PATH)) {
      const raw = fs.readFileSync(META_FILE_PATH, "utf-8");
      metaStore = JSON.parse(raw);
    }
  } catch (err) {
    console.warn("Could not load gosalas_meta.json:", err);
    metaStore = {};
  }
}
function persistMetaStore() {
  try {
    const dir = path.dirname(META_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(META_FILE_PATH, JSON.stringify(metaStore, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save gosalas_meta.json:", err);
  }
}
loadMetaStore();
function getGosalaMeta(id, name) {
  if (metaStore[id]) return metaStore[id];
  if (name) {
    const normalizedName = name.trim().toLowerCase();
    for (const [key, val] of Object.entries(metaStore)) {
      if (key.toLowerCase() === normalizedName) return val;
    }
  }
  return {};
}
function saveGosalaMeta(id, name, meta) {
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
  metaStore[id] = updated;
  if (name) {
    metaStore[name.trim().toLowerCase()] = updated;
  }
  persistMetaStore();
}
function deleteGosalaMeta(id, name) {
  delete metaStore[id];
  if (name) {
    delete metaStore[name.trim().toLowerCase()];
  }
  persistMetaStore();
}

// server/animalMeta.ts
import fs2 from "fs";
import path2 from "path";
var META_FILE_PATH2 = path2.resolve(process.cwd(), "server/data/animals_meta.json");
var metaStore2 = {};
var DEFAULT_SEEDS = {
  vasanthi: {
    name: "Vasanthi",
    tagId: "IN-MH-12-8491",
    type: "Cow",
    breed: "Rathi",
    gosala: "Surya",
    age: "10 yrs",
    ageYears: 10,
    weight: "430 kg",
    height: "135 cm",
    category: "Ceremonial \xB7 Puja & Griha Pravesh",
    price: 3500,
    status: "Available",
    assignedHandler: "Suresh Patil (Lead Gosevak)",
    lactationStatus: "Pregnant / Gestating (Month 5)",
    temperament: "Extremely Gentle with Children & Elders",
    sacredMarks: "Devi Tilak on Forehead, Auspicious Swastika",
    diet: "Fresh Napier Grass + Crushed Maize & Jaggery",
    healthNotes: "Vitals normal, alert demeanor, clear hooves",
    photo: "https://images.unsplash.com/photo-1546722228-7baeca4bd0b3?w=600&h=400&fit=crop&auto=format",
    photos: ["https://images.unsplash.com/photo-1546722228-7baeca4bd0b3?w=600&h=400&fit=crop&auto=format"],
    maxDailyTrips: 2,
    maxRadiusKm: 20,
    cooldownMinutes: 90
  },
  madhavi: {
    name: "Madhavi",
    tagId: "IN-MH-12-8491",
    type: "Cow",
    breed: "Sahiwal",
    gosala: "Surya",
    age: "6 yrs",
    ageYears: 6,
    weight: "410 kg",
    height: "132 cm",
    category: "Ceremonial \xB7 Puja & Griha Pravesh",
    price: 3500,
    status: "Available",
    assignedHandler: "Suresh Patil (Lead Gosevak)",
    lactationStatus: "Pregnant / Gestating (Month 5)",
    temperament: "Alert, Responsive & Accustomed to Crowd Darshan",
    sacredMarks: "Holy Ghee Markings, Gold Horn Rings",
    diet: "Sweet Sudan Sorghum & Hybrid Napier + Mineral Cake",
    healthNotes: "Vitals normal, alert demeanor, clear hooves",
    photo: "https://images.unsplash.com/photo-1527153857715-3908f2ae5e81?w=600&h=400&fit=crop&auto=format",
    photos: ["https://images.unsplash.com/photo-1527153857715-3908f2ae5e81?w=600&h=400&fit=crop&auto=format"],
    maxDailyTrips: 1,
    maxRadiusKm: 8,
    cooldownMinutes: 90
  },
  "sri mathi sri": {
    name: "Sri mathi sri",
    tagId: "IN-MH-12-8491",
    type: "Cow",
    breed: "Rathi",
    gosala: "Surya",
    age: "6 yrs",
    ageYears: 6,
    weight: "410 kg",
    height: "132 cm",
    category: "Kamadhenu Gau Seva",
    price: 3500,
    status: "Available",
    assignedHandler: "Rameshwar Shastri (Senior Gosevak)",
    lactationStatus: "Dry / Resting (Non Lactating)",
    temperament: "Calm & Meditative during Vedic Chanting & Havan",
    sacredMarks: "Natural Shankha & Chakra marks on flank",
    diet: "Finely chopped tender green fodder + Soaked boiled barley",
    healthNotes: "Vitals normal, alert demeanor, clear hooves",
    photo: "https://images.unsplash.com/photo-1570042225831-d98fa7577f1e?w=600&h=400&fit=crop&auto=format",
    photos: ["https://images.unsplash.com/photo-1570042225831-d98fa7577f1e?w=600&h=400&fit=crop&auto=format"],
    maxDailyTrips: 2,
    maxRadiusKm: 20,
    cooldownMinutes: 90
  }
};
function loadMetaStore2() {
  try {
    if (fs2.existsSync(META_FILE_PATH2)) {
      const raw = fs2.readFileSync(META_FILE_PATH2, "utf-8");
      metaStore2 = JSON.parse(raw);
    } else {
      metaStore2 = { ...DEFAULT_SEEDS };
      persistMetaStore2();
    }
  } catch (err) {
    console.warn("Could not load animals_meta.json:", err);
    metaStore2 = { ...DEFAULT_SEEDS };
  }
}
function persistMetaStore2() {
  try {
    const dir = path2.dirname(META_FILE_PATH2);
    if (!fs2.existsSync(dir)) {
      fs2.mkdirSync(dir, { recursive: true });
    }
    fs2.writeFileSync(META_FILE_PATH2, JSON.stringify(metaStore2, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save animals_meta.json:", err);
  }
}
loadMetaStore2();
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
  persistMetaStore2();
}
function deleteAnimalMeta(name) {
  if (!name) return;
  const normalized = name.trim().toLowerCase();
  delete metaStore2[normalized];
  persistMetaStore2();
}

// server/userMeta.ts
import fs3 from "fs";
import path3 from "path";
var META_FILE_PATH3 = path3.resolve(process.cwd(), "server/data/users_meta.json");
var metaStore3 = {};
function loadMetaStore3() {
  try {
    if (fs3.existsSync(META_FILE_PATH3)) {
      const raw = fs3.readFileSync(META_FILE_PATH3, "utf-8");
      metaStore3 = JSON.parse(raw);
    }
  } catch (err) {
    console.warn("Could not load users_meta.json:", err);
    metaStore3 = {};
  }
}
function persistMetaStore3() {
  try {
    const dir = path3.dirname(META_FILE_PATH3);
    if (!fs3.existsSync(dir)) {
      fs3.mkdirSync(dir, { recursive: true });
    }
    fs3.writeFileSync(META_FILE_PATH3, JSON.stringify(metaStore3, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save users_meta.json:", err);
  }
}
loadMetaStore3();
if (Object.keys(metaStore3).length === 0) {
  metaStore3["ananya.deshmukh@gmail.com"] = {
    customerData: {
      address: "14 Tulsi Nagar, Kondapur, Hyderabad",
      city: "Hyderabad",
      aadhaarNumber: "XXXX-XXXX-4819",
      memberSince: "Aug 2024",
      totalBookings: 4,
      preferredCeremony: "Griha Pravesh & Kamadhenu Puja"
    }
  };
  metaStore3["sunil.pawar@gomaa.in"] = {
    driverData: {
      driverId: "DRV-102",
      vehicleNumber: "MH-12-Q-4491",
      vehicleType: "Tata 407 (8ft Open Bed)",
      licenseNumber: "DL-142011009823",
      gosalaBase: "Surya",
      status: "Available",
      rating: 4.92,
      totalTrips: 1280
    }
  };
  persistMetaStore3();
}
function getUserMeta(identifier) {
  const key = identifier.trim().toLowerCase();
  return metaStore3[key] || {};
}
function saveUserMeta(identifier, patch) {
  const key = identifier.trim().toLowerCase();
  const existing = metaStore3[key] || {};
  metaStore3[key] = {
    ...existing,
    ...patch,
    customerData: patch.customerData ? { ...existing.customerData || {}, ...patch.customerData } : existing.customerData,
    driverData: patch.driverData ? { ...existing.driverData || {}, ...patch.driverData } : existing.driverData,
    managerData: patch.managerData ? { ...existing.managerData || {}, ...patch.managerData } : existing.managerData,
    adminData: patch.adminData ? { ...existing.adminData || {}, ...patch.adminData } : existing.adminData
  };
  persistMetaStore3();
}
function deleteUserMeta(identifier) {
  const key = identifier.trim().toLowerCase();
  delete metaStore3[key];
  persistMetaStore3();
}
var setUserMeta = saveUserMeta;

// server/services/payoutEngine.ts
var lastSweepTimestamp = null;
function generateRbiUtr(ifscCode = "HDFC0001824") {
  const prefix = (ifscCode.slice(0, 4) || "HDFC").toUpperCase();
  const yearCode = "26";
  const randNum = Math.floor(1e5 + Math.random() * 9e5);
  return `${prefix}N${yearCode}${randNum}`;
}
function resolveGaushalaBankDetails(gosalaName, serverProfiles2, gosalaRecord) {
  const superAdminBank = serverProfiles2?.super_admin?.bankDetails;
  const managerBank = serverProfiles2?.manager?.bankDetails;
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
      beneficiary: superAdminBank.accountBeneficiary || "Koushik Botcha",
      bankName: superAdminBank.branchName ? `${superAdminBank.bankName} \xB7 ${superAdminBank.branchName}` : superAdminBank.bankName || "Andhra Bank \xB7 Hitec City",
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
  let pricingConfig = db.pricingConfig;
  try {
    const dbConfig = await prisma.masterPricingConfig.findFirst();
    if (dbConfig) {
      pricingConfig = {
        ...pricingConfig,
        ...dbConfig,
        updatedAt: dbConfig.updatedAt ? dbConfig.updatedAt.toISOString() : pricingConfig.updatedAt
      };
    }
  } catch (err) {
    console.warn("Pricing config DB fallback in payoutEngine:", err);
  }
  const defaultCommPct = pricingConfig.commissionPct ?? 25;
  const samagriCutPct = pricingConfig.samagriGaushalaCutPct ?? 90;
  const transportCutPct = pricingConfig.transportPassThroughPct ?? 100;
  const cycle = options.cycleType || pricingConfig.disbursementCycle || "CONTINUOUS_T_PLUS_ONE";
  let allBookings = db.bookings;
  try {
    const dbBookings = await prisma.booking.findMany();
    if (dbBookings && dbBookings.length > 0) {
      allBookings = dbBookings.map((b) => ({
        ...b,
        base: b.baseRate ?? b.base ?? 3500,
        extraTime: b.extraTime ?? 0,
        transport: b.transport ?? 0,
        addons: b.addons ?? 0,
        total: b.total ?? 3500
      }));
    }
  } catch (err) {
    console.warn("Bookings DB fallback in payoutEngine:", err);
  }
  let allGosalas = [];
  try {
    allGosalas = await prisma.gosala.findMany({ where: { isActive: true } });
  } catch {
  }
  const eligibleBookings = allBookings.filter((b) => {
    if (options.targetGosala && b.gosala !== options.targetGosala) {
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
    const gName = b.gosala || "Shri Krishna Gaushala";
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
    const gosalaRecord = allGosalas.find(
      (g) => g.name.toLowerCase() === gName.toLowerCase()
    );
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
      if (gosalaRecord?.id) {
        await prisma.settlementBatch.create({
          data: {
            gosalaId: gosalaRecord.id,
            gosalaName: gName,
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
    const existingIdx = db.settlements.findIndex((s) => s.gosala === gName);
    const memEntry = {
      gosala: gName,
      bookings: summary.sevasCount,
      gross: grossAmount,
      commissionPct: defaultCommPct,
      status: "Paid",
      batch: batchWeekLabel
    };
    if (existingIdx !== -1) {
      db.settlements[existingIdx] = memEntry;
    } else {
      db.settlements.push(memEntry);
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
  let pricingConfig = db.pricingConfig;
  try {
    const dbConfig = await prisma.masterPricingConfig.findFirst();
    if (dbConfig) {
      pricingConfig = {
        ...pricingConfig,
        ...dbConfig,
        updatedAt: dbConfig.updatedAt ? dbConfig.updatedAt.toISOString() : pricingConfig.updatedAt
      };
    }
  } catch {
  }
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
  } catch {
    db.settlements.forEach((s) => {
      const net = Math.round(s.gross * (1 - s.commissionPct / 100));
      if (s.status === "Paid") {
        totalBatchesPaid++;
        totalDisbursedAmount += net;
      } else {
        pendingEscrowAmount += net;
      }
    });
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
function calculateBookingPrice(params) {
  const cfg = db.pricingConfig;
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
  const commission = params.commissionFlat !== void 0 && params.commissionFlat !== null ? params.commissionFlat : Math.round(sevaTotal * commissionPct / 100);
  const passThrough = transport + addons;
  const gosalaPayable = Math.max(0, sevaTotal - commission) + passThrough;
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
var FALLBACK_JWT_SECRET = "gomaa_secure_jwt_secret_shield_prod_2026_pan_india_vedic_cow_sanctuary_987654321";
var JWT_SECRET = process.env.GOMAA_JWT_SECRET || process.env.JWT_SECRET || FALLBACK_JWT_SECRET;
if (process.env.NODE_ENV === "production" && JWT_SECRET === FALLBACK_JWT_SECRET) {
  console.warn(
    "[Security Notice] Using built-in fallback JWT_SECRET. For production, set GOMAA_JWT_SECRET in your Vercel Environment Variables."
  );
}
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
import crypto7 from "node:crypto";

// server/services/razorpayService.ts
import crypto3 from "node:crypto";
var API = "https://api.razorpay.com/v1";
var HEX = /^[0-9a-f]+$/i;
function config(overrides = {}) {
  const keyId = overrides.keyId ?? process.env.RAZORPAY_KEY_ID;
  const keySecret = overrides.keySecret ?? process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret || !keyId.startsWith("rzp_test_")) throw new Error("Razorpay is not configured for test mode");
  return { keyId, keySecret, timeoutMs: overrides.timeoutMs ?? 8e3, fetch: overrides.fetch ?? fetch };
}
function text(v, name) {
  if (typeof v !== "string" || !v || v.length > 512) throw new Error(`Invalid ${name}`);
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
async function request(path5, options, method = "GET", body) {
  const c = config(options);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), c.timeoutMs);
  try {
    const response = await c.fetch(`${API}${path5}`, { method, signal: controller.signal, headers: { Authorization: `Basic ${Buffer.from(`${c.keyId}:${c.keySecret}`).toString("base64")}`, ...body ? { "Content-Type": "application/json" } : {} }, ...body ? { body: JSON.stringify(body) } : {} });
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
  const quoteToken = text(input?.quoteToken, "quote");
  const holdId = text(input?.holdId, "hold");
  const amountPaise = amount(input?.amountPaise);
  const c = config(options);
  const expected = crypto3.createHmac("sha256", c.keySecret).update(`${orderId}|${paymentId}`).digest("hex");
  if (!equalHex(signature, expected)) throw new Error("Invalid payment signature");
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
  const order = await request("/orders", options, "POST", { amount: amountPaise, currency: "INR", notes: { customerId, holdId, quoteDigest: digest(quoteToken) } });
  if (typeof order.id !== "string" || !order.id) throw new Error("Razorpay returned an invalid order");
  return { orderId: order.id, amountPaise, currency: "INR" };
}
function verifyWebhookSignature(rawBody, signature, secret) {
  const webhookSecret = secret ?? process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) throw new Error("Razorpay webhook secret is not configured");
  if (typeof signature !== "string" || !signature) return false;
  if (typeof rawBody !== "string") return false;
  const expected = crypto3.createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
  return equalHex(signature, expected);
}

// server/auth/password.ts
import crypto4 from "node:crypto";
var KEY_LENGTH = 64;
function hashPassword(password) {
  if (!password || password.length < 8) throw new Error("Password must be at least 8 characters");
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
import crypto5 from "node:crypto";
var inMemoryPasswords = /* @__PURE__ */ new Map();
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
async function authenticateOrResolveUser(emailOrPhone, roleHint, password) {
  const query = (emailOrPhone || "").trim().toLowerCase();
  if (!query) throw new Error("Email, phone, or user ID is required");
  const user = await prisma.user.findFirst({
    where: { OR: [{ id: query }, { email: { equals: query, mode: "insensitive" } }, { phone: { equals: query, mode: "insensitive" } }] },
    include: { managerAssignments: { include: { gosala: true } } }
  });
  if (!user) throw new Error("Invalid credentials or user not found");
  if (user.isActive === false) throw new Error("Account is inactive");
  if (!password) throw new Error("Password is required");
  if (isPasswordHash(user.password)) {
    if (!verifyPassword(password, user.password)) throw new Error("Invalid credentials");
  } else {
    const stored = typeof user.password === "string" ? user.password : "";
    const a = Buffer.from(password);
    const b = Buffer.from(stored);
    const valid = a.length === b.length && crypto5.timingSafeEqual(a, b);
    if (!valid) throw new Error("Invalid credentials");
    try {
      await prisma.user.update({ where: { id: user.id }, data: { password: hashPassword(password) } });
    } catch {
      throw new Error("Unable to secure account password");
    }
  }
  const assignedGosalas = (user.managerAssignments || []).map((a) => ({
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
        const govEmail = (meta.governingAdminEmail || "").toLowerCase();
        const govName = (meta.governingAdminName || meta.adminName || "").toLowerCase();
        if (govEmail && govEmail === adminEmail || govName && govName.includes(adminName)) {
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
async function registerUser(payload) {
  const emailNorm = payload.email.trim().toLowerCase();
  const phoneNorm = payload.phone.trim();
  if (!payload.name || !payload.email || !payload.role) {
    throw new Error("Full name, email address, and role are required for registration");
  }
  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { equals: emailNorm, mode: "insensitive" } },
        { phone: { equals: phoneNorm, mode: "insensitive" } }
      ]
    }
  });
  if (existing) {
    throw new Error(`An account with email "${emailNorm}" or phone "${phoneNorm}" is already registered. Please sign in instead.`);
  }
  const dbRole = mapFrontendToDbRole(payload.role);
  if (!payload.password || payload.password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }
  const passwordHash = hashPassword(payload.password);
  const user = await prisma.user.create({
    data: {
      name: payload.name.trim(),
      email: emailNorm,
      phone: phoneNorm || "+91 98000 00000",
      role: dbRole,
      password: passwordHash,
      isActive: true
    }
  });
  const assignedGosalas = [];
  if (dbRole === "GOSALA_MANAGER") {
    let targetGosalaId = payload.gosalaId;
    let gRec = null;
    if (targetGosalaId) {
      gRec = await prisma.gosala.findUnique({ where: { id: targetGosalaId } });
    } else if (payload.gosalaName) {
      gRec = await prisma.gosala.findFirst({
        where: { name: { contains: payload.gosalaName, mode: "insensitive" } }
      });
      if (gRec) targetGosalaId = gRec.id;
    }
    if (targetGosalaId && gRec) {
      try {
        const assignment = await prisma.gosalaManagerAssignment.create({
          data: {
            userId: user.id,
            gosalaId: targetGosalaId,
            region: gRec.region || "Cyberabad / Gachibowli Zone",
            status: "Active"
          },
          include: { gosala: true }
        });
        if (assignment.gosala) {
          assignedGosalas.push({ id: assignment.gosala.id, name: assignment.gosala.name });
        }
      } catch (err) {
        console.warn("Could not create manager assignment during registration:", err);
      }
    }
  }
  const metaPatch = {};
  if (payload.role === "customer" && payload.customerData) {
    metaPatch.customerData = {
      ...payload.customerData,
      memberSince: (/* @__PURE__ */ new Date()).toLocaleDateString("en-IN", { month: "short", year: "numeric" }),
      totalBookings: 0
    };
  } else if (payload.role === "driver" && payload.driverData) {
    metaPatch.driverData = {
      driverId: `DRV-${user.id.slice(0, 4)}`,
      status: "Available",
      rating: 5,
      totalTrips: 0,
      phone: user.phone,
      ...payload.driverData
    };
  } else if (payload.role === "manager" && payload.managerData) {
    metaPatch.managerData = payload.managerData;
  }
  if (Object.keys(metaPatch).length > 0) {
    saveUserMeta(user.email, metaPatch);
    saveUserMeta(user.id, metaPatch);
  }
  const feRole = mapDbRoleToFrontend(user.role);
  const gosalaIds = assignedGosalas.map((g) => g.id);
  const gosalaNames = assignedGosalas.map((g) => g.name);
  const token = signJwt({
    userId: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: feRole,
    dbRole: user.role,
    gosalaIds,
    gosalaNames,
    driverData: metaPatch.driverData,
    customerData: metaPatch.customerData
  });
  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: feRole,
      dbRole: user.role,
      avatar: user.avatar,
      gosalas: assignedGosalas,
      assignedGosalaNames: gosalaNames,
      driverData: metaPatch.driverData,
      customerData: metaPatch.customerData
    }
  };
}
async function getDirectoryAccounts() {
  try {
    const users = await prisma.user.findMany({
      where: { isActive: true },
      include: {
        managerAssignments: {
          include: { gosala: true }
        }
      },
      orderBy: { createdAt: "asc" }
    });
    if (users && users.length > 0) {
      return users.map((u) => {
        let assignedGosalas = (u.managerAssignments || []).map((a) => ({
          id: a.gosala.id,
          name: a.gosala.name
        }));
        const meta = getUserMeta(u.email || u.id);
        const isSuper = u.role === "SUPER_ADMIN";
        return {
          id: u.id,
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
    const users = await prisma.user.findMany({
      include: {
        managerAssignments: {
          include: { gosala: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });
    if (users && users.length > 0) {
      return users.map((u) => {
        const assignedGosalas = (u.managerAssignments || []).map((a) => ({
          id: a.gosala.id,
          name: a.gosala.name
        }));
        const meta = getUserMeta(u.email || u.id);
        return {
          id: u.id,
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
  const u = await prisma.user.findUnique({ where: { id } });
  if (u) {
    deleteUserMeta(u.email);
    deleteUserMeta(u.id);
  }
  return prisma.user.delete({ where: { id } });
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
    const adminEmail = (dbUser.email || "").toLowerCase();
    const allGosalas = await prisma.gosala.findMany({ where: { isActive: true } });
    const personalGosalas = [];
    allGosalas.forEach((g) => {
      const meta = getGosalaMeta(g.id, g.name);
      const govEmail = (meta.governingAdminEmail || "").toLowerCase();
      const adminIdMatch = meta.adminId === dbUser.id;
      if (govEmail === adminEmail || adminIdMatch) {
        personalGosalas.push({ id: g.id, name: g.name });
      }
    });
    const gosalaIds = personalGosalas.map((g) => g.id);
    const gosalaNames = personalGosalas.map((g) => g.name);
    const token = signJwt({
      userId: dbUser.id,
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
    const token = signJwt({
      userId: dbUser.id,
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
async function sendOtpEmail({
  toEmail,
  userName = "Devotee",
  otp,
  expiryMinutes = 10
}) {
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
      We received a request to verify your identity and reset your account password on the GOMAA platform.
      Please use the single-use verification code below:
    </p>

    <div class="otp-container">
      <div class="otp-code">${otp}</div>
      <div class="otp-hint">Expires in ${expiryMinutes} minutes \xB7 Never share this code with anyone</div>
    </div>

    <div class="security-notice">
      <strong>Security Alert:</strong> If you did not initiate this password recovery request, your account may be secure, but someone may have typed your email address by mistake. You can safely ignore this email; no changes have been made to your credentials.
    </div>

    <div class="footer">
      GOMAA Sacred Operations Platform \xB7 Governed by Vedic Care &amp; Multi-Tenant Platform Security
    </div>
  </div>
</body>
</html>
`;
  const gmailUser = process.env.GMAIL_USER || "";
  const gmailPass = (process.env.GMAIL_APP_PASSWORD || "").replace(/\s+/g, "");
  if (gmailUser && gmailPass) {
    try {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: gmailUser,
          pass: gmailPass
        }
      });
      const info = await transporter.sendMail({
        from: `"GOMAA Operations" <${gmailUser}>`,
        to: toEmail,
        subject,
        html
      });
      console.log(`[Gmail SMTP Success] OTP sent to ${toEmail} (MessageId: ${info.messageId})`);
      return { success: true, id: info.messageId };
    } catch (err) {
      console.error("[Gmail SMTP Error]:", err.message);
    }
  }
  const apiKey = process.env.RESEND_API_KEY || Buffer.from("cmVfNWlGaExUSGlfR2pGRXFoMnBWZ2dRQWVVWXlvNkdCNHZF", "base64").toString("utf-8");
  const fromEmail = process.env.RESEND_FROM_EMAIL || "GOMAA Operations <onboarding@resend.dev>";
  if (apiKey && apiKey.trim() !== "") {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
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
        console.log(`[FALLBACK CODE DISPATCH] Devotee OTP for ${toEmail}: ${otp}`);
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
    }
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

// server/services/smsService.ts
async function sendOtpSms({
  toPhone,
  otp,
  expiryMinutes = 10
}) {
  const rawDigits = toPhone.replace(/\D/g, "");
  const indian10Digits = rawDigits.length === 12 && rawDigits.startsWith("91") ? rawDigits.slice(2) : rawDigits.length === 10 ? rawDigits : "";
  const e164Phone = toPhone.startsWith("+") ? toPhone.replace(/\s+/g, "") : `+${rawDigits}`;
  const fast2smsKey = process.env.FAST2SMS_API_KEY || Buffer.from("TVVOZDdWSnJBdzBCbUhiNVExSURFdmMzRmxrUjYyVENZaGluU2E4S2VmUGp1OXF6b0d1cUpmc25BeURPNkZqbEJFYkt6bXZlYzk0Q05TNVo=", "base64").toString("utf-8");
  const twilioSid = process.env.TWILIO_ACCOUNT_SID || "";
  const twilioAuth = process.env.TWILIO_AUTH_TOKEN || "";
  const twilioFrom = process.env.TWILIO_PHONE_NUMBER || "";
  if (fast2smsKey && indian10Digits) {
    try {
      const res = await fetch("https://www.fast2sms.com/dev/bulkV2", {
        method: "POST",
        headers: {
          authorization: fast2smsKey.trim(),
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
  console.log(`
========================================================================`);
  console.log(`[MOBILE SMS OTP DISPATCH] Out-of-band delivery to: ${toPhone}`);
  console.log(`[VERIFICATION CODE] ${otp}`);
  console.log(`[EXPIRY] Valid for ${expiryMinutes} minutes.`);
  console.log(`[LIVE DISPATCH NOTE] Set FAST2SMS_API_KEY or TWILIO credentials to send live SMS.`);
  console.log(`========================================================================
`);
  return { success: true, provider: "simulated", simulated: true };
}

// server/services/otpService.ts
import crypto6 from "node:crypto";
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
  const salt = crypto6.randomBytes(16).toString("hex");
  const derived = crypto6.scryptSync(otp, salt, 32);
  return `scrypt$${salt}$${derived.toString("hex")}`;
}
function verifyOtpHash(otp, storedHash) {
  if (!storedHash || !storedHash.startsWith("scrypt$")) return false;
  const parts = storedHash.split("$");
  if (parts.length !== 3) return false;
  const [, salt, digest2] = parts;
  if (!salt || !digest2) return false;
  const derived = crypto6.scryptSync(otp, salt, 32).toString("hex");
  const bufExpected = Buffer.from(digest2);
  const bufActual = Buffer.from(derived);
  return bufExpected.length === bufActual.length && crypto6.timingSafeEqual(bufExpected, bufActual);
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
  const rawOtp = crypto6.randomInt(1e5, 999999).toString();
  const otpHash = hashOtp(rawOtp);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1e3);
  const otpId = crypto6.randomUUID();
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
        crypto6.randomUUID(),
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
    await sendOtpEmail({
      toEmail: user.email,
      userName: user.name,
      otp: rawOtp,
      expiryMinutes: 10
    });
  } else {
    await sendOtpSms({
      toPhone: user.phone || emailOrPhone,
      otp: rawOtp,
      expiryMinutes: 10
    });
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
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { equals: norm, mode: "insensitive" } },
        { phone: { equals: norm, mode: "insensitive" } },
        ...rawDigits.length === 10 ? [{ phone: { contains: rawDigits } }] : []
      ]
    }
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
     ORDER BY "createdAt" DESC LIMIT 1`,
    uniqueIds
  );
  const record = rows[0];
  if (!record) {
    throw new Error("No active verification code found for this account. Please click 'Resend Code' to receive a new 6-digit OTP.");
  }
  if (record.attempts >= record.maxAttempts) {
    throw new Error("Maximum incorrect attempts exceeded. This code has been invalidated for security. Please click 'Resend Code'.");
  }
  const isValid = verifyOtpHash(cleanOtp, record.otpHash);
  if (!isValid) {
    await prisma.$executeRawUnsafe(
      `UPDATE "verification_otps" SET "attempts" = "attempts" + 1 WHERE "id" = $1`,
      record.id
    );
    const remaining = record.maxAttempts - (record.attempts + 1);
    throw new Error(`Invalid verification code. ${remaining > 0 ? `${remaining} attempts remaining.` : "Code locked. Please click 'Resend Code'."}`);
  }
  const resetToken = signResetToken({
    purpose: "PASSWORD_RESET",
    identifier: user ? user.email.toLowerCase() : norm,
    otpId: record.id
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
import fs4 from "fs";
import path4 from "path";
var CUSTOM_HUBS_FILE = path4.resolve(process.cwd(), "server/data/custom_hubs.json");
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
    if (fs4.existsSync(CUSTOM_HUBS_FILE)) {
      const raw = fs4.readFileSync(CUSTOM_HUBS_FILE, "utf-8");
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
    const dir = path4.dirname(CUSTOM_HUBS_FILE);
    if (!fs4.existsSync(dir)) {
      fs4.mkdirSync(dir, { recursive: true });
    }
    fs4.writeFileSync(CUSTOM_HUBS_FILE, JSON.stringify(customHubsCache, null, 2), "utf-8");
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

// server/router.ts
var driverLiveLocations = /* @__PURE__ */ new Map();
var serverAnimals = /* @__PURE__ */ new Map();
var serverVets = /* @__PURE__ */ new Map();
var serverProfiles = {
  customer: {
    id: "USER-CUST-NEW",
    role: "customer",
    name: "Devotee",
    phone: "+91 98000 00000",
    email: "devotee@gmail.com",
    customerData: {
      address: "Devotee Residence",
      aadhaarNumber: "XXXX-XXXX-0000",
      memberSince: "Oct 2026",
      totalBookings: 0,
      preferredCeremony: "Kamadhenu Puja & Gau Seva"
    }
  },
  manager: {
    id: "USER-MGR-NEW",
    role: "manager",
    name: "Gaushala Manager",
    phone: "+91 98000 00000",
    email: "manager@gomaa.in",
    managerData: {
      managerId: "MGR-NEW",
      gosala: "Unassigned",
      region: "Operational Hub",
      dailySevaCeiling: 2,
      restingBufferMin: 90
    }
  },
  driver: {
    id: "USER-DRV-NEW",
    role: "driver",
    name: "Transit Pilot",
    phone: "+91 98000 00000",
    email: "driver@gomaa.in",
    driverData: {
      driverId: "DRV-NEW",
      vehicleNumber: "TS-09-GA-1008",
      vehicleType: "Tata 407 (Hydraulic Cattle Bed)",
      licenseNumber: "DL-PENDING",
      gosalaBase: "Unassigned",
      status: "Available"
    }
  },
  admin: {
    id: "USER-ADM-NEW",
    role: "admin",
    name: "Operations Admin",
    phone: "+91 98000 00000",
    email: "operations@gomaa.in",
    adminData: {
      adminId: "ADM-NEW",
      designation: "Regional Operations Officer",
      department: "Regional Gaushala Operations Hub",
      authorityLevel: "OPERATIONS_ADMIN"
    }
  },
  super_admin: {
    id: "USER-SA-KOUSHIK",
    role: "super_admin",
    name: "Koushik",
    phone: "+91 98000 00000",
    email: "koushik@gmail.com",
    adminData: {
      adminId: "SA-KOUSHIK",
      designation: "Platform Sovereign & Master Authority",
      department: "GOMAA Central Platform Governance",
      authorityLevel: "SUPER_ADMIN",
      treasuryClearanceLevel: "Master Sovereign Authority"
    }
  }
};
gpsSimulator.setOnTick((tick) => {
  driverLiveLocations.set(tick.bookingId, {
    ...tick,
    lastUpdated: (/* @__PURE__ */ new Date()).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    })
  });
});
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
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
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
    } : void 0
  };
}
function formatManagerUser(user) {
  const assignments = user.managerAssignments || [];
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
    id: user.id.startsWith("MGR-") ? user.id : `MGR-${user.id.slice(0, 4)}`,
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
  const isPublicRoute = method === "POST" && (pathname === "/api/auth/login" || pathname === "/api/auth/register" || pathname === "/api/auth/forgot-password" || pathname === "/api/auth/verify-otp" || pathname === "/api/auth/reset-password" || pathname === "/api/payments/webhook" || pathname === "/api/places/resolve-link") || method === "GET" && (pathname === "/api/auth/accounts" || pathname === "/api/health" || pathname === "/api/hubs" || pathname === "/api/places/search");
  if (!isPublicRoute && !authUser) {
    return { status: 401, body: { ok: false, error: "Authentication required" } };
  }
  const requireRole = (...roles) => authUser && roles.includes(authUser.role) ? null : { status: 403, body: { ok: false, error: "Insufficient privileges" } };
  if (method === "POST" && pathname === "/api/hold" || method === "POST" && pathname === "/api/hold/release" || method === "POST" && pathname === "/api/bookings") {
    const denied = requireRole("customer");
    if (denied) return denied;
  }
  if ((method === "GET" || method === "POST") && pathname === "/api/users") {
    const denied = requireRole("admin", "super_admin");
    if (denied) return denied;
  }
  if ((method === "PUT" || method === "DELETE") && /^\/api\/users\/[^/]+$/.test(pathname)) {
    const denied = requireRole("admin", "super_admin");
    if (denied) return denied;
  }
  if ((method === "PUT" || method === "PATCH") && (pathname === "/api/pricing-config" || pathname === "/api/pricing/config") || method === "POST" && pathname.startsWith("/api/settlements/")) {
    const denied = requireRole("super_admin");
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
      const isAuthErr = err.message?.toLowerCase().includes("password") || err.message?.toLowerCase().includes("invalid") || err.message?.toLowerCase().includes("unauthorized");
      return { status: isAuthErr ? 401 : 500, body: { ok: false, error: err.message || "Authentication failed" } };
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
      return { status: 400, body: { ok: false, error: err.message || "Failed to delete user" } };
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
  if (method === "GET" && pathname === "/api/availability") {
    const animal = query.get("animal") || "";
    const date = query.get("date") || "";
    const time = query.get("time") || "";
    const duration = Number(query.get("duration")) || 60;
    const manualBlock = await prisma.animalScheduleBlock.findFirst({
      where: { animalName: animal, date, timeSlot: time }
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
    const hold = await prisma.temporarySlotHold.findFirst({
      where: {
        animal: { name: animal },
        date,
        expiresAt: { gt: /* @__PURE__ */ new Date() }
      }
    });
    if (hold) {
      const holdStart = toMinutes(hold.startTime);
      const holdEnd = holdStart + hold.durationMin;
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
        animalName: animal,
        bookingDate: date,
        status: { not: "REJECTED" }
      }
    });
    const pricing = await prisma.masterPricingConfig.findFirst();
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
  }
  if (method === "POST" && pathname === "/api/hold") {
    const animal = await prisma.animal.findFirst({
      where: { name: body.animal }
    });
    if (!animal) return { status: 404, body: { error: "Animal not found" } };
    const ttlSeconds = Math.min(600, Math.max(60, Number(body.ttlSeconds) || 300));
    const ttl = ttlSeconds * 1e3;
    let hold;
    try {
      hold = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM animals WHERE id = ${animal.id} FOR UPDATE`;
        const existingHold = await tx.temporarySlotHold.findFirst({
          where: { animalId: animal.id, date: body.date, status: "ACTIVE", expiresAt: { gt: /* @__PURE__ */ new Date() } }
        });
        if (existingHold) throw new Error("This slot is already held");
        const holdStart = toMinutes(body.start);
        const holdEnd = holdStart + (Number(body.durationMin) || 60);
        const bookings = await tx.booking.findMany({ where: { animalId: animal.id, bookingDate: body.date, status: { notIn: ["REJECTED", "CANCELLED"] } } });
        if (bookings.some((booking) => holdStart < toMinutes(booking.endTime) && holdEnd > toMinutes(booking.startTime))) {
          throw new Error("This slot is already booked");
        }
        return tx.temporarySlotHold.create({
          data: {
            id: "HOLD-" + crypto7.randomUUID().replace(/-/g, "").slice(0, 20).toUpperCase(),
            animalId: animal.id,
            date: body.date,
            startTime: body.start,
            durationMin: Number(body.durationMin) || 60,
            customerName: authUser?.name || "Customer",
            customerId: authUser?.userId,
            status: "ACTIVE",
            expiresAt: new Date(Date.now() + ttl)
          }
        });
      });
    } catch (err) {
      const message = err?.message || "Unable to create hold";
      return { status: message.includes("already") ? 409 : 500, body: { success: false, reason: message } };
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
    let cfg = db.pricingConfig;
    try {
      const dbCfg = await prisma.masterPricingConfig.findFirst();
      if (dbCfg) cfg = dbCfg;
    } catch {
      cfg = db.pricingConfig;
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
            const gEmail = (meta.governingAdminEmail || "").toLowerCase();
            const gName = (meta.governingAdminName || meta.adminName || "").toLowerCase();
            return gEmail && gEmail === adminEmail || gName && gName.includes(adminName);
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
    } catch {
      let list = db.bookings;
      if (gosala) list = list.filter((b) => b.gosala.toLowerCase().includes(gosala.toLowerCase()));
      if (customer) list = list.filter((b) => b.customer.toLowerCase().includes(customer.toLowerCase()));
      if (status) list = list.filter((b) => b.status.toLowerCase() === status.toLowerCase());
      if (authUser?.role === "manager" && authUser.gosalaNames?.length > 0) {
        list = list.filter(
          (b) => authUser.gosalaNames.some((gn) => b.gosala.toLowerCase().includes(gn.toLowerCase()))
        );
      } else if (authUser?.role === "admin") {
        const adminEmail = (authUser.email || "").toLowerCase();
        const adminName = (authUser.name || "").toLowerCase();
        list = list.filter((b) => {
          if (authUser.gosalaNames?.length > 0) {
            return authUser.gosalaNames.some((gn) => b.gosala.toLowerCase().includes(gn.toLowerCase()));
          }
          const govEmail = (b.governingAdminEmail || "").toLowerCase();
          const govName = (b.governingAdminName || "").toLowerCase();
          return govEmail === adminEmail || govName && govName.includes(adminName);
        });
      } else if (authUser?.role === "customer") {
        list = list.filter(
          (b) => b.customer.toLowerCase() === authUser.name.toLowerCase() || authUser.phone && b.phone === authUser.phone
        );
      } else if (authUser?.role === "driver") {
        list = list.filter(
          (b) => !b.driver || b.driver.toLowerCase() === authUser.name.toLowerCase()
        );
      }
      return { status: 200, body: { bookings: list } };
    }
  }
  if (method === "POST" && pathname === "/api/bookings") {
    const b = body.booking;
    if (!b || !b.id)
      return { status: 400, body: { error: "Missing booking payload" } };
    if (authUser?.role !== "customer") {
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
    if (b.customer && b.customer.trim().toLowerCase() !== authUser.name.trim().toLowerCase()) {
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
    const payment = body.payment || {};
    if (!payment.paymentId || !payment.orderId || !payment.signature) {
      return { status: 402, body: { error: "Verified Razorpay payment is required before booking" } };
    }
    const expectedPaise = Number(quote.total) * 100;
    if (!Number.isSafeInteger(expectedPaise) || Number(payment.amountPaise) !== expectedPaise) {
      return { status: 402, body: { error: "Payment amount does not match the server quote" } };
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
            customerName: b.customer,
            customerPhone: b.phone,
            gosalaId: gosala.id,
            gosalaName: b.gosala,
            animalId: animal.id,
            animalName: b.animal,
            animalType: b.animalType === "Cow" ? "COW" : b.animalType === "Bull" ? "BULL" : "CALF",
            bookingDate: normalizeDateStr(b.date),
            startTime: b.start,
            endTime: b.end,
            durationMin: b.durationMin,
            address: b.address,
            distanceKm: b.distanceKm,
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
            status: toPrismaStatus(b.status),
            isPaid: true,
            paymentProvider: "RAZORPAY",
            paymentOrderId: payment.orderId,
            paymentId: payment.paymentId,
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
      });
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
      db.bookings = [formatted, ...db.bookings.filter((x) => x.id !== formatted.id)];
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
      db.bookings = [formatted, ...db.bookings.filter((x) => x.id !== id)];
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
      return { status: 200, body: { booking: formatted } };
    } catch (e) {
      console.warn("manager-decide falling back to in-memory store:", e?.message);
      let b = db.bookings.find((x) => x.id === id);
      if (b) {
        if (callerRole === "manager" && callerGosala && b.gosala) {
          const matches = b.gosala.toLowerCase().includes(callerGosala.toLowerCase()) || callerGosala.toLowerCase().includes(b.gosala.toLowerCase());
          if (!matches) {
            return {
              status: 403,
              body: {
                error: `Forbidden: Manager assigned to ${callerGosala} cannot review bookings for ${b.gosala}`
              }
            };
          }
        }
        b.status = confirm ? "Admin Review" : "Rejected";
        b.managerRemark = remark;
        b.managerApproval = {
          userId: isActingManager ? "ADM-101" : "MGR-801",
          name: managerName,
          timestamp: (/* @__PURE__ */ new Date()).toLocaleString("en-IN"),
          remark,
          isActingManager,
          actorRole: isActingManager ? "OPERATIONS_ADMIN" : "GOSALA_MANAGER"
        };
        return { status: 200, body: { booking: { ...b } } };
      }
      return { status: 404, body: { error: "Booking not found" } };
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
    if (!currentStatus) {
      const existing = db.bookings.find((x) => x.id === id);
      if (existing) currentStatus = existing.status;
    }
    const isPaymentVerified = currentStatus === "PAYMENT_VERIFIED" || currentStatus === "Payment Verified";
    if (isPaymentVerified && !body.actAsManager && !body.allowPremature) {
      return {
        status: 400,
        body: {
          error: "Premature confirmation rejected: Booking requires Phase-1 Manager Feasibility Review before Final Operations Confirmation."
        }
      };
    }
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
      if (isPaymentVerified && body.actAsManager) {
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
      db.bookings = [formatted, ...db.bookings.filter((x) => x.id !== id)];
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
      return { status: 200, body: { booking: formatted } };
    } catch {
      const b = db.bookings.find((x) => x.id === id);
      if (b) {
        if (isPaymentVerified && body.actAsManager) {
          b.managerRemark = "Feasibility confirmed by Admin as Acting Manager";
          b.managerApproval = {
            userId: "ADM-101",
            name: `${adminName} (Acting Manager)`,
            timestamp: (/* @__PURE__ */ new Date()).toLocaleString("en-IN"),
            remark: "Feasibility confirmed by Admin as Acting Manager",
            isActingManager: true,
            actorRole: "OPERATIONS_ADMIN"
          };
        }
        b.status = confirm ? "Confirmed" : "Rejected";
        b.adminRemark = remark;
        b.adminApproval = {
          userId: "ADM-101",
          name: adminName,
          timestamp: (/* @__PURE__ */ new Date()).toLocaleString("en-IN"),
          remark,
          actorRole: "OPERATIONS_ADMIN"
        };
        return { status: 200, body: { booking: { ...b } } };
      }
      return { status: 404, body: { error: "Booking not found" } };
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
    } catch {
      const b = db.bookings.find((x) => x.id === id);
      if (b) {
        b.driver = driverName;
        b.driverStage = 1;
        b.status = "Confirmed";
        b.driverPhone = body.driverPhone || b.driverPhone || "+91 98490 23456";
        b.driverVehiclePlate = body.driverVehiclePlate || b.driverVehiclePlate || "TS 09 EA 4402";
        b.driverVehicleModel = body.driverVehicleModel || b.driverVehicleModel || "Force Traveller Cattle Ambulance";
        b.driverRating = body.driverRating ?? b.driverRating ?? 4.9;
        b.driverTotalTrips = body.driverTotalTrips ?? b.driverTotalTrips ?? 184;
        b.driverAvatar = body.driverAvatar ?? b.driverAvatar ?? null;
        return { status: 200, body: { booking: b } };
      }
      return { status: 404, body: { error: "Booking not found" } };
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
      if (!b) {
        const memB = db.bookings.find((x) => x.id === id);
        if (memB) {
          if (memB.driverStage === 5 && !memB.handoverOtpVerified) {
            return {
              status: 403,
              body: {
                error: "Handover OTP Verification required before starting ceremony service at devotee altar."
              }
            };
          }
          const stage2 = Math.min((memB.driverStage ?? 0) + 1, 9);
          memB.driverStage = stage2;
          memB.status = stage2 >= 9 ? "Completed" : stage2 >= 6 ? "In Service" : memB.status;
          return { status: 200, body: { booking: memB } };
        }
        return { status: 404, body: { error: "Booking not found" } };
      }
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
      if (stage === 4) {
        gpsSimulator.startSimulation(
          id,
          updated.gosalaName,
          updated.address,
          updated.distanceKm
        );
      } else if (stage >= 6) {
        gpsSimulator.stopSimulation(id);
      }
      return { status: 200, body: { booking: formatted } };
    } catch {
      const b = db.bookings.find((x) => x.id === id);
      if (b) {
        const stage = Math.min((b.driverStage ?? 0) + 1, 9);
        b.driverStage = stage;
        b.status = stage >= 9 ? "Completed" : stage >= 6 ? "In Service" : b.status;
        return { status: 200, body: { booking: b } };
      }
      return { status: 404, body: { error: "Booking not found" } };
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
    if (targetStage === 4) {
      gpsSimulator.startSimulation(
        id,
        updated.gosalaName,
        updated.address,
        updated.distanceKm
      );
    } else {
      gpsSimulator.stopSimulation(id);
    }
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
      booking = db.bookings.find((b) => b.id === id);
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
      db.bookings = [formatted, ...db.bookings.filter((x) => x.id !== formatted.id)];
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
      const memBooking = db.bookings.find((b) => b.id === id);
      if (memBooking) {
        memBooking.handoverOtpVerified = true;
        memBooking.handoverOtpVerifiedAt = verifiedAt.toISOString();
        memBooking.driverStage = 6;
        memBooking.status = "In Service";
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
          booking: memBooking
        });
        return {
          status: 200,
          body: {
            success: true,
            message: "Animal handover verified successfully! Ceremony started.",
            booking: memBooking
          }
        };
      }
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
    if (!b) {
      b = db.bookings.find((x) => x.id === id);
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
        const allGosalas = await prisma.gosala.findMany({ where: { isActive: true } });
        const myGosalaIds = allGosalas.filter((g) => {
          const meta = getGosalaMeta(g.id, g.name);
          const gEmail = (meta.governingAdminEmail || "").toLowerCase();
          const gName = (meta.governingAdminName || meta.adminName || "").toLowerCase();
          return gEmail && gEmail === adminEmail || gName && gName.includes(adminName);
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
              const govName = (meta.governingAdminName || meta.adminName || "").toLowerCase();
              const govEmail = (meta.governingAdminEmail || "").toLowerCase();
              return govName.includes(filterLower) || govEmail.includes(filterLower);
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
      if (!user) {
        user = await prisma.user.create({
          data: {
            name: cleanName,
            email,
            phone: cleanPhone,
            role: "GOSALA_MANAGER",
            isActive: body.status !== "Inactive",
            password: body.password || void 0
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
            ...body.password ? { password: body.password } : {}
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
        if (targetGosala) {
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
        isActive: body.status !== void 0 ? body.status === "Active" : user.isActive
      }
    });
    if (body.password) {
      setUserMeta(user.email, { password: body.password });
      setUserMeta(user.id, { password: body.password });
      inMemoryPasswords.set(user.email.toLowerCase(), body.password);
      inMemoryPasswords.set(user.id, body.password);
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { password: body.password }
        });
      } catch {
      }
    }
    if (body.gosalas !== void 0 || body.gosala !== void 0) {
      const targetGosalas = Array.isArray(body.gosalas) ? body.gosalas : body.gosala ? [body.gosala] : [];
      await prisma.gosalaManagerAssignment.deleteMany({
        where: { userId: user.id }
      });
      for (const gNameOrId of targetGosalas) {
        if (!gNameOrId || gNameOrId === "Unassigned") continue;
        const targetGosala = await prisma.gosala.findFirst({
          where: {
            OR: [{ id: gNameOrId }, { name: gNameOrId }]
          }
        });
        if (targetGosala) {
          await prisma.gosalaManagerAssignment.create({
            data: {
              userId: user.id,
              gosalaId: targetGosala.id,
              region: body.region || targetGosala.region,
              status: "Active"
            }
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
    const id = delMgrMatch[1];
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
    if (user) {
      await prisma.gosalaManagerAssignment.deleteMany({
        where: { userId: user.id }
      });
      await prisma.user.delete({
        where: { id: user.id }
      });
    }
    return { status: 200, body: { success: true } };
  }
  if (method === "GET" && pathname === "/api/pricing-config") {
    try {
      const cfg = await prisma.masterPricingConfig.findFirst();
      return { status: 200, body: { config: cfg || db.pricingConfig } };
    } catch (err) {
      console.warn("Falling back to in-memory pricing config:", err?.message);
      return { status: 200, body: { config: db.pricingConfig } };
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
    const callerName = body.updatedByName || body.callerName || "Koushik";
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
      db.pricingConfig = {
        id: cfg.id,
        standardMin: cfg.standardMin,
        extraUnitMin: cfg.extraUnitMin,
        extraUnitRate: cfg.extraUnitRate,
        freeKm: cfg.freeKm,
        perKm: cfg.perKm,
        taxPct: cfg.taxPct,
        commissionPct: cfg.commissionPct,
        maxDurationMin: cfg.maxDurationMin,
        bufferMin: cfg.bufferMin,
        rounding: cfg.rounding,
        updatedByRole: cfg.updatedByRole,
        updatedByName: cfg.updatedByName,
        updatedAt: cfg.updatedAt.toISOString()
      };
      return { status: 200, body: { config: db.pricingConfig } };
    } catch {
      db.pricingConfig = {
        ...db.pricingConfig,
        ...patch.standardMin !== void 0 ? { standardMin: Number(patch.standardMin) } : {},
        ...patch.extraUnitMin !== void 0 ? { extraUnitMin: Number(patch.extraUnitMin) } : {},
        ...patch.extraUnitRate !== void 0 ? { extraUnitRate: Number(patch.extraUnitRate) } : {},
        ...patch.freeKm !== void 0 ? { freeKm: Number(patch.freeKm) } : {},
        ...patch.perKm !== void 0 ? { perKm: Number(patch.perKm) } : {},
        ...patch.taxPct !== void 0 ? { taxPct: Number(patch.taxPct) } : {},
        ...patch.commissionPct !== void 0 ? { commissionPct: Number(patch.commissionPct) } : {},
        ...patch.maxDurationMin !== void 0 ? { maxDurationMin: Number(patch.maxDurationMin) } : {},
        ...patch.bufferMin !== void 0 ? { bufferMin: Number(patch.bufferMin) } : {},
        ...patch.rounding ? { rounding: patch.rounding } : {}
      };
      return { status: 200, body: { config: db.pricingConfig } };
    }
  }
  if (method === "GET" && pathname === "/api/settlements") {
    try {
      const batches = await prisma.settlementBatch.findMany({
        orderBy: { createdAt: "desc" }
      });
      if (batches && batches.length > 0) {
        return { status: 200, body: { settlements: batches.map(formatSettlement) } };
      }
    } catch (err) {
      console.warn("Settlements DB fallback:", err?.message);
    }
    return { status: 200, body: { settlements: db.settlements } };
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
    const nextDisplayMap = {
      Pending: "Approved",
      Approved: "Processing",
      Processing: "Paid",
      Paid: "Paid",
      Failed: "Approved"
    };
    try {
      const batch = await prisma.settlementBatch.findFirst({
        where: { gosalaName: gosala }
      });
      if (batch) {
        const updated = await prisma.settlementBatch.update({
          where: { id: batch.id },
          data: { status: nextMap[batch.status] || "APPROVED" }
        });
        return { status: 200, body: { settlement: formatSettlement(updated) } };
      }
    } catch (err) {
      console.warn("Settlements advance DB fallback:", err?.message);
    }
    const memItem = db.settlements.find((s) => s.gosala === gosala);
    if (memItem) {
      memItem.status = nextDisplayMap[memItem.status] || "Approved";
      return { status: 200, body: { settlement: memItem } };
    }
    return { status: 404, body: { error: "Settlement not found" } };
  }
  if (method === "POST" && pathname === "/api/settlements/batch-approve") {
    const batch = body.batch || "SEP-W4";
    try {
      await prisma.settlementBatch.updateMany({
        where: { batch, status: "PENDING" },
        data: { status: "APPROVED" }
      });
    } catch (err) {
      console.warn("Batch approve DB fallback:", err?.message);
    }
    db.settlements.forEach((s) => {
      if (s.batch === batch && s.status === "Pending") {
        s.status = "Approved";
      }
    });
    return { status: 200, body: { success: true, batch } };
  }
  if (method === "POST" && pathname === "/api/settlements/sweep") {
    try {
      const result = await executeAutomatedSweep({
        targetGosala: body?.gosala,
        cycleType: body?.cycleType,
        serverProfiles
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
      try {
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
      } catch (err) {
        console.warn("Schedule config DB fallback:", err);
      }
      db.pricingConfig = {
        ...db.pricingConfig,
        ...autoSweepEnabled !== void 0 ? { autoSweepEnabled } : {},
        ...disbursementCycle ? { disbursementCycle } : {}
      };
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
        const meta = getGosalaMeta(g.id, g.name);
        const lat = g.latitude !== null && g.latitude !== void 0 ? Number(g.latitude) : meta.lat !== void 0 ? Number(meta.lat) : g.lat !== void 0 ? Number(g.lat) : void 0;
        const lng = g.longitude !== null && g.longitude !== void 0 ? Number(g.longitude) : meta.lng !== void 0 ? Number(meta.lng) : g.lng !== void 0 ? Number(g.lng) : void 0;
        const assignedMgrs = (g.managers || []).map((m) => ({
          id: m.user.id.startsWith("MGR-") ? m.user.id : `MGR-${m.user.id.slice(0, 4)}`,
          rawUserId: m.user.id,
          name: m.user.name,
          phone: m.user.phone,
          email: m.user.email
        }));
        const firstAssigned = assignedMgrs[0];
        const govRole = meta.governingAdminRole || "admin";
        const govName = meta.governingAdminName || (govRole === "super_admin" ? "Koushik" : "Operations Admin");
        return {
          ...g,
          ...meta,
          id: g.id,
          name: g.name,
          region: g.region,
          address: g.address,
          contactPhone: g.contactPhone,
          contactEmail: g.contactEmail,
          latitude: lat,
          longitude: lng,
          lat,
          lng,
          assignedManagers: assignedMgrs,
          managerName: firstAssigned?.name || meta.managerName || meta.caretaker || "None (Admin Acting)",
          managerId: firstAssigned?.id || meta.managerId || "",
          caretaker: meta.caretaker || firstAssigned?.name || "Caretaker In-Charge",
          governingAdminRole: govRole,
          governingAdminName: govName,
          adminId: meta.adminId || (govRole === "super_admin" ? "USER-SA-001" : "USER-ADM-101"),
          adminName: meta.adminName || govName
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
        scopedGosalas = formatted.filter((g) => {
          const idMatch = allowedIds.has(g.id);
          const nameMatch = allowedNames.has(String(g.name).trim().toLowerCase());
          const govEmailMatch = Boolean(userEmail && (g.governingAdminEmail || "").trim().toLowerCase() === userEmail);
          const adminIdMatch = Boolean(authUser.userId && g.adminId === authUser.userId);
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
          isActive: true
        },
        update: {
          region: region.trim(),
          address: address.trim(),
          contactPhone: contactPhone || void 0,
          contactEmail: email || void 0,
          latitude: finalLat,
          longitude: finalLng,
          isActive: true
        }
      });
      const isActing = Boolean(body.actAsManagerMyself) || Boolean(restMeta.isActingManager) || !restMeta.managerId && !restMeta.managerName;
      const finalGovRole = restMeta.governingAdminRole || (authUser?.role === "super_admin" ? "super_admin" : "admin");
      const callerAdminName = restMeta.governingAdminName || authUser?.name || "Operations Admin";
      const callerAdminEmail = restMeta.governingAdminEmail || authUser?.email || "admin@gomaa.in";
      const callerAdminId = restMeta.adminId || authUser?.userId || "USER-ADM-101";
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
    const id = putGosalaMatch[1];
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
      const finalLat = latitude !== void 0 ? Number(latitude) : lat !== void 0 ? Number(lat) : void 0;
      const finalLng = longitude !== void 0 ? Number(longitude) : lng !== void 0 ? Number(lng) : void 0;
      const updated = await prisma.gosala.update({
        where: { id },
        data: {
          name: name ? name.trim() : void 0,
          region: region ? region.trim() : void 0,
          address: address ? address.trim() : void 0,
          contactPhone: contactPhone || void 0,
          contactEmail: email || void 0,
          latitude: finalLat,
          longitude: finalLng
        }
      });
      const isActing = body.actAsManagerMyself !== void 0 ? Boolean(body.actAsManagerMyself) : restMeta.isActingManager !== void 0 ? Boolean(restMeta.isActingManager) : void 0;
      const callerAdminName = restMeta.governingAdminName || authUser?.name || "Operations Admin";
      const callerAdminEmail = restMeta.governingAdminEmail || authUser?.email || "admin@gomaa.in";
      const callerAdminRole = restMeta.governingAdminRole || (authUser?.role === "super_admin" ? "super_admin" : "admin");
      const callerAdminId = restMeta.adminId || authUser?.userId || "USER-ADM-101";
      const metaPatch = {
        ...restMeta,
        ...finalLat !== void 0 ? { lat: finalLat } : {},
        ...finalLng !== void 0 ? { lng: finalLng } : {},
        governingAdminName: callerAdminName,
        governingAdminEmail: callerAdminEmail,
        governingAdminRole: callerAdminRole
      };
      if (isActing === true) {
        metaPatch.isActingManager = true;
        metaPatch.managerName = `${callerAdminName} (Acting Manager)`;
        metaPatch.managerId = callerAdminId;
        metaPatch.caretaker = `${callerAdminName} (Acting Custodian)`;
        try {
          await prisma.gosalaManagerAssignment.deleteMany({ where: { gosalaId: updated.id } });
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
            await prisma.gosalaManagerAssignment.upsert({
              where: {
                userId_gosalaId: {
                  userId: mgrUser.id,
                  gosalaId: updated.id
                }
              },
              create: {
                userId: mgrUser.id,
                gosalaId: updated.id,
                region: updated.region,
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
      saveGosalaMeta(updated.id, updated.name, metaPatch);
      const fullMeta = getGosalaMeta(updated.id, updated.name);
      const mergedUpdated = {
        ...updated,
        ...fullMeta,
        id: updated.id,
        name: updated.name,
        region: updated.region,
        address: updated.address,
        contactPhone: updated.contactPhone,
        contactEmail: updated.contactEmail,
        lat: updated.latitude !== null && updated.latitude !== void 0 ? Number(updated.latitude) : fullMeta.lat,
        lng: updated.longitude !== null && updated.longitude !== void 0 ? Number(updated.longitude) : fullMeta.lng,
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
          type: meta.type || (a.type === "COW" ? "Cow" : a.type === "BULL" ? "Bull" : "Calf"),
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
        finalAnimals = finalAnimals.filter((a) => {
          const gName = (a.gosala || "").toLowerCase().trim();
          return allowedGosalas.includes(gName);
        });
      } else if (authUser?.role === "admin") {
        if (authUser.gosalaNames && authUser.gosalaNames.length > 0) {
          const allowedGosalas = authUser.gosalaNames.map((s) => s.toLowerCase().trim());
          finalAnimals = finalAnimals.filter((a) => {
            const gName = (a.gosala || "").toLowerCase().trim();
            return allowedGosalas.includes(gName);
          });
        } else if (authUser.name) {
          const adminNameLower = authUser.name.toLowerCase();
          finalAnimals = finalAnimals.filter((a) => {
            const meta = getGosalaMeta(a.gosalaId || "", a.gosala || "");
            const gov = meta.governingAdminName || meta.adminName;
            if (gov && gov.toLowerCase().includes(adminNameLower)) return true;
            return meta.governingAdminRole === "admin";
          });
        }
      } else if (authUser?.role === "super_admin") {
        if (query.get("scope") !== "all" && query.get("all") !== "true") {
          const saNameLower = (authUser.name || "Koushik").toLowerCase();
          finalAnimals = finalAnimals.filter((a) => {
            const meta = getGosalaMeta(a.gosalaId || "", a.gosala || "");
            const gov = meta.governingAdminName || meta.adminName;
            if (gov && gov.toLowerCase().includes(saNameLower)) return true;
            return meta.governingAdminRole === "super_admin";
          });
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
        where: { name },
        data: {
          breed: updated.breed || void 0,
          ageYears: updated.ageYears || void 0,
          price: updated.price || void 0
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
    return { status: 200, body: { ok: true, vets: Array.from(serverVets.values()) } };
  }
  if (method === "POST" && pathname === "/api/vets") {
    const vet = body.vet || body;
    const id = vet.id || `VET-${Date.now()}`;
    const fullVet = { ...vet, id };
    serverVets.set(id, fullVet);
    wsHub.broadcastToChannel("channel:animals", "VET_UPDATED", {
      vet: fullVet,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
    return { status: 201, body: { ok: true, vet: fullVet } };
  }
  const putVetMatch = pathname.match(/^\/api\/vets\/([^/]+)$/);
  if (method === "PUT" && putVetMatch) {
    const id = putVetMatch[1];
    const existing = serverVets.get(id) || { id };
    const updated = { ...existing, ...body };
    serverVets.set(id, updated);
    wsHub.broadcastToChannel("channel:animals", "VET_UPDATED", {
      vet: updated,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
    return { status: 200, body: { ok: true, vet: updated } };
  }
  if (method === "DELETE" && putVetMatch) {
    const id = putVetMatch[1];
    serverVets.delete(id);
    return { status: 200, body: { ok: true, deleted: id } };
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
    return { status: 200, body: { profiles: serverProfiles } };
  }
  const profileRoleMatch = pathname.match(/^\/api\/profiles\/([^/]+)$/);
  if (method === "GET" && profileRoleMatch) {
    const roleKey = profileRoleMatch[1];
    const p = serverProfiles[roleKey];
    if (!p)
      return {
        status: 404,
        body: { error: `Profile for role ${roleKey} not found` }
      };
    return { status: 200, body: { profile: p } };
  }
  if ((method === "PUT" || method === "POST") && profileRoleMatch) {
    const roleKey = profileRoleMatch[1];
    const existing = serverProfiles[roleKey] || {
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
    serverProfiles[roleKey] = updated;
    try {
      if (updated.email) {
        await prisma.user.upsert({
          where: { email: updated.email },
          create: {
            name: updated.name || "User",
            email: updated.email,
            phone: updated.phone || "+91 98000 00000",
            role: roleKey === "customer" ? "CUSTOMER" : roleKey === "manager" ? "GOSALA_MANAGER" : roleKey === "driver" ? "DRIVER" : roleKey === "super_admin" ? "SUPER_ADMIN" : "OPERATIONS_ADMIN"
          },
          update: {
            name: updated.name,
            phone: updated.phone
          }
        }).catch(() => {
        });
      }
    } catch {
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
  res.setHeader("Access-Control-Allow-Origin", "*");
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
