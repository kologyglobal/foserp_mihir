import type { CrmMasterAuditEvent, CrmMasterEntry, CrmMasterKind } from '../types/crmMasters'

const DEFAULT_USER = 'Demo User'

export function appendAudit(
  entry: CrmMasterEntry,
  action: CrmMasterAuditEvent['action'],
  detail?: string,
  by = DEFAULT_USER,
): CrmMasterAuditEvent[] {
  const event: CrmMasterAuditEvent = { action, at: new Date().toISOString(), by, detail }
  return [...(entry.auditHistory ?? []), event]
}

export function stampCreated(): Pick<CrmMasterEntry, 'createdBy' | 'modifiedBy' | 'auditHistory'> {
  const ts = new Date().toISOString()
  return {
    createdBy: DEFAULT_USER,
    modifiedBy: DEFAULT_USER,
    auditHistory: [{ action: 'created', at: ts, by: DEFAULT_USER }],
  }
}

export function duplicateMasterCode(kind: CrmMasterKind, code: string, entries: CrmMasterEntry[]): string {
  let candidate = `${code}_copy`
  let n = 2
  while (entries.some((e) => e.kind === kind && e.code === candidate)) {
    candidate = `${code}_copy_${n}`
    n += 1
  }
  return candidate
}

export function duplicateMasterName(name: string): string {
  return `${name} (Copy)`
}
