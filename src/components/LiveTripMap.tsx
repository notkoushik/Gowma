import { useEffect, useRef, useState, useCallback, useMemo } from "react"
import L from "leaflet"
import {
  Navigation,
  MapPin,
  Flag,
  Gauge,
  Clock,
  Compass,
  RefreshCw,
  Milestone,
  Crosshair,
} from "lucide-react"
import { useRealtime } from "../hooks/useRealtime"
import { api } from "../services/api"
import { fetchRoadRoute, RoadRoute } from "../services/routing"
import { matchAndSliceRoute, LatLng } from "../utils/mapMatching"
import { VehicleMarkerAnimator } from "../utils/vehicleAnimator"
import { geocodeAddress } from "../hooks/useDeviceLocation"
import { createResilientTileLayer } from "../lib/mapTiles"

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

// Known coordinates for Gaushalas and regional localities
const REGIONAL_COORDS: Record<string, LatLng> = {
  // Registered Gaushalas & Sanctuaries
  "RamNath Gaushala": [17.4647, 78.3662], // Kondapur / Gachibowli, Hyderabad
  "Surya": [17.4401, 78.3489], // Gachibowli, Hyderabad
  "Suryavanchi Gaushala": [17.3826, 78.3976], // Narsingi / Gandipet, Hyderabad
  "Shri Krishna Gaushala": [17.4401, 78.3489],
  "Nandini Goseva Sadan": [17.4647, 78.3662],
  "Gopal Gaushala Trust": [17.4447, 78.3762],
  "Vrindavan Goshala": [17.3826, 78.3976],
  "Kamdhenu Seva Kendra": [17.4200, 78.3300],

  // Regional Localities (Hyderabad & Cyberabad)
  "Kondapur, Hyderabad": [17.4647, 78.3662],
  "Gachibowli, Hyderabad": [17.4401, 78.3489],
  "Hitec City, Hyderabad": [17.4485, 78.3748],
  "Madhapur, Hyderabad": [17.4483, 78.3915],
  "Banjara Hills, Hyderabad": [17.4156, 78.4358],
  "Jubilee Hills, Hyderabad": [17.4325, 78.4073],
  "Narsingi, Hyderabad": [17.3826, 78.3976],
  "Gandipet, Hyderabad": [17.3850, 78.3200],
  "Kukatpally, Hyderabad": [17.4947, 78.3996],
  "Secunderabad": [17.4399, 78.4983],
}

function resolveCoords(name: string, fallback: LatLng): LatLng {
  if (REGIONAL_COORDS[name]) return REGIONAL_COORDS[name]
  for (const key of Object.keys(REGIONAL_COORDS)) {
    if (
      name.toLowerCase().includes(key.toLowerCase()) ||
      key.toLowerCase().includes(name.toLowerCase())
    ) {
      return REGIONAL_COORDS[key]
    }
  }
  return fallback
}

