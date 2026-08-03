import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const backend = dirname(fileURLToPath(import.meta.url))
const server = join(backend, 'dist', 'server.js')
const frontend = join(backend, 'public')

if (!existsSync(server)) {
  throw new Error(`Backend build is missing: ${server}. Hostinger must run npm run deploy:build before start.`)
}
const prismaModule = join(backend, 'dist', 'config', 'prisma.js')
if (!existsSync(prismaModule)) {
  throw new Error(
    `Backend build is incomplete: ${prismaModule} is missing. Delete dist/ and tsconfig.tsbuildinfo, then run npm run deploy:build and confirm dist/config/prisma.js exists before restart.`,
  )
}
if (!existsSync(join(frontend, 'index.html'))) {
  throw new Error(`Frontend build is missing: ${frontend}. Hostinger must run npm run deploy:build before start.`)
}

process.chdir(backend)
process.env.FRONTEND_DIST = process.env.FRONTEND_DIST ?? resolve(frontend)

const runMigrateOnStart =
  process.env.RUN_MIGRATE_ON_START === 'true' ||
  process.env.RUN_MIGRATE_ON_START === '1'

if (runMigrateOnStart) {
  console.log('[hostinger-start] RUN_MIGRATE_ON_START=true — running migrate deploy before server start…')
  const migrateScript = join(backend, 'scripts', 'migrate-deploy.mjs')
  const migrate = spawnSync(process.execPath, [migrateScript], {
    cwd: backend,
    env: process.env,
    stdio: 'inherit',
  })
  if (migrate.status !== 0) {
    throw new Error(
      'Prisma migrate deploy failed on startup. Fix migrations or run npm run db:recover-known once, then redeploy.',
    )
  }
} else {
  console.log('[hostinger-start] Migrations run at deploy:build time; skipping startup migrate.')
}

await import(pathToFileURL(server).href)
