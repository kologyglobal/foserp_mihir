/**
 * Phase 4C2 Money Out — vendor adjustments + corrections frontend verification.
 */
import { runVendorAdjustmentFrontendTests } from '../src/modules/accounting/money-out/vendor-adjustments/__tests__/vendor-adjustments.test.ts'

console.log('═══════════════════════════════════════')
console.log(' Money Out Adjustments (Phase 4C2) verification')
console.log('═══════════════════════════════════════\n')

const result = runVendorAdjustmentFrontendTests()
console.log(`\n${result.passed} passed, ${result.failed} failed`)
process.exit(result.failed > 0 ? 1 : 0)
