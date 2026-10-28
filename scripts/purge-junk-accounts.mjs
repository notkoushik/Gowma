import { prisma } from "../server/prisma.ts"
import fs from "node:fs"
import path from "node:path"
import { hashPassword } from "../server/auth/password.ts"

async function purgeJunkAccounts() {
  console.log("==================================================================")
  console.log("  GOMAA POSTGRESQL CLEANUP: PURGING JUNK & TEST ACCOUNTS          ")
  console.log("==================================================================")

  // 1. Identify users to delete
  const junkEmails = [
    // QA test accounts from previous automated test runs
    "qa.538fa22d71@example.test",
    "qa.78aecfa9@example.test",
    "qa.1c9550ca@example.test",
    "qa.b49f3c31@example.test",
    "qa.ea6c8b81a472@example.test",
    "qa.40e39093@example.test",
    "qa.d293e9d2be@example.test",
    "qa.62e5ca6c5a@example.test",
    "qa.7035c66b8c@example.test",
    "custom_devotee_1791486062082@gmail.com",
    "custom_devotee_1791488001040@gomaa.in",
    // Test personas created during earlier manual experiments
    "ramraj@gmail.com",
    "suryavardhan@gmail.com",
    "aruna@gmail.com",
    "hari@gmail.com",
  ]

  // Also query for any user with email containing 'qa.' or 'test.' or '.test'
  const matchingUsers = await prisma.user.findMany({
    where: {
      OR: [
        { email: { in: junkEmails } },
        { email: { startsWith: "qa." } },
        { email: { startsWith: "custom_devotee_" } },
        { email: { endsWith: "@example.test" } },
        { email: { endsWith: "@gomaa.test" } },
      ],
    },
    select: { id: true, email: true, name: true, role: true },
  })

  const userIds = matchingUsers.map((u) => u.id)
  const userEmails = matchingUsers.map((u) => u.email).filter(Boolean)
  console.log(`Found ${matchingUsers.length} junk/test users to purge:`)
  for (const u of matchingUsers) {
    console.log(`  - [${u.id}] ${u.role}: ${u.email} (${u.name})`)
  }

  if (userIds.length > 0) {
    // 2. Delete holds associated with these users
    const deletedHolds = await prisma.temporarySlotHold.deleteMany({
      where: { customerId: { in: userIds } },
    })
    console.log(`✓ Deleted ${deletedHolds.count} temporary slot holds`)

    // 3. Delete bookings associated with these users
    const deletedBookings = await prisma.booking.deleteMany({
      where: {
        OR: [
          { customerId: { in: userIds } },
          { driverId: { in: userIds } },
        ],
      },
    })
    console.log(`✓ Deleted ${deletedBookings.count} bookings`)

    // 4. Delete audit trails created by or for these users
    const deletedAudits = await prisma.approvalAuditTrail.deleteMany({
      where: {
        OR: [
          { actorId: { in: userIds } },
          { bookingId: { in: deletedBookings.count > 0 ? undefined : [] } },
        ],
      },
    })
    console.log(`✓ Deleted ${deletedAudits.count} audit trail entries`)

    // 5. Delete manager assignments
    const deletedAssignments = await prisma.gosalaManagerAssignment.deleteMany({
      where: { userId: { in: userIds } },
    })
    console.log(`✓ Deleted ${deletedAssignments.count} manager assignments`)

    // 6. Delete user records from PostgreSQL
    const deletedUsers = await prisma.user.deleteMany({
      where: { id: { in: userIds } },
    })
    console.log(`✓ Deleted ${deletedUsers.count} users from PostgreSQL`)
  }

  // 7. Delete orphaned test gaushalas (godhavari_aruna, Ramrajulu, Gangamma) with 0 animals
  const testGaushalaNames = ["godhavari_aruna", "Ramrajulu", "Gangamma"]
  const testGosalas = await prisma.gosala.findMany({
    where: { name: { in: testGaushalaNames } },
    include: { animals: true },
  })

  for (const g of testGosalas) {
    if (g.animals.length === 0) {
      await prisma.gosalaManagerAssignment.deleteMany({ where: { gosalaId: g.id } })
      await prisma.gosala.delete({ where: { id: g.id } })
      console.log(`✓ Deleted empty test Gaushala: ${g.name} (${g.id})`)
    }
  }

  // 8. Clean up users_meta.json
  const usersMetaPath = path.resolve(process.cwd(), "server", "data", "users_meta.json")
  if (fs.existsSync(usersMetaPath)) {
    try {
      const meta = JSON.parse(fs.readFileSync(usersMetaPath, "utf-8"))
      let cleaned = 0
      for (const key of Object.keys(meta)) {
        if (
          userEmails.includes(key) ||
          userIds.includes(key) ||
          key.startsWith("qa.") ||
          key.startsWith("custom_devotee_") ||
          key.includes(".test")
        ) {
          delete meta[key]
          cleaned++
        }
      }
      fs.writeFileSync(usersMetaPath, JSON.stringify(meta, null, 2), "utf-8")
      console.log(`✓ Cleaned ${cleaned} entries from server/data/users_meta.json`)
    } catch (err) {
      console.warn("Could not update users_meta.json:", err.message)
    }
  }

  // 9. Clean up verification_otps table
  try {
    const deletedOtps = await prisma.$executeRawUnsafe(`DELETE FROM "verification_otps" WHERE "expiresAt" < NOW() OR "used" = true`)
    console.log(`✓ Cleaned up expired/consumed verification OTPs (${deletedOtps} rows)`)
  } catch (err) {
    console.warn("Notice cleaning OTPs:", err.message)
  }

  // 10. Ensure baseline Transit Driver (sunil.pawar@gomaa.in) exists with valid hash
  const driverEmail = "sunil.pawar@gomaa.in"
  const existingDriver = await prisma.user.findFirst({
    where: { email: { equals: driverEmail, mode: "insensitive" } },
  })
  if (!existingDriver) {
    await prisma.user.create({
      data: {
        id: "USER-DRV-SUNIL",
        name: "Sunil Pawar",
        email: driverEmail,
        phone: "+91 98440 55667",
        role: "DRIVER",
        password: hashPassword("Driver@2026!"),
        isActive: true,
      },
    })
    console.log(`✓ Seeded canonical Transit Driver: ${driverEmail}`)
  }

  // 11. Final PostgreSQL users count and roster
  const remaining = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  })

  console.log("\n==================================================================")
  console.log(`  CLEANUP COMPLETE. REMAINING LEGITIMATE PLATFORM USERS: ${remaining.length}`)
  console.log("==================================================================")
  for (const u of remaining) {
    console.log(`  • [${u.role.padEnd(16)}] ${(u.email || "").padEnd(30)} | ${u.name} (${u.phone || "No phone"})`)
  }
}

purgeJunkAccounts()
  .catch((err) => {
    console.error("Purge script failed:", err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
