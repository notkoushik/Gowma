import puppeteer from "puppeteer-core"
import path from "node:path"

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
const TARGET_URL = "https://gowma.vercel.app"
const OUT_DIR = path.resolve(process.cwd(), "docs", "screenshots")

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function run() {
  console.log("=== CAPTURING WALLET & MANAGER SHARE SPLIT PAGES ===")
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: "new",
    defaultViewport: { width: 1440, height: 900 },
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  })

  const page = await browser.newPage()

  try {
    // -------------------------------------------------------------------------
    // 1. Manager Wallet Page & Withdrawal Modal
    // -------------------------------------------------------------------------
    console.log("1. Logging in as Gaushala Manager (manager1@gomaa.in)...")
    await page.goto(`${TARGET_URL}/#/login`, { waitUntil: "networkidle2" })
    await sleep(2500)

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
    await sleep(4000)

    console.log("  Navigating to Manager Wallet view...")
    await page.goto(`${TARGET_URL}/#manager/wallet`, { waitUntil: "networkidle2" })
    await sleep(3000)

    // Open the Withdraw Modal to showcase instant IMPS/RTGS withdrawal capability
    const withdrawBtn = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"))
      const wBtn = btns.find((b) => b.textContent && b.textContent.includes("Withdraw to Bank"))
      if (wBtn) {
        wBtn.click()
        return true
      }
      return false
    })
    console.log(`  Clicked 'Withdraw to Bank' button: ${withdrawBtn}`)
    await sleep(1500)

    // Type a sample withdrawal amount to show dynamic input and quick chips
    await page.evaluate(() => {
      const numInput = document.querySelector('input[type="number"]')
      if (numInput) {
        numInput.value = "2000"
        numInput.dispatchEvent(new Event("input", { bubbles: true }))
      }
    })
    await sleep(1000)

    const p1 = path.join(OUT_DIR, "13_manager_wallet_and_withdraw_modal.png")
    await page.screenshot({ path: p1 })
    console.log(`  ✓ Saved: ${p1}`)

    // -------------------------------------------------------------------------
    // 2. Operations Admin Regional Treasury & Manager Share Split Page
    // -------------------------------------------------------------------------
    console.log("\n2. Logging in as Operations Admin (alt.yq-fs88dj2@yopmail.com)...")
    await page.goto(`${TARGET_URL}/#/login`, { waitUntil: "networkidle2" })
    await sleep(2500)

    const emailAdm = await page.$('input[type="text"], input[type="email"]')
    const passAdm = await page.$('input[type="password"]')
    if (emailAdm && passAdm) {
      await emailAdm.click({ clickCount: 3 })
      await emailAdm.type("alt.yq-fs88dj2@yopmail.com")
      await passAdm.click({ clickCount: 3 })
      await passAdm.type("Koushik.git")
      const btn = await page.$('button[type="submit"]')
      if (btn) await btn.click()
    }
    await sleep(4000)

    console.log("  Navigating to Operations Admin Treasury & Wallets view...")
    await page.goto(`${TARGET_URL}/#admin/wallet`, { waitUntil: "networkidle2" })
    await sleep(3500)

    const p2 = path.join(OUT_DIR, "14_admin_wallet_and_manager_share_split.png")
    await page.screenshot({ path: p2 })
    console.log(`  ✓ Saved: ${p2}`)

    // -------------------------------------------------------------------------
    // 3. Operations Admin Profile - Manager Share Split Tab
    // -------------------------------------------------------------------------
    console.log("\n3. Opening Operations Admin Profile Modal and switching to Manager Share Split tab...")
    // Click on user profile header button in top-right or sidebar
    const openedProfile = await page.evaluate(() => {
      // Look for button that opens profile modal
      const profileButtons = Array.from(document.querySelectorAll("button"))
      const target = profileButtons.find(
        (b) =>
          (b.textContent && (b.textContent.includes("Profile") || b.textContent.includes("Adjust in Profile") || b.textContent.includes("Operations Admin"))) ||
          b.getAttribute("title")?.toLowerCase().includes("profile"),
      )
      if (target) {
        target.click()
        return true
      }
      return false
    })
    console.log(`  Clicked Profile trigger: ${openedProfile}`)
    await sleep(2000)

    // Click on the "Manager Share Split" tab inside the modal
    const switchedTab = await page.evaluate(() => {
      const tabButtons = Array.from(document.querySelectorAll("button"))
      const shareTab = tabButtons.find(
        (b) => b.textContent && b.textContent.includes("Manager Share Split"),
      )
      if (shareTab) {
        shareTab.click()
        return true
      }
      return false
    })
    console.log(`  Switched to 'Manager Share Split' tab: ${switchedTab}`)
    await sleep(2000)

    const p3 = path.join(OUT_DIR, "15_admin_profile_share_split_tab.png")
    await page.screenshot({ path: p3 })
    console.log(`  ✓ Saved: ${p3}`)

    console.log("\n=== ALL WALLET & SHARE SPLIT SCREENSHOTS CAPTURED SUCCESSFULLY ===")
  } catch (err) {
    console.error("Error during capture:", err)
  } finally {
    await browser.close()
  }
}

run()
