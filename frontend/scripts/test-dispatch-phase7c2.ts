/**
 * Dispatch Phase 7C2 smoke — API client, routes, workbench tabs, pick list pages (static).
 * npx tsx scripts/test-dispatch-phase7c2.ts
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
check('dispatchApi exports previewDispatchReservations', dispatchApi.includes('export async function previewDispatchReservations'))
check('dispatchApi exports postDispatchReservations', dispatchApi.includes('export async function postDispatchReservations'))
check('dispatchApi exports getDispatchReservationPosition', dispatchApi.includes('export async function getDispatchReservationPosition'))
check('dispatchApi exports createDispatchPickLists', dispatchApi.includes('export async function createDispatchPickLists'))
check('dispatchApi exports listDispatchPickLists', dispatchApi.includes('export async function listDispatchPickLists'))
check('dispatchApi exports pickDispatchPickLine', dispatchApi.includes('export async function pickDispatchPickLine'))
check('dispatchApi exports listWorkbenchReservations', dispatchApi.includes('export async function listWorkbenchReservations'))
check('dispatchApi exports listWorkbenchShortages', dispatchApi.includes('export async function listWorkbenchShortages'))
check('dispatchApi keeps getDispatchWorkbenchSummary', dispatchApi.includes('export async function getDispatchWorkbenchSummary'))
check('dispatchApi keeps confirmOutboundDispatch', dispatchApi.includes('export async function confirmOutboundDispatch'))

const routes = fs.readFileSync(path.join(root, 'src/routes/dispatchFinanceRoutes.tsx'), 'utf8')
check('routes include pick-lists register', routes.includes("path: 'dispatch/pick-lists'") && routes.includes('DispatchPickListRegisterPage'))
check('routes include pick-lists detail', routes.includes('DispatchPickListDetailPage'))
check('routes include pick mode', routes.includes("path: 'dispatch/pick-lists/:id/pick'"))

const workbench = fs.readFileSync(path.join(root, 'src/modules/dispatch/DispatchWorkbenchPage.tsx'), 'utf8')
check('workbench title Dispatch & Delivery', workbench.includes('Dispatch & Delivery'))
check('workbench tab Requirements', workbench.includes("'requirements'") && workbench.includes('Requirements'))
check('workbench tab Reservations', workbench.includes("'reservations'") && workbench.includes('Reservations'))
check('workbench tab Pick Lists', workbench.includes("'pick_lists'") && workbench.includes('Pick Lists'))
check('workbench tab Shortages', workbench.includes("'shortages'") && workbench.includes('Shortages'))
check('workbench KPI Ready to Reserve', workbench.includes('Ready to Reserve'))
check('workbench tab Packing', workbench.includes("'packing'") && workbench.includes('Packing'))
check('workbench no Challan tab', !workbench.match(/['"]challan['"]/i) && !workbench.includes('Challan'))

const pickPages = fs.readFileSync(path.join(root, 'src/modules/dispatch/DispatchPickListPages.tsx'), 'utf8')
check('pick list register page exists', pickPages.includes('DispatchPickListRegisterPage'))
check('pick list detail page exists', pickPages.includes('DispatchPickListDetailPage'))
check('pick mode page exists', pickPages.includes('DispatchPickListPickModePage'))

const drawer = fs.readFileSync(path.join(root, 'src/modules/dispatch/DispatchReservationDrawer.tsx'), 'utf8')
check('reservation drawer Reserve Stock', drawer.includes('Reserve Stock'))

const detail = fs.readFileSync(path.join(root, 'src/modules/dispatch/ApiOutboundDispatchPages.tsx'), 'utf8')
check('detail Reserve Stock CTA', detail.includes('Reserve Stock'))
check('detail Basic Confirm label', detail.includes('Basic Confirm (7C0)'))
check('detail no challan create', !detail.match(/Create.*Challan/i) && !detail.includes('createChallan'))

const nav = fs.readFileSync(path.join(root, 'src/config/navigation.ts'), 'utf8')
check('nav has Pick Lists', nav.includes("path: '/dispatch/pick-lists'"))

const pkg = fs.readFileSync(path.join(root, 'package.json'), 'utf8')
check('package.json test:dispatch-phase7c2 script', pkg.includes('test:dispatch-phase7c2'))

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
