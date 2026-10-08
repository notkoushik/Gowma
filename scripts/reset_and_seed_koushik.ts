import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

async function resetAndSeed() {
  console.log('--- 1. Purging transactional audit trails & bookings ---')
  const atCount = await prisma.approvalAuditTrail.deleteMany()
  const holdCount = await prisma.temporarySlotHold.deleteMany()
  const blockCount = await prisma.animalScheduleBlock.deleteMany()
  const bCount = await prisma.booking.deleteMany()
  console.log(`Deleted: ${atCount.count} audit trails, ${bCount.count} bookings`)

  console.log('--- 2. Purging manager assignments & all user accounts ---')
  const assignCount = await prisma.gosalaManagerAssignment.deleteMany()
  const uCount = await prisma.user.deleteMany()
  console.log(`Deleted: ${assignCount.count} manager assignments, ${uCount.count} users`)

  console.log('--- 3. Resetting user metadata store ---')
  const usersMetaPath = path.resolve(process.cwd(), 'server', 'data', 'users_meta.json')
  fs.writeFileSync(usersMetaPath, JSON.stringify({}, null, 2), 'utf-8')

  console.log('--- 4. Unassigning Gaushala managers for fresh start ---')
  const gosalasMetaPath = path.resolve(process.cwd(), 'server', 'data', 'gosalas_meta.json')
  if (fs.existsSync(gosalasMetaPath)) {
    try {
      const gMeta = JSON.parse(fs.readFileSync(gosalasMetaPath, 'utf-8'))
      for (const key of Object.keys(gMeta)) {
        gMeta[key].managerId = ''
        gMeta[key].managerName = 'Unassigned (Awaiting Admin)'
        gMeta[key].isActingManager = false
        gMeta[key].actAsManagerMyself = false
      }
      fs.writeFileSync(gosalasMetaPath, JSON.stringify(gMeta, null, 2), 'utf-8')
    } catch {}
  }

  console.log('--- 5. Provisioning New Super Admin (koushik@gmail.com) ---')
  const superAdmin = await prisma.user.create({
    data: {
      id: 'USER-SA-KOUSHIK',
      email: 'koushik@gmail.com',
      name: 'Koushik',
      phone: '+91 98000 00000',
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  })

  console.log('🎉 Super Admin successfully created:')
  console.log({
    id: superAdmin.id,
    name: superAdmin.name,
    email: superAdmin.email,
    role: superAdmin.role,
    password: 'Koushik.git',
  })
}

resetAndSeed()
  .catch((err) => {
    console.error('Reset and seed failed:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
