import { useState, useMemo, useRef, useEffect } from "react"
import L from "leaflet"
import {
  Award,
  ChevronLeft,
  ChevronRight,
  Clock,
  Droplets,
  Heart,
  Leaf,
  MapPin,
  Phone,
  Shield,
  Sprout,
  Star,
  TreeDeciduous,
  Navigation,
  Calendar,
  Users,
  Mail,
  CheckCircle2,
  Stethoscope,
  Syringe,
  UtensilsCrossed,
  Compass,
  ExternalLink,
  X,
  Car,
  ShieldCheck,
  Sparkles,
} from "lucide-react"
import { gosalaDetails, type GosalaDetail } from "../../data/customer"
import { type Animal, type EmpanelledVet } from "../../data/animals"
import { inr } from "../../data/mock"
import { useStore } from "../../store/store"
import { api } from "../../services/api"
import { useDeviceLocation } from "../../hooks/useDeviceLocation"
import {
  fetchRoadRoute,
  getCachedOrEstimatedRoadDistance,
  type RoadRoute,
} from "../../services/routing"
import { createResilientTileLayer } from "../../lib/mapTiles"

// Great-circle Haversine formula for exact distance computation
function computeHaversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371 // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

export function resolveGosalaDetail(
  gosalaId: string,
  storeGosalas: any[],
  storeAnimals: Animal[] = [],
  storeVets: EmpanelledVet[] = [],
  customerCoords?: { lat: number; lng: number } | null,
  overrideDistanceKm?: number,
): GosalaDetail | null {
  const found = storeGosalas.find(
    (sg) =>
      sg.id === gosalaId ||
      sg.name.toLowerCase() === gosalaId.toLowerCase() ||
      sg.name.toLowerCase().includes(gosalaId.toLowerCase()),
  )
  if (!found) {
    if (gosalaDetails[gosalaId]) return gosalaDetails[gosalaId]
    const firstKey = Object.keys(gosalaDetails)[0]
    return gosalaDetails[firstKey] || null
  }

  const name = found.name
  const initials =
    name
      .split(" ")
      .map((w: string) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "GS"

  const photo =
    found.photo ||
    "https://images.unsplash.com/photo-1546722228-7baeca4bd0b3?w=600&h=400&fit=crop&auto=format"
  const gallery =
    found.photos && found.photos.length > 0
      ? found.photos
      : [
          photo,
          "https://images.unsplash.com/photo-1500595046743-cd271d694d30?w=600&h=400&fit=crop&auto=format",
        ]

  // Count actual animals dynamically from the store
  const matchingAnimals = storeAnimals.filter(
    (a) =>
      a.gosala.toLowerCase() === found.name.toLowerCase() ||
      a.gosala.toLowerCase().includes(found.name.toLowerCase()) ||
      found.name.toLowerCase().includes(a.gosala.toLowerCase()),
  )

  const cowCount = matchingAnimals.filter(
    (a) => a.type === "Cow" || (a as any).category === "Cow",
  ).length
  const calfCount = matchingAnimals.filter(
    (a) => a.type === "Calf" || (a as any).category === "Calf",
  ).length
  const bullCount = matchingAnimals.filter(
    (a) => a.type === "Bull" || (a as any).category === "Bull",
  ).length
  const totalAnimals =
    matchingAnimals.length > 0 ? matchingAnimals.length : (found.capacity || 40)

  // Assigned Vet lookup
  const assignedVet = storeVets.find((v) =>
    v.assignedGosalas?.some(
      (g: string) =>
        g.toLowerCase() === found.name.toLowerCase() ||
        found.name.toLowerCase().includes(g.toLowerCase()),
    ),
  )

  const gLat =
    found.lat !== undefined && found.lat !== null
      ? Number(found.lat)
      : (found as any).latitude !== undefined && (found as any).latitude !== null
        ? Number((found as any).latitude)
        : undefined
  const gLng =
    found.lng !== undefined && found.lng !== null
      ? Number(found.lng)
      : (found as any).longitude !== undefined && (found as any).longitude !== null
        ? Number((found as any).longitude)
        : undefined

  // Calculate real road distance dynamically if coordinates available
  let calculatedDistanceKm = 6.5
  if (overrideDistanceKm !== undefined && overrideDistanceKm > 0) {
    calculatedDistanceKm = overrideDistanceKm
  } else if (customerCoords?.lat && customerCoords?.lng && gLat && gLng) {
    calculatedDistanceKm = getCachedOrEstimatedRoadDistance(
      [customerCoords.lat, customerCoords.lng],
      [gLat, gLng],
    )
  } else if (found.distanceKm) {
    calculatedDistanceKm = found.distanceKm
  }

  const certs = [
    {
      label: found.trustRegistrationNo
        ? `AWBI Registered Shelter (#${found.trustRegistrationNo})`
        : "AWBI Registered Shelter",
      issuer: "Animal Welfare Board of India (PCA Act Section 38)",
    },
    {
      label: assignedVet
        ? `Empanelled Vet: ${assignedVet.name}`
        : "Empanelled Veterinary Care",
      issuer: assignedVet
        ? `${assignedVet.clinic || "Veterinary Polyclinic"} · Reg: ${assignedVet.regNo}`
        : "State Veterinary Council & VCI",
    },
  ]

  return {
    id: found.id,
    name: found.name,
    area: found.address || found.region || "Operational Vedic Sanctuary",
    distanceKm: calculatedDistanceKm,
    lat: gLat,
    lng: gLng,
    rating: found.rating ?? 4.9,
    animals: totalAnimals,
    photo,
    gallery,
    tagline: "Vedic Cattle Sanctuary · AWBI Registered",
    about:
      found.notes ||
      `${found.name} is a dedicated sacred sanctuary committed to traditional Go-seva, welfare ethics, and organic maintenance across ${found.region || "India"}. Every animal is nurtured under Vedic principles with round-the-clock veterinary oversight.`,
    address: found.address || found.region || "Sanctuary Premises",
    phone: found.contactPhone || "+91 98230 44910",
    email: found.email || "trust@gomaa.in",
    managerName: found.managerName || "Rahul Kamble",
    managerInitials: initials,
    yearEstablished: Number(found.establishedYear) || 2024,
    registrationNo: found.trustRegistrationNo || "AWBI/TRUST/IN",
    totalAnimals,
    cowCount,
    calfCount,
    bullCount,
    areaAcres: found.landAcres ?? 5.5,
    serviceHours: found.visitingHours || "6:00 AM – 7:30 PM (All 7 Days)",
    certifications: certs,
    animalCare: {
      feedSchedule: "6:00 AM & 4:30 PM organic forage & dry straw",
      feedType: "Hydroponic maize, green grass, jaggery & mineral cakes",
      vetVisits: "Twice weekly scheduled inspections + 24/7 on-call triage",
      vaccination: "FMD, Brucellosis, and Hemorrhagic Septicemia certified",
      restPeriod: "Mandatory 90-min cooldown after any sacred darshan or transit",
      grooming: "Daily dawn brush down, neem water bath, and hoof inspection",
    },
    facilities:
      found.facilities && found.facilities.length > 0
        ? found.facilities.map((f: string) => ({
            label: f,
            detail: "Maintained to the highest Gaushala welfare standards",
          }))
        : [
            {
              label: "Padded Cattle Van",
              detail: "Air-ventilated hydraulic lift carrier",
            },
            {
              label: "24/7 Clean Water",
              detail: "Fresh borewell trough",
            },
          ],
    maintenancePractices: [
      "Pure organic feed with ayurvedic herbal mix",
      "Padded bedding with rubber safety matting",
      "Regular hoof cleaning and vet checkups",
    ],
    totalReviews: 24,
    reviews: [
      {
        name: "Suresh Kulkarni",
        initials: "SK",
        rating: 5,
        comment:
          "Exceptional care of sacred cows. Highly recommend for Griha Pravesh sevas.",
        date: "Last week",
      },
    ],
  }
}

function StarRow({ rating, size = 13 }: { rating: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={size}
          className={
            i <= Math.round(rating)
              ? "text-saffron fill-saffron"
              : "text-line-strong"
          }
        />
      ))}
    </span>
  )
}

