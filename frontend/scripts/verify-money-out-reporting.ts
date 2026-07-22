/**
 * Phase 4D1 Money Out — AP reporting frontend verification.
 *
 * Static checks (no live server):
 *  - reporting tabs live (Outstanding, Vendors, Ageing, Payment Planning)
 *  - Reconciliation remains preview-only
 *  - routes registered
 *  - bridge + api client reporting methods present
 *  - overview uses reporting APIs (not invoice list sampling)
 *  - payables page uses overview/outstanding APIs
 *  - no Ant Design in reporting pages
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

let passed = 0
let failed = 0

function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    passed += 1
    console.log(`✓ ${label}${detail ? ` — ${detail}` : ''}`)
  } else {
    failed += 1
    console.log(`✗ ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

function read(rel: string) {
  return readFileSync(path.join(ROOT, rel), 'utf8')
}

const REPORTING_PAGES = [
  'src/modules/accounting/money-out/outstanding/OutstandingPage.tsx',
  'src/modules/accounting/money-out/ageing/AgeingPage.tsx',
  'src/modules/accounting/money-out/vendors/VendorListPage.tsx',
  'src/modules/accounting/money-out/vendors/VendorDetailPage.tsx',
  'src/modules/accounting/money-out/payment-planning/PaymentPlanningPage.tsx',
  'src/modules/accounting/money-out/MoneyOutOverviewPage.tsx',
  'src/modules/accounting/money-out/payables/PayablesPage.tsx',
  'src/modules/accounting/money-out/components/PayableAttentionPanel.tsx',
]

async function main() {
  console.log('═══════════════════════════════════════')
  console.log(' Money Out Reporting (Phase 4D1) verification')
  console.log('═══════════════════════════════════════\n')

  const { MONEY_OUT_WORKSPACE_TABS } = await import('../src/modules/accounting/money-out/moneyOutUi.ts')

  const liveTab = (p: string) =>
    MONEY_OUT_WORKSPACE_TABS.some((t) => t.path === p && !('preview' in t && t.preview))
  const previewTab = (p: string) =>
    MONEY_OUT_WORKSPACE_TABS.some((t) => t.path === p && 'preview' in t && t.preview)

  check('Outstanding tab live', liveTab('/accounting/money-out/outstanding'))
  check('Vendors tab live', liveTab('/accounting/money-out/vendors'))
  check('Ageing tab live', liveTab('/accounting/money-out/ageing'))
  check('Payment Planning tab live', liveTab('/accounting/money-out/payment-planning'))
  check('Reconciliation tab live', liveTab('/accounting/money-out/reconciliation'))
  check('Close Gate tab live', liveTab('/accounting/money-out/close-gate'))
  check('Ageing not preview', !previewTab('/accounting/money-out/ageing'))

  const routesSrc = read('src/routes/accountingRoutes.tsx')
  check('Outstanding route', routesSrc.includes("path: 'accounting/money-out/outstanding'"))
  check('Vendors list route', routesSrc.includes("path: 'accounting/money-out/vendors'"))
  check('Vendor detail route', routesSrc.includes("path: 'accounting/money-out/vendors/:vendorId'"))
  check('Ageing route', routesSrc.includes("path: 'accounting/money-out/ageing'"))
  check('Payment planning route', routesSrc.includes("path: 'accounting/money-out/payment-planning'"))

  const indexSrc = read('src/modules/accounting/money-out/index.ts')
  check('Index exports OutstandingPage', indexSrc.includes('OutstandingPage'))
  check('Index exports AgeingPage', indexSrc.includes('AgeingPage'))
  check('Index exports VendorListPage', indexSrc.includes('VendorListPage'))
  check('Index exports PaymentPlanningPage', indexSrc.includes('PaymentPlanningPage'))

  const typesSrc = read('src/types/moneyOut.ts')
  check('Types PayableOverviewDto', typesSrc.includes('export interface PayableOverviewDto'))
  check('Types PayableOutstandingOpenItemDto', typesSrc.includes('export interface PayableOutstandingOpenItemDto'))
  check('Types PaymentPlanningDto', typesSrc.includes('export interface PaymentPlanningDto'))
  check('Types PayableAgeingBasis document_age', typesSrc.includes("'document_age'"))

  const apiSrc = read('src/services/api/payablesApi.ts')
  check('API getPayableOverview', apiSrc.includes('getPayableOverview'))
  check('API listPayableOutstanding', apiSrc.includes('listPayableOutstanding'))
  check('API getPayableAgeingReport', apiSrc.includes('getPayableAgeingReport'))
  check('API listVendorPayableSummaries', apiSrc.includes('listVendorPayableSummaries'))
  check('API getVendorPayableSummary', apiSrc.includes('getVendorPayableSummary'))
  check('API listVendorPayableOpenItems', apiSrc.includes('listVendorPayableOpenItems'))
  check('API getPaymentPlanning', apiSrc.includes('getPaymentPlanning'))
  check('API reporting base path', apiSrc.includes("'/accounting/payables'"))

  const bridgeSrc = read('src/services/bridges/payablesApiBridge.ts')
  check('Bridge getPayableOverview', bridgeSrc.includes('export async function getPayableOverview'))
  check('Bridge listPayableOutstanding', bridgeSrc.includes('export async function listPayableOutstanding'))
  check('Bridge getPayableAgeingReport', bridgeSrc.includes('export async function getPayableAgeingReport'))
  check('Bridge listVendorPayableSummaries', bridgeSrc.includes('export async function listVendorPayableSummaries'))
  check('Bridge getPaymentPlanning', bridgeSrc.includes('export async function getPaymentPlanning'))
  check('Bridge reporting requires API mode', bridgeSrc.includes('requireApiMode()'))

  const overviewSrc = read('src/modules/accounting/money-out/MoneyOutOverviewPage.tsx')
  check('Overview uses getPayableOverview', overviewSrc.includes('getPayableOverview'))
  check('Overview uses getPayableAgeingReport', overviewSrc.includes('getPayableAgeingReport'))
  check('Overview has ageing chart', overviewSrc.includes('BarChart'))
  check('Overview no ageing PreviewCard', !overviewSrc.includes('PreviewCard'))

  const payablesSrc = read('src/modules/accounting/money-out/payables/PayablesPage.tsx')
  check('Payables uses getPayableOverview', payablesSrc.includes('getPayableOverview'))
  check('Payables links to outstanding', payablesSrc.includes('/accounting/money-out/outstanding'))

  const ageingSrc = read('src/modules/accounting/money-out/ageing/AgeingPage.tsx')
  check('Ageing supports document_age basis', ageingSrc.includes('document_age'))

  const shellSrc = read('src/modules/accounting/money-out/MoneyOutWorkspaceShell.tsx')
  check('Shell activePath for outstanding', shellSrc.includes("'/accounting/money-out/outstanding'"))
  check('Shell activePath for payment-planning', shellSrc.includes("'/accounting/money-out/payment-planning'"))

  const pageSources = REPORTING_PAGES.map((p) => read(p))
  check('No Ant Design in reporting pages', pageSources.every((f) => !f.includes('antd') && !f.includes('@ant-design')))
  check(
    'Reporting pages use bridge',
    pageSources.every(
      (f) =>
        f.includes('payablesApiBridge') ||
        f.includes('PayableAttentionPanel') ||
        f.includes('MoneyOutWorkspaceShell'),
    ),
  )

  console.log(`\n${passed} passed, ${failed} failed`)
  if (failed > 0) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
