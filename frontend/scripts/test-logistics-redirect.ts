/**
 * Logistics alias → Dispatch redirect wiring.
 * npx tsx --tsconfig tsconfig.app.json scripts/test-logistics-redirect.ts
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const read = (rel: string) => readFileSync(path.join(root, rel), 'utf8')

let pass = 0
let fail = 0
function check(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (ok) pass++
  else fail++
}

const logisticsRoutes = read('src/routes/logisticsRoutes.tsx')
const indexRoutes = read('src/routes/index.tsx')
const nav = read('src/config/navigation.ts')
const matrix = read('src/config/permissionMatrix.ts')
const moduleNav = read('src/config/moduleWorkspaceNav.ts')

check('logisticsRoutes.tsx exists with /dispatch Navigate', logisticsRoutes.includes('Navigate to="/dispatch"'))
check('logistics route path registered', logisticsRoutes.includes("path: 'logistics'"))
check('index.tsx imports logisticsRouteChildren', indexRoutes.includes("from './logisticsRoutes'"))
check('index.tsx spreads logisticsRouteChildren', indexRoutes.includes('...logisticsRouteChildren'))
check(
  'navigation maps /logistics → dispatch category',
  nav.includes("pathname.startsWith('/logistics')") && nav.includes("return 'dispatch'"),
)
check('permission matrix covers /logistics', matrix.includes("prefix: '/logistics'"))
check('dispatch category workspace path is /dispatch', nav.includes("path: '/dispatch'") && nav.includes("title: 'Logistics'"))

console.log(`\nResults: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exitCode = 1
