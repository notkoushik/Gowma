import { prisma } from "./prisma.ts"

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

// In-memory cache backed by PostgreSQL `animals.metadata`
let metaStore: Record<string, AnimalRichMeta> = {}
let isInitialized = false

async function initMetaStore() {
  if (isInitialized) return
  try {
    const animals = await prisma.animal.findMany({
      select: { id: true, name: true, metadata: true }
    })
    for (const a of animals) {
      if (a.metadata && typeof a.metadata === "object") {
        if (a.id) metaStore[a.id] = a.metadata as AnimalRichMeta
        if (a.name) metaStore[a.name.trim().toLowerCase()] = a.metadata as AnimalRichMeta
      }
    }
    isInitialized = true
  } catch (err) {
    console.warn("[animalMeta] Could not preload animals metadata from DB:", (err as any)?.message)
  }
}

// Trigger initial load
initMetaStore().catch(() => {})

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

  // Persist to PostgreSQL asynchronously
  prisma.animal.findFirst({
    where: {
      OR: [
        { name: { equals: name.trim(), mode: "insensitive" } },
        { id: name.trim() }
      ]
    }
  }).then(async (animal) => {
    if (animal) {
      metaStore[animal.id] = updated
      metaStore[animal.name.trim().toLowerCase()] = updated
      await prisma.animal.update({
        where: { id: animal.id },
        data: { metadata: updated as any }
      })
    }
  }).catch((err) => {
    console.error(`[animalMeta] Failed to persist metadata to DB for ${name}:`, err.message)
  })
}

export function deleteAnimalMeta(name: string) {
  if (!name) return
  const normalized = name.trim().toLowerCase()
  delete metaStore[normalized]

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
      })
    }
  }).catch(() => {})
}
