import { PrismaClient } from "@prisma/client"
import { hashPassword } from "../server/auth/password.ts"
import { saveGosalaMeta } from "../server/gosalaMeta.ts"

const prisma = new PrismaClient()

async function main() {
  console.log("=== SEEDING RAJU (GAUSHALA MANAGER) ===")
  const email = "raju@gmail.com"
  const password = "raju123"
  const hashedPassword = hashPassword(password)
  console.log("Generated secure scrypt hash for 'raju123':", hashedPassword)

  // 1. Find Gaushala_02
  const g2 = await prisma.gosala.findFirst({
    where: {
      OR: [
        { name: "Gaushala_02" },
        { region: { contains: "Cyberabad" } },
      ]
    }
  })

  if (!g2) {
    console.error("Gaushala_02 not found in DB!")
    return
  }

  console.log(`Found Gaushala_02: ID = ${g2.id}, Name = ${g2.name}, Region = ${g2.region}`)

  // 2. Upsert User Raju
  let user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } }
  })

  if (!user) {
    user = await prisma.user.create({
      data: {
        name: "Raju",
        email: email.toLowerCase(),
        phone: "+91 98111 22244",
        role: "GOSALA_MANAGER",
        isActive: true,
        password: hashedPassword,
        uniqueId: "GMA-MGR-0202",
      }
    })
    console.log("Created user Raju:", user.id)
  } else {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        name: "Raju",
        email: email.toLowerCase(),
        phone: "+91 98111 22244",
        role: "GOSALA_MANAGER",
        isActive: true,
        password: hashedPassword,
      }
    })
    console.log("Updated user Raju:", user.id)
  }

  // 3. Relieve other managers from Gaushala_02
  await prisma.gosalaManagerAssignment.deleteMany({
    where: {
      gosalaId: g2.id,
      NOT: { userId: user.id }
    }
  })

  // 4. Assign Raju to Gaushala_02
  const assignment = await prisma.gosalaManagerAssignment.upsert({
    where: {
      userId_gosalaId: {
        userId: user.id,
        gosalaId: g2.id,
      }
    },
    create: {
      userId: user.id,
      gosalaId: g2.id,
      region: g2.region,
      status: "Active",
    },
    update: {
      status: "Active",
      region: g2.region,
    }
  })
  console.log("Manager assignment linked:", assignment.id)

  // 5. Update gosala metadata
  const currentMeta = (g2.metadata && typeof g2.metadata === "object") ? { ...g2.metadata } : {}
  currentMeta.managerId = user.id.startsWith("MGR-") ? user.id : `MGR-${user.id.slice(0, 4)}`
  currentMeta.managerName = user.name
  currentMeta.isActingManager = false
  currentMeta.actAsManagerMyself = false

  await prisma.gosala.update({
    where: { id: g2.id },
    data: { metadata: currentMeta }
  })

  saveGosalaMeta(g2.id, g2.name, {
    managerId: user.id.startsWith("MGR-") ? user.id : `MGR-${user.id.slice(0, 4)}`,
    managerName: user.name,
    isActingManager: false,
  })

  console.log("Gaushala_02 metadata successfully linked to Manager Raju!")
}

main().catch(console.error).finally(() => prisma.$disconnect())
