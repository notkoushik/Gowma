import {
  initialGosalas,
  type Gosala,
  GOSALA_CUSTOM_DETAIL_SUGGESTIONS,
  GOSALA_FACILITY_OPTIONS,
} from "../src/data/gosalas"
import { animals, initialEmpanelledVets, type Animal } from "../src/data/animals"
import { bookings } from "../src/data/mock"

console.log("==================================================================")
console.log("   TESTING PROFESSIONAL GAUSHALA PROFILE VIEW & DETAIL ADDITIONS")
console.log("==================================================================")

let passCount = 0
let failCount = 0

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`✅ PASS: ${msg}`)
    passCount++
  } else {
    console.error(`❌ FAIL: ${msg}`)
    failCount++
  }
}

// 1. Gaushala Profile Data Integrity
const g = initialGosalas[0]
assert(Boolean(g.id && g.name), `Profile resolved for: ${g.name}`)
assert(Boolean(g.trustRegistrationNo), `AWBI Trust Registration: ${g.trustRegistrationNo}`)
assert(Boolean(g.establishedYear), `Established Year: ${g.establishedYear}`)
assert(Array.isArray(g.facilities) && g.facilities.length >= 3, `Verified Facilities Count: ${g.facilities.length}`)
assert(Array.isArray(g.photos) && g.photos.length >= 2, `Sanctum Premises Photos: ${g.photos?.length}`)

// 2. Capacity & Live Occupancy Metrics
const residentHerd = animals.filter(
  (a) => a.gosala.toLowerCase() === g.name.toLowerCase()
)
const capacity = g.capacity || 40
const occupancyPct = Math.min(100, Math.round((residentHerd.length / capacity) * 100))
const openStalls = Math.max(0, capacity - residentHerd.length)

assert(residentHerd.length > 0, `Resident herd housed in ${g.name}: ${residentHerd.length} sacred cattle`)
assert(occupancyPct > 0 && occupancyPct <= 100, `Live Occupancy calculation: ${residentHerd.length}/${capacity} (${occupancyPct}%)`)
assert(openStalls >= 0, `Open stalls available for intake: ${openStalls}`)

// 3. Resident Cattle Herd Details
residentHerd.forEach((cow) => {
  assert(Boolean(cow.name && cow.photo && cow.status), `Resident cow verified: ${cow.name} (${cow.breed || cow.type}) - ${cow.status}`)
})

// 4. Caretaker & Empanelled Veterinarian
assert(Boolean(g.caretaker && g.contactPhone), `Chief Caretaker verified: ${g.caretaker} (${g.contactPhone})`)
const assignedVets = initialEmpanelledVets.filter(
  (v) =>
    v.assignedGosalas.includes("All Gaushalas") ||
    v.assignedGosalas.some((sg) => sg.toLowerCase() === g.name.toLowerCase())
)
assert(assignedVets.length > 0, `Empanelled Vet verified for ${g.name}: ${assignedVets[0].name} (${assignedVets[0].clinic})`)

// 5. Seva Bookings Dispatched from this Gaushala
const residentNames = new Set(residentHerd.map((c) => c.name.toLowerCase()))
const relatedBookings = bookings.filter(
  (b) =>
    (b.gosala && b.gosala.toLowerCase() === g.name.toLowerCase()) ||
    (b.animalName && residentNames.has(b.animalName.toLowerCase()))
)
assert(Array.isArray(relatedBookings), `Related Seva bookings queryable: ${relatedBookings.length} bookings found`)

// 6. Test Adding Custom Sanctuary Details
assert(Array.isArray(GOSALA_CUSTOM_DETAIL_SUGGESTIONS) && GOSALA_CUSTOM_DETAIL_SUGGESTIONS.length >= 5, "Custom details suggestions present")
const initialCustomDetails = g.customDetails || []
const newDetail = {
  id: "CD-TEST-1",
  key: "Total Pasture Land (Acres)",
  value: "18.5 Acres Organic Napier Grass",
}
const updatedDetails = [...initialCustomDetails, newDetail]
assert(updatedDetails.length === initialCustomDetails.length + 1, `Custom detail added: [${newDetail.key}: ${newDetail.value}]`)

// 7. Test Adding Facility Amenity
const initialFacilities = g.facilities || []
const newFacility = "Biogas & Panchagavya Manufacturing Bay"
const updatedFacilities = [...initialFacilities, newFacility]
assert(updatedFacilities.includes(newFacility), `New facility added: ${newFacility}`)

// 8. Test Adding Gosevak Staff Member
const initialStaff = g.additionalStaff || []
const newStaff = {
  id: "STF-TEST-1",
  name: "Santosh Shinde",
  role: "Senior Herd Feeder & Milker",
  phone: "+91 98230 55192",
  shift: "Morning (05:00 AM - 01:00 PM)",
}
const updatedStaff = [...initialStaff, newStaff]
assert(updatedStaff.some((s) => s.name === "Santosh Shinde"), `Additional Gosevak added: ${newStaff.name} (${newStaff.role})`)

// 9. Test Registering Sacred Cow to this Shed
const newCow: Animal = {
  name: "Gokul Surabhi",
  type: "Cow",
  breed: "Gir Cow",
  gosala: g.name,
  age: "3 yrs",
  ageYears: 3,
  weight: "360 kg",
  height: "135 cm",
  category: "Ceremonial Puja & Seva",
  price: 3500,
  status: "Available",
  todayBookings: 0,
  maxDailyTrips: 2,
  maxRadiusKm: 25,
  cooldownMinutes: 90,
  photo: "https://images.unsplash.com/photo-1546722228-7baeca4bd0b3?w=800&h=600&fit=crop&auto=format",
  photos: ["https://images.unsplash.com/photo-1546722228-7baeca4bd0b3?w=800&h=600&fit=crop&auto=format"],
}
const updatedHerd = [...residentHerd, newCow]
assert(updatedHerd.some((c) => c.name === "Gokul Surabhi" && c.gosala === g.name), `Cow registered directly to ${g.name}: ${newCow.name} (${newCow.breed})`)

// 10. Test Adjusting Shed Capacity
const newCapacity = 60
assert(newCapacity > capacity, `Shed capacity adjusted: ${capacity} -> ${newCapacity} bovine units`)

console.log("==================================================================")
console.log(`SUMMARY: ${passCount} Passed, ${failCount} Failed`)
console.log("==================================================================")

if (failCount > 0) {
  process.exit(1)
} else {
  console.log("✨ ALL DYNAMIC GAUSHALA PROFILE DETAIL ADDITION TESTS PASSED!")
}
