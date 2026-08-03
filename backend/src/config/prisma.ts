import { PrismaMariaDb } from '@prisma/adapter-mariadb'
import { PrismaClient } from '@prisma/client'
import { env } from './env.js'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

/** Low pool size for shared hosting (Hostinger/cPanel process limits). */
const CONNECTION_LIMIT = env.isProd ? 10 : 10

export function createPrismaClient(): PrismaClient {
  const adapter = new PrismaMariaDb({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASS,
    database: env.DB_NAME,
    connectionLimit: CONNECTION_LIMIT,
  })

  return new PrismaClient({
    adapter,
    log: env.isDev ? ['error', 'warn'] : ['error'],
  })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (!env.isProd) {
  globalForPrisma.prisma = prisma
}

export async function connectDatabase(): Promise<void> {
  await prisma.$connect()
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect()
}
