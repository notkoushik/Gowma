import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const baselineAccounts = [
  {
    id: "USER-SA-KOUSHIK",
    name: "Koushik",
    email: "koushik@gmail.com",
    phone: "+91 98000 00000",
    role: "SUPER_ADMIN",
    password: "Koushik.git",
    isActive: true,
  },
  {
    id: "USER-MGR-RAM",
    name: "Rammohan",
    email: "rammohan@gmail.com",
    phone: "+91 98490 12345",
    role: "GOSALA_MANAGER",
    password: "Koushik.git",
    isActive: true,
  },
  {
    id: "USER-OPS-VIKRAM",
    name: "Vikramaditya",
    email: "vikramaditya@gomaa.in",
    phone: "+91 98200 11223",
    role: "OPERATIONS_ADMIN",
    password: "OpsAdmin@2026!",
    isActive: true,
  },
  {
    id: "USER-OPS-RAJESH",
    name: "Rajesh",
    email: "rajesh@gomaa.in",
    phone: "+91 98200 99887",
    role: "OPERATIONS_ADMIN",
    password: "OpsAdmin2@2026!",
    isActive: true,
  },
  {
    id: "USER-CUST-RADHA",
    name: "Radha",
    email: "radha@gmail.com",
    phone: "+91 98200 44556",
    role: "CUSTOMER",
    password: "koushik.git",
    isActive: true,
  },
  {
    id: "USER-DRV-SUNIL",
    name: "Sunil Pawar",
    email: "sunil.pawar@gomaa.in",
    phone: "+91 98440 55667",
    role: "DRIVER",
    password: "koushik.git",
    isActive: true,
  },
]

async function seed() {
  try {
    for (const acc of baselineAccounts) {
      const existing = await prisma.user.findFirst({
        where: { email: { equals: acc.email, mode: "insensitive" } },
      })
      if (!existing) {
        await prisma.user.create({ data: acc })
        console.log(`[Seed] Created account: ${acc.email} (${acc.role})`)
      } else {
        await prisma.user.update({
          where: { id: existing.id },
          data: { password: acc.password, isActive: true },
        })
        console.log(`[Seed] Updated password for: ${acc.email}`)
      }
    }
  } catch (err) {
    console.warn("[Seed] Notice:", err.message)
  } finally {
    await prisma.$disconnect()
  }
}

seed()
