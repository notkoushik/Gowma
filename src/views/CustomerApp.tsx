import { useEffect, useState, useMemo } from "react"
import {
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Compass,
  Flag,
  Home,
  LogOut,
  MapPin,
  Navigation,
  Phone,
  Ruler,
  Scale,
  Search,
  ShieldCheck,
  Star,
  Ticket,
  Truck,
  Crosshair,
  Building2,
  PawPrint,
} from "lucide-react"
import { type Animal, type AnimalType } from "../data/animals"
import { pricing, type Gosala } from "../data/customer"
import { CURRENT_CUSTOMER, inr, type Booking } from "../data/mock"
import { tripStages } from "../data/driver"
import { useStore, useToast } from "../store/store"
import BookingFlow from "./customer/BookingFlow"
import { MobileGosalaProfile, EnRouteModal } from "./customer/GosalaProfile"
import { fetchRoadRoute } from "../services/routing"
import LiveTripMap from "../components/LiveTripMap"
import LocationPromptBanner from "../components/LocationPromptBanner"
import CattleAndShelterGallery from "../components/CattleAndShelterGallery"
import CustomerTrackingDossier from "../components/CustomerTrackingDossier"
import { useRealtime } from "../hooks/useRealtime"
import {
  useDeviceLocation,
  getIndianLocalityFromCoords,
} from "../hooks/useDeviceLocation"

import DesktopCustomer from "./customer/DesktopCustomer"

import EditProfileModal from "../components/EditProfileModal"
import LocationPickerModal from "../components/LocationPickerModal"
import {
  sortGaushalasByProximity,
  getGaushalaServiceability,
} from "../utils/geoDistance"
import type { OperationalRegionHub } from "../data/regions"
import type { RoleProfile } from "../data/profiles"

type Tab = "discover" | "bookings" | "track" | "profile"

export type BookingSummary = {
  animal: string
  animalName: string
  animalType: AnimalType
  gosala: string
  date: string
  time: string
  start: string
  end: string
  durationMin: number
  address: string
  distanceKm: number
  base: number
  extraTime: number
  transport: number
  addons: number
  tax: number
  total: number
  holdId?: string
  freeKmSnapshot?: number
  perKmSnapshot?: number
  extraUnitRateSnapshot?: number
  commissionSnapshot?: number
  commissionPct?: number
}

export type MyBooking = {
  id: string
  animal: string
  gosala: string
  date: string
  time: string
  total: number
  status: "Under Review" | "Confirmed" | "In Service" | "Completed" | "Rejected"
  driverStage?: number
  address?: string
  distanceKm?: number
  driver?: string | null
  handoverOtp?: string
  handoverOtpVerified?: boolean
  handoverOtpVerifiedAt?: string | null
  driverPhone?: string | null
  driverVehiclePlate?: string | null
  driverVehicleModel?: string | null
  driverRating?: number | null
  driverTotalTrips?: number | null
  driverAvatar?: string | null
}

export function makeBooking(
  s: BookingSummary,
  customerProfile?: RoleProfile,
  defaultCommissionPct: number = 20,
  authUser?: any,
): Booking {
  const custName = authUser?.name || customerProfile?.name || CURRENT_CUSTOMER
  const custPhone = authUser?.phone || customerProfile?.phone || "+91 98204 11827"
  const custEmail = authUser?.email || customerProfile?.email || "devotee@gomaa.in"
  const custAadhaar =
    authUser?.customerData?.aadhaarNumber ||
    customerProfile?.customerData?.aadhaarNumber ||
    "•••• •••• 4912"
  const custGotra =
    authUser?.customerData?.gotra ||
    customerProfile?.customerData?.gotra ||
    "Kashyapa"
  const custFamily =
    authUser?.customerData?.familyMembers ||
    customerProfile?.customerData?.familyMembers ||
    "Family Members & Devotees"
  const custNotes =
    customerProfile?.customerData?.specialNotes ||
    "Ground-floor courtyard altar prepared. Water bucket and fresh grass kept ready."

  const commPct = s.commissionPct ?? defaultCommissionPct
  const commAmount =
    s.commissionSnapshot ?? Math.round(((s.base + s.extraTime) * commPct) / 100)

  return {
    id: "GMA-" + Math.floor(24818 + Math.random() * 900),
    customer: custName,
    phone: custPhone,
    customerEmail: custEmail,
    aadhaarNumber: custAadhaar,
    devoteeGotra: custGotra,
    devoteeFamilyMembers: custFamily,
    specialInstructions: custNotes,
    gosala: s.gosala,
    animal: s.animalName,
    animalType: s.animalType,
    date: s.date,
    start: s.start,
    end: s.end,
    durationMin: s.durationMin,
    address: s.address,
    distanceKm: s.distanceKm,
    base: s.base,
    extraTime: s.extraTime,
    transport: s.transport,
    addons: s.addons,
    tax: s.tax,
    discount: 0,
    total: s.total,
    commissionPct: commPct,
    status: "Payment Verified",
    driver: null,
    driverStage: 0,
    paid: true,
    handoverOtp: String(Math.floor(1000 + Math.random() * 9000)),
    handoverOtpVerified: false,
    handoverOtpVerifiedAt: null,
    freeKmSnapshot: s.freeKmSnapshot ?? 5,
    perKmSnapshot: s.perKmSnapshot ?? 50,
    extraUnitRateSnapshot: s.extraUnitRateSnapshot ?? 500,
    commissionSnapshot: commAmount,
    createdAt: new Date().toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
  }
}

export function toMyBooking(b: Booking): MyBooking {
  const status: MyBooking["status"] =
    b.status === "Rejected"
      ? "Rejected"
      : b.status === "Completed"
        ? "Completed"
        : b.status === "In Service"
          ? "In Service"
          : b.status === "Confirmed"
            ? "Confirmed"
            : "Under Review"
  return {
    id: b.id,
    animal: `${b.animal} · ${b.animalType}`,
    gosala: b.gosala,
    date: b.date,
    time: `${b.start} – ${b.end}`,
    total: b.total,
    status,
    driverStage: b.driverStage,
    address: b.address,
    distanceKm: b.distanceKm,
    driver: b.driver,
    handoverOtp: b.handoverOtp,
    handoverOtpVerified: b.handoverOtpVerified,
    handoverOtpVerifiedAt: b.handoverOtpVerifiedAt,
    driverPhone: b.driverPhone,
    driverVehiclePlate: b.driverVehiclePlate,
    driverVehicleModel: b.driverVehicleModel,
    driverRating: b.driverRating,
    driverTotalTrips: b.driverTotalTrips,
    driverAvatar: b.driverAvatar,
  }
}

