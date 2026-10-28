import { PrismaClient } from "@prisma/client"

let dbUrl =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL ||
  process.env.STORAGE_POSTGRES_PRISMA_URL ||
  ""

// In serverless environments (Vercel, AWS Lambda), enforce strict connection limits
// to prevent pool exhaustion (FATAL: too many connections for role)
if (dbUrl && !dbUrl.includes("connection_limit=")) {
  const separator = dbUrl.includes("?") ? "&" : "?"
  dbUrl = `${dbUrl}${separator}connection_limit=2&pool_timeout=15`
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
