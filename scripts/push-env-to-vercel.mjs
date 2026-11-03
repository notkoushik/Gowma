import fs from "node:fs"
import { execSync } from "node:child_process"

/**
 * Utility to push a local .env file in bulk to Vercel via Vercel CLI.
 * Usage:
 *   node scripts/push-env-to-vercel.mjs [filePath] [environments]
 * Examples:
 *   node scripts/push-env-to-vercel.mjs .env.production production
 *   node scripts/push-env-to-vercel.mjs .env production,preview,development
 */

const envFile = process.argv[2] || ".env"
const environments = process.argv[3] || "production"

if (!fs.existsSync(envFile)) {
  console.error(`❌ File not found: ${envFile}`)
  process.exit(1)
}

console.log(`\n================================================================================`)
console.log(`   🚀 PUSHING ENVIRONMENT VARIABLES TO VERCEL`)
console.log(`   Source File : ${envFile}`)
console.log(`   Environments: ${environments}`)
console.log(`================================================================================\n`)

const content = fs.readFileSync(envFile, "utf8")
const lines = content.split("\n")

const envVars = []

for (let line of lines) {
  line = line.trim()
  if (!line || line.startsWith("#")) continue

  const equalsIdx = line.indexOf("=")
  if (equalsIdx === -1) continue

  const key = line.slice(0, equalsIdx).trim()
  let value = line.slice(equalsIdx + 1).trim()

  // Strip wrapping quotes if present
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1)
  }

  // Skip placeholder or sensitive markers
  if (value === "[SENSITIVE]" || value === "") {
    console.warn(`⚠️  Skipping ${key}: placeholder or empty value`)
    continue
  }

  envVars.push({ key, value })
}

// Automatically ensure Prisma / PostgreSQL alias keys match DATABASE_URL
const dbEntry = envVars.find((e) => e.key === "DATABASE_URL")
if (dbEntry) {
  if (!envVars.some((e) => e.key === "DATABASE_POSTGRES_URL")) {
    envVars.push({ key: "DATABASE_POSTGRES_URL", value: dbEntry.value })
  }
  if (!envVars.some((e) => e.key === "DATABASE_PRISMA_DATABASE_URL")) {
    envVars.push({ key: "DATABASE_PRISMA_DATABASE_URL", value: dbEntry.value })
  }
}

console.log(`Found ${envVars.length} valid environment variable(s) to upload.\n`)

let success = 0
let failed = 0

for (const { key, value } of envVars) {
  process.stdout.write(`Uploading ${key}... `)
  try {
    const isClientConfig = key.startsWith("VITE_") || key.startsWith("NEXT_PUBLIC_")
    const typeFlag = isClientConfig ? "--type config" : ""
    const cmd = `npx vercel env add ${key} --environment ${environments} ${typeFlag} --yes --force`
    execSync(cmd, { input: value, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] })
    console.log(`✔ OK`)
    success++
  } catch (err) {
    console.log(`✗ Failed: ${err.message}`)
    failed++
  }
}

console.log(`\n================================================================================`)
console.log(`   DONE: ${success} updated, ${failed} failed`)
console.log(`================================================================================\n`)
