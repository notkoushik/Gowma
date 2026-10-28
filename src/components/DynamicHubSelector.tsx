import { useState, useEffect, useRef, useMemo } from "react"
import {
  MapPin,
  Search,
  Plus,
  Crosshair,
  Check,
  ChevronDown,
  Sparkles,
  Building2,
  Navigation,
  Globe,
  X,
  Compass,
  AlertCircle,
} from "lucide-react"
import {
  INDIAN_REGIONAL_HUBS,
  type OperationalRegionHub,
  ALL_INDIAN_STATES_AND_UTS,
  getActiveHubsRegistry,
  registerDynamicHub,
  syncDynamicHubs,
  calculateDistanceKm,
} from "../data/regions"
import { api } from "../services/api"
import { reverseGeocodeCoords } from "../hooks/useDeviceLocation"

export interface DynamicHubSelectorProps {
  value: string
  currentLat?: number
  currentLng?: number
  onSelectHub: (hub: OperationalRegionHub) => void
  label?: string
  required?: boolean
  className?: string
}

export default function DynamicHubSelector({
  value,
  currentLat,
  currentLng,
  onSelectHub,
  label = "Operational Hub / City *",
  required = true,
  className = "",
}: DynamicHubSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [hubsList, setHubsList] = useState<OperationalRegionHub[]>(
    getActiveHubsRegistry(),
  )
  const [isLoading, setIsLoading] = useState(false)
  const [isDetectingGps, setIsDetectingGps] = useState(false)
  const [gpsNotice, setGpsNotice] = useState<string | null>(null)

  // New Hub Creation Modal / Drawer State
  const [showAddHubModal, setShowAddHubModal] = useState(false)
  const [newHubState, setNewHubState] = useState(ALL_INDIAN_STATES_AND_UTS[0])
  const [newHubCity, setNewHubCity] = useState("")
  const [newHubName, setNewHubName] = useState("")
  const [newHubRadius, setNewHubRadius] = useState(35)
  const [newHubLat, setNewHubLat] = useState<number>(currentLat || 17.4156)
  const [newHubLng, setNewHubLng] = useState<number>(currentLng || 78.4358)
  const [isSubmittingHub, setIsSubmittingHub] = useState(false)
  const [newHubError, setNewHubError] = useState<string | null>(null)

  const dropdownRef = useRef<HTMLDivElement>(null)

  // 1. Fetch dynamic hubs from backend API on mount
  useEffect(() => {
    let mounted = true
    setIsLoading(true)
    api
      .getHubs()
      .then((res) => {
        if (mounted && res?.ok && Array.isArray(res.hubs)) {
          syncDynamicHubs(res.hubs)
          setHubsList(getActiveHubsRegistry())
        }
      })
      .catch((err) => {
        console.warn(
          "[DynamicHubSelector] Could not fetch server hubs, using local registry:",
          err,
        )
      })
      .finally(() => {
        if (mounted) setIsLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Resolve currently selected hub object
  const selectedHub = useMemo(() => {
    if (!value) return hubsList[0] || INDIAN_REGIONAL_HUBS[0]
    return (
      hubsList.find(
        (h) =>
          h.id === value ||
          h.name.toLowerCase() === value.toLowerCase() ||
          value.toLowerCase().includes(h.name.toLowerCase()) ||
          `${h.city} — ${h.name}`.toLowerCase() === value.toLowerCase(),
      ) || null
    )
  }, [value, hubsList])

  // Filter hubs by search query
  const filteredHubs = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return hubsList
    return hubsList.filter(
      (h) =>
        h.name.toLowerCase().includes(q) ||
        h.city.toLowerCase().includes(q) ||
        h.state.toLowerCase().includes(q) ||
        h.zone.toLowerCase().includes(q),
    )
  }, [search, hubsList])

  // Group hubs by state
  const hubsByState = useMemo(() => {
    const map = new Map<string, OperationalRegionHub[]>()
    for (const hub of filteredHubs) {
      const list = map.get(hub.state) || []
      list.push(hub)
      map.set(hub.state, list)
    }
    return map
  }, [filteredHubs])

  // GPS auto-detect location
  const handleDetectLocation = async () => {
    setIsDetectingGps(true)
    setGpsNotice(null)

    if (!navigator.geolocation) {
      setGpsNotice("Geolocation is not supported by your browser.")
      setIsDetectingGps(false)
      return
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        try {
          // 1. Try to reverse geocode address to get city and state
          const geo = await reverseGeocodeCoords(lat, lng)
          const detectedCity = geo.city || "Detected City"
          const detectedState = geo.state || "Telangana"

          // 2. Find nearest existing hub
          let closest = hubsList[0]
          let minDist = Infinity
          for (const h of hubsList) {
            const d = calculateDistanceKm(lat, lng, h.lat, h.lng)
            if (d < minDist) {
              minDist = d
              closest = h
            }
          }

          if (minDist <= closest.defaultMaxRadiusKm) {
            // Found a nearby serviced hub
            onSelectHub(closest)
            setGpsNotice(
              `Matched nearby hub: ${closest.name} (${minDist.toFixed(1)} km away)`,
            )
            setIsOpen(false)
          } else {
            // User is in a new district or unserved cluster
            setGpsNotice(
              `Nearest registered hub is ${minDist.toFixed(0)} km away in ${closest.city}.`,
            )
            setNewHubState(
              ALL_INDIAN_STATES_AND_UTS.find(
                (s) => s.toLowerCase() === detectedState.toLowerCase(),
              ) || ALL_INDIAN_STATES_AND_UTS[0],
            )
            setNewHubCity(detectedCity)
            setNewHubName(`${detectedCity} Sanctuary Belt`)
            setNewHubLat(lat)
            setNewHubLng(lng)
            setShowAddHubModal(true)
          }
        } catch {
          setGpsNotice("Could not resolve address from coordinates.")
        } finally {
          setIsDetectingGps(false)
        }
      },
      (err) => {
        setGpsNotice(err.message || "Could not retrieve GPS coordinates.")
        setIsDetectingGps(false)
      },
      { timeout: 8000, enableHighAccuracy: true },
    )
  }

  // Create new custom operational hub
  const handleCreateHub = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmittingHub(true)
    setNewHubError(null)

    if (!newHubCity.trim() || !newHubName.trim()) {
      setNewHubError("Please enter City and Hub name.")
      setIsSubmittingHub(false)
      return
    }

    try {
      const res = await api.createHub({
        state: newHubState,
        city: newHubCity.trim(),
        name: newHubName.trim(),
        defaultMaxRadiusKm: Number(newHubRadius) || 35,
        lat: Number(newHubLat),
        lng: Number(newHubLng),
      })

      if (res?.ok && res.hub) {
        registerDynamicHub(res.hub)
        setHubsList(getActiveHubsRegistry())
        onSelectHub(res.hub)
        setShowAddHubModal(false)
        setIsOpen(false)
        setNewHubCity("")
        setNewHubName("")
      } else {
        setNewHubError("Failed to register operational hub.")
      }
    } catch (err: any) {
      setNewHubError(err.message || "Failed to create operational hub.")
    } finally {
      setIsSubmittingHub(false)
    }
  }

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {label && (
        <div className="flex items-center justify-between mb-1">
          <label className="block text-[12px] font-semibold text-ink uppercase tracking-wider">
            {label}
          </label>
          <button
            type="button"
            onClick={handleDetectLocation}
            disabled={isDetectingGps}
            className="inline-flex items-center gap-1 text-[11px] text-saffron hover:text-saffron-deep font-semibold cursor-pointer disabled:opacity-50"
            title="Auto-detect closest hub from device GPS"
          >
            {isDetectingGps ? (
              <div className="w-3 h-3 border-2 border-saffron border-t-transparent rounded-full animate-spin" />
            ) : (
              <Crosshair size={12} />
            )}
            <span>GPS Auto-Detect</span>
          </button>
        </div>
      )}

      {/* Main Select Button Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full bg-paper border border-line hover:border-saffron/60 rounded-md px-3.5 py-2.5 text-left text-[13px] text-ink outline-none focus:border-saffron focus:ring-2 focus:ring-saffron/20 transition flex items-center justify-between gap-2 shadow-2xs cursor-pointer"
      >
        <div className="flex items-center gap-2 min-w-0">
          <MapPin size={15} className="text-saffron-deep shrink-0" />
          <div className="truncate">
            {selectedHub ? (
              <div className="flex items-baseline gap-1.5 truncate">
                <span className="font-semibold text-ink">
                  {selectedHub.city}
                </span>
                <span className="text-ink-faint text-[12px] truncate">
                  — {selectedHub.name}
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 bg-stone-100 text-ink-soft rounded-xs shrink-0">
                  {selectedHub.state}
                </span>
                {selectedHub.isCustom && (
                  <span className="text-[9.5px] font-mono px-1.5 py-0.2 bg-emerald-50 text-emerald-700 font-semibold rounded-xs shrink-0 border border-emerald-200">
                    Custom
                  </span>
                )}
              </div>
            ) : (
              <span className="text-ink-faint">
                {value || "Select Operational Hub / City"}
              </span>
            )}
          </div>
        </div>
        <ChevronDown
          size={14}
          className={`text-ink-faint shrink-0 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* GPS Status Notice if any */}
      {gpsNotice && (
        <div className="mt-1 text-[11px] text-forest font-medium flex items-center gap-1 animate-fade-in">
          <Sparkles size={11} className="shrink-0" />
          <span>{gpsNotice}</span>
        </div>
      )}

      {/* Dropdown Menu / Searchable Popover */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-paper border border-line rounded-lg shadow-xl overflow-hidden animate-[fadein_.12s_ease]">
          {/* Search Header */}
          <div className="p-2.5 border-b border-line bg-paper-soft flex items-center gap-2">
            <Search size={14} className="text-ink-faint shrink-0" />
            <input
              type="text"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Indian city, state, or hub..."
              className="w-full bg-transparent text-[12.5px] text-ink outline-none placeholder:text-ink-faint"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="text-ink-faint hover:text-ink p-0.5 cursor-pointer"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Quick Actions Bar: Add New Hub */}
          <div className="px-3 py-2 bg-saffron-soft/30 border-b border-line flex items-center justify-between text-[11.5px]">
            <span className="text-ink-faint">
              {filteredHubs.length} operational hub
              {filteredHubs.length !== 1 ? "s" : ""}
            </span>
            <button
              type="button"
              onClick={() => {
                setNewHubLat(currentLat || 17.4156)
                setNewHubLng(currentLng || 78.4358)
                setShowAddHubModal(true)
              }}
              className="inline-flex items-center gap-1 text-saffron-deep hover:text-saffron font-bold cursor-pointer transition"
            >
              <Plus size={13} />
              <span>+ Register New Hub / City</span>
            </button>
          </div>

          {/* Hubs List (Grouped by State) */}
          <div className="max-h-64 overflow-y-auto divide-y divide-line/60">
            {hubsByState.size === 0 ? (
              <div className="p-4 text-center">
                <p className="text-[12.5px] text-ink-faint mb-2">
                  No operational hubs matching &ldquo;{search}&rdquo;
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setNewHubCity(search)
                    setNewHubName(`${search} Goseva Hub`)
                    setNewHubLat(currentLat || 17.4156)
                    setNewHubLng(currentLng || 78.4358)
                    setShowAddHubModal(true)
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-saffron text-white text-[12px] font-semibold hover:bg-saffron-deep transition cursor-pointer shadow-2xs"
                >
                  <Plus size={13} />
                  <span>Create &ldquo;{search}&rdquo; as New Hub</span>
                </button>
              </div>
            ) : (
              Array.from(hubsByState.entries()).map(([state, hubs]) => (
                <div key={state} className="p-1.5">
                  <div className="px-2 py-1 text-[10.5px] font-mono uppercase tracking-wider text-ink-faint font-bold flex items-center justify-between">
                    <span>{state}</span>
                    <span className="text-[9.5px] text-ink-faint font-normal">
                      {hubs.length}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    {hubs.map((hub) => {
                      const isSelected = selectedHub?.id === hub.id
                      return (
                        <button
                          key={hub.id}
                          type="button"
                          onClick={() => {
                            onSelectHub(hub)
                            setIsOpen(false)
                          }}
                          className={`w-full text-left px-2.5 py-1.5 rounded-sm text-[12.5px] transition flex items-center justify-between gap-2 cursor-pointer ${
                            isSelected
                              ? "bg-saffron text-white font-medium"
                              : "hover:bg-paper-soft text-ink"
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-semibold truncate">
                              {hub.city}
                            </span>
                            <span
                              className={`text-[11.5px] truncate ${
                                isSelected ? "text-white/80" : "text-ink-faint"
                              }`}
                            >
                              — {hub.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {hub.isCustom && (
                              <span
                                className={`text-[9px] font-mono px-1 py-0.2 rounded-xs uppercase ${
                                  isSelected
                                    ? "bg-white/20 text-white"
                                    : "bg-emerald-100 text-emerald-800 font-semibold"
                                }`}
                              >
                                Custom
                              </span>
                            )}
                            {isSelected && (
                              <Check size={13} className="shrink-0" />
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* MODAL: REGISTER A NEW DYNAMIC OPERATIONAL HUB                         */}
      {/* -------------------------------------------------------------------- */}
      {showAddHubModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-[fadein_.15s_ease]">
          <div className="relative w-full max-w-md bg-paper border border-line rounded-lg shadow-2xl overflow-hidden p-6">
            <button
              type="button"
              onClick={() => setShowAddHubModal(false)}
              className="absolute right-4 top-4 text-ink-faint hover:text-ink p-1 rounded cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2.5 mb-1.5">
              <div className="w-8 h-8 rounded-sm bg-saffron/15 text-saffron grid place-items-center">
                <Globe size={16} />
              </div>
              <h2 className="font-serif text-[18px] font-bold text-ink">
                Register New Operational Hub
              </h2>
            </div>
            <p className="text-[12px] text-ink-faint mb-4 leading-relaxed">
              Dynamically add a new city, district, or temple pilgrimage cluster
              to the GOMAA platform. Once saved, it is immediately available for
              all Gaushala trusts and devotee discovery.
            </p>

            {newHubError && (
              <div className="mb-3.5 p-2.5 bg-red-50 border border-red-200 rounded text-[12px] text-red-800 flex items-start gap-2">
                <AlertCircle
                  size={14}
                  className="text-red-600 shrink-0 mt-0.5"
                />
                <span>{newHubError}</span>
              </div>
            )}

            <form onSubmit={handleCreateHub} className="space-y-3.5">
              <div>
                <label className="block text-[11.5px] font-semibold text-ink uppercase tracking-wider mb-1">
                  Indian State / Union Territory *
                </label>
                <select
                  value={newHubState}
                  onChange={(e) => setNewHubState(e.target.value)}
                  className="w-full bg-paper border border-line rounded-md px-3 py-2 text-[12.5px] text-ink outline-none focus:border-saffron transition cursor-pointer"
                >
                  {ALL_INDIAN_STATES_AND_UTS.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11.5px] font-semibold text-ink uppercase tracking-wider mb-1">
                    City / Town / District *
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={newHubCity}
                    onChange={(e) => setNewHubCity(e.target.value)}
                    placeholder="e.g. Tirupati"
                    className="w-full bg-paper border border-line rounded-md px-3 py-2 text-[12.5px] text-ink outline-none focus:border-saffron transition"
                  />
                </div>

                <div>
                  <label className="block text-[11.5px] font-semibold text-ink uppercase tracking-wider mb-1">
                    Service Radius (km)
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={150}
                    value={newHubRadius}
                    onChange={(e) =>
                      setNewHubRadius(Number(e.target.value) || 35)
                    }
                    className="w-full bg-paper border border-line rounded-md px-3 py-2 text-[12.5px] text-ink outline-none focus:border-saffron transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11.5px] font-semibold text-ink uppercase tracking-wider mb-1">
                  Operational Hub / Belt Name *
                </label>
                <input
                  type="text"
                  required
                  value={newHubName}
                  onChange={(e) => setNewHubName(e.target.value)}
                  placeholder="e.g. Alipiri Foothills & Heritage Sanctuary Belt"
                  className="w-full bg-paper border border-line rounded-md px-3 py-2 text-[12.5px] text-ink outline-none focus:border-saffron transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-ink-faint uppercase tracking-wider mb-1">
                    Latitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={newHubLat}
                    onChange={(e) =>
                      setNewHubLat(parseFloat(e.target.value) || 0)
                    }
                    className="w-full bg-paper border border-line rounded px-2.5 py-1.5 text-[12px] font-mono text-ink outline-none focus:border-saffron"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-ink-faint uppercase tracking-wider mb-1">
                    Longitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={newHubLng}
                    onChange={(e) =>
                      setNewHubLng(parseFloat(e.target.value) || 0)
                    }
                    className="w-full bg-paper border border-line rounded px-2.5 py-1.5 text-[12px] font-mono text-ink outline-none focus:border-saffron"
                  />
                </div>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddHubModal(false)}
                  className="flex-1 py-2 text-[12.5px] border border-line rounded-md text-ink-soft hover:bg-stone-50 cursor-pointer font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingHub}
                  className="flex-[2] inline-flex items-center justify-center gap-1.5 bg-saffron text-white rounded-md py-2 text-[13px] font-bold hover:bg-saffron-deep transition shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingHub ? (
                    <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Sparkles size={14} />
                      <span>Save &amp; Select Hub</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
