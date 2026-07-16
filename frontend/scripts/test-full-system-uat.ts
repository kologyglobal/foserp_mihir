/**
 * Full System UAT gate — npm run test:full-system-uat
 * Runs build, CI, UAT, EETA, theme, CRM, mobile, and factory-control suites.
 * On success, regenerates all FULL_SYSTEM_* deliverable reports.
 */
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runPackageScript } from './run-package-script'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const SUITES = [
  'build',
  'test:ci',
  'test:uat',
  'test:eeta-100',
  'test:demo-data-saturation',
  'test:dynamics-theme',
  'test:ui-ux-audit',
  'test:form-action-usability',
  'test:erp-card-form-system',
  'test:practical-user-journey',
  'test:saas-ui',
  'test:advanced-crm',
  'test:crm-dashboard-design-polish',
  'test:crm-companies-ui',
  'test:quotation-template-builder',
  'test:crm-integration',
  'test:crm-sales-navigation',
  'test:crm-quotation-to-so-handover',
  'test:crm-lead-form-refinement',
  'test:crm-leads-list-view',
  'test:purchase-module',
  'test:max-update-depth',
  'test:mobile-ops',
  'test:cross-module-creation',
  'test:dynamic-qc',
  'test:qr-generation',
  'test:serial-genealogy',
  'test:eco-ecr',
  'test:approval-matrix',
  'test:rbac',
  'test:dms',
] as const

interface Result {
  script: string
  ok: boolean
  durationMs: number
  summary: string
}

function run(script: string): Result {
  const start = Date.now()
  const r = runPackageScript(script, ROOT)
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`
  const durationMs = Date.now() - start
  let summary = r.status === 0 ? 'PASS' : 'FAIL'
  const slash = out.match(/(\d+)\/(\d+)\s+passed/i)
  if (slash) summary = `${slash[1]}/${slash[2]} passed`
  else if (out.includes('UAT AUTOMATION GREEN')) summary = 'UAT GREEN'
  else if (out.includes('CI GREEN')) summary = 'CI GREEN'
  else if (out.includes('EETA 100 ACHIEVED')) summary = 'EETA 100'
  return { script, ok: r.status === 0, durationMs, summary }
}

function banner(title: string) {
  console.log(`\n${'═'.repeat(62)}\n ${title}\n${'═'.repeat(62)}\n`)
}

banner('FULL SYSTEM UAT GATE — FOS ERP')

const results: Result[] = []
for (const script of SUITES) {
  process.stdout.write(`  Running ${script}… `)
  const res = run(script)
  results.push(res)
  console.log(res.ok ? `✓ ${res.summary} (${(res.durationMs / 1000).toFixed(1)}s)` : `✗ FAIL`)
}

const failed = results.filter((r) => !r.ok)
const summaryMd = [
  '# Full System UAT Automation Summary',
  '',
  `**Generated:** ${new Date().toISOString()}`,
  '',
  '| Suite | Status | Result | Duration |',
  '|-------|--------|--------|----------|',
  ...results.map(
    (r) => `| \`${r.script}\` | ${r.ok ? '✓ PASS' : '✗ FAIL'} | ${r.summary} | ${(r.durationMs / 1000).toFixed(1)}s |`,
  ),
  '',
  `**Overall:** ${failed.length === 0 ? '✓ FULL SYSTEM UAT GREEN' : `✗ ${failed.length} suite(s) failed`}`,
  '',
  failed.length > 0 ? `Failed: ${failed.map((f) => f.script).join(', ')}` : '',
].join('\n')

writeFileSync(path.join(ROOT, 'FULL_SYSTEM_UAT_AUTOMATION_SUMMARY.md'), summaryMd)

if (failed.length === 0) {
  console.log('\n  Generating full system UAT reports…')
  const gen = runPackageScript('generate:full-system-uat-reports', ROOT)
  if (gen.status !== 0) {
    console.log('✗ Report generation failed')
    process.exit(1)
  }
  console.log('\n✓ FULL SYSTEM UAT GREEN — all reports generated')
  process.exit(0)
}

console.log(`\n✗ FULL SYSTEM UAT RED — ${failed.length} suite(s) failed. Fix before generating final reports.`)
process.exit(1)
