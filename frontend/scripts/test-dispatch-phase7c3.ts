/**
 * Dispatch Phase 7C3 smoke — API client, routes, workbench packing tabs, packing pages (static).
 * npx tsx scripts/test-dispatch-phase7c3.ts
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
check('dispatchApi exports createDispatchPackingSessions', dispatchApi.includes('export async function createDispatchPackingSessions'))
check('dispatchApi exports listDispatchPackingSessions', dispatchApi.includes('export async function listDispatchPackingSessions'))
check('dispatchApi exports getDispatchPackingSession', dispatchApi.includes('export async function getDispatchPackingSession'))
check('dispatchApi exports packIntoDispatchPackage', dispatchApi.includes('export async function packIntoDispatchPackage'))
check('dispatchApi exports getDispatchPackingReconciliation', dispatchApi.includes('export async function getDispatchPackingReconciliation'))
check('dispatchApi exports listWorkbenchPacking', dispatchApi.includes('export async function listWorkbenchPacking'))
check('dispatchApi exports listWorkbenchPacked', dispatchApi.includes('export async function listWorkbenchPacked'))
check('dispatchApi exports listWorkbenchPackingShortages', dispatchApi.includes('export async function listWorkbenchPackingShortages'))
check('dispatchApi summary readyToPack field', dispatchApi.includes('readyToPack'))
check('dispatchApi keeps confirmOutboundDispatch', dispatchApi.includes('export async function confirmOutboundDispatch'))
check('dispatchApi keeps createDispatchPickLists', dispatchApi.includes('export async function createDispatchPickLists'))

const routes = fs.readFileSync(path.join(root, 'src/routes/dispatchFinanceRoutes.tsx'), 'utf8')
check('routes include packing-sessions register', routes.includes("path: 'dispatch/packing-sessions'") && routes.includes('DispatchPackingRegisterPage'))
check('routes include packing-sessions detail', routes.includes('DispatchPackingDetailPage'))
check('routes include pack mode', routes.includes("path: 'dispatch/packing-sessions/:id/pack'"))

const workbench = fs.readFileSync(path.join(root, 'src/modules/dispatch/DispatchWorkbenchPage.tsx'), 'utf8')
check('workbench KPI Ready to Pack', workbench.includes('Ready to Pack'))
check('workbench KPI Packing', workbench.includes("'packingInProgress'") || workbench.includes('Packing'))
check('workbench tab ready_to_pack', workbench.includes("'ready_to_pack'"))
check('workbench tab packing', workbench.includes("'packing'"))
check('workbench tab packed', workbench.includes("'packed'"))
check('workbench packing shortages tab', workbench.includes("'packing_shortages'"))

const packingPages = fs.readFileSync(path.join(root, 'src/modules/dispatch/DispatchPackingPages.tsx'), 'utf8')
check('packing register page exists', packingPages.includes('DispatchPackingRegisterPage'))
check('packing detail page exists', packingPages.includes('DispatchPackingDetailPage'))
check('pack mode page exists', packingPages.includes('DispatchPackingPackModePage'))
check('pack mode Create Package', packingPages.includes('Create Package'))
check('pack mode lotRef field', packingPages.includes('lotRef'))
check('no challan create action', !packingPages.match(/Create.*Challan/i))

const detail = fs.readFileSync(path.join(root, 'src/modules/dispatch/ApiOutboundDispatchPages.tsx'), 'utf8')
check('detail Start Packing CTA', detail.includes('Start Packing'))
check('detail packing sessions link', detail.includes('packing-sessions'))
check('detail Ready for Delivery Challan label', detail.includes('Ready for Delivery Challan'))
check('detail Basic Confirm label', detail.includes('Basic Confirm (7C0)'))

const nav = fs.readFileSync(path.join(root, 'src/config/navigation.ts'), 'utf8')
check('nav has Packing Sessions', nav.includes("path: '/dispatch/packing-sessions'"))

const pkg = fs.readFileSync(path.join(root, 'package.json'), 'utf8')
check('package.json test:dispatch-phase7c3 script', pkg.includes('test:dispatch-phase7c3'))

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
