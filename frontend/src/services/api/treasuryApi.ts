import type {
  BankStatementDetail,
  BankStatementListItem,
  CreateManualStatementInput,
  CreateStatementLineInput,
  ExecuteImportBatchInput,
  ImportBatchDto,
  InspectImportBatchInput,
  LifecycleInput,
  ListBankStatementsQuery,
  MappingTemplateDto,
  Paginated,
  PreviewImportBatchInput,
  TreasuryAccountSummary,
  UpdateBankStatementInput,
} from '../../modules/accounting/treasury/bank-statements/api/bank-statement.types'
import type {
  CreateTransferInput,
  DeleteTransferInput,
  LifecycleInput as TransferLifecycleInput,
  ListTransfersQuery,
  ReasonedLifecycleInput,
  ReverseTransferInput,
  TransferReversalPreviewDto,
  TreasuryTransferDto,
  UpdateTransferInput,
} from '../../modules/accounting/treasury/transfers/api/treasury-transfer.types'
import type {
  ApproveChequeInput,
  BounceChequeInput,
  CancelChequeInput,
  ChequePostingResultDto,
  ClearChequeInput,
  CreateChequeInput,
  DepositChequeInput,
  IssueChequeInput,
  ListChequesQuery,
  MarkChequeReadyInput,
  RejectChequeInput,
  ReverseChequeInput,
  ReviseChequeInput,
  StopChequeInput,
  SubmitChequeInput,
  TreasuryChequeDto,
  UpdateChequeInput,
  ValidateChequeResult,
} from '../../modules/accounting/treasury/cheques/api/treasury-cheque.types'
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
} from '../../modules/accounting/treasury/bank-reconciliation/api/bank-reconciliation.types'
import type {
  ApproveAdjustmentInput,
  BankPostingRuleDto,
  CancelAdjustmentInput,
  ClassifyStatementLineInput,
  ClassifyStatementLineResultDto,
  CreateAdjustmentFromStatementLineInput,
  CreateAdjustmentInput,
  CreateBankPostingRuleInput,
  AdjustmentLifecycleInput,
  ListBankPostingRulesQuery,
  ListTreasuryAdjustmentsQuery,
  RejectAdjustmentInput,
  ReverseAdjustmentInput,
  TreasuryAdjustmentDto,
  TreasuryAdjustmentPostingResultDto,
  UpdateAdjustmentInput,
  UpdateBankPostingRuleInput,
  ValidateAdjustmentResult,
} from '../../modules/accounting/treasury/adjustments/api/treasury-adjustment.types'
import type { BookQuery, BookResultDto } from '../../modules/accounting/treasury/books/api/treasury-books.types'
import type {
  CancelStandingInstructionInput,
  CreateStandingInstructionInput,
  GenerateDueDraftsInput,
  GenerationOutcomeDto,
  ListStandingInstructionsQuery,
  PauseStandingInstructionInput,
  ResumeStandingInstructionInput,
  StandingInstructionDto,
  UpdateStandingInstructionInput,
} from '../../modules/accounting/treasury/standing-instructions/api/standing-instruction.types'
import { apiDownloadBlob, apiRequest, tenantPath, type ApiResponse } from './client'

function buildQuery(params?: Record<string, string | number | boolean | undefined | null>): string {
  if (!params) return ''
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v))
  }
  const q = qs.toString()
  return q ? `?${q}` : ''
}

function toPaginated<T>(res: ApiResponse<T[]>, fallbackLimit = 20): Paginated<T> {
  const meta = res.meta ?? { page: 1, limit: fallbackLimit, total: res.data.length, totalPages: 1 }
  return {
    items: res.data,
    page: meta.page,
    limit: meta.limit,
    total: meta.total,
    totalPages: meta.totalPages,
  }
}

const TREASURY = '/accounting/treasury'
const STATEMENTS = `${TREASURY}/bank-statements`
const IMPORT_BATCHES = `${STATEMENTS}/import-batches`
const MAPPING_TEMPLATES = `${TREASURY}/bank-statement-mapping-templates`
const RECONCILIATION = `${TREASURY}/bank-reconciliation`
const TRANSFERS = `${TREASURY}/transfers`
const CHEQUES = `${TREASURY}/cheques`
const ADJUSTMENTS = `${TREASURY}/treasury-adjustments`
const POSTING_RULES = `${TREASURY}/bank-posting-rules`
const STANDING_INSTRUCTIONS = `${TREASURY}/standing-instructions`
const BOOKS = `${TREASURY}/books`
const LIQUIDITY = `${TREASURY}/liquidity`
const BANK_CONNECTORS = `${TREASURY}/bank-connectors`

// ─── Treasury accounts ───────────────────────────────────────────────────────

export async function listTreasuryAccounts(params: {
  legalEntityId: string
  accountType?: 'BANK' | 'CASH' | 'CLEARING'
  status?: 'ACTIVE' | 'INACTIVE' | 'CLOSED'
  page?: number
  limit?: number
}) {
  const res = await apiRequest<TreasuryAccountSummary[]>(
    `${tenantPath(`${TREASURY}/accounts`)}${buildQuery(params)}`,
  )
  return toPaginated(res, params.limit ?? 50)
}

