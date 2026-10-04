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
export function getRegionalLocalityFromCoords(lat: number, lng: number): string {
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
      lat: 17.4401,
      lng: 78.3489,
      accuracy: 50,
      speed: null,
      heading: null,
      address: "Kothaguda, Hyderabad, Telangana",
      city: "Hyderabad",
      state: "Telangana",
      error: null,
      isLoading: false,
      hasPermission: false,
      permissionStatus:
        typeof navigator !== "undefined" && navigator.geolocation
          ? "prompt"
          : "unsupported",
      source: "OFFLINE_CENTROID",
    }
  })

  const [isWatching, setIsWatching] = useState(false)
  const watchIdRef = useRef<number | null>(null)

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
        }>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              if (
                pos?.coords &&
                typeof pos.coords.latitude === "number" &&
                !isNaN(pos.coords.latitude)
              ) {
                resolve({
                  lat: pos.coords.latitude,
                  lng: pos.coords.longitude,
                  accuracy: pos.coords.accuracy,
                })
              } else {
                reject(new Error("Invalid coordinates returned by browser GPS"))
              }
            },
            (err) => reject(err),
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
          )
        })

        // Reverse geocode high-accuracy coordinates
        const geoInfo = await reverseGeocodeCoords(
          gpsResult.lat,
          gpsResult.lng,
        )

        const newState: GeoLocationState = {
          lat: Number(gpsResult.lat.toFixed(5)),
          lng: Number(gpsResult.lng.toFixed(5)),
          accuracy: gpsResult.accuracy,
          speed: null,
          heading: null,
          address: geoInfo.address,
          city: geoInfo.city,
          state: geoInfo.state,
          error: null,
          isLoading: false,
          hasPermission: true,
          permissionStatus: "granted",
          source: "GPS_HARDWARE",
        }

        setState(newState)
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newState))
        } catch {}

        return {
          lat: newState.lat!,
          lng: newState.lng!,
          address: newState.address!,
          city: newState.city!,
          state: newState.state!,
        }
      } catch (err: any) {
        console.warn("Browser GPS prompt declined or failed, trying IP fallback...", err)
      }
    }

    // 2. Fallback to IP Geolocation
    const ipResult = await getIpLocationFallback()
    if (ipResult) {
      const newState: GeoLocationState = {
        lat: Number(ipResult.lat.toFixed(5)),
        lng: Number(ipResult.lng.toFixed(5)),
        accuracy: 5000,
        speed: null,
        heading: null,
        address: ipResult.address,
        city: ipResult.city,
        state: ipResult.state,
        error: null,
        isLoading: false,
        hasPermission: false,
        permissionStatus: "prompt",
        source: "IP_FALLBACK",
      }

      setState(newState)
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newState))
      } catch {}

      return {
        lat: newState.lat!,
        lng: newState.lng!,
        address: newState.address!,
        city: newState.city!,
        state: newState.state!,
      }
    }

    // 3. Last Fallback: Indian Hub Centroid
    const fallbackHub = INDIAN_REGIONAL_HUBS[0]
    const fallbackState: GeoLocationState = {
      lat: fallbackHub.lat,
      lng: fallbackHub.lng,
      accuracy: 10000,
      speed: null,
      heading: null,
      address: `${fallbackHub.name}, ${fallbackHub.city}, ${fallbackHub.state}`,
      city: fallbackHub.city,
      state: fallbackHub.state,
      error: null,
      isLoading: false,
      hasPermission: false,
      permissionStatus: "prompt",
      source: "OFFLINE_CENTROID",
    }
    setState(fallbackState)
    return {
      lat: fallbackState.lat!,
      lng: fallbackState.lng!,
      address: fallbackState.address!,
      city: fallbackState.city!,
      state: fallbackState.state!,
    }
  }, [])

  // Check initial permission status and auto-query if granted or silently fetch IP
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

          if (perm.state === "granted") {
            requestLocation()
          } else {
            getIpLocationFallback().then((ipLoc) => {
              if (ipLoc) {
                setState((s) => {
                  if (s.hasPermission) return s
                  return {
                    ...s,
                    lat: ipLoc.lat,
                    lng: ipLoc.lng,
                    city: ipLoc.city,
                    state: ipLoc.state,
                    address: ipLoc.address,
                    source: "IP_FALLBACK",
                  }
                })
              }
            }).catch(() => {})
          }

          perm.onchange = () => {
            setState((s) => ({
              ...s,
              permissionStatus: perm.state as "prompt" | "granted" | "denied",
              hasPermission: perm.state === "granted",
            }))
            if (perm.state === "granted") {
              requestLocation()
            }
          }
        })
        .catch(() => {})
    } else {
      getIpLocationFallback().then((ipLoc) => {
        if (ipLoc) {
          setState((s) => {
            if (s.hasPermission) return s
            return {
              ...s,
              lat: ipLoc.lat,
              lng: ipLoc.lng,
              city: ipLoc.city,
              state: ipLoc.state,
              address: ipLoc.address,
              source: "IP_FALLBACK",
            }
          })
        }
      }).catch(() => {})
    }
  }, [requestLocation])


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
