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
}): PricingCalculationResult {
  const cfg = db.pricingConfig

  const base = params.baseRate ?? 3500
  const durationMin = params.durationMin || cfg.standardMin || 60
  const extraMin = Math.max(0, durationMin - (cfg.standardMin || 60))
  const unitMin = cfg.extraUnitMin || 30
  const unitRate = cfg.extraUnitRate || 500

  const extraUnits = Math.ceil(extraMin / unitMin)
  const extraTime = extraUnits * unitRate

  // Distance transport calculation
  const distanceKm = params.distanceKm || 0
  const freeKm = cfg.freeKm || 5
  const perKm = cfg.perKm || 50
  const chargeableKm = Math.max(0, Math.round((distanceKm - freeKm) * 10) / 10)
  const transport = Math.round(chargeableKm * perKm)

  const addons = params.addonsCost || 0
  const discount = params.discount || 0

  const subtotal = base + extraTime + transport + addons - discount
  const taxPct = cfg.taxPct || 12
  const tax = Math.round((subtotal * taxPct) / 100)
  const total = subtotal + tax

  const commissionPct = cfg.commissionPct || 20
  const commission = Math.round(((base + extraTime) * commissionPct) / 100)

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
    freeKmSnapshot: freeKm,
    perKmSnapshot: perKm,
    extraUnitRateSnapshot: unitRate,
    chargeableKm,
  }
}
