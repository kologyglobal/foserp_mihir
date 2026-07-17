import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Banknote,
  ClipboardList,
  Link2,
  Package,
  Plus,
  Save,
  Send,
  Trash2,
  Truck,
} from 'lucide-react'
import { PurchaseCardFormShell } from '@/components/purchase/PurchaseCardFormShell'
import { PurchaseTableToolbar, purchaseStatusTone } from '@/components/purchase/purchaseCardFormShared'
import { PurchaseTaxTotalsPanel } from '@/components/purchase/PurchaseTaxTotalsPanel'
import {
  PurchaseDocumentFactBox,
  buildPurchaseRelatedLinks,
  purchaseDocumentApprovalFact,
} from '@/components/purchase/PurchaseDocumentFactBox'
import { ErpCardSection, ErpFieldRow, ErpFormSpan, ErpStickySaveBar } from '@/components/erp/card-form'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { ErpButton, ErpButtonGroup } from '@/components/erp/ErpButton'
import { Checkbox, Input, Select, Textarea } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EmptyState } from '@/components/ui/EmptyState'
import { EnterpriseFormMetrics } from '@/design-system/workspace'
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard'
import {
  hasMeaningfulTaxTotals,
  taxTotalsSummary,
} from '@/modules/purchase/purchaseFastTabSummaries'
import {
  createPurchaseReturn,
  createPurchaseReturnFromGrn,
  createPurchaseReturnFromQualityInspection,
  getGRNs,
  getPurchaseInvoices,
  getPurchaseItems,
  getPurchaseOrders,
  getPurchaseReturnById,
  getQualityInspections,
  getVendors,
  PurchaseServiceError,
  PURCHASE_RETURN_DOMAIN_STATUS_LABELS,
  PURCHASE_RETURN_ORIGIN_LABELS,
  PURCHASE_RETURN_REASON_LABELS,
  submitPurchaseReturn,
  updatePurchaseReturn,
} from '@/services/purchase'
import type {
  GoodsReceiptNote,
  PurchaseInvoice,
  PurchaseItem,
  PurchaseOrder,
  PurchaseReturn,
  PurchaseReturnOrigin,
  PurchaseReturnReason,
  QualityInspection,
  Vendor,
} from '@/types/purchaseDomain'
import { PURCHASE_DEMO_LOCATION, PURCHASE_DEMO_LOCATION_FG } from '@/data/purchase/purchaseDomainSeed'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { cn } from '@/utils/cn'

function today() {
  return new Date().toISOString().slice(0, 10)
}

type EditorLine = {
  key: string
  itemId: string
  itemCode: string
  description: string
  batchLotNo: string
  serialNumber: string
  receivedQty: number
  availableReturnQty: number
  returnQty: number
  uom: string
  unitCost: number
  gstRatePct: number
  reason: PurchaseReturnReason
  replacementQty: number
  remarks: string
  goodsReceiptLineId: string | null
}

function emptyLine(partial?: Partial<EditorLine>): EditorLine {
  return {
    key: crypto.randomUUID(),
    itemId: '',
    itemCode: '',
    description: '',
    batchLotNo: '',
    serialNumber: '',
    receivedQty: 0,
    availableReturnQty: 0,
    returnQty: 0,
    uom: 'NOS',
    unitCost: 0,
    gstRatePct: 18,
    reason: 'quality_rejection',
    replacementQty: 0,
    remarks: '',
    goodsReceiptLineId: null,
    ...partial,
  }
}

function lineTaxable(l: EditorLine) {
  return Number((l.returnQty * l.unitCost).toFixed(2))
}

function lineTotal(l: EditorLine) {
  const taxable = lineTaxable(l)
  return Number((taxable + (taxable * l.gstRatePct) / 100).toFixed(2))
}

