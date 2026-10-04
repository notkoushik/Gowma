import fs from "fs"
import path from "path"

const META_FILE_PATH = path.resolve(process.cwd(), "server/data/gosalas_meta.json")

interface GosalaRichMeta {
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
  managerId?: string
  managerName?: string
}

// In-memory cache backed by server/data/gosalas_meta.json
let metaStore: Record<string, GosalaRichMeta> = {}

function loadMetaStore() {
  try {
    if (fs.existsSync(META_FILE_PATH)) {
      const raw = fs.readFileSync(META_FILE_PATH, "utf-8")
      metaStore = JSON.parse(raw)
    }
  } catch (err) {
    console.warn("Could not load gosalas_meta.json:", err)
    metaStore = {}
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
    console.error("Failed to save gosalas_meta.json:", err)
  }
}

// Initial load
loadMetaStore()

export function getGosalaMeta(id: string, name?: string): GosalaRichMeta {
  if (metaStore[id]) return metaStore[id]
  if (name) {
    const normalizedName = name.trim().toLowerCase()
    for (const [key, val] of Object.entries(metaStore)) {
      if (key.toLowerCase() === normalizedName) return val
    }
  }
  return {}
}

export function saveGosalaMeta(
  id: string,
  name: string,
  meta: Partial<GosalaRichMeta>,
) {
  const existing = { ...(metaStore[id] || (name ? metaStore[name.trim().toLowerCase()] : {}) || {}) }
  const updated: GosalaRichMeta = {
    ...existing,
    ...meta,
  }

  // Filter out undefined values to keep clean
  Object.keys(updated).forEach((k) => {
    if ((updated as any)[k] === undefined) {
      delete (updated as any)[k]
    }
  })

  metaStore[id] = updated
  if (name) {
    metaStore[name.trim().toLowerCase()] = updated
  }

  persistMetaStore()
}

export function deleteGosalaMeta(id: string, name?: string) {
  delete metaStore[id]
  if (name) {
    delete metaStore[name.trim().toLowerCase()]
  }
  persistMetaStore()
}
