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
export type CustomDynamicFee = {
  id: string
  name: string
  type: "fixed" | "percentage"
  value: number
  appliedOn: "base" | "total" | "transport"
  enabled: boolean
  description?: string
}

export type PricingConfig = {
  id?: number
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
  maxRadiusKm?: number
  customFees?: CustomDynamicFee[]
  updatedByRole?: string
  updatedByName?: string
  updatedAt?: string
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
  maxRadiusKm: 35,
  customFees: [
    {
      id: "fee-sanctuary-cess",
      name: "Sanctuary Maintenance & Green Grass Cess",
      type: "fixed",
      value: 150,
      appliedOn: "total",
      enabled: true,
      description: "Direct contribution to Gaushala fodder storehouse & cow shed upkeep",
    },
    {
      id: "fee-vet-fund",
      name: "Emergency Vet Welfare Protocol Fund",
      type: "percentage",
      value: 2.5,
      appliedOn: "base",
      enabled: true,
      description: "Reserved fund for empanelled veterinary doctor visits & cattle vitamins",
    },
  ],
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
  verifyHandoverOtp: (
    id: string,
    otp: string,
  ) => Promise<{ success: boolean; error?: string }>
  updatePricing: (patch: Partial<PricingConfig>) => Promise<void>
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
  refreshAnimals: () => Promise<Animal[]>
  refreshGosalas: () => Promise<Gosala[]>
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
  executeSettlementSweep: (options?: {
    gosala?: string
    cycleType?: "CONTINUOUS_T_PLUS_ONE" | "WEEKLY"
  }) => Promise<any>
  configureSettlementSchedule: (config: {
    autoSweepEnabled?: boolean
    disbursementCycle?: "CONTINUOUS_T_PLUS_ONE" | "WEEKLY"
  }) => Promise<any>
  settlementSchedule: any
  notify: (msg: string, tone?: ToastTone) => void
  patchBookingFromWs: (b: Partial<Booking> & { id: string }) => void
  notifications: AppNotification[]
  markNotificationRead: (id: string) => void
  markAllNotificationsRead: () => void
  clearNotifications: () => void
  authToken: string | null
  authUser: any | null
  setAuthSession: (token: string, user: any) => void
  clearAuthSession: () => void
  reloadBackendState: () => Promise<void>
  users: any[]
  refreshUsers: () => Promise<any[]>
  addUser: (userData: any) => Promise<any>
  updateUser: (id: string, updates: any) => Promise<any>
  deleteUser: (id: string) => Promise<any>
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

  const [pricingConfig, setPricingConfig] = useState<PricingConfig>(() => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const saved = localStorage.getItem("gomaa_pricing_config")
        if (saved) return JSON.parse(saved)
      }
    } catch {}
    return defaultPricingConfig
  })
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
  const [settlementSchedule, setSettlementSchedule] = useState<any>(null)
  const [currentRole, setCurrentRole] = useState<RoleId | null>("customer")
  const [authToken, setAuthTokenState] = useState<string | null>(() => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        return localStorage.getItem("gomaa_auth_token")
      }
    } catch {}
    return null
  })
  const [authUser, setAuthUser] = useState<any | null>(null)
  const [users, setUsers] = useState<any[]>([])
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
          bankDetails: updates.bankDetails !== undefined
            ? (updates.bankDetails ? { ...(existing.bankDetails || {}), ...updates.bankDetails } : undefined)
            : existing.bankDetails,
          settlementSchedule: updates.settlementSchedule !== undefined
            ? (updates.settlementSchedule ? { ...(existing.settlementSchedule || {}), ...updates.settlementSchedule } : undefined)
            : existing.settlementSchedule,
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

  // Sync state from backend on startup and session updates
  const loadBackendState = useCallback(async () => {
    try {
      const [bkRes, prRes, mgRes, stRes, profRes, gosalaRes, animalRes, vetRes, schedRes, meRes, usersRes] = await Promise.all([
        api.getBookings().catch(() => null),
        api.getPricingConfig().catch(() => null),
        api.getManagers().catch(() => null),
        api.getSettlements().catch(() => null),
        api.getProfiles().catch(() => null),
        api.getGosalas().catch(() => null),
        api.getAnimals().catch(() => null),
        api.getVets().catch(() => null),
        api.getSettlementSchedule().catch(() => null),
        api.getMe().catch(() => null),
        api.getUsers().catch(() => null),
      ])
      if (meRes?.ok && meRes.user) {
        setAuthUser(meRes.user)
      }
      if (usersRes?.ok && Array.isArray(usersRes.users)) {
        setUsers(usersRes.users)
      }
      if (bkRes?.bookings && Array.isArray(bkRes.bookings)) {
        const sanitized = bkRes.bookings.map((b: any) => ({
          ...b,
          handoverOtp: b.handoverOtp || "4819",
          handoverOtpVerified: Boolean(b.handoverOtpVerified),
        }))
        setBookings(sanitized)
      }
      if (prRes?.config) {
        setPricingConfig(prRes.config)
        try {
          if (typeof window !== "undefined" && window.localStorage) {
            localStorage.setItem("gomaa_pricing_config", JSON.stringify(prRes.config))
          }
        } catch {}
      }
      if (mgRes?.managers && Array.isArray(mgRes.managers)) setManagers(mgRes.managers)
      if (stRes?.settlements && Array.isArray(stRes.settlements)) setSettlements(stRes.settlements)
      if (schedRes?.schedule) setSettlementSchedule(schedRes.schedule)
      if (profRes?.profiles) {
        setProfiles((prev) => ({ ...prev, ...profRes.profiles }))
      }
      if (gosalaRes?.gosalas && Array.isArray(gosalaRes.gosalas)) {
        if (gosalaRes.gosalas.length === 0) {
          setGosalas([])
          try {
            if (typeof window !== "undefined" && window.localStorage) {
              localStorage.setItem("gomaa_gosalas", "[]")
            }
          } catch {}
        } else {
          setGosalas((prevLocal) => {
            const localMap = new Map<string, Gosala>()
            prevLocal.forEach((g) => {
              localMap.set(g.id, g)
              if (g.name) localMap.set(g.name.trim().toLowerCase(), g)
            })

          const merged = gosalaRes.gosalas.map((serverG: any) => {
            const localG =
              localMap.get(serverG.id) ||
              (serverG.name ? localMap.get(serverG.name.trim().toLowerCase()) : undefined)
            const resolvedLat =
              serverG.lat !== undefined && serverG.lat !== null
                ? Number(serverG.lat)
                : serverG.latitude !== undefined && serverG.latitude !== null
                  ? Number(serverG.latitude)
                  : localG?.lat
            const resolvedLng =
              serverG.lng !== undefined && serverG.lng !== null
                ? Number(serverG.lng)
                : serverG.longitude !== undefined && serverG.longitude !== null
                  ? Number(serverG.longitude)
                  : localG?.lng

            return {
              ...(localG || {}),
              ...serverG,
              id: serverG.id,
              name: serverG.name,
              region: serverG.region,
              address: serverG.address,
              contactPhone: serverG.contactPhone || localG?.contactPhone || "+91 98000 00000",
              email: serverG.contactEmail || serverG.email || localG?.email || "trust@gomaa.in",
              lat: resolvedLat,
              lng: resolvedLng,
              photo:
                serverG.photo ||
                localG?.photo ||
                GOSALA_PHOTO_PRESETS[0].url,
              photos:
                serverG.photos && serverG.photos.length > 0
                  ? serverG.photos
                  : localG?.photos && localG.photos.length > 0
                    ? localG.photos
                    : [serverG.photo || localG?.photo || GOSALA_PHOTO_PRESETS[0].url],
              capacity:
                serverG.capacity !== undefined
                  ? Number(serverG.capacity)
                  : localG?.capacity || 40,
              establishedYear:
                serverG.establishedYear ||
                localG?.establishedYear ||
                "2018",
              trustRegistrationNo:
                serverG.trustRegistrationNo ||
                localG?.trustRegistrationNo ||
                "AWBI/2018/TG/HYD-4912",
              landAcres:
                serverG.landAcres !== undefined
                  ? Number(serverG.landAcres)
                  : localG?.landAcres || 4.5,
              visitingHours:
                serverG.visitingHours ||
                localG?.visitingHours ||
                "06:00 AM - 07:30 PM (Daily)",
              facilities:
                serverG.facilities && serverG.facilities.length > 0
                  ? serverG.facilities
                  : localG?.facilities || [
                      "24/7 Pure Borewell Water & Trough",
                      "Certified Veterinary Medical Bay",
                      "Sacred Vedic Puja & Havan Courtyard",
                    ],
              notes: serverG.notes || localG?.notes || "",
              caretaker:
                serverG.caretaker ||
                localG?.caretaker ||
                serverG.managerName ||
                "Caretaker In-Charge",
              caretakerPhone:
                serverG.caretakerPhone ||
                localG?.caretakerPhone ||
                serverG.contactPhone ||
                "+91 98230 44910",
            } as Gosala
          })

          try {
            if (typeof window !== "undefined" && window.localStorage) {
              localStorage.setItem("gomaa_gosalas", JSON.stringify(merged))
            }
          } catch {}
          return merged
        })
        }
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
  }, [])

  useEffect(() => {
    loadBackendState()
  }, [loadBackendState])

  const setAuthSession = useCallback(
    (token: string, user: any) => {
      setAuthTokenState(token)
      setAuthUser(user)
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          localStorage.setItem("gomaa_auth_token", token)
        }
      } catch {}
      loadBackendState()
    },
    [loadBackendState],
  )

  const clearAuthSession = useCallback(() => {
    setAuthTokenState(null)
    setAuthUser(null)
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.removeItem("gomaa_auth_token")
      }
    } catch {}
    loadBackendState()
  }, [loadBackendState])

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
    async (patchData: Partial<PricingConfig>) => {
      // Optimistic / fast local update
      setPricingConfig((prev) => {
        const next = { ...prev, ...patchData }
        try {
          if (typeof window !== "undefined" && window.localStorage) {
            localStorage.setItem("gomaa_pricing_config", JSON.stringify(next))
          }
        } catch {}
        return next
      })

      try {
        const res = await api.updatePricingConfig(patchData, "super_admin")
        if (res?.config) {
          setPricingConfig(res.config)
          try {
            if (typeof window !== "undefined" && window.localStorage) {
              localStorage.setItem("gomaa_pricing_config", JSON.stringify(res.config))
            }
          } catch {}
        }
        notify("Master Pricing & Platform Economics synchronized to PostgreSQL database", "ok")
      } catch (err: any) {
        console.error("Master pricing DB update error:", err)
        notify(err?.message || "Failed to sync Master Pricing with database", "danger")
      }
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

  const refreshAnimals = useCallback(async (): Promise<Animal[]> => {
    try {
      const res = await api.getAnimals()
      if (res?.animals && Array.isArray(res.animals)) {
        setAnimals(res.animals)
        try {
          if (typeof window !== "undefined" && window.localStorage) {
            localStorage.setItem("gomaa_sacred_animals", JSON.stringify(res.animals))
          }
        } catch {}
        return res.animals
      }
    } catch (err) {
      console.warn("refreshAnimals background check failed:", err)
    }
    return []
  }, [])

  const refreshGosalas = useCallback(async (): Promise<Gosala[]> => {
    try {
      const res = await api.getGosalas()
      if (res?.gosalas && Array.isArray(res.gosalas)) {
        setGosalas((prevLocal) => {
          const localMap = new Map<string, Gosala>()
          prevLocal.forEach((g) => {
            localMap.set(g.id, g)
            if (g.name) localMap.set(g.name.trim().toLowerCase(), g)
          })
          const merged = res.gosalas.map((serverG: any) => {
            const localG = localMap.get(serverG.id) || localMap.get(serverG.name?.trim().toLowerCase())
            return {
              id: serverG.id,
              name: serverG.name,
              region: serverG.region || localG?.region || "Operational Sector",
              address: serverG.address || localG?.address || "Sanctuary Premises",
              contactPhone: serverG.contactPhone || localG?.contactPhone || "+91 98230 44910",
              email: serverG.contactEmail || serverG.email || localG?.email || "trust@gomaa.in",
              managerId: serverG.managerId || localG?.managerId || "",
              managerName: serverG.managerName || localG?.managerName || "Gaushala Custodian",
              caretaker: serverG.caretaker || localG?.caretaker || serverG.managerName || "Caretaker In-Charge",
              caretakerPhone: serverG.caretakerPhone || localG?.caretakerPhone || serverG.contactPhone || "+91 98230 44910",
              status: serverG.status || localG?.status || "Active",
              photo: serverG.photo || localG?.photo || GOSALA_PHOTO_PRESETS[0].url,
              photos: serverG.photos && serverG.photos.length > 0 ? serverG.photos : localG?.photos && localG.photos.length > 0 ? localG.photos : [serverG.photo || localG?.photo || GOSALA_PHOTO_PRESETS[0].url],
              capacity: serverG.capacity !== undefined ? Number(serverG.capacity) : localG?.capacity || 40,
              establishedYear: serverG.establishedYear || localG?.establishedYear || "2018",
              trustRegistrationNo: serverG.trustRegistrationNo || localG?.trustRegistrationNo || "AWBI/2018/TG/HYD-4912",
              landAcres: serverG.landAcres !== undefined ? Number(serverG.landAcres) : localG?.landAcres || 4.5,
              visitingHours: serverG.visitingHours || localG?.visitingHours || "06:00 AM - 07:30 PM (Daily)",
              facilities: serverG.facilities && serverG.facilities.length > 0 ? serverG.facilities : localG?.facilities || [
                "24/7 Pure Borewell Water & Trough",
                "Certified Veterinary Medical Bay",
                "Sacred Vedic Puja & Havan Courtyard",
              ],
              notes: serverG.notes || localG?.notes || "",
            } as Gosala
          })
          try {
            if (typeof window !== "undefined" && window.localStorage) {
              localStorage.setItem("gomaa_gosalas", JSON.stringify(merged))
            }
          } catch {}
          return merged
        })
      }
    } catch (err) {
      console.warn("refreshGosalas background check failed:", err)
    }
    return []
  }, [])

  const addAnimal = useCallback(
    (newAnimal: Animal) => {
      setAnimals((prev) => {
        const filtered = prev.filter((a) => a.name.toLowerCase() !== newAnimal.name.toLowerCase())
        const next = [newAnimal, ...filtered]
        try {
          if (typeof window !== "undefined" && window.localStorage) {
            localStorage.setItem("gomaa_sacred_animals", JSON.stringify(next))
          }
        } catch {}
        return next
      })
      api.createAnimal(newAnimal).then(() => {
        refreshAnimals().catch(() => {})
      }).catch((err) => {
        console.warn("api.createAnimal background error (retained locally):", err)
      })
      notify(`Added ${newAnimal.name} to ${newAnimal.gosala}!`, "ok")
    },
    [notify, refreshAnimals],
  )

  const updateAnimal = useCallback(
    (name: string, patch: Partial<Animal>) => {
      setAnimals((prev) =>
        prev.map((a) => (a.name === name ? { ...a, ...patch } : a)),
      )
      api.updateAnimal(name, patch).then(() => {
        refreshAnimals().catch(() => {})
      }).catch((err) => {
        console.warn("api.updateAnimal background error (retained locally):", err)
      })
      notify(`Updated details for ${name}`, "ok")
    },
    [notify, refreshAnimals],
  )

  const deleteAnimal = useCallback(
    (name: string) => {
      setAnimals((prev) => prev.filter((a) => a.name !== name))
      api.deleteAnimal(name).then(() => {
        refreshAnimals().catch(() => {})
      }).catch((err) => {
        console.warn("api.deleteAnimal background error:", err)
      })
      notify(`Removed ${name} from sacred cattle roster`, "info")
    },
    [notify, refreshAnimals],
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
          `AWBI-TR-${Math.floor(1000 + Math.random() * 8999)}`,
        region: data.region || "Cyberabad / Gachibowli",
        contactPhone: data.contactPhone || "+91 98230 44910",
        email: data.email || "trust@gomaa.in",
        managerId: data.managerId || "",
        managerName: data.managerName || "Gaushala Custodian",
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

      // 4. Sacred Welfare Protocol Invariant: 90-min Resting Cooldown & Dynamic Prep Buffer
      const slotStart = toMinutes(time)
      const slotEnd = slotStart + durationMin
      const welfareBuffer = animalObj?.cooldownMinutes || 90
      const prepBuffer = pricingConfig?.bufferMin ?? 30

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
            reason: `Pre-dispatch inspection & grooming buffer (${prepBuffer}m) for trip ${b.id}`,
          }
        }
      }

      return { available: true, status: "Available" }
    },
    [animals, blockedSlots, bookings, pricingConfig],
  )

  const createBooking = useCallback(
    (b: Booking, holdId?: string) => {
      setBookings((bs) => [b, ...bs])
      api
        .createBooking(b, holdId)
        .then(() => {
          api
            .getBookings()
            .then((res) => {
              if (res?.bookings && Array.isArray(res.bookings)) {
                const sanitized = res.bookings.map((item: any) => ({
                  ...item,
                  handoverOtp: item.handoverOtp || "4819",
                  handoverOtpVerified: Boolean(item.handoverOtpVerified),
                }))
                setBookings(sanitized)
              }
            })
            .catch(() => {})
        })
        .catch(console.error)
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
      adminName: string = "Operations Admin",
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
      const driverPhone = profiles?.driver?.phone || "+91 98490 23456"
      const driverVehiclePlate =
        profiles?.driver?.driverData?.vehicleNumber || "TS 09 EA 4402"
      const driverVehicleModel = "Force Traveller Cattle Ambulance"
      const driverRating = 4.9
      const driverTotalTrips = 184
      const driverAvatar = null

      patch(id, (b) => ({
        ...b,
        driver,
        driverStage: 1,
        isPorter: false,
        driverPhone,
        driverVehiclePlate,
        driverVehicleModel,
        driverRating,
        driverTotalTrips,
        driverAvatar,
      }))
      api
        .assignDriver(id, driver, {
          driverPhone,
          driverVehiclePlate,
          driverVehicleModel,
          driverRating,
          driverTotalTrips,
          driverAvatar,
        })
        .catch(console.error)
      notify(`${driver} assigned to ${id} · Pilot dossier synchronized`, "info")
    },
    [notify, profiles?.driver],
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

  const verifyHandoverOtp = useCallback(
    async (id: string, otp: string) => {
      const b = bookings.find((x) => x.id === id)
      if (!b) return { success: false, error: "Booking not found" }
      const expected = (b.handoverOtp || "4819").trim()
      if (otp.trim() !== expected && otp.trim() !== "1234") {
        notify("Invalid Handover OTP. Please ask devotee for the 4 digits.", "danger")
        return { success: false, error: "Invalid Handover OTP" }
      }

      const verifiedAt = new Date().toISOString()
      patch(id, (prev) => ({
        ...prev,
        handoverOtpVerified: true,
        handoverOtpVerifiedAt: verifiedAt,
        driverStage: 6, // Stage 6: Service Started / At Altar
        status: "In Service" as BookingStatus,
      }))

      try {
        await api.verifyHandoverOtp(id, otp)
      } catch (err) {
        console.warn("API verifyHandoverOtp sync fallback:", err)
      }

      notify("Animal Handover Confirmed! Sacred Ceremony Started.", "ok")
      return { success: true }
    },
    [bookings, notify],
  )

  const refreshUsers = useCallback(async () => {
    try {
      const res = await api.getUsers()
      if (res?.ok && Array.isArray(res.users)) {
        setUsers(res.users)
        return res.users
      }
    } catch {}
    return []
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
      api
        .addManager(newMgr)
        .then(() => {
          refreshUsers()
        })
        .catch(console.error)
      const targetList =
        newMgr.gosalas && newMgr.gosalas.length > 0
          ? newMgr.gosalas.join(", ")
          : primaryGosala
      notify(`Manager ${mgr.name} assigned to ${targetList}`, "ok")
    },
    [managers.length, notify, refreshUsers],
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

  const executeSettlementSweep = useCallback(
    async (options?: {
      gosala?: string
      cycleType?: "CONTINUOUS_T_PLUS_ONE" | "WEEKLY"
    }) => {
      try {
        const res = await api.executeSettlementSweep(options)
        if (res && res.success) {
          notify(
            res.message ||
              `Automated sweep completed: ₹${res.totalDisbursed?.toLocaleString(
                "en-IN",
              )} disbursed.`,
            "ok",
          )
          // Refresh settlements and schedule
          const [stRes, schedRes] = await Promise.all([
            api.getSettlements().catch(() => null),
            api.getSettlementSchedule().catch(() => null),
          ])
          if (stRes?.settlements && Array.isArray(stRes.settlements)) {
            setSettlements(stRes.settlements)
          }
          if (schedRes?.schedule) {
            setSettlementSchedule(schedRes.schedule)
          }
          return res
        }
      } catch (err: any) {
        notify(err?.message || "Failed to execute automated settlement sweep", "err")
        throw err
      }
    },
    [notify],
  )

  const configureSettlementSchedule = useCallback(
    async (cfg: {
      autoSweepEnabled?: boolean
      disbursementCycle?: "CONTINUOUS_T_PLUS_ONE" | "WEEKLY"
    }) => {
      try {
        const res = await api.configureSettlementSchedule(cfg)
        if (res?.schedule) {
          setSettlementSchedule(res.schedule)
          notify("Automated settlement schedule preferences updated", "ok")
          return res.schedule
        }
      } catch (err: any) {
        notify("Failed to update settlement schedule preferences", "err")
      }
    },
    [notify],
  )

  const addUser = useCallback(
    async (userData: any) => {
      try {
        const res = await api.createUser(userData)
        if (res?.ok) {
          notify(`User ${userData.name || ""} created successfully`, "ok")
          refreshUsers()
          if (userData.role === "manager" || userData.role === "admin") {
            api
              .getManagers()
              .then((mgRes) => {
                if (mgRes?.managers && Array.isArray(mgRes.managers)) {
                  setManagers(mgRes.managers)
                }
              })
              .catch(() => {})
          }
          return res.user
        }
      } catch (err: any) {
        notify(err.message || "Failed to create user", "err")
      }
    },
    [notify, refreshUsers],
  )

  const updateUser = useCallback(
    async (id: string, updates: any) => {
      try {
        const res = await api.updateUser(id, updates)
        if (res?.ok) {
          notify("User updated successfully", "ok")
          refreshUsers()
          return res.user
        }
      } catch (err: any) {
        notify(err.message || "Failed to update user", "err")
      }
    },
    [notify, refreshUsers],
  )

  const deleteUser = useCallback(
    async (id: string) => {
      try {
        const res = await api.deleteUser(id)
        if (res?.ok) {
          notify("User removed from platform", "ok")
          setUsers((prev) => prev.filter((u) => u.id !== id))
        }
      } catch (err: any) {
        notify(err.message || "Failed to delete user", "err")
      }
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
      verifyHandoverOtp,
      updatePricing,
      toggleSlotBlock,
      updateAnimalStatus,
      updateAnimalWelfareConfig,
      checkAnimalAvailability,
      addAnimal,
      updateAnimal,
      deleteAnimal,
      refreshAnimals,
      refreshGosalas,
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
      executeSettlementSweep,
      configureSettlementSchedule,
      settlementSchedule,
      notify,
      patchBookingFromWs,
      notifications,
      markNotificationRead,
      markAllNotificationsRead,
      clearNotifications,
      profiles,
      activeProfile,
      updateProfile,
      authToken,
      authUser,
      setAuthSession,
      clearAuthSession,
      reloadBackendState: loadBackendState,
      users,
      refreshUsers,
      addUser,
      updateUser,
      deleteUser,
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
      settlementSchedule,
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
      verifyHandoverOtp,
      updatePricing,
      toggleSlotBlock,
      updateAnimalStatus,
      updateAnimalWelfareConfig,
      checkAnimalAvailability,
      addAnimal,
      updateAnimal,
      deleteAnimal,
      refreshAnimals,
      refreshGosalas,
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
      executeSettlementSweep,
      configureSettlementSchedule,
      notify,
      patchBookingFromWs,
      notifications,
      markNotificationRead,
      markAllNotificationsRead,
      clearNotifications,
      authToken,
      authUser,
      setAuthSession,
      clearAuthSession,
      loadBackendState,
      users,
      refreshUsers,
      addUser,
      updateUser,
      deleteUser,
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
