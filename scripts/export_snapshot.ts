import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

async function exportSnapshot() {
  console.log('--- 1. Reading current database records ---')
  const users = await prisma.user.findMany()
  const bookings = await prisma.booking.findMany()
  const assignments = await prisma.gosalaManagerAssignment.findMany()
  const auditTrails = await prisma.approvalAuditTrail.findMany()
  const scheduleBlocks = await prisma.animalScheduleBlock.findMany()
  const slotHolds = await prisma.temporarySlotHold.findMany()

  console.log(`Found: ${users.length} users, ${bookings.length} bookings, ${assignments.length} assignments, ${auditTrails.length} audit trails`)

  const dataDir = path.resolve(process.cwd(), 'server', 'data')
  const backupsDir = path.resolve(dataDir, 'backups')
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true })
  }

  let usersMeta: any = {}
  const usersMetaPath = path.resolve(dataDir, 'users_meta.json')
  if (fs.existsSync(usersMetaPath)) {
    try {
      usersMeta = JSON.parse(fs.readFileSync(usersMetaPath, 'utf-8'))
    } catch {}
  }

  let gosalasMeta: any = {}
  const gosalasMetaPath = path.resolve(dataDir, 'gosalas_meta.json')
  if (fs.existsSync(gosalasMetaPath)) {
    try {
      gosalasMeta = JSON.parse(fs.readFileSync(gosalasMetaPath, 'utf-8'))
    } catch {}
  }

  const snapshot = {
    timestamp: new Date().toISOString(),
    description: 'Snapshot archive prior to complete reset & Koushik Super Admin seeding',
    counts: {
      users: users.length,
      bookings: bookings.length,
      assignments: assignments.length,
      auditTrails: auditTrails.length,
      scheduleBlocks: scheduleBlocks.length,
      slotHolds: slotHolds.length,
    },
    tables: {
      users,
      bookings,
      assignments,
      auditTrails,
      scheduleBlocks,
      slotHolds,
    },
    meta: {
      usersMeta,
      gosalasMeta,
    },
  }

  const snapshotFile = path.resolve(backupsDir, 'snapshot_archive_pre_reset.json')
  fs.writeFileSync(snapshotFile, JSON.stringify(snapshot, null, 2), 'utf-8')

  console.log(`✅ Snapshot successfully archived to: ${snapshotFile}`)
}

exportSnapshot()
  .catch((err) => {
    console.error('Snapshot export failed:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
