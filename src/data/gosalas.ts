export type GosalaStatus = "Active" | "Maintenance" | "Under Audit"

export type GosalaStaff = {
  id?: string
  name: string
  role: string
  phone: string
  shift?: string
}

export type GosalaCustomDetail = {
  id?: string
  key: string
  value: string
}

export type Gosala = {
  id: string
  name: string
  trustRegistrationNo: string
  region: string
  address: string
  contactPhone: string
  email: string
  managerId: string
  managerName: string
  caretaker: string
  caretakerPhone?: string
  caretakerShift?: string
  caretakerQuarters?: string
  additionalStaff?: GosalaStaff[]
  customDetails?: GosalaCustomDetail[]
  capacity: number
  establishedYear: string
  facilities: string[]
  lat?: number
  lng?: number
  status: GosalaStatus
  photo?: string
  photos?: string[]
  notes?: string
}

export const GOSALA_FACILITY_OPTIONS = [
  "Padded Cattle Ambulance / Van",
  "24/7 Pure Borewell Water & Trough",
  "Certified Veterinary Medical Bay",
  "Organic Green Fodder Pasture",
  "Electrolyte & Ayurvedic Feed Station",
  "Sacred Vedic Puja & Havan Courtyard",
  "Solar Powered Automatic Chaff Cutter",
  "Non-Slip Rubber Flooring in Sheds",
  "Covered Weather-Proof Night Pens",
  "Maternity & Young Calf Nursing Pen",
]

import { INDIAN_REGIONAL_HUBS } from "./regions.ts"

export const GOSALA_REGION_PRESETS = [
  ...INDIAN_REGIONAL_HUBS.map((h) => `${h.state} - ${h.name}`),
  // Legacy short aliases for seamless backward compatibility
  "Pune West (Kothrud)",
  "Pune North (Baner)",
  "Pune East (Kalyani Nagar)",
  "Pune South (Hadapsar)",
  "Pune PCMC (Wakad / Pimpri)",
  "Pune Rural (Mulshi & Paud)",
  "Hyderabad Central (Banjara Hills / Jubilee Hills)",
  "Cyberabad / Gachibowli (HITEC City)",
  "Narsingi / Gandipet (Outer Ring Road)",
  "Secunderabad / Cantonment",
  "Bengaluru South (Kanakapura Rd)",
  "Mumbai Western Suburbs (Borivali)",
  "South Delhi (Chattarpur / Vasant Kunj)",
  "Mathura / Vrindavan (Sacred Braj Bhoomi)",
]

export const GOSALA_PHOTO_PRESETS = [
  {
    label: "Vedic Sanctum Courtyard & Mandir",
    description: "Traditional stone courtyard with sacred banyan trees, havan kund & clean water troughs",
    url: "https://images.unsplash.com/photo-1546722228-7baeca4bd0b3?w=800&h=480&fit=crop&auto=format",
  },
  {
    label: "Organic Green Grazing Pasture",
    description: "Spacious open green pastures with organic Napier grass and shade trees",
    url: "https://images.unsplash.com/photo-1500595046743-cd271d694d30?w=800&h=480&fit=crop&auto=format",
  },
  {
    label: "Covered Resting Sheds & Feeding Pens",
    description: "High-roof weather-protected bovine sheds with non-slip flooring and automatic fodder racks",
    url: "https://images.unsplash.com/photo-1527153857715-3908f2ae5e81?w=800&h=480&fit=crop&auto=format",
  },
  {
    label: "Veterinary Clinical & Care Bay",
    description: "Dedicated medical examination stalls with clean maternity and recovery isolation units",
    url: "https://images.unsplash.com/photo-1516467508483-a7212febe31a?w=800&h=480&fit=crop&auto=format",
  },
  {
    label: "Open Solar Grazing Yard",
    description: "Sunlit open exercise yards with sand bedding, solar lamps and automated water sprinklers",
    url: "https://images.unsplash.com/photo-1570042225831-d98fa7577f1e?w=800&h=480&fit=crop&auto=format",
  },
  {
    label: "Rural Goseva Sanctuary",
    description: "Lush rural perimeter with dedicated cow grooming pavilions and devotee pradakshina paths",
    url: "https://images.unsplash.com/photo-1613445564548-7dd79ec70f08?w=800&h=480&fit=crop&auto=format",
  },
]

export const GOSALA_CUSTOM_DETAIL_SUGGESTIONS = [
  "Total Pasture Land (Acres)",
  "Daily Green Napier Fodder (Kg)",
  "Solar Power Generation (kW)",
  "Biogas & Panchagavya Plant",
  "80G Income Tax Exemption No.",
  "Darshan & Visiting Hours",
  "Dedicated Cattle Ambulance No.",
  "Water Reservoir Capacity (Liters)",
  "Organic Ghee Processing Unit",
  "Calf Maternity Isolation Stalls",
]

// 0 hardcoded gaushalas - populated strictly via dynamic user registration and backend database sync
export const initialGosalas: Gosala[] = []
