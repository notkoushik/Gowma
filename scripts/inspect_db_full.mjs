import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  console.log("=== USERS ===")
  const users = await prisma.user.findMany({
    include: {
      managerAssignments: {
        include: { gosala: true }
      }
    }
  })
  console.log(`Total users: ${users.length}`)
  for (const u of users) {
    console.log(`[User] ID: ${u.id} | Email: ${u.email} | Name: ${u.name} | Role: ${u.role} | Active: ${u.isActive} | UniqueId: ${u.uniqueId} | Password: ${u.password ? (u.password.startsWith("scrypt$") ? "scrypt_hash" : "PLAIN:" + u.password) : "NONE"}`)
    if (u.managerAssignments && u.managerAssignments.length > 0) {
      console.log(`   -> Assignments:`, u.managerAssignments.map(a => `${a.gosala.name} (${a.region})`))
    }
  }

  console.log("\n=== GOSALAS ===")
  const gosalas = await prisma.gosala.findMany()
  console.log(`Total gosalas: ${gosalas.length}`)
  for (const g of gosalas) {
    console.log(`[Gosala] ID: ${g.id} | Name: ${g.name} | Region: ${g.region} | Metadata:`, JSON.stringify(g.metadata))
  }

  console.log("\n=== BOOKINGS ===")
  const bookings = await prisma.booking.findMany()
  console.log(`Total bookings: ${bookings.length}`)
  for (const b of bookings) {
    console.log(`[Booking] ID: ${b.id} | Animal: ${b.animalName} | Customer: ${b.customerName} | Status: ${b.status} | Date: ${b.bookingDate} | Location: ${b.location}`)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
