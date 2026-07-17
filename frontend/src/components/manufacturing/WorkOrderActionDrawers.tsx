import { useEffect, useMemo, useState } from 'react'
import { FormField } from '@/components/forms/FormField'
import { Input, Select, Textarea } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import { StatusDot, statusToneFromLabel } from '@/components/design-system/StatusDot'
import { ManufacturingActionDrawer } from './ManufacturingActionDrawer'
import { MfgTouchBtn } from './ManufacturingMobile'
import type {
  HoldReason,
  ProductionCostPreview,
  ProductionQualityReview,
  WorkOrder,
  WorkOrderClosingPreview,
  WorkOrderMaterial,
} from '@/types/manufacturingWorkOrder'
import {
  HOLD_REASON_LABELS,
  WO_MATERIAL_STATUS_LABELS,
  WO_QC_STATUS_LABELS,
  getWorkOrderQcStatus,
} from '@/types/manufacturingWorkOrder'
import { formatCurrency } from '@/utils/formatters/currency'

const touchInput = 'min-h-12 text-[16px] md:min-h-0 md:text-[13px]'

function SummaryField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-erp-muted">{label}</div>
      <div className="mt-0.5 text-[15px] font-medium text-erp-text md:text-[13px]">{value ?? '—'}</div>
    </div>
  )
}

