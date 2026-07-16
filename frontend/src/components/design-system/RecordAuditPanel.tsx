import type { RecordAuditView } from '../../utils/masterAudit'
import {
  resolveRecordCreatedBy,
  resolveRecordCreatedDate,
  resolveRecordModifiedLabel,
} from '../../utils/masterAudit'

export function RecordAuditPanel({
  audit,
  pendingUserName,
  className,
}: {
  audit: RecordAuditView
  pendingUserName?: string
  className?: string
}) {
  const modified = resolveRecordModifiedLabel(audit)

  return (
    <div className={className ?? 'rounded-lg border border-erp-border bg-erp-surface-alt/40 px-3 py-2.5 text-[12px]'}>
      <dl className="grid gap-1.5 sm:grid-cols-2">
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-erp-muted">Created on</dt>
          <dd className="font-medium text-erp-text">{resolveRecordCreatedDate(audit)}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-erp-muted">Created by</dt>
          <dd className="font-medium text-erp-text">{resolveRecordCreatedBy(audit, pendingUserName)}</dd>
        </div>
        {modified ? (
          <div className="sm:col-span-2">
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-erp-muted">Last modified</dt>
            <dd className="font-medium text-erp-text">{modified}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  )
}
