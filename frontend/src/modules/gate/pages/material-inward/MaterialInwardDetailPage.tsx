import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { RefreshCw, ShieldOff } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatDateTime } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { appPromptNote } from '@/store/confirmDialogStore'
import { useGatePermissions } from '@/utils/permissions/gate'
import { gateService } from '../../api/gateService'
import type { MaterialInwardEntry, MaterialInwardStatus } from '../../types/gate.types'
import { GateBoundaryBanner, GateDataStates, GateStatusBadge, InsideDuration } from '../../components'
import type { GateLoadState } from '../../components'
import { GATE_BREADCRUMB } from '../../gateUi'

function Field({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <dt className="text-[12px] text-erp-muted">{label}</dt>
      <dd className="text-[13px] font-medium text-erp-text">{value ?? '—'}</dd>
    </div>
  )
}

const NEXT_STATUS: Partial<Record<MaterialInwardStatus, MaterialInwardStatus>> = {
  draft: 'vehicle_arrived',
  vehicle_arrived: 'documents_verified',
  documents_verified: 'waiting_unloading',
  waiting_unloading: 'waiting_store',
  waiting_store: 'waiting_qc',
  waiting_qc: 'waiting_grn',
}

export function MaterialInwardDetailPage() {
  const { id } = useParams<{ id: string }>()
  const perms = useGatePermissions()
  const [entry, setEntry] = useState<MaterialInwardEntry | null>(null)
  const [state, setState] = useState<GateLoadState>('loading')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setState('loading')
    setError('')
    try {
      setEntry(await gateService.getMaterialInwardById(id))
      setState('ready')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load inward entry')
      setState('error')
    }
  }, [id])

  useEffect(() => { void load() }, [load])

  const advance = async () => {
    if (!entry || busy) return
    const next = NEXT_STATUS[entry.status]
    if (!next) return
    setBusy(true)
    try {
      setEntry(await gateService.updateMaterialInwardStatus(entry.id, next))
      notify.success(`Status updated to ${next.replace(/_/g, ' ')}.`)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Could not update status')
    } finally {
      setBusy(false)
    }
  }

  const cancel = async () => {
    if (!entry) return
    const remarks = await appPromptNote({
      title: 'Cancel material inward',
      description: 'Cancellation remarks are required.',
      confirmLabel: 'Cancel Entry',
      tone: 'danger',
      note: { required: true, label: 'Remarks' },
    })
    if (remarks == null) return
    setBusy(true)
    try {
      setEntry(await gateService.cancelMaterialInward(entry.id, remarks))
      notify.success('Inward entry cancelled.')
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Could not cancel')
    } finally {
      setBusy(false)
    }
  }

  const next = entry ? NEXT_STATUS[entry.status] : undefined
  const isReadOnly = entry ? ['closed', 'cancelled', 'rejected', 'accepted'].includes(entry.status) : false

  return (
    <OperationalPageShell
      variant="dynamics" layout="enterprise" badge="Gate & Security"
      title={entry ? entry.entryNumber : 'Material Inward'}
      autoBreadcrumbs={false}
      breadcrumbs={[...GATE_BREADCRUMB, { label: 'Material Inward', to: '/gate/material-inward' }, { label: entry?.entryNumber ?? '…' }]}
      backLink={{ to: '/gate/material-inward', label: 'Back to Material Inward' }}
      commandBar={(
        <ErpCommandBar
          inline sticky={false}
          primaryAction={perms.canEditInward && next ? { id: 'advance', label: `Mark ${next.replace(/_/g, ' ')}`, variant: 'primary', disabled: busy, onClick: () => void advance() } : undefined}
          secondaryActions={[
            { id: 'cancel', label: 'Cancel Entry', hidden: !perms.canEditInward || isReadOnly, disabled: busy, onClick: () => void cancel() },
            { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() },
          ]}
        />
      )}
    >
      <div className="space-y-3 p-4">
        <GateBoundaryBanner message="Gate entry records physical material arrival only. Inventory will be updated after Store completes the GRN." />
        {!perms.canViewInward ? (
          <EmptyState icon={ShieldOff} title="Access denied" description="You do not have permission to view material inward." />
        ) : (
          <GateDataStates state={state} error={error} onRetry={() => void load()} loadingVariant="form">
            {entry ? (
              <div className="grid gap-3 xl:grid-cols-3">
                <section className="rounded-md border border-erp-border bg-white p-4 xl:col-span-2">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <h3 className="text-[14px] font-semibold text-erp-text">Gate entry summary</h3>
                    <GateStatusBadge status={entry.status} />
                  </div>
                  <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
                    <Field label="Vendor" value={entry.vendorName} />
                    <Field label="Inward type" value={entry.inwardType.replace(/_/g, ' ')} />
                    <Field label="PO" value={entry.poNumber} />
                    <Field label="Challan" value={entry.challanNumber} />
                    <Field label="Invoice" value={entry.invoiceNumber} />
                    <Field label="LR" value={entry.lrNumber} />
                    <Field label="Vehicle" value={entry.vehicleNumber} />
                    <Field label="Driver" value={entry.driverName} />
                    <Field label="Seal" value={entry.sealNumber} />
                    <Field label="Material" value={entry.materialSummary} />
                    <Field label="Packages" value={entry.packages} />
                    <Field label="Warehouse" value={entry.warehouse} />
                    <Field label="Arrival" value={entry.arrivalTime ? formatDateTime(entry.arrivalTime) : '—'} />
                    <div>
                      <dt className="text-[12px] text-erp-muted">Waiting</dt>
                      <dd className="text-[13px] font-medium"><InsideDuration from={entry.arrivalTime} warnAfterMinutes={60} /></dd>
                    </div>
                    <Field label="Gate" value={entry.gate} />
                    <Field label="Remarks" value={entry.remarks} />
                  </dl>
                </section>
                <div className="space-y-3">
                  <section className="rounded-md border border-erp-border bg-white p-4">
                    <h3 className="mb-2 text-[13px] font-semibold text-erp-text">Linked documents</h3>
                    <dl className="space-y-2 text-[13px]">
                      <div className="flex justify-between gap-2"><dt className="text-erp-muted">PO</dt><dd className="font-medium">{entry.poNumber ?? '—'}</dd></div>
                      <div className="flex justify-between gap-2"><dt className="text-erp-muted">GRN</dt><dd className="font-medium text-erp-muted">{entry.linkedGrnNumber ?? 'Pending Store'}</dd></div>
                      <div className="flex justify-between gap-2"><dt className="text-erp-muted">Quality Inspection</dt><dd className="font-medium text-erp-muted">{entry.linkedQcNumber ?? 'Pending QC'}</dd></div>
                    </dl>
                    <p className="mt-2 text-[11.5px] text-erp-muted">Gate does not create GRN or QC — those stay in Store and Quality.</p>
                  </section>
                  <section className="rounded-md border border-erp-border bg-white p-4">
                    <h3 className="mb-2 text-[13px] font-semibold text-erp-text">Status timeline</h3>
                    {entry.timeline.length === 0 ? <p className="text-[13px] text-erp-muted">No timeline events yet.</p> : (
                      <ol className="space-y-2">
                        {entry.timeline.map((ev, i) => (
                          <li key={i} className="text-[13px]">
                            <GateStatusBadge status={ev.status} />
                            <span className="mt-0.5 block text-erp-muted">{ev.by} · {formatDateTime(ev.at)}{ev.note ? ` · ${ev.note}` : ''}</span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </section>
                </div>
              </div>
            ) : null}
          </GateDataStates>
        )}
      </div>
    </OperationalPageShell>
  )
}
