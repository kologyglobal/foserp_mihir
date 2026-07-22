import * as api from '@/services/api/treasuryApi'
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
  Paginated,
  RejectAdjustmentInput,
  ReverseAdjustmentInput,
  TreasuryAdjustmentDto,
  TreasuryAdjustmentPostingResultDto,
  UpdateAdjustmentInput,
  UpdateBankPostingRuleInput,
  ValidateAdjustmentResult,
} from './treasury-adjustment.types'

function unwrap<T>(res: { data: T }): T {
  return res.data
}

export async function fetchAdjustments(query: ListTreasuryAdjustmentsQuery): Promise<Paginated<TreasuryAdjustmentDto>> {
  return api.listTreasuryAdjustments(query)
}

export async function fetchAdjustment(id: string): Promise<TreasuryAdjustmentDto> {
  return unwrap(await api.getTreasuryAdjustment(id))
}

export async function createAdjustmentDraft(data: CreateAdjustmentInput): Promise<TreasuryAdjustmentDto> {
  return unwrap(await api.createTreasuryAdjustment(data))
}

export async function updateAdjustmentDraft(id: string, data: UpdateAdjustmentInput): Promise<TreasuryAdjustmentDto> {
  return unwrap(await api.updateTreasuryAdjustment(id, data))
}

export async function validateAdjustment(id: string): Promise<ValidateAdjustmentResult> {
  return unwrap(await api.validateTreasuryAdjustment(id))
}

export async function submitAdjustment(id: string, data: AdjustmentLifecycleInput): Promise<TreasuryAdjustmentDto> {
  return unwrap(await api.submitTreasuryAdjustment(id, data))
}

export async function approveAdjustment(id: string, data: ApproveAdjustmentInput): Promise<TreasuryAdjustmentDto> {
  return unwrap(await api.approveTreasuryAdjustment(id, data))
}

export async function rejectAdjustment(id: string, data: RejectAdjustmentInput): Promise<TreasuryAdjustmentDto> {
  return unwrap(await api.rejectTreasuryAdjustment(id, data))
}

export async function reviseAdjustment(id: string, data: AdjustmentLifecycleInput): Promise<TreasuryAdjustmentDto> {
  return unwrap(await api.reviseTreasuryAdjustment(id, data))
}

export async function markAdjustmentReady(id: string, data: AdjustmentLifecycleInput): Promise<TreasuryAdjustmentDto> {
  return unwrap(await api.markTreasuryAdjustmentReady(id, data))
}

export async function cancelAdjustment(id: string, data: CancelAdjustmentInput): Promise<TreasuryAdjustmentDto> {
  return unwrap(await api.cancelTreasuryAdjustment(id, data))
}

export async function postAdjustment(id: string, data: AdjustmentLifecycleInput & { postingDate?: string }): Promise<TreasuryAdjustmentPostingResultDto> {
  return unwrap(await api.postTreasuryAdjustment(id, data))
}

export async function reverseAdjustment(id: string, data: ReverseAdjustmentInput): Promise<TreasuryAdjustmentPostingResultDto> {
  return unwrap(await api.reverseTreasuryAdjustment(id, data))
}

export async function createAdjustmentFromStatementLine(
  statementId: string,
  lineId: string,
  data: CreateAdjustmentFromStatementLineInput,
): Promise<TreasuryAdjustmentDto> {
  return unwrap(await api.createTreasuryAdjustmentFromStatementLine(statementId, lineId, data))
}

// ─── Bank posting rules + classification ─────────────────────────────────────

export async function fetchBankPostingRules(query: ListBankPostingRulesQuery): Promise<Paginated<BankPostingRuleDto>> {
  return api.listBankPostingRules(query)
}

export async function fetchBankPostingRule(id: string): Promise<BankPostingRuleDto> {
  return unwrap(await api.getBankPostingRule(id))
}

export async function createBankPostingRuleDraft(data: CreateBankPostingRuleInput): Promise<BankPostingRuleDto> {
  return unwrap(await api.createBankPostingRule(data))
}

export async function updateBankPostingRuleDraft(id: string, data: UpdateBankPostingRuleInput): Promise<BankPostingRuleDto> {
  return unwrap(await api.updateBankPostingRule(id, data))
}

export async function deactivateBankPostingRule(id: string): Promise<BankPostingRuleDto> {
  return unwrap(await api.deactivateBankPostingRule(id))
}

export async function classifyStatementLine(
  statementId: string,
  lineId: string,
  data: ClassifyStatementLineInput,
): Promise<ClassifyStatementLineResultDto> {
  return unwrap(await api.classifyStatementLine(statementId, lineId, data))
}
