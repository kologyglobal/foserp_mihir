import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Save, Truck } from 'lucide-react'
import { ErpStatusChip } from '@/components/erp/ErpStatusChip'
import { FormField } from '@/components/forms/FormField'
import { Input, Select, Textarea } from '@/components/forms/Inputs'
import { SELECT_PLACEHOLDER } from '@/components/forms/selectStandards'
import { LoadingState } from '@/design-system/components/LoadingState'
import { isApiMode } from '@/config/apiConfig'
import { ProductionPageHeader } from '../ui'
import {
  createJobWorkOrder,
  getJobWorkOrderById,
  getWorkOrders,
  updateJobWorkOrder,
} from '@/services/manufacturing'
import { listWorkOrders } from '@/services/api/manufacturingApi'
import { fetchVendors, fetchItems } from '@/services/api/masterBatchApi'
import { fetchMasterWarehouses, mapWarehouseDto } from '@/services/api/masterApi'
import type { WorkOrder } from '@/types/manufacturingWorkOrder'
import type { ProductionOrder } from '@/types/manufacturingProduction'
import { notify } from '@/store/toastStore'
import { useManufacturingPermissions } from '@/utils/permissions/manufacturing'

const PROCESSES = [
  'Welding',
  'Machining',
  'Painting',
  'Galvanizing',
  'Cutting',
  'Fabrication',
  'Heat Treatment',
  'Other',
] as const

const VENDORS = [
  'ABC Welding Works',
  'SS Fab Solutions',
  'Pune Coatings Pvt Ltd',
  'Metro Machine Shop',
]

type ApiOption = { id: string; label: string; code?: string; name?: string }

function formatMoney(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '—'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value)
}