function CertBadge({ label, issuer }: { label: string; issuer: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-ok/30 bg-ok-soft/50 p-3 shadow-2xs">
      <CheckCircle2 size={16} className="text-ok shrink-0 mt-0.5" />
      <div>
        <div className="text-[12.5px] font-semibold text-ink">{label}</div>
        <div className="text-[11px] text-ink-faint mt-0.5">{issuer}</div>
      </div>
    </div>
  )
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-serif text-[17px] text-ink mb-3 mt-6 first:mt-0 flex items-center gap-2">
      {children}
    </h3>
  )
}

function AnimalCard({
  animal,
  onSelect,
}: {
  animal: Animal
  onSelect: (a: Animal) => void
}) {
  return (
    <button
      onClick={() => onSelect(animal)}
      className="w-full text-left rounded-xl border border-line bg-card overflow-hidden hover:border-forest/50 hover:shadow-md transition-all group shadow-xs cursor-pointer flex flex-col"
    >
      <div className="h-36 bg-paper-deep overflow-hidden relative">
        <img
          src={animal.photo || (animal.photos && animal.photos[0]) || "https://images.unsplash.com/photo-1546722228-7baeca4bd0b3?w=600&h=400&fit=crop&auto=format"}
          alt={animal.name}
          className="h-full w-full object-cover group-hover:scale-[1.04] transition-transform duration-500"
        />
        <div className="absolute top-2 left-2 flex items-center gap-1.5 flex-wrap">
          <span
            className={`text-[10px] font-medium rounded-full px-2 py-0.5 shadow-2xs backdrop-blur-xs ${
              animal.status === "Available"
                ? "bg-emerald-600/90 text-white"
                : animal.status === "Resting Buffer"
                  ? "bg-amber-600/90 text-white"
                  : "bg-saffron text-white"
            }`}
          >
            {animal.status}
          </span>
          {animal.breed && (
            <span className="text-[10px] font-medium rounded-full px-2 py-0.5 bg-ink/75 text-white backdrop-blur-xs font-mono">
              {animal.breed}
            </span>
          )}
        </div>
        {animal.tagId && (
          <span className="absolute bottom-2 right-2 text-[9px] font-mono rounded bg-white/90 text-ink px-1.5 py-0.5 shadow-xs font-semibold">
            {animal.tagId}
          </span>
        )}
      </div>
      <div className="p-3.5 flex flex-col flex-1 justify-between gap-2">
        <div>
          <div className="flex items-baseline justify-between gap-1">
            <span className="font-serif text-[16px] text-ink font-bold group-hover:text-forest transition-colors">{animal.name}</span>
            <span className="font-mono text-[13px] text-ink font-bold tabular shrink-0">
              {inr(animal.price || 3500)}
            </span>
          </div>
          <div className="text-[11.5px] text-ink-soft mt-0.5 line-clamp-1">
            {animal.type} · {animal.age || `${animal.ageYears || 5} yrs`} {animal.lactationStatus ? `· ${animal.lactationStatus}` : ""}
          </div>
        </div>
        <div className="pt-2 border-t border-line/60 flex items-center justify-between text-[11px]">
          <span className="text-ink-faint">
            {animal.weight || "420 kg"} · {animal.height || "135 cm"}
          </span>
          <span className="text-forest font-semibold group-hover:underline inline-flex items-center gap-0.5">
            Book Darshan →
          </span>
        </div>
      </div>
    </button>
  )
}

