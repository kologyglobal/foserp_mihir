/**
 * Phase 5A2 — bank statement list filter unit checks.
 * Run via: npm run test:bank-statements
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseListFilters, syncListSearchParams } from '../utils/list-filters.ts'
import { STATEMENT_STATUS_LABELS } from '../utils/bankStatementUi.ts'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..', '..')

let passed = 0
let failed = 0

function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    passed += 1
    console.log(`✓ ${label}${detail ? ` — ${detail}` : ''}`)
  } else {
    failed += 1
    console.log(`✗ ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

function read(rel: string) {
  return readFileSync(path.join(ROOT, rel), 'utf8')
}

export function runBankStatementListFilterTests() {
  const params = new URLSearchParams('status=DRAFT&treasuryAccountId=abc&page=2')
  const filters = parseListFilters(params, 'le-1')
  check('parseListFilters status', filters.status === 'DRAFT')
  check('parseListFilters account', filters.treasuryAccountId === 'abc')
  check('parseListFilters page', filters.page === 2)
  check('parseListFilters legal entity', filters.legalEntityId === 'le-1')

  const synced = syncListSearchParams(new URLSearchParams(), { status: 'VALIDATED', page: 3 })
  check('syncListSearchParams status', synced.get('status') === 'VALIDATED')
  check('syncListSearchParams page', synced.get('page') === '3')

  check('Draft status label', STATEMENT_STATUS_LABELS.DRAFT === 'Draft')
  check('Validated status label', STATEMENT_STATUS_LABELS.VALIDATED === 'Validated')

  const routesSrc = read('src/routes/accountingRoutes.tsx')
  check('List route wired', routesSrc.includes("path: 'accounting/bank-cash/statements'"))
  check('Manual route wired', routesSrc.includes("path: 'accounting/bank-cash/statements/manual'"))
  check('Mapping templates route', routesSrc.includes("path: 'accounting/bank-cash/mapping-templates'"))

  return { passed, failed }
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` || process.argv[1]?.endsWith('list-filters.test.ts')) {
  console.log('═══════════════════════════════════════')
  console.log(' Bank Statements — list filters')
  console.log('═══════════════════════════════════════\n')
  const result = runBankStatementListFilterTests()
  console.log(`\n${result.passed} passed, ${result.failed} failed`)
  process.exit(result.failed > 0 ? 1 : 0)
}
