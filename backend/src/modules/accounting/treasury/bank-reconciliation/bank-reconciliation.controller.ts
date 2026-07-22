import type { Request, Response } from 'express'
import { auditFromRequest } from '../../../../services/audit.service.js'
import { getRouteParam, getTenantId } from '../../../../types/request-context.js'
import { asyncHandler } from '../../../../utils/asyncHandler.js'
import { sendCreated, sendSuccess } from '../../../../utils/response.js'
import { buildMatchAllowedActions, buildSessionAllowedActions } from './bank-reconciliation-allowed-actions.service.js'
import { createAdjustmentDraftForLine } from './bank-reconciliation-adjustment-draft.service.js'
import { runAutoMatch } from './bank-reconciliation-auto-match.service.js'
import { createExceptionForStatement, listExceptionsForStatement, resolveException } from './bank-reconciliation-exception.service.js'
import { finalizeSession, reopenSession } from './bank-reconciliation-finalize.service.js'
import { createMatch, getMatch } from './bank-reconciliation-match.service.js'
import { previewMatch } from './bank-reconciliation-preview.service.js'
import * as readSvc from './bank-reconciliation-read.service.js'
import * as readRepo from './bank-reconciliation-read.repository.js'
import { getOrCreateSession } from './bank-reconciliation-session.service.js'
import { acceptSuggestion, generateSuggestionsForSession, listPendingSuggestions, rejectSuggestion } from './bank-reconciliation-suggestion.service.js'
import { unmatch } from './bank-reconciliation-unmatch.service.js'
import type { ReconciliationContext } from './bank-reconciliation.types.js'

function buildContext(req: Request, tenantId: string): ReconciliationContext {
  const audit = auditFromRequest(req)
  return {
    tenantId,
    userId: req.context?.userId ?? '',
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  }
}

// ─── Sessions / history / exceptions (global) ──────────────────────────────────

export const listSessions = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const result = await readSvc.listSessions(tenantId, req.query as never)
  return sendSuccess(res, 'bank reconciliation sessions listed', result.items, 200, result.meta)
})

export const listHistory = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const result = await readSvc.listHistory(tenantId, req.query as never)
  return sendSuccess(res, 'bank reconciliation history listed', result.items, 200, result.meta)
})

export const listExceptionsGlobal = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const result = await readSvc.listExceptions(tenantId, req.query as never)
  return sendSuccess(res, 'bank reconciliation exceptions listed', result.items, 200, result.meta)
})

// ─── Statement-scoped workspace ────────────────────────────────────────────────

export const getWorkspace = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const statementId = getRouteParam(req, 'statementId')
  const userId = req.context?.userId ?? ''
  const workspace = await readSvc.getWorkspace(tenantId, userId, statementId)
  const allowedActions = buildSessionAllowedActions(req, workspace.session.status)
  return sendSuccess(res, 'bank reconciliation workspace fetched', { ...workspace, allowedActions })
})

export const getSummary = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const statementId = getRouteParam(req, 'statementId')
  const summary = await readSvc.getSummary(tenantId, statementId)
  const allowedActions = buildSessionAllowedActions(req, summary.status)
  return sendSuccess(res, 'bank reconciliation summary fetched', { ...summary, allowedActions })
})

export const runAutoMatchHandler = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const statementId = getRouteParam(req, 'statementId')
  const userId = req.context?.userId ?? ''
  const statement = await readRepo.getStatementOrThrow(tenantId, statementId)
  const session = await getOrCreateSession(tenantId, userId, statementId)
  const context = buildContext(req, tenantId)
  const result = await runAutoMatch(tenantId, statement, session, context)
  return sendSuccess(res, 'bank reconciliation auto-match run complete', result)
})

export const listSuggestionsForStatement = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const statementId = getRouteParam(req, 'statementId')
  const userId = req.context?.userId ?? ''
  const statement = await readRepo.getStatementOrThrow(tenantId, statementId)
  const session = await getOrCreateSession(tenantId, userId, statementId)
  const generated = await generateSuggestionsForSession(tenantId, statement, session)
  const pending = await listPendingSuggestions(tenantId, session.id)
  const seen = new Set(pending.map((s) => s.id))
  const items = [...pending, ...generated.filter((s) => !seen.has(s.id))]
  return sendSuccess(res, 'bank reconciliation suggestions listed', items)
})

