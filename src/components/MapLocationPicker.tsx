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
} from "lucide-react"
import {
  INDIAN_REGIONAL_HUBS,
  findNearestIndianHub,
  type OperationalRegionHub,
} from "../data/regions"
import { reverseGeocodeCoords } from "../hooks/useDeviceLocation"

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
}

// Custom Saffron Vedic Pin Icon for Leaflet
function createVedicPinIcon() {
  return L.divIcon({
    className: "custom-vedic-pin",
    html: `
      <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 38px; height: 38px; transform: translate(-19px, -36px);">
        <div style="position: absolute; width: 38px; height: 38px; background: #c2611b; border: 3px solid #ffffff; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); box-shadow: 0 4px 12px rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center;">
        </div>
        <div style="position: relative; z-index: 2; color: #ffffff; font-size: 16px; margin-top: -4px;">
          🛕
        </div>
        <div style="position: absolute; bottom: -6px; width: 14px; height: 6px; background: rgba(0,0,0,0.25); border-radius: 50%; filter: blur(1px);"></div>
      </div>
    `,
    iconSize: [38, 38],
    iconAnchor: [19, 36],
  })
}

export default function MapLocationPicker({
  initialLat,
  initialLng,
  initialAddress = "",
  initialRegion = "",
  onChange,
  label = "Gaushala Premise Map Pinpoint & Coordinates *",
  helperText = "Click on the map or drag the pin to set the exact physical location of the Gaushala anywhere in India.",
  height = "320px",
}: MapLocationPickerProps) {
  // Coordinates State (Default to Hyderabad or provided)
  const defaultHub = INDIAN_REGIONAL_HUBS[0] // Hyderabad Central
  const [currentLat, setCurrentLat] = useState<number>(
    initialLat || defaultHub.lat,
  )
  const [currentLng, setCurrentLng] = useState<number>(
    initialLng || defaultHub.lng,
  )

  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)

  // Search & Geocoding State
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false)
  const [isDetectingGps, setIsDetectingGps] = useState(false)
  const [resolvedAddress, setResolvedAddress] = useState(initialAddress)
  const [resolvedRegion, setResolvedRegion] = useState(initialRegion)

  // Featured Indian Hubs for Quick Fly-To
  const featuredHubs = useMemo(
    () => INDIAN_REGIONAL_HUBS.filter((h) => h.isFeatured),
    [],
  )

  // Update Coordinates, Reverse Geocode, and Notify Parent
  const handleUpdateCoordinates = useCallback(
    async (lat: number, lng: number, skipReverse = false) => {
      setCurrentLat(lat)
      setCurrentLng(lng)

      // Move marker
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng])
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

      // Reverse Geocode
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

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return

    const initialCoord: L.LatLngTuple = [currentLat, currentLng]
    const map = L.map(mapContainerRef.current, {
      center: initialCoord,
      zoom: 14,
      zoomControl: false,
    })

    // CartoDB Voyager / OpenStreetMap standard tiles
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      },
    ).addTo(map)

    // Position Zoom control top-right
    L.control.zoom({ position: "topright" }).addTo(map)

    // Create Draggable Pin Marker
    const marker = L.marker(initialCoord, {
      draggable: true,
      icon: createVedicPinIcon(),
      title: "Gaushala Premise Location",
    }).addTo(map)

    marker.bindPopup(
      `<div style="font-family: sans-serif; font-size: 12px; text-align: center;">
        <strong style="color: #c2611b;">Sacred Gaushala Premise</strong><br/>
        Drag pin or click map to move
      </div>`,
    )

    // Marker Drag Handler
    marker.on("dragend", () => {
      const pos = marker.getLatLng()
      handleUpdateCoordinates(
        Number(pos.lat.toFixed(5)),
        Number(pos.lng.toFixed(5)),
      )
    })

    // Map Click Handler (Click anywhere to place pin)
    map.on("click", (e: L.LeafletMouseEvent) => {
      const lat = Number(e.latlng.lat.toFixed(5))
      const lng = Number(e.latlng.lng.toFixed(5))
      handleUpdateCoordinates(lat, lng)
    })

    mapInstanceRef.current = map
    markerRef.current = marker

    // Invalidate size after container settles
    setTimeout(() => {
      map.invalidateSize()
    }, 200)

    return () => {
      map.remove()
      mapInstanceRef.current = null
      markerRef.current = null
    }
  }, [])

  // Fly to target coordinates
  const flyToCoords = (lat: number, lng: number, zoom = 15) => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([lat, lng], zoom, { duration: 1.2 })
    }
    handleUpdateCoordinates(lat, lng)
  }

  // Handle Search Input Geocoding
  const handleSearchAddress = async (e: React.FormEvent) => {
    e.preventDefault()
    const q = searchQuery.trim()
    if (!q) return

    setIsSearching(true)
    try {
      const query = q.includes("India") ? q : `${q}, India`
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          query,
        )}&countrycodes=in&limit=5`,
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
          flyToCoords(lat, lng)
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
    setSearchQuery(result.display_name.split(",").slice(0, 3).join(", "))
    setSearchResults([])
    flyToCoords(lat, lng)
  }

  // Use Device Live GPS (if user is currently at the shelter)
  const handleUseCurrentGPS = () => {
    if (!navigator.geolocation) return

    setIsDetectingGps(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(5))
        const lng = Number(pos.coords.longitude.toFixed(5))
        flyToCoords(lat, lng, 16)
        setIsDetectingGps(false)
      },
      (err) => {
        console.warn("GPS error:", err.message)
        setIsDetectingGps(false)
      },
      { enableHighAccuracy: true, timeout: 8000 },
    )
  }

  return (
    <div className="space-y-2">
      {/* Label and Helper Text */}
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

      {/* Top Map Controls: Search Bar & GPS */}
      <div className="flex flex-col sm:flex-row gap-2">
        <form
          onSubmit={handleSearchAddress}
          className="relative flex-1 flex items-center"
        >
          <Search
            size={14}
            className="absolute left-3 text-ink-faint pointer-events-none"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search address, landmark, town in India (e.g. 'Raman Reti Vrindavan', 'Gachibowli')..."
            className="w-full bg-card border border-line rounded pl-8 pr-16 py-1.5 text-[12.5px] text-ink outline-none focus:border-forest transition shadow-2xs"
          />
          <button
            type="submit"
            disabled={isSearching || !searchQuery.trim()}
            className="absolute right-1.5 px-2.5 py-0.5 rounded bg-forest text-white text-[11px] font-medium hover:opacity-90 disabled:opacity-40 transition cursor-pointer"
          >
            {isSearching ? "Searching..." : "Locate"}
          </button>
        </form>

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

      {/* Search Autocomplete Suggestions Dropdown */}
      {searchResults.length > 0 && (
        <div className="bg-card border border-line rounded shadow-lg max-h-40 overflow-y-auto z-20 text-[12px] divide-y divide-line/60">
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

      {/* Quick Jump Indian Hub Shortcuts */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] -mx-1 px-1">
        <span className="font-mono text-ink-faint shrink-0 text-[10px] uppercase tracking-wider">
          Jump to:
        </span>
        {featuredHubs.map((hub) => (
          <button
            key={hub.id}
            type="button"
            onClick={() => flyToCoords(hub.lat, hub.lng, 13)}
            className="px-2 py-0.5 rounded-full border border-line bg-paper hover:bg-forest-soft/40 hover:border-forest/50 text-ink-soft shrink-0 transition text-[11px] cursor-pointer"
          >
            {hub.city}
          </button>
        ))}
      </div>

      {/* Interactive Leaflet Map Container */}
      <div
        className="relative rounded-lg overflow-hidden border border-line-strong shadow-inner bg-paper-deep"
        style={{ height }}
      >
        <div ref={mapContainerRef} className="h-full w-full z-0" />

        {/* Floating Coordinates & State Badge */}
        <div className="absolute bottom-2.5 left-2.5 right-2.5 z-[400] flex flex-wrap items-center justify-between gap-2 p-2 rounded bg-card/95 backdrop-blur-xs border border-line shadow-md text-[11.5px]">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded-full bg-saffron text-white grid place-items-center">
              <MapPin size={11} />
            </div>
            <div>
              <span className="font-mono font-medium text-ink tabular">
                {currentLat.toFixed(5)}° N, {currentLng.toFixed(5)}° E
              </span>
              {isReverseGeocoding ? (
                <span className="text-[10px] text-saffron-deep ml-2 animate-pulse">
                  Resolving locality...
                </span>
              ) : resolvedRegion ? (
                <span className="text-[10.5px] text-ink-faint ml-2 truncate max-w-[200px]">
                  ({resolvedRegion})
                </span>
              ) : null}
            </div>
          </div>

          <div className="text-[10.5px] font-mono text-ok flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-ok animate-pulse" />
            <span>Pin Locked</span>
          </div>
        </div>
      </div>
    </div>
  )
}
