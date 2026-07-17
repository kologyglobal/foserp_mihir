import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ClipboardList,
  FileText,
  MapPin,
  PackageCheck,
  Save,
  Send,
  StickyNote,
  Truck,
} from 'lucide-react'
import { PurchaseCardFormShell } from '@/components/purchase/PurchaseCardFormShell'
import {
  PurchaseFormSectionNav,
  purchaseSectionId,
} from '@/components/purchase/PurchaseEnterpriseFormKit'
import {
  PurchaseDocumentFactBox,
  buildPurchaseRelatedLinks,
  purchaseDocumentApprovalFact,
} from '@/components/purchase/PurchaseDocumentFactBox'
import { purchaseStatusTone } from '@/components/purchase/purchaseCardFormShared'
import { ErpCardSection, ErpFieldRow, ErpFormSpan, ErpStickySaveBar } from '@/components/erp/card-form'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { ErpButton, ErpButtonGroup } from '@/components/erp/ErpButton'
import { Input, Select, Textarea } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EnterpriseFormMetrics } from '@/design-system/workspace'
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
  PurchaseServiceError,
  submitGRN,
  updateGRN,
  GRN_DOMAIN_STATUS_LABELS,
} from '@/services/purchase'
import type { GoodsReceiptNote, GrnInput, PurchaseOrder } from '@/types/purchaseDomain'
import { formatNumber } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { systemConfirm } from '@/utils/systemConfirm'
import { cn } from '@/utils/cn'

type LineDraft = {
  purchaseOrderLineId: string
  itemCode: string
  itemName: string
  description: string
  uom: string
  orderedQty: number
  previouslyReceivedQty: number
  pendingQty: number
  receivedQty: number
  acceptedQty: number
  rejectedQty: number
  shortQty: number
  excessQty: number
  damagedQty: number
  batchNumber: string
  lotNumber: string
  serialNumber: string
  manufacturingDate: string
  expiryDate: string
  warehouseId: string
  warehouseName: string
  bin: string
  allowExcess: boolean
  batchControlled: boolean
  serialControlled: boolean
  expiryControlled: boolean
  remarks: string
}

const SECTIONS = [
  { id: 'po-source', label: 'PO Source', icon: ClipboardList },
  { id: 'document', label: 'Document', icon: FileText },
  { id: 'receiving', label: 'Receiving', icon: Truck },
  { id: 'lines', label: 'Lines', icon: PackageCheck },
  { id: 'notes', label: 'Notes', icon: StickyNote },
]

function today() {
  return new Date().toISOString().slice(0, 10)
}

function linesFromPo(
  po: PurchaseOrder,
  itemControls: Record<string, { batch: boolean; serial: boolean; expiry: boolean }>,
): LineDraft[] {
  return po.lines
    .filter((l) => l.pendingQty > 0)
    .map((l) => {
      const ctrl = itemControls[l.itemId] ?? { batch: false, serial: false, expiry: false }
      return {
        purchaseOrderLineId: l.id,
        itemCode: l.itemCode,
        itemName: l.itemName,
        description: l.specification || l.itemName,
        uom: l.uom,
        orderedQty: l.quantity,
        previouslyReceivedQty: l.receivedQty,
        pendingQty: l.pendingQty,
        receivedQty: l.pendingQty,
        acceptedQty: 0,
        rejectedQty: 0,
        shortQty: 0,
        excessQty: 0,
        damagedQty: 0,
        batchNumber: '',
        lotNumber: '',
        serialNumber: '',
        manufacturingDate: '',
        expiryDate: '',
        warehouseId: l.locationId || po.deliveryLocation.id,
        warehouseName: l.locationName || po.deliveryLocation.name,
        bin: '',
        allowExcess: false,
        batchControlled: ctrl.batch,
        serialControlled: ctrl.serial,
        expiryControlled: ctrl.expiry,
        remarks: '',
      }
    })
}

