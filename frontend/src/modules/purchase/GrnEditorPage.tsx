import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ChevronDown,
  ChevronRight,
  ClipboardList,
  FileText,
  MapPin,
  Package,
  StickyNote,
  Truck,
} from 'lucide-react'
import { PurchaseCardFormShell } from '@/components/purchase/PurchaseCardFormShell'
import { purchaseSectionId } from '@/components/purchase/PurchaseEnterpriseFormKit'
import {
  PurchaseDocumentFactBox,
  buildPurchaseRelatedLinks,
  purchaseDocumentApprovalFact,
} from '@/components/purchase/PurchaseDocumentFactBox'
import {
  PurchaseStatusChip,
  purchaseStatusTone,
} from '@/components/purchase/purchaseCardFormShared'
import { ErpCardSection, ErpFieldRow, ErpFormSpan } from '@/components/erp/card-form'
import { ErpSmartSelect } from '@/components/erp/ErpSmartSelect'
import { FormActionBar } from '@/components/erp/FormActionBar'
import { DecimalInput, Input, Select, Textarea } from '@/components/forms/Inputs'
import { SELECT_PLACEHOLDER } from '@/components/forms/selectStandards'
import { LoadingState } from '@/design-system/components/LoadingState'
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard'
import {
  joinFastTabSummary,
  notesSummary,
  receivingSummary,
} from '@/modules/purchase/purchaseFastTabSummaries'
import {
  createGRNFromPo,
  getGRNById,
  getPurchaseItems,
  getPurchaseOrderById,
  getPurchaseOrders,
  getPurchaseSetup,
  previewNextGoodsReceiptNumber,
  PurchaseServiceError,
  updateGRN,
  GRN_DOMAIN_STATUS_LABELS,
} from '@/services/purchase'
import {
  evaluateGrnDocumentTolerance,
  evaluateGrnLineTolerance,
  GRN_TOLERANCE_STATUS_LABELS,
} from '@/services/purchase/grnTolerance'
import {
  buildItemReceiptControls,
  linesFromGrn,
  linesFromPo,
  recalcGrnLineDraft,
  type GrnLineDraft,
  type ItemReceiptControl,
} from '@/modules/purchase/grnLineDraft'
import {
  GRN_LINES_RECEIVING_GUIDE,
  GRN_RECEIVING_CONDITION_DESCRIPTIONS,
  GRN_RECEIVING_CONDITION_LABELS,
  GRN_SHORT_CLOSE_REASONS,
  type GrnReceivingCondition,
} from '@/services/purchase/grnReceivingCondition'
import type { GrnInput, PurchaseOrder } from '@/types/purchaseDomain'
import { formatNumber } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import {
  formatPurchaseQty,
  purchaseLineHasDualUom,
  purchaseQtyToBaseQty,
  toUomQuantityFromBase,
} from '@/utils/purchaseLineUom'
import { notify } from '@/store/toastStore'
import { systemConfirm } from '@/utils/systemConfirm'
import { useActiveWarehouses, useActiveLocations } from '@/hooks/useMasterLists'
import { useMasterStore } from '@/store/masterStore'
import { useBinOptions } from '@/hooks/useBinOptions'
import { resolveBinSelection, resolveItemDefaultBin } from '@/utils/itemDefaultBin'
import { PURCHASE_FORM_ROUTES } from './purchaseFormRoutes'

/**
 * Resolve GRN warehouse: PO delivery warehouse → Purchase Setup default → blank.
 * Never picks the first warehouse from the master list.
 */
function warehouseFromPoDelivery(
  po: PurchaseOrder,
  setupDefaultWarehouseId?: string,
): { id: string; name: string } {
  const { locations, warehouses } = useMasterStore.getState()
  if (po.deliveryLocation?.id) {
    const loc = locations.find((l) => l.id === po.deliveryLocation.id)
    const byLocation = loc?.warehouseId
      ? warehouses.find((w) => w.id === loc.warehouseId)
      : undefined
    if (byLocation) return { id: byLocation.id, name: byLocation.warehouseName }
    const direct = warehouses.find(
      (w) => w.id === po.deliveryLocation.id || w.warehouseName === po.deliveryLocation.name,
    )
    if (direct) return { id: direct.id, name: direct.warehouseName }
  }
  if (setupDefaultWarehouseId) {
    const fromSetup = warehouses.find((w) => w.id === setupDefaultWarehouseId)
    if (fromSetup) return { id: fromSetup.id, name: fromSetup.warehouseName }
    return { id: setupDefaultWarehouseId, name: '' }
  }
  return { id: '', name: '' }
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

/** Resolve storage location id from id, code, or name (GRN editor stores id in state). */
function resolveStorageLocationId(
  raw: string,
  locations: ReturnType<typeof useMasterStore.getState>['locations'],
): string {
  const v = raw.trim()
  if (!v) return ''
  if (locations.some((l) => l.id === v)) return v
  const hit = locations.find((l) => l.locationName === v || l.locationCode === v)
  return hit?.id ?? v
}

/** Human label for receiving location — never show a bare UUID in UI chrome. */
function storageLocationLabel(
  raw: string,
  locations: ReturnType<typeof useMasterStore.getState>['locations'],
): string {
  const v = raw.trim()
  if (!v) return ''
  const hit = locations.find(
    (l) => l.id === v || l.locationName === v || l.locationCode === v,
  )
  if (hit) {
    const code = hit.locationCode?.trim()
    const name = hit.locationName?.trim()
    if (code && name && code !== name) return `${code} — ${name}`
    return name || code || ''
  }
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)) {
    return ''
  }
  return v
}

