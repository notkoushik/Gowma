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
            password: sa.password,
            isActive: true,
          },
        })
        console.log(`[Seed] Super Admin re-verified: ${sa.email}`)
      }
    }

    // 3. Ensure test devotee account devpulseorg@gmail.com is aligned with Koushik.git password & 7780740223 phone
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
            password: hashPassword("Koushik.git"),
            isActive: true,
          },
        })
        console.log("[Seed] devpulseorg@gmail.com synchronized with phone +91 7780740223 and password Koushik.git")
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
          password: hashPassword("Koushik.git"),
          isActive: true,
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
      } else {
        await prisma.gosala.update({
          where: { id: existingG.id },
          data: {
            adminId: admin1User.id,
            adminEmail: admin1User.email,
            adminName: admin1User.name,
          },
        })
        console.log(`[Seed] Re-assigned sanctuary ${existingG.name} to ${admin1User.name}`)
      }
    }
  } catch (err) {
    console.warn("[Seed] Notice:", err.message)
  } finally {
    await prisma.$disconnect()
  }
}

seed()
