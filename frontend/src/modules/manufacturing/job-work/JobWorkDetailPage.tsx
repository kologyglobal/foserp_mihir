import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { Button } from '@/design-system/components/Button'
import { Modal } from '@/design-system/components/Modal'
import { FormField } from '@/components/forms/FormField'
import { Input, Textarea } from '@/components/forms/Inputs'
import { DataTable } from '@/components/tables/DataTable'
import { LoadingState } from '@/design-system/components/LoadingState'
import { StatusDot, statusToneFromLabel } from '@/components/design-system/StatusDot'
import {
  closeJobWorkOrderDemo,
  dispatchJobWorkMaterialDemo,
  getJobWorkMaterials,
  getJobWorkOrderById,
  getJobWorkReconciliation,
  linkJobWorkVendorInvoiceDemo,
  receiveJobWorkDemo,
  returnJobWorkMaterialDemo,
  cancelJobWorkOrderDemo,
  approveJobWorkDifferenceDemo,
} from '@/services/manufacturing'
import type { JobWorkMaterial, JobWorkOrder } from '@/types/manufacturingJobWork'
import { JW_STATUS_LABELS } from '@/types/manufacturingJobWork'
import { formatDate, formatDateTime } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { useManufacturingPermissions } from '@/utils/permissions/manufacturing'

type Dialog = 'dispatch' | 'receive' | 'return' | 'reconcile' | 'invoice' | 'close' | 'cancel' | null

