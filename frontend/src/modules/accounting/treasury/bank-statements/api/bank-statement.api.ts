import * as api from '@/services/api/treasuryApi'
import type {
  BankStatementDetail,
  BankStatementListItem,
  CreateManualStatementInput,
  CreateStatementLineInput,
  LifecycleInput,
  ListBankStatementsQuery,
  Paginated,
  UpdateBankStatementInput,
} from './bank-statement.types'

function unwrap<T>(res: { data: T }): T {
  return res.data
}

export async function fetchBankStatements(query: ListBankStatementsQuery): Promise<Paginated<BankStatementListItem>> {
  return api.listBankStatements(query)
}

export async function fetchBankStatement(id: string): Promise<BankStatementDetail> {
  return unwrap(await api.getBankStatement(id))
}

export async function createManualStatement(data: CreateManualStatementInput): Promise<BankStatementListItem> {
  return unwrap(await api.createManualBankStatement(data))
}

export async function updateStatement(id: string, data: UpdateBankStatementInput): Promise<BankStatementListItem> {
  return unwrap(await api.updateBankStatement(id, data))
}

export async function validateStatement(id: string, body: LifecycleInput): Promise<BankStatementListItem> {
  return unwrap(await api.validateBankStatement(id, body))
}

export async function reopenStatementDraft(id: string, body: LifecycleInput): Promise<BankStatementListItem> {
  return unwrap(await api.reopenBankStatementDraft(id, body))
}

export async function cancelStatement(id: string, body: LifecycleInput): Promise<BankStatementListItem> {
  return unwrap(await api.cancelBankStatement(id, body))
}

export async function addStatementLine(statementId: string, data: CreateStatementLineInput) {
  return unwrap(await api.addBankStatementLine(statementId, data))
}

export async function updateStatementLine(
  statementId: string,
  lineId: string,
  data: Partial<CreateStatementLineInput> & { expectedUpdatedAt: string },
) {
  return unwrap(await api.updateBankStatementLine(statementId, lineId, data))
}

export async function deleteStatementLine(statementId: string, lineId: string, expectedUpdatedAt: string) {
  return unwrap(await api.deleteBankStatementLine(statementId, lineId, expectedUpdatedAt))
}

export async function fetchTreasuryBankAccounts(legalEntityId: string) {
  return api.listTreasuryAccounts({ legalEntityId, accountType: 'BANK', status: 'ACTIVE', limit: 100 })
}
