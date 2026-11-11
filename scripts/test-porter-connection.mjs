import test from "node:test"
import assert from "node:assert/strict"
import {
  parseCleanCustomerLocation,
  calculatePorterQuotes,
  dispatchPorterRide,
  PORTER_VEHICLE_CATALOG,
} from "../src/services/porterService.ts"

test("Porter Service Suite 1: Clean Customer Location Parsing & Maps Generation", () => {
  const rawAddress = "Flat 402, Sai Krupa Apts, Near Hanuman Temple, Kondapur, Hyderabad"
  const distanceKm = 14.2
  const lat = 17.4682
  const lng = 78.3619

  const parsed = parseCleanCustomerLocation(rawAddress, distanceKm, lat, lng)

  assert.equal(parsed.fullAddress, rawAddress, "Preserves full customer destination address")
  assert.equal(parsed.city, "Hyderabad", "Correctly extracts destination city")
  assert.ok(parsed.landmark?.includes("Near Hanuman Temple"), "Detects street landmark for driver drop")
  assert.equal(parsed.lat, lat, "Maps destination latitude")
  assert.equal(parsed.lng, lng, "Maps destination longitude")
  assert.ok(parsed.googleMapsUrl.includes("17.4682,78.3619"), "Generates direct Google Maps directions URL")
  assert.equal(parsed.distanceKm, 14.2, "Standardizes distance to 1 decimal place")
  assert.ok(parsed.estimatedTransitMin >= 20, "Estimates realistic urban driving duration")
})

test("Porter Service Suite 2: Dynamic Distance-Based Rate Card Calculation", () => {
  const distanceKm = 15.0
  const quotes = calculatePorterQuotes(distanceKm)

  assert.equal(quotes.length, 3, "Returns quotes for all 3 Porter livestock vehicle classes")

  const tata407 = quotes.find((q) => q.vehicleId === "TATA_407_RAMP")
  assert.ok(tata407, "Tata 407 quote found")

  // Base 280 (incl 3km) + (15 - 3) * 18 = 280 + 216 = 496. Handling = 100. Subtotal = 596. GST 5% = 30. Total = 626.
  const expectedChargeableKm = 15 - 3
  const expectedDistFare = expectedChargeableKm * 18
  assert.equal(tata407.distanceFare, expectedDistFare, "Calculates accurate extra km charge")
  assert.equal(tata407.handlingFee, 100, "Includes cattle hydraulic ramp handling kit fee")
  assert.equal(tata407.totalFare, 280 + expectedDistFare + 100 + Math.round((280 + expectedDistFare + 100) * 0.05), "Total includes 5% GST pass-through")

  const bolero = quotes.find((q) => q.vehicleId === "BOLERO_MAXI_TRUCK")
  assert.ok(bolero, "Bolero Maxi quote found")
  assert.ok(bolero.totalFare > tata407.totalFare, "Heavy duty Bolero has premium rate for larger bulls")

  const tataAce = quotes.find((q) => q.vehicleId === "TATA_ACE_GOLD")
  assert.ok(tataAce, "Tata Ace quote found")
  assert.ok(tataAce.totalFare < tata407.totalFare, "Tata Ace Gold offers economy rate for dwarf/calf transport")
})

test("Porter Service Suite 3: Porter Dispatch & Tracking Payload Execution", () => {
  const payload = {
    bookingId: "GMA-24817",
    gaushalaName: "Shri Krishna Gaushala",
    pickupAddress: "Shri Krishna Gaushala Main Gate, Transit Bay, Hyderabad",
    pickupPhone: "+91 94220 11920",
    customerName: "Ananya Deshmukh",
    customerPhone: "+91 98204 11827",
    customerAddress: "14 Tulsi Nagar, Kondapur, Hyderabad",
    distanceKm: 12.5,
    vehicleId: "TATA_407_RAMP",
    vehicleName: "Tata 407 (8ft Open Bed + Ramp)",
    fare: 580,
  }

  const result = dispatchPorterRide(payload)

  assert.equal(result.success, true, "Dispatch executes successfully")
  assert.ok(result.porterBookingId.startsWith("POR-HYD-"), "Generates city-prefixed Porter Order ID (POR-HYD-XXXXX)")
  assert.ok(result.trackingUrl.includes("porter.in/track?order_id="), "Generates live customer tracking URL")
  assert.ok(result.driver.name.length > 0, "Assigns verified Porter partner driver")
  assert.ok(result.driver.phone.startsWith("+91"), "Assigns driver contact phone")
  assert.ok(result.driver.vehiclePlate.length > 5, "Assigns verified RTO vehicle plate")
  assert.equal(result.pickupAddress, payload.pickupAddress, "Accurately passes gaushala pickup address")
  assert.equal(result.dropAddress, payload.customerAddress, "Accurately passes clean customer destination drop")
  assert.equal(result.fare, 580, "Records exact agreed pass-through fare")
})
