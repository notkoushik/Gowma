import { PrismaClient } from "@prisma/client"
import fs from "fs"
import path from "path"

const prisma = new PrismaClient()
const META_FILE_PATH = path.resolve(process.cwd(), "server/data/gosalas_meta.json")

async function main() {
  console.log("=== SYNCHRONIZING GAUSHALA PORTFOLIOS & MANAGER ASSIGNMENTS ===")

  // 1. Ensure Super Admin and Admin exist
  let superAdmin = await prisma.user.findFirst({
    where: { OR: [{ role: "SUPER_ADMIN" }, { email: "superadmin@gomaa.in" }, { email: "vikramaditya.hegde@gomaa.in" }] }
  })
  if (!superAdmin) {
    superAdmin = await prisma.user.create({
      data: {
        name: "Vikramaditya Hegde",
        email: "superadmin@gomaa.in",
        phone: "+91 98110 33456",
        role: "SUPER_ADMIN",
        isActive: true,
      }
    })
  }

  let priyaAdmin = await prisma.user.findFirst({
    where: { OR: [{ role: "OPERATIONS_ADMIN" }, { email: "admin@gomaa.in" }, { email: "priya.sharma@gomaa.in" }] }
  })
  if (!priyaAdmin) {
    priyaAdmin = await prisma.user.create({
      data: {
        name: "Priya Sharma",
        email: "admin@gomaa.in",
        phone: "+91 98220 77123",
        role: "OPERATIONS_ADMIN",
        isActive: true,
      }
    })
  }

  // 2. Ensure Managers exist
  const managers = [
    { name: "Gajanan Kale", email: "manager@gomaa.in", phone: "+91 98230 44102", targetGosala: "RamNath Gaushala" },
    { name: "Mahadev Joshi", email: "mahadev@vrindavangosala.org", phone: "+91 98500 77124", targetGosala: "Suryavanchi Gaushala" },
    { name: "Rahul Kamble", email: "rahul.kamble@gomaa.in", phone: "+91 98230 44910", targetGosala: "Surya" },
    { name: "Rameshwar Shinde", email: "rameshwar@nandinigoseva.org", phone: "+91 98901 88321", targetGosala: "Govardhan Goseva Trust" },
  ]

  const userMap: Record<string, any> = {}
  for (const m of managers) {
    let u = await prisma.user.findFirst({
      where: { OR: [{ email: m.email }, { name: m.name }] }
    })
    if (!u) {
      u = await prisma.user.create({
        data: {
          name: m.name,
          email: m.email,
          phone: m.phone,
          role: "GOSALA_MANAGER",
          isActive: true,
        }
      })
    }
    userMap[m.name] = u
  }

  // 3. Ensure Super Admin's Sovereign Gaushala exists
  let govGoseva = await prisma.gosala.findFirst({
    where: { name: "Govardhan Goseva Trust" }
  })
  if (!govGoseva) {
    govGoseva = await prisma.gosala.create({
      data: {
        name: "Govardhan Goseva Trust",
        region: "Telangana - Cyberabad / Gachibowli (HITEC City)",
        address: "Survey 44, Near Financial District, Gachibowli, Hyderabad, Telangana 500032",
        contactPhone: "+91 98490 12345",
        contactEmail: "govardhan.trust@gomaa.in",
        latitude: 17.4401,
        longitude: 78.3489,
        isActive: true,
      }
    })
  }

  // 4. Link Managers to Gaushalas in PostgreSQL
  for (const m of managers) {
    const targetG = await prisma.gosala.findFirst({
      where: { name: m.targetGosala }
    })
    const u = userMap[m.name]
    if (targetG && u) {
      await prisma.gosalaManagerAssignment.upsert({
        where: {
          userId_gosalaId: {
            userId: u.id,
            gosalaId: targetG.id,
          }
        },
        create: {
          userId: u.id,
          gosalaId: targetG.id,
          region: targetG.region,
          status: "Active",
        },
        update: {
          status: "Active",
        }
      })
      console.log(`  ✓ Linked Manager "${m.name}" -> Gaushala "${targetG.name}"`)
    }
  }

  // 5. Update gosalas_meta.json with governance admin info
  let metaStore: Record<string, any> = {}
  if (fs.existsSync(META_FILE_PATH)) {
    try {
      metaStore = JSON.parse(fs.readFileSync(META_FILE_PATH, "utf-8"))
    } catch {}
  }

  // Set Priya Sharma's portfolio
  const priyaGosalas = ["RamNath Gaushala", "Suryavanchi Gaushala", "Surya", "Tirupati Balaji Sacred Surabhi Trust"]
  for (const pName of priyaGosalas) {
    const g = await prisma.gosala.findFirst({ where: { name: pName } })
    if (g) {
      // Find matching manager
      const mgr = managers.find(m => m.targetGosala === pName)
      const meta = metaStore[g.id] || metaStore[pName.toLowerCase()] || {}
      const updatedMeta = {
        ...meta,
        governingAdminRole: "admin",
        governingAdminName: "Priya Sharma",
        adminId: "USER-ADM-101",
        adminName: "Priya Sharma",
        caretaker: mgr ? mgr.name : meta.caretaker || "Dedicated Gosevak Caretaker",
        managerName: mgr ? mgr.name : meta.managerName || "Dedicated Gosevak Caretaker",
        managerId: mgr && userMap[mgr.name] ? userMap[mgr.name].id : meta.managerId,
      }
      metaStore[g.id] = updatedMeta
      metaStore[pName.toLowerCase()] = updatedMeta
    }
  }

  // Set Super Admin's portfolio
  const saMeta = metaStore[govGoseva.id] || metaStore["govardhan goseva trust"] || {}
  const updatedSaMeta = {
    ...saMeta,
    governingAdminRole: "super_admin",
    governingAdminName: "Vikramaditya Hegde",
    adminId: "USER-SA-001",
    adminName: "Vikramaditya Hegde",
    caretaker: "Rameshwar Shinde",
    managerName: "Rameshwar Shinde",
    managerId: userMap["Rameshwar Shinde"]?.id || "MGR-002",
    capacity: 100,
    establishedYear: "2016",
    trustRegistrationNo: "AWBI/2016/TG/HYD-CAPTAIN",
    facilities: [
      "Padded Cattle Ambulance / Van",
      "24/7 Pure Borewell Water & Trough",
      "Certified Veterinary Medical Bay",
      "Sacred Vedic Puja & Havan Courtyard",
      "Organic Green Fodder Pasture",
    ],
    photo: "https://images.unsplash.com/photo-1546722228-7baeca4bd0b3?w=800&h=480&fit=crop&auto=format",
  }
  metaStore[govGoseva.id] = updatedSaMeta
  metaStore["govardhan goseva trust"] = updatedSaMeta

  fs.writeFileSync(META_FILE_PATH, JSON.stringify(metaStore, null, 2), "utf-8")
  console.log("  ✓ Updated server/data/gosalas_meta.json with separate admin portfolios")
  console.log("=== PORTFOLIO & ASSIGNMENTS SYNC COMPLETE ===")
}

main().catch(console.error).finally(() => prisma.$disconnect())
