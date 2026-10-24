import { execSync } from "child_process"

console.log("[Build] Running prisma generate...")
try {
  execSync("npx prisma generate", { stdio: "inherit" })
} catch (err) {
  console.error("[Build] prisma generate failed:", err.message)
  process.exit(1)
}

const dbUrl =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL ||
  process.env.STORAGE_POSTGRES_PRISMA_URL ||
  ""
if (dbUrl) {
  process.env.DATABASE_URL = dbUrl
}

if (dbUrl && !dbUrl.includes("localhost") && !dbUrl.includes("127.0.0.1")) {
  console.log("[Build] Cloud PostgreSQL detected. Synchronizing Prisma schema to cloud database...")
  try {
    try {
      execSync("npx prisma migrate deploy", { stdio: "inherit" })
    } catch {
      console.log("[Build] Applying direct schema sync via db push...")
      execSync("npx prisma db push --skip-generate --accept-data-loss", { stdio: "inherit" })
    }
    console.log("[Build] Cloud database schema synchronized successfully!")
    console.log("[Build] Ensuring Super Admin account exists in cloud database...")
    execSync("node scripts/seed-cloud-db.js", { stdio: "inherit" })
    console.log("[Build] Super Admin account synchronized successfully!")
  } catch (err) {
    console.error("[Deploy] Cloud database sync notice:", err.message)
  }
} else {
  console.log("[Build] Skipping cloud DB push (local/offline environment).")
}
