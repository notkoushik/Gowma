/**
 * Pan-India Geographic Regional Directory & Centroid Engine
 * Categorizes operational hubs, sacred pilgrimage clusters, and metropolitan zones
 * for dynamic location detection and nearest-Gaushala matching.
 */

export type IndianState =
  | "Telangana"
  | "Maharashtra"
  | "Karnataka"
  | "Gujarat"
  | "Delhi NCR"
  | "Uttar Pradesh"
  | "Rajasthan"
  | "Andhra Pradesh"
  | "Tamil Nadu"
  | "Madhya Pradesh"
  | "Haryana"
  | "Punjab"
  | "West Bengal"
  | "Kerala"

export interface OperationalRegionHub {
  id: string
  state: IndianState
  city: string
  name: string
  zone: "North" | "South" | "East" | "West" | "Central" | "Rural"
  lat: number
  lng: number
  defaultMaxRadiusKm: number
  pincodePrefixes: string[]
  isFeatured?: boolean
}

export const INDIAN_REGIONAL_HUBS: OperationalRegionHub[] = [
  // --- TELANGANA ---
  {
    id: "hub-hyd-central",
    state: "Telangana",
    city: "Hyderabad",
    name: "Hyderabad Central (Banjara Hills / Jubilee Hills)",
    zone: "Central",
    lat: 17.4156,
    lng: 78.4358,
    defaultMaxRadiusKm: 35,
    pincodePrefixes: ["500034", "500033", "500082"],
    isFeatured: true,
  },
  {
    id: "hub-hyd-west",
    state: "Telangana",
    city: "Hyderabad",
    name: "Cyberabad / Gachibowli (HITEC City)",
    zone: "West",
    lat: 17.4401,
    lng: 78.3489,
    defaultMaxRadiusKm: 35,
    pincodePrefixes: ["500032", "500081", "500084"],
    isFeatured: true,
  },
  {
    id: "hub-hyd-southwest",
    state: "Telangana",
    city: "Hyderabad",
    name: "Narsingi / Gandipet (Outer Ring Road)",
    zone: "South",
    lat: 17.3753,
    lng: 78.3615,
    defaultMaxRadiusKm: 40,
    pincodePrefixes: ["500075", "500089"],
    isFeatured: true,
  },
  {
    id: "hub-hyd-secunderabad",
    state: "Telangana",
    city: "Secunderabad",
    name: "Secunderabad / Cantonment (Kompally)",
    zone: "North",
    lat: 17.4399,
    lng: 78.4983,
    defaultMaxRadiusKm: 35,
    pincodePrefixes: ["500003", "500010", "500014"],
    isFeatured: true,
  },
  {
    id: "hub-hyd-east",
    state: "Telangana",
    city: "Hyderabad",
    name: "Uppal / LB Nagar (East Hyderabad)",
    zone: "East",
    lat: 17.4022,
    lng: 78.5601,
    defaultMaxRadiusKm: 35,
    pincodePrefixes: ["500039", "500074"],
  },
  {
    id: "hub-warangal",
    state: "Telangana",
    city: "Warangal",
    name: "Warangal & Hanamkonda Heritage Belt",
    zone: "Central",
    lat: 17.9689,
    lng: 79.5941,
    defaultMaxRadiusKm: 40,
    pincodePrefixes: ["506001", "506002"],
  },

  // --- MAHARASHTRA ---
  {
    id: "hub-pune-west",
    state: "Maharashtra",
    city: "Pune",
    name: "Pune West (Kothrud / Bavdhan)",
    zone: "West",
    lat: 18.5074,
    lng: 73.8077,
    defaultMaxRadiusKm: 35,
    pincodePrefixes: ["411038", "411021", "411058"],
    isFeatured: true,
  },
  {
    id: "hub-pune-north",
    state: "Maharashtra",
    city: "Pune",
    name: "Pune North (Baner / Aundh)",
    zone: "North",
    lat: 18.559,
    lng: 73.7868,
    defaultMaxRadiusKm: 35,
    pincodePrefixes: ["411045", "411007"],
    isFeatured: true,
  },
  {
    id: "hub-pune-east",
    state: "Maharashtra",
    city: "Pune",
    name: "Pune East (Kalyani Nagar / Viman Nagar)",
    zone: "East",
    lat: 18.5482,
    lng: 73.9034,
    defaultMaxRadiusKm: 35,
    pincodePrefixes: ["411006", "411014"],
    isFeatured: true,
  },
  {
    id: "hub-pune-south",
    state: "Maharashtra",
    city: "Pune",
    name: "Pune South (Hadapsar / Kondhwa)",
    zone: "South",
    lat: 18.5089,
    lng: 73.9259,
    defaultMaxRadiusKm: 35,
    pincodePrefixes: ["411028", "411048"],
  },
  {
    id: "hub-pune-pcmc",
    state: "Maharashtra",
    city: "Pune",
    name: "Pune PCMC (Wakad / Hinjewadi / Pimpri)",
    zone: "West",
    lat: 18.5987,
    lng: 73.7628,
    defaultMaxRadiusKm: 35,
    pincodePrefixes: ["411057", "411017", "411018"],
    isFeatured: true,
  },
  {
    id: "hub-mumbai-suburbs",
    state: "Maharashtra",
    city: "Mumbai",
    name: "Mumbai Western Suburbs (Borivali / Andheri)",
    zone: "West",
    lat: 19.2288,
    lng: 72.8541,
    defaultMaxRadiusKm: 35,
    pincodePrefixes: ["400092", "400053", "400066"],
    isFeatured: true,
  },
  {
    id: "hub-mumbai-thane",
    state: "Maharashtra",
    city: "Mumbai",
    name: "Mumbai MMR (Thane & Navi Mumbai)",
    zone: "East",
    lat: 19.2183,
    lng: 72.9781,
    defaultMaxRadiusKm: 40,
    pincodePrefixes: ["400601", "400703"],
    isFeatured: true,
  },
  {
    id: "hub-mumbai-south",
    state: "Maharashtra",
    city: "Mumbai",
    name: "South Mumbai (Girgaon / Dadar)",
    zone: "South",
    lat: 18.9553,
    lng: 72.8181,
    defaultMaxRadiusKm: 30,
    pincodePrefixes: ["400004", "400028"],
  },
  {
    id: "hub-nashik",
    state: "Maharashtra",
    city: "Nashik",
    name: "Nashik & Trimbakeshwar (Sacred Godavari)",
    zone: "Central",
    lat: 19.9975,
    lng: 73.7898,
    defaultMaxRadiusKm: 45,
    pincodePrefixes: ["422001", "422212"],
  },
  {
    id: "hub-nagpur",
    state: "Maharashtra",
    city: "Nagpur",
    name: "Nagpur & Vidarbha Goseva Corridor",
    zone: "Central",
    lat: 21.1458,
    lng: 79.0882,
    defaultMaxRadiusKm: 40,
    pincodePrefixes: ["440001", "440010"],
  },

  // --- KARNATAKA ---
  {
    id: "hub-blr-south",
    state: "Karnataka",
    city: "Bengaluru",
    name: "Bengaluru South (Kanakapura Rd / Jayanagar)",
    zone: "South",
    lat: 12.8716,
    lng: 77.5446,
    defaultMaxRadiusKm: 35,
    pincodePrefixes: ["560062", "560041", "560078"],
    isFeatured: true,
  },
  {
    id: "hub-blr-east",
    state: "Karnataka",
    city: "Bengaluru",
    name: "Bengaluru East (Whitefield / Indiranagar)",
    zone: "East",
    lat: 12.9698,
    lng: 77.7499,
    defaultMaxRadiusKm: 35,
    pincodePrefixes: ["560066", "560038"],
    isFeatured: true,
  },
  {
    id: "hub-blr-north",
    state: "Karnataka",
    city: "Bengaluru",
    name: "Bengaluru North (Hebbal / Yelahanka)",
    zone: "North",
    lat: 13.0358,
    lng: 77.597,
    defaultMaxRadiusKm: 35,
    pincodePrefixes: ["560024", "560064"],
  },
  {
    id: "hub-mysuru",
    state: "Karnataka",
    city: "Mysuru",
    name: "Mysuru Heritage & Chamundi Hills",
    zone: "South",
    lat: 12.2958,
    lng: 76.6394,
    defaultMaxRadiusKm: 40,
    pincodePrefixes: ["570001", "570010"],
  },

  // --- GUJARAT ---
  {
    id: "hub-ahmedabad-west",
    state: "Gujarat",
    city: "Ahmedabad",
    name: "Ahmedabad (SG Highway / Bodakdev)",
    zone: "West",
    lat: 23.0387,
    lng: 72.5119,
    defaultMaxRadiusKm: 35,
    pincodePrefixes: ["380054", "380015"],
    isFeatured: true,
  },
  {
    id: "hub-ahmedabad-east",
    state: "Gujarat",
    city: "Ahmedabad",
    name: "Ahmedabad (Maninagar / Sabarmati)",
    zone: "East",
    lat: 22.9966,
    lng: 72.6029,
    defaultMaxRadiusKm: 35,
    pincodePrefixes: ["380008", "380005"],
  },
  {
    id: "hub-surat",
    state: "Gujarat",
    city: "Surat",
    name: "Surat & Tapi River Basin (Kamrej)",
    zone: "South",
    lat: 21.1702,
    lng: 72.8311,
    defaultMaxRadiusKm: 35,
    pincodePrefixes: ["395001", "395007"],
    isFeatured: true,
  },
  {
    id: "hub-rajkot",
    state: "Gujarat",
    city: "Rajkot",
    name: "Rajkot (Saurashtra Gir Sanctuary Hub)",
    zone: "West",
    lat: 22.3039,
    lng: 70.8022,
    defaultMaxRadiusKm: 45,
    pincodePrefixes: ["360001", "360005"],
  },

  // --- DELHI NCR ---
  {
    id: "hub-delhi-south",
    state: "Delhi NCR",
    city: "New Delhi",
    name: "South Delhi (Chattarpur / Vasant Kunj)",
    zone: "South",
    lat: 28.5023,
    lng: 77.1812,
    defaultMaxRadiusKm: 35,
    pincodePrefixes: ["110074", "110070"],
    isFeatured: true,
  },
  {
    id: "hub-ncr-gurugram",
    state: "Delhi NCR",
    city: "Gurugram",
    name: "Gurugram (Golf Course Rd / Sohna)",
    zone: "West",
    lat: 28.4595,
    lng: 77.0266,
    defaultMaxRadiusKm: 35,
    pincodePrefixes: ["122001", "122002"],
    isFeatured: true,
  },
  {
    id: "hub-ncr-noida",
    state: "Delhi NCR",
    city: "Noida",
    name: "Noida & Greater Noida (Yamuna Expressway)",
    zone: "East",
    lat: 28.5355,
    lng: 77.391,
    defaultMaxRadiusKm: 35,
    pincodePrefixes: ["201301", "201308"],
    isFeatured: true,
  },

  // --- UTTAR PRADESH ---
  {
    id: "hub-up-vrindavan",
    state: "Uttar Pradesh",
    city: "Vrindavan",
    name: "Mathura / Vrindavan (Sacred Braj Bhoomi)",
    zone: "Central",
    lat: 27.5706,
    lng: 77.6934,
    defaultMaxRadiusKm: 45,
    pincodePrefixes: ["281121", "281001"],
    isFeatured: true,
  },
  {
    id: "hub-up-varanasi",
    state: "Uttar Pradesh",
    city: "Varanasi",
    name: "Varanasi (Kashi / Sacred Ganga Ghats)",
    zone: "East",
    lat: 25.3176,
    lng: 82.9739,
    defaultMaxRadiusKm: 40,
    pincodePrefixes: ["221001", "221005"],
    isFeatured: true,
  },
  {
    id: "hub-up-ayodhya",
    state: "Uttar Pradesh",
    city: "Ayodhya",
    name: "Ayodhya & Saryu River Sanctuary",
    zone: "Central",
    lat: 26.7922,
    lng: 82.1998,
    defaultMaxRadiusKm: 40,
    pincodePrefixes: ["224123", "224001"],
  },
  {
    id: "hub-up-lucknow",
    state: "Uttar Pradesh",
    city: "Lucknow",
    name: "Lucknow (Gomti Nagar / Awadh)",
    zone: "Central",
    lat: 26.8467,
    lng: 80.9462,
    defaultMaxRadiusKm: 35,
    pincodePrefixes: ["226010", "226001"],
  },

  // --- RAJASTHAN ---
  {
    id: "hub-jaipur",
    state: "Rajasthan",
    city: "Jaipur",
    name: "Jaipur (Hingonia / Sanganer Heritage)",
    zone: "Central",
    lat: 26.9124,
    lng: 75.7873,
    defaultMaxRadiusKm: 45,
    pincodePrefixes: ["302001", "302029"],
    isFeatured: true,
  },
  {
    id: "hub-jodhpur",
    state: "Rajasthan",
    city: "Jodhpur",
    name: "Jodhpur & Pali (Tharparkar Sanctuaries)",
    zone: "West",
    lat: 26.2389,
    lng: 73.0243,
    defaultMaxRadiusKm: 45,
    pincodePrefixes: ["342001"],
  },

  // --- ANDHRA PRADESH ---
  {
    id: "hub-tirupati",
    state: "Andhra Pradesh",
    city: "Tirupati",
    name: "Tirupati (Sri Venkateswara Gosamrakshana)",
    zone: "South",
    lat: 13.6288,
    lng: 79.4192,
    defaultMaxRadiusKm: 40,
    pincodePrefixes: ["517501", "517507"],
    isFeatured: true,
  },
  {
    id: "hub-vijayawada",
    state: "Andhra Pradesh",
    city: "Vijayawada",
    name: "Vijayawada & Guntur (Krishna Basin)",
    zone: "Central",
    lat: 16.5062,
    lng: 80.648,
    defaultMaxRadiusKm: 35,
    pincodePrefixes: ["520001", "522001"],
  },

  // --- TAMIL NADU ---
  {
    id: "hub-chennai",
    state: "Tamil Nadu",
    city: "Chennai",
    name: "Chennai (Mylapore / Tambaram Corridor)",
    zone: "East",
    lat: 13.0827,
    lng: 80.2707,
    defaultMaxRadiusKm: 35,
    pincodePrefixes: ["600004", "600045"],
    isFeatured: true,
  },
  {
    id: "hub-coimbatore",
    state: "Tamil Nadu",
    city: "Coimbatore",
    name: "Coimbatore (Kongu Kangayam Hub)",
    zone: "West",
    lat: 11.0168,
    lng: 76.9558,
    defaultMaxRadiusKm: 40,
    pincodePrefixes: ["641001", "641018"],
  },
]

