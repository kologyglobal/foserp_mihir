import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Check,
  LogIn,
  LogOut,
  Pencil,
  Printer,
  RefreshCw,
  ShieldOff,
  X,
} from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { ErpButton } from '@/components/erp/ErpButton'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatDate, formatDateTime } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { appConfirm, appPromptNote } from '@/store/confirmDialogStore'
import { useGatePermissions } from '@/utils/permissions/gate'
import { gateService } from '../../api/gateService'
import type { Visitor, VisitorVisit } from '../../types/gate.types'
import { VISITOR_TYPE_LABELS } from '../../utils/gateStatus'
import {
  GateDataStates,
  GateModal,
  GateStatusBadge,
  InsideDuration,
  VisitorPassPreview,
} from '../../components'
import { VisitorExitModal } from '../../components/VisitorExitModal'
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

export function VisitorDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const perms = useGatePermissions()
  const [visit, setVisit] = useState<VisitorVisit | null>(null)
  const [profile, setProfile] = useState<Visitor | null>(null)
  const [state, setState] = useState<GateLoadState>('loading')
  const [error, setError] = useState('')
  const [passOpen, setPassOpen] = useState(false)
  const [exitOpen, setExitOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setState('loading')
    setError('')
    try {
      const record = await gateService.getVisitorById(id)
      setVisit(record)
      setState('ready')
      try {
        setProfile(await gateService.searchVisitorByMobile(record.mobile))
      } catch {
        setProfile(null)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load visitor record')
      setState('error')
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const run = async (label: string, action: () => Promise<VisitorVisit>) => {
    if (busy) return
    setBusy(true)
    try {
      const updated = await action()
      setVisit(updated)
      notify.success(label)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  const approve = () => run('Visitor approved.', () => gateService.approveVisitor(visit!.id))
  const allowEntry = () => run('Entry recorded — visitor is inside.', () => gateService.recordVisitorEntry(visit!.id))
  const reject = async () => {
    const remarks = await appPromptNote({
      title: 'Reject visitor',
      description: 'Rejection remarks are mandatory and visible in the approval history.',
      confirmLabel: 'Reject',
      tone: 'danger',
      note: { required: true, label: 'Remarks' },
    })
    if (remarks == null) return
    await run('Visitor rejected.', () => gateService.rejectVisitor(visit!.id, remarks))
  }
  const cancel = async () => {
    const ok = await appConfirm({
      title: 'Cancel this visit?',
      description: 'A cancelled visit becomes read-only. This cannot be undone.',
      tone: 'danger',
      confirmLabel: 'Cancel Visit',
    })
    if (!ok) return
    await run('Visit cancelled.', () => gateService.cancelVisitor(visit!.id))
  }

  const status = visit?.status
  const isReadOnly = status ? ['exited', 'cancelled', 'rejected', 'no_show'].includes(status) : false
  const canApprove = perms.canApproveVisitor && status ? ['waiting_approval', 'arrived'].includes(status) : false
  const canAllowEntry =
    perms.canVisitorEntry &&
    status !== undefined &&
    ['approved', 'arrived'].includes(status) &&
    (!visit?.hostApprovalRequired || visit?.approvalStatus === 'approved')
  const canExit = perms.canVisitorExit && status === 'inside'
  const canCancel = perms.canEditVisitor && status ? ['expected', 'arrived', 'waiting_approval', 'approved'].includes(status) : false

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Gate & Security"
      title={visit ? `${visit.entryNumber} · ${visit.visitorName}` : 'Visitor'}
      autoBreadcrumbs={false}
      breadcrumbs={[...GATE_BREADCRUMB, { label: 'Visitors', to: '/gate/visitors' }, { label: visit?.entryNumber ?? '…' }]}
      backLink={{ to: '/gate/visitors', label: 'Back to Visitors' }}
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={
            canExit
              ? { id: 'exit', label: 'Record Exit', icon: LogOut, variant: 'primary', onClick: () => setExitOpen(true) }
              : canAllowEntry
                ? { id: 'entry', label: 'Allow Entry', icon: LogIn, variant: 'primary', disabled: busy, onClick: () => void allowEntry() }
                : canApprove
                  ? { id: 'approve', label: 'Approve', icon: Check, variant: 'primary', disabled: busy, onClick: () => void approve() }
                  : undefined
          }
          secondaryActions={[
            { id: 'reject', label: 'Reject', icon: X, hidden: !canApprove, disabled: busy, onClick: () => void reject() },
            { id: 'print', label: 'Print Pass', icon: Printer, hidden: !visit, onClick: () => setPassOpen(true) },
            { id: 'edit', label: 'Edit', icon: Pencil, hidden: !perms.canEditVisitor || isReadOnly, onClick: () => navigate(`/gate/visitors/${id}/edit`) },
            { id: 'cancel', label: 'Cancel Visit', icon: X, hidden: !canCancel, disabled: busy, onClick: () => void cancel() },
            { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() },
          ]}
        />
      )}
    >
      <div className="space-y-3 p-4">
        {!perms.canViewVisitor ? (
          <EmptyState icon={ShieldOff} title="Access denied" description="You do not have permission to view visitor records." />
        ) : (
          <GateDataStates state={state} error={error} onRetry={() => void load()} loadingVariant="form">
            {visit ? (
              <div className="grid gap-3 xl:grid-cols-3">
                <div className="space-y-3 xl:col-span-2">
                  {/* Summary */}
                  <section className="rounded-md border border-erp-border bg-white p-4">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <h3 className="text-[14px] font-semibold text-erp-text">Visit summary</h3>
                      <GateStatusBadge status={visit.status} />
                      {isReadOnly ? <span className="text-[11.5px] font-medium text-erp-muted">Read-only</span> : null}
                    </div>
                    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
                      <Field label="Pass number" value={visit.entryNumber} />
                      <Field label="Visitor" value={visit.visitorName} />
                      <Field label="Mobile" value={visit.mobile} />
                      <Field label="Company" value={visit.company} />
                      <Field label="Visitor type" value={VISITOR_TYPE_LABELS[visit.visitorType]} />
                      <Field label="Visitors in party" value={visit.visitorCount} />
                      <Field label="Host" value={visit.hostName} />
                      <Field label="Department" value={visit.department} />
                      <Field label="Gate" value={visit.gate} />
                      <Field label="Purpose" value={visit.purpose} />
                      <Field label="Meeting location" value={visit.meetingLocation} />
                      <Field label="ID reference" value={visit.idReferenceMasked} />
                    </dl>
                  </section>

                  {/* Entry / exit timeline */}
                  <section className="rounded-md border border-erp-border bg-white p-4">
                    <h3 className="mb-3 text-[14px] font-semibold text-erp-text">Entry & exit</h3>
                    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
                      <Field label="Visit date" value={formatDate(visit.visitDate)} />
                      <Field label="Entry time" value={visit.entryTime ? formatDateTime(visit.entryTime) : 'Not entered'} />
                      <Field label="Exit time" value={visit.exitTime ? formatDateTime(visit.exitTime) : 'Not exited'} />
                      <div>
                        <dt className="text-[12px] text-erp-muted">Duration</dt>
                        <dd className="text-[13px] font-medium">
                          <InsideDuration from={visit.entryTime} to={visit.exitTime} warnAfterMinutes={240} />
                        </dd>
                      </div>
                      <Field label="Badge returned" value={visit.badgeReturned == null ? '—' : visit.badgeReturned ? 'Yes' : 'No'} />
                      <Field label="Exit remarks" value={visit.exitRemarks} />
                    </dl>
                  </section>

                  {/* Vehicle & belongings */}
                  <section className="rounded-md border border-erp-border bg-white p-4">
                    <h3 className="mb-3 text-[14px] font-semibold text-erp-text">Vehicle & belongings</h3>
                    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
                      <Field label="Vehicle" value={visit.vehicleNumber} />
                      <Field label="Vehicle type" value={visit.vehicleType} />
                      <Field label="Bags" value={visit.bagCount} />
                      <Field label="Laptop" value={visit.laptopCarried ? 'Yes' : 'No'} />
                      <Field label="Equipment" value={visit.equipmentCarried ? 'Yes' : 'No'} />
                      <Field label="Belongings" value={visit.belongingsDescription} />
                      <Field label="PPE required" value={visit.ppeRequired ? 'Yes' : 'No'} />
                      <Field label="NDA required" value={visit.ndaRequired ? 'Yes' : 'No'} />
                      <Field label="Safety declaration" value={visit.safetyDeclarationAccepted ? 'Accepted' : 'Not accepted'} />
                    </dl>
                  </section>

                  {/* Approval history / audit */}
                  <section className="rounded-md border border-erp-border bg-white p-4">
                    <h3 className="mb-3 text-[14px] font-semibold text-erp-text">Approval & audit history</h3>
                    {visit.approvalHistory.length === 0 ? (
                      <p className="text-[13px] text-erp-muted">No approval events recorded for this visit.</p>
                    ) : (
                      <ol className="space-y-2">
                        {visit.approvalHistory.map((event, i) => (
                          <li key={i} className="flex items-start gap-2 text-[13px]">
                            <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-erp-primary" aria-hidden />
                            <span>
                              <span className="font-medium capitalize text-erp-text">{event.action.replace(/_/g, ' ')}</span>
                              <span className="text-erp-muted"> · {event.by} · {formatDateTime(event.at)}</span>
                              {event.remarks ? <span className="block text-erp-muted">“{event.remarks}”</span> : null}
                            </span>
                          </li>
                        ))}
                      </ol>
                    )}
                    <p className="mt-3 border-t border-erp-border pt-2 text-[11.5px] text-erp-muted">
                      Created by {visit.createdBy} on {formatDateTime(visit.createdAt)} · Last updated by {visit.updatedBy} on {formatDateTime(visit.updatedAt)}
                    </p>
                  </section>
                </div>

                <div className="space-y-3">
                  {/* Pass preview */}
                  <VisitorPassPreview visit={visit} />

                  {/* Previous visits */}
                  <section className="rounded-md border border-erp-border bg-white p-4">
                    <h3 className="mb-2 text-[13px] font-semibold text-erp-text">Visitor history</h3>
                    {profile ? (
                      <dl className="space-y-1.5 text-[13px]">
                        <div className="flex justify-between">
                          <dt className="text-erp-muted">Total visits</dt>
                          <dd className="font-semibold tabular-nums text-erp-text">{profile.totalVisits}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-erp-muted">Last visit</dt>
                          <dd className="font-medium text-erp-text">{profile.lastVisitAt ? formatDate(profile.lastVisitAt) : '—'}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-erp-muted">Usual host</dt>
                          <dd className="font-medium text-erp-text">{profile.lastHost ?? '—'}</dd>
                        </div>
                        {profile.isBlacklisted ? (
                          <p className="rounded-md bg-rose-50 px-2 py-1.5 text-[12px] font-medium text-rose-700">
                            Blacklisted{profile.blacklistReason ? ` — ${profile.blacklistReason}` : ''}
                          </p>
                        ) : null}
                      </dl>
                    ) : (
                      <p className="text-[13px] text-erp-muted">First recorded visit for this mobile number.</p>
                    )}
                  </section>

                  {/* Notes & attachments placeholder */}
                  <section className="rounded-md border border-erp-border bg-white p-4">
                    <h3 className="mb-2 text-[13px] font-semibold text-erp-text">Notes & attachments</h3>
                    <p className="text-[12.5px] text-erp-muted">
                      Remarks: {visit.remarks || '—'}
                    </p>
                    <p className="mt-2 text-[11.5px] text-erp-muted">
                      Shared entity notes/attachments hook up to the gate backend when it ships — gate records keep
                      remarks inline until then.
                    </p>
                  </section>
                </div>
              </div>
            ) : null}
          </GateDataStates>
        )}
      </div>

      {/* Printable pass */}
      <GateModal
        open={passOpen}
        onClose={() => setPassOpen(false)}
        title="Visitor Pass"
        footer={
          <div className="flex justify-end gap-2">
            <ErpButton variant="secondary" onClick={() => setPassOpen(false)}>
              Close
            </ErpButton>
            <ErpButton icon={Printer} onClick={() => window.print()}>
              Print Pass
            </ErpButton>
          </div>
        }
      >
        {visit ? <VisitorPassPreview visit={visit} /> : null}
      </GateModal>

      <VisitorExitModal
        visit={exitOpen ? visit : null}
        onClose={() => setExitOpen(false)}
        onDone={(updated) => setVisit(updated)}
      />
    </OperationalPageShell>
  )
}
