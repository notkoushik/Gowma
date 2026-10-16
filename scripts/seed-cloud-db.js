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

    // Note: Non-destructive build step. Only ensures Super Admins exist.
    // NEVER delete users, animals, gaushalas, or bookings during deployment builds.

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

    // 3. Ensure test devotee account devpulseorg@gmail.com is aligned with Koushik.git password & 7780740223 phone
    try {
      const devPulse = await prisma.user.findFirst({
        where: { email: { equals: "devpulseorg@gmail.com", mode: "insensitive" } },
      })
      if (devPulse) {
        await prisma.user.update({
          where: { id: devPulse.id },
          data: {
            name: "test-01",
            phone: "+91 7780740223",
            password: hashPassword("Koushik.git"),
            isActive: true,
          },
        })
        console.log("[Seed] devpulseorg@gmail.com synchronized with phone +91 7780740223 and password Koushik.git")
      }
    } catch {}
  } catch (err) {
    console.warn("[Seed] Notice:", err.message)
  } finally {
    await prisma.$disconnect()
  }
}

seed()
