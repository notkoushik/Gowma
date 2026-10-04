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

export type GosalaOfferingCategory = "puja" | "feed" | "prasadam" | "decoration"

export type GosalaOfferingItem = {
  id: string
  name: string
  desc: string
  price: number
  category: GosalaOfferingCategory
  inStock: boolean
  maxQty?: number
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
  assignedManagers?: { id: string; name: string; phone?: string; email?: string }[]
  caretaker: string
  caretakerPhone?: string
  caretakerShift?: string
  caretakerQuarters?: string
  additionalStaff?: GosalaStaff[]
  customDetails?: GosalaCustomDetail[]
  capacity: number
  landAcres?: number
  establishedYear: string
  visitingHours?: string
  facilities: string[]
  lat?: number
  lng?: number
  status: GosalaStatus
  photo?: string
  photos?: string[]
  notes?: string
  // Gaushala-Specific Offerings & Custom Base Pricing
  items?: GosalaOfferingItem[]
  baseCowPrice?: number
  baseBullPrice?: number
  baseCalfPrice?: number
  baseBuffaloPrice?: number
  basePairPrice?: number
  customBovineCategories?: CustomBovineCategory[]

  // Gaushala-Specific Commission, Tax & Settlement Economics
  partnershipTier?: PartnershipTier
  commissionType?: CommissionType
  customCommissionPct?: number // e.g. 8 for 8%
  customCommissionFlat?: number // e.g. 400 for ₹400 flat
  taxTreatment?: TaxTreatment
  customTaxPct?: number // e.g. 0 for exempt, 5 for concessional
  bufferMinutes?: number // turnaround buffer in minutes
  partnershipNotes?: string // rationale e.g. "Close Partner Gaushala - 8% preferential commission"

  governingAdminName?: string
  governingAdminRole?: string
  adminId?: string
  adminName?: string
}

export type PartnershipTier = "PREFERRED" | "STANDARD" | "CHARITABLE" | "COMMERCIAL" | "CUSTOM"
export type CommissionType = "percentage" | "fixed" | "hybrid"
export type TaxTreatment = "standard_gst" | "section_80g_exempt" | "reduced_charity_gst" | "custom_rate"

export type CustomBovineCategory = {
  id: string
  name: string
  basePrice: number
  description?: string
  badgeText?: string
}

export const DEFAULT_GOSALA_OFFERINGS: GosalaOfferingItem[] = [
  {
    id: "item-mala",
    name: "Marigold Pooja Mala",
    desc: "Fresh consecrated floral garland for the holy cow",
    price: 150,
    category: "puja",
    inStock: true,
    maxQty: 5,
  },
  {
    id: "item-fodder",
    name: "Fresh Green Grass Fodder",
    desc: "10 kg organic sweet grass basket (Grass Seva)",
    price: 120,
    category: "feed",
    inStock: true,
    maxQty: 10,
  },
  {
    id: "item-chunni",
    name: "Pure Silk Chunni & Vastra",
    desc: "Ceremonial silk drape with golden zari border",
    price: 300,
    category: "decoration",
    inStock: true,
    maxQty: 3,
  },
  {
    id: "item-jaggery",
    name: "Devotional Jaggery & Chana",
    desc: "Organic gur and roasted chana feeding plate",
    price: 180,
    category: "feed",
    inStock: true,
    maxQty: 5,
  },
  {
    id: "item-ghee",
    name: "Pure Vedic A2 Gir Cow Ghee (500ml)",
    desc: "Traditional bilona churned Gaushala trust ghee",
    price: 950,
    category: "prasadam",
    inStock: true,
    maxQty: 4,
  },
  {
    id: "item-dhoop",
    name: "Natural Gomaye Hawan Dhoop",
    desc: "Eco-friendly cow dung herbal dhoop cones (pack of 20)",
    price: 200,
    category: "puja",
    inStock: true,
    maxQty: 6,
  },
  {
    id: "item-puja-kit",
    name: "Gau Pooja Kalash & Tilak Kit",
    desc: "Complete brass kalash, kumkum, akshata and bell set",
    price: 450,
    category: "puja",
    inStock: true,
    maxQty: 2,
  },
]

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
  // Common regional aliases
  "Cyberabad / Gachibowli",
  "Narsingi / Gandipet",
  "Hyderabad Central (Banjara Hills / Jubilee Hills)",
  "Secunderabad / Cantonment",
  "Warangal / Hanamkonda",
  "Vijayawada / Guntur",
  "Tirupati / Chandragiri",
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
    url: "https://images.unsplash.com/photo-1589923188900-85dae523342b?w=800&h=480&fit=crop&auto=format",
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
