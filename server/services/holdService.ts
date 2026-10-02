import { db } from "../db"
import { checkAvailability } from "./availabilityService"
import { cacheService } from "./cacheService"
import type { SlotHold } from "../types"

export type AcquireHoldResult = { success: true; hold: SlotHold } | {
  success: false
  reason: string
}

export async function acquireSlotHold(params: {
  animal: string
  date: string
  start: string
  durationMin: number
  customerName: string
  ttlSeconds?: number
}): Promise<AcquireHoldResult> {
  const lockKey = `hold:${params.animal.toLowerCase()}:${params.date}:${params.start}`
  const ttlSeconds = params.ttlSeconds || 300

  // 1. Check general calendar and welfare availability
  const avail = checkAvailability(
    params.animal,
    params.date,
    params.start,
    params.durationMin,
  )
  if (!avail.available) {
    return {
      success: false,
      reason: avail.reason || "Slot is not available for hold",
    }
  }

  // 2. Atomic NX Lock via CacheService (Redis semantics)
  const acquired = await cacheService.set(
    lockKey,
    { customer: params.customerName, heldAt: Date.now() },
    { ttlSeconds, nx: true },
  )

  if (!acquired) {
    return {
      success: false,
      reason: "This slot was just claimed by another customer. Please select another slot.",
    }
  }

  const hold: SlotHold = {
    holdId: "HOLD-" + Date.now().toString(36).toUpperCase(),
    animal: params.animal,
    date: params.date,
    start: params.start,
    durationMin: params.durationMin,
    expiresAt: Date.now() + ttlSeconds * 1000,
    customerName: params.customerName,
  }

  db.slotHolds.push(hold)
  return { success: true, hold }
}

export async function releaseSlotHold(holdId: string): Promise<boolean> {
  const hold = db.slotHolds.find((h) => h.holdId === holdId || (h as any).id === holdId)
  if (hold) {
    const lockKey = `hold:${hold.animal.toLowerCase()}:${hold.date}:${hold.start}`
    await cacheService.del(lockKey)
  }
  const initialLen = db.slotHolds.length
  db.slotHolds = db.slotHolds.filter((h) => h.holdId !== holdId && (h as any).id !== holdId)
  return db.slotHolds.length < initialLen
}
