import { execSync } from "child_process"

console.log("[Build] Running prisma generate...")
try {
  execSync("npx prisma generate", { stdio: "inherit" })
} catch (err) {
  console.error("[Build] prisma generate failed:", err.message)
  process.exit(1)
}

const dbUrl = process.env.DATABASE_URL || ""
if (dbUrl && !dbUrl.includes("localhost") && !dbUrl.includes("127.0.0.1")) {
  console.log("[Build] Cloud PostgreSQL detected. Synchronizing Prisma schema to cloud database...")
  try {
    execSync("npx prisma db push --accept-data-loss", { stdio: "inherit" })
    console.log("[Build] Cloud database schema synchronized successfully!")
    console.log("[Build] Seeding baseline accounts to cloud database...")
    execSync("node scripts/seed-cloud-db.js", { stdio: "inherit" })
    console.log("[Build] Baseline accounts synchronized successfully!")
  } catch (err) {
    console.warn("[Build] prisma db notice (continuing build):", err.message)
  }
} else {
  console.log("[Build] Skipping cloud DB push (local/offline environment).")
}
