import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { RefreshCw, ScanSearch, ShieldOff } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatDateTime } from '@/utils/dates/format'
import { useGatePermissions } from '@/utils/permissions/gate'
import { gateService } from '../../api/gateService'
import type { MaterialOutwardEntry } from '../../types/gate.types'
import {
  GateBoundaryBanner,
  GateDataStates,
  GateStatusBadge,
  OUTWARD_CHECKLIST_ITEMS,
} from '../../components'
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

export function MaterialOutwardDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const perms = useGatePermissions()
  const [entry, setEntry] = useState<MaterialOutwardEntry | null>(null)
  const [state, setState] = useState<GateLoadState>('loading')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!id) return
    setState('loading')
    setError('')
    try {
      setEntry(await gateService.getMaterialOutwardById(id))
      setState('ready')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load outward entry')
      setState('error')
    }
  }, [id])

  useEffect(() => { void load() }, [load])

  const isReadOnly = entry ? ['released', 'rejected', 'cancelled'].includes(entry.status) : false

  return (
    <OperationalPageShell
      variant="dynamics" layout="enterprise" badge="Gate & Security"
      title={entry ? entry.entryNumber : 'Material Outward'}
      autoBreadcrumbs={false}
      breadcrumbs={[...GATE_BREADCRUMB, { label: 'Material Outward', to: '/gate/material-outward' }, { label: entry?.entryNumber ?? '…' }]}
      backLink={{ to: '/gate/material-outward', label: 'Back to Material Outward' }}
      commandBar={(
        <ErpCommandBar
          inline sticky={false}
          primaryAction={
            perms.canVerifyOutward && entry && !isReadOnly
              ? { id: 'verify', label: 'Verify at Gate', icon: ScanSearch, variant: 'primary', onClick: () => navigate(`/gate/material-outward/verify?id=${entry.id}`) }
              : undefined
          }
          secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]}
        />
      )}
    >
      <div className="space-y-3 p-4">
        <GateBoundaryBanner message="Security verifies and releases approved outward material. Stock and accounting posting remain in their respective modules." />
        {!perms.canViewOutward ? (
          <EmptyState icon={ShieldOff} title="Access denied" description="You do not have permission to view material outward." />
        ) : (
          <GateDataStates state={state} error={error} onRetry={() => void load()} loadingVariant="form">
            {entry ? (
              <div className="grid gap-3 xl:grid-cols-3">
                <section className="rounded-md border border-erp-border bg-white p-4 xl:col-span-2">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <h3 className="text-[14px] font-semibold text-erp-text">Outward summary</h3>
                    <GateStatusBadge status={entry.status} />
                    {isReadOnly ? <span className="text-[11.5px] font-medium text-erp-muted">Read-only</span> : null}
                  </div>
                  <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
                    <Field label="Document" value={`${entry.documentType} ${entry.documentNumber}`} />
                    <Field label="Outward type" value={entry.outwardType.replace(/_/g, ' ')} />
                    <Field label="Party" value={entry.partyName} />
                    <Field label="Vehicle" value={entry.vehicleNumber} />
                    <Field label="Driver" value={entry.driverName} />
                    <Field label="Seal" value={entry.sealNumber} />
                    <Field label="Material" value={entry.materialSummary} />
                    <Field label="Packages expected" value={entry.packagesExpected} />
                    <Field label="Packages verified" value={entry.packagesVerified} />
                    <Field label="Approval" value={entry.approvalStatus} />
                    <Field label="Planned" value={entry.plannedTime ? formatDateTime(entry.plannedTime) : null} />
                    <Field label="Released" value={entry.releasedAt ? formatDateTime(entry.releasedAt) : null} />
                    <Field label="Released by" value={entry.releasedBy} />
                    <Field label="Gate" value={entry.gate} />
                  </dl>
                </section>
                <div className="space-y-3">
                  <section className="rounded-md border border-erp-border bg-white p-4">
                    <h3 className="mb-2 text-[13px] font-semibold text-erp-text">Checklist</h3>
                    <ul className="space-y-1.5 text-[13px]">
                      {OUTWARD_CHECKLIST_ITEMS.map((item) => (
                        <li key={item.key} className="flex items-center justify-between gap-2">
                          <span className="text-erp-muted">{item.label}</span>
                          <span className={entry.checklist[item.key] ? 'font-semibold text-emerald-700' : 'text-erp-muted'}>
                            {entry.checklist[item.key] ? 'Done' : 'Pending'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                  <section className="rounded-md border border-erp-border bg-white p-4">
                    <h3 className="mb-2 text-[13px] font-semibold text-erp-text">Timeline</h3>
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
