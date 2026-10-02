import {
  PrismaClient,
  UserRole,
  AnimalType,
  BookingStatus,
  SettlementStatus,
  AuditAction,
} from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("🌱 Starting GOMAA PostgreSQL Database Seed...")

  // 1. Clean existing records in topological order
  await prisma.approvalAuditTrail.deleteMany()
  await prisma.temporarySlotHold.deleteMany()
  await prisma.animalScheduleBlock.deleteMany()
  await prisma.booking.deleteMany()
  await prisma.settlementBatch.deleteMany()
  await prisma.animal.deleteMany()
  await prisma.gosalaManagerAssignment.deleteMany()
  await prisma.gosala.deleteMany()
  await prisma.user.deleteMany()
  await prisma.masterPricingConfig.deleteMany()

  // 2. Master Pricing Configuration
  const pricing = await prisma.masterPricingConfig.create({
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
    },
  })
  console.log("✔ Master pricing config created")

  // 3. Seed Users across all roles
  const superAdmin = await prisma.user.create({
    data: {
      name: "Vikramaditya Hegde",
      email: "superadmin@gomaa.in",
      phone: "+91 98200 11000",
      role: UserRole.SUPER_ADMIN,
    },
  })

  const admin = await prisma.user.create({
    data: {
      name: "Priya Sharma",
      email: "admin@gomaa.in",
      phone: "+91 98201 22000",
      role: UserRole.OPERATIONS_ADMIN,
    },
  })

  const driver1 = await prisma.user.create({
    data: {
      name: "Sunil Pawar",
      email: "driver@gomaa.in",
      phone: "+91 98203 33001",
      role: UserRole.DRIVER,
    },
  })

  const driver2 = await prisma.user.create({
    data: {
      name: "Arjun More",
      email: "arjun@gomaa.in",
      phone: "+91 98203 33002",
      role: UserRole.DRIVER,
    },
  })

  const driver3 = await prisma.user.create({
    data: {
      name: "Ganesh Patil",
      email: "ganesh@gomaa.in",
      phone: "+91 98203 33003",
      role: UserRole.DRIVER,
    },
  })

  const customerAnanya = await prisma.user.create({
    data: {
      name: "Ananya Deshmukh",
      email: "ananya@gomaa.in",
      phone: "+91 98204 11827",
      role: UserRole.CUSTOMER,
    },
  })

  const customerRohan = await prisma.user.create({
    data: {
      name: "Rohan Iyer",
      email: "rohan@gmail.com",
      phone: "+91 99872 33410",
      role: UserRole.CUSTOMER,
    },
  })

  const customerMeera = await prisma.user.create({
    data: {
      name: "Meera Kulkarni",
      email: "meera@gmail.com",
      phone: "+91 98765 00921",
      role: UserRole.CUSTOMER,
    },
  })

  const customerVikram = await prisma.user.create({
    data: {
      name: "Vikram Joshi",
      email: "vikram@gmail.com",
      phone: "+91 90045 71230",
      role: UserRole.CUSTOMER,
    },
  })

  // Managers
  const mgrGajanan = await prisma.user.create({
    data: {
      name: "Gajanan Kale",
      email: "manager@gomaa.in",
      phone: "+91 98230 44102",
      role: UserRole.GOSALA_MANAGER,
    },
  })

  const mgrRameshwar = await prisma.user.create({
    data: {
      name: "Rameshwar Shinde",
      email: "rameshwar@nandinigoseva.org",
      phone: "+91 98901 88321",
      role: UserRole.GOSALA_MANAGER,
    },
  })

  const mgrTukaram = await prisma.user.create({
    data: {
      name: "Tukaram Deshpande",
      email: "tukaram@gopaltrust.org",
      phone: "+91 97640 19283",
      role: UserRole.GOSALA_MANAGER,
    },
  })

  const mgrMahadev = await prisma.user.create({
    data: {
      name: "Mahadev Joshi",
      email: "mahadev@vrindavangosala.org",
      phone: "+91 98500 77124",
      role: UserRole.GOSALA_MANAGER,
    },
  })

  const mgrVitthal = await prisma.user.create({
    data: {
      name: "Vitthal Patil",
      email: "vitthal@kamdhenuseva.org",
      phone: "+91 99220 63819",
      role: UserRole.GOSALA_MANAGER,
    },
  })

  console.log("✔ Users seeded")

  // 4. Gosalas
  const gosala1 = await prisma.gosala.create({
    data: {
      name: "Shri Krishna Gaushala",
      region: "Pune West (Kothrud)",
      address: "Near Chandani Chowk, Kothrud, Pune",
      contactPhone: "+91 98230 44102",
      contactEmail: "contact@shrikrishnagosala.org",
      latitude: 18.5074,
      longitude: 73.8077,
    },
  })

  const gosala2 = await prisma.gosala.create({
    data: {
      name: "Nandini Goseva Sadan",
      region: "Pune North (Baner)",
      address: "Baner-Pashan Link Rd, Baner, Pune",
      contactPhone: "+91 98901 88321",
      contactEmail: "contact@nandinigoseva.org",
      latitude: 18.559,
      longitude: 73.7868,
    },
  })

  const gosala3 = await prisma.gosala.create({
    data: {
      name: "Gopal Gaushala Trust",
      region: "Pune East (Kalyani Nagar)",
      address: "Wadgaon Sheri, Kalyani Nagar, Pune",
      contactPhone: "+91 97640 19283",
      contactEmail: "contact@gopaltrust.org",
      latitude: 18.5482,
      longitude: 73.9034,
    },
  })

  const gosala4 = await prisma.gosala.create({
    data: {
      name: "Vrindavan Goshala",
      region: "Pune South (Hadapsar)",
      address: "Saswad Road, Hadapsar, Pune",
      contactPhone: "+91 98500 77124",
      contactEmail: "contact@vrindavangosala.org",
      latitude: 18.4967,
      longitude: 73.9417,
    },
  })

  const gosala5 = await prisma.gosala.create({
    data: {
      name: "Kamdhenu Seva Kendra",
      region: "Pune West (Wakad)",
      address: "Datta Mandir Rd, Wakad, Pune",
      contactPhone: "+91 99220 63819",
      contactEmail: "contact@kamdhenuseva.org",
      latitude: 18.5987,
      longitude: 73.7628,
    },
  })

  console.log("✔ Gosalas seeded")

  // 5. Gosala Manager Assignments
  await prisma.gosalaManagerAssignment.createMany({
    data: [
      {
        userId: mgrGajanan.id,
        gosalaId: gosala1.id,
        region: "Pune West (Kothrud)",
        status: "Active",
      },
      {
        userId: mgrRameshwar.id,
        gosalaId: gosala2.id,
        region: "Pune North (Baner)",
        status: "Active",
      },
      {
        userId: mgrTukaram.id,
        gosalaId: gosala3.id,
        region: "Pune East (Kalyani Nagar)",
        status: "Active",
      },
      {
        userId: mgrMahadev.id,
        gosalaId: gosala4.id,
        region: "Pune South (Hadapsar)",
        status: "Active",
      },
      {
        userId: mgrVitthal.id,
        gosalaId: gosala5.id,
        region: "Pune West (Wakad)",
        status: "Inactive",
      },
    ],
  })

  // 6. Animals
  const gauri = await prisma.animal.create({
    data: {
      gosalaId: gosala1.id,
      name: "Gauri",
      type: AnimalType.COW,
      breed: "Gir",
      ageYears: 5,
    },
  })

  const lakshmi = await prisma.animal.create({
    data: {
      gosalaId: gosala1.id,
      name: "Lakshmi",
      type: AnimalType.COW,
      breed: "Sahiwal",
      ageYears: 6,
    },
  })

  const radha = await prisma.animal.create({
    data: {
      gosalaId: gosala1.id,
      name: "Radha",
      type: AnimalType.COW,
      breed: "Tharparkar",
      ageYears: 4,
    },
  })

  const shyam = await prisma.animal.create({
    data: {
      gosalaId: gosala2.id,
      name: "Shyam",
      type: AnimalType.BULL,
      breed: "Ongole",
      ageYears: 7,
    },
  })

  const ganga = await prisma.animal.create({
    data: {
      gosalaId: gosala2.id,
      name: "Ganga",
      type: AnimalType.COW,
      breed: "Rathi",
      ageYears: 5,
    },
  })

  const nandi = await prisma.animal.create({
    data: {
      gosalaId: gosala3.id,
      name: "Nandi",
      type: AnimalType.BULL,
      breed: "Kankrej",
      ageYears: 8,
    },
  })

  const kesari = await prisma.animal.create({
    data: {
      gosalaId: gosala3.id,
      name: "Kesari",
      type: AnimalType.CALF,
      breed: "Gir Calf",
      ageYears: 1,
    },
  })

  console.log("✔ Animals seeded")

  // 7. Seed Bookings with Historical Snapshots & Audit Trails
  const b1 = await prisma.booking.create({
    data: {
      id: "GMA-24817",
      customerId: customerAnanya.id,
      customerName: customerAnanya.name,
      customerPhone: customerAnanya.phone,
      gosalaId: gosala1.id,
      gosalaName: gosala1.name,
      animalId: gauri.id,
      animalName: gauri.name,
      animalType: gauri.type,
      bookingDate: "26 Sep 2026",
      startTime: "10:00",
      endTime: "12:00",
      durationMin: 120,
      address: "14 Tulsi Nagar, Kothrud, Pune",
      distanceKm: 12.4,
      baseRate: 3500,
      extraTimeFee: 1000,
      transportFee: 370,
      addonsFee: 450,
      taxFee: 468,
      discountFee: 0,
      totalAmount: 5788,
      commissionPct: 20.0,
      commissionAmount: 900,
      gosalaPayable: 4888,
      status: BookingStatus.ADMIN_REVIEW,
      isPaid: true,
      freeKmSnapshot: 5.0,
      perKmSnapshot: 50.0,
      extraUnitRateSnapshot: 500,
      commissionSnapshot: 900,
      managerRemark:
        "Feasibility confirmed. Gauri is in good health and rested for ceremonial service.",
    },
  })

  await prisma.approvalAuditTrail.create({
    data: {
      bookingId: b1.id,
      actorId: mgrGajanan.id,
      actorRole: UserRole.GOSALA_MANAGER,
      actorName: mgrGajanan.name,
      action: AuditAction.MANAGER_CONFIRMED,
      remark:
        "Feasibility confirmed. Gauri is in good health and rested for ceremonial service.",
    },
  })

  const b2 = await prisma.booking.create({
    data: {
      id: "GMA-24816",
      customerId: customerRohan.id,
      customerName: customerRohan.name,
      customerPhone: customerRohan.phone,
      gosalaId: gosala2.id,
      gosalaName: gosala2.name,
      animalId: shyam.id,
      animalName: shyam.name,
      animalType: shyam.type,
      bookingDate: "26 Sep 2026",
      startTime: "08:00",
      endTime: "09:00",
      durationMin: 60,
      address: "Plot 22, Baner Road, Pune",
      distanceKm: 4.2,
      baseRate: 4200,
      extraTimeFee: 0,
      transportFee: 0,
      addonsFee: 300,
      taxFee: 360,
      discountFee: 250,
      totalAmount: 4610,
      commissionPct: 20.0,
      commissionAmount: 840,
      gosalaPayable: 3770,
      status: BookingStatus.PAYMENT_VERIFIED,
      isPaid: true,
      freeKmSnapshot: 5.0,
      perKmSnapshot: 50.0,
      extraUnitRateSnapshot: 500,
      commissionSnapshot: 840,
    },
  })

  const b3 = await prisma.booking.create({
    data: {
      id: "GMA-24815",
      customerId: customerMeera.id,
      customerName: customerMeera.name,
      customerPhone: customerMeera.phone,
      gosalaId: gosala1.id,
      gosalaName: gosala1.name,
      animalId: lakshmi.id,
      animalName: lakshmi.name,
      animalType: lakshmi.type,
      driverId: driver1.id,
      driverStage: 3,
      bookingDate: "27 Sep 2026",
      startTime: "11:00",
      endTime: "12:30",
      durationMin: 90,
      address: "Sr 8, Viman Nagar, Pune",
      distanceKm: 9.1,
      baseRate: 3500,
      extraTimeFee: 500,
      transportFee: 205,
      addonsFee: 650,
      taxFee: 428,
      discountFee: 0,
      totalAmount: 5283,
      commissionPct: 22.0,
      commissionAmount: 880,
      gosalaPayable: 4403,
      status: BookingStatus.CONFIRMED,
      isPaid: true,
      freeKmSnapshot: 5.0,
      perKmSnapshot: 50.0,
      extraUnitRateSnapshot: 500,
      commissionSnapshot: 880,
      managerRemark: "Operational check passed. Handler assigned.",
      adminRemark:
        "Final approval granted. Payment verified via Razorpay webhook.",
    },
  })

  await prisma.approvalAuditTrail.createMany({
    data: [
      {
        bookingId: b3.id,
        actorId: mgrGajanan.id,
        actorRole: UserRole.GOSALA_MANAGER,
        actorName: mgrGajanan.name,
        action: AuditAction.MANAGER_CONFIRMED,
        remark: "Operational check passed. Handler assigned.",
      },
      {
        bookingId: b3.id,
        actorId: admin.id,
        actorRole: UserRole.OPERATIONS_ADMIN,
        actorName: admin.name,
        action: AuditAction.ADMIN_CONFIRMED,
        remark:
          "Final approval granted. Payment verified via Razorpay webhook.",
      },
    ],
  })

  const b4 = await prisma.booking.create({
    data: {
      id: "GMA-24814",
      customerId: customerVikram.id,
      customerName: customerVikram.name,
      customerPhone: customerVikram.phone,
      gosalaId: gosala3.id,
      gosalaName: gosala3.name,
      animalId: kesari.id,
      animalName: kesari.name,
      animalType: kesari.type,
      driverId: driver2.id,
      driverStage: 6,
      bookingDate: "27 Sep 2026",
      startTime: "09:00",
      endTime: "10:00",
      durationMin: 60,
      address: "Lane 5, Kalyani Nagar, Pune",
      distanceKm: 6.8,
      baseRate: 2800,
      extraTimeFee: 0,
      transportFee: 90,
      addonsFee: 200,
      taxFee: 226,
      discountFee: 0,
      totalAmount: 3316,
      commissionPct: 20.0,
      commissionAmount: 560,
      gosalaPayable: 2756,
      status: BookingStatus.IN_SERVICE,
      isPaid: true,
    },
  })

  console.log("✔ Bookings and audit trails seeded")

  // 8. Settlement Batches (Super Admin Treasury)
  await prisma.settlementBatch.createMany({
    data: [
      {
        gosalaId: gosala1.id,
        gosalaName: gosala1.name,
        batch: "SEP-W4",
        bookingsCount: 24,
        grossAmount: 184500,
        commissionPct: 20.0,
        commissionAmount: 36900,
        payableAmount: 147600,
        status: SettlementStatus.APPROVED,
      },
      {
        gosalaId: gosala2.id,
        gosalaName: gosala2.name,
        batch: "SEP-W4",
        bookingsCount: 18,
        grossAmount: 142300,
        commissionPct: 20.0,
        commissionAmount: 28460,
        payableAmount: 113840,
        status: SettlementStatus.PROCESSING,
      },
      {
        gosalaId: gosala3.id,
        gosalaName: gosala3.name,
        batch: "SEP-W4",
        bookingsCount: 15,
        grossAmount: 121800,
        commissionPct: 22.0,
        commissionAmount: 26796,
        payableAmount: 95004,
        status: SettlementStatus.PENDING,
      },
      {
        gosalaId: gosala4.id,
        gosalaName: gosala4.name,
        batch: "SEP-W3",
        bookingsCount: 9,
        grossAmount: 68400,
        commissionPct: 20.0,
        commissionAmount: 13680,
        payableAmount: 54720,
        status: SettlementStatus.PAID,
      },
      {
        gosalaId: gosala5.id,
        gosalaName: gosala5.name,
        batch: "SEP-W3",
        bookingsCount: 6,
        grossAmount: 41200,
        commissionPct: 20.0,
        commissionAmount: 8240,
        payableAmount: 32960,
        status: SettlementStatus.FAILED,
      },
    ],
  })

  // 9. Animal schedule blocks
  await prisma.animalScheduleBlock.create({
    data: {
      animalId: shyam.id,
      animalName: shyam.name,
      date: "26 Sep 2026",
      timeSlot: "11:00",
      reason: "Post-service resting buffer",
      blockedById: admin.id,
    },
  })

  await prisma.animalScheduleBlock.create({
    data: {
      animalId: shyam.id,
      animalName: shyam.name,
      date: "26 Sep 2026",
      timeSlot: "12:00",
      reason: "Post-service resting buffer",
      blockedById: admin.id,
    },
  })

  console.log("✔ Settlement batches and schedule blocks seeded")
  console.log("🚀 PostgreSQL Database Seed Complete!")
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
