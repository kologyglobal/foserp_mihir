/**
 * Low-memory production compile for Hostinger shared hosting.
 * esbuild transpiles file-by-file (no full-program tsc graph).
 */
import * as esbuild from 'esbuild'
import { readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const backend = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const srcDir = join(backend, 'src')
const outDir = join(backend, 'dist')

/** Keep in sync with tsconfig.build.json exclude (relative to src/). */
const EXCLUDE = new Set([
  'config/swagger.ts',
  'config/swagger.generated-paths.ts',
  'modules/purchase/requisitions/requisition.repository.ts',
  'modules/purchase/requisitions/requisition.service.ts',
  'modules/purchase/requisitions/requisition.controller.ts',
  'modules/purchase/requisitions/requisition.routes.ts',
  'modules/purchase/shared/mappers.ts',
])

function collectEntryPoints(dir, base = dir) {
  const points = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) {
      points.push(...collectEntryPoints(full, base))
      continue
    }
    if (!name.endsWith('.ts') || name.endsWith('.d.ts')) continue
    const rel = relative(base, full).replace(/\\/g, '/')
    if (EXCLUDE.has(rel)) continue
    points.push(full)
  }
  return points
}

const entryPoints = collectEntryPoints(srcDir)
console.log(`[compile-dist] Transpiling ${entryPoints.length} files with esbuild…`)

const result = await esbuild.build({
  entryPoints,
  outdir: outDir,
  outbase: srcDir,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  packages: 'external',
  logLevel: 'warning',
})

if (result.errors.length) {
  console.error('[compile-dist] esbuild failed')
  process.exit(1)
}

console.log('[compile-dist] Done.')
