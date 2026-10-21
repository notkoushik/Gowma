import puppeteer from "puppeteer-core"
import path from "node:path"
import fs from "node:fs"

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
const TARGET_URL = "https://gowma.vercel.app"
const OUT_DIR = path.resolve(process.cwd(), "docs", "screenshots")

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true })
}

async function capture() {
  console.log("Launching Chrome for automated documentation screenshots...")
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
    // 1. Devotee Landing Page
    console.log("[1/7] Capturing Devotee Portal (Landing & Ceremony Booking)...")
    await page.goto(`${TARGET_URL}/#/customer`, { waitUntil: "networkidle2", timeout: 30000 })
    await new Promise((r) => setTimeout(r, 2000))
    await page.screenshot({ path: path.join(OUT_DIR, "01_devotee_landing.png") })

    // 2. Login Gateway
    console.log("[2/7] Capturing Login Gateway...")
    await page.goto(`${TARGET_URL}/#/login`, { waitUntil: "networkidle2", timeout: 30000 })
    await new Promise((r) => setTimeout(r, 1500))
    await page.screenshot({ path: path.join(OUT_DIR, "02_login_gateway.png") })

    // 3. Driver Console
    console.log("[3/7] Capturing Driver Telemetry Console...")
    await page.goto(`${TARGET_URL}/#/driver`, { waitUntil: "networkidle2", timeout: 30000 })
    await new Promise((r) => setTimeout(r, 2000))
    await page.screenshot({ path: path.join(OUT_DIR, "03_driver_console.png") })

    // 4. Authenticated Login as Super Admin
    console.log("[4/7] Logging in as Super Admin...")
    await page.goto(`${TARGET_URL}/#/login`, { waitUntil: "networkidle2", timeout: 30000 })
    await new Promise((r) => setTimeout(r, 1000))

    const emailInput = await page.$('input[type="text"], input[type="email"]')
    if (emailInput) {
      await emailInput.click({ clickCount: 3 })
      await emailInput.type("koushik@gmail.com")
    }

    const passInput = await page.$('input[type="password"]')
    if (passInput) {
      await passInput.click({ clickCount: 3 })
      await passInput.type("Koushik.git")
    }

    const submitBtn = await page.$('button[type="submit"]')
    if (submitBtn) {
      await submitBtn.click()
    }

    await new Promise((r) => setTimeout(r, 3500))

    // Capture Super Admin Overview
    console.log("[5/7] Capturing Super Admin Governance & Operations Admin views...")
    await page.screenshot({ path: path.join(OUT_DIR, "04_superadmin_overview.png") })

    // Gaushalas Directory
    await page.goto(`${TARGET_URL}/#/admin/gosalas`, { waitUntil: "networkidle2", timeout: 30000 })
    await new Promise((r) => setTimeout(r, 2000))
    await page.screenshot({ path: path.join(OUT_DIR, "05_admin_gaushalas_network.png") })

    // Custodians Matrix
    await page.goto(`${TARGET_URL}/#/admin/managers`, { waitUntil: "networkidle2", timeout: 30000 })
    await new Promise((r) => setTimeout(r, 2000))
    await page.screenshot({ path: path.join(OUT_DIR, "06_admin_custodians_matrix.png") })

    // Click Reassign Custodian button to capture the Reassign Modal
    try {
      const reassignBtns = await page.$$("button")
      for (const btn of reassignBtns) {
        const text = await page.evaluate((el) => el.innerText, btn)
        if (text && (text.includes("Reassign") || text.includes("Assign"))) {
          await btn.click()
          await new Promise((r) => setTimeout(r, 1000))
          await page.screenshot({ path: path.join(OUT_DIR, "07_reassign_custodian_modal.png") })
          console.log("  ✓ Captured Reassign Custodian Modal")
          // Close modal
          await page.keyboard.press("Escape")
          break
        }
      }
    } catch (e) {
      console.warn("Could not open reassign modal:", e.message)
    }

    // Bookings Audit
    await page.goto(`${TARGET_URL}/#/admin/bookings`, { waitUntil: "networkidle2", timeout: 30000 })
    await new Promise((r) => setTimeout(r, 2000))
    await page.screenshot({ path: path.join(OUT_DIR, "08_admin_bookings_audit.png") })

    // Animals Welfare
    await page.goto(`${TARGET_URL}/#/admin/animals`, { waitUntil: "networkidle2", timeout: 30000 })
    await new Promise((r) => setTimeout(r, 2000))
    await page.screenshot({ path: path.join(OUT_DIR, "09_admin_animals_welfare.png") })

    // Pricing Arranger
    await page.goto(`${TARGET_URL}/#/super_admin/pricing`, { waitUntil: "networkidle2", timeout: 30000 })
    await new Promise((r) => setTimeout(r, 2000))
    await page.screenshot({ path: path.join(OUT_DIR, "10_superadmin_pricing_arranger.png") })

    // Settlements Ledger
    await page.goto(`${TARGET_URL}/#/super_admin/settlements`, { waitUntil: "networkidle2", timeout: 30000 })
    await new Promise((r) => setTimeout(r, 2000))
    await page.screenshot({ path: path.join(OUT_DIR, "11_superadmin_settlements_ledger.png") })

    // 6. Authenticate as Gaushala Manager (manager1@gomaa.in)
    console.log("[6/7] Logging in as Gaushala Manager (manager1@gomaa.in)...")
    await page.goto(`${TARGET_URL}/#/login`, { waitUntil: "networkidle2", timeout: 30000 })
    await new Promise((r) => setTimeout(r, 1000))

    const mEmailInput = await page.$('input[type="text"], input[type="email"]')
    if (mEmailInput) {
      await mEmailInput.click({ clickCount: 3 })
      await mEmailInput.type("manager1@gomaa.in")
    }

    const mPassInput = await page.$('input[type="password"]')
    if (mPassInput) {
      await mPassInput.click({ clickCount: 3 })
      await mPassInput.type("Koushik.git")
    }

    const mSubmitBtn = await page.$('button[type="submit"]')
    if (mSubmitBtn) {
      await mSubmitBtn.click()
    }

    await new Promise((r) => setTimeout(r, 3500))
    await page.screenshot({ path: path.join(OUT_DIR, "12_manager_facility_dashboard.png") })

    // 7. Operations Admin (alt.yq-fs88dj2@yopmail.com)
    console.log("[7/7] Logging in as Operations Admin (alt.yq-fs88dj2@yopmail.com)...")
    await page.goto(`${TARGET_URL}/#/login`, { waitUntil: "networkidle2", timeout: 30000 })
    await new Promise((r) => setTimeout(r, 1000))

    const admEmailInput = await page.$('input[type="text"], input[type="email"]')
    if (admEmailInput) {
      await admEmailInput.click({ clickCount: 3 })
      await admEmailInput.type("alt.yq-fs88dj2@yopmail.com")
    }

    const admPassInput = await page.$('input[type="password"]')
    if (admPassInput) {
      await admPassInput.click({ clickCount: 3 })
      await admPassInput.type("Koushik.git")
    }

    const admSubmitBtn = await page.$('button[type="submit"]')
    if (admSubmitBtn) {
      await admSubmitBtn.click()
    }

    await new Promise((r) => setTimeout(r, 3500))
    await page.screenshot({ path: path.join(OUT_DIR, "13_operations_admin_portal.png") })

    console.log("All screenshots captured successfully in docs/screenshots/!")
  } catch (err) {
    console.error("Screenshot capture error:", err)
  } finally {
    await browser.close()
  }
}

capture()
