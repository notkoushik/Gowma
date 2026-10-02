/**
 * Mathematical Engine for Map-Matching, GPS Road Snapping, and Heading Azimuth
 * Implements the core algorithms used by Uber and Ola navigation systems.
 */

export type LatLng = [number, number] // [latitude, longitude]

export interface SnappedLocation {
  snappedPos: LatLng
  segmentIndex: number
  progressOnSegment: number // 0.0 to 1.0 along the segment
  distanceToRoadMeters: number
  bearing: number // 0 to 360 degrees road-tangent azimuth
  traveledCoords: LatLng[]
  remainingCoords: LatLng[]
  roadDistanceRemainingKm: number
}

const EARTH_RADIUS_METERS = 6371000

/**
 * Standard Haversine formula to compute great-circle distance in meters
 */
export function haversineDistanceMeters(p1: LatLng, p2: LatLng): number {
  const dLat = ((p2[0] - p1[0]) * Math.PI) / 180
  const dLng = ((p2[1] - p1[1]) * Math.PI) / 180
  const lat1 = (p1[0] * Math.PI) / 180
  const lat2 = (p2[0] * Math.PI) / 180

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return EARTH_RADIUS_METERS * c
}

/**
 * Calculate forward azimuth bearing (0° to 360°) from p1 to p2
 */
export function calculateAzimuthBearing(p1: LatLng, p2: LatLng): number {
  if (p1[0] === p2[0] && p1[1] === p2[1]) return 0

  const lat1 = (p1[0] * Math.PI) / 180
  const lat2 = (p2[0] * Math.PI) / 180
  const dLng = ((p2[1] - p1[1]) * Math.PI) / 180

  const y = Math.sin(dLng) * Math.cos(lat2)
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)

  const brng = (Math.atan2(y, x) * 180) / Math.PI
  return (brng + 360) % 360
}

/**
 * Shortest angular rotation delta between two bearings (handling 355° -> 5° without a 350° backspin)
 */
export function shortestAngleDelta(fromAngle: number, toAngle: number): number {
  let diff = (toAngle - fromAngle) % 360
  if (diff < -180) diff += 360
  if (diff > 180) diff -= 360
  return diff
}

/**
 * Orthogonal project point P onto segment A -> B in local equirectangular plane
 */
export function projectPointOntoSegment(
  p: LatLng,
  a: LatLng,
  b: LatLng,
): { projectedPoint: LatLng; t: number; distanceMeters: number } {
  // Equirectangular approximation for local meter coordinates around average latitude
  const latAvg = (((a[0] + b[0]) / 2) * Math.PI) / 180
  const cosLat = Math.cos(latAvg)

  // Local Cartesian conversion (x: East meters, y: North meters)
  const ax = ((a[1] * Math.PI) / 180) * EARTH_RADIUS_METERS * cosLat
  const ay = ((a[0] * Math.PI) / 180) * EARTH_RADIUS_METERS
  const bx = ((b[1] * Math.PI) / 180) * EARTH_RADIUS_METERS * cosLat
  const by = ((b[0] * Math.PI) / 180) * EARTH_RADIUS_METERS
  const px = ((p[1] * Math.PI) / 180) * EARTH_RADIUS_METERS * cosLat
  const py = ((p[0] * Math.PI) / 180) * EARTH_RADIUS_METERS

  const dx = bx - ax
  const dy = by - ay
  const lenSq = dx * dx + dy * dy

  if (lenSq === 0) {
    return {
      projectedPoint: a,
      t: 0,
      distanceMeters: haversineDistanceMeters(p, a),
    }
  }

  // Parameter t clamped between [0, 1]
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq))

  const projLat = a[0] + t * (b[0] - a[0])
  const projLng = a[1] + t * (b[1] - a[1])
  const projectedPoint: LatLng = [projLat, projLng]

  return {
    projectedPoint,
    t,
    distanceMeters: haversineDistanceMeters(p, projectedPoint),
  }
}

/**
 * Pillar 2 & 3: Map-Matching Engine
 * Finds the optimal road segment for vehicle position P, snaps P to the road line,
 * and partitions the road route into traveled path and remaining path ahead.
 */
export function matchAndSliceRoute(
  vehiclePos: LatLng,
  routeCoordinates: LatLng[],
): SnappedLocation {
  if (!routeCoordinates || routeCoordinates.length === 0) {
    return {
      snappedPos: vehiclePos,
      segmentIndex: 0,
      progressOnSegment: 0,
      distanceToRoadMeters: 0,
      bearing: 0,
      traveledCoords: [vehiclePos],
      remainingCoords: [vehiclePos],
      roadDistanceRemainingKm: 0,
    }
  }

  if (routeCoordinates.length === 1) {
    return {
      snappedPos: routeCoordinates[0],
      segmentIndex: 0,
      progressOnSegment: 1,
      distanceToRoadMeters: haversineDistanceMeters(
        vehiclePos,
        routeCoordinates[0],
      ),
      bearing: 0,
      traveledCoords: [routeCoordinates[0]],
      remainingCoords: [routeCoordinates[0]],
      roadDistanceRemainingKm: 0,
    }
  }

  let minDistance = Infinity
  let bestSegmentIndex = 0
  let bestSnappedPos: LatLng = routeCoordinates[0]
  let bestT = 0

  // Search each road segment
  for (let i = 0; i < routeCoordinates.length - 1; i++) {
    const a = routeCoordinates[i]
    const b = routeCoordinates[i + 1]
    const { projectedPoint, t, distanceMeters } = projectPointOntoSegment(
      vehiclePos,
      a,
      b,
    )

    if (distanceMeters < minDistance) {
      minDistance = distanceMeters
      bestSegmentIndex = i
      bestSnappedPos = projectedPoint
      bestT = t
    }
  }

  // Road segment tangent heading
  const segStart = routeCoordinates[bestSegmentIndex]
  const segEnd = routeCoordinates[bestSegmentIndex + 1]
  const bearing = calculateAzimuthBearing(segStart, segEnd)

  // Sliced geometries:
  // Traveled path: Start -> ... -> segStart -> bestSnappedPos
  const traveledCoords: LatLng[] = [
    ...routeCoordinates.slice(0, bestSegmentIndex + 1),
    bestSnappedPos,
  ]

  // Remaining path: bestSnappedPos -> segEnd -> ... -> End
  const remainingCoords: LatLng[] = [
    bestSnappedPos,
    ...routeCoordinates.slice(bestSegmentIndex + 1),
  ]

  // Calculate exact road kilometers remaining
  let remainingMeters = 0
  for (let j = 0; j < remainingCoords.length - 1; j++) {
    remainingMeters += haversineDistanceMeters(
      remainingCoords[j],
      remainingCoords[j + 1],
    )
  }
  const roadDistanceRemainingKm = Math.round((remainingMeters / 1000) * 10) / 10

  return {
    snappedPos: bestSnappedPos,
    segmentIndex: bestSegmentIndex,
    progressOnSegment: bestT,
    distanceToRoadMeters: Math.round(minDistance * 10) / 10,
    bearing,
    traveledCoords,
    remainingCoords,
    roadDistanceRemainingKm,
  }
}
