import { db } from "../db"

function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number)
  return (h || 0) * 60 + (m || 0)
}

export type SlotCheckResult = {
  available: boolean
  status: "Available" | "Booked" | "Blocked" | "Buffer" | "Held"
  bookingId?: string
  customer?: string
  reason?: string
}

export function checkAvailability(
  animal: string,
  date: string,
  time: string,
  durationMin: number = 60,
): SlotCheckResult {
  db.cleanExpiredHolds()

  const key = `${animal}-${date}`
  const manualBlocks = db.blockedSlots[key] || []

  // 1. Check manual blocks
  if (manualBlocks.includes(time)) {
    return {
      available: false,
      status: "Blocked",
      reason:
        "Slot blocked by Gosala Manager for rest, medical examination, or sanctuary routine",
    }
  }

  const slotStart = toMinutes(time)
  const slotEnd = slotStart + durationMin

  // 2. Check temporary holds
  const hold = db.slotHolds.find(
    (h) =>
      h.animal === animal &&
      h.date === date &&
      toMinutes(h.start) <= slotStart &&
      toMinutes(h.start) + h.durationMin > slotStart,
  )
  if (hold) {
    return {
      available: false,
      status: "Held",
      reason: `Slot temporarily held by customer checkout (${Math.ceil(
        (hold.expiresAt - Date.now()) / 1000,
      )}s remaining)`,
    }
  }

  // 3. Check confirmed / active bookings on this date
  const relevantBookings = db.bookings.filter(
    (b) =>
      b.animal === animal &&
      b.date === date &&
      b.status !== "Rejected" &&
      b.status !== "Cancelled",
  )

  // 4. Sacred Welfare Protocol Invariant: Daily Seva Ceiling
  // Calves & Senior cattle: max 1 trip/day; Adult cattle: max 2 trips/day
  const isCalfOrSenior =
    animal.toLowerCase().includes("kesari") ||
    animal.toLowerCase().includes("calf")
  const maxDailyTrips = isCalfOrSenior ? 1 : 2

  if (relevantBookings.length >= maxDailyTrips) {
    return {
      available: false,
      status: "Blocked",
      reason: `Maximum daily welfare ceiling reached (${relevantBookings.length}/${maxDailyTrips} sevas scheduled today)`,
    }
  }

  // 5. Sacred Welfare Protocol Invariant: 90-minute post-trip resting cooldown
  const welfareBufferMin = 90

  for (const b of relevantBookings) {
    const bStart = toMinutes(b.start)
    const bEnd = toMinutes(b.end)

    // Direct booking overlap
    if (slotStart < bEnd && slotEnd > bStart) {
      return {
        available: false,
        status: "Booked",
        bookingId: b.id,
        customer: b.customer,
        reason: `Reserved for ${b.customer} (${b.start} - ${b.end})`,
      }
    }

    // Mandatory post-trip resting cooldown (bEnd to bEnd + 90 min)
    if (slotStart >= bEnd && slotStart < bEnd + welfareBufferMin) {
      const remainingMins = bEnd + welfareBufferMin - slotStart
      return {
        available: false,
        status: "Buffer",
        bookingId: b.id,
        reason: `Mandatory 90-minute resting & hydration cooldown following trip ${b.id} (${remainingMins}m remaining)`,
      }
    }

    // Pre-trip preparation buffer (bStart - 30m to bStart)
    const prepBuffer = 30
    if (slotEnd > bStart - prepBuffer && slotStart < bStart) {
      return {
        available: false,
        status: "Buffer",
        bookingId: b.id,
        reason: `Pre-dispatch inspection & halter grooming buffer for trip ${b.id}`,
      }
    }
  }

  return {
    available: true,
    status: "Available",
  }
}
