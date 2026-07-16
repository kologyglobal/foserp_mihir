/** Standard audit columns for production-ready documents */
export interface AuditTrail {
  createdById: string
  createdByName: string
  createdAt: string
  modifiedById: string | null
  modifiedByName: string | null
  modifiedAt: string | null
  approvedById: string | null
  approvedByName: string | null
  approvedAt: string | null
}

export type AuditStamp = Pick<
  AuditTrail,
  'createdById' | 'createdByName' | 'createdAt' | 'modifiedById' | 'modifiedByName' | 'modifiedAt'
>

export type ApprovalStamp = Pick<AuditTrail, 'approvedById' | 'approvedByName' | 'approvedAt'>
