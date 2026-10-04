import { useEffect, useRef, useState, useCallback, useMemo } from "react"
import L from "leaflet"
import {
  MapPin,
  Search,
  Crosshair,
  Compass,
  Check,
  RefreshCw,
  Sparkles,
  ChevronDown,
  Navigation,
  Maximize2,
  Minimize2,
  ChevronsUpDown,
  X,
  Layers,
  CheckCircle2,
  Copy,
  AlertCircle,
} from "lucide-react"
import {
  INDIAN_REGIONAL_HUBS,
  findNearestIndianHub,
  type OperationalRegionHub,
} from "../data/regions"
import { reverseGeocodeCoords } from "../hooks/useDeviceLocation"
import { createResilientTileLayer } from "../lib/mapTiles"

export interface MapLocationPickerProps {
  initialLat?: number
  initialLng?: number
  initialAddress?: string
  initialRegion?: string
  onChange: (data: {
    lat: number
    lng: number
    address: string
    city?: string
    state?: string
    suggestedRegion?: string
  }) => void
  label?: string
  helperText?: string
  height?: string
  defaultViewMode?: "compact" | "elongated"
}

// Curated list of distinct, major Indian regional hubs for quick 1-tap jumps
const CURATED_JUMP_HUBS = [
  {
    id: "hyd-central",
    name: "Hyderabad (Banjara / Jubilee)",
    city: "Hyderabad",
    state: "Telangana",
    lat: 17.4156,
    lng: 78.4358,
  },
  {
    id: "hyd-cyber",
    name: "Cyberabad (HITEC / Gachibowli)",
    city: "Hyderabad",
    state: "Telangana",
    lat: 17.4401,
    lng: 78.3489,
  },
  {
    id: "hyd-sec",
    name: "Secunderabad",
    city: "Secunderabad",
    state: "Telangana",
    lat: 17.4399,
    lng: 78.4983,
  },
  {
    id: "warangal",
    name: "Warangal / Hanamkonda",
    city: "Warangal",
    state: "Telangana",
    lat: 17.9689,
    lng: 79.5941,
  },
  {
    id: "tirupati",
    name: "Tirupati (Goshala Valley)",
    city: "Tirupati",
    state: "Andhra Pradesh",
    lat: 13.6288,
    lng: 79.4192,
  },
  {
    id: "mumbai",
    name: "Mumbai / Navi Mumbai",
    city: "Mumbai",
    state: "Maharashtra",
    lat: 19.076,
    lng: 72.8777,
  },
  {
    id: "vrindavan",
    name: "Vrindavan / Mathura",
    city: "Mathura",
    state: "Uttar Pradesh",
    lat: 27.5807,
    lng: 77.6975,
  },
  {
    id: "jaipur",
    name: "Jaipur (Pink City)",
    city: "Jaipur",
    state: "Rajasthan",
    lat: 26.9124,
    lng: 75.7873,
  },
  {
    id: "bengaluru",
    name: "Bengaluru (Central)",
    city: "Bengaluru",
    state: "Karnataka",
    lat: 12.9716,
    lng: 77.5946,
  },
  {
    id: "ahmedabad",
    name: "Ahmedabad",
    city: "Ahmedabad",
    state: "Gujarat",
    lat: 23.0225,
    lng: 72.5714,
  },
  {
    id: "delhi",
    name: "Delhi NCR",
    city: "New Delhi",
    state: "Delhi NCR",
    lat: 28.6139,
    lng: 77.209,
  },
  {
    id: "varanasi",
    name: "Varanasi (Kashi)",
    city: "Varanasi",
    state: "Uttar Pradesh",
    lat: 25.3176,
    lng: 82.9739,
  },
]

// Coordinate validation helper: ensures valid finite geographic numbers
function isValidCoordinate(lat?: number | null, lng?: number | null): boolean {
  if (lat == null || lng == null) return false
  if (typeof lat !== "number" || typeof lng !== "number") return false
  if (isNaN(lat) || isNaN(lng) || !isFinite(lat) || !isFinite(lng)) return false
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false
  return true
}

