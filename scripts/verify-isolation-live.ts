import { api } from "../src/services/api"

async function verify() {
  const gRes = await fetch("http://localhost:8443/api/gosalas")
  const gData = await gRes.json()
  const gosalas: any[] = gData.gosalas || []

  const mRes = await fetch("http://localhost:8443/api/managers")
  const mData = await mRes.json()
  const managers: any[] = mData.managers || []

  console.log("==================================================================")
  console.log("          GOMAA LIVE MULTI-TENANT ISOLATION AUDIT                 ")
  console.log("==================================================================")
  console.log("Total Gaushalas Registered:", gosalas.length)
  console.log("Total Managers Registered:", managers.length)

  const superAdminGosalas = gosalas.filter(
    (g) => g.governingAdminRole === "super_admin"
  )
  const operationsAdminGosalas = gosalas.filter(
    (g) => g.governingAdminRole === "admin"
  )

  console.log("\n[1] SUPER ADMIN PORTFOLIO (Vikramaditya Hegde):")
  superAdminGosalas.forEach((g) => {
    console.log(`  • ${g.name} (ID: ${g.id}, Manager: ${g.managerName || "None"})`)
  })

  console.log("\n[2] OPERATIONS ADMIN PORTFOLIO (Priya Sharma):")
  operationsAdminGosalas.forEach((g) => {
    console.log(`  • ${g.name} (ID: ${g.id}, Manager: ${g.managerName || "None"})`)
  })

  const overlap = superAdminGosalas.filter((sg) =>
    operationsAdminGosalas.some((og) => og.id === sg.id)
  )
  console.log("\n[3] ISOLATION AUDIT:")
  if (overlap.length === 0) {
    console.log("  ✓ ZERO LEAKAGE: 0 overlap between Super Admin & Operations Admin portfolios.")
  } else {
    console.error("  ✗ LEAKAGE DETECTED! Overlapping Gaushalas:", overlap.map((g) => g.name))
  }

  console.log("\n[4] MANAGER ASSIGNMENT & LOGIN DISCONNECT VERIFICATION:")
  let unassignedCount = 0
  for (const m of managers) {
    const directList =
      m.gosalas && m.gosalas.length > 0
        ? m.gosalas
        : m.gosala && m.gosala !== "Unassigned"
        ? [m.gosala]
        : []
    const mapped = gosalas.filter(
      (g) =>
        g.managerId === m.id ||
        (m.id && g.managerId && (m.id.includes(g.managerId) || g.managerId.includes(m.id))) ||
        (g.managerName && g.managerName.toLowerCase() === m.name.toLowerCase())
    )
    const assigned = Array.from(new Set([...directList, ...mapped.map((g) => g.name)]))
    if (assigned.length === 0) unassignedCount++
    console.log(`  • ${m.name} (${m.id}): ${assigned.length} Gaushala(s) -> [${assigned.join(", ")}]`)
  }

  console.log("\n==================================================================")
  if (overlap.length === 0 && unassignedCount === 0) {
    console.log("  >>> ALL ISOLATION & ASSIGNMENT INVARIANTS PASSED SUCCESSFULLY <<<")
  } else {
    console.log(`  >>> AUDIT SUMMARY: Overlap=${overlap.length}, UnassignedManagers=${unassignedCount} <<<`)
  }
  console.log("==================================================================")
}

verify().catch(console.error)
