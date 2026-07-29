import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '@prisma/client';
import { env } from './env.js';
const globalForPrisma = globalThis;
const CONNECTION_LIMIT = env.isProd ? 10 : 10;
export function createPrismaClient() {
    const adapter = new PrismaMariaDb({
        host: env.DB_HOST,
        port: env.DB_PORT,
        user: env.DB_USER,
        password: env.DB_PASS,
        database: env.DB_NAME,
        connectionLimit: CONNECTION_LIMIT,
    });
    return new PrismaClient({
        adapter,
        log: env.isDev ? ['error', 'warn'] : ['error'],
    });
}
export const prisma = globalForPrisma.prisma ?? createPrismaClient();
if (!env.isProd) {
    globalForPrisma.prisma = prisma;
}
export async function connectDatabase() {
    await prisma.$connect();
}
export async function disconnectDatabase() {
    await prisma.$disconnect();
}
