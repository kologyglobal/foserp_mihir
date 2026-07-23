/**
 * Wipe local DB and recreate with utf8mb4_unicode_ci (MariaDB default is general_ci,
 * which breaks FKs to Prisma tables created with unicode_ci).
 *
 * Usage: npx tsx scripts/wipe-and-recreate-db.ts
 */
import { config } from 'dotenv'
import { spawnSync } from 'node:child_process'
import mariadb from 'mariadb'

config()

const host = process.env.DB_HOST ?? 'localhost'
const port = Number(process.env.DB_PORT ?? '3306')
const name = process.env.DB_NAME ?? 'fos_erp'
const user = process.env.DB_USER ?? 'root'
const password = process.env.DB_PASS ?? ''

async function wipe() {
  const conn = await mariadb.createConnection({ host, port, user, password })
  console.log(`Dropping database \`${name}\`...`)
  await conn.query(`DROP DATABASE IF EXISTS \`${name}\``)
  console.log(`Creating database \`${name}\` with utf8mb4_unicode_ci...`)
  await conn.query(
    `CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  )
  await conn.end()
  console.log('Database recreated.')
}

function run(cmd: string, args: string[]) {
  console.log(`\n> ${cmd} ${args.join(' ')}`)
  const result = spawnSync(cmd, args, { stdio: 'inherit', shell: true, env: process.env })
  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1)
  }
}

await wipe()
run('npx', ['tsx', 'scripts/prisma-cli.ts', 'migrate', 'deploy'])
run('npm', ['run', 'db:seed'])
console.log('\nDone: database wiped, migrated, and seeded.')
