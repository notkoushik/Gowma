/**
 * Google Places & Google Maps Resolution Service
 * 
 * Provides:
 * 1. Live Google Places API Search (if GOOGLE_MAPS_API_KEY is configured)
 * 2. Zero-Key Google Maps URL Resolver (expands maps.app.goo.gl and extracts place name + coordinates)
 * 3. Coordinate parser (decimal degrees and DMS from Google Maps copy/paste)
 */

import { findNearestOperationalHub } from "./hubService.ts"

export interface ResolvedGooglePlace {
  id: string
  name: string
  address: string
  city: string
  state: string
  lat: number
  lng: number
  source: "google_places_api" | "google_maps_link" | "coordinates"
  hubId?: string
  hubName?: string
  suggestedRegion?: string
}

/**
 * Extracts coordinates from any Google Maps URL format:
 * - @lat,lng,zoom
 * - !3dlat!4dlng
 * - ?q=lat,lng or &query=lat,lng
 * - ?ll=lat,lng
 */
export function extractCoordsFromGoogleUrl(url: string): { lat: number; lng: number } | null {
  if (!url) return null

  // 1. @lat,lng
  const atMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
  if (atMatch) {
    const lat = parseFloat(atMatch[1])
    const lng = parseFloat(atMatch[2])
    if (isValidLatLong(lat, lng)) return { lat, lng }
  }

  // 2. !3dlat!4dlng (Google Maps protobuf query payload)
  const protoMatch = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/)
  if (protoMatch) {
    const lat = parseFloat(protoMatch[1])
    const lng = parseFloat(protoMatch[2])
    if (isValidLatLong(lat, lng)) return { lat, lng }
  }

  // 3. q=lat,lng or query=lat,lng
  const qMatch = url.match(/[?&](?:q|query)=(-?\d+\.\d+),(-?\d+\.\d+)/)
  if (qMatch) {
    const lat = parseFloat(qMatch[1])
    const lng = parseFloat(qMatch[2])
    if (isValidLatLong(lat, lng)) return { lat, lng }
  }

  // 4. ll=lat,lng
  const llMatch = url.match(/[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/)
  if (llMatch) {
    const lat = parseFloat(llMatch[1])
    const lng = parseFloat(llMatch[2])
    if (isValidLatLong(lat, lng)) return { lat, lng }
  }

  return null
}

/**
 * Extracts place name from Google Maps URL /place/Name+Here/
 */
export function extractPlaceNameFromGoogleUrl(url: string): string | null {
  if (!url) return null
  const placeMatch = url.match(/\/place\/([^/@?]+)/)
  if (placeMatch && placeMatch[1]) {
    try {
      const decoded = decodeURIComponent(placeMatch[1].replace(/\+/g, " "))
      if (decoded.trim().length > 0) return decoded.trim()
    } catch {}
  }
  return null
}

/**
 * Extracts decimal coordinates from direct raw input: "18.5204, 73.8567"
 */
