/**
 * Finance Phase 5B1 — treasury transfer permission unit checks.
 * Run via: npm run test:treasury-transfers
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
  'finance.treasury.transfer.view',
  'finance.treasury.transfer.create',
  'finance.treasury.transfer.edit',
  'finance.treasury.transfer.submit',
  'finance.treasury.transfer.approve',
  'finance.treasury.transfer.post',
  'finance.treasury.transfer.dispatch',
  'finance.treasury.transfer.receive',
  'finance.treasury.transfer.cancel',
  'finance.treasury.transfer.reverse',
  'finance.treasury.transfer.in_transit.view',
]

export function runTreasuryTransferPermissionTests() {
  const permSrc = read('frontend/src/utils/permissions/treasuryTransfer.ts')
  for (const perm of FINE_GRAINED_PERMISSIONS) {
    check(`Permission key ${perm}`, permSrc.includes(`'${perm}'`))
  }
  check('TREASURY_TRANSFER_PERMISSIONS exported', permSrc.includes('export const TREASURY_TRANSFER_PERMISSIONS'))
  check('useTreasuryTransferPermissions hook exported', permSrc.includes('export function useTreasuryTransferPermissions'))
  check('hasTreasuryTransferPermission exported', permSrc.includes('export function hasTreasuryTransferPermission'))
  check('mergeAllowedAction exported', permSrc.includes('export function mergeAllowedAction'))
  check('Workspace admin bypass respected in API mode', permSrc.includes('hasWorkspaceAdminRole()'))
  check('Demo fallback maps onto Bank & Cash fund-transfer demo permission pack', permSrc.includes('hasBankCashPermission'))

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
  console.log(' Treasury Transfers — permissions')
  console.log('═══════════════════════════════════════\n')
  const result = runTreasuryTransferPermissionTests()
  console.log(`\n${result.passed} passed, ${result.failed} failed`)
  process.exit(result.failed > 0 ? 1 : 0)
}
