/**
 * Phase 5A2 — bank statement import frontend verification.
 */
import { runBankStatementListFilterTests } from '../src/modules/accounting/treasury/bank-statements/__tests__/list-filters.test.ts'
import { runColumnMappingMapperTests } from '../src/modules/accounting/treasury/bank-statements/__tests__/column-mapping.test.ts'
import { runTreasuryStatementPermissionTests } from '../src/modules/accounting/treasury/bank-statements/__tests__/permissions.test.ts'
import { runImportWizardUxTests } from '../src/modules/accounting/treasury/bank-statements/__tests__/import-wizard-ux.test.ts'

console.log('═══════════════════════════════════════')
console.log(' Bank Statements (Phase 5A2) verification')
console.log('═══════════════════════════════════════\n')

let passed = 0
let failed = 0

for (const run of [
  runBankStatementListFilterTests,
  runColumnMappingMapperTests,
  runTreasuryStatementPermissionTests,
  runImportWizardUxTests,
]) {
  const result = run()
  passed += result.passed
  failed += result.failed
  console.log('')
}

console.log(`\nTotal: ${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