export function statusTone(s: MyBooking["status"]) {
  return {
    "Under Review": "bg-warn-soft text-warn",
    Confirmed: "bg-ok-soft text-ok",
    "In Service": "bg-info-soft text-info",
    Completed: "bg-paper-deep text-ink-soft",
    Rejected: "bg-danger-soft text-danger",
  }[s]
}

/* ---------------- Discover ---------------- */
function Discover({
  onOpenAnimal,
  onOpenGosala,
}: {
  onOpenAnimal: (a: Animal) => void
  onOpenGosala: (id: string, distanceKm?: number) => void
}) {
  const { gosalas: storeGosalas, animals: storeAnimals } = useStore()
  const { notify } = useToast()
  const [q, setQ] = useState("")
  const [address, setAddress] = useState("Kothaguda, Hyderabad")
  const [isEditingAddress, setIsEditingAddress] = useState(false)
  const [locationPickerOpen, setLocationPickerOpen] = useState(false)
  const [routeModalGosala, setRouteModalGosala] = useState<Gosala | null>(null)
  const [routeModalMode, setRouteModalMode] = useState<"route" | "pinpoint">("route")
  const deviceLocation = useDeviceLocation()

  const liveAnimals = storeAnimals || []

  const customerGosalas: Gosala[] = useMemo(() => {
    return storeGosalas.map((g, idx) => {
      const housedCows = liveAnimals.filter(
        (a) => a.gosala.toLowerCase() === g.name.toLowerCase(),
      )
      const dynamicRating = (g as any).rating || Number((4.7 + ((g.name.length * 3 + idx) % 4) * 0.1).toFixed(1))

      return {
        id: g.id,
        name: g.name,
        area: g.address || g.region || "Operational Vedic Sanctuary",
        distanceKm: (g as any).distanceKm ?? 6.5,
        rating: dynamicRating,
        animals: housedCows.length || g.capacity || 40,
        photo:
          g.photo ||
          "https://images.unsplash.com/photo-1546722228-7baeca4bd0b3?w=600&h=400&fit=crop&auto=format",
        lat:
          g.lat !== undefined && g.lat !== null
            ? Number(g.lat)
            : (g as any).latitude !== undefined && (g as any).latitude !== null
              ? Number((g as any).latitude)
              : undefined,
        lng:
          g.lng !== undefined && g.lng !== null
            ? Number(g.lng)
            : (g as any).longitude !== undefined && (g as any).longitude !== null
              ? Number((g as any).longitude)
              : undefined,
      }
    })
  }, [storeGosalas, liveAnimals])

  const sortedGaushalas = useMemo(() => {
    return sortGaushalasByProximity(
      customerGosalas,
      deviceLocation.lat,
      deviceLocation.lng,
    )
  }, [customerGosalas, deviceLocation.lat, deviceLocation.lng])

  // Prefetch and store real road driving distances for total accuracy across card and modal
  const [roadDistances, setRoadDistances] = useState<Record<string, number>>({})

  useEffect(() => {
    const lat = deviceLocation.lat || 17.4401
    const lng = deviceLocation.lng || 78.3489
    const userCoords: [number, number] = [lat, lng]

    customerGosalas.forEach((g) => {
      const gLat =
        g.lat !== undefined && g.lat !== null
          ? Number(g.lat)
          : (g as any).latitude !== undefined && (g as any).latitude !== null
            ? Number((g as any).latitude)
            : undefined
      const gLng =
        g.lng !== undefined && g.lng !== null
          ? Number(g.lng)
          : (g as any).longitude !== undefined && (g as any).longitude !== null
            ? Number((g as any).longitude)
            : undefined

      if (gLat && gLng) {
        fetchRoadRoute(userCoords, [gLat, gLng]).then((route) => {
          if (route?.distanceKm) {
            setRoadDistances((prev) => ({
              ...prev,
              [g.id]: route.distanceKm,
            }))
          }
        })
      }
    })
  }, [deviceLocation.lat, deviceLocation.lng, customerGosalas])

  const handleSelectHub = (hub: OperationalRegionHub) => {
    deviceLocation.setManualLocation(hub)
    setAddress(`${hub.name}, ${hub.city}, ${hub.state}`)
    setLocationPickerOpen(false)
  }

  const handleDetectLocation = async () => {
    const res = await deviceLocation.requestLocation()
    if (res) {
      setAddress(
        res.address || getIndianLocalityFromCoords(res.lat, res.lng),
      )
      notify(
        `📍 Live Location: ${res.city}, ${res.state} (${res.lat.toFixed(3)}° N, ${res.lng.toFixed(3)}° E) verified!`,
        "ok",
      )
    }
  }

  const [selectedCategory, setSelectedCategory] = useState<"ALL" | AnimalType>("ALL")

  const list = liveAnimals.filter((a) => {
    const qLower = q.toLowerCase().trim()
    const matchesSearch =
      qLower === "" ||
      a.name.toLowerCase().includes(qLower) ||
      a.type.toLowerCase().includes(qLower) ||
      (a.breed && a.breed.toLowerCase().includes(qLower)) ||
      (a.category && a.category.toLowerCase().includes(qLower))
    const matchesCat =
      selectedCategory === "ALL" || a.type === selectedCategory
    return matchesSearch && matchesCat
  })
  return (
    <div className="p-4 space-y-5">
      {/* Location Bar with Switcher Modal Trigger */}
      <div className="flex items-center justify-between gap-2 p-2.5 rounded-sm bg-card border border-line shadow-2xs">
        <button
          onClick={() => setLocationPickerOpen(true)}
          className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer group"
          title="Tap to select Indian region or switch city"
        >
          <div className="h-7 w-7 rounded-full bg-saffron-soft text-saffron-deep grid place-items-center shrink-0">
            <MapPin size={14} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[9.5px] uppercase font-mono tracking-wider text-ink-faint flex items-center gap-1">
              <span>Your Location</span>
              <ChevronDown size={11} className="text-ink-faint group-hover:text-saffron-deep" />
            </div>
            <div className="text-[12.5px] text-ink font-semibold truncate group-hover:text-saffron-deep flex items-center gap-1.5">
              <span>{deviceLocation.city || (deviceLocation.isLoading ? "Locating..." : address)}</span>
              {deviceLocation.source && (
                <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-medium border ${
                  deviceLocation.source === "GPS_HARDWARE"
                    ? "bg-ok-soft text-ok border-ok/30"
                    : deviceLocation.source === "IP_FALLBACK"
                      ? "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30"
                      : "bg-paper-deep text-ink-soft border-line"
                }`}>
                  {deviceLocation.source === "GPS_HARDWARE"
                    ? "🛰️ Live GPS"
                    : deviceLocation.source === "IP_FALLBACK"
                      ? "🌐 Live IP"
                      : "📍 Custom"}
                </span>
              )}
            </div>
            {deviceLocation.lat && deviceLocation.lng && (
              <div className="text-[10px] font-mono text-ink-faint truncate">
                {deviceLocation.lat.toFixed(4)}° N, {deviceLocation.lng.toFixed(4)}° E · {deviceLocation.state || "India"}
              </div>
            )}
          </div>
        </button>
        <button
          onClick={handleDetectLocation}
          disabled={deviceLocation.isLoading}
          title="Detect live GPS location"
          className="shrink-0 inline-flex items-center gap-1 bg-saffron-soft text-saffron-deep hover:bg-saffron hover:text-white rounded-sm px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer"
        >
          <Crosshair
            size={12}
            className={deviceLocation.isLoading ? "animate-spin" : ""}
          />
          <span className="text-[11px]">GPS</span>
        </button>
      </div>

      {!deviceLocation.hasPermission && (
        <LocationPromptBanner
          role="CUSTOMER"
          hasPermission={deviceLocation.hasPermission}
          permissionStatus={deviceLocation.permissionStatus}
          isLoading={deviceLocation.isLoading}
          error={deviceLocation.error}
          accuracy={deviceLocation.accuracy}
          address={deviceLocation.address}
          onRequestLocation={handleDetectLocation}
          onOpenLocationPicker={() => setLocationPickerOpen(true)}
        />
      )}

      <div className="relative">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
        />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search cow, calf, bull…"
          className="w-full bg-card border border-line rounded-sm pl-9 pr-3 py-2.5 text-[13px] text-ink outline-none focus:border-saffron focus:ring-2 focus:ring-saffron/20"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="font-serif text-[16px] text-ink">
            Nearest Gosalas
          </h2>
          <button
            onClick={() => setLocationPickerOpen(true)}
            className="text-[11px] font-mono text-saffron-deep hover:underline cursor-pointer"
          >
            {deviceLocation.city ? `Near ${deviceLocation.city}` : "All India"} ({sortedGaushalas.length})
          </button>
        </div>
        {sortedGaushalas.length === 0 ? (
          <div className="p-6 text-center rounded-sm border border-dashed border-line bg-card/60">
            <Building2 size={26} className="mx-auto text-saffron-deep/70 mb-2" />
            <p className="font-serif text-[15px] text-ink font-semibold">
              No Gaushalas registered yet
            </p>
            <p className="text-[12px] text-ink-soft max-w-xs mx-auto mt-1 leading-relaxed">
              As Gaushalas register their sanctuaries on GOMAA, they will appear here with live darshan timings.
            </p>
          </div>
        ) : (
          <div className="flex gap-3.5 overflow-x-auto -mx-4 px-4 pb-2">
            {sortedGaushalas.map(({ gosala: g, serviceability }) => {
              const housedCount = liveAnimals.filter(
                (a) => a.gosala.toLowerCase() === g.name.toLowerCase(),
              ).length
              const cattleLabel =
                housedCount > 0
                  ? `${housedCount} cattle`
                  : g.animals && g.animals > 0
                    ? `Cap: ${g.animals} cattle`
                    : "Intake Open"

              return (
                <div
                  key={g.id}
                  className="w-[260px] shrink-0 rounded-lg border border-line bg-card overflow-hidden text-left hover:border-line-strong transition-all flex flex-col justify-between shadow-xs"
                >
                  <div
                    onClick={() =>
                      onOpenGosala(
                        g.id,
                        roadDistances[g.id] ?? serviceability.distanceKm,
                      )
                    }
                    className="cursor-pointer"
                  >
                    <div className="h-28 bg-paper-deep relative overflow-hidden">
                      <img
                        src={g.photo}
                        alt={g.name}
                        className="h-full w-full object-cover"
                      />
                      <span
                        className={`absolute top-2 right-2 text-[9.5px] px-1.5 py-0.5 rounded font-medium shadow-2xs border ${serviceability.badgeClass}`}
                      >
                        {serviceability.badgeText}
                      </span>
                    </div>
                    <div className="p-3">
                      <div className="text-[13.5px] text-ink font-semibold truncate">
                        {g.name}
                      </div>
                      <div className="text-[11px] text-ink-faint mt-0.5 truncate flex items-center gap-1">
                        <MapPin size={10} className="text-saffron shrink-0" />
                        <span className="truncate">{g.area}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-[11px]">
                        <span className="inline-flex items-center gap-1 text-ink-soft">
                          <Star size={11} className="text-saffron fill-saffron" />{" "}
                          {g.rating}
                        </span>
                        <span className="inline-flex items-center gap-1 text-ink-soft font-mono tabular font-medium">
                          <Navigation size={11} className="text-forest" /> {roadDistances[g.id] ?? serviceability.distanceKm} km
                        </span>
                        <span className="text-ink-faint font-medium">· {cattleLabel}</span>
                      </div>
                    </div>
                  </div>

                  <div className="px-3 pb-2.5 pt-1.5 border-t border-line/50 bg-paper/40 flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setRouteModalGosala(g)
                          setRouteModalMode("route")
                        }}
                        className="px-2 py-1 rounded bg-forest/10 hover:bg-forest text-forest hover:text-white border border-forest/20 text-[10.5px] font-medium transition inline-flex items-center gap-1 cursor-pointer"
                        title="Check driving en route"
                      >
                        <Navigation size={10} />
                        <span>En Route</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setRouteModalGosala(g)
                          setRouteModalMode("pinpoint")
                        }}
                        className="px-2 py-1 rounded bg-card hover:bg-paper-deep text-ink-soft hover:text-ink border border-line text-[10.5px] font-medium transition inline-flex items-center gap-1 cursor-pointer"
                        title="View exact map pin"
                      >
                        <MapPin size={10} className="text-saffron" />
                        <span>Location</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        onOpenGosala(
                          g.id,
                          roadDistances[g.id] ?? serviceability.distanceKm,
                        )
                      }
                      className="text-[11px] text-saffron-deep hover:underline font-semibold flex items-center gap-0.5 cursor-pointer"
                    >
                      <span>Profile →</span>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <LocationPickerModal
        isOpen={locationPickerOpen}
        onClose={() => setLocationPickerOpen(false)}
        currentCity={deviceLocation.city}
        currentAddress={address}
        onSelectHub={handleSelectHub}
        onDetectGPS={handleDetectLocation}
        isDetectingGPS={deviceLocation.isLoading}
      />

      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-serif text-[16px] text-ink">
            Available animals
          </h2>
          <span className="font-mono text-[11px] text-ink-faint">
            {list.length} {list.length === 1 ? "bovine" : "bovines"}
          </span>
        </div>

        {/* Bovine Category Filter Pills */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-3 -mx-1 px-1 scrollbar-none">
          {[
            { id: "ALL", label: "All Bovines" },
            { id: "Cow & Calf", label: "Cow & Calf Pair (Jodi)" },
            { id: "Cow", label: "Cow (Gau Mata)" },
            { id: "Calf", label: "Calf (Vatsa)" },
            { id: "Bull", label: "Bull (Nandi)" },
            { id: "Buffalo", label: "Buffalo (Mahishi)" },
          ].map((cat) => {
            const count =
              cat.id === "ALL"
                ? liveAnimals.length
                : liveAnimals.filter((a) => a.type === cat.id).length
            const active = selectedCategory === cat.id
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id as any)}
                className={`shrink-0 px-2.5 py-1 rounded-full text-[11.5px] transition flex items-center gap-1.5 cursor-pointer border ${
                  active
                    ? "bg-saffron text-white border-saffron font-medium shadow-2xs"
                    : "bg-card text-ink-soft border-line hover:border-line-strong hover:text-ink"
                }`}
              >
                <span>{cat.label}</span>
                <span
                  className={`text-[9.5px] font-mono px-1 rounded-full ${
                    active ? "bg-white/20 text-white" : "bg-paper-deep text-ink-faint"
                  }`}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {list.length === 0 ? (
          <div className="p-6 text-center rounded-sm border border-dashed border-line bg-card/60">
            <PawPrint size={26} className="mx-auto text-saffron-deep/70 mb-2" />
            <p className="font-serif text-[15px] text-ink font-semibold">
              No sacred cattle found
            </p>
            <p className="text-[12px] text-ink-soft max-w-xs mx-auto mt-1 leading-relaxed">
              No bovines registered under &ldquo;{selectedCategory}&rdquo; matching your search. Try switching categories or clearing search.
            </p>
            {selectedCategory !== "ALL" && (
              <button
                onClick={() => setSelectedCategory("ALL")}
                className="mt-3 text-[11.5px] text-saffron-deep hover:underline cursor-pointer font-medium"
              >
                Show all cattle ({liveAnimals.length})
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {list.map((a) => (
              <button
                key={a.name}
                onClick={() => onOpenAnimal(a)}
                className="w-full flex gap-3 rounded-sm border border-line bg-card p-3 text-left hover:border-line-strong transition-colors"
              >
                <div className="h-20 w-20 rounded-sm bg-paper-deep overflow-hidden shrink-0">
                  <img
                    src={a.photo}
                    alt={a.name}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-serif text-[16px] text-ink">
                      {a.name}
                    </span>
                    <span className="font-mono text-[13px] text-ink tabular font-medium">
                      {inr(a.price)}
                    </span>
                  </div>
                  <div className="text-[11.5px] text-ink-faint flex items-center gap-1.5 flex-wrap mt-0.5">
                    <span className="font-medium text-ink-soft">{a.type}</span>
                    {a.type === "Cow & Calf" && (
                      <span className="text-[9.5px] font-semibold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-300">
                        Mother & Calf Pair
                      </span>
                    )}
                    {a.type === "Buffalo" && (
                      <span className="text-[9.5px] font-medium px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-800 border border-indigo-200">
                        Mahishi
                      </span>
                    )}
                    <span>·</span>
                    <span>{a.category}</span>
                  </div>
                  <div className="text-[11px] text-ink-faint mt-1 truncate">
                    {a.gosala}
                  </div>
                  <div className="mt-1.5">
                    <span
                      className={`text-[10.5px] rounded-full px-2 py-0.5 ${
                        a.status === "Available"
                          ? "bg-ok-soft text-ok"
                          : a.status === "Resting Buffer"
                            ? "bg-warn-soft text-warn"
                            : "bg-saffron-soft text-saffron-deep"
                      }`}
                    >
                      {a.status}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      {routeModalGosala && (
        <EnRouteModal
          isOpen={!!routeModalGosala}
          onClose={() => setRouteModalGosala(null)}
          gosalaName={routeModalGosala.name}
          gosalaAddress={routeModalGosala.area || routeModalGosala.name}
          gosalaLat={routeModalGosala.lat ?? (routeModalGosala as any).latitude}
          gosalaLng={routeModalGosala.lng ?? (routeModalGosala as any).longitude}
          customerLat={deviceLocation.lat || undefined}
          customerLng={deviceLocation.lng || undefined}
          customerAddress={address || deviceLocation.address || undefined}
          mode={routeModalMode}
        />
      )}
    </div>
  )
}

/* ---------------- Animal detail ---------------- */
function AnimalDetail({
  animal,
  onBack,
  onBook,
}: {
  animal: Animal
  onBack: () => void
  onBook: (g: Gosala) => void
}) {
  const { gosalas: storeGosalas } = useStore()
  const matchedStore = storeGosalas.find(
    (g) =>
      g.name.toLowerCase() === animal.gosala.toLowerCase() ||
      g.name.toLowerCase().includes(animal.gosala.toLowerCase()) ||
      animal.gosala.toLowerCase().includes(g.name.toLowerCase()),
  )

  const effectiveGosala: Gosala = {
    id: matchedStore?.id ?? "GOS-101",
    name: matchedStore?.name ?? animal.gosala,
    area: matchedStore?.address ?? matchedStore?.region ?? "Operational Vedic Sanctuary",
    distanceKm: (matchedStore as any)?.distanceKm ?? 6.2,
    rating: (matchedStore as any)?.rating ?? 4.8,
    animals: matchedStore?.capacity ?? 40,
    photo:
      matchedStore?.photo ??
      "https://images.unsplash.com/photo-1546722228-7baeca4bd0b3?w=600&h=400&fit=crop&auto=format",
    lat: matchedStore?.lat,
    lng: matchedStore?.lng,
  }

  return (
    <div className="pb-24">
      {/* Dynamic Multi-Photo Gallery for Sacred Cow & Shelter Premises */}
      <div className="p-2 sm:p-4 bg-paper/60">
        <CattleAndShelterGallery
          animal={animal}
          gosalaName={animal.gosala}
          onBack={onBack}
        />
      </div>

      <div className="p-4 space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-serif text-[24px] text-ink leading-tight">
              {animal.name}
            </h1>
            <div className="text-[12.5px] text-ink-faint">
              {animal.breed || animal.type} · {animal.category}
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-[20px] text-ink tabular">
              {inr(animal.price)}
            </div>
            <div className="text-[11px] text-ink-faint">base · 60 min</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            [Clock, "Age", animal.age],
            [Scale, "Weight", animal.weight],
            [Ruler, "Height", animal.height],
          ].map(([Icon, l, v]: any) => (
            <div
              key={l}
              className="rounded-sm border border-line bg-card p-3 text-center"
            >
              <Icon size={15} className="text-saffron mx-auto" />
              <div className="font-mono text-[9px] uppercase tracking-wider text-ink-faint mt-1.5">
                {l}
              </div>
              <div className="text-[13px] text-ink mt-0.5 tabular">{v}</div>
            </div>
          ))}
        </div>

        <div className="rounded-sm border border-line bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-sm bg-paper-deep overflow-hidden shrink-0 border border-line">
              <img
                src={effectiveGosala.photo}
                alt={effectiveGosala.name}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[13.5px] font-medium text-ink truncate">{effectiveGosala.name}</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-50 text-emerald-700 font-mono border border-emerald-200 shrink-0">AWBI Verified</span>
              </div>
              <div className="text-[11.5px] text-ink-faint">{effectiveGosala.area}</div>
            </div>
            <div className="text-right">
              <div className="inline-flex items-center gap-1 text-[12px] text-ink-soft">
                <Star size={12} className="text-saffron fill-saffron" />{" "}
                {effectiveGosala.rating}
              </div>
              <div className="font-mono text-[11px] text-ink-faint tabular">
                {effectiveGosala.distanceKm} km
              </div>
            </div>
          </div>
        </div>

        <div>
          <h3 className="font-serif text-[15px] text-ink mb-2">
            Booking rules
          </h3>
          <ul className="space-y-1.5 text-[12.5px] text-ink-soft">
            <li className="flex gap-2">
              <span className="text-saffron">›</span> Standard 60-minute
              booking; extra time at {inr(pricing.extraUnitRate)}/
              {pricing.extraUnitMin} min
            </li>
            <li className="flex gap-2">
              <span className="text-saffron">›</span> Transport free within{" "}
              {pricing.freeKm} km, then {inr(pricing.perKm)}/km
            </li>
            <li className="flex gap-2">
              <span className="text-saffron">›</span> Availability is reserved
              per individual animal & time range
            </li>
            <li className="flex gap-2">
              <span className="text-saffron">›</span> Slot held during checkout
              · payment verified server-side
            </li>
          </ul>
        </div>
      </div>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[440px] border-t border-line bg-card p-4 flex items-center gap-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            From
          </div>
          <div className="font-mono text-[16px] text-ink tabular">
            {inr(animal.price)}
          </div>
        </div>
        <button
          onClick={() => onBook(effectiveGosala)}
          disabled={animal.status !== "Available"}
          className="ml-auto bg-saffron text-white rounded-sm px-8 py-3 text-[14px] font-medium hover:bg-saffron-deep disabled:opacity-40 transition-colors"
        >
          {animal.status !== "Available" ? "Unavailable" : "Book now"}
        </button>
      </div>
    </div>
  )
}

/* ---------------- Bookings ---------------- */
function Bookings({
  list,
  onTrack,
}: {
  list: MyBooking[]
  onTrack: (bookingId?: string) => void
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-serif text-[22px] text-ink">My bookings</h1>
        <span className="text-[12px] font-mono text-ink-faint">
          {list.length} {list.length === 1 ? "booking" : "bookings"}
        </span>
      </div>
      {list.length === 0 && (
        <div className="p-8 text-center border border-dashed border-line rounded bg-card text-ink-faint text-[13px]">
          No bookings placed yet.
        </div>
      )}
      {list.map((b) => {
        const isExpanded = expandedId === b.id
        return (
          <div
            key={b.id}
            className={`rounded-sm border transition-all duration-200 bg-card overflow-hidden ${
              isExpanded
                ? "border-saffron/50 shadow-md ring-1 ring-saffron/20"
                : "border-line hover:border-line-strong shadow-2xs"
            }`}
          >
            {/* Header / Minimized Clickable Summary Row */}
            <div
              onClick={() => setExpandedId(isExpanded ? null : b.id)}
              className="p-4 cursor-pointer select-none"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11.5px] text-ink-faint">
                  {b.id}
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10.5px] rounded-full px-2 py-0.5 ${statusTone(b.status)}`}
                  >
                    {b.status}
                  </span>
                  <div
                    className={`p-1 rounded-full text-ink-faint transition-transform duration-200 ${
                      isExpanded ? "rotate-180 text-saffron-deep" : ""
                    }`}
                  >
                    <ChevronDown size={15} />
                  </div>
                </div>
              </div>

              <div className="flex items-baseline justify-between mt-1.5">
                <div className="font-serif text-[17px] text-ink font-medium">
                  {b.animal}
                </div>
                <div className="font-mono text-[14px] text-ink tabular font-medium">
                  {inr(b.total)}
                </div>
              </div>

              <div className="text-[12px] text-ink-faint truncate">
                {b.gosala}
              </div>

              <div className="flex items-center gap-3 text-[12px] text-ink-soft mt-2 font-mono tabular">
                <span>{b.date}</span>
                <span className="text-ink-faint">·</span>
                <span>{b.time}</span>
              </div>
            </div>

            {/* Expandable Details Drawer */}
            {isExpanded && (
              <div className="px-4 pb-4 pt-2 border-t border-line/60 bg-paper/50 space-y-3 text-[12.5px] animate-fade-in">
                {b.address && (
                  <div className="flex items-start gap-2 text-ink-soft">
                    <MapPin size={14} className="text-saffron shrink-0 mt-0.5" />
                    <div>
                      <div className="text-[10.5px] uppercase font-mono text-ink-faint">
                        Ceremony Address
                      </div>
                      <div className="text-ink font-medium">{b.address}</div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-line/40">
                  <div>
                    <div className="text-[10.5px] uppercase font-mono text-ink-faint">
                      Transit Distance
                    </div>
                    <div className="text-ink font-medium">
                      {b.distanceKm ? `${b.distanceKm} km` : "Safe Zone"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10.5px] uppercase font-mono text-ink-faint">
                      Transport & Handler
                    </div>
                    <div className="text-ink font-medium">
                      {b.driver || "Assigned by Gaushala"}
                    </div>
                  </div>
                </div>

                <div className="p-2.5 rounded bg-saffron-soft/30 border border-saffron/20 text-[11.5px] text-ink-soft">
                  <span className="font-medium text-saffron-deep">
                    Ritual Preparation:
                  </span>{" "}
                  Ground-floor portico ready, clean water bucket and sacred green
                  grass feeding protocol.
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-line/60">
                  <span className="text-[11.5px] text-forest font-medium inline-flex items-center gap-1">
                    <ShieldCheck size={13} /> Verified Devotee Booking
                  </span>
                  {b.status !== "Rejected" && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onTrack(b.id)
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-saffron text-white text-[12px] font-medium shadow-xs hover:bg-saffron-deep transition cursor-pointer"
                    >
                      <Truck size={13} /> Track live
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ---------------- Track ---------------- */
function Track({
  booking,
  bookingsList = [],
  onSelectBooking,
}: {
  booking?: MyBooking
  bookingsList?: MyBooking[]
  onSelectBooking?: (id: string) => void
}) {
  const deviceLocation = useDeviceLocation()
  if (!booking)
    return (
      <div className="p-10 text-center">
        <Truck size={30} className="text-ink-faint mx-auto" />
        <p className="text-[13px] text-ink-faint mt-3">
          No active trip to track right now.
        </p>
      </div>
    )

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-[22px] text-ink">Live tracking</h1>
        {bookingsList.length > 1 && (
          <select
            value={booking.id}
            onChange={(e) => onSelectBooking?.(e.target.value)}
            className="text-[11px] font-mono bg-card border border-line rounded px-2 py-1 text-ink-soft cursor-pointer max-w-[170px] truncate"
          >
            {bookingsList.map((b) => (
              <option key={b.id} value={b.id}>
                {b.id} · {b.status}
              </option>
            ))}
          </select>
        )}
      </div>

      <LocationPromptBanner
        role="CUSTOMER"
        hasPermission={deviceLocation.hasPermission}
        permissionStatus={deviceLocation.permissionStatus}
        isLoading={deviceLocation.isLoading}
        error={deviceLocation.error}
        accuracy={deviceLocation.accuracy}
        address={deviceLocation.address}
        onRequestLocation={deviceLocation.requestLocation}
      />

      <CustomerTrackingDossier
        booking={booking}
        customerCoords={
          deviceLocation.lat && deviceLocation.lng
            ? [deviceLocation.lat, deviceLocation.lng]
            : null
        }
        layoutMode="compact"
        heightClass="h-56"
      />
    </div>
  )
}

/* ---------------- Mobile shell ---------------- */
function MobileCustomer({
  onSignOut,
  myBookings,
  onCreate,
}: {
  onSignOut: () => void
  myBookings: MyBooking[]
  onCreate: (s: BookingSummary) => void
}) {
  const { profiles, refreshAnimals, authUser } = useStore()
  const [tab, setTab] = useState<Tab>("discover")

  useEffect(() => {
    refreshAnimals?.().catch(() => {})
  }, [refreshAnimals])
  const [detail, setDetail] = useState<Animal | null>(null)
  const [gosalaProfileId, setGosalaProfileId] = useState<string | null>(null)
  const [gosalaProfileDist, setGosalaProfileDist] = useState<number | undefined>(undefined)
  const [flow, setFlow] = useState<{ animal: Animal; gosala: Gosala } | null>(
    null,
  )
  const [editProfileOpen, setEditProfileOpen] = useState(false)
  const [openProfileSection, setOpenProfileSection] = useState<string | null>(null)
  const [selectedTrackBookingId, setSelectedTrackBookingId] = useState<string | null>(null)

  const customerProfile = profiles?.customer
  const devoteeName = authUser?.name || customerProfile?.name || CURRENT_CUSTOMER

  const activeTrip =
    (selectedTrackBookingId
      ? myBookings.find((b) => b.id === selectedTrackBookingId)
      : null) ||
    myBookings.find((b) => b.status === "In Service") ||
    myBookings.find((b) => b.status === "Confirmed" && b.driver) ||
    myBookings.find((b) => b.status === "Confirmed") ||
    myBookings.find((b) => b.status === "Under Review") ||
    myBookings[0]

  const tabs: { id: Tab; label: string; icon: typeof Home }[] = [
    { id: "discover", label: "Discover", icon: Compass },
    { id: "bookings", label: "Bookings", icon: Ticket },
    { id: "track", label: "Track", icon: Truck },
    { id: "profile", label: "Profile", icon: Home },
  ]

  return (
    <div className="min-h-screen bg-paper-deep flex justify-center">
      <div className="w-full max-w-[440px] min-h-screen bg-paper flex flex-col shadow-xl border-x border-line relative">
        {/* App bar */}
        <header className="h-14 px-4 flex items-center gap-3 border-b border-line bg-card sticky top-0 z-20">
          <div className="h-8 w-8 rounded-sm bg-saffron grid place-items-center font-serif text-[16px] text-white">
            G
          </div>
          <div className="leading-none">
            <div className="font-serif text-[16px]">GOMAA</div>
            <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-faint mt-0.5">
              Book a Gau Seva
            </div>
          </div>
          <button
            className="ml-auto relative h-9 w-9 grid place-items-center rounded-sm text-ink-soft"
            aria-label="Notifications"
          >
            <Bell size={17} />
            <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-saffron" />
          </button>
          <button
            onClick={onSignOut}
            className="text-ink-faint hover:text-ink p-1"
            aria-label="Sign out"
          >
            <LogOut size={16} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto pb-16">
          {detail ? (
            <AnimalDetail
              animal={detail}
              onBack={() => setDetail(null)}
              onBook={(g) => setFlow({ animal: detail, gosala: g })}
            />
          ) : gosalaProfileId ? (
            <MobileGosalaProfile
              gosalaId={gosalaProfileId}
              distanceKm={gosalaProfileDist}
              onBack={() => {
                setGosalaProfileId(null)
                setGosalaProfileDist(undefined)
              }}
              onSelectAnimal={(a) => {
                setGosalaProfileId(null)
                setGosalaProfileDist(undefined)
                setDetail(a)
              }}
            />
          ) : (
            <>
              {tab === "discover" && (
                <Discover
                  onOpenAnimal={setDetail}
                  onOpenGosala={(id, dist) => {
                    setGosalaProfileId(id)
                    setGosalaProfileDist(dist)
                  }}
                />
              )}
              {tab === "bookings" && (
                <Bookings
                  list={myBookings}
                  onTrack={(bookingId) => {
                    if (bookingId) setSelectedTrackBookingId(bookingId)
                    setTab("track")
                  }}
                />
              )}
              {tab === "track" && (
                <Track
                  booking={activeTrip}
                  bookingsList={myBookings}
                  onSelectBooking={setSelectedTrackBookingId}
                />
              )}
              {tab === "profile" && (
                <div className="p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-14 w-14 rounded-full bg-forest text-white grid place-items-center font-serif text-[20px]">
                        {devoteeName.slice(0, 1)}
                      </div>
                      <div>
                        <div className="font-serif text-[19px] text-ink">
                          {devoteeName}
                        </div>
                        <div className="text-[12px] text-ink-faint">
                          {customerProfile?.phone || "+91 98204 11827"} ·{" "}
                          {customerProfile?.email || "ananya@gomaa.in"}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setEditProfileOpen(true)}
                      className="px-2.5 py-1 text-[11px] font-medium text-forest bg-forest-soft border border-forest/30 rounded hover:bg-forest hover:text-white transition-all shadow-2xs"
                    >
                      Edit
                    </button>
                  </div>

                  {/* Devotee verification dossier - Collapsible accordion */}
                  <div className="rounded border border-line bg-card overflow-hidden transition-all shadow-2xs">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenProfileSection(
                          openProfileSection === "verification"
                            ? null
                            : "verification",
                        )
                      }
                      className="w-full flex items-center justify-between p-3.5 text-left bg-card hover:bg-paper-deep/60 transition cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <ShieldCheck size={16} className="text-forest" />
                        <div>
                          <div className="text-[12.5px] font-semibold text-ink">
                            Devotee Verification & Altar Setup Dossier
                          </div>
                          <div className="text-[11px] text-ink-faint">
                            Aadhaar verified · {customerProfile?.customerData?.gotra || "Kashyapa"} gotra
                          </div>
                        </div>
                      </div>
                      <ChevronDown
                        size={16}
                        className={`text-ink-faint transition-transform duration-200 shrink-0 ${
                          openProfileSection === "verification" ? "rotate-180 text-forest" : ""
                        }`}
                      />
                    </button>

                    {openProfileSection === "verification" && (
                      <div className="p-3.5 border-t border-line/60 bg-paper/40 space-y-2 text-[12px] animate-fade-in">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-[10.5px] uppercase font-mono text-ink-faint block">Devotee Gotra</span>
                            <strong className="text-ink font-medium">{customerProfile?.customerData?.gotra || "Kashyapa"}</strong>
                          </div>
                          <div>
                            <span className="text-[10.5px] uppercase font-mono text-ink-faint block">Aadhaar (Verified)</span>
                            <strong className="font-mono text-ink">{customerProfile?.customerData?.aadhaarNumber || "•••• •••• 4912"}</strong>
                          </div>
                        </div>
                        <div className="pt-1.5 border-t border-line/40">
                          <span className="text-[10.5px] uppercase font-mono text-ink-faint block">Default Puja Venue</span>
                          <span className="text-ink font-medium">{customerProfile?.customerData?.defaultAddress || "Flat 402, Aditya Heights, Kondapur, Hyderabad"}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Profile Accordion Drawers */}
                  {[
                    {
                      id: "addresses",
                      label: "Saved addresses",
                      subtitle: customerProfile?.customerData?.defaultAddress || "Flat 402, Aditya Heights, Kondapur, Hyderabad",
                      content: (
                        <div className="space-y-2 text-[12px]">
                          <div className="p-2.5 rounded bg-card border border-line flex items-start justify-between">
                            <div>
                              <div className="font-medium text-ink flex items-center gap-1.5">
                                <MapPin size={12} className="text-saffron" /> Home (Default Altar)
                              </div>
                              <div className="text-ink-soft text-[11.5px] mt-0.5">
                                {customerProfile?.customerData?.defaultAddress || "Flat 402, Aditya Heights, Kondapur, Hyderabad"}
                              </div>
                            </div>
                            <span className="text-[10px] font-mono bg-forest/10 text-forest px-1.5 py-0.5 rounded">Active</span>
                          </div>
                        </div>
                      ),
                    },
                    {
                      id: "payments",
                      label: "Payment methods",
                      subtitle: "UPI Auto-Pay & Net Banking Escrow",
                      content: (
                        <div className="space-y-2 text-[12px]">
                          <div className="p-2.5 rounded bg-card border border-line">
                            <div className="font-medium text-ink">UPI ID (Google Pay / PhonePe)</div>
                            <div className="font-mono text-ink-soft text-[11.5px]">ananya.deshmukh@okhdfcbank</div>
                            <div className="text-[10.5px] text-forest mt-1">✓ Verified for Cow Seva Escrow Protection</div>
                          </div>
                        </div>
                      ),
                    },
                    {
                      id: "notifications",
                      label: "Notifications",
                      subtitle: "WhatsApp live dispatches & Puja reminders",
                      content: (
                        <div className="space-y-1.5 text-[12px] text-ink-soft">
                          <div className="flex items-center justify-between py-1 border-b border-line/40">
                            <span>WhatsApp Trip Tracking</span>
                            <span className="text-forest font-semibold text-[11px]">Enabled</span>
                          </div>
                          <div className="flex items-center justify-between py-1 border-b border-line/40">
                            <span>SMS Muhurat Updates</span>
                            <span className="text-forest font-semibold text-[11px]">Enabled</span>
                          </div>
                          <div className="flex items-center justify-between py-1">
                            <span>Gaushala Welfare News</span>
                            <span className="text-ink-faint text-[11px]">Monthly</span>
                          </div>
                        </div>
                      ),
                    },
                    {
                      id: "support",
                      label: "Help & support",
                      subtitle: "Gowmaa Dedicated Care Desk · 24/7",
                      content: (
                        <div className="space-y-2 text-[12px]">
                          <div className="text-ink-soft">
                            Have questions regarding animal welfare, muhurat rescheduling, or cow transport?
                          </div>
                          <div className="flex items-center gap-2 pt-1">
                            <a
                              href="tel:+919820411827"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-forest text-white text-[11.5px] font-medium"
                            >
                              <Phone size={12} /> Call Care Desk
                            </a>
                          </div>
                        </div>
                      ),
                    },
                  ].map((item) => {
                    const isOpen = openProfileSection === item.id
                    return (
                      <div
                        key={item.id}
                        className="rounded-sm border border-line bg-card overflow-hidden transition-all shadow-2xs"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setOpenProfileSection(isOpen ? null : item.id)
                          }
                          className="w-full flex items-center justify-between px-4 py-3.5 text-[13.5px] text-ink hover:bg-paper-deep/60 transition cursor-pointer select-none"
                        >
                          <div>
                            <div className="font-medium text-ink">{item.label}</div>
                            <div className="text-[11px] text-ink-faint">{item.subtitle}</div>
                          </div>
                          <ChevronDown
                            size={16}
                            className={`text-ink-faint transition-transform duration-200 shrink-0 ${
                              isOpen ? "rotate-180 text-forest" : ""
                            }`}
                          />
                        </button>
                        {isOpen && (
                          <div className="px-4 pb-4 pt-2 border-t border-line/60 bg-paper/40 animate-fade-in">
                            {item.content}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Bottom tab bar */}
        {!detail && !gosalaProfileId && (
          <nav className="absolute bottom-0 left-0 right-0 h-16 border-t border-line bg-card flex">
            {tabs.map((t) => {
              const active = tab === t.id
              const Icon = t.icon
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex-1 flex flex-col items-center justify-center gap-1 text-[10.5px] transition-colors ${
                    active ? "text-saffron-deep" : "text-ink-faint"
                  }`}
                >
                  <Icon size={19} className={active ? "text-saffron" : ""} />
                  {t.label}
                  {t.id === "track" && activeTrip && (
                    <span className="absolute translate-x-4 -translate-y-4 h-1.5 w-1.5 rounded-full bg-saffron" />
                  )}
                </button>
              )
            })}
          </nav>
        )}

        {flow && (
          <BookingFlow
            animal={flow.animal}
            gosala={flow.gosala}
            onClose={() => setFlow(null)}
            onComplete={(s) => {
              onCreate(s)
              setFlow(null)
              setDetail(null)
              setTab("bookings")
            }}
          />
        )}

        {editProfileOpen && (
          <EditProfileModal
            role="customer"
            onClose={() => setEditProfileOpen(false)}
          />
        )}
      </div>
    </div>
  )
}

/* ---------------- Responsive wrapper ---------------- */
function useIsDesktop() {
  const [desktop, setDesktop] = useState(
    typeof window !== "undefined"
      ? window.matchMedia("(min-width: 1024px)").matches
      : false,
  )
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)")
    const on = () => setDesktop(mq.matches)
    mq.addEventListener("change", on)
    return () => mq.removeEventListener("change", on)
  }, [])
  return desktop
}

export default function CustomerApp({ onSignOut }: { onSignOut: () => void }) {
  const { bookings, createBooking, profiles, pricingConfig, authUser } = useStore()
  const isDesktop = useIsDesktop()
  const customerProfile = profiles?.customer
  const currentDevotee = authUser?.name || customerProfile?.name || CURRENT_CUSTOMER

  const myBookings = bookings
    .filter((b) => {
      if (authUser?.name && b.customer?.toLowerCase() === authUser.name.toLowerCase()) return true
      if (authUser?.phone && b.phone === authUser.phone) return true
      if (authUser?.email && (b as any).customerEmail === authUser.email) return true
      if (b.customer === currentDevotee) return true
      if (!authUser && b.customer === CURRENT_CUSTOMER) return true
      return false
    })
    .map(toMyBooking)

  const create = (s: BookingSummary) =>
    createBooking(
      makeBooking(s, customerProfile, pricingConfig?.commissionPct, authUser),
      s.holdId,
    )

  return isDesktop ? (
    <DesktopCustomer
      onSignOut={onSignOut}
      myBookings={myBookings}
      onCreate={create}
    />
  ) : (
    <MobileCustomer
      onSignOut={onSignOut}
      myBookings={myBookings}
      onCreate={create}
    />
  )
}
