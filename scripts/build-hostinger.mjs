import { execFileSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const frontend = join(root, 'frontend')
const backend = join(root, 'backend')
const frontendDist = join(frontend, 'dist')
const backendPublic = join(backend, 'public')
const nextPublic = join(backend, '.public-next')
function run(args, cwd, env = process.env) {
  console.log(`> npm ${args.join(' ')} (${cwd})`)
  if (process.platform === 'win32') {
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
  const fromHost = process.env.HOSTINGER_GIT_COMMIT
    ?? process.env.GITHUB_SHA
    ?? process.env.COMMIT_SHA
  if (fromHost) return fromHost

  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return 'unknown'
  }
}

function assertFile(path, message) {
  if (!existsSync(path)) throw new Error(`${message}: ${path}`)
}

console.log('Installing deterministic frontend dependencies')
run(['ci'], frontend)

console.log('Installing deterministic backend dependencies')
run(['ci'], backend)

console.log('Building Vite frontend in API mode')
run(
  ['run', 'build'],
  frontend,
  {
    ...process.env,
    VITE_USE_API: process.env.VITE_USE_API ?? 'true',
    VITE_API_BASE_URL: process.env.VITE_API_BASE_URL ?? '/api/v1',
    VITE_TENANT_SLUG: process.env.VITE_TENANT_SLUG ?? 'vasant-trailers',
  },
)

console.log('Building Express backend')
run(['run', 'build'], backend)

assertFile(join(frontendDist, 'index.html'), 'Vite did not produce index.html')
assertFile(join(backend, 'dist', 'server.js'), 'Backend did not produce dist/server.js')

// Publish only after both builds pass. The running app continues using the old
// directory until the deployment platform restarts it.
rmSync(nextPublic, { recursive: true, force: true })
mkdirSync(nextPublic, { recursive: true })
cpSync(frontendDist, nextPublic, { recursive: true })

const revision = gitRevision()
writeFileSync(
  join(nextPublic, 'build-meta.json'),
  `${JSON.stringify({
    revision,
    builtAt: new Date().toISOString(),
    frontendMode: 'api',
  }, null, 2)}\n`,
  'utf8',
)

const html = readFileSync(join(nextPublic, 'index.html'), 'utf8')
if (!/\/assets\/[^"']+\.js/.test(html)) {
  throw new Error('Built index.html does not reference a hashed JavaScript asset')
}

rmSync(backendPublic, { recursive: true, force: true })
renameSync(nextPublic, backendPublic)

console.log(`Hostinger build complete for revision ${revision}`)
console.log(`Published SPA: ${backendPublic}`)