export function parseRawCoordinates(input: string): { lat: number; lng: number } | null {
  if (!input) return null
  const trimmed = input.trim()

  // Format: "18.52043, 73.85672" or "18.52043 73.85672"
  const decMatch = trimmed.match(/^(-?\d{1,2}(?:\.\d+)?)[,\s]+(-?\d{1,3}(?:\.\d+)?)$/)
  if (decMatch) {
    const lat = parseFloat(decMatch[1])
    const lng = parseFloat(decMatch[2])
    if (isValidLatLong(lat, lng)) return { lat, lng }
  }

  // DMS format: 18°31'13.4"N 73°51'24.1"E
  const dmsRegex = /(\d+)[°\s]+(\d+)['\s]+([\d.]+)?["\s]*([NSEW])/gi
  const matches = [...trimmed.matchAll(dmsRegex)]
  if (matches.length === 2) {
    const convertDms = (deg: string, min: string, sec: string | undefined, dir: string) => {
      let val = parseFloat(deg) + parseFloat(min) / 60 + (sec ? parseFloat(sec) / 3600 : 0)
      if (dir.toUpperCase() === "S" || dir.toUpperCase() === "W") val = -val
      return val
    }
    const lat = convertDms(matches[0][1], matches[0][2], matches[0][3], matches[0][4])
    const lng = convertDms(matches[1][1], matches[1][2], matches[1][3], matches[1][4])
    if (isValidLatLong(lat, lng)) return { lat, lng }
  }

  return null
}

function isValidLatLong(lat: number, lng: number): boolean {
  return !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
}

/**
 * Expands shortened Google Maps links (e.g. https://maps.app.goo.gl/xxx or https://goo.gl/maps/xxx)
 */
export async function expandGoogleShortUrl(shortUrl: string): Promise<string> {
  try {
    const res = await fetch(shortUrl, {
      method: "HEAD",
      redirect: "manual",
      signal: AbortSignal.timeout(4000),
    })

    const loc = res.headers.get("location")
    if (loc) {
      if (loc.includes("maps.app.goo.gl") || loc.includes("goo.gl/maps")) {
        return expandGoogleShortUrl(loc)
      }
      return loc
    }
    return shortUrl
  } catch (err) {
    return shortUrl
  }
}

/**
 * Resolves a Google Maps URL or raw coordinates into a fully structured Gaushala premise.
 */
export async function resolveGoogleMapsLinkOrCoords(input: string): Promise<ResolvedGooglePlace | null> {
  const cleanInput = (input || "").trim()
  if (!cleanInput) return null

  // Case 1: Raw coordinates entered
  const directCoords = parseRawCoordinates(cleanInput)
  if (directCoords) {
    const nearest = findNearestOperationalHub(directCoords.lat, directCoords.lng)
    return {
      id: `coord-${directCoords.lat.toFixed(4)}-${directCoords.lng.toFixed(4)}`,
      name: `Gaushala Premise (${directCoords.lat.toFixed(4)}, ${directCoords.lng.toFixed(4)})`,
      address: `Coordinates: ${directCoords.lat.toFixed(5)}, ${directCoords.lng.toFixed(5)} near ${nearest.hub.city}, ${nearest.hub.state}`,
      city: nearest.hub.city,
      state: nearest.hub.state,
      lat: directCoords.lat,
      lng: directCoords.lng,
      source: "coordinates",
      hubId: nearest.hub.id,
      hubName: nearest.hub.name,
      suggestedRegion: `${nearest.hub.name} (${nearest.hub.city}, ${nearest.hub.state})`,
    }
  }

  // Case 2: Google Maps URL
  if (
    cleanInput.includes("google.com/maps") ||
    cleanInput.includes("maps.app.goo.gl") ||
    cleanInput.includes("goo.gl/maps") ||
    cleanInput.startsWith("http")
  ) {
    let targetUrl = cleanInput
    if (cleanInput.includes("maps.app.goo.gl") || cleanInput.includes("goo.gl/maps")) {
      targetUrl = await expandGoogleShortUrl(cleanInput)
    }

    const coords = extractCoordsFromGoogleUrl(targetUrl)
    const placeName = extractPlaceNameFromGoogleUrl(targetUrl)

    if (coords) {
      const nearest = findNearestOperationalHub(coords.lat, coords.lng)
      const name = placeName || "Custom Gaushala from Google Maps"
      const address = placeName
        ? `${placeName}, ${nearest.hub.city}, ${nearest.hub.state}`
        : `Google Maps Pin: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)} (${nearest.hub.city}, ${nearest.hub.state})`

      return {
        id: `gmaps-${coords.lat.toFixed(4)}-${coords.lng.toFixed(4)}`,
        name,
        address,
        city: nearest.hub.city,
        state: nearest.hub.state,
        lat: coords.lat,
        lng: coords.lng,
        source: "google_maps_link",
        hubId: nearest.hub.id,
        hubName: nearest.hub.name,
        suggestedRegion: `${nearest.hub.name} (${nearest.hub.city}, ${nearest.hub.state})`,
      }
    }
  }

  return null
}

/**
 * Searches Google Places API (Text Search) if GOOGLE_MAPS_API_KEY is configured.
 */
export async function searchGooglePlacesApi(
  query: string,
  apiKey?: string,
): Promise<ResolvedGooglePlace[]> {
  const key = apiKey || process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY
  if (!key) {
    return []
  }

  const cleanQuery = query.trim()
  if (!cleanQuery) return []

  try {
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
      cleanQuery,
    )}&region=in&key=${key}`

    const res = await fetch(url, { signal: AbortSignal.timeout(4000) })
    if (!res.ok) return []

    const data = await res.json()
    if (!Array.isArray(data.results)) return []

    return data.results.slice(0, 5).map((p: any) => {
      const lat = p.geometry?.location?.lat || 17.4156
      const lng = p.geometry?.location?.lng || 78.4358
      const nearest = findNearestOperationalHub(lat, lng)

      return {
        id: `gplaces-${p.place_id}`,
        name: p.name,
        address: p.formatted_address || `${p.name}, India`,
        city: nearest.hub.city,
        state: nearest.hub.state,
        lat,
        lng,
        source: "google_places_api",
        hubId: nearest.hub.id,
        hubName: nearest.hub.name,
        suggestedRegion: `${nearest.hub.name} (${nearest.hub.city}, ${nearest.hub.state})`,
      }
    })
  } catch (err) {
    console.warn("Google Places API search failed:", err)
    return []
  }
}
