/**
 * Hostinger Git deploy build (backend hPanel "npm run build").
 * Backend: prisma generate + esbuild compile. Frontend: optional Vite SPA → public/.
 * Migrations are NOT run here — use build:with-migrate or RUN_MIGRATE_ON_START when ready.
 */
import { execFileSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const backend = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = join(backend, '..')
const frontend = join(repoRoot, 'frontend')
const backendPublic = join(backend, 'public')
const isWin = process.platform === 'win32'

function runNpm(args, cwd, env = process.env) {
  if (isWin) {
    execFileSync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', `npm ${args.join(' ')}`], {
      cwd,
      env,
      stdio: 'inherit',
    })
    return
  }
  execFileSync('npm', args, { cwd, env, stdio: 'inherit' })
}

function gitRevision() {
  return (
    process.env.HOSTINGER_GIT_COMMIT
    ?? process.env.GITHUB_SHA
    ?? process.env.COMMIT_SHA
    ?? 'unknown'
  )
}

const skipFrontend =
  process.env.SKIP_FRONTEND === '1' || process.env.SKIP_FRONTEND === 'true'

console.log('[build-hostinger] Backend compile (esbuild, no migrations)…')
runNpm(['run', 'build:app'], backend)

if (skipFrontend) {
  console.log('[build-hostinger] SKIP_FRONTEND=1 — SPA publish skipped (API-only).')
} else if (existsSync(join(frontend, 'package.json'))) {
  console.log('[build-hostinger] Building Vite frontend…')
  runNpm(['ci'], frontend)
  const viteEnv = {
    ...process.env,
    VITE_USE_API: process.env.VITE_USE_API ?? 'true',
    VITE_API_BASE_URL: process.env.VITE_API_BASE_URL ?? '/api/v1',
    VITE_TENANT_SLUG: process.env.VITE_TENANT_SLUG ?? 'vasant-trailers',
  }
  runNpm(['run', 'build:hostinger'], frontend, viteEnv)

  const frontendDist = join(frontend, 'dist')
  if (!existsSync(join(frontendDist, 'index.html'))) {
    throw new Error(`Frontend build missing ${join(frontendDist, 'index.html')}`)
  }

  rmSync(backendPublic, { recursive: true, force: true })
  mkdirSync(backendPublic, { recursive: true })
  cpSync(frontendDist, backendPublic, { recursive: true })

  const html = readFileSync(join(backendPublic, 'index.html'), 'utf8')
  if (!/\/assets\/[^"']+\.js/.test(html)) {
    throw new Error('Built index.html does not reference a hashed JavaScript asset')
  }

  writeFileSync(
    join(backendPublic, 'build-meta.json'),
    `${JSON.stringify(
      {
        revision: gitRevision(),
        builtAt: new Date().toISOString(),
        frontendMode: 'api',
      },
      null,
      2,
    )}\n`,
    'utf8',
  )
  console.log(`[build-hostinger] Published SPA → ${backendPublic}`)
} else {
  console.warn(
    '[build-hostinger] No ../frontend in deploy tree — API-only. Set SKIP_FRONTEND=1 for stage API hosts.',
  )
}

console.log('[build-hostinger] Deploy build complete.')