// Custom Saffron Vedic Pin Icon for Leaflet
function createVedicPinIcon() {
  return L.divIcon({
    className: "custom-vedic-pin",
    html: `
      <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 42px; height: 42px; transform: translate(-21px, -40px); cursor: grab;">
        <!-- Pin Shape -->
        <div style="position: absolute; width: 38px; height: 38px; background: linear-gradient(135deg, #e07a2a 0%, #c2611b 100%); border: 3px solid #ffffff; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); box-shadow: 0 6px 18px rgba(0,0,0,0.38); display: flex; align-items: center; justify-content: center;">
        </div>
        <!-- Sacred Vedic Icon -->
        <div style="position: relative; z-index: 2; color: #ffffff; font-size: 17px; margin-top: -3px; text-shadow: 0 1px 3px rgba(0,0,0,0.4);">
          🛕
        </div>
        <!-- Drop Shadow on Map Ground -->
        <div style="position: absolute; bottom: -8px; width: 18px; height: 7px; background: rgba(0,0,0,0.32); border-radius: 50%; filter: blur(1.5px);"></div>
      </div>
    `,
    iconSize: [42, 42],
    iconAnchor: [21, 40],
  })
}

export default function MapLocationPicker({
  initialLat,
  initialLng,
  initialAddress = "",
  initialRegion = "",
  onChange,
  label = "Gaushala Premise Map Pinpoint & Coordinates *",
  helperText = "Click anywhere on the map or drag the pin to set the exact physical shelter location.",
  height = "320px",
  defaultViewMode = "compact",
}: MapLocationPickerProps) {
  // Screen & View Mode: "compact" (standard) | "elongated" (tall 580px) | "fullscreen" (full viewport studio)
  const [viewMode, setViewMode] = useState<"compact" | "elongated" | "fullscreen">(defaultViewMode)

  // Default coordinate initialization with strict NaN validation
  const defaultHub = INDIAN_REGIONAL_HUBS[0] // Hyderabad Central
  const safeInitialLat = isValidCoordinate(initialLat, initialLng) ? (initialLat as number) : defaultHub.lat
  const safeInitialLng = isValidCoordinate(initialLat, initialLng) ? (initialLng as number) : defaultHub.lng

  const [currentLat, setCurrentLat] = useState<number>(safeInitialLat)
  const [currentLng, setCurrentLng] = useState<number>(safeInitialLng)

  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)

  // Search & Geocoding State
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false)
  const [isDetectingGps, setIsDetectingGps] = useState(false)
  const [gpsMessage, setGpsMessage] = useState<string | null>(null)
  const [gpsError, setGpsError] = useState<string | null>(null)
  const [resolvedAddress, setResolvedAddress] = useState(initialAddress)
  const [resolvedRegion, setResolvedRegion] = useState(initialRegion)
  const [copiedNotification, setCopiedNotification] = useState(false)

  // Smooth Leaflet size invalidation loop during animation transitions
  const triggerSmoothInvalidation = useCallback(() => {
    if (!mapInstanceRef.current) return
    const map = mapInstanceRef.current
    const startTime = performance.now()
    const duration = 500

    const step = (time: number) => {
      map.invalidateSize({ animate: false })
      if (time - startTime < duration) {
        requestAnimationFrame(step)
      } else {
        map.invalidateSize({ animate: true })
        if (markerRef.current) {
          try {
            map.panTo(markerRef.current.getLatLng(), { animate: true, duration: 0.25 })
          } catch {}
        }
      }
    }
    requestAnimationFrame(step)
  }, [])

  // Update Coordinates, Reverse Geocode, and Notify Parent
  const handleUpdateCoordinates = useCallback(
    async (lat: number, lng: number, skipReverse = false) => {
      if (!isValidCoordinate(lat, lng)) {
        console.warn("handleUpdateCoordinates: invalid lat/lng ignored:", lat, lng)
        return
      }

      setCurrentLat(lat)
      setCurrentLng(lng)

      // Move marker
      if (markerRef.current) {
        try {
          markerRef.current.setLatLng([lat, lng])
        } catch (e) {
          console.warn("Error setting marker LatLng:", e)
        }
      }

      // Resolve Closest Operational Indian Hub
      const closest = findNearestIndianHub(lat, lng)
      const suggestedRegion = `${closest.hub.state} - ${closest.hub.name}`
      setResolvedRegion(suggestedRegion)

      if (skipReverse) {
        onChange({
          lat,
          lng,
          address: resolvedAddress,
          city: closest.hub.city,
          state: closest.hub.state,
          suggestedRegion,
        })
        return
      }

      // Reverse Geocode via Nominatim
      setIsReverseGeocoding(true)
      try {
        const geoResult = await reverseGeocodeCoords(lat, lng)
        const addr = geoResult.address || `${closest.hub.name}, ${closest.hub.city}`
        setResolvedAddress(addr)
        onChange({
          lat,
          lng,
          address: addr,
          city: geoResult.city || closest.hub.city,
          state: geoResult.state || closest.hub.state,
          suggestedRegion,
        })
      } catch (e) {
        console.warn("Reverse geocode failed:", e)
        onChange({
          lat,
          lng,
          address: resolvedAddress || `${closest.hub.name}, ${closest.hub.city}`,
          city: closest.hub.city,
          state: closest.hub.state,
          suggestedRegion,
        })
      } finally {
        setIsReverseGeocoding(false)
      }
    },
    [onChange, resolvedAddress],
  )

  // Fly smoothly to target coordinates with strict validation
  const flyToCoords = useCallback(
    (lat: number, lng: number, zoom = 15) => {
      if (!isValidCoordinate(lat, lng)) {
        console.warn("flyToCoords: invalid lat/lng ignored:", lat, lng)
        return
      }

      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.flyTo([lat, lng], zoom, {
            duration: 1.2,
            easeLinearity: 0.25,
          })
        } catch (e) {
          console.warn("Leaflet flyTo failed:", e)
        }
      }
      handleUpdateCoordinates(lat, lng)
    },
    [handleUpdateCoordinates],
  )

  // Sync with external coordinates changes without remounting the map
  useEffect(() => {
    if (
      isValidCoordinate(initialLat, initialLng) &&
      (Math.abs((initialLat as number) - currentLat) > 0.0001 ||
        Math.abs((initialLng as number) - currentLng) > 0.0001)
    ) {
      const safeLat = initialLat as number
      const safeLng = initialLng as number
      setCurrentLat(safeLat)
      setCurrentLng(safeLng)
      if (markerRef.current) {
        try {
          markerRef.current.setLatLng([safeLat, safeLng])
        } catch {}
      }
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.panTo([safeLat, safeLng], { animate: true, duration: 0.5 })
        } catch {}
      }
    }
  }, [initialLat, initialLng])

  // Initialize Leaflet Map once
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return

    const initialCoord: L.LatLngTuple = [currentLat, currentLng]
    const map = L.map(mapContainerRef.current, {
      center: initialCoord,
      zoom: 14,
      zoomControl: false,
    })

    // Resilient CARTO Voyager Basemap with OpenStreetMap Fallback
    createResilientTileLayer(map)

    // Position Zoom control top-right
    L.control.zoom({ position: "topright" }).addTo(map)

    // Create Draggable Pin Marker
    const marker = L.marker(initialCoord, {
      draggable: true,
      icon: createVedicPinIcon(),
      title: "Gaushala Premise Location",
    }).addTo(map)

    marker.bindPopup(
      `<div style="font-family: sans-serif; font-size: 12px; text-align: center; padding: 4px;">
        <strong style="color: #c2611b; font-size: 13px;">Sacred Gaushala Premise</strong><br/>
        <span style="color: #555; font-size: 11px;">Drag pin or tap map to place exact sanctuary entrance</span>
      </div>`,
    )

    // Marker Drag Handler
    marker.on("dragend", () => {
      const pos = marker.getLatLng()
      if (pos && isValidCoordinate(pos.lat, pos.lng)) {
        handleUpdateCoordinates(
          Number(pos.lat.toFixed(5)),
          Number(pos.lng.toFixed(5)),
        )
      }
    })

    // Map Click Handler (Click anywhere to smoothly place pin)
    map.on("click", (e: L.LeafletMouseEvent) => {
      if (e?.latlng && isValidCoordinate(e.latlng.lat, e.latlng.lng)) {
        const lat = Number(e.latlng.lat.toFixed(5))
        const lng = Number(e.latlng.lng.toFixed(5))
        handleUpdateCoordinates(lat, lng)
      }
    })

    mapInstanceRef.current = map
    markerRef.current = marker

    // Initial size invalidation
    setTimeout(() => {
      map.invalidateSize()
    }, 200)

    // ResizeObserver on the container to smoothly invalidate on layout/dimension shifts
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize({ animate: false })
    })
    resizeObserver.observe(mapContainerRef.current)

    return () => {
      resizeObserver.disconnect()
      map.remove()
      mapInstanceRef.current = null
      markerRef.current = null
    }
  }, [])

  // Lock body scroll and listen to ESC key in fullscreen mode
  useEffect(() => {
    if (viewMode === "fullscreen") {
      document.body.style.overflow = "hidden"
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          setViewMode("compact")
          setTimeout(triggerSmoothInvalidation, 50)
        }
      }
      window.addEventListener("keydown", handleKeyDown)
      return () => {
        document.body.style.overflow = ""
        window.removeEventListener("keydown", handleKeyDown)
      }
    } else {
      document.body.style.overflow = ""
    }
  }, [viewMode, triggerSmoothInvalidation])

  // Auto-Debounced Real-Time Search (350ms)
  useEffect(() => {
    const q = searchQuery.trim()
    if (q.length < 3) {
      setSearchResults([])
      return
    }

    const timer = setTimeout(async () => {
      setIsSearching(true)
      try {
        const queryWithCountry = q.toLowerCase().includes("india") ? q : `${q}, India`
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            queryWithCountry,
          )}&countrycodes=in&limit=5&addressdetails=1`,
          {
            headers: {
              "Accept-Language": "en",
              "User-Agent": "GOMAA-Gaushala-Manager/1.0",
            },
          },
        )
        if (res.ok) {
          const data = await res.json()
          setSearchResults(data)
        }
      } catch (err) {
        console.warn("Geocoding search failed:", err)
      } finally {
        setIsSearching(false)
      }
    }, 350)

    return () => clearTimeout(timer)
  }, [searchQuery])

  // Handle Search Submission (without using <form> to prevent nested form errors)
  const handleSearchExecute = async () => {
    const q = searchQuery.trim()
    if (!q) return

    setIsSearching(true)
    try {
      const queryWithCountry = q.toLowerCase().includes("india") ? q : `${q}, India`
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          queryWithCountry,
        )}&countrycodes=in&limit=5&addressdetails=1`,
        {
          headers: {
            "Accept-Language": "en",
            "User-Agent": "GOMAA-Gaushala-Manager/1.0",
          },
        },
      )
      if (res.ok) {
        const data = await res.json()
        setSearchResults(data)
        if (data.length > 0) {
          const first = data[0]
          const lat = parseFloat(first.lat)
          const lng = parseFloat(first.lon)
          if (isValidCoordinate(lat, lng)) {
            flyToCoords(lat, lng, 16)
            setSearchResults([])
          }
        }
      }
    } catch (err) {
      console.warn("Geocoding search failed:", err)
    } finally {
      setIsSearching(false)
    }
  }

  // Handle Selecting a Search Suggestion
  const handleSelectSearchResult = (result: any) => {
    const lat = parseFloat(result.lat)
    const lng = parseFloat(result.lon)
    if (!isValidCoordinate(lat, lng)) return

    const displayName = result.display_name
    setSearchQuery(displayName.split(",").slice(0, 3).join(", "))
    setSearchResults([])
    flyToCoords(lat, lng, 16)
  }

  // Use Device Live GPS (with safe coordinate extraction)
  const handleUseCurrentGPS = () => {
    if (!navigator.geolocation) {
      setGpsError("GPS is not supported by your browser.")
      setTimeout(() => setGpsError(null), 4000)
      return
    }

    setIsDetectingGps(true)
    setGpsMessage(null)
    setGpsError(null)

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsDetectingGps(false)
        if (
          !pos?.coords ||
          typeof pos.coords.latitude !== "number" ||
          typeof pos.coords.longitude !== "number" ||
          isNaN(pos.coords.latitude) ||
          isNaN(pos.coords.longitude)
        ) {
          setGpsError("Could not retrieve precise coordinates.")
          setTimeout(() => setGpsError(null), 4000)
          return
        }

        const lat = Number(pos.coords.latitude.toFixed(5))
        const lng = Number(pos.coords.longitude.toFixed(5))

        if (!isValidCoordinate(lat, lng)) {
          setGpsError("Received out-of-range GPS coordinates.")
          setTimeout(() => setGpsError(null), 4000)
          return
        }

        const accuracy = Math.round(pos.coords.accuracy || 0)
        flyToCoords(lat, lng, 16)
        setGpsMessage(`Locked to GPS (±${accuracy}m accuracy)`)
        setTimeout(() => setGpsMessage(null), 5000)
      },
      (err) => {
        console.warn("GPS error:", err.message)
        setIsDetectingGps(false)
        setGpsError(err.code === 1 ? "Location permission denied" : "Unable to acquire GPS signal")
        setTimeout(() => setGpsError(null), 4000)
      },
      { enableHighAccuracy: true, timeout: 9000, maximumAge: 0 },
    )
  }

  // Toggle View Modes
  const toggleElongate = () => {
    setViewMode((prev) => (prev === "compact" ? "elongated" : "compact"))
    setTimeout(triggerSmoothInvalidation, 50)
  }

  const toggleFullscreen = () => {
    setViewMode((prev) => (prev === "fullscreen" ? "compact" : "fullscreen"))
    setTimeout(triggerSmoothInvalidation, 50)
  }

  // Copy coordinates to clipboard
  const handleCopyCoords = () => {
    navigator.clipboard.writeText(`${currentLat.toFixed(5)}, ${currentLng.toFixed(5)}`)
    setCopiedNotification(true)
    setTimeout(() => setCopiedNotification(false), 2000)
  }

  // UNIFIED RENDER: The container and map DOM node are NEVER unmounted.
  // When in fullscreen mode, CSS transforms the SAME container into a full-viewport studio!
  return (
    <div
      className={
        viewMode === "fullscreen"
          ? "fixed inset-0 z-[9999] bg-paper text-ink flex flex-col p-4 sm:p-6 backdrop-blur-md overflow-hidden animate-in fade-in duration-200"
          : "space-y-2.5 relative"
      }
    >
      {/* Fullscreen Dedicated Executive Header */}
      {viewMode === "fullscreen" && (
        <div className="flex items-center justify-between pb-3 border-b border-line mb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-saffron text-white grid place-items-center shadow-xs">
              <Compass size={18} />
            </div>
            <div>
              <h2 className="font-serif text-[18px] font-bold text-ink leading-tight">
                Gaushala Geodesic Pinpoint Studio
              </h2>
              <p className="text-[11.5px] text-ink-faint">
                Full-screen precision geofencing across India. Tap anywhere or drag the sacred pin.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleFullscreen}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-forest text-white text-[12.5px] font-semibold hover:opacity-90 transition cursor-pointer shadow-sm"
            >
              <CheckCircle2 size={15} />
              <span>Confirm &amp; Lock Pinpoint</span>
            </button>
            <button
              type="button"
              onClick={toggleFullscreen}
              className="h-8 w-8 rounded-lg border border-line bg-card hover:bg-paper-deep text-ink-soft grid place-items-center transition cursor-pointer"
              title="Close Fullscreen (Esc)"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Label and Geodesic Badge (Only shown in Inline / Compact mode) */}
      {viewMode !== "fullscreen" && (
        <>
          <div className="flex items-baseline justify-between">
            <label className="block text-[12px] font-semibold text-ink">
              {label}
            </label>
            <div className="text-[11px] font-mono text-forest flex items-center gap-1 font-medium">
              <Check size={12} />
              <span>Geodesic Routing Enabled</span>
            </div>
          </div>
          <p className="text-[11px] text-ink-faint leading-relaxed">{helperText}</p>
        </>
      )}

      {/* Top Map Controls: Search Bar & GPS (Uses <div> instead of <form> to prevent nested form errors) */}
      <div className="flex flex-col sm:flex-row gap-2 shrink-0">
        <div className="relative flex-1 flex items-center">
          <Search
            size={14}
            className="absolute left-3 text-ink-faint pointer-events-none"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                handleSearchExecute()
              }
            }}
            placeholder="Search address, landmark, town in India (e.g. 'Raman Reti Vrindavan', 'Gachibowli')..."
            className="w-full bg-card border border-line rounded pl-8 pr-16 py-1.5 text-[12.5px] text-ink outline-none focus:border-forest transition shadow-2xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-14 text-ink-faint hover:text-ink p-1 cursor-pointer"
            >
              <X size={12} />
            </button>
          )}
          <button
            type="button"
            onClick={handleSearchExecute}
            disabled={isSearching || !searchQuery.trim()}
            className="absolute right-1.5 px-2.5 py-0.5 rounded bg-forest text-white text-[11px] font-medium hover:opacity-90 disabled:opacity-40 transition cursor-pointer"
          >
            {isSearching ? "Searching..." : "Locate"}
          </button>
        </div>

        <button
          type="button"
          onClick={handleUseCurrentGPS}
          disabled={isDetectingGps}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded border border-line bg-card hover:bg-paper-deep text-ink text-[12px] font-medium transition cursor-pointer shrink-0 shadow-2xs"
          title="Use current device GPS if you are physically at the Gaushala"
        >
          <Crosshair
            size={13}
            className={isDetectingGps ? "animate-spin text-saffron" : "text-saffron"}
          />
          <span>{isDetectingGps ? "Acquiring..." : "I'm At The Gaushala (GPS)"}</span>
        </button>
      </div>

      {/* GPS Error Feedback Banner */}
      {gpsError && (
        <div className="p-2 rounded bg-amber-500/10 border border-amber-500/30 text-amber-800 text-[11.5px] flex items-center gap-1.5 shrink-0">
          <AlertCircle size={13} className="shrink-0" />
          <span>{gpsError}</span>
        </div>
      )}

      {/* Search Autocomplete Suggestions Dropdown */}
      {searchResults.length > 0 && (
        <div className="bg-card border border-line rounded shadow-lg max-h-40 overflow-y-auto z-30 text-[12px] divide-y divide-line/60">
          {searchResults.map((item, idx) => (
            <div
              key={idx}
              onClick={() => handleSelectSearchResult(item)}
              className="p-2.5 hover:bg-paper cursor-pointer flex items-start gap-2 transition"
            >
              <MapPin size={13} className="text-saffron shrink-0 mt-0.5" />
              <div className="line-clamp-1 text-ink leading-tight">
                {item.display_name}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick Jump Indian Hub Shortcuts - Deduplicated and Unique */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] -mx-1 px-1 shrink-0">
        <span className="font-mono text-ink-faint shrink-0 text-[10px] uppercase tracking-wider">
          Jump to:
        </span>
        {CURATED_JUMP_HUBS.map((hub) => (
          <button
            key={hub.id}
            type="button"
            onClick={() => flyToCoords(hub.lat, hub.lng, 13)}
            className="px-2 py-0.5 rounded-full border border-line bg-paper hover:bg-forest-soft/40 hover:border-forest/50 text-ink-soft shrink-0 transition text-[11px] cursor-pointer"
          >
            {hub.name}
          </button>
        ))}
      </div>

      {/* Persistent Map Element: NEVER UNMOUNTED ACROSS MODES */}
      <div
        className={`relative w-full rounded-xl overflow-hidden border border-line-strong shadow-md bg-paper-deep transition-[height,max-height] duration-500 cubic-bezier(0.16, 1, 0.3, 1) ${
          viewMode === "fullscreen"
            ? "flex-1 min-h-0 h-full"
            : viewMode === "elongated"
            ? "h-[580px] sm:h-[620px]"
            : "h-[300px] sm:h-[340px]"
        }`}
      >
        {/* Leaflet Mount Container */}
        <div ref={mapContainerRef} className="h-full w-full z-0 cursor-crosshair" />

        {/* Floating Viewport Mode Switcher Pill (Top Left) */}
        <div className="absolute top-3 left-3 z-[400] flex items-center gap-1.5 p-1 rounded-lg bg-card/95 backdrop-blur-md border border-line shadow-md text-[11px]">
          {viewMode !== "fullscreen" && (
            <button
              type="button"
              onClick={toggleElongate}
              className={`flex items-center gap-1 px-2.5 py-1 rounded font-medium transition cursor-pointer ${
                viewMode === "elongated"
                  ? "bg-forest text-white shadow-2xs"
                  : "text-ink-soft hover:bg-paper hover:text-ink"
              }`}
              title={viewMode === "elongated" ? "Switch to standard compact map" : "Elongate map to tall view"}
            >
              <ChevronsUpDown size={12} />
              <span>{viewMode === "elongated" ? "Elongated (Active)" : "Elongate Map"}</span>
            </button>
          )}

          <button
            type="button"
            onClick={toggleFullscreen}
            className={`flex items-center gap-1 px-2.5 py-1 rounded font-medium transition cursor-pointer ${
              viewMode === "fullscreen"
                ? "bg-saffron text-white shadow-2xs"
                : "text-ink-soft hover:bg-paper hover:text-ink"
            }`}
            title="Open full-screen pinpoint studio"
          >
            {viewMode === "fullscreen" ? (
              <>
                <Minimize2 size={12} />
                <span>Exit Fullscreen</span>
              </>
            ) : (
              <>
                <Maximize2 size={12} />
                <span>Full Screen</span>
              </>
            )}
          </button>
        </div>

        {/* Subtle Hint to Tap & Elongate (visible when compact) */}
        {viewMode === "compact" && (
          <button
            type="button"
            onClick={toggleElongate}
            className="absolute top-3 right-12 z-[400] hidden sm:flex items-center gap-1 px-2 py-1 rounded-full bg-paper/90 backdrop-blur-xs border border-line/80 text-[10.5px] text-ink-faint hover:text-forest hover:border-forest transition shadow-2xs cursor-pointer"
          >
            <Sparkles size={11} className="text-saffron shrink-0" />
            <span>Tap to Elongate Screen ↕</span>
          </button>
        )}

        {/* Floating Coordinates & State Telemetry Badge (Bottom) */}
        <div className="absolute bottom-3 left-3 right-3 z-[400] flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-card/95 backdrop-blur-md border border-line shadow-lg text-[12px]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-7 w-7 rounded-full bg-saffron text-white grid place-items-center shadow-2xs shrink-0">
              <MapPin size={14} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-ink tabular tracking-tight">
                  {currentLat.toFixed(5)}° N, {currentLng.toFixed(5)}° E
                </span>
                <button
                  type="button"
                  onClick={handleCopyCoords}
                  className="text-[10px] text-ink-faint hover:text-ink cursor-pointer px-1 py-0.5 rounded hover:bg-paper transition"
                  title="Copy coordinates"
                >
                  {copiedNotification ? (
                    <span className="text-forest font-semibold">✓ Copied</span>
                  ) : (
                    <Copy size={11} />
                  )}
                </button>
              </div>
              {isReverseGeocoding ? (
                <span className="text-[11px] text-saffron-deep animate-pulse flex items-center gap-1 font-medium">
                  <RefreshCw size={10} className="animate-spin" />
                  Resolving address from coordinates...
                </span>
              ) : (
                <span className="text-[11px] text-ink-soft truncate block max-w-[280px] sm:max-w-[420px]">
                  {resolvedAddress || resolvedRegion || "Locality ready"}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {gpsMessage && (
              <span className="text-[11px] text-forest font-medium hidden sm:inline-block">
                {gpsMessage}
              </span>
            )}
            <div className="text-[11px] font-mono text-ok flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-ok/10 border border-ok/20">
              <span className="h-2 w-2 rounded-full bg-ok animate-pulse" />
              <span className="font-medium">Pin Locked</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Elongate / Expand Bar Toggle (Only in Inline Mode) */}
      {viewMode !== "fullscreen" && (
        <div className="flex items-center justify-between pt-1 shrink-0">
          <button
            type="button"
            onClick={toggleElongate}
            className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-forest hover:text-forest-deep transition cursor-pointer"
          >
            <ChevronsUpDown size={13} />
            <span>
              {viewMode === "elongated"
                ? "↕ Collapse to Compact View (300px)"
                : "↕ Elongate & Enlarge Map View (580px)"}
            </span>
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="inline-flex items-center gap-1 text-[11.5px] font-medium text-ink-faint hover:text-ink transition cursor-pointer"
          >
            <Maximize2 size={12} />
            <span>Expand to Full Screen</span>
          </button>
        </div>
      )}
    </div>
  )
}
