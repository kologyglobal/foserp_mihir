import { existsSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const backend = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(backend, 'dist')
const tsbuildinfo = join(backend, 'tsconfig.tsbuildinfo')
const isWin = process.platform === 'win32'
// Hostinger shared plans often kill 8GB heaps; local/CI can raise via env.
const heapMb = process.env.TSC_MAX_OLD_SPACE_SIZE || '4096'

function runNpmScript(args) {
  console.log(`> npm ${args.join(' ')}`)
  if (isWin) {
    execFileSync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', `npm ${args.join(' ')}`], {
      cwd: backend,
      stdio: 'inherit',
      env: process.env,
    })
    return
  }
  execFileSync('npm', args, { cwd: backend, stdio: 'inherit', env: process.env })
}

function runNode(args) {
  console.log(`> node ${args.join(' ')}`)
  execFileSync(process.execPath, args, { cwd: backend, stdio: 'inherit', env: process.env })
}

// Wipe stale/partial output — OOM-killed tsc often leaves dist/app.js without dist/config/*.
rmSync(dist, { recursive: true, force: true })
rmSync(tsbuildinfo, { force: true })

runNpmScript(['exec', '--', 'prisma', 'generate'])

runNode([
  `--max-old-space-size=${heapMb}`,
  join(backend, 'node_modules/typescript/bin/tsc'),
])

const required = [
  join(dist, 'server.js'),
  join(dist, 'app.js'),
  join(dist, 'config', 'database.js'),
  join(dist, 'config', 'env.js'),
]

for (const file of required) {
  if (!existsSync(file)) {
    throw new Error(
      `Backend build incomplete — missing ${file}. ` +
        `Usually Hostinger OOM/disk during tsc. Free space and set TSC_MAX_OLD_SPACE_SIZE (tried ${heapMb}).`,
    )
  }
}

console.log(`Backend build OK (heap ${heapMb}MB):`, required.map((f) => f.slice(backend.length + 1)).join(', '))
