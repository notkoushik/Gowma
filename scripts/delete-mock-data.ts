import { prisma } from "../server/prisma"

async function deleteMockData() {
  console.log("🧹 Deleting all seeded Gaushalas and Animals from database...")
  try {
    const deletedAnimals = await prisma.animal.deleteMany({})
    console.log(`✅ Deleted ${deletedAnimals.count} animals from database.`)

    const deletedGosalas = await prisma.gosala.deleteMany({})
    console.log(`✅ Deleted ${deletedGosalas.count} Gaushalas from database.`)

    console.log("✨ All mock/seeded data successfully removed. Database is in 100% clean zero-state.")
  } catch (err: any) {
    console.error("❌ Failed to delete data:", err.message)
  } finally {
    await prisma.$disconnect()
  }
}

deleteMockData()
