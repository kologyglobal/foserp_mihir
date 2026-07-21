/**
 * Finance Phase 5B2 — treasury cheque frontend verification.
 */
import { runTreasuryChequePermissionTests } from '../src/modules/accounting/treasury/cheques/__tests__/permissions.test.ts'
import { runChequeRoutesAndNavTests } from '../src/modules/accounting/treasury/cheques/__tests__/routes-and-nav.test.ts'

console.log('═══════════════════════════════════════')
console.log(' Treasury Cheques (Phase 5B2) verification')
console.log('═══════════════════════════════════════\n')

let passed = 0
let failed = 0

for (const run of [runTreasuryChequePermissionTests, runChequeRoutesAndNavTests]) {
  const result = run()
  passed += result.passed
  failed += result.failed
  console.log('')
}

console.log(`\nTotal: ${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
