import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { CheckCircle2, ClipboardCheck, Paperclip, Save } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { StatusDot, statusToneFromLabel } from '@/components/design-system/StatusDot'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { ErpCardSection } from '@/components/erp/card-form'
import { FormField } from '@/components/forms/FormField'
import { Input, Select, Checkbox } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import { ManufacturingAiAssist, ManufacturingDemoBanner } from '@/components/manufacturing'
import {
  checkWorkOrderMaterialAvailability,
  createWorkOrder,
  createWorkOrderAndMarkReady,
  getActiveRouteForFinishedItem,
  getBoms,
  getFinishedItemDefaults,
  getManufacturingRoutes,
  getManufacturingSettings,
  getWorkOrderById,
  getWorkOrderMaterials,
  getWorkOrderSourceDetails,
  getWorkOrderSourceDocuments,
  previewWorkOrderMaterials,
  updateWorkOrder,
} from '@/services/manufacturing'
import type { ManufacturingRoute } from '@/types/manufacturingRoute'
import type {
  CreateWorkOrderInput,
  MaterialConsumptionMode,
  WorkOrderMaterial,
  WorkOrderSource,
  WorkOrderSourceDocument,
} from '@/types/manufacturingWorkOrder'
import { WO_SOURCE_LABELS } from '@/types/manufacturingWorkOrder'
import { PRODUCTION_METHOD_LABELS, type ProductionMethod } from '@/types/manufacturing'
import { formatCurrency } from '@/utils/formatters/currency'
import { notify } from '@/store/toastStore'
import { useManufacturingPermissions } from '@/utils/permissions/manufacturing'
import { cn } from '@/utils/cn'

const today = () => new Date().toISOString().slice(0, 10)

const LINES = [
  'WS-AXLE-01',
  'WS-AXLE-02',
  'LINE-CHS-01',
  'LINE-TANK-01',
  'FG Stores · Bay A',
]

function SuggestionRow({
  label,
  value,
  ok,
}: {
  label: string
  value: string
  ok?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-erp-border/70 py-2 last:border-0">
      <div>
        <p className="text-[12px] font-medium text-erp-muted">{label}</p>
        <p className="text-[13px] font-semibold text-erp-text">{value}</p>
      </div>
      {ok != null ? (
        <span
          className={cn(
            'mt-0.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1',
            ok ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : 'bg-amber-50 text-amber-900 ring-amber-200',
          )}
        >
          {ok ? 'OK' : 'Check'}
        </span>
      ) : null}
    </div>
  )
}