export function JobWorkDetailPage() {
  const { jobWorkId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const perms = useManufacturingPermissions()
  const [jobWork, setJobWork] = useState<JobWorkOrder | null>(null)
  const [materials, setMaterials] = useState<JobWorkMaterial[]>([])
  const [tab, setTab] = useState<'overview' | 'materials' | 'activity'>('overview')
  const [dialog, setDialog] = useState<Dialog>(null)
  const [qty, setQty] = useState(0)
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [reconSummary, setReconSummary] = useState('')

  const load = useCallback(async () => {
    if (!jobWorkId) return
    setLoading(true)
    const [item, lines] = await Promise.all([getJobWorkOrderById(jobWorkId), getJobWorkMaterials(jobWorkId)])
    if (!item) {
      notify.error('Job work not found')
      navigate('/manufacturing/job-work')
      return
    }
    setJobWork(item)
    setMaterials(lines)
    setQty(Math.max(1, item.pendingQty || 1))
    setLoading(false)
  }, [jobWorkId, navigate])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const action = searchParams.get('action') as Dialog
    if (action && ['dispatch', 'receive', 'return', 'reconcile', 'invoice', 'close', 'cancel'].includes(action)) {
      setDialog(action)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  if (loading || !jobWork) return <LoadingState />

  const readOnly = jobWork.readOnly || ['closed', 'cancelled'].includes(jobWork.status)

  const act = async (fn: () => Promise<{ ok: boolean; error?: string }>, success: string) => {
    const r = await fn()
    if (!r.ok) {
      notify.error(r.error ?? 'Action failed')
      return
    }
    notify.success(success)
    setDialog(null)
    setNote('')
    await load()
  }

  const doAction = () => {
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
        'Materials dispatched',
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
        'Receipt confirmed',
      )
    }
    if (dialog === 'return') {
      void act(
        () =>
          returnJobWorkMaterialDemo(
            jobWork.id,
            materials.map((line) => ({ materialId: line.id, returnQty: Math.max(0, line.balanceWithVendor) })),
          ),
        'Material return recorded',
      )
    }
    if (dialog === 'invoice') {
      void act(
        () =>
          linkJobWorkVendorInvoiceDemo(jobWork.id, {
            invoiceId: `inv-${Date.now()}`,
            invoiceNo: note || `PI-${jobWork.jwNumber}`,
            invoiceAmount: qty || jobWork.expectedCost,
          }),
        'Vendor invoice linked',
      )
    }
    if (dialog === 'close') void act(() => closeJobWorkOrderDemo(jobWork.id), 'Job work closed')
    if (dialog === 'cancel') void act(() => cancelJobWorkOrderDemo(jobWork.id, note), 'Job work cancelled')
    if (dialog === 'reconcile') {
      void getJobWorkReconciliation(jobWork.id).then(async (r) => {
        if (!r) return
        setReconSummary(
          r.lines.map((l) => `${l.materialCode}: bal ${l.actualBalance} (${l.status})`).join(' · ') || 'No lines',
        )
        if (!r.canClose && note.trim()) {
          await approveJobWorkDifferenceDemo(jobWork.id, note)
          notify.success('Difference approved')
          await load()
        } else {
          notify.info(r.warnings.join(', ') || 'Reconciliation reviewed')
        }
        setDialog(null)
      })
    }
  }

  const dialogTitle =
    dialog === 'dispatch'
      ? 'Dispatch Material'
      : dialog === 'receive'
        ? 'Receive Job Work'
        : dialog === 'invoice'
          ? 'Link Vendor Invoice'
          : dialog === 'reconcile'
            ? 'Reconcile Material'
            : dialog === 'close'
              ? 'Close Job Work'
              : dialog === 'cancel'
                ? 'Cancel Job Work'
                : 'Return Material'

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
      commandBar={(
        <ErpCommandBar
          inline
          sticky
          primaryAction={
            !readOnly && perms.canDispatchJobWork
              ? { id: 'dispatch', label: 'Send Material', onClick: () => setDialog('dispatch') }
              : undefined
          }
          secondaryActions={[
            ...(!readOnly && perms.canReceiveJobWork
              ? [{ id: 'receive', label: 'Receive', onClick: () => setDialog('receive') }]
              : []),
            ...(!readOnly && perms.canReturnJobWorkMaterial
              ? [{ id: 'return', label: 'Return Material', onClick: () => setDialog('return') }]
              : []),
            ...(!readOnly && perms.canReconcileJobWork
              ? [{ id: 'reconcile', label: 'Reconcile', onClick: () => setDialog('reconcile') }]
              : []),
            ...(!readOnly && perms.canLinkJwInvoice
              ? [{ id: 'invoice', label: 'Link Invoice', onClick: () => setDialog('invoice') }]
              : []),
            ...(!readOnly && perms.canCloseJobWork
              ? [{ id: 'close', label: 'Close', onClick: () => setDialog('close') }]
              : []),
            { id: 'back', label: 'Back', onClick: () => navigate('/manufacturing/job-work') },
          ]}
        />
      )}
    >
      <div className="mb-4 grid grid-cols-2 gap-2 rounded border border-erp-border p-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ['Work Order', jobWork.workOrderNo],
          ['Ordered', jobWork.orderedQty],
          ['Sent', jobWork.sentQty],
          ['Received', jobWork.receivedQty],
          ['Pending', jobWork.pendingQty],
          ['Return by', formatDate(jobWork.expectedReturnDate)],
        ].map(([label, value]) => (
          <div key={String(label)}>
            <div className="text-xs text-erp-muted">{label}</div>
            <div className="font-medium">{value}</div>
          </div>
        ))}
        <div>
          <div className="text-xs text-erp-muted">Status</div>
          <StatusDot label={JW_STATUS_LABELS[jobWork.status]} tone={statusToneFromLabel(jobWork.status)} />
        </div>
      </div>

      <div className="mb-3 flex gap-2 border-b border-erp-border" role="tablist">
        {(['overview', 'materials', 'activity'] as const).map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={tab === item}
            onClick={() => setTab(item)}
            className={tab === item ? 'border-b-2 border-erp-primary px-3 py-2 text-sm font-medium' : 'px-3 py-2 text-sm text-erp-muted'}
          >
            {item[0].toUpperCase() + item.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'overview' ? (
        <div className="grid gap-3 rounded border border-erp-border p-4 sm:grid-cols-2">
          <div>
            <div className="text-xs text-erp-muted">Item</div>
            {jobWork.itemCode} — {jobWork.itemName}
          </div>
          <div>
            <div className="text-xs text-erp-muted">Rate</div>
            {jobWork.rate} ({jobWork.rateBasis}) · Expected {jobWork.expectedCost}
          </div>
          <div>
            <div className="text-xs text-erp-muted">Material warehouse</div>
            {jobWork.materialWarehouseName}
          </div>
          <div>
            <div className="text-xs text-erp-muted">Receipt warehouse</div>
            {jobWork.receiptWarehouseName}
          </div>
          <div>
            <div className="text-xs text-erp-muted">Invoice</div>
            {jobWork.invoiceNo ?? 'Not linked'} ({jobWork.invoiceStatus})
          </div>
          {reconSummary ? (
            <div className="sm:col-span-2">
              <div className="text-xs text-erp-muted">Last reconciliation</div>
              {reconSummary}
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === 'materials' ? (
        <div className="overflow-x-auto">
          <DataTable
            data={materials}
            columns={[
              { accessorKey: 'materialCode', header: 'Material' },
              { accessorKey: 'requiredQty', header: 'Required' },
              { accessorKey: 'availableQty', header: 'Available' },
              { accessorKey: 'sentQty', header: 'Sent' },
              { accessorKey: 'additionalSentQty', header: 'Additional' },
              { accessorKey: 'consumedQty', header: 'Consumed' },
              { accessorKey: 'returnedQty', header: 'Returned' },
              { accessorKey: 'scrapReturnedQty', header: 'Scrap Returned' },
              { accessorKey: 'balanceWithVendor', header: 'Balance' },
              { accessorKey: 'status', header: 'Status' },
            ]}
          />
        </div>
      ) : null}

      {tab === 'activity' ? (
        <ol className="space-y-3 border-l border-erp-border pl-4">
          {jobWork.activity.map((item) => (
            <li key={item.id}>
              <div className="text-xs text-erp-muted">
                {formatDateTime(item.at)} · {item.userName}
              </div>
              <div className="font-medium">{item.action}</div>
              {item.comment ? <div className="text-sm text-erp-muted">{item.comment}</div> : null}
            </li>
          ))}
        </ol>
      ) : null}

      <Modal
        open={dialog !== null}
        onClose={() => setDialog(null)}
        title={dialogTitle}
        footer={(
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDialog(null)}>Cancel</Button>
            <Button onClick={doAction}>Confirm</Button>
          </div>
        )}
      >
        {(dialog === 'receive' || dialog === 'invoice') && (
          <FormField label={dialog === 'invoice' ? 'Invoice Amount' : 'Received Quantity'}>
            <Input id="jw-qty" type="number" min="0" value={qty} onChange={(e) => setQty(Number(e.target.value))} />
          </FormField>
        )}
        {(dialog === 'dispatch' || dialog === 'invoice' || dialog === 'reconcile' || dialog === 'cancel') && (
          <FormField
            label={dialog === 'invoice' ? 'Invoice Number' : dialog === 'reconcile' ? 'Difference reason (if needed)' : 'Remarks'}
          >
            <Textarea id="jw-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
          </FormField>
        )}
        {dialog === 'dispatch' ? (
          <p className="mt-2 text-[13px] text-erp-muted">
            System will send required quantities (or available stock) for each BOM material line.
          </p>
        ) : null}
        {dialog === 'close' ? (
          <p className="text-[13px] text-erp-muted">
            Closing requires material reconciliation. Unexplained vendor balances must be approved first.
          </p>
        ) : null}
      </Modal>
    </OperationalPageShell>
  )
}
