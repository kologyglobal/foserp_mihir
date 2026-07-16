import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { MoreHorizontal } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { StatusDot, statusToneFromLabel } from '@/components/design-system/StatusDot'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { FormField } from '@/components/forms/FormField'
import { Input, Select, Textarea } from '@/components/forms/Inputs'
import { DataTable } from '@/components/tables/DataTable'
import { LoadingState } from '@/design-system/components/LoadingState'
import { Modal } from '@/design-system/components/Modal'
import { Button } from '@/design-system/components/Button'
import {
  cancelWorkOrderDemo,
  checkWorkOrderMaterialAvailability,
  closeWorkOrderDemo,
  closeWorkOrderWithDifferenceDemo,
  completeAndCloseWorkOrderDemo,
  completeProductionQuantityDemo,
  confirmManualMaterialIssueDemo,
  createProductionReworkDemo,
  createPurchaseRequisitionFromShortageDemo,
  createTransferFromShortageDemo,
  getAutomaticConsumptionPreview,
  getManualMaterialIssuePreview,
  getMaterialReturnPreview,
  getManufacturingSettings,
  getProductionCompletionPreview,
  getProductionCostPreview,
  getProductionQualityReview,
  getProductionVariancePreview,
  getWorkOrderActivity,
  getWorkOrderById,
  getWorkOrderClosingPreview,
  getWorkOrderMaterials,
  getWorkOrderOutputs,
  holdWorkOrderDemo,
  recordProductionScrapDemo,
  releaseWorkOrderReservationsDemo,
  reserveWorkOrderMaterialsDemo,
  resumeWorkOrderDemo,
  returnUnusedMaterialDemo,
  saveProductionProgressDemo,
  startWorkOrderDemo,
  updateProductionQualityResultDemo,
} from '@/services/manufacturing'
import type { ManufacturingSettings } from '@/types/manufacturingSettings'
import type {
  HoldReason,
  MaterialConsumptionPreview,
  MaterialIssueLine,
  MaterialReturnLine,
  ProductionCompletionPreview,
  ProductionCostPreview,
  ProductionOutputEntry,
  ProductionQualityReview,
  ProductionVariancePreview,
  ScrapReason,
  WorkOrder,
  WorkOrderActivity,
  WorkOrderClosingPreview,
  WorkOrderMaterial,
} from '@/types/manufacturingWorkOrder'
import {
  HOLD_REASON_LABELS,
  SCRAP_REASON_LABELS,
  WO_MATERIAL_STATUS_LABELS,
  WO_SOURCE_LABELS,
  WO_STATUS_LABELS,
} from '@/types/manufacturingWorkOrder'
import { PRODUCTION_METHOD_LABELS } from '@/types/manufacturing'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate, formatDateTime } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { useManufacturingPermissions } from '@/utils/permissions/manufacturing'
import { cn } from '@/utils/cn'

type Dialog =
  | null
  | 'start'
  | 'hold'
  | 'resume'
  | 'complete'
  | 'close'
  | 'cancel'
  | 'issue'
  | 'return'
  | 'scrap'
  | 'rework'
  | 'quality'
  | 'cost'
  | 'more'

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-erp-muted">{label}</div>
      <div className="mt-0.5 text-[13px] font-medium text-erp-text">{value ?? '—'}</div>
    </div>
  )
}

