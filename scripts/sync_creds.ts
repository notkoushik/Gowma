import { prisma } from "../server/prisma.ts"
import { hashPassword } from "../server/auth/password.ts"

async function main() {
  const adminHash = hashPassword("GomaaAdmin@2026!")
  const superHash = hashPassword("SuperAdmin@2026!")

  // Super Admin
  await prisma.user.updateMany({
    where: { email: "superadmin@gomaa.in" },
    data: { password: superHash, isActive: true },
  })

  // Admins
  await prisma.user.updateMany({
    where: {
      email: {
        in: [
          "alt.yq-fs88dj2@yopmail.com",
          "admin@gomaa.in",
          "operations@gomaa.in",
          "gomaa052026@gmail.com",
        ],
      },
    },
    data: { password: adminHash, isActive: true },
  })

  // Managers
  await prisma.user.updateMany({
    where: { email: { in: ["manager1@gomaa.in", "manager2@gomaa.in"] } },
    data: { password: adminHash, isActive: true },
  })

  // Devotees / Customers
  await prisma.user.updateMany({
    where: {
      email: { in: ["devpulseorg@gmail.com", "devpusleorg@gmail.com"] },
    },
    data: { password: adminHash, isActive: true },
  })

  // Driver
  const existingDriver = await prisma.user.findFirst({
    where: {
      OR: [{ email: "driver@gomaa.in" }, { role: "DRIVER" }],
    },
  })

  if (!existingDriver) {
    await prisma.user.create({
      data: {
        name: "Sunil Pawar (Transit Pilot)",
        email: "driver@gomaa.in",
        phone: "+91 98203 33001",
        role: "DRIVER",
        password: adminHash,
        isActive: true,
      },
    })
    console.log("Created driver@gomaa.in")
  } else {
    await prisma.user.update({
      where: { id: existingDriver.id },
      data: { password: adminHash, isActive: true },
    })
    console.log("Updated driver credentials for", existingDriver.email)
  }

  console.log("SUCCESS: All role passwords synchronized successfully!")
  await prisma.$disconnect()
}

main().catch((err) => {
  console.error("Sync error:", err)
  process.exit(1)
})
