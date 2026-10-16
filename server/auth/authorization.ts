import type { JwtPayload } from "./jwt.ts"

/** The small, persisted parts of a resource used by authorization. */
export type GosalaResource = {
  id?: string | number | null
  gosalaId?: string | number | null
  name?: string | null
  gosala?: string | null
}

export type BookingResource = GosalaResource & {
  customerId?: string | number | null
  driverId?: string | number | null
  customer?: string | null
  driver?: string | null
}

export type AnimalResource = GosalaResource & {
  booking?: BookingResource | null
}

const normalize = (value: unknown): string => String(value ?? "").trim().toLowerCase()
const values = (items: unknown): string[] =>
  Array.isArray(items) ? items.map(normalize).filter(Boolean) : []

/** Returns the normalized gosala IDs and names granted by the token. */
export function getAllowedGosalaIds(user: JwtPayload): string[] {
  return Array.from(new Set([...values(user.gosalaIds), ...values(user.gosalaNames)]))
}

function hasGosalaScope(user: JwtPayload, resource: GosalaResource): boolean {
  const allowed = new Set(getAllowedGosalaIds(user))
  if (!allowed.size) return false
  return [resource.id, resource.gosalaId, resource.name, resource.gosala]
    .map(normalize)
    .some((value) => value !== "" && allowed.has(value))
}

export function canAccessGosala(user: JwtPayload, gosala: GosalaResource): boolean {
  if (user.role === "super_admin") return true
  if (user.role !== "admin" && user.role !== "manager") return false
  return hasGosalaScope(user, gosala)
}

export function canAccessBooking(user: JwtPayload, booking: BookingResource): boolean {
  if (user.role === "super_admin") return true
  if (user.role === "customer") return normalize(booking.customerId) !== "" && normalize(booking.customerId) === normalize(user.userId)
  if (user.role === "driver") return normalize(booking.driverId) !== "" && normalize(booking.driverId) === normalize(user.userId)
  if (user.role === "admin" || user.role === "manager") return hasGosalaScope(user, booking)
  return false
}

export function canAccessAnimal(user: JwtPayload, animal: AnimalResource): boolean {
  if (user.role === "super_admin") return true
  if (animal.booking) return canAccessBooking(user, animal.booking)
  if (user.role === "admin" || user.role === "manager") return hasGosalaScope(user, animal)
  return false
}

export function canUseLiveTracking(user: JwtPayload): boolean {
  return user.role !== "super_admin" && (user.role === "admin" || user.role === "manager" || user.role === "customer" || user.role === "driver")
}

export function canSubscribeTracking(user: JwtPayload, booking: BookingResource): boolean {
  return canUseLiveTracking(user) && canAccessBooking(user, booking)
}

export function canPublishTelemetry(user: JwtPayload, booking: BookingResource): boolean {
  return user.role === "driver" && canAccessBooking(user, booking)
}
