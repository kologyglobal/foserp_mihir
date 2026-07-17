import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { Button } from '@/design-system/components/Button'
import { Modal } from '@/design-system/components/Modal'
import { FormField } from '@/components/forms/FormField'
import { Input, Textarea } from '@/components/forms/Inputs'
import { TableLink } from '@/components/ui/AppLink'
import { LoadingState } from '@/design-system/components/LoadingState'
import { StatusDot, statusToneFromLabel } from '@/components/design-system/StatusDot'
import {
  ManufacturingAiRail,
  ManufacturingDemoBanner,
} from '@/components/manufacturing'
import {
  approveJobWorkDifferenceDemo,
  cancelJobWorkOrderDemo,
  closeJobWorkOrderDemo,
  dispatchJobWorkMaterialDemo,
  getJobWorkDispatches,
  getJobWorkMaterials,
  getJobWorkOrderById,
  getJobWorkReceipts,
  getJobWorkReconciliation,
  linkJobWorkVendorInvoiceDemo,
  receiveJobWorkDemo,
} from '@/services/manufacturing'
import type {
  JobWorkDispatch,
  JobWorkMaterial,
  JobWorkOrder,
  JobWorkReceipt,
  JobWorkReconciliation,
} from '@/types/manufacturingJobWork'
import { JW_STATUS_LABELS } from '@/types/manufacturingJobWork'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate, formatDateTime } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { useManufacturingPermissions } from '@/utils/permissions/manufacturing'
import { buildJobWorkDetailAiInsights } from '@/utils/manufacturing/insights'
import { cn } from '@/utils/cn'

type Tab =
  | 'overview'
  | 'material_sent'
  | 'receipts'
  | 'reconciliation'
  | 'invoice'
  | 'timeline'
  | 'documents'

type Dialog = 'dispatch' | 'receive' | 'reconcile' | 'invoice' | 'close' | 'cancel' | null

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'material_sent', label: 'Material Sent' },
  { id: 'receipts', label: 'Receipts' },
  { id: 'reconciliation', label: 'Reconciliation' },
  { id: 'invoice', label: 'Vendor Invoice Placeholder' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'documents', label: 'Documents' },
]

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-erp-muted">{label}</div>
      <div className="mt-0.5 text-[13px] font-medium text-erp-text">{value ?? '—'}</div>
    </div>
  )
}

