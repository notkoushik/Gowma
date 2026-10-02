export type AnimalOperationalStatus = "Available" | "In Transit" | "In Seva" | "Resting Buffer" | "Vet Care" | "Heat Hold" | "Recovering"

export type AnimalVetInfo = {
  doctorName: string
  qualification: string
  regNo: string
  clinic: string
  phone: string
  lastVisit: string
  nextDue: string
  dewormingDate?: string
  hoofCareDate?: string
  vitals?: {
    temp: string
    heartRate: string
    respiration: string
    rumen: string
  }
}

export type AnimalDietInfo = {
  greenFodder: string
  dryRoughage: string
  concentrateMix: string
  waterIntakeLiters: string
  feedingTimes: string
  postTripCare: string
}

export type AnimalCustomDetail = {
  id: string
  label: string
  value: string
}

export type Animal = {
  name: string
  tagId?: string // e.g. "IN-MH-12-8491" (Govt INAPH / Pashu Aadhaar)
  type: "Cow" | "Calf" | "Bull"
  breed?: string
  gosala: string
  age: string
  ageYears: number
  weight: string
  height: string
  category: string
  price: number
  status: AnimalOperationalStatus
  todayBookings: number
  maxDailyTrips: number
  maxRadiusKm: number
  cooldownMinutes: number
  cooldownExpiresAt?: string // e.g. "14:15"
  assignedHandler: string
  lactationStatus?: string
  temperament?: string
  sacredMarks?: string
  diet: string
  healthNotes?: string
  photo: string
  photos?: string[]
  vetInfo?: AnimalVetInfo
  dietInfo?: AnimalDietInfo
  customDetails?: AnimalCustomDetail[]
}

// 0 hardcoded animals - populated strictly through user registrations and backend database sync
export const animals: Animal[] = []

/* ---------------- Certified Empanelled Veterinarians ---------------- */
export type EmpanelledVet = {
  id: string
  name: string
  qualification: string
  regNo: string
  clinic: string
  phone: string
  address: string
  specialization: string
  emergency24x7: boolean
  assignedGosalas: string[]
}

// 0 hardcoded vets - populated strictly via user entries and backend API sync
export const initialEmpanelledVets: EmpanelledVet[] = []

/* ---------------- Standardized Dropdown Presets ---------------- */
export const CATTLE_BREEDS = [
  "Gir Cow",
  "Sahiwal",
  "Kankrej",
  "Tharparkar",
  "Rathi",
  "Ongole",
  "Hallikar",
  "Deoni",
  "Khillari",
  "Red Sindhi",
  "Malvi",
  "Punganur Dwarf",
]

export const AGE_PRESETS = [
  {
    label: "Young Calf (1–2 yrs)",
    age: "1 yr",
    ageYears: 1,
    weight: "120 kg",
    height: "92 cm",
    type: "Calf",
  },
  {
    label: "Milking Mother Cow (3–5 yrs)",
    age: "4 yrs",
    ageYears: 4,
    weight: "380 kg",
    height: "128 cm",
    type: "Cow",
  },
  {
    label: "Prime Sacred Cow (6–8 yrs)",
    age: "6 yrs",
    ageYears: 6,
    weight: "410 kg",
    height: "132 cm",
    type: "Cow",
  },
  {
    label: "Senior Cattle (9–11 yrs)",
    age: "10 yrs",
    ageYears: 10,
    weight: "430 kg",
    height: "135 cm",
    type: "Cow",
  },
  {
    label: "Elder Cow / Sanctuary (12+ yrs)",
    age: "13 yrs",
    ageYears: 13,
    weight: "390 kg",
    height: "130 cm",
    type: "Cow",
  },
  {
    label: "Sacred Nandi Bull (5–8 yrs)",
    age: "7 yrs",
    ageYears: 7,
    weight: "520 kg",
    height: "142 cm",
    type: "Bull",
  },
]

export const CEREMONIAL_CATEGORIES = [
  "Ceremonial · Puja & Griha Pravesh",
  "Temple Pradakshina & Utsav",
  "Vedic Havan & Blessing",
  "Kamadhenu Gau Seva",
  "Gau Gras & Darshan Seva",
  "Gaushala Sanctuary Rest",
]

