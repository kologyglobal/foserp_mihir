import type { EnterpriseDocumentStripField } from '../design-system/workspace/types'
import type { MasterRecordAudit } from '../types/master'
import { getLeadUser } from '../data/crm/leadUsers'
import { getSessionUser } from './permissions'
import { formatDate, formatDateTime } from './dates/format'
const LEGACY_CREATOR_ID = 'legacy'
const LEGACY_CREATOR_NAME = 'System'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isUserId(value: string): boolean {
  return UUID_RE.test(value) || value.startsWith('user-')
}

/** Resolve audit actor to a display name — never return raw user IDs / UUIDs. */
export function resolveAuditActorName(
  ...candidates: Array<string | null | undefined>
): string {
  for (const raw of candidates) {
    if (!raw?.trim()) continue
    const value = raw.trim()
    if (!isUserId(value)) return value
    const session = getSessionUser()
    if (session.id === value && session.name) return session.name
    const known = getLeadUser(value)
    if (known?.name) return known.name
  }
  return '—'
}

export function stampMasterCreated(): MasterRecordAudit & { createdAt: string } {
  const user = getSessionUser()
  const ts = new Date().toISOString()
  return {
    createdById: user.id,
    createdByName: user.name,
    createdAt: ts,
    modifiedById: null,
    modifiedByName: null,
    modifiedAt: null,
  }
}

export function stampMasterModified(
  _existing?: Partial<MasterRecordAudit>,
): Pick<MasterRecordAudit, 'modifiedById' | 'modifiedByName' | 'modifiedAt'> {
  const user = getSessionUser()
  return {
    modifiedById: user.id,
    modifiedByName: user.name,
    modifiedAt: new Date().toISOString(),
  }
}

/** Backfill audit columns on persisted master rows missing creator metadata. */
export function migrateMasterRecordAudit<T extends Partial<MasterRecordAudit> & { createdAt?: string }>(
  record: T,
): T & MasterRecordAudit & { createdAt: string } {
  const createdAt = record.createdAt ?? new Date().toISOString()
  return {
    ...record,
    createdAt,
    createdById: record.createdById ?? LEGACY_CREATOR_ID,
    createdByName: record.createdByName ?? LEGACY_CREATOR_NAME,
    modifiedById: record.modifiedById ?? null,
    modifiedByName: record.modifiedByName ?? null,
    modifiedAt: record.modifiedAt ?? null,
  }
}

export function mergeMasterAuditArrays<T extends Partial<MasterRecordAudit> & { createdAt?: string }>(
  rows: T[],
): Array<T & MasterRecordAudit & { createdAt: string }> {
  return rows.map(migrateMasterRecordAudit)
}

export type RecordAuditView = Partial<MasterRecordAudit & { createdAt?: string }>

export function resolveRecordCreatedBy(audit: RecordAuditView, pendingUserName?: string): string {
  return audit.createdByName ?? pendingUserName ?? getSessionUser().name
}

export function resolveRecordCreatedDate(audit: RecordAuditView): string {
  if (audit.createdAt) return formatDate(audit.createdAt)
  return formatDate(new Date().toISOString())
}

export function resolveRecordModifiedLabel(audit: RecordAuditView): string | undefined {
  if (!audit.modifiedAt) return undefined
  const by = audit.modifiedByName ? ` · ${audit.modifiedByName}` : ''
  return `${formatDateTime(audit.modifiedAt)}${by}`
}

/** Row shape for master register list tables (global + purchase-native). */
export type AuditableListRow = RecordAuditView & {
  updatedAt?: string
  /** Purchase-native master fields */
  createdBy?: string
  modifiedBy?: string
}

export function resolveRecordUpdatedOn(row: AuditableListRow): string {
  const ts = row.modifiedAt ?? row.updatedAt ?? row.createdAt
  return ts ? formatDate(ts) : '—'
}

/** User name + timestamp for Updated By list cells. */
export function resolveRecordUpdatedBy(row: AuditableListRow): string {
  const name = resolveAuditActorName(
    row.modifiedByName,
    row.modifiedBy,
    row.createdByName,
    row.createdBy,
  )
  const ts = row.modifiedAt ?? row.updatedAt ?? row.createdAt
  if (name === '—' && !ts) return '—'
  if (name === '—') return ts ? formatDateTime(ts) : '—'
  if (!ts) return name
  return `${name} · ${formatDateTime(ts)}`
}

export function resolveRecordCreatedOnForList(row: AuditableListRow): string {
  return row.createdAt ? formatDate(row.createdAt) : '—'
}

export function resolveRecordCreatedByForList(row: AuditableListRow): string {
  return resolveAuditActorName(row.createdByName, row.createdBy)
}

/** Document strip fields for created / modified metadata (prepended when absent). */
export function buildRecordAuditStripFields(
  audit: RecordAuditView,
  options?: { pendingUserName?: string; includeModified?: boolean },
): EnterpriseDocumentStripField[] {
  const createdBy = resolveRecordCreatedBy(audit, options?.pendingUserName)
  const fields: EnterpriseDocumentStripField[] = [
    { label: 'Created On', value: resolveRecordCreatedDate(audit), highlight: Boolean(audit.createdAt) },
    { label: 'Created By', value: createdBy, highlight: Boolean(audit.createdByName) },
  ]
  if (options?.includeModified !== false && audit.modifiedAt) {
    fields.push({
      label: 'Last Modified',
      value: resolveRecordModifiedLabel(audit) ?? '—',
      highlight: true,
    })
  }
  return fields
}

export function appendAuditStripFields(
  strip: EnterpriseDocumentStripField[],
  audit: RecordAuditView,
  options?: { pendingUserName?: string },
): EnterpriseDocumentStripField[] {
  const auditFields = buildRecordAuditStripFields(audit, options)
  const labels = new Set(strip.map((f) => f.label))
  const merged = [...auditFields.filter((f) => !labels.has(f.label)), ...strip]
  return merged
}
