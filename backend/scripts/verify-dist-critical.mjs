import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const required = [
  'dist/server.js',
  'dist/app.js',
  'dist/config/prisma.js',
  'dist/config/env.js',
]

const missing = required.filter((rel) => !existsSync(join(root, rel)))
if (missing.length) {
  console.error('Backend build incomplete — missing:')
  for (const rel of missing) console.error(`  - ${rel}`)
  console.error('Fix: delete dist/ + tsconfig.tsbuildinfo, then re-run npm run build.')
  process.exit(1)
}

console.log('Verified critical dist modules:', required.join(', '))
