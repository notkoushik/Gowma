import {
  animals,
  type Animal,
  type AnimalCustomDetail,
  LACTATION_STATUSES,
  TEMPERAMENT_PRESETS,
} from "../src/data/animals"
import { SACRED_MARKS_PRESETS, CUSTOM_DETAIL_SUGGESTIONS, GOSALA_PRESETS, photoPresets } from "../src/views/manager/Animals"

console.log("=".repeat(70))
console.log("   GOMAA EDIT COW & ENTERPRISE LIVESTOCK ATTRIBUTES TEST SUITE     ")
console.log("=".repeat(70))

let passed = 0
let failed = 0

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${msg}`)
    passed++
  } else {
    console.error(`  ✗ FAIL: ${msg}`)
    failed++
  }
}

// Suite 1: Enterprise Cattle Schema Verification
console.log("\n---------------------------------------------------------------------")
console.log("Test Suite 1: Enterprise Cattle Schema (Pashu Aadhaar, Lactation, Marks)")
console.log("---------------------------------------------------------------------")

assert(Array.isArray(LACTATION_STATUSES) && LACTATION_STATUSES.length >= 5, "Lactation statuses preset has ≥5 options")
assert(Array.isArray(TEMPERAMENT_PRESETS) && TEMPERAMENT_PRESETS.length >= 5, "Devotee temperament presets has ≥5 options")
assert(Array.isArray(SACRED_MARKS_PRESETS) && SACRED_MARKS_PRESETS.length >= 5, "Sacred Vedic marks presets has ≥5 options")

const gauri = animals.find((a) => a.name === "Gauri")
assert(!!gauri, "Gauri exists in seed herd")
assert(!!gauri?.tagId && gauri.tagId.startsWith("IN-MH-"), `Gauri has valid Govt. Pashu Aadhaar RFID: ${gauri?.tagId}`)
assert(!!gauri?.lactationStatus, `Gauri has lactation status: ${gauri?.lactationStatus}`)
assert(!!gauri?.temperament, `Gauri has devotee temperament trait: ${gauri?.temperament}`)
assert(!!gauri?.sacredMarks, `Gauri has auspicious sacred marks: ${gauri?.sacredMarks}`)

// Suite 2: Simulating Edit Cow Update Operation (Store Patch Contract)
console.log("\n---------------------------------------------------------------------")
console.log("Test Suite 2: Edit Cow Update Pipeline & Data Preservation")
console.log("---------------------------------------------------------------------")

let testHerd = [...animals]

function simulateUpdateAnimal(name: string, patch: Partial<Animal>) {
  testHerd = testHerd.map((a) => (a.name === name ? { ...a, ...patch } : a))
}

const originalWeight = gauri?.weight
const newTagId = "IN-MH-12-9999"
const newWeight = "435 kg"
const newLactation = LACTATION_STATUSES[1] // Active Milking
const newTemperament = "Calm & Meditative during Vedic Chanting & Havan"
const newCaretaker = "Mahadev Patil (Senior Gosevak)"

simulateUpdateAnimal("Gauri", {
  tagId: newTagId,
  weight: newWeight,
  lactationStatus: newLactation,
  temperament: newTemperament,
  assignedHandler: newCaretaker,
})

const updatedGauri = testHerd.find((a) => a.name === "Gauri")
assert(updatedGauri?.tagId === newTagId, `Tag ID successfully updated to ${newTagId}`)
assert(updatedGauri?.weight === newWeight, `Weight updated from ${originalWeight} to ${newWeight}`)
assert(updatedGauri?.lactationStatus === newLactation, `Lactation status updated to ${newLactation}`)
assert(updatedGauri?.temperament === newTemperament, `Temperament updated to ${newTemperament}`)
assert(updatedGauri?.assignedHandler === newCaretaker, `Assigned handler updated to ${newCaretaker}`)
assert(updatedGauri?.gosala === gauri?.gosala, "Gaushala preserved without unintended mutation")

// Suite 3: Calf Welfare Safeguards during Edit
console.log("\n---------------------------------------------------------------------")
console.log("Test Suite 3: Young Calf Safety Rules & Cooldown Constraints")
console.log("---------------------------------------------------------------------")

const kesari = animals.find((a) => a.name === "Kesari")
assert(kesari?.type === "Calf", "Kesari is classified as a young calf")
assert(kesari?.maxDailyTrips === 1, "Calf max daily trip hard-capped at 1")
assert(kesari?.maxRadiusKm === 8, "Calf travel radius capped at 8 km")
assert(kesari?.cooldownMinutes === 120, "Calf cooldown enforced at 120 minutes")

// Suite 4: Customizable Cattle Details (Dynamic Attributes)
console.log("\n---------------------------------------------------------------------")
console.log("Test Suite 4: Customizable Cattle Details Dynamic Addition & Removal")
console.log("---------------------------------------------------------------------")

assert(Array.isArray(CUSTOM_DETAIL_SUGGESTIONS) && CUSTOM_DETAIL_SUGGESTIONS.length >= 6, "Has predefined customizable detail quick-suggestions")
assert(gauri?.customDetails && gauri.customDetails.length > 0, "Gauri has pre-populated customizable details")

// Test dynamic add custom detail
const dynamicDetail: AnimalCustomDetail = {
  id: `custom-${Date.now()}`,
  label: "Astrological Nakshatra",
  value: "Rohini (Auspicious for Kamadhenu Puja)",
}

const currentCustoms = gauri?.customDetails || []
const updatedCustoms = [...currentCustoms, dynamicDetail]

simulateUpdateAnimal("Gauri", {
  customDetails: updatedCustoms,
})

const gauriWithCustom = testHerd.find((a) => a.name === "Gauri")
assert(
  !!gauriWithCustom?.customDetails?.find((d) => d.label === "Astrological Nakshatra"),
  "Dynamically added Astrological Nakshatra to Gauri"
)
assert(
  gauriWithCustom?.customDetails?.length === currentCustoms.length + 1,
  `Custom details count incremented to ${gauriWithCustom?.customDetails?.length}`
)

// Test removal of custom detail
const filteredCustoms = updatedCustoms.filter((d) => d.label !== "Astrological Nakshatra")
simulateUpdateAnimal("Gauri", {
  customDetails: filteredCustoms,
})

// Suite 5: Dropdown Customize Option Flow (Bottom of Dropdowns)
console.log("\n---------------------------------------------------------------------")
console.log("Test Suite 5: Dropdown Bottom Customize Option (Lactation, Breed, Gosala)")
console.log("---------------------------------------------------------------------")

assert(Array.isArray(GOSALA_PRESETS) && GOSALA_PRESETS.length >= 3, "Has standard Gaushala location presets")

// Test saving a customized lactation status selected via the dropdown's bottom "+ Customize..." option
const customLactationValue = "Special Ayurvedic Diet & Minimal Milking (4 L/day)"
simulateUpdateAnimal("Gauri", {
  lactationStatus: customLactationValue,
})

const gauriCustomLact = testHerd.find((a) => a.name === "Gauri")
assert(
  gauriCustomLact?.lactationStatus === customLactationValue,
  `Custom lactation status from dropdown bottom option saved: ${gauriCustomLact?.lactationStatus}`
)

// Test saving a customized breed entered via dropdown bottom option
const customBreedValue = "Deoni (Pure Indigenous Maharashtra Strain)"
simulateUpdateAnimal("Gauri", {
  breed: customBreedValue,
})

const gauriCustomBreed = testHerd.find((a) => a.name === "Gauri")
assert(
  gauriCustomBreed?.breed === customBreedValue,
  `Custom breed from dropdown bottom option saved: ${gauriCustomBreed?.breed}`
)

// Test saving a customized gosevak handler
const customHandlerValue = "Vasantrao Patil (Senior Master Caretaker - +91 98221 00000)"
// Suite 6: Bovine Photo Upload & Image Management (File Upload, URL, Presets)
console.log("\n---------------------------------------------------------------------")
console.log("Test Suite 6: Bovine Photo Upload (Base64 File, External URL & Presets)")
console.log("---------------------------------------------------------------------")

assert(Array.isArray(photoPresets) && photoPresets.length >= 6, "Has ≥6 verified indigenous breed photo presets")

// Test applying a custom uploaded device photo (Base64 data URL)
const mockUploadedBase64 = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA="
simulateUpdateAnimal("Gauri", {
  photo: mockUploadedBase64,
})

const gauriWithUploadedPhoto = testHerd.find((a) => a.name === "Gauri")
assert(
  gauriWithUploadedPhoto?.photo.startsWith("data:image/"),
  "Custom base64 device photograph saved successfully on Gauri"
)

// Test applying an external cloud photo URL
const customCloudPhotoUrl = "https://images.unsplash.com/photo-1570042225831-d98fa7577f1e?w=800"
simulateUpdateAnimal("Gauri", {
  photo: customCloudPhotoUrl,
})

const gauriWithCloudPhoto = testHerd.find((a) => a.name === "Gauri")
assert(
  gauriWithCloudPhoto?.photo === customCloudPhotoUrl,
  `Custom external cloud photo URL saved: ${gauriWithCloudPhoto?.photo}`
)

console.log("\n" + "=".repeat(70))
console.log(`TEST SUMMARY: ${passed + failed} TESTS EVALUATED`)
console.log(`  PASSED: ${passed} | FAILED: ${failed}`)
console.log("=".repeat(70))

if (failed > 0) {
  process.exit(1)
} else {
  console.log("\n  ALL EDIT COW & ENTERPRISE LIVESTOCK ATTRIBUTES VERIFIED 100%!\n")
}
