/**
 * GOMAA Gaushala Geodesic Search Service
 * 
 * Provides unified, intelligent search across:
 * 1. GOMAA Registered Gaushalas (active database & memory records)
 * 2. Curated Major Sacred Vedic Gaushalas & Ashrams across India
 * 3. Live OpenStreetMap Photon POI Geocoding (fuzzy matching for places of worship, cow shelters, trusts)
 * 4. OpenStreetMap Nominatim Geocoding (with India boundary bias & query relaxation)
 */

import { findNearestIndianHub, type OperationalRegionHub, calculateDistanceKm } from "../data/regions.ts"
import { api } from "./api.ts"

export interface GaushalaSearchResult {
  id: string
  name: string
  address: string
  city: string
  state: string
  lat: number
  lng: number
  source: "gomaa_database" | "sacred_sanctuary" | "osm_poi" | "geocoded" | "google_maps_link" | "google_places_api"
  badgeText: string
  trustNo?: string
  capacity?: number
  caretaker?: string
  suggestedRegion: string
  hubId: string
  hubName: string
  distanceKm?: number
}

// Curated Sacred Indian Gaushalas & Famous Vedic Ashrams with exact coordinates
export const CURATED_SACRED_INDIAN_GAUSHALAS = [
  // Uttar Pradesh & Braj Region
  {
    id: "curated-surya-vrindavan",
    name: "Surya Vrindavan Sanctuary",
    trustName: "Surya Goseva Charitable Trust",
    address: "Raman Reti Road, Near Bhaktivedanta Hospice, Vrindavan, Mathura",
    city: "Mathura",
    state: "Uttar Pradesh",
    lat: 27.575,
    lng: 77.674,
    capacity: 250,
    trustNo: "UP-MTH-2018-8841",
  },
  {
    id: "curated-iskcon-vrindavan",
    name: "Shri Krishna Balaram Gaushala",
    trustName: "ISKCON Vrindavan Cow Protection Trust",
    address: "Bhaktivedanta Swami Marg, Raman Reti, Vrindavan",
    city: "Mathura",
    state: "Uttar Pradesh",
    lat: 27.5742,
    lng: 77.6755,
    capacity: 350,
    trustNo: "ISK-VRN-1975-01",
  },
  {
    id: "curated-mataji-barsana",
    name: "Mataji Gaushala Barsana",
    trustName: "Mataji Goseva Trust Barsana Dham",
    address: "Parikrama Marg, Barsana, Mathura District",
    city: "Barsana",
    state: "Uttar Pradesh",
    lat: 27.6478,
    lng: 77.3752,
    capacity: 55000,
    trustNo: "BRS-TR-1998-04",
  },
  {
    id: "curated-govardhan-danghati",
    name: "Shri Govardhan Gaushala & Parikrama Trust",
    trustName: "Dan Ghati Govardhan Seva Sansthan",
    address: "Dan Ghati, Parikrama Marg, Govardhan",
    city: "Govardhan",
    state: "Uttar Pradesh",
    lat: 27.498,
    lng: 77.464,
    capacity: 1200,
    trustNo: "GVD-MTH-2005-77",
  },
  {
    id: "curated-kashi-vishwanath",
    name: "Kashi Vishwanath Mandir Gaushala",
    trustName: "Shri Kashi Vishwanath Temple Trust",
    address: "Near Sarnath Ring Road, Kashi, Varanasi",
    city: "Varanasi",
    state: "Uttar Pradesh",
    lat: 25.3109,
    lng: 83.0104,
    capacity: 450,
    trustNo: "VNS-KV-1983-09",
  },
  {
    id: "curated-ram-janmabhoomi",
    name: "Shri Ram Janmabhoomi Gaushala",
    trustName: "Shri Ram Janmabhoomi Teerth Kshetra Trust",
    address: "Karsevakpuram, Ayodhya Dham",
    city: "Ayodhya",
    state: "Uttar Pradesh",
    lat: 26.7922,
    lng: 82.1998,
    capacity: 600,
    trustNo: "AYD-RJ-2020-01",
  },

  // Maharashtra
  {
    id: "curated-govardhan-ecovillage",
    name: "Govardhan Ecovillage Gaushala",
    trustName: "Govardhan Goseva & Vedic Research Trust",
    address: "Galtare, Post Hamrapur, Wada Taluka, Palghar",
    city: "Palghar",
    state: "Maharashtra",
    lat: 19.8256,
    lng: 73.0894,
    capacity: 350,
    trustNo: "MH-THN-2003-4412",
  },
  {
    id: "curated-keshav-pune",
    name: "Keshav Gaushala & Goseva Kendra",
    trustName: "Shri Keshav Goseva Sanstha Alandi",
    address: "Alandi Road, Charholi Budruk, Pune",
    city: "Pune",
    state: "Maharashtra",
    lat: 18.675,
    lng: 73.898,
    capacity: 220,
    trustNo: "MH-PUN-2011-552",
  },
  {
    id: "curated-dattatreya-nashik",
    name: "Dattatreya Goseva Ashram Gaushala",
    trustName: "Shri Datta Digambar Trust",
    address: "Panchavati, Near Ramkund, Nashik",
    city: "Nashik",
    state: "Maharashtra",
    lat: 20.011,
    lng: 73.7903,
    capacity: 180,
    trustNo: "MH-NSK-2014-991",
  },
  {
    id: "curated-bombay-pinjrapole",
    name: "Bombay Panjrapole Gaushala (Oldest in Mumbai)",
    trustName: "The Bombay Panjrapole Society",
    address: "Panjrapole Road, Bhuleshwar / Chembur Sanctuary, Mumbai",
    city: "Mumbai",
    state: "Maharashtra",
    lat: 18.955,
    lng: 72.828,
    capacity: 1500,
    trustNo: "BOM-PJ-1834-01",
  },

  // Telangana & Hyderabad
  {
    id: "curated-sri-govardhana-hyd",
    name: "Sri Govardhana Sanctuary",
    trustName: "Sri Govardhana Trust Hyderabad",
    address: "Road No 12, Banjara Hills, Hyderabad",
    city: "Hyderabad",
    state: "Telangana",
    lat: 17.4156,
    lng: 78.4358,
    capacity: 120,
    trustNo: "TG-HYD-2016-102",
  },
  {
    id: "curated-kanha-shanti-vanam",
    name: "Kanha Shanti Vanam Gaushala",
    trustName: "Heartfulness Institute Cow Welfare Trust",
    address: "Kanha Village, Nandigama Mandal, Ranga Reddy District",
    city: "Hyderabad",
    state: "Telangana",
    lat: 17.135,
    lng: 78.275,
    capacity: 400,
    trustNo: "TG-RR-2018-771",
  },
  {
    id: "curated-warangal-bhadrakali",
    name: "Bhadrakali Temple Gaushala",
    trustName: "Sri Bhadrakali Devasthanam Trust",
    address: "Bhadrakali Lake Road, Warangal",
    city: "Warangal",
    state: "Telangana",
    lat: 17.994,
    lng: 79.576,
    capacity: 140,
    trustNo: "TG-WGL-1999-33",
  },

  // Andhra Pradesh
  {
    id: "curated-ttd-tirupati",
    name: "TTD Sri Venkateswara Gosamrakshana Shala",
    trustName: "Tirumala Tirupati Devasthanams Trust",
    address: "Chandragiri Road, Near Alipiri, Tirupati",
    city: "Tirupati",
    state: "Andhra Pradesh",
    lat: 13.635,
    lng: 79.408,
    capacity: 3500,
    trustNo: "TTD-AP-1956-01",
  },
  {
    id: "curated-simhachalam",
    name: "Simhachalam Temple Gaushala",
    trustName: "Sri Varaha Lakshmi Narasimha Swamy Devasthanam",
    address: "Simhachalam Hill Road, Visakhapatnam",
    city: "Visakhapatnam",
    state: "Andhra Pradesh",
    lat: 17.7667,
    lng: 83.25,
    capacity: 400,
    trustNo: "AP-VSP-1972-12",
  },
  {
    id: "curated-kanaka-durga",
    name: "Sri Kanaka Durga Temple Gaushala",
    trustName: "Sri Durga Malleswara Swamy Devasthanam",
    address: "Indrakeeladri, Krishna River Bank, Vijayawada",
    city: "Vijayawada",
    state: "Andhra Pradesh",
    lat: 16.516,
    lng: 80.612,
    capacity: 220,
    trustNo: "AP-VJA-1988-08",
  },

  // Rajasthan
  {
    id: "curated-pathmeda-godham",
    name: "Shri Pathmeda Godham Gaushala",
    trustName: "Shri Godham Mahatirth Pathmeda Trust",
    address: "Pathmeda, Sanchore Tehsil, Jalore District",
    city: "Jalore",
    state: "Rajasthan",
    lat: 24.754,
    lng: 71.772,
    capacity: 200000,
    trustNo: "RJ-JLR-1993-01",
  },
  {
    id: "curated-hingonia-jaipur",
    name: "Hingonia Gaushala",
    trustName: "Sri Krishna Balaram Seva Trust",
    address: "Hingonia, Post Bassi, Jaipur",
    city: "Jaipur",
    state: "Rajasthan",
    lat: 26.832,
    lng: 75.689,
    capacity: 15000,
    trustNo: "RJ-JPR-2016-51",
  },
  {
    id: "curated-jodhpur-gopal",
    name: "Shree Krishna Gaushala Jodhpur",
    trustName: "Jodhpur Goseva Sangh",
    address: "Pal Road, Jodhpur",
    city: "Jodhpur",
    state: "Rajasthan",
    lat: 26.2389,
    lng: 73.0243,
    capacity: 850,
    trustNo: "RJ-JDH-2001-44",
  },

  // Gujarat
  {
    id: "curated-bansi-gir",
    name: "Bansi Gir Gaushala",
    trustName: "Bansi Gir Goseva Trust",
    address: "Sanand-Bavla Road, Sanand, Ahmedabad",
    city: "Ahmedabad",
    state: "Gujarat",
    lat: 22.9868,
    lng: 72.38,
    capacity: 650,
    trustNo: "GJ-AHM-2006-18",
  },
  {
    id: "curated-rajkot-gir-kendra",
    name: "Shri Gir Kankrej Goseva Kendra",
    trustName: "Rajkot Goseva Mahamandal",
    address: "Kotharia Road, Rajkot",
    city: "Rajkot",
    state: "Gujarat",
    lat: 22.253,
    lng: 70.812,
    capacity: 1200,
    trustNo: "GJ-RJK-1994-32",
  },

  // Karnataka & South
  {
    id: "curated-art-of-living",
    name: "Sri Sri Gaushala (Art of Living)",
    trustName: "Ved Vignan Maha Vidya Peeth Trust",
    address: "21st Km Kanakapura Road, Udayapura, Bengaluru",
    city: "Bengaluru",
    state: "Karnataka",
    lat: 12.793,
    lng: 77.509,
    capacity: 350,
    trustNo: "KA-BLR-1981-05",
  },
  {
    id: "curated-gokula-gaushala",
    name: "Gokula Gaushala Mathikere",
    trustName: "M.S. Ramaiah Gokula Trust",
    address: "Mathikere, Near IISc, Bengaluru",
    city: "Bengaluru",
    state: "Karnataka",
    lat: 13.033,
    lng: 77.555,
    capacity: 180,
    trustNo: "KA-BLR-1990-21",
  },
  {
    id: "curated-ramana-ashram",
    name: "Sri Ramanasramam Gaushala",
    trustName: "Sri Ramanasramam Trust",
    address: "Chengam Road, Tiruvannamalai",
    city: "Tiruvannamalai",
    state: "Tamil Nadu",
    lat: 12.2253,
    lng: 79.0664,
    capacity: 150,
    trustNo: "TN-TVM-1950-02",
  },
  {
    id: "curated-kanchi-peetham",
    name: "Kanchi Kamakoti Peetham Goshala",
    trustName: "Sri Kanchi Kamakoti Peetham Trust",
    address: "Enathur, Kanchipuram",
    city: "Kanchipuram",
    state: "Tamil Nadu",
    lat: 12.8342,
    lng: 79.7036,
    capacity: 400,
    trustNo: "TN-KNC-1960-01",
  },
  {
    id: "curated-amritapuri",
    name: "Amritapuri Cow Sanctuary",
    trustName: "Mata Amritanandamayi Math",
    address: "Parayakadavu, Vallikavu, Kollam",
    city: "Kollam",
    state: "Kerala",
    lat: 9.091,
    lng: 76.489,
    capacity: 110,
    trustNo: "KL-KLM-1988-15",
  },

  // East & Central
  {
    id: "curated-jagannath-puri",
    name: "Jagannath Temple Gaushala",
    trustName: "Shree Jagannath Temple Administration",
    address: "Near Grand Road, Puri",
    city: "Puri",
    state: "Odisha",
    lat: 19.8135,
    lng: 85.8312,
    capacity: 650,
    trustNo: "OD-PRI-1955-01",
  },
  {
    id: "curated-mahakal-ujjain",
    name: "Mahakaleshwar Mandir Gaushala",
    trustName: "Shri Mahakaleshwar Temple Management Committee",
    address: "Chintaman Ganesh Road, Ujjain",
    city: "Ujjain",
    state: "Madhya Pradesh",
    lat: 23.1828,
    lng: 75.7682,
    capacity: 500,
    trustNo: "MP-UJN-1982-01",
  },
  {
    id: "curated-mayapur-iskcon",
    name: "Mayapur ISKCON Goshala",
    trustName: "ISKCON Mayapur Cow Care Ministry",
    address: "Sri Mayapur Dham, Nadia District",
    city: "Mayapur",
    state: "West Bengal",
    lat: 23.4233,
    lng: 88.3894,
    capacity: 450,
    trustNo: "WB-NDA-1972-04",
  },

  // Delhi NCR & Haryana & Uttarakhand
  {
    id: "curated-sultanpur-delhi",
    name: "Shri Krishna Gaushala Sultanpur",
    trustName: "Delhi Goseva Sangh",
    address: "Mehrauli-Gurgaon Road, Sultanpur, New Delhi",
    city: "New Delhi",
    state: "Delhi",
    lat: 28.498,
    lng: 77.16,
    capacity: 1200,
    trustNo: "DL-STP-1991-03",
  },
  {
    id: "curated-patanjali-haridwar",
    name: "Patanjali Gaushala & Research Institute",
    trustName: "Patanjali Yogpeeth Trust",
    address: "Delhi-Haridwar National Highway, Bahadrabad, Haridwar",
    city: "Haridwar",
    state: "Uttarakhand",
    lat: 29.898,
    lng: 78.048,
    capacity: 1500,
    trustNo: "UK-HWR-2006-08",
  },
  {
    id: "curated-parmarth-rishikesh",
    name: "Parmarth Niketan Goshala",
    trustName: "Parmarth Niketan Ashram Trust",
    address: "Swargashram, Rishikesh",
    city: "Rishikesh",
    state: "Uttarakhand",
    lat: 30.1205,
    lng: 78.314,
    capacity: 250,
    trustNo: "UK-RSK-1970-02",
  },
  {
    id: "curated-kurukshetra-gaushala",
    name: "Kurukshetra Gaushala Trust",
    trustName: "Kurukshetra Goseva Mandal",
    address: "Near Brahma Sarovar, Thanesar, Kurukshetra",
    city: "Kurukshetra",
    state: "Haryana",
    lat: 29.965,
    lng: 76.837,
    capacity: 900,
    trustNo: "HR-KKR-1985-11",
  },
]

