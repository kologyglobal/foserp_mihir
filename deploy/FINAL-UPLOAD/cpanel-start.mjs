/**
 * cPanel / no-SSH entrypoint.
 * - Applies Prisma migrations
 * - Seeds once when the database has no tenants (SEED_ON_EMPTY=true)
 * - Starts the API + SPA
 *
 * cPanel Node.js "Application startup file": cpanel-start.mjs
 */
import { config as loadEnv } from 'dotenv'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

loadEnv()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
process.chdir(__dirname)

function buildDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  const host = process.env.DB_HOST ?? 'localhost'
  const port = process.env.DB_PORT ?? '3306'
  const name = process.env.DB_NAME ?? 'fos_erp'
  const user = process.env.DB_USER ?? 'root'
  const pass = encodeURIComponent(process.env.DB_PASS ?? '')
  return `mysql://${user}:${pass}@${host}:${port}/${name}`
}

process.env.DATABASE_URL = buildDatabaseUrl()
process.env.NODE_ENV = process.env.NODE_ENV || 'production'

function run(cmd, args) {
  console.log(`[cpanel-start] ${cmd} ${args.join(' ')}`)
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: true, env: process.env })
  if ((r.status ?? 1) !== 0) {
    throw new Error(`Failed: ${cmd} ${args.join(' ')}`)
  }
}

async function shouldSeed() {
  if (process.env.SEED_ON_EMPTY !== 'true') return false
  const { PrismaClient } = await import('@prisma/client')
  const prisma = new PrismaClient()
  try {
    const count = await prisma.tenant.count()
    return count === 0
  } catch {
    return true
  } finally {
    await prisma.$disconnect()
  }
}

async function main() {
  if (process.env.RUN_MIGRATE_ON_START !== 'false') {
    run('npx', ['prisma', 'migrate', 'deploy'])
  }

  if (await shouldSeed()) {
    console.log('[cpanel-start] Empty database — running seed…')
    run('npx', ['tsx', 'prisma/seed.ts'])
    console.log('[cpanel-start] Seed done. Set SEED_ON_EMPTY=false in .env via File Manager after first login.')
  }

  const distServer = path.join(__dirname, 'dist', 'server.js')
  if (fs.existsSync(distServer)) {
    const serverUrl = pathToFileURL(distServer).href
    await import(serverUrl)
    return
  }

  // Fallback: run TypeScript entry with tsx (no pre-built dist)
  console.log('[cpanel-start] dist/ missing — starting with tsx src/server.ts')
  run('npx', ['tsx', 'src/server.ts'])
}

main().catch((err) => {
  console.error('[cpanel-start] fatal', err)
  process.exit(1)
})
