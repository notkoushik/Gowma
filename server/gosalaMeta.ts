import { prisma } from "./prisma.ts"

export interface GosalaRichMeta {
  photo?: string
  photos?: string[]
  trustRegistrationNo?: string
  capacity?: number
  establishedYear?: string
  landAcres?: number
  visitingHours?: string
  caretaker?: string
  caretakerPhone?: string
  caretakerShift?: string
  caretakerQuarters?: string
  facilities?: string[]
  customDetails?: any[]
  additionalStaff?: any[]
  notes?: string
  status?: string
  items?: any[]
  lat?: number
  lng?: number
  adminId?: string
  adminName?: string
  governingAdminRole?: "super_admin" | "admin" | string
  governingAdminName?: string
  governingAdminEmail?: string
  isActingManager?: boolean
  managerId?: string
  managerName?: string
}

// In-memory cache backed by PostgreSQL `gosalas.metadata`
let metaStore: Record<string, GosalaRichMeta> = {}
let isInitialized = false

async function initMetaStore() {
  if (isInitialized) return
  try {
    const gosalas = await prisma.gosala.findMany({
      select: { id: true, name: true, metadata: true }
    })
    for (const g of gosalas) {
      if (g.metadata && typeof g.metadata === "object") {
        if (g.id) metaStore[g.id] = g.metadata as GosalaRichMeta
        if (g.name) metaStore[g.name.trim().toLowerCase()] = g.metadata as GosalaRichMeta
      }
    }
    isInitialized = true
  } catch (err) {
    console.warn("[gosalaMeta] Could not preload gosalas metadata from DB:", (err as any)?.message)
  }
}

// Trigger initial load
initMetaStore().catch(() => {})

export function getGosalaMeta(id: string, name?: string): GosalaRichMeta {
  if (id && metaStore[id]) return metaStore[id]
  if (name) {
    const normalizedName = name.trim().toLowerCase()
    if (metaStore[normalizedName]) return metaStore[normalizedName]
    for (const [key, val] of Object.entries(metaStore)) {
      if (key.toLowerCase() === normalizedName) return val
    }
  }
  return {}
}

export async function saveGosalaMetaAsync(
  id: string,
  name: string,
  meta: Partial<GosalaRichMeta>,
): Promise<GosalaRichMeta> {
  const existing = { ...(metaStore[id] || (name ? metaStore[name.trim().toLowerCase()] : {}) || {}) }
  const updated: GosalaRichMeta = {
    ...existing,
    ...meta,
  }

  // Filter out undefined values
  Object.keys(updated).forEach((k) => {
    if ((updated as any)[k] === undefined) {
      delete (updated as any)[k]
    }
  })

  if (id) metaStore[id] = updated
  if (name) metaStore[name.trim().toLowerCase()] = updated

  try {
    const gosala = await prisma.gosala.findFirst({
      where: {
        OR: [
          ...(id ? [{ id }] : []),
          ...(name ? [{ name: { equals: name, mode: "insensitive" as const } }] : [])
        ]
      }
    })
    if (gosala) {
      metaStore[gosala.id] = updated
      metaStore[gosala.name.trim().toLowerCase()] = updated
      await prisma.gosala.update({
        where: { id: gosala.id },
        data: { metadata: updated as any }
      })
    }
  } catch (err: any) {
    console.error(`[gosalaMeta] Failed to persist metadata to DB for ${name || id}:`, err.message)
  }
  return updated
}

export function saveGosalaMeta(
  id: string,
  name: string,
  meta: Partial<GosalaRichMeta>,
) {
  saveGosalaMetaAsync(id, name, meta).catch(() => {})
}

export function deleteGosalaMeta(id: string, name?: string) {
  if (id) delete metaStore[id]
  if (name) delete metaStore[name.trim().toLowerCase()]

  prisma.gosala.findFirst({
    where: {
      OR: [
        ...(id ? [{ id }] : []),
        ...(name ? [{ name: { equals: name, mode: "insensitive" as const } }] : [])
      ]
    }
  }).then(async (gosala) => {
    if (gosala) {
      await prisma.gosala.update({
        where: { id: gosala.id },
        data: { metadata: {} }
      })
    }
  }).catch(() => {})
}
