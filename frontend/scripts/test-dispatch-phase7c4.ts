/**
 * Dispatch Phase 7C4 smoke — Delivery Challan API client, routes, workbench tabs.
 * npx tsx scripts/test-dispatch-phase7c4.ts
 */
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
let pass = 0
let fail = 0

function check(label: string, ok: boolean) {
  console.log(`${ok ? '✓' : '✗'} ${label}`)
  ok ? pass++ : fail++
}

const dispatchApi = fs.readFileSync(path.join(root, 'src/services/api/dispatchApi.ts'), 'utf8')
check('dispatchApi exports createDeliveryChallan', dispatchApi.includes('export async function createDeliveryChallan'))
check('dispatchApi exports listDeliveryChallans', dispatchApi.includes('export async function listDeliveryChallans'))
check('dispatchApi exports issueDeliveryChallan', dispatchApi.includes('export async function issueDeliveryChallan'))
check('dispatchApi exports listWorkbenchChallanDrafts', dispatchApi.includes('export async function listWorkbenchChallanDrafts'))
check('dispatchApi summary readyForChallan field', dispatchApi.includes('readyForChallan'))
check('dispatchApi keeps packIntoDispatchPackage', dispatchApi.includes('export async function packIntoDispatchPackage'))
check('dispatchApi keeps confirmOutboundDispatch', dispatchApi.includes('export async function confirmOutboundDispatch'))

const routes = fs.readFileSync(path.join(root, 'src/routes/dispatchFinanceRoutes.tsx'), 'utf8')
check('routes include delivery-challans register', routes.includes("path: 'dispatch/delivery-challans'") && routes.includes('DispatchChallanRegisterPage'))
check('routes include delivery-challans detail', routes.includes('DispatchChallanDetailPage'))

const workbench = fs.readFileSync(path.join(root, 'src/modules/dispatch/DispatchWorkbenchPage.tsx'), 'utf8')
check('workbench KPI Ready for Challan', workbench.includes('Ready for Challan'))
check('workbench KPI Issued Challans', workbench.includes('Issued Challans'))
check('workbench tab ready_for_challan', workbench.includes("'ready_for_challan'"))
check('workbench tab challan_drafts', workbench.includes("'challan_drafts'"))
check('workbench Create Delivery Challan', workbench.includes('Create Delivery Challan'))
check('workbench no Post Dispatch action', !workbench.match(/Post Dispatch/i))

const pages = fs.readFileSync(path.join(root, 'src/modules/dispatch/DispatchChallanPages.tsx'), 'utf8')
check('challan register page exists', pages.includes('DispatchChallanRegisterPage'))
check('challan detail page exists', pages.includes('DispatchChallanDetailPage'))
check('document-only banner', pages.includes('DELIVERY_CHALLAN_AS_DOCUMENT_ONLY'))
check('manual e-Way Bill field', pages.includes('e-Way Bill (manual reference)'))
check('no invoice action', !pages.match(/Create.*Invoice/i))

const nav = fs.readFileSync(path.join(root, 'src/config/navigation.ts'), 'utf8')
check('nav has Delivery Challans', nav.includes("path: '/dispatch/delivery-challans'"))

const pkg = fs.readFileSync(path.join(root, 'package.json'), 'utf8')
check('package.json test:dispatch-phase7c4 script', pkg.includes('test:dispatch-phase7c4'))

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
