import { db } from "../db"

export type PricingCalculationResult = {
  base: number
  extraTime: number
  transport: number
  addons: number
  tax: number
  discount: number
  total: number
  commission: number
  commissionPct: number
  gosalaPayable: number
  freeKmSnapshot: number
  perKmSnapshot: number
  extraUnitRateSnapshot: number
  chargeableKm: number
}

export function calculateBookingPrice(params: {
  baseRate?: number
  durationMin: number
  distanceKm: number
  addonsCost?: number
  discount?: number
  taxPct?: number
  commissionPct?: number
  commissionFlat?: number
  freeKm?: number
  perKm?: number
  extraUnitMin?: number
  extraUnitRate?: number
}): PricingCalculationResult {
  const cfg = db.pricingConfig

  const base = params.baseRate ?? 3500
  const durationMin = params.durationMin || cfg.standardMin || 60
  const standardMin = cfg.standardMin || 60
  const extraMin = Math.max(0, durationMin - standardMin)
  const unitMin = params.extraUnitMin ?? (cfg.extraUnitMin || 30)
  const unitRate = params.extraUnitRate ?? (cfg.extraUnitRate || 500)

  const extraUnits = Math.ceil(extraMin / unitMin)
  const extraTime = extraUnits * unitRate

  // Distance transport calculation
  const distanceKm = params.distanceKm || 0
  const freeKm = params.freeKm ?? (cfg.freeKm || 5)
  const perKm = params.perKm ?? (cfg.perKm || 50)
  const chargeableKm = Math.max(0, Math.round((distanceKm - freeKm) * 10) / 10)
  const transport = Math.round((chargeableKm * perKm) / 10) * 10

  const addons = params.addonsCost || 0
  const discount = params.discount || 0

  const subtotal = Math.max(0, base + extraTime + transport + addons - discount)
  const taxPct = params.taxPct !== undefined ? params.taxPct : (cfg.taxPct || 12)
  const tax = Math.round((subtotal * taxPct) / 100)
  const total = subtotal + tax

  const commissionPct = params.commissionPct !== undefined ? params.commissionPct : (cfg.commissionPct || 20)
  const sevaTotal = base + extraTime
  const commission =
    params.commissionFlat !== undefined && params.commissionFlat !== null
      ? params.commissionFlat
      : Math.round((sevaTotal * commissionPct) / 100)

  const passThrough = transport + addons
  const gosalaPayable = Math.max(0, sevaTotal - commission) + passThrough

  return {
    base,
    extraTime,
    transport,
    addons,
    tax,
    discount,
    total,
    commission,
    commissionPct,
    gosalaPayable,
    freeKmSnapshot: freeKm,
    perKmSnapshot: perKm,
    extraUnitRateSnapshot: unitRate,
    chargeableKm,
  }
}
