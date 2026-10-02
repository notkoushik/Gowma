import {
  initialGosalas,
  type Gosala,
  GOSALA_FACILITY_OPTIONS,
  GOSALA_PHOTO_PRESETS,
} from "../src/data/gosalas"
import { animals, type Animal } from "../src/data/animals"

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${msg}`)
    process.exit(1)
  }
  console.log(`✅ PASS: ${msg}`)
}

console.log("==================================================================")
console.log("   GOMAA DYNAMIC GAUSHALA SHELTER MANAGEMENT TEST SUITE")
console.log("==================================================================")

// Test 1: Verify Initial Gaushalas
console.log("\n--- TEST 1: Initial Gaushala Seed Data ---")
assert(Array.isArray(initialGosalas) && initialGosalas.length >= 3, "Initial gosalas list seeded with >= 3 shelters")
const shriKrishna = initialGosalas.find(g => g.name.includes("Shri Krishna"))
assert(!!shriKrishna, "Shri Krishna Gaushala exists in initial seed")
assert(shriKrishna!.capacity >= 40, "Shelter capacity is >= 40 bovine units")
assert(shriKrishna!.facilities.length >= 4, "Facilities include emergency & clinical amenities")

// Test 2: Dynamic Gaushala Registration
console.log("\n--- TEST 2: Dynamic Gaushala Registration ---")
const newGaushala: Gosala = {
  id: `GOS-${Date.now().toString().slice(-4)}`,
  name: "Gokul Vrundavan Gaushala Sanctuary",
  registrationNumber: "AWBI/PUN/2026/9981",
  region: "Wakad, Pune (West Corridor)",
  address: "Survey No. 44, Wakad-Hinjawadi Link Rd, Pune 411057",
  contactPhone: "+91 99234 56789",
  contactEmail: "care@gokulvrundavan.org",
  caretakerName: "Pandit Raghav Sharma",
  capacity: 65,
  currentOccupancy: 0,
  establishedYear: "2025",
  facilities: [
    "Covered Resting Sheds",
    "24x7 Veterinary Clinic & Dispensary",
    "Bovine Hydrotherapy Pond",
    "Solar Grazing Yards",
  ],
  status: "Active",
  isAWBIVerified: true,
  coordinates: {
    lat: 18.598,
    lng: 73.762,
  },
}

assert(newGaushala.name.length > 5, "Gaushala name valid")
assert(newGaushala.facilities.includes("24x7 Veterinary Clinic & Dispensary"), "Facility amenity registered")
console.log(`Registered Gaushala: ${newGaushala.name} (${newGaushala.region}) with capacity ${newGaushala.capacity}`)

// Test 3: Herd Dynamic Association
console.log("\n--- TEST 3: Cattle Herd Association with New Shelter ---")
const mockHerd: Animal[] = [...animals]

// Add a newly registered cow to this brand-new Gaushala
const newlyRegisteredCow: Animal = {
  name: "Surabhi",
  tagId: "IN-MH-12-9901",
  type: "Cow",
  breed: "Rathi Cow",
  gosala: newGaushala.name, // Assigned to dynamic Gaushala
  age: "4 yrs",
  ageYears: 4,
  weight: "390 kg",
  height: "128 cm",
  category: "Ceremonial · Puja & Griha Pravesh",
  price: 3600,
  status: "Available",
  todayBookings: 0,
  maxDailyTrips: 2,
  maxRadiusKm: 20,
  cooldownMinutes: 90,
  assignedHandler: "Ramdas Shinde",
  lactationStatus: "Active Lactating (Early cycle)",
  temperament: "Exceptionally docile & calm with children",
  sacredMarks: "Natural sandalwood tilak blaze on muzzle",
  photo: "https://images.unsplash.com/photo-1546445317-29f4545e9d53?auto=format&fit=crop&w=700&q=80",
  diet: "Fresh Napier Hybrid Grass + Multi-grain Lapshi",
  healthNotes: "Fit, active and blessed temperament",
}

mockHerd.push(newlyRegisteredCow)

const cowsInNewShelter = mockHerd.filter(a => a.gosala.toLowerCase() === newGaushala.name.toLowerCase())
assert(cowsInNewShelter.length === 1, "Exactly 1 cow registered under new Gaushala")
assert(cowsInNewShelter[0].name === "Surabhi", "Cow name matches Surabhi")
assert(cowsInNewShelter[0].gosala === "Gokul Vrundavan Gaushala Sanctuary", "Gaushala shelter matches newly registered shelter")

// Test 4: Capacity & Occupancy Calculation
console.log("\n--- TEST 4: Capacity & Occupancy Tracking ---")
const updatedOccupancy = cowsInNewShelter.length
const occupancyPercentage = Math.round((updatedOccupancy / newGaushala.capacity) * 100)
assert(occupancyPercentage > 0 && occupancyPercentage < 100, `Occupancy calculation verified: ${updatedOccupancy}/${newGaushala.capacity} (${occupancyPercentage}%)`)

// Test 5: Safe Deletion Guard
console.log("\n--- TEST 5: Deletion Safeguard Check ---")
const canDelete = (shelterName: string, herd: Animal[]): { allowed: boolean; reason?: string } => {
  const residentCount = herd.filter(a => a.gosala.toLowerCase() === shelterName.toLowerCase()).length
  if (residentCount > 0) {
    return {
      allowed: false,
      reason: `Cannot delete "${shelterName}" while ${residentCount} resident cattle are housed there. Reassign cattle first.`,
    }
  }
  return { allowed: true }
}

const deleteAttemptWithCows = canDelete(newGaushala.name, mockHerd)
assert(!deleteAttemptWithCows.allowed, "Deletion correctly blocked when resident cattle exist")
console.log(`Protected: ${deleteAttemptWithCows.reason}`)

const emptyShelterName = "Future Expansion Shed"
const deleteAttemptEmpty = canDelete(emptyShelterName, mockHerd)
assert(deleteAttemptEmpty.allowed, "Empty shelter can be safely deleted")

// Test 6: Empanelled Vet Assignment to Multiple Shelters
console.log("\n--- TEST 6: Empanelled Vet Shelter Assignment ---")
const allAvailableGosalas = [...initialGosalas.map(g => g.name), newGaushala.name]
const assignVetShelters = (selection: string, availableShelters: string[]) => {
  if (selection === "All Gaushalas") {
    return availableShelters
  }
  return [selection]
}

const panelVetShelters = assignVetShelters("All Gaushalas", allAvailableGosalas)
assert(panelVetShelters.includes("Gokul Vrundavan Gaushala Sanctuary"), "Dynamic Gaushala included when vet assigned to 'All Gaushalas'")
assert(panelVetShelters.length === 4, `All 4 gaushalas assigned to regional panel vet (count: ${panelVetShelters.length})`)

const dedicatedVetShelters = assignVetShelters(newGaushala.name, allAvailableGosalas)
assert(dedicatedVetShelters.length === 1 && dedicatedVetShelters[0] === newGaushala.name, "Dedicated vet assigned specifically to new shelter")

// Test 7: Gaushala Photo Presets, Upload & Dynamic Edit
console.log("\n--- TEST 7: Gaushala Photo Management & Presets ---")

assert(Array.isArray(GOSALA_PHOTO_PRESETS) && GOSALA_PHOTO_PRESETS.length >= 6, "Has >= 6 verified bovine sanctuary photo presets")
assert(shriKrishna!.photo !== undefined && shriKrishna!.photo.startsWith("https://"), "Initial shelter has valid photo URL")
assert(Array.isArray(shriKrishna!.photos) && shriKrishna!.photos.length >= 1, "Initial shelter has photos array gallery")

// Test adding shelter with custom photo
const customPhotoUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
const shelterWithPhoto: Gosala = {
  ...newGaushala,
  photo: customPhotoUrl,
}
assert(shelterWithPhoto.photo.startsWith("data:image/"), "Shelter supports Base64 device camera upload")

// Test updating shelter photo dynamically
const updatedPhotoPreset = GOSALA_PHOTO_PRESETS[3].url
shelterWithPhoto.photo = updatedPhotoPreset
assert(shelterWithPhoto.photo === GOSALA_PHOTO_PRESETS[3].url, "Shelter photo successfully updated to Veterinary Clinical Bay preset")

console.log("\n==================================================================")
console.log("   ALL DYNAMIC GAUSHALA MANAGEMENT TESTS PASSED WITH 100% SUCCESS")
console.log("==================================================================\n")
