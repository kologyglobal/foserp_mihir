import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Hand, RefreshCw, ShieldOff } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { ErpButton } from '@/components/erp/ErpButton'
import { EmptyState } from '@/components/ui/EmptyState'
import { FormField } from '@/components/forms/FormField'
import { Input } from '@/components/forms/Inputs'
import { formatDateTime } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { useGatePermissions } from '@/utils/permissions/gate'
import { gateService } from '../../api/gateService'
import type { CourierEntry } from '../../types/gate.types'
import { GateDataStates, GateModal, GateStatusBadge } from '../../components'
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

export function CourierDetailPage() {
  const { id } = useParams<{ id: string }>()
  const perms = useGatePermissions()
  const [record, setRecord] = useState<CourierEntry | null>(null)
  const [state, setState] = useState<GateLoadState>('loading')
  const [error, setError] = useState('')
  const [handoverOpen, setHandoverOpen] = useState(false)
  const [handedOverTo, setHandedOverTo] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setState('loading')
    setError('')
    try {
      setRecord(await gateService.getCourierById(id))
      setState('ready')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load courier record')
      setState('error')
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const confirmHandover = async () => {
    if (!record || busy) return
    if (!handedOverTo.trim()) {
      notify.warning('Receiver name is required for handover.')
      return
    }
    setBusy(true)
    try {
      setRecord(await gateService.markCourierHandedOver(record.id, handedOverTo.trim()))
      notify.success('Parcel handed over.')
      setHandoverOpen(false)
      setHandedOverTo('')
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Handover failed')
    } finally {
      setBusy(false)
    }
  }

  const canHandover =
    perms.canCourierHandover &&
    record?.direction === 'incoming' &&
    record.status === 'pending_handover'

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Gate & Security"
      title={record ? record.entryNumber : 'Courier'}
      autoBreadcrumbs={false}
      breadcrumbs={[...GATE_BREADCRUMB, { label: 'Couriers', to: '/gate/couriers' }, { label: record?.entryNumber ?? '…' }]}
      backLink={{ to: '/gate/couriers', label: 'Back to Couriers' }}
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={
            canHandover
              ? { id: 'handover', label: 'Hand Over Parcel', icon: Hand, variant: 'primary', onClick: () => setHandoverOpen(true) }
              : undefined
          }
          secondaryActions={[
            { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() },
          ]}
        />
      )}
    >
      <div className="space-y-3 p-4">
        {!perms.canViewCourier ? (
          <EmptyState icon={ShieldOff} title="Access denied" description="You do not have permission to view courier records." />
        ) : (
          <GateDataStates state={state} error={error} onRetry={() => void load()} loadingVariant="form">
            {record ? (
              <section className="rounded-md border border-erp-border bg-white p-4">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <h3 className="text-[14px] font-semibold text-erp-text">
                    {record.courierCompany}
                    {record.trackingNumber ? ` · ${record.trackingNumber}` : ''}
                  </h3>
                  <GateStatusBadge status={record.status} />
                  <span className="rounded bg-erp-surface-alt px-2 py-0.5 text-[11px] font-medium capitalize text-erp-muted">
                    {record.direction}
                  </span>
                </div>
                <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
                  <Field label="Entry number" value={record.entryNumber} />
                  <Field label="Sender" value={record.senderName} />
                  <Field label="Recipient employee" value={record.recipientEmployee} />
                  <Field label="Department" value={record.department} />
                  <Field label="Parcel type" value={record.parcelType} />
                  <Field label="Parcel description" value={record.parcelDescription} />
                  <Field label="Received time" value={record.receivedTime ? formatDateTime(record.receivedTime) : null} />
                  <Field label="Received by" value={record.receivedBy} />
                  <Field label="Dispatch time" value={record.dispatchTime ? formatDateTime(record.dispatchTime) : null} />
                  <Field label="Handover time" value={record.handoverTime ? formatDateTime(record.handoverTime) : null} />
                  <Field label="Handed over to" value={record.handedOverTo} />
                  <Field label="Charges" value={record.charges != null ? `₹ ${record.charges}` : null} />
                  <Field label="Gate" value={record.gate} />
                </dl>
                {record.remarks ? (
                  <p className="mt-3 text-[13px] text-erp-muted">
                    <span className="font-medium text-erp-text">Remarks:</span> {record.remarks}
                  </p>
                ) : null}
              </section>
            ) : null}
          </GateDataStates>
        )}
      </div>

      <GateModal
        open={handoverOpen}
        onClose={() => setHandoverOpen(false)}
        title="Hand Over Parcel"
        subtitle={record ? `${record.entryNumber} · ${record.recipientEmployee ?? 'Recipient'}` : undefined}
        footer={
          <div className="flex justify-end gap-2">
            <ErpButton variant="secondary" onClick={() => setHandoverOpen(false)} disabled={busy}>
              Cancel
            </ErpButton>
            <ErpButton icon={Hand} onClick={() => void confirmHandover()} loading={busy} disabled={busy || !handedOverTo.trim()}>
              Confirm Handover
            </ErpButton>
          </div>
        }
      >
        {record ? (
          <div className="space-y-3 text-[13px]">
            <p>
              <span className="text-erp-muted">From:</span>{' '}
              <span className="font-medium">{record.senderName ?? record.courierCompany}</span>
            </p>
            <p>
              <span className="text-erp-muted">Received:</span>{' '}
              {record.receivedTime ? formatDateTime(record.receivedTime) : '—'} by {record.receivedBy ?? '—'}
            </p>
            <FormField label="Handed over to" required>
              <Input
                value={handedOverTo}
                onChange={(e) => setHandedOverTo(e.target.value)}
                placeholder={record.recipientEmployee ?? 'Employee name'}
                autoFocus
              />
            </FormField>
          </div>
        ) : null}
      </GateModal>
    </OperationalPageShell>
  )
}
