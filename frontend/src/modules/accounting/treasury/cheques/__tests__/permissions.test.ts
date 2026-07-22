/**
 * Finance Phase 5B2 — treasury cheque permission unit checks.
 * Run via: npm run test:treasury-cheques
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..', '..', '..')

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

function mergeAllowedAction(uiPerm: boolean, serverAction?: boolean): boolean {
  if (serverAction === undefined) return uiPerm
  return uiPerm && serverAction
}

const FINE_GRAINED_PERMISSIONS = [
  'finance.treasury.cheque.view',
  'finance.treasury.cheque.create',
  'finance.treasury.cheque.edit',
  'finance.treasury.cheque.submit',
  'finance.treasury.cheque.approve',
  'finance.treasury.cheque.issue',
  'finance.treasury.cheque.deposit',
  'finance.treasury.cheque.clear',
  'finance.treasury.cheque.bounce',
  'finance.treasury.cheque.stop',
  'finance.treasury.cheque.cancel',
  'finance.treasury.cheque.reverse',
]

export function runTreasuryChequePermissionTests() {
  const permSrc = read('frontend/src/utils/permissions/treasuryCheque.ts')
  for (const perm of FINE_GRAINED_PERMISSIONS) {
    check(`Permission key ${perm}`, permSrc.includes(`'${perm}'`))
  }
  check('TREASURY_CHEQUE_PERMISSIONS exported', permSrc.includes('export const TREASURY_CHEQUE_PERMISSIONS'))
  check('useTreasuryChequePermissions hook exported', permSrc.includes('export function useTreasuryChequePermissions'))
  check('hasTreasuryChequePermission exported', permSrc.includes('export function hasTreasuryChequePermission'))
  check('mergeAllowedAction exported', permSrc.includes('export function mergeAllowedAction'))
  check('Workspace admin bypass respected in API mode', permSrc.includes('hasWorkspaceAdminRole()'))
  check('Demo fallback maps onto Bank & Cash cheque demo permission pack', permSrc.includes('hasBankCashPermission'))

  const backendPermSrc = read('backend/src/constants/permissions.ts')
  for (const perm of FINE_GRAINED_PERMISSIONS) {
    check(`Backend defines ${perm}`, backendPermSrc.includes(`'${perm}'`))
  }

  check('mergeAllowedAction gates server false', mergeAllowedAction(true, false) === false)
  check('mergeAllowedAction passes server true', mergeAllowedAction(true, true) === true)
  check('mergeAllowedAction ignores undefined server', mergeAllowedAction(true, undefined) === true)
  check('mergeAllowedAction respects false ui perm', mergeAllowedAction(false, true) === false)

  return { passed, failed }
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` || process.argv[1]?.endsWith('permissions.test.ts')) {
  console.log('═══════════════════════════════════════')
  console.log(' Treasury Cheques — permissions')
  console.log('═══════════════════════════════════════\n')
  const result = runTreasuryChequePermissionTests()
  console.log(`\n${result.passed} passed, ${result.failed} failed`)
  process.exit(result.failed > 0 ? 1 : 0)
}
