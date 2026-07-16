import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Banknote,
  Building2,
  ClipboardList,
  FileImage,
  FileSpreadsheet,
  FileText,
  Paperclip,
  PenLine,
  Plus,
  ShieldAlert,
  Trash2,
} from 'lucide-react'
import { ErpCardSection, ErpFieldRow, ErpStickySaveBar } from '../../components/erp/card-form'
import { FactBoxPaneAiToggle } from '../../components/erp/card-form/FactBoxPaneAiToggle'
import {
  ENTERPRISE_FORM_CLASS,
  EnterpriseBusinessFactBox,
  EnterpriseFormContextPanel,
  EnterpriseFormMetrics,
  EnterpriseFormSectionNav,
} from '../../design-system/workspace'
import { SalesCardFormShell } from './SalesCardFormShell'
import { salesChildBreadcrumbs } from '../../utils/salesNavigation'
import { ErpSmartSelect } from '../../components/erp/ErpSmartSelect'
import { CommercialTermSelect } from '../../components/masters/GeographySelects'
import { QuickCreateSelect } from '../../components/quick-create/QuickCreateSelect'
import { Input, Textarea } from '../../components/forms/Inputs'
import { AppLink } from '../../components/ui/AppLink'
import { Toast } from '../../components/ui/Toast'
import { useSalesStore } from '../../store/salesStore'
import { useCrmStore } from '../../store/crmStore'
import { useMasterStore } from '../../store/masterStore'
import { useActiveCustomers, useActiveProducts } from '../../hooks/useMasterLists'
import { formatCurrency } from '../../utils/formatters/currency'
import { formatDate } from '../../utils/dates/format'
import { resolveOpportunitySalesOrderPrefill } from '../../utils/opportunitySalesOrderDraft'
import { buildSalesOrderLinesFromQuotationDocument } from '../../utils/crmQuotationSoLines'
import { LocationFieldRow } from '../../components/masters/LocationFieldRow'
import { useDocumentLocation } from '../../hooks/useDocumentLocation'
import { locationDisplayLabel } from '../../utils/locationUtils'

const GST_RATE_OPTIONS = [0, 5, 12, 18, 28] as const

interface SoLineDraft {
  key: string
  productId: string
  qty: number
  unitPrice: number
  discountPct: number
  taxPct: number
}

interface SoAttachment {
  id: string
  name: string
  kind: 'pdf' | 'image' | 'excel' | 'drawing' | 'customer_po'
  uploadedAt: string
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate.slice(0, 10))
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}

function computeLineTotals(line: SoLineDraft) {
  const taxableValue = round2(line.qty * line.unitPrice * (1 - line.discountPct / 100))
  const gstAmount = round2(taxableValue * (line.taxPct / 100))
  return { taxableValue, gstAmount, lineTotal: round2(taxableValue + gstAmount) }
}

function newLineDraft(productId = '', unitPrice = 0): SoLineDraft {
  return {
    key: crypto.randomUUID(),
    productId,
    qty: 1,
    unitPrice,
    discountPct: 0,
    taxPct: 18,
  }
}

function attachmentIcon(kind: SoAttachment['kind']) {
  if (kind === 'image') return FileImage
  if (kind === 'excel') return FileSpreadsheet
  if (kind === 'drawing') return PenLine
  return FileText
}

function detectAttachmentKind(fileName: string): SoAttachment['kind'] {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.webp')) {
    return 'image'
  }
  if (lower.endsWith('.xls') || lower.endsWith('.xlsx') || lower.endsWith('.csv')) return 'excel'
  if (lower.endsWith('.dwg') || lower.endsWith('.dxf')) return 'drawing'
  if (lower.includes('po') || lower.includes('purchase')) return 'customer_po'
  return 'pdf'
}

