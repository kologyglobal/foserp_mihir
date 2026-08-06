/**
 * Run `prisma generate` only when schema/prisma deps changed or client is missing.
 * Saves ~3 min on Hostinger builds/restarts when only TS code changed.
 *
 * Force: FORCE_PRISMA_GENERATE=1
 * Skip:  SKIP_PRISMA_GENERATE=1 (build:app:compile only — use when client is known good)
 */
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const backend = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const schemaPath = join(backend, 'prisma', 'schema.prisma')
const packagePath = join(backend, 'package.json')
const cacheDir = join(backend, '.cache')
const stampPath = join(cacheDir, 'prisma-client-input.sha256')
const clientMarker = join(backend, 'node_modules', '.prisma', 'client', 'index.js')
const isWin = process.platform === 'win32'

function readInputsHash() {
  if (!existsSync(schemaPath)) {
    throw new Error(`[ensure-prisma-client] Missing ${schemaPath}`)
  }
  const hash = createHash('sha256')
  hash.update(readFileSync(schemaPath))
  if (existsSync(packagePath)) {
    const pkg = JSON.parse(readFileSync(packagePath, 'utf8'))
    hash.update(
      JSON.stringify({
        client: pkg.dependencies?.['@prisma/client'] ?? '',
        prisma: pkg.dependencies?.prisma ?? '',
        adapter: pkg.dependencies?.['@prisma/adapter-mariadb'] ?? '',
      }),
    )
  }
  return hash.digest('hex')
}

function readStamp() {
  if (!existsSync(stampPath)) return null
  return readFileSync(stampPath, 'utf8').trim()
}

function writeStamp(value) {
  mkdirSync(cacheDir, { recursive: true })
  writeFileSync(stampPath, `${value}\n`, 'utf8')
}

function runGenerate() {
  const started = Date.now()
  console.log('[ensure-prisma-client] Running prisma generate (large schema — may take several minutes)…')
  if (isWin) {
    execFileSync(
      process.env.ComSpec ?? 'cmd.exe',
      ['/d', '/s', '/c', 'npx prisma generate --schema=./prisma/schema.prisma'],
      { cwd: backend, env: process.env, stdio: 'inherit' },
    )
  } else {
    execFileSync('npx', ['prisma', 'generate', '--schema=./prisma/schema.prisma'], {
      cwd: backend,
      env: process.env,
      stdio: 'inherit',
    })
  }
  const secs = ((Date.now() - started) / 1000).toFixed(1)
  console.log(`[ensure-prisma-client] prisma generate finished in ${secs}s`)
}

const force =
  process.argv.includes('--force')
  || process.env.FORCE_PRISMA_GENERATE === '1'
  || process.env.FORCE_PRISMA_GENERATE === 'true'
const skip = process.env.SKIP_PRISMA_GENERATE === '1' || process.env.SKIP_PRISMA_GENERATE === 'true'

if (skip) {
  console.log('[ensure-prisma-client] SKIP_PRISMA_GENERATE — skipping prisma generate')
  process.exit(0)
}

const inputsHash = readInputsHash()
const savedHash = readStamp()
const clientExists = existsSync(clientMarker)

if (!force && clientExists && savedHash === inputsHash) {
  console.log('[ensure-prisma-client] Prisma client up to date — skipping generate')
  process.exit(0)
}

if (!clientExists) {
  console.log('[ensure-prisma-client] Generated client missing — prisma generate required')
} else if (savedHash !== inputsHash) {
  console.log('[ensure-prisma-client] schema.prisma or Prisma package versions changed — regenerating')
} else if (force) {
  console.log('[ensure-prisma-client] FORCE_PRISMA_GENERATE — regenerating')
}

runGenerate()
writeStamp(inputsHash)
