/**
 * Dispatch Phase 7C5 smoke — hardened post + reverse API client and detail actions.
 * npx tsx scripts/test-dispatch-phase7c5.ts
 */
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const repoRoot = path.resolve(root, '..')
let pass = 0
let fail = 0

function check(label: string, ok: boolean) {
  console.log(`${ok ? '✓' : '✗'} ${label}`)
  ok ? pass++ : fail++
}

const dispatchApi = fs.readFileSync(path.join(root, 'src/services/api/dispatchApi.ts'), 'utf8')
check('dispatchApi exports postOutboundDispatch', dispatchApi.includes('export async function postOutboundDispatch'))
check('dispatchApi exports reverseOutboundDispatch', dispatchApi.includes('export async function reverseOutboundDispatch'))
check('dispatchApi status includes REVERSED', dispatchApi.includes("'REVERSED'"))
check('dispatchApi keeps confirmOutboundDispatch (7C0 bridge)', dispatchApi.includes('export async function confirmOutboundDispatch'))

const detail = fs.readFileSync(path.join(root, 'src/modules/dispatch/ApiOutboundDispatchPages.tsx'), 'utf8')
check('detail page imports postOutboundDispatch', detail.includes('postOutboundDispatch'))
check('detail page imports reverseOutboundDispatch', detail.includes('reverseOutboundDispatch'))
check('detail page offers Post Dispatch (7C5) for workbench', detail.includes('Post Dispatch (7C5)'))
check('detail page offers Reverse (7C5)', detail.includes('Reverse (7C5)'))

const routes = fs.readFileSync(
  path.join(repoRoot, 'backend/src/modules/dispatch/outbound/outbound-dispatch.routes.ts'),
  'utf8',
)
check('backend route POST /:id/post', routes.includes("'/:id/post'"))
check('backend route POST /:id/reverse', routes.includes("'/:id/reverse'"))

const migration = fs.existsSync(
  path.join(
    repoRoot,
    'backend/prisma/migrations/20260722030000_dispatch_phase7c5_hardened_posting/migration.sql',
  ),
)
check('7C5 migration exists', migration)

const pkg = fs.readFileSync(path.join(root, 'package.json'), 'utf8')
check('package.json test:dispatch-phase7c5 script', pkg.includes('test:dispatch-phase7c5'))

const beTest = fs.existsSync(path.join(repoRoot, 'backend/tests/dispatch-phase7c5.test.ts'))
check('backend live test dispatch-phase7c5.test.ts exists', beTest)

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
