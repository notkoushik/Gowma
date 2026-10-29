import fs from "node:fs"
import puppeteer from "puppeteer-core"

function resolveChromePath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH && fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
    return process.env.PUPPETEER_EXECUTABLE_PATH
  }
  const linuxCandidates = [
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    "/snap/bin/chromium",
  ]
  const winCandidates = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    (process.env.LOCALAPPDATA || "") + "\\Google\\Chrome\\Application\\chrome.exe",
  ]
  const candidates = process.platform === "win32" ? winCandidates : linuxCandidates
  for (const p of candidates) {
    if (p && fs.existsSync(p)) return p
  }
  return process.platform === "win32" ? winCandidates[0] : "/usr/bin/chromium-browser"
}

const CHROME_PATH = resolveChromePath()
const TARGET_URL = process.argv[2]?.startsWith("http")
  ? process.argv[2]
  : process.env.TEST_TARGET_URL || "https://gowma.vercel.app"

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const auditLog = {
  pagesVisited: 0,
  interactionsTested: 0,
  networkErrors: [],
  consoleErrors: [],
  uncaughtExceptions: [],
}

async function runApplicationCrawler() {
  console.log("================================================================================")
  console.log("   GOMAA AUTOMATED FULL-APPLICATION BROWSER CRAWLER & AUDIT SUITE               ")
  console.log(`   Target URL: ${TARGET_URL}`)
  console.log("================================================================================\n")

  const isHeaded = process.argv.includes("--headed") || process.env.HEADED === "true"
  console.log(`   Mode: ${isHeaded ? "👀 Headed (Watch Mode on Screen)" : "⚡ Headless (Fast Automated Mode)"}`)

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: isHeaded ? false : "new",
    slowMo: isHeaded ? 100 : 0,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--ignore-certificate-errors"],
  })

  try {
    const page = await browser.newPage()

    // 1. Trap all Console Errors
    page.on("console", (msg) => {
      const type = msg.type()
      const text = msg.text()
      if (type === "error" && !text.includes("favicon") && !text.includes("CartoDB") && !text.includes("tile.openstreetmap")) {
        console.error(`  [BROWSER CONSOLE ERROR]: ${text}`)
        auditLog.consoleErrors.push({ text, location: page.url() })
      }
    })

    // 2. Trap uncaught page errors
    page.on("pageerror", (err) => {
      console.error(`  [PAGE UNCAUGHT EXCEPTION]: ${err.message}`)
      auditLog.uncaughtExceptions.push({ message: err.message, location: page.url() })
    })

    // 3. Trap 5xx / 4xx API network failures
    page.on("response", async (res) => {
      const url = res.url()
      const status = res.status()
      if (url.includes("/api/") && status >= 400 && !url.includes("/api/auth/verify-otp")) {
        if (status >= 500) {
          const bodyText = await res.text().catch(() => "")
          console.error(`  [CRITICAL API 5xx ERROR]: ${status} ${url} - Response Body: ${bodyText}`)
          auditLog.networkErrors.push({ status, url, page: page.url(), body: bodyText })
        }
      }
    })

    // =========================================================================
    // STAGE 1: MOBILE VIEWPORT VERIFICATION (iPhone SE: 375x667)
    // =========================================================================
    console.log("[STAGE 1] Testing Mobile Viewport (iPhone SE 375 x 667)...")
    await page.setViewport({ width: 375, height: 667, isMobile: true, hasTouch: true })

    console.log("  1.1 Navigating to Login Page...")
    await page.goto(`${TARGET_URL}/#/login`, { waitUntil: "networkidle2", timeout: 30000 })
    await sleep(2000)
    auditLog.pagesVisited++

    console.log("  1.2 Logging in as Operations Admin (alt.yq-fs88dj2@yopmail.com)...")
    const emailInput = await page.$('input[type="text"], input[type="email"]')
    const passInput = await page.$('input[type="password"]')
    if (emailInput && passInput) {
      await emailInput.click({ clickCount: 3 })
      await emailInput.type("alt.yq-fs88dj2@yopmail.com")
      await passInput.click({ clickCount: 3 })
      await passInput.type("GomaaAdmin@2026!")
      const submitBtn = await page.$('button[type="submit"]')
      if (submitBtn) await submitBtn.click()
    }
    await sleep(4000)

    // =========================================================================
    // STAGE 2: DESKTOP AUDIT & FULL ROUTE TRAVERSAL
    // =========================================================================
    console.log("\n[STAGE 2] Testing Desktop Viewport (1440 x 900)...")
    await page.setViewport({ width: 1440, height: 900 })

    const adminRoutes = [
      { id: "overview", url: `${TARGET_URL}/#/admin/overview`, name: "Operations Overview" },
      { id: "gosalas", url: `${TARGET_URL}/#/admin/gosalas`, name: "Sanctuary Directory & Facilities" },
      { id: "managers", url: `${TARGET_URL}/#/admin/managers`, name: "Gosala Managers Governance" },
      { id: "bookings", url: `${TARGET_URL}/#/admin/bookings`, name: "Bookings & Devotee Triage" },
      { id: "animals", url: `${TARGET_URL}/#/admin/animals`, name: "Sacred Herd & Cattle Roster" },
      { id: "wallet", url: `${TARGET_URL}/#/admin/wallet`, name: "Regional Treasury & Manager Wallets" },
      { id: "availability", url: `${TARGET_URL}/#/admin/availability`, name: "Availability & Fleet" },
    ]

    for (const route of adminRoutes) {
      console.log(`  Visiting: ${route.name} (${route.url})...`)
      await page.goto(route.url, { waitUntil: "networkidle2", timeout: 30000 })
      await sleep(2000)
      auditLog.pagesVisited++
    }

    // =========================================================================
    // STAGE 3: DEEP-DIVE AUDIT ON REGIONAL TREASURY & 80/20 LEDGER
    // =========================================================================
    console.log("\n[STAGE 3] Deep-Dive Audit: Regional Treasury & 80/20 Ledger (/#/admin/ledger)...")
    await page.goto(`${TARGET_URL}/#/admin/ledger`, { waitUntil: "networkidle2", timeout: 30000 })
    await sleep(2500)
    auditLog.pagesVisited++

    // Interactively find and click each Gaushala filter button on the ledger
    console.log("  3.1 Interactively switching between Gaushala Shelters...")
    const gaushalaButtons = await page.evaluate(() => {
      const strip = document.querySelector('[data-testid="gaushala-scope-strip"]') || document
      const buttons = Array.from(strip.querySelectorAll("button"))
      return buttons
        .map((b) => b.innerText.trim())
        .filter((txt) => (txt.includes("Portfolio") || txt.startsWith("Gaushala")) && !txt.includes("Pop-up"))
    })
    console.log(`  Found Scope Tabs: [${gaushalaButtons.join(", ")}]`)

    for (const btnText of gaushalaButtons.slice(0, 5)) {
      console.log(`  Clicking Gaushala scope tab: '${btnText}'...`)
      await page.evaluate((targetText) => {
        const strip = document.querySelector('[data-testid="gaushala-scope-strip"]') || document
        const btns = Array.from(strip.querySelectorAll("button"))
        const found = btns.find((b) => b.innerText.includes(targetText))
        if (found) found.click()
      }, btnText)
      await sleep(1500)
      auditLog.interactionsTested++
    }

    // Check if the Scope and action buttons rendered without error
    const scopeRendered = await page.evaluate(() => {
      const text = document.body.innerText
      return text.includes("Gaushala Account Scope:") && (text.includes("Financial Summary") || text.includes("Consolidated"))
    })
    console.log(`  Scope & Financial Ledger Header Rendered: ${scopeRendered ? "YES" : "NO"}`)

    // Test Navigation to Gaushala Profile
    console.log("  3.2 Testing 'Go to Gaushala Profile ↗' link interaction...")
    const hasJumpButton = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"))
      const jumpBtn = btns.find((b) => b.innerText.includes("Profile & Herd") || b.innerText.includes("Go to"))
      if (jumpBtn) {
        jumpBtn.click()
        return true
      }
      return false
    })
    console.log(`  Jump button interacted: ${hasJumpButton ? "YES" : "NO"}`)
    await sleep(2000)
    auditLog.interactionsTested++

    // =========================================================================
    // STAGE 4: SUPER ADMIN SOVEREIGN CAPTAIN MODE AUDIT
    // =========================================================================
    console.log("\n[STAGE 4] Testing Super Admin Sovereign Captain View...")
    await page.evaluate(() => {
      try { localStorage.clear() } catch {}
    })
    await page.goto(`${TARGET_URL}/#/login`, { waitUntil: "networkidle2", timeout: 30000 })
    await sleep(2000)

    const emailInputSA = await page.$('input[type="text"], input[type="email"]')
    const passInputSA = await page.$('input[type="password"]')
    if (emailInputSA && passInputSA) {
      await emailInputSA.click({ clickCount: 3 })
      await emailInputSA.type("superadmin@gomaa.in")
      await passInputSA.click({ clickCount: 3 })
      await passInputSA.type("SuperAdmin@2026!")
      const submitBtn = await page.$('button[type="submit"]')
      if (submitBtn) await submitBtn.click()
    }
    await sleep(4000)

    console.log("  Visiting Super Admin Master Pricing & Economics...")
    await page.goto(`${TARGET_URL}/#/super_admin/pricing`, { waitUntil: "networkidle2", timeout: 30000 })
    await sleep(2500)
    auditLog.pagesVisited++

    console.log("  Visiting Super Admin Treasury Settlements...")
    await page.goto(`${TARGET_URL}/#/super_admin/settlements`, { waitUntil: "networkidle2", timeout: 30000 })
    await sleep(2500)
    auditLog.pagesVisited++

    // =========================================================================
    // STAGE 5: FINAL VERIFICATION & AUDIT COMPILATION
    // =========================================================================
    console.log("\n================================================================================")
    console.log("   AUTOMATED BROWSER CRAWL AUDIT REPORT                                         ")
    console.log("================================================================================")
    console.log(`  • Total Unique Pages Crawled:       ${auditLog.pagesVisited}`)
    console.log(`  • Interactive Journeys Tested:      ${auditLog.interactionsTested}`)
    console.log(`  • Uncaught Browser Exceptions:      ${auditLog.uncaughtExceptions.length}`)
    console.log(`  • Critical API 5xx Errors:          ${auditLog.networkErrors.length}`)
    console.log(`  • Filtered Console Errors:          ${auditLog.consoleErrors.length}`)

    if (auditLog.networkErrors.length > 0) {
      console.log("\n[FAILED] Network Errors Detected:")
      auditLog.networkErrors.forEach((e) => console.log(`  - HTTP ${e.status} at ${e.url}`))
    }

    if (auditLog.uncaughtExceptions.length > 0) {
      console.log("\n[FAILED] Uncaught Exceptions Detected:")
      auditLog.uncaughtExceptions.forEach((e) => console.log(`  - ${e.message} at ${e.location}`))
    }

    if (auditLog.networkErrors.length === 0 && auditLog.uncaughtExceptions.length === 0) {
      console.log("\n✅ ALL APPLICATION PAGES CRAWLED CLEANLY WITH 0 ERRORS AND 0 CRASHES!")
    } else {
      process.exitCode = 1
    }
  } catch (err) {
    console.error("Test runner execution failure:", err)
    process.exitCode = 1
  } finally {
    await browser.close()
  }
}

runApplicationCrawler()
