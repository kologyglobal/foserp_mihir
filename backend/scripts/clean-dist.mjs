import { existsSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')
const tsbuildinfo = join(root, 'tsconfig.tsbuildinfo')
const keepTsBuildInfo = process.argv.includes('--keep-tsbuildinfo')

if (existsSync(dist)) {
  rmSync(dist, { recursive: true, force: true })
  console.log('Removed dist/')
}
if (!keepTsBuildInfo && existsSync(tsbuildinfo)) {
  rmSync(tsbuildinfo, { force: true })
  console.log('Removed tsconfig.tsbuildinfo')
}
