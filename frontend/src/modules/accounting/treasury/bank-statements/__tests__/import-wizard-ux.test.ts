/**
 * Phase 5A2 — import wizard UX / empty-state wiring checks.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { groupIssuesBySeverity, issueSeverityTone } from '../utils/bankStatementUi.ts'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..', '..')

let passed = 0
let failed = 0

function check(label: string, ok: boolean) {
  if (ok) {
    passed += 1
    console.log(`✓ ${label}`)
  } else {
    failed += 1
    console.log(`✗ ${label}`)
  }
}

function read(rel: string) {
  return readFileSync(path.join(ROOT, rel), 'utf8')
}

export function runImportWizardUxTests() {
  const grouped = groupIssuesBySeverity([
    { severity: 'ERROR', category: 'ROW', code: 'X', message: 'bad' },
    { severity: 'WARNING', category: 'ROW', code: 'Y', message: 'warn' },
  ])
  check('groupIssues errors', grouped.errors.length === 1)
  check('groupIssues warnings', grouped.warnings.length === 1)
  check('issueSeverityTone error', issueSeverityTone('ERROR') === 'critical')

  const importPage = read('src/modules/accounting/treasury/bank-statements/pages/BankStatementImportPage.api.tsx')
  check('Import wizard steps component', importPage.includes('ImportWizardSteps'))
  check('Import permission gate', importPage.includes('canImport'))
  check('Import API mode empty permission message', importPage.includes('do not have permission'))
  check('Import format picker labels', importPage.includes('IMPORT_FORMAT_LABELS'))
  check('Import accepts MT940/CAMT extensions', importPage.includes('IMPORT_FILE_ACCEPT'))
  check('Import skips mapping for structured formats', importPage.includes('isStructuredImportFormat'))

  const ui = read('src/modules/accounting/treasury/bank-statements/utils/bankStatementUi.ts')
  check('UI has MT940 format label', ui.includes("MT940: 'SWIFT MT940'"))
  check('UI has CAMT.053 format label', ui.includes("CAMT_053: 'ISO 20022 CAMT.053'"))
  check('UI accept includes .sta/.mt940/.xml', ui.includes('.sta,.mt940') && ui.includes('.xml'))

  const listPage = read('src/modules/accounting/treasury/bank-statements/pages/BankStatementListPage.api.tsx')
  check('List empty state', listPage.includes('No bank statements yet'))
  check('List isApiMode gate via wrapper', read('src/modules/accounting/treasury/bank-statements/pages/BankStatementListPage.tsx').includes('isApiMode()'))

  const batchPage = read('src/modules/accounting/treasury/bank-statements/pages/BankStatementImportBatchPage.tsx')
  check('Batch page download', batchPage.includes('downloadBatchFile'))

  return { passed, failed }
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` || process.argv[1]?.endsWith('import-wizard-ux.test.ts')) {
  console.log('═══════════════════════════════════════')
  console.log(' Bank Statements — import wizard UX')
  console.log('═══════════════════════════════════════\n')
  const result = runImportWizardUxTests()
  console.log(`\n${result.passed} passed, ${result.failed} failed`)
  process.exit(result.failed > 0 ? 1 : 0)
}
