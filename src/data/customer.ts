export const pricing = {
  includedMin: 60,
  extraUnitMin: 30,
  extraUnitRate: 500,
  freeKm: 5,
  perKm: 50,
  taxPct: 12,
}

export type Gosala = {
  id: string
  name: string
  area: string
  distanceKm: number
  rating: number
  animals: number
  photo: string
  lat?: number
  lng?: number
  taxTreatment?: string
  customTaxPct?: number
  commissionType?: string
  customCommissionPct?: number
  customCommissionFlat?: number
  bufferMinutes?: number
  partnershipTier?: string
  partnershipNotes?: string
}

export type GosalaFacility = {
  label: string
  detail: string
}

export type GosalaReview = {
  name: string
  initials: string
  rating: number
  comment: string
  date: string
}

export type GosalaDetail = Gosala & {
  gallery: string[]
  tagline: string
  about: string
  address: string
  phone: string
  email: string
  managerName: string
  managerInitials: string
  yearEstablished: number
  registrationNo: string
  totalAnimals: number
  cowCount: number
  calfCount: number
  bullCount: number
  areaAcres: number
  serviceHours: string
  certifications: { label: string; issuer: string }[]
  animalCare: {
    feedSchedule: string
    feedType: string
    vetVisits: string
    vaccination: string
    restPeriod: string
    grooming: string
  }
  facilities: GosalaFacility[]
  maintenancePractices: string[]
  totalReviews: number
  reviews: GosalaReview[]
}

// 0 hardcoded customer gosalas - populated dynamically from user-registered sanctuaries
export const gosalas: Gosala[] = []

// Dynamic lookup registry - dynamically filled when resolving Gaushalas
export const gosalaDetails: Record<string, GosalaDetail> = {}

export type Addon = {
  id: string
  name: string
  desc: string
  price: number
  maxQty: number
}

import { DEFAULT_GOSALA_OFFERINGS } from "./gosalas"

export const addons: Addon[] = DEFAULT_GOSALA_OFFERINGS.map((item) => ({
  id: item.id,
  name: item.name,
  desc: item.desc,
  price: item.price,
  maxQty: item.maxQty || 5,
}))

export const durationOptions = [
  { min: 60, label: "60 min", extra: 0, tag: "Included" },
  { min: 90, label: "90 min", extra: 500, tag: "+30 min" },
  { min: 120, label: "120 min", extra: 1000, tag: "+60 min" },
]

