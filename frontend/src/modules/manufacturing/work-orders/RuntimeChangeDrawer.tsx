import { useEffect, useMemo, useState } from 'react'
import { Modal } from '@/design-system/components/Modal'
import { Button } from '@/design-system/components/Button'
import { FormField } from '@/components/forms/FormField'
import { Input, Select, Textarea } from '@/components/forms/Inputs'
import { fetchAdminUsersApi } from '@/services/api/adminApi'
import { listMachines, listWorkCentres, previewRuntimeChange, createRuntimeChange, submitRuntimeChange, applyRuntimeChange } from '@/services/api/manufacturingApi'
import type { RuntimeChangeInput, RuntimeChangePreview, RuntimeChangeType } from '@/types/manufacturingRuntimeChange'
import { RUNTIME_CHANGE_TYPE_LABELS, RUNTIME_CHANGE_TYPES } from '@/types/manufacturingRuntimeChange'
import type { WorkOrderDetail } from '@/types/manufacturingProduction'
import { HOLD_REASON_CATEGORY_LABELS, HOLD_REASON_CATEGORY_VALUES, PRODUCTION_PRIORITY_LABELS, PRODUCTION_PRIORITY_VALUES } from '@/types/manufacturingProduction'
import { canRequestAssignmentChange, canRequestHoldChange, canRequestJobWorkChange, canRequestMachineChange, canRequestQuantityChange, canRequestRouteChange, canRequestRuntimeChange, canRequestScheduleChange, canRequestSkipChange, canRequestWorkCentreChange } from '@/utils/permissions/manufacturing'
import { notify } from '@/store/toastStore'
import { useSetupLookup } from '../setup/useSetupLookups'

type Props = { open: boolean; onClose: () => void; workOrder: WorkOrderDetail; onChanged: () => void }
type Option = { id: string; label: string }
const terminal = new Set(['COMPLETED', 'CLOSED', 'CANCELLED'])
const operationTypes = new Set<RuntimeChangeType>(['MACHINE_CHANGE', 'WORK_CENTRE_CHANGE', 'REPEAT_OPERATION', 'SKIP_OPERATION'])
const stageTypes = new Set<RuntimeChangeType>(['STAGE_HOLD', 'STAGE_RESUME'])

function permitted(type: RuntimeChangeType) {
  if (!canRequestRuntimeChange()) return false
  if (type === 'QUANTITY_CHANGE') return canRequestQuantityChange()
  if (['DUE_DATE_CHANGE', 'PRIORITY_CHANGE'].includes(type)) return canRequestScheduleChange()
  if (['SUPERVISOR_CHANGE', 'OPERATOR_CHANGE'].includes(type)) return canRequestAssignmentChange()
  if (type === 'MACHINE_CHANGE') return canRequestMachineChange()
  if (type === 'WORK_CENTRE_CHANGE') return canRequestWorkCentreChange()
  if (['ADD_OPERATION', 'REPEAT_OPERATION'].includes(type)) return canRequestRouteChange()
  if (type === 'SKIP_OPERATION') return canRequestSkipChange()
  if (type === 'CONVERT_TO_JOB_WORK') return canRequestJobWorkChange()
  return canRequestHoldChange()
}
function display(value: unknown): string {
  if (value == null) return '—'
  if (typeof value !== 'object') return String(value)
  return Object.entries(value as Record<string, unknown>).map(([key, entry]) => `${key.replace(/([A-Z])/g, ' $1')}: ${Array.isArray(entry) ? entry.length : display(entry)}`).join(' · ')
}

