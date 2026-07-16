import { PrismaClient } from '@prisma/client'
import { env } from './env.js'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.isDev ? ['error', 'warn'] : ['error'],
  })

if (!env.isProd) {
  globalForPrisma.prisma = prisma
}

export async function connectDatabase(): Promise<void> {
  await prisma.$connect()
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect()
}