export function JobWorkFormPage() {
  const { jobWorkId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const perms = useManufacturingPermissions()
  const isEdit = Boolean(jobWorkId)
  const apiMode = isApiMode()

  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [apiWorkOrders, setApiWorkOrders] = useState<ProductionOrder[]>([])
  const [vendors, setVendors] = useState<ApiOption[]>([])
  const [items, setItems] = useState<ApiOption[]>([])
  const [warehouses, setWarehouses] = useState<ApiOption[]>([])

  const [workOrderId, setWorkOrderId] = useState(searchParams.get('workOrderId') ?? '')
  const [vendorId, setVendorId] = useState('')
  const [vendorName, setVendorName] = useState('')
  const [process, setProcess] = useState('')
  const [materialToSend, setMaterialToSend] = useState('')
  const [materialItemId, setMaterialItemId] = useState('')
  const [outputItemId, setOutputItemId] = useState('')
  const [materialWarehouseId, setMaterialWarehouseId] = useState('')
  const [receiptWarehouseId, setReceiptWarehouseId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [expectedReturnDate, setExpectedReturnDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [rate, setRate] = useState(0)
  const [remarks, setRemarks] = useState('')
  const [qualityRequired, setQualityRequired] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        if (apiMode) {
          const [woRes, vendorRows, itemRows, whRows] = await Promise.all([
            listWorkOrders({ limit: 100 }),
            fetchVendors(),
            fetchItems(),
            fetchMasterWarehouses(),
          ])
          if (cancelled) return
          setApiWorkOrders((woRes.data ?? []).filter((w) => !['CLOSED', 'CANCELLED'].includes(w.status)))
          setVendors(vendorRows.map((v) => ({ id: v.id, label: `${v.code} — ${v.name}`, code: v.code, name: v.name })))
          setItems(itemRows.map((i) => ({ id: i.id, label: `${i.code} — ${i.name}`, code: i.code, name: i.name })))
          setWarehouses(
            whRows.map((row) => {
              const wh = mapWarehouseDto(row)
              return { id: wh.id, label: `${wh.warehouseCode} — ${wh.warehouseName}` }
            }),
          )
          if (whRows[0]) {
            const first = mapWarehouseDto(whRows[0]).id
            setMaterialWarehouseId((prev) => prev || first)
            setReceiptWarehouseId((prev) => prev || first)
          }
        } else {
          const list = await getWorkOrders()
          if (!cancelled) setWorkOrders(list.filter((w) => !['closed', 'cancelled'].includes(w.status)))
        }
      } catch (e) {
        notify.error(e instanceof Error ? e.message : 'Failed to load form masters')
      } finally {
        if (!cancelled && !isEdit) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [apiMode, isEdit])

  useEffect(() => {
    if (!jobWorkId) return
    void getJobWorkOrderById(jobWorkId).then((item) => {
      if (!item) {
        notify.error('Job work not found')
        navigate('/manufacturing/job-work')
        return
      }
      if (item.status !== 'draft') {
        notify.error('Only draft job work can be edited')
        navigate(`/manufacturing/job-work/${jobWorkId}`)
        return
      }
      setWorkOrderId(item.workOrderId)
      setVendorId(item.vendorId)
      setVendorName(item.vendorName)
      setProcess(item.process)
      setMaterialToSend(item.materialToSend ?? item.itemName)
      setOutputItemId(item.itemId)
      setMaterialWarehouseId(item.materialWarehouseId)
      setReceiptWarehouseId(item.receiptWarehouseId)
      setQuantity(item.orderedQty)
      setExpectedReturnDate(item.expectedReturnDate)
      setRate(item.rate)
      setRemarks(item.remarks ?? '')
      setQualityRequired(item.qualityRequired)
      setLoading(false)
    })
  }, [jobWorkId, navigate])

  const selectedWo = useMemo(
    () => workOrders.find((w) => w.id === workOrderId) ?? null,
    [workOrderId, workOrders],
  )
  const selectedApiWo = useMemo(
    () => apiWorkOrders.find((w) => w.id === workOrderId) ?? null,
    [workOrderId, apiWorkOrders],
  )

  useEffect(() => {
    if (isEdit || apiMode || !selectedWo) return
    setMaterialToSend((prev) => prev || `${selectedWo.finishedItemCode} — process material`)
    setQuantity((prev) => (prev > 1 ? prev : Math.max(1, selectedWo.remainingQty || selectedWo.plannedQty || 1)))
  }, [isEdit, apiMode, selectedWo])

  useEffect(() => {
    if (isEdit || !apiMode || !selectedApiWo) return
    setOutputItemId(selectedApiWo.productItemId)
    setQuantity((prev) => (prev > 1 ? prev : Math.max(1, Number(selectedApiWo.plannedQuantity) || 1)))
  }, [isEdit, apiMode, selectedApiWo])

  const expectedCost = useMemo(() => (Number(rate) || 0) * (Number(quantity) || 0), [rate, quantity])

  const save = async () => {
    if (!perms.canCreateJobWork && !isEdit) {
      notify.error('No permission to create job work')
      return
    }
    if (!process.trim() || quantity <= 0) {
      notify.error('Process and quantity are required')
      return
    }
    if (!expectedReturnDate) {
      notify.error('Expected return date is required')
      return
    }

    setSaving(true)
    try {
      if (apiMode) {
        if (!vendorId || !outputItemId || !materialItemId || !materialWarehouseId || !receiptWarehouseId) {
          notify.error('Vendor, output item, material item and warehouses are required')
          return
        }
        const vendor = vendors.find((v) => v.id === vendorId)
        const output = items.find((i) => i.id === outputItemId)
        const r = isEdit && jobWorkId
          ? await updateJobWorkOrder(jobWorkId, {
              process,
              orderedQty: quantity,
              rate: rate || 0,
              expectedReturnDate,
              materialToSend: materialToSend.trim() || undefined,
              remarks: remarks.trim() || undefined,
              qualityRequired,
            })
          : await createJobWorkOrder({
              workOrderId: workOrderId || '',
              workOrderNo: selectedApiWo?.orderNumber ?? '',
              vendorId,
              vendorName: vendor?.name ?? vendor?.label ?? '',
              process: process.trim(),
              quantity,
              rate: rate || 0,
              rateBasis: 'per_piece',
              expectedReturnDate,
              itemId: outputItemId,
              itemCode: output?.code ?? '',
              itemName: output?.name ?? '',
              materialToSend: materialToSend.trim() || undefined,
              remarks: remarks.trim() || undefined,
              materialItemId,
              materialWarehouseId,
              receiptWarehouseId,
              qualityRequired,
            })
        if (!r.ok || !r.jobWork) {
          notify.error(r.error ?? 'Save failed')
          return
        }
        notify.success(isEdit ? 'Job work updated' : 'Job work created')
        navigate(`/manufacturing/job-work/${r.jobWork.id}`)
        return
      }

      if (!selectedWo || !vendorName.trim()) {
        notify.error('Work order and vendor are required')
        return
      }
      if (!materialToSend.trim()) {
        notify.error('Material to send is required')
        return
      }

      const input = {
        workOrderId: selectedWo.id,
        workOrderNo: selectedWo.woNumber,
        vendorId: `vendor-${vendorName.replace(/\W/g, '').toLowerCase()}`,
        vendorName: vendorName.trim(),
        process: process.trim(),
        quantity,
        rate: rate || 0,
        rateBasis: 'per_piece' as const,
        expectedReturnDate,
        itemId: selectedWo.finishedItemId,
        itemCode: selectedWo.finishedItemCode,
        itemName: selectedWo.finishedItemName,
        uom: selectedWo.uom,
        materialToSend: materialToSend.trim(),
        remarks: remarks.trim() || undefined,
      }

      const r = isEdit && jobWorkId
        ? await updateJobWorkOrder(jobWorkId, {
            ...input,
            orderedQty: quantity,
            pendingQty: quantity,
            expectedCost: (rate || 0) * quantity,
            materialToSend: input.materialToSend,
            remarks: input.remarks,
          })
        : await createJobWorkOrder(input)

      if (!r.ok || !r.jobWork) {
        notify.error(r.error ?? 'Save failed')
        return
      }
      notify.success(isEdit ? 'Job work updated' : 'Job work created')
      navigate(`/manufacturing/job-work/${r.jobWork.id}`)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <ProductionPageHeader
        title={isEdit ? 'Edit Job Work' : 'Create Job Work'}
        backLink={{ to: '/manufacturing/job-work', label: 'Job Work' }}
      >
        <LoadingState variant="card" />
      </ProductionPageHeader>
    )
  }

  const linkedWoLabel = apiMode
    ? selectedApiWo
      ? `${selectedApiWo.orderNumber} · ${selectedApiWo.status}`
      : null
    : selectedWo
      ? `${selectedWo.woNumber} — ${selectedWo.finishedItemCode}`
      : null

  return (
    <ProductionPageHeader
      title={isEdit ? 'Edit Job Work' : 'Create Job Work'}
      description="Create a subcontract job work order for vendor processing."
      breadcrumbs={[
        { label: 'Manufacturing & Production', to: '/manufacturing' },
        { label: 'Job Work', to: '/manufacturing/job-work' },
        { label: isEdit ? 'Edit' : 'New' },
      ]}
      favoritePath="/manufacturing/job-work/new"
      backLink={{ to: '/manufacturing/job-work', label: 'Job Work' }}
      primaryAction={{
        id: 'save',
        label: saving ? 'Saving…' : 'Save Draft',
        icon: Save,
        disabled: saving,
        onClick: () => void save(),
      }}
      secondaryActions={[{ id: 'cancel', label: 'Cancel', onClick: () => navigate('/manufacturing/job-work') }]}
    >
      <div className="overflow-hidden rounded-xl border border-erp-border bg-erp-surface shadow-sm">
        {/* Form chrome */}
        <div className="flex flex-wrap items-center gap-3 border-b border-erp-border px-5 py-3.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-erp-primary-soft text-erp-primary ring-1 ring-erp-primary/10">
            <Truck className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[15px] font-semibold tracking-tight text-erp-text">Job Work Order</h2>
              <ErpStatusChip label="DRAFT" tone="pending" />
            </div>
            <p className="mt-0.5 truncate text-[12px] text-erp-muted">
              {linkedWoLabel ? `Linked to ${linkedWoLabel}` : 'Standalone subcontract — link a work order if needed'}
            </p>
          </div>
          <div className="rounded-lg border border-erp-border bg-erp-surface-alt/60 px-3.5 py-2 text-right">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-erp-muted">Expected cost</p>
            <p className="text-[15px] font-bold tabular-nums text-erp-text">{formatMoney(expectedCost)}</p>
          </div>
        </div>

        <form
          className="grid grid-cols-1 gap-x-5 gap-y-4 p-5 md:grid-cols-2 xl:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
        >
          <FormField label="Work Order" required={!apiMode} hint={apiMode ? 'Optional link to production order' : undefined}>
            <Select value={workOrderId} onChange={(e) => setWorkOrderId(e.target.value)} disabled={isEdit}>
              <option value="">{apiMode ? `${SELECT_PLACEHOLDER} (optional)` : SELECT_PLACEHOLDER}</option>
              {apiMode
                ? apiWorkOrders.map((wo) => (
                    <option key={wo.id} value={wo.id}>
                      {wo.orderNumber} · {wo.status}
                    </option>
                  ))
                : workOrders.map((wo) => (
                    <option key={wo.id} value={wo.id}>
                      {wo.woNumber} — {wo.finishedItemCode} ({wo.status})
                    </option>
                  ))}
            </Select>
          </FormField>

          {apiMode ? (
            <FormField label="Vendor" required>
              <Select value={vendorId} onChange={(e) => setVendorId(e.target.value)} disabled={isEdit}>
                <option value="">{SELECT_PLACEHOLDER}</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </Select>
            </FormField>
          ) : (
            <FormField label="Vendor" required>
              <Input
                list="jw-vendor-list"
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
                placeholder="Type or pick a vendor"
              />
              <datalist id="jw-vendor-list">
                {VENDORS.map((v) => (
                  <option key={v} value={v} />
                ))}
              </datalist>
            </FormField>
          )}

          <FormField label="Process / Operation" required>
            <Select value={process} onChange={(e) => setProcess(e.target.value)}>
              <option value="">{SELECT_PLACEHOLDER}</option>
              {PROCESSES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </FormField>

          {apiMode ? (
            <>
              <FormField label="Output item" required>
                <Select value={outputItemId} onChange={(e) => setOutputItemId(e.target.value)} disabled={isEdit}>
                  <option value="">{SELECT_PLACEHOLDER}</option>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.label}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Material item" required>
                <Select value={materialItemId} onChange={(e) => setMaterialItemId(e.target.value)} disabled={isEdit}>
                  <option value="">{SELECT_PLACEHOLDER}</option>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.label}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Material note" hint="Optional for stores / gate">
                <Input
                  value={materialToSend}
                  onChange={(e) => setMaterialToSend(e.target.value)}
                  placeholder="e.g. Cut pieces with drawing Rev B"
                />
              </FormField>

              <FormField label="Material warehouse" required>
                <Select
                  value={materialWarehouseId}
                  onChange={(e) => setMaterialWarehouseId(e.target.value)}
                  disabled={isEdit}
                >
                  <option value="">{SELECT_PLACEHOLDER}</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.label}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Receipt warehouse" required>
                <Select
                  value={receiptWarehouseId}
                  onChange={(e) => setReceiptWarehouseId(e.target.value)}
                  disabled={isEdit}
                >
                  <option value="">{SELECT_PLACEHOLDER}</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.label}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Quality on receive">
                <label className="flex h-9 cursor-pointer items-center gap-2.5 rounded-md border border-erp-border bg-erp-surface-alt/40 px-3 text-[13px] text-erp-text transition-colors hover:border-erp-primary/40 hover:bg-erp-primary-soft/20">
                  <input
                    type="checkbox"
                    className="size-3.5 accent-[var(--erp-primary)]"
                    checked={qualityRequired}
                    onChange={(e) => setQualityRequired(e.target.checked)}
                  />
                  <span className="leading-tight">QC inspection on receive</span>
                </label>
              </FormField>
            </>
          ) : (
            <FormField label="Material to Send" required className="md:col-span-2 xl:col-span-2">
              <Input
                value={materialToSend}
                onChange={(e) => setMaterialToSend(e.target.value)}
                placeholder="e.g. MS Plate / Chassis sub-assembly"
              />
            </FormField>
          )}

          <FormField label="Quantity" required>
            <Input
              type="number"
              min={0.001}
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
          </FormField>

          <FormField label="Expected Return Date" required>
            <Input
              type="date"
              value={expectedReturnDate}
              onChange={(e) => setExpectedReturnDate(e.target.value)}
            />
          </FormField>

          <FormField label="Rate (per piece)" hint="Planning estimate — not posted to accounts">
            <Input
              type="number"
              min={0}
              step="any"
              value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
              placeholder="0"
            />
          </FormField>

          <FormField label="Remarks" className="md:col-span-2 xl:col-span-3">
            <Textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={3}
              placeholder="Instructions for vendor, stores, or quality…"
            />
          </FormField>

          {!apiMode && selectedWo ? (
            <div className="md:col-span-2 xl:col-span-3 flex items-center gap-2 rounded-lg border border-erp-border bg-erp-surface-alt/50 px-3.5 py-2.5 text-[12.5px] text-erp-muted">
              <span className="font-medium text-erp-text">Finished item</span>
              <span className="text-erp-border">·</span>
              <span>
                <strong className="text-erp-text">
                  {selectedWo.finishedItemCode} — {selectedWo.finishedItemName}
                </strong>
                {' · '}Planned {selectedWo.plannedQty} {selectedWo.uom}
              </span>
            </div>
          ) : null}
        </form>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-erp-border bg-erp-surface-alt/30 px-5 py-2.5 text-[11.5px] text-erp-muted">
          <span>Qty × rate = {formatMoney(expectedCost)} (planning only)</span>
          <span>Press Save Draft in the header to create the order</span>
        </div>
      </div>
    </ProductionPageHeader>
  )
}