/** Preview-first runtime change request flow for API work orders. */
export function RuntimeChangeDrawer({ open, onClose, workOrder, onChanged }: Props) {
  const [step, setStep] = useState(1)
  const [changeType, setChangeType] = useState<RuntimeChangeType>('QUANTITY_CHANGE')
  const [stageId, setStageId] = useState('')
  const [operationId, setOperationId] = useState('')
  const [reason, setReason] = useState('')
  const [values, setValues] = useState<Record<string, string>>({})
  const [preview, setPreview] = useState<RuntimeChangePreview | null>(null)
  const [busy, setBusy] = useState(false)
  const [users, setUsers] = useState<Option[]>([])
  const [machines, setMachines] = useState<Option[]>([])
  const [workCentres, setWorkCentres] = useState<Option[]>([])
  const { options: items } = useSetupLookup('items')
  const { options: vendors } = useSetupLookup('vendors')
  const { options: warehouses } = useSetupLookup('warehouses')
  const types = useMemo(() => terminal.has(workOrder.status) ? [] : RUNTIME_CHANGE_TYPES.filter(permitted).filter((type) => type !== 'WORK_ORDER_RESUME' || workOrder.status === 'ON_HOLD').filter((type) => type !== 'WORK_ORDER_HOLD' || workOrder.status !== 'ON_HOLD'), [workOrder.status])

  useEffect(() => {
    if (!open) return
    setStep(1); setReason(''); setValues({}); setPreview(null); setChangeType(types[0] ?? 'QUANTITY_CHANGE')
    setStageId(workOrder.stages[0]?.id ?? ''); setOperationId(workOrder.operations[0]?.id ?? '')
    void Promise.all([
      fetchAdminUsersApi().then((rows) => setUsers(rows.map((u) => ({ id: u.id, label: `${u.firstName} ${u.lastName}`.trim() || u.email })))),
      listMachines({ limit: 100 }).then((r) => setMachines(r.data.map((x) => ({ id: x.id, label: `${x.code} — ${x.name}` })))),
      listWorkCentres({ limit: 100 }).then((r) => setWorkCentres(r.data.map((x) => ({ id: x.id, label: `${x.code} — ${x.name}` })))),
    ]).catch(() => notify.warning('Some change form lookups could not be loaded'))
  }, [open, types, workOrder.operations, workOrder.stages])

  const set = (key: string, value: string) => setValues((old) => ({ ...old, [key]: value }))
  const proposed = (): Record<string, unknown> => {
    const text = (key: string) => values[key]?.trim()
    if (changeType === 'QUANTITY_CHANGE') return { plannedQuantity: Number(values.plannedQuantity) }
    if (changeType === 'DUE_DATE_CHANGE') return { requiredCompletionDate: values.requiredCompletionDate }
    if (changeType === 'PRIORITY_CHANGE') return { priority: values.priority || 'MEDIUM' }
    if (changeType === 'SUPERVISOR_CHANGE') return { supervisorId: values.supervisorId || null }
    if (changeType === 'OPERATOR_CHANGE') return { userId: values.userId || null }
    if (changeType === 'MACHINE_CHANGE') return { machineId: values.machineId || null }
    if (changeType === 'WORK_CENTRE_CHANGE') return { workCentreId: values.workCentreId || null }
    if (changeType === 'ADD_OPERATION') return { name: text('name'), code: text('code') || undefined, workCentreId: values.workCentreId || undefined, machineId: values.machineId || undefined, plannedQuantity: values.plannedQuantity ? Number(values.plannedQuantity) : undefined }
    if (changeType === 'REPEAT_OPERATION') return { sourceOperationId: operationId, plannedQuantity: values.plannedQuantity ? Number(values.plannedQuantity) : undefined }
    if (changeType === 'SKIP_OPERATION') return { notes: text('remarks') || undefined }
    if (changeType === 'CONVERT_TO_JOB_WORK') return { vendorId: values.vendorId, processName: text('processName'), itemId: values.itemId, orderedQty: Number(values.orderedQty), rate: Number(values.rate || 0), rateBasis: 'PER_PIECE', materialWarehouseId: values.materialWarehouseId, receiptWarehouseId: values.receiptWarehouseId, materialLines: [{ itemId: values.materialItemId, requiredQty: Number(values.materialQty || values.orderedQty) }] }
    if (changeType === 'WORK_ORDER_HOLD') return { reasonCategory: values.reasonCategory || 'OTHER', remarks: text('remarks') || undefined, expectedResumeAt: values.expectedResumeAt || undefined }
    return changeType === 'WORK_ORDER_RESUME' ? { remarks: text('remarks') || undefined } : { reasonCategory: values.reasonCategory || undefined, remarks: text('remarks') || undefined }
  }
  const base = () => ({ changeType, ...(stageTypes.has(changeType) ? { stageId } : {}), ...(operationTypes.has(changeType) ? { operationId } : {}), proposedValue: proposed() })
  const textInput = (label: string, key: string, type = 'text') => <FormField label={label}><Input type={type} value={values[key] ?? ''} onChange={(e) => set(key, e.target.value)} /></FormField>
  const selectInput = (label: string, key: string, options: Option[]) => <FormField label={label}><Select value={values[key] ?? ''} onChange={(e) => set(key, e.target.value)}><option value="">Select…</option>{options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</Select></FormField>
  const fields = <div className="grid gap-3 sm:grid-cols-2">
    {stageTypes.has(changeType) ? <FormField label="Stage" required><Select value={stageId} onChange={(e) => setStageId(e.target.value)}>{workOrder.stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}</Select></FormField> : null}
    {operationTypes.has(changeType) ? <FormField label="Operation" required><Select value={operationId} onChange={(e) => setOperationId(e.target.value)}>{workOrder.operations.map((operation) => <option key={operation.id} value={operation.id}>{operation.name}</option>)}</Select></FormField> : null}
    {changeType === 'QUANTITY_CHANGE' ? textInput('Planned quantity', 'plannedQuantity', 'number') : null}
    {changeType === 'DUE_DATE_CHANGE' ? textInput('Required completion date', 'requiredCompletionDate', 'date') : null}
    {changeType === 'PRIORITY_CHANGE' ? <FormField label="Priority"><Select value={values.priority ?? 'MEDIUM'} onChange={(e) => set('priority', e.target.value)}>{PRODUCTION_PRIORITY_VALUES.map((priority) => <option key={priority} value={priority}>{PRODUCTION_PRIORITY_LABELS[priority]}</option>)}</Select></FormField> : null}
    {changeType === 'SUPERVISOR_CHANGE' ? selectInput('Supervisor', 'supervisorId', users) : null}
    {changeType === 'OPERATOR_CHANGE' ? selectInput('Operator', 'userId', users) : null}
    {['MACHINE_CHANGE', 'ADD_OPERATION'].includes(changeType) ? selectInput('Machine', 'machineId', machines) : null}
    {['WORK_CENTRE_CHANGE', 'ADD_OPERATION'].includes(changeType) ? selectInput('Work centre', 'workCentreId', workCentres) : null}
    {changeType === 'ADD_OPERATION' ? <>{textInput('Operation name', 'name')}{textInput('Operation code', 'code')}{textInput('Planned quantity', 'plannedQuantity', 'number')}</> : null}
    {changeType === 'REPEAT_OPERATION' ? textInput('Planned quantity (optional)', 'plannedQuantity', 'number') : null}
    {changeType === 'CONVERT_TO_JOB_WORK' ? <>{selectInput('Vendor', 'vendorId', vendors)}{textInput('Process name', 'processName')}{selectInput('Output item', 'itemId', items)}{textInput('Ordered quantity', 'orderedQty', 'number')}{textInput('Rate', 'rate', 'number')}{selectInput('Material warehouse', 'materialWarehouseId', warehouses)}{selectInput('Receipt warehouse', 'receiptWarehouseId', warehouses)}{selectInput('Material item', 'materialItemId', items)}{textInput('Material quantity', 'materialQty', 'number')}</> : null}
    {['WORK_ORDER_HOLD', 'STAGE_HOLD'].includes(changeType) ? <FormField label="Reason category"><Select value={values.reasonCategory ?? 'OTHER'} onChange={(e) => set('reasonCategory', e.target.value)}>{HOLD_REASON_CATEGORY_VALUES.map((category) => <option key={category} value={category}>{HOLD_REASON_CATEGORY_LABELS[category]}</option>)}</Select></FormField> : null}
    {changeType === 'WORK_ORDER_HOLD' ? textInput('Expected resume date', 'expectedResumeAt', 'date') : null}
    {['WORK_ORDER_HOLD', 'WORK_ORDER_RESUME', 'STAGE_HOLD', 'STAGE_RESUME', 'SKIP_OPERATION'].includes(changeType) ? <div className="sm:col-span-2"><FormField label="Remarks"><Textarea value={values.remarks ?? ''} onChange={(e) => set('remarks', e.target.value)} rows={2} /></FormField></div> : null}
  </div>
  const previewChange = async () => { setBusy(true); try { const result = await previewRuntimeChange(workOrder.id, base()); setPreview(result.data); setStep(3) } catch (error) { notify.error(error instanceof Error ? error.message : 'Unable to preview change') } finally { setBusy(false) } }
  const submit = async () => { if (!reason.trim()) return notify.error('A reason is required'); setBusy(true); try { const created = await createRuntimeChange(workOrder.id, { ...base(), reason: reason.trim(), idempotencyKey: `runtime-change:${crypto.randomUUID()}` } as RuntimeChangeInput); if (preview?.risk.approvalRequired) await submitRuntimeChange(workOrder.id, created.data.id); else await applyRuntimeChange(workOrder.id, created.data.id, { idempotencyKey: `runtime-apply:${crypto.randomUUID()}` }); notify.success(preview?.risk.approvalRequired ? 'Change sent for approval' : 'Change applied'); onChanged(); onClose() } catch (error) { notify.error(error instanceof Error ? error.message : 'Unable to save change') } finally { setBusy(false) } }
  return <Modal open={open} onClose={onClose} title="Change / Exception" closeDisabled={busy} footer={<div className="flex justify-between gap-2"><Button variant="secondary" disabled={busy} onClick={() => step === 1 ? onClose() : setStep(step - 1)}>Back</Button>{step === 1 ? <Button disabled={!changeType || busy} onClick={() => setStep(2)}>Continue</Button> : step === 2 ? <Button disabled={busy} onClick={() => void previewChange()}>Preview impact</Button> : step === 3 ? <Button disabled={busy} onClick={() => setStep(4)}>Continue</Button> : <Button disabled={busy || !reason.trim()} onClick={() => void submit()}>{preview?.risk.approvalRequired ? 'Send for approval' : 'Apply change'}</Button>}</div>}>
    {types.length === 0 ? <p className="text-sm text-erp-muted">No runtime changes can be requested for this work order.</p> : null}
    {step === 1 && types.length ? <FormField label="Change type" required><Select value={changeType} onChange={(e) => setChangeType(e.target.value as RuntimeChangeType)}>{types.map((type) => <option key={type} value={type}>{RUNTIME_CHANGE_TYPE_LABELS[type]}</option>)}</Select></FormField> : null}
    {step === 2 ? fields : null}
    {step === 3 && preview ? <div className="space-y-3 text-sm"><p className="rounded-md border border-slate-200 bg-slate-50 p-3">{preview.impact.summary || 'Review the impact below before continuing.'}</p><dl className="space-y-2"><div><dt className="text-erp-muted">Current</dt><dd>{display(preview.original)}</dd></div><div><dt className="text-erp-muted">Proposed</dt><dd>{display(preview.proposed)}</dd></div></dl>{preview.impact.warnings?.map((warning) => <p key={warning} className="rounded-md border border-amber-200 bg-amber-50 p-2 text-amber-900">{warning}</p>)}<p className="text-erp-muted">Risk: <strong>{preview.risk.riskLevel.toLowerCase()}</strong> · {preview.risk.approvalRequired ? 'Approval required' : 'Can be applied directly'}</p></div> : null}
    {step === 4 ? <FormField label="Reason" required><Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Why is this change needed?" /></FormField> : null}
  </Modal>
}