export function WorkOrderDetailPage() {
  const { workOrderId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const perms = useManufacturingPermissions()

  const [wo, setWo] = useState<WorkOrder | null>(null)
  const [mats, setMats] = useState<WorkOrderMaterial[]>([])
  const [acts, setActs] = useState<WorkOrderActivity[]>([])
  const [outputs, setOutputs] = useState<ProductionOutputEntry[]>([])
  const [quality, setQuality] = useState<ProductionQualityReview | null>(null)
  const [settings, setSettings] = useState<ManufacturingSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'overview' | 'materials' | 'activity'>('overview')
  const [dialog, setDialog] = useState<Dialog>(null)
  const [busy, setBusy] = useState(false)

  const [startAt, setStartAt] = useState(() => new Date().toISOString().slice(0, 16))
  const [supervisor, setSupervisor] = useState('')
  const [shift, setShift] = useState('A')
  const [workstation, setWorkstation] = useState('')
  const [remarks, setRemarks] = useState('')
  const [holdReason, setHoldReason] = useState<HoldReason>('material_shortage')
  const [expectedResume, setExpectedResume] = useState('')
  const [goodQty, setGoodQty] = useState(1)
  const [rejectedQty, setRejectedQty] = useState(0)
  const [scrapQty, setScrapQty] = useState(0)
  const [reworkQty, setReworkQty] = useState(0)
  const [productionDate, setProductionDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [batchNo, setBatchNo] = useState('')
  const [serialText, setSerialText] = useState('')
  const [differenceReason, setDifferenceReason] = useState('')
  const [completionPreview, setCompletionPreview] = useState<ProductionCompletionPreview | null>(null)
  const [consumption, setConsumption] = useState<MaterialConsumptionPreview | null>(null)
  const [closingPreview, setClosingPreview] = useState<WorkOrderClosingPreview | null>(null)
  const [costPreview, setCostPreview] = useState<ProductionCostPreview | null>(null)
  const [variancePreview, setVariancePreview] = useState<ProductionVariancePreview | null>(null)
  const [issueLines, setIssueLines] = useState<MaterialIssueLine[]>([])
  const [returnLines, setReturnLines] = useState<MaterialReturnLine[]>([])
  const [scrapReason, setScrapReason] = useState<ScrapReason>('process_loss')
  const [startWarnings, setStartWarnings] = useState<string[]>([])

  const readOnly = wo?.status === 'closed' || wo?.status === 'cancelled'

  const reload = useCallback(async () => {
    if (!workOrderId) return
    setLoading(true)
    try {
      const [w, m, a, o, q, s] = await Promise.all([
        getWorkOrderById(workOrderId),
        getWorkOrderMaterials(workOrderId),
        getWorkOrderActivity(workOrderId),
        getWorkOrderOutputs(workOrderId),
        getProductionQualityReview(workOrderId),
        getManufacturingSettings(),
      ])
      if (!w) {
        notify.error('Work order not found')
        navigate('/manufacturing/work-orders')
        return
      }
      setWo(w)
      setMats(m)
      setActs(a)
      setOutputs(o)
      setQuality(q)
      setSettings(s)
      setGoodQty(Math.max(1, w.remainingQty || 1))
    } finally {
      setLoading(false)
    }
  }, [navigate, workOrderId])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    const action = searchParams.get('action') as Dialog
    if (action && action !== 'more') {
      setDialog(action)
      searchParams.delete('action')
      setSearchParams(searchParams, { replace: true })
    }
    const t = searchParams.get('tab')
    if (t === 'materials' || t === 'activity' || t === 'overview') setTab(t)
  }, [searchParams, setSearchParams])

  useEffect(() => {
    if (dialog === 'complete' && workOrderId) {
      void getProductionCompletionPreview(workOrderId, goodQty).then(setCompletionPreview)
      void getAutomaticConsumptionPreview(workOrderId, goodQty).then(setConsumption)
    }
  }, [dialog, goodQty, workOrderId])

  useEffect(() => {
    if (dialog === 'close' && workOrderId) void getWorkOrderClosingPreview(workOrderId).then(setClosingPreview)
  }, [dialog, workOrderId])

  useEffect(() => {
    if (dialog === 'cost' && workOrderId && perms.canViewCost) {
      void Promise.all([getProductionCostPreview(workOrderId), getProductionVariancePreview(workOrderId)]).then(([c, v]) => {
        setCostPreview(c)
        setVariancePreview(v)
      })
    }
  }, [dialog, perms.canViewCost, workOrderId])

  useEffect(() => {
    if (dialog === 'issue' && workOrderId) void getManualMaterialIssuePreview(workOrderId).then(setIssueLines)
  }, [dialog, workOrderId])

  useEffect(() => {
    if (dialog === 'return' && workOrderId) void getMaterialReturnPreview(workOrderId).then(setReturnLines)
  }, [dialog, workOrderId])

  const materialColumns = useMemo(
    () => [
      {
        id: 'comp',
        header: 'Component',
        cell: ({ row }: { row: { original: WorkOrderMaterial } }) => (
          <div>
            <div className="font-medium">{row.original.componentItemCode}</div>
            <div className="text-[11px] text-erp-muted">{row.original.componentItemName}</div>
          </div>
        ),
      },
      { accessorKey: 'requiredQty', header: 'Required' },
      { accessorKey: 'availableQty', header: 'Available' },
      { accessorKey: 'reservedQty', header: 'Reserved' },
      { accessorKey: 'consumedQty', header: 'Consumed' },
      { accessorKey: 'returnedQty', header: 'Returned' },
      { accessorKey: 'shortageQty', header: 'Shortage' },
      { accessorKey: 'warehouseName', header: 'Warehouse' },
      { accessorKey: 'tracking', header: 'Tracking' },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }: { row: { original: WorkOrderMaterial } }) => (
          <StatusDot tone={statusToneFromLabel(row.original.status)} label={WO_MATERIAL_STATUS_LABELS[row.original.status]} />
        ),
      },
    ],
    [],
  )

  if (loading || !wo) return <LoadingState />

  const run = async (fn: () => Promise<{ ok: boolean; error?: string; warnings?: string[] }>, okMsg: string) => {
    setBusy(true)
    try {
      const r = await fn()
      if (!r.ok) {
        notify.error(r.error ?? 'Action failed')
        if (r.warnings?.length) setStartWarnings(r.warnings)
        return false
      }
      r.warnings?.forEach((w) => notify.warning(w))
      notify.success(okMsg)
      setDialog(null)
      await reload()
      return true
    } finally {
      setBusy(false)
    }
  }

  const primaryAction =
    !readOnly && wo.status === 'draft' && perms.canStartWo
      ? { id: 'start', label: 'Start', onClick: () => setDialog('start') }
      : !readOnly && wo.status === 'in_progress' && perms.canCompleteProduction
        ? { id: 'complete', label: 'Complete Production', onClick: () => setDialog('complete') }
        : !readOnly && wo.status === 'on_hold' && perms.canResumeWo
          ? { id: 'resume', label: 'Resume', onClick: () => setDialog('resume') }
          : undefined

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Manufacturing"
      title={wo.woNumber}
      description={`${wo.finishedItemCode} — ${wo.finishedItemName}`}
      breadcrumbs={[
        { label: 'Manufacturing & Production', to: '/manufacturing' },
        { label: 'Work Orders', to: '/manufacturing/work-orders' },
        { label: wo.woNumber },
      ]}
      autoBreadcrumbs={false}
      favoritePath={`/manufacturing/work-orders/${wo.id}`}
      commandBar={(
        <ErpCommandBar
          inline
          sticky
          primaryAction={primaryAction}
          secondaryActions={[
            ...(!readOnly && wo.status === 'in_progress' && perms.canHoldWo
              ? [{ id: 'hold', label: 'Put on Hold', onClick: () => setDialog('hold') }]
              : []),
            ...(!readOnly && ['completed', 'in_progress'].includes(wo.status) && perms.canCloseWo
              ? [{ id: 'close', label: 'Close', onClick: () => setDialog('close') }]
              : []),
            { id: 'more', label: 'More', icon: MoreHorizontal, onClick: () => setDialog('more') },
            { id: 'back', label: 'Back', onClick: () => navigate('/manufacturing/work-orders') },
          ]}
        />
      )}
    >
      <div className="sticky top-0 z-10 mb-4 grid grid-cols-2 gap-2 rounded-lg border border-erp-border bg-erp-surface p-3 shadow-sm sm:grid-cols-4 lg:grid-cols-8">
        <Field label="Work Order" value={wo.woNumber} />
        <Field label="Finished Item" value={wo.finishedItemCode} />
        <Field label="Planned" value={wo.plannedQty} />
        <Field label="Produced" value={wo.producedQty} />
        <Field label="Remaining" value={wo.remainingQty} />
        <Field label="Due Date" value={formatDate(wo.dueDate)} />
        <Field label="Progress" value={`${wo.progressPercent}%`} />
        <Field label="Status" value={<StatusDot tone={statusToneFromLabel(wo.status)} label={WO_STATUS_LABELS[wo.status]} />} />
      </div>

      {readOnly ? (
        <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900" role="status">
          This work order is {WO_STATUS_LABELS[wo.status]} and read-only.
        </p>
      ) : null}

      <div className="mb-3 flex gap-1 border-b border-erp-border" role="tablist">
        {(['overview', 'materials', 'activity'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              'px-3 py-2 text-[13px] font-medium capitalize',
              tab === t ? 'border-b-2 border-erp-primary text-erp-primary' : 'text-erp-muted',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'overview' ? (
        <div className="grid gap-3 rounded-lg border border-erp-border p-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Finished Item" value={`${wo.finishedItemCode} — ${wo.finishedItemName}`} />
          <Field label="Source" value={WO_SOURCE_LABELS[wo.source]} />
          <Field label="Source Document" value={wo.sourceDocumentNo || '—'} />
          <Field label="Method" value={PRODUCTION_METHOD_LABELS[wo.productionMethod]} />
          <Field label="Plant" value={wo.plantName} />
          <Field label="BOM" value={`${wo.bomNumber} ${wo.bomVersion}`} />
          <Field label="Material Warehouse" value={wo.materialWarehouseName} />
          <Field label="FG Warehouse" value={wo.fgWarehouseName} />
          <Field label="Customer" value={wo.customerName || '—'} />
          <Field label="Quality" value={wo.qualityRequired ? (wo.qualityHold ? 'Hold' : 'Required') : 'Not required'} />
        </div>
      ) : null}

      {tab === 'materials' ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" disabled={!perms.canViewMaterials || readOnly} onClick={() => void run(async () => { const r = await checkWorkOrderMaterialAvailability(wo.id); return { ok: r.ok, warnings: 'warnings' in r ? (r as { warnings?: string[] }).warnings : undefined } }, 'Availability checked')}>Check Availability</Button>
            <Button size="sm" variant="secondary" disabled={!perms.canReserveMaterials || readOnly} onClick={() => void run(async () => { const r = await reserveWorkOrderMaterialsDemo(wo.id); return { ok: r.ok, error: r.error } }, 'Materials reserved')}>Reserve All Available</Button>
            <Button size="sm" variant="secondary" disabled={!perms.canReserveMaterials || readOnly} onClick={() => void run(() => releaseWorkOrderReservationsDemo(wo.id), 'Reservation released')}>Release Reservation</Button>
            <Button size="sm" variant="secondary" disabled={!perms.canCreateRequirement || readOnly} onClick={() => void run(async () => createPurchaseRequisitionFromShortageDemo(wo.id), 'PR draft created')}>Create PR Draft</Button>
            <Button size="sm" variant="secondary" disabled={!perms.canCreateRequirement || readOnly} onClick={() => void run(async () => createTransferFromShortageDemo(wo.id), 'Transfer draft created')}>Create Transfer Draft</Button>
          </div>
          <div className="overflow-x-auto"><DataTable columns={materialColumns as never} data={mats} /></div>
        </div>
      ) : null}

      {tab === 'activity' ? (
        <div className="space-y-4">
          <ol className="relative space-y-3 border-l border-erp-border pl-4">
            {acts.map((a) => (
              <li key={a.id}>
                <div className="text-[12px] text-erp-muted">{formatDateTime(a.at)}</div>
                <div className="text-[13px] font-medium">{a.action}</div>
                <div className="text-[12px] text-erp-muted">{a.userName}{a.quantity != null ? ` · Qty ${a.quantity}` : ''}</div>
                {a.comment ? <p className="text-[12px]">{a.comment}</p> : null}
              </li>
            ))}
          </ol>
          {outputs.length > 0 ? (
            <div className="rounded-lg border border-erp-border p-3">
              <h3 className="text-[13px] font-semibold">Previous output</h3>
              <ul className="mt-2 divide-y divide-erp-border text-[13px]">
                {outputs.map((o) => (
                  <li key={o.id} className="flex justify-between py-2">
                    <span>{formatDateTime(o.at)} — Good {o.goodQty}, Rejected {o.rejectedQty}, Scrap {o.scrapQty}</span>
                    <span className="text-erp-muted">{o.userName}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      <Modal open={dialog === 'start'} onClose={() => setDialog(null)} title="Start Production" closeDisabled={busy} footer={(
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDialog(null)} disabled={busy}>Cancel</Button>
          <Button disabled={busy} onClick={() => void run(async () => { const r = await startWorkOrderDemo({ workOrderId: wo.id, startAt: new Date(startAt).toISOString(), supervisor, shift, workstation, remarks }); setStartWarnings(r.warnings); return { ok: r.ok, error: r.error, warnings: r.warnings } }, 'Production started')}>Start</Button>
        </div>
      )}>
        <div className="grid gap-3">
          <FormField label="Work Order"><Input id="st-wo" value={wo.woNumber} readOnly /></FormField>
          <FormField label="Start Date and Time" required><Input id="st-at" type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} /></FormField>
          <FormField label="Supervisor"><Input id="st-sup" value={supervisor} onChange={(e) => setSupervisor(e.target.value)} /></FormField>
          <FormField label="Shift"><Input id="st-shift" value={shift} onChange={(e) => setShift(e.target.value)} /></FormField>
          <FormField label="Workstation"><Input id="st-ws" value={workstation} onChange={(e) => setWorkstation(e.target.value)} /></FormField>
          <FormField label="Remarks"><Textarea id="st-rm" value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} /></FormField>
          {startWarnings.length > 0 ? <ul className="list-disc pl-4 text-[12px] text-amber-800" role="alert">{startWarnings.map((w) => <li key={w}>{w}</li>)}</ul> : null}
        </div>
      </Modal>

      <Modal open={dialog === 'hold'} onClose={() => setDialog(null)} title="Put on Hold" footer={(
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDialog(null)}>Cancel</Button>
          <Button disabled={busy} onClick={() => void run(() => holdWorkOrderDemo({ workOrderId: wo.id, holdAt: new Date().toISOString(), reason: holdReason, expectedResumeDate: expectedResume || undefined, remarks }), 'Work order on hold')}>Hold</Button>
        </div>
      )}>
        <div className="grid gap-3">
          <FormField label="Reason" required>
            <Select id="h-reason" value={holdReason} onChange={(e) => setHoldReason(e.target.value as HoldReason)}>
              {(Object.keys(HOLD_REASON_LABELS) as HoldReason[]).map((r) => <option key={r} value={r}>{HOLD_REASON_LABELS[r]}</option>)}
            </Select>
          </FormField>
          <FormField label="Expected Resume Date"><Input id="h-exp" type="date" value={expectedResume} onChange={(e) => setExpectedResume(e.target.value)} /></FormField>
          <FormField label="Remarks"><Textarea id="h-rm" value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} /></FormField>
        </div>
      </Modal>

      <Modal open={dialog === 'resume'} onClose={() => setDialog(null)} title="Resume Production" footer={(
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDialog(null)}>Cancel</Button>
          <Button disabled={busy} onClick={() => void run(() => resumeWorkOrderDemo({ workOrderId: wo.id, resumeAt: new Date().toISOString(), resolutionNote: remarks }), 'Production resumed')}>Resume</Button>
        </div>
      )}>
        <FormField label="Resolution Note"><Textarea id="rs-note" value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={3} /></FormField>
      </Modal>

      <Modal open={dialog === 'complete'} onClose={() => setDialog(null)} title="Complete Production" size="lg" description="Enter good quantity to complete. Everything else is optional." closeDisabled={busy} footer={(
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={() => setDialog(null)} disabled={busy}>Cancel</Button>
          <Button variant="secondary" disabled={busy || !perms.canCompleteProduction} onClick={() => void run(async () => saveProductionProgressDemo(wo.id, { goodQty, rejectedQty, scrapQty, reworkQty, productionDate, batchNo: batchNo || undefined, serialNos: serialText ? serialText.split(/[\s,]+/).filter(Boolean) : undefined, comment: remarks }), 'Progress saved')}>Save Progress</Button>
          <Button disabled={busy || !perms.canCompleteProduction} onClick={() => void run(async () => completeProductionQuantityDemo(wo.id, { goodQty, rejectedQty, scrapQty, reworkQty, productionDate, differenceReason: differenceReason || undefined, comment: remarks }), 'Quantity completed')}>Complete Quantity</Button>
          <Button disabled={busy || !perms.canCompleteAndClose} onClick={() => void run(async () => completeAndCloseWorkOrderDemo(wo.id, { goodQty, rejectedQty, scrapQty, reworkQty, productionDate, differenceReason: differenceReason || undefined }), 'Completed and closed')}>Complete and Close</Button>
        </div>
      )}>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Good Quantity" required><Input id="cp-good" type="number" min={0.001} step="any" value={goodQty} onChange={(e) => setGoodQty(Number(e.target.value))} className="text-lg" /></FormField>
          <FormField label="Production Date"><Input id="cp-date" type="date" value={productionDate} onChange={(e) => setProductionDate(e.target.value)} /></FormField>
          <FormField label="Rejected Quantity"><Input id="cp-rej" type="number" min={0} value={rejectedQty} onChange={(e) => setRejectedQty(Number(e.target.value))} /></FormField>
          <FormField label="Scrap Quantity"><Input id="cp-scr" type="number" min={0} value={scrapQty} onChange={(e) => setScrapQty(Number(e.target.value))} /></FormField>
          <FormField label="Rework Quantity"><Input id="cp-rw" type="number" min={0} value={reworkQty} onChange={(e) => setReworkQty(Number(e.target.value))} /></FormField>
          {wo.batchRequired ? <FormField label="Finished Batch"><Input id="cp-batch" value={batchNo} onChange={(e) => setBatchNo(e.target.value)} /></FormField> : null}
          {wo.serialRequired ? <FormField label="Serial Numbers"><Textarea id="cp-ser" value={serialText} onChange={(e) => setSerialText(e.target.value)} rows={2} /></FormField> : null}
          <FormField label="Difference Reason (if under/over)" className="sm:col-span-2"><Input id="cp-diff" value={differenceReason} onChange={(e) => setDifferenceReason(e.target.value)} /></FormField>
        </div>
        {completionPreview ? (
          <dl className="mt-4 grid grid-cols-2 gap-2 rounded-md border border-erp-border p-3 text-[12px] sm:grid-cols-4">
            <div><dt className="text-erp-muted">Planned</dt><dd>{completionPreview.plannedQty}</dd></div>
            <div><dt className="text-erp-muted">Previously Produced</dt><dd>{completionPreview.previouslyProduced}</dd></div>
            <div><dt className="text-erp-muted">Remaining</dt><dd>{completionPreview.remainingQty}</dd></div>
            <div><dt className="text-erp-muted">FG Warehouse</dt><dd>{completionPreview.fgWarehouseName}</dd></div>
          </dl>
        ) : null}
        {consumption && settings?.materialConsumption.automaticConsumption ? (
          <div className="mt-3">
            <h3 className="text-[13px] font-semibold">Material consumption preview</h3>
            <ul className="mt-1 max-h-40 overflow-auto text-[12px]">
              {consumption.lines.map((l) => (
                <li key={l.componentItemCode} className="flex justify-between border-b border-erp-border py-1">
                  <span>{l.componentItemCode}</span>
                  <span>{l.requiredForOutput} {l.uom}{l.shortage > 0 ? ` · short ${l.shortage}` : ''}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Modal>

      <Modal open={dialog === 'close'} onClose={() => setDialog(null)} title="Close Work Order" size="lg" footer={(
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDialog(null)}>Return to Production</Button>
          <Button disabled={busy} onClick={() => void run(async () => {
            if (closingPreview && Math.abs(closingPreview.materialDifference) > 0.01) {
              return closeWorkOrderWithDifferenceDemo(wo.id, differenceReason || 'Approved difference')
            }
            return closeWorkOrderDemo(wo.id)
          }, 'Work order closed')}>Close Work Order</Button>
        </div>
      )}>
        {closingPreview ? (
          <div className="grid gap-2 text-[13px] sm:grid-cols-2">
            <Field label="Planned" value={closingPreview.plannedQty} />
            <Field label="Good" value={closingPreview.goodQty} />
            <Field label="Material Difference" value={closingPreview.materialDifference} />
            <Field label="Quality" value={closingPreview.qualityStatus} />
            {Math.abs(closingPreview.materialDifference) > 0.01 ? (
              <FormField label="Difference Reason" className="sm:col-span-2"><Input id="cl-diff" value={differenceReason} onChange={(e) => setDifferenceReason(e.target.value)} /></FormField>
            ) : null}
            {closingPreview.blockers.length ? <p className="sm:col-span-2 text-red-700" role="alert">{closingPreview.blockers.join('; ')}</p> : null}
          </div>
        ) : <LoadingState />}
      </Modal>

      <Modal open={dialog === 'cancel'} onClose={() => setDialog(null)} title="Cancel Work Order" footer={(
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDialog(null)}>Back</Button>
          <Button disabled={busy || !perms.canCancelWo} onClick={() => void run(() => cancelWorkOrderDemo(wo.id, remarks), 'Cancelled')}>Confirm Cancel</Button>
        </div>
      )}>
        <FormField label="Reason"><Textarea id="cn-rm" value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={3} /></FormField>
      </Modal>

      <Modal open={dialog === 'more'} onClose={() => setDialog(null)} title="More actions" size="sm">
        <div className="flex flex-col gap-1">
          {[
            { id: 'issue' as const, label: 'Issue Material', show: Boolean(settings?.materialConsumption.manualMaterialIssue && perms.canIssueMaterials) },
            { id: 'return' as const, label: 'Return Material', show: perms.canReturnMaterials },
            { id: 'scrap' as const, label: 'Record Scrap', show: perms.canRecordScrap },
            { id: 'rework' as const, label: 'Record Rework', show: perms.canManageRework },
            { id: 'quality' as const, label: 'Quality Review', show: perms.canInspectQuality && Boolean(quality) },
            { id: 'cost' as const, label: 'View Cost', show: perms.canViewCost },
            { id: 'cancel' as const, label: 'Cancel', show: perms.canCancelWo && !readOnly },
          ].filter((x) => x.show).map((x) => (
            <Button key={x.id} variant="secondary" className="justify-start" onClick={() => setDialog(x.id)}>{x.label}</Button>
          ))}
          <p className="mt-2 text-[11px] text-erp-muted">Print Job Card is optional and disabled by default.</p>
        </div>
      </Modal>

      <Modal open={dialog === 'issue'} onClose={() => setDialog(null)} title="Material Issue" size="lg" footer={(
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDialog(null)}>Cancel</Button>
          <Button disabled={busy} onClick={() => void run(() => confirmManualMaterialIssueDemo(wo.id, issueLines.map((l) => ({ materialId: l.id, issueQty: l.issueQty, batchOrSerial: l.batchOrSerial }))), 'Material issued')}>Confirm Issue Demo</Button>
        </div>
      )}>
        {!settings?.materialConsumption.manualMaterialIssue ? (
          <p className="text-[13px] text-erp-muted">Manual material issue is disabled. Automatic consumption is the default.</p>
        ) : (
          <ul className="space-y-2 text-[13px]">
            {issueLines.map((l, idx) => (
              <li key={l.id} className="grid gap-2 border-b border-erp-border pb-2 sm:grid-cols-3">
                <span className="font-medium">{l.componentItemCode} · pending {l.pendingQty}</span>
                <FormField label="Issue Qty"><Input id={`iss-${l.id}`} type="number" value={l.issueQty} onChange={(e) => { const next = [...issueLines]; next[idx] = { ...l, issueQty: Number(e.target.value) }; setIssueLines(next) }} /></FormField>
                <FormField label="Batch/Serial"><Input id={`issb-${l.id}`} value={l.batchOrSerial ?? ''} onChange={(e) => { const next = [...issueLines]; next[idx] = { ...l, batchOrSerial: e.target.value }; setIssueLines(next) }} /></FormField>
              </li>
            ))}
          </ul>
        )}
      </Modal>

      <Modal open={dialog === 'return'} onClose={() => setDialog(null)} title="Return Unused Material" size="lg" footer={(
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDialog(null)}>Cancel</Button>
          <Button disabled={busy} onClick={() => void run(() => returnUnusedMaterialDemo(wo.id, returnLines.map((l) => ({ materialId: l.id, returnQty: l.returnQty, reason: l.reason }))), 'Material returned')}>Confirm Return</Button>
        </div>
      )}>
        <ul className="space-y-2 text-[13px]">
          {returnLines.map((l, idx) => (
            <li key={l.id} className="grid gap-2 border-b border-erp-border pb-2 sm:grid-cols-3">
              <span>{l.componentItemCode} · returnable {l.returnableQty}</span>
              <FormField label="Return Qty"><Input id={`ret-${l.id}`} type="number" value={l.returnQty} onChange={(e) => { const next = [...returnLines]; next[idx] = { ...l, returnQty: Number(e.target.value) }; setReturnLines(next) }} /></FormField>
              <FormField label="Reason"><Input id={`retr-${l.id}`} value={l.reason ?? ''} onChange={(e) => { const next = [...returnLines]; next[idx] = { ...l, reason: e.target.value }; setReturnLines(next) }} /></FormField>
            </li>
          ))}
        </ul>
      </Modal>

      <Modal open={dialog === 'scrap'} onClose={() => setDialog(null)} title="Record Scrap" footer={(
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDialog(null)}>Cancel</Button>
          <Button disabled={busy} onClick={() => void run(() => recordProductionScrapDemo(wo.id, { scrapQty, reason: scrapReason, remarks }), 'Scrap recorded')}>Save Scrap</Button>
        </div>
      )}>
        <div className="grid gap-3">
          <FormField label="Scrap Quantity" required><Input id="sc-qty" type="number" min={0} value={scrapQty} onChange={(e) => setScrapQty(Number(e.target.value))} /></FormField>
          <FormField label="Reason"><Select id="sc-reason" value={scrapReason} onChange={(e) => setScrapReason(e.target.value as ScrapReason)}>{(Object.keys(SCRAP_REASON_LABELS) as ScrapReason[]).map((r) => <option key={r} value={r}>{SCRAP_REASON_LABELS[r]}</option>)}</Select></FormField>
          <FormField label="Remarks"><Textarea id="sc-rm" value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} /></FormField>
        </div>
      </Modal>

      <Modal open={dialog === 'rework'} onClose={() => setDialog(null)} title="Record Rework" footer={(
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDialog(null)}>Cancel</Button>
          <Button disabled={busy} onClick={() => void run(() => createProductionReworkDemo(wo.id, { reworkQty, reason: remarks || 'Rework', expectedCompletionDate: expectedResume || productionDate, workstation, remarks }), 'Rework created')}>Create Rework</Button>
        </div>
      )}>
        <div className="grid gap-3">
          <FormField label="Rework Quantity" required><Input id="rw-qty" type="number" min={0} value={reworkQty} onChange={(e) => setReworkQty(Number(e.target.value))} /></FormField>
          <FormField label="Expected Completion"><Input id="rw-exp" type="date" value={expectedResume} onChange={(e) => setExpectedResume(e.target.value)} /></FormField>
          <FormField label="Workstation"><Input id="rw-ws" value={workstation} onChange={(e) => setWorkstation(e.target.value)} /></FormField>
          <FormField label="Reason / Remarks"><Textarea id="rw-rm" value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} /></FormField>
        </div>
      </Modal>

      <Modal open={dialog === 'quality'} onClose={() => setDialog(null)} title="Quality Review" size="lg">
        {quality ? (
          <div className="space-y-3 text-[13px]">
            <div className="font-medium">{quality.finishedItemCode} · Produced {quality.producedQty} · {quality.result}</div>
            <div className="flex flex-wrap gap-2">
              {(['accepted', 'partially_accepted', 'rejected', 'rework', 'accepted_under_deviation'] as const).map((result) => (
                <Button key={result} size="sm" variant="secondary" disabled={busy || !perms.canInspectQuality || (result === 'accepted_under_deviation' && !perms.canAcceptDeviation)} onClick={() => void run(() => updateProductionQualityResultDemo(wo.id, { result, acceptedQty: result === 'rejected' ? 0 : quality.producedQty, rejectedQty: result === 'rejected' ? quality.producedQty : 0, reworkQty: result === 'rework' ? quality.producedQty : 0, inspector: 'QC User' }), `Quality ${result.replace(/_/g, ' ')}`)}>{result.replace(/_/g, ' ')}</Button>
              ))}
            </div>
          </div>
        ) : <p className="text-erp-muted">No quality reviews pending.</p>}
      </Modal>

      <Modal open={dialog === 'cost'} onClose={() => setDialog(null)} title="Cost & Variance Preview" size="lg">
        {costPreview ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <dl className="space-y-1 text-[13px]">
              <Field label="Material Cost" value={formatCurrency(costPreview.materialCost)} />
              <Field label="Labour Cost" value={formatCurrency(costPreview.labourCost)} />
              <Field label="Machine Cost" value={formatCurrency(costPreview.machineCost)} />
              <Field label="Job Work Cost" value={formatCurrency(costPreview.jobWorkCost)} />
              <Field label="Total" value={formatCurrency(costPreview.totalProductionCost)} />
              <Field label="Cost / Good Unit" value={formatCurrency(costPreview.costPerGoodUnit)} />
            </dl>
            {variancePreview ? (
              <dl className="space-y-1 text-[13px]">
                <Field label="Planned vs Consumed Material" value={`${variancePreview.plannedMaterial} / ${variancePreview.consumedMaterial}`} />
                <Field label="Planned vs Actual Output" value={`${variancePreview.plannedOutput} / ${variancePreview.actualOutput}`} />
                <Field label="Yield Diff" value={variancePreview.yieldDiff} />
                <Field label="Scrap Diff" value={variancePreview.scrapDiff} />
              </dl>
            ) : null}
          </div>
        ) : <LoadingState />}
      </Modal>
    </OperationalPageShell>
  )
}