export function PurchaseReturnEditorPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const isNew = !id
  const navigate = useNavigate()

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [recordId, setRecordId] = useState<string | null>(id ?? null)
  const [documentNumber, setDocumentNumber] = useState<string | null>(null)
  const [status, setStatus] = useState<PurchaseReturn['status']>('draft')

  const [origin, setOrigin] = useState<PurchaseReturnOrigin>(
    (searchParams.get('origin') as PurchaseReturnOrigin) || 'grn_rejected_quantity',
  )
  const [documentDate, setDocumentDate] = useState(today())
  const [vendorId, setVendorId] = useState('')
  const [purchaseOrderId, setPurchaseOrderId] = useState('')
  const [goodsReceiptId, setGoodsReceiptId] = useState(searchParams.get('grnId') ?? '')
  const [purchaseInvoiceId, setPurchaseInvoiceId] = useState('')
  const [qualityInspectionId, setQualityInspectionId] = useState(searchParams.get('qiId') ?? '')
  const [returnReason, setReturnReason] = useState<PurchaseReturnReason>('quality_rejection')
  const [warehouseId, setWarehouseId] = useState<string>(PURCHASE_DEMO_LOCATION.id)
  const [transportDetails, setTransportDetails] = useState('')
  const [debitNoteRequired, setDebitNoteRequired] = useState(true)
  const [replacementRequired, setReplacementRequired] = useState(false)
  const [remarks, setRemarks] = useState('')
  const [lines, setLines] = useState<EditorLine[]>([emptyLine()])

  const [vendors, setVendors] = useState<Vendor[]>([])
  const [items, setItems] = useState<PurchaseItem[]>([])
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [grns, setGrns] = useState<GoodsReceiptNote[]>([])
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([])
  const [inspections, setInspections] = useState<QualityInspection[]>([])

  const { dirty, markDirty, resetDirty } = useUnsavedChangesGuard(true)
  const locations = [PURCHASE_DEMO_LOCATION, PURCHASE_DEMO_LOCATION_FG]

  const selectedVendor = useMemo(() => vendors.find((v) => v.id === vendorId), [vendors, vendorId])

  const summary = useMemo(() => {
    const active = lines.filter((l) => l.itemId)
    const taxable = active.reduce((s, l) => s + lineTaxable(l), 0)
    const total = active.reduce((s, l) => s + lineTotal(l), 0)
    const returnQty = active.reduce((s, l) => s + (Number(l.returnQty) || 0), 0)
    return {
      lineCount: active.length,
      returnQty,
      taxable: Number(taxable.toFixed(2)),
      tax: Number((total - taxable).toFixed(2)),
      total: Number(total.toFixed(2)),
    }
  }, [lines])

  const formMetrics = useMemo(
    () => [
      {
        label: 'Lines',
        value: String(summary.lineCount),
        accent: 'green' as const,
      },
      {
        label: 'Return Qty',
        value: String(summary.returnQty),
        accent: 'slate' as const,
      },
      {
        label: 'Taxable',
        value: formatCurrency(summary.taxable),
        accent: 'blue' as const,
      },
      {
        label: 'GST',
        value: formatCurrency(summary.tax),
        accent: 'violet' as const,
      },
      {
        label: 'Est. Total',
        value: formatCurrency(summary.total),
        accent: 'amber' as const,
        highlight: summary.total > 0,
      },
    ],
    [summary],
  )

  const financeDefaultOpen = hasMeaningfulTaxTotals(summary.taxable, summary.tax, summary.total)
  const financePeek = useMemo(
    () =>
      taxTotalsSummary({
        subtotal: summary.taxable,
        tax: summary.tax,
        total: summary.total,
      }),
    [summary.taxable, summary.tax, summary.total],
  )

  const documentTitle = isNew
    ? 'New Purchase Return'
    : (documentNumber ?? 'Purchase Return')
  const vendorFact = selectedVendor?.vendorName || 'Not selected'

  const recordHeaderFacts = useMemo(
    () => [
      ...(isNew
        ? [{ label: 'Return No', value: documentNumber ?? 'Auto-generated' }]
        : []),
      { label: 'Vendor', value: vendorFact },
      {
        label: 'Date',
        value: documentDate ? formatDate(documentDate) : 'Not selected',
      },
      {
        label: 'Reason',
        value: PURCHASE_RETURN_REASON_LABELS[returnReason],
      },
    ],
    [isNew, documentNumber, vendorFact, documentDate, returnReason],
  )

  const selectedPo = useMemo(
    () => orders.find((o) => o.id === purchaseOrderId),
    [orders, purchaseOrderId],
  )
  const selectedGrn = useMemo(
    () => grns.find((g) => g.id === goodsReceiptId),
    [grns, goodsReceiptId],
  )
  const selectedInvoice = useMemo(
    () => invoices.find((i) => i.id === purchaseInvoiceId),
    [invoices, purchaseInvoiceId],
  )

  const documentFactBox = useMemo(() => {
    const approval = purchaseDocumentApprovalFact(status)
    const firstLine = lines.find((l) => l.itemId || l.itemCode.trim())
    return (
      <PurchaseDocumentFactBox
        vendor={
          selectedVendor
            ? {
                id: selectedVendor.id,
                code: selectedVendor.vendorCode,
                name: selectedVendor.vendorName,
                rating: selectedVendor.rating,
                paymentTerms: selectedVendor.paymentTerms,
                leadTimeDays: selectedVendor.leadTimeDays,
              }
            : null
        }
        purchaseHistory={{
          lastPurchasePrice: firstLine && firstLine.unitCost > 0 ? firstLine.unitCost : null,
          lastVendorName: selectedVendor?.vendorName ?? null,
          averageLeadTimeDays: selectedVendor?.leadTimeDays ?? null,
        }}
        documentStatus={{
          statusLabel: PURCHASE_RETURN_DOMAIN_STATUS_LABELS[status],
          ...approval,
          createdBy: null,
          modifiedBy: null,
          modifiedDate: null,
        }}
        related={buildPurchaseRelatedLinks({
          purchaseOrderId: purchaseOrderId || null,
          purchaseOrderNumber: selectedPo?.documentNumber || null,
          goodsReceiptId: goodsReceiptId || null,
          goodsReceiptNumber: selectedGrn?.documentNumber || null,
          invoices: selectedInvoice
            ? [
                {
                  id: selectedInvoice.id,
                  documentNumber: selectedInvoice.documentNumber,
                  status: selectedInvoice.status,
                },
              ]
            : undefined,
        })}
      />
    )
  }, [
    status,
    lines,
    selectedVendor,
    purchaseOrderId,
    selectedPo,
    goodsReceiptId,
    selectedGrn,
    selectedInvoice,
  ])

  const setLinesDirty = (next: EditorLine[]) => {
    setLines(next)
    markDirty()
  }

  const patchLine = (key: string, patch: Partial<EditorLine>) => {
    setLinesDirty(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }

  const applyItem = (key: string, itemId: string) => {
    const item = items.find((i) => i.id === itemId)
    if (!item) return
    patchLine(key, {
      itemId: item.id,
      itemCode: item.itemCode,
      description: item.itemName,
      uom: item.uom,
      unitCost: item.standardRate,
      gstRatePct: item.gstRatePct,
    })
  }

  const toInput = () => ({
    vendorId,
    origin,
    documentDate,
    goodsReceiptId: goodsReceiptId || null,
    purchaseOrderId: purchaseOrderId || null,
    purchaseInvoiceId: purchaseInvoiceId || null,
    qualityInspectionId: qualityInspectionId || null,
    returnReason,
    warehouseId,
    warehouseName: locations.find((l) => l.id === warehouseId)?.name ?? PURCHASE_DEMO_LOCATION.name,
    transportDetails,
    debitNoteRequired,
    replacementRequired,
    remarks,
    lines: lines
      .filter((l) => l.itemId)
      .map((l) => ({
        itemId: l.itemId,
        returnQty: l.returnQty,
        unitCost: l.unitCost,
        goodsReceiptLineId: l.goodsReceiptLineId,
        description: l.description,
        batchLotNo: l.batchLotNo,
        serialNumber: l.serialNumber,
        receivedQty: l.receivedQty,
        availableReturnQty: l.availableReturnQty,
        reason: l.reason,
        replacementQty: l.replacementQty,
        remarks: l.remarks,
      })),
  })

  const hydrate = useCallback(
    (doc: PurchaseReturn) => {
      setRecordId(doc.id)
      setDocumentNumber(doc.documentNumber)
      setStatus(doc.status)
      setOrigin(doc.origin)
      setDocumentDate(doc.documentDate)
      setVendorId(doc.vendor.id)
      setPurchaseOrderId(doc.purchaseOrderId ?? '')
      setGoodsReceiptId(doc.goodsReceiptId ?? '')
      setPurchaseInvoiceId(doc.purchaseInvoiceId ?? '')
      setQualityInspectionId(doc.qualityInspectionId ?? '')
      setReturnReason(doc.returnReason)
      setWarehouseId(doc.warehouseId)
      setTransportDetails(doc.transportDetails)
      setDebitNoteRequired(doc.debitNoteRequired)
      setReplacementRequired(doc.replacementRequired)
      setRemarks(doc.remarks)
      setLines(
        doc.lines.map((l) =>
          emptyLine({
            key: l.id,
            itemId: l.itemId,
            itemCode: l.itemCode,
            description: l.description || l.itemName,
            batchLotNo: l.batchLotNo,
            serialNumber: l.serialNumber,
            receivedQty: l.receivedQty,
            availableReturnQty: l.availableReturnQty,
            returnQty: l.returnQty,
            uom: l.uom,
            unitCost: l.unitCost,
            gstRatePct: l.gstRatePct,
            reason: l.reason,
            replacementQty: l.replacementQty,
            remarks: l.remarks,
            goodsReceiptLineId: l.goodsReceiptLineId,
          }),
        ),
      )
      resetDirty()
    },
    [resetDirty],
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [v, i, o, g, inv, qi] = await Promise.all([
        getVendors(),
        getPurchaseItems(),
        getPurchaseOrders(),
        getGRNs(),
        getPurchaseInvoices(),
        getQualityInspections(),
      ])
      if (cancelled) return
      setVendors(v)
      setItems(i)
      setOrders(o)
      setGrns(g)
      setInvoices(inv)
      setInspections(qi)

      if (!isNew && id) {
        setLoading(true)
        try {
          const doc = await getPurchaseReturnById(id)
          if (!doc) {
            notify.error('Purchase return not found')
            navigate('/purchase/returns')
            return
          }
          if (doc.status !== 'draft' && doc.status !== 'pending_approval') {
            notify.error('Only draft / pending returns can be edited')
            navigate(`/purchase/returns/${doc.id}`)
            return
          }
          hydrate(doc)
        } finally {
          if (!cancelled) setLoading(false)
        }
      } else {
        const qiId = searchParams.get('qiId')
        const grnId = searchParams.get('grnId')
        if (qiId) {
          setLoading(true)
          try {
            const created = await createPurchaseReturnFromQualityInspection(qiId)
            hydrate(created)
            navigate(`/purchase/returns/${created.id}/edit`, { replace: true })
          } catch (err) {
            notify.error(err instanceof PurchaseServiceError ? err.message : 'Failed to create from QI')
          } finally {
            if (!cancelled) setLoading(false)
          }
        } else if (grnId) {
          setLoading(true)
          try {
            const created = await createPurchaseReturnFromGrn(grnId, {
              origin: (searchParams.get('origin') as PurchaseReturnOrigin) || 'grn_rejected_quantity',
            })
            hydrate(created)
            navigate(`/purchase/returns/${created.id}/edit`, { replace: true })
          } catch (err) {
            notify.error(err instanceof PurchaseServiceError ? err.message : 'Failed to create from GRN')
          } finally {
            if (!cancelled) setLoading(false)
          }
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [hydrate, id, isNew, navigate, searchParams])

  const applyOriginPreset = async (mode: PurchaseReturnOrigin) => {
    setOrigin(mode)
    markDirty()
    if (mode === 'quality_rejection' && qualityInspectionId) {
      try {
        const created = await createPurchaseReturnFromQualityInspection(qualityInspectionId)
        hydrate(created)
        navigate(`/purchase/returns/${created.id}/edit`, { replace: true })
      } catch (err) {
        notify.error(err instanceof PurchaseServiceError ? err.message : 'Could not load QI lines')
      }
      return
    }
    if (goodsReceiptId) {
      try {
        const created = await createPurchaseReturnFromGrn(goodsReceiptId, { origin: mode })
        hydrate(created)
        navigate(`/purchase/returns/${created.id}/edit`, { replace: true })
      } catch (err) {
        notify.error(err instanceof PurchaseServiceError ? err.message : 'Could not load GRN lines')
      }
    }
  }

  const saveDraft = async (andSubmit: boolean) => {
    if (!vendorId) {
      notify.error('Select a vendor')
      return
    }
    if (!toInput().lines.length) {
      notify.error('Add at least one line with an item')
      return
    }
    setSaving(true)
    try {
      const input = toInput()
      let doc: PurchaseReturn
      if (recordId) {
        doc = await updatePurchaseReturn(recordId, input)
      } else {
        doc = await createPurchaseReturn(input)
        setRecordId(doc.id)
        setDocumentNumber(doc.documentNumber)
      }
      if (andSubmit) {
        doc = await submitPurchaseReturn(doc.id)
        notify.success('Return submitted for approval')
        resetDirty()
        navigate(`/purchase/returns/${doc.id}`)
        return
      }
      hydrate(doc)
      notify.success('Draft saved')
      if (isNew) navigate(`/purchase/returns/${doc.id}/edit`, { replace: true })
    } catch (err) {
      notify.error(err instanceof PurchaseServiceError ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <PurchaseCardFormShell
        title="Purchase Return"
        description="Loading…"
        status="Draft"
        favoritePath="/purchase/returns/new"
        breadcrumbs={[
          { label: 'Purchase', to: '/purchase' },
          { label: 'Returns', to: '/purchase/returns' },
          { label: 'Loading' },
        ]}
        footer={null}
        backLink={{ to: '/purchase/returns', label: 'Back to Returns' }}
      >
        <LoadingState variant="form" rows={8} />
      </PurchaseCardFormShell>
    )
  }

  const editable = status === 'draft' || status === 'pending_approval'
  const showOriginPicker = isNew || !recordId
  const vendorOrders = orders.filter((o) => !vendorId || o.vendor.id === vendorId)
  const vendorGrns = grns.filter((g) => !vendorId || g.vendor.id === vendorId)
  const vendorInvoices = invoices.filter((i) => !vendorId || i.vendor.id === vendorId)

  return (
    <PurchaseCardFormShell
      title={isNew ? 'New Purchase Return' : `Edit ${documentNumber ?? 'Purchase Return'}`}
      description="Vendor material return — draft and pending-approval documents only"
      recordNo={documentNumber ?? (isNew ? 'New' : undefined)}
      recordTitle={documentTitle}
      status={PURCHASE_RETURN_DOMAIN_STATUS_LABELS[status]}
      statusTone={purchaseStatusTone(status)}
      statusKey={status}
      recordHeaderFacts={recordHeaderFacts}
      favoritePath={recordId ? `/purchase/returns/${recordId}/edit` : '/purchase/returns/new'}
      backLink={{ to: '/purchase/returns', label: 'Back to Returns' }}
      breadcrumbs={[
        { label: 'Returns', to: '/purchase/returns' },
        { label: isNew ? 'New' : documentNumber ?? 'Edit' },
      ]}
      factBox={documentFactBox}
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[
            {
              id: 'save',
              label: saving ? 'Saving…' : 'Save Draft',
              icon: Save,
              onClick: () => void saveDraft(false),
              disabled: !editable || saving,
            },
          ]}
          primaryAction={{
            id: 'submit',
            label: 'Submit for Approval',
            icon: Send,
            onClick: () => void saveDraft(true),
            disabled: !editable || saving,
          }}
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
                onClick={() => navigate('/purchase/returns')}
              >
                Cancel
              </ErpButton>
              <ErpButton
                type="button"
                variant="secondary"
                icon={Save}
                disabled={!editable || saving}
                onClick={() => void saveDraft(false)}
              >
                {saving ? 'Saving…' : 'Save Draft'}
              </ErpButton>
            </ErpButtonGroup>
          }
        />
      }
      onSaveShortcut={() => void saveDraft(false)}
    >
      {showOriginPicker ? (
        <ErpCardSection
          title="Origin"
          subtitle="Choose return origin and optionally load lines from GRN or quality inspection"
          icon={ClipboardList}
          accent="slate"
          collapsible
          defaultOpen
          dense
          columns={1}
        >
          <p className="mb-2 text-[12px] text-erp-muted">
            Selecting an origin with a source GRN or QI loads draft lines, then opens the editor.
          </p>
          <div className="mb-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Purchase return origin">
            {(Object.entries(PURCHASE_RETURN_ORIGIN_LABELS) as [PurchaseReturnOrigin, string][]).map(
              ([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  role="tab"
                  aria-selected={origin === mode}
                  className={cn(
                    'rounded border px-2.5 py-1 text-[12px] font-medium transition-colors',
                    origin === mode
                      ? 'border-erp-primary bg-erp-primary text-white'
                      : 'border-erp-border bg-erp-surface text-erp-text hover:border-erp-primary hover:bg-erp-primary-soft',
                  )}
                  onClick={() => void applyOriginPreset(mode)}
                >
                  {label}
                </button>
              ),
            )}
          </div>
          <div className="space-y-2">
            <Select
              value={goodsReceiptId}
              onChange={(e) => {
                setGoodsReceiptId(e.target.value)
                markDirty()
              }}
              className="max-w-md"
              aria-label="Source GRN"
            >
              <option value="">Source GRN…</option>
              {grns.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.documentNumber} · {g.vendor.name}
                </option>
              ))}
            </Select>
            <Select
              value={qualityInspectionId}
              onChange={(e) => {
                setQualityInspectionId(e.target.value)
                markDirty()
              }}
              className="max-w-md"
              aria-label="Source quality inspection"
            >
              <option value="">Source Quality Inspection…</option>
              {inspections
                .filter((q) => q.rejectedQty > 0)
                .map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.documentNumber} · rej {q.rejectedQty}
                  </option>
                ))}
            </Select>
            <div className="flex flex-wrap gap-2 pt-1">
              <ErpButton
                type="button"
                variant="secondary"
                size="sm"
                disabled={!goodsReceiptId}
                onClick={() => void applyOriginPreset(origin)}
              >
                Load lines from GRN
              </ErpButton>
              <ErpButton
                type="button"
                variant="secondary"
                size="sm"
                disabled={!qualityInspectionId}
                onClick={() => void applyOriginPreset('quality_rejection')}
              >
                Load lines from QI
              </ErpButton>
            </div>
          </div>
        </ErpCardSection>
      ) : null}

      <EnterpriseFormMetrics metrics={formMetrics} />

      <ErpCardSection
        title="Header"
        subtitle="Vendor, reason, linked documents, warehouse, and return flags"
        icon={Truck}
        accent="blue"
        collapsible
        defaultOpen
        dense
      >
        <ErpFormSpan span={3}>
          <p className="erp-field-group__label">Document</p>
        </ErpFormSpan>
        <ErpFieldRow label="Return Number" readOnly>
          <Input
            value={documentNumber ?? 'Auto on save'}
            readOnly
            className="bg-erp-surface-alt"
          />
        </ErpFieldRow>
        <ErpFieldRow label="Return Date" required>
          <Input
            type="date"
            value={documentDate}
            onChange={(e) => {
              setDocumentDate(e.target.value)
              markDirty()
            }}
            disabled={!editable}
          />
        </ErpFieldRow>
        <ErpFieldRow label="Origin" readOnly>
          <Input value={PURCHASE_RETURN_ORIGIN_LABELS[origin]} readOnly className="bg-erp-surface-alt" />
        </ErpFieldRow>

        <ErpFormSpan span={3}>
          <p className="erp-field-group__label">Vendor &amp; reason</p>
        </ErpFormSpan>
        <ErpFieldRow label="Vendor" required>
          <Select
            value={vendorId}
            onChange={(e) => {
              setVendorId(e.target.value)
              markDirty()
            }}
            disabled={!editable}
          >
            <option value="">Select vendor…</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.vendorName}
              </option>
            ))}
          </Select>
        </ErpFieldRow>
        <ErpFieldRow label="Return Reason" required>
          <Select
            value={returnReason}
            onChange={(e) => {
              setReturnReason(e.target.value as PurchaseReturnReason)
              markDirty()
            }}
            disabled={!editable}
          >
            {Object.entries(PURCHASE_RETURN_REASON_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </ErpFieldRow>
        <ErpFieldRow label="Warehouse">
          <Select
            value={warehouseId}
            onChange={(e) => {
              setWarehouseId(e.target.value)
              markDirty()
            }}
            disabled={!editable}
          >
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        </ErpFieldRow>

        <ErpFormSpan span={3}>
          <p className="erp-field-group__label">Linked documents</p>
        </ErpFormSpan>
        <ErpFieldRow label="PO Number">
          <Select
            value={purchaseOrderId}
            onChange={(e) => {
              setPurchaseOrderId(e.target.value)
              markDirty()
            }}
            disabled={!editable}
          >
            <option value="">—</option>
            {vendorOrders.map((o) => (
              <option key={o.id} value={o.id}>
                {o.documentNumber}
              </option>
            ))}
          </Select>
        </ErpFieldRow>
        <ErpFieldRow label="GRN Number">
          <Select
            value={goodsReceiptId}
            onChange={(e) => {
              setGoodsReceiptId(e.target.value)
              markDirty()
            }}
            disabled={!editable}
          >
            <option value="">—</option>
            {vendorGrns.map((g) => (
              <option key={g.id} value={g.id}>
                {g.documentNumber}
              </option>
            ))}
          </Select>
        </ErpFieldRow>
        <ErpFieldRow label="Purchase Invoice">
          <Select
            value={purchaseInvoiceId}
            onChange={(e) => {
              setPurchaseInvoiceId(e.target.value)
              markDirty()
            }}
            disabled={!editable}
          >
            <option value="">—</option>
            {vendorInvoices.map((inv) => (
              <option key={inv.id} value={inv.id}>
                {inv.documentNumber}
              </option>
            ))}
          </Select>
        </ErpFieldRow>
        <ErpFieldRow label="Quality Inspection" readOnly={!editable}>
          <Select
            value={qualityInspectionId}
            onChange={(e) => {
              setQualityInspectionId(e.target.value)
              markDirty()
            }}
            disabled={!editable}
          >
            <option value="">—</option>
            {inspections.map((q) => (
              <option key={q.id} value={q.id}>
                {q.documentNumber}
              </option>
            ))}
          </Select>
        </ErpFieldRow>

        <ErpFormSpan span={3}>
          <p className="erp-field-group__label">Logistics &amp; flags</p>
        </ErpFormSpan>
        <ErpFieldRow label="Transport Details" colSpan={2}>
          <Input
            value={transportDetails}
            onChange={(e) => {
              setTransportDetails(e.target.value)
              markDirty()
            }}
            disabled={!editable}
            placeholder="Vehicle / transporter"
          />
        </ErpFieldRow>
        <ErpFieldRow label="Flags">
          <div className="flex flex-col gap-1.5 pt-1">
            <Checkbox
              label="Debit note required"
              checked={debitNoteRequired}
              onChange={(e) => {
                setDebitNoteRequired(e.target.checked)
                markDirty()
              }}
              disabled={!editable}
            />
            <Checkbox
              label="Replacement required"
              checked={replacementRequired}
              onChange={(e) => {
                setReplacementRequired(e.target.checked)
                markDirty()
              }}
              disabled={!editable}
            />
          </div>
        </ErpFieldRow>
        <ErpFieldRow label="Remarks" colSpan={3}>
          <Textarea
            value={remarks}
            onChange={(e) => {
              setRemarks(e.target.value)
              markDirty()
            }}
            disabled={!editable}
            rows={2}
          />
        </ErpFieldRow>
      </ErpCardSection>

      <ErpCardSection
        title="Return Lines"
        subtitle="Items, quantities, cost, and per-line return reason"
        icon={Package}
        accent="teal"
        collapsible
        defaultOpen
        dense
        columns={1}
        badge={
          <span className="text-[11px] tabular-nums text-erp-muted">
            {summary.lineCount} line{summary.lineCount === 1 ? '' : 's'}
          </span>
        }
      >
        <PurchaseTableToolbar>
          {editable ? (
            <ErpButton
              type="button"
              size="sm"
              variant="secondary"
              icon={Plus}
              onClick={() => setLinesDirty([...lines, emptyLine({ reason: returnReason })])}
            >
              Add Line
            </ErpButton>
          ) : null}
          <span className="text-[12px] tabular-nums text-erp-muted">
            Qty {summary.returnQty} · {formatCurrency(summary.total)}
          </span>
        </PurchaseTableToolbar>
        {lines.length === 0 ? (
          <EmptyState icon={Plus} title="No lines" description="Add items to return." />
        ) : (
          <div className="overflow-x-auto">
            <table className="quo-editor-price__table w-full min-w-[1100px]">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Batch / Serial</th>
                  <th>Recv</th>
                  <th>Avail</th>
                  <th>Return Qty</th>
                  <th>UOM</th>
                  <th>Unit Cost</th>
                  <th>Tax %</th>
                  <th>Amount</th>
                  <th>Reason</th>
                  <th>Repl Qty</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.key}>
                    <td>
                      <Select
                        value={l.itemId}
                        onChange={(e) => applyItem(l.key, e.target.value)}
                        disabled={!editable}
                      >
                        <option value="">Item…</option>
                        {items.map((it) => (
                          <option key={it.id} value={it.id}>
                            {it.itemCode} — {it.itemName}
                          </option>
                        ))}
                      </Select>
                      <Input
                        className="mt-1"
                        value={l.description}
                        onChange={(e) => patchLine(l.key, { description: e.target.value })}
                        disabled={!editable}
                        placeholder="Description"
                      />
                    </td>
                    <td>
                      <Input
                        value={l.batchLotNo}
                        onChange={(e) => patchLine(l.key, { batchLotNo: e.target.value })}
                        disabled={!editable}
                        placeholder="Batch"
                      />
                      <Input
                        className="mt-1"
                        value={l.serialNumber}
                        onChange={(e) => patchLine(l.key, { serialNumber: e.target.value })}
                        disabled={!editable}
                        placeholder="Serial"
                      />
                    </td>
                    <td className="tabular-nums">{l.receivedQty}</td>
                    <td className="tabular-nums">{l.availableReturnQty}</td>
                    <td>
                      <Input
                        type="number"
                        value={l.returnQty}
                        onChange={(e) => patchLine(l.key, { returnQty: Number(e.target.value) || 0 })}
                        disabled={!editable}
                      />
                    </td>
                    <td>{l.uom}</td>
                    <td>
                      <Input
                        type="number"
                        value={l.unitCost}
                        onChange={(e) => patchLine(l.key, { unitCost: Number(e.target.value) || 0 })}
                        disabled={!editable}
                      />
                    </td>
                    <td className="tabular-nums">{l.gstRatePct}%</td>
                    <td className="tabular-nums">{formatCurrency(lineTotal(l))}</td>
                    <td>
                      <Select
                        value={l.reason}
                        onChange={(e) =>
                          patchLine(l.key, { reason: e.target.value as PurchaseReturnReason })
                        }
                        disabled={!editable}
                      >
                        {Object.entries(PURCHASE_RETURN_REASON_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td>
                      <Input
                        type="number"
                        value={l.replacementQty}
                        onChange={(e) =>
                          patchLine(l.key, { replacementQty: Number(e.target.value) || 0 })
                        }
                        disabled={!editable}
                      />
                    </td>
                    <td>
                      {editable ? (
                        <button
                          type="button"
                          className="rounded p-1 text-erp-danger-fg hover:bg-red-50"
                          onClick={() => setLinesDirty(lines.filter((x) => x.key !== l.key))}
                          aria-label="Remove line"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ErpCardSection>

      <ErpCardSection
        title="Financial Summary"
        subtitle="Estimated taxable, GST, and return amount from lines"
        collapsedSummary={financePeek || undefined}
        icon={Banknote}
        accent="amber"
        collapsible
        defaultOpen={financeDefaultOpen}
        dense
        columns={1}
      >
        <PurchaseTaxTotalsPanel
          charges={[
            {
              id: 'taxable',
              label: 'Taxable Amount',
              kind: 'value',
              value: formatCurrency(summary.taxable),
            },
          ]}
          chargesHeading="Estimate"
          calcRows={[
            {
              id: 'gst',
              label: 'GST',
              value: formatCurrency(summary.tax),
            },
          ]}
          grandTotalLabel="Est. Total"
          grandTotalValue={formatCurrency(summary.total)}
          footer={
            <div className="flex flex-wrap items-center gap-3 text-[12px] text-erp-muted">
              <span className="inline-flex items-center gap-1">
                <Link2 className="h-3.5 w-3.5" />
                Origin: {PURCHASE_RETURN_ORIGIN_LABELS[origin]}
              </span>
            </div>
          }
        />
      </ErpCardSection>
    </PurchaseCardFormShell>
  )
}
