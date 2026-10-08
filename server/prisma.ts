import { PrismaClient } from "@prisma/client"

// Singleton pattern to prevent connection pool exhaustion during Vite HMR / hot reloads
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function getPrismaInstance(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient({
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