export const listCandidatesForLine = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const statementId = getRouteParam(req, 'statementId')
  const lineId = getRouteParam(req, 'lineId')
  const candidates = await readSvc.listCandidatesForLine(tenantId, statementId, lineId)
  return sendSuccess(res, 'bank reconciliation candidates fetched', candidates)
})

export const createAdjustmentDraft = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const statementId = getRouteParam(req, 'statementId')
  const lineId = getRouteParam(req, 'lineId')
  const context = buildContext(req, tenantId)
  const journal = await createAdjustmentDraftForLine(req, tenantId, statementId, lineId, req.body, context)
  return sendCreated(res, 'bank statement adjustment journal draft created', journal)
})

export const finalizeSessionHandler = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const statementId = getRouteParam(req, 'statementId')
  const context = buildContext(req, tenantId)
  const session = await finalizeSession(tenantId, statementId, context, Boolean(req.body?.force))
  return sendSuccess(res, 'bank reconciliation session finalized', session)
})

export const reopenSessionHandler = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const statementId = getRouteParam(req, 'statementId')
  const context = buildContext(req, tenantId)
  const session = await reopenSession(tenantId, statementId, req.body.reason, context)
  return sendSuccess(res, 'bank reconciliation session reopened', session)
})

// ─── Suggestions (accept / reject) ─────────────────────────────────────────────

export const acceptSuggestionHandler = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const suggestionId = getRouteParam(req, 'suggestionId')
  const context = buildContext(req, tenantId)
  const match = await acceptSuggestion(tenantId, suggestionId, req.body.idempotencyKey, context)
  return sendCreated(res, 'bank reconciliation suggestion accepted', match)
})

export const rejectSuggestionHandler = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const suggestionId = getRouteParam(req, 'suggestionId')
  const context = buildContext(req, tenantId)
  const suggestion = await rejectSuggestion(tenantId, suggestionId, req.body?.reason, context)
  return sendSuccess(res, 'bank reconciliation suggestion rejected', suggestion)
})

// ─── Preview / matches / unmatch ────────────────────────────────────────────────

export const previewMatchHandler = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const preview = await previewMatch(tenantId, req.body)
  return sendSuccess(res, 'bank reconciliation match previewed', preview)
})

export const createMatchHandler = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const context = buildContext(req, tenantId)
  const match = await createMatch(tenantId, req.body, context)
  return sendCreated(res, 'bank reconciliation match created', match)
})

export const getMatchHandler = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const matchId = getRouteParam(req, 'matchId')
  const match = await getMatch(tenantId, matchId)
  const allowedActions = buildMatchAllowedActions(req, match.matchStatus)
  return sendSuccess(res, 'bank reconciliation match fetched', { ...match, allowedActions })
})

export const unmatchHandler = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const matchId = getRouteParam(req, 'matchId')
  const context = buildContext(req, tenantId)
  const match = await unmatch(tenantId, matchId, req.body.reason, context)
  return sendSuccess(res, 'bank reconciliation match unmatched', match)
})

// ─── Exceptions (statement-scoped create) ──────────────────────────────────────

export const createException = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const statementId = req.body.statementId as string
  const context = buildContext(req, tenantId)
  const exception = await createExceptionForStatement(tenantId, statementId, req.body, context)
  return sendCreated(res, 'bank reconciliation exception created', exception)
})

export const resolveExceptionHandler = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const exceptionId = getRouteParam(req, 'exceptionId')
  const context = buildContext(req, tenantId)
  const exception = await resolveException(tenantId, exceptionId, req.body, context)
  return sendSuccess(res, 'bank reconciliation exception resolved', exception)
})

export const listExceptionsForStatementHandler = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const statementId = getRouteParam(req, 'statementId')
  const exceptions = await listExceptionsForStatement(tenantId, statementId)
  return sendSuccess(res, 'bank reconciliation exceptions listed', exceptions)
})
