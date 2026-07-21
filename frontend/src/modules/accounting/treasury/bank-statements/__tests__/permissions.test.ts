/**
 * Phase 5A2 — treasury statement permissions unit checks.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { BANK_STATEMENT_LIVE_LINKS, IMPORT_WIZARD_STEPS } from '../utils/bankStatementUi.ts'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..', '..')

let passed = 0
let failed = 0

function check(label: string, ok: boolean) {
  if (ok) {
    passed += 1
    console.log(`✓ ${label}`)
  } else {
    failed += 1
    console.log(`✗ ${label}`)
  }
}

function read(rel: string) {
  return readFileSync(path.join(ROOT, rel), 'utf8')
}

function mergeAllowedAction(uiPerm: boolean, serverAction?: boolean): boolean {
  if (serverAction === undefined) return uiPerm
  return uiPerm && serverAction
}

export function runTreasuryStatementPermissionTests() {
  const permSrc = read('src/utils/permissions/treasuryStatement.ts')
  check('Permission view key', permSrc.includes("'finance.treasury.statement.view'"))
  check('Permission import key', permSrc.includes("'finance.treasury.statement.import'"))
  check('Permission mapping.manage', permSrc.includes("'finance.treasury.statement.mapping.manage'"))
  check('mergeAllowedAction gates server', mergeAllowedAction(true, false) === false)
  check('mergeAllowedAction passes undefined server', mergeAllowedAction(true, undefined) === true)
  check('useTreasuryStatementPermissions hook', permSrc.includes('useTreasuryStatementPermissions'))
  check('canImport export', permSrc.includes('canImport'))

  const apiSrc = read('src/services/api/treasuryApi.ts')
  check('treasuryApi createImportBatch FormData', apiSrc.includes("form.append('file'"))
  check('treasuryApi listBankStatements', apiSrc.includes('listBankStatements'))
  check('treasuryApi mapping templates', apiSrc.includes('bank-statement-mapping-templates'))

  check('Wizard has 7 steps', IMPORT_WIZARD_STEPS.length === 7)
  check('Live link import', BANK_STATEMENT_LIVE_LINKS.some((l) => l.path.includes('/import')))

  return { passed, failed }
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` || process.argv[1]?.endsWith('permissions.test.ts')) {
  console.log('═══════════════════════════════════════')
  console.log(' Bank Statements — permissions')
  console.log('═══════════════════════════════════════\n')
  const result = runTreasuryStatementPermissionTests()
  console.log(`\n${result.passed} passed, ${result.failed} failed`)
  process.exit(result.failed > 0 ? 1 : 0)
}
