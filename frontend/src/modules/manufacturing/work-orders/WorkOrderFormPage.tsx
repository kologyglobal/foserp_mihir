import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { ErpCardSection } from '@/components/erp/card-form'
import { FormField } from '@/components/forms/FormField'
import { Input, Select } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  createWorkOrder,
  getBoms,
  getFinishedItemDefaults,
  getWorkOrderById,
  getWorkOrderSourceDetails,
  getWorkOrderSourceDocuments,
  updateWorkOrder,
} from '@/services/manufacturing'
import type { CreateWorkOrderInput, WorkOrderPriority, WorkOrderSource, WorkOrderSourceDocument } from '@/types/manufacturingWorkOrder'
import { WO_PRIORITY_LABELS, WO_SOURCE_LABELS } from '@/types/manufacturingWorkOrder'
import { PRODUCTION_METHOD_LABELS, type ProductionMethod } from '@/types/manufacturing'
import { notify } from '@/store/toastStore'
import { useManufacturingPermissions } from '@/utils/permissions/manufacturing'

const today = () => new Date().toISOString().slice(0, 10)

export function WorkOrderFormPage() {
  const { workOrderId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const perms = useManufacturingPermissions()
  const isEdit = Boolean(workOrderId)

  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [sourceDocs, setSourceDocs] = useState<WorkOrderSourceDocument[]>([])
  const [finishedItems, setFinishedItems] = useState<Array<{ id: string; code: string; name: string }>>([])

  const [source, setSource] = useState<WorkOrderSource>('sales_order')
  const [sourceDocumentId, setSourceDocumentId] = useState('')
  const [finishedItemId, setFinishedItemId] = useState('')
  const [finishedItemCode, setFinishedItemCode] = useState('')
  const [finishedItemName, setFinishedItemName] = useState('')
  const [plannedQty, setPlannedQty] = useState(1)
  const [startDate, setStartDate] = useState(today())
  const [dueDate, setDueDate] = useState(today())
  const [plantName, setPlantName] = useState('Vasant Plant')
  const [productionMethod, setProductionMethod] = useState<ProductionMethod>('in_house')
  const [priority, setPriority] = useState<WorkOrderPriority>('normal')
  const [customerName, setCustomerName] = useState('')
  const [salesOrderNo, setSalesOrderNo] = useState('')
  const [project, setProject] = useState('')
  const [deliveryLocation, setDeliveryLocation] = useState('')
  const [bomId, setBomId] = useState<string | null>(null)
  const [bomNumber, setBomNumber] = useState('')
  const [bomVersion, setBomVersion] = useState('')
  const [uom, setUom] = useState('NOS')
  const [materialWarehouseName, setMaterialWarehouseName] = useState('RM Stores')
  const [fgWarehouseName, setFgWarehouseName] = useState('FG Stores')
  const [costCentre, setCostCentre] = useState('CC-PROD')
  const [qualityRequired, setQualityRequired] = useState(false)
  const [batchRequired, setBatchRequired] = useState(false)
  const [serialRequired, setSerialRequired] = useState(false)

  const applyDetails = useCallback(async (src: WorkOrderSource, docId: string | null) => {
    const details = await getWorkOrderSourceDetails(src, docId)
    if (!details) return
    setFinishedItemId(details.finishedItemId)
    setFinishedItemCode(details.finishedItemCode)
    setFinishedItemName(details.finishedItemName)
    setPlannedQty(details.requiredQty)
    setDueDate(details.requiredDate)
    setCustomerName(details.customerName ?? '')
    setProject(details.project ?? '')
    setDeliveryLocation(details.deliveryLocation ?? '')
    setPriority(details.priority)
    setBomId(details.bomId ?? null)
    setBomNumber(details.bomNumber ?? '')
    setBomVersion(details.bomVersion ?? '')
    setUom(details.uom)
    setProductionMethod(details.productionMethod)
    setMaterialWarehouseName(details.materialWarehouseName)
    setFgWarehouseName(details.fgWarehouseName)
    setPlantName(details.plantName)
    setCostCentre(details.costCentre ?? 'CC-PROD')
    setQualityRequired(details.qualityRequired)
    setBatchRequired(details.batchRequired)
    setSerialRequired(details.serialRequired)
    if (src === 'sales_order' && docId) {
      const docs = await getWorkOrderSourceDocuments('sales_order')
      const doc = docs.find((d) => d.id === docId)
      if (doc) setSalesOrderNo(doc.documentNo)
    }
  }, [])

  useEffect(() => {
    void getWorkOrderSourceDocuments(source).then(setSourceDocs)
  }, [source])

  useEffect(() => {
    void getBoms({ status: 'active' }).then((boms) => setFinishedItems(boms.map((bom) => ({
      id: bom.finishedItemId, code: bom.finishedItemCode, name: bom.finishedItemName,
    }))))
  }, [])

  useEffect(() => {
    if (!isEdit) {
      const bomFromQuery = searchParams.get('bomId')
      if (bomFromQuery) void applyDetails('manual', null)
      return
    }
    if (!workOrderId || !perms.canEditWo) return
    setLoading(true)
    void getWorkOrderById(workOrderId)
      .then((wo) => {
        if (!wo) {
          notify.error('Work order not found')
          navigate('/manufacturing/work-orders')
          return
        }
        if (wo.status !== 'draft') {
          notify.error('Only draft work orders can be edited')
          navigate(`/manufacturing/work-orders/${wo.id}`)
          return
        }
        setSource(wo.source)
        setSourceDocumentId(wo.sourceDocumentId ?? '')
        setFinishedItemId(wo.finishedItemId)
        setFinishedItemCode(wo.finishedItemCode)
        setFinishedItemName(wo.finishedItemName)
        setPlannedQty(wo.plannedQty)
        setStartDate(wo.startDate)
        setDueDate(wo.dueDate)
        setPlantName(wo.plantName)
        setProductionMethod(wo.productionMethod)
        setPriority(wo.priority)
        setCustomerName(wo.customerName)
        setSalesOrderNo(wo.salesOrderNo)
        setProject(wo.project ?? '')
        setDeliveryLocation(wo.deliveryLocation ?? '')
        setBomId(wo.bomId)
    setBomNumber(wo.bomNumber ?? '')
    setBomVersion(wo.bomVersion ?? '')
        setUom(wo.uom)
        setMaterialWarehouseName(wo.materialWarehouseName)
        setFgWarehouseName(wo.fgWarehouseName)
        setCostCentre(wo.costCentre ?? '')
        setQualityRequired(wo.qualityRequired)
        setBatchRequired(wo.batchRequired)
        setSerialRequired(wo.serialRequired)
      })
      .finally(() => setLoading(false))
  }, [applyDetails, isEdit, navigate, perms.canEditWo, searchParams, workOrderId])

  const onSourceDocChange = async (docId: string) => {
    setSourceDocumentId(docId)
    if (docId) await applyDetails(source, docId)
  }

  const onFinishedItemChange = async (itemId: string) => {
    setFinishedItemId(itemId)
    const details = await getFinishedItemDefaults(itemId)
    if (!details) return
    setFinishedItemCode(details.finishedItemCode)
    setFinishedItemName(details.finishedItemName)
    setBomId(details.bomId ?? null)
    setBomNumber(details.bomNumber ?? '')
    setBomVersion(details.bomVersion ?? '')
    setUom(details.uom)
    setProductionMethod(details.productionMethod)
    setMaterialWarehouseName(details.materialWarehouseName)
    setFgWarehouseName(details.fgWarehouseName)
    setPlantName(details.plantName)
    setQualityRequired(details.qualityRequired)
    setBatchRequired(details.batchRequired)
    setSerialRequired(details.serialRequired)
  }

  const save = async () => {
    if (!finishedItemId || plannedQty <= 0) {
      notify.error('Finished item and quantity are required')
      return
    }
    setSaving(true)
    const input: CreateWorkOrderInput = {
      source,
      sourceDocumentId: sourceDocumentId || null,
      sourceDocumentNo: salesOrderNo || sourceDocs.find((d) => d.id === sourceDocumentId)?.documentNo || '',
      finishedItemId,
      finishedItemCode,
      finishedItemName,
      plannedQty,
      startDate,
      dueDate,
      plantName,
      productionMethod,
      priority,
      customerName,
      salesOrderNo,
      salesOrderId: source === 'sales_order' ? sourceDocumentId || undefined : undefined,
      project,
      deliveryLocation,
      bomId,
      bomNumber,
      bomVersion,
      uom,
      materialWarehouseName,
      fgWarehouseName,
      costCentre,
      qualityRequired,
      batchRequired,
      serialRequired,
    }
    try {
      const result = isEdit && workOrderId
        ? await updateWorkOrder(workOrderId, input)
        : await createWorkOrder(input)
      if (!result.ok || !result.workOrder) {
        notify.error(result.error ?? 'Save failed')
        return
      }
      notify.success(isEdit ? 'Work order updated' : 'Work order created')
      navigate(`/manufacturing/work-orders/${result.workOrder.id}`)
    } finally {
      setSaving(false)
    }
  }

  if (!perms.canCreateWo && !isEdit) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" title="New Work Order" badge="Manufacturing">
        <p className="text-[13px] text-erp-muted">You do not have permission to create work orders.</p>
      </OperationalPageShell>
    )
  }

  if (loading) return <LoadingState />

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Manufacturing"
      title={isEdit ? 'Edit Work Order' : 'New Work Order'}
      description="Quick Mode — enter finished item, quantity, and dates. The system fills the rest."
      breadcrumbs={[
        { label: 'Manufacturing & Production', to: '/manufacturing' },
        { label: 'Work Orders', to: '/manufacturing/work-orders' },
        { label: isEdit ? 'Edit' : 'New' },
      ]}
      autoBreadcrumbs={false}
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={{ id: 'save', label: saving ? 'Saving…' : 'Save', onClick: () => void save(), disabled: saving }}
          secondaryActions={[{ id: 'cancel', label: 'Cancel', onClick: () => navigate('/manufacturing/work-orders') }]}
        />
      )}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <ErpCardSection title="Requirement">
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Requirement Source">
              <Select
                id="wo-source"
                value={source}
                onChange={(e) => {
                  const s = e.target.value as WorkOrderSource
                  setSource(s)
                  setSourceDocumentId('')
                }}
              >
                {(Object.keys(WO_SOURCE_LABELS) as WorkOrderSource[]).map((s) => (
                  <option key={s} value={s}>{WO_SOURCE_LABELS[s]}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Source Document">
              <Select
                id="wo-source-doc"
                value={sourceDocumentId}
                onChange={(e) => void onSourceDocChange(e.target.value)}
                disabled={source === 'manual'}
              >
                <option value="">{source === 'manual' ? 'Manual — no document' : 'Select document'}</option>
                {sourceDocs.map((d) => (
                  <option key={d.id} value={d.id}>{d.label}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Finished Item" required>
              <Select
                id="wo-item"
                value={finishedItemId}
                onChange={(e) => void onFinishedItemChange(e.target.value)}
                disabled={source !== 'manual'}
                aria-label="Finished item"
              >
                <option value="">{source === 'manual' ? 'Select finished item' : 'Auto-filled from source'}</option>
                {finishedItems.map((item) => <option key={item.id} value={item.id}>{item.code} — {item.name}</option>)}
              </Select>
            </FormField>
            <FormField label="Production Quantity" required>
              <Input
                id="wo-qty"
                type="number"
                min={0.001}
                step="any"
                value={plannedQty}
                onChange={(e) => setPlannedQty(Number(e.target.value))}
                className="text-lg"
              />
            </FormField>
            <FormField label="Start Date" required>
              <Input id="wo-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </FormField>
            <FormField label="Due Date" required>
              <Input id="wo-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </FormField>
          </div>
        </ErpCardSection>

        <ErpCardSection title="Optional overrides">
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Plant">
              <Input id="wo-plant" value={plantName} onChange={(e) => setPlantName(e.target.value)} />
            </FormField>
            <FormField label="Production Method">
              <Select id="wo-method" value={productionMethod} onChange={(e) => setProductionMethod(e.target.value as ProductionMethod)}>
                {(Object.keys(PRODUCTION_METHOD_LABELS) as ProductionMethod[]).map((m) => (
                  <option key={m} value={m}>{PRODUCTION_METHOD_LABELS[m]}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Priority">
              <Select id="wo-priority" value={priority} onChange={(e) => setPriority(e.target.value as WorkOrderPriority)}>
                {(Object.keys(WO_PRIORITY_LABELS) as WorkOrderPriority[]).map((p) => (
                  <option key={p} value={p}>{WO_PRIORITY_LABELS[p]}</option>
                ))}
              </Select>
            </FormField>
          </div>
        </ErpCardSection>

        <ErpCardSection title="System-filled (read-only)" className="lg:col-span-2">
          <dl className="grid gap-2 text-[13px] sm:grid-cols-2 lg:grid-cols-3">
            <div><dt className="text-erp-muted">Customer</dt><dd className="font-medium text-erp-text">{customerName || '—'}</dd></div>
            <div><dt className="text-erp-muted">Sales Order</dt><dd className="font-medium text-erp-text">{salesOrderNo || '—'}</dd></div>
            <div><dt className="text-erp-muted">Project</dt><dd className="font-medium text-erp-text">{project || '—'}</dd></div>
            <div><dt className="text-erp-muted">Delivery</dt><dd className="font-medium text-erp-text">{deliveryLocation || '—'}</dd></div>
            <div><dt className="text-erp-muted">Active BOM</dt><dd className="font-medium text-erp-text">{bomNumber || '—'} {bomVersion}</dd></div>
            <div><dt className="text-erp-muted">UOM</dt><dd className="font-medium text-erp-text">{uom}</dd></div>
            <div><dt className="text-erp-muted">Material Warehouse</dt><dd className="font-medium text-erp-text">{materialWarehouseName}</dd></div>
            <div><dt className="text-erp-muted">FG Warehouse</dt><dd className="font-medium text-erp-text">{fgWarehouseName}</dd></div>
            <div><dt className="text-erp-muted">Cost Centre</dt><dd className="font-medium text-erp-text">{costCentre}</dd></div>
            <div><dt className="text-erp-muted">Quality / Batch / Serial</dt><dd className="font-medium text-erp-text">{[qualityRequired ? 'QC' : '—']} / {batchRequired ? 'Batch' : '—'} / {serialRequired ? 'Serial' : '—'}</dd></div>
          </dl>
        </ErpCardSection>
      </div>
    </OperationalPageShell>
  )
}