export default function LiveTripMap({
  bookingId,
  pickupLocation,
  dropLocation,
  driverName = "Sunil Pawar",
  stageIndex,
  distanceKm = 8,
  heightClass = "h-72 md:h-96",
  interactive = true,
  customerCoords = null,
  driverCoords = null,
  viewerRole = "CUSTOMER",
}: LiveTripMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const vehicleMarkerRef = useRef<L.Marker | null>(null)
  const vehicleAnimatorRef = useRef<VehicleMarkerAnimator | null>(null)
  const destMarkerRef = useRef<L.Marker | null>(null)

  // Real Road polylines
  const roadCasingPolylineRef = useRef<L.Polyline | null>(null)
  const roadActivePolylineRef = useRef<L.Polyline | null>(null)
  const roadHistoryPolylineRef = useRef<L.Polyline | null>(null)

  const { isConnected, lastGpsTick } = useRealtime({ bookingId })

  const [polledLocation, setPolledLocation] = useState<any>(null)
  const [lastSyncTime, setLastSyncTime] = useState<number>(Date.now())
  const [secondsAgo, setSecondsAgo] = useState<number>(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [roadRoute, setRoadRoute] = useState<RoadRoute | null>(null)
  const [isLoadingRoute, setIsLoadingRoute] = useState<boolean>(true)

  // Resolve origin coordinates (Gosala)
  const originCoords = useMemo(
    () => resolveCoords(pickupLocation, [18.5074, 73.8077]),
    [pickupLocation],
  )

  // Destination coordinates: prioritize real customer device coordinates, then geocoded address, then local table
  const [actualDestCoords, setActualDestCoords] = useState<LatLng>(() => {
    if (customerCoords) return customerCoords
    return resolveCoords(dropLocation, [
      originCoords[0] + 0.024,
      originCoords[1] + 0.038,
    ])
  })

  // Whenever customerCoords or dropLocation changes, geocode or update real destination
  useEffect(() => {
    if (customerCoords && customerCoords[0] && customerCoords[1]) {
      setActualDestCoords(customerCoords)
      return
    }

    let isSubscribed = true
    geocodeAddress(dropLocation).then((coords) => {
      if (isSubscribed && coords) {
        setActualDestCoords(coords)
      }
    })

    return () => {
      isSubscribed = false
    }
  }, [customerCoords, dropLocation])

  const isEnRoute = stageIndex >= 4 && stageIndex < 7

  // Pillar 1: Fetch true turn-by-turn road route from OSRM connecting to real destination
  useEffect(() => {
    let isCancelled = false
    setIsLoadingRoute(true)

    fetchRoadRoute(originCoords, actualDestCoords).then((route) => {
      if (!isCancelled) {
        setRoadRoute(route)
        setIsLoadingRoute(false)
      }
    })

    return () => {
      isCancelled = true
    }
  }, [originCoords, actualDestCoords])

  // Determine active raw driver position (prioritize driver device GPS if passed)
  const rawPos: LatLng = useMemo(() => {
    if (driverCoords && driverCoords[0] && driverCoords[1]) {
      return driverCoords
    }
    if (lastGpsTick?.lat && lastGpsTick?.lng) {
      return [lastGpsTick.lat, lastGpsTick.lng]
    }
    if (polledLocation?.lat && polledLocation?.lng) {
      return [polledLocation.lat, polledLocation.lng]
    }
    if (stageIndex >= 5) {
      return actualDestCoords
    }
    if (isEnRoute) {
      if (roadRoute && roadRoute.coordinates.length > 2) {
        const midIdx = Math.floor(roadRoute.coordinates.length / 2)
        return roadRoute.coordinates[midIdx]
      }
      return [
        (originCoords[0] + actualDestCoords[0]) / 2,
        (originCoords[1] + actualDestCoords[1]) / 2,
      ]
    }
    return originCoords
  }, [
    driverCoords,
    lastGpsTick,
    polledLocation,
    stageIndex,
    isEnRoute,
    roadRoute,
    originCoords,
    actualDestCoords,
  ])

  // Pillar 2 & 3: Map-Matching Engine (Orthogonal road snapping & polyline slicing)
  const snapResult = useMemo(() => {
    if (!roadRoute || roadRoute.coordinates.length < 2) {
      return {
        snappedPos: rawPos,
        segmentIndex: 0,
        progressOnSegment: 0,
        distanceToRoadMeters: 0,
        bearing: 45,
        traveledCoords: [rawPos],
        remainingCoords: [rawPos, actualDestCoords],
        roadDistanceRemainingKm: distanceKm,
      }
    }
    if (stageIndex < 4) {
      return {
        snappedPos: originCoords,
        segmentIndex: 0,
        progressOnSegment: 0,
        distanceToRoadMeters: 0,
        bearing: 0,
        traveledCoords: [originCoords],
        remainingCoords: roadRoute.coordinates,
        roadDistanceRemainingKm: roadRoute.distanceKm,
      }
    }
    if (stageIndex >= 5) {
      return {
        snappedPos: actualDestCoords,
        segmentIndex: roadRoute.coordinates.length - 1,
        progressOnSegment: 1,
        distanceToRoadMeters: 0,
        bearing: 0,
        traveledCoords: roadRoute.coordinates,
        remainingCoords: [actualDestCoords],
        roadDistanceRemainingKm: 0,
      }
    }
    return matchAndSliceRoute(rawPos, roadRoute.coordinates)
  }, [
    rawPos,
    roadRoute,
    stageIndex,
    originCoords,
    actualDestCoords,
    distanceKm,
  ])

  // Effective vehicle position, road-tangent bearing, and speed
  const vehiclePos = snapResult.snappedPos
  const vehicleBearing =
    lastGpsTick?.bearing ?? polledLocation?.bearing ?? snapResult.bearing ?? 45
  const vehicleSpeed =
    lastGpsTick?.speedKmh ?? polledLocation?.speedKmh ?? (isEnRoute ? 32 : 0)

  // Real driving metrics
  const totalRoadDistanceKm = roadRoute?.distanceKm || distanceKm
  const roadDistanceRemainingKm = isEnRoute
    ? snapResult.roadDistanceRemainingKm
    : stageIndex >= 5
      ? 0
      : totalRoadDistanceKm

  const etaMinutes = isEnRoute
    ? Math.max(
        1,
        Math.round((roadDistanceRemainingKm / Math.max(vehicleSpeed, 25)) * 60),
      )
    : roadRoute?.durationMin || 8

  // 1-Minute Polling function to fetch driver's latest GPS fix
  const fetchDriverGps = useCallback(async () => {
    setIsRefreshing(true)
    try {
      const res = await api.getDriverLocation(bookingId)
      if (res?.location) {
        setPolledLocation(res.location)
        setLastSyncTime(Date.now())
        setSecondsAgo(0)
      }
    } catch (e) {
      console.warn("Driver location poll fallback:", e)
    } finally {
      setIsRefreshing(false)
    }
  }, [bookingId])

  // Periodic 60-second (1 min) poll
  useEffect(() => {
    fetchDriverGps()

    const pollInterval = setInterval(() => {
      fetchDriverGps()
    }, 60000)

    return () => {
      clearInterval(pollInterval)
    }
  }, [fetchDriverGps])

  // Dedicated 1-second timer to update "Last sync: X sec ago" ticker
  useEffect(() => {
    const secondTimer = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastSyncTime) / 1000))
    }, 1000)

    return () => {
      clearInterval(secondTimer)
    }
  }, [lastSyncTime])

  // Initialize Leaflet Map with real OpenStreetMap tiles
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return

    const map = L.map(mapContainerRef.current, {
      zoomControl: interactive,
      attributionControl: false,
      scrollWheelZoom: interactive,
      dragging: interactive,
    }).setView(
      [
        (originCoords[0] + actualDestCoords[0]) / 2,
        (originCoords[1] + actualDestCoords[1]) / 2,
      ],
      13,
    )

    mapInstanceRef.current = map

    // Resilient CARTO Voyager Basemap with OpenStreetMap Fallback
    createResilientTileLayer(map)

    // Polyline 1: Completed History Path (soft gray behind car)
    const historyPolyline = L.polyline([], {
      color: "#94a3b8",
      weight: 3.5,
      opacity: 0.5,
      lineCap: "round",
      lineJoin: "round",
    }).addTo(map)
    roadHistoryPolylineRef.current = historyPolyline

    // Polyline 2: Road Outer Casing (Clean white outline for high contrast)
    const casingPolyline = L.polyline([], {
      color: "#ffffff",
      weight: 8,
      opacity: 0.9,
      lineCap: "round",
      lineJoin: "round",
    }).addTo(map)
    roadCasingPolylineRef.current = casingPolyline

    // Polyline 3: Active Road Polyline (Bold saffron on real streets)
    const activePolyline = L.polyline([], {
      color: "#c2611b",
      weight: 4.5,
      opacity: 0.95,
      lineCap: "round",
      lineJoin: "round",
    }).addTo(map)
    roadActivePolylineRef.current = activePolyline

    // Origin Marker (Gosala Pin)
    const originIcon = L.divIcon({
      className: "custom-leaflet-marker",
      html: `
        <div style="background:#2f4f3e; width:34px; height:34px; border-radius:50%; border:2.5px solid white; box-shadow:0 3px 8px rgba(0,0,0,0.3); display:grid; place-items:center; color:white; font-size:14px; font-weight:bold;">
          🏛️
        </div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    })

    L.marker(originCoords, { icon: originIcon })
      .bindPopup(`<b>Pickup Gaushala</b><br/>${pickupLocation}`)
      .addTo(map)

    // Destination Marker (Customer Home Pin)
    const destIcon = L.divIcon({
      className: "custom-leaflet-marker",
      html: `
        <div style="background:#a63a2f; width:34px; height:34px; border-radius:50%; border:2.5px solid white; box-shadow:0 3px 8px rgba(0,0,0,0.3); display:grid; place-items:center; color:white; font-size:14px; font-weight:bold;">
          📍
        </div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    })

    const destMarker = L.marker(actualDestCoords, { icon: destIcon })
      .bindPopup(`<b>Customer Delivery Address</b><br/>${dropLocation}`)
      .addTo(map)
    destMarkerRef.current = destMarker

    // Live Driver Vehicle Marker
    const vehicleIcon = L.divIcon({
      className: "custom-vehicle-marker",
      html: `
        <div id="vehicle-marker-${bookingId}" style="position:relative; width:44px; height:44px; display:grid; place-items:center;">
          <div style="position:absolute; inset:0; border-radius:50%; background:rgba(194,97,27,0.25); animation:ping 1.6s cubic-bezier(0,0,0.2,1) infinite;"></div>
          <div id="vehicle-arrow-${bookingId}" style="width:34px; height:34px; border-radius:50%; background:#c2611b; border:2.5px solid white; box-shadow:0 4px 12px rgba(0,0,0,0.35); display:grid; place-items:center; color:white; transform:rotate(${vehicleBearing}deg); transition:transform 0.4s ease;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
            </svg>
          </div>
        </div>
      `,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    })

    const vehicleMarker = L.marker(vehiclePos, { icon: vehicleIcon })
      .bindPopup(
        `<b>Live Driver: ${driverName}</b><br/>Speed: ${vehicleSpeed} km/h<br/>Road-matched live`,
      )
      .addTo(map)
    vehicleMarkerRef.current = vehicleMarker

    // Pillar 4: Initialize Smooth 60 FPS Gliding Animator
    vehicleAnimatorRef.current = new VehicleMarkerAnimator(
      vehicleMarker,
      `vehicle-arrow-${bookingId}`,
    )

    // Initial bounds fit
    const bounds = L.latLngBounds([originCoords, actualDestCoords])
    map.fitBounds(bounds, { padding: [50, 50] })

    return () => {
      vehicleAnimatorRef.current?.destroy()
      vehicleAnimatorRef.current = null
      map.remove()
      mapInstanceRef.current = null
    }
  }, [bookingId, pickupLocation, dropLocation, originCoords, actualDestCoords])

  // Update destination marker position if actualDestCoords changes
  useEffect(() => {
    if (destMarkerRef.current) {
      destMarkerRef.current.setLatLng(actualDestCoords)
    }
  }, [actualDestCoords])

  // Update polylines and vehicle marker smoothly whenever route or position changes
  useEffect(() => {
    if (!mapInstanceRef.current) return

    // Pillar 4: Smooth 60 FPS Dead-Reckoning Gliding Animation
    if (vehicleAnimatorRef.current) {
      vehicleAnimatorRef.current.animateTo(vehiclePos, vehicleBearing, {
        durationMs: isEnRoute ? 1200 : 400,
      })
    } else if (vehicleMarkerRef.current) {
      vehicleMarkerRef.current.setLatLng(vehiclePos)
    }

    // Pillar 3: Update Dual-Stroke Polylines with exact road geometry
    if (roadRoute && roadRoute.coordinates.length > 1) {
      if (isEnRoute) {
        if (roadHistoryPolylineRef.current) {
          roadHistoryPolylineRef.current.setLatLngs(snapResult.traveledCoords)
        }
        if (roadCasingPolylineRef.current) {
          roadCasingPolylineRef.current.setLatLngs(snapResult.remainingCoords)
        }
        if (roadActivePolylineRef.current) {
          roadActivePolylineRef.current.setLatLngs(snapResult.remainingCoords)
        }
      } else if (stageIndex >= 5) {
        if (roadHistoryPolylineRef.current) {
          roadHistoryPolylineRef.current.setLatLngs(roadRoute.coordinates)
        }
        if (roadCasingPolylineRef.current)
          roadCasingPolylineRef.current.setLatLngs([])
        if (roadActivePolylineRef.current)
          roadActivePolylineRef.current.setLatLngs([])
      } else {
        if (roadHistoryPolylineRef.current)
          roadHistoryPolylineRef.current.setLatLngs([])
        if (roadCasingPolylineRef.current) {
          roadCasingPolylineRef.current.setLatLngs(roadRoute.coordinates)
        }
        if (roadActivePolylineRef.current) {
          roadActivePolylineRef.current.setLatLngs(roadRoute.coordinates)
        }
      }
    }
  }, [
    vehiclePos,
    vehicleBearing,
    roadRoute,
    snapResult,
    isEnRoute,
    stageIndex,
    bookingId,
  ])

  // Helper to re-center map around the active user/trip
  const handleRecenter = () => {
    if (!mapInstanceRef.current) return
    const target =
      viewerRole === "DRIVER" || viewerRole === "MANAGER"
        ? vehiclePos
        : actualDestCoords
    mapInstanceRef.current.setView(target, 15, { animate: true })
  }

  return (
    <div
      className={`relative isolate ${heightClass} w-full rounded-sm overflow-hidden border border-line shadow-sm select-none`}
    >
      {/* Real Interactive Leaflet OpenStreetMap Container */}
      <div
        ref={mapContainerRef}
        className="absolute inset-0 h-full w-full z-0"
      />

      {/* Top Floating HUD: Real-time 1-Minute GPS Sync & Road Status */}
      <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between pointer-events-none">
        {/* Sync Status Badge */}
        <div className="inline-flex items-center gap-2 bg-white/95 backdrop-blur-md rounded-full px-3 py-1.5 border border-line text-ink shadow-md pointer-events-auto">
          <span className="relative flex h-2 w-2">
            <span
              className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isConnected ? "bg-ok animate-ping" : "bg-warn"
              }`}
            />
            <span
              className={`relative inline-flex h-2 w-2 rounded-full ${
                isConnected ? "bg-ok" : "bg-warn"
              }`}
            />
          </span>
          <span className="font-mono text-[11px] font-semibold text-ink">
            {isConnected ? "Live GPS Connected" : "Connecting GPS..."}
          </span>
          <span className="bg-saffron-soft text-saffron-deep px-1.5 py-0.5 rounded text-[9.5px] font-mono font-medium">
            1-MIN SYNC
          </span>
          <span className="text-[10px] font-mono text-ink-faint">
            {secondsAgo < 5 ? "Just now" : `${secondsAgo}s ago`}
          </span>
        </div>

        {/* Speedometer, Compass, Recenter, and Refresh Button */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          {isEnRoute && (
            <div className="bg-white/95 backdrop-blur-md rounded-sm px-2 py-1 border border-line text-ink flex items-center gap-1 shadow-md">
              <Gauge size={12} className="text-saffron" />
              <span className="font-mono text-[11px] font-bold tabular-nums">
                {vehicleSpeed}{" "}
                <span className="text-[8.5px] font-normal text-ink-faint">
                  km/h
                </span>
              </span>
            </div>
          )}

          <div className="bg-white/95 backdrop-blur-md rounded-sm px-2 py-1 border border-line text-ink flex items-center gap-1 shadow-md">
            <Compass size={12} className="text-forest" />
            <span className="font-mono text-[11px] font-medium tabular-nums">
              {Math.round(vehicleBearing)}°
            </span>
          </div>

          <button
            onClick={handleRecenter}
            title="Recenter on My Location"
            className="h-7 w-7 rounded-sm bg-white/95 backdrop-blur-md border border-line grid place-items-center text-ink-soft hover:text-ink shadow-md pointer-events-auto transition-colors cursor-pointer"
          >
            <Crosshair size={13} className="text-forest" />
          </button>

          <button
            onClick={fetchDriverGps}
            disabled={isRefreshing}
            title="Fetch Fresh Driver Location"
            className="h-7 w-7 rounded-sm bg-white/95 backdrop-blur-md border border-line grid place-items-center text-ink-soft hover:text-ink shadow-md pointer-events-auto transition-colors cursor-pointer"
          >
            <RefreshCw
              size={13}
              className={isRefreshing ? "animate-spin text-saffron" : ""}
            />
          </button>
        </div>
      </div>

      {/* Road Network Badge: Indicates OSRM Road Graph Active */}
      <div className="absolute top-14 left-3 z-20 pointer-events-none">
        <div className="inline-flex items-center gap-1.5 bg-paper-deep/90 backdrop-blur-md border border-line rounded px-2 py-0.5 text-[10px] font-mono text-ink-soft shadow-sm">
          <Milestone size={11} className="text-saffron-deep" />
          <span>
            {isLoadingRoute
              ? "Connecting road network..."
              : roadRoute?.summary
                ? `Via ${roadRoute.summary}`
                : "City Transit Corridors"}
          </span>
        </div>
      </div>

      {/* Bottom Floating Card: Clean Route & Dynamic ETA along Real Roads */}
      <div className="absolute bottom-3 left-3 right-3 z-20 bg-white/95 backdrop-blur-md rounded-sm border border-line p-3 text-ink flex items-center justify-between shadow-xl">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 rounded-full bg-saffron-soft border border-saffron/30 grid place-items-center text-saffron shrink-0">
            <Navigation size={15} />
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-medium text-ink truncate flex items-center gap-1.5">
              <span className="font-semibold">{pickupLocation}</span>
              <span className="text-ink-faint">→</span>
              <span className="text-ink-soft truncate">{dropLocation}</span>
            </div>
            <div className="text-[11px] text-ink-faint flex items-center gap-2 mt-0.5 font-mono">
              <span>Driver: {driverName}</span>
              {roadDistanceRemainingKm > 0 && (
                <>
                  <span className="text-ink-faint/40">·</span>
                  <span className="text-saffron-deep font-semibold">
                    {roadDistanceRemainingKm} km road drive
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Dynamic Road ETA */}
        {isEnRoute && etaMinutes > 0 ? (
          <div className="text-right shrink-0 pl-2">
            <div className="inline-flex items-center gap-1 text-ok font-mono text-[13.5px] font-bold tabular-nums">
              <Clock size={13} />
              <span>~{etaMinutes} min</span>
            </div>
            <div className="text-[9.5px] text-ink-faint uppercase font-mono tracking-wider">
              Est. Road ETA
            </div>
          </div>
        ) : stageIndex >= 5 ? (
          <span className="inline-flex items-center gap-1 text-ok bg-ok-soft border border-ok/30 px-2 py-1 rounded text-[11.5px] font-medium">
            Arrived at Destination
          </span>
        ) : (
          <div className="text-right shrink-0 pl-2">
            <div className="text-[12px] font-mono text-ink font-semibold">
              ~{etaMinutes} min trip
            </div>
            <div className="text-[9.5px] text-ink-faint uppercase font-mono tracking-wider">
              {totalRoadDistanceKm} km road
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
