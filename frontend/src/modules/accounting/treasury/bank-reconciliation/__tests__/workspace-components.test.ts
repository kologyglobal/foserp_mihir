/**
 * Phase 5A3 — reconciliation workspace component wiring checks (manual match, clearing preview,
 * suggestions, exceptions, finalize/reopen, unmatch, mobile responsiveness).
 * Source-string checks (no React test renderer in this repo's lightweight harness) — mirrors
 * the pattern used by bank-statements/__tests__/import-wizard-ux.test.ts.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..', '..')

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

const MOD = 'src/modules/accounting/treasury/bank-reconciliation'

export function runWorkspaceComponentTests() {
  // Manual / grouped / partial match drawer
  const drawer = read(`${MOD}/components/ManualMatchDrawer.tsx`)
  check('Manual match drawer requires balanced totals before preview', drawer.includes('amountsBalanced'))
  check('Manual match drawer gates grouped matches on permission', drawer.includes('canGroupMatch'))
  check('Manual match drawer gates partial matches on permission', drawer.includes('canPartialMatch'))
  check('Manual match drawer previews before confirming', drawer.includes('runPreview') && drawer.includes('runConfirm'))
  check('Manual match drawer disables confirm until preview exists', drawer.includes('disabled={!preview}'))
  check('Manual match drawer uses idempotency key on confirm', drawer.includes('resolveIdempotencyKey()'))
  check('Manual match drawer surfaces idempotent replay message', drawer.includes('idempotentReplay'))

  // Clearing preview panel — posting impact before confirmation
  const clearingPanel = read(`${MOD}/components/ClearingPreviewPanel.tsx`)
  check('Clearing preview shows settlement entries for clearing matches', clearingPanel.includes('CLEARING_SETTLEMENT'))
  check('Clearing preview shows debit/credit columns', clearingPanel.includes('Debit') && clearingPanel.includes('Credit'))
  check(
    'Direct match preview confirms no new accounting entries',
    clearingPanel.includes('no new accounting entries will be created'),
  )
  check('Clearing preview surfaces warnings', clearingPanel.includes('preview.warnings'))

  // Candidate table — direct vs clearing GL candidate selection
  const candidateTable = read(`${MOD}/components/CandidateTable.tsx`)
  check('Candidate table supports amount allocation editing', candidateTable.includes('onAmountChange'))
  check('Candidate table supports toggle selection', candidateTable.includes('onToggle'))

  // Suggestion accept/reject
  const suggestionTable = read(`${MOD}/components/SuggestionTable.tsx`)
  check('Suggestion table gates accept on permission', suggestionTable.includes('canAccept'))
  check('Suggestion table gates reject on permission', suggestionTable.includes('canReject'))
  check('Suggestion table only allows actions while pending', suggestionTable.includes("s.status === 'PENDING'"))

  // Exceptions
  const exceptionTable = read(`${MOD}/components/ExceptionTable.tsx`)
  check('Exception table gates resolve on permission', exceptionTable.includes('canResolve'))
  check('Exception table only allows resolving open exceptions', exceptionTable.includes("ex.status === 'OPEN'"))

  // Finalization / reopen
  const checklist = read(`${MOD}/components/FinalizationChecklist.tsx`)
  check('Finalize disabled until all lines resolved', checklist.includes('disabled={!allMatched}'))
  check('Finalize-with-exceptions available as override path', checklist.includes('finalizeWithExceptions'))
  check('Reopen requires a reason', checklist.includes('disabled={!reopenReason.trim()}'))
  check('Checklist surfaces open exception count', checklist.includes('openExceptionCount'))
  check('Checklist surfaces pending suggestion count', checklist.includes('pendingSuggestionCount'))

  // Difference panel
  const diffPanel = read(`${MOD}/components/DifferencePanel.tsx`)
  check('Difference panel component exists', diffPanel.length > 0)

  // Mobile responsiveness — statement line register
  const lineTable = read(`${MOD}/components/StatementLineReconTable.tsx`)
  check('Statement line table uses a mobile media query', lineTable.includes('useMediaQuery(MQ_MOBILE)'))
  check('Statement line table renders stacked cards on mobile', lineTable.includes('isMobile'))
  check('Statement line table exposes accessible checkboxes', lineTable.includes('aria-label={`Select line'))
  check('Statement line table exposes direction as text label (a11y)', lineTable.includes('DirectionLabel'))

  // Status chips — text labels for a11y, not color-only
  const chips = read(`${MOD}/components/BankReconciliationStatusChip.tsx`)
  check('Direction rendered as accessible text label', chips.includes('DirectionLabel'))
  check('Confidence rendered as a labeled chip', chips.includes('ConfidenceChip'))

  // Match detail — unmatch confirmation + clearing reversal messaging
  const matchDetail = read(`${MOD}/pages/ReconciliationMatchDetailPage.tsx`)
  check('Match detail gates unmatch on permission + allowed action', matchDetail.includes('canUnmatch'))
  check('Match detail explains clearing reversal before unmatch', matchDetail.includes('exact reversal of the clearing settlement'))
  check('Match detail uses idempotency key on unmatch', matchDetail.includes('resolveKey()'))
  check('Match detail shows reversed banner', matchDetail.includes("match.matchStatus === 'REVERSED'"))

  // Workspace page — command bar wired to allowedActions from the server
  const workspacePage = read(`${MOD}/pages/ReconciliationWorkspacePage.api.tsx`)
  check('Workspace command bar gates Run Auto Match', workspacePage.includes('canRunAutoMatch'))
  check('Workspace command bar gates Manual Match on selection', workspacePage.includes('selectedLines.length === 0'))
  check('Workspace gates Report Exception to exactly one selected line', workspacePage.includes('selectedLines.length !== 1'))
  check('Workspace surfaces loading/empty/error states', workspacePage.includes('LoadingState') && workspacePage.includes('error ??'))
  check('Workspace uses idempotency key for auto-match', workspacePage.includes('resolveAutoMatchKey()'))
  check('Workspace uses idempotency key for finalize', workspacePage.includes('resolveFinalizeKey()'))

  // List / history / exceptions pages
  const listPage = read(`${MOD}/pages/ReconciliationListPage.api.tsx`)
  check('List page filters by bank account', listPage.includes('treasuryAccountId'))
  check('List page filters by status', listPage.includes('STATUS_OPTIONS'))
  check('List page links into workspace by bankStatementId', listPage.includes('row.bankStatementId'))

  const historyPage = read(`${MOD}/pages/ReconciliationHistoryPage.tsx`)
  check('History page requires API mode', historyPage.includes('isApiMode()'))
  check('History page gates on view permission', historyPage.includes('perms.canView'))

  const exceptionsPage = read(`${MOD}/pages/ReconciliationExceptionsPage.tsx`)
  check('Exceptions page defaults to open exceptions', exceptionsPage.includes("useState<'' | 'OPEN' | 'RESOLVED'>('OPEN')"))
  check('Exceptions page wires resolve action', exceptionsPage.includes('onResolve'))

  return { passed, failed }
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` || process.argv[1]?.endsWith('workspace-components.test.ts')) {
  console.log('═══════════════════════════════════════')
  console.log(' Bank Reconciliation — workspace components')
  console.log('═══════════════════════════════════════\n')
  const result = runWorkspaceComponentTests()
  console.log(`\n${result.passed} passed, ${result.failed} failed`)
  process.exit(result.failed > 0 ? 1 : 0)
}
