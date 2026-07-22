/**
 * Phase 5A3 — bank reconciliation frontend verification.
 */
import { runBankReconciliationPermissionTests } from '../src/modules/accounting/treasury/bank-reconciliation/__tests__/permissions.test.ts'
import { runBankReconciliationUiUtilTests } from '../src/modules/accounting/treasury/bank-reconciliation/__tests__/ui-utils.test.ts'
import { runReconciliationRoutesAndNavTests } from '../src/modules/accounting/treasury/bank-reconciliation/__tests__/routes-and-nav.test.ts'
import { runWorkspaceComponentTests } from '../src/modules/accounting/treasury/bank-reconciliation/__tests__/workspace-components.test.ts'

console.log('═══════════════════════════════════════')
console.log(' Bank Reconciliation (Phase 5A3) verification')
console.log('═══════════════════════════════════════\n')

let passed = 0
let failed = 0

for (const run of [
  runBankReconciliationPermissionTests,
  runBankReconciliationUiUtilTests,
  runReconciliationRoutesAndNavTests,
  runWorkspaceComponentTests,
]) {
  const result = run()
  passed += result.passed
  failed += result.failed
  console.log('')
}

console.log(`\nTotal: ${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
