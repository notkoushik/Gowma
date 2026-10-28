import { PrismaClient } from "@prisma/client"
import crypto from "node:crypto"

const prisma = new PrismaClient()

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex")
  const derived = crypto.scryptSync(password, salt, 64)
  return `scrypt$${salt}$${derived.toString("hex")}`
}

async function seed() {
  try {
    const superAdmins = [
      {
        id: "USER-SA-SUPERADMIN",
        uniqueId: "GMA-SA-0001",
        name: "Super Admin",
        email: "superadmin@gomaa.in",
        phone: "+91 98000 00000",
        role: "SUPER_ADMIN",
        password: hashPassword("SuperAdmin@2026!"),
        isActive: true,
      },
    ]

    // Note: Non-destructive build step. Only ensures Super Admins exist.
    // NEVER delete users, animals, gaushalas, or bookings during deployment builds.

    // 2. Ensure both Super Admins exist with scrypt hash
    for (const sa of superAdmins) {
      const existing = await prisma.user.findFirst({
        where: {
          OR: [
            { email: { equals: sa.email, mode: "insensitive" } },
            { id: sa.id },
          ],
        },
      })

      if (!existing) {
        await prisma.user.create({ data: sa })
        console.log(`[Seed] Created Super Admin: ${sa.email}`)
      } else {
        await prisma.user.update({
          where: { id: existing.id },
          data: {
            uniqueId: sa.uniqueId,
            role: "SUPER_ADMIN",
            isActive: true,
            ...(!existing.password ? { password: sa.password } : {}),
          },
        })
        console.log(`[Seed] Super Admin re-verified: ${sa.email}`)
      }
    }

    // 3. Ensure test devotee accounts devpulseorg@gmail.com and devpusleorg@gmail.com exist
    try {
      const devoteesToSeed = [
        { email: "devpulseorg@gmail.com", phone: "+91 7780740223", name: "Devotee (devpulseorg)", uniqueId: "GMA-DEV-0223" },
        { email: "devpusleorg@gmail.com", phone: "+91 7780740224", name: "Devotee (devpusleorg)", uniqueId: "GMA-DEV-0224" },
      ]
      for (const d of devoteesToSeed) {
        const existing = await prisma.user.findFirst({
          where: { email: { equals: d.email, mode: "insensitive" } },
        })
        if (existing) {
          await prisma.user.update({
            where: { id: existing.id },
            data: {
              uniqueId: d.uniqueId,
              name: d.name,
              phone: d.phone,
              role: "CUSTOMER",
              isActive: true,
              password: hashPassword("GomaaAdmin@2026!"),
            },
          })
          console.log(`[Seed] Devotee ${d.email} re-verified with unique ID ${d.uniqueId}`)
        } else {
          await prisma.user.create({
            data: {
              uniqueId: d.uniqueId,
              name: d.name,
              email: d.email,
              phone: d.phone,
              role: "CUSTOMER",
              isActive: true,
              password: hashPassword("GomaaAdmin@2026!"),
            },
          })
          console.log(`[Seed] Devotee ${d.email} created with unique ID ${d.uniqueId}`)
        }
      }
    } catch (e) {
      console.warn("[Seed] Devotee error:", e.message)
    }

    // 4. Ensure Operations Admins exist with verified passwords
    const operationsAdmins = [
      {
        email: "alt.yq-fs88dj2@yopmail.com",
        uniqueId: "GMA-OPS-0101",
        name: "Admin_1",
        phone: "+91 98222 33344",
        password: hashPassword("GomaaAdmin@2026!"),
      },
      {
        email: "admin@gomaa.in",
        uniqueId: "GMA-OPS-0102",
        name: "Operations Admin",
        phone: "+91 98222 33345",
        password: hashPassword("GomaaAdmin@2026!"),
      },
      {
        email: "operations@gomaa.in",
        uniqueId: "GMA-OPS-0103",
        name: "Operations Admin",
        phone: "+91 98222 33346",
        password: hashPassword("GomaaAdmin@2026!"),
      },
      {
        email: "gomaa052026@gmail.com",
        uniqueId: "GMA-OPS-0104",
        name: "GOMAA Operations",
        phone: "+91 98222 33347",
        password: hashPassword("GomaaAdmin@2026!"),
      },
    ]

    let admin1User = null
    let gomaaUser = null

    for (const adm of operationsAdmins) {
      let existingAdm = await prisma.user.findFirst({
        where: { email: { equals: adm.email, mode: "insensitive" } },
      })

      if (!existingAdm) {
        existingAdm = await prisma.user.create({
          data: {
            uniqueId: adm.uniqueId,
            name: adm.name,
            email: adm.email,
            phone: adm.phone,
            role: "OPERATIONS_ADMIN",
            password: adm.password,
            isActive: true,
          },
        })
        console.log(`[Seed] Created Operations Admin: ${adm.email}`)
      } else {
        existingAdm = await prisma.user.update({
          where: { id: existingAdm.id },
          data: {
            uniqueId: adm.uniqueId,
            name: adm.name,
            role: "OPERATIONS_ADMIN",
            isActive: true,
            password: adm.password,
          },
        })
        console.log(`[Seed] Synchronized Operations Admin: ${adm.email}`)
      }

      if (adm.email === "alt.yq-fs88dj2@yopmail.com") {
        admin1User = existingAdm
      }
      if (adm.email === "gomaa052026@gmail.com") {
        gomaaUser = existingAdm
      }
    }

    // 5. Ensure Gaushalas (Gaushala_01, Gaushala_02, Gaushala_03) exist and are governed properly
    const defaultGosalas = [
      {
        name: "Gaushala_01",
        region: "Hyderabad Central (Banjara Hills / Jubilee Hills)",
        address: "Plot 42, Road No 12, Banjara Hills, Hyderabad, Telangana 500034",
        contactPhone: "+91 98230 44910",
        contactEmail: "gaushala1@gomaa.in",
        latitude: 17.4156,
        longitude: 78.4357,
        governingAdmin: gomaaUser || admin1User,
      },
      {
        name: "Gaushala_02",
        region: "Cyberabad / Gachibowli Zone",
        address: "Survey 88, Financial District, Gachibowli, Hyderabad, Telangana 500032",
        contactPhone: "+91 98230 44911",
        contactEmail: "gaushala2@gomaa.in",
        latitude: 17.4401,
        longitude: 78.3489,
        governingAdmin: gomaaUser || admin1User,
      },
      {
        name: "Gaushala_03",
        region: "Secunderabad & Cantonment",
        address: "Temple Road, Trimulgherry, Secunderabad, Telangana 500015",
        contactPhone: "+91 98230 44912",
        contactEmail: "gaushala3@gomaa.in",
        latitude: 17.4721,
        longitude: 78.5028,
        governingAdmin: admin1User,
      },
    ]

    for (const gDef of defaultGosalas) {
      const govAdmin = gDef.governingAdmin || admin1User
      const existingG = await prisma.gosala.findFirst({
        where: { name: { equals: gDef.name, mode: "insensitive" } },
      })
      if (!existingG) {
        await prisma.gosala.create({
          data: {
            name: gDef.name,
            region: gDef.region,
            address: gDef.address,
            contactPhone: gDef.contactPhone,
            contactEmail: gDef.contactEmail,
            latitude: gDef.latitude,
            longitude: gDef.longitude,
            isActive: true,
            adminId: govAdmin.id,
            adminEmail: govAdmin.email,
            adminName: govAdmin.name,
          },
        })
        console.log(`[Seed] Created sanctuary ${gDef.name} governed by ${govAdmin.name}`)
      } else {
        await prisma.gosala.update({
          where: { id: existingG.id },
          data: {
            adminId: govAdmin.id,
            adminEmail: govAdmin.email,
            adminName: govAdmin.name,
          },
        })
        console.log(`[Seed] Sanctuary ${existingG.name} synchronized with governance (${govAdmin.name} - ${govAdmin.email})`)
      }
    }

    // 6. Ensure standard Managers exist for Gaushala_01 and Gaushala_03
    const defaultManagers = [
      {
        id: "USER-MGR-01",
        uniqueId: "GMA-MGR-0101",
        name: "Manager 1",
        email: "manager1@gomaa.in",
        phone: "+91 98111 22233",
        role: "GOSALA_MANAGER",
        password: hashPassword("GomaaAdmin@2026!"),
        isActive: true,
        targetGosalaName: "Gaushala_01",
      },
      {
        id: "USER-MGR-02",
        uniqueId: "GMA-MGR-0201",
        name: "Manager 2",
        email: "manager2@gomaa.in",
        phone: "+91 98444 55566",
        role: "GOSALA_MANAGER",
        password: hashPassword("GomaaAdmin@2026!"),
        isActive: true,
        targetGosalaName: "Gaushala_03",
      },
    ]

    for (const mDef of defaultManagers) {
      let mgr = await prisma.user.findFirst({
        where: {
          OR: [
            { email: { equals: mDef.email, mode: "insensitive" } },
            { id: mDef.id },
          ],
        },
      })
      if (!mgr) {
        mgr = await prisma.user.create({
          data: {
            id: mDef.id,
            uniqueId: mDef.uniqueId,
            name: mDef.name,
            email: mDef.email,
            phone: mDef.phone,
            role: "GOSALA_MANAGER",
            password: mDef.password,
            isActive: true,
          },
        })
        console.log(`[Seed] Created Manager: ${mDef.name} (${mDef.email}) with ${mDef.uniqueId}`)
      } else {
        await prisma.user.update({
          where: { id: mgr.id },
          data: {
            uniqueId: mDef.uniqueId,
            name: mDef.name,
            role: "GOSALA_MANAGER",
            isActive: true,
            ...(!mgr.password ? { password: mDef.password } : {}),
          },
        })
        console.log(`[Seed] Synchronized Manager: ${mDef.name} (${mDef.email}) with ${mDef.uniqueId}`)
      }

      // Link to target Gaushala
      const targetG = await prisma.gosala.findFirst({
        where: { name: { equals: mDef.targetGosalaName, mode: "insensitive" } },
      })
      if (targetG) {
        // Enforce 1:1 single-custodian invariant
        await prisma.gosalaManagerAssignment.deleteMany({
          where: {
            gosalaId: targetG.id,
            NOT: { userId: mgr.id },
          },
        })
        await prisma.gosalaManagerAssignment.upsert({
          where: {
            userId_gosalaId: {
              userId: mgr.id,
              gosalaId: targetG.id,
            },
          },
          create: {
            userId: mgr.id,
            gosalaId: targetG.id,
            region: targetG.region,
            status: "Active",
          },
          update: {
            status: "Active",
          },
        })
      }
    }

    // 7. Seed Sacred Cattle Herd across Gaushalas
    const sacredHerdData = [
      {
        gosalaName: "Gaushala_01",
        name: "Surabhi",
        type: "COW",
        breed: "Indigenous Gir Cow",
        ageYears: 4,
        healthStatus: "HEALTHY",
        price: 3500,
      },
      {
        gosalaName: "Gaushala_01",
        name: "Nandini",
        type: "COW",
        breed: "Sahiwal Sacred Cow",
        ageYears: 5,
        healthStatus: "HEALTHY",
        price: 3500,
      },
      {
        gosalaName: "Gaushala_01",
        name: "Gauri & Ganga",
        type: "COW_AND_CALF",
        breed: "Gir Mother Cow & Calf Pair",
        ageYears: 4,
        healthStatus: "HEALTHY",
        price: 4800,
      },
      {
        gosalaName: "Gaushala_01",
        name: "Balarama",
        type: "BULL",
        breed: "Hallikar Nandi Bull",
        ageYears: 6,
        healthStatus: "HEALTHY",
        price: 4000,
      },
      {
        gosalaName: "Gaushala_01",
        name: "Gopala",
        type: "CALF",
        breed: "Young Gir Calf",
        ageYears: 1,
        healthStatus: "HEALTHY",
        price: 2500,
      },
      {
        gosalaName: "Gaushala_02",
        name: "Kapila",
        type: "COW",
        breed: "Indigenous Tharparkar",
        ageYears: 5,
        healthStatus: "HEALTHY",
        price: 3500,
      },
      {
        gosalaName: "Gaushala_02",
        name: "Shyama",
        type: "BUFFALO",
        breed: "Murrah Sacred Buffalo",
        ageYears: 5,
        healthStatus: "HEALTHY",
        price: 3800,
      },
      {
        gosalaName: "Gaushala_02",
        name: "Dharma",
        type: "BULL",
        breed: "Deoni Nandi Bull",
        ageYears: 4,
        healthStatus: "HEALTHY",
        price: 4000,
      },
      {
        gosalaName: "Gaushala_03",
        name: "Kalyani",
        type: "COW",
        breed: "Purebred Kankrej Cow",
        ageYears: 6,
        healthStatus: "HEALTHY",
        price: 3500,
      },
      {
        gosalaName: "Gaushala_03",
        name: "Radha & Kanha",
        type: "COW_AND_CALF",
        breed: "Sahiwal Mother & Calf Pair",
        ageYears: 5,
        healthStatus: "HEALTHY",
        price: 4800,
      },
      {
        gosalaName: "Gaushala_03",
        name: "Keshav",
        type: "CALF",
        breed: "Punganur Dwarf Calf",
        ageYears: 1,
        healthStatus: "HEALTHY",
        price: 2500,
      },
    ]

    for (const aDef of sacredHerdData) {
      const g = await prisma.gosala.findFirst({
        where: { name: { equals: aDef.gosalaName, mode: "insensitive" } },
      })
      if (g) {
        await prisma.animal.upsert({
          where: {
            gosalaId_name: {
              gosalaId: g.id,
              name: aDef.name,
            },
          },
          create: {
            gosalaId: g.id,
            name: aDef.name,
            type: aDef.type,
            breed: aDef.breed,
            ageYears: aDef.ageYears,
            healthStatus: aDef.healthStatus,
            price: aDef.price,
            isActive: true,
          },
          update: {
            type: aDef.type,
            breed: aDef.breed,
            ageYears: aDef.ageYears,
            healthStatus: aDef.healthStatus,
            price: aDef.price,
            isActive: true,
          },
        })
        console.log(`[Seed] Synchronized Sacred Cattle: ${aDef.name} (${aDef.breed}) at ${aDef.gosalaName}`)
      }
    }

    // 8. Seed the 2 Active Operational Bookings (Payment Verified, awaiting review / triage)
    const devotee = await prisma.user.findFirst({
      where: { email: { equals: "devpulseorg@gmail.com", mode: "insensitive" } },
    })
    const g1 = await prisma.gosala.findFirst({
      where: { name: { equals: "Gaushala_01", mode: "insensitive" } },
    })
    const cowSurabhi = await prisma.animal.findFirst({
      where: { name: { equals: "Surabhi", mode: "insensitive" } },
    })
    const cowNandini = await prisma.animal.findFirst({
      where: { name: { equals: "Nandini", mode: "insensitive" } },
    })

    if (devotee && g1 && cowSurabhi) {
      const activeBookings = [
        {
          id: "GMA-25057",
          customerId: devotee.id,
          gosalaId: g1.id,
          animalId: cowSurabhi.id,
          customerName: devotee.name,
          customerPhone: devotee.phone || "+91 7780740223",
          animalName: cowSurabhi.name,
          animalType: cowSurabhi.type,
          gosalaName: g1.name,
          bookingDate: "28 Oct 2026",
          startTime: "08:00",
          endTime: "09:00",
          durationMin: 60,
          address: "Flat/House: Flat 402, Block B, 12th Main Road, Indiranagar, Landmark: Near Ganesha Temple, Ground Floor Courtyard",
          distanceKm: 13.3,
          baseRate: 3500,
          extraTimeFee: 0,
          transportFee: 290,
          addonsFee: 0,
          taxFee: 455,
          discountFee: 0,
          totalAmount: 4245,
          commissionPct: 25,
          commissionAmount: 875,
          gosalaPayable: 2915,
          status: "PAYMENT_VERIFIED",
          driverStage: 0,
          isPaid: true,
          paymentProvider: "RAZORPAY",
          paymentOrderId: "order_test_1793204968301",
          paymentId: "pay_test_1793204968301",
          paymentStatus: "CAPTURED",
          handoverOtp: "8229",
          handoverOtpVerified: false,
        },
        {
          id: "GMA-28492",
          customerId: devotee.id,
          gosalaId: g1.id,
          animalId: (cowNandini || cowSurabhi).id,
          customerName: devotee.name,
          customerPhone: devotee.phone || "+91 7780740223",
          animalName: (cowNandini || cowSurabhi).name,
          animalType: (cowNandini || cowSurabhi).type,
          gosalaName: g1.name,
          bookingDate: "29 Oct 2026",
          startTime: "09:30",
          endTime: "10:30",
          durationMin: 60,
          address: "Plot 88, Road 12, Jubilee Hills, Hyderabad",
          distanceKm: 12.5,
          baseRate: 3500,
          extraTimeFee: 0,
          transportFee: 350,
          addonsFee: 0,
          taxFee: 455,
          discountFee: 0,
          totalAmount: 4305,
          commissionPct: 25,
          commissionAmount: 875,
          gosalaPayable: 2975,
          status: "PAYMENT_VERIFIED",
          driverStage: 0,
          isPaid: true,
          paymentProvider: "RAZORPAY",
          paymentOrderId: "order_test_1793204968302",
          paymentId: "pay_test_1793204968302",
          paymentStatus: "CAPTURED",
          handoverOtp: "5147",
          handoverOtpVerified: false,
        },
      ]

      for (const b of activeBookings) {
        const existing = await prisma.booking.findUnique({ where: { id: b.id } })
        if (!existing) {
          await prisma.booking.create({ data: b })
          console.log(`[Seed] Created active order ${b.id} (${b.animalName}) in ${b.status} status`)
        } else {
          await prisma.booking.update({
            where: { id: b.id },
            data: {
              status: b.status,
              gosalaName: b.gosalaName,
              gosalaId: b.gosalaId,
            },
          })
          console.log(`[Seed] Synchronized active order ${b.id} (${b.status})`)
        }
      }
    }
  } catch (err) {
    console.warn("[Seed] Notice:", err.message)
  } finally {
    await prisma.$disconnect()
  }
}

seed()
