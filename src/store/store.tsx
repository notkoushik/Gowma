import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from "lucide-react"
import {
  type Booking,
  type BookingStatus,
  type ApprovalRecord,
  type GosalaManager,
  type Settlement,
} from "../data/mock"
import { tripStages } from "../data/driver"
import type { RoleId } from "../data/roles"
import {
  type Animal,
  type AnimalOperationalStatus,
  type EmpanelledVet,
} from "../data/animals"
import {
  type Gosala,
  GOSALA_PHOTO_PRESETS,
} from "../data/gosalas"
import { initialProfiles, type RoleProfile } from "../data/profiles"
import { api } from "../services/api"

export type { Gosala } from "../data/gosalas"

/* ---------------- Professional Toasts & Alerts ---------------- */
export type ToastTone = "ok" | "info" | "danger" | "warn" | "err"
export type Toast = {
  id: string
  msg: string
  tone: ToastTone
  count: number
  timerId?: any
}

export type AppNotification = {
  id: string
  title: string
  message: string
  timestamp: string
  category: "welfare" | "booking" | "transport" | "system"
  tone: ToastTone
  read: boolean
  bookingId?: string
}

const ToastCtx = createContext<{
  notify: (msg: string, tone?: ToastTone) => void
  dismiss: (id: string) => void
}>({
  notify: () => {},
  dismiss: () => {},
})
export const useToast = () => useContext(ToastCtx)

/* ---------------- Pricing Configuration ---------------- */
export type PricingConfig = {
  standardMin: number
  extraUnitMin: number
  extraUnitRate: number
  freeKm: number
  perKm: number
  taxPct: number
  commissionPct: number
  maxDurationMin: number
  bufferMin: number
  rounding: string
}

export const defaultPricingConfig: PricingConfig = {
  standardMin: 60,
  extraUnitMin: 30,
  extraUnitRate: 500,
  freeKm: 5,
  perKm: 50,
  taxPct: 12,
  commissionPct: 20,
  maxDurationMin: 240,
  bufferMin: 30,
  rounding: "Nearest ₹10",
}

export type SlotAvailabilityStatus = "Available" | "Booked" | "Blocked" | "Buffer"

export type SlotCheckResult = {
  available: boolean
  status: SlotAvailabilityStatus
  bookingId?: string
  customer?: string
  reason?: string
}

/* ---------------- Bookings store ---------------- */
type Store = {
  bookings: Booking[]
  animals: Animal[]
  pricingConfig: PricingConfig
  blockedSlots: Record<string, string[]>
  managers: GosalaManager[]
  settlements: Settlement[]
  profiles: Record<RoleId, RoleProfile>
  activeProfile: RoleProfile
  updateProfile: (role: RoleId, updates: Partial<RoleProfile>) => Promise<void>
  currentRole: RoleId | null
  setCurrentRole: (r: RoleId | null) => void
  createBooking: (b: Booking, holdId?: string) => void
  managerDecide: (
    id: string,
    confirm: boolean,
    remark: string,
    managerName?: string,
    rejectionCode?: string,
  ) => void
  adminDecide: (
    id: string,
    confirm: boolean,
    remark: string,
    adminName?: string,
  ) => void
  assignDriver: (id: string, driver: string) => void
  assignPorterTransport: (
    bookingId: string,
    porterData: {
      vehicleType: string
      fare: number
      driverName: string
      driverPhone: string
    },
  ) => void
  advanceTrip: (id: string) => void
  updatePricing: (patch: Partial<PricingConfig>) => void
  toggleSlotBlock: (animal: string, date: string, time: string) => void
  updateAnimalStatus: (
    name: string,
    status: AnimalOperationalStatus,
    note?: string,
  ) => void
  updateAnimalWelfareConfig: (
    animalName: string,
    config: {
      maxDailyTrips?: number
      cooldownMinutes?: number
      maxRadiusKm?: number
    },
  ) => void
  checkAnimalAvailability: (
    animal: string,
    date: string,
    time: string,
    durationMin?: number,
  ) => SlotCheckResult
  addAnimal: (animal: Animal) => void
  updateAnimal: (name: string, patch: Partial<Animal>) => void
  deleteAnimal: (name: string) => void
  vets: EmpanelledVet[]
  addVet: (vet: EmpanelledVet) => void
  updateVet: (id: string, patch: Partial<EmpanelledVet>) => void
  deleteVet: (id: string) => void
  gosalas: Gosala[]
  activeGosalaFilter: string
  setActiveGosalaFilter: (name: string) => void
  activeManagerGosala: string
  setActiveManagerGosala: (name: string) => void
  addGosala: (gosala: Omit<Gosala, "id"> | Gosala) => Gosala
  updateGosala: (id: string, patch: Partial<Gosala>) => void
  deleteGosala: (id: string) => void
  addManager: (mgr: Omit<GosalaManager, "id" | "assignedDate"> & { gosalas?: string[] }) => void
  updateManager: (id: string, patch: Partial<GosalaManager> & { gosalas?: string[] }) => void
  toggleManagerStatus: (id: string) => void
  deleteManager: (id: string) => void
  advanceSettlement: (gosala: string) => void
  approveSettlementBatch: (batch: string) => void
  notify: (msg: string, tone?: ToastTone) => void
  patchBookingFromWs: (b: Partial<Booking> & { id: string }) => void
  notifications: AppNotification[]
  markNotificationRead: (id: string) => void
  markAllNotificationsRead: () => void
  clearNotifications: () => void
}

