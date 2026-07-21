import * as api from '@/services/api/treasuryApi'
import type {
  AcceptSuggestionInput,
  AutoMatchRunResultDto,
  BankReconciliationMatchDto,
  CandidatesForLineDto,
  CreateAdjustmentDraftInput,
  CreateExceptionInput,
  CreateMatchInput,
  ExceptionDto,
  FinalizeSessionInput,
  ListExceptionsQuery,
  ListHistoryQuery,
  ListSessionsQuery,
  MatchPreviewResultDto,
  Paginated,
  PreviewMatchInput,
  ReconciliationWorkspaceDto,
  RejectSuggestionInput,
  ReopenSessionInput,
  ResolveExceptionInput,
  RunAutoMatchInput,
  SessionDto,
  SessionSummaryDto,
  SuggestionDto,
  UnmatchInput,
} from './bank-reconciliation.types'

function unwrap<T>(res: { data: T }): T {
  return res.data
}

export async function fetchReconciliationSessions(query: ListSessionsQuery): Promise<Paginated<SessionDto>> {
  return api.listReconciliationSessions(query)
}

export async function fetchReconciliationHistory(query: ListHistoryQuery): Promise<Paginated<SessionDto>> {
  return api.listReconciliationHistory(query)
}

export async function fetchReconciliationExceptionsGlobal(query: ListExceptionsQuery): Promise<Paginated<ExceptionDto>> {
  return api.listReconciliationExceptionsGlobal(query)
}

export async function createException(data: CreateExceptionInput): Promise<ExceptionDto> {
  return unwrap(await api.createReconciliationException(data))
}

export async function resolveException(exceptionId: string, data: ResolveExceptionInput): Promise<ExceptionDto> {
  return unwrap(await api.resolveReconciliationException(exceptionId, data))
}

export async function acceptSuggestion(suggestionId: string, data: AcceptSuggestionInput): Promise<BankReconciliationMatchDto> {
  return unwrap(await api.acceptReconciliationSuggestion(suggestionId, data))
}

export async function rejectSuggestion(suggestionId: string, data: RejectSuggestionInput): Promise<SuggestionDto> {
  return unwrap(await api.rejectReconciliationSuggestion(suggestionId, data))
}

export async function previewMatch(data: PreviewMatchInput): Promise<MatchPreviewResultDto> {
  return unwrap(await api.previewReconciliationMatch(data))
}

export async function createMatch(data: CreateMatchInput): Promise<BankReconciliationMatchDto> {
  return unwrap(await api.createReconciliationMatch(data))
}

export async function fetchMatch(matchId: string): Promise<BankReconciliationMatchDto> {
  return unwrap(await api.getReconciliationMatch(matchId))
}

export async function unmatch(matchId: string, data: UnmatchInput): Promise<BankReconciliationMatchDto> {
  return unwrap(await api.unmatchReconciliationMatch(matchId, data))
}

export async function fetchWorkspace(statementId: string): Promise<ReconciliationWorkspaceDto> {
  return unwrap(await api.getReconciliationWorkspace(statementId))
}

export async function fetchSummary(statementId: string): Promise<SessionSummaryDto> {
  return unwrap(await api.getReconciliationSummary(statementId))
}

export async function runAutoMatch(statementId: string, data: RunAutoMatchInput): Promise<AutoMatchRunResultDto> {
  return unwrap(await api.runReconciliationAutoMatch(statementId, data))
}

export async function fetchSuggestionsForStatement(statementId: string): Promise<SuggestionDto[]> {
  return unwrap(await api.listReconciliationSuggestionsForStatement(statementId))
}

export async function fetchExceptionsForStatement(statementId: string): Promise<ExceptionDto[]> {
  return unwrap(await api.listReconciliationExceptionsForStatement(statementId))
}

export async function finalizeSession(statementId: string, data: FinalizeSessionInput): Promise<SessionDto> {
  return unwrap(await api.finalizeReconciliationSession(statementId, data))
}

export async function reopenSession(statementId: string, data: ReopenSessionInput): Promise<SessionDto> {
  return unwrap(await api.reopenReconciliationSession(statementId, data))
}

export async function fetchCandidatesForLine(statementId: string, lineId: string): Promise<CandidatesForLineDto> {
  return unwrap(await api.getReconciliationCandidatesForLine(statementId, lineId))
}

export async function createAdjustmentDraft(statementId: string, lineId: string, data: CreateAdjustmentDraftInput): Promise<unknown> {
  return unwrap(await api.createReconciliationAdjustmentDraft(statementId, lineId, data))
}
