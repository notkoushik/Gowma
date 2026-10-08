import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

async function main() {
  console.log('=== GOMAA COMPLETE INFRASTRUCTURE RESET TO SCRATCH ===')

  // 1. Snapshot archive for safety
  const dataDir = path.resolve(process.cwd(), 'server', 'data')
  const backupsDir = path.resolve(dataDir, 'backups')
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true })
  }

  const gosalas = await prisma.gosala.findMany({
    include: {
      animals: true,
      offerings: true,
      managers: true,
      settlements: true,
    },
  })
  const animals = await prisma.animal.findMany()
  const scheduleBlocks = await prisma.animalScheduleBlock.findMany()
  const slotHolds = await prisma.temporarySlotHold.findMany()

  let gosalasMeta: any = {}
  const gosalasMetaPath = path.resolve(dataDir, 'gosalas_meta.json')
  if (fs.existsSync(gosalasMetaPath)) {
    try {
      gosalasMeta = JSON.parse(fs.readFileSync(gosalasMetaPath, 'utf-8'))
    } catch {}
  }

  const backupPayload = {
    timestamp: new Date().toISOString(),
    description: 'Archived Gaushalas, Animals, and Metadata before Complete Clean Slate',
    counts: {
      gosalas: gosalas.length,
      animals: animals.length,
      scheduleBlocks: scheduleBlocks.length,
      slotHolds: slotHolds.length,
    },
    tables: {
      gosalas,
      animals,
      scheduleBlocks,
      slotHolds,
    },
    meta: {
      gosalasMeta,
    },
  }

  const backupFile = path.resolve(backupsDir, 'snapshot_gosalas_and_infrastructure.json')
  fs.writeFileSync(backupFile, JSON.stringify(backupPayload, null, 2), 'utf-8')
  console.log(`[Backup] Safely saved ${gosalas.length} Gaushalas and ${animals.length} Animals to: ${backupFile}`)

  // 2. Cascade delete dependent infrastructure records in database
  console.log('[Cleanup] Deleting schedule blocks...')
  await prisma.animalScheduleBlock.deleteMany({})

  console.log('[Cleanup] Deleting temporary slot holds...')
  await prisma.temporarySlotHold.deleteMany({})

  console.log('[Cleanup] Deleting offerings...')
  await prisma.gosalaOffering.deleteMany({})

  console.log('[Cleanup] Deleting settlements...')
  await prisma.settlementBatch.deleteMany({})

  console.log('[Cleanup] Deleting animal records...')
  await prisma.animal.deleteMany({})

  console.log('[Cleanup] Deleting manager assignments...')
  await prisma.gosalaManagerAssignment.deleteMany({})

  console.log('[Cleanup] Deleting all gaushala records...')
  await prisma.gosala.deleteMany({})

  // 3. Reset metadata file to empty object
  fs.writeFileSync(gosalasMetaPath, JSON.stringify({}, null, 2), 'utf-8')
  console.log('[Metadata] Reset server/data/gosalas_meta.json to {}')

  // 4. Verify post-reset database counts
  const finalGosalas = await prisma.gosala.count()
  const finalAnimals = await prisma.animal.count()
  const finalUsers = await prisma.user.findMany()

  console.log('=== VERIFICATION SUMMARY ===')
  console.log(`Remaining Gaushalas: ${finalGosalas}`)
  console.log(`Remaining Animals: ${finalAnimals}`)
  console.log(`Remaining Users: ${finalUsers.length}`)
  finalUsers.forEach((u) => {
    console.log(`  - User: ${u.name} (${u.email}) Role: ${u.role}`)
  })

  console.log('=== COMPLETE CLEAN SLATE ACHIEVED ===')
}

main()
  .catch((e) => {
    console.error('Reset failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
