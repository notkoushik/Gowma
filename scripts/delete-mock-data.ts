import { prisma } from "../server/prisma"

// CRITICAL PRODUCTION SAFEGUARD
const dbUrl = process.env.DATABASE_URL || ""
const isCloudOrProd = dbUrl && !dbUrl.includes("localhost") && !dbUrl.includes("127.0.0.1")
if (process.env.NODE_ENV === "production" || isCloudOrProd || process.env.ALLOW_DATABASE_RESET !== "true") {
  console.error("🛑 [SAFETY REFUSED] Delete mock data operation blocked!")
  console.error("This script permanently deletes records and cannot run against cloud or production databases.")
  console.error("To run on local development ONLY, you must explicitly set ALLOW_DATABASE_RESET=true.")
  process.exit(1)
}

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
