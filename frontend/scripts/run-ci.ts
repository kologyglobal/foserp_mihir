/**
 * CI orchestrator — npm run test:ci
 * Single trusted gate for pre-backend ERP readiness.
 *
 * Phase 1: Build & typecheck (tsc -b + vite build)
 * Phase 2: Factory-control gate (12 explicit suites — any failure fails CI)
 * Phase 3: Extended regression (non-duplicated suites)
 * Phase 4: Go-live simulation
 */
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { runPackageScript } from './run-package-script'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

interface SuiteResult {
  label: string
  npmScript: string
  ok: boolean
  durationMs: number
  passed?: number
  failed?: number
  summary?: string
}

/** Factory-control gate — must all pass for CI green */
const FACTORY_CONTROL_SUITES: { label: string; npmScript: string }[] = [
  { label: 'Dynamic QC', npmScript: 'test:dynamic-qc' },
  { label: 'QR Generation', npmScript: 'test:qr-generation' },
  { label: 'QR Traceability', npmScript: 'test:qr-traceability' },
  { label: 'Approval Matrix', npmScript: 'test:approval-matrix' },
  { label: 'RBAC', npmScript: 'test:rbac' },
  { label: 'Execution Layer', npmScript: 'test:execution-layer' },
  { label: 'Entity 360', npmScript: 'test:entity-360' },
  { label: 'Control Towers', npmScript: 'test:control-towers' },
  { label: 'Serial Genealogy', npmScript: 'test:serial-genealogy' },
  { label: 'DMS', npmScript: 'test:dms' },
  { label: 'ECO / ECR', npmScript: 'test:eco-ecr' },
  { label: 'WO Flow', npmScript: 'test:wo-flow' },
  { label: 'Demo Data', npmScript: 'test:demo-data' },
  { label: 'Demo Data Saturation', npmScript: 'test:demo-data-saturation' },
  { label: 'Mobile Operations', npmScript: 'test:mobile-ops' },
  { label: 'Advanced CRM', npmScript: 'test:advanced-crm' },
  { label: 'CRM Dashboard Design Polish', npmScript: 'test:crm-dashboard-design-polish' },
  { label: 'CRM Companies UI', npmScript: 'test:crm-companies-ui' },
  { label: 'Quotation Template Builder', npmScript: 'test:quotation-template-builder' },
  { label: 'CRM Integration', npmScript: 'test:crm-integration' },
  { label: 'CRM Sales Navigation', npmScript: 'test:crm-sales-navigation' },
  { label: 'CRM EEATA Fix', npmScript: 'test:crm-eeata-fix' },
  { label: 'CRM Quotation to SO Handover', npmScript: 'test:crm-quotation-to-so-handover' },
  { label: 'CRM Lead Form Refinement', npmScript: 'test:crm-lead-form-refinement' },
  { label: 'CRM Leads List View', npmScript: 'test:crm-leads-list-view' },
  { label: 'CRM Masters', npmScript: 'test:crm-masters' },
  { label: 'CRM Opportunity Item Lines', npmScript: 'test:crm-opportunity-item-lines' },
  { label: 'CRM Opportunity Full Page', npmScript: 'test:crm-opportunity-full-page' },
  { label: 'Max Update Depth', npmScript: 'test:max-update-depth' },
  { label: 'Cross-Module Creation', npmScript: 'test:cross-module-creation' },
  { label: 'Quality Flow', npmScript: 'test:quality' },
  { label: 'Purchase Production Ready', npmScript: 'test:purchase-production-ready' },
  { label: 'Purchase Module', npmScript: 'test:purchase-module' },
  { label: 'Dispatch Production Ready', npmScript: 'test:dispatch-production-ready' },
]

/** Additional regression — excludes suites already in factory-control gate */
const EXTENDED_REGRESSION_SUITES: { label: string; npmScript: string }[] = [
  { label: 'Integrity Check', npmScript: 'test:integrity' },
  { label: 'Quality Production Ready', npmScript: 'test:quality:production' },
  { label: 'Sales Lifecycle', npmScript: 'test:sales' },
  { label: 'Invoice Flow', npmScript: 'test:invoice' },
  { label: 'Product Master', npmScript: 'test:product-master' },
  { label: 'WO Creation Order', npmScript: 'test:wo-order' },
  { label: 'WIP Routing', npmScript: 'test:wip' },
  { label: 'SA Receipt', npmScript: 'test:sa-receipt' },
  { label: 'Costing', npmScript: 'test:costing' },
  { label: 'Dispatch Flow', npmScript: 'test:dispatch' },
  { label: 'Modern ERP UI', npmScript: 'test:modern-erp-ui' },
  { label: 'UI/UX Audit', npmScript: 'test:ui-ux-audit' },
  { label: 'Form Action Usability', npmScript: 'test:form-action-usability' },
  { label: 'ERP Card Form System', npmScript: 'test:erp-card-form-system' },
  { label: 'Practical User Journey', npmScript: 'test:practical-user-journey' },
  { label: 'SaaS UI', npmScript: 'test:saas-ui' },
  { label: 'Dynamics Theme', npmScript: 'test:dynamics-theme' },
  { label: 'Operational Reports', npmScript: 'test:reports' },
]

const GO_LIVE = { label: 'Go-Live Simulation', npmScript: 'simulate:go-live' }

function banner(title: string) {
  const line = '═'.repeat(58)
  console.log(`\n${line}`)
  console.log(` ${title}`)
  console.log(`${line}\n`)
}

function phaseHeader(phase: string, title: string) {
  console.log(`\n▶ ${phase}: ${title}`)
  console.log('─'.repeat(58))
}

