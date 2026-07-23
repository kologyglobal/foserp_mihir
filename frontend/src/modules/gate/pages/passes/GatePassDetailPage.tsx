import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Check, PackageCheck, RefreshCw, ShieldOff, X } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { ErpButton } from '@/components/erp/ErpButton'
import { EmptyState } from '@/components/ui/EmptyState'
import { FormField } from '@/components/forms/FormField'
import { Input, Textarea } from '@/components/forms/Inputs'
import { formatDate, formatDateTime } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { appConfirm, appPromptNote } from '@/store/confirmDialogStore'
import { useGatePermissions } from '@/utils/permissions/gate'
import { gateService } from '../../api/gateService'
import type { GatePass } from '../../types/gate.types'
import { gatePassPendingQty, isGatePassOverdue, todayIsoDate } from '../../utils/gateStatus'
import { buildGatePassReturnSchema } from '../../schemas/gateSchemas'
import { GateDataStates, GateModal, GateStatusBadge, OverdueIndicator } from '../../components'
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

export function GatePassDetailPage() {
  const { id } = useParams<{ id: string }>()
  const perms = useGatePermissions()
  const [pass, setPass] = useState<GatePass | null>(null)
  const [state, setState] = useState<GateLoadState>('loading')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [returnItemId, setReturnItemId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setState('loading')
    setError('')
    try {
      setPass(await gateService.getGatePassById(id))
      setState('ready')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load gate pass')
      setState('error')
    }
  }, [id])

  useEffect(() => { void load() }, [load])

  const selectedItem = pass?.items.find((i) => i.id === returnItemId) ?? null
  const pending = selectedItem ? selectedItem.quantity - selectedItem.returnedQuantity : 0
  const returnSchema = useMemo(() => buildGatePassReturnSchema(Math.max(pending, 0.001)), [pending])

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(returnSchema) as Resolver<{ returnDate: string; returnedQuantity: number; conditionReturned?: string; damage?: string; remarks?: string }>,
    defaultValues: { returnDate: todayIsoDate(), returnedQuantity: pending || 1, conditionReturned: '', damage: '', remarks: '' },
  })

  useEffect(() => {
    if (selectedItem) reset({ returnDate: todayIsoDate(), returnedQuantity: Math.max(pending, 0), conditionReturned: '', damage: '', remarks: '' })
  }, [selectedItem, pending, reset])

  const run = async (label: string, action: () => Promise<GatePass>) => {
    if (busy) return
    setBusy(true)
    try {
      setPass(await action())
      notify.success(label)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  const approve = () => run('Gate pass approved.', () => gateService.approveGatePass(pass!.id))
  const reject = async () => {
    const remarks = await appPromptNote({ title: 'Reject gate pass', description: 'Rejection remarks are required.', confirmLabel: 'Reject', tone: 'danger', note: { required: true, label: 'Remarks' } })
    if (remarks == null) return
    await run('Gate pass rejected.', () => gateService.rejectGatePass(pass!.id, remarks))
  }
  const sendOut = () => run('Pass marked sent out.', () => gateService.markGatePassSentOut(pass!.id))
  const close = async () => {
    const ok = await appConfirm({ title: 'Close gate pass?', description: 'Closing with pending quantity writes the remainder off — provide justification if prompted.', confirmLabel: 'Close Pass' })
    if (!ok) return
    const pendingQty = gatePassPendingQty(pass!)
    let remarks: string | undefined
    if (pendingQty > 0) {
      const note = await appPromptNote({ title: 'Write-off justification', description: `${pendingQty} units still pending. Remarks are required.`, confirmLabel: 'Close / Write Off', tone: 'danger', note: { required: true, label: 'Justification' } })
      if (note == null) return
      remarks = note
    }
    await run('Gate pass closed.', () => gateService.closeGatePass(pass!.id, remarks))
  }

  const submitReturn = async (values: { returnDate: string; returnedQuantity: number; conditionReturned?: string; damage?: string; remarks?: string }) => {
    if (!pass || !returnItemId) return
    setBusy(true)
    try {
      setPass(await gateService.recordGatePassReturn(pass.id, {
        itemId: returnItemId,
        returnDate: values.returnDate,
        returnedQuantity: values.returnedQuantity,
        conditionReturned: values.conditionReturned || undefined,
        damage: values.damage || undefined,
        remarks: values.remarks || undefined,
      }))
      notify.success('Return recorded.')
      setReturnItemId(null)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Could not record return')
    } finally {
      setBusy(false)
    }
  }

  const overdue = pass ? isGatePassOverdue(pass) || pass.status === 'overdue' : false
  const isReadOnly = pass ? ['closed', 'cancelled', 'written_off', 'rejected'].includes(pass.status) : false
  const canReturn = perms.canReturnPass && pass && ['sent_out', 'partially_returned', 'overdue', 'approved'].includes(pass.status) && gatePassPendingQty(pass) > 0

  return (
    <OperationalPageShell
      variant="dynamics" layout="enterprise" badge="Gate & Security"
      title={pass ? pass.entryNumber : 'Gate Pass'}
      autoBreadcrumbs={false}
      breadcrumbs={[...GATE_BREADCRUMB, { label: 'Gate Passes', to: '/gate/passes' }, { label: pass?.entryNumber ?? '…' }]}
      backLink={{ to: '/gate/passes', label: 'Back to Gate Passes' }}
      commandBar={(
        <ErpCommandBar
          inline sticky={false}
          primaryAction={
            canReturn
              ? { id: 'return', label: 'Record Return', icon: PackageCheck, variant: 'primary', onClick: () => setReturnItemId(pass!.items.find((i) => i.returnedQuantity < i.quantity)?.id ?? null) }
              : perms.canApprovePass && pass?.status === 'pending_approval'
                ? { id: 'approve', label: 'Approve', icon: Check, variant: 'primary', disabled: busy, onClick: () => void approve() }
                : perms.canEditPass && pass?.status === 'approved'
                  ? { id: 'send', label: 'Mark Sent Out', icon: PackageCheck, variant: 'primary', disabled: busy, onClick: () => void sendOut() }
                  : undefined
          }
          secondaryActions={[
            { id: 'reject', label: 'Reject', icon: X, hidden: !(perms.canApprovePass && pass?.status === 'pending_approval'), disabled: busy, onClick: () => void reject() },
            { id: 'close', label: 'Close Pass', hidden: !perms.canEditPass || isReadOnly, disabled: busy, onClick: () => void close() },
            { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() },
          ]}
        />
      )}
    >
      <div className="space-y-3 p-4">
        {!perms.canViewPass ? (
          <EmptyState icon={ShieldOff} title="Access denied" description="You do not have permission to view gate passes." />
        ) : (
          <GateDataStates state={state} error={error} onRetry={() => void load()} loadingVariant="form">
            {pass ? (
              <>
                {overdue ? (
                  <div className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] font-medium text-rose-800">
                    <OverdueIndicator /> This returnable pass is overdue — {gatePassPendingQty(pass)} unit(s) still pending return.
                  </div>
                ) : null}
                <section className="rounded-md border border-erp-border bg-white p-4">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <h3 className="text-[14px] font-semibold text-erp-text">Pass summary</h3>
                    <GateStatusBadge status={overdue && pass.status !== 'overdue' ? 'overdue' : pass.status} />
                  </div>
                  <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
                    <Field label="Pass kind" value={pass.passKind} />
                    <Field label="Movement type" value={pass.movementType} />
                    <Field label="Department" value={pass.department} />
                    <Field label="Responsible" value={pass.responsibleEmployee} />
                    <Field label="Carried by" value={pass.carriedBy} />
                    <Field label="Party" value={pass.partyName} />
                    <Field label="Purpose" value={pass.purpose} />
                    <Field label="Outward date" value={formatDate(pass.outwardDate)} />
                    <Field label="Expected return" value={pass.expectedReturnDate ? formatDate(pass.expectedReturnDate) : '—'} />
                    <Field label="Pending quantity" value={gatePassPendingQty(pass)} />
                    <Field label="Approver" value={pass.approverName} />
                    <Field label="Gate" value={pass.gate} />
                  </dl>
                </section>

                <section className="rounded-md border border-erp-border bg-white p-4">
                  <h3 className="mb-3 text-[14px] font-semibold text-erp-text">Items</h3>
                  <div className="overflow-x-auto">
                    <table className="erp-table w-full text-[12.5px]">
                      <thead>
                        <tr>
                          <th>Item</th><th>Serial</th><th>Qty</th><th>Returned</th><th>Pending</th><th>UOM</th><th>Condition Out</th><th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pass.items.map((item) => {
                          const itemPending = item.quantity - item.returnedQuantity
                          return (
                            <tr key={item.id}>
                              <td className="font-medium">{item.itemDescription}</td>
                              <td>{item.serialNumber ?? '—'}</td>
                              <td className="tabular-nums">{item.quantity}</td>
                              <td className="tabular-nums">{item.returnedQuantity}</td>
                              <td className="tabular-nums font-semibold">{itemPending}</td>
                              <td>{item.uom}</td>
                              <td>{item.conditionOut ?? '—'}</td>
                              <td>
                                {canReturn && itemPending > 0 ? (
                                  <ErpButton size="sm" variant="outline" onClick={() => setReturnItemId(item.id)}>Return</ErpButton>
                                ) : null}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>

                {pass.returns.length > 0 ? (
                  <section className="rounded-md border border-erp-border bg-white p-4">
                    <h3 className="mb-3 text-[14px] font-semibold text-erp-text">Return history</h3>
                    <ol className="space-y-2 text-[13px]">
                      {pass.returns.map((r) => {
                        const item = pass.items.find((i) => i.id === r.itemId)
                        return (
                          <li key={r.id}>
                            <span className="font-medium">{formatDate(r.returnDate)}</span> · {item?.itemDescription ?? r.itemId} · qty {r.returnedQuantity}
                            <span className="text-erp-muted"> · {r.recordedBy}{r.conditionReturned ? ` · ${r.conditionReturned}` : ''}</span>
                          </li>
                        )
                      })}
                    </ol>
                  </section>
                ) : null}
              </>
            ) : null}
          </GateDataStates>
        )}
      </div>

      <GateModal
        open={Boolean(returnItemId && selectedItem)}
        onClose={() => setReturnItemId(null)}
        title="Record Gate Pass Return"
        subtitle={selectedItem ? `${selectedItem.itemDescription} · pending ${pending}` : undefined}
        footer={
          <div className="flex justify-end gap-2">
            <ErpButton variant="secondary" onClick={() => setReturnItemId(null)} disabled={busy}>Cancel</ErpButton>
            <ErpButton onClick={handleSubmit((v) => void submitReturn(v))} loading={busy} disabled={busy || pending <= 0}>Confirm Return</ErpButton>
          </div>
        }
      >
        {selectedItem ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Return date" required error={errors.returnDate?.message}>
              <Input type="date" {...register('returnDate')} error={Boolean(errors.returnDate)} />
            </FormField>
            <FormField label="Returned quantity" required error={errors.returnedQuantity?.message} hint={`Max pending: ${pending}`}>
              <Input type="number" min={0.001} max={pending} step="any" {...register('returnedQuantity')} error={Boolean(errors.returnedQuantity)} />
            </FormField>
            <FormField label="Condition returned"><Input {...register('conditionReturned')} /></FormField>
            <FormField label="Damage"><Input {...register('damage')} /></FormField>
            <FormField label="Remarks" className="sm:col-span-2"><Textarea rows={2} {...register('remarks')} /></FormField>
            <p className="sm:col-span-2 text-[12px] text-erp-muted">Recorded at {formatDateTime(new Date().toISOString())} — partial returns are supported when enabled in settings.</p>
          </div>
        ) : null}
      </GateModal>
    </OperationalPageShell>
  )
}
