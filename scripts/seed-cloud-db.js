import { PrismaClient } from "@prisma/client"
import crypto from "node:crypto"

const prisma = new PrismaClient()

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex")
  const derived = crypto.scryptSync(password, salt, 64)
  return `scrypt$${salt}$${derived.toString("hex")}`
}

async function seed() {
  try {
    const superAdmins = [
      {
        id: "USER-SA-NANIKOUSHIK",
        name: "Koushik",
        email: "nanikoushik96@gmail.com",
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

    const allowedEmails = superAdmins.map((s) => s.email.toLowerCase())

    // 1. Purge legacy test records and accounts except Super Admins
    try {
      const nonSuperAdminUsers = await prisma.user.findMany({
        where: {
          email: { notIn: allowedEmails },
        },
        select: { id: true, email: true },
      })

      if (nonSuperAdminUsers.length > 0) {
        console.log(`[Seed] Purging ${nonSuperAdminUsers.length} non-superadmin accounts...`)
        try { await prisma.gosalaManagerAssignment.deleteMany() } catch {}
        try { await prisma.temporarySlotHold.deleteMany() } catch {}
        try { await prisma.booking.deleteMany() } catch {}
        try { await prisma.animalScheduleBlock.deleteMany() } catch {}
        try { await prisma.approvalAuditTrail.deleteMany() } catch {}

        await prisma.user.deleteMany({
          where: {
            id: { in: nonSuperAdminUsers.map((u) => u.id) },
          },
        })
        console.log(`[Seed] Purged all legacy accounts. Only Super Admins remain.`)
      }
    } catch (cleanErr) {
      console.warn("[Seed] Purge notice:", cleanErr.message)
    }

    // 2. Ensure both Super Admins exist with scrypt hash
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
        console.log(`[Seed] Created Super Admin: ${sa.email}`)
      } else {
        await prisma.user.update({
          where: { id: existing.id },
          data: {
            role: "SUPER_ADMIN",
            password: sa.password,
            isActive: true,
          },
        })
        console.log(`[Seed] Super Admin re-verified: ${sa.email}`)
      }
    }
  } catch (err) {
    console.warn("[Seed] Notice:", err.message)
  } finally {
    await prisma.$disconnect()
  }
}

seed()
