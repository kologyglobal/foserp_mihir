import { isApiMode } from '../../config/apiConfig'
import type {
  CreateJournalInput,
  Journal,
  JournalAuditEntry,
  JournalListFilters,
  JournalValidationReport,
  UpdateJournalInput,
} from '../../types/journals'
import * as api from '../api/financeApi'
import { getJournalDemoState, seedDemoJournalIfEmpty } from '../../store/journalDemoStore'
import { resolveLegalEntityId } from './financeApiBridge'

function unwrap<T>(res: { data: T }): T {
  return res.data
}

export async function listJournals(filters?: Partial<JournalListFilters>): Promise<Journal[]> {
  const legalEntityId = resolveLegalEntityId(filters?.legalEntityId)
  if (isApiMode()) return unwrap(await api.listJournals({ legalEntityId, ...filters }))
  seedDemoJournalIfEmpty(legalEntityId)
  return getJournalDemoState().listJournals({ legalEntityId, ...filters })
}

export async function getJournal(id: string): Promise<Journal> {
  if (isApiMode()) return unwrap(await api.getJournal(id))
  const journal = getJournalDemoState().getJournal(id)
  if (!journal) throw new Error('Journal not found')
  return journal
}

export async function createJournal(input: CreateJournalInput): Promise<Journal> {
  if (isApiMode()) return unwrap(await api.createJournal(input as unknown as Record<string, unknown>))
  return getJournalDemoState().createJournal(input)
}

export async function updateJournal(id: string, input: UpdateJournalInput): Promise<Journal> {
  if (isApiMode()) return unwrap(await api.updateJournal(id, input as unknown as Record<string, unknown>))
  return getJournalDemoState().updateJournal(id, input)
}

export async function validateJournal(id: string): Promise<JournalValidationReport> {
  if (isApiMode()) return unwrap(await api.validateJournal(id))
  return getJournalDemoState().validateJournal(id)
}

export async function submitJournal(id: string): Promise<Journal> {
  if (isApiMode()) return unwrap(await api.submitJournal(id))
  return getJournalDemoState().submitJournal(id)
}

export async function cancelJournal(id: string, cancellationReason: string): Promise<Journal> {
  if (isApiMode()) return unwrap(await api.cancelJournal(id, cancellationReason))
  return getJournalDemoState().cancelJournal(id, cancellationReason)
}

export async function getJournalAudit(id: string): Promise<JournalAuditEntry[]> {
  if (isApiMode()) return unwrap(await api.getJournalAudit(id))
  return getJournalDemoState().getJournalAudit(id)
}

export async function postJournal(id: string) {
  if (isApiMode()) return unwrap(await api.postJournal(id))
  return getJournalDemoState().postJournal(id)
}

export async function getJournalLedger(id: string) {
  if (isApiMode()) return unwrap(await api.getJournalLedger(id))
  return getJournalDemoState().getJournalLedger(id)
}
