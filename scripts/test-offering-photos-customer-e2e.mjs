import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import {
  getOfferingImage,
  OFFERING_PHOTO_PRESETS,
  DEFAULT_OFFERING_FALLBACK_IMAGE,
} from "../src/utils/offeringImages.ts"
import { DEFAULT_GOSALA_OFFERINGS } from "../src/data/gosalas.ts"

test("offering photography presets and smart resolver contract", () => {
  assert.ok(OFFERING_PHOTO_PRESETS.length >= 6, "Expected at least 6 sacred presets")
  assert.ok(DEFAULT_OFFERING_FALLBACK_IMAGE.startsWith("https://images.unsplash.com"))

  // Test keyword matching
  const malaImg = getOfferingImage({ name: "Marigold Pooja Mala", category: "puja" })
  assert.ok(malaImg.includes("596461404969"), "Expected marigold image to resolve")

  const grassImg = getOfferingImage({ name: "Fresh Green Grass Fodder", category: "feed" })
  assert.ok(grassImg.includes("1500382017468"), "Expected grass image to resolve")

  const gheeImg = getOfferingImage({ name: "Pure Vedic A2 Gir Cow Ghee (500ml)", category: "prasadam" })
  assert.ok(gheeImg.includes("1589927986089"), "Expected ghee image to resolve")

  // Direct image priority
  const customUrl = "https://example.com/custom-puja.jpg"
  assert.equal(getOfferingImage({ name: "Random Item", image: customUrl }), customUrl)
})

test("default gaushala offerings have curated photographs", () => {
  for (const offering of DEFAULT_GOSALA_OFFERINGS) {
    assert.ok(offering.image, `Offering ${offering.name} is missing curated image`)
    assert.ok(offering.image.startsWith("https://images.unsplash.com/"))
  }
})

test("GaushalaProfileView has photo upload, preset picker, and photo banners", () => {
  const code = readFileSync("src/views/manager/GaushalaProfileView.tsx", "utf8")
  assert.match(code, /getOfferingImage/)
  assert.match(code, /OFFERING_PHOTO_PRESETS/)
  assert.match(code, /handleOfferingPhotoFile/)
  assert.match(code, /FileReader/)
  assert.match(code, /readAsDataURL/)
  assert.match(code, /showPresetPicker/)
  assert.match(code, /image:\s*offeringImage\.trim\(\)/)
  // Check photo banner on cards
  assert.match(code, /img\s+src=\{photoSrc\}/)
  assert.match(code, /DEFAULT_OFFERING_FALLBACK_IMAGE/)
})

test("Pricing view has photo upload, preset picker, and photo banners for admin", () => {
  const code = readFileSync("src/views/Pricing.tsx", "utf8")
  assert.match(code, /getOfferingImage/)
  assert.match(code, /OFFERING_PHOTO_PRESETS/)
  assert.match(code, /handleItemPhotoFile/)
  assert.match(code, /FileReader/)
  assert.match(code, /readAsDataURL/)
  assert.match(code, /showItemPresets/)
  assert.match(code, /image:\s*itemImage\.trim\(\)/)
  assert.match(code, /img\s+src=\{photoSrc\}/)
})

test("BookingFlow propagates add-on photos through Step 3, Step 5, and Step 6", () => {
  const code = readFileSync("src/views/customer/BookingFlow.tsx", "utf8")
  assert.match(code, /getOfferingImage/)
  assert.match(code, /image:\s*item\.image\s*\|\|\s*item\.imageUrl/)
  assert.match(code, /image:\s*x\.image/)
  // Step 3 thumbnail
  assert.match(code, /getOfferingImage\(a\)/)
  // Step 5 itemized breakdown thumbnail
  assert.match(code, /getOfferingImage\(item\)/)
  // Step 6 confirmation thumbnail
  assert.match(code, /getOfferingImage\(item\)/)
})

