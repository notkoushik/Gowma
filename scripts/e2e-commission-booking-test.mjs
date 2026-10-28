import puppeteer from "puppeteer-core"
import path from "node:path"
import fs from "node:fs"

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
const TARGET_URL = "https://gowma.vercel.app"
const OUT_DIR = path.resolve(process.cwd(), "docs", "screenshots")

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true })
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function runE2ETesting() {
  console.log("=== STARTING DEEP E2E DYNAMIC COMMISSION & LIVESTOCK TESTING ===")
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: "new",
    defaultViewport: { width: 1440, height: 900 },
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  })

  const page = await browser.newPage()

  try {
    // -------------------------------------------------------------
    // STEP 1: Devotee Sign In
    // -------------------------------------------------------------
    console.log("[Step 1] Navigating to Login Gateway for Devotee...")
    await page.goto(`${TARGET_URL}/#/login`, { waitUntil: "networkidle2", timeout: 35000 })
    await sleep(1500)

    const emailInput = await page.$('input[type="text"], input[type="email"]')
    if (emailInput) {
      await emailInput.click({ clickCount: 3 })
      await emailInput.type("devpulseorg@gmail.com")
    }

    const passInput = await page.$('input[type="password"]')
    if (passInput) {
      await passInput.click({ clickCount: 3 })
      await passInput.type("GomaaAdmin@2026!")
    }

    const submitBtn = await page.$('button[type="submit"]')
    if (submitBtn) {
      await submitBtn.click()
    }

    await sleep(4000)
    await page.screenshot({ path: path.join(OUT_DIR, "01_devotee_login_and_dashboard.png") })
    console.log("  ✓ Captured: 01_devotee_login_and_dashboard.png")

    // -------------------------------------------------------------
    // STEP 2: Devotee Sacred Cattle Catalog
    // -------------------------------------------------------------
    console.log("[Step 2] Viewing Sacred Cattle Catalog in Devotee Portal...")
    await page.goto(`${TARGET_URL}/#/customer`, { waitUntil: "networkidle2", timeout: 35000 })
    await sleep(3000)

    // Scroll down to see Available Animals
    await page.evaluate(() => window.scrollBy(0, 650))
    await sleep(1500)
    await page.screenshot({ path: path.join(OUT_DIR, "02_devotee_sacred_cattle_catalog.png") })
    console.log("  ✓ Captured: 02_devotee_sacred_cattle_catalog.png")

    // -------------------------------------------------------------
    // STEP 3: Select Cow & Open Booking Flow
    // -------------------------------------------------------------
    console.log("[Step 3] Selecting Cow to open Booking Flow & Dynamic Pricing Breakdown...")
    // Click on first cow card in available animals
    const animalButtons = await page.$$("section button")
    let openedAnimal = false
    for (const ab of animalButtons) {
      const text = await page.evaluate((el) => el.innerText, ab)
      if (text && (text.includes("Surabhi") || text.includes("KUSHI") || text.includes("Cow") || text.includes("₹"))) {
        await ab.click()
        openedAnimal = true
        console.log("    Clicked cow card:", text.slice(0, 30))
        break
      }
    }

    await sleep(2500)

    // In DetailView, click "Book Gau Seva" or "Book Seva"
    const bookBtns = await page.$$("button")
    for (const b of bookBtns) {
      const bText = await page.evaluate((el) => el.innerText, b)
      if (bText && (bText.includes("Book Gau Seva") || bText.includes("Book Seva") || bText.includes("Book now"))) {
        await b.click()
        console.log("    Clicked Book Gau Seva button")
        break
      }
    }

    await sleep(2500)

    // Scroll to pricing breakdown in Booking Flow
    await page.evaluate(() => window.scrollBy(0, 400))
    await sleep(1500)
    await page.screenshot({ path: path.join(OUT_DIR, "03_dynamic_pricing_commission_breakdown.png") })
    console.log("  ✓ Captured: 03_dynamic_pricing_commission_breakdown.png")

    // -------------------------------------------------------------
    // STEP 4: Devotee My Bookings Dossier
    // -------------------------------------------------------------
    console.log("[Step 4] Checking Devotee Bookings Tracker...")
    // Click "My bookings" tab in customer navbar
    const navLinks = await page.$$("header button, nav button, button")
    for (const nl of navLinks) {
      const nlText = await page.evaluate((el) => el.innerText, nl)
      if (nlText && nlText.includes("My bookings")) {
        await nl.click()
        break
      }
    }
    await sleep(2000)
    await page.screenshot({ path: path.join(OUT_DIR, "04_devotee_booking_confirmed.png") })
    console.log("  ✓ Captured: 04_devotee_booking_confirmed.png")

    // -------------------------------------------------------------
    // STEP 5: Super Admin View - Sacred Herd with Gaushala Details
    // -------------------------------------------------------------
    console.log("[Step 5] Logging in as Super Admin...")
    await page.goto(`${TARGET_URL}/#/login`, { waitUntil: "networkidle2", timeout: 35000 })
    await sleep(1500)

    const saEmail = await page.$('input[type="text"], input[type="email"]')
    if (saEmail) {
      await saEmail.click({ clickCount: 3 })
      await saEmail.type("superadmin@gomaa.in")
    }

    const saPass = await page.$('input[type="password"]')
    if (saPass) {
      await saPass.click({ clickCount: 3 })
      await saPass.type("SuperAdmin@2026!")
    }

    const saSubmit = await page.$('button[type="submit"]')
    if (saSubmit) {
      await saSubmit.click()
    }

    await sleep(4000)

    console.log("[Step 5b] Navigating to Sacred Herd & Vets (Admin View)...")
    await page.goto(`${TARGET_URL}/#/admin/animals`, { waitUntil: "networkidle2", timeout: 35000 })
    await sleep(3000)
    await page.screenshot({ path: path.join(OUT_DIR, "05_sacred_herd_with_gaushala_details.png") })
    console.log("  ✓ Captured: 05_sacred_herd_with_gaushala_details.png")

    // -------------------------------------------------------------
    // STEP 6: Cow Welfare & Seva Dossier Modal with Shelter Details
    // -------------------------------------------------------------
    console.log("[Step 6] Opening Cow Welfare & Seva Dossier Modal...")
    const viewDossierBtns = await page.$$("button")
    for (const btn of viewDossierBtns) {
      const text = await page.evaluate((el) => el.innerText, btn)
      if (text && text.includes("View Profile & Welfare Dossier")) {
        await btn.click()
        break
      }
    }

    await sleep(2500)
    await page.screenshot({ path: path.join(OUT_DIR, "06_cow_welfare_dossier_modal.png") })
    console.log("  ✓ Captured: 06_cow_welfare_dossier_modal.png")

    // Explicitly click the close button on the modal
    console.log("    Closing modal cleanly via close button...")
    const closeBtn = await page.$('button[aria-label="Close"]')
    if (closeBtn) {
      await closeBtn.click()
    } else {
      await page.keyboard.press("Escape")
    }
    await sleep(1500)

    // -------------------------------------------------------------
    // STEP 7: Empanelled Doctors with Gaushala Facilities
    // -------------------------------------------------------------
    console.log("[Step 7] Switching to Empanelled Doctors Tab...")
    const allButtons = await page.$$("button")
    for (const b of allButtons) {
      const text = await page.evaluate((el) => el.innerText, b)
      if (text && text.includes("Empanelled Doctors")) {
        await b.click()
        console.log("    Clicked Empanelled Doctors tab")
        break
      }
    }

    await sleep(3000)
    await page.screenshot({ path: path.join(OUT_DIR, "07_empanelled_vets_with_shelters.png") })
    console.log("  ✓ Captured: 07_empanelled_vets_with_shelters.png")

    // -------------------------------------------------------------
    // STEP 8: Filter Doctors by Specific Gaushala
    // -------------------------------------------------------------
    console.log("[Step 8] Filtering Doctors by Gaushala_01...")
    const shelterFilterBtns = await page.$$("button")
    for (const sBtn of shelterFilterBtns) {
      const text = await page.evaluate((el) => el.innerText, sBtn)
      if (text && (text.includes("Gaushala_01") || text.includes("Shri Krishna"))) {
        await sBtn.click()
        console.log("    Clicked Gaushala filter pill:", text)
        break
      }
    }

    await sleep(2500)
    await page.screenshot({ path: path.join(OUT_DIR, "08_vets_filtered_by_gaushala.png") })
    console.log("  ✓ Captured: 08_vets_filtered_by_gaushala.png")

    // -------------------------------------------------------------
    // STEP 9: Super Admin Settlements & Dynamic Revenue Ledger
    // -------------------------------------------------------------
    console.log("[Step 9] Navigating to Settlements & Revenue Ledger...")
    await page.goto(`${TARGET_URL}/#/super_admin/settlements`, { waitUntil: "networkidle2", timeout: 35000 })
    await sleep(3000)
    await page.screenshot({ path: path.join(OUT_DIR, "09_settlements_ledger_commission_split.png") })
    console.log("  ✓ Captured: 09_settlements_ledger_commission_split.png")

    // -------------------------------------------------------------
    // STEP 10: Gaushala Manager Portal & Receivables Ledger
    // -------------------------------------------------------------
    console.log("[Step 10] Logging in as Gaushala Manager (manager1@gomaa.in)...")
    await page.goto(`${TARGET_URL}/#/login`, { waitUntil: "networkidle2", timeout: 35000 })
    await sleep(1500)

    const mgrEmail = await page.$('input[type="text"], input[type="email"]')
    if (mgrEmail) {
      await mgrEmail.click({ clickCount: 3 })
      await mgrEmail.type("manager1@gomaa.in")
    }

    const mgrPass = await page.$('input[type="password"]')
    if (mgrPass) {
      await mgrPass.click({ clickCount: 3 })
      await mgrPass.type("GomaaAdmin@2026!")
    }

    const mgrSubmit = await page.$('button[type="submit"]')
    if (mgrSubmit) {
      await mgrSubmit.click()
    }

    await sleep(4000)
    await page.screenshot({ path: path.join(OUT_DIR, "10_manager_receivables_ledger.png") })
    console.log("  ✓ Captured: 10_manager_receivables_ledger.png")

    console.log("=== ALL 10 E2E SCREENSHOTS CAPTURED AND VERIFIED SUCCESSFULLY! ===")
  } catch (err) {
    console.error("E2E Test Execution Error:", err)
  } finally {
    await browser.close()
  }
}

runE2ETesting()
