import { PrismaClient } from "@prisma/client"

const prodUrl =
  "postgres://9e3ba52f1cf3469404f1a554940c8e3d181816ea43224801993180f6d3e222ad:sk_I3vvEHR1FOCS8K7Gl3DyE@db.prisma.io:5432/postgres?sslmode=require"

const prisma = new PrismaClient({
  datasources: { db: { url: prodUrl } },
})

async function main() {
  console.log("Connecting to production db.prisma.io database...")

  // Add missing columns to bookings
  await prisma.$executeRawUnsafe(
    'ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "walletTxId" TEXT;',
  )
  console.log('✓ Added "walletTxId" to "bookings"')

  // Also check if any other columns from prisma/schema.prisma are missing on gosalas or bookings
  await prisma.$executeRawUnsafe(
    'ALTER TABLE "gosalas" ADD COLUMN IF NOT EXISTS "baseCowPrice" INTEGER DEFAULT 3500;',
  )
  await prisma.$executeRawUnsafe(
    'ALTER TABLE "gosalas" ADD COLUMN IF NOT EXISTS "baseBullPrice" INTEGER DEFAULT 4000;',
  )
  await prisma.$executeRawUnsafe(
    'ALTER TABLE "gosalas" ADD COLUMN IF NOT EXISTS "baseCalfPrice" INTEGER DEFAULT 2500;',
  )
  await prisma.$executeRawUnsafe(
    'ALTER TABLE "gosalas" ADD COLUMN IF NOT EXISTS "baseBuffaloPrice" INTEGER DEFAULT 3800;',
  )
  await prisma.$executeRawUnsafe(
    'ALTER TABLE "gosalas" ADD COLUMN IF NOT EXISTS "basePairPrice" INTEGER DEFAULT 4800;',
  )
  await prisma.$executeRawUnsafe(
    'ALTER TABLE "gosalas" ADD COLUMN IF NOT EXISTS "partnershipTier" TEXT DEFAULT \'STANDARD\';',
  )
  await prisma.$executeRawUnsafe(
    'ALTER TABLE "gosalas" ADD COLUMN IF NOT EXISTS "commissionType" TEXT DEFAULT \'PERCENTAGE\';',
  )
  await prisma.$executeRawUnsafe(
    'ALTER TABLE "gosalas" ADD COLUMN IF NOT EXISTS "commissionValue" DOUBLE PRECISION;',
  )
  await prisma.$executeRawUnsafe(
    'ALTER TABLE "gosalas" ADD COLUMN IF NOT EXISTS "taxTreatment" TEXT DEFAULT \'STANDARD_GST\';',
  )
  await prisma.$executeRawUnsafe(
    'ALTER TABLE "gosalas" ADD COLUMN IF NOT EXISTS "customTaxPct" DOUBLE PRECISION;',
  )
  await prisma.$executeRawUnsafe(
    'ALTER TABLE "gosalas" ADD COLUMN IF NOT EXISTS "bufferMinutes" INTEGER DEFAULT 30;',
  )
  await prisma.$executeRawUnsafe(
    'ALTER TABLE "gosalas" ADD COLUMN IF NOT EXISTS "partnershipNotes" TEXT;',
  )
  console.log('✓ Verified all sanctuary economics columns on "gosalas"')

  const columns = await prisma.$queryRawUnsafe(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'walletTxId'",
  )
  console.log("Columns verified in production:", columns)
}

main()
  .catch((err) => {
    console.error("Migration error:", err)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