test("CustomerApp and DesktopCustomer propagate items in effectiveGosala", () => {
  const custCode = readFileSync("src/views/CustomerApp.tsx", "utf8")
  assert.match(custCode, /items:\s*matchedStore\?\.items\s*\|\|\s*\(matchedStore as any\)\?\.metadata\?\.items/)

  const deskCode = readFileSync("src/views/customer/DesktopCustomer.tsx", "utf8")
  assert.match(deskCode, /items:\s*matchedStore\?\.items\s*\|\|\s*\(matchedStore as any\)\?\.metadata\?\.items/)
})

test("BookingFlow matches storeGosalas and dynamically extracts manager offerings", () => {
  const code = readFileSync("src/views/customer/BookingFlow.tsx", "utf8")
  assert.match(code, /storeGosalas\?\.find/)
  assert.match(code, /gaushalaItems\s*=\s*\(gosala as any\)\?\.items/)
})

test("server router preserves items and avoids currentMeta TDZ ReferenceError", () => {
  const code = readFileSync("server/router.ts", "utf8")
  // Check that currentMeta is declared before authUser.role === 'manager' inside PUT /api/gosalas/:id
  const putHandlerStart = code.indexOf("pathname.match(/^\\/api\\/gosalas\\/([^/]+)$/)")
  const subCode = code.slice(putHandlerStart)
  const declPos = subCode.indexOf("const currentMeta = (existing.metadata")
  const mgrRolePos = subCode.indexOf("if (authUser.role === \"manager\")")
  assert.ok(declPos > 0 && declPos < mgrRolePos, "currentMeta must be declared before manager role checks in PUT /api/gosalas/:id")
})

test("Customer booking with add-ons math and payload integrity end-to-end", () => {
  // Simulate customer selecting 2 items:
  // Item 1: Marigold Pooja Mala (₹150, qty 2)
  // Item 2: Pure Vedic A2 Ghee (₹650, qty 1)
  const item1 = DEFAULT_GOSALA_OFFERINGS[0] // Marigold Mala, ₹150
  const item2 = DEFAULT_GOSALA_OFFERINGS[4] // A2 Ghee, ₹650

  const qty = { [item1.id]: 2, [item2.id]: 1 }

  const selectedAddons = [item1, item2].map((it) => ({
    id: it.id,
    name: it.name,
    qty: qty[it.id],
    price: it.price,
    total: it.price * qty[it.id],
    image: getOfferingImage(it),
    category: it.category,
  }))

  const basePrice = 500 // Cow booking
  const transport = 180 // 10 km chargeable @ ₹18/km
  const addonsTotal = selectedAddons.reduce((acc, x) => acc + x.total, 0) // 150*2 + 950 = 1250
  assert.equal(addonsTotal, 1250)

  const subtotal = basePrice + transport + addonsTotal // 500 + 180 + 1250 = 1930
  assert.equal(subtotal, 1930)

  // 18% GST (or 0% if 80G exempt)
  const taxPct = 18
  const tax = Math.round((subtotal * taxPct) / 100) // 347
  assert.equal(tax, 347)

  const total = subtotal + tax // 2277
  assert.equal(total, 2277)

  // Verify booking payload preserves add-on photos
  const bookingSummary = {
    animal: "Gauri · Cow",
    animalName: "Gauri",
    animalType: "Cow",
    gosala: "Sri Krishna Gaushala",
    date: "2026-11-10",
    time: "09:00 - 10:00",
    base: basePrice,
    transport,
    addons: addonsTotal,
    tax,
    total,
    selectedAddons,
  }

  assert.equal(bookingSummary.selectedAddons.length, 2)
  assert.ok(bookingSummary.selectedAddons[0].image.includes("596461404969"))
  assert.ok(bookingSummary.selectedAddons[1].image.includes("1589927986089"))
  assert.equal(bookingSummary.selectedAddons[0].total, 300)
  assert.equal(bookingSummary.selectedAddons[1].total, 950)
})
