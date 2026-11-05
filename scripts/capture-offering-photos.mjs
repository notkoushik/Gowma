import puppeteer from "puppeteer-core"
import path from "node:path"

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
const TARGET_URL = "https://gowma.vercel.app"
const OUT_DIR = path.resolve(process.cwd(), "docs", "screenshots")

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function run() {
  console.log("=== CAPTURING OFFERING PHOTOS & CUSTOMER BOOKING FLOW VERIFICATION ===")
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: "new",
    defaultViewport: { width: 1440, height: 900 },
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  })

  const page = await browser.newPage()

  try {
    // 1. Manager view: Sacred Offerings tab
    console.log("1. Navigating to Manager Login...")
    await page.goto(`${TARGET_URL}/#/login`, { waitUntil: "networkidle2" })
    await sleep(2500)

    const emailInput = await page.$('input[type="text"], input[type="email"]')
    const passInput = await page.$('input[type="password"]')
    if (emailInput && passInput) {
      await emailInput.click({ clickCount: 3 })
      await emailInput.type("manager1@gomaa.in")
      await passInput.click({ clickCount: 3 })
      await passInput.type("Manager@2026!")
      const btn = await page.$('button[type="submit"]')
      if (btn) await btn.click()
    }
    await sleep(3500)

    console.log("2. Opening Gaushalas list & sanctum profile...")
    await page.goto(`${TARGET_URL}/#manager/gosalas`, { waitUntil: "networkidle2" })
    await sleep(3000)

    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button, a"))
      const profileBtn = btns.find((b) => {
        const txt = (b.textContent || "").toLowerCase()
        return txt.includes("sanctum profile") || txt.includes("view details") || txt.includes("sanctum")
      })
      if (profileBtn) profileBtn.click()
    })
    await sleep(2500)

    // Switch to Sacred Offerings tab
    console.log("3. Switching to 'Sacred Offerings & Store' tab...")
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"))
      const offTab = btns.find((b) => (b.textContent || "").includes("Sacred Offerings"))
      if (offTab) offTab.click()
    })
    await sleep(2500)

    await page.screenshot({
      path: path.join(OUT_DIR, "manager_sacred_offerings_with_photos.png"),
      fullPage: false,
    })
    console.log("  Saved: manager_sacred_offerings_with_photos.png")

    // Open Add Offering modal
    console.log("4. Opening Add Offering modal...")
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"))
      const addBtn = btns.find((b) => (b.textContent || "").includes("Add New Offering"))
      if (addBtn) addBtn.click()
    })
    await sleep(1500)

    // Click presets toggle
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"))
      const pBtn = btns.find((b) => (b.textContent || "").includes("Presets"))
      if (pBtn) pBtn.click()
    })
    await sleep(1000)

    await page.screenshot({
      path: path.join(OUT_DIR, "manager_add_offering_modal_photo_picker.png"),
      fullPage: false,
    })
    console.log("  Saved: manager_add_offering_modal_photo_picker.png")

    // 5. Customer Booking Flow
    console.log("5. Testing Customer Booking Flow...")
    await page.goto(`${TARGET_URL}/#/customer`, { waitUntil: "networkidle2" })
    await sleep(3000)

    // Click first "Book Darshan / Seva" or "Book Seva"
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"))
      const bookBtn = btns.find((b) => {
        const txt = (b.textContent || "").toLowerCase()
        return txt.includes("book") || txt.includes("darshan")
      })
      if (bookBtn) bookBtn.click()
    })
    await sleep(2000)

    // Step 0: Date
    await page.evaluate(() => {
      const dayBtns = Array.from(document.querySelectorAll("button")).filter(
        (b) => !b.disabled && b.textContent && !isNaN(Number(b.textContent.trim()))
      )
      if (dayBtns.length > 0) dayBtns[Math.min(2, dayBtns.length - 1)].click()
    })
    await sleep(500)

    // Click Next: Time
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"))
      const nextBtn = btns.find((b) => (b.textContent || "").includes("Select Time Slot") || (b.textContent || "").includes("Next"))
      if (nextBtn) nextBtn.click()
    })
    await sleep(1000)

    // Select Slot
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"))
      const slotBtn = btns.find((b) => (b.textContent || "").includes(":00") && !b.disabled)
      if (slotBtn) slotBtn.click()
    })
    await sleep(500)

    // Next: Duration
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"))
      const nextBtn = btns.find((b) => (b.textContent || "").includes("Duration") || (b.textContent || "").includes("Next"))
      if (nextBtn) nextBtn.click()
    })
    await sleep(1000)

    // Next: Add-ons (Step 3)
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"))
      const nextBtn = btns.find((b) => (b.textContent || "").includes("Add-ons") || (b.textContent || "").includes("Next"))
      if (nextBtn) nextBtn.click()
    })
    await sleep(1500)

    // Add 1 Marigold Mala and 1 Green Grass Fodder
    await page.evaluate(() => {
      const plusBtns = Array.from(document.querySelectorAll('button[aria-label="Increase"]'))
      if (plusBtns.length >= 2) {
        plusBtns[0].click()
        plusBtns[1].click()
      }
    })
    await sleep(1000)

    await page.screenshot({
      path: path.join(OUT_DIR, "customer_booking_addons_with_photos.png"),
      fullPage: false,
    })
    console.log("  Saved: customer_booking_addons_with_photos.png")

    console.log("=== VERIFICATION COMPLETE: ALL SCREENSHOTS SAVED ===")
  } catch (err) {
    console.error("Test capture error:", err.message)
  } finally {
    await browser.close()
  }
}

run()
