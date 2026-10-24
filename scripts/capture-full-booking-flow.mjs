import puppeteer from "puppeteer-core"
import path from "node:path"

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
const TARGET_URL = "https://gowma.vercel.app"
const OUT_DIR = path.resolve(process.cwd(), "docs", "screenshots")

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function clickContinue(page, stepLabel) {
  console.log(`   Advancing from ${stepLabel}...`)
  await sleep(1000)
  const buttons = await page.$$("button")
  let clicked = false
  for (const b of buttons) {
    const text = await page.evaluate((el) => el.innerText, b)
    if (text && text.trim().startsWith("Continue")) {
      const isDisabled = await page.evaluate((el) => el.disabled || el.getAttribute("disabled") !== null, b)
      if (!isDisabled) {
        await b.click()
        clicked = true
        console.log(`   ✓ Clicked Continue button for ${stepLabel}`)
        break
      }
    }
  }
  await sleep(2000)
  return clicked
}

async function runBooking() {
  console.log("=== FULL DEVOTEE BOOKING WALKTHROUGH WITH DYNAMIC PRICING BREAKDOWN ===")
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: "new",
    defaultViewport: { width: 1440, height: 900 },
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  })

  const page = await browser.newPage()

  try {
    // 1. Sign In as Devotee
    console.log("1. Signing in as Devotee (devpulseorg@gmail.com)...")
    await page.goto(`${TARGET_URL}/#/login`, { waitUntil: "networkidle2" })
    await sleep(2000)

    const email = await page.$('input[type="text"], input[type="email"]')
    const pass = await page.$('input[type="password"]')
    if (email && pass) {
      await email.click({ clickCount: 3 })
      await email.type("devpulseorg@gmail.com")
      await pass.click({ clickCount: 3 })
      await pass.type("Koushik.git")
      const btn = await page.$('button[type="submit"]')
      if (btn) await btn.click()
    }
    await sleep(4000)

    // 2. Select Cow
    console.log("2. Navigating to Customer Cattle Catalog...")
    await page.goto(`${TARGET_URL}/#/customer`, { waitUntil: "networkidle2" })
    await sleep(3000)
    await page.evaluate(() => window.scrollBy(0, 650))
    await sleep(1000)

    const animalButtons = await page.$$("section button")
    for (const ab of animalButtons) {
      const text = await page.evaluate((el) => el.innerText, ab)
      if (text && text.includes("Surabhi")) {
        await ab.click()
        console.log("   Selected cow: Surabhi (Indigenous Gir Cow)")
        break
      }
    }
    await sleep(2500)

    // In detail view, click Book now
    const bookBtns = await page.$$("button")
    for (const b of bookBtns) {
      const text = await page.evaluate((el) => el.innerText, b)
      if (text && (text.includes("Book now") || text.includes("Book Gau Seva"))) {
        await b.click()
        console.log("   Clicked Book now CTA")
        break
      }
    }
    await sleep(2500)

    // Step 0: Date (1/6)
    console.log("3. Step 0 (Date): Proceeding to Time step...")
    await clickContinue(page, "Step 0 (Date)")

    // Step 1: Time Slot (2/6)
    console.log("4. Step 1 (Time Slot): Selecting available slot...")
    const slotBtns = await page.$$("button")
    for (const b of slotBtns) {
      const text = await page.evaluate((el) => el.innerText, b)
      if (text && text.includes("Available") && /\d{2}:\d{2}/.test(text)) {
        await b.click()
        console.log("   ✓ Picked slot:", text.replace(/\n/g, " "))
        break
      }
    }
    await sleep(1500)
    await clickContinue(page, "Step 1 (Time Slot)")

    // Step 2: Duration (3/6)
    console.log("5. Step 2 (Duration): Selecting Extended 90 min Seva...")
    const durBtns = await page.$$("button")
    for (const b of durBtns) {
      const text = await page.evaluate((el) => el.innerText, b)
      if (text && (text.includes("90 min") || text.includes("Extended"))) {
        await b.click()
        console.log("   ✓ Selected 90 min duration option")
        break
      }
    }
    await sleep(1000)
    await clickContinue(page, "Step 2 (Duration)")

    // Step 3: Addons (4/6)
    console.log("6. Step 3 (Offerings & Addons)...")
    await clickContinue(page, "Step 3 (Addons)")

    // Step 4: Address / Location (5/6)
    console.log("7. Step 4 (Ceremony Location)...")
    const locBtns = await page.$$("button")
    for (const b of locBtns) {
      const text = await page.evaluate((el) => el.innerText, b)
      if (text && (text.includes("km") || text.includes("Temple") || text.includes("Nagar"))) {
        await b.click()
        console.log("   ✓ Selected location:", text.replace(/\n/g, " "))
        break
      }
    }
    await sleep(1000)
    await clickContinue(page, "Step 4 (Location)")

    // Step 5: Review & Dynamic Pricing Summary (6/6)
    console.log("8. Step 5 reached! Scrolling inside modal to capture full price breakdown...")
    await sleep(2500)
    await page.evaluate(() => {
      const scrollables = document.querySelectorAll(".overflow-y-auto")
      scrollables.forEach((s) => (s.scrollTop = 420))
    })
    await sleep(1500)
    await page.screenshot({ path: path.join(OUT_DIR, "03_dynamic_pricing_commission_breakdown.png") })
    console.log("  ✓ Captured: 03_dynamic_pricing_commission_breakdown.png")

    // Click "Pay ... & Book"
    console.log("9. Clicking Pay & Book...")
    const payBtns = await page.$$("button")
    for (const b of payBtns) {
      const text = await page.evaluate((el) => el.innerText, b)
      if (text && text.includes("Pay ₹") && text.includes("Book")) {
        const isDisabled = await page.evaluate((el) => el.disabled || el.getAttribute("disabled") !== null, b)
        if (!isDisabled) {
          await b.click()
          console.log("   ✓ Clicked Pay CTA:", text.replace(/\n/g, " "))
          break
        }
      }
    }

    console.log("   Waiting for payment gateway handshake and verified confirmation...")
    await sleep(3500)

    // Capture devotee confirmed dossier modal
    await page.screenshot({ path: path.join(OUT_DIR, "04_devotee_booking_confirmed.png") })
    console.log("  ✓ Captured: 04_devotee_booking_confirmed.png")

    console.log("=== FULL BOOKING FLOW COMPLETED SUCCESSFULLY! ===")
  } catch (err) {
    console.error("Booking error:", err)
  } finally {
    await browser.close()
  }
}

runBooking()
