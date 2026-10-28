import { PrismaClient } from "@prisma/client"

// Prioritize pooled connection strings (PgBouncer) in serverless environments (e.g. Vercel)
// to prevent "FATAL: too many connections for role prisma_migration"
let dbUrl =
  process.env.POSTGRES_PRISMA_URL ||
  process.env.STORAGE_POSTGRES_PRISMA_URL ||
  process.env.DATABASE_PRISMA_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  ""

const isServerless = Boolean(
  process.env.VERCEL ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.NETLIFY ||
  process.env.NODE_ENV === "production"
)

if (dbUrl) {
  const targetLimit = isServerless ? "1" : "5"
  const timeout = isServerless ? "10" : "15"

  if (dbUrl.includes("connection_limit=")) {
    dbUrl = dbUrl.replace(/connection_limit=\d+/, `connection_limit=${targetLimit}`)
  } else {
    const separator = dbUrl.includes("?") ? "&" : "?"
    dbUrl = `${dbUrl}${separator}connection_limit=${targetLimit}&pool_timeout=${timeout}`
  }
}

process.env.DATABASE_URL = dbUrl

// Singleton pattern to prevent connection pool exhaustion during Vite HMR / hot reloads
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function getPrismaInstance(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient({
      datasourceUrl: process.env.DATABASE_URL,
      log: ["warn", "error"],
    })
  }
  return globalForPrisma.prisma
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const instance = getPrismaInstance() as any
    const value = instance[prop]
    return typeof value === "function" ? value.bind(instance) : value
  },
})
