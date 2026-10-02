import { prisma } from "../server/prisma"

async function checkDb() {
  try {
    await prisma.$connect()
    console.log("✅ CONNECTED TO POSTGRESQL SUCCESSFULLY!")
    const info: any = await prisma.$queryRaw`SELECT current_database(), current_user, inet_server_port(), version();`
    console.log("📊 Database Details:", info)

    const tables: any = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `
    console.log("📋 Public Tables Found:", tables)
  } catch (err: any) {
    console.error("❌ Database Connection Error:", err.message)
  } finally {
    await prisma.$disconnect()
  }
}

checkDb()
