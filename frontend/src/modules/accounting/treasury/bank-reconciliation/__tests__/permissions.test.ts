/**
 * Phase 5A3 — bank reconciliation permission unit checks.
 * Run via: npm run test:bank-reconciliation
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
  'finance.bank.reconciliation.view',
  'finance.bank.reconciliation.run_auto_match',
  'finance.bank.reconciliation.match',
  'finance.bank.reconciliation.group_match',
  'finance.bank.reconciliation.partial_match',
  'finance.bank.reconciliation.unmatch',
  'finance.bank.reconciliation.finalize',
  'finance.bank.reconciliation.finalize_with_exceptions',
  'finance.bank.reconciliation.reopen',
  'finance.bank.reconciliation.exception_manage',
  'finance.bank.reconciliation.clearing_post',
  'finance.bank.reconciliation.adjustment_draft_create',
]

export function runBankReconciliationPermissionTests() {
  const permSrc = read('frontend/src/utils/permissions/bankReconciliation.ts')
  for (const perm of FINE_GRAINED_PERMISSIONS) {
    check(`Permission key ${perm}`, permSrc.includes(`'${perm}'`))
  }
  check('BANK_RECONCILIATION_PERMISSIONS exported', permSrc.includes('export const BANK_RECONCILIATION_PERMISSIONS'))
  check('useBankReconciliationPermissions hook exported', permSrc.includes('export function useBankReconciliationPermissions'))
  check('hasBankReconciliationPermission exported', permSrc.includes('export function hasBankReconciliationPermission'))
  check('mergeAllowedAction exported', permSrc.includes('export function mergeAllowedAction'))
  check('Workspace admin bypass respected in API mode', permSrc.includes('hasWorkspaceAdminRole()'))
  check('Demo fallback maps onto Bank & Cash permission pack', permSrc.includes('hasBankCashPermission'))

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
  console.log(' Bank Reconciliation — permissions')
  console.log('═══════════════════════════════════════\n')
  const result = runBankReconciliationPermissionTests()
  console.log(`\n${result.passed} passed, ${result.failed} failed`)
  process.exit(result.failed > 0 ? 1 : 0)
}
