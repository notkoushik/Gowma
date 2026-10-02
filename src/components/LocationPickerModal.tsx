import { useState, useMemo } from "react"
import {
  MapPin,
  Navigation,
  Search,
  X,
  Check,
  ChevronRight,
  Sparkles,
  Compass,
} from "lucide-react"
import {
  INDIAN_REGIONAL_HUBS,
  getAllIndianStates,
  getHubsForState,
  type IndianState,
  type OperationalRegionHub,
} from "../data/regions.ts"
import MapLocationPicker from "./MapLocationPicker"

interface LocationPickerModalProps {
  isOpen: boolean
  onClose: () => void
  currentCity: string | null
  currentAddress: string | null
  onSelectHub: (hub: OperationalRegionHub) => void
  onDetectGPS: () => Promise<any>
  isDetectingGPS: boolean
}

export default function LocationPickerModal({
  isOpen,
  onClose,
  currentCity,
  currentAddress,
  onSelectHub,
  onDetectGPS,
  isDetectingGPS,
}: LocationPickerModalProps) {
  const [search, setSearch] = useState("")
  const [selectedState, setSelectedState] = useState<IndianState | "ALL">("ALL")
  const [mode, setMode] = useState<"hubs" | "map">("hubs")

  const allStates = useMemo(() => getAllIndianStates(), [])

  // Featured hubs for quick 1-tap pills
  const featuredHubs = useMemo(
    () => INDIAN_REGIONAL_HUBS.filter((h) => h.isFeatured),
    [],
  )

  // Filtered hubs based on search & state
  const filteredHubs = useMemo(() => {
    let list = INDIAN_REGIONAL_HUBS
    if (selectedState !== "ALL") {
      list = list.filter((h) => h.state === selectedState)
    }
    const q = search.toLowerCase().trim()
    if (!q) return list

    return list.filter(
      (h) =>
        h.city.toLowerCase().includes(q) ||
        h.name.toLowerCase().includes(q) ||
        h.state.toLowerCase().includes(q) ||
        h.pincodePrefixes.some((p) => p.includes(q)),
    )
  }, [search, selectedState])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-ink/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-card rounded-md border border-line shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-line flex items-center justify-between bg-paper">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full bg-saffron text-white grid place-items-center">
              <Compass size={16} />
            </div>
            <div>
              <h3 className="font-serif text-[17px] text-ink font-semibold leading-tight">
                Select Your Region
              </h3>
              <p className="text-[12px] text-ink-faint">
                GOMAA connects you with the nearest sacred Vedic Gaushalas
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-ink-faint hover:text-ink cursor-pointer hover:bg-paper-deep transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* View Mode Switcher: Browse Hubs vs Interactive Map Pinpoint */}
        <div className="flex border-b border-line bg-paper text-[12px] font-medium">
          <button
            onClick={() => setMode("hubs")}
            className={`flex-1 py-2.5 text-center flex items-center justify-center gap-1.5 transition border-b-2 cursor-pointer ${
              mode === "hubs"
                ? "border-saffron text-saffron-deep bg-saffron-soft/20 font-semibold"
                : "border-transparent text-ink-soft hover:text-ink"
            }`}
          >
            <Compass size={13} />
            Browse State & City Hubs
          </button>
          <button
            onClick={() => setMode("map")}
            className={`flex-1 py-2.5 text-center flex items-center justify-center gap-1.5 transition border-b-2 cursor-pointer ${
              mode === "map"
                ? "border-saffron text-saffron-deep bg-saffron-soft/20 font-semibold"
                : "border-transparent text-ink-soft hover:text-ink"
            }`}
          >
            <MapPin size={13} />
            Drop Pin on Live Map
          </button>
        </div>

        {mode === "map" ? (
          <div className="p-4 overflow-y-auto max-h-[70vh] bg-paper">
            <div className="mb-3 text-[12px] text-ink-soft leading-relaxed flex items-center gap-1.5">
              <Sparkles size={14} className="text-saffron shrink-0" />
              <span>Drag the sacred Vedic pin directly onto your home, building gate, or temple courtyard.</span>
            </div>
            <MapLocationPicker
              initialAddress={currentAddress || undefined}
              onChange={(data) => {
                onSelectHub({
                  id: "custom-doorstep-pin",
                  name: data.address,
                  city: data.city || currentCity || "Custom Location",
                  state: (data.state as IndianState) || "Maharashtra",
                  zone: "Central",
                  lat: data.lat,
                  lng: data.lng,
                  defaultMaxRadiusKm: 35,
                  pincodePrefixes: [],
                })
                onClose()
              }}
              height="350px"
              helperText="Click anywhere on the map or drag the pin to set your exact doorstep delivery spot."
            />
          </div>
        ) : (
          <>
            {/* Current & GPS Auto-Detect Bar */}
            <div className="p-4 border-b border-line bg-paper/50 space-y-2.5">
          <button
            onClick={async () => {
              await onDetectGPS()
              onClose()
            }}
            disabled={isDetectingGPS}
            className="w-full flex items-center justify-between p-3 rounded border border-saffron/40 bg-saffron-soft/60 hover:bg-saffron-soft transition cursor-pointer group"
          >
            <div className="flex items-center gap-2.5 text-left">
              <div className="h-8 w-8 rounded-full bg-saffron text-white grid place-items-center group-hover:scale-105 transition-transform">
                <Navigation
                  size={15}
                  className={isDetectingGPS ? "animate-spin" : ""}
                />
              </div>
              <div>
                <div className="text-[13px] font-semibold text-saffron-deep flex items-center gap-1.5">
                  Detect My Current Location
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-saffron text-white">
                    GPS
                  </span>
                </div>
                <div className="text-[11.5px] text-ink-soft">
                  {currentAddress || "Auto-detect exact doorstep coordinates"}
                </div>
              </div>
            </div>
            <ChevronRight
              size={16}
              className="text-saffron group-hover:translate-x-0.5 transition-transform"
            />
          </button>

          {/* Quick Hub Chips */}
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-ink-faint mb-1.5 flex items-center gap-1">
              <Sparkles size={11} className="text-saffron" /> Popular Vedic &
              Metro Hubs
            </div>
            <div className="flex flex-wrap gap-1.5">
              {featuredHubs.slice(0, 7).map((hub) => {
                const isSelected =
                  currentCity?.toLowerCase() === hub.city.toLowerCase()
                return (
                  <button
                    key={hub.id}
                    onClick={() => {
                      onSelectHub(hub)
                      onClose()
                    }}
                    className={`px-2.5 py-1 rounded text-[12px] font-medium transition cursor-pointer border ${
                      isSelected
                        ? "bg-saffron text-white border-saffron shadow-xs"
                        : "bg-card hover:bg-paper-deep text-ink-soft hover:text-ink border-line"
                    }`}
                  >
                    {hub.city}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="p-3 border-b border-line bg-card">
          <div className="relative">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
            />
            <input
              type="text"
              placeholder="Search by City, State, or Pincode (e.g. Hyderabad, Baner, 500075)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded border border-line bg-paper text-[13px] text-ink focus:outline-none focus:border-saffron transition"
            />
          </div>

          {/* State Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pt-2.5 pb-0.5 scrollbar-none text-[11.5px]">
            <button
              onClick={() => setSelectedState("ALL")}
              className={`px-2.5 py-0.5 rounded-full shrink-0 font-medium transition cursor-pointer ${
                selectedState === "ALL"
                  ? "bg-forest text-white"
                  : "bg-paper text-ink-soft hover:text-ink"
              }`}
            >
              All States
            </button>
            {allStates.map((st) => (
              <button
                key={st}
                onClick={() => setSelectedState(st)}
                className={`px-2.5 py-0.5 rounded-full shrink-0 font-medium transition cursor-pointer ${
                  selectedState === st
                    ? "bg-forest text-white"
                    : "bg-paper text-ink-soft hover:text-ink"
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Hubs Listing */}
        <div className="p-2 overflow-y-auto flex-1 divide-y divide-line/60">
          {filteredHubs.length === 0 ? (
            <div className="p-8 text-center text-ink-faint">
              <MapPin size={24} className="mx-auto mb-2 opacity-40" />
              <p className="text-[13px]">
                No operational hubs matching "{search}".
              </p>
              <p className="text-[11.5px] mt-1">
                You can still browse sevas; GOMAA supports extended transit across all Indian districts.
              </p>
            </div>
          ) : (
            filteredHubs.map((hub) => {
              const isSelected =
                currentCity?.toLowerCase() === hub.city.toLowerCase() &&
                currentAddress?.includes(hub.city)
              return (
                <button
                  key={hub.id}
                  onClick={() => {
                    onSelectHub(hub)
                    onClose()
                  }}
                  className="w-full text-left p-3 hover:bg-paper/70 rounded transition flex items-center justify-between cursor-pointer group"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <MapPin
                      size={16}
                      className="text-saffron shrink-0 mt-0.5 group-hover:scale-110 transition-transform"
                    />
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium text-ink flex items-center gap-1.5">
                        <span className="truncate">{hub.name}</span>
                        {isSelected && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-ok-soft text-ok font-semibold">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="text-[11.5px] text-ink-faint mt-0.5">
                        {hub.city} · {hub.state} ({hub.zone} Zone) · Service
                        Radius: {hub.defaultMaxRadiusKm} km
                      </div>
                    </div>
                  </div>
                  {isSelected ? (
                    <Check size={16} className="text-ok shrink-0 ml-2" />
                  ) : (
                    <ChevronRight
                      size={14}
                      className="text-ink-faint group-hover:text-ink shrink-0 ml-2 group-hover:translate-x-0.5 transition-transform"
                    />
                  )}
                </button>
              )
            })
          )}
        </div>
      </>
    )}

        {/* Footer */}
        <div className="p-3 border-t border-line bg-paper text-center text-[11.5px] text-ink-faint">
          Doorstep Vedic Gau Seva available within 35 km of each hub • Extended transit across all India
        </div>
      </div>
    </div>
  )
}
