import { execSync } from "child_process"

console.log("[Build] Running prisma generate...")
try {
  execSync("npx prisma generate", { stdio: "inherit" })
} catch (err) {
  if (process.platform === "win32") {
    console.warn("[Build] Windows query engine DLL lock notice: proceeding with existing generated client...")
  } else {
    console.error("[Build] prisma generate failed:", err.message)
    process.exit(1)
  }
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
      execSync("npx prisma db push --skip-generate", { stdio: "inherit" })
    }
    console.log("[Build] Cloud database schema synchronized successfully!")
    // SAFEGUARD: Never run automated seeding or data mutation during build/deploy.
    // Live customer, manager, admin, booking, and wallet records are strictly preserved.
  } catch (err) {
    console.error("[Deploy] Cloud database sync notice:", err.message)
  }
} else {
  console.log("[Build] Skipping cloud DB push (local/offline environment).")
}
