import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Banknote,
  ClipboardList,
  FileText,
  GitCompare,
  Package,
  Plus,
  StickyNote,
  Trash2,
  Truck,
  Building2,
  Wrench,
  Zap,
} from 'lucide-react'
import { PurchaseCardFormShell } from '@/components/purchase/PurchaseCardFormShell'
import {
  PurchaseDocumentFactBox,
  buildPurchaseRelatedLinks,
  purchaseDocumentApprovalFact,
} from '@/components/purchase/PurchaseDocumentFactBox'
import { purchaseStatusTone } from '@/components/purchase/purchaseCardFormShared'
import { PurchaseTermSelect } from '@/components/purchase/PurchaseTermSelect'
import { PurchaseTaxTotalsPanel } from '@/components/purchase/PurchaseTaxTotalsPanel'
import {
  ErpCardSection,
  ErpFieldRow,
  ErpFormSpan,
} from '@/components/erp/card-form'
import { ErpButton } from '@/components/erp/ErpButton'
import { FormActionBar } from '@/components/erp/FormActionBar'
import { Input, Select, Textarea } from '@/components/forms/Inputs'
import { Badge } from '@/components/ui/Badge'
import {
  commercialTermsSummary,
  hasMeaningfulTaxTotals,
  notesSummary,
  taxTotalsSummary,
} from '@/modules/purchase/purchaseFastTabSummaries'
import { LoadingState } from '@/design-system/components/LoadingState'
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard'
import {
  createDirectPurchaseInvoice,
  createPurchaseInvoice,
  createPurchaseInvoiceFromGrn,
  createPurchaseInvoiceFromPo,
  createPurchaseInvoiceFromServicePo,
  getGRNs,
  getPurchaseInvoiceById,
  getPurchaseItems,
  getPurchaseOrders,
  getPurchaseSetup,
  getVendors,
  previewNextPurchaseInvoiceNumber,
  PurchaseServiceError,
  PURCHASE_INVOICE_ORIGIN_LABELS,
  PURCHASE_INVOICE_STATUS_LABELS,
  updatePurchaseInvoice,
} from '@/services/purchase'
import type {
  GoodsReceiptNote,
  PurchaseInvoice,
  PurchaseInvoiceLine,
  PurchaseInvoiceOrigin,
  PurchaseItem,
  PurchaseOrder,
  PurchaseSetup,
  Vendor,
} from '@/types/purchaseDomain'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { cn } from '@/utils/cn'
import { PURCHASE_PAYMENT_TERMS } from '@/data/purchase/purchaseCommercialTerms'
import { PURCHASE_FORM_ROUTES } from './purchaseFormRoutes'

type EditorLine = PurchaseInvoiceLine & { key: string }

const ORIGINS: { id: PurchaseInvoiceOrigin; label: string; icon: typeof FileText }[] = [
  { id: 'purchase_order', label: 'Purchase Order', icon: FileText },
  { id: 'goods_receipt', label: 'Posted GRN', icon: Package },
  { id: 'vendor_invoice', label: 'Vendor Invoice', icon: Truck },
  { id: 'service_po', label: 'Service PO', icon: Wrench },
  { id: 'direct', label: 'Direct Invoice', icon: Zap },
]

function today() {
  return new Date().toISOString().slice(0, 10)
}

function emptyLine(partial?: Partial<PurchaseInvoiceLine>): EditorLine {
  return {
    key: crypto.randomUUID(),
    id: '',
    lineNo: 1,
    purchaseOrderLineId: null,
    goodsReceiptLineId: null,
    poLineNo: null,
    grnLineNo: null,
    itemId: '',
    itemCode: '',
    itemName: '',
    description: '',
    uom: 'NOS',
    hsnCode: '',
    sacCode: null,
    quantity: 1,
    rate: 0,
    discountAmount: 0,
    taxableAmount: 0,
    gstRatePct: 18,
    cgst: 0,
    sgst: 0,
    igst: 0,
    tdsAmount: 0,
    tcsAmount: 0,
    lineTotal: 0,
    costCentre: '',
    project: '',
    account: '5110-RM Purchases',
    remarks: '',
    ...partial,
  }
}

function fromInvoiceLines(lines: PurchaseInvoiceLine[]): EditorLine[] {
  return lines.map((l) => ({ ...l, key: l.id || crypto.randomUUID() }))
}

export function PurchaseInvoiceEditorPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const isNew = !id || id === 'new'

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [invoice, setInvoice] = useState<PurchaseInvoice | null>(null)
  const [previewDocumentNumber, setPreviewDocumentNumber] = useState<string | null>(null)
  const [origin, setOrigin] = useState<PurchaseInvoiceOrigin>('purchase_order')
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [items, setItems] = useState<PurchaseItem[]>([])
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [grns, setGrns] = useState<GoodsReceiptNote[]>([])
  const [setup, setSetup] = useState<PurchaseSetup | null>(null)

  const [vendorId, setVendorId] = useState('')
  const [vendorInvoiceNumber, setVendorInvoiceNumber] = useState('')
  const [vendorInvoiceDate, setVendorInvoiceDate] = useState(today())
  const [documentDate, setDocumentDate] = useState(today())
  const [postingDate, setPostingDate] = useState(today())
  const [dueDate, setDueDate] = useState('')
  const [placeOfSupply, setPlaceOfSupply] = useState('')
  const [paymentTerms, setPaymentTerms] = useState('Net 30')
  const [reverseCharge, setReverseCharge] = useState(false)
  const [eInvoiceReference, setEInvoiceReference] = useState('')
  const [remarks, setRemarks] = useState('')
  const [purchaseOrderId, setPurchaseOrderId] = useState('')
  const [goodsReceiptId, setGoodsReceiptId] = useState('')
  const [lines, setLines] = useState<EditorLine[]>([emptyLine()])
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const {
    markDirty: markGuardDirty,
    resetDirty,
  } = useUnsavedChangesGuard(true)

  useEffect(() => {
    if (dirty && !saving) markGuardDirty()
    else resetDirty()
  }, [dirty, markGuardDirty, resetDirty, saving])

  const canDirect =
    setup?.allowDirectInvoice || true /* demo admin session — gate still enforced in service */

  const selectedVendor = useMemo(
    () => vendors.find((v) => v.id === vendorId) ?? null,
    [vendors, vendorId],
  )

  const poNumber =
    orders.find((o) => o.id === purchaseOrderId)?.documentNumber ??
    invoice?.purchaseOrderNumber ??
    ''
  const grnNumber =
    grns.find((g) => g.id === goodsReceiptId)?.documentNumber ??
    invoice?.goodsReceiptNumber ??
    ''

  const loadRefs = useCallback(async () => {
    const [v, i, o, g, s] = await Promise.all([
      getVendors(),
      getPurchaseItems(),
      getPurchaseOrders(),
      getGRNs(),
      getPurchaseSetup(),
    ])
    setVendors(v)
    setItems(i)
    setOrders(o.filter((x) => !['cancelled', 'draft'].includes(x.status)))
    setGrns(g.filter((x) => x.status === 'posted'))
    setSetup(s)
  }, [])

  const applyInvoice = (row: PurchaseInvoice) => {
    setInvoice(row)
    setOrigin(row.origin)
    setVendorId(row.vendor.id)
    setVendorInvoiceNumber(row.vendorInvoiceNumber)
    setVendorInvoiceDate(row.vendorInvoiceDate)
    setDocumentDate(row.documentDate)
    setPostingDate(row.postingDate)
    setDueDate(row.dueDate ?? '')
    setPlaceOfSupply(row.placeOfSupply)
    setPaymentTerms(row.paymentTerms)
    setReverseCharge(row.reverseCharge)
    setEInvoiceReference(row.eInvoiceReference ?? '')
    setRemarks(row.remarks)
    setPurchaseOrderId(row.purchaseOrderId ?? '')
    setGoodsReceiptId(row.goodsReceiptId ?? '')
    setLines(fromInvoiceLines(row.lines.length ? row.lines : [emptyLine()]))
    setDirty(false)
  }

  useEffect(() => {
    void (async () => {
      await loadRefs()
      const fromPo = searchParams.get('fromPo')
      const fromGrn = searchParams.get('fromGrn')
      const fromServicePo = searchParams.get('fromServicePo')
      const originParam = searchParams.get('origin') as PurchaseInvoiceOrigin | null

      try {
        if (!isNew && id) {
          setLoading(true)
          const row = await getPurchaseInvoiceById(id)
          if (!row) {
            notify.error('Invoice not found')
            navigate('/purchase/invoices')
            return
          }
          applyInvoice(row)
          return
        }

        if (fromPo) {
          const created = await createPurchaseInvoiceFromPo(fromPo)
          navigate(`/purchase/invoices/${created.id}/edit`, { replace: true })
          return
        }
        if (fromGrn) {
          const created = await createPurchaseInvoiceFromGrn(fromGrn)
          navigate(`/purchase/invoices/${created.id}/edit`, { replace: true })
          return
        }
        if (fromServicePo) {
          const created = await createPurchaseInvoiceFromServicePo(fromServicePo)
          navigate(`/purchase/invoices/${created.id}/edit`, { replace: true })
          return
        }
        if (originParam) setOrigin(originParam)
        const nextNumber = await previewNextPurchaseInvoiceNumber().catch(() => null)
        if (nextNumber) setPreviewDocumentNumber(nextNumber)
      } catch (err) {
        notify.error(err instanceof PurchaseServiceError ? err.message : 'Failed to start invoice')
      } finally {
        setLoading(false)
      }
    })()
  }, [id, isNew, loadRefs, navigate, searchParams])

  const patchLine = (key: string, patch: Partial<EditorLine>) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.key !== key) return l
        const next = { ...l, ...patch }
        if (patch.itemId) {
          const item = items.find((i) => i.id === patch.itemId)
          if (item) {
            next.itemCode = item.itemCode
            next.itemName = item.itemName
            next.description = item.itemName
            next.uom = item.uom
            next.hsnCode = item.hsnCode
            next.sacCode = item.sacCode
            next.gstRatePct = item.gstRatePct
            next.rate = item.standardRate || next.rate
          }
        }
        const gross = next.quantity * next.rate
        next.taxableAmount = Number(Math.max(0, gross - next.discountAmount).toFixed(2))
        const tax = Number(((next.taxableAmount * next.gstRatePct) / 100).toFixed(2))
        next.lineTotal = Number((next.taxableAmount + tax + next.tcsAmount - next.tdsAmount).toFixed(2))
        return next
      }),
    )
    setDirty(true)
  }

  const buildInput = () => ({
    vendorId,
    vendorInvoiceNumber,
    vendorInvoiceDate,
    origin,
    purchaseOrderId: purchaseOrderId || null,
    goodsReceiptId: goodsReceiptId || null,
    documentDate,
    postingDate,
    dueDate: dueDate || null,
    placeOfSupply,
    paymentTerms,
    reverseCharge,
    eInvoiceReference: eInvoiceReference || null,
    remarks,
    lines: lines
      .filter((l) => l.itemId)
      .map((l) => ({
        itemId: l.itemId,
        quantity: l.quantity,
        rate: l.rate,
        discountAmount: l.discountAmount,
        gstRatePct: l.gstRatePct,
        tdsAmount: l.tdsAmount,
        tcsAmount: l.tcsAmount,
        description: l.description,
        purchaseOrderLineId: l.purchaseOrderLineId,
        goodsReceiptLineId: l.goodsReceiptLineId,
        costCentre: l.costCentre,
        project: l.project,
        account: l.account,
        remarks: l.remarks,
      })),
  })

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!vendorId) errs.vendorId = 'Vendor is required'
    if (!vendorInvoiceNumber.trim()) errs.vendorInvoiceNumber = 'Vendor invoice number is required'
    if (!lines.some((l) => l.itemId && l.quantity > 0)) errs.lines = 'Add at least one line'
    if (origin === 'direct' && !canDirect) errs.origin = 'Direct invoice not permitted'
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  const saveDraft = async () => {
    if (saving) return
    if (!validate()) {
      notify.error('Fix validation errors')
      return
    }
    setSaving(true)
    try {
      const input = buildInput()
      let row: PurchaseInvoice
      if (isNew || !invoice) {
        row =
          origin === 'direct'
            ? await createDirectPurchaseInvoice(input)
            : await createPurchaseInvoice(input)
        notify.success(`Saved · ${row.documentNumber}`)
        setDirty(false)
        resetDirty()
      } else {
        row = await updatePurchaseInvoice(invoice.id, input)
        applyInvoice(row)
        setDirty(false)
        resetDirty()
        notify.success(`Saved · ${row.documentNumber}`)
      }
      navigate(PURCHASE_FORM_ROUTES.purchaseInvoice.list, { replace: true })
    } catch (err) {
      notify.error(err instanceof PurchaseServiceError ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const totals = useMemo(() => {
    const taxableAmount = lines.reduce((s, l) => s + (Number(l.taxableAmount) || 0), 0)
    const tax = lines.reduce(
      (s, l) => s + Number((((Number(l.taxableAmount) || 0) * (Number(l.gstRatePct) || 0)) / 100).toFixed(2)),
      0,
    )
    const tdsAmount = lines.reduce((s, l) => s + (Number(l.tdsAmount) || 0), 0)
    const tcsAmount = lines.reduce((s, l) => s + (Number(l.tcsAmount) || 0), 0)
    const totalAmount = lines.reduce((s, l) => s + (Number(l.lineTotal) || 0), 0)
    const filledLines = lines.filter((l) => l.itemId).length
    return { taxableAmount, tax, tdsAmount, tcsAmount, totalAmount, filledLines, lineCount: lines.length }
  }, [lines])

  const showTcs =
    Boolean(setup?.tax.tcsEnabled) || totals.tcsAmount > 0 || lines.some((l) => Number(l.tcsAmount) > 0)
  const showTds =
    Boolean(setup?.tax.tdsEnabled) || totals.tdsAmount > 0 || lines.some((l) => Number(l.tdsAmount) > 0)

  const documentTitle = isNew
    ? 'New Purchase Invoice'
    : (invoice?.documentNumber ?? 'Purchase Invoice')
  const vendorFact = selectedVendor?.vendorName || 'Not selected'

  const recordHeaderFacts = useMemo(
    () => [
      ...(isNew
        ? [{ label: 'Invoice No', value: invoice?.documentNumber ?? previewDocumentNumber ?? 'Loading…' }]
        : []),
      { label: 'Vendor', value: vendorFact },
      ...(poNumber ? [{ label: 'PO', value: poNumber }] : []),
      ...(grnNumber ? [{ label: 'GRN', value: grnNumber }] : []),
      {
        label: 'Date',
        value: documentDate ? formatDate(documentDate) : 'Not selected',
      },
    ],
    [isNew, invoice?.documentNumber, previewDocumentNumber, vendorFact, poNumber, grnNumber, documentDate],
  )

  const taxTotalsDefaultOpen = hasMeaningfulTaxTotals(
    totals.taxableAmount,
    totals.tax,
    totals.totalAmount,
  )
  const commercialPeek = useMemo(
    () =>
      commercialTermsSummary({
        paymentTerms,
        dueDate,
      }),
    [paymentTerms, dueDate],
  )
  const taxPeek = useMemo(
    () =>
      taxTotalsSummary({
        subtotal: totals.taxableAmount,
        tax: totals.tax,
        total: totals.totalAmount,
      }),
    [totals.taxableAmount, totals.tax, totals.totalAmount],
  )
  const notesPeek = useMemo(() => notesSummary(remarks), [remarks])

  const statusLabel = invoice ? PURCHASE_INVOICE_STATUS_LABELS[invoice.status] : 'Draft'

  const documentFactBox = useMemo(() => {
    const approval = purchaseDocumentApprovalFact(invoice?.status ?? 'draft', invoice?.approver?.name)
    const firstLine = lines.find((l) => l.itemId || l.itemCode.trim() || l.itemName.trim())
    return (
      <PurchaseDocumentFactBox
        vendor={
          selectedVendor
            ? {
                id: selectedVendor.id,
                code: selectedVendor.vendorCode,
                name: selectedVendor.vendorName,
                rating: selectedVendor.rating,
                paymentTerms: paymentTerms || selectedVendor.paymentTerms,
                leadTimeDays: selectedVendor.leadTimeDays,
              }
            : null
        }
        purchaseHistory={{
          lastPurchasePrice: firstLine && Number(firstLine.rate) > 0 ? Number(firstLine.rate) : null,
          lastVendorName: selectedVendor?.vendorName ?? null,
          averageLeadTimeDays: selectedVendor?.leadTimeDays ?? null,
        }}
        documentStatus={{
          statusLabel,
          ...approval,
          createdBy: invoice?.createdBy ?? null,
          modifiedBy: invoice?.updatedBy ?? null,
          modifiedDate: invoice?.updatedAt ? formatDate(invoice.updatedAt.slice(0, 10)) : null,
        }}
        related={buildPurchaseRelatedLinks({
          purchaseOrderId: purchaseOrderId || null,
          purchaseOrderNumber: poNumber || null,
          goodsReceiptId: goodsReceiptId || null,
          goodsReceiptNumber: grnNumber || null,
        })}
      />
    )
  }, [
    invoice,
    lines,
    selectedVendor,
    paymentTerms,
    statusLabel,
    purchaseOrderId,
    poNumber,
    goodsReceiptId,
    grnNumber,
  ])

  if (loading) {
    return (
      <PurchaseCardFormShell
        title="Purchase Invoice"
        description="Loading…"
        status="…"
        favoritePath="/purchase/invoices"
        breadcrumbs={[
          { label: 'Purchase', to: '/purchase' },
          { label: 'Invoices', to: '/purchase/invoices' },
          { label: 'Loading' },
        ]}
        footer={null}
      >
        <LoadingState variant="form" rows={10} />
      </PurchaseCardFormShell>
    )
  }

  return (
    <PurchaseCardFormShell
      title={isNew ? 'New Purchase Invoice' : `Edit ${invoice?.documentNumber ?? 'Purchase Invoice'}`}
      description="Vendor invoice capture, matching origin, and verify flow"
      recordNo={invoice?.documentNumber ?? (isNew ? 'New' : undefined)}
      recordTitle={documentTitle}
      status={statusLabel}
      statusTone={purchaseStatusTone(invoice?.status ?? 'draft')}
      statusKey={invoice?.status ?? 'draft'}
      recordHeaderFacts={recordHeaderFacts}
      company={selectedVendor?.vendorName}
      favoritePath={invoice ? `/purchase/invoices/${invoice.id}/edit` : '/purchase/invoices/new'}
      breadcrumbs={[
        { label: 'Invoices', to: '/purchase/invoices' },
        { label: isNew ? 'New' : invoice?.documentNumber ?? 'Edit' },
      ]}
      commandBar={null}
      factBox={documentFactBox}
      collapsibleFactBox
      stickyFooter
      footer={
        <FormActionBar
          sticky
          cancelFirst
          busy={saving}
          dirty={dirty}
          onCancel={() => {
            setDirty(false)
            resetDirty()
            navigate(PURCHASE_FORM_ROUTES.purchaseInvoice.list)
          }}
          onSave={saveDraft}
        />
      }
      onSaveShortcut={() => void saveDraft()}
    >
      {isNew ? (
        <ErpCardSection
          title="Origin"
          subtitle="Choose how this purchase invoice is created — source selection only on new drafts"
          icon={ClipboardList}
          accent="slate"
          collapsible
          defaultOpen
          dense
          columns={1}
        >
          <ErpFormSpan span={1}>
            <p className="mb-2 text-[12px] text-erp-muted">
              PO / GRN / Service PO create a draft from the selected source, then open the editor. Vendor Invoice and
              Direct let you enter lines manually.
            </p>
            <div
              className="mb-3 flex flex-wrap gap-1.5"
              role="tablist"
              aria-label="Purchase invoice origin"
            >
              {ORIGINS.map((o) => {
                const Icon = o.icon
                const disabled = o.id === 'direct' && setup && !setup.allowDirectInvoice
                return (
                  <button
                    key={o.id}
                    type="button"
                    role="tab"
                    aria-selected={origin === o.id}
                    disabled={Boolean(disabled) && isNew}
                    onClick={() => {
                      setOrigin(o.id)
                      setDirty(true)
                    }}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-[12px] font-medium transition-colors',
                      origin === o.id
                        ? 'border-erp-primary bg-erp-primary text-white'
                        : 'border-erp-border bg-erp-surface text-erp-text hover:border-erp-primary hover:bg-erp-primary-soft',
                      disabled && isNew && 'opacity-50',
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {o.label}
                  </button>
                )
              })}
            </div>
            {fieldErrors.origin ? (
              <p className="mb-2 text-[12px] text-erp-danger-fg">{fieldErrors.origin}</p>
            ) : null}
          </ErpFormSpan>

          {origin === 'purchase_order' ? (
            <ErpFieldRow label="Source PO">
              <Select
                value={purchaseOrderId}
                onChange={async (e) => {
                  const poId = e.target.value
                  setPurchaseOrderId(poId)
                  if (!poId) return
                  try {
                    const created = await createPurchaseInvoiceFromPo(poId)
                    navigate(`/purchase/invoices/${created.id}/edit`, { replace: true })
                  } catch (err) {
                    notify.error(err instanceof PurchaseServiceError ? err.message : 'Failed')
                  }
                }}
                className="max-w-md"
              >
                <option value="">Select released / receivable PO…</option>
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.documentNumber} — {o.vendor.name}
                  </option>
                ))}
              </Select>
            </ErpFieldRow>
          ) : null}

          {origin === 'goods_receipt' ? (
            <ErpFieldRow label="Posted GRN">
              <Select
                value={goodsReceiptId}
                onChange={async (e) => {
                  const grnId = e.target.value
                  setGoodsReceiptId(grnId)
                  if (!grnId) return
                  try {
                    const created = await createPurchaseInvoiceFromGrn(grnId)
                    navigate(`/purchase/invoices/${created.id}/edit`, { replace: true })
                  } catch (err) {
                    notify.error(err instanceof PurchaseServiceError ? err.message : 'Failed')
                  }
                }}
                className="max-w-md"
              >
                <option value="">Select posted GRN…</option>
                {grns.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.documentNumber} — {g.vendor.name} ({g.purchaseOrderNumber})
                  </option>
                ))}
              </Select>
            </ErpFieldRow>
          ) : null}

          {origin === 'service_po' ? (
            <ErpFieldRow label="Service PO">
              <Select
                value={purchaseOrderId}
                onChange={async (e) => {
                  const poId = e.target.value
                  setPurchaseOrderId(poId)
                  if (!poId) return
                  try {
                    const created = await createPurchaseInvoiceFromServicePo(poId)
                    navigate(`/purchase/invoices/${created.id}/edit`, { replace: true })
                  } catch (err) {
                    notify.error(err instanceof PurchaseServiceError ? err.message : 'Failed')
                  }
                }}
                className="max-w-md"
              >
                <option value="">Select service PO…</option>
                {orders
                  .filter((o) => o.orderType === 'service' || o.lines.every((l) => l.itemType === 'service'))
                  .map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.documentNumber} — {o.vendor.name}
                    </option>
                  ))}
              </Select>
            </ErpFieldRow>
          ) : null}

          {origin === 'vendor_invoice' || origin === 'direct' ? (
            <ErpFormSpan span={1}>
              <p className="text-[13px] text-erp-muted">
                Fill Document, Vendor, and Lines below to enter the invoice
                {origin === 'direct' ? ' without a PO/GRN link' : ''}.
              </p>
            </ErpFormSpan>
          ) : null}
        </ErpCardSection>
      ) : null}

      <ErpCardSection
        title="Document & Vendor"
        subtitle="Vendor invoice identity, posting dates, and commercial terms"
        collapsedSummary={commercialPeek || undefined}
        icon={Building2}
        accent="blue"
        collapsible
        defaultOpen
        dense
      >
        <ErpFormSpan span={3}>
          <p className="erp-field-group__label">Document</p>
        </ErpFormSpan>
        <ErpFieldRow
          label="Invoice Number"
          readOnly
          hint={isNew && !invoice ? 'Preview from number series — assigned when you save' : undefined}
        >
          <Input
            value={invoice?.documentNumber ?? previewDocumentNumber ?? ''}
            placeholder="Loading number…"
            readOnly
            className="bg-erp-surface-alt"
          />
        </ErpFieldRow>
        <ErpFieldRow label="Document Date">
          <Input
            type="date"
            value={documentDate}
            onChange={(e) => {
              setDocumentDate(e.target.value)
              setDirty(true)
            }}
          />
        </ErpFieldRow>
        <ErpFieldRow label="Posting Date">
          <Input
            type="date"
            value={postingDate}
            onChange={(e) => {
              setPostingDate(e.target.value)
              setDirty(true)
            }}
          />
        </ErpFieldRow>
        <ErpFieldRow label="Origin" readOnly>
          <Input value={PURCHASE_INVOICE_ORIGIN_LABELS[origin]} readOnly className="bg-erp-surface-alt" />
        </ErpFieldRow>
        <ErpFieldRow label="Currency" readOnly>
          <Input value="INR" readOnly className="bg-erp-surface-alt" />
        </ErpFieldRow>
        <ErpFieldRow label="E-Invoice Reference">
          <Input
            value={eInvoiceReference}
            onChange={(e) => {
              setEInvoiceReference(e.target.value)
              setDirty(true)
            }}
          />
        </ErpFieldRow>

        <ErpFormSpan span={3}>
          <p className="erp-field-group__label">Vendor</p>
        </ErpFormSpan>
        <ErpFieldRow label="Vendor" required fieldError={fieldErrors.vendorId}>
          <Select
            value={vendorId}
            onChange={(e) => {
              setVendorId(e.target.value)
              const v = vendors.find((x) => x.id === e.target.value)
              if (v) {
                setPlaceOfSupply(v.state)
                setPaymentTerms(v.paymentTerms)
              }
              setDirty(true)
            }}
          >
            <option value="">Select vendor…</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.vendorName}
              </option>
            ))}
          </Select>
        </ErpFieldRow>
        <ErpFieldRow label="GST Number" readOnly>
          <Input
            value={selectedVendor?.gstin ?? ''}
            readOnly
            className="bg-erp-surface-alt font-mono"
          />
        </ErpFieldRow>
        <ErpFieldRow
          label="Vendor Invoice Number"
          required
          fieldError={fieldErrors.vendorInvoiceNumber}
        >
          <Input
            value={vendorInvoiceNumber}
            onChange={(e) => {
              setVendorInvoiceNumber(e.target.value)
              setDirty(true)
            }}
          />
        </ErpFieldRow>
        <ErpFieldRow label="Vendor Invoice Date">
          <Input
            type="date"
            value={vendorInvoiceDate}
            onChange={(e) => {
              setVendorInvoiceDate(e.target.value)
              setDirty(true)
            }}
          />
        </ErpFieldRow>
        <ErpFieldRow label="Place of Supply">
          <Input
            value={placeOfSupply}
            onChange={(e) => {
              setPlaceOfSupply(e.target.value)
              setDirty(true)
            }}
          />
        </ErpFieldRow>
        <ErpFieldRow label="Reverse Charge">
          <Select
            value={reverseCharge ? '1' : '0'}
            onChange={(e) => {
              setReverseCharge(e.target.value === '1')
              setDirty(true)
            }}
          >
            <option value="0">No</option>
            <option value="1">Yes</option>
          </Select>
        </ErpFieldRow>

        <ErpFormSpan span={3}>
          <p className="erp-field-group__label">Match origin</p>
        </ErpFormSpan>
        <ErpFieldRow label="PO Number" readOnly>
          <Input value={poNumber || '—'} readOnly className="bg-erp-surface-alt" />
        </ErpFieldRow>
        <ErpFieldRow label="GRN Number" readOnly>
          <Input value={grnNumber || '—'} readOnly className="bg-erp-surface-alt" />
        </ErpFieldRow>
        <ErpFieldRow label="Payment Terms">
          <PurchaseTermSelect
            value={paymentTerms}
            options={PURCHASE_PAYMENT_TERMS}
            onChange={(v) => {
              setPaymentTerms(v)
              setDirty(true)
            }}
            emptyLabel="Select payment terms…"
          />
        </ErpFieldRow>
        <ErpFieldRow label="Due Date">
          <Input
            type="date"
            value={dueDate}
            onChange={(e) => {
              setDueDate(e.target.value)
              setDirty(true)
            }}
          />
        </ErpFieldRow>
      </ErpCardSection>

      <ErpCardSection
        title="Invoice Lines"
        subtitle="Item quantities, rates, GST, TDS/TCS — table scrolls horizontally on smaller screens"
        icon={Package}
        accent="green"
        collapsible
        defaultOpen
        dense
        columns={1}
      >
        <ErpFormSpan span={1}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="erp-field-group__label mb-0">Lines</p>
            <ErpButton
              type="button"
              size="sm"
              variant="secondary"
              icon={Plus}
              onClick={() => {
                setLines((prev) => [...prev, emptyLine({ lineNo: prev.length + 1 })])
                setDirty(true)
              }}
            >
              Add line
            </ErpButton>
          </div>
          {fieldErrors.lines ? (
            <p className="mb-2 text-[12px] text-erp-danger-fg">{fieldErrors.lines}</p>
          ) : null}
          <div className="overflow-x-auto rounded-md border border-erp-border">
            <table className="w-full min-w-[1100px] text-left text-[12px]">
              <thead className="border-b border-erp-border bg-erp-surface-alt text-erp-muted">
                <tr>
                  <th className="p-2">Item</th>
                  <th className="p-2">Qty</th>
                  <th className="p-2">Rate</th>
                  <th className="p-2">Disc</th>
                  <th className="p-2">GST%</th>
                  {showTds ? <th className="p-2">TDS</th> : null}
                  {showTcs ? <th className="p-2">TCS</th> : null}
                  <th className="p-2">Line Total</th>
                  <th className="p-2">Cost / Project</th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.key} className="border-b border-erp-border/60">
                    <td className="p-2">
                      <Select
                        value={line.itemId}
                        onChange={(e) => patchLine(line.key, { itemId: e.target.value })}
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
                        placeholder="Description"
                        value={line.description}
                        onChange={(e) => patchLine(line.key, { description: e.target.value })}
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        type="number"
                        value={line.quantity}
                        onChange={(e) => patchLine(line.key, { quantity: Number(e.target.value) || 0 })}
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        type="number"
                        value={line.rate}
                        onChange={(e) => patchLine(line.key, { rate: Number(e.target.value) || 0 })}
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        type="number"
                        value={line.discountAmount}
                        onChange={(e) =>
                          patchLine(line.key, { discountAmount: Number(e.target.value) || 0 })
                        }
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        type="number"
                        value={line.gstRatePct}
                        onChange={(e) => patchLine(line.key, { gstRatePct: Number(e.target.value) || 0 })}
                      />
                    </td>
                    {showTds ? (
                      <td className="p-2">
                        <Input
                          type="number"
                          value={line.tdsAmount}
                          onChange={(e) => patchLine(line.key, { tdsAmount: Number(e.target.value) || 0 })}
                        />
                      </td>
                    ) : null}
                    {showTcs ? (
                      <td className="p-2">
                        <Input
                          type="number"
                          value={line.tcsAmount}
                          onChange={(e) => patchLine(line.key, { tcsAmount: Number(e.target.value) || 0 })}
                        />
                      </td>
                    ) : null}
                    <td className="p-2 tabular-nums">{formatCurrency(line.lineTotal)}</td>
                    <td className="p-2">
                      <Input
                        placeholder="Cost centre"
                        value={line.costCentre}
                        onChange={(e) => patchLine(line.key, { costCentre: e.target.value })}
                      />
                      <Input
                        className="mt-1"
                        placeholder="Project"
                        value={line.project}
                        onChange={(e) => patchLine(line.key, { project: e.target.value })}
                      />
                    </td>
                    <td className="p-2">
                      <button
                        type="button"
                        className="rounded p-1 text-erp-danger-fg hover:bg-red-50"
                        onClick={() => {
                          setLines((prev) => prev.filter((l) => l.key !== line.key))
                          setDirty(true)
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ErpFormSpan>
      </ErpCardSection>

      <ErpCardSection
        title="Tax & Totals"
        subtitle="Provisional totals from line taxable amounts and GST"
        collapsedSummary={taxPeek || undefined}
        icon={Banknote}
        accent="amber"
        collapsible
        defaultOpen={taxTotalsDefaultOpen}
        dense
        columns={1}
      >
        <PurchaseTaxTotalsPanel
          charges={[
            {
              id: 'taxable',
              label: 'Taxable Amount',
              kind: 'value',
              value: formatCurrency(totals.taxableAmount),
            },
            {
              id: 'tds',
              label: 'TDS',
              kind: 'value',
              value: formatCurrency(totals.tdsAmount),
              hidden: !showTds,
            },
            {
              id: 'tcs',
              label: 'TCS',
              kind: 'value',
              value: formatCurrency(totals.tcsAmount),
              hidden: !showTcs,
            },
          ]}
          calcRows={[
            {
              id: 'tax',
              label: 'Tax (GST)',
              value: formatCurrency(totals.tax),
            },
          ]}
          grandTotalValue={formatCurrency(totals.totalAmount)}
        />
      </ErpCardSection>

      <ErpCardSection
        title="Notes"
        subtitle="Internal remarks for approvers and AP"
        collapsedSummary={notesPeek || undefined}
        icon={StickyNote}
        accent="slate"
        collapsible
        defaultOpen={false}
        dense
        columns={1}
      >
        <ErpFormSpan span={1}>
          <p className="erp-field-group__label">Notes</p>
        </ErpFormSpan>
        <ErpFieldRow label="Remarks">
          <Textarea
            value={remarks}
            rows={3}
            onChange={(e) => {
              setRemarks(e.target.value)
              setDirty(true)
            }}
          />
        </ErpFieldRow>
      </ErpCardSection>

      {invoice ? (
        <ErpCardSection
          title="Matching snapshot"
          subtitle="Three-way match outcome after verify — open detail for full panel"
          icon={GitCompare}
          accent="violet"
          collapsible
          defaultOpen={false}
          dense
          columns={1}
        >
          <ErpFormSpan span={1}>
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                color={
                  invoice.matchStatus === 'matched'
                    ? 'green'
                    : invoice.matchStatus === 'mismatch'
                      ? 'yellow'
                      : 'gray'
                }
              >
                {invoice.matchingResultStatus}
              </Badge>
              {invoice.matchingExceptionApproved ? (
                <Badge color="blue">Exception approved by {invoice.exceptionApprovedBy}</Badge>
              ) : null}
            </div>
            <p className="mt-2 text-[12px] text-erp-muted">
              Open detail to view full three-way matching panel after verify.
            </p>
          </ErpFormSpan>
        </ErpCardSection>
      ) : null}
    </PurchaseCardFormShell>
  )
}
