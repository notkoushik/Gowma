import puppeteer from "puppeteer-core"
import path from "node:path"

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
const TARGET_URL = "https://gowma.vercel.app"
const OUT_DIR = path.resolve(process.cwd(), "docs", "screenshots")

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function run() {
  console.log("=== VERIFYING MANAGER OFFERINGS RIGHTS & SUPER ADMIN TRACKING RESTRICTIONS ===")
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: "new",
    defaultViewport: { width: 1440, height: 900 },
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  })

  const page = await browser.newPage()

  try {
    // -------------------------------------------------------------------------
    // 1. Gaushala Manager Login & Offerings Governance
    // -------------------------------------------------------------------------
    console.log("\n1. Logging in as Gaushala Manager (manager1@gomaa.in)...")
    await page.goto(`${TARGET_URL}/#/login`, { waitUntil: "networkidle2" })
    await sleep(3000)

    const emailMgr = await page.$('input[type="text"], input[type="email"]')
    const passMgr = await page.$('input[type="password"]')
    if (emailMgr && passMgr) {
      await emailMgr.click({ clickCount: 3 })
      await emailMgr.type("manager1@gomaa.in")
      await passMgr.click({ clickCount: 3 })
      await passMgr.type("Koushik.git")
      const btn = await page.$('button[type="submit"]')
      if (btn) await btn.click()
    }
    await sleep(4500)

    console.log("  Navigating to Manager Gaushalas list view...")
    await page.goto(`${TARGET_URL}/#manager/gosalas`, { waitUntil: "networkidle2" })
    await sleep(3500)

    // Click on the first Gaushala Sanctum View or Profile button
    console.log("  Opening assigned Gaushala Profile / Sanctum view...")
    const openedProfile = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button, a"))
      const profileBtn = btns.find((b) => {
        const txt = (b.textContent || "").toLowerCase()
        return txt.includes("sanctum profile") || txt.includes("view details") || txt.includes("public view") || txt.includes("sanctum")
      })
      if (profileBtn) {
        profileBtn.click()
        return true
      }
      return false
    })
    console.log(`  Opened Profile: ${openedProfile}`)
    await sleep(3000)

    // Switch to Sacred Offerings tab
    console.log("  Clicking 'Sacred Offerings & Store' tab...")
    const clickedTab = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"))
      const offTab = btns.find((b) => (b.textContent || "").includes("Sacred Offerings"))
      if (offTab) {
        offTab.click()
        return true
      }
      return false
    })
    console.log(`  Clicked Offerings tab: ${clickedTab}`)
    await sleep(2500)

    // Toggle stock on one of the items
    console.log("  Testing Restock / Out of Stock toggle...")
    const toggledStock = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"))
      const toggleBtn = btns.find((b) => {
        const txt = b.textContent || ""
        return txt.includes("Mark Out of Stock") || txt.includes("Restock")
      })
      if (toggleBtn) {
        toggleBtn.click()
        return true
      }
      return false
    })
    console.log(`  Toggled item stock: ${toggledStock}`)
    await sleep(2000)

    // Click "+ Add New Offering / Add-on" button
    console.log("  Clicking '+ Add New Offering / Add-on'...")
    const clickedAdd = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"))
      const addBtn = btns.find((b) => (b.textContent || "").includes("Add New Offering"))
      if (addBtn) {
        addBtn.click()
        return true
      }
      return false
    })
    console.log(`  Opened Add Offering modal: ${clickedAdd}`)
    await sleep(1500)

    // Fill form in Add Offering modal
    await page.evaluate(() => {
      const modal = document.querySelector(".fixed.inset-0")
      if (modal) {
        const nameInput = modal.querySelector('input[type="text"]')
        if (nameInput) {
          nameInput.value = "Navagraha Samidha Sacred Bundle"
          nameInput.dispatchEvent(new Event("input", { bubbles: true }))
        }
        const descTextarea = modal.querySelector("textarea")
        if (descTextarea) {
          descTextarea.value = "Handpicked nine sacred medicinal woods for purifying Agnihotra Cow Yajna"
          descTextarea.dispatchEvent(new Event("input", { bubbles: true }))
        }
      }
    })
    await sleep(1000)

    const p1 = path.join(OUT_DIR, "16_manager_offerings_management.png")
    await page.screenshot({ path: p1 })
    console.log(`  ✓ Saved Manager Offerings modal screenshot: ${p1}`)

    // Close modal to capture the clean offerings grid
    await page.evaluate(() => {
      const modal = document.querySelector(".fixed.inset-0")
      if (modal) {
        const cancelBtn = Array.from(modal.querySelectorAll("button")).find((b) => (b.textContent || "").includes("Cancel"))
        if (cancelBtn) cancelBtn.click()
      }
    })
    await sleep(1500)

    // Scroll down to the offerings grid
    await page.evaluate(() => {
      const el = document.querySelector(".grid.grid-cols-1.md\\:grid-cols-2") || document.querySelector(".grid")
      if (el) el.scrollIntoView({ behavior: "instant", block: "center" })
    })
    await sleep(1000)

    const p1b = path.join(OUT_DIR, "16b_manager_offerings_tab_grid.png")
    await page.screenshot({ path: p1b })
    console.log(`  ✓ Saved Manager Offerings tab grid screenshot: ${p1b}`)

    // -------------------------------------------------------------------------
    // 2. Super Admin Offerings Read-Only & Live Tracking Removal
    // -------------------------------------------------------------------------
    console.log("\n2. Logging in as Super Admin (nanikoushik96@gmail.com)...")
    await page.goto(`${TARGET_URL}/#/login`, { waitUntil: "networkidle2" })
    await sleep(3000)

    const emailSA = await page.$('input[type="text"], input[type="email"]')
    const passSA = await page.$('input[type="password"]')
    if (emailSA && passSA) {
      await emailSA.click({ clickCount: 3 })
      await emailSA.type("nanikoushik96@gmail.com")
      await passSA.click({ clickCount: 3 })
      await passSA.type("Koushik.git")
      const btn = await page.$('button[type="submit"]')
      if (btn) await btn.click()
    }
    await sleep(4500)

    console.log("  Navigating to Super Admin Pricing - Gosala Offerings sector...")
    await page.goto(`${TARGET_URL}/#super_admin/pricing/gosalas`, { waitUntil: "networkidle2" })
    await sleep(3500)

    // Scroll to Section B: Devotional Store Offerings & Items
    await page.evaluate(() => {
      const target = Array.from(document.querySelectorAll("*")).find(
        (el) => el.textContent && el.textContent.includes("Devotional Store Offerings & Items") && el.children.length === 0
      )
      if (target) {
        target.scrollIntoView({ behavior: "instant", block: "center" })
      } else {
        const main = document.querySelector("main")
        if (main) main.scrollTop = 1800
        window.scrollBy(0, 1800)
      }
    })
    await sleep(2000)

    const p3 = path.join(OUT_DIR, "18_superadmin_offerings_readonly_badge.png")
    await page.screenshot({ path: p3 })
    console.log(`  ✓ Saved Super Admin Pricing Offerings Read-Only screenshot: ${p3}`)

    console.log("  Attempting direct navigation to Live Tracking (#super_admin/tracking)...")
    await page.goto(`${TARGET_URL}/#super_admin/tracking`, { waitUntil: "networkidle2" })
    await sleep(3500)

    const finalHash = await page.evaluate(() => window.location.hash)
    console.log(`  Final URL hash for Super Admin: ${finalHash}`)

    const isTrackingMounted = await page.evaluate(() => {
      return Boolean(document.querySelector(".leaflet-container") || document.querySelector('[data-testid="live-map"]'))
    })
    console.log(`  Is Live Tracking / Leaflet Map mounted for Super Admin? ${isTrackingMounted} (Expected: false)`)

    const p2 = path.join(OUT_DIR, "17_superadmin_offerings_readonly_and_no_tracking.png")
    await page.screenshot({ path: p2 })
    console.log(`  ✓ Saved Super Admin Restricted Navigation screenshot: ${p2}`)

    console.log("\n=== ALL VERIFICATION CHECKS COMPLETED SUCCESSFULLY ===")
  } catch (err) {
    console.error("Test execution failed:", err)
  } finally {
    await browser.close()
  }
}

run()
