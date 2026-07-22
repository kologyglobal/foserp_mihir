/**
 * Dispatch Phase 7C0 smoke — API client + dual-mode routes (static).
 * npx tsx scripts/test-dispatch-phase7c0.ts
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
check('dispatchApi exports listOutboundDispatches', dispatchApi.includes('export async function listOutboundDispatches'))
check('dispatchApi exports confirmOutboundDispatch', dispatchApi.includes('export async function confirmOutboundDispatch'))
check('dispatchApi exports getSalesOrderFulfilment', dispatchApi.includes('export async function getSalesOrderFulfilment'))

const routes = fs.readFileSync(path.join(root, 'src/routes/dispatchFinanceRoutes.tsx'), 'utf8')
check('dispatch routes API register', routes.includes('ApiOutboundDispatchRegisterPage') && routes.includes('isApiMode()'))
check('dispatch routes API detail', routes.includes('ApiOutboundDispatchDetailPage'))

const pages = fs.readFileSync(path.join(root, 'src/modules/dispatch/ApiOutboundDispatchPages.tsx'), 'utf8')
check('ApiOutboundDispatchPages confirm CTA', pages.includes('Confirm stock-out') || pages.includes('Basic Confirm'))
check('ApiOutboundDispatchPages fulfilment panel', pages.includes('SO fulfilment'))

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
