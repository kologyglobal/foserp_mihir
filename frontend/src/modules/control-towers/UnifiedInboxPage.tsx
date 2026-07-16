import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { OperationalPageShell } from '../../components/design-system/OperationalPageShell'
import { DataGrid } from '../../components/design-system/DataGrid'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useUnifiedInbox, type InboxItem } from '../../utils/controlTowerMetrics'
import { CONTROL_TOWER_ROUTES } from '../../config/controlTowerRoutes'
import { cn } from '../../utils/cn'

type InboxTab = 'work' | 'approvals' | 'tasks' | 'alerts'

const TAB_LABELS: Record<InboxTab, string> = {
  work: 'My Work',
  approvals: 'My Approvals',
  tasks: 'My Tasks',
  alerts: 'My Alerts',
}

export function UnifiedInboxPage() {
  const navigate = useNavigate()
  const inbox = useUnifiedInbox()
  const [tab, setTab] = useState<InboxTab>('work')

  const lists: Record<InboxTab, InboxItem[]> = {
    work: inbox.work,
    approvals: inbox.approvals,
    tasks: inbox.tasks,
    alerts: inbox.alerts,
  }

  const columns = useMemo<ColumnDef<InboxItem, unknown>[]>(
    () => [
      {
        id: 'severity',
        header: '',
        cell: ({ row }) => (
          <span
            className={cn(
              'inline-block h-2 w-2 rounded-full',
              row.original.severity === 'red' && 'bg-erp-danger-solid',
              row.original.severity === 'amber' && 'bg-erp-warning-solid',
              row.original.severity === 'green' && 'bg-erp-success-solid',
            )}
          />
        ),
      },
      { accessorKey: 'title', header: 'Item' },
      { accessorKey: 'description', header: 'Detail' },
      { accessorKey: 'module', header: 'Module', cell: ({ row }) => <StatusBadge status={row.original.module} /> },
    ],
    [],
  )

  return (
    <OperationalPageShell
      title="Unified Inbox"
      description="Approvals, tasks, alerts, and prioritized work across every module."
      badge={`${inbox.counts.work} items`}
      favoritePath={CONTROL_TOWER_ROUTES.inbox}
      insights={[
        { label: 'My Work', value: inbox.counts.work, accent: 'blue' },
        { label: 'Approvals', value: inbox.counts.approvals, accent: 'amber' },
        { label: 'Tasks', value: inbox.counts.tasks, accent: 'blue' },
        { label: 'Alerts', value: inbox.counts.alerts, accent: inbox.counts.alerts ? 'amber' : 'green' },
        { label: 'QC Pending', value: inbox.counts.qcPending, accent: 'amber' },
        { label: 'PO Approval', value: inbox.counts.poApprovalPending, accent: 'amber' },
        { label: 'Dispatch Pending', value: inbox.counts.dispatchPending, accent: 'blue' },
        { label: 'Payment Pending', value: inbox.counts.paymentPending, accent: 'amber' },
        { label: 'Delayed WO', value: inbox.counts.delayedWorkOrders, accent: inbox.counts.delayedWorkOrders ? 'red' : 'green' },
      ]}
    >
      <div className="mb-4 flex flex-wrap gap-2">
        {(Object.keys(TAB_LABELS) as InboxTab[]).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              'rounded-lg border px-3 py-2 text-[12px] font-semibold transition-colors',
              tab === id ? 'border-erp-primary bg-erp-primary-soft text-erp-primary' : 'border-erp-border text-erp-muted hover:border-erp-primary/40',
            )}
          >
            {TAB_LABELS[id]} ({lists[id].length})
          </button>
        ))}
      </div>

      <DataGrid
        data={lists[tab]}
        columns={columns}
        compact
        emptyMessage="Inbox clear — nothing pending in this queue."
        onRowView={(row) => navigate(row.href)}
      />
    </OperationalPageShell>
  )
}
