/**
 * Finance Phase 5B1 — treasury transfer frontend verification.
 */
import { runTreasuryTransferPermissionTests } from '../src/modules/accounting/treasury/transfers/__tests__/permissions.test.ts'
import { runTreasuryTransferUiUtilTests } from '../src/modules/accounting/treasury/transfers/__tests__/ui-utils.test.ts'
import { runTransferRoutesAndNavTests } from '../src/modules/accounting/treasury/transfers/__tests__/routes-and-nav.test.ts'

console.log('═══════════════════════════════════════')
console.log(' Treasury Transfers (Phase 5B1) verification')
console.log('═══════════════════════════════════════\n')

let passed = 0
let failed = 0

for (const run of [runTreasuryTransferPermissionTests, runTreasuryTransferUiUtilTests, runTransferRoutesAndNavTests]) {
  const result = run()
  passed += result.passed
  failed += result.failed
  console.log('')
}

console.log(`\nTotal: ${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
