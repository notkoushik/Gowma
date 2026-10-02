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

export const addons: Addon[] = [
  {
    id: "mala",
    name: "Marigold mala",
    desc: "Fresh garland for the animal",
    price: 150,
    maxQty: 4,
  },
  {
    id: "flowers",
    name: "Flower basket",
    desc: "Assorted puja flowers",
    price: 200,
    maxQty: 3,
  },
  {
    id: "chunni",
    name: "Silk chunni",
    desc: "Decorative cloth drape",
    price: 300,
    maxQty: 2,
  },
  {
    id: "decor",
    name: "Full decoration",
    desc: "Bells, kalash & tilak set",
    price: 450,
    maxQty: 1,
  },
]

export const durationOptions = [
  { min: 60, label: "60 min", extra: 0, tag: "Included" },
  { min: 90, label: "90 min", extra: 500, tag: "+30 min" },
  { min: 120, label: "120 min", extra: 1000, tag: "+60 min" },
]

// slot availability per time (true = available)
export const daySlots = [
  { time: "08:00", end: "09:00", available: true },
  { time: "09:00", end: "10:00", available: true },
  { time: "10:00", end: "11:00", available: false },
  { time: "11:00", end: "12:00", available: true },
  { time: "12:00", end: "13:00", available: true },
  { time: "14:00", end: "15:00", available: true },
  { time: "15:00", end: "16:00", available: false },
  { time: "16:00", end: "17:00", available: true },
]
