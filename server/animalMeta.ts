import fs from "fs"
import path from "path"

const META_FILE_PATH = path.resolve(process.cwd(), "server/data/animals_meta.json")

export interface AnimalRichMeta {
  name?: string
  tagId?: string
  type?: string
  breed?: string
  gosala?: string
  age?: string
  ageYears?: number
  weight?: string
  height?: string
  category?: string
  price?: number
  status?: string
  assignedHandler?: string
  lactationStatus?: string
  temperament?: string
  sacredMarks?: string
  diet?: string
  healthNotes?: string
  photo?: string
  photos?: string[]
  vetInfo?: any
  dietInfo?: any
  customDetails?: any[]
  maxDailyTrips?: number
  maxRadiusKm?: number
  cooldownMinutes?: number
}

// In-memory cache backed by server/data/animals_meta.json
let metaStore: Record<string, AnimalRichMeta> = {}

// Seed data based on manager registration if file doesn't exist
const DEFAULT_SEEDS: Record<string, AnimalRichMeta> = {
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
    category: "Ceremonial · Puja & Griha Pravesh",
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
    cooldownMinutes: 90,
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
    category: "Ceremonial · Puja & Griha Pravesh",
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
    cooldownMinutes: 90,
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
    cooldownMinutes: 90,
  },
}

function loadMetaStore() {
  try {
    if (fs.existsSync(META_FILE_PATH)) {
      const raw = fs.readFileSync(META_FILE_PATH, "utf-8")
      metaStore = JSON.parse(raw)
    } else {
      metaStore = { ...DEFAULT_SEEDS }
      persistMetaStore()
    }
  } catch (err) {
    console.warn("Could not load animals_meta.json:", err)
    metaStore = { ...DEFAULT_SEEDS }
  }
}

function persistMetaStore() {
  try {
    const dir = path.dirname(META_FILE_PATH)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(META_FILE_PATH, JSON.stringify(metaStore, null, 2), "utf-8")
  } catch (err) {
    console.error("Failed to save animals_meta.json:", err)
  }
}

// Initial load
loadMetaStore()

export function getAnimalMeta(name: string): AnimalRichMeta {
  if (!name) return {}
  const normalized = name.trim().toLowerCase()
  if (metaStore[normalized]) return metaStore[normalized]

  // Fuzzy find
  for (const [key, val] of Object.entries(metaStore)) {
    if (key.toLowerCase() === normalized || key.toLowerCase().includes(normalized) || normalized.includes(key.toLowerCase())) {
      return val
    }
  }
  return {}
}

export function getAllAnimalMeta(): Record<string, AnimalRichMeta> {
  return metaStore
}

export function saveAnimalMeta(name: string, meta: Partial<AnimalRichMeta>) {
  if (!name) return
  const normalized = name.trim().toLowerCase()
  const existing = metaStore[normalized] || {}
  const updated: AnimalRichMeta = {
    ...existing,
    ...meta,
    name: meta.name || existing.name || name.trim(),
  }

  // Filter undefined
  Object.keys(updated).forEach((k) => {
    if ((updated as any)[k] === undefined) {
      delete (updated as any)[k]
    }
  })

  metaStore[normalized] = updated
  persistMetaStore()
}

export function deleteAnimalMeta(name: string) {
  if (!name) return
  const normalized = name.trim().toLowerCase()
  delete metaStore[normalized]
  persistMetaStore()
}
