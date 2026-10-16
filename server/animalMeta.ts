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
const DEFAULT_SEEDS: Record<string, AnimalRichMeta> = {}


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
