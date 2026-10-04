import { PrismaClient } from "@prisma/client"

// Singleton pattern to prevent connection pool exhaustion during Vite HMR / hot reloads
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["warn", "error"],
  })

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}