const StoreCtx = createContext<Store | null>(null)

export function useStore() {
  const ctx = useContext(StoreCtx)
  if (!ctx) throw new Error("useStore must be used within AppProvider")
  return ctx
}

// Convert "HH:MM" to minutes from midnight
function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number)
  return (h || 0) * 60 + (m || 0)
}

export function AppProvider({ children }: { children: ReactNode }) {
  // One-time client cache purge to align browser with zero-state clean database
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      if (!localStorage.getItem("gomaa_cleaned_v2")) {
        localStorage.removeItem("gomaa_gosalas")
        localStorage.removeItem("gomaa_sacred_animals")
        localStorage.removeItem("gomaa_empanelled_vets")
        localStorage.removeItem("gomaa_managers")
        localStorage.removeItem("gomaa_settlements")
        localStorage.removeItem("gomaa_bookings")
        localStorage.setItem("gomaa_cleaned_v2", "true")
      }
    } catch {}
  }

  const [bookings, setBookings] = useState<Booking[]>(() => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const saved = localStorage.getItem("gomaa_bookings")
        if (saved) return JSON.parse(saved)
      }
    } catch {}
    return []
  })
  const [animals, setAnimals] = useState<Animal[]>(() => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const saved = localStorage.getItem("gomaa_sacred_animals")
        if (saved) return JSON.parse(saved)
      }
    } catch {}
    return []
  })
  const [vets, setVets] = useState<EmpanelledVet[]>(() => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const saved = localStorage.getItem("gomaa_empanelled_vets")
        if (saved) return JSON.parse(saved)
      }
    } catch {}
    return []
  })
  const [gosalas, setGosalas] = useState<Gosala[]>(() => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const saved = localStorage.getItem("gomaa_gosalas")
        if (saved) {
          const parsed = JSON.parse(saved)
          if (Array.isArray(parsed) && parsed.length > 0) return parsed
        }
      }
    } catch {}
    return []
  })
  const [activeGosalaFilter, setActiveGosalaFilter] = useState<string>("ALL")
  const [activeManagerGosala, setActiveManagerGosalaState] = useState<string>(
    () => {
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          return localStorage.getItem("gomaa_active_manager_gosala") || ""
        }
      } catch {}
      return ""
    },
  )

  const setActiveManagerGosala = useCallback(
    (name: string) => {
      setActiveManagerGosalaState(name)
      setActiveGosalaFilter(name)
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          localStorage.setItem("gomaa_active_manager_gosala", name)
        }
      } catch {}
    },
    [],
  )

  useEffect(() => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.setItem("gomaa_gosalas", JSON.stringify(gosalas))
      }
    } catch {}
  }, [gosalas])

  const [pricingConfig, setPricingConfig] =
    useState<PricingConfig>(defaultPricingConfig)
  const [blockedSlots, setBlockedSlots] = useState<Record<string, string[]>>({})
  const [managers, setManagers] = useState<GosalaManager[]>(() => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const saved = localStorage.getItem("gomaa_managers")
        if (saved) return JSON.parse(saved)
      }
    } catch {}
    return []
  })
  const [settlements, setSettlements] = useState<Settlement[]>(() => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const saved = localStorage.getItem("gomaa_settlements")
        if (saved) return JSON.parse(saved)
      }
    } catch {}
    return []
  })
  const [currentRole, setCurrentRole] = useState<RoleId | null>("customer")
  const [toasts, setToasts] = useState<Toast[]>([])
  const [notifications, setNotifications] = useState<AppNotification[]>([])

  const markNotificationRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    )
  }, [])

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }, [])

  const clearNotifications = useCallback(() => {
    setNotifications([])
  }, [])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => {
      const target = prev.find((t) => t.id === id)
      if (target?.timerId) clearTimeout(target.timerId)
      return prev.filter((t) => t.id !== id)
    })
  }, [])

  const notify = useCallback(
    (msg: string, tone: ToastTone = "ok") => {
      const id =
        Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

      // Add to persistent notification history
      setNotifications((prev) => [
        {
          id:
            "notif-" +
            Date.now().toString(36) +
            Math.random().toString(36).slice(2, 4),
          title:
            tone === "ok"
              ? "Operation Confirmed"
              : tone === "warn"
                ? "Welfare Notice"
                : tone === "danger" || tone === "err"
                  ? "Constraint Alert"
                  : "System Notice",
          message: msg,
          timestamp: "Just now",
          category:
            msg.toLowerCase().includes("welfare") ||
            msg.toLowerCase().includes("buffer") ||
            msg.toLowerCase().includes("resting") ||
            msg.toLowerCase().includes("blocked")
              ? "welfare"
              : msg.toLowerCase().includes("driver") ||
                  msg.toLowerCase().includes("porter") ||
                  msg.toLowerCase().includes("transit")
                ? "transport"
                : "booking",
          tone,
          read: false,
        },
        ...prev.slice(0, 29),
      ])

      setToasts((prev) => {
        // Deduplication: if an alert with identical message already exists in active list, increment count & refresh timer
        const existingIdx = prev.findIndex((t) => t.msg === msg)
        if (existingIdx !== -1) {
          const updated = [...prev]
          const existing = updated[existingIdx]
          if (existing.timerId) clearTimeout(existing.timerId)

          const timerId = setTimeout(() => {
            dismiss(existing.id)
          }, 3200)

          updated[existingIdx] = {
            ...existing,
            count: existing.count + 1,
            timerId,
          }
          return updated
        }

        // Auto-dismiss after 3.5 seconds
        const timerId = setTimeout(() => {
          dismiss(id)
        }, 3500)

        const newItem: Toast = {
          id,
          msg,
          tone,
          count: 1,
          timerId,
        }

        // Hard cap: maximum 3 visible alerts simultaneously to prevent screen flooding
        const list = [...prev, newItem]
        if (list.length > 3) {
          const removed = list.shift()
          if (removed?.timerId) clearTimeout(removed.timerId)
        }
        return list
      })
    },
    [dismiss],
  )

  const [profiles, setProfiles] = useState<Record<RoleId, RoleProfile>>(() => {
    try {
      const saved = localStorage.getItem("gomaa_role_profiles")
      if (saved) return JSON.parse(saved)
    } catch {}
    return initialProfiles
  })

  const activeProfile = useMemo(() => {
    return (
      profiles[currentRole || "customer"] ||
      initialProfiles[currentRole || "customer"] ||
      initialProfiles.customer
    )
  }, [profiles, currentRole])

  const updateProfile = useCallback(
    async (role: RoleId, updates: Partial<RoleProfile>) => {
      setProfiles((prev) => {
        const existing = prev[role] || initialProfiles[role]
        const updated: RoleProfile = {
          ...existing,
          ...updates,
          customerData: updates.customerData
            ? {
                ...(existing.customerData ||
                  initialProfiles.customer.customerData!),
                ...updates.customerData,
              }
            : existing.customerData,
          managerData: updates.managerData
            ? {
                ...(existing.managerData ||
                  initialProfiles.manager.managerData!),
                ...updates.managerData,
              }
            : existing.managerData,
          driverData: updates.driverData
            ? {
                ...(existing.driverData || initialProfiles.driver.driverData!),
                ...updates.driverData,
              }
            : existing.driverData,
          adminData: updates.adminData
            ? {
                ...(existing.adminData || initialProfiles.admin.adminData!),
                ...updates.adminData,
              }
            : existing.adminData,
        }
        const next = { ...prev, [role]: updated }
        try {
          localStorage.setItem("gomaa_role_profiles", JSON.stringify(next))
        } catch {}
        return next
      })

      try {
        await api.updateProfile(role, updates)
      } catch (err) {
        console.warn("API profile sync fallback:", err)
      }
      notify("Profile updated successfully", "ok")
    },
    [notify],
  )

  // Sync state from backend on startup
  useEffect(() => {
    let active = true
    async function loadBackendState() {
      try {
        const [bkRes, prRes, mgRes, stRes, profRes, gosalaRes, animalRes, vetRes] = await Promise.all([
          api.getBookings().catch(() => null),
          api.getPricingConfig().catch(() => null),
          api.getManagers().catch(() => null),
          api.getSettlements().catch(() => null),
          api.getProfiles().catch(() => null),
          api.getGosalas().catch(() => null),
          api.getAnimals().catch(() => null),
          api.getVets().catch(() => null),
        ])
        if (!active) return
        if (bkRes?.bookings && Array.isArray(bkRes.bookings)) setBookings(bkRes.bookings)
        if (prRes?.config) setPricingConfig(prRes.config)
        if (mgRes?.managers && Array.isArray(mgRes.managers)) setManagers(mgRes.managers)
        if (stRes?.settlements && Array.isArray(stRes.settlements)) setSettlements(stRes.settlements)
        if (profRes?.profiles) {
          setProfiles((prev) => ({ ...prev, ...profRes.profiles }))
        }
        if (gosalaRes?.gosalas && Array.isArray(gosalaRes.gosalas)) {
          setGosalas(gosalaRes.gosalas)
          try {
            if (typeof window !== "undefined" && window.localStorage) {
              localStorage.setItem("gomaa_gosalas", JSON.stringify(gosalaRes.gosalas))
            }
          } catch {}
        }
        if (animalRes?.animals && Array.isArray(animalRes.animals)) {
          setAnimals(animalRes.animals)
          try {
            if (typeof window !== "undefined" && window.localStorage) {
              localStorage.setItem("gomaa_sacred_animals", JSON.stringify(animalRes.animals))
            }
          } catch {}
        }
        if (vetRes?.vets && Array.isArray(vetRes.vets)) {
          setVets(vetRes.vets)
          try {
            if (typeof window !== "undefined" && window.localStorage) {
              localStorage.setItem("gomaa_empanelled_vets", JSON.stringify(vetRes.vets))
            }
          } catch {}
        }
      } catch (e) {
        console.warn("Backend state init fallback:", e)
      }
    }
    loadBackendState()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.setItem("gomaa_sacred_animals", JSON.stringify(animals))
      }
    } catch {}
  }, [animals])

  useEffect(() => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.setItem("gomaa_bookings", JSON.stringify(bookings))
      }
    } catch {}
  }, [bookings])

  useEffect(() => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.setItem("gomaa_empanelled_vets", JSON.stringify(vets))
      }
    } catch {}
  }, [vets])

  useEffect(() => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.setItem("gomaa_managers", JSON.stringify(managers))
      }
    } catch {}
  }, [managers])

  useEffect(() => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.setItem("gomaa_settlements", JSON.stringify(settlements))
      }
    } catch {}
  }, [settlements])

  const patch = (id: string, fn: (b: Booking) => Booking) =>
    setBookings((bs) => bs.map((b) => (b.id === id ? fn(b) : b)))

  const patchBookingFromWs = useCallback(
    (incoming: Partial<Booking> & { id: string }) => {
      setBookings((prev) => {
        const idx = prev.findIndex((b) => b.id === incoming.id)
        if (idx === -1) {
          if ((incoming as Booking).customer && (incoming as Booking).animal) {
            return [incoming as Booking, ...prev]
          }
          return prev
        }
        const updated = [...prev]
        updated[idx] = { ...updated[idx], ...incoming }
        return updated
      })
    },
    [],
  )

  const updatePricing = useCallback(
    (patchData: Partial<PricingConfig>) => {
      setPricingConfig((prev) => ({ ...prev, ...patchData }))
      api.updatePricingConfig(patchData).catch(console.error)
      notify("Pricing rules updated live across the platform", "ok")
    },
    [notify],
  )

  const toggleSlotBlock = useCallback(
    (animal: string, date: string, time: string) => {
      const key = `${animal}-${date}`
      const cur = blockedSlots[key] || []
      const wasBlocked = cur.includes(time)
      const next = wasBlocked ? cur.filter((t) => t !== time) : [...cur, time]

      // Update state
      setBlockedSlots((prev) => ({ ...prev, [key]: next }))

      // Notify once directly outside of state setter callback
      notify(
        wasBlocked
          ? `${animal} · ${time} unblocked and made available`
          : `${animal} · ${time} marked blocked / resting`,
        wasBlocked ? "ok" : "info",
      )

      api.toggleSlotBlock(animal, date, time).catch(console.error)
    },
    [blockedSlots, notify],
  )

  const updateAnimalStatus = useCallback(
    (name: string, status: AnimalOperationalStatus, note?: string) => {
      setAnimals((prev) =>
        prev.map((a) => {
          if (a.name !== name) return a
          const isCooldown = status === "Resting Buffer"
          return {
            ...a,
            status,
            healthNotes: note || a.healthNotes,
            cooldownExpiresAt: isCooldown
              ? new Date(
                  Date.now() + (a.cooldownMinutes || 90) * 60000,
                ).toLocaleTimeString("en-IN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : undefined,
          }
        }),
      )
      api.updateAnimalStatus(name, status, note).catch(console.error)
      notify(
        `${name} marked as ${status}${note ? `: ${note}` : ""}`,
        status === "Available"
          ? "ok"
          : status === "Vet Care" || status === "Heat Hold"
            ? "danger"
            : "info",
      )
    },
    [notify],
  )

  const addAnimal = useCallback(
    (newAnimal: Animal) => {
      setAnimals((prev) => [newAnimal, ...prev])
      api.createAnimal(newAnimal).catch((err) => {
        console.warn("api.createAnimal background error (retained locally):", err)
      })
      notify(`Added ${newAnimal.name} to ${newAnimal.gosala}!`, "ok")
    },
    [notify],
  )

  const updateAnimal = useCallback(
    (name: string, patch: Partial<Animal>) => {
      setAnimals((prev) =>
        prev.map((a) => (a.name === name ? { ...a, ...patch } : a)),
      )
      api.updateAnimal(name, patch).catch((err) => {
        console.warn("api.updateAnimal background error (retained locally):", err)
      })
      notify(`Updated details for ${name}`, "ok")
    },
    [notify],
  )

  const deleteAnimal = useCallback(
    (name: string) => {
      setAnimals((prev) => prev.filter((a) => a.name !== name))
      api.deleteAnimal(name).catch((err) => {
        console.warn("api.deleteAnimal background error:", err)
      })
      notify(`Removed ${name} from sacred cattle roster`, "info")
    },
    [notify],
  )

  const addVet = useCallback(
    (vet: EmpanelledVet) => {
      setVets((prev) => [vet, ...prev])
      api.createVet(vet).catch((err) => {
        console.warn("api.createVet background error (retained locally):", err)
      })
      notify(`Empanelled ${vet.name} as certified veterinary doctor`, "ok")
    },
    [notify],
  )

  const updateVet = useCallback(
    (id: string, patch: Partial<EmpanelledVet>) => {
      setVets((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)))
      api.updateVet(id, patch).catch((err) => {
        console.warn("api.updateVet background error (retained locally):", err)
      })
      notify("Updated veterinarian details", "ok")
    },
    [notify],
  )

  const deleteVet = useCallback(
    (id: string) => {
      setVets((prev) => prev.filter((v) => v.id !== id))
      api.deleteVet(id).catch((err) => {
        console.warn("api.deleteVet background error:", err)
      })
      notify("Removed veterinarian from active roster", "info")
    },
    [notify],
  )

  const addGosala = useCallback(
    (data: Omit<Gosala, "id"> | Gosala): Gosala => {
      const id = "id" in data && data.id ? data.id : `GOS-${100 + gosalas.length + 1}`
      const newGosala: Gosala = {
        ...data,
        id,
        trustRegistrationNo:
          data.trustRegistrationNo ||
          `MAH-PUN-AWBI-${Math.floor(1000 + Math.random() * 8999)}`,
        region: data.region || "Pune West (Kothrud)",
        contactPhone: data.contactPhone || "+91 98230 44910",
        email: data.email || "trust@gomaa.in",
        managerId: data.managerId || "MGR-804",
        managerName: data.managerName || "Rahul Kamble",
        caretaker: data.caretaker || "Dedicated Gosevak Caretaker",
        capacity: Number(data.capacity) || 40,
        establishedYear: data.establishedYear || "2024",
        facilities:
          data.facilities && data.facilities.length > 0
            ? data.facilities
            : [
                "Padded Cattle Ambulance / Van",
                "24/7 Pure Borewell Water & Trough",
              ],
        status: data.status || "Active",
        photo: data.photo || GOSALA_PHOTO_PRESETS[0].url,
        photos:
          data.photos && data.photos.length > 0
            ? data.photos
            : [data.photo || GOSALA_PHOTO_PRESETS[0].url],
      }
      setGosalas((prev) => [newGosala, ...prev])
      api.createGosala(newGosala).catch((err) => {
        console.warn("api.createGosala background error (using local state):", err)
      })
      notify(
        `Gaushala "${newGosala.name}" successfully registered under your management!`,
        "ok",
      )
      return newGosala
    },
    [gosalas.length, notify],
  )

  const updateGosala = useCallback(
    (id: string, patch: Partial<Gosala>) => {
      setGosalas((prev) =>
        prev.map((g) => (g.id === id ? { ...g, ...patch } : g)),
      )
      api.updateGosala(id, patch).catch((err) => {
        console.warn("api.updateGosala background error (using local state):", err)
      })
      notify("Gaushala facility details updated successfully", "ok")
    },
    [notify],
  )

  const deleteGosala = useCallback(
    (id: string) => {
      const target = gosalas.find((g) => g.id === id)
      if (target) {
        setGosalas((prev) => prev.filter((g) => g.id !== id))
        api.deleteGosala(id).catch((err) => {
          console.warn("api.deleteGosala background error:", err)
        })
        notify(
          `Gaushala "${target.name}" removed from management roster`,
          "info",
        )
      }
    },
    [gosalas, notify],
  )

  const checkAnimalAvailability = useCallback(
    (
      animal: string,
      date: string,
      time: string,
      durationMin: number = 60,
    ): SlotCheckResult => {
      // 1. Check animal operational status
      const animalObj = animals.find(
        (a) => a.name.toLowerCase() === animal.toLowerCase(),
      )
      if (animalObj) {
        if (animalObj.status === "Vet Care") {
          return {
            available: false,
            status: "Blocked",
            reason: `Animal placed under veterinary care & inspection (${animalObj.healthNotes || "Resting"})`,
          }
        }
        if (animalObj.status === "Heat Hold") {
          return {
            available: false,
            status: "Blocked",
            reason:
              "Animal on heat stress hold (midday thermal threshold exceeded)",
          }
        }
        if (animalObj.status === "Recovering") {
          return {
            available: false,
            status: "Blocked",
            reason:
              "Animal undergoing post-treatment rehabilitation (no commercial transit)",
          }
        }
      }

      const key = `${animal}-${date}`
      const blocked = blockedSlots[key] || []

      // 2. Check manual blocks
      if (blocked.includes(time)) {
        return {
          available: false,
          status: "Blocked",
          reason:
            "Manually blocked by Gosala admin for animal resting / vet inspection",
        }
      }

      // 3. Sacred Welfare Protocol Invariant: Max Daily Trip Limit
      const isCalfOrSenior =
        (animalObj?.ageYears !== undefined &&
          (animalObj.ageYears < 3 || animalObj.ageYears > 10)) ||
        animal.toLowerCase().includes("kesari") ||
        animal.toLowerCase().includes("calf")
      const maxDailyLimit = animalObj?.maxDailyTrips || (isCalfOrSenior ? 1 : 2)

      const activeSameDayBookings = bookings.filter(
        (b) =>
          b.animal.toLowerCase() === animal.toLowerCase() &&
          b.date === date &&
          b.status !== "Rejected" &&
          b.status !== "Cancelled",
      )

      if (activeSameDayBookings.length >= maxDailyLimit) {
        return {
          available: false,
          status: "Blocked",
          reason: `Maximum daily welfare limit reached (${activeSameDayBookings.length}/${maxDailyLimit} sevas scheduled today)`,
        }
      }

      // 4. Sacred Welfare Protocol Invariant: 90-min Resting Cooldown & 30-min Prep Buffer
      const slotStart = toMinutes(time)
      const slotEnd = slotStart + durationMin
      const welfareBuffer = animalObj?.cooldownMinutes || 90
      const prepBuffer = 30

      for (const b of activeSameDayBookings) {
        const bStart = toMinutes(b.start)
        const bEnd = toMinutes(b.end)
        const bEndWithCooldown = bEnd + welfareBuffer

        // Direct overlap
        if (slotStart < bEnd && slotEnd > bStart) {
          return {
            available: false,
            status: "Booked",
            bookingId: b.id,
            customer: b.customer,
            reason: `Reserved for booking ${b.id} (${b.start}–${b.end})`,
          }
        }

        // Post-trip resting cooldown
        if (slotStart >= bEnd && slotStart < bEndWithCooldown) {
          const remaining = bEndWithCooldown - slotStart
          return {
            available: false,
            status: "Buffer",
            bookingId: b.id,
            reason: `Mandatory 90-min resting cooldown after trip ${b.id} (${remaining}m remaining)`,
          }
        }

        // Pre-trip preparation buffer
        if (slotEnd > bStart - prepBuffer && slotStart < bStart) {
          return {
            available: false,
            status: "Buffer",
            bookingId: b.id,
            reason: `Pre-dispatch inspection & grooming buffer for trip ${b.id}`,
          }
        }
      }

      return { available: true, status: "Available" }
    },
    [animals, blockedSlots, bookings],
  )

  const createBooking = useCallback(
    (b: Booking, holdId?: string) => {
      setBookings((bs) => [b, ...bs])
      api.createBooking(b, holdId).catch(console.error)
      notify(
        `Booking ${b.id} placed · Payment verified server-side · Sent to manager review`,
        "ok",
      )
    },
    [notify],
  )

  const managerDecide = useCallback(
    (
      id: string,
      confirm: boolean,
      remark: string,
      managerName?: string,
      rejectionCode?: string,
    ) => {
      const nowStr = new Date().toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })

      const effectiveName = managerName || profiles?.manager?.name || "Gaushala Manager"
      const managerId = profiles?.manager?.id || "MGR-ACTIVE"

      const finalRemark = rejectionCode
        ? `[${rejectionCode}] ${remark}`
        : remark ||
          (confirm
            ? "Feasibility & animal health confirmed"
            : "Rejected by manager")

      const approval: ApprovalRecord = {
        userId: managerId,
        name: effectiveName,
        timestamp: nowStr,
        remark: finalRemark,
      }

      patch(id, (b) => ({
        ...b,
        status: confirm ? "Admin Review" : "Rejected",
        managerRemark: approval.remark,
        managerApproval: approval,
      }))

      api
        .managerDecide(id, confirm, finalRemark, effectiveName, managerId)
        .catch(console.error)

      notify(
        confirm
          ? `${id} confirmed by Manager (${managerName}) · forwarded to Admin`
          : `${id} rejected by Manager · slot released`,
        confirm ? "ok" : "danger",
      )
    },
    [notify],
  )

  const adminDecide = useCallback(
    (
      id: string,
      confirm: boolean,
      remark: string,
      adminName: string = "Priya Sharma",
    ) => {
      const nowStr = new Date().toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })

      const approval: ApprovalRecord = {
        userId: "ADM-101",
        name: adminName,
        timestamp: nowStr,
        remark:
          remark ||
          (confirm
            ? "Approved for service · payment snapshot validated"
            : "Rejected by admin"),
      }

      patch(id, (b) => ({
        ...b,
        status: confirm ? "Confirmed" : "Rejected",
        adminRemark: approval.remark,
        adminApproval: approval,
      }))

      api
        .adminDecide(id, confirm, remark, adminName, "ADM-101")
        .catch(console.error)

      notify(
        confirm
          ? `🎉 ${id} CONFIRMED by Admin · Customer notified via WhatsApp & In-App!`
          : `${id} rejected · refund initiated`,
        confirm ? "ok" : "danger",
      )
    },
    [notify],
  )

  const assignDriver = useCallback(
    (id: string, driver: string) => {
      patch(id, (b) => ({ ...b, driver, driverStage: 0, isPorter: false }))
      api.assignDriver(id, driver).catch(console.error)
      notify(`${driver} assigned to ${id} · Driver App notified`, "info")
    },
    [notify],
  )

  const assignPorterTransport = useCallback(
    (
      bookingId: string,
      porterData: {
        vehicleType: string
        fare: number
        driverName: string
        driverPhone: string
      },
    ) => {
      const porterBookingId = `POR-PUN-${Math.floor(10000 + Math.random() * 90000)}`
      patch(bookingId, (b) => ({
        ...b,
        driver: `Porter (${porterData.driverName})`,
        driverStage: 1,
        isPorter: true,
        porterBookingId,
        porterVehicleType: porterData.vehicleType,
        porterFare: porterData.fare,
        porterDriverName: porterData.driverName,
        porterDriverPhone: porterData.driverPhone,
        porterStatus: "Dispatched",
      }))
      notify(
        `🚀 Porter 3rd-Party Transport Dispatched (${porterBookingId}) · ${porterData.driverName} (${porterData.vehicleType})`,
        "ok",
      )
    },
    [notify],
  )

  const updateAnimalWelfareConfig = useCallback(
    (
      animalName: string,
      config: {
        maxDailyTrips?: number
        cooldownMinutes?: number
        maxRadiusKm?: number
      },
    ) => {
      setAnimals((prev) =>
        prev.map((a) => {
          if (a.name.toLowerCase() !== animalName.toLowerCase()) return a
          return {
            ...a,
            maxDailyTrips:
              config.maxDailyTrips !== undefined
                ? config.maxDailyTrips
                : a.maxDailyTrips,
            cooldownMinutes:
              config.cooldownMinutes !== undefined
                ? config.cooldownMinutes
                : a.cooldownMinutes,
            maxRadiusKm:
              config.maxRadiusKm !== undefined
                ? config.maxRadiusKm
                : a.maxRadiusKm,
          }
        }),
      )
      notify(
        `${animalName} policy updated: ${
          config.cooldownMinutes ? `${config.cooldownMinutes}m cooldown` : ""
        }${
          config.maxDailyTrips ? ` · max ${config.maxDailyTrips} sevas/day` : ""
        }${config.maxRadiusKm ? ` · ${config.maxRadiusKm}km cap` : ""}`,
        "ok",
      )
    },
    [notify],
  )

  const advanceTrip = useCallback((id: string) => {
    patch(id, (b) => {
      const stage = Math.min(b.driverStage + 1, tripStages.length - 1)
      const status: BookingStatus =
        stage >= tripStages.length - 1
          ? "Completed"
          : stage >= 6
            ? "In Service"
            : b.status
      return { ...b, driverStage: stage, status }
    })
    api.advanceTripStage(id).catch(console.error)
  }, [])

  const addManager = useCallback(
    (mgr: Omit<GosalaManager, "id" | "assignedDate"> & { gosalas?: string[] }) => {
      const id = `MGR-${800 + managers.length + 1}`
      const assignedDate =
        "Today, " +
        new Date().toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      const primaryGosala =
        mgr.gosalas && mgr.gosalas.length > 0 ? mgr.gosalas[0] : mgr.gosala || "Unassigned"
      const newMgr: GosalaManager = {
        ...mgr,
        id,
        assignedDate,
        gosala: primaryGosala,
        gosalas: mgr.gosalas || (mgr.gosala ? [mgr.gosala] : []),
      }
      setManagers((prev) => [newMgr, ...prev])
      api.addManager(newMgr).catch(console.error)
      const targetList =
        newMgr.gosalas && newMgr.gosalas.length > 0
          ? newMgr.gosalas.join(", ")
          : primaryGosala
      notify(`Manager ${mgr.name} assigned to ${targetList}`, "ok")
    },
    [managers.length, notify],
  )

  const updateManager = useCallback(
    (id: string, patchData: Partial<GosalaManager> & { gosalas?: string[] }) => {
      setManagers((prev) =>
        prev.map((m) => {
          if (m.id !== id) return m
          const updatedGosalas =
            patchData.gosalas !== undefined ? patchData.gosalas : m.gosalas
          const primaryGosala =
            updatedGosalas && updatedGosalas.length > 0
              ? updatedGosalas[0]
              : patchData.gosala || m.gosala
          return {
            ...m,
            ...patchData,
            gosala: primaryGosala,
            gosalas: updatedGosalas,
          }
        }),
      )
      api.updateManager(id, patchData).catch(console.error)
      notify("Gaushala manager details updated", "ok")
    },
    [notify],
  )

  const toggleManagerStatus = useCallback(
    (id: string) => {
      const target = managers.find((m) => m.id === id)
      if (target) {
        const next = target.status === "Active" ? "Inactive" : "Active"
        notify(
          `${target.name} marked ${next}`,
          next === "Active" ? "ok" : "info",
        )
      }
      setManagers((prev) =>
        prev.map((m) => {
          if (m.id !== id) return m
          const next = m.status === "Active" ? "Inactive" : "Active"
          return { ...m, status: next }
        }),
      )
      api.toggleManagerStatus(id).catch(console.error)
    },
    [managers, notify],
  )

  const deleteManager = useCallback(
    (id: string) => {
      setManagers((prev) => prev.filter((m) => m.id !== id))
      api.deleteManager(id).catch(console.error)
      notify("Manager assignment removed", "info")
    },
    [notify],
  )

  const advanceSettlement = useCallback(
    (gosala: string) => {
      const nextStatusMap: Record<Settlement["status"], Settlement["status"]> =
        {
          Pending: "Approved",
          Approved: "Processing",
          Processing: "Paid",
          Paid: "Paid",
          Failed: "Approved",
        }
      const target = settlements.find((r) => r.gosala === gosala)
      if (target) {
        const next = nextStatusMap[target.status]
        notify(
          `${gosala} · ${target.status} → ${next}`,
          next === "Paid" ? "ok" : "info",
        )
      }
      setSettlements((rows) =>
        rows.map((r) => {
          if (r.gosala !== gosala) return r
          const next = nextStatusMap[r.status]
          return { ...r, status: next }
        }),
      )
      api.advanceSettlement(gosala).catch(console.error)
    },
    [settlements, notify],
  )

  const approveSettlementBatch = useCallback(
    (batch: string) => {
      setSettlements((rows) =>
        rows.map((r) =>
          r.batch === batch && r.status === "Pending"
            ? { ...r, status: "Approved" }
            : r,
        ),
      )
      api.approveSettlementBatch(batch).catch(console.error)
      notify(`Settlement batch ${batch} approved for payout processing`, "ok")
    },
    [notify],
  )

  const store = useMemo(
    () => ({
      bookings,
      animals,
      pricingConfig,
      blockedSlots,
      managers,
      settlements,
      currentRole,
      setCurrentRole,
      createBooking,
      managerDecide,
      adminDecide,
      assignDriver,
      assignPorterTransport,
      advanceTrip,
      updatePricing,
      toggleSlotBlock,
      updateAnimalStatus,
      updateAnimalWelfareConfig,
      checkAnimalAvailability,
      addAnimal,
      updateAnimal,
      deleteAnimal,
      vets,
      addVet,
      updateVet,
      deleteVet,
      gosalas,
      activeGosalaFilter,
      setActiveGosalaFilter,
      activeManagerGosala,
      setActiveManagerGosala,
      addGosala,
      updateGosala,
      deleteGosala,
      addManager,
      updateManager,
      toggleManagerStatus,
      deleteManager,
      advanceSettlement,
      approveSettlementBatch,
      notify,
      patchBookingFromWs,
      notifications,
      markNotificationRead,
      markAllNotificationsRead,
      clearNotifications,
      profiles,
      activeProfile,
      updateProfile,
    }),
    [
      bookings,
      animals,
      vets,
      gosalas,
      activeGosalaFilter,
      activeManagerGosala,
      setActiveManagerGosala,
      pricingConfig,
      blockedSlots,
      managers,
      settlements,
      profiles,
      activeProfile,
      updateProfile,
      currentRole,
      setCurrentRole,
      createBooking,
      managerDecide,
      adminDecide,
      assignDriver,
      assignPorterTransport,
      advanceTrip,
      updatePricing,
      toggleSlotBlock,
      updateAnimalStatus,
      updateAnimalWelfareConfig,
      checkAnimalAvailability,
      addAnimal,
      updateAnimal,
      addVet,
      updateVet,
      deleteVet,
      addGosala,
      updateGosala,
      deleteGosala,
      addManager,
      updateManager,
      toggleManagerStatus,
      deleteManager,
      advanceSettlement,
      approveSettlementBatch,
      notify,
      patchBookingFromWs,
      notifications,
      markNotificationRead,
      markAllNotificationsRead,
      clearNotifications,
    ],
  )

  return (
    <ToastCtx.Provider value={{ notify, dismiss }}>
      <StoreCtx.Provider value={store}>
        {children}
        {/* Professional Alert Notification Viewport (Bottom-Right, Max 3, Deduplicated) */}
        <div className="fixed bottom-5 right-5 z-[100] flex flex-col items-end gap-2 pointer-events-none max-w-[380px] w-full px-4 sm:px-0">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`pointer-events-auto w-full bg-card/95 backdrop-blur-md border shadow-xl rounded-lg p-3 text-[12.5px] flex items-start gap-2.5 transition-all duration-200 animate-[fadein_.2s_ease] ${
                t.tone === "ok"
                  ? "border-emerald-200 bg-emerald-50/90 text-emerald-950"
                  : t.tone === "danger" || t.tone === "err"
                    ? "border-red-200 bg-red-50/90 text-red-950"
                    : t.tone === "warn"
                      ? "border-amber-200 bg-amber-50/90 text-amber-950"
                      : "border-line-strong bg-paper/95 text-ink"
              }`}
            >
              <div className="shrink-0 mt-0.5">
                {t.tone === "ok" && (
                  <CheckCircle2 size={16} className="text-emerald-700" />
                )}
                {t.tone === "info" && (
                  <Info size={16} className="text-forest" />
                )}
                {(t.tone === "danger" || t.tone === "err") && (
                  <AlertCircle size={16} className="text-danger" />
                )}
                {t.tone === "warn" && (
                  <AlertTriangle size={16} className="text-amber-700" />
                )}
              </div>

              <div className="flex-1 min-w-0 pr-1">
                <div className="font-medium flex items-center gap-1.5 flex-wrap leading-snug">
                  <span>{t.msg}</span>
                  {t.count > 1 && (
                    <span className="font-mono text-[10px] bg-ink/10 text-ink px-1.5 py-0.2 rounded-full font-bold">
                      ×{t.count}
                    </span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="text-ink-faint hover:text-ink p-0.5 rounded hover:bg-black/5 transition-colors shrink-0 cursor-pointer"
                aria-label="Dismiss notification"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      </StoreCtx.Provider>
    </ToastCtx.Provider>
  )
}
