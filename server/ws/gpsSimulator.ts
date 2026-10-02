import { wsHub } from "./hub.ts"
import type { GpsTickPayload } from "./types.ts"

type Point = { lat: number; lng: number }

const GOSALA_COORDS: Record<string, Point> = {
  "Shri Krishna Gaushala": { lat: 18.5074, lng: 73.8077 }, // Kothrud / Paud Road
  "Nandini Goseva Sadan": { lat: 18.559, lng: 73.7868 }, // Baner
  "Gopal Gaushala Trust": { lat: 18.5482, lng: 73.9034 }, // Kalyani Nagar
  "Vrindavan Goshala": { lat: 18.4967, lng: 73.9417 }, // Hadapsar
  "Kamdhenu Seva Kendra": { lat: 18.5987, lng: 73.7628 }, // Wakad
}

function calculateBearing(p1: Point, p2: Point): number {
  const rad = Math.PI / 180
  const lat1 = p1.lat * rad
  const lat2 = p2.lat * rad
  const dLng = (p2.lng - p1.lng) * rad

  const y = Math.sin(dLng) * Math.cos(lat2)
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)
  let brng = Math.atan2(y, x) / rad
  return Math.round((brng + 360) % 360)
}

function generateFallbackWaypoints(
  start: Point,
  end: Point,
  count = 25,
): Point[] {
  const points: Point[] = []
  for (let i = 0; i <= count; i++) {
    const t = i / count
    points.push({
      lat: start.lat + (end.lat - start.lat) * t,
      lng: start.lng + (end.lng - start.lng) * t,
    })
  }
  return points
}

async function fetchRealRoadWaypoints(
  start: Point,
  end: Point,
): Promise<Point[]> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 4000)
    const url = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timeout)

    if (res.ok) {
      const data = await res.json()
      if (
        data.code === "Ok" &&
        data.routes?.[0]?.geometry?.coordinates?.length > 1
      ) {
        const coords: [number, number][] = data.routes[0].geometry.coordinates
        // Sample to ~30 distinct road waypoints along real streets
        const step = Math.max(1, Math.floor(coords.length / 30))
        const sampled: Point[] = []
        for (let i = 0; i < coords.length; i += step) {
          sampled.push({ lat: coords[i][1], lng: coords[i][0] })
        }
        const last = coords[coords.length - 1]
        sampled.push({ lat: last[1], lng: last[0] })
        return sampled
      }
    }
  } catch (err) {
    console.warn("OSRM simulator fetch fallback:", err)
  }
  return generateFallbackWaypoints(start, end, 25)
}

class GpsSimulatorManager {
  private activeSimulations = new Map<string, NodeJS.Timeout>()
  private onTickListener?: (tick: GpsTickPayload) => void

  setOnTick(cb: (tick: GpsTickPayload) => void) {
    this.onTickListener = cb
  }

  async startSimulation(
    bookingId: string,
    gosalaName: string,
    destinationAddress: string,
    totalDistanceKm = 10,
  ) {
    this.stopSimulation(bookingId)

    const startPoint = GOSALA_COORDS[gosalaName] || {
      lat: 18.5074,
      lng: 73.8077,
    }
    const endPoint = {
      lat: startPoint.lat + 0.024,
      lng: startPoint.lng + 0.038,
    }

    // Fetch actual driving road coordinates from OpenStreetMap OSRM
    const waypoints = await fetchRealRoadWaypoints(startPoint, endPoint)
    let currentIndex = 0

    const channel = `channel:booking:${bookingId}`

    const interval = setInterval(() => {
      if (currentIndex >= waypoints.length - 1) {
        // Reached destination!
        const finalPoint = waypoints[waypoints.length - 1]
        const tick: GpsTickPayload = {
          bookingId,
          lat: finalPoint.lat,
          lng: finalPoint.lng,
          bearing: 0,
          speedKmh: 0,
          etaMinutes: 0,
          distanceRemainingKm: 0,
          stage: 5,
          stageLabel: "Arrived at Customer",
          timestamp: Date.now(),
        }
        wsHub.broadcastToChannel(channel, "GPS_TICK", tick)
        wsHub.broadcastToChannel(channel, "STAGE_CHANGED", {
          bookingId,
          stage: 5,
          stageLabel: "Arrived at Customer",
        })
        this.onTickListener?.(tick)
        this.stopSimulation(bookingId)
        return
      }

      const current = waypoints[currentIndex]
      const next = waypoints[currentIndex + 1]
      const bearing = calculateBearing(current, next)
      const progressRatio = currentIndex / waypoints.length
      const distanceRemainingKm =
        Math.round(totalDistanceKm * (1 - progressRatio) * 10) / 10
      const speedKmh = 26 + Math.floor(Math.random() * 10) // 26 - 36 km/h realistic city speed
      const etaMinutes = Math.max(
        1,
        Math.round((distanceRemainingKm / speedKmh) * 60),
      )

      const tick: GpsTickPayload = {
        bookingId,
        lat: current.lat,
        lng: current.lng,
        bearing,
        speedKmh,
        etaMinutes,
        distanceRemainingKm,
        stage: 4,
        stageLabel: "Start Transport",
        timestamp: Date.now(),
      }

      wsHub.broadcastToChannel(channel, "GPS_TICK", tick)
      this.onTickListener?.(tick)
      currentIndex++
    }, 1500)

    this.activeSimulations.set(bookingId, interval)
  }

  stopSimulation(bookingId: string) {
    const existing = this.activeSimulations.get(bookingId)
    if (existing) {
      clearInterval(existing)
      this.activeSimulations.delete(bookingId)
    }
  }
}

export const gpsSimulator = new GpsSimulatorManager()
