import { isApiMode } from '../../config/apiConfig'
import type {
  ApprovalListFilters,
  ApprovalRequest,
  JournalApprovalTimelineEntry,
} from '../../types/approvals'
import type { Journal } from '../../types/journals'
import * as api from '../api/financeApi'
import { getApprovalDemoState } from '../../store/approvalDemoStore'
import { resolveLegalEntityId } from './financeApiBridge'

function unwrap<T>(res: { data: T }): T {
  return res.data
}

export async function listApprovalRequests(
  filters?: Partial<ApprovalListFilters>,
): Promise<ApprovalRequest[]> {
  const legalEntityId = resolveLegalEntityId(filters?.legalEntityId)
  if (isApiMode()) return unwrap(await api.listApprovalRequests({ legalEntityId, ...filters }))
  return getApprovalDemoState().listApprovals({ legalEntityId, ...filters })
}

export async function getApprovalRequest(id: string): Promise<ApprovalRequest> {
  if (isApiMode()) return unwrap(await api.getApprovalRequest(id))
  const item = getApprovalDemoState().getApproval(id)
  if (!item) throw new Error('Approval request not found')
  return item
}

export async function getJournalApprovals(journalId: string): Promise<JournalApprovalTimelineEntry[]> {
  if (isApiMode()) return unwrap(await api.getJournalApprovals(journalId))
  return getApprovalDemoState().getJournalApprovals(journalId)
}

export async function approveJournal(journalId: string, comments?: string): Promise<Journal> {
  if (isApiMode()) return unwrap(await api.approveJournal(journalId, comments))
  return getApprovalDemoState().approveJournal(journalId, comments)
}

export async function sendBackJournal(journalId: string, comments: string): Promise<Journal> {
  if (isApiMode()) return unwrap(await api.sendBackJournal(journalId, comments))
  return getApprovalDemoState().sendBackJournal(journalId, comments)
}

export async function rejectJournal(journalId: string, comments: string): Promise<Journal> {
  if (isApiMode()) return unwrap(await api.rejectJournal(journalId, comments))
  return getApprovalDemoState().rejectJournal(journalId, comments)
}