export function WorkOrderFormPage() {
  const { workOrderId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const perms = useManufacturingPermissions()
  const isEdit = Boolean(workOrderId)

  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [quickMode, setQuickMode] = useState(true)
  const [autoConsumption, setAutoConsumption] = useState(true)
  const [sourceDocs, setSourceDocs] = useState<WorkOrderSourceDocument[]>([])
  const [finishedItems, setFinishedItems] = useState<Array<{ id: string; code: string; name: string }>>([])
  const [previewMaterials, setPreviewMaterials] = useState<WorkOrderMaterial[]>([])
  const [estimatedCost, setEstimatedCost] = useState(0)
  const [materialReady, setMaterialReady] = useState(false)
  const [materialsChecked, setMaterialsChecked] = useState(false)

  const [source, setSource] = useState<WorkOrderSource>('sales_order')
  const [sourceDocumentId, setSourceDocumentId] = useState('')
  const [finishedItemId, setFinishedItemId] = useState('')
  const [finishedItemCode, setFinishedItemCode] = useState('')
  const [finishedItemName, setFinishedItemName] = useState('')
  const [plannedQty, setPlannedQty] = useState(1)
  const [startDate, setStartDate] = useState(today())
  const [dueDate, setDueDate] = useState(today())
  const [workstation, setWorkstation] = useState('')
  const [plantName, setPlantName] = useState('Chakan')
  const [productionMethod, setProductionMethod] = useState<ProductionMethod>('in_house')
  const [customerName, setCustomerName] = useState('')
  const [salesOrderNo, setSalesOrderNo] = useState('')
  const [bomId, setBomId] = useState<string | null>(null)
  const [bomNumber, setBomNumber] = useState('')
  const [bomVersion, setBomVersion] = useState('')
  const [uom, setUom] = useState('NOS')
  const [materialWarehouseName, setMaterialWarehouseName] = useState('RM Stores')
  const [fgWarehouseName, setFgWarehouseName] = useState('FG Stores')
  const [qualityRequired, setQualityRequired] = useState(false)
  const [notes, setNotes] = useState('')
  const [attachmentNote, setAttachmentNote] = useState('')
  const [activeRoute, setActiveRoute] = useState<ManufacturingRoute | null>(null)
  const [routeOptions, setRouteOptions] = useState<ManufacturingRoute[]>([])
  const [selectedRouteId, setSelectedRouteId] = useState('')
  const [overrideRoute, setOverrideRoute] = useState(false)

  const refreshPreview = useCallback(async (nextBomId: string | null, qty: number) => {
    const preview = await previewWorkOrderMaterials(nextBomId, qty)
    setPreviewMaterials(preview.materials)
    setEstimatedCost(preview.estimatedCost)
    setMaterialReady(preview.materialReady)
    setMaterialsChecked(false)
  }, [])

  const loadRouteForItem = useCallback(async (itemId: string, nextBomId?: string | null) => {
    if (!itemId) {
      setActiveRoute(null)
      setRouteOptions([])
      setSelectedRouteId('')
      setOverrideRoute(false)
      return
    }
    const [active, all] = await Promise.all([
      getActiveRouteForFinishedItem(itemId, nextBomId),
      getManufacturingRoutes({ finishedItem: itemId }),
    ])
    setActiveRoute(active)
    setRouteOptions(all.filter((r) => r.status === 'active' || r.status === 'draft'))
    setSelectedRouteId(active?.id ?? '')
    setOverrideRoute(false)
  }, [])

  const applyDetails = useCallback(async (src: WorkOrderSource, docId: string | null) => {
    const details = await getWorkOrderSourceDetails(src, docId)
    if (!details) return
    setFinishedItemId(details.finishedItemId)
    setFinishedItemCode(details.finishedItemCode)
    setFinishedItemName(details.finishedItemName)
    setPlannedQty(details.requiredQty)
    setDueDate(details.requiredDate)
    setCustomerName(details.customerName ?? '')
    setBomId(details.bomId ?? null)
    setBomNumber(details.bomNumber ?? '')
    setBomVersion(details.bomVersion ?? '')
    setUom(details.uom)
    setProductionMethod(details.productionMethod)
    setMaterialWarehouseName(details.materialWarehouseName)
    setFgWarehouseName(details.fgWarehouseName)
    setPlantName(details.plantName)
    setQualityRequired(details.qualityRequired)
    if (src === 'sales_order' && docId) {
      const docs = await getWorkOrderSourceDocuments('sales_order')
      const doc = docs.find((d) => d.id === docId)
      if (doc) setSalesOrderNo(doc.documentNo)
    } else {
      setSalesOrderNo('')
    }
    await refreshPreview(details.bomId ?? null, details.requiredQty)
    await loadRouteForItem(details.finishedItemId, details.bomId ?? null)
  }, [loadRouteForItem, refreshPreview])

  useEffect(() => {
    void getWorkOrderSourceDocuments(source).then(setSourceDocs)
  }, [source])

  useEffect(() => {
    void getManufacturingSettings().then((s) => {
      setQuickMode(s.general.quickModeDefault !== false)
      setAutoConsumption(s.materialConsumption.automaticConsumption !== false)
    })
  }, [])

  useEffect(() => {
    void getBoms({ status: 'active' }).then((boms) => setFinishedItems(boms.map((bom) => ({
      id: bom.finishedItemId,
      code: bom.finishedItemCode,
      name: bom.finishedItemName,
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
      .then(async (wo) => {
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
        setWorkstation(wo.workstation ?? '')
        setPlantName(wo.plantName)
        setProductionMethod(wo.productionMethod)
        setCustomerName(wo.customerName)
        setSalesOrderNo(wo.salesOrderNo)
        setBomId(wo.bomId)
        setBomNumber(wo.bomNumber ?? '')
        setBomVersion(wo.bomVersion ?? '')
        setUom(wo.uom)
        setMaterialWarehouseName(wo.materialWarehouseName)
        setFgWarehouseName(wo.fgWarehouseName)
        setQualityRequired(wo.qualityRequired)
        setAutoConsumption(wo.consumptionMode === 'automatic')
        setNotes(wo.notes ?? '')
        const mats = await getWorkOrderMaterials(wo.id)
        setPreviewMaterials(mats)
        const preview = await previewWorkOrderMaterials(wo.bomId, wo.plannedQty)
        setEstimatedCost(preview.estimatedCost)
        setMaterialReady(preview.materialReady)
        await loadRouteForItem(wo.finishedItemId, wo.bomId)
        if (wo.routeId) {
          setSelectedRouteId(wo.routeId)
        }
      })
      .finally(() => setLoading(false))
  }, [applyDetails, isEdit, loadRouteForItem, navigate, perms.canEditWo, searchParams, workOrderId])

  const onSourceDocChange = async (docId: string) => {
    setSourceDocumentId(docId)
    if (docId) await applyDetails(source, docId)
  }

  const onFinishedItemChange = async (itemId: string) => {
    setFinishedItemId(itemId)
    const details = await getFinishedItemDefaults(itemId)
    if (!details) {
      await loadRouteForItem(itemId, null)
      return
    }
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
    await refreshPreview(details.bomId ?? null, plannedQty)
    await loadRouteForItem(itemId, details.bomId ?? null)
  }

  const onQtyChange = async (qty: number) => {
    setPlannedQty(qty)
    if (bomId) await refreshPreview(bomId, qty)
  }

  const buildInput = (): CreateWorkOrderInput => ({
    source,
    sourceDocumentId: sourceDocumentId || null,
    sourceDocumentNo:
      salesOrderNo
      || sourceDocs.find((d) => d.id === sourceDocumentId)?.documentNo
      || (source === 'manual' ? 'MANUAL' : ''),
    finishedItemId,
    finishedItemCode,
    finishedItemName,
    plannedQty,
    startDate,
    dueDate,
    plantName,
    productionMethod,
    customerName,
    salesOrderNo,
    salesOrderId: source === 'sales_order' ? sourceDocumentId || undefined : undefined,
    bomId,
    bomNumber,
    bomVersion,
    uom,
    materialWarehouseName,
    fgWarehouseName,
    qualityRequired,
    workstation: workstation || undefined,
    notes: notes || undefined,
    consumptionMode: (autoConsumption ? 'automatic' : 'manual_issue') as MaterialConsumptionMode,
    routeId: selectedRouteId || null,
    overrideRoute: overrideRoute && perms.canOverrideRoute,
  })

  const saveDraft = async () => {
    if (!finishedItemId || plannedQty <= 0) {
      notify.error('Finished item and planned quantity are required')
      return
    }
    setSaving(true)
    try {
      const input = buildInput()
      const result = isEdit && workOrderId
        ? await updateWorkOrder(workOrderId, input)
        : await createWorkOrder(input)
      if (!result.ok || !result.workOrder) {
        notify.error(result.error ?? 'Save failed')
        return
      }
      notify.success('Draft saved')
      navigate(`/manufacturing/work-orders/${result.workOrder.id}`)
    } finally {
      setSaving(false)
    }
  }

  const checkMaterials = async () => {
    if (!finishedItemId) {
      notify.error('Select a finished item first')
      return
    }
    setSaving(true)
    try {
      if (isEdit && workOrderId) {
        await updateWorkOrder(workOrderId, buildInput())
        const checked = await checkWorkOrderMaterialAvailability(workOrderId)
        setPreviewMaterials(checked.materials)
        setMaterialReady(checked.warnings.length === 0)
        setMaterialsChecked(true)
        if (checked.warnings.length) {
          checked.warnings.forEach((w) => notify.warning(w))
        } else {
          notify.success('Materials available')
        }
        return
      }
      const preview = await previewWorkOrderMaterials(bomId, plannedQty)
      setPreviewMaterials(preview.materials)
      setEstimatedCost(preview.estimatedCost)
      setMaterialReady(preview.materialReady)
      setMaterialsChecked(true)
      if (!preview.materialReady) {
        preview.materials
          .filter((m) => m.shortageQty > 0)
          .forEach((m) => notify.warning(`${m.componentItemCode}: short ${m.shortageQty}`))
      } else {
        notify.success('Materials look available')
      }
    } finally {
      setSaving(false)
    }
  }

  const createAndReady = async () => {
    if (!finishedItemId || plannedQty <= 0) {
      notify.error('Finished item and planned quantity are required')
      return
    }
    if (!perms.canCreateWo && !isEdit) {
      notify.error('Permission denied')
      return
    }
    setSaving(true)
    try {
      const result = await createWorkOrderAndMarkReady(buildInput(), isEdit ? workOrderId : undefined)
      if (!result.ok || !result.workOrder) {
        notify.error(result.error ?? 'Could not create work order')
        return
      }
      result.warnings.forEach((w) => notify.warning(w))
      notify.success(
        result.warnings.length
          ? 'Work order saved — material shortages remain'
          : 'Work order created and marked Ready',
      )
      navigate(`/manufacturing/work-orders/${result.workOrder.id}`)
    } finally {
      setSaving(false)
    }
  }

  const previewRoute = useMemo(() => {
    if (overrideRoute && selectedRouteId) {
      return routeOptions.find((r) => r.id === selectedRouteId) ?? activeRoute
    }
    return activeRoute
  }, [activeRoute, overrideRoute, routeOptions, selectedRouteId])

  const suggestions = useMemo(() => ([
    {
      label: 'BOM found',
      value: bomNumber ? `${bomNumber}${bomVersion ? ` (${bomVersion})` : ''}` : 'No active BOM',
      ok: Boolean(bomNumber),
    },
    {
      label: 'Materials available',
      value: !previewMaterials.length
        ? 'Select item to preview'
        : materialReady
          ? `${previewMaterials.length} component(s) ready`
          : `${previewMaterials.filter((m) => m.shortageQty > 0).length} shortage line(s)`,
      ok: previewMaterials.length ? materialReady : undefined,
    },
    {
      label: 'Route template',
      value: previewRoute
        ? `${previewRoute.routeNo} ${previewRoute.version} · ${previewRoute.operations.length} ops (snapshot on create)`
        : 'No active route for this item',
      ok: Boolean(previewRoute),
    },
    {
      label: 'QC / Job Work flags',
      value: previewRoute
        ? `QC ops: ${previewRoute.operations.filter((o) => o.qcRequired).length} · Job work: ${previewRoute.operations.filter((o) => o.jobWorkRequired).length}`
        : qualityRequired ? 'Item QC required' : 'None',
      ok: true,
    },
    {
      label: 'Auto consumption',
      value: autoConsumption ? 'Enabled' : 'Manual issue',
      ok: autoConsumption,
    },
    {
      label: 'Expected production cost',
      value: estimatedCost > 0 ? formatCurrency(estimatedCost) : '—',
      ok: estimatedCost > 0,
    },
  ]), [autoConsumption, bomNumber, bomVersion, estimatedCost, materialReady, previewMaterials, previewRoute, qualityRequired])

  const aiSuggestions = useMemo(() => {
    const tips: string[] = []
    if (previewRoute) {
      tips.push(
        `Route Master “${previewRoute.routeName}” will be copied into this WO — you do not add stages manually.`,
      )
    } else if (finishedItemId) {
      tips.push('No active Route for this item. Create one under Manufacturing → Routes (once), then return.')
    }
    if (materialReady) tips.push('This WO can start because all materials are available.')
    const short = previewMaterials.filter((m) => m.shortageQty > 0)
    for (const m of short.slice(0, 2)) {
      tips.push(`Raw material ${m.componentItemCode} is short by ${m.shortageQty} ${m.uom}.`)
    }
    if (qualityRequired) tips.push('QC is required for this finished item.')
    if (autoConsumption && previewMaterials.length > 0) {
      tips.push(`Auto consumption will consume ${previewMaterials.length} materials on completion.`)
    }
    if (!tips.length) tips.push('Pick source and finished item — system fills BOM, route, warehouses, and flags.')
    return tips
  }, [autoConsumption, finishedItemId, materialReady, previewMaterials, previewRoute, qualityRequired])

  if (!perms.canCreateWo && !isEdit) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" title="New Work Order" badge="Manufacturing">
        <p className="text-[13px] text-erp-muted">You do not have permission to create work orders.</p>
      </OperationalPageShell>
    )
  }

  if (loading) {
    return (
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Manufacturing"
        title={isEdit ? 'Edit Work Order' : 'New Work Order'}
        breadcrumbs={[
          { label: 'Manufacturing & Production', to: '/manufacturing' },
          { label: 'Work Orders', to: '/manufacturing/work-orders' },
        ]}
        autoBreadcrumbs={false}
        backLink={{ to: '/manufacturing/work-orders', label: 'Back to Work Orders' }}
      >
        <LoadingState variant="form" />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Manufacturing"
      title={isEdit ? 'Edit Work Order' : 'New Work Order'}
      description="Enter Source, Finished Item, Qty, and dates. BOM, materials, warehouses, and Route operations fill automatically."
      breadcrumbs={[
        { label: 'Manufacturing & Production', to: '/manufacturing' },
        { label: 'Work Orders', to: '/manufacturing/work-orders' },
        { label: isEdit ? 'Edit' : 'New' },
      ]}
      autoBreadcrumbs={false}
      favoritePath={isEdit ? `/manufacturing/work-orders/${workOrderId}/edit` : '/manufacturing/work-orders/new'}
      backLink={{ to: '/manufacturing/work-orders', label: 'Back to Work Orders' }}
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={{
            id: 'ready',
            label: saving ? 'Working…' : 'Create & Mark Ready',
            icon: CheckCircle2,
            onClick: () => void createAndReady(),
            disabled: saving,
          }}
          secondaryActions={[
            {
              id: 'draft',
              label: 'Save Draft',
              icon: Save,
              onClick: () => void saveDraft(),
              disabled: saving,
            },
            {
              id: 'check',
              label: 'Check Materials',
              icon: ClipboardCheck,
              onClick: () => void checkMaterials(),
              disabled: saving || !finishedItemId,
            },
            { id: 'cancel', label: 'Cancel', onClick: () => navigate('/manufacturing/work-orders') },
          ]}
        />
      )}
    >
      <div className="space-y-4">
        <ManufacturingDemoBanner message="Route Master is a reusable template — create once under Routes. On this screen you only pick Item + Qty; stages are copied into the WO as a snapshot (master edits later do not change this WO)." />

        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-[12px] font-semibold text-emerald-900 ring-1 ring-emerald-200">
            <Checkbox checked={quickMode} onChange={(e) => setQuickMode(e.target.checked)} />
            Quick Mode {quickMode ? 'ON' : 'OFF'}
          </label>
          {materialsChecked ? (
            <span className={cn(
              'rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1',
              materialReady ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : 'bg-amber-50 text-amber-900 ring-amber-200',
            )}>
              Materials {materialReady ? 'OK' : 'shortage'}
            </span>
          ) : null}
          {previewRoute ? (
            <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-900 ring-1 ring-sky-200">
              Route {previewRoute.routeNo} · {previewRoute.version} ready to snapshot
            </span>
          ) : finishedItemId ? (
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-900 ring-1 ring-amber-200">
              No active route — set up under Routes
            </span>
          ) : null}
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
          <div className="min-w-0 space-y-4">
            <ErpCardSection title="1. Essentials" collapsible defaultOpen accent="blue">
              <p className="mb-3 text-[12px] text-erp-muted">
                Source Type · Finished Item · Quantity · Start Date · Due Date. Everything else is auto-filled.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Source Type" required>
                  <Select
                    value={source}
                    onChange={(e) => {
                      const s = e.target.value as WorkOrderSource
                      setSource(s)
                      setSourceDocumentId('')
                      setSalesOrderNo('')
                      if (s !== 'manual') {
                        setFinishedItemId('')
                        setFinishedItemCode('')
                        setFinishedItemName('')
                        setBomId(null)
                        setBomNumber('')
                        setPreviewMaterials([])
                        setActiveRoute(null)
                        setSelectedRouteId('')
                      }
                    }}
                  >
                    {(Object.keys(WO_SOURCE_LABELS) as WorkOrderSource[]).map((s) => (
                      <option key={s} value={s}>{WO_SOURCE_LABELS[s]}</option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Source Reference">
                  <Select
                    value={sourceDocumentId}
                    onChange={(e) => void onSourceDocChange(e.target.value)}
                    disabled={source === 'manual'}
                  >
                    <option value="">{source === 'manual' ? 'Manual — no document' : 'Select reference…'}</option>
                    {sourceDocs.map((d) => (
                      <option key={d.id} value={d.id}>{d.label}</option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Finished Item" required>
                  <Select
                    value={finishedItemId}
                    onChange={(e) => void onFinishedItemChange(e.target.value)}
                    disabled={quickMode && source !== 'manual' && Boolean(sourceDocumentId)}
                  >
                    <option value="">
                      {source === 'manual' ? 'Select finished item…' : 'Auto from source / select…'}
                    </option>
                    {finishedItems.map((item) => (
                      <option key={item.id} value={item.id}>{item.code} — {item.name}</option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Quantity" required>
                  <Input
                    type="number"
                    min={0.001}
                    step="any"
                    value={plannedQty}
                    onChange={(e) => void onQtyChange(Number(e.target.value))}
                    className="text-lg font-semibold"
                  />
                </FormField>
                <FormField label="Start Date" required>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </FormField>
                <FormField label="Due Date" required>
                  <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </FormField>
                {!quickMode ? (
                  <FormField label="Production Warehouse / Line" className="sm:col-span-2">
                    <Select value={workstation} onChange={(e) => setWorkstation(e.target.value)}>
                      <option value="">Select line / bay…</option>
                      {LINES.map((line) => (
                        <option key={line} value={line}>{line}</option>
                      ))}
                    </Select>
                  </FormField>
                ) : null}
              </div>
            </ErpCardSection>

            <ErpCardSection
              title="2. Auto-filled BOM & Materials"
              collapsible
              defaultOpen
              accent="teal"
              badge={<span className="text-[11px] text-erp-muted">{previewMaterials.length} line{previewMaterials.length === 1 ? '' : 's'}</span>}
            >
              <dl className="mb-3 grid gap-2 text-[13px] sm:grid-cols-3">
                <div>
                  <dt className="text-erp-muted">BOM (auto)</dt>
                  <dd className="font-semibold text-erp-text">{bomNumber || '—'} {bomVersion}</dd>
                </div>
                <div>
                  <dt className="text-erp-muted">Production Method</dt>
                  <dd className="font-semibold text-erp-text">{PRODUCTION_METHOD_LABELS[productionMethod]}</dd>
                </div>
                <div>
                  <dt className="text-erp-muted">UOM</dt>
                  <dd className="font-semibold text-erp-text">{uom}</dd>
                </div>
              </dl>
              {previewMaterials.length === 0 ? (
                <p className="rounded-lg border border-dashed border-erp-border px-3 py-6 text-center text-[12px] text-erp-muted">
                  Select a finished item or source to load BOM materials.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="erp-table w-full text-[12px]">
                    <thead>
                      <tr>
                        <th>Raw Material</th>
                        <th className="text-right">Required</th>
                        <th className="text-right">Available</th>
                        <th className="text-right">Shortage</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewMaterials.map((m) => (
                        <tr key={m.id}>
                          <td>
                            <div className="font-mono">{m.componentItemCode}</div>
                            <div className="text-erp-muted">{m.componentItemName}</div>
                          </td>
                          <td className="text-right tabular-nums">{m.requiredQty.toFixed(2)} {m.uom}</td>
                          <td className="text-right tabular-nums">{m.availableQty}</td>
                          <td className={cn('text-right tabular-nums font-semibold', m.shortageQty > 0 && 'text-rose-700')}>
                            {m.shortageQty.toFixed(2)}
                          </td>
                          <td>
                            <StatusDot tone={statusToneFromLabel(m.status)} label={m.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </ErpCardSection>

            <ErpCardSection
              title="3. Route Operations (review — auto from Route Master)"
              collapsible
              defaultOpen
              accent="violet"
              badge={
                previewRoute ? (
                  <span className="text-[11px] text-erp-muted">
                    {previewRoute.operations.length} stage{previewRoute.operations.length === 1 ? '' : 's'}
                  </span>
                ) : undefined
              }
            >
              <p className="mb-3 text-[12px] text-erp-muted">
                Do not build stages here. The active Route linked to this Finished Item / BOM is copied into the Work Order on create.
                Changes on the Operations tab later affect <span className="font-semibold text-erp-text">only this WO</span>, not the master.
              </p>
              {previewRoute ? (
                <div className="mb-3 rounded-lg border border-erp-border bg-slate-50/80 px-3 py-2 text-[13px]">
                  <span className="font-semibold text-erp-text">{previewRoute.routeNo}</span>
                  {' — '}
                  {previewRoute.routeName}
                  <span className="text-erp-muted"> · {previewRoute.version} · {previewRoute.status}</span>
                  {previewRoute.defaultBomNumber ? (
                    <span className="text-erp-muted"> · BOM {previewRoute.defaultBomNumber}</span>
                  ) : null}
                  <p className="mt-1 font-medium text-erp-text">
                    {previewRoute.operations
                      .slice()
                      .sort((a, b) => a.sequenceNo - b.sequenceNo)
                      .map((o) => o.operationName)
                      .join(' → ')}
                  </p>
                </div>
              ) : null}
              {perms.canOverrideRoute ? (
                <div className="mb-3 grid gap-3 rounded-lg border border-dashed border-amber-200 bg-amber-50/40 p-3 sm:grid-cols-2">
                  <label className="inline-flex items-center gap-2 text-[13px] font-medium">
                    <Checkbox
                      checked={overrideRoute}
                      onChange={(e) => {
                        setOverrideRoute(e.target.checked)
                        if (!e.target.checked) setSelectedRouteId(activeRoute?.id ?? '')
                      }}
                    />
                    Override route (permission)
                  </label>
                  <FormField label="Alternate route template">
                    <Select
                      value={selectedRouteId}
                      disabled={!overrideRoute}
                      onChange={(e) => setSelectedRouteId(e.target.value)}
                    >
                      <option value="">Active route (default)</option>
                      {routeOptions.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.routeNo} — {r.routeName} ({r.version}, {r.status})
                        </option>
                      ))}
                    </Select>
                  </FormField>
                </div>
              ) : (
                <p className="mb-3 text-[11px] text-erp-muted">Route override requires permission — default active template is always used.</p>
              )}
              {!previewRoute ? (
                <p className="rounded-lg border border-dashed border-erp-border px-3 py-6 text-center text-[12px] text-erp-muted">
                  No active Route for this item. Create and activate one under{' '}
                  <button
                    type="button"
                    className="font-semibold text-erp-primary hover:underline"
                    onClick={() => navigate('/manufacturing/routes')}
                  >
                    Manufacturing → Routes
                  </button>
                  {' '}(once), then return.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="erp-table w-full text-[12px]">
                    <thead>
                      <tr>
                        <th>Seq</th>
                        <th>Operation</th>
                        <th>Work Center</th>
                        <th>Planned Time</th>
                        <th>QC</th>
                        <th>Job Work</th>
                        <th>Default Vendor</th>
                        <th>Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...previewRoute.operations]
                        .sort((a, b) => a.sequenceNo - b.sequenceNo)
                        .map((op) => (
                          <tr key={op.id}>
                            <td className="tabular-nums">{op.sequenceNo}</td>
                            <td className="font-semibold">{op.operationName}</td>
                            <td>{op.workCenter}</td>
                            <td className="tabular-nums">{op.plannedTimeMinutes} min</td>
                            <td>{op.qcRequired ? 'Yes' : '—'}</td>
                            <td>{op.jobWorkRequired ? 'Yes' : '—'}</td>
                            <td>{op.defaultVendorName || '—'}</td>
                            <td className="text-erp-muted">{op.remarks || '—'}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </ErpCardSection>

            <ErpCardSection title="4. Warehouse & Consumption" collapsible defaultOpen={!quickMode} accent="slate">
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Source Warehouse (auto)">
                  <Input value={materialWarehouseName} readOnly disabled />
                </FormField>
                <FormField label="Finished Goods Warehouse (auto)">
                  <Input value={fgWarehouseName} readOnly disabled />
                </FormField>
                <FormField label="Plant (auto)">
                  <Input value={plantName} readOnly disabled />
                </FormField>
                <div className="flex items-end">
                  <label className="inline-flex items-center gap-2 text-[13px]">
                    <Checkbox
                      checked={autoConsumption}
                      onChange={(e) => setAutoConsumption(e.target.checked)}
                    />
                    Auto Consumption
                  </label>
                </div>
              </div>
            </ErpCardSection>

            <ErpCardSection title="5. QC Requirement" collapsible defaultOpen={!quickMode} accent="amber">
              <label className="inline-flex items-center gap-2 text-[13px]">
                <Checkbox
                  checked={qualityRequired}
                  onChange={(e) => setQualityRequired(e.target.checked)}
                  disabled={quickMode}
                />
                QC Required {quickMode ? '(from item / BOM)' : ''}
              </label>
              <p className="mt-2 text-[12px] text-erp-muted">
                When QC is required, Complete Production places the WO in QC Pending before close.
              </p>
            </ErpCardSection>

            <ErpCardSection title="6. Notes / Attachments" collapsible defaultOpen={false} accent="slate">
              <FormField label="Notes">
                <textarea
                  className="min-h-[88px] w-full rounded-lg border border-erp-border px-3 py-2 text-[13px]"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional planning notes…"
                />
              </FormField>
              <FormField label="Attachments (demo)">
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={attachmentNote}
                    onChange={(e) => setAttachmentNote(e.target.value)}
                    placeholder="File name or link reference…"
                  />
                  <button
                    type="button"
                    className="erp-btn erp-btn-secondary inline-flex h-9 items-center gap-1 px-3 text-[12px]"
                    onClick={() => {
                      if (!attachmentNote.trim()) {
                        notify.warning('Enter a file name first')
                        return
                      }
                      notify.success('Attachment noted (demo — not uploaded)')
                      setAttachmentNote('')
                    }}
                  >
                    <Paperclip className="h-3.5 w-3.5" />
                    Add
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-erp-muted">Uploads are demo-only until the manufacturing API ships.</p>
              </FormField>
              {customerName ? (
                <p className="mt-2 text-[12px] text-erp-muted">Customer from source: <span className="font-medium text-erp-text">{customerName}</span></p>
              ) : null}
            </ErpCardSection>
          </div>

          <aside className="space-y-3 lg:sticky lg:top-4">
            <div className="h-fit rounded-xl border border-erp-border bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-erp-text">System Suggestions</h2>
              <p className="mt-0.5 text-[11px] text-erp-muted">Filled automatically in Quick Mode.</p>
              <div className="mt-3">
                {suggestions.map((s) => (
                  <SuggestionRow key={s.label} label={s.label} value={s.value} ok={s.ok} />
                ))}
              </div>
            </div>
            <ManufacturingAiAssist title="Work Order Insights" suggestions={aiSuggestions} />
          </aside>
        </div>
      </div>
    </OperationalPageShell>
  )
}