// ─── Bank statements ─────────────────────────────────────────────────────────

export async function listBankStatements(params: ListBankStatementsQuery) {
  const res = await apiRequest<BankStatementListItem[]>(
    `${tenantPath(STATEMENTS)}${buildQuery(params as unknown as Record<string, string | number | boolean | undefined>)}`,
  )
  return toPaginated(res, params.limit ?? 20)
}

export async function getBankStatement(id: string) {
  return apiRequest<BankStatementDetail>(tenantPath(`${STATEMENTS}/${id}`))
}

export async function createManualBankStatement(data: CreateManualStatementInput) {
  return apiRequest<BankStatementListItem>(tenantPath(`${STATEMENTS}/manual`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateBankStatement(id: string, data: UpdateBankStatementInput) {
  return apiRequest<BankStatementListItem>(tenantPath(`${STATEMENTS}/${id}`), {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function validateBankStatement(id: string, body: LifecycleInput) {
  return apiRequest<BankStatementListItem>(tenantPath(`${STATEMENTS}/${id}/validate`), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function reopenBankStatementDraft(id: string, body: LifecycleInput) {
  return apiRequest<BankStatementListItem>(tenantPath(`${STATEMENTS}/${id}/reopen-draft`), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function cancelBankStatement(id: string, body: LifecycleInput) {
  return apiRequest<BankStatementListItem>(tenantPath(`${STATEMENTS}/${id}/cancel`), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function addBankStatementLine(statementId: string, data: CreateStatementLineInput) {
  return apiRequest<unknown>(tenantPath(`${STATEMENTS}/${statementId}/lines`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateBankStatementLine(
  statementId: string,
  lineId: string,
  data: Partial<CreateStatementLineInput> & { expectedUpdatedAt: string },
) {
  return apiRequest<unknown>(tenantPath(`${STATEMENTS}/${statementId}/lines/${lineId}`), {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function deleteBankStatementLine(statementId: string, lineId: string, expectedUpdatedAt: string) {
  return apiRequest<unknown>(tenantPath(`${STATEMENTS}/${statementId}/lines/${lineId}`), {
    method: 'DELETE',
    body: JSON.stringify({ expectedUpdatedAt }),
  })
}

// ─── Import batches ──────────────────────────────────────────────────────────

export async function createImportBatch(input: {
  treasuryAccountId: string
  importFormat: 'CSV' | 'XLSX' | 'MT940' | 'CAMT_053' | 'AUTO_DETECT'
  mappingTemplateId?: string
  file: File
}) {
  const form = new FormData()
  form.append('file', input.file)
  form.append('treasuryAccountId', input.treasuryAccountId)
  form.append('importFormat', input.importFormat)
  if (input.mappingTemplateId) form.append('mappingTemplateId', input.mappingTemplateId)
  return apiRequest<ImportBatchDto>(tenantPath(IMPORT_BATCHES), { method: 'POST', body: form })
}

export async function getImportBatch(id: string) {
  return apiRequest<ImportBatchDto>(tenantPath(`${IMPORT_BATCHES}/${id}`))
}

export async function inspectImportBatch(id: string, body: InspectImportBatchInput) {
  return apiRequest<{
    batch: ImportBatchDto
    inspect: Record<string, unknown>
    suggestedMapping: Record<string, unknown>
  }>(tenantPath(`${IMPORT_BATCHES}/${id}/inspect`), { method: 'POST', body: JSON.stringify(body) })
}

export async function previewImportBatch(id: string, body: PreviewImportBatchInput) {
  return apiRequest<{ preview: Record<string, unknown>; mappingConfig: Record<string, unknown> }>(
    tenantPath(`${IMPORT_BATCHES}/${id}/preview`),
    { method: 'POST', body: JSON.stringify(body) },
  )
}

export async function executeImportBatch(id: string, body: ExecuteImportBatchInput) {
  return apiRequest<{ batch: ImportBatchDto; statementId: string }>(
    tenantPath(`${IMPORT_BATCHES}/${id}/import`),
    { method: 'POST', body: JSON.stringify(body) },
  )
}

export async function retryImportBatch(id: string, body: ExecuteImportBatchInput) {
  return apiRequest<{ batch: ImportBatchDto; statementId: string }>(
    tenantPath(`${IMPORT_BATCHES}/${id}/retry`),
    { method: 'POST', body: JSON.stringify(body) },
  )
}

export async function cancelImportBatch(id: string, body: LifecycleInput) {
  return apiRequest<ImportBatchDto>(tenantPath(`${IMPORT_BATCHES}/${id}/cancel`), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function downloadImportBatchFile(id: string) {
  return apiDownloadBlob(tenantPath(`${IMPORT_BATCHES}/${id}/file`))
}

// ─── Mapping templates ───────────────────────────────────────────────────────

export async function listMappingTemplates(params: {
  legalEntityId: string
  page?: number
  limit?: number
  treasuryAccountId?: string
  importFormat?: 'CSV' | 'XLSX' | 'MANUAL'
  isActive?: boolean
}) {
  const res = await apiRequest<MappingTemplateDto[]>(
    `${tenantPath(MAPPING_TEMPLATES)}${buildQuery(params)}`,
  )
  return toPaginated(res, params.limit ?? 50)
}

export async function getMappingTemplate(id: string) {
  return apiRequest<MappingTemplateDto>(tenantPath(`${MAPPING_TEMPLATES}/${id}`))
}

export async function createMappingTemplate(data: Record<string, unknown>) {
  return apiRequest<MappingTemplateDto>(tenantPath(MAPPING_TEMPLATES), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateMappingTemplate(id: string, data: Record<string, unknown>) {
  return apiRequest<MappingTemplateDto>(tenantPath(`${MAPPING_TEMPLATES}/${id}`), {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function activateMappingTemplate(id: string, expectedUpdatedAt: string) {
  return apiRequest<MappingTemplateDto>(tenantPath(`${MAPPING_TEMPLATES}/${id}/activate`), {
    method: 'POST',
    body: JSON.stringify({ expectedUpdatedAt }),
  })
}

export async function deactivateMappingTemplate(id: string, expectedUpdatedAt: string) {
  return apiRequest<MappingTemplateDto>(tenantPath(`${MAPPING_TEMPLATES}/${id}/deactivate`), {
    method: 'POST',
    body: JSON.stringify({ expectedUpdatedAt }),
  })
}

// ─── Bank reconciliation — Phase 5A3 ─────────────────────────────────────────

export async function listReconciliationSessions(params: ListSessionsQuery) {
  const res = await apiRequest<SessionDto[]>(
    `${tenantPath(RECONCILIATION)}${buildQuery(params as unknown as Record<string, string | number | boolean | undefined>)}`,
  )
  return toPaginated(res, params.limit ?? 20)
}

export async function listReconciliationHistory(params: ListHistoryQuery) {
  const res = await apiRequest<SessionDto[]>(
    `${tenantPath(`${RECONCILIATION}/history`)}${buildQuery(params as unknown as Record<string, string | number | boolean | undefined>)}`,
  )
  return toPaginated(res, params.limit ?? 20)
}

export async function listReconciliationExceptionsGlobal(params: ListExceptionsQuery) {
  const res = await apiRequest<ExceptionDto[]>(
    `${tenantPath(`${RECONCILIATION}/exceptions`)}${buildQuery(params as unknown as Record<string, string | number | boolean | undefined>)}`,
  )
  return toPaginated(res, params.limit ?? 20)
}

export async function createReconciliationException(data: CreateExceptionInput) {
  return apiRequest<ExceptionDto>(tenantPath(`${RECONCILIATION}/exceptions`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function resolveReconciliationException(exceptionId: string, data: ResolveExceptionInput) {
  return apiRequest<ExceptionDto>(tenantPath(`${RECONCILIATION}/exceptions/${exceptionId}/resolve`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function acceptReconciliationSuggestion(suggestionId: string, data: AcceptSuggestionInput) {
  return apiRequest<BankReconciliationMatchDto>(tenantPath(`${RECONCILIATION}/suggestions/${suggestionId}/accept`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function rejectReconciliationSuggestion(suggestionId: string, data: RejectSuggestionInput) {
  return apiRequest<SuggestionDto>(tenantPath(`${RECONCILIATION}/suggestions/${suggestionId}/reject`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function previewReconciliationMatch(data: PreviewMatchInput) {
  return apiRequest<MatchPreviewResultDto>(tenantPath(`${RECONCILIATION}/preview`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function createReconciliationMatch(data: CreateMatchInput) {
  return apiRequest<BankReconciliationMatchDto>(tenantPath(`${RECONCILIATION}/matches`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function getReconciliationMatch(matchId: string) {
  return apiRequest<BankReconciliationMatchDto>(tenantPath(`${RECONCILIATION}/matches/${matchId}`))
}

export async function unmatchReconciliationMatch(matchId: string, data: UnmatchInput) {
  return apiRequest<BankReconciliationMatchDto>(tenantPath(`${RECONCILIATION}/matches/${matchId}/unmatch`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function getReconciliationWorkspace(statementId: string) {
  return apiRequest<ReconciliationWorkspaceDto>(tenantPath(`${STATEMENTS}/${statementId}/reconciliation`))
}

export async function getReconciliationSummary(statementId: string) {
  return apiRequest<SessionSummaryDto>(tenantPath(`${STATEMENTS}/${statementId}/reconciliation/summary`))
}

export async function runReconciliationAutoMatch(statementId: string, data: RunAutoMatchInput) {
  return apiRequest<AutoMatchRunResultDto>(tenantPath(`${STATEMENTS}/${statementId}/reconciliation/run-auto-match`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function listReconciliationSuggestionsForStatement(statementId: string) {
  return apiRequest<SuggestionDto[]>(tenantPath(`${STATEMENTS}/${statementId}/reconciliation/suggestions`))
}

export async function listReconciliationExceptionsForStatement(statementId: string) {
  return apiRequest<ExceptionDto[]>(tenantPath(`${STATEMENTS}/${statementId}/reconciliation/exceptions`))
}

export async function finalizeReconciliationSession(statementId: string, data: FinalizeSessionInput) {
  return apiRequest<SessionDto>(tenantPath(`${STATEMENTS}/${statementId}/reconciliation/finalize`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function reopenReconciliationSession(statementId: string, data: ReopenSessionInput) {
  return apiRequest<SessionDto>(tenantPath(`${STATEMENTS}/${statementId}/reconciliation/reopen`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function getReconciliationCandidatesForLine(statementId: string, lineId: string) {
  return apiRequest<CandidatesForLineDto>(tenantPath(`${STATEMENTS}/${statementId}/lines/${lineId}/reconciliation-candidates`))
}

export async function createReconciliationAdjustmentDraft(statementId: string, lineId: string, data: CreateAdjustmentDraftInput) {
  return apiRequest<unknown>(tenantPath(`${STATEMENTS}/${statementId}/lines/${lineId}/create-journal-draft`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

// ─── Internal treasury transfers — Phase 5B1 ─────────────────────────────────

export async function listTreasuryTransfers(params: ListTransfersQuery) {
  const res = await apiRequest<TreasuryTransferDto[]>(
    `${tenantPath(TRANSFERS)}${buildQuery(params as unknown as Record<string, string | number | boolean | undefined>)}`,
  )
  return toPaginated(res, params.limit ?? 20)
}

export async function getTreasuryTransfer(id: string) {
  return apiRequest<TreasuryTransferDto>(tenantPath(`${TRANSFERS}/${id}`))
}

export async function createTreasuryTransfer(data: CreateTransferInput) {
  return apiRequest<TreasuryTransferDto>(tenantPath(TRANSFERS), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateTreasuryTransfer(id: string, data: UpdateTransferInput) {
  return apiRequest<TreasuryTransferDto>(tenantPath(`${TRANSFERS}/${id}`), {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function deleteTreasuryTransfer(id: string, data: DeleteTransferInput) {
  return apiRequest<unknown>(tenantPath(`${TRANSFERS}/${id}`), {
    method: 'DELETE',
    body: JSON.stringify(data),
  })
}

export async function validateTreasuryTransfer(id: string, data: TransferLifecycleInput) {
  return apiRequest<TreasuryTransferDto>(tenantPath(`${TRANSFERS}/${id}/validate`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function submitTreasuryTransfer(id: string, data: TransferLifecycleInput) {
  return apiRequest<TreasuryTransferDto>(tenantPath(`${TRANSFERS}/${id}/submit`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function approveTreasuryTransfer(id: string, data: TransferLifecycleInput) {
  return apiRequest<TreasuryTransferDto>(tenantPath(`${TRANSFERS}/${id}/approve`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function rejectTreasuryTransfer(id: string, data: ReasonedLifecycleInput) {
  return apiRequest<TreasuryTransferDto>(tenantPath(`${TRANSFERS}/${id}/reject`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function reviseTreasuryTransfer(id: string, data: TransferLifecycleInput) {
  return apiRequest<TreasuryTransferDto>(tenantPath(`${TRANSFERS}/${id}/revise`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function markTreasuryTransferReady(id: string, data: TransferLifecycleInput) {
  return apiRequest<TreasuryTransferDto>(tenantPath(`${TRANSFERS}/${id}/mark-ready`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function cancelTreasuryTransfer(id: string, data: ReasonedLifecycleInput) {
  return apiRequest<TreasuryTransferDto>(tenantPath(`${TRANSFERS}/${id}/cancel`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function postTreasuryTransfer(id: string, data: TransferLifecycleInput) {
  return apiRequest<TreasuryTransferDto>(tenantPath(`${TRANSFERS}/${id}/post`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function dispatchTreasuryTransfer(id: string, data: TransferLifecycleInput) {
  return apiRequest<TreasuryTransferDto>(tenantPath(`${TRANSFERS}/${id}/dispatch`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function receiveTreasuryTransfer(id: string, data: TransferLifecycleInput) {
  return apiRequest<TreasuryTransferDto>(tenantPath(`${TRANSFERS}/${id}/receive`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function reverseTreasuryTransfer(id: string, data: ReverseTransferInput) {
  return apiRequest<TreasuryTransferDto>(tenantPath(`${TRANSFERS}/${id}/reverse`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function getTreasuryTransferReversalPreview(id: string) {
  return apiRequest<TransferReversalPreviewDto>(tenantPath(`${TRANSFERS}/${id}/reversal-preview`))
}

// ─── Treasury cheques — Phase 5B2 ────────────────────────────────────────────

export async function listTreasuryCheques(params: ListChequesQuery) {
  const res = await apiRequest<TreasuryChequeDto[]>(
    `${tenantPath(CHEQUES)}${buildQuery(params as unknown as Record<string, string | number | boolean | undefined>)}`,
  )
  return toPaginated(res, params.limit ?? 20)
}

export async function getTreasuryCheque(id: string) {
  return apiRequest<TreasuryChequeDto>(tenantPath(`${CHEQUES}/${id}`))
}

export async function createTreasuryCheque(data: CreateChequeInput) {
  return apiRequest<TreasuryChequeDto>(tenantPath(CHEQUES), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateTreasuryCheque(id: string, data: UpdateChequeInput) {
  return apiRequest<TreasuryChequeDto>(tenantPath(`${CHEQUES}/${id}`), {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function validateTreasuryCheque(id: string) {
  return apiRequest<ValidateChequeResult>(tenantPath(`${CHEQUES}/${id}/validate`), {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export async function submitTreasuryCheque(id: string, data: SubmitChequeInput) {
  return apiRequest<TreasuryChequeDto>(tenantPath(`${CHEQUES}/${id}/submit`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function approveTreasuryCheque(id: string, data: ApproveChequeInput) {
  return apiRequest<TreasuryChequeDto>(tenantPath(`${CHEQUES}/${id}/approve`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function rejectTreasuryCheque(id: string, data: RejectChequeInput) {
  return apiRequest<TreasuryChequeDto>(tenantPath(`${CHEQUES}/${id}/reject`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function reviseTreasuryCheque(id: string, data: ReviseChequeInput) {
  return apiRequest<TreasuryChequeDto>(tenantPath(`${CHEQUES}/${id}/revise`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function markTreasuryChequeReady(id: string, data: MarkChequeReadyInput) {
  return apiRequest<TreasuryChequeDto>(tenantPath(`${CHEQUES}/${id}/mark-ready`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function cancelTreasuryCheque(id: string, data: CancelChequeInput) {
  return apiRequest<TreasuryChequeDto>(tenantPath(`${CHEQUES}/${id}/cancel`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function issueTreasuryCheque(id: string, data: IssueChequeInput) {
  return apiRequest<ChequePostingResultDto>(tenantPath(`${CHEQUES}/${id}/issue`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function depositTreasuryCheque(id: string, data: DepositChequeInput) {
  return apiRequest<ChequePostingResultDto>(tenantPath(`${CHEQUES}/${id}/deposit`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function clearTreasuryCheque(id: string, data: ClearChequeInput) {
  return apiRequest<TreasuryChequeDto>(tenantPath(`${CHEQUES}/${id}/clear`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function bounceTreasuryCheque(id: string, data: BounceChequeInput) {
  return apiRequest<TreasuryChequeDto>(tenantPath(`${CHEQUES}/${id}/bounce`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function stopTreasuryCheque(id: string, data: StopChequeInput) {
  return apiRequest<TreasuryChequeDto>(tenantPath(`${CHEQUES}/${id}/stop`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function reverseTreasuryCheque(id: string, data: ReverseChequeInput) {
  return apiRequest<ChequePostingResultDto>(tenantPath(`${CHEQUES}/${id}/reverse`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

// ─── Treasury adjustments — Phase 5B3 ────────────────────────────────────────

export async function listTreasuryAdjustments(params: ListTreasuryAdjustmentsQuery) {
  const res = await apiRequest<TreasuryAdjustmentDto[]>(
    `${tenantPath(ADJUSTMENTS)}${buildQuery(params as unknown as Record<string, string | number | boolean | undefined>)}`,
  )
  return toPaginated(res, params.limit ?? 20)
}

export async function getTreasuryAdjustment(id: string) {
  return apiRequest<TreasuryAdjustmentDto>(tenantPath(`${ADJUSTMENTS}/${id}`))
}

export async function createTreasuryAdjustment(data: CreateAdjustmentInput) {
  return apiRequest<TreasuryAdjustmentDto>(tenantPath(ADJUSTMENTS), { method: 'POST', body: JSON.stringify(data) })
}

export async function updateTreasuryAdjustment(id: string, data: UpdateAdjustmentInput) {
  return apiRequest<TreasuryAdjustmentDto>(tenantPath(`${ADJUSTMENTS}/${id}`), { method: 'PATCH', body: JSON.stringify(data) })
}

export async function validateTreasuryAdjustment(id: string) {
  return apiRequest<ValidateAdjustmentResult>(tenantPath(`${ADJUSTMENTS}/${id}/validate`), { method: 'POST', body: JSON.stringify({}) })
}

export async function submitTreasuryAdjustment(id: string, data: AdjustmentLifecycleInput) {
  return apiRequest<TreasuryAdjustmentDto>(tenantPath(`${ADJUSTMENTS}/${id}/submit`), { method: 'POST', body: JSON.stringify(data) })
}

export async function approveTreasuryAdjustment(id: string, data: ApproveAdjustmentInput) {
  return apiRequest<TreasuryAdjustmentDto>(tenantPath(`${ADJUSTMENTS}/${id}/approve`), { method: 'POST', body: JSON.stringify(data) })
}

export async function rejectTreasuryAdjustment(id: string, data: RejectAdjustmentInput) {
  return apiRequest<TreasuryAdjustmentDto>(tenantPath(`${ADJUSTMENTS}/${id}/reject`), { method: 'POST', body: JSON.stringify(data) })
}

export async function reviseTreasuryAdjustment(id: string, data: AdjustmentLifecycleInput) {
  return apiRequest<TreasuryAdjustmentDto>(tenantPath(`${ADJUSTMENTS}/${id}/revise`), { method: 'POST', body: JSON.stringify(data) })
}

export async function markTreasuryAdjustmentReady(id: string, data: AdjustmentLifecycleInput) {
  return apiRequest<TreasuryAdjustmentDto>(tenantPath(`${ADJUSTMENTS}/${id}/mark-ready`), { method: 'POST', body: JSON.stringify(data) })
}

export async function cancelTreasuryAdjustment(id: string, data: CancelAdjustmentInput) {
  return apiRequest<TreasuryAdjustmentDto>(tenantPath(`${ADJUSTMENTS}/${id}/cancel`), { method: 'POST', body: JSON.stringify(data) })
}

export async function postTreasuryAdjustment(id: string, data: AdjustmentLifecycleInput & { postingDate?: string }) {
  return apiRequest<TreasuryAdjustmentPostingResultDto>(tenantPath(`${ADJUSTMENTS}/${id}/post`), { method: 'POST', body: JSON.stringify(data) })
}

export async function reverseTreasuryAdjustment(id: string, data: ReverseAdjustmentInput) {
  return apiRequest<TreasuryAdjustmentPostingResultDto>(tenantPath(`${ADJUSTMENTS}/${id}/reverse`), { method: 'POST', body: JSON.stringify(data) })
}

export async function createTreasuryAdjustmentFromStatementLine(
  statementId: string,
  lineId: string,
  data: CreateAdjustmentFromStatementLineInput,
) {
  return apiRequest<TreasuryAdjustmentDto>(tenantPath(`${STATEMENTS}/${statementId}/lines/${lineId}/treasury-adjustment`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

// ─── Bank posting rules + statement classification — Phase 5B3 ──────────────

export async function listBankPostingRules(params: ListBankPostingRulesQuery) {
  const res = await apiRequest<BankPostingRuleDto[]>(
    `${tenantPath(POSTING_RULES)}${buildQuery(params as unknown as Record<string, string | number | boolean | undefined>)}`,
  )
  return toPaginated(res, params.limit ?? 50)
}

export async function getBankPostingRule(id: string) {
  return apiRequest<BankPostingRuleDto>(tenantPath(`${POSTING_RULES}/${id}`))
}

export async function createBankPostingRule(data: CreateBankPostingRuleInput) {
  return apiRequest<BankPostingRuleDto>(tenantPath(POSTING_RULES), { method: 'POST', body: JSON.stringify(data) })
}

export async function updateBankPostingRule(id: string, data: UpdateBankPostingRuleInput) {
  return apiRequest<BankPostingRuleDto>(tenantPath(`${POSTING_RULES}/${id}`), { method: 'PATCH', body: JSON.stringify(data) })
}

export async function deactivateBankPostingRule(id: string) {
  return apiRequest<BankPostingRuleDto>(tenantPath(`${POSTING_RULES}/${id}/deactivate`), { method: 'POST', body: JSON.stringify({}) })
}

export async function classifyStatementLine(statementId: string, lineId: string, data: ClassifyStatementLineInput) {
  return apiRequest<ClassifyStatementLineResultDto>(tenantPath(`${STATEMENTS}/${statementId}/lines/${lineId}/classify`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

// ─── Standing instructions — Phase 5B3 ───────────────────────────────────────

export async function listStandingInstructions(params: ListStandingInstructionsQuery) {
  const res = await apiRequest<StandingInstructionDto[]>(
    `${tenantPath(STANDING_INSTRUCTIONS)}${buildQuery(params as unknown as Record<string, string | number | boolean | undefined>)}`,
  )
  return toPaginated(res, params.limit ?? 50)
}

export async function getStandingInstruction(id: string) {
  return apiRequest<StandingInstructionDto>(tenantPath(`${STANDING_INSTRUCTIONS}/${id}`))
}

export async function createStandingInstruction(data: CreateStandingInstructionInput) {
  return apiRequest<StandingInstructionDto>(tenantPath(STANDING_INSTRUCTIONS), { method: 'POST', body: JSON.stringify(data) })
}

export async function updateStandingInstruction(id: string, data: UpdateStandingInstructionInput) {
  return apiRequest<StandingInstructionDto>(tenantPath(`${STANDING_INSTRUCTIONS}/${id}`), { method: 'PATCH', body: JSON.stringify(data) })
}

export async function pauseStandingInstruction(id: string, data: PauseStandingInstructionInput) {
  return apiRequest<StandingInstructionDto>(tenantPath(`${STANDING_INSTRUCTIONS}/${id}/pause`), { method: 'POST', body: JSON.stringify(data) })
}

export async function resumeStandingInstruction(id: string, data: ResumeStandingInstructionInput) {
  return apiRequest<StandingInstructionDto>(tenantPath(`${STANDING_INSTRUCTIONS}/${id}/resume`), { method: 'POST', body: JSON.stringify(data) })
}

export async function cancelStandingInstruction(id: string, data: CancelStandingInstructionInput) {
  return apiRequest<StandingInstructionDto>(tenantPath(`${STANDING_INSTRUCTIONS}/${id}/cancel`), { method: 'POST', body: JSON.stringify(data) })
}

export async function generateDueStandingInstructionDrafts(data: GenerateDueDraftsInput) {
  return apiRequest<GenerationOutcomeDto[]>(tenantPath(`${STANDING_INSTRUCTIONS}/generate-due-drafts`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

// ─── Bankbook / cashbook — Phase 5B3 ─────────────────────────────────────────

export async function getBankbook(params: BookQuery) {
  return apiRequest<BookResultDto>(`${tenantPath(`${BOOKS}/bankbook`)}${buildQuery(params as unknown as Record<string, string | number | boolean | undefined>)}`)
}

export async function getCashbook(params: BookQuery) {
  return apiRequest<BookResultDto>(`${tenantPath(`${BOOKS}/cashbook`)}${buildQuery(params as unknown as Record<string, string | number | boolean | undefined>)}`)
}

export async function downloadBankbookCsv(params: BookQuery) {
  return apiDownloadBlob(`${tenantPath(`${BOOKS}/bankbook/export`)}${buildQuery(params as unknown as Record<string, string | number | boolean | undefined>)}`)
}

export async function downloadCashbookCsv(params: BookQuery) {
  return apiDownloadBlob(`${tenantPath(`${BOOKS}/cashbook/export`)}${buildQuery(params as unknown as Record<string, string | number | boolean | undefined>)}`)
}

// ─── Liquidity / cash position — Phase 5C1 ───────────────────────────────────

export async function getTreasuryCashPosition(params: {
  legalEntityId: string
  asOfDate?: string
  currencyCode?: string
}) {
  return apiRequest<import('@/modules/accounting/treasury/liquidity/api/treasury-liquidity.types').CashPositionResult>(
    `${tenantPath(`${LIQUIDITY}/cash-position`)}${buildQuery(params)}`,
  )
}

export async function getTreasuryDailyLiquidity(params: {
  legalEntityId: string
  asOfDate?: string
  currencyCode?: string
}) {
  return apiRequest<import('@/modules/accounting/treasury/liquidity/api/treasury-liquidity.types').DailyLiquidityResult>(
    `${tenantPath(`${LIQUIDITY}/daily`)}${buildQuery(params)}`,
  )
}

export async function getTreasuryLiquidityForecast(params: {
  legalEntityId: string
  asOfDate?: string
  horizonDays?: number
  currencyCode?: string
}) {
  return apiRequest<import('@/modules/accounting/treasury/liquidity/api/treasury-liquidity.types').ShortTermForecastResult>(
    `${tenantPath(`${LIQUIDITY}/forecast`)}${buildQuery(params)}`,
  )
}

export async function getTreasuryClosingControls(params: {
  legalEntityId: string
  asOfDate?: string
}) {
  return apiRequest<import('@/modules/accounting/treasury/liquidity/api/treasury-liquidity.types').ClosingControlsResult>(
    `${tenantPath(`${LIQUIDITY}/closing-controls`)}${buildQuery(params)}`,
  )
}

export async function getTreasuryLiquidityDashboard(params: {
  legalEntityId: string
  asOfDate?: string
  horizonDays?: number
}) {
  return apiRequest<import('@/modules/accounting/treasury/liquidity/api/treasury-liquidity.types').TreasuryDashboardResult>(
    `${tenantPath(`${LIQUIDITY}/dashboard`)}${buildQuery(params)}`,
  )
}

export async function createTreasuryDayClose(data: {
  legalEntityId: string
  closeDate: string
  notes?: string | null
}) {
  return apiRequest<import('@/modules/accounting/treasury/liquidity/api/treasury-liquidity.types').TreasuryDayCloseDto>(
    tenantPath(`${LIQUIDITY}/day-closes`),
    { method: 'POST', body: JSON.stringify(data) },
  )
}

export async function reviewTreasuryDayClose(id: string, data: { expectedUpdatedAt: string; notes?: string | null }) {
  return apiRequest<import('@/modules/accounting/treasury/liquidity/api/treasury-liquidity.types').TreasuryDayCloseDto>(
    tenantPath(`${LIQUIDITY}/day-closes/${id}/review`),
    { method: 'POST', body: JSON.stringify(data) },
  )
}

export async function closeTreasuryDayClose(id: string, data: { expectedUpdatedAt: string; notes?: string | null }) {
  return apiRequest<import('@/modules/accounting/treasury/liquidity/api/treasury-liquidity.types').TreasuryDayCloseDto>(
    tenantPath(`${LIQUIDITY}/day-closes/${id}/close`),
    { method: 'POST', body: JSON.stringify(data) },
  )
}

export async function reopenTreasuryDayClose(id: string, data: { expectedUpdatedAt: string; reason: string; notes?: string | null }) {
  return apiRequest<import('@/modules/accounting/treasury/liquidity/api/treasury-liquidity.types').TreasuryDayCloseDto>(
    tenantPath(`${LIQUIDITY}/day-closes/${id}/reopen`),
    { method: 'POST', body: JSON.stringify(data) },
  )
}

// ─── Bank connectors — Phase 5D1 scaffold + 5D2 sandbox/REST pull ─────────────

export async function listBankConnectorProviders() {
  return apiRequest<import('@/modules/accounting/treasury/connectors/api/bank-connector.types').BankConnectorProviderCatalogItem[]>(
    tenantPath(`${BANK_CONNECTORS}/providers`),
  )
}

export async function listBankConnectors(
  params: import('@/modules/accounting/treasury/connectors/api/bank-connector.types').ListBankConnectorsQuery,
) {
  const res = await apiRequest<
    import('@/modules/accounting/treasury/connectors/api/bank-connector.types').BankConnectorDto[]
  >(`${tenantPath(BANK_CONNECTORS)}${buildQuery(params as unknown as Record<string, string | number | boolean | undefined>)}`)
  return toPaginated(res, params.limit ?? 50)
}

export async function getBankConnector(id: string) {
  return apiRequest<import('@/modules/accounting/treasury/connectors/api/bank-connector.types').BankConnectorDto>(
    tenantPath(`${BANK_CONNECTORS}/${id}`),
  )
}

export async function createBankConnector(
  data: import('@/modules/accounting/treasury/connectors/api/bank-connector.types').CreateBankConnectorInput,
) {
  return apiRequest<import('@/modules/accounting/treasury/connectors/api/bank-connector.types').BankConnectorDto>(
    tenantPath(BANK_CONNECTORS),
    { method: 'POST', body: JSON.stringify(data) },
  )
}

export async function updateBankConnector(
  id: string,
  data: import('@/modules/accounting/treasury/connectors/api/bank-connector.types').UpdateBankConnectorInput,
) {
  return apiRequest<import('@/modules/accounting/treasury/connectors/api/bank-connector.types').BankConnectorDto>(
    tenantPath(`${BANK_CONNECTORS}/${id}`),
    { method: 'PATCH', body: JSON.stringify(data) },
  )
}

export async function enableBankConnector(id: string, data: { expectedUpdatedAt: string }) {
  return apiRequest<import('@/modules/accounting/treasury/connectors/api/bank-connector.types').BankConnectorDto>(
    tenantPath(`${BANK_CONNECTORS}/${id}/enable`),
    { method: 'POST', body: JSON.stringify(data) },
  )
}

export async function disableBankConnector(id: string, data: { expectedUpdatedAt: string }) {
  return apiRequest<import('@/modules/accounting/treasury/connectors/api/bank-connector.types').BankConnectorDto>(
    tenantPath(`${BANK_CONNECTORS}/${id}/disable`),
    { method: 'POST', body: JSON.stringify(data) },
  )
}

export async function testBankConnectorConnection(id: string) {
  return apiRequest<import('@/modules/accounting/treasury/connectors/api/bank-connector.types').BankConnectorProbeResult>(
    tenantPath(`${BANK_CONNECTORS}/${id}/test-connection`),
    { method: 'POST', body: '{}' },
  )
}

export async function syncBankConnector(id: string) {
  return apiRequest<import('@/modules/accounting/treasury/connectors/api/bank-connector.types').BankConnectorProbeResult>(
    tenantPath(`${BANK_CONNECTORS}/${id}/sync`),
    { method: 'POST', body: '{}' },
  )
}

export async function startBankConnectorConsent(
  id: string,
  data: { redirectUri: string; expectedUpdatedAt?: string },
) {
  return apiRequest<{
    connector: import('@/modules/accounting/treasury/connectors/api/bank-connector.types').BankConnectorDto
    consent: import('@/modules/accounting/treasury/connectors/api/bank-connector.types').BankConnectorConsentDto
    authorizationUrl: string | null
  }>(tenantPath(`${BANK_CONNECTORS}/${id}/consents/start`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function bankConnectorConsentCallback(
  id: string,
  data: { state: string; code?: string; error?: string; accessToken?: string; expiresInSeconds?: number },
) {
  return apiRequest<{
    consent: import('@/modules/accounting/treasury/connectors/api/bank-connector.types').BankConnectorConsentDto
  }>(tenantPath(`${BANK_CONNECTORS}/${id}/consents/callback`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function revokeBankConnectorConsent(id: string, data: { expectedUpdatedAt?: string; reason?: string } = {}) {
  return apiRequest<{
    consent: import('@/modules/accounting/treasury/connectors/api/bank-connector.types').BankConnectorConsentDto
  }>(tenantPath(`${BANK_CONNECTORS}/${id}/consents/revoke`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}
