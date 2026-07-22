/**
 * Dispatch Phase 7C1 smoke — API client + workbench dual-mode routes (static).
 * npx tsx scripts/test-dispatch-phase7c1.ts
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
check('dispatchApi exports getDispatchWorkbenchSummary', dispatchApi.includes('export async function getDispatchWorkbenchSummary'))
check('dispatchApi exports listDispatchRequirements', dispatchApi.includes('export async function listDispatchRequirements'))
check('dispatchApi exports createDraftDispatchFromRequirements', dispatchApi.includes('export async function createDraftDispatchFromRequirements'))
check('dispatchApi exports getSalesOrderDispatchRequirements', dispatchApi.includes('export async function getSalesOrderDispatchRequirements'))

const routes = fs.readFileSync(path.join(root, 'src/routes/dispatchFinanceRoutes.tsx'), 'utf8')
check('dispatch routes workbench API page', routes.includes('DispatchWorkbenchPage') && routes.includes('dispatch/workbench'))
check('dispatch root uses workbench in API mode', routes.includes("path: 'dispatch'") && routes.includes('isApiMode()'))

const workbench = fs.readFileSync(path.join(root, 'src/modules/dispatch/DispatchWorkbenchPage.tsx'), 'utf8')
check('workbench creates draft from requirements', workbench.includes('createDraftDispatchFromRequirements'))
check('workbench does not call confirm as primary action', !workbench.includes('confirmOutboundDispatch'))

const register = fs.readFileSync(path.join(root, 'src/modules/dispatch/ApiOutboundDispatchPages.tsx'), 'utf8')
check('register no longer links Demo plan', !register.includes('Demo plan'))
check('register links Workbench', register.includes("navigate('/dispatch/workbench')"))

const so360 = fs.readFileSync(path.join(root, 'src/modules/sales/SalesOrder360Page.tsx'), 'utf8')
check('SO 360 uses API fulfilment panel in API mode', so360.includes('SalesOrderDispatchFulfilmentPanel') && so360.includes('isApiMode()'))

const nav = fs.readFileSync(path.join(root, 'src/config/navigation.ts'), 'utf8')
check('nav has Dispatch Workbench', nav.includes("path: '/dispatch/workbench'"))

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