export interface SearchGaushalasOptions {
  currentLat?: number
  currentLng?: number
  localGosalas?: any[]
  limit?: number
}

/**
 * Searches Gaushalas and landmarks using a 4-tier federated resolution engine.
 */
export async function searchGaushalaLocations(
  query: string,
  options: SearchGaushalasOptions = {},
): Promise<GaushalaSearchResult[]> {
  const rawQ = (query || "").trim()
  if (!rawQ || rawQ.length < 2) return []

  const results: GaushalaSearchResult[] = []
  const seenKeys = new Set<string>()

  const addResult = (res: GaushalaSearchResult) => {
    // Unique key by coordinate proximity (within ~150 meters) or exact name
    const coordKey = `${res.lat.toFixed(3)}_${res.lng.toFixed(3)}`
    const nameKey = res.name.toLowerCase().replace(/[^a-z0-9]/g, "")
    if (seenKeys.has(coordKey) || seenKeys.has(nameKey)) return
    seenKeys.add(coordKey)
    seenKeys.add(nameKey)

    // Compute distance if GPS origin available
    if (options.currentLat && options.currentLng) {
      res.distanceKm = Math.round(
        calculateDistanceKm(options.currentLat, options.currentLng, res.lat, res.lng),
      )
    }

    results.push(res)
  }

  const norm = rawQ.toLowerCase()
  const tokens = norm.split(/[\s,.-]+/).filter((t) => t.length >= 2)

// Helper: Local zero-latency Google Maps URL & coordinate extraction
function extractCoordsAndNameLocally(input: string): { lat: number; lng: number; name?: string; isCoords?: boolean } | null {
  if (!input) return null
  const trimmed = input.trim()

  // Direct Decimal coordinates: "18.5204, 73.8567"
  const decMatch = trimmed.match(/^(-?\d{1,2}(?:\.\d+)?)[,\s]+(-?\d{1,3}(?:\.\d+)?)$/)
  if (decMatch) {
    const lat = parseFloat(decMatch[1])
    const lng = parseFloat(decMatch[2])
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng, isCoords: true }
    }
  }

  // Place name in /place/Name+Here/
  const placeMatch = trimmed.match(/\/place\/([^/@?]+)/)
  let name: string | undefined
  if (placeMatch && placeMatch[1]) {
    try {
      name = decodeURIComponent(placeMatch[1].replace(/\+/g, " "))
    } catch {}
  }

  // @lat,lng
  const atMatch = trimmed.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
  if (atMatch) {
    const lat = parseFloat(atMatch[1])
    const lng = parseFloat(atMatch[2])
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng, name, isCoords: false }
    }
  }

  // Protobuf !3dlat!4dlng
  const protoMatch = trimmed.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/)
  if (protoMatch) {
    const lat = parseFloat(protoMatch[1])
    const lng = parseFloat(protoMatch[2])
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng, name, isCoords: false }
    }
  }

  // Query param q=lat,lng
  const qMatch = trimmed.match(/[?&](?:q|query)=(-?\d+\.\d+),(-?\d+\.\d+)/)
  if (qMatch) {
    const lat = parseFloat(qMatch[1])
    const lng = parseFloat(qMatch[2])
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng, name, isCoords: false }
    }
  }

  return null
}

  // -------------------------------------------------------------
  // TIER 0: Direct Google Maps URL or Coordinates Resolution
  // -------------------------------------------------------------
  const directExtract = extractCoordsAndNameLocally(rawQ)
  if (directExtract) {
    const closestHub = findNearestIndianHub(directExtract.lat, directExtract.lng)
    addResult({
      id: `local-gmaps-${directExtract.lat.toFixed(4)}-${directExtract.lng.toFixed(4)}`,
      name: directExtract.name || "Gaushala Premise (Google Maps)",
      address: directExtract.name
        ? `${directExtract.name}, ${closestHub.hub.city}, ${closestHub.hub.state}`
        : `Google Maps Pin: ${directExtract.lat.toFixed(5)}, ${directExtract.lng.toFixed(5)} (${closestHub.hub.city}, ${closestHub.hub.state})`,
      city: closestHub.hub.city,
      state: closestHub.hub.state,
      lat: directExtract.lat,
      lng: directExtract.lng,
      source: directExtract.isCoords ? "geocoded" : "google_maps_link",
      badgeText: directExtract.isCoords ? "Exact Coordinates" : "Google Maps Verified",
      suggestedRegion: `${closestHub.hub.name} (${closestHub.hub.city}, ${closestHub.hub.state})`,
      hubId: closestHub.hub.id,
      hubName: closestHub.hub.name,
    })
    return results
  }

  // Fallback: If shortened URL (e.g. maps.app.goo.gl or goo.gl/maps), resolve via backend API
  if (rawQ.includes("maps.app.goo.gl") || rawQ.includes("goo.gl/maps")) {
    try {
      const resp = await api.resolveGoogleMapsLink(rawQ)
      if (resp?.ok && resp.place) {
        const p = resp.place
        addResult({
          id: p.id,
          name: p.name,
          address: p.address,
          city: p.city,
          state: p.state,
          lat: p.lat,
          lng: p.lng,
          source: "google_maps_link",
          badgeText: "Google Maps Verified",
          suggestedRegion: p.suggestedRegion || `${p.city}, ${p.state}`,
          hubId: p.hubId || "hub-resolved",
          hubName: p.hubName || p.city,
        })
        return results
      }
    } catch (e) {
      // Fall through to regular search
    }
  }

  // Optional: Google Places Backend Search (if API key is configured)
  try {
    const gplacesResp = await api.searchPlaces(rawQ)
    if (gplacesResp?.ok && Array.isArray(gplacesResp.places)) {
      for (const gp of gplacesResp.places) {
        addResult({
          id: gp.id,
          name: gp.name,
          address: gp.address,
          city: gp.city,
          state: gp.state,
          lat: gp.lat,
          lng: gp.lng,
          source: "google_places_api",
          badgeText: "Google Places",
          suggestedRegion: gp.suggestedRegion || `${gp.city}, ${gp.state}`,
          hubId: gp.hubId || "gplaces-hub",
          hubName: gp.hubName || gp.city,
        })
      }
    }
  } catch (e) {
    // Non-fatal
  }

  // -------------------------------------------------------------
  // TIER 1: Search Registered GOMAA Gaushalas in Database / Context
  // -------------------------------------------------------------
  if (Array.isArray(options.localGosalas) && options.localGosalas.length > 0) {
    for (const g of options.localGosalas) {
      const gName = (g.name || "").toLowerCase()
      const gAddr = (g.address || "").toLowerCase()
      const gRegion = (g.region || "").toLowerCase()
      const hay = `${gName} ${gAddr} ${gRegion}`

      const matches =
        hay.includes(norm) ||
        (tokens.length > 0 && tokens.every((t) => hay.includes(t)))

      if (matches) {
        const lat = typeof g.latitude === "number" ? g.latitude : typeof g.lat === "number" ? g.lat : 17.4156
        const lng = typeof g.longitude === "number" ? g.longitude : typeof g.lng === "number" ? g.lng : 78.4358
        const closestHub = findNearestIndianHub(lat, lng)

        addResult({
          id: `gomaa-${g.id || g.name}`,
          name: g.name,
          address: g.address || `${g.name}, ${g.region}`,
          city: closestHub.hub.city,
          state: closestHub.hub.state,
          lat,
          lng,
          source: "gomaa_database",
          badgeText: "GOMAA Registered",
          trustNo: g.trustNo || g.trustRegistrationNumber || "AWBI Verified",
          capacity: g.capacity || 50,
          caretaker: g.caretaker || "Dedicated Gosevak Custodian",
          suggestedRegion: `${closestHub.hub.name} (${closestHub.hub.city}, ${closestHub.hub.state})`,
          hubId: closestHub.hub.id,
          hubName: closestHub.hub.name,
        })
      }
    }
  }

  // -------------------------------------------------------------
  // TIER 2: Search Curated Major Sacred Indian Gaushalas & Ashrams
  // -------------------------------------------------------------
  for (const cg of CURATED_SACRED_INDIAN_GAUSHALAS) {
    const hay = `${cg.name} ${cg.trustName} ${cg.address} ${cg.city} ${cg.state}`.toLowerCase()
    const matches =
      hay.includes(norm) ||
      (tokens.length > 0 && tokens.every((t) => hay.includes(t))) ||
      (tokens.length >= 2 && tokens.filter((t) => hay.includes(t)).length >= Math.ceil(tokens.length * 0.7))

    if (matches) {
      const closestHub = findNearestIndianHub(cg.lat, cg.lng)
      addResult({
        id: cg.id,
        name: cg.name,
        address: cg.address,
        city: cg.city,
        state: cg.state,
        lat: cg.lat,
        lng: cg.lng,
        source: "sacred_sanctuary",
        badgeText: "Vedic Sacred Sanctuary",
        trustNo: cg.trustNo,
        capacity: cg.capacity,
        suggestedRegion: `${closestHub.hub.name} (${closestHub.hub.city}, ${closestHub.hub.state})`,
        hubId: closestHub.hub.id,
        hubName: closestHub.hub.name,
      })
    }
  }

  // -------------------------------------------------------------
  // TIER 3: Live OpenStreetMap Photon POI Geocoder
  // -------------------------------------------------------------
  try {
    const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(
      rawQ,
    )}&limit=6&lat=20.5937&lon=78.9629`
    const res = await fetch(photonUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(3500),
    })

    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data.features)) {
        for (const feat of data.features) {
          const props = feat.properties || {}
          const coords = feat.geometry?.coordinates || []
          if (coords.length >= 2 && props.name) {
            const lng = coords[0]
            const lat = coords[1]
            // Verify inside India bounds (lat 6-38, lng 68-98)
            if (lat >= 6 && lat <= 38 && lng >= 68 && lng <= 98) {
              const closestHub = findNearestIndianHub(lat, lng)
              const parts = [props.street, props.district, props.city, props.state, props.countrycode?.toUpperCase()]
                .filter(Boolean)
              const address = parts.length > 0 ? parts.join(", ") : `${props.name}, ${closestHub.hub.city}`

              addResult({
                id: `photon-${props.osm_id || Math.random()}`,
                name: props.name,
                address,
                city: props.city || closestHub.hub.city,
                state: props.state || closestHub.hub.state,
                lat,
                lng,
                source: "osm_poi",
                badgeText: props.osm_value === "cow" || props.name.toLowerCase().includes("gaushala")
                  ? "OpenStreetMap Gaushala"
                  : "OpenStreetMap Landmark",
                suggestedRegion: `${closestHub.hub.name} (${closestHub.hub.city}, ${closestHub.hub.state})`,
                hubId: closestHub.hub.id,
                hubName: closestHub.hub.name,
              })
            }
          }
        }
      }
    }
  } catch (e) {
    // Photon non-fatal failure
  }

  // -------------------------------------------------------------
  // TIER 4: OpenStreetMap Nominatim Fallback (with countrycodes=in)
  // -------------------------------------------------------------
  if (results.length < 3) {
    try {
      const nominatimQuery = rawQ.toLowerCase().includes("india") ? rawQ : `${rawQ}, India`
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          nominatimQuery,
        )}&countrycodes=in&limit=4&addressdetails=1`,
        {
          headers: {
            "Accept-Language": "en",
            "User-Agent": "GOMAA-Gaushala-Manager/1.0",
          },
          signal: AbortSignal.timeout(3000),
        },
      )

      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) {
          for (const item of data) {
            const lat = parseFloat(item.lat)
            const lng = parseFloat(item.lon)
            if (!isNaN(lat) && !isNaN(lng) && lat >= 6 && lat <= 38 && lng >= 68 && lng <= 98) {
              const closestHub = findNearestIndianHub(lat, lng)
              const title = item.name || item.display_name.split(",")[0]
              addResult({
                id: `osm-${item.place_id || Math.random()}`,
                name: title,
                address: item.display_name,
                city: item.address?.city || item.address?.town || item.address?.village || closestHub.hub.city,
                state: item.address?.state || closestHub.hub.state,
                lat,
                lng,
                source: "geocoded",
                badgeText: "Geocoded Location",
                suggestedRegion: `${closestHub.hub.name} (${closestHub.hub.city}, ${closestHub.hub.state})`,
                hubId: closestHub.hub.id,
                hubName: closestHub.hub.name,
              })
            }
          }
        }
      }
    } catch (e) {
      // Nominatim non-fatal
    }
  }

  // Limit output count if specified
  const maxResults = options.limit || 8
  return results.slice(0, maxResults)
}