export function GrnEditorPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const isNew = !id
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [recordId, setRecordId] = useState<string | null>(id ?? null)
  const [documentNumber, setDocumentNumber] = useState<string | null>(null)
  const [status, setStatus] = useState('draft')
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [itemControls, setItemControls] = useState<Record<string, ItemReceiptControl>>({})
  const [setupTolerancePct, setSetupTolerancePct] = useState(0)
  const [shortCloseLineIndex, setShortCloseLineIndex] = useState<number | null>(null)
  const [shortCloseReasonDraft, setShortCloseReasonDraft] = useState('')
  const [shortCloseReasonOther, setShortCloseReasonOther] = useState('')
  const [poId, setPoId] = useState(searchParams.get('poId') ?? '')
  const [vendorId, setVendorId] = useState('')
  const [documentDate, setDocumentDate] = useState(today())
  const [vendorChallanNumber, setVendorChallanNumber] = useState('')
  const [vendorChallanDate, setVendorChallanDate] = useState('')
  const [vehicleNo, setVehicleNo] = useState('')
  const [transporterName, setTransporterName] = useState('')
  const [lrNumber, setLrNumber] = useState('')
  const [gateEntryNo, setGateEntryNo] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [warehouseName, setWarehouseName] = useState('')
  const [receivingLocation, setReceivingLocation] = useState('')
  const [receivedByName, setReceivedByName] = useState('Amit Deshmukh')
  const [inspectionRequired, setInspectionRequired] = useState(true)
  const [allowExcess, setAllowExcess] = useState(false)
  const [remarks, setRemarks] = useState('')
  const [lines, setLines] = useState<GrnLineDraft[]>([])
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [showAdvancedDetails, setShowAdvancedDetails] = useState(false)
  const { dirty, markDirty, resetDirty } = useUnsavedChangesGuard(true)

  const warehouses = useActiveWarehouses()
  const storageLocations = useActiveLocations()
  const bins = useBinOptions(warehouseId || undefined)

  const warehouseLocations = useMemo(
    () => storageLocations.filter((l) => !warehouseId || l.warehouseId === warehouseId),
    [storageLocations, warehouseId],
  )
  const receivingLocationLabel = useMemo(
    () => storageLocationLabel(receivingLocation, storageLocations),
    [receivingLocation, storageLocations],
  )
  const receivableOrders = useMemo(
    () =>
      orders.filter(
        (o) =>
          ['released', 'sent_to_vendor', 'partially_received', 'fully_received', 'invoiced'].includes(
            o.status,
          ) && o.lines.some((l) => l.pendingQty > 0),
      ),
    [orders],
  )

  const selectedPo = useMemo(() => orders.find((o) => o.id === poId), [orders, poId])

  /** Match PO editor: scope by warehouse / storage location; never leave dropdown empty when bins exist. */
  const warehouseBins = useMemo(() => {
    const selectedIds = new Set(lines.map((l) => l.binId).filter(Boolean) as string[])
    const selectedCodes = new Set(lines.map((l) => l.bin?.trim()).filter((c): c is string => Boolean(c)))
    const keepSelected = (b: (typeof bins)[number]) =>
      selectedIds.has(b.id) ||
      selectedCodes.has(b.code) ||
      [...selectedIds].some(
        (id) => b.code.localeCompare(id, undefined, { sensitivity: 'accent' }) === 0,
      )

    const deliveryRef = receivingLocation || selectedPo?.deliveryLocation?.id
    if (!warehouseId && !deliveryRef) return bins

    const scoped = bins.filter(
      (b) =>
        !b.warehouseId ||
        b.warehouseId === warehouseId ||
        (deliveryRef && b.storageLocationId === deliveryRef) ||
        (deliveryRef && b.warehouseId === deliveryRef) ||
        keepSelected(b),
    )
    return scoped.length > 0 ? scoped : bins
  }, [bins, warehouseId, receivingLocation, selectedPo?.deliveryLocation?.id, lines])

  /** When bins load after PO lines, resolve item default bin + code-only snapshots to ids. */
  useEffect(() => {
    if (!bins.length || !lines.length) return
    const catalog = warehouseBins.length ? warehouseBins : bins
    setLines((prev) => {
      let changed = false
      const next = prev.map((line) => {
        const resolved = resolveBinSelection(line.binId, line.bin, catalog)
        if (resolved.binId || resolved.binCode) {
          if (resolved.binId !== line.binId || resolved.binCode !== line.bin) {
            changed = true
            return { ...line, binId: resolved.binId, bin: resolved.binCode }
          }
          return line
        }
        const master = useMasterStore.getState().items.find((i) => i.id === line.itemId)
        const def = resolveItemDefaultBin(master, catalog)
        if ((def.binId || def.binCode) && (def.binId !== line.binId || def.binCode !== line.bin)) {
          changed = true
          return { ...line, binId: def.binId, bin: def.binCode }
        }
        return line
      })
      return changed ? next : prev
    })
  }, [bins, warehouseBins, poId, lines.length])

  const receivableVendors = useMemo(() => {
    const map = new Map<string, { id: string; name: string; code: string }>()
    for (const order of receivableOrders) {
      if (!map.has(order.vendor.id)) map.set(order.vendor.id, order.vendor)
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [receivableOrders])

  const vendorReceivableOrders = useMemo(
    () => (vendorId ? receivableOrders.filter((o) => o.vendor.id === vendorId) : []),
    [receivableOrders, vendorId],
  )

  const vendorSelectOptions = useMemo(
    () =>
      receivableVendors.map((v) => ({
        value: v.id,
        label: v.code ? `${v.code} — ${v.name}` : v.name,
        searchText: `${v.code} ${v.name}`.toLowerCase(),
      })),
    [receivableVendors],
  )

  const poSelectOptions = useMemo(
    () =>
      vendorReceivableOrders.map((o) => {
        const openQty = o.lines.reduce((s, l) => s + l.pendingQty, 0)
        return {
          value: o.id,
          label: o.documentNumber,
          searchText: `${o.documentNumber} ${o.vendor.name} ${o.vendor.code ?? ''} open ${openQty}`.toLowerCase(),
          trailing: `Open ${formatNumber(openQty)}`,
        }
      }),
    [vendorReceivableOrders],
  )

  /** Approved (not yet sent) — visible for guidance, not selectable for GRN. */
  const approvedNotReleasedOrders = useMemo(
    () =>
      orders.filter(
        (o) => o.status === 'approved' && o.lines.some((l) => l.pendingQty > 0),
      ),
    [orders],
  )

  const vendorApprovedNotReleased = useMemo(
    () => (vendorId ? approvedNotReleasedOrders.filter((o) => o.vendor.id === vendorId) : []),
    [approvedNotReleasedOrders, vendorId],
  )

  const receiptSetup = useMemo(
    () => ({ allowOverReceipt: allowExcess, overReceiptTolerancePct: setupTolerancePct }),
    [allowExcess, setupTolerancePct],
  )

  const lineTotals = useMemo(() => {
    const receivedQty = lines.reduce((s, l) => s + (Number(l.receivedQty) || 0), 0)
    const pendingQty = lines.reduce((s, l) => s + (Number(l.pendingQty) || 0), 0)
    const shortQty = lines.reduce((s, l) => s + (Number(l.shortQty) || 0), 0)
    const excessQty = lines.reduce((s, l) => s + (Number(l.excessQty) || 0), 0)
    const doc = evaluateGrnDocumentTolerance(
      lines.map((l) => ({
        itemCode: l.itemCode,
        openQuantity: Number(l.pendingQty) || 0,
        receivedQuantity: Number(l.receivedQty) || 0,
        itemTolerancePct: l.quantityTolerancePct,
        setupTolerancePct: setupTolerancePct,
        allowOverReceipt: allowExcess,
        closeOpenQuantity: l.closeOpenQuantity,
      })),
    )
    const remainingOpenQty = lines.reduce((s, l) => {
      const pending = Number(l.pendingQty) || 0
      const received = Number(l.receivedQty) || 0
      return s + Math.max(0, pending - received)
    }, 0)
    return {
      lineCount: lines.length,
      receivedQty,
      pendingQty,
      shortQty,
      excessQty,
      notReceivedCount: doc.notReceivedCount,
      partialCount: doc.partialCount,
      outsideCount: doc.outsideCount,
      requiresToleranceApproval: doc.requiresApproval,
      receivableLineCount: doc.receivableLineCount,
      remainingOpenQty,
    }
  }, [lines, allowExcess, setupTolerancePct])

  const showWeightCol = useMemo(
    () => lines.some((l) => l.receiptEntryMode !== 'UNIT_ONLY'),
    [lines],
  )

  const showBatchSerialCol = useMemo(
    () => lines.some((l) => l.batchControlled || l.serialControlled),
    [lines],
  )
  const showExpiryCol = useMemo(
    () => lines.some((l) => l.expiryControlled),
    [lines],
  )

  const receivingPeek = useMemo(
    () =>
      receivingSummary({
        warehouse: warehouseName,
        gateEntry: gateEntryNo,
        vehicle: vehicleNo,
        qcRequired: inspectionRequired,
      }),
    [warehouseName, gateEntryNo, vehicleNo, inspectionRequired],
  )
  const notesPeek = useMemo(() => notesSummary(remarks), [remarks])
  const linesPeek = useMemo(
    () =>
      joinFastTabSummary([
        `${lineTotals.lineCount} line${lineTotals.lineCount === 1 ? '' : 's'}`,
        lineTotals.receivedQty > 0 ? `Received ${formatNumber(lineTotals.receivedQty)}` : false,
      ]),
    [lineTotals],
  )

  const statusLabel =
    GRN_DOMAIN_STATUS_LABELS[status as keyof typeof GRN_DOMAIN_STATUS_LABELS] ?? status

  const documentTitle = isNew
    ? 'New Goods Receipt Note'
    : (documentNumber ?? 'Goods Receipt Note')
  const vendorFact = selectedPo?.vendor.name || 'Not selected'
  const poFact = selectedPo?.documentNumber || 'Not selected'

  const recordHeaderFacts = useMemo(
    () => [
      ...(isNew
        ? [{ label: 'GRN No', value: documentNumber ?? 'Loading…' }]
        : []),
      { label: 'Vendor', value: vendorFact },
      { label: 'PO', value: poFact },
      {
        label: 'Date',
        value: documentDate ? formatDate(documentDate) : 'Not selected',
      },
      {
        label: 'Warehouse',
        value: warehouseName || 'Not selected',
      },
    ],
    [isNew, documentNumber, vendorFact, poFact, documentDate, warehouseName],
  )

  const documentFactBox = useMemo(() => {
    const approval = purchaseDocumentApprovalFact(status)
    const vendor = selectedPo?.vendor
    return (
      <PurchaseDocumentFactBox
        vendor={
          vendor
            ? {
                id: vendor.id,
                code: vendor.code,
                name: vendor.name,
                paymentTerms: selectedPo?.paymentTerms,
              }
            : null
        }
        documentStatus={{
          statusLabel,
          ...approval,
          createdBy: receivedByName || null,
          modifiedBy: null,
          modifiedDate: null,
        }}
        related={buildPurchaseRelatedLinks({
          purchaseOrderId: poId || null,
          purchaseOrderNumber: selectedPo?.documentNumber || null,
        })}
      />
    )
  }, [status, statusLabel, selectedPo, poId, receivedByName])

  const readOnlyHeaderPo = !isNew && Boolean(recordId)
  const showPoPicker = isNew || !readOnlyHeaderPo

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [pos, items, setup] = await Promise.all([
        getPurchaseOrders(),
        getPurchaseItems(),
        getPurchaseSetup().catch(() => null),
      ])
      setOrders(pos)
      if (setup) {
        setAllowExcess(Boolean(setup.general.allowOverReceipt))
        setSetupTolerancePct(Number(setup.general.overReceiptTolerancePct ?? 0))
      }
      const masterItems = useMasterStore.getState().items
      const tolerances = useMasterStore.getState().receivingTolerances
      const tolerancePctById = new Map(
        tolerances.map((t) => [t.id, Number(t.percentage ?? 0)]),
      )
      const controls = buildItemReceiptControls(masterItems.length ? masterItems : [], tolerancePctById)
      for (const item of items) {
        if (!controls[item.id]) {
          controls[item.id] = {
            batch: item.batchControlled,
            serial: item.serialControlled,
            expiry: item.expiryControlled,
            qcRequired: item.qcRequired,
            quantityTolerancePct: Number(item.receivingTolerancePercentage ?? 0),
            weightTolerancePct: Number(item.receivingTolerancePercentage ?? 0),
            receiptEntryMode: 'UNIT_ONLY',
            standardWeightPerBaseUnit: 0,
            weightUomCode: '',
            requireWeightAtReceipt: false,
          }
        }
      }
      setItemControls(controls)
      const setupSnap = {
        allowOverReceipt: Boolean(setup?.general.allowOverReceipt ?? allowExcess),
        overReceiptTolerancePct: Number(setup?.general.overReceiptTolerancePct ?? setupTolerancePct),
      }
      if (!isNew && id) {
        const grn = await getGRNById(id)
        if (!grn) {
          notify.error('GRN not found')
          navigate('/purchase/grn')
          return
        }
        setRecordId(grn.id)
        setDocumentNumber(grn.documentNumber)
        setStatus(grn.status)
        setPoId(grn.purchaseOrderId)
        const grnPo = pos.find((o) => o.id === grn.purchaseOrderId)
        if (grnPo) setVendorId(grnPo.vendor.id)
        setDocumentDate(grn.documentDate)
        setVendorChallanNumber(grn.vendorChallanNumber)
        setVendorChallanDate(grn.vendorChallanDate ?? '')
        setVehicleNo(grn.vehicleNo ?? '')
        setTransporterName(grn.transporterName ?? '')
        setLrNumber(grn.lrNumber ?? '')
        setGateEntryNo(grn.gateEntryNo ?? '')
        setWarehouseId(grn.warehouseId)
        setWarehouseName(grn.warehouseName)
        setReceivingLocation(
          grn.storageLocationId ||
            resolveStorageLocationId(grn.receivingLocation, useMasterStore.getState().locations),
        )
        setReceivedByName(grn.receivedBy.name)
        setInspectionRequired(grn.inspectionRequired)
        setAllowExcess(grn.allowExcess)
        setRemarks(grn.remarks)
        setLines(linesFromGrn(grn, controls, setupSnap, grn.inspectionRequired))
        resetDirty()
      } else {
        const initialPoId = searchParams.get('poId') ?? ''
        if (initialPoId) {
          const [po, poSetup] = await Promise.all([
            getPurchaseOrderById(initialPoId),
            getPurchaseSetup().catch(() => null),
          ])
          const effectiveSetup = poSetup ?? setup
          if (effectiveSetup) {
            setAllowExcess(Boolean(effectiveSetup.general.allowOverReceipt))
            setSetupTolerancePct(Number(effectiveSetup.general.overReceiptTolerancePct ?? 0))
          }
          if (po) {
            setPoId(po.id)
            setVendorId(po.vendor.id)
            const wh = warehouseFromPoDelivery(po, effectiveSetup?.general.defaultWarehouseId)
            setWarehouseId(wh.id)
            setWarehouseName(wh.name)
            if (effectiveSetup?.receiving.defaultReceivingLocationId) {
              setReceivingLocation(effectiveSetup.receiving.defaultReceivingLocationId)
            }
            const effectiveSetupSnap = {
              allowOverReceipt: Boolean(effectiveSetup?.general.allowOverReceipt),
              overReceiptTolerancePct: Number(
                effectiveSetup?.general.overReceiptTolerancePct ?? 0,
              ),
            }
            const autoInspect = effectiveSetup?.receiving.autoCreateInspection ?? true
            setInspectionRequired(autoInspect)
            setLines(linesFromPo(po, controls, effectiveSetupSnap, autoInspect))
          }
        }
        const nextNumber = await previewNextGoodsReceiptNumber().catch(() => null)
        if (nextNumber) setDocumentNumber(nextNumber)
        resetDirty()
      }
    } finally {
      setLoading(false)
    }
  }, [id, isNew, navigate, resetDirty, searchParams])

  useEffect(() => {
    void load()
  }, [load])

  const onSelectVendor = (nextVendorId: string) => {
    setVendorId(nextVendorId)
    markDirty()
    const currentPo = orders.find((o) => o.id === poId)
    if (currentPo && currentPo.vendor.id !== nextVendorId) {
      void onSelectPo('')
    }
  }

  const onSelectPo = async (nextPoId: string) => {
    setPoId(nextPoId)
    markDirty()
    if (!nextPoId) {
      setLines([])
      return
    }
    const [po, setup] = await Promise.all([
      getPurchaseOrderById(nextPoId),
      getPurchaseSetup().catch(() => null),
    ])
    if (!po) return
    setVendorId(po.vendor.id)
    if (setup) {
      setAllowExcess(Boolean(setup.general.allowOverReceipt))
      setSetupTolerancePct(Number(setup.general.overReceiptTolerancePct ?? 0))
    }
    const wh = warehouseFromPoDelivery(po, setup?.general.defaultWarehouseId)
    setWarehouseId(wh.id)
    setWarehouseName(wh.name)
    if (!receivingLocation && setup?.receiving.defaultReceivingLocationId) {
      setReceivingLocation(setup.receiving.defaultReceivingLocationId)
    }
    setLines(
      linesFromPo(po, itemControls, {
        allowOverReceipt: Boolean(setup?.general.allowOverReceipt ?? allowExcess),
        overReceiptTolerancePct: Number(
          setup?.general.overReceiptTolerancePct ?? setupTolerancePct,
        ),
      }, inspectionRequired),
    )
  }

  const updateLine = (index: number, patch: Partial<GrnLineDraft>) => {
    setLines((prev) => {
      const next = [...prev]
      const recalced = recalcGrnLineDraft(
        { ...next[index], ...patch },
        receiptSetup,
        inspectionRequired,
      )
      if ('receivingCondition' in patch && patch.receivingCondition) {
        recalced.receivingCondition = patch.receivingCondition
      }
      next[index] = recalced
      return next
    })
    markDirty()
  }

  const requestShortClose = (index: number, checked: boolean) => {
    if (!checked) {
      updateLine(index, { closeOpenQuantity: false, shortCloseReason: '' })
      return
    }
    setShortCloseLineIndex(index)
    setShortCloseReasonDraft(GRN_SHORT_CLOSE_REASONS[0].value)
    setShortCloseReasonOther('')
  }

  const confirmShortClose = () => {
    if (shortCloseLineIndex == null) return
    const reason =
      shortCloseReasonDraft === 'OTHER'
        ? shortCloseReasonOther.trim()
        : GRN_SHORT_CLOSE_REASONS.find((r) => r.value === shortCloseReasonDraft)?.label ??
          shortCloseReasonDraft
    updateLine(shortCloseLineIndex, {
      closeOpenQuantity: true,
      shortCloseReason: reason,
    })
    setShortCloseLineIndex(null)
  }

  const buildInput = (): GrnInput => ({
    purchaseOrderId: poId,
    documentDate,
    vendorChallanNumber,
    vendorChallanDate: vendorChallanDate || null,
    vehicleNo: vehicleNo || null,
    transporterName: transporterName || null,
    lrNumber: lrNumber || null,
    gateEntryNo: gateEntryNo || null,
    warehouseId,
    warehouseName,
    receivingLocation,
    receivedByName,
    inspectionRequired,
    allowExcess,
    remarks,
    // Create shows all open PO lines; only received / short-close rows are saved on the GRN.
    lines: lines.filter((l) => {
      const received = Number(l.receivedUomQty ?? l.receivedQty) || 0
      return received > 0 || Boolean(l.closeOpenQuantity)
    }).map((l) => ({
      purchaseOrderLineId: l.purchaseOrderLineId,
      receivedUomQty: Number(l.receivedUomQty ?? l.receivedQty) || 0,
      receivedQty: Number(l.receivedQty) || 0,
      acceptedQty: Number(l.acceptedQty) || 0,
      rejectedQty: Number(l.rejectedQty) || 0,
      shortQty: Number(l.shortQty) || 0,
      excessQty: Number(l.excessQty) || 0,
      damagedQty: Number(l.damagedQty) || 0,
      receivedWeight: l.receivedWeight,
      closeOpenQuantity: Boolean(l.closeOpenQuantity),
      shortCloseRequested: Boolean(l.closeOpenQuantity),
      shortCloseReason: l.shortCloseReason || null,
      receivingCondition: l.receivingCondition,
      receivingConditionReason: l.receivingConditionReason || null,
      batchNumber: l.batchNumber,
      lotNumber: l.lotNumber,
      serialNumber: l.serialNumber,
      manufacturingDate: l.manufacturingDate || null,
      expiryDate: l.expiryDate || null,
      warehouseId: l.warehouseId || warehouseId,
      warehouseName: l.warehouseName || warehouseName,
      binId: l.binId ?? null,
      bin: l.bin,
      allowExcess: l.allowExcess || allowExcess,
      remarks: l.remarks,
    })),
  })

  /** Returns the first clear, user-facing message (or null when valid). */
  const validateClient = (): string | null => {
    const errs: Record<string, string> = {}
    const messages: string[] = []

    const push = (key: string, message: string) => {
      errs[key] = message
      messages.push(message)
    }

    if (!poId) push('poId', 'Please select a purchase order.')
    if (!vendorId) push('vendorId', 'Please select a vendor.')
    if (!warehouseId.trim()) push('warehouseId', 'Please select a warehouse.')
    if (!lines.length) push('lines', 'Add at least one open PO line to receive.')
    const includedLines = lines.filter((l) => {
      const received = Number(l.receivedUomQty ?? l.receivedQty) || 0
      return received > 0 || Boolean(l.closeOpenQuantity)
    })
    if (lines.length && !includedLines.length) {
      push(
        'lines',
        'Enter received quantity on at least one line (unused PO lines stay open for a later GRN).',
      )
    }

    lines.forEach((l, i) => {
      const itemLabel = (l.itemCode || l.itemName || `Line ${i + 1}`).trim()
      const received = Number(l.receivedUomQty ?? l.receivedQty) || 0
      const open = Math.max(0, Number(l.pendingUomQty ?? l.pendingQty) || 0)
      if (received <= 0 && !l.closeOpenQuantity) {
        // Idle open PO row — not part of this GRN; skip per-line receive checks.
        return
      }
      if (received < 0) {
        push(`line-${i}-qty`, `Received quantity cannot be negative for ${itemLabel}.`)
      }
      // Hard max = open PO qty + item/setup over-receipt tolerance (never save beyond band).
      const tol = evaluateGrnLineTolerance({
        openQuantity: open,
        receivedQuantity: received,
        itemTolerancePct: l.quantityTolerancePct,
        setupTolerancePct,
        allowOverReceipt: allowExcess || l.allowExcess,
      })
      if (received > tol.upperBound + 1e-9) {
        const maxLabel = Number(tol.upperBound.toFixed(4))
        push(
          `line-${i}-excess`,
          `Received quantity (${received}) for ${itemLabel} exceeds maximum allowed (${maxLabel}). ` +
            `Open PO quantity is ${open}` +
            (tol.tolerancePercentage > 0
              ? ` with over-receipt tolerance ${tol.tolerancePercentage}%.`
              : ' (no over-receipt tolerance).'),
        )
      }
      if (l.batchControlled && received > 0 && !l.batchNumber.trim()) {
        push(`line-${i}-batch`, `Batch number is required for ${itemLabel}.`)
      }
      if (l.serialControlled && received > 0 && !l.serialNumber.trim()) {
        push(`line-${i}-serial`, `Serial number is required for ${itemLabel}.`)
      }
      if (l.expiryControlled && received > 0 && !l.expiryDate) {
        push(`line-${i}-expiry`, `Expiry date is required for ${itemLabel}.`)
      }
    })

    setFieldErrors(errs)
    return messages[0] ?? null
  }

  const saveDraft = async () => {
    if (saving) return
    const firstError = validateClient()
    if (firstError) {
      notify.error(firstError)
      return
    }
    setSaving(true)
    try {
      const input = buildInput()
      if (recordId) {
        const updated = await updateGRN(recordId, input)
        setDocumentNumber(updated.documentNumber)
        setStatus(updated.status)
        setLines(linesFromGrn(updated, itemControls, receiptSetup, inspectionRequired))
        notify.success(`Saved · ${updated.documentNumber}`)
      } else {
        const created = await createGRNFromPo(input)
        setRecordId(created.id)
        setDocumentNumber(created.documentNumber)
        setStatus(created.status)
        setLines(linesFromGrn(created, itemControls, receiptSetup, inspectionRequired))
        notify.success(`Saved · ${created.documentNumber}`)
      }
      resetDirty()
      navigate(PURCHASE_FORM_ROUTES.grn.list, { replace: true })
    } catch (err) {
      if (err instanceof PurchaseServiceError && err.code === 'EXCESS_QTY_REQUIRES_PERMISSION') {
        const ok = await systemConfirm({
          title: 'Allow excess receipt?',
          description: `${err.message}\n\nAllow excess receipt for this GRN?`,
          confirmLabel: 'Allow excess',
          cancelLabel: 'Cancel',
          variant: 'danger',
        })
        if (ok) {
          setAllowExcess(true)
          setLines((prev) => prev.map((l) => ({ ...l, allowExcess: true })))
          notify.info('Allow Excess enabled — save again to confirm')
        }
      } else if (err instanceof PurchaseServiceError && err.code === 'GRN_QTY_EXCEEDS') {
        notify.error(err.message)
      } else {
        notify.error(err instanceof PurchaseServiceError ? err.message : 'Save failed')
      }
    } finally {
      setSaving(false)
    }
  }

  const breadcrumbs = [
    { label: 'Goods Receipts', to: '/purchase/grn' },
    { label: isNew ? 'New' : documentNumber ?? 'Edit' },
  ]

  const validationErrorList = useMemo(() => Object.values(fieldErrors), [fieldErrors])
  const validationItems = useMemo(
    () =>
      validationErrorList.map((message, i) => ({
        id: `grn-err-${i}`,
        label: message,
        message: 'Required',
      })),
    [validationErrorList],
  )

  if (loading) {
    return (
      <PurchaseCardFormShell
        title="Goods Receipt Note"
        description="Loading…"
        status="Draft"
        favoritePath="/purchase/grn/new"
        breadcrumbs={[
          { label: 'Goods Receipts', to: '/purchase/grn' },
          { label: 'Loading' },
        ]}
        footer={null}
      >
        <LoadingState variant="form" rows={8} />
      </PurchaseCardFormShell>
    )
  }

  return (
    <PurchaseCardFormShell
      title={isNew ? 'New Goods Receipt Note' : `Edit ${documentNumber ?? 'GRN'}`}
      description="Receive against a released purchase order with open quantity"
      className="purchase-order-editor--scrollbar-hidden"
      recordNo={documentNumber ?? (isNew ? 'New' : undefined)}
      recordTitle={documentTitle}
      status={statusLabel}
      statusTone={purchaseStatusTone(status)}
      statusKey={status}
      recordHeaderFacts={recordHeaderFacts}
      favoritePath={recordId ? `/purchase/grn/${recordId}/edit` : '/purchase/grn/new'}
      breadcrumbs={breadcrumbs}
      factBox={documentFactBox}
      collapsibleFactBox
      commandBar={null}
      validationTitle={
        validationErrorList.length ? 'Goods Receipt cannot be saved.' : undefined
      }
      validationErrors={validationErrorList}
      validationItems={validationErrorList.length ? validationItems : undefined}
      stickyFooter
      footer={
        <FormActionBar
          sticky
          cancelFirst
          busy={saving}
          dirty={dirty}
          onCancel={() => {
            resetDirty()
            navigate(PURCHASE_FORM_ROUTES.grn.list)
          }}
          onSave={saveDraft}
        />
      }
      onSaveShortcut={() => void saveDraft()}
    >
      <div className="space-y-3">
      {showPoPicker ? (
        <ErpCardSection
          id={purchaseSectionId('po-source')}
          title="PO Source"
          subtitle="Select vendor, then a released PO with open quantity"
          icon={ClipboardList}
          accent="slate"
          collapsible
          defaultOpen
          dense
          columns={1}
        >
          <ErpFormSpan span={1}>
            <p className="mb-2 text-[12px] text-erp-muted">
              Choose the <strong>vendor</strong> first, then pick a PO that is{' '}
              <strong>Sent to Vendor / Released</strong> (or partially received) with open quantity.
              Header warehouse defaults from the PO delivery location.
            </p>
            {receivableOrders.length === 0 ? (
              <div className="space-y-2 text-[13px] text-erp-muted">
                <p>
                  No receivable purchase orders.{' '}
                  <Link to="/purchase/orders" className="text-erp-primary underline">
                    Open Purchase Orders
                  </Link>
                </p>
                {approvedNotReleasedOrders.length > 0 ? (
                  <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-950">
                    {approvedNotReleasedOrders.length} approved PO
                    {approvedNotReleasedOrders.length === 1 ? '' : 's'} with open qty
                    {approvedNotReleasedOrders.length <= 3
                      ? ` (${approvedNotReleasedOrders.map((o) => o.documentNumber).join(', ')})`
                      : ''}{' '}
                    — open the PO and use <strong>Send to Vendor</strong>, then create the GRN.
                  </p>
                ) : null}
              </div>
            ) : (
              <>
                <div className="grn-po-source-row">
                  <ErpFieldRow
                    label="Vendor"
                    required
                    fieldError={fieldErrors.vendorId}
                    fieldState={fieldErrors.vendorId ? 'error' : 'idle'}
                  >
                    <ErpSmartSelect
                      className="w-full"
                      options={vendorSelectOptions}
                      value={vendorId}
                      disabled={readOnlyHeaderPo}
                      onChange={(v) => onSelectVendor(v || '')}
                      allowEmpty
                      placeholder={SELECT_PLACEHOLDER}
                      appearance="combo"
                      dropdownMinWidth={320}
                    />
                  </ErpFieldRow>
                  <ErpFieldRow
                    label="Purchase Order"
                    required
                    fieldError={fieldErrors.poId}
                    fieldState={fieldErrors.poId ? 'error' : 'idle'}
                  >
                    <ErpSmartSelect
                      className="w-full"
                      options={poSelectOptions}
                      value={poId}
                      disabled={readOnlyHeaderPo || !vendorId}
                      onChange={(v) => void onSelectPo(v || '')}
                      allowEmpty
                      placeholder={vendorId ? 'Search PO number…' : 'Select vendor first…'}
                      emptyMessage={vendorId ? 'No receivable POs for this vendor' : 'Select a vendor first'}
                      appearance="combo"
                      dropdownMinWidth={360}
                      resolveOrphanLabel={(id) => orders.find((o) => o.id === id)?.documentNumber}
                    />
                  </ErpFieldRow>
                </div>
                {vendorId && vendorApprovedNotReleased.length > 0 ? (
                  <p className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-950">
                    {vendorApprovedNotReleased.length} approved PO
                    {vendorApprovedNotReleased.length === 1 ? '' : 's'} for this vendor still need{' '}
                    <strong>Send to Vendor</strong>
                    {vendorApprovedNotReleased.length <= 3
                      ? `: ${vendorApprovedNotReleased.map((o) => o.documentNumber).join(', ')}`
                      : ''}
                    . Only released POs appear in the list below.
                  </p>
                ) : null}
              </>
            )}
          </ErpFormSpan>
        </ErpCardSection>
      ) : null}

      <ErpCardSection
        id={purchaseSectionId('document')}
        title="Receipt & Vendor"
        subtitle="GRN date, vendor, and challan references"
        icon={FileText}
        accent="blue"
        collapsible
        defaultOpen
        dense
        columns={6}
      >
        <ErpFieldRow label="GRN Date" required>
          <Input
            type="date"
            value={documentDate}
            onChange={(e) => {
              setDocumentDate(e.target.value)
              markDirty()
            }}
          />
        </ErpFieldRow>
        {!showPoPicker ? (
          <ErpFieldRow label="Purchase Order" readOnly>
            <Input
              value={selectedPo ? `${selectedPo.documentNumber} — ${selectedPo.vendor.name}` : '—'}
              readOnly
              className="bg-erp-surface-alt"
            />
          </ErpFieldRow>
        ) : null}
        <ErpFieldRow label="Vendor" readOnly>
          <Input value={selectedPo?.vendor.name ?? '—'} readOnly className="bg-erp-surface-alt" />
        </ErpFieldRow>
        <ErpFieldRow label="Vendor Challan Number">
          <Input
            value={vendorChallanNumber}
            onChange={(e) => {
              setVendorChallanNumber(e.target.value)
              markDirty()
            }}
          />
        </ErpFieldRow>
        <ErpFieldRow label="Vendor Challan Date">
          <Input
            type="date"
            value={vendorChallanDate}
            onChange={(e) => {
              setVendorChallanDate(e.target.value)
              markDirty()
            }}
          />
        </ErpFieldRow>

        <ErpFormSpan span={3} className="erp-po-advanced-details">
          <button
            type="button"
            className="erp-po-advanced-details__toggle"
            onClick={() => setShowAdvancedDetails((open) => !open)}
            aria-expanded={showAdvancedDetails}
            aria-controls={
              showAdvancedDetails ? purchaseSectionId('advanced') : undefined
            }
          >
            {showAdvancedDetails ? (
              <ChevronDown className="erp-po-advanced-details__chevron" aria-hidden />
            ) : (
              <ChevronRight className="erp-po-advanced-details__chevron" aria-hidden />
            )}
            <span>
              {showAdvancedDetails
                ? 'Hide advanced details'
                : 'Show advanced details · number and status'}
            </span>
          </button>
          {showAdvancedDetails ? (
            <div
              id={purchaseSectionId('advanced')}
              className="erp-po-advanced-details__panel"
              role="region"
              aria-label="Advanced details"
            >
              <div className="erp-card-section__grid erp-card-section__grid--dense erp-card-section__grid--cols-6">
                <ErpFieldRow
                  label="GRN Number"
                  readOnly
                  hint={isNew ? 'Preview from number series — assigned when you save' : undefined}
                >
                  <Input
                    value={documentNumber ?? ''}
                    placeholder="Loading number…"
                    readOnly
                    className="bg-erp-surface-alt"
                  />
                </ErpFieldRow>
                <ErpFieldRow label="Status" readOnly hint="Lifecycle status — not editable on the form">
                  <div className="flex min-h-9 items-center">
                    <PurchaseStatusChip status={status} kind="grn" />
                  </div>
                </ErpFieldRow>
              </div>
            </div>
          ) : null}
        </ErpFormSpan>
      </ErpCardSection>

      <ErpCardSection
        id={purchaseSectionId('receiving')}
        title="Receiving"
        subtitle="Warehouse, gate entry, transport, and QC flags"
        collapsedSummary={receivingPeek || undefined}
        icon={Truck}
        accent="green"
        collapsible
        defaultOpen
        dense
        columns={6}
      >
        <ErpFormSpan span={3}>
          <p className="erp-field-group__label">Location</p>
        </ErpFormSpan>
        <ErpFieldRow
          label="Warehouse"
          required
          fieldError={fieldErrors.warehouseId}
          fieldState={fieldErrors.warehouseId ? 'error' : 'idle'}
        >
          <Select
            value={warehouseId}
            onChange={(e) => {
              const wh = warehouses.find((w) => w.id === e.target.value)
              setWarehouseId(wh?.id ?? '')
              setWarehouseName(wh?.warehouseName ?? '')
              setReceivingLocation('')
              markDirty()
            }}
          >
            <option value="">{SELECT_PLACEHOLDER}</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.warehouseCode} — {w.warehouseName}
              </option>
            ))}
          </Select>
        </ErpFieldRow>
        <ErpFieldRow label="Receiving Location">
          <Select
            value={receivingLocation}
            onChange={(e) => {
              setReceivingLocation(e.target.value)
              markDirty()
            }}
            disabled={!warehouseId}
          >
            <option value="">{SELECT_PLACEHOLDER}</option>
            {warehouseLocations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.locationCode} — {l.locationName}
              </option>
            ))}
          </Select>
        </ErpFieldRow>
        <ErpFieldRow label="Received By">
          <Input
            value={receivedByName}
            onChange={(e) => {
              setReceivedByName(e.target.value)
              markDirty()
            }}
          />
        </ErpFieldRow>
        <ErpFieldRow label="Gate Entry Number">
          <Input
            value={gateEntryNo}
            onChange={(e) => {
              setGateEntryNo(e.target.value)
              markDirty()
            }}
          />
        </ErpFieldRow>

        <ErpFormSpan span={3}>
          <p className="erp-field-group__label mt-2">Transport</p>
        </ErpFormSpan>
        <ErpFieldRow label="Vehicle Number">
          <Input
            value={vehicleNo}
            onChange={(e) => {
              setVehicleNo(e.target.value)
              markDirty()
            }}
          />
        </ErpFieldRow>
        <ErpFieldRow label="Transporter">
          <Input
            value={transporterName}
            onChange={(e) => {
              setTransporterName(e.target.value)
              markDirty()
            }}
          />
        </ErpFieldRow>
        <ErpFieldRow label="LR Number">
          <Input
            value={lrNumber}
            onChange={(e) => {
              setLrNumber(e.target.value)
              markDirty()
            }}
          />
        </ErpFieldRow>

        <ErpFormSpan span={3}>
          <p className="erp-field-group__label mt-2">QC / Excess</p>
        </ErpFormSpan>
        <ErpFieldRow label="Inspection Required">
          <label className="flex min-h-9 items-center gap-2 text-[13px] text-erp-text">
            <input
              type="checkbox"
              checked={inspectionRequired}
              onChange={(e) => {
                setInspectionRequired(e.target.checked)
                markDirty()
              }}
            />
            QC before post
          </label>
        </ErpFieldRow>
        <ErpFieldRow label="Allow Excess">
          <label className="flex min-h-9 items-center gap-2 text-[13px] text-erp-text">
            <input
              type="checkbox"
              checked={allowExcess}
              onChange={(e) => {
                setAllowExcess(e.target.checked)
                markDirty()
              }}
            />
            Permit qty above pending
          </label>
        </ErpFieldRow>
        {warehouseName ? (
          <ErpFormSpan span={3}>
            <p className="flex items-center gap-1.5 text-[12px] text-erp-muted">
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Receiving into {warehouseName}
              {receivingLocationLabel ? ` · ${receivingLocationLabel}` : ''}
            </p>
          </ErpFormSpan>
        ) : null}
      </ErpCardSection>

      <ErpCardSection
        id={purchaseSectionId('lines')}
        title="Item Lines"
        subtitle="Receive quantities against open PO lines"
        collapsedSummary={linesPeek || undefined}
        icon={Package}
        accent="teal"
        collapsible
        defaultOpen
        dense
        columns={1}
        className="purchase-doc-lines-section ring-1 ring-teal-200/70 shadow-sm"
        badge={
          <span className="text-[11px] tabular-nums text-erp-muted">
            {lineTotals.lineCount} line{lineTotals.lineCount === 1 ? '' : 's'}
          </span>
        }
      >
        <div className="min-w-0 max-w-full">
        {fieldErrors.lines ? (
          <p className="mb-2 text-[12px] text-erp-danger-fg">{fieldErrors.lines}</p>
        ) : (
          <div className="mb-2 space-y-2 text-[12px] text-erp-muted">
            <p>{GRN_LINES_RECEIVING_GUIDE.intro}</p>
            <details className="rounded border border-erp-border bg-erp-surface-alt px-3 py-2">
              <summary className="cursor-pointer font-medium text-erp-text">
                Short, excess, damage &amp; accepted/rejected — what each means
              </summary>
              <dl className="mt-2 space-y-2 border-t border-erp-border pt-2">
                {GRN_LINES_RECEIVING_GUIDE.columns.map((row) => (
                  <div key={row.term}>
                    <dt className="font-medium text-erp-text">{row.term}</dt>
                    <dd className="text-[11px] leading-snug text-erp-muted">{row.meaning}</dd>
                  </div>
                ))}
              </dl>
            </details>
            <p className="text-[11px]">
              Enter qty in the <strong>vendor/purchase unit</strong> (Receive UOM). Weight columns
              appear for casting items. Leave Receive Qty blank / 0 for not received (line stays open
              on the PO).
            </p>
            {lineTotals.requiresToleranceApproval ? (
              <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-950">
                One or more lines exceed quantity or weight tolerance — saving/submitting will route
                this GRN for <strong>approval</strong> before inventory posting.
              </p>
            ) : null}
            {lineTotals.remainingOpenQty > 0 ||
            lineTotals.notReceivedCount > 0 ||
            lineTotals.partialCount > 0 ||
            lineTotals.outsideCount > 0 ? (
              <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-950">
                Pending after this receipt: {formatNumber(lineTotals.remainingOpenQty)} open qty
                {lineTotals.notReceivedCount
                  ? ` · ${lineTotals.notReceivedCount} not received`
                  : ''}
                {lineTotals.partialCount ? ` · ${lineTotals.partialCount} partial` : ''}
                {lineTotals.outsideCount
                  ? ` · ${lineTotals.outsideCount} outside tolerance (approval)`
                  : ''}
              </p>
            ) : null}
          </div>
        )}
        <div className="purchase-doc-lines-grid-scroll relative rounded-md border border-erp-border">
          <table className="erp-table purchase-doc-lines-grid grn-lines-grid w-max min-w-full text-left text-[12px]">
            <thead>
              <tr>
                <th className="purchase-doc-lines-grid__sticky-item">Item</th>
                <th className="num">PO Qty</th>
                <th className="num">Prev. Recd</th>
                <th className="num">Pending</th>
                <th className="num grn-lines-grid__receive-qty-col" title={GRN_LINES_RECEIVING_GUIDE.columns[0].meaning}>
                  Receive Qty
                </th>
                <th className="purchase-doc-lines-grid__uom-col" title="Vendor / purchase unit">
                  Receive UOM
                </th>
                <th
                  className="num grn-lines-grid__accepted-col"
                  title={GRN_LINES_RECEIVING_GUIDE.columns[1].meaning}
                >
                  Accepted
                  <span className="block text-[10px] font-normal text-erp-muted">(stock UOM)</span>
                </th>
                <th
                  className="num"
                  title={GRN_LINES_RECEIVING_GUIDE.columns[2].meaning}
                >
                  Rejected
                  <span className="block text-[10px] font-normal text-erp-muted">(stock UOM · set by QC if required)</span>
                </th>
                {showWeightCol ? <th className="num">Weight</th> : null}
                <th className="num">Qty Tol %</th>
                {showWeightCol ? <th className="num">Wt Tol %</th> : null}
                <th className="num" title={GRN_LINES_RECEIVING_GUIDE.columns[6].meaning}>
                  Var %
                </th>
                <th title="Why qty differs from PO — not the same as tolerance %">
                  Condition
                  <span className="block text-[10px] font-normal text-erp-muted">Short / Excess / Dmg</span>
                </th>
                <th title="Tolerance result on quantity (and weight when applicable)">Status</th>
                <th title={GRN_LINES_RECEIVING_GUIDE.columns[7].meaning}>Close open</th>
                {showBatchSerialCol ? <th>Batch / Lot / Serial</th> : null}
                {showExpiryCol ? <th>Mfg / Expiry</th> : null}
                <th>Bin</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={l.purchaseOrderLineId} className="align-top">
                  <td className="purchase-doc-lines-grid__sticky-item">
                    <div className="font-mono text-[11px]">{l.itemCode}</div>
                    <div className="leading-snug">{l.itemName}</div>
                  </td>
                  <td className="num">
                    {(() => {
                      const dual = purchaseLineHasDualUom({
                        itemId: l.itemId,
                        uomConversionFactor: l.uomConversionFactor,
                      })
                      const uomQty = Number(l.orderedUomQty) || Number(l.orderedQty) || 0
                      return (
                        <>
                          <span className="tabular-nums">{formatNumber(uomQty)}</span>
                          {dual && l.baseUom ? (
                            <p className="mt-1 text-[10px] tabular-nums text-erp-muted">
                              {formatPurchaseQty(Number(l.orderedQty) || 0)} {l.baseUom}
                            </p>
                          ) : null}
                        </>
                      )
                    })()}
                  </td>
                  <td className="num">
                    {(() => {
                      const dual = purchaseLineHasDualUom({
                        itemId: l.itemId,
                        uomConversionFactor: l.uomConversionFactor,
                      })
                      const factor = Number(l.uomConversionFactor) || 1
                      const prevBase = Number(l.previouslyReceivedQty) || 0
                      const prevUom = toUomQuantityFromBase(prevBase, factor)
                      return (
                        <>
                          <span className="tabular-nums">{formatNumber(prevUom)}</span>
                          {dual && l.baseUom ? (
                            <p className="mt-1 text-[10px] tabular-nums text-erp-muted">
                              {formatPurchaseQty(prevBase)} {l.baseUom}
                            </p>
                          ) : null}
                        </>
                      )
                    })()}
                  </td>
                  <td className="num">
                    {(() => {
                      const dual = purchaseLineHasDualUom({
                        itemId: l.itemId,
                        uomConversionFactor: l.uomConversionFactor,
                      })
                      const pendingUom =
                        Number(l.pendingUomQty) || Number(l.pendingQty) || 0
                      return (
                        <>
                          <span className="tabular-nums">{formatNumber(pendingUom)}</span>
                          {dual && l.baseUom ? (
                            <p className="mt-1 text-[10px] tabular-nums text-erp-muted">
                              {formatPurchaseQty(Number(l.pendingQty) || 0)} {l.baseUom}
                            </p>
                          ) : null}
                        </>
                      )
                    })()}
                  </td>
                  <td className="num grn-lines-grid__received-col">
                    {(() => {
                      const qtyError =
                        fieldErrors[`line-${i}-qty`] || fieldErrors[`line-${i}-excess`]
                      return (
                        <div className="grn-received-cell">
                          <DecimalInput
                            className="grn-received-cell__input"
                            min={0}
                            blankZero
                            placeholder="Enter qty"
                            value={Number(l.receivedUomQty ?? l.receivedQty) || 0}
                            onChange={(v) => {
                              const factor = Number(l.uomConversionFactor) || 1
                              updateLine(i, {
                                receivedUomQty: v,
                                receivedQty: purchaseQtyToBaseQty(v, factor),
                              })
                            }}
                          />
                          {qtyError ? (
                            <p className="grn-received-cell__error">{qtyError}</p>
                          ) : null}
                        </div>
                      )
                    })()}
                  </td>
                  <td className="purchase-doc-lines-grid__uom-col text-[11px] font-semibold uppercase">
                    {l.uom || '—'}
                  </td>
                  <td className="num grn-lines-grid__accepted-col">
                    <DecimalInput
                      className="w-20"
                      min={0}
                      value={Number(l.acceptedQty) || 0}
                      disabled={l.qcRequired || inspectionRequired}
                      title={
                        l.qcRequired || inspectionRequired
                          ? 'Determined by Quality Inspection after receiving — not editable here'
                          : undefined
                      }
                      onChange={(v) => updateLine(i, { acceptedQty: v })}
                    />
                    {l.qcRequired || inspectionRequired ? (
                      <p className="mt-1 text-[10px] text-erp-muted">Set by QC</p>
                    ) : l.baseUom ? (
                      <p className="mt-1 text-[10px] uppercase text-erp-muted">{l.baseUom}</p>
                    ) : null}
                  </td>
                  <td className="num">
                    <DecimalInput
                      className="w-20"
                      min={0}
                      value={Number(l.rejectedQty) || 0}
                      disabled={l.qcRequired || inspectionRequired}
                      title={
                        l.qcRequired || inspectionRequired
                          ? 'Determined by Quality Inspection after receiving — not editable here'
                          : undefined
                      }
                      onChange={(v) =>
                        updateLine(i, {
                          rejectedQty: v,
                          damagedQty: v,
                          receivingCondition: v > 0 ? 'DAMAGE' : l.receivingCondition,
                        })
                      }
                    />
                    {l.qcRequired || inspectionRequired ? (
                      <p className="mt-1 text-[10px] text-erp-muted">Set by QC</p>
                    ) : l.baseUom ? (
                      <p className="mt-1 text-[10px] uppercase text-erp-muted">{l.baseUom}</p>
                    ) : null}
                  </td>
                  {showWeightCol ? (
                    <td className="num">
                      {l.receiptEntryMode === 'UNIT_ONLY' ? (
                        '—'
                      ) : (
                        <>
                          <DecimalInput
                            className="w-24"
                            min={0}
                            value={Number(l.receivedWeight) || 0}
                            onChange={(v) => updateLine(i, { receivedWeight: v })}
                          />
                          {l.expectedWeight != null ? (
                            <p className="mt-1 text-[10px] text-erp-muted">
                              Exp {formatNumber(l.expectedWeight)}
                              {l.weightUomCode ? ` ${l.weightUomCode}` : ''}
                            </p>
                          ) : null}
                        </>
                      )}
                    </td>
                  ) : null}
                  <td className="num">{formatNumber(l.quantityTolerancePct)}</td>
                  {showWeightCol ? (
                    <td className="num">{formatNumber(l.weightTolerancePct)}</td>
                  ) : null}
                  <td className="num">
                    {l.variancePercentage == null ? '—' : `${formatNumber(l.variancePercentage)}%`}
                    {l.weightVariancePercentage != null ? (
                      <p className="text-[10px] text-erp-muted">
                        Wt {formatNumber(l.weightVariancePercentage)}%
                      </p>
                    ) : null}
                  </td>
                  <td>
                    <Select
                      className="min-w-[8.5rem] text-[11px]"
                      value={l.receivingCondition}
                      title={GRN_RECEIVING_CONDITION_DESCRIPTIONS[l.receivingCondition]}
                      onChange={(e) =>
                        updateLine(i, {
                          receivingCondition: e.target.value as GrnLineDraft['receivingCondition'],
                        })
                      }
                    >
                      {(Object.keys(GRN_RECEIVING_CONDITION_LABELS) as GrnReceivingCondition[]).map(
                        (value) => (
                          <option key={value} value={value} title={GRN_RECEIVING_CONDITION_DESCRIPTIONS[value]}>
                            {GRN_RECEIVING_CONDITION_LABELS[value]}
                          </option>
                        ),
                      )}
                    </Select>
                    <p className="mt-1 max-w-[9rem] text-[10px] leading-snug text-erp-muted">
                      {GRN_RECEIVING_CONDITION_DESCRIPTIONS[l.receivingCondition]}
                    </p>
                  </td>
                  <td>
                    {GRN_TOLERANCE_STATUS_LABELS[
                      l.toleranceStatus as keyof typeof GRN_TOLERANCE_STATUS_LABELS
                    ] ?? l.toleranceStatus}
                    {l.weightToleranceStatus &&
                    l.weightToleranceStatus !== 'NOT_APPLICABLE' ? (
                      <p className="text-[10px] text-erp-muted">Wt: {l.weightToleranceStatus}</p>
                    ) : null}
                  </td>
                  <td>
                    <label className="inline-flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={l.closeOpenQuantity}
                        disabled={(Number(l.receivedQty) || 0) <= 0 && !l.closeOpenQuantity}
                        onChange={(e) => requestShortClose(i, e.target.checked)}
                      />
                      <span className="text-[11px] text-erp-muted">Close</span>
                    </label>
                    {l.shortCloseReason ? (
                      <p className="mt-1 text-[10px] text-erp-muted">{l.shortCloseReason}</p>
                    ) : null}
                  </td>
                  {showBatchSerialCol ? (
                    <td>
                      {l.batchControlled ? (
                        <Input
                          className="mb-1 w-36"
                          placeholder="Batch"
                          value={l.batchNumber}
                          onChange={(e) => updateLine(i, { batchNumber: e.target.value })}
                        />
                      ) : null}
                      {l.batchControlled ? (
                        <Input
                          className="mb-1 w-36"
                          placeholder="Lot"
                          value={l.lotNumber}
                          onChange={(e) => updateLine(i, { lotNumber: e.target.value })}
                        />
                      ) : null}
                      {l.serialControlled ? (
                        <Input
                          className="w-36"
                          placeholder="Serial"
                          value={l.serialNumber}
                          onChange={(e) => updateLine(i, { serialNumber: e.target.value })}
                        />
                      ) : null}
                      {!l.batchControlled && !l.serialControlled ? (
                        <span className="text-[11px] text-erp-muted">—</span>
                      ) : null}
                      {fieldErrors[`line-${i}-batch`] || fieldErrors[`line-${i}-serial`] ? (
                        <p className="mt-1 text-xs text-erp-danger-fg">
                          {fieldErrors[`line-${i}-batch`] || fieldErrors[`line-${i}-serial`]}
                        </p>
                      ) : null}
                    </td>
                  ) : null}
                  {showExpiryCol ? (
                    <td>
                      <Input
                        type="date"
                        className="mb-1 w-36"
                        value={l.manufacturingDate}
                        onChange={(e) => updateLine(i, { manufacturingDate: e.target.value })}
                      />
                      <Input
                        type="date"
                        className="w-36"
                        value={l.expiryDate}
                        onChange={(e) => updateLine(i, { expiryDate: e.target.value })}
                      />
                      {fieldErrors[`line-${i}-expiry`] ? (
                        <p className="mt-1 text-xs text-erp-danger-fg">{fieldErrors[`line-${i}-expiry`]}</p>
                      ) : null}
                    </td>
                  ) : null}
                  <td>
                    {(() => {
                      const resolvedBinId =
                        l.binId ||
                        (l.bin
                          ? warehouseBins.find(
                              (b) =>
                                b.code.localeCompare(l.bin, undefined, { sensitivity: 'accent' }) ===
                                0,
                            )?.id
                          : undefined) ||
                        ''
                      return (
                        <>
                          <Select
                            className="min-w-[7rem] text-[11px]"
                            value={resolvedBinId}
                            onChange={(e) => {
                              const nextBinId = e.target.value || null
                              const bin = warehouseBins.find((b) => b.id === nextBinId)
                              updateLine(i, { binId: nextBinId, bin: bin?.code ?? '' })
                            }}
                            title={
                              !warehouseBins.length
                                ? 'Create bins under Masters → BIN or Inventory setup'
                                : undefined
                            }
                          >
                            <option value="">{SELECT_PLACEHOLDER}</option>
                            {warehouseBins.map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.code}
                              </option>
                            ))}
                            {resolvedBinId &&
                            !warehouseBins.some((b) => b.id === resolvedBinId) &&
                            l.bin ? (
                              <option value={resolvedBinId}>{l.bin}</option>
                            ) : null}
                          </Select>
                          {!warehouseBins.length ? (
                            <p className="mt-1 text-[10px] text-erp-muted">
                              {warehouseId
                                ? 'No bins for this warehouse — add BIN master for the delivery warehouse'
                                : 'Select warehouse / PO first'}
                            </p>
                          ) : null}
                        </>
                      )
                    })()}
                  </td>
                  <td>
                    <Input
                      className="w-32"
                      value={l.remarks}
                      onChange={(e) => updateLine(i, { remarks: e.target.value })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!lines.length ? (
            <p className="p-4 text-sm text-erp-muted">
              Select a PO with open quantity, or{' '}
              <Link to="/purchase/orders" className="text-erp-primary underline">
                open Purchase Orders
              </Link>
              .
            </p>
          ) : null}
        </div>
        </div>
      </ErpCardSection>

      <ErpCardSection
        id={purchaseSectionId('notes')}
        title="Notes"
        subtitle="Receiving remarks and QC context"
        collapsedSummary={notesPeek || undefined}
        icon={StickyNote}
        accent="slate"
        collapsible
        defaultOpen={false}
        dense
        columns={1}
      >
        <ErpFieldRow label="Remarks" horizontal={false}>
          <Textarea
            value={remarks}
            onChange={(e) => {
              setRemarks(e.target.value)
              markDirty()
            }}
            rows={4}
            placeholder="Gate notes, discrepancy context, QC instructions…"
          />
        </ErpFieldRow>
      </ErpCardSection>
      </div>

      {shortCloseLineIndex != null ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg border border-erp-border bg-white p-4 shadow-lg">
            <h3 className="text-sm font-semibold text-erp-text">Close open quantity</h3>
            <p className="mt-1 text-[12px] text-erp-muted">
              Remaining PO quantity will not be expected. Select a reason — may require Purchase
              Manager approval.
            </p>
            <div className="mt-3 space-y-2">
              <Select
                value={shortCloseReasonDraft}
                onChange={(e) => setShortCloseReasonDraft(e.target.value)}
              >
                {GRN_SHORT_CLOSE_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </Select>
              {shortCloseReasonDraft === 'OTHER' ? (
                <Input
                  placeholder="Reason details"
                  value={shortCloseReasonOther}
                  onChange={(e) => setShortCloseReasonOther(e.target.value)}
                />
              ) : null}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="erp-btn erp-btn--secondary"
                onClick={() => setShortCloseLineIndex(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="erp-btn erp-btn--primary"
                onClick={confirmShortClose}
                disabled={shortCloseReasonDraft === 'OTHER' && !shortCloseReasonOther.trim()}
              >
                Confirm close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </PurchaseCardFormShell>
  )
}
