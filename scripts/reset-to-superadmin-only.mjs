import { prisma } from "../server/prisma.ts"
import fs from "node:fs"
import path from "node:path"
import { hashPassword } from "../server/auth/password.ts"

async function resetToSuperAdminOnly() {
  console.log("==================================================================")
  console.log("  GOMAA DATABASE RESET: SUPER ADMIN ONLY (CLEAN START)            ")
  console.log("==================================================================")

  const dataDir = path.resolve(process.cwd(), "server", "data")
  const backupsDir = path.resolve(dataDir, "backups")
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true })
  }

  // Step 1: Create a safety backup snapshot
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  const snapshotFile = path.resolve(backupsDir, `snapshot_before_superadmin_reset_${timestamp}.json`)

  const currentUsers = await prisma.user.findMany()
  const currentBookings = await prisma.booking.findMany()
  const currentHolds = await prisma.temporarySlotHold.findMany()
  const currentAssignments = await prisma.gosalaManagerAssignment.findMany()
  const currentAudits = await prisma.approvalAuditTrail.findMany()
  const currentBlocks = await prisma.animalScheduleBlock.findMany()

  fs.writeFileSync(
    snapshotFile,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        description: "Pre-reset snapshot prior to clearing everything except Super Admin",
        counts: {
          users: currentUsers.length,
          bookings: currentBookings.length,
          holds: currentHolds.length,
          assignments: currentAssignments.length,
          audits: currentAudits.length,
          blocks: currentBlocks.length,
        },
        users: currentUsers,
        bookings: currentBookings,
        holds: currentHolds,
        assignments: currentAssignments,
      },
      null,
      2
    ),
    "utf-8"
  )
  console.log(`[Safety Backup] Created snapshot archive at: ${snapshotFile}`)

  // Step 2: Delete transactional records
  console.log("[1/6] Purging all bookings, slot holds, blocks, and audit trails...")
  const deletedHolds = await prisma.temporarySlotHold.deleteMany()
  const deletedBookings = await prisma.booking.deleteMany()
  const deletedBlocks = await prisma.animalScheduleBlock.deleteMany()
  const deletedAudits = await prisma.approvalAuditTrail.deleteMany()
  console.log(`  ✓ Deleted: ${deletedHolds.count} slot holds`)
  console.log(`  ✓ Deleted: ${deletedBookings.count} bookings`)
  console.log(`  ✓ Deleted: ${deletedBlocks.count} schedule blocks`)
  console.log(`  ✓ Deleted: ${deletedAudits.count} audit trail entries`)

  // Step 3: Delete manager assignments
  console.log("[2/6] Purging all Gaushala manager assignments...")
  const deletedAssignments = await prisma.gosalaManagerAssignment.deleteMany()
  console.log(`  ✓ Deleted: ${deletedAssignments.count} manager assignments`)

  // Step 4: Reset Gaushalas metadata (set managers to unassigned)
  console.log("[3/6] Resetting Gaushalas metadata to unassigned status...")
  const gosalasMetaPath = path.resolve(dataDir, "gosalas_meta.json")
  if (fs.existsSync(gosalasMetaPath)) {
    try {
      const gMeta = JSON.parse(fs.readFileSync(gosalasMetaPath, "utf-8"))
      for (const key of Object.keys(gMeta)) {
        gMeta[key].managerId = ""
        gMeta[key].managerName = "Unassigned (Awaiting Admin)"
        gMeta[key].isActingManager = false
        gMeta[key].actAsManagerMyself = false
      }
      fs.writeFileSync(gosalasMetaPath, JSON.stringify(gMeta, null, 2), "utf-8")
      console.log(`  ✓ Reset all Gaushala managers in server/data/gosalas_meta.json`)
    } catch (err) {
      console.warn("  ⚠ Notice updating gosalas_meta.json:", err.message)
    }
  }

  // Step 5: Clean verification OTPs table
  console.log("[4/6] Purging all verification OTPs...")
  try {
    const deletedOtps = await prisma.$executeRawUnsafe(`DELETE FROM "verification_otps"`)
    console.log(`  ✓ Cleared verification_otps table (${deletedOtps} rows)`)
  } catch (err) {
    console.warn("  ⚠ Notice clearing OTPs:", err.message)
  }

  // Step 6: Delete all users except Super Admin (superadmin@gomaa.in)
  console.log("[5/6] Deleting all users except Super Admin (superadmin@gomaa.in)...")
  const nonSuperAdminUsers = await prisma.user.findMany({
    where: {
      AND: [
        { email: { not: "superadmin@gomaa.in" } },
        { id: { not: "USER-SA-SUPERADMIN" } },
      ],
    },
    select: { id: true, email: true },
  })

  const deleteIds = nonSuperAdminUsers.map((u) => u.id)
  let deletedCount = 0
  if (deleteIds.length > 0) {
    const res = await prisma.user.deleteMany({
      where: { id: { in: deleteIds } },
    })
    deletedCount = res.count
  }
  console.log(`  ✓ Deleted ${deletedCount} non-superadmin users`)

  // Ensure Super Admin exists with canonical credentials and valid PBKDF2 hash
  const existingSuperAdmin = await prisma.user.findFirst({
    where: {
      OR: [
        { email: "superadmin@gomaa.in" },
        { id: "USER-SA-SUPERADMIN" },
      ],
    },
  })

  const superAdminPasswordHash = hashPassword("SuperAdmin@2026!")

  if (existingSuperAdmin) {
    await prisma.user.update({
      where: { id: existingSuperAdmin.id },
      data: {
        id: "USER-SA-SUPERADMIN",
        name: "Super Admin",
        email: "superadmin@gomaa.in",
        phone: "+91 98000 00000",
        role: "SUPER_ADMIN",
        password: superAdminPasswordHash,
        isActive: true,
      },
    })
    console.log(`  ✓ Re-verified Super Admin credentials (superadmin@gomaa.in / SuperAdmin@2026!)`)
  } else {
    await prisma.user.create({
      data: {
        id: "USER-SA-SUPERADMIN",
        name: "Super Admin",
        email: "superadmin@gomaa.in",
        phone: "+91 98000 00000",
        role: "SUPER_ADMIN",
        password: superAdminPasswordHash,
        isActive: true,
      },
    })
    console.log(`  ✓ Created new Super Admin (superadmin@gomaa.in / SuperAdmin@2026!)`)
  }

  // Step 7: Reset users_meta.json
  console.log("[6/6] Resetting users_meta.json...")
  const usersMetaPath = path.resolve(dataDir, "users_meta.json")
  fs.writeFileSync(usersMetaPath, JSON.stringify({}, null, 2), "utf-8")
  console.log(`  ✓ Reset server/data/users_meta.json to empty state`)

  // Final verification & summary
  const remainingUsers = await prisma.user.findMany()
  const remainingGosalas = await prisma.gosala.count()
  const remainingAnimals = await prisma.animal.count()
  const remainingBookings = await prisma.booking.count()
  const remainingHolds = await prisma.temporarySlotHold.count()

  console.log("\n==================================================================")
  console.log("  RESET COMPLETED SUCCESSFULLY: READY FOR CLEAN-SLATE TESTING     ")
  console.log("==================================================================")
  console.log(`  Total Users Remaining:     ${remainingUsers.length} (Only Super Admin)`)
  remainingUsers.forEach((u) => {
    console.log(`    • [${u.role}] ${u.email} (${u.name}) - ID: ${u.id}`)
  })
  console.log(`  Total Gaushalas:           ${remainingGosalas} (All unassigned, ready for manager onboarding)`)
  console.log(`  Total Sacred Animals:      ${remainingAnimals} (Available for booking seva)`)
  console.log(`  Total Active Bookings:     ${remainingBookings}`)
  console.log(`  Total Active Slot Holds:   ${remainingHolds}`)
  console.log("==================================================================")
}

resetToSuperAdminOnly()
  .catch((err) => {
    console.error("Reset script failed:", err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