function DrawerActions({
  onCancel,
  cancelLabel = 'Cancel',
  busy,
  children,
}: {
  onCancel: () => void
  cancelLabel?: string
  busy?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <MfgTouchBtn variant="secondary" disabled={busy} onClick={onCancel} className="sm:flex-none sm:min-w-[7rem]">
        {cancelLabel}
      </MfgTouchBtn>
      {children}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* 1. Check Material                                                          */
/* -------------------------------------------------------------------------- */

export function CheckMaterialDrawer({
  open,
  onClose,
  woNumber,
  materials,
  busy,
  canReserve,
  canCreatePr,
  onReserve,
  onCreatePr,
  onRecheck,
}: {
  open: boolean
  onClose: () => void
  woNumber: string
  materials: WorkOrderMaterial[]
  busy?: boolean
  canReserve?: boolean
  canCreatePr?: boolean
  onReserve: () => void
  onCreatePr: () => void
  onRecheck?: () => void
}) {
  const shortages = useMemo(() => materials.filter((m) => m.shortageQty > 0), [materials])
  const hasShortage = shortages.length > 0

  return (
    <ManufacturingActionDrawer
      open={open}
      onClose={onClose}
      title="Check Materials"
      subtitle={woNumber}
      widthClassName="max-w-xl"
      closeDisabled={busy}
      footer={(
        <DrawerActions onCancel={onClose} cancelLabel="Close" busy={busy}>
          {onRecheck ? (
            <MfgTouchBtn variant="secondary" disabled={busy} onClick={onRecheck} className="sm:flex-none">
              Recheck
            </MfgTouchBtn>
          ) : null}
          {canReserve ? (
            <MfgTouchBtn disabled={busy || hasShortage} variant="primary" onClick={onReserve} className="sm:flex-none sm:min-w-[8rem]">
              Reserve
            </MfgTouchBtn>
          ) : null}
        </DrawerActions>
      )}
    >
      <div className="space-y-3">
        {hasShortage ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-[14px] text-amber-900 md:text-[12px]" role="status">
            {shortages.length} line{shortages.length === 1 ? '' : 's'} short — reserve blocked until stock arrives.
            {canCreatePr ? ' Create a purchase request for shortages below.' : null}
          </div>
        ) : (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-[14px] text-emerald-900 md:text-[12px]" role="status">
            Materials available — you can reserve stock for this work order.
          </div>
        )}

        <ul className="space-y-2 md:hidden">
          {materials.length === 0 ? (
            <li className="rounded-lg border border-dashed border-erp-border px-3 py-8 text-center text-erp-muted">No material lines</li>
          ) : (
            materials.map((m) => (
              <li
                key={m.id}
                className={`rounded-xl border border-erp-border p-3 ${m.shortageQty > 0 ? 'border-amber-200 bg-amber-50/60' : 'bg-white'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-[14px] font-semibold">{m.componentItemCode}</p>
                    <p className="text-[12px] text-erp-muted">{m.componentItemName}</p>
                  </div>
                  <StatusDot tone={statusToneFromLabel(m.status)} label={WO_MATERIAL_STATUS_LABELS[m.status]} />
                </div>
                <dl className="mt-2 grid grid-cols-3 gap-2 text-[13px]">
                  <div>
                    <dt className="text-erp-muted">Req</dt>
                    <dd className="font-semibold tabular-nums">{m.requiredQty}</dd>
                  </div>
                  <div>
                    <dt className="text-erp-muted">Avail</dt>
                    <dd className="font-semibold tabular-nums">{m.availableQty}</dd>
                  </div>
                  <div>
                    <dt className="text-erp-muted">Short</dt>
                    <dd className="font-semibold tabular-nums">{m.shortageQty}</dd>
                  </div>
                </dl>
              </li>
            ))
          )}
        </ul>

        <div className="hidden overflow-x-auto rounded-lg border border-erp-border md:block">
          <table className="erp-table w-full text-[12px]">
            <thead>
              <tr>
                <th>Required material</th>
                <th className="text-right">Required</th>
                <th className="text-right">Available</th>
                <th className="text-right">Shortage</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {materials.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-erp-muted">No material lines</td>
                </tr>
              ) : (
                materials.map((m) => (
                  <tr key={m.id} className={m.shortageQty > 0 ? 'bg-amber-50/60' : undefined}>
                    <td>
                      <div className="font-mono font-medium">{m.componentItemCode}</div>
                      <div className="text-[11px] text-erp-muted">{m.componentItemName}</div>
                    </td>
                    <td className="tabular-nums text-right">{m.requiredQty} {m.uom}</td>
                    <td className="tabular-nums text-right">{m.availableQty}</td>
                    <td className="tabular-nums text-right">{m.shortageQty}</td>
                    <td>
                      <StatusDot tone={statusToneFromLabel(m.status)} label={WO_MATERIAL_STATUS_LABELS[m.status]} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {hasShortage && canCreatePr ? (
          <div className="rounded-xl border border-erp-border bg-slate-50 p-3">
            <p className="text-[13px] font-semibold text-erp-text">Shortages</p>
            <ul className="mt-2 space-y-1 text-[13px] text-erp-muted">
              {shortages.map((m) => (
                <li key={m.id}>
                  {m.componentItemCode}: short {m.shortageQty} {m.uom}
                </li>
              ))}
            </ul>
            <MfgTouchBtn className="mt-3 w-full" variant="secondary" disabled={busy} onClick={onCreatePr}>
              Create Purchase Request
            </MfgTouchBtn>
          </div>
        ) : null}
      </div>
    </ManufacturingActionDrawer>
  )
}

/* -------------------------------------------------------------------------- */
/* 2. Start Production                                                        */
/* -------------------------------------------------------------------------- */

export function StartProductionDrawer({
  open,
  onClose,
  woNumber,
  busy,
  warnings,
  initial,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  woNumber: string
  busy?: boolean
  warnings?: string[]
  initial: {
    startAt: string
    operator: string
    machineLine: string
    shift: string
    remarks: string
  }
  onConfirm: (values: {
    startAt: string
    operator: string
    machineLine: string
    shift: string
    remarks: string
  }) => void
}) {
  const [startAt, setStartAt] = useState(initial.startAt)
  const [operator, setOperator] = useState(initial.operator)
  const [machineLine, setMachineLine] = useState(initial.machineLine)
  const [shift, setShift] = useState(initial.shift)
  const [remarks, setRemarks] = useState(initial.remarks)

  useEffect(() => {
    if (!open) return
    setStartAt(initial.startAt)
    setOperator(initial.operator)
    setMachineLine(initial.machineLine)
    setShift(initial.shift)
    setRemarks(initial.remarks)
  }, [initial, open])

  return (
    <ManufacturingActionDrawer
      open={open}
      onClose={onClose}
      title="Start Production"
      subtitle={woNumber}
      closeDisabled={busy}
      footer={(
        <DrawerActions onCancel={onClose} busy={busy}>
          <MfgTouchBtn
            disabled={busy || !startAt}
            variant="primary"
            className="sm:flex-none sm:min-w-[8rem]"
            onClick={() => onConfirm({ startAt, operator, machineLine, shift, remarks })}
          >
            Start
          </MfgTouchBtn>
        </DrawerActions>
      )}
    >
      <div className="grid gap-3">
        <FormField label="Start Date / Time" required>
          <Input type="datetime-local" className={touchInput} value={startAt} onChange={(e) => setStartAt(e.target.value)} />
        </FormField>
        <FormField label="Operator">
          <Input className={touchInput} value={operator} onChange={(e) => setOperator(e.target.value)} placeholder="Operator name" />
        </FormField>
        <FormField label="Machine / Line">
          <Input className={touchInput} value={machineLine} onChange={(e) => setMachineLine(e.target.value)} placeholder="e.g. Line-1" />
        </FormField>
        <FormField label="Shift">
          <Select className={touchInput} value={shift} onChange={(e) => setShift(e.target.value)}>
            <option value="A">Shift A</option>
            <option value="B">Shift B</option>
            <option value="C">Shift C</option>
            <option value="General">General</option>
          </Select>
        </FormField>
        <div className="md:hidden">
          <details className="rounded-xl border border-erp-border bg-slate-50 open:bg-white">
            <summary className="cursor-pointer list-none px-3 py-3 text-[14px] font-semibold text-erp-text marker:content-none">
              Remarks (optional)
            </summary>
            <div className="px-3 pb-3">
              <Textarea
                className={touchInput}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={2}
                placeholder="Optional notes"
              />
            </div>
          </details>
        </div>
        <div className="hidden md:block">
          <FormField label="Remarks">
            <Textarea className={touchInput} value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} />
          </FormField>
        </div>
        {warnings && warnings.length > 0 ? (
          <ul className="list-disc pl-4 text-[14px] text-amber-800 md:text-[12px]" role="alert">
            {warnings.map((w) => <li key={w}>{w}</li>)}
          </ul>
        ) : null}
      </div>
    </ManufacturingActionDrawer>
  )
}

/* -------------------------------------------------------------------------- */
/* 3. Hold Work Order                                                         */
/* -------------------------------------------------------------------------- */

const HOLD_OPTIONS = (Object.keys(HOLD_REASON_LABELS) as HoldReason[])

export function HoldWorkOrderDrawer({
  open,
  onClose,
  woNumber,
  busy,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  woNumber: string
  busy?: boolean
  onConfirm: (values: { reason: HoldReason; expectedResumeDate: string; remarks: string }) => void
}) {
  const [reason, setReason] = useState<HoldReason>('material_shortage')
  const [expectedResumeDate, setExpectedResumeDate] = useState('')
  const [remarks, setRemarks] = useState('')

  useEffect(() => {
    if (!open) return
    setReason('material_shortage')
    setExpectedResumeDate('')
    setRemarks('')
  }, [open])

  return (
    <ManufacturingActionDrawer
      open={open}
      onClose={onClose}
      title="Hold Work Order"
      subtitle={woNumber}
      closeDisabled={busy}
      footer={(
        <DrawerActions onCancel={onClose} busy={busy}>
          <MfgTouchBtn
            disabled={busy}
            variant="primary"
            className="sm:flex-none sm:min-w-[8rem]"
            onClick={() => onConfirm({ reason, expectedResumeDate, remarks })}
          >
            Hold
          </MfgTouchBtn>
        </DrawerActions>
      )}
    >
      <div className="grid gap-3">
        <FormField label="Hold Reason" required>
          <Select className={touchInput} value={reason} onChange={(e) => setReason(e.target.value as HoldReason)}>
            {HOLD_OPTIONS.map((r) => (
              <option key={r} value={r}>{HOLD_REASON_LABELS[r]}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="Expected Resume Date">
          <Input type="date" className={touchInput} value={expectedResumeDate} onChange={(e) => setExpectedResumeDate(e.target.value)} />
        </FormField>
        <FormField label="Remarks">
          <Textarea className={touchInput} value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={3} />
        </FormField>
      </div>
    </ManufacturingActionDrawer>
  )
}

/* -------------------------------------------------------------------------- */
/* 4. Complete Production                                                     */
/* -------------------------------------------------------------------------- */

export function CompleteProductionDrawer({
  open,
  onClose,
  wo,
  busy,
  defaultAutoConsume,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  wo: WorkOrder
  busy?: boolean
  defaultAutoConsume?: boolean
  onConfirm: (values: {
    goodQty: number
    scrapQty: number
    reworkQty: number
    rejectedQty: number
    completionAt: string
    autoConsume: boolean
    remarks: string
  }) => void
}) {
  const [goodQty, setGoodQty] = useState(Math.max(1, wo.remainingQty || 1))
  const [scrapQty, setScrapQty] = useState(0)
  const [reworkQty, setReworkQty] = useState(0)
  const [rejectedQty, setRejectedQty] = useState(0)
  const [completionAt, setCompletionAt] = useState(() => new Date().toISOString().slice(0, 16))
  const [autoConsume, setAutoConsume] = useState(defaultAutoConsume ?? wo.consumptionMode === 'automatic')
  const [remarks, setRemarks] = useState('')

  useEffect(() => {
    if (!open) return
    setGoodQty(Math.max(1, wo.remainingQty || 1))
    setScrapQty(0)
    setReworkQty(0)
    setRejectedQty(0)
    setCompletionAt(new Date().toISOString().slice(0, 16))
    setAutoConsume(defaultAutoConsume ?? wo.consumptionMode === 'automatic')
    setRemarks('')
  }, [defaultAutoConsume, open, wo.consumptionMode, wo.remainingQty])

  return (
    <ManufacturingActionDrawer
      open={open}
      onClose={onClose}
      title="Complete Production"
      subtitle={`${wo.woNumber} · remaining ${wo.remainingQty} ${wo.uom}`}
      closeDisabled={busy}
      footer={(
        <DrawerActions onCancel={onClose} busy={busy}>
          <MfgTouchBtn
            disabled={busy || goodQty <= 0}
            variant="primary"
            className="sm:flex-none sm:min-w-[10rem]"
            onClick={() => onConfirm({ goodQty, scrapQty, reworkQty, rejectedQty, completionAt, autoConsume, remarks })}
          >
            Complete
          </MfgTouchBtn>
        </DrawerActions>
      )}
    >
      <div className="grid gap-3">
        <FormField label="Good Qty" required>
          <Input
            type="number"
            min={0.001}
            step="any"
            className={`${touchInput} text-[20px] font-semibold`}
            value={goodQty}
            onChange={(e) => setGoodQty(Number(e.target.value))}
          />
        </FormField>
        <FormField label="Completion Date / Time" required>
          <Input type="datetime-local" className={touchInput} value={completionAt} onChange={(e) => setCompletionAt(e.target.value)} />
        </FormField>
        <label className="flex min-h-12 items-center gap-3 rounded-xl border border-erp-border bg-slate-50 px-3 text-[14px] text-erp-text">
          <input
            type="checkbox"
            className="h-5 w-5 rounded border-erp-border"
            checked={autoConsume}
            onChange={(e) => setAutoConsume(e.target.checked)}
          />
          Auto-consume BOM materials
        </label>
        <details className="rounded-xl border border-erp-border bg-slate-50 open:bg-white">
          <summary className="cursor-pointer list-none px-3 py-3 text-[14px] font-semibold text-erp-text marker:content-none">
            Scrap / Rework / Reject (optional)
          </summary>
          <div className="grid gap-3 px-3 pb-3 sm:grid-cols-3">
            <FormField label="Scrap Qty">
              <Input type="number" min={0} step="any" className={touchInput} value={scrapQty} onChange={(e) => setScrapQty(Number(e.target.value))} />
            </FormField>
            <FormField label="Rework Qty">
              <Input type="number" min={0} step="any" className={touchInput} value={reworkQty} onChange={(e) => setReworkQty(Number(e.target.value))} />
            </FormField>
            <FormField label="Rejected Qty">
              <Input type="number" min={0} step="any" className={touchInput} value={rejectedQty} onChange={(e) => setRejectedQty(Number(e.target.value))} />
            </FormField>
          </div>
        </details>
        <FormField label="Remarks">
          <Textarea className={touchInput} value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} />
        </FormField>
      </div>
    </ManufacturingActionDrawer>
  )
}

/* -------------------------------------------------------------------------- */
/* 5. QC Action                                                               */
/* -------------------------------------------------------------------------- */

export function QcActionDrawer({
  open,
  onClose,
  woNumber,
  review,
  busy,
  onAction,
}: {
  open: boolean
  onClose: () => void
  woNumber: string
  review: ProductionQualityReview | null
  busy?: boolean
  onAction: (
    action: 'accepted' | 'rejected' | 'rework',
    values: { inspectedQty: number; acceptedQty: number; rejectedQty: number; reworkQty: number; remarks: string },
  ) => void
}) {
  const produced = review?.producedQty ?? 0
  const [inspectedQty, setInspectedQty] = useState(produced)
  const [acceptedQty, setAcceptedQty] = useState(produced)
  const [rejectedQty, setRejectedQty] = useState(0)
  const [reworkQty, setReworkQty] = useState(0)
  const [remarks, setRemarks] = useState('')

  useEffect(() => {
    if (!open) return
    const qty = review?.producedQty ?? 0
    setInspectedQty(qty)
    setAcceptedQty(qty)
    setRejectedQty(0)
    setReworkQty(0)
    setRemarks('')
  }, [open, review?.producedQty])

  return (
    <ManufacturingActionDrawer
      open={open}
      onClose={onClose}
      title="QC Action"
      subtitle={woNumber}
      closeDisabled={busy}
      footer={(
        <div className="flex flex-col-reverse gap-2">
          <MfgTouchBtn variant="secondary" onClick={onClose} disabled={busy}>Cancel</MfgTouchBtn>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <MfgTouchBtn
              disabled={busy || !review}
              variant="primary"
              onClick={() => onAction('accepted', { inspectedQty, acceptedQty, rejectedQty, reworkQty, remarks })}
            >
              QC Accept
            </MfgTouchBtn>
            <MfgTouchBtn
              variant="secondary"
              disabled={busy || !review}
              onClick={() => onAction('rejected', {
                inspectedQty,
                acceptedQty: 0,
                rejectedQty: rejectedQty || inspectedQty,
                reworkQty: 0,
                remarks,
              })}
            >
              Reject
            </MfgTouchBtn>
            <MfgTouchBtn
              variant="secondary"
              disabled={busy || !review}
              onClick={() => onAction('rework', {
                inspectedQty,
                acceptedQty: 0,
                rejectedQty: 0,
                reworkQty: reworkQty || inspectedQty,
                remarks,
              })}
            >
              Rework
            </MfgTouchBtn>
          </div>
        </div>
      )}
    >
      {!review || review.result !== 'pending' ? (
        <p className="text-[14px] text-erp-muted">No pending QC review for this work order.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Inspected Qty" required>
            <Input type="number" min={0} step="any" className={touchInput} value={inspectedQty} onChange={(e) => setInspectedQty(Number(e.target.value))} />
          </FormField>
          <FormField label="Accepted Qty">
            <Input type="number" min={0} step="any" className={touchInput} value={acceptedQty} onChange={(e) => setAcceptedQty(Number(e.target.value))} />
          </FormField>
          <FormField label="Rejected Qty">
            <Input type="number" min={0} step="any" className={touchInput} value={rejectedQty} onChange={(e) => setRejectedQty(Number(e.target.value))} />
          </FormField>
          <FormField label="Rework Qty">
            <Input type="number" min={0} step="any" className={touchInput} value={reworkQty} onChange={(e) => setReworkQty(Number(e.target.value))} />
          </FormField>
          <FormField label="QC Remarks" className="sm:col-span-2">
            <Textarea className={touchInput} value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={3} placeholder="Inspection notes" />
          </FormField>
        </div>
      )}
    </ManufacturingActionDrawer>
  )
}

/* -------------------------------------------------------------------------- */
/* 6. Close Work Order                                                        */
/* -------------------------------------------------------------------------- */

export function CloseWorkOrderDrawer({
  open,
  onClose,
  wo,
  preview,
  cost,
  busy,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  wo: WorkOrder
  preview: WorkOrderClosingPreview | null
  cost?: ProductionCostPreview | null
  busy?: boolean
  onConfirm: () => void
}) {
  const qcStatus = getWorkOrderQcStatus(wo)
  const blockers = preview?.blockers ?? []
  const canClose = blockers.length === 0

  return (
    <ManufacturingActionDrawer
      open={open}
      onClose={onClose}
      title="Close Work Order"
      subtitle={`${wo.woNumber} becomes read-only after close`}
      closeDisabled={busy}
      footer={(
        <DrawerActions onCancel={onClose} cancelLabel="Back" busy={busy}>
          <MfgTouchBtn
            disabled={busy || !preview || !canClose}
            variant="primary"
            className="sm:flex-none sm:min-w-[10rem]"
            onClick={onConfirm}
          >
            Confirm Close
          </MfgTouchBtn>
        </DrawerActions>
      )}
    >
      {!preview ? (
        <LoadingState variant="card" rows={4} />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <SummaryField label="Planned Qty" value={`${preview.plannedQty} ${wo.uom}`} />
            <SummaryField label="Good Qty" value={`${preview.goodQty} ${wo.uom}`} />
            <SummaryField label="Scrap" value={preview.scrapQty} />
            <SummaryField label="Rework" value={preview.reworkQty} />
            <SummaryField label="Reject" value={preview.rejectedQty} />
            <SummaryField label="Material consumed" value={preview.materialConsumed} />
            <SummaryField label="QC Status" value={WO_QC_STATUS_LABELS[qcStatus]} />
            <SummaryField label="Quality review" value={preview.qualityStatus} />
          </div>

          {(cost ?? preview.cost) ? (
            <div className="rounded-lg border border-erp-border bg-slate-50 p-3">
              <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-erp-muted">Cost summary</p>
              <dl className="grid gap-2 text-[13px] sm:grid-cols-2">
                <div className="flex justify-between gap-2"><dt className="text-erp-muted">Material</dt><dd className="tabular-nums">{formatCurrency((cost ?? preview.cost).materialCost)}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-erp-muted">Labour</dt><dd className="tabular-nums">{formatCurrency((cost ?? preview.cost).labourCost)}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-erp-muted">Machine</dt><dd className="tabular-nums">{formatCurrency((cost ?? preview.cost).machineCost)}</dd></div>
                <div className="flex justify-between gap-2 font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatCurrency((cost ?? preview.cost).totalProductionCost)}</dd></div>
              </dl>
            </div>
          ) : null}

          {blockers.length > 0 ? (
            <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-800" role="alert">
              Cannot close: {blockers.join('; ')}
            </p>
          ) : (
            <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-900">
              Ready to close. The work order will become read-only.
            </p>
          )}
        </div>
      )}
    </ManufacturingActionDrawer>
  )
}
