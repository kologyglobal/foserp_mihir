export interface AuditUserNames {
  createdByName?: string
  modifiedByName?: string
  ownerName?: string
  leadOwnerName?: string
}

export function mapAuditFields(
  row: {
    createdBy: string | null
    updatedBy: string | null
    createdAt: Date
    updatedAt: Date
  },
  names?: AuditUserNames,
) {
  return {
    createdById: row.createdBy ?? '',
    createdByName: names?.createdByName ?? '',
    createdAt: row.createdAt.toISOString(),
    modifiedById: row.updatedBy,
    modifiedByName: names?.modifiedByName ?? null,
    modifiedAt: row.updatedAt.toISOString(),
    approvedById: null as string | null,
    approvedByName: null as string | null,
    approvedAt: null as string | null,
  }
}
