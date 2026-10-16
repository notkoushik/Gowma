import fs from "fs"
import path from "path"

export interface OperationalHub {
  id: string
  state: string
  city: string
  name: string
  zone: "North" | "South" | "East" | "West" | "Central" | "Rural"
  lat: number
  lng: number
  defaultMaxRadiusKm: number
  pincodePrefixes: string[]
  isFeatured?: boolean
  isCustom?: boolean
  createdAt?: string
}

const CUSTOM_HUBS_FILE = path.resolve(process.cwd(), "server/data/custom_hubs.json")

// Baseline Curated Indian Metropolitan and Pilgrimage Hubs
const BASELINE_INDIAN_HUBS: OperationalHub[] = [
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
    isFeatured: true,
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
    isFeatured: true,
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
    isFeatured: true,
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
    isFeatured: true,
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
    pincodePrefixes: ["506001", "506002"],
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
    isFeatured: true,
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
    isFeatured: true,
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
    pincodePrefixes: ["530001", "530017"],
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
    isFeatured: true,
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
    isFeatured: true,
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
    isFeatured: true,
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
    isFeatured: true,
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
    isFeatured: true,
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
    pincodePrefixes: ["570001", "570010"],
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
    isFeatured: true,
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
    pincodePrefixes: ["395001", "395007"],
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
    isFeatured: true,
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
    isFeatured: true,
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
    isFeatured: true,
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
    isFeatured: true,
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
    isFeatured: true,
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
    pincodePrefixes: ["641001", "641018"],
  },
]

// In-memory cache for custom hubs loaded from disk
let customHubsCache: OperationalHub[] = []
let isLoaded = false

function ensureCustomHubsLoaded() {
  if (isLoaded) return
  try {
    if (fs.existsSync(CUSTOM_HUBS_FILE)) {
      const raw = fs.readFileSync(CUSTOM_HUBS_FILE, "utf-8")
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        customHubsCache = parsed
      }
    }
  } catch (err) {
    console.warn("[HubService] Could not read custom_hubs.json:", err)
    customHubsCache = []
  } finally {
    isLoaded = true
  }
}

function persistCustomHubs() {
  try {
    const dir = path.dirname(CUSTOM_HUBS_FILE)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(CUSTOM_HUBS_FILE, JSON.stringify(customHubsCache, null, 2), "utf-8")
  } catch (err) {
    console.error("[HubService] Failed to write custom_hubs.json:", err)
  }
}

/**
 * Returns all active operational hubs (Baseline + Custom registered hubs)
 */
export function getAllOperationalHubs(): OperationalHub[] {
  ensureCustomHubsLoaded()
  return [...BASELINE_INDIAN_HUBS, ...customHubsCache]
}

/**
 * Register a new dynamic operational hub
 */
export function createOperationalHub(payload: {
  state: string
  city: string
  name: string
  zone?: "North" | "South" | "East" | "West" | "Central" | "Rural"
  lat: number
  lng: number
  defaultMaxRadiusKm?: number
  pincodePrefixes?: string[]
}): OperationalHub {
  ensureCustomHubsLoaded()

  const cleanState = (payload.state || "").trim()
  const cleanCity = (payload.city || "").trim()
  const cleanName = (payload.name || "").trim()

  if (!cleanState) {
    throw new Error("State is required to register an operational hub.")
  }
  if (!cleanCity) {
    throw new Error("City / District name is required.")
  }
  if (!cleanName) {
    throw new Error("Hub / Sanctuary belt name is required.")
  }

  const lat = Number(payload.lat)
  const lng = Number(payload.lng)
  if (isNaN(lat) || isNaN(lng) || lat < 6 || lat > 38 || lng < 68 || lng > 98) {
    throw new Error("Valid geographic coordinates within India are required.")
  }

  // Derive zone if not provided
  let zone = payload.zone || "Central"
  const sLower = cleanState.toLowerCase()
  if (sLower.includes("karnataka") || sLower.includes("tamil") || sLower.includes("kerala") || sLower.includes("andhra") || sLower.includes("telangana")) {
    zone = "South"
  } else if (sLower.includes("delhi") || sLower.includes("uttar") || sLower.includes("punjab") || sLower.includes("haryana")) {
    zone = "North"
  } else if (sLower.includes("maharashtra") || sLower.includes("gujarat") || sLower.includes("rajasthan") || sLower.includes("goa")) {
    zone = "West"
  } else if (sLower.includes("bengal") || sLower.includes("odisha") || sLower.includes("bihar") || sLower.includes("assam")) {
    zone = "East"
  }

  const slug = `${cleanCity.toLowerCase().replace(/[^a-z0-9]/g, "")}-${Date.now().toString(36)}`
  const newHub: OperationalHub = {
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
    createdAt: new Date().toISOString(),
  }

  customHubsCache.push(newHub)
  persistCustomHubs()
  return newHub
}

/**
 * Calculates great-circle Haversine distance in kilometers
 */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.round(R * c * 10) / 10
}

/**
 * Fast lookup to find closest operational hub from given coordinates
 */
export function findNearestOperationalHub(
  lat: number,
  lng: number
): { hub: OperationalHub; distanceKm: number } {
  const allHubs = getAllOperationalHubs()
  let closest = allHubs[0]
  let minDist = Infinity

  for (const h of allHubs) {
    const d = haversineKm(lat, lng, h.lat, h.lng)
    if (d < minDist) {
      minDist = d
      closest = h
    }
  }

  return { hub: closest, distanceKm: minDist }
}
