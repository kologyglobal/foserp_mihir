/**
 * Full ERP UAT automation gate — npm run test:uat
 */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { runPackageScript } from './run-package-script'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const SUITES = [
  'build',
  'test:ci',
  'test:demo-data',
  'test:cross-module-creation',
  'test:form-action-usability',
  'test:erp-card-form-system',
  'test:practical-user-journey',
  'test:dynamic-qc',
  'test:qr-generation',
  'test:serial-genealogy',
  'test:eco-ecr',
  'test:approval-matrix',
  'test:rbac',
  'test:dms',
  'test:mobile-ops',
  'test:advanced-crm',
  'test:crm-dashboard-design-polish',
  'test:crm-companies-ui',
  'test:quotation-template-builder',
  'test:crm-integration',
  'test:crm-sales-navigation',
  'test:crm-eeata-fix',
  'test:crm-quotation-to-so-handover',
  'test:crm-lead-form-refinement',
  'test:crm-leads-list-view',
  'test:crm-masters',
  'test:crm-opportunity-item-lines',
  'test:crm-opportunity-full-page',
  'test:purchase-module',
  'test:max-update-depth',
] as const

const EXTRA = ['test:uat-data-validation', 'test:demo-data-saturation'] as const

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

  if (script === 'test:ci' && r.status !== 0) {
    const aborted = out.match(/CI aborted — (test:[\w:-]+) failed/i)
    const suiteFail = out.match(/✗ FAIL — (build|[\w:-]+)/i)
    const ciRed = out.match(/CI RED — fix failures before merge/i)
    if (aborted) summary = `FAIL at ${aborted[1]}`
    else if (suiteFail) summary = `FAIL at ${suiteFail[1]}`
    else if (ciRed) summary = 'CI RED — see console output'
    else summary = 'FAIL — see CI output'
  } else {
    const slash = out.match(/(\d+)\/(\d+)\s+passed/i)
    if (slash) summary = `${slash[1]}/${slash[2]} passed`
  }

  return { script, ok: r.status === 0, durationMs, summary }
}

function banner(title: string) {
  console.log(`\n${'═'.repeat(58)}\n ${title}\n${'═'.repeat(58)}\n`)
}

banner('ERP UAT AUTOMATION GATE')

const results: Result[] = []
for (const script of SUITES) {
  process.stdout.write(`  Running ${script}… `)
  const res = run(script)
  results.push(res)
  console.log(res.ok ? `✓ ${res.summary} (${(res.durationMs / 1000).toFixed(1)}s)` : `✗ FAIL`)
}

for (const script of EXTRA) {
  process.stdout.write(`  Running ${script}… `)
  const res = run(script)
  results.push(res)
  console.log(res.ok ? `✓ ${res.summary} (${(res.durationMs / 1000).toFixed(1)}s)` : `✗ FAIL`)
}

const allOk = results.every((r) => r.ok)
const lines = [
  '# UAT Automation Summary',
  '',
  `**Generated:** ${new Date().toISOString().slice(0, 10)}`,
  `**Overall:** ${allOk ? '✓ UAT AUTOMATION GREEN' : '✗ UAT AUTOMATION FAILED'}`,
  '',
  '| Suite | Status | Summary | Duration |',
  '|-------|--------|---------|----------|',
  ...results.map((r) => `| \`${r.script}\` | ${r.ok ? 'PASS' : 'FAIL'} | ${r.summary} | ${(r.durationMs / 1000).toFixed(1)}s |`),
  '',
  '## Verdict',
  allOk
    ? '- All automated UAT gates passed. Proceed with manual UAT signoff review.'
    : '- One or more gates failed. UAT signoff blocked until resolved.',
  '',
]

writeFileSync(path.join(ROOT, 'UAT_AUTOMATION_SUMMARY.md'), lines.join('\n'))
console.log(`\nWrote UAT_AUTOMATION_SUMMARY.md`)
console.log(allOk ? '\n✓ UAT AUTOMATION GREEN' : '\n✗ UAT AUTOMATION FAILED')
process.exit(allOk ? 0 : 1)
