import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const backend = dirname(fileURLToPath(import.meta.url))
const server = join(backend, 'dist', 'server.js')
const frontend = join(backend, 'public')

if (!existsSync(server)) {
  throw new Error(
    `Backend build is missing: ${server}. Run npm run build in backend (Hostinger deploy build).`,
  )
}
const prismaModule = join(backend, 'dist', 'config', 'prisma.js')
if (!existsSync(prismaModule)) {
  throw new Error(
    `Backend build is incomplete: ${prismaModule} is missing. Re-run npm run build and confirm dist/config/prisma.js exists.`,
  )
}
if (!existsSync(join(frontend, 'index.html'))) {
  console.warn(
    '[hostinger-start] No public/index.html — API-only mode. Set SKIP_FRONTEND=1 on stage API hosts or run full deploy with frontend/.',
  )
} else {
  console.log('[hostinger-start] SPA available at public/')
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
  console.log('[hostinger-start] Skipping startup migrate (run build:with-migrate or RUN_MIGRATE_ON_START when DB is ready).')
}

await import(pathToFileURL(server).href)
