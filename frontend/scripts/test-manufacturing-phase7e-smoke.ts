/**
 * Phase 7E — Manufacturing costing / accounting frontend smoke.
 * Verifies frontend wiring (API client, Work Order Costing tab, live
 * Manufacturing Accounting workspace + gate, permissions, routes, docs).
 * Backend costing module is covered by backend vitest.
 *
 * Run: npm run test:manufacturing-phase7e
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

let passed = 0
let failed = 0

function check(label: string, ok: boolean) {
  if (ok) {
    passed++
    console.log(`  ✓ ${label}`)
  } else {
    failed++
    console.error(`  ✗ ${label}`)
  }
}

function exists(rel: string) {
  return existsSync(path.join(ROOT, rel))
}

function read(rel: string) {
  return existsSync(path.join(ROOT, rel)) ? readFileSync(path.join(ROOT, rel), 'utf8') : ''
}

console.log('\n── Manufacturing Phase 7E (Costing / Accounting) smoke ──\n')

console.log('API client:')
check('manufacturingCostingApi.ts exists', exists('src/services/api/manufacturingCostingApi.ts'))
const api = read('src/services/api/manufacturingCostingApi.ts')
check('listCostingPolicies', api.includes('listCostingPolicies'))
check('createCostingPolicy', api.includes('createCostingPolicy'))
check('updateCostingPolicy', api.includes('updateCostingPolicy'))
check('activateCostingPolicy', api.includes('activateCostingPolicy'))
check('getCostingReadiness', api.includes('getCostingReadiness'))
check('getWorkOrderCostSummary', api.includes('getWorkOrderCostSummary'))
check('getWorkOrderCostDetails', api.includes('getWorkOrderCostDetails'))
check('calculateWorkOrderCost', api.includes('calculateWorkOrderCost'))
check('getWorkOrderCostSnapshots', api.includes('getWorkOrderCostSnapshots'))
check('getWorkOrderAccountingReadiness', api.includes('getWorkOrderAccountingReadiness'))
check('previewWorkOrderFinancialClose', api.includes('previewWorkOrderFinancialClose'))
check('recordWorkOrderFinancialClose', api.includes('recordWorkOrderFinancialClose'))
check('getManufacturingAccountingGateStatus', api.includes('getManufacturingAccountingGateStatus'))
check('listManufacturingAccountingEvents', api.includes('listManufacturingAccountingEvents'))
check('validate/post/retry event helpers', api.includes('validateManufacturingAccountingEvent') && api.includes('postManufacturingAccountingEvent') && api.includes('retryManufacturingAccountingEvent'))
check('workspace summary + list helpers', api.includes('getAccountingWorkspaceSummary') && api.includes('listAccountingWorkspaceUnposted') && api.includes('listAccountingWorkspaceFailed') && api.includes('listAccountingWorkspaceProvisional') && api.includes('listAccountingWorkspaceCloseReady') && api.includes('listAccountingWorkspaceReconciliation'))
check('path /manufacturing/costing/policies', api.includes('/manufacturing/costing/policies'))
check('path /manufacturing/costing/readiness', api.includes('/manufacturing/costing/readiness'))
check('path cost-summary', api.includes('/cost-summary'))
check('path cost/calculate', api.includes('/cost/calculate'))
check('path accounting-readiness', api.includes('/accounting-readiness'))
check('path financial-close/preview', api.includes('/financial-close/preview'))
check('path accounting/workspace/*', api.includes('/manufacturing/accounting/workspace/summary') && api.includes('/manufacturing/accounting/workspace/reconciliation'))

console.log('\nWork Order Costing tab:')
check('WorkOrderCostingPanel.tsx exists', exists('src/modules/manufacturing/work-orders/WorkOrderCostingPanel.tsx'))
const panel = read('src/modules/manufacturing/work-orders/WorkOrderCostingPanel.tsx')
check('panel loads cost summary', panel.includes('getWorkOrderCostSummary'))
check('panel loads accounting readiness', panel.includes('getWorkOrderAccountingReadiness'))
check('panel Calculate Cost action', panel.includes('calculateWorkOrderCost'))
check('panel Financial Close Preview', panel.includes('previewWorkOrderFinancialClose'))
check('panel never fakes zero cost (Not Available)', panel.includes('Not Available'))
check('panel Pending Rate flag', panel.includes('Pending Rate'))
check('panel accounting-disabled state', panel.includes('Disabled / Not Enabled'))
check('panel permission gates', panel.includes('canCalculateCost') && panel.includes('canFinancialClose') && panel.includes('canViewCost'))
const detailPage = read('src/modules/manufacturing/work-orders/ApiWorkOrderDetailPage.tsx')
check('detail page imports WorkOrderCostingPanel', detailPage.includes('WorkOrderCostingPanel'))
check('detail page has Costing tab', detailPage.includes("{ id: 'costing', label: 'Costing' }"))
check('Costing tab gated on canViewCost', detailPage.includes('canViewCost()'))

console.log('\nManufacturing Accounting workspace + gate:')
check('ManufacturingAccountingWorkspacePage.tsx exists', exists('src/modules/accounting/manufacturing/ManufacturingAccountingWorkspacePage.tsx'))
const workspace = read('src/modules/accounting/manufacturing/ManufacturingAccountingWorkspacePage.tsx')
check('workspace KPI strip from summary', workspace.includes('getAccountingWorkspaceSummary') && workspace.includes('ManufacturingAccountingSummaryCards'))
check('workspace tabs (unposted/failed/provisional/close-ready/reconciliation)', workspace.includes("'unposted'") && workspace.includes("'failed'") && workspace.includes("'provisional'") && workspace.includes("'close-ready'") && workspace.includes("'reconciliation'"))
check('workspace Validate/Post/Retry actions', workspace.includes('validateManufacturingAccountingEvent') && workspace.includes('postManufacturingAccountingEvent') && workspace.includes('retryManufacturingAccountingEvent'))
check('workspace immutable-voucher confirm', workspace.includes('immutable journal voucher'))
check('workspace work order drill-down', workspace.includes('/manufacturing/work-orders/'))
check('workspace honest flag-off banner', workspace.includes('not enabled'))
const gate = read('src/components/accounting/manufacturingAccounting/ManufacturingAccountingApiGate.tsx')
check('gate calls accounting gate endpoint', gate.includes('getManufacturingAccountingGateStatus'))
check('gate honest empty state when flag off', gate.includes('Manufacturing Accounting is not enabled for this tenant'))
check('gate links to work order costing', gate.includes('/manufacturing/work-orders'))
check('gate renders live workspace when allowed', gate.includes('ManufacturingAccountingWorkspacePage'))
check('gate preserves demo mode', gate.includes('isApiMode()') && gate.includes('{children}'))

console.log('\nRoutes:')
const accountingRoutes = read('src/routes/accountingRoutes.tsx')
check('route accounting/manufacturing still gated', accountingRoutes.includes("path: 'accounting/manufacturing'") && accountingRoutes.includes('withManufacturingAccountingApiGate'))
const manufacturingRoutes = read('src/routes/manufacturingRoutes.tsx')
check('route manufacturing/work-orders/:workOrderId resolves', manufacturingRoutes.includes("path: 'manufacturing/work-orders/:workOrderId'") && manufacturingRoutes.includes('ApiWorkOrderDetailPage'))

console.log('\nNavigation:')
const nav = read('src/config/navigation.ts')
check('nav Manufacturing Accounting → /accounting/manufacturing', nav.includes("path: '/accounting/manufacturing'"))

console.log('\nPermissions:')
const perms = read('src/utils/permissions/manufacturing.ts')
check('permission manufacturing.cost.calculate', perms.includes("'manufacturing.cost.calculate'"))
check('permission manufacturing.accounting.view', perms.includes("'manufacturing.accounting.view'"))
check('permission manufacturing.accounting.post', perms.includes("'manufacturing.accounting.post'"))
check('permission manufacturing.accounting.financial_close', perms.includes("'manufacturing.accounting.financial_close'"))
check('permission manufacturing.costing_policy.view/manage', perms.includes("'manufacturing.costing_policy.view'") && perms.includes("'manufacturing.costing_policy.manage'"))
check('canViewCost helper', perms.includes('export const canViewCost'))
check('canCalculateCost helper', perms.includes('export const canCalculateCost'))
check('canViewAccounting helper', perms.includes('export const canViewAccounting'))
check('canPostAccounting helper', perms.includes('export const canPostAccounting'))
check('canFinancialClose helper', perms.includes('export const canFinancialClose'))

console.log('\nDocs:')
check('docs/manufacturing/PRODUCTION_PHASE7E_README.md exists', existsSync(path.resolve(ROOT, '..', 'docs', 'manufacturing', 'PRODUCTION_PHASE7E_README.md')))

console.log(`\nResult: ${passed} passed, ${failed} failed\n`)
if (failed === 0) {
  console.log(
    'Note: backend Phase 7E costing module is mounted at /manufacturing/costing/*, /manufacturing/work-orders/:id/cost*,\n' +
      '/manufacturing/accounting/* — enforced by manufacturing.cost.* / manufacturing.accounting.* / manufacturing.costing_policy.*\n' +
      'permissions and covered by backend vitest. Frontend uses these APIs when VITE_USE_API=true; no feature flags were enabled.\n',
  )
}
process.exit(failed > 0 ? 1 : 0)
