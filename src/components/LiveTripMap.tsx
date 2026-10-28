import { useMemo } from "react"
import {
  Navigation,
  MapPin,
  ExternalLink,
  Clock,
  ShieldCheck,
  Truck,
  CheckCircle2,
  AlertCircle,
  Compass,
} from "lucide-react"
import { useRealtime } from "../hooks/useRealtime"

export type LatLng = [number, number]

export interface LiveTripMapProps {
  bookingId: string
  pickupLocation: string
  dropLocation: string
  driverName?: string
  stageIndex: number
  distanceKm?: number
  heightClass?: string
  interactive?: boolean
  customerCoords?: LatLng | null
  driverCoords?: LatLng | null
  viewerRole?: "CUSTOMER" | "DRIVER" | "ADMIN" | "MANAGER"
}

export default function LiveTripMap({
  bookingId,
  pickupLocation,
  dropLocation,
  driverName = "Assigned Driver",
  stageIndex = 0,
  distanceKm = 8,
  heightClass = "h-auto",
  viewerRole = "CUSTOMER",
}: LiveTripMapProps) {
  // Real-time stage listener via WebSocket (zero GPS polling traffic)
  const { isConnected } = useRealtime({ bookingId })

  const isDriver = viewerRole === "DRIVER"
  const isEnRoute = stageIndex >= 3 && stageIndex < 5
  const isAtCustomer = stageIndex === 5
  const isInService = stageIndex >= 6 && stageIndex < 7
  const isCompleted = stageIndex >= 7

  // Estimated driving time calculated using compassionate bovine transit speed (< 40 km/h)
  const estimatedMins = useMemo(() => {
    const km = Math.max(1, distanceKm || 8)
    return Math.round(km * 2.2 + 8)
  }, [distanceKm])

  // Context-aware Google Maps deep-link
  const googleMapsUrl = useMemo(() => {
    const cleanPickup = pickupLocation || "Gaushala Sanctuary"
    const cleanDrop = dropLocation || "Devotee Venue"

    if (isDriver) {
      // Driver heads to sanctuary first (stages 0-2), then to devotee (stages 3+)
      const targetDestination = stageIndex < 3 ? cleanPickup : cleanDrop
      return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(targetDestination)}`
    }

    // Customer & Managers view full transit corridor
    return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(cleanPickup)}&destination=${encodeURIComponent(cleanDrop)}`
  }, [pickupLocation, dropLocation, isDriver, stageIndex])

  // Milestone progression definition
  const milestones = [
    {
      label: "Dispatched",
      desc: "Ambulance Assigned",
      active: stageIndex >= 0,
      current: stageIndex < 3,
    },
    {
      label: "Bovine Picked Up",
      desc: pickupLocation || "Sanctuary",
      active: stageIndex >= 3,
      current: stageIndex === 3,
    },
    {
      label: "En Route",
      desc: `In Transit · ~${estimatedMins} min ETA`,
      active: stageIndex >= 4,
      current: stageIndex === 4,
    },
    {
      label: "Arrived",
      desc: "At Devotee Altar",
      active: stageIndex >= 5,
      current: stageIndex === 5,
    },
    {
      label: "Puja In Progress",
      desc: "Sacred Seva",
      active: stageIndex >= 6,
      current: stageIndex === 6,
    },
  ]

  return (
    <div
      className={`rounded-xl border border-line bg-card shadow-xs overflow-hidden flex flex-col ${heightClass}`}
    >
      {/* Header Bar */}
      <div className="px-4 py-3 border-b border-line bg-paper/60 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-7 w-7 rounded-lg bg-saffron/15 text-saffron-deep flex items-center justify-center shrink-0">
            <Truck size={15} />
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-medium text-ink truncate">
              {isCompleted
                ? "Ceremony Completed & Bovine Returned"
                : isInService
                  ? "Ceremony in Progress at Altar"
                  : isAtCustomer
                    ? "Vehicle Arrived at Devotee Doorstep"
                    : isEnRoute
                      ? "Cattle Ambulance En Route"
                      : "Dispatch & Route Scheduled"}
            </div>
            <div className="text-[11px] text-ink-faint flex items-center gap-1.5">
              <span>{driverName}</span>
              <span>•</span>
              <span>{distanceKm} km transit</span>
              {isConnected && (
                <>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1 text-[10px] text-forest font-mono">
                    <span className="h-1.5 w-1.5 rounded-full bg-forest animate-pulse" />
                    Live Sync
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <span
          className={`text-[11px] font-mono px-2 py-0.5 rounded-full font-medium shrink-0 ${
            isCompleted
              ? "bg-forest-soft text-forest border border-forest/30"
              : isAtCustomer || isInService
                ? "bg-ok text-white"
                : isEnRoute
                  ? "bg-saffron text-white"
                  : "bg-paper text-ink-soft border border-line"
          }`}
        >
          {isCompleted
            ? "Completed"
            : isInService
              ? "In Service"
              : isAtCustomer
                ? "At Doorstep"
                : isEnRoute
                  ? "En Route"
                  : "Stage " + (stageIndex + 1)}
        </span>
      </div>

      {/* Main Logistics & Google Maps Action Area */}
      <div className="p-4 space-y-4 flex-1">
        {/* Transit Route Corridor */}
        <div className="rounded-lg border border-line/80 bg-paper/40 p-3 space-y-2.5">
          <div className="flex items-start gap-2.5">
            <div className="flex flex-col items-center mt-0.5">
              <span className="h-2.5 w-2.5 rounded-full bg-saffron ring-4 ring-saffron/20 shrink-0" />
              <span className="w-0.5 h-6 bg-line-strong my-0.5" />
              <MapPin size={13} className="text-forest shrink-0" />
            </div>

            <div className="min-w-0 flex-1 space-y-2 text-[12.5px]">
              <div>
                <div className="text-[10px] uppercase font-mono tracking-wider text-ink-faint">
                  Sanctuary Origin
                </div>
                <div className="font-medium text-ink truncate">
                  {pickupLocation || "Gaushala Sanctuary"}
                </div>
              </div>

              <div>
                <div className="text-[10px] uppercase font-mono tracking-wider text-ink-faint">
                  Devotee Altar Destination
                </div>
                <div className="font-medium text-ink truncate">
                  {dropLocation || "Devotee Residence"}
                </div>
              </div>
            </div>

            {/* Travel Specs Badge */}
            <div className="text-right shrink-0">
              <div className="text-[15px] font-serif font-semibold text-ink">
                ~{estimatedMins} min
              </div>
              <div className="text-[11px] font-mono text-ink-faint">
                {distanceKm} km
              </div>
            </div>
          </div>
        </div>

        {/* Primary Google Maps Navigation Button */}
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg py-3 px-4 bg-forest hover:bg-forest/90 text-white font-medium text-[13px] shadow-sm transition-all cursor-pointer group"
        >
          <Compass
            size={17}
            className="transition-transform group-hover:rotate-45 text-amber-200"
          />
          <span>
            {isDriver
              ? stageIndex < 3
                ? "Start Google Maps Navigation to Sanctuary"
                : "Start Google Maps Turn-by-Turn to Devotee"
              : "Open Live Route & Traffic in Google Maps"}
          </span>
          <ExternalLink size={14} className="opacity-80 ml-auto" />
        </a>

        {/* Milestone Progression Bar */}
        <div className="space-y-1.5 pt-1">
          <div className="text-[11px] font-mono uppercase tracking-wider text-ink-faint flex items-center justify-between">
            <span>Ceremony Logistics Progression</span>
            <span>Step {Math.min(5, Math.max(1, stageIndex))} of 5</span>
          </div>

          <div className="grid grid-cols-5 gap-1.5">
            {milestones.map((m, idx) => (
              <div
                key={idx}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  m.active ? "bg-forest" : "bg-line"
                }`}
              />
            ))}
          </div>

          <div className="grid grid-cols-5 text-center gap-1 pt-1">
            {milestones.map((m, idx) => (
              <div key={idx} className="min-w-0">
                <div
                  className={`text-[10.5px] font-medium truncate ${
                    m.current
                      ? "text-forest font-semibold"
                      : m.active
                        ? "text-ink"
                        : "text-ink-faint"
                  }`}
                >
                  {m.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bovine Welfare Transport Protocol Note */}
        <div className="rounded-lg bg-saffron-soft/40 border border-saffron/20 p-2.5 flex items-start gap-2 text-[11.5px] text-ink-soft">
          <ShieldCheck
            size={15}
            className="text-saffron-deep shrink-0 mt-0.5"
          />
          <div className="leading-snug">
            <strong className="text-ink font-medium">
              Bovine Welfare Safe Travel Protocol:
            </strong>{" "}
            Cattle Ambulance maintains gentle cruising speeds (&lt; 40 km/h)
            with non-slip flooring and hydraulic ramps for stress-free animal
            transport.
          </div>
        </div>
      </div>
    </div>
  )
}
