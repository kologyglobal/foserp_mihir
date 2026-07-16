import { config } from 'dotenv'
import { spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

config()

function buildDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  const host = process.env.DB_HOST ?? 'localhost'
  const port = process.env.DB_PORT ?? '3306'
  const name = process.env.DB_NAME ?? 'fos_erp'
  const user = process.env.DB_USER ?? 'root'
  const pass = encodeURIComponent(process.env.DB_PASS ?? '')
  return `mysql://${user}:${pass}@${host}:${port}/${name}`
}

process.env.DATABASE_URL = buildDatabaseUrl()

const result = spawnSync(
  'npx',
  ['prisma', 'migrate', 'diff', '--from-empty', '--to-schema-datamodel', 'prisma/schema.prisma', '--script'],
  { encoding: 'utf8', shell: true, env: process.env },
)

if (result.status !== 0) {
  console.error(result.stderr)
  process.exit(1)
}

writeFileSync('prisma/migrations/20260710180000_init/migration.sql', result.stdout, 'utf8')
console.log('Migration SQL regenerated successfully')
