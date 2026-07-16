/**
 * Backend folder structure integrity gate — Phase 10 alignment checks.
 * Run: npm run test:backend-structure
 */
import { existsSync, readFileSync } from 'node:fs'
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

// ─── Phase 10 shared layer ───────────────────────────────────────────────────

const sharedFiles = [
  'src/shared/index.ts',
  'src/shared/prisma/helpers.ts',
  'src/shared/prisma/audit.ts',
  'src/shared/users/resolveUserNames.ts',
]

for (const file of sharedFiles) {
  check(`Shared file exists: ${file}`, exists(file))
}

const sharedIndex = exists('src/shared/index.ts') ? read('src/shared/index.ts') : ''
check(
  'shared/index exports prisma helpers',
  sharedIndex.includes('tenantActiveFilter') && sharedIndex.includes('mapAuditFields'),
)
check('shared/index exports resolveUserNames', sharedIndex.includes('resolveUserNames'))

check(
  'Phase 11: crm.shared.ts compat shim removed',
  !exists('src/modules/crm/crm.shared.ts'),
)

// ─── Quotation mapper split ──────────────────────────────────────────────────

const quotationFiles = [
  'src/modules/crm/quotations/quotation.types.ts',
  'src/modules/crm/quotations/quotation.mapper.ts',
  'src/modules/crm/quotations/quotation.service.ts',
  'src/modules/crm/quotations/quotation.routes.ts',
]

for (const file of quotationFiles) {
  check(`Quotation module file exists: ${file}`, exists(file))
}

const quotationMapper = exists('src/modules/crm/quotations/quotation.mapper.ts')
  ? read('src/modules/crm/quotations/quotation.mapper.ts')
  : ''
check(
  'quotation.mapper.ts defines mapQuotationToDto',
  quotationMapper.includes('export function mapQuotationToDto'),
)
check(
  'quotation.mapper.ts defines mapQuotationDocumentToDto',
  quotationMapper.includes('export function mapQuotationDocumentToDto'),
)

const quotationTypes = exists('src/modules/crm/quotations/quotation.types.ts')
  ? read('src/modules/crm/quotations/quotation.types.ts')
  : ''
check(
  'quotation.types.ts keeps DTOs + pricing helpers only',
  quotationTypes.includes('export interface QuotationDto') &&
    quotationTypes.includes('export function parsePricing') &&
    !quotationTypes.includes('export function mapQuotationToDto'),
)

const quotationService = exists('src/modules/crm/quotations/quotation.service.ts')
  ? read('src/modules/crm/quotations/quotation.service.ts')
  : ''
check(
  'quotation.service imports mapper (not types) for mapQuotationToDto',
  quotationService.includes("from './quotation.mapper.js'") &&
    quotationService.includes('mapQuotationToDto'),
)

// ─── Quotations stay under CRM ───────────────────────────────────────────────

check('Quotations live under modules/crm/quotations/', exists('src/modules/crm/quotations'))
check('No top-level modules/quotations/', !exists('src/modules/quotations'))

const crmRoutes = exists('src/modules/crm/crm.routes.ts') ? read('src/modules/crm/crm.routes.ts') : ''
check(
  'crm.routes mounts /quotations under CRM',
  crmRoutes.includes("router.use('/quotations'") &&
    crmRoutes.includes('./quotations/quotation.routes.js'),
)

// ─── Docs ────────────────────────────────────────────────────────────────────

const docsRoot = path.resolve(ROOT, '..', 'docs')
const consolidationDoc = path.join(docsRoot, 'BACKEND_SHARED_CONSOLIDATION.md')
check('docs/BACKEND_SHARED_CONSOLIDATION.md exists', existsSync(consolidationDoc))

const adrDoc = path.join(docsRoot, 'ARCHITECTURE_DECISIONS.md')
const adrContent = existsSync(adrDoc) ? readFileSync(adrDoc, 'utf8') : ''
check('ADR-019 quotations-under-CRM documented', adrContent.includes('ADR-019'))

// ─── Report ──────────────────────────────────────────────────────────────────

const passed = results.filter((r) => r.ok).length
const failed = results.filter((r) => !r.ok)

console.log(`\nBackend structure gate: ${passed}/${results.length} checks passed\n`)

for (const r of results) {
  const mark = r.ok ? '✓' : '✗'
  console.log(`  ${mark} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`)
}

if (failed.length > 0) {
  console.log(`\n${failed.length} check(s) failed.\n`)
  process.exit(1)
}

console.log('\nAll backend structure checks passed.\n')
