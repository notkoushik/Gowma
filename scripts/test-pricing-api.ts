import { prisma } from "../server/prisma"

async function main() {
  const config = await prisma.masterPricingConfig.findFirst()
  console.log("Master Pricing Config in DB:", config)
  
  if (!config) {
    console.log("No config found, creating seed config...")
    const created = await prisma.masterPricingConfig.create({
      data: {
        id: 1,
        standardMin: 60,
        extraUnitMin: 30,
        extraUnitRate: 500,
        freeKm: 5.0,
        perKm: 50.0,
        taxPct: 12.0,
        commissionPct: 20.0,
        maxDurationMin: 240,
        bufferMin: 30,
        rounding: "Nearest ₹10",
        updatedByRole: "SUPER_ADMIN",
        updatedByName: "Vikramaditya Hegde",
      }
    })
    console.log("Created default pricing config:", created)
  }
  
  await prisma.$disconnect()
}

main().catch(err => {
  console.error("Error testing pricing config:", err)
  process.exit(1)
})