function linesFromGrn(grn: GoodsReceiptNote): LineDraft[] {
  return grn.lines.map((l) => ({
    purchaseOrderLineId: l.purchaseOrderLineId,
    itemCode: l.itemCode,
    itemName: l.itemName,
    description: l.description,
    uom: l.uom,
    orderedQty: l.orderedQty,
    previouslyReceivedQty: l.previouslyReceivedQty,
    pendingQty: l.pendingQty,
    receivedQty: l.receivedQty,
    acceptedQty: l.acceptedQty,
    rejectedQty: l.rejectedQty,
    shortQty: l.shortQty,
    excessQty: l.excessQty,
    damagedQty: l.damagedQty,
    batchNumber: l.batchNumber,
    lotNumber: l.lotNumber,
    serialNumber: l.serialNumber,
    manufacturingDate: l.manufacturingDate ?? '',
    expiryDate: l.expiryDate ?? '',
    warehouseId: l.warehouseId,
    warehouseName: l.warehouseName,
    bin: l.bin,
    allowExcess: l.allowExcess,
    batchControlled: l.batchControlled,
    serialControlled: l.serialControlled,
    expiryControlled: l.expiryControlled,
    remarks: l.remarks,
  }))
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
  const [itemControls, setItemControls] = useState<
    Record<string, { batch: boolean; serial: boolean; expiry: boolean }>
  >({})
  const [poId, setPoId] = useState(searchParams.get('poId') ?? '')
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
  const [lines, setLines] = useState<LineDraft[]>([])
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [activeSection, setActiveSection] = useState('po-source')

  const { markDirty, resetDirty } = useUnsavedChangesGuard(true)

  const receivableOrders = useMemo(
    () =>
      orders.filter(
        (o) =>
          ['released', 'partially_received', 'fully_received', 'invoiced'].includes(o.status) &&
          o.lines.some((l) => l.pendingQty > 0),
      ),
    [orders],
  )

  const selectedPo = useMemo(() => orders.find((o) => o.id === poId), [orders, poId])

  const lineTotals = useMemo(() => {
    const receivedQty = lines.reduce((s, l) => s + (Number(l.receivedQty) || 0), 0)
    const pendingQty = lines.reduce((s, l) => s + (Number(l.pendingQty) || 0), 0)
    const shortQty = lines.reduce((s, l) => s + (Number(l.shortQty) || 0), 0)
    const excessQty = lines.reduce((s, l) => s + (Number(l.excessQty) || 0), 0)
    return {
      lineCount: lines.length,
      receivedQty,
      pendingQty,
      shortQty,
      excessQty,
    }
  }, [lines])

  const formMetrics = useMemo(
    () => [
      {
        label: 'Lines',
        value: String(lineTotals.lineCount),
        accent: 'blue' as const,
        highlight: lineTotals.lineCount > 0,
      },
      {
        label: 'Received Qty',
        value: formatNumber(lineTotals.receivedQty),
        accent: 'green' as const,
        highlight: lineTotals.receivedQty > 0,
      },
      {
        label: 'Pending Qty',
        value: formatNumber(lineTotals.pendingQty),
        accent: 'amber' as const,
        highlight: lineTotals.pendingQty > 0,
      },
      {
        label: 'Short',
        value: formatNumber(lineTotals.shortQty),
        accent: 'violet' as const,
        highlight: lineTotals.shortQty > 0,
      },
      {
        label: 'Excess',
        value: formatNumber(lineTotals.excessQty),
        accent: 'slate' as const,
        highlight: lineTotals.excessQty > 0,
      },
    ],
    [lineTotals],
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
        ? [{ label: 'GRN No', value: documentNumber ?? 'Auto-generated' }]
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

  const navSections = useMemo(
    () =>
      SECTIONS.filter((s) => s.id !== 'po-source' || showPoPicker).map((s) => ({
        ...s,
        done:
          s.id === 'po-source'
            ? Boolean(poId)
            : s.id === 'document'
              ? Boolean(documentDate)
              : s.id === 'receiving'
                ? Boolean(warehouseId)
                : s.id === 'lines'
                  ? lines.length > 0
                  : Boolean(remarks.trim()),
      })),
    [showPoPicker, poId, documentDate, warehouseId, lines.length, remarks],
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [pos, items] = await Promise.all([getPurchaseOrders(), getPurchaseItems()])
      setOrders(pos)
      const controls: Record<string, { batch: boolean; serial: boolean; expiry: boolean }> = {}
      for (const item of items) {
        controls[item.id] = {
          batch: item.batchControlled,
          serial: item.serialControlled,
          expiry: item.expiryControlled,
        }
      }
      setItemControls(controls)
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
        setDocumentDate(grn.documentDate)
        setVendorChallanNumber(grn.vendorChallanNumber)
        setVendorChallanDate(grn.vendorChallanDate ?? '')
        setVehicleNo(grn.vehicleNo ?? '')
        setTransporterName(grn.transporterName ?? '')
        setLrNumber(grn.lrNumber ?? '')
        setGateEntryNo(grn.gateEntryNo ?? '')
        setWarehouseId(grn.warehouseId)
        setWarehouseName(grn.warehouseName)
        setReceivingLocation(grn.receivingLocation)
        setReceivedByName(grn.receivedBy.name)
        setInspectionRequired(grn.inspectionRequired)
        setAllowExcess(grn.allowExcess)
        setRemarks(grn.remarks)
        setLines(linesFromGrn(grn))
        setActiveSection('document')
        resetDirty()
      } else {
        const initialPoId = searchParams.get('poId') ?? ''
        if (initialPoId) {
          const po = await getPurchaseOrderById(initialPoId)
          if (po) {
            setPoId(po.id)
            setWarehouseId(po.deliveryLocation.id)
            setWarehouseName(po.deliveryLocation.name)
            setLines(linesFromPo(po, controls))
            setInspectionRequired(true)
            setActiveSection('document')
          }
        }
        resetDirty()
      }
    } finally {
      setLoading(false)
    }
  }, [id, isNew, navigate, resetDirty, searchParams])

  useEffect(() => {
    void load()
  }, [load])

  const onSelectPo = async (nextPoId: string) => {
    setPoId(nextPoId)
    markDirty()
    if (!nextPoId) {
      setLines([])
      return
    }
    const po = await getPurchaseOrderById(nextPoId)
    if (!po) return
    setWarehouseId(po.deliveryLocation.id)
    setWarehouseName(po.deliveryLocation.name)
    setLines(linesFromPo(po, itemControls))
  }

  const updateLine = (index: number, patch: Partial<LineDraft>) => {
    setLines((prev) => {
      const next = [...prev]
      const row = { ...next[index], ...patch }
      const pending = row.pendingQty
      const received = Number(row.receivedQty) || 0
      row.excessQty = Math.max(0, received - pending)
      row.shortQty = Math.max(0, pending - received)
      next[index] = row
      return next
    })
    markDirty()
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
    lines: lines.map((l) => ({
      purchaseOrderLineId: l.purchaseOrderLineId,
      receivedQty: Number(l.receivedQty) || 0,
      acceptedQty: Number(l.acceptedQty) || 0,
      rejectedQty: Number(l.rejectedQty) || 0,
      shortQty: Number(l.shortQty) || 0,
      excessQty: Number(l.excessQty) || 0,
      damagedQty: Number(l.damagedQty) || 0,
      batchNumber: l.batchNumber,
      lotNumber: l.lotNumber,
      serialNumber: l.serialNumber,
      manufacturingDate: l.manufacturingDate || null,
      expiryDate: l.expiryDate || null,
      warehouseId: l.warehouseId || warehouseId,
      warehouseName: l.warehouseName || warehouseName,
      bin: l.bin,
      allowExcess: l.allowExcess || allowExcess,
      remarks: l.remarks,
    })),
  })

  const validateClient = (): boolean => {
    const errs: Record<string, string> = {}
    if (!poId) errs.poId = 'Select a purchase order'
    if (!warehouseId.trim()) errs.warehouseId = 'Warehouse is mandatory'
    if (!lines.length) errs.lines = 'Add at least one line with open quantity'
    lines.forEach((l, i) => {
      if ((Number(l.receivedQty) || 0) <= 0) errs[`line-${i}-qty`] = 'Received qty required'
      if (l.batchControlled && !l.batchNumber.trim()) errs[`line-${i}-batch`] = 'Batch required'
      if (l.serialControlled && !l.serialNumber.trim()) errs[`line-${i}-serial`] = 'Serial required'
      if (l.expiryControlled && !l.expiryDate) errs[`line-${i}-expiry`] = 'Expiry required'
      if ((Number(l.receivedQty) || 0) > l.pendingQty && !l.allowExcess && !allowExcess) {
        errs[`line-${i}-excess`] = 'Exceeds pending — enable Allow Excess'
      }
    })
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  const saveDraft = async () => {
    if (!validateClient()) {
      notify.error('Fix validation errors before saving')
      return
    }
    setSaving(true)
    try {
      const input = buildInput()
      if (recordId) {
        const updated = await updateGRN(recordId, input)
        setDocumentNumber(updated.documentNumber)
        setStatus(updated.status)
        setLines(linesFromGrn(updated))
        notify.success(`Draft ${updated.documentNumber} saved`)
      } else {
        const created = await createGRNFromPo(input)
        setRecordId(created.id)
        setDocumentNumber(created.documentNumber)
        setStatus(created.status)
        setLines(linesFromGrn(created))
        notify.success(`Created ${created.documentNumber}`)
        resetDirty()
        navigate(`/purchase/grn/${created.id}/edit`, { replace: true })
        return
      }
      resetDirty()
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
      } else {
        notify.error(err instanceof PurchaseServiceError ? err.message : 'Save failed')
      }
    } finally {
      setSaving(false)
    }
  }

  const submit = async () => {
    if (!validateClient()) {
      notify.error('Fix validation errors before submit')
      return
    }
    setSaving(true)
    try {
      let grnId = recordId
      const input = buildInput()
      if (!grnId) {
        const created = await createGRNFromPo(input)
        grnId = created.id
        setRecordId(created.id)
        setDocumentNumber(created.documentNumber)
      } else {
        await updateGRN(grnId, input)
      }
      const submitted = await submitGRN(grnId)
      setStatus(submitted.status)
      resetDirty()
      notify.success(
        submitted.inspectionRequired
          ? `${submitted.documentNumber} submitted — pending inspection`
          : `${submitted.documentNumber} submitted`,
      )
      navigate(`/purchase/grn/${submitted.id}`)
    } catch (err) {
      if (err instanceof PurchaseServiceError && err.code === 'EXCESS_QTY_REQUIRES_PERMISSION') {
        const ok = await systemConfirm({
          title: 'Allow excess receipt?',
          description: `${err.message}\n\nAllow excess receipt?`,
          confirmLabel: 'Allow excess',
          cancelLabel: 'Cancel',
          variant: 'danger',
        })
        if (ok) {
          setAllowExcess(true)
          notify.info('Allow Excess enabled — submit again')
        }
      } else {
        notify.error(err instanceof PurchaseServiceError ? err.message : 'Submit failed')
      }
    } finally {
      setSaving(false)
    }
  }

  const breadcrumbs = [
    { label: 'Goods Receipts', to: '/purchase/grn' },
    { label: isNew ? 'New' : documentNumber ?? 'Edit' },
  ]

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
      recordNo={documentNumber ?? (isNew ? 'New' : undefined)}
      recordTitle={documentTitle}
      status={statusLabel}
      statusTone={purchaseStatusTone(status)}
      statusKey={status}
      recordHeaderFacts={recordHeaderFacts}
      favoritePath={recordId ? `/purchase/grn/${recordId}/edit` : '/purchase/grn/new'}
      breadcrumbs={breadcrumbs}
      backLink={{ to: '/purchase/grn', label: 'Back to Goods Receipts' }}
      factBox={documentFactBox}
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={{
            id: 'submit',
            label: 'Submit',
            icon: Send,
            onClick: () => void submit(),
            disabled: saving || (status !== 'draft' && Boolean(recordId)),
          }}
          secondaryActions={[
            {
              id: 'save',
              label: saving ? 'Saving…' : 'Save Draft',
              icon: Save,
              onClick: () => void saveDraft(),
              disabled: saving,
            },
          ]}
        />
      }
      stickyFooter
      footer={
        <ErpStickySaveBar
          sticky
          isSubmitting={saving}
          actions={
            <ErpButtonGroup>
              <ErpButton
                type="button"
                variant="ghost"
                disabled={saving}
                onClick={() => navigate('/purchase/grn')}
              >
                Cancel
              </ErpButton>
              <ErpButton
                type="button"
                variant="secondary"
                icon={Save}
                disabled={saving}
                onClick={() => void saveDraft()}
              >
                {saving ? 'Saving…' : 'Save Draft'}
              </ErpButton>
            </ErpButtonGroup>
          }
        />
      }
      onSaveShortcut={() => void saveDraft()}
    >
      <EnterpriseFormMetrics metrics={formMetrics} />

      <PurchaseFormSectionNav
        sections={navSections}
        activeId={activeSection}
        onSelect={setActiveSection}
      />

      {showPoPicker ? (
        <ErpCardSection
          id={purchaseSectionId('po-source')}
          title="PO Source"
          subtitle="Select a released purchase order with open quantity"
          icon={ClipboardList}
          accent="slate"
          collapsible
          defaultOpen
          dense
          columns={1}
        >
          <p className="mb-2 text-[12px] text-erp-muted">
            GRN lines load from the selected PO’s open quantity. Header warehouse defaults from the PO delivery
            location.
          </p>
          {receivableOrders.length === 0 ? (
            <p className="text-[13px] text-erp-muted">
              No receivable purchase orders.{' '}
              <Link to="/purchase/orders" className="text-erp-primary underline">
                Open Purchase Orders
              </Link>
            </p>
          ) : (
            <>
              <div
                className="mb-3 flex flex-wrap gap-1.5"
                role="tablist"
                aria-label="Purchase order source"
              >
                {receivableOrders.map((o) => {
                  const openQty = o.lines.reduce((s, l) => s + l.pendingQty, 0)
                  return (
                    <button
                      key={o.id}
                      type="button"
                      role="tab"
                      aria-selected={poId === o.id}
                      disabled={readOnlyHeaderPo}
                      className={cn(
                        'rounded border px-2.5 py-1 text-[12px] font-medium transition-colors',
                        poId === o.id
                          ? 'border-erp-primary bg-erp-primary text-white'
                          : 'border-erp-border bg-erp-surface text-erp-text hover:border-erp-primary hover:bg-erp-primary-soft',
                        readOnlyHeaderPo && 'cursor-not-allowed opacity-70',
                      )}
                      onClick={() => void onSelectPo(o.id)}
                    >
                      {o.documentNumber}
                      <span className={cn('ml-1.5 font-normal', poId === o.id ? 'text-white/80' : 'text-erp-muted')}>
                        {o.vendor.name} · open {formatNumber(openQty)}
                      </span>
                    </button>
                  )
                })}
              </div>
              <ErpFieldRow
                label="Purchase Order"
                required
                fieldError={fieldErrors.poId}
                fieldState={fieldErrors.poId ? 'error' : 'idle'}
              >
                <Select
                  value={poId}
                  disabled={readOnlyHeaderPo}
                  onChange={(e) => void onSelectPo(e.target.value)}
                  className="max-w-md"
                >
                  <option value="">Select released PO…</option>
                  {receivableOrders.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.documentNumber} — {o.vendor.name} (open{' '}
                      {formatNumber(o.lines.reduce((s, l) => s + l.pendingQty, 0))})
                    </option>
                  ))}
                </Select>
              </ErpFieldRow>
            </>
          )}
        </ErpCardSection>
      ) : null}

      <ErpCardSection
        id={purchaseSectionId('document')}
        title="Document"
        subtitle="GRN identity, vendor, and challan references"
        icon={FileText}
        accent="blue"
        collapsible
        defaultOpen
        dense
      >
        <ErpFormSpan span={3}>
          <p className="erp-field-group__label">Document</p>
        </ErpFormSpan>
        <ErpFieldRow label="GRN Number" readOnly>
          <Input value={documentNumber ?? 'Auto-generated'} readOnly className="bg-erp-surface-alt" />
        </ErpFieldRow>
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
        <ErpFieldRow label="Status" readOnly>
          <Input value={statusLabel} readOnly className="bg-erp-surface-alt" />
        </ErpFieldRow>

        <ErpFormSpan span={3}>
          <p className="erp-field-group__label">Vendor / PO</p>
        </ErpFormSpan>
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
      </ErpCardSection>

      <ErpCardSection
        id={purchaseSectionId('receiving')}
        title="Receiving"
        subtitle="Warehouse, gate entry, transport, and QC flags"
        collapsedSummary={receivingPeek || undefined}
        icon={Truck}
        accent="green"
        collapsible
        defaultOpen={false}
        dense
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
          <Input
            value={warehouseName}
            onChange={(e) => {
              setWarehouseName(e.target.value)
              if (!warehouseId) setWarehouseId('loc-custom')
              markDirty()
            }}
          />
        </ErpFieldRow>
        <ErpFieldRow label="Receiving Location">
          <Input
            value={receivingLocation}
            onChange={(e) => {
              setReceivingLocation(e.target.value)
              markDirty()
            }}
            placeholder="Dock / bay"
          />
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
          <p className="erp-field-group__label">Transport</p>
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
          <p className="erp-field-group__label">QC / Excess</p>
        </ErpFormSpan>
        <ErpFieldRow label="Inspection Required">
          <label className="flex items-center gap-2 text-sm">
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
          <label className="flex items-center gap-2 text-sm">
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
              {receivingLocation ? ` · ${receivingLocation}` : ''}
            </p>
          </ErpFormSpan>
        ) : null}
      </ErpCardSection>

      <ErpCardSection
        id={purchaseSectionId('lines')}
        title="Lines"
        subtitle="Qty breakdown against PO open quantity"
        collapsedSummary={linesPeek || undefined}
        icon={PackageCheck}
        accent="amber"
        collapsible
        defaultOpen
        dense
        columns={1}
      >
        {fieldErrors.lines ? (
          <p className="mb-2 text-sm text-red-600">{fieldErrors.lines}</p>
        ) : (
          <p className="mb-2 text-[12px] text-erp-muted">
            Adjust received quantities; short / excess recalculate from pending open qty.
          </p>
        )}
        <div className="overflow-x-auto rounded-md border border-erp-border">
          <table className="erp-table min-w-full text-left text-[12px]">
            <thead>
              <tr>
                <th>Item</th>
                <th className="num">Ordered</th>
                <th className="num">Prev. Recd</th>
                <th className="num">Pending</th>
                <th className="num">Received</th>
                <th>Short / Excess / Dmg</th>
                <th>Batch / Lot / Serial</th>
                <th>Mfg / Expiry</th>
                <th>Bin</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={l.purchaseOrderLineId} className="align-top">
                  <td>
                    <div className="font-mono text-[11px]">{l.itemCode}</div>
                    <div>{l.itemName}</div>
                    <div className="text-[11px] text-erp-muted">{l.uom}</div>
                  </td>
                  <td className="num">{formatNumber(l.orderedQty)}</td>
                  <td className="num">{formatNumber(l.previouslyReceivedQty)}</td>
                  <td className="num">{formatNumber(l.pendingQty)}</td>
                  <td className="num">
                    <Input
                      type="number"
                      className="w-24"
                      value={l.receivedQty}
                      onChange={(e) => updateLine(i, { receivedQty: Number(e.target.value) })}
                    />
                    {fieldErrors[`line-${i}-qty`] || fieldErrors[`line-${i}-excess`] ? (
                      <p className="mt-1 text-xs text-red-600">
                        {fieldErrors[`line-${i}-qty`] || fieldErrors[`line-${i}-excess`]}
                      </p>
                    ) : null}
                  </td>
                  <td>
                    <div className="flex gap-1">
                      <Input
                        type="number"
                        className="w-16"
                        title="Short"
                        value={l.shortQty}
                        onChange={(e) => updateLine(i, { shortQty: Number(e.target.value) })}
                      />
                      <Input
                        type="number"
                        className="w-16"
                        title="Excess"
                        value={l.excessQty}
                        onChange={(e) => updateLine(i, { excessQty: Number(e.target.value) })}
                      />
                      <Input
                        type="number"
                        className="w-16"
                        title="Damaged"
                        value={l.damagedQty}
                        onChange={(e) => updateLine(i, { damagedQty: Number(e.target.value) })}
                      />
                    </div>
                  </td>
                  <td>
                    <Input
                      className="mb-1 w-36"
                      placeholder="Batch"
                      value={l.batchNumber}
                      onChange={(e) => updateLine(i, { batchNumber: e.target.value })}
                    />
                    <Input
                      className="mb-1 w-36"
                      placeholder="Lot"
                      value={l.lotNumber}
                      onChange={(e) => updateLine(i, { lotNumber: e.target.value })}
                    />
                    <Input
                      className="w-36"
                      placeholder="Serial"
                      value={l.serialNumber}
                      onChange={(e) => updateLine(i, { serialNumber: e.target.value })}
                    />
                    {fieldErrors[`line-${i}-batch`] || fieldErrors[`line-${i}-serial`] ? (
                      <p className="mt-1 text-xs text-red-600">
                        {fieldErrors[`line-${i}-batch`] || fieldErrors[`line-${i}-serial`]}
                      </p>
                    ) : null}
                  </td>
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
                      <p className="mt-1 text-xs text-red-600">{fieldErrors[`line-${i}-expiry`]}</p>
                    ) : null}
                  </td>
                  <td>
                    <Input
                      className="w-20"
                      value={l.bin}
                      onChange={(e) => updateLine(i, { bin: e.target.value })}
                    />
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
      </ErpCardSection>

      <ErpCardSection
        id={purchaseSectionId('notes')}
        title="Notes"
        subtitle="Receiving remarks and QC context"
        collapsedSummary={notesPeek || undefined}
        icon={StickyNote}
        accent="violet"
        collapsible
        defaultOpen={false}
        dense
      >
        <ErpFormSpan span={3}>
          <p className="erp-field-group__label">Remarks</p>
        </ErpFormSpan>
        <ErpFormSpan span={3}>
          <Textarea
            value={remarks}
            onChange={(e) => {
              setRemarks(e.target.value)
              markDirty()
            }}
            rows={3}
            placeholder="Gate notes, discrepancy context, QC instructions…"
          />
        </ErpFormSpan>
      </ErpCardSection>
    </PurchaseCardFormShell>
  )
}
