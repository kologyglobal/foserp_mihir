/**
 * Route integrity gate — Phase 2 route split verification.
 * Run: npm run test:route-integrity
 * Refresh baseline after intentional route changes: npm run test:route-integrity -- --write-baseline
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ROUTES_DIR = path.join(ROOT, 'src/routes')
const BASELINE_PATH = path.join(ROOT, 'scripts/route-paths-baseline.json')

interface Baseline {
  generatedAt: string
  pathCount: number
  indexCount: number
  paths: string[]
  keyPaths: string[]
}

const KEY_PATHS = [
  '/login',
  '/m',
  'masters',
  'crm',
  'purchase',
  'sales',
  'inventory',
  'mrp',
  'production',
  'manufacturing',
  'quality',
  'dispatch',
  'reports',
  'quotations',
  'sales-orders',
]

function readRouteFiles(): string[] {
  return readdirSync(ROUTES_DIR)
    .filter((f) => f.endsWith('.tsx'))
    .map((f) => readFileSync(path.join(ROUTES_DIR, f), 'utf8'))
}

function extractPaths(content: string): { paths: string[]; indexCount: number } {
  const paths: string[] = []
  let indexCount = 0
  const pathRegex = /path:\s*['"]([^'"]+)['"]/g
  let match: RegExpExecArray | null
  while ((match = pathRegex.exec(content)) !== null) {
    paths.push(match[1])
  }
  const indexRegex = /index:\s*true/g
  while (indexRegex.exec(content) !== null) {
    indexCount += 1
  }
  return { paths, indexCount }
}

function collectRouteSnapshot(): { paths: string[]; indexCount: number } {
  const allPaths: string[] = []
  let totalIndex = 0
  for (const content of readRouteFiles()) {
    const { paths, indexCount } = extractPaths(content)
    allPaths.push(...paths)
    totalIndex += indexCount
  }
  return { paths: allPaths.sort(), indexCount: totalIndex }
}

function buildBaseline(): Baseline {
  const { paths, indexCount } = collectRouteSnapshot()
  return {
    generatedAt: new Date().toISOString(),
    pathCount: paths.length,
    indexCount,
    paths,
    keyPaths: KEY_PATHS,
  }
}

function loadBaseline(): Baseline {
  if (!existsSync(BASELINE_PATH)) {
    throw new Error(`Missing baseline: ${BASELINE_PATH}. Run with --write-baseline first.`)
  }
  return JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as Baseline
}

function multisetDiff(a: string[], b: string[]): { missing: string[]; extra: string[] } {
  const count = (arr: string[]) => {
    const m = new Map<string, number>()
    for (const p of arr) m.set(p, (m.get(p) ?? 0) + 1)
    return m
  }
  const aMap = count(a)
  const bMap = count(b)
  const missing: string[] = []
  const extra: string[] = []

  for (const [p, n] of aMap) {
    const bn = bMap.get(p) ?? 0
    if (bn < n) {
      for (let i = 0; i < n - bn; i++) missing.push(p)
    }
  }
  for (const [p, n] of bMap) {
    const an = aMap.get(p) ?? 0
    if (an < n) {
      for (let i = 0; i < n - an; i++) extra.push(p)
    }
  }

  return { missing: missing.sort(), extra: extra.sort() }
}

function main() {
  const writeBaseline = process.argv.includes('--write-baseline')
  const snapshot = collectRouteSnapshot()

  if (writeBaseline) {
    const baseline = buildBaseline()
    writeFileSync(BASELINE_PATH, `${JSON.stringify(baseline, null, 2)}\n`, 'utf8')
    console.log(`Baseline written: ${baseline.pathCount} paths, ${baseline.indexCount} index routes`)
    console.log(`File: ${BASELINE_PATH}`)
    return
  }

  const baseline = loadBaseline()
  const { missing, extra } = multisetDiff(baseline.paths, snapshot.paths)

  console.log('\n=== Route Integrity ===\n')
  console.log(`Baseline paths: ${baseline.pathCount} (${baseline.generatedAt})`)
  console.log(`Current paths:  ${snapshot.paths.length}`)
  console.log(`Baseline index routes: ${baseline.indexCount}`)
  console.log(`Current index routes:  ${snapshot.indexCount}`)

  let failed = 0

  if (snapshot.paths.length !== baseline.pathCount) {
    failed += 1
    console.log(`\n✗ Path count mismatch (expected ${baseline.pathCount}, got ${snapshot.paths.length})`)
  } else {
    console.log('\n✓ Path count matches baseline')
  }

  if (snapshot.indexCount !== baseline.indexCount) {
    failed += 1
    console.log(`✗ Index route count mismatch (expected ${baseline.indexCount}, got ${snapshot.indexCount})`)
  } else {
    console.log('✓ Index route count matches baseline')
  }

  if (missing.length > 0) {
    failed += 1
    console.log(`\n✗ Missing paths (${missing.length}):`)
    for (const p of missing.slice(0, 20)) console.log(`  - ${p}`)
    if (missing.length > 20) console.log(`  ... and ${missing.length - 20} more`)
  }

  if (extra.length > 0) {
    failed += 1
    console.log(`\n✗ Extra paths (${extra.length}):`)
    for (const p of extra.slice(0, 20)) console.log(`  - ${p}`)
    if (extra.length > 20) console.log(`  ... and ${extra.length - 20} more`)
  }

  if (missing.length === 0 && extra.length === 0 && snapshot.paths.length === baseline.pathCount) {
    console.log('✓ Path multiset matches baseline')
  }

  const presentKeyPaths = KEY_PATHS.filter((kp) => snapshot.paths.includes(kp))
  if (presentKeyPaths.length !== KEY_PATHS.length) {
    failed += 1
    const absent = KEY_PATHS.filter((kp) => !snapshot.paths.includes(kp))
    console.log(`\n✗ Missing key paths: ${absent.join(', ')}`)
  } else {
    console.log(`✓ All ${KEY_PATHS.length} key paths present`)
  }

  const routeModules = [
    'authRoutes.tsx',
    'homeRoutes.tsx',
    'masterRoutes.tsx',
    'engineeringRoutes.tsx',
    'platformRoutes.tsx',
    'inventoryRoutes.tsx',
    'productionRoutes.tsx',
    'manufacturingRoutes.tsx',
    'salesRoutes.tsx',
    'qualityRoutes.tsx',
    'dispatchFinanceRoutes.tsx',
    'reportsRoutes.tsx',
    'quotationRoutes.tsx',
    'crmRoutes.tsx',
    'purchaseRoutes.tsx',
    'mobileRoutes.tsx',
  ]
  for (const mod of routeModules) {
    const exists = existsSync(path.join(ROUTES_DIR, mod))
    if (!exists) {
      failed += 1
      console.log(`✗ Missing route module: ${mod}`)
    }
  }
  if (failed === 0 || routeModules.every((m) => existsSync(path.join(ROUTES_DIR, m)))) {
    console.log(`✓ All ${routeModules.length} route module files exist`)
  }

  const indexContent = readFileSync(path.join(ROUTES_DIR, 'index.tsx'), 'utf8')
  const indexLines = indexContent.split('\n').length
  if (indexLines > 100) {
    failed += 1
    console.log(`✗ index.tsx still ${indexLines} lines (target ~80 composer)`)
  } else {
    console.log(`✓ index.tsx is slim composer (${indexLines} lines)`)
  }

  console.log(`\n${failed === 0 ? 'Route integrity PASSED' : 'Route integrity FAILED'}`)
  if (failed > 0) process.exit(1)
}

main()
