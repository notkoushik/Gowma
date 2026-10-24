import { PrismaClient } from "@prisma/client"
import { generateUniqueId } from "../server/auth/authService.ts"

const prisma = new PrismaClient()

const KNOWN_UNIQUE_IDS = {
  "nanikoushik96@gmail.com": "GMA-SA-0001",
  "nanikoushik@gmail.com": "GMA-SA-0002",
  "koushik@gmail.com": "GMA-SA-0003",
  "alt.yq-fs88dj2@yopmail.com": "GMA-OPS-0101",
  "admin@gomaa.in": "GMA-OPS-0102",
  "operations@gomaa.in": "GMA-OPS-0103",
  "gomaa052026@gmail.com": "GMA-OPS-0104",
  "manager1@gomaa.in": "GMA-MGR-0101",
  "manager2@gomaa.in": "GMA-MGR-0201",
  "devpulseorg@gmail.com": "GMA-DEV-0223",
  "devpusleorg@gmail.com": "GMA-DEV-0224",
}

async function run() {
  console.log("=== GOMAA UNIQUE PERSON IDENTIFIER MIGRATION ===")
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } })
  console.log(`Found ${users.length} users in database.`)

  let updated = 0
  for (const u of users) {
    const targetUniqueId = KNOWN_UNIQUE_IDS[u.email.toLowerCase()] || u.uniqueId || generateUniqueId(u.role, u.phone)
    if (u.uniqueId !== targetUniqueId) {
      await prisma.user.update({
        where: { id: u.id },
        data: { uniqueId: targetUniqueId },
      })
      console.log(`  ✓ Assigned ${u.role} (${u.email}): ${targetUniqueId}`)
      updated++
    } else {
      console.log(`  - Verified ${u.role} (${u.email}): ${u.uniqueId}`)
    }
  }

  console.log(`=== MIGRATION COMPLETE! Updated ${updated} users. ===\n`)
  const verified = await prisma.user.findMany({ select: { uniqueId: true, role: true, name: true, email: true, phone: true } })
  console.table(verified)
}

run()
  .catch((e) => console.error("Migration error:", e))
  .finally(() => prisma.$disconnect())
