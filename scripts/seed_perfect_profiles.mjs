import { PrismaClient } from "@prisma/client"
import crypto from "node:crypto"

const prisma = new PrismaClient()

// Standard password hashing using scrypt
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex")
  const derived = crypto.scryptSync(password, salt, 64)
  return `scrypt$${salt}$${derived.toString("hex")}`
}

// AES-256-GCM encryption for bank account storage
function encryptAccount(plain, dataKeyStr = "gomaa_default_secret_key_2026_ledger_secure") {
  const key = crypto.createHash("sha256").update(process.env.GOMAA_DATA_KEY || dataKeyStr).digest()
  const iv = crypto.randomBytes(12)
  const c = crypto.createCipheriv("aes-256-gcm", key, iv)
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()])
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64")).join(".")
}

async function seedPerfectProfiles() {
  console.log("================================================================================")
  console.log("   GOMAA PLATFORM: SEEDING PERFECT PROFILES (SUPER ADMIN, OPS ADMIN, MANAGERS)   ")
  console.log("================================================================================\n")

  // 1. PURGE TEMPORARY JUNK / TEST ACCOUNTS & OLD EXPERIMENTAL ACCOUNTS
  console.log("[Step 1] Purging stale temporary & experimental test accounts...")
  const junkUsers = await prisma.user.findMany({
    where: {
      OR: [
        { email: { startsWith: "test_mgr_" } },
        { email: { startsWith: "mgr_user_test_" } },
        { email: { startsWith: "prod_test_mgr_" } },
        { email: { endsWith: "@gomaa.test" } },
        { email: { endsWith: "@example.test" } },
        { email: "alt.yq-fs88dj2@yopmail.com" },
        { email: "raju@gmail.com" },
        { email: "operations@gomaa.in" },
      ],
    },
    select: { id: true, email: true, name: true },
  })

  for (const ju of junkUsers) {
    try {
      await prisma.gosalaManagerAssignment.deleteMany({ where: { userId: ju.id } })
      await prisma.temporarySlotHold.deleteMany({ where: { customerId: ju.id } })
      const w = await prisma.wallet.findFirst({ where: { userId: ju.id } })
      if (w) {
        await prisma.walletTransaction.deleteMany({ where: { walletId: w.id } })
        await prisma.wallet.delete({ where: { id: w.id } })
      }
      await prisma.user.delete({ where: { id: ju.id } })
      console.log(`  - Purged obsolete account: ${ju.email} (${ju.name})`)
    } catch (e) {
      console.warn(`  - Warning purging ${ju.email}:`, e.message)
    }
  }
  console.log("✓ Cleanup of obsolete accounts completed.\n")

  // 2. DEFINE PERFECT PROFILES SPECIFICATION
  const profiles = [
    // ---------------- SUPER ADMIN ----------------
    {
      id: "USER-SA-SUPERADMIN",
      uniqueId: "GMA-SA-0001",
      name: "Acharya Vishwanath Sharma",
      email: "superadmin@gomaa.in",
      phone: "+91 98000 00001",
      role: "SUPER_ADMIN",
      rawPassword: "SuperAdmin@2026!",
      initialBalanceRupees: 50000,
      metadata: {
        password: "SuperAdmin@2026!",
        adminData: {
          adminId: "GMA-SA-0001",
          designation: "Platform Captain & Supreme Authority",
          department: "Apex Executive Council",
          authorityLevel: "Tier-0 Root Platform",
          treasuryClearanceLevel: "Unrestricted Treasury Control",
          jurisdiction: "All-India Sanctuary Network",
        },
      },
    },

    // ---------------- OPERATIONS ADMINS ----------------
    {
      id: "USER-OPS-HYD-01",
      uniqueId: "GMA-OPS-0101",
      name: "Rajeshwar Rao",
      email: "admin@gomaa.in",
      phone: "+91 98222 00101",
      role: "OPERATIONS_ADMIN",
      rawPassword: "OpsAdmin@2026!",
      initialBalanceRupees: 15000,
      metadata: {
        password: "OpsAdmin@2026!",
        adminData: {
          adminId: "GMA-OPS-0101",
          designation: "Regional Operations Director",
          department: "Telangana Sanctuary Operations & Logistics",
          authorityLevel: "Tier-1 Regional Hub Lead",
          treasuryClearanceLevel: "Operational Escrow Clearance",
          governedGosalas: ["Gaushala_01", "Gaushala_02"],
        },
      },
    },
    {
      id: "USER-OPS-SEC-02",
      uniqueId: "GMA-OPS-0102",
      name: "Vikramaditya Reddy",
      email: "ops.secunderabad@gomaa.in",
      phone: "+91 98222 00102",
      role: "OPERATIONS_ADMIN",
      rawPassword: "OpsAdmin@2026!",
      initialBalanceRupees: 10000,
      metadata: {
        password: "OpsAdmin@2026!",
        adminData: {
          adminId: "GMA-OPS-0102",
          designation: "Zonal Operations Coordinator",
          department: "Secunderabad Cantonment Trust",
          authorityLevel: "Tier-1 Zonal Hub Controller",
          treasuryClearanceLevel: "Regional Payout Settlement",
          governedGosalas: ["Gaushala_03"],
        },
      },
    },

    // ---------------- GAUSHALA MANAGERS ----------------
    {
      id: "USER-MGR-HYD-01",
      uniqueId: "GMA-MGR-0101",
      name: "Shyam Sundar Shastri",
      email: "manager1@gomaa.in",
      phone: "+91 98111 00101",
      role: "GOSALA_MANAGER",
      rawPassword: "Manager@2026!",
      initialBalanceRupees: 5000,
      assignedGosalaName: "Gaushala_01",
      payoutBank: {
        type: "BANK",
        holderName: "Shyam Sundar Shastri",
        bankName: "State Bank of India",
        accountNumber: "98765432104491",
        accountLast4: "4491",
        ifsc: "SBIN0001420",
      },
      metadata: {
        password: "Manager@2026!",
        managerData: {
          managerId: "GMA-MGR-0101",
          gosala: "Gaushala_01",
          region: "Hyderabad Central (Banjara Hills / Jubilee Hills)",
          dailySevaCeiling: 12,
          restingBufferMin: 45,
          assignedGosalas: ["Gaushala_01"],
        },
      },
    },
    {
      id: "USER-MGR-GCB-02",
      uniqueId: "GMA-MGR-0201",
      name: "Gopal Krishna Murthy",
      email: "manager2@gomaa.in",
      phone: "+91 98111 00201",
      role: "GOSALA_MANAGER",
      rawPassword: "Manager@2026!",
      initialBalanceRupees: 7500,
      assignedGosalaName: "Gaushala_02",
      payoutBank: {
        type: "BANK",
        holderName: "Gopal Krishna Murthy",
        bankName: "HDFC Bank",
        accountNumber: "50100234568832",
        accountLast4: "8832",
        ifsc: "HDFC0000456",
      },
      metadata: {
        password: "Manager@2026!",
        managerData: {
          managerId: "GMA-MGR-0201",
          gosala: "Gaushala_02",
          region: "Cyberabad / Gachibowli Zone",
          dailySevaCeiling: 10,
          restingBufferMin: 45,
          assignedGosalas: ["Gaushala_02"],
        },
      },
    },
    {
      id: "USER-MGR-SEC-03",
      uniqueId: "GMA-MGR-0301",
      name: "Raghavendra Swamy",
      email: "manager3@gomaa.in",
      phone: "+91 98111 00301",
      role: "GOSALA_MANAGER",
      rawPassword: "Manager@2026!",
      initialBalanceRupees: 6200,
      assignedGosalaName: "Gaushala_03",
      payoutBank: {
        type: "BANK",
        holderName: "Raghavendra Swamy",
        bankName: "ICICI Bank",
        accountNumber: "00120156789014",
        accountLast4: "9014",
        ifsc: "ICIC0001234",
      },
      metadata: {
        password: "Manager@2026!",
        managerData: {
          managerId: "GMA-MGR-0301",
          gosala: "Gaushala_03",
          region: "Secunderabad & Cantonment",
          dailySevaCeiling: 8,
          restingBufferMin: 60,
          assignedGosalas: ["Gaushala_03"],
        },
      },
    },

    // ---------------- DEVOTEE CUSTOMER ----------------
    {
      id: "USER-DEV-0223",
      uniqueId: "GMA-DEV-0223",
      name: "Srinivas Ramanujan (Devotee)",
      email: "devpulseorg@gmail.com",
      phone: "+91 77807 40223",
      role: "CUSTOMER",
      rawPassword: "Devotee@2026!",
      initialBalanceRupees: 10000,
      metadata: {
        password: "Devotee@2026!",
        customerData: {
          address: "14 Tulsi Nagar, Kondapur, Hyderabad",
          city: "Hyderabad",
          gotra: "Kashyapa",
          preferredCeremony: "Kamadhenu Puja & Gau Seva",
        },
      },
    },

    // ---------------- TRANSIT PILOT / DRIVER ----------------
    {
      id: "USER-DRV-3001",
      uniqueId: "GMA-DRV-3001",
      name: "Sunil Pawar (Transit Pilot)",
      email: "driver@gomaa.in",
      phone: "+91 98203 33001",
      role: "DRIVER",
      rawPassword: "Driver@2026!",
      initialBalanceRupees: 3000,
      metadata: {
        password: "Driver@2026!",
        driverData: {
          driverId: "GMA-DRV-3001",
          vehicleNumber: "MH-12-Q-4491",
          vehicleType: "Tata 407 (8ft Open Bed Hydraulic)",
          licenseNumber: "DL-142011009823",
          gosalaBase: "Gaushala_01",
          status: "Available",
          rating: 4.95,
          totalTrips: 1420,
        },
      },
    },
  ]

  // 3. SEED USERS & WALLETS (AVOIDING UNIQUE CONSTRAINT COLLISIONS)
  console.log("[Step 2] Upserting perfect user profiles and provisioning double-entry wallets...")
  const seededUsers = new Map()

  for (const p of profiles) {
    const passwordHash = hashPassword(p.rawPassword)

    // Clear uniqueId collision if held by another user
    if (p.uniqueId) {
      await prisma.user.updateMany({
        where: {
          uniqueId: p.uniqueId,
          NOT: { email: { equals: p.email, mode: "insensitive" } },
        },
        data: { uniqueId: null },
      })
    }

    // Upsert user by email
    const existing = await prisma.user.findFirst({
      where: { email: { equals: p.email, mode: "insensitive" } },
    })

    let userRecord
    if (existing) {
      userRecord = await prisma.user.update({
        where: { id: existing.id },
        data: {
          uniqueId: p.uniqueId,
          name: p.name,
          phone: p.phone,
          role: p.role,
          password: passwordHash,
          isActive: true,
          metadata: p.metadata,
        },
      })
      console.log(`✓ Synchronized [${p.role}] ${p.name} (${p.email}) -> ID: ${p.uniqueId}`)
    } else {
      userRecord = await prisma.user.create({
        data: {
          id: p.id,
          uniqueId: p.uniqueId,
          name: p.name,
          email: p.email,
          phone: p.phone,
          role: p.role,
          password: passwordHash,
          isActive: true,
          metadata: p.metadata,
        },
      })
      console.log(`✓ Created [${p.role}] ${p.name} (${p.email}) -> ID: ${p.uniqueId}`)
    }
    seededUsers.set(p.email, userRecord)

    // Provision Wallet
    const balancePaise = BigInt(p.initialBalanceRupees * 100)
    let wallet = await prisma.wallet.findUnique({ where: { userId: userRecord.id } })
    if (!wallet) {
      wallet = await prisma.wallet.create({
        data: {
          kind: "USER",
          userId: userRecord.id,
          balancePaise,
          currency: "INR",
          isActive: true,
        },
      })
    } else {
      wallet = await prisma.wallet.update({
        where: { id: wallet.id },
        data: {
          balancePaise,
          isActive: true,
        },
      })
    }

    // Ensure ledger entry for initial balance
    const existingTx = await prisma.walletTransaction.findFirst({
      where: { walletId: wallet.id, purpose: "ADJUSTMENT" },
    })
    if (!existingTx && balancePaise > 0n) {
      await prisma.walletTransaction.create({
        data: {
          walletId: wallet.id,
          amountPaise: balancePaise,
          type: "CREDIT",
          purpose: "ADJUSTMENT",
          status: "SUCCESS",
          balanceBefore: 0n,
          balanceAfter: balancePaise,
          idempotencyKey: `init_balance_${userRecord.id}`,
          description: `Initial verified operational wallet balance of ₹${p.initialBalanceRupees}`,
        },
      })
    }

    // Register verified payout account if defined
    if (p.payoutBank) {
      const bank = p.payoutBank
      const existingAccount = await prisma.payoutAccount.findFirst({
        where: { userId: userRecord.id, ifsc: bank.ifsc },
      })
      if (!existingAccount) {
        await prisma.payoutAccount.create({
          data: {
            userId: userRecord.id,
            type: "BANK",
            holderName: bank.holderName,
            accountLast4: bank.accountLast4,
            ifsc: bank.ifsc,
            accountNumberEnc: encryptAccount(bank.accountNumber),
            usableFrom: new Date(Date.now() - 3600000), // Usable immediately (cool-off passed)
            isActive: true,
          },
        })
        console.log(`  └─ Payout Bank Registered: ${bank.bankName} (•••• ${bank.accountLast4}, IFSC: ${bank.ifsc})`)
      }
    }
  }

  // 4. LINK GAUSHALAS TO GOVERNING OPERATIONS ADMINS & APPOINT MANAGERS
  console.log("\n[Step 3] Linking Gaushalas to Governing Operations Admins & Appointing Managers...")
  const hydAdmin = seededUsers.get("admin@gomaa.in")
  const secAdmin = seededUsers.get("ops.secunderabad@gomaa.in")

  const gaushalasConfig = [
    {
      name: "Gaushala_01",
      region: "Hyderabad Central (Banjara Hills / Jubilee Hills)",
      address: "Plot 42, Road No 12, Banjara Hills, Hyderabad, Telangana 500034",
      contactPhone: "+91 98230 44910",
      contactEmail: "gaushala1@gomaa.in",
      latitude: 17.4156,
      longitude: 78.4357,
      governingAdmin: hydAdmin,
      manager: seededUsers.get("manager1@gomaa.in"),
    },
    {
      name: "Gaushala_02",
      region: "Cyberabad / Gachibowli Zone",
      address: "Survey 88, Financial District, Gachibowli, Hyderabad, Telangana 500032",
      contactPhone: "+91 98230 44911",
      contactEmail: "gaushala2@gomaa.in",
      latitude: 17.4401,
      longitude: 78.3489,
      governingAdmin: hydAdmin,
      manager: seededUsers.get("manager2@gomaa.in"),
    },
    {
      name: "Gaushala_03",
      region: "Secunderabad & Cantonment",
      address: "Temple Road, Trimulgherry, Secunderabad, Telangana 500015",
      contactPhone: "+91 98230 44912",
      contactEmail: "gaushala3@gomaa.in",
      latitude: 17.4721,
      longitude: 78.5028,
      governingAdmin: secAdmin,
      manager: seededUsers.get("manager3@gomaa.in"),
    },
  ]

  for (const gc of gaushalasConfig) {
    const existingG = await prisma.gosala.findFirst({
      where: { name: { equals: gc.name, mode: "insensitive" } },
    })

    const metadataPatch = {
      adminId: gc.governingAdmin.id,
      adminName: gc.governingAdmin.name,
      governingAdminEmail: gc.governingAdmin.email,
      governingAdminRole: "admin",
      managerId: gc.manager.uniqueId,
      managerName: gc.manager.name,
      caretaker: gc.manager.name,
      isActingManager: false,
      actAsManagerMyself: false,
    }

    let gRecord
    if (!existingG) {
      gRecord = await prisma.gosala.create({
        data: {
          name: gc.name,
          region: gc.region,
          address: gc.address,
          contactPhone: gc.contactPhone,
          contactEmail: gc.contactEmail,
          latitude: gc.latitude,
          longitude: gc.longitude,
          isActive: true,
          adminId: gc.governingAdmin.id,
          adminEmail: gc.governingAdmin.email,
          adminName: gc.governingAdmin.name,
          metadata: metadataPatch,
        },
      })
      console.log(`✓ Created Sanctuary ${gc.name} under ${gc.governingAdmin.name}`)
    } else {
      gRecord = await prisma.gosala.update({
        where: { id: existingG.id },
        data: {
          region: gc.region,
          address: gc.address,
          contactPhone: gc.contactPhone,
          contactEmail: gc.contactEmail,
          adminId: gc.governingAdmin.id,
          adminEmail: gc.governingAdmin.email,
          adminName: gc.governingAdmin.name,
          metadata: {
            ...((existingG.metadata && typeof existingG.metadata === "object") ? existingG.metadata : {}),
            ...metadataPatch,
          },
        },
      })
      console.log(`✓ Synchronized Sanctuary ${gc.name} (Governed by ${gc.governingAdmin.name})`)
    }

    // 5. ENFORCE 1:1 ACTIVE CUSTODIAN MANAGER ASSIGNMENT
    await prisma.gosalaManagerAssignment.deleteMany({
      where: {
        gosalaId: gRecord.id,
        NOT: { userId: gc.manager.id },
      },
    })
    await prisma.gosalaManagerAssignment.upsert({
      where: {
        userId_gosalaId: {
          userId: gc.manager.id,
          gosalaId: gRecord.id,
        },
      },
      create: {
        userId: gc.manager.id,
        gosalaId: gRecord.id,
        region: gc.region,
        status: "Active",
      },
      update: {
        status: "Active",
        region: gc.region,
      },
    })
    console.log(`  └─ Appointed Custodian: ${gc.manager.name} (${gc.manager.uniqueId})`)
  }

  // 6. SYNCHRONIZE SPLIT POLICIES IN POSTGRESQL
  console.log("\n[Step 4] Ensuring split policies are registered in database...")
  for (const gc of gaushalasConfig) {
    const existingG = await prisma.gosala.findFirst({ where: { name: gc.name } })
    if (existingG) {
      await prisma.splitPolicy.upsert({
        where: { policyKey: existingG.id },
        update: { managerBp: 3000 },
        create: {
          policyKey: existingG.id,
          managerBp: 3000,
        },
      })
    }
  }
  await prisma.splitPolicy.upsert({
    where: { policyKey: "DEFAULT" },
    update: { managerBp: 3000 },
    create: {
      policyKey: "DEFAULT",
      managerBp: 3000,
    },
  })
  console.log("✓ Default 30% Manager / 60% Shelter Corpus / 10% Platform fee registered.\n")

  console.log("================================================================================")
  console.log("   ALL PERFECT PROFILES CONFIGURED AND SEEDED SUCCESSFULLY!                    ")
  console.log("================================================================================")
}

seedPerfectProfiles()
  .catch((err) => {
    console.error("❌ Seeding failed:", err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