function ReviewCard({ review }: { review: GosalaDetail["reviews"][0] }) {
  return (
    <div className="rounded-lg border border-line bg-card p-4 shadow-2xs">
      <div className="flex items-center gap-3 mb-3">
        <div className="h-9 w-9 rounded-full bg-forest text-white grid place-items-center text-[12px] font-medium shrink-0">
          {review.initials}
        </div>
        <div className="min-w-0">
          <div className="text-[13px] text-ink font-semibold">{review.name}</div>
          <div className="flex items-center gap-2 mt-0.5">
            <StarRow rating={review.rating} size={11} />
            <span className="font-mono text-[10px] text-ink-faint">
              {review.date}
            </span>
          </div>
        </div>
      </div>
      <p className="text-[12.5px] text-ink-soft leading-relaxed">
        {review.comment}
      </p>
    </div>
  )
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
        active
          ? "border-saffron text-saffron-deep font-semibold"
          : "border-transparent text-ink-soft hover:text-ink"
      }`}
    >
      {children}
    </button>
  )
}

type ProfileTab = "about" | "animals" | "reviews"

/* ═══════════════════════════════════════════════════════
   EN ROUTE & LOCATION ROUTE EXPLORER MODAL
   ═══════════════════════════════════════════════════════ */
export function EnRouteModal({
  isOpen,
  onClose,
  gosalaName,
  gosalaAddress,
  gosalaLat,
  gosalaLng,
  customerLat,
  customerLng,
  customerAddress,
  mode = "route",
}: {
  isOpen: boolean
  onClose: () => void
  gosalaName: string
  gosalaAddress: string
  gosalaLat?: number
  gosalaLng?: number
  customerLat?: number
  customerLng?: number
  customerAddress?: string
  mode?: "route" | "pinpoint"
}) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const [roadRoute, setRoadRoute] = useState<RoadRoute | null>(null)
  const [isLoadingRoute, setIsLoadingRoute] = useState(false)

  // Default coordinate fallbacks if coordinates are not yet acquired or NaN
  const effectiveCustLat = typeof customerLat === "number" && !isNaN(customerLat) ? customerLat : 17.4401
  const effectiveCustLng = typeof customerLng === "number" && !isNaN(customerLng) ? customerLng : 78.3489
  const effectiveGosalaLat = typeof gosalaLat === "number" && !isNaN(gosalaLat) ? gosalaLat : 17.3753
  const effectiveGosalaLng = typeof gosalaLng === "number" && !isNaN(gosalaLng) ? gosalaLng : 78.3615

  // Fetch real road route
  useEffect(() => {
    if (!isOpen) return
    if (mode === "pinpoint") return

    let cancelled = false
    setIsLoadingRoute(true)

    fetchRoadRoute(
      [effectiveCustLat, effectiveCustLng],
      [effectiveGosalaLat, effectiveGosalaLng],
    ).then((route) => {
      if (!cancelled) {
        setRoadRoute(route)
        setIsLoadingRoute(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [
    isOpen,
    mode,
    effectiveCustLat,
    effectiveCustLng,
    effectiveGosalaLat,
    effectiveGosalaLng,
  ])

  // Leaflet Map Initialization
  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove()
      mapInstanceRef.current = null
    }

    const map = L.map(mapContainerRef.current, {
      center: [effectiveGosalaLat, effectiveGosalaLng],
      zoom: 13,
      zoomControl: false,
    })

    createResilientTileLayer(map)
    L.control.zoom({ position: "topright" }).addTo(map)

    // Vedic Sanctuary Marker
    const sanctuaryIcon = L.divIcon({
      className: "custom-sanctuary-pin",
      html: `
        <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; transform: translate(-20px, -38px);">
          <div style="position: absolute; width: 38px; height: 38px; background: #c2611b; border: 3px solid #ffffff; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); box-shadow: 0 4px 14px rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center;"></div>
          <div style="position: relative; z-index: 2; color: #ffffff; font-size: 17px; margin-top: -3px;">🛕</div>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 38],
    })

    const destMarker = L.marker([effectiveGosalaLat, effectiveGosalaLng], {
      icon: sanctuaryIcon,
      title: gosalaName,
    }).addTo(map)

    destMarker.bindPopup(`
      <div style="font-family: sans-serif; font-size: 12px; text-align: center; padding: 2px;">
        <strong style="color: #c2611b;">${gosalaName}</strong><br/>
        <span style="font-size: 11px; color: #555;">${gosalaAddress}</span>
      </div>
    `)

    if (mode === "route") {
      // Devotee Marker
      const devoteeIcon = L.divIcon({
        className: "custom-devotee-pin",
        html: `
          <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; transform: translate(-18px, -34px);">
            <div style="position: absolute; width: 34px; height: 34px; background: #1c5237; border: 3px solid #ffffff; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); box-shadow: 0 4px 12px rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center;"></div>
            <div style="position: relative; z-index: 2; color: #ffffff; font-size: 15px; margin-top: -3px;">📍</div>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 34],
      })

      const originMarker = L.marker([effectiveCustLat, effectiveCustLng], {
        icon: devoteeIcon,
        title: "Your Location",
      }).addTo(map)

      originMarker.bindPopup(`
        <div style="font-family: sans-serif; font-size: 12px; text-align: center; padding: 2px;">
          <strong style="color: #1c5237;">Your Current Location</strong><br/>
          <span style="font-size: 11px; color: #555;">${customerAddress || "Devotee Location"}</span>
        </div>
      `)

      // Road Route Polyline
      if (roadRoute && roadRoute.coordinates.length > 0) {
        const polyline = L.polyline(roadRoute.coordinates, {
          color: "#c2611b",
          weight: 5,
          opacity: 0.85,
          lineJoin: "round",
        }).addTo(map)

        try {
          map.fitBounds(polyline.getBounds(), { padding: [50, 50] })
        } catch {}
      } else {
        const bounds = L.latLngBounds(
          [effectiveCustLat, effectiveCustLng],
          [effectiveGosalaLat, effectiveGosalaLng],
        )
        map.fitBounds(bounds, { padding: [60, 60] })
      }
    } else {
      map.setView([effectiveGosalaLat, effectiveGosalaLng], 15)
    }

    mapInstanceRef.current = map

    // ResizeObserver guarantees invalidation whenever modal layout finishes animating
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize({ animate: false })
    })
    resizeObserver.observe(mapContainerRef.current)

    // Staggered invalidations to catch all modal backdrop and render frames
    const t1 = setTimeout(() => map.invalidateSize(), 60)
    const t2 = setTimeout(() => map.invalidateSize(), 220)
    const t3 = setTimeout(() => map.invalidateSize(), 600)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      resizeObserver.disconnect()
      map.remove()
      mapInstanceRef.current = null
    }
  }, [
    isOpen,
    mode,
    roadRoute,
    effectiveCustLat,
    effectiveCustLng,
    effectiveGosalaLat,
    effectiveGosalaLng,
    gosalaName,
    gosalaAddress,
    customerAddress,
  ])

  if (!isOpen) return null

  // Google Maps Deep Link
  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${effectiveCustLat},${effectiveCustLng}&destination=${effectiveGosalaLat},${effectiveGosalaLng}`

  return (
    <div className="fixed inset-0 z-[1000] bg-ink/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-card border border-line rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-line flex items-center justify-between gap-3 bg-paper">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-forest text-white grid place-items-center shadow-xs shrink-0">
              <Navigation size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif text-[17px] sm:text-[19px] font-bold text-ink">
                  {mode === "route" ? "Sacred Transit & Road Route" : "Gaushala Premise Pinpoint"}
                </h3>
                <span className="font-mono text-[11px] px-2 py-0.5 rounded-full bg-forest text-white font-medium">
                  {mode === "route" ? "Live Roadway" : "Satellite Verified"}
                </span>
              </div>
              <p className="text-[12px] text-ink-faint">
                {mode === "route"
                  ? `Direct road route from your location to ${gosalaName}`
                  : `Exact physical sanctuary location on the map`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line bg-card hover:bg-paper text-ink text-[12px] font-medium transition cursor-pointer shadow-xs"
            >
              <ExternalLink size={13} className="text-saffron" />
              <span className="hidden sm:inline">Open in Google Maps</span>
              <span className="sm:hidden">Maps</span>
            </a>
            <button
              type="button"
              onClick={onClose}
              className="h-8 w-8 rounded-lg border border-line bg-card hover:bg-paper-deep text-ink-soft grid place-items-center transition cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Telemetry Metric Strip (Only in Route Mode) */}
        {mode === "route" && (
          <div className="p-3 sm:p-4 bg-paper-deep/60 border-b border-line flex flex-wrap items-center justify-between gap-3 text-[12.5px]">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-1.5 font-medium text-ink">
                <span className="text-ink-faint font-mono text-[11px] uppercase tracking-wider">Distance:</span>
                <span className="font-serif font-bold text-[15px] text-forest">
                  {roadRoute?.distanceKm ? `${roadRoute.distanceKm} km` : "Calculating..."}
                </span>
              </div>
              <div className="flex items-center gap-1.5 font-medium text-ink">
                <span className="text-ink-faint font-mono text-[11px] uppercase tracking-wider">Est. Transit:</span>
                <span className="font-serif font-bold text-[15px] text-saffron-deep">
                  {roadRoute?.durationMin ? `~${roadRoute.durationMin} mins` : "Calculating..."}
                </span>
              </div>
              <div className="hidden sm:flex items-center gap-1.5 text-ink-soft">
                <span className="text-ink-faint font-mono text-[11px] uppercase tracking-wider">Corridor:</span>
                <span className="font-medium text-ink">{roadRoute?.summary || "Direct Arterial"}</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-ok/10 border border-ok/20 text-ok font-mono text-[11px] font-medium">
              <CheckCircle2 size={12} />
              <span>Within 35 km Doorstep Radius</span>
            </div>
          </div>
        )}

        {/* Map Canvas */}
        <div className="relative w-full h-[400px] sm:h-[480px] md:h-[520px] bg-paper-deep overflow-hidden">
          <div ref={mapContainerRef} className="absolute inset-0 z-0" />
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 border-t border-line bg-paper flex items-center justify-between gap-3 text-[12px]">
          <div className="flex items-center gap-2 text-ink-soft min-w-0">
            <MapPin size={14} className="text-saffron shrink-0" />
            <span className="truncate">{gosalaAddress}</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-forest text-white hover:bg-forest-deep font-semibold transition cursor-pointer shadow-xs shrink-0"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   MOBILE PROFILE
   ═══════════════════════════════════════════════════════ */
export function MobileGosalaProfile({
  gosalaId,
  distanceKm,
  onBack,
  onSelectAnimal,
}: {
  gosalaId: string
  distanceKm?: number
  onBack: () => void
  onSelectAnimal: (a: Animal) => void
}) {
  const { gosalas: storeGosalas, animals: storeAnimals, vets: storeVets, refreshAnimals } = useStore()
  const [fetchedAnimals, setFetchedAnimals] = useState<Animal[]>([])
  const deviceLocation = useDeviceLocation()
  const customerCoords =
    deviceLocation?.lat && deviceLocation?.lng
      ? { lat: deviceLocation.lat, lng: deviceLocation.lng }
      : null

  useEffect(() => {
    let active = true
    api.getAnimals().then((res) => {
      if (active && res?.animals && Array.isArray(res.animals) && res.animals.length > 0) {
        setFetchedAnimals(res.animals)
      }
    }).catch(() => {})
    refreshAnimals?.().catch(() => {})
    return () => {
      active = false
    }
  }, [gosalaId, refreshAnimals])

  const allAnimals = useMemo(() => {
    const map = new Map<string, Animal>()
    ;(storeAnimals || []).forEach((a) => map.set(a.name.toLowerCase(), a))
    fetchedAnimals.forEach((a) => map.set(a.name.toLowerCase(), a))
    return Array.from(map.values())
  }, [storeAnimals, fetchedAnimals])

  const g = useMemo(
    () =>
      resolveGosalaDetail(
        gosalaId,
        storeGosalas,
        allAnimals,
        storeVets,
        customerCoords,
        distanceKm,
      ),
    [gosalaId, storeGosalas, allAnimals, storeVets, customerCoords, distanceKm],
  )

  const [photoIdx, setPhotoIdx] = useState(0)
  const [tab, setTab] = useState<ProfileTab>("about")
  const [showRouteModal, setShowRouteModal] = useState(false)
  const [routeModalMode, setRouteModalMode] = useState<"route" | "pinpoint">("route")

  const gosalaAnimals = useMemo(() => {
    if (!g) return []
    return allAnimals.filter((a) => {
      if (!a.gosala || !g.name) return false
      const anmG = a.gosala.trim().toLowerCase()
      const tgtG = g.name.trim().toLowerCase()
      return (
        anmG === tgtG ||
        anmG.includes(tgtG) ||
        tgtG.includes(anmG) ||
        (a as any).gosalaId === (g as any).id
      )
    })
  }, [allAnimals, g])

  if (!g) {
    return (
      <div className="p-8 text-center">
        <p className="text-ink-faint">Gosala not found.</p>
        <button
          onClick={onBack}
          className="mt-3 text-saffron text-[13px] font-medium"
        >
          Go back
        </button>
      </div>
    )
  }

  return (
    <div className="pb-24">
      {/* Route & Pinpoint Modal */}
      <EnRouteModal
        isOpen={showRouteModal}
        onClose={() => setShowRouteModal(false)}
        gosalaName={g.name}
        gosalaAddress={g.address}
        gosalaLat={g.lat}
        gosalaLng={g.lng}
        customerLat={customerCoords?.lat}
        customerLng={customerCoords?.lng}
        customerAddress={deviceLocation?.address || undefined}
        mode={routeModalMode}
      />

      {/* Top bar */}
      <div className="flex items-center justify-between p-4 border-b border-line">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-[13px] text-ink-soft hover:text-ink cursor-pointer"
        >
          <ChevronLeft size={16} /> Back
        </button>
        <div className="font-mono text-[11px] text-ink-faint">
          {g.distanceKm} km away
        </div>
      </div>

      {/* Hero photo */}
      <div className="relative aspect-[16/10] bg-paper-deep overflow-hidden">
        <img
          src={g.gallery[photoIdx]}
          alt={g.name}
          className="h-full w-full object-cover"
        />
        {g.gallery.length > 1 && (
          <div className="absolute bottom-2 right-2 rounded-full bg-ink/70 px-2 py-0.5 text-[10px] text-white font-mono">
            {photoIdx + 1} / {g.gallery.length}
          </div>
        )}
      </div>

      {/* Quick stats strip */}
      <div className="p-4 border-b border-line">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
          {g.tagline}
        </div>
        <h1 className="font-serif text-[24px] text-ink leading-tight mt-1">
          {g.name}
        </h1>
        <div className="flex items-center gap-3 mt-1.5">
          <span className="inline-flex items-center gap-1 text-[13px]">
            <StarRow rating={g.rating} size={13} />
            <span className="font-medium text-ink ml-1">{g.rating}</span>
            <span className="text-ink-faint text-[11px] font-mono">
              ({g.totalReviews})
            </span>
          </span>
          <span className="text-ink-faint text-[12px]">·</span>
          <span className="text-[12px] text-ink-soft font-mono">
            {g.area}
          </span>
        </div>

        {/* 4 Key stats */}
        <div className="grid grid-cols-4 rounded-lg border border-line mt-3 overflow-hidden text-center bg-card">
          <div className="py-2.5 border-r border-line">
            <div className="font-mono text-[13px] text-ink font-semibold">{g.totalAnimals}</div>
            <div className="font-mono text-[8.5px] uppercase tracking-wider text-ink-faint">
              Animals
            </div>
          </div>
          <div className="py-2.5 border-r border-line">
            <div className="font-mono text-[13px] text-ink font-semibold">{g.areaAcres} ac</div>
            <div className="font-mono text-[8.5px] uppercase tracking-wider text-ink-faint">
              Land
            </div>
          </div>
          <div className="py-2.5 border-r border-line">
            <div className="font-mono text-[13px] text-ink font-semibold">
              {g.yearEstablished}
            </div>
            <div className="font-mono text-[8.5px] uppercase tracking-wider text-ink-faint">
              Est.
            </div>
          </div>
          <div className="py-2.5">
            <div className="font-mono text-[12px] text-ink font-semibold">
              {g.cowCount}C/{g.calfCount}Ca/{g.bullCount}B
            </div>
            <div className="font-mono text-[8.5px] uppercase tracking-wider text-ink-faint">
              Mix
            </div>
          </div>
        </div>

        {/* En Route & Location Exploration Bar */}
        <div className="mt-3.5 rounded-xl border border-line bg-paper/70 p-3 space-y-2.5 shadow-2xs">
          <div className="flex items-center justify-between text-[11.5px]">
            <div className="flex items-center gap-1.5 font-medium text-ink">
              <Navigation size={13} className="text-forest" />
              <span>{g.distanceKm} km from your location</span>
            </div>
            <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-forest-soft text-forest font-semibold">
              Within 35 km Radius
            </span>
          </div>

          <div className="flex items-start gap-1.5 text-[11.5px] text-ink-soft">
            <MapPin size={13} className="text-saffron shrink-0 mt-0.5" />
            <span className="line-clamp-1">{g.address}</span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setRouteModalMode("route")
                setShowRouteModal(true)
              }}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-forest text-white hover:bg-forest-deep text-[12px] font-medium transition cursor-pointer shadow-xs"
            >
              <Navigation size={13} />
              <span>Check En Route</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setRouteModalMode("pinpoint")
                setShowRouteModal(true)
              }}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-line bg-card hover:bg-paper text-ink text-[12px] font-medium transition cursor-pointer shadow-xs"
            >
              <Compass size={13} className="text-saffron" />
              <span>Location Pin</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-line px-4 overflow-x-auto">
        <TabBtn active={tab === "about"} onClick={() => setTab("about")}>
          About & Practices
        </TabBtn>
        <TabBtn active={tab === "animals"} onClick={() => setTab("animals")}>
          Animals ({gosalaAnimals.length})
        </TabBtn>
        <TabBtn active={tab === "reviews"} onClick={() => setTab("reviews")}>
          Reviews ({g.totalReviews})
        </TabBtn>
      </div>

      {/* Tab content */}
      <div className="p-4">
        {tab === "about" && (
          <>
            <Heading>
              <Heart size={15} className="text-saffron" />
              About the Sanctuary
            </Heading>
            <p className="text-[13px] text-ink-soft leading-relaxed">
              {g.about}
            </p>

            <Heading>
              <Award size={15} className="text-ok" />
              Certifications & Legal Trust
            </Heading>
            <div className="space-y-2">
              {g.certifications.map((c) => (
                <CertBadge key={c.label} {...c} />
              ))}
            </div>

            <Heading>
              <Leaf size={15} className="text-forest" />
              Animal Welfare & Daily Care
            </Heading>
            <div className="space-y-2 text-[12.5px]">
              <div className="rounded-lg border border-line bg-card p-3 space-y-2">
                <div className="flex gap-2">
                  <UtensilsCrossed size={14} className="text-saffron shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-ink">Feed Schedule:</strong>{" "}
                    <span className="text-ink-soft">{g.animalCare.feedSchedule}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Sprout size={14} className="text-forest shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-ink">Feed Mix:</strong>{" "}
                    <span className="text-ink-soft">{g.animalCare.feedType}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Stethoscope size={14} className="text-info shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-ink">Veterinary Visits:</strong>{" "}
                    <span className="text-ink-soft">{g.animalCare.vetVisits}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Syringe size={14} className="text-ok shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-ink">Vaccinations:</strong>{" "}
                    <span className="text-ink-soft">{g.animalCare.vaccination}</span>
                  </div>
                </div>
              </div>
            </div>

            <Heading>
              <TreeDeciduous size={15} className="text-forest" />
              Certified Facilities
            </Heading>
            <div className="space-y-2">
              {g.facilities.map((f) => (
                <div
                  key={f.label}
                  className="rounded-lg border border-line bg-card p-3 shadow-2xs"
                >
                  <div className="text-[12.5px] font-semibold text-ink">
                    {f.label}
                  </div>
                  <div className="text-[11.5px] text-ink-faint mt-0.5 leading-snug">
                    {f.detail}
                  </div>
                </div>
              ))}
            </div>

            <Heading>
              <Users size={15} className="text-ink-faint" />
              Sanctuary Management
            </Heading>
            <div className="flex items-center gap-3 rounded-lg border border-line bg-card p-4 shadow-2xs">
              <div className="h-12 w-12 rounded-full bg-forest text-white grid place-items-center font-serif text-[16px] shrink-0 font-bold">
                {g.managerInitials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] text-ink font-semibold">{g.managerName}</div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-ink-faint mt-0.5">
                  Gaushala Custodian & Manager
                </div>
                <div className="font-mono text-[10.5px] text-forest mt-0.5 font-medium">
                  {g.registrationNo}
                </div>
              </div>
            </div>
          </>
        )}

        {tab === "animals" && (
          <>
            <p className="text-[12px] text-ink-faint mb-3">
              {gosalaAnimals.length} sacred animals available for direct booking
            </p>
            <div className="grid grid-cols-2 gap-3">
              {gosalaAnimals.map((a) => (
                <AnimalCard key={a.name} animal={a} onSelect={onSelectAnimal} />
              ))}
            </div>
            {gosalaAnimals.length === 0 && (
              <div className="text-center py-8 text-ink-faint text-[13px]">
                No animals currently listed from this Gosala.
              </div>
            )}
          </>
        )}

        {tab === "reviews" && (
          <>
            <div className="flex items-center gap-4 mb-5 rounded-lg border border-line bg-card p-4 shadow-2xs">
              <div>
                <div className="font-serif text-[40px] text-ink leading-none tabular font-bold">
                  {g.rating}
                </div>
                <StarRow rating={g.rating} size={15} />
                <div className="font-mono text-[10.5px] text-ink-faint mt-1">
                  {g.totalReviews} verified bookings
                </div>
              </div>
            </div>
            <div className="space-y-3">
              {g.reviews.map((r) => (
                <ReviewCard key={r.name} review={r} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Sticky bottom CTA */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[440px] border-t border-line bg-card/95 backdrop-blur-md p-3.5 flex items-center gap-3 z-30 shadow-lg">
        <div>
          <div className="font-mono text-[9.5px] uppercase tracking-wider text-ink-faint">
            Available Herd
          </div>
          <div className="text-[13.5px] text-ink font-semibold">
            {gosalaAnimals.filter((a) => a.status === "Available").length} cattle ready
          </div>
        </div>
        <button
          onClick={() => setTab("animals")}
          className="ml-auto bg-saffron text-white rounded-lg px-6 py-2.5 text-[13.5px] font-semibold hover:bg-saffron-deep transition-colors shadow-xs cursor-pointer"
        >
          View available animals →
        </button>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   DESKTOP PROFILE
   ═══════════════════════════════════════════════════════ */
export function DesktopGosalaProfile({
  gosalaId,
  distanceKm,
  onBack,
  onSelectAnimal,
}: {
  gosalaId: string
  distanceKm?: number
  onBack: () => void
  onSelectAnimal: (a: Animal) => void
}) {
  const { gosalas: storeGosalas, animals: storeAnimals, vets: storeVets, refreshAnimals } = useStore()
  const [fetchedAnimals, setFetchedAnimals] = useState<Animal[]>([])
  const deviceLocation = useDeviceLocation()
  const customerCoords =
    deviceLocation?.lat && deviceLocation?.lng
      ? { lat: deviceLocation.lat, lng: deviceLocation.lng }
      : null

  useEffect(() => {
    let active = true
    api.getAnimals().then((res) => {
      if (active && res?.animals && Array.isArray(res.animals) && res.animals.length > 0) {
        setFetchedAnimals(res.animals)
      }
    }).catch(() => {})
    refreshAnimals?.().catch(() => {})
    return () => {
      active = false
    }
  }, [gosalaId, refreshAnimals])

  const allAnimals = useMemo(() => {
    const map = new Map<string, Animal>()
    ;(storeAnimals || []).forEach((a) => map.set(a.name.toLowerCase(), a))
    fetchedAnimals.forEach((a) => map.set(a.name.toLowerCase(), a))
    return Array.from(map.values())
  }, [storeAnimals, fetchedAnimals])

  const g = useMemo(
    () =>
      resolveGosalaDetail(
        gosalaId,
        storeGosalas,
        allAnimals,
        storeVets,
        customerCoords,
        distanceKm,
      ),
    [gosalaId, storeGosalas, allAnimals, storeVets, customerCoords, distanceKm],
  )

  const [photoIdx, setPhotoIdx] = useState(0)
  const [tab, setTab] = useState<ProfileTab>("about")
  const [showRouteModal, setShowRouteModal] = useState(false)
  const [routeModalMode, setRouteModalMode] = useState<"route" | "pinpoint">("route")

  const gosalaAnimals = useMemo(() => {
    if (!g) return []
    return allAnimals.filter((a) => {
      if (!a.gosala || !g.name) return false
      const anmG = a.gosala.trim().toLowerCase()
      const tgtG = g.name.trim().toLowerCase()
      return (
        anmG === tgtG ||
        anmG.includes(tgtG) ||
        tgtG.includes(anmG) ||
        (a as any).gosalaId === (g as any).id
      )
    })
  }, [allAnimals, g])

  if (!g) {
    return (
      <div className="p-12 text-center max-w-md mx-auto my-16 rounded-xl border border-dashed border-line bg-paper-deep/30">
        <h3 className="font-serif text-xl text-ink font-semibold mb-2">
          Gaushala Not Found
        </h3>
        <p className="text-sm text-ink-soft mb-6">
          The requested Gaushala could not be located or has not been registered yet.
        </p>
        <button
          onClick={onBack}
          className="px-5 py-2.5 bg-saffron hover:bg-saffron-deep text-white rounded font-medium text-sm transition-colors cursor-pointer"
        >
          Return to Directory
        </button>
      </div>
    )
  }

  return (
    <div>
      {/* Route & Pinpoint Modal */}
      <EnRouteModal
        isOpen={showRouteModal}
        onClose={() => setShowRouteModal(false)}
        gosalaName={g.name}
        gosalaAddress={g.address}
        gosalaLat={g.lat}
        gosalaLng={g.lng}
        customerLat={customerCoords?.lat}
        customerLng={customerCoords?.lng}
        customerAddress={deviceLocation?.address || undefined}
        mode={routeModalMode}
      />

      {/* Breadcrumb */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-[13px] text-ink-soft hover:text-ink mb-5 cursor-pointer font-medium"
      >
        <ChevronLeft size={16} /> Back to discover
      </button>

      {/* Upper: two-column */}
      <div className="grid lg:grid-cols-[1.3fr_1fr] gap-8 mb-8">
        {/* Gallery column */}
        <div>
          <div className="relative rounded-xl overflow-hidden bg-paper-deep aspect-[16/9] shadow-sm">
            <img
              src={g.gallery[photoIdx]}
              alt={g.name}
              className="h-full w-full object-cover"
            />
            {/* Prev / Next arrows */}
            {photoIdx > 0 && (
              <button
                onClick={() => setPhotoIdx((p) => p - 1)}
                className="absolute left-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-white/85 backdrop-blur grid place-items-center text-ink hover:bg-white transition-colors cursor-pointer shadow-md"
              >
                <ChevronLeft size={18} />
              </button>
            )}
            {photoIdx < g.gallery.length - 1 && (
              <button
                onClick={() => setPhotoIdx((p) => p + 1)}
                className="absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-white/85 backdrop-blur grid place-items-center text-ink hover:bg-white transition-colors cursor-pointer shadow-md"
              >
                <ChevronRight size={18} />
              </button>
            )}
          </div>

          {/* Thumbnails */}
          <div className="flex gap-2 mt-3">
            {g.gallery.map((src, i) => (
              <button
                key={i}
                onClick={() => setPhotoIdx(i)}
                className={`h-16 flex-1 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                  i === photoIdx
                    ? "border-saffron shadow-xs scale-[1.02]"
                    : "border-transparent opacity-60 hover:opacity-90"
                }`}
              >
                <img src={src} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </div>

        {/* Info column */}
        <div className="space-y-4">
          {/* Title & Ratings */}
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
              {g.tagline}
            </div>
            <h1 className="font-serif text-[32px] text-ink leading-tight mt-1 font-bold">
              {g.name}
            </h1>
            <div className="flex items-center gap-4 mt-2">
              <span className="inline-flex items-center gap-1.5 text-[13.5px]">
                <StarRow rating={g.rating} size={14} />
                <span className="font-bold text-ink ml-0.5">{g.rating}</span>
                <span className="text-ink-faint text-[12px] font-mono">
                  ({g.totalReviews} reviews)
                </span>
              </span>
              <span className="inline-flex items-center gap-1 text-[12.5px] text-forest font-mono font-medium">
                <Navigation size={12} /> {g.distanceKm} km
              </span>
            </div>
          </div>

          {/* Dynamic quick stats grid */}
          <div className="grid grid-cols-4 rounded-xl border border-line overflow-hidden bg-card shadow-2xs">
            {[
              { val: g.totalAnimals.toString(), label: "Animals" },
              { val: `${g.areaAcres} ac`, label: "Land" },
              { val: g.yearEstablished.toString(), label: "Est." },
              {
                val: `${g.cowCount}C/${g.calfCount}Ca/${g.bullCount}B`,
                label: "Mix",
              },
            ].map(({ val, label }, i) => (
              <div
                key={label}
                className={`py-3 text-center ${
                  i < 3 ? "border-r border-line" : ""
                }`}
              >
                <div className="font-mono text-[14px] text-ink font-bold tabular">
                  {val}
                </div>
                <div className="font-mono text-[9px] uppercase tracking-wider text-ink-faint mt-0.5">
                  {label}
                </div>
              </div>
            ))}
          </div>

          {/* Service & Visiting Hours */}
          <div className="flex items-center gap-2 text-[12.5px] text-ink-soft rounded-lg border border-line bg-card px-3.5 py-2.5 shadow-2xs">
            <Clock size={14} className="text-forest shrink-0" />
            <span className="font-medium">{g.serviceHours}</span>
          </div>

          {/* Certifications summary */}
          <div className="space-y-2">
            {g.certifications.slice(0, 2).map((c) => (
              <CertBadge key={c.label} {...c} />
            ))}
          </div>

          {/* Manager & Caretaker Card */}
          <div className="flex items-center gap-3 rounded-lg border border-line bg-card p-3.5 shadow-2xs">
            <div className="h-11 w-11 rounded-full bg-forest text-white grid place-items-center font-serif text-[15px] font-bold shrink-0">
              {g.managerInitials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[14px] text-ink font-semibold">{g.managerName}</div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                Gosala Manager · AWBI Custodian
              </div>
            </div>
            <a
              href={`tel:${g.phone}`}
              className="h-9 px-3 grid place-items-center rounded-lg bg-forest text-white text-[12px] flex items-center gap-1.5 hover:bg-forest-deep transition cursor-pointer shadow-xs"
              title="Call Gaushala Manager"
            >
              <Phone size={14} />
            </a>
          </div>

          {/* Primary View Available Animals CTA */}
          <button
            onClick={() => setTab("animals")}
            className="w-full bg-saffron text-white rounded-lg py-3.5 text-[15px] font-bold hover:bg-saffron-deep transition-all shadow-sm cursor-pointer"
          >
            View available animals →
          </button>

          {/* Sacred Geodesics, En Route & Directions Card */}
          <div className="rounded-xl border border-line bg-paper/70 p-3.5 space-y-3 shadow-xs">
            <div className="flex items-center justify-between text-[12px]">
              <div className="flex items-center gap-1.5 font-medium text-ink">
                <Navigation size={13} className="text-forest" />
                <span>
                  {g.distanceKm > 0 ? `${g.distanceKm} km from your location` : "Doorstep Route Active"}
                </span>
                <span className="text-ink-faint font-mono text-[11px]">
                  (approx. {Math.max(10, Math.round(g.distanceKm * 2.2))} mins drive)
                </span>
              </div>
              <span className="font-mono text-[10.5px] px-2 py-0.5 rounded-full bg-forest-soft text-forest font-semibold">
                Within 35 km Radius
              </span>
            </div>

            <div className="flex items-start gap-2 text-[12px] text-ink-soft">
              <MapPin size={14} className="text-saffron shrink-0 mt-0.5" />
              <span>{g.address}</span>
            </div>

            {/* En Route & Location Action Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setRouteModalMode("route")
                  setShowRouteModal(true)
                }}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-forest text-white hover:bg-forest-deep text-[12.5px] font-medium transition cursor-pointer shadow-xs"
              >
                <Navigation size={13} />
                <span>Check En Route</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setRouteModalMode("pinpoint")
                  setShowRouteModal(true)
                }}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-line bg-card hover:bg-paper text-ink text-[12.5px] font-medium transition cursor-pointer shadow-xs"
              >
                <Compass size={13} className="text-saffron" />
                <span>Sanctuary Location</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-line flex mb-6">
        <TabBtn active={tab === "about"} onClick={() => setTab("about")}>
          About & Practices
        </TabBtn>
        <TabBtn active={tab === "animals"} onClick={() => setTab("animals")}>
          Animals ({gosalaAnimals.length})
        </TabBtn>
        <TabBtn active={tab === "reviews"} onClick={() => setTab("reviews")}>
          Reviews ({g.totalReviews})
        </TabBtn>
      </div>

      {/* About tab */}
      {tab === "about" && (
        <div className="grid lg:grid-cols-[1.3fr_1fr] gap-8">
          <div>
            <p className="text-[14px] text-ink-soft leading-relaxed mb-6">
              {g.about}
            </p>

            {/* Animal Care Grid */}
            <div className="flex items-center gap-2 mb-3">
              <Leaf size={16} className="text-forest" />
              <h3 className="font-serif text-[17px] text-ink font-semibold">Animal Care & Welfare</h3>
            </div>
            <div className="grid sm:grid-cols-2 gap-3 mb-6">
              <div className="rounded-lg border border-line bg-card p-3.5 space-y-1 shadow-2xs">
                <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase text-ink-faint">
                  <UtensilsCrossed size={12} className="text-saffron" />
                  Feed Schedule
                </div>
                <div className="text-[13px] text-ink font-medium">
                  {g.animalCare.feedSchedule}
                </div>
              </div>
              <div className="rounded-lg border border-line bg-card p-3.5 space-y-1 shadow-2xs">
                <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase text-ink-faint">
                  <Sprout size={12} className="text-forest" />
                  Feed Mix
                </div>
                <div className="text-[13px] text-ink font-medium">
                  {g.animalCare.feedType}
                </div>
              </div>
              <div className="rounded-lg border border-line bg-card p-3.5 space-y-1 shadow-2xs">
                <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase text-ink-faint">
                  <Stethoscope size={12} className="text-info" />
                  Veterinary Care
                </div>
                <div className="text-[13px] text-ink font-medium">
                  {g.animalCare.vetVisits}
                </div>
              </div>
              <div className="rounded-lg border border-line bg-card p-3.5 space-y-1 shadow-2xs">
                <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase text-ink-faint">
                  <Syringe size={12} className="text-ok" />
                  Vaccination
                </div>
                <div className="text-[13px] text-ink font-medium">
                  {g.animalCare.vaccination}
                </div>
              </div>
            </div>

            {/* Facilities */}
            <div className="flex items-center gap-2 mb-3">
              <TreeDeciduous size={16} className="text-forest" />
              <h3 className="font-serif text-[17px] text-ink font-semibold">Facilities & Infrastructure</h3>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {g.facilities.map((f) => (
                <div
                  key={f.label}
                  className="rounded-lg border border-line bg-card p-3.5 shadow-2xs"
                >
                  <div className="text-[13px] font-semibold text-ink">
                    {f.label}
                  </div>
                  <div className="text-[11.5px] text-ink-faint mt-0.5 leading-snug">
                    {f.detail}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Certifications + Maintenance */}
          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Award size={16} className="text-ok" />
                <h3 className="font-serif text-[17px] text-ink font-semibold">
                  Accreditations & Legal Compliance
                </h3>
              </div>
              <div className="space-y-2">
                {g.certifications.map((c) => (
                  <CertBadge key={c.label} {...c} />
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-3">
                <Droplets size={16} className="text-info" />
                <h3 className="font-serif text-[17px] text-ink font-semibold">
                  Maintenance Protocols
                </h3>
              </div>
              <ul className="space-y-2">
                {g.maintenancePractices.map((p) => (
                  <li
                    key={p}
                    className="flex gap-2 text-[12.5px] text-ink-soft"
                  >
                    <span className="text-saffron shrink-0 font-bold">›</span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-3">
                <Mail size={16} className="text-ink-faint" />
                <h3 className="font-serif text-[17px] text-ink font-semibold">Direct Communication</h3>
              </div>
              <div className="space-y-2 text-[12.5px] rounded-lg border border-line bg-card p-4 shadow-2xs">
                <div className="flex items-center gap-2 text-ink-soft">
                  <Phone size={13} className="text-forest shrink-0" />
                  <a
                    href={`tel:${g.phone}`}
                    className="text-forest font-medium hover:underline font-mono"
                  >
                    {g.phone}
                  </a>
                </div>
                <div className="flex items-center gap-2 text-ink-soft">
                  <Mail size={13} className="text-ink-faint shrink-0" />
                  <span>{g.email}</span>
                </div>
                <div className="flex items-start gap-2 text-ink-soft">
                  <MapPin
                    size={13}
                    className="text-saffron shrink-0 mt-0.5"
                  />
                  <span>{g.address}</span>
                </div>
                <div className="flex items-center gap-2 text-ink-soft">
                  <Calendar size={13} className="text-ink-faint shrink-0" />
                  <span>{g.serviceHours}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Animals tab */}
      {tab === "animals" && (
        <div>
          <p className="text-[13px] text-ink-faint mb-5">
            {gosalaAnimals.length} sacred animals currently resident and available from {g.name}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {gosalaAnimals.map((a) => (
              <AnimalCard key={a.name} animal={a} onSelect={onSelectAnimal} />
            ))}
          </div>
          {gosalaAnimals.length === 0 && (
            <div className="rounded-xl border border-line bg-card p-12 text-center text-ink-faint text-[14px]">
              No resident animals currently listed from this Gaushala.
            </div>
          )}
        </div>
      )}

      {/* Reviews tab */}
      {tab === "reviews" && (
        <div>
          <div className="flex items-end gap-6 mb-6">
            <div>
              <div className="font-serif text-[56px] text-ink leading-none font-bold">
                {g.rating}
              </div>
              <StarRow rating={g.rating} size={18} />
              <div className="font-mono text-[11px] text-ink-faint mt-1.5">
                {g.totalReviews} verified devotee bookings
              </div>
            </div>
            <div className="text-[13px] text-ink-soft max-w-md">
              All reviews are from verified devotees who performed Darshan or Go-seva from this sanctuary.
            </div>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {g.reviews.map((r) => (
              <ReviewCard key={r.name} review={r} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
