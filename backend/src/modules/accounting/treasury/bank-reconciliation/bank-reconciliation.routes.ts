import { Router } from 'express'
import { authenticate } from '../../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../../middleware/permission.middleware.js'
import { requireTenantAccess, resolveTenant } from '../../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema } from '../../../../utils/pagination.js'
import * as controller from './bank-reconciliation.controller.js'
import {
  acceptSuggestionBodySchema,
  createAdjustmentDraftBodySchema,
  createExceptionBodySchema,
  createMatchBodySchema,
  exceptionIdParamSchema,
  finalizeSessionBodySchema,
  listExceptionsQuerySchema,
  listHistoryQuerySchema,
  listSessionsQuerySchema,
  matchIdParamSchema,
  previewMatchBodySchema,
  rejectSuggestionBodySchema,
  reopenSessionBodySchema,
  resolveExceptionBodySchema,
  runAutoMatchBodySchema,
  statementIdParamSchema,
  statementLineParamSchema,
  suggestionIdParamSchema,
  unmatchBodySchema,
} from './bank-reconciliation.schemas.js'

const router = Router({ mergeParams: true })
router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)

const VIEW = 'finance.bank.reconciliation.view'

// ─── Global (session-list / history / exceptions) ──────────────────────────────

router.get('/bank-reconciliation', requirePermission(VIEW), validateQuery(listSessionsQuerySchema), controller.listSessions)
router.get('/bank-reconciliation/history', requirePermission(VIEW), validateQuery(listHistoryQuerySchema), controller.listHistory)
router.get('/bank-reconciliation/exceptions', requirePermission(VIEW), validateQuery(listExceptionsQuerySchema), controller.listExceptionsGlobal)
router.post(
  '/bank-reconciliation/exceptions',
  requirePermission('finance.bank.reconciliation.exception_manage'),
  validateBody(createExceptionBodySchema),
  controller.createException,
)
router.post(
  '/bank-reconciliation/exceptions/:exceptionId/resolve',
  validateParams(exceptionIdParamSchema),
  requirePermission('finance.bank.reconciliation.exception_manage'),
  validateBody(resolveExceptionBodySchema),
  controller.resolveExceptionHandler,
)

// ─── Suggestions (accept / reject) ─────────────────────────────────────────────

router.post(
  '/bank-reconciliation/suggestions/:suggestionId/accept',
  validateParams(suggestionIdParamSchema),
  requirePermission('finance.bank.reconciliation.match'),
  validateBody(acceptSuggestionBodySchema),
  controller.acceptSuggestionHandler,
)
router.post(
  '/bank-reconciliation/suggestions/:suggestionId/reject',
  validateParams(suggestionIdParamSchema),
  requirePermission('finance.bank.reconciliation.match'),
  validateBody(rejectSuggestionBodySchema),
  controller.rejectSuggestionHandler,
)

// ─── Preview / matches / unmatch ────────────────────────────────────────────────

router.post(
  '/bank-reconciliation/preview',
  requirePermission(VIEW),
  validateBody(previewMatchBodySchema),
  controller.previewMatchHandler,
)
router.post(
  '/bank-reconciliation/matches',
  requirePermission('finance.bank.reconciliation.match'),
  validateBody(createMatchBodySchema),
  controller.createMatchHandler,
)
router.get(
  '/bank-reconciliation/matches/:matchId',
  validateParams(matchIdParamSchema),
  requirePermission(VIEW),
  controller.getMatchHandler,
)
router.post(
  '/bank-reconciliation/matches/:matchId/unmatch',
  validateParams(matchIdParamSchema),
  requirePermission('finance.bank.reconciliation.unmatch'),
  validateBody(unmatchBodySchema),
  controller.unmatchHandler,
)

// ─── Statement-scoped workspace ────────────────────────────────────────────────

router.get(
  '/bank-statements/:statementId/reconciliation',
  validateParams(statementIdParamSchema),
  requirePermission(VIEW),
  controller.getWorkspace,
)
router.get(
  '/bank-statements/:statementId/reconciliation/summary',
  validateParams(statementIdParamSchema),
  requirePermission(VIEW),
  controller.getSummary,
)
router.post(
  '/bank-statements/:statementId/reconciliation/run-auto-match',
  validateParams(statementIdParamSchema),
  requirePermission('finance.bank.reconciliation.run_auto_match'),
  validateBody(runAutoMatchBodySchema),
  controller.runAutoMatchHandler,
)
router.get(
  '/bank-statements/:statementId/reconciliation/suggestions',
  validateParams(statementIdParamSchema),
  requirePermission(VIEW),
  controller.listSuggestionsForStatement,
)
router.get(
  '/bank-statements/:statementId/reconciliation/exceptions',
  validateParams(statementIdParamSchema),
  requirePermission(VIEW),
  controller.listExceptionsForStatementHandler,
)
router.post(
  '/bank-statements/:statementId/reconciliation/finalize',
  validateParams(statementIdParamSchema),
  requirePermission('finance.bank.reconciliation.finalize'),
  validateBody(finalizeSessionBodySchema),
  controller.finalizeSessionHandler,
)
router.post(
  '/bank-statements/:statementId/reconciliation/reopen',
  validateParams(statementIdParamSchema),
  requirePermission('finance.bank.reconciliation.reopen'),
  validateBody(reopenSessionBodySchema),
  controller.reopenSessionHandler,
)

router.get(
  '/bank-statements/:statementId/lines/:lineId/reconciliation-candidates',
  validateParams(statementLineParamSchema),
  requirePermission(VIEW),
  controller.listCandidatesForLine,
)
router.post(
  '/bank-statements/:statementId/lines/:lineId/create-journal-draft',
  validateParams(statementLineParamSchema),
  requirePermission('finance.bank.reconciliation.adjustment_draft_create'),
  validateBody(createAdjustmentDraftBodySchema),
  controller.createAdjustmentDraft,
)

export default router
