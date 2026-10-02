import { useState, useCallback, useRef, useEffect } from "react"
import {
  findNearestIndianHub,
  getIndianLocalityFallback,
  INDIAN_REGIONAL_HUBS,
} from "../data/regions.ts"

export interface GeoLocationState {
  lat: number | null
  lng: number | null
  accuracy: number | null
  speed: number | null
  heading: number | null
  address: string | null
  city: string | null
  state: string | null
  error: string | null
  isLoading: boolean
  hasPermission: boolean
  permissionStatus: "prompt" | "granted" | "denied" | "unsupported"
  source?: "GPS_HARDWARE" | "IP_FALLBACK" | "OFFLINE_CENTROID" | "USER_MANUAL"
}

// Map approximate Indian localities from coordinates as instant offline fallback
export function getIndianLocalityFromCoords(lat: number, lng: number): string {
  return getIndianLocalityFallback(lat, lng)
}

// Backward-compatible alias for existing code
export function getPuneLocalityFromCoords(lat: number, lng: number): string {
  return getIndianLocalityFallback(lat, lng)
}

// In-memory cache for reverse geocoding to avoid rate-limiting (OSM Nominatim policy)
const geocodeCache = new Map<string, { address: string; city: string; state: string }>()

function getCacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(3)},${lng.toFixed(3)}`
}

// Reverse geocode exact physical street address using OpenStreetMap Nominatim
export async function reverseGeocodeCoords(
  lat: number,
  lng: number,
): Promise<{ address: string; city: string; state: string }> {
  const key = getCacheKey(lat, lng)
  if (geocodeCache.has(key)) {
    return geocodeCache.get(key)!
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 4000)

    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
      {
        headers: {
          "Accept-Language": "en",
          "User-Agent": "GOMAA-GauSeva-App/1.0",
        },
        signal: controller.signal,
      },
    )
    clearTimeout(timeout)

    if (res.ok) {
      const data = await res.json()
      if (data.address) {
        const a = data.address
        const street =
          a.road || a.pedestrian || a.suburb || a.neighbourhood || ""
        const locality =
          a.suburb || a.neighbourhood || a.residential || a.city_district || ""
        const city =
          a.city ||
          a.town ||
          a.village ||
          a.county ||
          a.state_district ||
          findNearestIndianHub(lat, lng).hub.city
        const state = a.state || findNearestIndianHub(lat, lng).hub.state
        const pincode = a.postcode ? ` - ${a.postcode}` : ""

        const parts = [
          street,
          locality && locality !== street ? locality : "",
          city,
          state + pincode,
        ].filter(Boolean)

        if (parts.length > 0) {
          const resObj = {
            address: parts.join(", "),
            city,
            state,
          }
          geocodeCache.set(key, resObj)
          if (geocodeCache.size > 200) {
            const first = geocodeCache.keys().next().value
            if (first) geocodeCache.delete(first)
          }
          return resObj
        }
      }
      if (data.display_name) {
        const segments = data.display_name
          .split(",")
          .slice(0, 3)
          .map((s: string) => s.trim())
        const nearest = findNearestIndianHub(lat, lng)
        const resObj = {
          address: segments.join(", "),
          city: nearest.hub.city,
          state: nearest.hub.state,
        }
        geocodeCache.set(key, resObj)
        return resObj
      }
    }
  } catch (err) {
    console.warn("Reverse geocode fetch fallback:", err)
  }

  const nearest = findNearestIndianHub(lat, lng)
  return {
    address: getIndianLocalityFallback(lat, lng),
    city: nearest.hub.city,
    state: nearest.hub.state,
  }
}

// Zero-Key IP Geolocation Fallback
export async function getIpLocationFallback(): Promise<{
  lat: number
  lng: number
  city: string
  state: string
  address: string
} | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 4000)

    const res = await fetch("https://ipwho.is/", {
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (res.ok) {
      const data = await res.json()
      if (data.success && data.latitude && data.longitude) {
        const lat = data.latitude
        const lng = data.longitude
        const city = data.city || "Hyderabad"
        const state = data.region || "Telangana"
        const address = `${city}, ${state}, India`
        return { lat, lng, city, state, address }
      }
    }
  } catch (err) {
    // Secondary fallback
    try {
      const res2 = await fetch("https://freeipapi.com/api/json")
      if (res2.ok) {
        const data2 = await res2.json()
        if (data2.latitude && data2.longitude) {
          return {
            lat: data2.latitude,
            lng: data2.longitude,
            city: data2.cityName || "Hyderabad",
            state: data2.regionName || "Telangana",
            address: `${data2.cityName}, ${data2.regionName}, India`,
          }
        }
      }
    } catch (e) {
      console.warn("IP Geolocation fallbacks failed:", e)
    }
  }

  return null
}

// Forward geocode address string to exact [lat, lng] using OpenStreetMap Nominatim
export async function geocodeAddress(
  address: string,
): Promise<[number, number] | null> {
  if (!address || address.trim().length === 0) return null
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 4000)

    const query = address.includes("India")
      ? address
      : `${address}, India`
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(query)}&limit=1`
    const res = await fetch(url, {
      headers: {
        "Accept-Language": "en",
        "User-Agent": "GOMAA-GauSeva-App/1.0",
      },
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (res.ok) {
      const results = await res.json()
      if (results && results.length > 0 && results[0].lat && results[0].lon) {
        return [parseFloat(results[0].lat), parseFloat(results[0].lon)]
      }
    }
  } catch (err) {
    console.warn("Forward geocode search fallback:", err)
  }
  return null
}

