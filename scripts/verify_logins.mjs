import { authenticateOrResolveUser, authenticateAdminUser } from "../server/auth/authService.ts"
import { prisma } from "../server/prisma.ts"

async function runTests() {
  console.log("================================================================================")
  console.log("   GOMAA PLATFORM: VERIFYING PERFECT PROFILES AUTHENTICATION & CAPABILITIES     ")
  console.log("================================================================================")

  const tests = [
    {
      name: "Super Admin via /admin (Email: superadmin@gomaa.in)",
      fn: () => authenticateAdminUser("superadmin@gomaa.in", "SuperAdmin@2026!"),
      expectedRole: "super_admin",
      expectedDbRole: "SUPER_ADMIN",
    },
    {
      name: "Super Admin via /admin (Unique ID: GMA-SA-0001)",
      fn: () => authenticateAdminUser("GMA-SA-0001", "SuperAdmin@2026!"),
      expectedRole: "super_admin",
      expectedDbRole: "SUPER_ADMIN",
    },
    {
      name: "Super Admin via /admin (Phone: 9800000001)",
      fn: () => authenticateAdminUser("9800000001", "SuperAdmin@2026!"),
      expectedRole: "super_admin",
      expectedDbRole: "SUPER_ADMIN",
    },
    {
      name: "Ops Admin 1 (Rajeshwar Rao) via /admin (Email: admin@gomaa.in)",
      fn: () => authenticateAdminUser("admin@gomaa.in", "OpsAdmin@2026!"),
      expectedRole: "admin",
      expectedDbRole: "OPERATIONS_ADMIN",
      checkGosalas: ["Gaushala_01", "Gaushala_02"],
    },
    {
      name: "Ops Admin 1 via /admin (Unique ID: GMA-OPS-0101)",
      fn: () => authenticateAdminUser("GMA-OPS-0101", "OpsAdmin@2026!"),
      expectedRole: "admin",
      expectedDbRole: "OPERATIONS_ADMIN",
    },
    {
      name: "Ops Admin 2 (Vikramaditya Reddy) via /admin (Email: ops.secunderabad@gomaa.in)",
      fn: () => authenticateAdminUser("ops.secunderabad@gomaa.in", "OpsAdmin@2026!"),
      expectedRole: "admin",
      expectedDbRole: "OPERATIONS_ADMIN",
      checkGosalas: ["Gaushala_03"],
    },
    {
      name: "Manager 1 (Shyam Sundar Shastri) via /login (Email: manager1@gomaa.in)",
      fn: () => authenticateOrResolveUser("manager1@gomaa.in", undefined, "Manager@2026!"),
      expectedRole: "manager",
      expectedDbRole: "GOSALA_MANAGER",
      checkGosalas: ["Gaushala_01"],
    },
    {
      name: "Manager 1 via /login (Unique ID: GMA-MGR-0101)",
      fn: () => authenticateOrResolveUser("GMA-MGR-0101", undefined, "Manager@2026!"),
      expectedRole: "manager",
      expectedDbRole: "GOSALA_MANAGER",
    },
    {
      name: "Manager 2 (Gopal Krishna Murthy) via /login (Email: manager2@gomaa.in)",
      fn: () => authenticateOrResolveUser("manager2@gomaa.in", undefined, "Manager@2026!"),
      expectedRole: "manager",
      expectedDbRole: "GOSALA_MANAGER",
      checkGosalas: ["Gaushala_02"],
    },
    {
      name: "Manager 3 (Raghavendra Swamy) via /login (Email: manager3@gomaa.in)",
      fn: () => authenticateOrResolveUser("manager3@gomaa.in", undefined, "Manager@2026!"),
      expectedRole: "manager",
      expectedDbRole: "GOSALA_MANAGER",
      checkGosalas: ["Gaushala_03"],
    },
    {
      name: "Devotee Customer via /login (Email: devpulseorg@gmail.com)",
      fn: () => authenticateOrResolveUser("devpulseorg@gmail.com", undefined, "Devotee@2026!"),
      expectedRole: "customer",
      expectedDbRole: "CUSTOMER",
    },
    {
      name: "Transit Pilot / Driver via /login (Email: driver@gomaa.in)",
      fn: () => authenticateOrResolveUser("driver@gomaa.in", undefined, "Driver@2026!"),
      expectedRole: "driver",
      expectedDbRole: "DRIVER",
    },
  ]

  let passed = 0
  for (const t of tests) {
    try {
      const session = await t.fn()
      if (!session || !session.token) {
        throw new Error("No session or token returned")
      }
      if (t.expectedRole && session.user.role !== t.expectedRole) {
        throw new Error(`Role mismatch: expected ${t.expectedRole}, got ${session.user.role}`)
      }
      if (t.expectedDbRole && session.user.dbRole !== t.expectedDbRole) {
        throw new Error(`DB Role mismatch: expected ${t.expectedDbRole}, got ${session.user.dbRole}`)
      }
      if (t.checkGosalas) {
        const names = session.user.assignedGosalaNames || []
        for (const expectedName of t.checkGosalas) {
          if (!names.includes(expectedName)) {
            throw new Error(`Gosala assignment missing: expected ${expectedName}, assigned: [${names.join(", ")}]`)
          }
        }
      }
      console.log(`✓ PASS: ${t.name} -> Token issued, User: ${session.user.name} (${session.user.uniqueId || session.user.id}), Gosalas: [${(session.user.assignedGosalaNames || []).join(", ")}]`)
      passed++
    } catch (err) {
      console.error(`✗ FAIL: ${t.name} -> ${err.message}`)
    }
  }

  // Zero-trust boundaries check
  console.log("\n--- Checking Zero-Trust RBAC Boundary Enforcement ---")
  try {
    await authenticateOrResolveUser("superadmin@gomaa.in", undefined, "SuperAdmin@2026!")
    console.error("✗ FAIL: Super Admin was unexpectedly allowed to log in via public /login")
  } catch (err) {
    console.log(`✓ PASS: Super Admin blocked on public /login: "${err.message}"`)
    passed++
  }

  try {
    await authenticateAdminUser("manager1@gomaa.in", "Manager@2026!")
    console.error("✗ FAIL: Manager was unexpectedly allowed to log in via /admin")
  } catch (err) {
    console.log(`✓ PASS: Manager blocked on /admin portal: "${err.message}"`)
    passed++
  }

  console.log(`\nResults: ${passed} / ${tests.length + 2} verification tests passed successfully.`)
  await prisma.$disconnect()
}

runTests().catch((e) => {
  console.error("Test execution failed:", e)
  process.exit(1)
})
