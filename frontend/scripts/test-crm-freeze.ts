/**
 * CRM freeze gate — npm run test:crm-freeze
 * Aggregates CRM regression suites required before CRM release.
 */
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { runPackageScript } from './run-package-script'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const SUITES = [
  'test:crm-opportunity-full-page',
  'test:crm-opportunity-item-lines',
  'test:crm-integration',
  'test:crm-pipeline-integrity',
  'test:crm-execution-clarity',
  'test:crm-enterprise',
  'test:crm-list-utils',
  'test:crm-mobile-pipeline',
  'test:crm-multiline-quotation-to-so',
  'test:crm-sales-navigation',
  'test:crm-eeata-fix',
  'test:crm-quotation-to-so-handover',
  'test:crm-lead-form-refinement',
  'test:crm-leads-list-view',
  'test:crm-masters',
  'test:crm-companies-ui',
  'test:crm-dashboard-design-polish',
  'test:advanced-crm',
  'test:erp-card-form-system',
] as const

console.log('\nCRM Freeze Gate\n')

let failed = 0
for (const script of SUITES) {
  const r = runPackageScript(script, ROOT)
  const ok = r.status === 0
  if (!ok) failed++
  console.log(`${ok ? '✓' : '✗'} ${script}${r.summary ? ` — ${r.summary}` : ''}`)
}

console.log(failed === 0 ? '\nCRM Freeze: PASSED\n' : `\nCRM Freeze: FAILED (${failed} suite(s))\n`)
process.exit(failed > 0 ? 1 : 0)
