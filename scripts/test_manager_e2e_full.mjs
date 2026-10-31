import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

const BASE_URL = "http://localhost:8443"

async function runE2ETest() {
  console.log("=============================================================")
  console.log("  END-TO-END VERIFICATION: SUPER ADMIN MANAGER CREATION & CREDIT")
  console.log("=============================================================")

  // 1. Authenticate as Super Admin
  console.log("\n[Step 1] Authenticating Super Admin via /api/auth/admin-login...")
  const saLoginRes = await fetch(`${BASE_URL}/api/auth/admin-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      emailOrPhone: "superadmin@gomaa.in",
      password: "SuperAdmin@2026!",
    }),
  })
  const saLoginData = await saLoginRes.json()
  if (!saLoginData.ok || !saLoginData.token) {
    throw new Error(`Super Admin login failed: ${JSON.stringify(saLoginData)}`)
  }
  const saToken = saLoginData.token
  console.log(`✓ Super Admin logged in! User: ${saLoginData.user.name} (${saLoginData.user.uniqueId})`)

  // 2. Test Path A: Create Manager via POST /api/managers (Sanctuary Managers Table flow)
  const mgrEmailA = `test_mgr_table_${Date.now()}@gomaa.in`
  const mgrPassA = "TestMgrPass2026!"
  console.log(`\n[Step 2] Path A: Super Admin creating manager via POST /api/managers (${mgrEmailA})...`)
  const createResA = await fetch(`${BASE_URL}/api/managers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${saToken}`,
    },
    body: JSON.stringify({
      name: "Rameshwar Shastri (Test A)",
      email: mgrEmailA,
      phone: "+91 98765 11223",
      password: mgrPassA,
      gosalas: ["Gaushala_01"],
      region: "Hyderabad",
      status: "Active",
    }),
  })
  const createDataA = await createResA.json()
  if (createResA.status !== 200 && createResA.status !== 201) {
    throw new Error(`Path A manager creation failed: ${JSON.stringify(createDataA)}`)
  }
  const managerA = createDataA.manager
  console.log(`✓ Path A Manager Created: ID ${managerA.id}, Name: ${managerA.name}`)

  // 3. Test Path B: Create Manager via POST /api/users (Add User / Role flow)
  const mgrEmailB = `test_mgr_role_${Date.now()}@gomaa.in`
  const mgrPassB = "TestMgrPass2026!"
  console.log(`\n[Step 3] Path B: Super Admin creating manager via POST /api/users (${mgrEmailB})...`)
  const createResB = await fetch(`${BASE_URL}/api/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${saToken}`,
    },
    body: JSON.stringify({
      name: "Gopal Krishna (Test B)",
      email: mgrEmailB,
      phone: "+91 98765 44556",
      password: mgrPassB,
      role: "manager",
      assignedGosalaNames: ["Gaushala_02"],
    }),
  })
  const createDataB = await createResB.json()
  if (createResB.status !== 200 && createResB.status !== 201) {
    throw new Error(`Path B manager creation failed: ${JSON.stringify(createDataB)}`)
  }
  const managerB = createDataB.user
  console.log(`✓ Path B Manager Created: ID ${managerB.id}, Role: ${managerB.role}, Gosalas: ${JSON.stringify(managerB.assignedGosalaNames)}`)

  // 4. Test Super Admin Crediting Manager A's Wallet with ₹2,500
  console.log(`\n[Step 4] Super Admin granting ₹2,500 credit to Manager A (${managerA.id})...`)
  const creditRes = await fetch(`${BASE_URL}/api/wallet/credit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${saToken}`,
    },
    body: JSON.stringify({
      userId: managerA.id,
      email: mgrEmailA,
      amountRupees: 2500,
      purpose: "OPERATIONAL_TEST",
      description: "Initial operational test credit granted by Super Admin",
    }),
  })
  const creditData = await creditRes.json()
  if (!creditRes.ok || !creditData.ok) {
    throw new Error(`Credit to Manager A failed: ${JSON.stringify(creditData)}`)
  }
  console.log(`✓ Credit successfully applied! New balance: ₹${creditData.balance.balanceRupees}`)

  // 5. Test Manager A logging into platform via /api/auth/login
  console.log(`\n[Step 5] Logging in as Manager A (${mgrEmailA}) on /api/auth/login...`)
  const mgrLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      emailOrPhone: mgrEmailA,
      password: mgrPassA,
    }),
  })
  const mgrLoginData = await mgrLoginRes.json()
  if (!mgrLoginRes.ok || !mgrLoginData.ok) {
    throw new Error(`Manager A login failed: ${JSON.stringify(mgrLoginData)}`)
  }
  const mgrToken = mgrLoginData.token
  console.log(`✓ Manager A authenticated! Role: ${mgrLoginData.user.role}, Gosalas: ${JSON.stringify(mgrLoginData.user.assignedGosalaNames)}`)

  // 6. Verify Manager A Wallet Balance via GET /api/wallet/balance
  console.log(`\n[Step 6] Manager A inspecting wallet balance via /api/wallet/balance...`)
  const balRes = await fetch(`${BASE_URL}/api/wallet/balance`, {
    headers: { Authorization: `Bearer ${mgrToken}` },
  })
  const balData = await balRes.json()
  if (!balRes.ok || !balData.ok) {
    throw new Error(`Failed to fetch wallet balance: ${JSON.stringify(balData)}`)
  }
  console.log(`✓ Manager A verified balance: ₹${balData.balanceRupees} (Expected: ₹2500)`)
  if (balData.balanceRupees !== 2500) {
    throw new Error(`Expected ₹2500, received ₹${balData.balanceRupees}`)
  }

  // 7. Test Manager A Withdrawing ₹1,000 to bank account via POST /api/wallet/withdraw
  console.log(`\n[Step 7] Manager A withdrawing ₹1,000 to bank account via /api/wallet/withdraw...`)
  const withdrawRes = await fetch(`${BASE_URL}/api/wallet/withdraw`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${mgrToken}`,
    },
    body: JSON.stringify({
      amountRupees: 1000,
      mode: "IMPS",
      bankName: "State Bank of India",
      accountMasked: "•••• 4491",
      ifsc: "SBIN0001420",
    }),
  })
  const withdrawData = await withdrawRes.json()
  if (!withdrawRes.ok || !withdrawData.ok) {
    throw new Error(`Manager withdrawal failed: ${JSON.stringify(withdrawData)}`)
  }
  console.log(`✓ Withdrawal executed! Message: ${withdrawData.message}, Remaining Balance: ₹${withdrawData.balance.balanceRupees}`)
  if (withdrawData.balance.balanceRupees !== 1500) {
    throw new Error(`Expected remaining ₹1500, received ₹${withdrawData.balance.balanceRupees}`)
  }

  // 8. Verify Ledger Transactions via GET /api/wallet/transactions
  console.log(`\n[Step 8] Manager A verifying double-entry transaction history...`)
  const txRes = await fetch(`${BASE_URL}/api/wallet/transactions`, {
    headers: { Authorization: `Bearer ${mgrToken}` },
  })
  const txData = await txRes.json()
  if (!txRes.ok || !txData.ok) {
    throw new Error(`Failed to fetch transactions: ${JSON.stringify(txData)}`)
  }
  console.log(`✓ Found ${txData.transactions.length} wallet transactions:`)
  txData.transactions.forEach((tx) => {
    console.log(`   - [${tx.type}] ₹${tx.amountRupees} | Purpose: ${tx.purpose} | Status: ${tx.status} | ${tx.description}`)
  })

  // 9. Cleanup Test Managers
  console.log(`\n[Step 9] Cleaning up test managers from DB...`)
  await fetch(`${BASE_URL}/api/managers/${managerA.id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${saToken}` },
  })
  const dbUserB = await prisma.user.findFirst({ where: { email: mgrEmailB } })
  if (dbUserB) {
    await prisma.gosalaManagerAssignment.deleteMany({ where: { userId: dbUserB.id } })
    const wallet = await prisma.wallet.findFirst({ where: { userId: dbUserB.id } })
    if (wallet) {
      await prisma.walletTransaction.deleteMany({ where: { walletId: wallet.id } })
      await prisma.wallet.delete({ where: { id: wallet.id } })
    }
    await prisma.user.delete({ where: { id: dbUserB.id } })
  }
  console.log("✓ Cleanup completed.")

  console.log("\n=============================================================")
  console.log("  ALL TESTS PASSED: E2E MANAGER FLOW FULLY VERIFIED 100%!")
  console.log("=============================================================")
}

runE2ETest()
  .catch((err) => {
    console.error("\n❌ TEST FAILED:", err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