function parseCounts(output: string): { passed?: number; failed?: number; summary?: string } {
  const lines = output.split('\n').reverse()
  for (const line of lines) {
    const slash = line.match(/(\d+)\/(\d+)\s+passed/i)
    if (slash) {
      const passed = Number(slash[1])
      const total = Number(slash[2])
      return { passed, failed: total - passed, summary: `${passed}/${total} passed` }
    }
    const result = line.match(/RESULT:\s*(\d+)\s+passed,\s*(\d+)\s+failed/i)
    if (result) {
      return {
        passed: Number(result[1]),
        failed: Number(result[2]),
        summary: `${result[1]} passed, ${result[2]} failed`,
      }
    }
    const results = line.match(/Results:\s*(\d+)\s+passed,\s*(\d+)\s+failed/i)
    if (results) {
      return {
        passed: Number(results[1]),
        failed: Number(results[2]),
        summary: `${results[1]} passed, ${results[2]} failed`,
      }
    }
    const allPass = line.match(/ALL\s+.+\s+PASS/i)
    if (allPass) {
      const prev = lines.find((l) => /(\d+)\s+passed/i.test(l))
      if (prev) {
        const m = prev.match(/(\d+)\s+passed,\s*(\d+)\s+failed/i)
        if (m) return { passed: Number(m[1]), failed: Number(m[2]), summary: `${m[1]} passed, ${m[2]} failed` }
      }
    }
  }
  return {}
}

function runNpmScript(npmScript: string): Omit<SuiteResult, 'label' | 'npmScript'> {
  const start = Date.now()
  const result = runPackageScript(npmScript, ROOT)
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`
  const ok = result.status === 0
  const counts = parseCounts(output)
  return {
    ok,
    durationMs: Date.now() - start,
    ...counts,
  }
}

function printSuiteLine(index: number, total: number, suite: SuiteResult) {
  const status = suite.ok ? '✓ PASS' : '✗ FAIL'
  const duration = `${(suite.durationMs / 1000).toFixed(1)}s`
  const counts = suite.summary ? ` · ${suite.summary}` : ''
  const pad = suite.label.padEnd(28, '.')
  console.log(`  [${String(index).padStart(2)}/${total}] ${pad} ${status} (${duration})${counts}`)
  if (!suite.ok) {
    const tail = suite.summary ? '' : '\n    (see output above for failure details)'
    if (tail) console.log(tail)
  }
}

function runSuiteBatch(
  phase: string,
  title: string,
  suites: { label: string; npmScript: string }[],
): SuiteResult[] {
  phaseHeader(phase, title)
  const results: SuiteResult[] = []
  for (let i = 0; i < suites.length; i++) {
    const def = suites[i]!
    console.log(`\n  Running ${def.npmScript}…`)
    const run = runNpmScript(def.npmScript)
    const suite: SuiteResult = { label: def.label, npmScript: def.npmScript, ...run }
    results.push(suite)
    printSuiteLine(i + 1, suites.length, suite)
    if (!suite.ok) {
      console.log(`\n  ✗ CI aborted — ${def.npmScript} failed.\n`)
      break
    }
  }
  return results
}

function summarize(all: SuiteResult[]) {
  const passed = all.filter((s) => s.ok).length
  const failed = all.filter((s) => !s.ok).length
  const checks = all.reduce((sum, s) => sum + (s.passed ?? 0), 0)
  banner('CI GATE SUMMARY')
  console.log(`  Suites run:     ${all.length}`)
  console.log(`  Suites passed:  ${passed}`)
  console.log(`  Suites failed:  ${failed}`)
  console.log(`  Checks passed:  ${checks > 0 ? checks : '(per-suite counts not parsed)'}`)
  console.log(`  Overall:        ${failed === 0 ? '✓ CI GREEN — pre-backend readiness OK' : '✗ CI RED — fix failures before merge'}\n`)
  return failed === 0
}

banner('CI GATE — Pre-Backend ERP Readiness')

// Phase 1: Build
phaseHeader('Phase 1/4', 'Build & Typecheck')
console.log('  Running build (tsc -b + vite build)…')
const buildStart = Date.now()
const build = runPackageScript('build', ROOT)
const buildOk = build.status === 0
const buildDuration = ((Date.now() - buildStart) / 1000).toFixed(1)
console.log(`  ${buildOk ? '✓ PASS' : '✗ FAIL'} — build (${buildDuration}s)`)
if (!buildOk) {
  console.error(build.stdout ?? '')
  console.error(build.stderr ?? '')
  console.log('\n✗ CI aborted at build phase.\n')
  process.exit(1)
}

const allResults: SuiteResult[] = []

// Phase 2: Factory-control gate (12 suites — hard fail)
const factoryResults = runSuiteBatch('Phase 2/4', 'Factory-Control Gate (12 suites)', FACTORY_CONTROL_SUITES)
allResults.push(...factoryResults)
if (factoryResults.some((s) => !s.ok)) {
  summarize(allResults)
  process.exit(1)
}

// Phase 3: Extended regression
const regressionResults = runSuiteBatch('Phase 3/4', 'Extended Regression', EXTENDED_REGRESSION_SUITES)
allResults.push(...regressionResults)
if (regressionResults.some((s) => !s.ok)) {
  summarize(allResults)
  process.exit(1)
}

// Phase 4: Go-live
phaseHeader('Phase 4/4', 'Go-Live Simulation')
console.log(`\n  Running ${GO_LIVE.npmScript}…`)
const goLiveRun = runNpmScript(GO_LIVE.npmScript)
const goLiveResult: SuiteResult = { label: GO_LIVE.label, npmScript: GO_LIVE.npmScript, ...goLiveRun }
allResults.push(goLiveResult)
printSuiteLine(1, 1, goLiveResult)

const green = summarize(allResults) && goLiveResult.ok
process.exit(green ? 0 : 1)