export function SalesOrderNewPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const opportunityIdParam = searchParams.get('opportunityId')
  const quotationDocumentIdParam = searchParams.get('quotationDocumentId')
  const duplicateCustomerId = searchParams.get('customerId')
  const duplicateProductId = searchParams.get('productId')
  const duplicateQty = Number(searchParams.get('qty') ?? '0')

  const opportunityPrefill = useMemo(
    () => (opportunityIdParam || quotationDocumentIdParam
      ? resolveOpportunitySalesOrderPrefill(opportunityIdParam, quotationDocumentIdParam)
      : null),
    [opportunityIdParam, quotationDocumentIdParam],
  )

  const createDirect = useSalesStore((s) => s.createDirectSalesOrder)
  const convertQuotation = useCrmStore((s) => s.convertQuotationDocumentToSalesOrder)
  const updateOpportunity = useCrmStore((s) => s.updateOpportunity)
  const quotationDocuments = useCrmStore((s) => s.quotationDocuments)
  const getQuotationDocument = useCrmStore((s) => s.getQuotationDocument)
  const getOpportunity = useCrmStore((s) => s.getOpportunity)
  const getQuotation = useSalesStore((s) => s.getQuotation)
  const customers = useActiveCustomers()
  const products = useActiveProducts()
  const getCustomer = useMasterStore((s) => s.getCustomer)
  const getProduct = useMasterStore((s) => s.getProduct)
  const locations = useMasterStore((s) => s.locations)

  const [activeSection, setActiveSection] = useState('customer')
  const [toast, setToast] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [customerId, setCustomerId] = useState(
    opportunityPrefill?.customerId ?? duplicateCustomerId ?? customers[0]?.id ?? '',
  )
  const [quotationDocumentId, setQuotationDocumentId] = useState(opportunityPrefill?.quotationDocumentId ?? '')
  const [lines, setLines] = useState<SoLineDraft[]>(() => {
    const productId = opportunityPrefill?.productId ?? duplicateProductId ?? products[0]?.id ?? ''
    const unitPrice = opportunityPrefill?.unitPrice ?? getProduct(productId)?.standardPrice ?? 0
    const qty = opportunityPrefill?.qty ?? (duplicateQty > 0 ? duplicateQty : 1)
    return [{ ...newLineDraft(productId, unitPrice), qty }]
  })
  const [customerPoNumber, setCustomerPoNumber] = useState('')
  const [customerPoDate, setCustomerPoDate] = useState('')
  const [paymentTerms, setPaymentTerms] = useState(opportunityPrefill?.paymentTerms ?? '30% advance, balance before dispatch')
  const [deliveryTerms, setDeliveryTerms] = useState(opportunityPrefill?.deliveryTerms ?? 'Ex-works Pune')
  const [directSoReason, setDirectSoReason] = useState(opportunityPrefill?.directSoReason ?? '')
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState(
    opportunityPrefill?.expectedDeliveryDate ?? addDays(new Date().toISOString(), 60),
  )
  const [deliveryLocation, setDeliveryLocation] = useState(opportunityPrefill?.deliveryLocation ?? '')
  const { locationId, setLocationId } = useDocumentLocation('sales', opportunityPrefill?.locationId)
  const [internalRemarks, setInternalRemarks] = useState(opportunityPrefill?.internalRemarks ?? '')
  const [freightAmount, setFreightAmount] = useState(0)
  const [orderDiscountAmount, setOrderDiscountAmount] = useState(0)
  const [attachments, setAttachments] = useState<SoAttachment[]>([])

  const customer = customerId ? getCustomer(customerId) : undefined
  const fromOpportunity = Boolean(opportunityPrefill)

  const quotationOptions = useMemo(() => {
    const latestByQuotation = new Map<string, (typeof quotationDocuments)[0]>()
    for (const doc of quotationDocuments) {
      const cur = latestByQuotation.get(doc.quotationId)
      if (!cur || doc.revisionNo > cur.revisionNo) latestByQuotation.set(doc.quotationId, doc)
    }
    return [...latestByQuotation.values()]
      .filter((d) => d.status === 'approved' || d.status === 'converted')
      .map((doc) => {
        const q = getQuotation(doc.quotationId)
        const cust = q ? customers.find((c) => c.id === q.customerId) : undefined
        return {
          value: doc.id,
          label: q?.quotationNo ?? doc.quotationId,
          searchText: `${q?.quotationNo ?? ''} ${cust?.customerName ?? ''} ${doc.salesOwnerName ?? ''}`.toLowerCase(),
          meta: cust?.customerName,
        }
      })
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [quotationDocuments, getQuotation, customers])

  const customerOptions = useMemo(
    () => customers.map((c) => ({ id: c.id, label: `${c.customerCode} · ${c.customerName}` })),
    [customers],
  )

  const productOptions = useMemo(
    () => products.map((p) => ({ id: p.id, label: `${p.productCode} · ${p.productName}` })),
    [products],
  )

  const computedLines = useMemo(
    () => lines.map((line) => {
      const totals = computeLineTotals(line)
      const product = line.productId ? getProduct(line.productId) : undefined
      return { ...line, ...totals, productName: product?.productName ?? '—' }
    }),
    [lines, getProduct],
  )

  const orderSummary = useMemo(() => {
    const totalQty = computedLines.reduce((s, l) => s + l.qty, 0)
    const basicAmount = round2(computedLines.reduce((s, l) => s + l.qty * l.unitPrice, 0))
    const subtotal = round2(computedLines.reduce((s, l) => s + l.taxableValue, 0))
    const totalLineDiscount = round2(basicAmount - subtotal)
    const gstByRate = new Map<number, number>()
    for (const line of computedLines) {
      gstByRate.set(line.taxPct, round2((gstByRate.get(line.taxPct) ?? 0) + line.gstAmount))
    }
    const totalGst = round2([...gstByRate.values()].reduce((s, v) => s + v, 0))
    const grandTotal = round2(subtotal + totalGst + freightAmount - orderDiscountAmount)
    return { totalQty, basicAmount, subtotal, totalLineDiscount, gstByRate, totalGst, grandTotal }
  }, [computedLines, freightAmount, orderDiscountAmount])

  function applyQuotation(docId: string) {
    if (!docId) return
    const doc = getQuotationDocument(docId)
    if (!doc) return
    const salesQuo = getQuotation(doc.quotationId)
    const opp = doc.opportunityId ? getOpportunity(doc.opportunityId) : null
    if (salesQuo) setCustomerId(salesQuo.customerId)
    setPaymentTerms(salesQuo?.paymentTerms ?? paymentTerms)
    setDeliveryTerms(salesQuo?.deliveryTerms ?? deliveryTerms)
    setFreightAmount(doc.freightAmount ?? 0)
    const built = buildSalesOrderLinesFromQuotationDocument({
      document: doc,
      opportunity: opp,
      salesQuotation: salesQuo,
      products,
      defaultProduct: products[0] ?? null,
    })
    if (built.length > 0) {
      setLines(built.map((l) => ({
        key: crypto.randomUUID(),
        productId: l.productId ?? products[0]?.id ?? '',
        qty: l.qty,
        unitPrice: l.unitPrice,
        discountPct: l.discountPct,
        taxPct: l.taxPct,
      })))
    }
    setQuotationDocumentId(docId)
    setDirectSoReason(`Approved quotation handover — ${salesQuo?.quotationNo ?? doc.quotationId}`)
    const inheritedLoc = doc.locationId ?? salesQuo?.locationId ?? opp?.locationId ?? null
    if (inheritedLoc) setLocationId(inheritedLoc)
    const loc = inheritedLoc ? locations.find((l) => l.id === inheritedLoc) : null
    if (loc) setDeliveryLocation(locationDisplayLabel(loc))
  }

  function updateLine(key: string, patch: Partial<SoLineDraft>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }

  function addLine() {
    const productId = products[0]?.id ?? ''
    setLines((prev) => [...prev, newLineDraft(productId, getProduct(productId)?.standardPrice ?? 0)])
  }

  function removeLine(key: string) {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((l) => l.key !== key)))
  }

  function handleAttachmentPick(e: React.ChangeEvent<HTMLInputElement>, kind?: SoAttachment['kind']) {
    const file = e.target.files?.[0]
    if (!file) return
    setAttachments((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: file.name,
        kind: kind ?? detectAttachmentKind(file.name),
        uploadedAt: new Date().toISOString(),
      },
    ])
    e.target.value = ''
  }

  function validate(): string[] {
    const errors: string[] = []
    if (!customerId) errors.push('Select a customer.')
    if (!lines.length) errors.push('Add at least one product line.')
    if (lines.some((l) => !l.productId)) errors.push('Every line needs a product.')
    if (lines.some((l) => !l.qty || l.qty < 1)) errors.push('Line quantities must be at least 1.')
    if (lines.some((l) => l.unitPrice <= 0)) errors.push('Line unit prices must be greater than zero.')
    if (!customerPoNumber.trim()) errors.push('Customer PO number is required.')
    if (!paymentTerms.trim()) errors.push('Payment terms are required.')
    if (!deliveryTerms.trim()) errors.push('Delivery terms are required.')
    if (directSoReason.trim().length < 10 && !(fromOpportunity && opportunityPrefill?.canConvertQuotation)) {
      errors.push('Provide a clear reason for direct SO (minimum 10 characters).')
    }
    return errors
  }

  async function persist(saveMode: 'save' | 'save_new') {
    const errors = validate()
    setValidationErrors(errors)
    if (errors.length) return

    setIsSubmitting(true)
    const attachmentNote = attachments.length
      ? `\nAttachments: ${attachments.map((a) => a.name).join(', ')}`
      : ''
    const locLabel = locations.find((l) => l.id === locationId)
    const handover = {
      customerPoNumber: customerPoNumber.trim(),
      customerPoDate: customerPoDate || undefined,
      expectedDeliveryDate: expectedDeliveryDate || undefined,
      deliveryLocation: (locLabel ? locationDisplayLabel(locLabel) : deliveryLocation.trim()) || undefined,
      locationId: locationId || undefined,
      internalRemarks: `${internalRemarks.trim()}${attachmentNote}`.trim() || undefined,
    }

    let r: { ok: boolean; error?: string; salesOrderId?: string }

    if (opportunityPrefill?.canConvertQuotation && opportunityPrefill.quotationDocumentId) {
      r = await Promise.resolve(convertQuotation(opportunityPrefill.quotationDocumentId, handover))
    } else {
      const primary = lines[0]
      const linkedDoc = quotationDocumentId ? getQuotationDocument(quotationDocumentId) : undefined
      const linkedQuo = linkedDoc ? getQuotation(linkedDoc.quotationId) : undefined
      r = createDirect({
        customerId,
        productId: primary.productId,
        qty: lines.reduce((s, l) => s + l.qty, 0),
        unitPrice: primary.unitPrice,
        customerPoNumber: customerPoNumber.trim(),
        paymentTerms: paymentTerms.trim(),
        deliveryTerms: deliveryTerms.trim(),
        directSoReason: directSoReason.trim(),
        expectedDeliveryDate: expectedDeliveryDate || undefined,
        deliveryLocation: handover.deliveryLocation,
        locationId: locationId || null,
        internalRemarks: handover.internalRemarks,
        opportunityId: opportunityPrefill?.opportunityId ?? linkedDoc?.opportunityId ?? null,
        contactId: opportunityPrefill
          ? getOpportunity(opportunityPrefill.opportunityId)?.contactId ?? null
          : linkedDoc?.contactId ?? null,
        quotationId: linkedQuo?.id ?? opportunityPrefill?.quotationId ?? null,
        quotationNo: linkedQuo?.quotationNo ?? null,
        quotationRevisionNo: linkedDoc?.revisionNo ?? linkedQuo?.revisionNo ?? null,
        quotationDocumentId: quotationDocumentId || null,
        customerPoDate: customerPoDate || undefined,
        freightAmount,
        orderDiscountAmount,
        lines: lines.map((l) => ({
          productId: l.productId,
          qty: l.qty,
          unitPrice: l.unitPrice,
          discountPct: l.discountPct,
          taxPct: l.taxPct,
        })),
      })
      if (r.ok && r.salesOrderId && opportunityPrefill?.opportunityId) {
        updateOpportunity(opportunityPrefill.opportunityId, {
          salesOrderId: r.salesOrderId,
          stage: 'won',
          status: 'won',
        })
      }
    }

    setIsSubmitting(false)
    if (r.ok && r.salesOrderId) {
      if (saveMode === 'save_new') {
        setToast('Sales order saved — ready for next entry')
        setCustomerPoNumber('')
        setCustomerPoDate('')
        setAttachments([])
        setActiveSection('customer')
        return
      }
      navigate(`/sales/orders/${r.salesOrderId}`)
      return
    }
    setToast(r.error ?? 'Could not create sales order')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    persist('save')
  }

  function scrollToSection(sectionId: string) {
    setActiveSection(sectionId)
    document.getElementById(`so-section-${sectionId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const needsDirectReason = !(fromOpportunity && opportunityPrefill?.canConvertQuotation)
  const hasValidLines = lines.length > 0 && lines.every((l) => l.productId && l.qty >= 1 && l.unitPrice > 0)

  const completionItems = useMemo(() => [
    { id: 'customer', label: 'Customer & PO', done: Boolean(customerId && customerPoNumber.trim()) },
    { id: 'lines', label: 'Products', done: hasValidLines },
    {
      id: 'commercial',
      label: 'Commercial',
      done: Boolean(
        paymentTerms.trim()
        && deliveryTerms.trim()
        && (!needsDirectReason || directSoReason.trim().length >= 10),
      ),
    },
    { id: 'documents', label: 'Documents', done: true },
  ], [customerId, customerPoNumber, hasValidLines, paymentTerms, deliveryTerms, needsDirectReason, directSoReason])

  const completionPercent = Math.round((completionItems.filter((i) => i.done).length / completionItems.length) * 100)

  const sectionNavItems = useMemo(() => [
    { id: 'customer', label: 'Customer & PO', icon: Building2, done: completionItems.find((i) => i.id === 'customer')?.done },
    { id: 'lines', label: 'Products', icon: ClipboardList, done: completionItems.find((i) => i.id === 'lines')?.done },
    { id: 'commercial', label: 'Commercial', icon: Banknote, done: completionItems.find((i) => i.id === 'commercial')?.done },
    { id: 'documents', label: 'Documents', icon: Paperclip, done: completionItems.find((i) => i.id === 'documents')?.done },
  ], [completionItems])

  const formMetrics = useMemo(() => [
    { label: 'Completion', value: `${completionPercent}%`, accent: 'blue' as const, hint: `${completionItems.filter((i) => i.done).length} of ${completionItems.length} sections` },
    { label: 'Line Items', value: String(lines.length), accent: 'green' as const, hint: hasValidLines ? formatCurrency(orderSummary.grandTotal) : 'Add products' },
    { label: 'Grand Total', value: orderSummary.grandTotal > 0 ? formatCurrency(orderSummary.grandTotal) : '—', accent: 'violet' as const, hint: `GST ${formatCurrency(orderSummary.totalGst)}` },
    { label: 'Delivery', value: expectedDeliveryDate ? formatDate(expectedDeliveryDate) : '—', accent: 'amber' as const, hint: customer?.customerName ?? 'Select customer' },
  ], [completionPercent, completionItems, lines.length, hasValidLines, orderSummary.grandTotal, orderSummary.totalGst, expectedDeliveryDate, customer?.customerName])

  const linkedQuotation = quotationDocumentId ? getQuotationDocument(quotationDocumentId) : undefined
  const linkedQuotationNo = linkedQuotation ? getQuotation(linkedQuotation.quotationId)?.quotationNo : undefined
  const opportunityQuotationNo = opportunityPrefill?.quotationId
    ? getQuotation(opportunityPrefill.quotationId)?.quotationNo
    : undefined

  const documentStrip = [
    { label: 'SO No.', value: 'Auto on save' },
    { label: 'Status', value: 'Draft' },
    { label: 'Customer', value: customer?.customerName ?? '—', highlight: Boolean(customerId) },
    { label: 'Customer PO', value: customerPoNumber.trim() || '—', highlight: Boolean(customerPoNumber.trim()) },
    { label: 'Quotation', value: linkedQuotationNo ?? opportunityQuotationNo ?? '—', highlight: Boolean(linkedQuotationNo || opportunityQuotationNo) },
    { label: 'Opportunity', value: opportunityPrefill?.opportunityNo ?? '—', highlight: Boolean(opportunityPrefill) },
    { label: 'Lines', value: String(lines.length), highlight: lines.length > 0 },
    { label: 'Grand Total', value: orderSummary.grandTotal > 0 ? formatCurrency(orderSummary.grandTotal) : '—', highlight: orderSummary.grandTotal > 0 },
  ]

  const validationGuideItems = useMemo(
    () => validationErrors.map((err, i) => ({ id: `err-${i}`, label: err, message: err })),
    [validationErrors],
  )

  const recordTitle = fromOpportunity && opportunityPrefill
    ? opportunityPrefill.opportunityName
    : customer?.customerName ?? 'New Sales Order'

  const factBox = (
    <EnterpriseBusinessFactBox
      completion={{ percent: completionPercent, items: completionItems }}
      aiInsights={[
        {
          id: 'ready',
          label: 'Readiness',
          value: completionPercent >= 75 ? 'Ready to save' : 'Incomplete',
          tone: completionPercent >= 75 ? 'success' as const : 'warning' as const,
        },
        {
          id: 'next',
          label: 'Suggested Next',
          value: !customerId ? 'Select customer' : !hasValidLines ? 'Add product lines' : !customerPoNumber.trim() ? 'Enter customer PO' : 'Review commercial terms',
          tone: 'info' as const,
        },
      ]}
    >
      <EnterpriseFormContextPanel
        summaryTitle="Order Summary"
        actionsTitle="Quick Actions"
        summary={[
          { label: 'Status', value: 'Draft' },
          { label: 'Customer', value: customer?.customerName ?? '—' },
          { label: 'Customer PO', value: customerPoNumber.trim() || '—' },
          { label: 'Lines', value: String(lines.length) },
          { label: 'Subtotal', value: formatCurrency(orderSummary.subtotal) },
          { label: 'GST', value: formatCurrency(orderSummary.totalGst) },
          { label: 'Freight', value: formatCurrency(freightAmount) },
          { label: 'Grand Total', value: formatCurrency(orderSummary.grandTotal), highlight: true },
          ...(expectedDeliveryDate ? [{ label: 'Delivery', value: formatDate(expectedDeliveryDate) }] : []),
          ...(opportunityPrefill ? [{ label: 'Opportunity', value: opportunityPrefill.opportunityNo }] : []),
        ]}
        actions={[
          {
            id: 'save',
            label: 'Save Sales Order',
            icon: FileText,
            primary: true,
            onClick: () => persist('save'),
            disabled: isSubmitting || !hasValidLines,
          },
          { id: 'list', label: 'All Sales Orders', icon: Building2, onClick: () => navigate('/sales/orders') },
        ]}
      />
      {fromOpportunity && opportunityPrefill?.canConvertQuotation ? (
        <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-[12px] text-emerald-900">
          Approved quotation handover — lines and commercial terms are pre-filled from CRM.
        </p>
      ) : null}
    </EnterpriseBusinessFactBox>
  )

  const lineGrid = (
    <div className="col-span-2 overflow-x-auto erp-line-items-grid">
      <table className="w-full min-w-[960px] text-[12px] erp-line-items-grid__table">
        <thead>
          <tr className="border-b border-erp-border bg-erp-surface-alt/60 text-left text-[11px] uppercase tracking-wide text-erp-muted">
            <th className="px-2 py-2 erp-line-items-grid__sticky-sr">#</th>
            <th className="px-2 py-2 erp-line-items-grid__sticky-product">Product</th>
            <th className="px-2 py-2 text-right">Qty</th>
            <th className="px-2 py-2 text-right">Unit Price</th>
            <th className="px-2 py-2 text-right">Disc %</th>
            <th className="px-2 py-2">GST %</th>
            <th className="px-2 py-2 text-right">Taxable</th>
            <th className="px-2 py-2 text-right">GST</th>
            <th className="px-2 py-2 text-right">Line Total</th>
            <th className="px-2 py-2" />
          </tr>
        </thead>
        <tbody>
          {computedLines.map((line, idx) => {
            const draft = lines[idx]
            if (!draft) return null
            const product = draft.productId ? getProduct(draft.productId) : undefined
            return (
              <tr key={line.key} className="border-b border-erp-border/60">
                <td className="px-2 py-2 tabular-nums text-erp-muted erp-line-items-grid__sticky-sr">{idx + 1}</td>
                <td className="px-2 py-2 erp-line-items-grid__sticky-product">
                  <QuickCreateSelect
                    entityType="product"
                    value={draft.productId}
                    onChange={(id) => updateLine(line.key, {
                      productId: id,
                      unitPrice: getProduct(id)?.standardPrice ?? draft.unitPrice,
                    })}
                    options={productOptions}
                    placeholder="Select product…"
                  />
                  {product?.status === 'draft' ? (
                    <p className="mt-1 flex items-center gap-1 text-[11px] text-amber-700">
                      <ShieldAlert className="h-3 w-3" /> Not engineering-released
                    </p>
                  ) : null}
                </td>
                <td className="px-2 py-2">
                  <Input
                    type="number"
                    min={1}
                    className="text-right"
                    value={draft.qty}
                    onChange={(e) => updateLine(line.key, { qty: Math.max(1, Number(e.target.value) || 1) })}
                  />
                </td>
                <td className="px-2 py-2">
                  <Input
                    type="number"
                    min={0}
                    className="text-right"
                    value={draft.unitPrice}
                    onChange={(e) => updateLine(line.key, { unitPrice: Math.max(0, Number(e.target.value) || 0) })}
                  />
                </td>
                <td className="px-2 py-2">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    className="text-right"
                    value={draft.discountPct}
                    onChange={(e) => updateLine(line.key, { discountPct: Math.max(0, Number(e.target.value) || 0) })}
                  />
                </td>
                <td className="px-2 py-2">
                  <select
                    className="erp-input h-9 w-full"
                    value={draft.taxPct}
                    onChange={(e) => updateLine(line.key, { taxPct: Number(e.target.value) })}
                  >
                    {GST_RATE_OPTIONS.map((rate) => (
                      <option key={rate} value={rate}>{rate}%</option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-2 text-right tabular-nums">{formatCurrency(line.taxableValue)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{formatCurrency(line.gstAmount)}</td>
                <td className="px-2 py-2 text-right font-semibold tabular-nums text-erp-primary">
                  {formatCurrency(line.lineTotal)}
                </td>
                <td className="px-2 py-2">
                  <button
                    type="button"
                    className="rounded p-1 text-erp-muted hover:bg-erp-danger/10 hover:text-erp-danger"
                    onClick={() => removeLine(line.key)}
                    aria-label="Remove line"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <button
        type="button"
        className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold text-erp-primary hover:underline"
        onClick={addLine}
      >
        <Plus className="h-3.5 w-3.5" /> Add product line
      </button>
    </div>
  )

  return (
    <>
      <SalesCardFormShell
        title={fromOpportunity ? 'Create Sales Order' : 'New Sales Order'}
        badge="Sales"
        className={ENTERPRISE_FORM_CLASS}
        collapsibleFactBox
        factBoxLabel="Details"
        recordNo="New"
        recordTitle={recordTitle}
        status="Draft"
        statusTone="info"
        stage={fromOpportunity ? 'From Opportunity' : 'Direct SO'}
        createdDate={formatDate(new Date().toISOString().slice(0, 10))}
        company={customer?.customerName}
        favoritePath="/sales/orders/new"
        breadcrumbs={salesChildBreadcrumbs('Sales Orders', '/sales/orders', fromOpportunity ? 'Create Sales Order' : 'New Sales Order')}
        documentStrip={documentStrip}
        validationItems={validationGuideItems}
        validationErrors={validationGuideItems.length ? undefined : validationErrors}
        factBox={factBox}
        onSubmit={handleSubmit}
        onSaveShortcut={() => persist('save')}
        onSaveAndNewShortcut={() => persist('save_new')}
        footer={(
          <ErpStickySaveBar
            cancelTo="/sales/orders"
            submitLabel="Save Sales Order"
            isSubmitting={isSubmitting}
            onSave={() => persist('save')}
            onSaveAndNew={() => persist('save_new')}
            hint={(
              <span className="text-[12px] text-erp-muted">
                {completionPercent}% complete · {formatCurrency(orderSummary.grandTotal)} grand total
                {expectedDeliveryDate ? ` · Delivery ${formatDate(expectedDeliveryDate)}` : ''}
              </span>
            )}
          />
        )}
      >
        <EnterpriseFormSectionNav
          sections={sectionNavItems}
          activeId={activeSection}
          onSelect={scrollToSection}
          trailing={<FactBoxPaneAiToggle />}
        />

        <EnterpriseFormMetrics metrics={formMetrics} />

        <ErpCardSection
          id="so-section-customer"
          title="Customer & Purchase Order"
          subtitle="Bill-to company, PO reference, and quotation linkage."
          icon={Building2}
          accent="blue"
          collapsible
          defaultOpen
        >
          <ErpFieldRow label="Quotation Number" hint="Search approved quotation to auto-fill lines and terms">
            <ErpSmartSelect
              options={quotationOptions}
              value={quotationDocumentId}
              onChange={(v) => {
                setQuotationDocumentId(v)
                if (v) applyQuotation(v)
              }}
              allowEmpty
              placeholder="Search quotation no, customer…"
            />
          </ErpFieldRow>
          <ErpFieldRow label="Customer" required>
            <QuickCreateSelect
              entityType="customer"
              value={customerId}
              onChange={setCustomerId}
              options={customerOptions}
              placeholder="Search customers…"
            />
          </ErpFieldRow>
          {customer ? (
            <div className="col-span-2 so-direct-customer-chip">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-erp-primary/10 text-erp-primary">
                  <Building2 className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-erp-text">{customer.customerName}</p>
                  <p className="mt-0.5 text-[12px] text-erp-muted">{customer.customerCode} · {customer.city}, {customer.state}</p>
                </div>
                <AppLink to={`/entity360/customers/${customer.id}`} className="shrink-0 text-[11px] font-semibold">
                  View 360
                </AppLink>
              </div>
            </div>
          ) : null}
          <ErpFieldRow label="Customer PO Number" required>
            <Input value={customerPoNumber} onChange={(e) => setCustomerPoNumber(e.target.value)} placeholder="e.g. PO/2026/1842" />
          </ErpFieldRow>
          <ErpFieldRow label="Customer PO Date">
            <Input type="date" value={customerPoDate} onChange={(e) => setCustomerPoDate(e.target.value)} />
          </ErpFieldRow>
          <ErpFieldRow label="Expected Delivery Date">
            <Input type="date" value={expectedDeliveryDate} onChange={(e) => setExpectedDeliveryDate(e.target.value)} />
          </ErpFieldRow>
        </ErpCardSection>

        <ErpCardSection
          id="so-section-lines"
          title="Product & Pricing"
          subtitle="Set quantity, price, discount and GST per product line."
          icon={ClipboardList}
          accent="violet"
          collapsible
          defaultOpen
          className="!max-w-none"
        >
          {lineGrid}
          <ErpFieldRow label="Freight (₹)">
            <Input type="number" min={0} value={freightAmount} onChange={(e) => setFreightAmount(Math.max(0, Number(e.target.value) || 0))} />
          </ErpFieldRow>
          <ErpFieldRow label="Order Discount (₹)">
            <Input type="number" min={0} value={orderDiscountAmount} onChange={(e) => setOrderDiscountAmount(Math.max(0, Number(e.target.value) || 0))} />
          </ErpFieldRow>
          <div className="col-span-2 flex justify-end pt-2">
            <div className="quo-editor-price__summary so-direct-order-summary">
              <div className="quo-editor-price__summary-row">
                <span>Total Quantity</span>
                <span className="tabular-nums">{orderSummary.totalQty}</span>
              </div>
              <div className="quo-editor-price__summary-row">
                <span>Basic Amount</span>
                <span className="tabular-nums">{formatCurrency(orderSummary.basicAmount)}</span>
              </div>
              {orderSummary.totalLineDiscount > 0 ? (
                <div className="quo-editor-price__summary-row">
                  <span>Line Discount</span>
                  <span className="tabular-nums">−{formatCurrency(orderSummary.totalLineDiscount)}</span>
                </div>
              ) : null}
              <div className="quo-editor-price__summary-row">
                <span>Taxable Amount</span>
                <span className="tabular-nums">{formatCurrency(orderSummary.subtotal)}</span>
              </div>
              {[...orderSummary.gstByRate.entries()]
                .sort(([a], [b]) => a - b)
                .map(([rate, amount]) => (
                  <div key={rate} className="quo-editor-price__summary-row">
                    <span>GST @ {rate}%</span>
                    <span className="tabular-nums">{formatCurrency(amount)}</span>
                  </div>
                ))}
              <div className="quo-editor-price__summary-row">
                <span>Total GST</span>
                <span className="tabular-nums">{formatCurrency(orderSummary.totalGst)}</span>
              </div>
              <div className="quo-editor-price__summary-row">
                <span>Freight</span>
                <span className="tabular-nums">{formatCurrency(freightAmount)}</span>
              </div>
              <div className="quo-editor-price__summary-row">
                <span>Order Discount</span>
                <span className="tabular-nums">{orderDiscountAmount > 0 ? `−${formatCurrency(orderDiscountAmount)}` : formatCurrency(0)}</span>
              </div>
              <div className="quo-editor-price__summary-row quo-editor-price__summary-row--total">
                <span>Grand Total</span>
                <span className="tabular-nums">{formatCurrency(orderSummary.grandTotal)}</span>
              </div>
            </div>
          </div>
        </ErpCardSection>

        <ErpCardSection
          id="so-section-commercial"
          title="Commercial & Delivery"
          subtitle="Payment, delivery terms, and internal justification."
          icon={Banknote}
          accent="green"
          collapsible
          defaultOpen
        >
          <ErpFieldRow label="Payment Terms" required>
            <CommercialTermSelect termType="payment" value={paymentTerms} onChange={setPaymentTerms} placeholder="Select payment terms" />
          </ErpFieldRow>
          <ErpFieldRow label="Delivery Terms" required>
            <CommercialTermSelect termType="delivery" value={deliveryTerms} onChange={setDeliveryTerms} placeholder="Select delivery terms" />
          </ErpFieldRow>
          <LocationFieldRow
            value={locationId}
            onChange={(locId) => {
              setLocationId(locId)
              const loc = locations.find((l) => l.id === locId)
              if (loc) setDeliveryLocation(locationDisplayLabel(loc))
            }}
            usage="sales"
            colSpan={2}
            label="Location Code"
            hint="Fulfilment location — flows from Lead → Opportunity → Quotation"
          />
          {needsDirectReason ? (
            <ErpFieldRow label="Reason for Direct Sales Order" required className="col-span-2">
              <Textarea
                rows={3}
                value={directSoReason}
                onChange={(e) => setDirectSoReason(e.target.value)}
                placeholder="Explain why this order bypasses the standard CRM quotation flow…"
              />
            </ErpFieldRow>
          ) : null}
          <ErpFieldRow label="Internal Remarks" className="col-span-2">
            <Textarea
              rows={2}
              value={internalRemarks}
              onChange={(e) => setInternalRemarks(e.target.value)}
              placeholder="Special instructions, freight notes, commercial exceptions…"
            />
          </ErpFieldRow>
        </ErpCardSection>

        <ErpCardSection
          id="so-section-documents"
          title="Document Attachments"
          subtitle="PDF, images, Excel, drawings, and customer PO."
          icon={Paperclip}
          accent="teal"
          collapsible
          defaultOpen={attachments.length > 0}
        >
          <div className="col-span-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {([
              ['pdf', 'PDF Documents'],
              ['image', 'Images'],
              ['excel', 'Excel Files'],
              ['drawing', 'Drawings'],
              ['customer_po', 'Customer PO'],
            ] as const).map(([kind, label]) => {
              const Icon = attachmentIcon(kind)
              return (
                <label
                  key={kind}
                  className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-erp-border bg-erp-surface-alt/30 px-4 py-5 text-center hover:border-erp-primary/40"
                >
                  <Icon className="h-6 w-6 text-erp-primary" />
                  <span className="text-[12px] font-semibold text-erp-text">{label}</span>
                  <span className="text-[11px] text-erp-muted">Click to upload</span>
                  <input type="file" className="sr-only" onChange={(e) => handleAttachmentPick(e, kind)} />
                </label>
              )
            })}
          </div>
          {attachments.length > 0 ? (
            <ul className="col-span-2 mt-2 space-y-2">
              {attachments.map((a) => {
                const Icon = attachmentIcon(a.kind)
                return (
                  <li key={a.id} className="flex items-center justify-between gap-2 rounded-md border border-erp-border px-3 py-2 text-[12px]">
                    <span className="flex min-w-0 items-center gap-2">
                      <Icon className="h-4 w-4 shrink-0 text-erp-primary" />
                      <span className="truncate font-medium">{a.name}</span>
                    </span>
                    <span className="shrink-0 text-erp-muted">{formatDate(a.uploadedAt)}</span>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="col-span-2 flex items-center gap-2 text-[12px] text-erp-muted">
              <Paperclip className="h-4 w-4" /> No attachments yet
            </p>
          )}
        </ErpCardSection>
      </SalesCardFormShell>
      {toast ? <Toast message={toast} variant={toast.includes('saved') ? 'success' : 'error'} /> : null}
    </>
  )
}
