import { useCallback, useEffect, useState } from 'react'
import { Check, ClipboardCheck, RefreshCw, RotateCcw, ShieldOff, X } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { ErpButton } from '@/components/erp/ErpButton'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import { EmptyState } from '@/components/ui/EmptyState'
import { SearchInput } from '@/components/ui/SearchInput'
import { formatDateTime } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { appPromptNote } from '@/store/confirmDialogStore'
import { useGatePermissions } from '@/utils/permissions/gate'
import { gateService } from '../api/gateService'
import type { GateApproval, GateApprovalType } from '../types/gate.types'
import { GateDataStates, GateDrawer, GateStatusBadge } from '../components'
import type { GateLoadState } from '../components'
import { GATE_BREADCRUMB } from '../gateUi'

const APPROVAL_TYPE_LABELS: Record<GateApprovalType, string> = {
  walk_in_visitor: 'Walk-in visitor',
  inward_without_po: 'Material inward without PO',
  material_outward: 'Material outward',
  returnable_gate_pass: 'Returnable gate pass',
  asset_movement: 'Asset movement',
  scrap_outward: 'Scrap outward',
  contractor_after_hours: 'Contractor after-hours entry',
  blacklist_override: 'Blacklist override',
}

const PRIORITY_TONE: Record<GateApproval['priority'], string> = {
  low: 'text-erp-muted',
  normal: 'text-erp-text',
  high: 'font-semibold text-amber-700',
  urgent: 'font-semibold text-rose-700',
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-[12px] text-erp-muted">{label}</dt>
      <dd className="text-[13px] font-medium text-erp-text">{value ?? '—'}</dd>
    </div>
  )
}

