import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const backend = dirname(fileURLToPath(import.meta.url))
const server = join(backend, 'dist', 'server.js')
const frontend = join(backend, 'public')

if (!existsSync(server)) {
  throw new Error(`Backend build is missing: ${server}. Hostinger must run npm run build before start.`)
}
const prismaModule = join(backend, 'dist', 'config', 'prisma.js')
if (!existsSync(prismaModule)) {
  throw new Error(
    `Backend build is incomplete: ${prismaModule} is missing. Delete dist/ and tsconfig.tsbuildinfo, then run npm run build and confirm dist/config/prisma.js exists before restart.`,
  )
}
if (!existsSync(join(frontend, 'index.html'))) {
  throw new Error(`Frontend build is missing: ${frontend}. Hostinger must run npm run build before start.`)
}

// Hostinger launches this file from the selected backend output directory.
// Keep dotenv and all relative backend paths stable.
process.chdir(backend)
process.env.FRONTEND_DIST = process.env.FRONTEND_DIST ?? resolve(frontend)

const skipMigrate =
  process.env.RUN_MIGRATE_ON_START === 'false' ||
  process.env.RUN_MIGRATE_ON_START === '0'

if (!skipMigrate) {
  console.log('[hostinger-start] Running prisma migrate deploy before server start…')
  const migrateScript = join(backend, 'scripts', 'migrate-deploy.mjs')
  const migrate = spawnSync(process.execPath, [migrateScript], {
    cwd: backend,
    env: {
      ...process.env,
      HOSTINGER_STARTUP: '1',
    },
    stdio: 'inherit',
  })
  if (migrate.status !== 0) {
    throw new Error(
      'Prisma migrate deploy failed on startup. Set RUN_MIGRATE_ON_START=false only for emergency bypass; fix migrations or apply live SQL scripts.',
    )
  }
} else {
  console.warn('[hostinger-start] RUN_MIGRATE_ON_START=false — skipping migrate deploy.')
}

await import(pathToFileURL(server).href)