export function JobWorkDetailPage() {
  const { jobWorkId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const perms = useManufacturingPermissions()

  const [jobWork, setJobWork] = useState<JobWorkOrder | null>(null)
  const [materials, setMaterials] = useState<JobWorkMaterial[]>([])
  const [dispatches, setDispatches] = useState<JobWorkDispatch[]>([])
  const [receipts, setReceipts] = useState<JobWorkReceipt[]>([])
  const [recon, setRecon] = useState<JobWorkReconciliation | null>(null)
  const [tab, setTab] = useState<Tab>('overview')
  const [dialog, setDialog] = useState<Dialog>(null)
  const [qty, setQty] = useState(1)
  const [note, setNote] = useState('')
  const [invoiceNo, setInvoiceNo] = useState('')
  const [invoiceAmount, setInvoiceAmount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!jobWorkId) return
    setLoading(true)
    try {
      const [item, lines, d, r, rec] = await Promise.all([
        getJobWorkOrderById(jobWorkId),
        getJobWorkMaterials(jobWorkId),
        getJobWorkDispatches(jobWorkId),
        getJobWorkReceipts(jobWorkId),
        getJobWorkReconciliation(jobWorkId),
      ])
      if (!item) {
        notify.error('Job work not found')
        navigate('/manufacturing/job-work')
        return
      }
      setJobWork(item)
      setMaterials(lines)
      setDispatches(d)
      setReceipts(r)
      setRecon(rec)
      setQty(Math.max(1, item.pendingQty || 1))
      setInvoiceAmount(item.invoiceAmount ?? item.expectedCost)
      setInvoiceNo(item.invoiceNo ?? '')
    } finally {
      setLoading(false)
    }
  }, [jobWorkId, navigate])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const action = searchParams.get('action') as Dialog
    if (action && ['dispatch', 'receive', 'reconcile', 'invoice', 'close', 'cancel'].includes(action)) {
      setDialog(action)
    }
    const t = searchParams.get('tab') as Tab | null
    if (t && TABS.some((x) => x.id === t)) setTab(t)
    if (action || t) {
      searchParams.delete('action')
      searchParams.delete('tab')
      setSearchParams(searchParams, { replace: true })
    }
  }, [searchParams, setSearchParams])

  if (loading || !jobWork) return <LoadingState variant="card" />

  const readOnly = jobWork.readOnly || ['closed', 'cancelled'].includes(jobWork.status)
  const canSend = !readOnly && perms.canDispatchJobWork && ['draft', 'material_sent'].includes(jobWork.status)
  const canReceive = !readOnly && perms.canReceiveJobWork && !['draft', 'closed', 'cancelled'].includes(jobWork.status)
  const canReconcile = !readOnly && perms.canReconcileJobWork && ['received', 'reconciliation_pending', 'partially_received'].includes(jobWork.status)
  const canInvoice = !readOnly && perms.canLinkJwInvoice
  const canClose = !readOnly && perms.canCloseJobWork && ['received', 'reconciliation_pending'].includes(jobWork.status)
  const canCancel = !readOnly && perms.canCancelJobWork

  const tips = buildJobWorkDetailAiInsights(jobWork)

  const act = async (fn: () => Promise<{ ok: boolean; error?: string }>, success: string) => {
    setBusy(true)
    try {
      const r = await fn()
      if (!r.ok) {
        notify.error(r.error ?? 'Action failed')
        return
      }
      notify.success(success)
      setDialog(null)
      setNote('')
      await load()
    } finally {
      setBusy(false)
    }
  }

  const confirmDialog = () => {
    if (dialog === 'dispatch') {
      void act(
        () =>
          dispatchJobWorkMaterialDemo(jobWork.id, {
            lines: materials.map((line) => ({
              materialId: line.id,
              qty: Math.max(0, Math.min(line.availableQty, Math.max(0, line.requiredQty - line.sentQty))),
            })),
            remarks: note,
          }),
        'Material sent to vendor',
      )
    }
    if (dialog === 'receive') {
      void act(
        () =>
          receiveJobWorkDemo(jobWork.id, {
            receivedQty: qty,
            acceptedQty: qty,
            vendorChallan: note || undefined,
            reconcileAfter: qty >= jobWork.pendingQty,
          }),
        'Receipt recorded',
      )
    }
    if (dialog === 'invoice') {
      void act(
        () =>
          linkJobWorkVendorInvoiceDemo(jobWork.id, {
            invoiceId: `inv-placeholder-${Date.now()}`,
            invoiceNo: invoiceNo || `PI-${jobWork.jwNumber}`,
            invoiceAmount: invoiceAmount || jobWork.expectedCost,
          }),
        'Vendor invoice placeholder linked',
      )
    }
    if (dialog === 'close') void act(() => closeJobWorkOrderDemo(jobWork.id), 'Job work closed')
    if (dialog === 'cancel') void act(() => cancelJobWorkOrderDemo(jobWork.id, note), 'Job work cancelled')
    if (dialog === 'reconcile') {
      void (async () => {
        setBusy(true)
        try {
          const r = await getJobWorkReconciliation(jobWork.id)
          if (!r) return
          setRecon(r)
          if (!r.canClose && note.trim()) {
            await approveJobWorkDifferenceDemo(jobWork.id, note)
            notify.success('Difference approved')
          } else if (r.warnings.length) {
            notify.warning(r.warnings.join('; '))
          } else {
            notify.success('Reconciliation reviewed')
          }
          setDialog(null)
          setNote('')
          await load()
        } finally {
          setBusy(false)
        }
      })()
    }
  }

  const dialogTitle =
    dialog === 'dispatch'
      ? 'Send Material'
      : dialog === 'receive'
        ? 'Receive Quantity'
        : dialog === 'invoice'
          ? 'Link Vendor Invoice (Placeholder)'
          : dialog === 'reconcile'
            ? 'Reconcile'
            : dialog === 'close'
              ? 'Close Job Work'
              : dialog === 'cancel'
                ? 'Cancel Job Work'
                : ''

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Manufacturing"
      title={jobWork.jwNumber}
      description={`${jobWork.vendorName} · ${jobWork.process}`}
      breadcrumbs={[
        { label: 'Manufacturing & Production', to: '/manufacturing' },
        { label: 'Job Work', to: '/manufacturing/job-work' },
        { label: jobWork.jwNumber },
      ]}
      autoBreadcrumbs={false}
      favoritePath={`/manufacturing/job-work/${jobWork.id}`}
      commandBar={(
        <ErpCommandBar
          inline
          sticky
          primaryAction={
            canSend
              ? { id: 'send', label: 'Send Material', onClick: () => setDialog('dispatch') }
              : canReceive
                ? { id: 'receive', label: 'Receive', onClick: () => setDialog('receive') }
                : canClose
                  ? { id: 'close', label: 'Close', onClick: () => setDialog('close') }
                  : undefined
          }
          secondaryActions={[
            ...(!readOnly && jobWork.status === 'draft' && perms.canEditJobWork
              ? [{ id: 'edit', label: 'Edit', onClick: () => navigate(`/manufacturing/job-work/${jobWork.id}/edit`) }]
              : []),
            ...(canReceive && canSend
              ? [{ id: 'receive', label: 'Receive', onClick: () => setDialog('receive') }]
              : []),
            ...(canReconcile
              ? [{ id: 'reconcile', label: 'Reconcile', onClick: () => { setTab('reconciliation'); setDialog('reconcile') } }]
              : []),
            ...(canInvoice
              ? [{ id: 'invoice', label: 'Link Invoice', onClick: () => { setTab('invoice'); setDialog('invoice') } }]
              : []),
            ...(canClose && (canSend || canReceive)
              ? [{ id: 'close', label: 'Close', onClick: () => setDialog('close') }]
              : []),
            ...(canCancel
              ? [{ id: 'cancel', label: 'Cancel', onClick: () => setDialog('cancel') }]
              : []),
            { id: 'back', label: 'Back', onClick: () => navigate('/manufacturing/job-work') },
          ]}
        />
      )}
    >
      <ManufacturingAiRail title="Job Work Insights" suggestions={tips}>
      <div className="space-y-3">
        <ManufacturingDemoBanner message="Select WO → Vendor → Send Material → Receive → Reconcile → Invoice placeholder → Close. No complex subcontracting accounting." />

        <div className="rounded-xl border border-erp-border bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-mono text-lg font-semibold text-erp-primary">{jobWork.jwNumber}</p>
              <p className="text-[14px] font-medium text-erp-text">{jobWork.process} · {jobWork.vendorName}</p>
              <p className="mt-1 text-[12px] text-erp-muted">
                Linked WO:{' '}
                <TableLink to={`/manufacturing/work-orders/${jobWork.workOrderId}`} className="font-mono font-semibold">
                  {jobWork.workOrderNo}
                </TableLink>
              </p>
            </div>
            <StatusDot tone={statusToneFromLabel(jobWork.status)} label={JW_STATUS_LABELS[jobWork.status]} />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            <Field label="Ordered Qty" value={`${jobWork.orderedQty} ${jobWork.uom}`} />
            <Field label="Sent Qty" value={jobWork.sentQty} />
            <Field label="Received Qty" value={jobWork.receivedQty} />
            <Field label="Balance Qty" value={jobWork.pendingQty} />
            <Field label="Material Sent" value={jobWork.materialSentDate ? formatDate(jobWork.materialSentDate) : '—'} />
            <Field label="Expected Return" value={formatDate(jobWork.expectedReturnDate)} />
          </div>
        </div>

        {readOnly ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900" role="status">
            This job work is read-only.
          </p>
        ) : null}

        <div role="tablist" aria-label="Job work tabs" className="flex flex-wrap gap-1 rounded-xl border border-erp-border bg-white p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-[12px] font-semibold transition',
                tab === t.id ? 'bg-erp-primary text-white' : 'text-erp-muted hover:bg-slate-50 hover:text-erp-text',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'overview' ? (
          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-erp-border bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold">Basic info</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Vendor" value={jobWork.vendorName} />
                <Field label="Process" value={jobWork.process} />
                <Field label="Item" value={`${jobWork.itemCode} — ${jobWork.itemName}`} />
                <Field label="Material to send" value={jobWork.materialToSend || materials[0]?.materialName || '—'} />
                <Field label="Rate (placeholder)" value={formatCurrency(jobWork.rate)} />
                <Field label="Expected cost" value={formatCurrency(jobWork.expectedCost)} />
                <Field label="Remarks" value={jobWork.remarks || '—'} />
              </div>
            </div>
            <div className="rounded-xl border border-erp-border bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold">Simple flow</h3>
              <ol className="list-decimal space-y-2 pl-4 text-[13px] text-erp-text">
                <li className={jobWork.status !== 'draft' ? 'text-emerald-700' : ''}>Select Work Order + Vendor</li>
                <li className={['material_sent', 'partially_received', 'received', 'reconciliation_pending', 'closed'].includes(jobWork.status) ? 'text-emerald-700' : ''}>Send Material</li>
                <li className={['partially_received', 'received', 'reconciliation_pending', 'closed'].includes(jobWork.status) ? 'text-emerald-700' : ''}>Receive Qty</li>
                <li className={['reconciliation_pending', 'closed'].includes(jobWork.status) || jobWork.differenceApproved ? 'text-emerald-700' : ''}>Reconcile</li>
                <li className={jobWork.invoiceStatus !== 'none' ? 'text-emerald-700' : ''}>Link Vendor Invoice (placeholder)</li>
                <li className={jobWork.status === 'closed' ? 'text-emerald-700' : ''}>Close</li>
              </ol>
            </div>
          </section>
        ) : null}

        {tab === 'material_sent' ? (
          <section className="space-y-3 rounded-xl border border-erp-border bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Material sent to vendor</h3>
              {canSend ? (
                <Button size="sm" onClick={() => setDialog('dispatch')}>Send Material</Button>
              ) : null}
            </div>
            <div className="overflow-x-auto">
              <table className="erp-table w-full text-[12px]">
                <thead>
                  <tr>
                    <th>Material</th>
                    <th className="text-right">Required</th>
                    <th className="text-right">Sent</th>
                    <th className="text-right">Balance @ Vendor</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {materials.length === 0 ? (
                    <tr><td colSpan={5} className="py-6 text-center text-erp-muted">No material lines</td></tr>
                  ) : (
                    materials.map((m) => (
                      <tr key={m.id}>
                        <td>
                          <div className="font-mono font-medium">{m.materialCode}</div>
                          <div className="text-[11px] text-erp-muted">{m.materialName}</div>
                        </td>
                        <td className="tabular-nums text-right">{m.requiredQty} {m.uom}</td>
                        <td className="tabular-nums text-right">{m.sentQty}</td>
                        <td className="tabular-nums text-right">{m.balanceWithVendor}</td>
                        <td className="capitalize">{m.status.replace(/_/g, ' ')}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {dispatches.length > 0 ? (
              <div>
                <h4 className="mb-2 text-[12px] font-semibold uppercase text-erp-muted">Dispatch history</h4>
                <ul className="divide-y divide-erp-border text-[13px]">
                  {dispatches.map((d) => (
                    <li key={d.id} className="flex justify-between gap-2 py-2">
                      <span>{formatDateTime(d.dispatchAt)} · {d.userName}</span>
                      <span className="text-erp-muted">{d.remarks || '—'}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        ) : null}

        {tab === 'receipts' ? (
          <section className="space-y-3 rounded-xl border border-erp-border bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Receipts from vendor</h3>
              {canReceive ? (
                <Button size="sm" onClick={() => setDialog('receive')}>Receive Qty</Button>
              ) : null}
            </div>
            {receipts.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-erp-muted">No receipts yet.</p>
            ) : (
              <table className="erp-table w-full text-[12px]">
                <thead>
                  <tr>
                    <th>Received At</th>
                    <th className="text-right">Received</th>
                    <th className="text-right">Accepted</th>
                    <th className="text-right">Rejected</th>
                    <th>Challan</th>
                    <th>User</th>
                  </tr>
                </thead>
                <tbody>
                  {receipts.map((r) => (
                    <tr key={r.id}>
                      <td>{formatDateTime(r.receivedAt)}</td>
                      <td className="tabular-nums text-right">{r.receivedQty}</td>
                      <td className="tabular-nums text-right">{r.acceptedQty}</td>
                      <td className="tabular-nums text-right">{r.rejectedQty}</td>
                      <td>{r.vendorChallan || '—'}</td>
                      <td>{r.userName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        ) : null}

        {tab === 'reconciliation' ? (
          <section className="space-y-3 rounded-xl border border-erp-border bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Material reconciliation</h3>
              {canReconcile ? (
                <Button size="sm" onClick={() => setDialog('reconcile')}>Reconcile</Button>
              ) : null}
            </div>
            {!recon || recon.lines.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-erp-muted">No reconciliation data yet. Send and receive material first.</p>
            ) : (
              <>
                <table className="erp-table w-full text-[12px]">
                  <thead>
                    <tr>
                      <th>Material</th>
                      <th className="text-right">Sent</th>
                      <th className="text-right">Consumed</th>
                      <th className="text-right">Returned</th>
                      <th className="text-right">Balance</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recon.lines.map((l) => (
                      <tr key={l.materialId}>
                        <td className="font-mono">{l.materialCode}</td>
                        <td className="tabular-nums text-right">{l.sent}</td>
                        <td className="tabular-nums text-right">{l.consumed}</td>
                        <td className="tabular-nums text-right">{l.returned}</td>
                        <td className="tabular-nums text-right">{l.actualBalance}</td>
                        <td className="capitalize">{l.status.replace(/_/g, ' ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {recon.warnings.length > 0 ? (
                  <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
                    {recon.warnings.join('; ')}
                  </p>
                ) : (
                  <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-900">
                    Material balances look clear for close.
                  </p>
                )}
              </>
            )}
          </section>
        ) : null}

        {tab === 'invoice' ? (
          <section className="rounded-xl border border-erp-border bg-white p-4 shadow-sm">
            <h3 className="mb-2 text-sm font-semibold">Vendor invoice placeholder</h3>
            <p className="mb-4 text-[13px] text-erp-muted">
              Link a vendor invoice reference for tracking only. This does not post AP / GST / TDS.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Invoice status" value={jobWork.invoiceStatus} />
              <Field label="Invoice No" value={jobWork.invoiceNo || 'Not linked'} />
              <Field label="Invoice Amount" value={jobWork.invoiceAmount != null ? formatCurrency(jobWork.invoiceAmount) : '—'} />
              <Field label="Expected service amount" value={formatCurrency(jobWork.expectedCost)} />
            </div>
            {canInvoice ? (
              <Button className="mt-4" size="sm" variant="secondary" onClick={() => setDialog('invoice')}>
                Link Vendor Invoice
              </Button>
            ) : null}
          </section>
        ) : null}

        {tab === 'timeline' ? (
          <section className="rounded-xl border border-erp-border bg-white p-4 shadow-sm">
            {jobWork.activity.length === 0 ? (
              <p className="text-center text-[13px] text-erp-muted">No activities yet.</p>
            ) : (
              <ol className="space-y-3">
                {jobWork.activity.map((a) => (
                  <li key={a.id} className="flex gap-3 border-b border-erp-border/70 pb-3 last:border-0">
                    <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-erp-primary" />
                    <div>
                      <p className="text-[13px] font-semibold text-erp-text">{a.action}</p>
                      <p className="text-[12px] text-erp-muted">
                        {a.userName} · {formatDateTime(a.at)}
                        {a.quantity != null ? ` · Qty ${a.quantity}` : ''}
                      </p>
                      {a.comment ? <p className="text-[12px] text-erp-text">{a.comment}</p> : null}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        ) : null}

        {tab === 'documents' ? (
          <section className="rounded-xl border border-erp-border bg-white p-4 shadow-sm">
            <Field label="Remarks" value={jobWork.remarks || 'No remarks'} />
            <p className="mt-4 text-[13px] text-erp-muted">
              Attachments are demo-only until the manufacturing API ships. Vendor challan: {jobWork.vendorChallan || '—'}.
            </p>
          </section>
        ) : null}
      </div>
      </ManufacturingAiRail>

      <Modal
        open={dialog !== null}
        onClose={() => setDialog(null)}
        title={dialogTitle}
        closeDisabled={busy}
        footer={(
          <div className="flex justify-end gap-2">
            <Button variant="secondary" disabled={busy} onClick={() => setDialog(null)}>Cancel</Button>
            <Button disabled={busy} onClick={confirmDialog}>Confirm</Button>
          </div>
        )}
      >
        {dialog === 'dispatch' ? (
          <div className="space-y-3">
            <p className="text-[13px] text-erp-muted">
              Send required material quantities to {jobWork.vendorName}.
            </p>
            <ul className="text-[12px]">
              {materials.map((m) => (
                <li key={m.id} className="flex justify-between border-b border-erp-border py-1">
                  <span>{m.materialName}</span>
                  <span className="tabular-nums">{Math.max(0, m.requiredQty - m.sentQty)} {m.uom}</span>
                </li>
              ))}
            </ul>
            <FormField label="Remarks">
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
            </FormField>
          </div>
        ) : null}
        {dialog === 'receive' ? (
          <div className="grid gap-3">
            <FormField label="Received Qty" required>
              <Input type="number" min={0.001} step="any" value={qty} onChange={(e) => setQty(Number(e.target.value))} />
            </FormField>
            <FormField label="Vendor challan / remarks">
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
            </FormField>
          </div>
        ) : null}
        {dialog === 'reconcile' ? (
          <div className="space-y-3">
            <p className="text-[13px] text-erp-muted">
              Review material balance. If there is an unexplained difference, enter a reason to approve it.
            </p>
            <FormField label="Difference reason (if needed)">
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
            </FormField>
          </div>
        ) : null}
        {dialog === 'invoice' ? (
          <div className="grid gap-3">
            <p className="text-[13px] text-erp-muted">Placeholder only — does not create an accounting voucher.</p>
            <FormField label="Invoice No">
              <Input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} placeholder={`PI-${jobWork.jwNumber}`} />
            </FormField>
            <FormField label="Invoice Amount">
              <Input type="number" min={0} value={invoiceAmount} onChange={(e) => setInvoiceAmount(Number(e.target.value))} />
            </FormField>
          </div>
        ) : null}
        {dialog === 'close' ? (
          <p className="text-[13px] text-erp-muted">
            Closing makes this job work read-only. Ensure receive + reconcile are done
            {recon && !recon.canClose ? ' (approve material difference first)' : ''}.
          </p>
        ) : null}
        {dialog === 'cancel' ? (
          <FormField label="Cancel reason">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
          </FormField>
        ) : null}
      </Modal>
    </OperationalPageShell>
  )
}
