import { prisma } from "../server/prisma"

async function main() {
  const cols = await prisma.$queryRawUnsafe(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'master_pricing_config'
    ORDER BY ordinal_position
  `)
  console.log("Columns in master_pricing_config:", cols)
  await prisma.$disconnect()
}

main().catch(err => {
  console.error("Error:", err)
  process.exit(1)
})
