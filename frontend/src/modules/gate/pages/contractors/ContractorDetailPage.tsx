import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { LogOut, RefreshCw, ShieldOff } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { ErpButton } from '@/components/erp/ErpButton'
import { EmptyState } from '@/components/ui/EmptyState'
import { FormField } from '@/components/forms/FormField'
import { Textarea } from '@/components/forms/Inputs'
import { formatDate, formatDateTime } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { useGatePermissions } from '@/utils/permissions/gate'
import { gateService } from '../../api/gateService'
import type { ContractorEntry } from '../../types/gate.types'
import {
  isContractorPassExpired,
  isContractorPassExpiringToday,
} from '../../utils/gateStatus'
import { GateDataStates, GateModal, GateStatusBadge, InsideDuration, OverdueIndicator } from '../../components'
import type { GateLoadState } from '../../components'
import { GATE_BREADCRUMB } from '../../gateUi'

function Field({ label, value }: { label: string; value?: string | number | boolean | null }) {
  const display =
    typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value ?? '—'
  return (
    <div>
      <dt className="text-[12px] text-erp-muted">{label}</dt>
      <dd className="text-[13px] font-medium text-erp-text">{display}</dd>
    </div>
  )
}

export function ContractorDetailPage() {
  const { id } = useParams<{ id: string }>()
  const perms = useGatePermissions()
  const [record, setRecord] = useState<ContractorEntry | null>(null)
  const [state, setState] = useState<GateLoadState>('loading')
  const [error, setError] = useState('')
  const [exitOpen, setExitOpen] = useState(false)
  const [exitRemarks, setExitRemarks] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setState('loading')
    setError('')
    try {
      setRecord(await gateService.getContractorById(id))
      setState('ready')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load contractor record')
      setState('error')
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const confirmExit = async () => {
    if (!record || busy) return
    setBusy(true)
    try {
      setRecord(await gateService.recordContractorExit(record.id, exitRemarks.trim() || undefined))
      notify.success(`Exit recorded for ${record.workerName}.`)
      setExitOpen(false)
      setExitRemarks('')
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Could not record exit')
    } finally {
      setBusy(false)
    }
  }

  const expired = record ? isContractorPassExpired(record.validUntil) : false
  const expiringToday = record ? isContractorPassExpiringToday(record.validUntil) : false
  const isReadOnly = record ? ['exited', 'cancelled'].includes(record.status) : false

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Gate & Security"
      title={record ? record.workerName : 'Contractor'}
      autoBreadcrumbs={false}
      breadcrumbs={[...GATE_BREADCRUMB, { label: 'Contractors', to: '/gate/contractors' }, { label: record?.entryNumber ?? '…' }]}
      backLink={{ to: '/gate/contractors', label: 'Back to Contractors' }}
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={
            perms.canContractorExit && record?.status === 'inside'
              ? { id: 'exit', label: 'Record Exit', icon: LogOut, variant: 'primary', onClick: () => setExitOpen(true) }
              : undefined
          }
          secondaryActions={[
            { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() },
          ]}
        />
      )}
    >
      <div className="space-y-3 p-4">
        {!perms.canViewContractor ? (
          <EmptyState icon={ShieldOff} title="Access denied" description="You do not have permission to view contractor records." />
        ) : (
          <GateDataStates state={state} error={error} onRetry={() => void load()} loadingVariant="form">
            {record ? (
              <>
                {record.status === 'inside' && (expired || expiringToday || !record.safetyInductionDone) ? (
                  <div className="space-y-2">
                    {expired ? (
                      <div className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] font-medium text-rose-800">
                        <OverdueIndicator /> Work pass expired on {formatDate(record.validUntil)} — verify before allowing continued access.
                      </div>
                    ) : null}
                    {!expired && expiringToday ? (
                      <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] font-medium text-amber-800">
                        <OverdueIndicator label="Expires today" /> Pass validity ends today ({formatDate(record.validUntil)}).
                      </div>
                    ) : null}
                    {!record.safetyInductionDone ? (
                      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] font-medium text-amber-800">
                        Safety induction not recorded — confirm with supervisor before entry.
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <section className="rounded-md border border-erp-border bg-white p-4">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <h3 className="text-[14px] font-semibold text-erp-text">{record.entryNumber}</h3>
                    <GateStatusBadge status={record.status} />
                    {isReadOnly ? <span className="text-[11.5px] font-medium text-erp-muted">Read-only</span> : null}
                  </div>
                  <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
                    <Field label="Worker" value={record.workerName} />
                    <Field label="Mobile" value={record.mobile} />
                    <Field label="Contractor company" value={record.contractorCompany} />
                    <Field label="Work reference" value={record.workReference} />
                    <Field label="Department" value={record.department} />
                    <Field label="Supervisor" value={record.supervisor} />
                    <Field label="Work location" value={record.workLocation} />
                    <Field label="Valid from" value={formatDate(record.validFrom)} />
                    <Field label="Valid until" value={formatDate(record.validUntil)} />
                    <Field label="Purpose" value={record.purpose} />
                    <Field label="Safety induction" value={record.safetyInductionDone} />
                    <Field label="PPE issued" value={record.ppeIssued} />
                    <Field label="Tools carried" value={record.toolsCarried} />
                    <Field label="Gate" value={record.gate} />
                    <Field label="Entry time" value={record.entryTime ? formatDateTime(record.entryTime) : null} />
                    <Field label="Exit time" value={record.exitTime ? formatDateTime(record.exitTime) : null} />
                  </dl>
                  {record.entryTime ? (
                    <p className="mt-2 text-[13px]">
                      <span className="text-erp-muted">Duration:</span>{' '}
                      <InsideDuration from={record.entryTime} to={record.exitTime} className="font-semibold" />
                    </p>
                  ) : null}
                  {record.remarks ? (
                    <p className="mt-3 text-[13px] text-erp-muted">
                      <span className="font-medium text-erp-text">Remarks:</span> {record.remarks}
                    </p>
                  ) : null}
                </section>
              </>
            ) : null}
          </GateDataStates>
        )}
      </div>

      <GateModal
        open={exitOpen}
        onClose={() => setExitOpen(false)}
        title="Record Contractor Exit"
        subtitle={record ? `${record.entryNumber} · ${record.workerName}` : undefined}
        footer={
          <div className="flex justify-end gap-2">
            <ErpButton variant="secondary" onClick={() => setExitOpen(false)} disabled={busy}>
              Cancel
            </ErpButton>
            <ErpButton icon={LogOut} onClick={() => void confirmExit()} loading={busy} disabled={busy}>
              Confirm Exit
            </ErpButton>
          </div>
        }
      >
        {record ? (
          <div className="space-y-3">
            <p className="text-[13px] text-erp-muted">
              Inside since {record.entryTime ? formatDateTime(record.entryTime) : '—'} (
              <InsideDuration from={record.entryTime} />)
            </p>
            <FormField label="Exit remarks">
              <Textarea rows={2} value={exitRemarks} onChange={(e) => setExitRemarks(e.target.value)} />
            </FormField>
          </div>
        ) : null}
      </GateModal>
    </OperationalPageShell>
  )
}
