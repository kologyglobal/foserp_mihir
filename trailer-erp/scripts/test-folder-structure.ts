/**
 * Folder structure integrity gate — Phase 11 cleanup checks.
 * Run: npm run test:folder-structure
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(ROOT, 'src')

interface CheckResult {
  name: string
  ok: boolean
  detail?: string
}

const results: CheckResult[] = []

function check(name: string, ok: boolean, detail?: string) {
  results.push({ name, ok, detail })
}

function read(rel: string): string {
  return readFileSync(path.join(ROOT, rel), 'utf8')
}

function exists(rel: string): boolean {
  return existsSync(path.join(ROOT, rel))
}

// ─── Required foundation folders ─────────────────────────────────────────────

const requiredDirs = [
  'src/config',
  'src/bootstrap',
  'src/services/bridges',
  'src/modules',
  'src/components',
  'src/design-system',
  'src/store',
  'src/routes',
  'src/data',
  'src/demo/factories',
  'src/demo/scenarios',
  'src/utils/formatters',
  'src/utils/dates',
  'src/utils/permissions',
]

for (const dir of requiredDirs) {
  check(`Directory exists: ${dir}`, exists(dir))
}

// ─── Required canonical files ────────────────────────────────────────────────

const requiredFiles = [
  'src/config/environment.ts',
  'src/config/apiConfig.ts',
  'src/config/appConfig.ts',
  'src/config/featureFlags.ts',
  'src/bootstrap/index.ts',
  'src/bootstrap/appBootstrap.ts',
  'src/bootstrap/apiHydration.ts',
  'src/bootstrap/demoBootstrap.ts',
  'src/services/bridges/crmApiBridge.ts',
  'src/services/bridges/masterApiBridge.ts',
  'src/services/bridges/quotationApiBridge.ts',
  'src/services/api/client.ts',
  'src/services/api/authApi.ts',
  'src/services/api/quotationApi.ts',
  'src/hooks/useApiMode.ts',
  'src/modules/auth/LoginPage.tsx',
  'src/modules/quotations/index.ts',
  'src/components/quotations/index.ts',
  'src/types/quotation.ts',
  'tsconfig.app.json',
  'vite.config.ts',
]

for (const file of requiredFiles) {
  check(`File exists: ${file}`, exists(file))
}

// ─── Path aliases ────────────────────────────────────────────────────────────

const tsconfig = read('tsconfig.app.json')
check('Path alias @/* in tsconfig.app.json', tsconfig.includes('"@/*"') && tsconfig.includes('"paths"'))

const viteConfig = read('vite.config.ts')
check('Path alias @ in vite.config.ts', viteConfig.includes('alias') && viteConfig.includes("'@'"))

// ─── Phase 11: compat shims removed ─────────────────────────────────────────

const removedShims = [
  'src/utils/format.ts',
  'src/utils/crmPermissions.ts',
  'src/services/api/config.ts',
  'src/services/api/crmApiBridge.ts',
  'src/services/api/crmApiAuth.ts',
  'src/services/api/masterApiBridge.ts',
  'src/services/api/masterBatchApiBridge.ts',
  'src/services/api/crmMasterApiBridge.ts',
  'src/store/bootstrap/crmBootstrap.ts',
  'src/demo/runGoLiveScenario.ts',
  'src/demo/demoScenarioExtensions.ts',
  'src/pages/auth/LoginPage.tsx',
  'src/modules/crm/CrmCardFormShell.tsx',
  'src/modules/crm/Lead360Workspace.tsx',
  'src/modules/crm/QuotationCrmPages.tsx',
  'src/modules/purchase/PurchaseCardFormShell.tsx',
  'src/modules/inventory/InventoryDashboard.tsx',
  'src/data/inventory.ts',
  'src/data/crm/quotationTemplates.ts',
  'src/components/crm/QuotationBuilder.tsx',
]

for (const shim of removedShims) {
  check(`Phase 11: compat shim removed — ${shim}`, !exists(shim))
}

// ─── Canonical locations ─────────────────────────────────────────────────────

check(
  'crmApiBridge canonical in services/bridges/',
  exists('src/services/bridges/crmApiBridge.ts') && read('src/services/bridges/crmApiBridge.ts').includes('syncAllCrmFromApi'),
)

check(
  'config/apiConfig exports isApiMode',
  read('src/config/apiConfig.ts').includes('export function isApiMode'),
)

check(
  'quotationRoutes imports from modules/quotations',
  read('src/routes/quotationRoutes.tsx').includes("from '@/modules/quotations'"),
)

check(
  'authRoutes imports LoginPage from modules/auth',
  read('src/routes/authRoutes.tsx').includes("from '@/modules/auth/LoginPage'"),
)

// ─── Forbidden: fetch in store files ────────────────────────────────────────

function scanDirForPattern(dir: string, pattern: RegExp, label: string) {
  const full = path.join(SRC, dir)
  if (!existsSync(full)) return
  for (const entry of readdirSync(full)) {
    const p = path.join(full, entry)
    if (statSync(p).isDirectory()) {
      if (entry === 'node_modules') continue
      scanDirForPattern(path.join(dir, entry), pattern, label)
      continue
    }
    if (!entry.endsWith('.ts') && !entry.endsWith('.tsx')) continue
    const content = readFileSync(p, 'utf8')
    if (pattern.test(content) && dir.startsWith('store')) {
      check(`${label}: ${path.relative(SRC, p)}`, false, 'raw fetch in store')
    }
  }
}

scanDirForPattern('store', /\bfetch\s*\(/, 'No raw fetch in store')

// ─── Phase 6 legacy data (canonical paths) ───────────────────────────────────

const phase6LegacyFiles = [
  'src/data/inventory/legacyDemo.ts',
  'src/data/production/legacyDemo.ts',
  'src/data/dispatch/legacyDemo.ts',
  'src/data/quality/legacyDemo.ts',
  'src/data/sales/legacyDemo.ts',
  'src/data/masters/legacyProducts.ts',
  'src/data/bom/legacyEngineering.ts',
  'src/data/mrp/legacyDemo.ts',
]

for (const file of phase6LegacyFiles) {
  check(`Phase 6: ${file} exists`, exists(file))
}

check('Phase 8: scripts/test-demo-api-isolation.ts exists', exists('scripts/test-demo-api-isolation.ts'))

const pkgJson = read('package.json')
check('Phase 8: package.json has test:demo-api-isolation', pkgJson.includes('"test:demo-api-isolation"'))

// ─── Report ──────────────────────────────────────────────────────────────────

const failed = results.filter((r) => !r.ok)

console.log('\n=== Folder Structure Integrity ===\n')
for (const r of results) {
  console.log(`${r.ok ? '✓' : '✗'} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`)
}

console.log(`\n${results.length - failed.length}/${results.length} checks passed`)

if (failed.length > 0) {
  console.error('\nStructure gate FAILED')
  process.exit(1)
}

console.log('\nStructure gate PASSED')
