import { PrismaClient } from "@prisma/client"
import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"

const prisma = new PrismaClient()

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex")
  const derived = crypto.scryptSync(password, salt, 64)
  return `scrypt$${salt}$${derived.toString("hex")}`
}

async function wipeAllExceptSuperAdmin() {
  console.log("==================================================================")
  console.log("  GOMAA TOTAL WIPE: CLEAN SLATE (PRESERVE ONLY SUPER ADMIN)       ")
  console.log("==================================================================")

  const dataDir = path.resolve(process.cwd(), "server", "data")
  const backupsDir = path.resolve(dataDir, "backups")
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true })
  }

  // 1. Safety archive
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  const snapshotFile = path.resolve(backupsDir, `snapshot_pre_total_wipe_${timestamp}.json`)

  try {
    const backupData = {
      timestamp: new Date().toISOString(),
      animalsMeta: fs.existsSync(path.resolve(dataDir, "animals_meta.json"))
        ? JSON.parse(fs.readFileSync(path.resolve(dataDir, "animals_meta.json"), "utf-8"))
        : {},
      gosalasMeta: fs.existsSync(path.resolve(dataDir, "gosalas_meta.json"))
        ? JSON.parse(fs.readFileSync(path.resolve(dataDir, "gosalas_meta.json"), "utf-8"))
        : {},
      usersMeta: fs.existsSync(path.resolve(dataDir, "users_meta.json"))
        ? JSON.parse(fs.readFileSync(path.resolve(dataDir, "users_meta.json"), "utf-8"))
        : {},
    }
    fs.writeFileSync(snapshotFile, JSON.stringify(backupData, null, 2), "utf-8")
    console.log(`[Backup] Preserved state in: ${snapshotFile}`)
  } catch (bErr) {
    console.warn("[Backup] Safety backup notice:", bErr.message)
  }

  // 2. Clear transactional & relation tables
  console.log("[1/6] Purging transactional tables (holds, blocks, audits, bookings)...")
  try { await prisma.temporarySlotHold.deleteMany() } catch (e) { console.warn("holds:", e.message) }
  try { await prisma.animalScheduleBlock.deleteMany() } catch (e) { console.warn("blocks:", e.message) }
  try { await prisma.approvalAuditTrail.deleteMany() } catch (e) { console.warn("audits:", e.message) }
  try { await prisma.booking.deleteMany() } catch (e) { console.warn("bookings:", e.message) }
  try { await prisma.settlementBatch.deleteMany() } catch (e) { console.warn("settlements:", e.message) }
  try { await prisma.gosalaOffering.deleteMany() } catch (e) { console.warn("offerings:", e.message) }
  try { await prisma.gosalaManagerAssignment.deleteMany() } catch (e) { console.warn("assignments:", e.message) }

  // 3. Clear animals table
  console.log("[2/6] Purging animals table...")
  try {
    const deletedAnimals = await prisma.animal.deleteMany()
    console.log(`  ✓ Deleted ${deletedAnimals.count} animals from database`)
  } catch (e) {
    console.warn("animals delete error:", e.message)
  }

  // 4. Clear gosalas table
  console.log("[3/6] Purging gosalas table...")
  try {
    const deletedGosalas = await prisma.gosala.deleteMany()
    console.log(`  ✓ Deleted ${deletedGosalas.count} gosalas from database`)
  } catch (e) {
    console.warn("gosalas delete error:", e.message)
  }

  // 5. Clear non-superadmin users
  console.log("[4/6] Purging all users except Super Admins...")
  const allowedEmails = [
    "nanikoushik96@gmail.com",
    "nanikoushik@gmail.com",
    "koushik@gmail.com",
  ]

  try {
    const nonSuperAdmins = await prisma.user.findMany({
      where: { email: { notIn: allowedEmails } },
      select: { id: true, email: true },
    })
    if (nonSuperAdmins.length > 0) {
      const deletedUsers = await prisma.user.deleteMany({
        where: { id: { in: nonSuperAdmins.map((u) => u.id) } },
      })
      console.log(`  ✓ Deleted ${deletedUsers.count} non-superadmin users`)
    }
  } catch (e) {
    console.warn("users delete error:", e.message)
  }

  // 6. Ensure Super Admins exist with scrypt password
  console.log("[5/6] Verifying Super Admin accounts...")
  const superAdmins = [
    {
      id: "USER-SA-NANIKOUSHIK-96",
      name: "Koushik",
      email: "nanikoushik96@gmail.com",
      phone: "+91 98000 00000",
      role: "SUPER_ADMIN",
      password: hashPassword("Koushik.git"),
      isActive: true,
    },
    {
      id: "USER-SA-NANIKOUSHIK",
      name: "Koushik",
      email: "nanikoushik@gmail.com",
      phone: "+91 98000 00000",
      role: "SUPER_ADMIN",
      password: hashPassword("Koushik.git"),
      isActive: true,
    },
    {
      id: "USER-SA-KOUSHIK",
      name: "Koushik",
      email: "koushik@gmail.com",
      phone: "+91 98000 00000",
      role: "SUPER_ADMIN",
      password: hashPassword("Koushik.git"),
      isActive: true,
    },
  ]

  for (const sa of superAdmins) {
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: sa.email, mode: "insensitive" } },
          { id: sa.id },
        ],
      },
    })
    if (!existing) {
      await prisma.user.create({ data: sa })
      console.log(`  ✓ Created Super Admin: ${sa.email}`)
    } else {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          role: "SUPER_ADMIN",
          password: sa.password,
          isActive: true,
        },
      })
      console.log(`  ✓ Super Admin active: ${sa.email}`)
    }
  }

  // 7. Reset server JSON metadata
  console.log("[6/6] Emptying server JSON metadata files...")
  fs.writeFileSync(path.resolve(dataDir, "animals_meta.json"), JSON.stringify({}, null, 2), "utf-8")
  fs.writeFileSync(path.resolve(dataDir, "gosalas_meta.json"), JSON.stringify({}, null, 2), "utf-8")
  fs.writeFileSync(path.resolve(dataDir, "users_meta.json"), JSON.stringify({}, null, 2), "utf-8")
  console.log("  ✓ Cleared animals_meta.json, gosalas_meta.json, users_meta.json")

  const userCount = await prisma.user.count()
  const animalCount = await prisma.animal.count()
  const gosalaCount = await prisma.gosala.count()
  const bookingCount = await prisma.booking.count()

  console.log("\n==================================================================")
  console.log("  TOTAL WIPE COMPLETE                                            ")
  console.log("==================================================================")
  console.log(`  Users remaining:    ${userCount} (Super Admins only)`)
  console.log(`  Animals remaining:  ${animalCount}`)
  console.log(`  Gosalas remaining:  ${gosalaCount}`)
  console.log(`  Bookings remaining: ${bookingCount}`)
  console.log("==================================================================")
}

wipeAllExceptSuperAdmin()
  .catch((e) => {
    console.error("Wipe failed:", e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