const STORAGE_KEY = "gomaa_device_location"

export function useDeviceLocation() {
  const [state, setState] = useState<GeoLocationState>(() => {
    // Restore from localStorage if previously permitted or set
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        return {
          lat: parsed.lat || null,
          lng: parsed.lng || null,
          accuracy: parsed.accuracy || null,
          speed: null,
          heading: null,
          address: parsed.address || null,
          city: parsed.city || null,
          state: parsed.state || null,
          error: null,
          isLoading: false,
          hasPermission: parsed.source === "GPS_HARDWARE" || parsed.source === "USER_MANUAL",
          permissionStatus:
            parsed.source === "GPS_HARDWARE" ? "granted" : "prompt",
          source: parsed.source || "OFFLINE_CENTROID",
        }
      }
    } catch (e) {
      // ignore
    }

    return {
      lat: null,
      lng: null,
      accuracy: null,
      speed: null,
      heading: null,
      address: null,
      city: null,
      state: null,
      error: null,
      isLoading: false,
      hasPermission: false,
      permissionStatus:
        typeof navigator !== "undefined" && navigator.geolocation
          ? "prompt"
          : "unsupported",
    }
  })

  const [isWatching, setIsWatching] = useState(false)
  const watchIdRef = useRef<number | null>(null)

  // Check initial permission status if available
  useEffect(() => {
    if (typeof navigator !== "undefined" && "permissions" in navigator) {
      navigator.permissions
        .query({ name: "geolocation" as PermissionName })
        .then((perm) => {
          setState((s) => ({
            ...s,
            permissionStatus: perm.state as "prompt" | "granted" | "denied",
            hasPermission: perm.state === "granted",
          }))

          perm.onchange = () => {
            setState((s) => ({
              ...s,
              permissionStatus: perm.state as "prompt" | "granted" | "denied",
              hasPermission: perm.state === "granted",
            }))
          }
        })
        .catch(() => {})
    }
  }, [])

  // Explicit user-gesture or auto request function
  const requestLocation = useCallback(async (): Promise<{
    lat: number
    lng: number
    address: string
    city: string
    state: string
  } | null> => {
    setState((s) => ({ ...s, isLoading: true, error: null }))

    // 1. Try Browser HTML5 Geolocation
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      try {
        const gpsResult = await new Promise<{
          lat: number
          lng: number
          accuracy: number
        } | null>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              resolve({
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                accuracy: pos.coords.accuracy,
              })
            },
            () => resolve(null),
            {
              enableHighAccuracy: true,
              timeout: 6000,
              maximumAge: 60000,
            },
          )
        })

        if (gpsResult) {
          const { address, city, state: stateName } =
            await reverseGeocodeCoords(gpsResult.lat, gpsResult.lng)

          const updated: GeoLocationState = {
            lat: gpsResult.lat,
            lng: gpsResult.lng,
            accuracy: gpsResult.accuracy,
            speed: null,
            heading: null,
            address,
            city,
            state: stateName,
            error: null,
            isLoading: false,
            hasPermission: true,
            permissionStatus: "granted",
            source: "GPS_HARDWARE",
          }

          try {
            localStorage.setItem(
              STORAGE_KEY,
              JSON.stringify({
                lat: gpsResult.lat,
                lng: gpsResult.lng,
                address,
                city,
                state: stateName,
                accuracy: gpsResult.accuracy,
                source: "GPS_HARDWARE",
              }),
            )
          } catch (e) {}

          setState(updated)
          return {
            lat: gpsResult.lat,
            lng: gpsResult.lng,
            address,
            city,
            state: stateName,
          }
        }
      } catch (e) {
        console.warn("GPS lookup error:", e)
      }
    }

    // 2. Fallback to Zero-Key IP Geolocation
    const ipResult = await getIpLocationFallback()
    if (ipResult) {
      const updated: GeoLocationState = {
        lat: ipResult.lat,
        lng: ipResult.lng,
        accuracy: 10000,
        speed: null,
        heading: null,
        address: ipResult.address,
        city: ipResult.city,
        state: ipResult.state,
        error: "Approximate city detected via network (±10km). Enable device GPS or pinpoint on map for exact doorstep delivery.",
        isLoading: false,
        hasPermission: false,
        permissionStatus: state.permissionStatus === "denied" ? "denied" : "prompt",
        source: "IP_FALLBACK",
      }

      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            lat: ipResult.lat,
            lng: ipResult.lng,
            address: ipResult.address,
            city: ipResult.city,
            state: ipResult.state,
            source: "IP_FALLBACK",
          }),
        )
      } catch (e) {}

      setState(updated)
      return ipResult
    }

    // 3. Fallback to nearest major Vedic/metropolitan hub (Default: Hyderabad Central)
    const defaultHub = INDIAN_REGIONAL_HUBS[0] // Hyderabad Central
    const fallbackAddress = `${defaultHub.name}, ${defaultHub.city}, ${defaultHub.state}`
    const fallbackState: GeoLocationState = {
      lat: defaultHub.lat,
      lng: defaultHub.lng,
      accuracy: null,
      speed: null,
      heading: null,
      address: fallbackAddress,
      city: defaultHub.city,
      state: defaultHub.state,
      error: "Location access not permitted; using regional Vedic hub.",
      isLoading: false,
      hasPermission: false,
      permissionStatus: "denied",
      source: "OFFLINE_CENTROID",
    }

    setState(fallbackState)
    return {
      lat: defaultHub.lat,
      lng: defaultHub.lng,
      address: fallbackAddress,
      city: defaultHub.city,
      state: defaultHub.state,
    }
  }, [])

  // Manual city/region override
  const setManualLocation = useCallback(
    (hub: {
      name: string
      city: string
      state: string
      lat: number
      lng: number
    }) => {
      const address = `${hub.name}, ${hub.city}, ${hub.state}`
      const updated: GeoLocationState = {
        lat: hub.lat,
        lng: hub.lng,
        accuracy: null,
        speed: null,
        heading: null,
        address,
        city: hub.city,
        state: hub.state,
        error: null,
        isLoading: false,
        hasPermission: true,
        permissionStatus: "granted",
        source: "USER_MANUAL",
      }
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            lat: hub.lat,
            lng: hub.lng,
            address,
            city: hub.city,
            state: hub.state,
            source: "USER_MANUAL",
          }),
        )
      } catch (e) {}
      setState(updated)
    },
    [],
  )

  // Start continuous watch (e.g. for Driver Companion)
  const startWatching = useCallback(
    (onLocationUpdate?: (pos: GeolocationPosition) => void) => {
      if (!navigator.geolocation || watchIdRef.current !== null) return

      setIsWatching(true)
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const lat = pos.coords.latitude
          const lng = pos.coords.longitude
          const heading = pos.coords.heading
          const speed = pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : null

          setState((prev) => ({
            ...prev,
            lat,
            lng,
            accuracy: pos.coords.accuracy,
            heading,
            speed,
            hasPermission: true,
            permissionStatus: "granted",
          }))

          if (onLocationUpdate) {
            onLocationUpdate(pos)
          }
        },
        (err) => {
          console.warn("Geolocation watch error:", err.message)
        },
        {
          enableHighAccuracy: true,
          maximumAge: 1000,
          timeout: 10000,
        },
      )
    },
    [],
  )

  // Stop continuous watch
  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    setIsWatching(false)
  }, [])

  // Auto-detect on initial mount if not yet detected
  useEffect(() => {
    if (!state.lat && !state.lng && !state.isLoading) {
      requestLocation().catch(() => {})
    }
  }, [state.lat, state.lng, state.isLoading, requestLocation])

  return {
    ...state,
    isWatching,
    requestLocation,
    setManualLocation,
    startWatching,
    stopWatching,
  }
}
