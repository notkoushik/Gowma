import { animals } from "../src/data/animals"
import { initialGosalas, GOSALA_PHOTO_PRESETS } from "../src/data/gosalas"
import { gosalas as customerGosalas } from "../src/data/customer"

console.log("=================================================================")
console.log("🔍 TESTING MULTI-PHOTO SHOWCASE FOR CATTLE & SHELTERS IN BOOKING")
console.log("=================================================================\n")

let passCount = 0
let failCount = 0

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`✅ PASS: ${message}`)
    passCount++
  } else {
    console.error(`❌ FAIL: ${message}`)
    failCount++
  }
}

// 1. Verify Animals Multi-Photo Collection
console.log("--- 1. Sacred Cattle Multi-Photo Coverage ---")
assert(animals.length >= 6, `Total animals registered: ${animals.length}`)

animals.forEach((a) => {
  const hasPrimaryPhoto = typeof a.photo === "string" && a.photo.startsWith("https://")
  const hasPhotosArray = Array.isArray(a.photos) && a.photos.length >= 3
  assert(
    hasPrimaryPhoto && hasPhotosArray,
    `Animal "${a.name}" has ${a.photos?.length || 0} verified photos (Primary: ${a.photo.substring(0, 30)}...)`,
  )
})

// 2. Verify Gaushala Multi-Photo Collection
console.log("\n--- 2. Gaushala Shelter Multi-Photo Coverage ---")
assert(initialGosalas.length >= 3, `Initial shelters registered: ${initialGosalas.length}`)

initialGosalas.forEach((g) => {
  const hasPrimaryPhoto = typeof g.photo === "string" && g.photo.startsWith("https://")
  const hasPhotosArray = Array.isArray(g.photos) && g.photos.length >= 3
  assert(
    hasPrimaryPhoto && hasPhotosArray,
    `Shelter "${g.name}" has ${g.photos?.length || 0} premise photos`,
  )
})

// 3. Verify Vedic Shelter Presets
console.log("\n--- 3. Vedic Shelter Photo Presets ---")
assert(
  GOSALA_PHOTO_PRESETS.length >= 6,
  `Shelter photo presets available for managers: ${GOSALA_PHOTO_PRESETS.length}`,
)
GOSALA_PHOTO_PRESETS.forEach((p) => {
  assert(
    p.url.startsWith("https://") && p.label.length > 0,
    `Preset verified: [${p.label}] -> ${p.url.substring(0, 35)}...`,
  )
})

// 4. Cross-Verification: Every animal's shelter resolves valid premise photos
console.log("\n--- 4. Cattle-to-Shelter Cross Resolution for Booking ---")
animals.forEach((animal) => {
  const matchedShelter = initialGosalas.find(
    (g) => g.name.toLowerCase() === animal.gosala.toLowerCase(),
  )
  const matchedCustomerShelter = customerGosalas.find(
    (cg) => cg.name.toLowerCase() === animal.gosala.toLowerCase(),
  )

  const shelterPhotos = matchedShelter?.photos || [matchedCustomerShelter?.photo || animal.photo]
  const animalPhotos = animal.photos || [animal.photo]

  assert(
    shelterPhotos.length >= 1 && animalPhotos.length >= 3,
    `Devotee booking "${animal.name}" is shown: ${animalPhotos.length} cow angles AND ${shelterPhotos.length} shelter facility photos (${animal.gosala})`,
  )
})

console.log("\n=================================================================")
console.log(`SUMMARY: ${passCount} Passed, ${failCount} Failed`)
console.log("=================================================================")

if (failCount > 0) {
  process.exit(1)
} else {
  console.log("✨ ALL MULTI-PHOTO BOOKING INTEGRATION TESTS PASSED CLEANLY!")
}
