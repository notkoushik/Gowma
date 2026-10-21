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
        id: "USER-SA-NANIKOUSHIK-96",
        name: "Koushik",
        email: "nanikoushik96@gmail.com",
        phone: "+91 98000 00000",
        role: "SUPER_ADMIN",
        password: hashPassword("Koushik.git"),
        isActive: true,
      },
      {
        id: "USER-SA-NANIKOUSHIK",
        name: "Koushik",
        email: "nanikoushik@gmail.com",
        phone: "+91 98000 00000",
        role: "SUPER_ADMIN",
        password: hashPassword("Koushik.git"),
        isActive: true,
      },
      {
        id: "USER-SA-KOUSHIK",
        name: "Koushik",
        email: "koushik@gmail.com",
        phone: "+91 98000 00000",
        role: "SUPER_ADMIN",
        password: hashPassword("Koushik.git"),
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
            role: "SUPER_ADMIN",
            isActive: true,
            ...(!existing.password ? { password: sa.password } : {}),
          },
        })
        console.log(`[Seed] Super Admin re-verified: ${sa.email}`)
      }
    }

    // 3. Ensure test devotee account devpulseorg@gmail.com is aligned with phone
    try {
      const devPulse = await prisma.user.findFirst({
        where: { email: { equals: "devpulseorg@gmail.com", mode: "insensitive" } },
      })
      if (devPulse) {
        await prisma.user.update({
          where: { id: devPulse.id },
          data: {
            name: "test-01",
            phone: "+91 7780740223",
            isActive: true,
            ...(!devPulse.password ? { password: hashPassword("Koushik.git") } : {}),
          },
        })
        console.log("[Seed] devpulseorg@gmail.com verified with phone +91 7780740223")
      }
    } catch {}

    // 4. Ensure Operations Admin Admin_1 (alt.yq-fs88dj2@yopmail.com) exists with password Koushik.git
    const admin1Email = "alt.yq-fs88dj2@yopmail.com"
    let admin1User = await prisma.user.findFirst({
      where: { email: { equals: admin1Email, mode: "insensitive" } },
    })

    if (!admin1User) {
      admin1User = await prisma.user.create({
        data: {
          name: "Admin_1",
          email: admin1Email,
          phone: "+91 98222 33344",
          role: "OPERATIONS_ADMIN",
          password: hashPassword("Koushik.git"),
          isActive: true,
        },
      })
      console.log(`[Seed] Created Operations Admin: ${admin1Email}`)
    } else {
      admin1User = await prisma.user.update({
        where: { id: admin1User.id },
        data: {
          name: "Admin_1",
          role: "OPERATIONS_ADMIN",
          isActive: true,
          ...(!admin1User.password ? { password: hashPassword("Koushik.git") } : {}),
        },
      })
      console.log(`[Seed] Synchronized Operations Admin: ${admin1Email}`)
    }

    // 5. Ensure Gaushalas (Gaushala_01, Gaushala_02, Gaushala_03) exist and are governed by Admin_1
    const defaultGosalas = [
      {
        name: "Gaushala_01",
        region: "Hyderabad Central (Banjara Hills / Jubilee Hills)",
        address: "Plot 42, Road No 12, Banjara Hills, Hyderabad, Telangana 500034",
        contactPhone: "+91 98230 44910",
        contactEmail: "gaushala1@gomaa.in",
        latitude: 17.4156,
        longitude: 78.4357,
      },
      {
        name: "Gaushala_02",
        region: "Cyberabad / Gachibowli Zone",
        address: "Survey 88, Financial District, Gachibowli, Hyderabad, Telangana 500032",
        contactPhone: "+91 98230 44911",
        contactEmail: "gaushala2@gomaa.in",
        latitude: 17.4401,
        longitude: 78.3489,
      },
      {
        name: "Gaushala_03",
        region: "Secunderabad & Cantonment",
        address: "Temple Road, Trimulgherry, Secunderabad, Telangana 500015",
        contactPhone: "+91 98230 44912",
        contactEmail: "gaushala3@gomaa.in",
        latitude: 17.4721,
        longitude: 78.5028,
      },
    ]

    for (const gDef of defaultGosalas) {
      const existingG = await prisma.gosala.findFirst({
        where: { name: { equals: gDef.name, mode: "insensitive" } },
      })
      if (!existingG) {
        await prisma.gosala.create({
          data: {
            ...gDef,
            isActive: true,
            adminId: admin1User.id,
            adminEmail: admin1User.email,
            adminName: admin1User.name,
          },
        })
        console.log(`[Seed] Created sanctuary ${gDef.name} governed by ${admin1User.name}`)
      } else if (!existingG.adminId && !existingG.adminEmail) {
        // Only assign default admin if the Gaushala has no governing admin set
        await prisma.gosala.update({
          where: { id: existingG.id },
          data: {
            adminId: admin1User.id,
            adminEmail: admin1User.email,
            adminName: admin1User.name,
          },
        })
        console.log(`[Seed] Assigned unassigned sanctuary ${existingG.name} to ${admin1User.name}`)
      } else {
        console.log(`[Seed] Sanctuary ${existingG.name} governance preserved (${existingG.adminName || existingG.adminEmail})`)
      }
    }

    // 6. Ensure standard Managers exist for Gaushala_01 and Gaushala_03
    const defaultManagers = [
      {
        id: "USER-MGR-01",
        name: "Manager 1",
        email: "manager1@gomaa.in",
        phone: "+91 98111 22233",
        role: "GOSALA_MANAGER",
        password: hashPassword("Koushik.git"),
        isActive: true,
        targetGosalaName: "Gaushala_01",
      },
      {
        id: "USER-MGR-02",
        name: "Manager 2",
        email: "manager2@gomaa.in",
        phone: "+91 98444 55566",
        role: "GOSALA_MANAGER",
        password: hashPassword("Koushik.git"),
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
            name: mDef.name,
            email: mDef.email,
            phone: mDef.phone,
            role: "GOSALA_MANAGER",
            password: mDef.password,
            isActive: true,
          },
        })
        console.log(`[Seed] Created Manager: ${mDef.name} (${mDef.email})`)
      } else {
        await prisma.user.update({
          where: { id: mgr.id },
          data: {
            name: mDef.name,
            role: "GOSALA_MANAGER",
            isActive: true,
            ...(!mgr.password ? { password: mDef.password } : {}),
          },
        })
        console.log(`[Seed] Synchronized Manager: ${mDef.name} (${mDef.email})`)
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
  } catch (err) {
    console.warn("[Seed] Notice:", err.message)
  } finally {
    await prisma.$disconnect()
  }
}

seed()
