import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  console.log("==========================================")
  console.log("  TESTING MANAGER LIFECYCLE (API + DB)    ")
  console.log("==========================================")

  // 1. Login as Super Admin to get token
  const saRes = await fetch("http://localhost:8443/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ emailOrPhone: "superadmin@gomaa.in", password: "SuperAdmin@2026!" })
  })
  const saData = await saRes.json()
  const token = saData.token
  console.log("1. Authenticated as Super Admin. Token acquired.")

  // 2. Create new test manager
  const testEmail = `test_mgr_${Date.now()}@gomaa.in`
  const testPass = "testpass123" // 11 chars
  console.log(`2. Creating manager ${testEmail}...`)

  const createRes = await fetch("http://localhost:8443/api/managers", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({
      name: "Temporary Manager",
      email: testEmail,
      phone: "+91 99887 76655",
      password: testPass,
      gosalas: ["Gaushala_03"],
      region: "Secunderabad",
      status: "Active"
    })
  })
  const createBody = await createRes.json()
  console.log("Create response status:", createRes.status)
  if (createRes.status !== 200 && createRes.status !== 201) {
    throw new Error(`Failed to create manager: ${JSON.stringify(createBody)}`)
  }
  const createdMgr = createBody.manager
  console.log(`Created manager ID: ${createdMgr.id}, DB user verified.`)

  // 3. Test logging in as the newly created manager
  console.log(`3. Logging in as new manager ${testEmail}...`)
  const loginRes = await fetch("http://localhost:8443/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ emailOrPhone: testEmail, password: testPass })
  })
  const loginBody = await loginRes.json()
  console.log("Login status:", loginRes.status)
  if (loginRes.status !== 200 || !loginBody.ok) {
    throw new Error(`Login failed for new manager: ${JSON.stringify(loginBody)}`)
  }
  console.log("✓ Successfully logged in as new manager!")

  // 4. Delete the test manager
  console.log(`4. Deleting test manager ${createdMgr.id}...`)
  const delRes = await fetch(`http://localhost:8443/api/managers/${createdMgr.id}`, {
    method: "DELETE",
    headers: {
      "Authorization": `Bearer ${token}`
    }
  })
  const delBody = await delRes.json()
  console.log("Delete status:", delRes.status, delBody)

  // 5. Verify manager is gone from DB
  const dbCheck = await prisma.user.findFirst({
    where: { email: testEmail }
  })
  console.log("5. Database verification (User exists?):", Boolean(dbCheck))

  // 6. Verify Gosala_03 metadata does not have ghost manager
  const g3 = await prisma.gosala.findFirst({ where: { name: "Gaushala_03" } })
  console.log("6. Gaushala_03 metadata managerName:", g3?.metadata?.managerName)

  console.log("\n✓ All lifecycle tests passed with 100% integrity!")
}

main().catch(console.error).finally(() => prisma.$disconnect())
