import type { ProductionAssignment } from '@/types/manufacturingPhase2b'
import { ASSIGNMENT_STATUS_LABELS } from '@/types/manufacturingPhase2b'
import { formatDateTime } from '@/utils/dates/format'
import { t } from '../../i18n/operatorStrings'

interface AssignmentHistoryProps {
  assignments: ProductionAssignment[]
}

/** Reassignment chain timeline for a production assignment. */
export function AssignmentHistory({ assignments }: AssignmentHistoryProps) {
  if (assignments.length === 0) {
    return <p className="text-[13px] text-erp-muted">{t('assignment.noAssignments')}</p>
  }

  return (
    <div>
      <h4 className="mb-2 text-[13px] font-semibold text-erp-text">{t('assignment.history')}</h4>
      <ol className="space-y-2">
        {assignments.map((a) => (
          <li key={a.id} className="rounded-lg border border-erp-border px-3 py-2 text-[12px]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-erp-primary">{a.id.slice(0, 8)}…</span>
              <span className="font-semibold">{ASSIGNMENT_STATUS_LABELS[a.status]}</span>
            </div>
            <p className="mt-1 text-erp-muted">
              Qty {a.assignedQuantity} · {a.stage?.name ?? a.stageId.slice(0, 8)}
              {a.machine ? ` · ${a.machine.name}` : ''}
            </p>
            <p className="text-[11px] text-erp-muted">{formatDateTime(a.createdAt)}</p>
          </li>
        ))}
      </ol>
    </div>
  )
}
