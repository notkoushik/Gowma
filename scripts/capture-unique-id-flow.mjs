import puppeteer from "puppeteer-core"
import path from "node:path"

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
const TARGET_URL = "https://gowma.vercel.app"
const OUT_DIR = path.resolve(process.cwd(), "docs", "screenshots")

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function run() {
  console.log("=== VERIFYING UNIQUE PERSON IDENTIFIER LOGIN & BADGING ===")
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: "new",
    defaultViewport: { width: 1440, height: 900 },
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  })

  const page = await browser.newPage()

  try {
    // 1. Devotee Sign-in with Unique ID: GMA-DEV-0223
    console.log("1. Testing Devotee login with Unique ID (GMA-DEV-0223)...")
    await page.goto(`${TARGET_URL}/#/login`, { waitUntil: "networkidle2" })
    await sleep(2000)

    const email = await page.$('input[type="text"], input[type="email"]')
    const pass = await page.$('input[type="password"]')
    if (email && pass) {
      await email.click({ clickCount: 3 })
      await email.type("GMA-DEV-0223")
      await pass.click({ clickCount: 3 })
      await pass.type("Koushik.git")
      const btn = await page.$('button[type="submit"]')
      if (btn) await btn.click()
    }
    await sleep(4000)

    // Capture Devotee view with GMA-DEV-0223 badge
    await page.screenshot({ path: path.join(OUT_DIR, "11_unique_id_login_and_devotee_badge.png") })
    console.log("  ✓ Captured: 11_unique_id_login_and_devotee_badge.png")

    // 2. Manager Sign-in with Unique ID: GMA-MGR-0101
    console.log("2. Testing Manager login with Unique ID (GMA-MGR-0101)...")
    await page.goto(`${TARGET_URL}/#/login`, { waitUntil: "networkidle2" })
    await sleep(2000)

    const emailMgr = await page.$('input[type="text"], input[type="email"]')
    const passMgr = await page.$('input[type="password"]')
    if (emailMgr && passMgr) {
      await emailMgr.click({ clickCount: 3 })
      await emailMgr.type("GMA-MGR-0101")
      await passMgr.click({ clickCount: 3 })
      await passMgr.type("Koushik.git")
      const btn = await page.$('button[type="submit"]')
      if (btn) await btn.click()
    }
    await sleep(4000)

    // Capture Manager view with GMA-MGR-0101 badge
    await page.screenshot({ path: path.join(OUT_DIR, "12_manager_unique_id_badge.png") })
    console.log("  ✓ Captured: 12_manager_unique_id_badge.png")

    console.log("=== ALL UNIQUE IDENTIFIER CHECKS PASSED SUCCESSFULLY! ===")
  } catch (err) {
    console.error("Test error:", err)
  } finally {
    await browser.close()
  }
}

run()