export const GOSEVAK_HANDLERS = [
  "Rameshwar Shastri (Senior Gosevak)",
  "Suresh Patil (Lead Gosevak)",
  "Mohan Deshmukh (Experienced Gosevak)",
  "Narayan Sharma (Calf Welfare Specialist)",
  "Ananda Patil (Calf Caretaker)",
  "Ganesh Yadav (Gosevak)",
  "Vithal More (Senior Bovine Attendant)",
]

export const DIET_PRESETS = [
  {
    id: "standard",
    label:
      "Standard Vedic Nutrition (Napier Grass + Wheat Straw + Mineral Jaggery)",
    greenFodder:
      "Fresh Napier Grass & Hybrid CO-4 (18 kg/day), Green Lucerne (5 kg/day)",
    dryRoughage: "Clean dry paddy straw & wheat straw (8-10 kg/day)",
    concentrateMix:
      "Crushed maize, wheat bran, mustard cake (3.5 kg/day), mineral salt & 250g pure jaggery",
    waterIntakeLiters: "50–60 Liters fresh filtered water daily (ad-libitum)",
    feedingTimes:
      "06:30 AM (Green Fodder), 12:30 PM (Concentrate Mash), 06:00 PM (Dry Roughage)",
    postTripCare:
      "Electrolyte hydration water with 200g jaggery, followed by 30 mins quiet resting in shaded pen",
  },
  {
    id: "high_yield",
    label:
      "High-Yield / Lactating Cow Diet (Rich Lucerne + Crushed Grains + Electrolytes)",
    greenFodder:
      "Sweet Sudan Sorghum & Hybrid Napier (22 kg/day), Fresh Berseem Lucerne (7 kg/day)",
    dryRoughage: "Chopped jowar kadbi & oat straw (10 kg/day)",
    concentrateMix:
      "Cottonseed cake, broken wheat, gram chuni (4.5 kg/day) + calcium phosphorus supplement",
    waterIntakeLiters: "65–75 Liters clean water daily",
    feedingTimes: "06:00 AM, 12:00 PM, 05:30 PM",
    postTripCare:
      "Warm jaggery mash + calcium booster drink, fresh soft bedding check",
  },
  {
    id: "calf",
    label:
      "Gentle Young Calf Nourishing Diet (Fresh Green Shoots + Mother Milk)",
    greenFodder: "Tender clover & soft grass shoots (4 kg/day)",
    dryRoughage: "Soft wheat straw (1.5 kg/day)",
    concentrateMix:
      "Calf starter mash (500g/day) + mother cow whole milk (2-3 Liters)",
    waterIntakeLiters: "15–20 Liters fresh lukewarm water",
    feedingTimes:
      "07:00 AM (Morning suckling), 01:00 PM (Soft green shoots), 06:30 PM (Evening suckling)",
    postTripCare:
      "Warm grooming rub, uninterrupted rest with mother cow, no commercial journeys",
  },
  {
    id: "senior",
    label:
      "Senior / Restorative Bovine Care Diet (Soft Soaked Mash + Herbal Digestive Tonics)",
    greenFodder: "Finely chopped tender green fodder (12 kg/day)",
    dryRoughage: "Steamed / soaked soft chaff (6 kg/day)",
    concentrateMix:
      "Soaked boiled barley, wheat bran, methi powder, turmeric & mineral salt (2.5 kg/day)",
    waterIntakeLiters:
      "40–45 Liters clean lukewarm water with digestive cumin seeds",
    feedingTimes: "07:00 AM, 01:00 PM, 06:00 PM",
    postTripCare:
      "Gentle joint rub, soft sand bedding, 120-minute resting cooldown",
  },
]

export const LACTATION_STATUSES = [
  "Dry / Resting (Non-Lactating)",
  "Active Milking (8–10 Liters/day)",
  "Prime Milking (12–14 Liters/day)",
  "Pregnant / Gestating (Month 5)",
  "Young Calf / Nursing Mother",
  "Elder Sanctuary Resident (Permanent Care)",
]

export const TEMPERAMENT_PRESETS = [
  "Extremely Gentle with Children & Elders",
  "Calm & Meditative during Vedic Chanting & Havan",
  "Alert, Responsive & Accustomed to Crowd Darshan",
  "Gentle & Quiet (Prefers Soft Bells & Ghee Diya)",
  "Playful & Affectionate Young Calf",
]
