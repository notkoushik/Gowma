import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      uniqueId: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      isActive: true,
      wallet: { select: { id: true, balancePaise: true } },
      managerAssignments: {
        include: { gosala: { select: { id: true, name: true, region: true } } }
      }
    },
    orderBy: { createdAt: "asc" }
  })

  console.log("\n=== ALL USERS IN DATABASE ===")
  for (const u of users) {
    const assigned = u.managerAssignments?.map(a => a.gosala?.name).join(", ") || "None"
    const bal = u.wallet ? `₹${Number(u.wallet.balancePaise) / 100}` : "No Wallet"
    console.log(`[${u.role}] ${u.uniqueId || 'NO-ID'} | ${u.name} | ${u.email} | Phone: ${u.phone} | Wallet: ${bal} | Assigned: ${assigned}`)
  }

  const gosalas = await prisma.gosala.findMany({
    select: { id: true, name: true, region: true, adminId: true, adminName: true, adminEmail: true },
    orderBy: { createdAt: "asc" }
  })
  console.log("\n=== ALL GAUSHALAS IN DATABASE ===")
  for (const g of gosalas) {
    console.log(`[Gaushala] ${g.name} (${g.region}) | Admin: ${g.adminName || 'None'} (${g.adminEmail || 'None'}) [ID: ${g.adminId || 'None'}]`)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