/**
 * Standard Haversine Distance in Kilometers
 */
export function calculateDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371 // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.round(R * c * 10) / 10
}

/**
 * Calculates estimated Indian road distance by applying road tortuosity factor (default 1.30x)
 * Accounting for bypasses, river bridges, and urban traffic routing.
 */
export function calculateRoadDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  tortuosity: number = 1.3,
): number {
  const straight = calculateDistanceKm(lat1, lng1, lat2, lng2)
  return Math.round(straight * tortuosity * 10) / 10
}

/**
 * Fast offline lookup to find closest operational Indian hub from any coordinates
 */
export function findNearestIndianHub(
  lat: number,
  lng: number,
): { hub: OperationalRegionHub; distanceKm: number } {
  let closest = INDIAN_REGIONAL_HUBS[0]
  let minDist = Infinity

  for (const hub of INDIAN_REGIONAL_HUBS) {
    const d = calculateDistanceKm(lat, lng, hub.lat, hub.lng)
    if (d < minDist) {
      minDist = d
      closest = hub
    }
  }

  return { hub: closest, distanceKm: minDist }
}

/**
 * Extract an accurate Indian address label for instant offline fallback
 */
export function getIndianLocalityFallback(lat: number, lng: number): string {
  const { hub, distanceKm } = findNearestIndianHub(lat, lng)
  if (distanceKm < 20) {
    return `${hub.name}, ${hub.city}`
  }
  if (distanceKm < 100) {
    return `Near ${hub.city}, ${hub.state}`
  }
  return `${hub.city}, ${hub.state} Region`
}

/**
 * Get distinct Indian states with active regional hubs
 */
export function getAllIndianStates(): IndianState[] {
  const states = new Set<IndianState>()
  INDIAN_REGIONAL_HUBS.forEach((h) => states.add(h.state))
  return Array.from(states)
}

/**
 * Get all hubs for a given state
 */
export function getHubsForState(state: IndianState): OperationalRegionHub[] {
  return INDIAN_REGIONAL_HUBS.filter((h) => h.state === state)
}
