import type {
  Booking,
  PricingConfig,
  GosalaManager,
  Settlement,
  SlotHold,
} from "./types"

export const defaultPricing: PricingConfig = {
  standardMin: 60,
  extraUnitMin: 30,
  extraUnitRate: 500,
  freeKm: 5,
  perKm: 50,
  taxPct: 12,
  commissionPct: 20,
  maxDurationMin: 240,
  bufferMin: 30,
  rounding: "Nearest ₹10",
}

export const initialBookings: Booking[] = []

export const initialManagers: GosalaManager[] = []

export const initialSettlements: Settlement[] = []

class InMemoryDB {
  bookings: Booking[] = [...initialBookings]
  managers: GosalaManager[] = [...initialManagers]
  settlements: Settlement[] = [...initialSettlements]
  pricingConfig: PricingConfig = { ...defaultPricing }
  slotHolds: SlotHold[] = []
  blockedSlots: Record<string, string[]> = {}

  // Helpers
  cleanExpiredHolds() {
    const now = Date.now()
    this.slotHolds = this.slotHolds.filter((h) => h.expiresAt > now)
  }
}

export const db = new InMemoryDB()
