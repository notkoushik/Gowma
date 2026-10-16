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
    const superAdmin = {
      id: "USER-SA-KOUSHIK",
      name: "Koushik",
      email: "koushik@gmail.com",
      phone: "+91 98000 00000",
      role: "SUPER_ADMIN",
      password: hashPassword("Koushik.git"),
      isActive: true,
    }

    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: superAdmin.email, mode: "insensitive" } },
          { id: superAdmin.id },
        ],
      },
    })

    if (!existing) {
      await prisma.user.create({ data: superAdmin })
      console.log(`[Seed] Created Super Admin: ${superAdmin.email}`)
    } else {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          role: "SUPER_ADMIN",
          password: superAdmin.password,
          isActive: true,
        },
      })
      console.log(`[Seed] Super Admin credentials re-verified: ${superAdmin.email}`)
    }
  } catch (err) {
    console.warn("[Seed] Notice:", err.message)
  } finally {
    await prisma.$disconnect()
  }
}

seed()