export function GateApprovalsPage() {
  const perms = useGatePermissions()
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<GateApproval[]>([])
  const [selected, setSelected] = useState<GateApproval | null>(null)
  const [state, setState] = useState<GateLoadState>('loading')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setState('loading')
    setError('')
    try {
      const data = await gateService.getGateApprovals({ search: search || undefined })
      setRows(data)
      setState(data.length === 0 ? 'empty' : 'ready')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load approvals')
      setState('error')
    }
  }, [search])

  useEffect(() => {
    void load()
  }, [load])

  const refreshSelected = (updated: GateApproval) => {
    setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
    setSelected(updated)
  }

  const runAction = async (
    label: string,
    action: (remarks?: string) => Promise<GateApproval>,
    requireRemarks: boolean,
    promptTitle: string,
  ) => {
    if (!selected || busy) return
    let remarks: string | undefined
    if (requireRemarks) {
      const note = await appPromptNote({
        title: promptTitle,
        description: 'Remarks are mandatory for this action.',
        confirmLabel: label,
        tone: label === 'Approve' ? undefined : 'danger',
        note: { required: true, label: 'Remarks' },
      })
      if (note == null) return
      remarks = note
    }
    setBusy(true)
    try {
      const updated = await action(remarks)
      refreshSelected(updated)
      notify.success(`${label} recorded for ${updated.requestNumber}.`)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  const approve = () =>
    runAction(
      'Approve',
      (remarks) => gateService.approveGateRequest(selected!.id, remarks),
      selected?.requestType === 'blacklist_override',
      'Approve request',
    )

  const reject = () =>
    runAction('Reject', (remarks) => gateService.rejectGateRequest(selected!.id, remarks!), true, 'Reject request')

  const sendBack = () =>
    runAction('Send Back', (remarks) => gateService.sendBackGateRequest(selected!.id, remarks!), true, 'Send back request')

  const pendingSelected = selected?.status === 'pending'

  if (!perms.canViewApprovals) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Gate & Security" title="Approvals" autoBreadcrumbs={false}>
        <EmptyState icon={ShieldOff} title="Access denied" description="You do not have permission to view gate approvals." />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Gate & Security"
      title="Approval Workspace"
      description="Review and action gate exceptions — walk-ins, inward without PO, outward releases, passes and overrides."
      showDescription
      autoBreadcrumbs={false}
      breadcrumbs={[...GATE_BREADCRUMB, { label: 'Approvals' }]}
      favoritePath="/gate/approvals"
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[
            { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() },
          ]}
        />
      )}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-erp-border bg-white px-3 py-2">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search request no., subject, requester, reason…"
          className="w-80"
          aria-label="Search approvals"
        />
      </div>

      <div className="p-3">
        <GateDataStates
          state={state}
          error={error}
          onRetry={() => void load()}
          emptyIcon={ClipboardCheck}
          emptyTitle="No approval requests"
          emptyDescription="Pending walk-ins, inward exceptions and outward releases appear here."
        >
          <EnterpriseRegisterTableShell>
            <table className="erp-table w-full text-[12.5px]">
              <thead>
                <tr>
                  <th>Request No.</th>
                  <th>Type</th>
                  <th>Requested By</th>
                  <th>Subject</th>
                  <th>Reason</th>
                  <th>Requested At</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="tabular-nums font-medium">{r.requestNumber}</td>
                    <td>{APPROVAL_TYPE_LABELS[r.requestType]}</td>
                    <td className="max-w-[140px] truncate">{r.requestedBy}</td>
                    <td className="max-w-[160px] truncate">{r.subject}</td>
                    <td className="max-w-[180px] truncate">{r.reason}</td>
                    <td className="whitespace-nowrap">{formatDateTime(r.requestedAt)}</td>
                    <td className={PRIORITY_TONE[r.priority]}>{r.priority}</td>
                    <td>
                      <GateStatusBadge status={r.status} />
                    </td>
                    <td>
                      <ErpButton size="sm" variant="ghost" onClick={() => setSelected(r)}>
                        View
                      </ErpButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </EnterpriseRegisterTableShell>
        </GateDataStates>
      </div>

      <GateDrawer
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.requestNumber ?? 'Approval request'}
        subtitle={selected ? APPROVAL_TYPE_LABELS[selected.requestType] : undefined}
        footer={
          selected && pendingSelected && perms.canActionApprovals ? (
            <div className="flex flex-wrap justify-end gap-2">
              <ErpButton variant="secondary" icon={RotateCcw} disabled={busy} onClick={() => void sendBack()}>
                Send Back
              </ErpButton>
              <ErpButton variant="danger" icon={X} disabled={busy} onClick={() => void reject()}>
                Reject
              </ErpButton>
              <ErpButton icon={Check} disabled={busy} onClick={() => void approve()}>
                Approve
              </ErpButton>
            </div>
          ) : undefined
        }
      >
        {selected ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <GateStatusBadge status={selected.status} />
              <span className={`text-[12px] capitalize ${PRIORITY_TONE[selected.priority]}`}>
                {selected.priority} priority
              </span>
            </div>
            <dl className="grid gap-3 sm:grid-cols-2">
              <Field label="Requested by" value={selected.requestedBy} />
              <Field label="Requested at" value={formatDateTime(selected.requestedAt)} />
              <Field label="Subject" value={selected.subject} />
              <Field label="Source type" value={selected.sourceType.replace(/_/g, ' ')} />
            </dl>
            <div>
              <dt className="text-[12px] text-erp-muted">Reason</dt>
              <dd className="mt-1 text-[13px] text-erp-text">{selected.reason}</dd>
            </div>
            {selected.actionedBy ? (
              <div className="rounded-md border border-erp-border bg-erp-surface-alt/40 p-3 text-[13px]">
                <p>
                  <span className="text-erp-muted">Actioned by:</span> {selected.actionedBy}
                  {selected.actionedAt ? ` · ${formatDateTime(selected.actionedAt)}` : ''}
                </p>
                {selected.actionRemarks ? (
                  <p className="mt-1">
                    <span className="text-erp-muted">Remarks:</span> {selected.actionRemarks}
                  </p>
                ) : null}
              </div>
            ) : null}
            {selected.requestType === 'blacklist_override' && pendingSelected ? (
              <p className="text-[12px] text-amber-700">Blacklist override approvals require mandatory remarks.</p>
            ) : null}
          </div>
        ) : null}
      </GateDrawer>
    </OperationalPageShell>
  )
}
