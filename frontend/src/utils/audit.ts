import type { ApprovalStamp, AuditStamp, AuditTrail } from '../types/audit'
import { getSessionUser } from './permissions'

export function stampCreated(): AuditStamp & ApprovalStamp {
  const user = getSessionUser()
  const ts = new Date().toISOString()
  return {
    createdById: user.id,
    createdByName: user.name,
    createdAt: ts,
    modifiedById: null,
    modifiedByName: null,
    modifiedAt: null,
    approvedById: null,
    approvedByName: null,
    approvedAt: null,
  }
}

export function stampModified(_existing: AuditTrail): Pick<AuditTrail, 'modifiedById' | 'modifiedByName' | 'modifiedAt'> {
  const user = getSessionUser()
  return {
    modifiedById: user.id,
    modifiedByName: user.name,
    modifiedAt: new Date().toISOString(),
  }
}

export function stampApproved(): ApprovalStamp {
  const user = getSessionUser()
  return {
    approvedById: user.id,
    approvedByName: user.name,
    approvedAt: new Date().toISOString(),
  }
}

export function mergeAudit<T extends AuditTrail>(doc: T, patch: Partial<T>): T {
  return { ...doc, ...patch }
}
