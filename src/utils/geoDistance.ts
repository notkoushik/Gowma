import { calculateDistanceKm } from "../data/regions.ts"

export type ServiceTier = "LOCAL_SERVICE" | "EXTENDED_TRANSIT" | "OUT_OF_RADIUS"

export interface ServiceabilityInfo {
  tier: ServiceTier
  distanceKm: number
  badgeText: string
  badgeClass: string
  isDirectBookingAllowed: boolean
  estimatedTransitMin: number
  noticeMessage?: string
}

export interface GeoLocationTarget {
  lat?: number
  lng?: number
}

/**
 * Resolve distance and serviceability tier for a given Gaushala
 */
export function getGaushalaServiceability(
  userLat: number | null,
  userLng: number | null,
  gaushala: GeoLocationTarget,
): ServiceabilityInfo {
  // If user location is not yet known, assume central operational radius
  if (!userLat || !userLng || !gaushala.lat || !gaushala.lng) {
    return {
      tier: "LOCAL_SERVICE",
      distanceKm: 6.5,
      badgeText: "Nearby",
      badgeClass: "bg-ok-soft text-ok border-ok/30",
      isDirectBookingAllowed: true,
      estimatedTransitMin: 25,
    }
  }

  const distanceKm = calculateDistanceKm(userLat, userLng, gaushala.lat, gaushala.lng)
  const estimatedTransitMin = Math.round(15 + distanceKm * 2.2)

  if (distanceKm <= 35) {
    return {
      tier: "LOCAL_SERVICE",
      distanceKm,
      badgeText: `${distanceKm} km · Doorstep Delivery`,
      badgeClass: "bg-ok-soft text-ok border-ok/30",
      isDirectBookingAllowed: true,
      estimatedTransitMin,
    }
  }

  if (distanceKm <= 75) {
    return {
      tier: "EXTENDED_TRANSIT",
      distanceKm,
      badgeText: `${distanceKm} km · Extended Transit`,
      badgeClass: "bg-warn-soft text-warn border-warn/30",
      isDirectBookingAllowed: true,
      estimatedTransitMin,
      noticeMessage: "Extended welfare transit requires dedicated resting buffer & hydration stops.",
    }
  }

  return {
    tier: "OUT_OF_RADIUS",
    distanceKm,
    badgeText: `${distanceKm} km · Distant Sanctuary`,
    badgeClass: "bg-paper-deep text-ink-soft border-line",
    isDirectBookingAllowed: false,
    estimatedTransitMin,
    noticeMessage: "Direct doorstep van delivery is outside normal radius. Contact sanctuary for special seva arrangements.",
  }
}

/**
 * Sort Gaushalas by nearest distance to user
 */
export function sortGaushalasByProximity<T extends GeoLocationTarget>(
  gaushalas: T[],
  userLat: number | null,
  userLng: number | null,
): { gosala: T; serviceability: ServiceabilityInfo }[] {
  return gaushalas
    .map((g) => ({
      gosala: g,
      serviceability: getGaushalaServiceability(userLat, userLng, g),
    }))
    .sort((a, b) => a.serviceability.distanceKm - b.serviceability.distanceKm)
}
