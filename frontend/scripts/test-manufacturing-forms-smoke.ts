/**
 * Manufacturing Form UX modernisation smoke test — shared foundation + form wiring.
 * Run: npm run test:manufacturing-forms
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

let passed = 0
let failed = 0

function check(label: string, ok: boolean, detail = '') {
  if (ok) {
    passed++
    console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`)
  } else {
    failed++
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

function read(relPath: string): string {
  return readFileSync(path.join(ROOT, relPath), 'utf8')
}

console.log('\n── Manufacturing form UX (FORM-A/B/C) smoke ──\n')

console.log('FORM-A shared foundation:')
const foundationFiles: Array<[string, string]> = [
  ['ManufacturingDocumentShell', 'src/modules/manufacturing/ui/ManufacturingDocumentShell.tsx'],
  ['ReadinessChecklist / ValidationSummary / NBA', 'src/modules/manufacturing/ui/ReadinessChecklist.tsx'],
]
for (const [label, relPath] of foundationFiles) {
  check(label, existsSync(path.join(ROOT, relPath)), relPath)
}

const uiIndex = read('src/modules/manufacturing/ui/index.ts')
for (const exportName of [
  'ManufacturingDocumentShell',
  'DocumentSummaryStrip',
  'DocumentInfoPanel',
  'DocumentFormSection',
  'AdvancedSection',
  'ReadinessChecklist',
  'ValidationSummary',
  'NextBestActionBanner',
  'PostingImpactPanel',
]) {
  check(`ui barrel exports ${exportName}`, uiIndex.includes(exportName))
}

const shellSrc = read('src/modules/manufacturing/ui/ManufacturingDocumentShell.tsx')
check('shell composes OperationalPageShell (no bespoke chrome)', shellSrc.includes('OperationalPageShell'))
check('shell uses ErpCommandBar for lifecycle actions', shellSrc.includes('ErpCommandBar'))

console.log('\nFORM-B core production:')
const createSrc = read('src/modules/manufacturing/work-orders/ApiWorkOrderCreatePage.tsx')
check('WO create shows Manufacturing Readiness panel', createSrc.includes('ManufacturingReadinessPanel'))
check('WO create uses server profile readiness', createSrc.includes('getProfileReadiness'))
check('WO create explains what happens next', createSrc.includes('What happens next'))

const detailSrc = read('src/modules/manufacturing/work-orders/ApiWorkOrderDetailPage.tsx')
check('WO detail shows next best action banner', detailSrc.includes('NextBestActionBanner'))
check('WO detail has information side panel', detailSrc.includes('DocumentInfoPanel'))
check('WO detail primary action is lifecycle-specific', detailSrc.includes("'Release Work Order'") && detailSrc.includes("'Start Production'"))
check('WO detail mounts FG receipt drawer', detailSrc.includes('FgReceiptDrawer'))
check('WO detail mounts material issue drawer', detailSrc.includes('MaterialIssueDrawer'))
check('WO detail mounts material return drawer', detailSrc.includes('MaterialReturnDrawer'))
check('WO detail complete uses close-readiness dialog', detailSrc.includes('CompleteWorkOrderDialog'))
check('WO detail no longer uses inline issue qty inputs', !detailSrc.includes('issueQtyByMaterial'))

const completeSrc = read('src/modules/manufacturing/work-orders/components/CompleteWorkOrderDialog.tsx')
check('complete dialog loads server close readiness', completeSrc.includes('getCloseReadiness'))
check('complete dialog shows blockers/warnings', completeSrc.includes('ValidationSummary'))

const dailySrc = read('src/modules/manufacturing/daily-update/DailyUpdatePage.tsx')
check('daily update add-line uses WO selector (no raw IDs)', dailySrc.includes('listWorkOrders') && !dailySrc.includes('Work Order ID'))
check('daily update add-line loads stage options', dailySrc.includes('getWorkOrderDetail'))
check('daily update submit confirm shows totals preview', dailySrc.includes('Submit Production Update'))

console.log('\nFORM-C materials / FG posting drawers:')
const materialDrawers = read('src/modules/manufacturing/work-orders/components/MaterialActionDrawers.tsx')
check('material issue drawer exists with posting impact', materialDrawers.includes('MaterialIssueDrawer') && materialDrawers.includes('PostingImpactPanel'))
check('material issue warns posting is immutable', materialDrawers.includes('cannot be directly edited'))
check('material return drawer requires reason', materialDrawers.includes('MaterialReturnDrawer') && materialDrawers.includes('Reason / Remarks'))

const fgDrawer = read('src/modules/manufacturing/work-orders/components/FgReceiptDrawer.tsx')
check('FG receipt drawer uses server eligibility', fgDrawer.includes('getFgEligibility'))
check('FG receipt drawer previews before posting', fgDrawer.includes('previewFgReceipt'))
check('FG receipt drawer posts with idempotency key', fgDrawer.includes('idempotencyKey'))

console.log('\nFORM-D job work:')
const jwDetail = read('src/modules/manufacturing/job-work/JobWorkDetailPage.tsx')
check('job work reconciliation shows equation', jwDetail.includes('Reconciliation equation'))
check('job work surfaces unexplained difference', jwDetail.includes('Unexplained difference'))

console.log('\nPermissions:')
const permsSrc = read('src/utils/permissions/manufacturing.ts')
check('FG receipt post permission wired to WO hook', permsSrc.includes('canPostFgReceipt'))

console.log('\nDocs:')
for (const doc of [
  'MANUFACTURING_FORM_INFORMATION_MATRIX.md',
  'MANUFACTURING_FORM_DESIGN_STANDARD.md',
  'MANUFACTURING_CRM_THEME_MAPPING.md',
  'MANUFACTURING_FORM_COMPONENTS.md',
  'WORK_ORDER_FORM_UX.md',
  'MATERIAL_FORM_UX.md',
  'FG_RECEIPT_FORM_UX.md',
  'MANUFACTURING_FORM_TEST_RESULTS.md',
]) {
  check(`docs/ui/production/${doc}`, existsSync(path.resolve(ROOT, '..', 'docs', 'ui', 'production', doc)))
}

console.log(`\n${passed} passed, ${failed} failed\n`)
if (failed > 0) process.exit(1)
