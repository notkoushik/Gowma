import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

async function restoreSnapshot() {
  const snapshotFile = path.resolve(process.cwd(), 'server', 'data', 'backups', 'snapshot_archive_pre_reset.json')
  if (!fs.existsSync(snapshotFile)) {
    throw new Error(`Snapshot file not found at ${snapshotFile}`)
  }

  console.log(`Reading archive from: ${snapshotFile}`)
  const raw = fs.readFileSync(snapshotFile, 'utf-8')
  const snapshot = JSON.parse(raw)

  console.log(`Archived at: ${snapshot.timestamp}`)
  console.log(`Record counts: Users: ${snapshot.counts.users}, Bookings: ${snapshot.counts.bookings}`)

  // 1. Clear current tables
  console.log('Cleaning active records...')
  await prisma.approvalAuditTrail.deleteMany()
  await prisma.temporarySlotHold.deleteMany()
  await prisma.animalScheduleBlock.deleteMany()
  await prisma.booking.deleteMany()
  await prisma.gosalaManagerAssignment.deleteMany()
  await prisma.user.deleteMany()

  // 2. Restore Users
  console.log('Restoring users...')
  for (const u of snapshot.tables.users) {
    await prisma.user.create({
      data: {
        id: u.id,
        email: u.email,
        name: u.name,
        phone: u.phone,
        role: u.role,
        avatar: u.avatar,
        isActive: u.isActive,
        createdAt: new Date(u.createdAt),
        updatedAt: new Date(u.updatedAt),
      },
    })
  }

  // 3. Restore Manager Assignments
  console.log('Restoring manager assignments...')
  for (const a of snapshot.tables.assignments) {
    await prisma.gosalaManagerAssignment.create({
      data: {
        id: a.id,
        userId: a.userId,
        gosalaId: a.gosalaId,
        region: a.region,
        status: a.status,
        assignedAt: new Date(a.assignedAt),
      },
    })
  }

  // 4. Restore Bookings
  console.log('Restoring bookings...')
  for (const b of snapshot.tables.bookings) {
    await prisma.booking.create({
      data: {
        id: b.id,
        customerId: b.customerId,
        gosalaId: b.gosalaId,
        animalId: b.animalId,
        driverId: b.driverId,
        customerName: b.customerName,
        customerPhone: b.customerPhone,
        animalName: b.animalName,
        animalType: b.animalType,
        gosalaName: b.gosalaName,
        bookingDate: b.bookingDate,
        startTime: b.startTime,
        endTime: b.endTime,
        durationMin: b.durationMin,
        address: b.address,
        distanceKm: b.distanceKm,
        baseRate: b.baseRate,
        extraTimeFee: b.extraTimeFee,
        transportFee: b.transportFee,
        addonsFee: b.addonsFee,
        taxFee: b.taxFee,
        discountFee: b.discountFee,
        totalAmount: b.totalAmount,
        commissionPct: b.commissionPct,
        commissionAmount: b.commissionAmount,
        gosalaPayable: b.gosalaPayable,
        status: b.status,
        driverStage: b.driverStage,
        isPaid: b.isPaid,
        freeKmSnapshot: b.freeKmSnapshot,
        perKmSnapshot: b.perKmSnapshot,
        extraUnitRateSnapshot: b.extraUnitRateSnapshot,
        commissionSnapshot: b.commissionSnapshot,
        managerRemark: b.managerRemark,
        adminRemark: b.adminRemark,
        handoverOtp: b.handoverOtp,
        handoverOtpVerified: b.handoverOtpVerified,
        handoverOtpVerifiedAt: b.handoverOtpVerifiedAt ? new Date(b.handoverOtpVerifiedAt) : null,
        driverPhone: b.driverPhone,
        driverVehiclePlate: b.driverVehiclePlate,
        driverVehicleModel: b.driverVehicleModel,
        driverRating: b.driverRating,
        driverTotalTrips: b.driverTotalTrips,
        driverAvatar: b.driverAvatar,
        createdAt: new Date(b.createdAt),
        updatedAt: new Date(b.updatedAt),
      },
    })
  }

  // 5. Restore Audit Trails
  console.log('Restoring audit trails...')
  for (const at of snapshot.tables.auditTrails) {
    await prisma.approvalAuditTrail.create({
      data: {
        id: at.id,
        bookingId: at.bookingId,
        action: at.action,
        actorId: at.actorId,
        actorRole: at.actorRole,
        previousStatus: at.previousStatus,
        newStatus: at.newStatus,
        remarks: at.remarks,
        createdAt: new Date(at.createdAt),
      },
    })
  }

  // 6. Restore metadata files
  const dataDir = path.resolve(process.cwd(), 'server', 'data')
  if (snapshot.meta.usersMeta) {
    fs.writeFileSync(path.resolve(dataDir, 'users_meta.json'), JSON.stringify(snapshot.meta.usersMeta, null, 2), 'utf-8')
  }
  if (snapshot.meta.gosalasMeta) {
    fs.writeFileSync(path.resolve(dataDir, 'gosalas_meta.json'), JSON.stringify(snapshot.meta.gosalasMeta, null, 2), 'utf-8')
  }

  console.log('🎉 Snapshot restoration complete!')
}

restoreSnapshot()
  .catch((err) => {
    console.error('Snapshot restore failed:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
