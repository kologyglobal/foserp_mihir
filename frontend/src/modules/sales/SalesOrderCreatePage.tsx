import { useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Banknote,
  Building2,
  ClipboardList,
  ExternalLink,
  FileImage,
  FileSpreadsheet,
  FileText,
  Handshake,
  MapPin,
  Paperclip,
  PenLine,
  Plus,
  ShieldAlert,
  Trash2,
  Zap,
} from 'lucide-react'
import {
  ErpCardSection,
  ErpFieldGroup,
  ErpFieldRow,
  ErpQuickEntrySection,
  ErpStickySaveBar,
} from '../../components/erp/card-form'
import { CrmCardFormShell } from '@/components/crm/CrmCardFormShell'
import { CrmSmartOverviewPanel } from '@/components/crm/CrmSmartOverviewPanel'
import { DynamicsStatusChip } from '../../components/dynamics/DynamicsStatusChip'
import {
  ENTERPRISE_FORM_CLASS,
  EnterpriseFormMetrics,
  EnterpriseFormSectionNav,
} from '../../design-system/workspace'
import { salesChildBreadcrumbs } from '../../utils/salesNavigation'
import { crmChildBreadcrumbs } from '../../utils/crmNavigation'
import { ErpSmartSelect } from '../../components/erp/ErpSmartSelect'
import { CommercialTermSelect } from '../../components/masters/GeographySelects'
import { QuickCreateSelect } from '../../components/quick-create/QuickCreateSelect'
import { Input, Textarea } from '../../components/forms/Inputs'
import { AppLink } from '../../components/ui/AppLink'
import { resolveCompany360Path } from '../../config/entity360Routes'
import { notify } from '../../store/toastStore'
import { validateSalesOrderCreate } from '../../utils/validation/crmSchemas/salesOrderSchema'
import { handleInvalidSubmit, type FieldErrorMap } from '../../utils/formValidation'
import { useSalesStore } from '../../store/salesStore'
import { useCrmStore } from '../../store/crmStore'
import { useMasterStore } from '../../store/masterStore'
import { isApiMode } from '../../config/apiConfig'
import { apiCreateSalesOrder } from '../../services/bridges/salesOrderApiBridge'
import { useActiveCustomers, useActiveProducts } from '../../hooks/useMasterLists'
import { formatCurrency } from '../../utils/formatters/currency'
import { formatDate } from '../../utils/dates/format'
import {
  resolveCreateSalesOrderGateForQuotationDocument,
  resolveOpportunityCreateSalesOrderGate,
  resolveOpportunitySalesOrderPrefill,
} from '../../utils/opportunitySalesOrderDraft'
import {
  CRM_SALES_ORDERS_PATH,
  isFromCrmSearchParam,
  resolveSalesOrderDetailPath,
} from '../../utils/crmSalesOrderNavigation'
import { buildSalesOrderLinesFromQuotationDocument } from '../../utils/crmQuotationSoLines'
import { LocationFieldRow } from '../../components/masters/LocationFieldRow'
import { useDocumentLocation } from '../../hooks/useDocumentLocation'
import { locationDisplayLabel } from '../../utils/locationUtils'
import {
  SalesOrderCreateModeChooser,
  type SalesOrderCreateMode,
} from '../../components/sales/SalesOrderCreateModeChooser'
import { OperationalPageShell } from '../../components/design-system/OperationalPageShell'

const GST_RATE_OPTIONS = [0, 5, 12, 18, 28] as const

type SoCreateMode = SalesOrderCreateMode

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
  const { pathname } = useLocation()
  const [searchParams] = useSearchParams()
  const opportunityIdParam = searchParams.get('opportunityId')
  const quotationDocumentIdParam = searchParams.get('quotationDocumentId')
  const fromCrm = isFromCrmSearchParam(searchParams.get('fromCrm'))
  const listPath = fromCrm ? CRM_SALES_ORDERS_PATH : '/sales/orders'
  const duplicateCustomerId = searchParams.get('customerId')
  const duplicateProductId = searchParams.get('productId')
  const duplicateQty = Number(searchParams.get('qty') ?? '0')

  const opportunityPrefill = useMemo(
    () => (opportunityIdParam || quotationDocumentIdParam
      ? resolveOpportunitySalesOrderPrefill(opportunityIdParam, quotationDocumentIdParam)
      : null),
    [opportunityIdParam, quotationDocumentIdParam],
  )
  const opportunitySoGate = useMemo(
    () => (opportunityIdParam || quotationDocumentIdParam
      ? resolveOpportunityCreateSalesOrderGate(opportunityIdParam, quotationDocumentIdParam)
      : null),
    [opportunityIdParam, quotationDocumentIdParam],
  )

  const initialCreateMode: SoCreateMode =
    quotationDocumentIdParam
    || opportunityPrefill?.quotationDocumentId
    || opportunityPrefill?.canConvertQuotation
      ? 'quotation'
      : 'direct'

  /** Prefill / deep-link skips the chooser; blank New SO starts with path selection. */
  const skipModeChooser = Boolean(
    opportunityIdParam
    || quotationDocumentIdParam
    || duplicateCustomerId
    || duplicateProductId,
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

  const [activeSection, setActiveSection] = useState('quick')
  const [createMode, setCreateMode] = useState<SoCreateMode>(initialCreateMode)
  const [modeChosen, setModeChosen] = useState(skipModeChooser)
  const [validationErrors, setValidationErrors] = useState<FieldErrorMap>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [customerId, setCustomerId] = useState(
    opportunityPrefill?.customerId ?? duplicateCustomerId ?? '',
  )
  const [quotationDocumentId, setQuotationDocumentId] = useState(opportunityPrefill?.quotationDocumentId ?? '')
  const [lines, setLines] = useState<SoLineDraft[]>(() => {
    const fromUpstream = Boolean(opportunityPrefill || duplicateProductId)
    if (!fromUpstream) {
      return [{ ...newLineDraft('', 0), qty: 1 }]
    }
    const productId = opportunityPrefill?.productId ?? duplicateProductId ?? ''
    const unitPrice = opportunityPrefill?.unitPrice ?? (productId ? getProduct(productId)?.standardPrice ?? 0 : 0)
    const qty = opportunityPrefill?.qty ?? (duplicateQty > 0 ? duplicateQty : 1)
    return [{ ...newLineDraft(productId, unitPrice), qty }]
  })
  const [customerPoNumber, setCustomerPoNumber] = useState('')
  const [customerPoDate, setCustomerPoDate] = useState('')
  const [paymentTerms, setPaymentTerms] = useState(opportunityPrefill?.paymentTerms ?? '')
  const [deliveryTerms, setDeliveryTerms] = useState(opportunityPrefill?.deliveryTerms ?? '')
  const [directSoReason, setDirectSoReason] = useState(opportunityPrefill?.directSoReason ?? '')
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState(
    opportunityPrefill?.expectedDeliveryDate ?? '',
  )
  const [deliveryLocation, setDeliveryLocation] = useState(opportunityPrefill?.deliveryLocation ?? '')
  const { locationId, setLocationId } = useDocumentLocation('sales', opportunityPrefill?.locationId)
  const [internalRemarks, setInternalRemarks] = useState(opportunityPrefill?.internalRemarks ?? '')
  const [freightAmount, setFreightAmount] = useState(0)
  const [orderDiscountMode, setOrderDiscountMode] = useState<'flat' | 'percent'>('flat')
  const [orderDiscountInput, setOrderDiscountInput] = useState(0)
  const [attachments, setAttachments] = useState<SoAttachment[]>([])

  const customer = customerId ? getCustomer(customerId) : undefined
  const fromOpportunity = Boolean(opportunityPrefill)
  const createTitle = fromOpportunity ? 'Create Sales Order' : 'New Sales Order'

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
        const quotationNo = q?.quotationNo ?? doc.quotationId
        const companyName = cust?.customerName?.trim() || 'Unknown company'
        const companyBits = [
          companyName,
          cust?.customerCode,
          [cust?.city, cust?.state].filter(Boolean).join(', ') || null,
          cust?.gstin ? `GSTIN ${cust.gstin}` : null,
        ].filter(Boolean)
        const total =
          (doc.totalAmount > 0 ? doc.totalAmount : null)
          ?? (q?.pricing?.grandTotal && q.pricing.grandTotal > 0 ? q.pricing.grandTotal : null)
          ?? 0
        const statusLabel = doc.status === 'converted' ? 'Converted' : 'Approved'
        const owner = doc.salesOwnerName?.trim()
        return {
          value: doc.id,
          label: `${quotationNo} · Rev ${doc.revisionNo}`,
          subtitle: companyBits.join(' · '),
          trailing: total > 0 ? formatCurrency(total) : '—',
          badge: owner ? `${statusLabel} · ${owner}` : statusLabel,
          searchText: [
            quotationNo,
            companyName,
            cust?.customerCode,
            cust?.city,
            cust?.state,
            cust?.gstin,
            owner,
            statusLabel,
            String(total),
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase(),
        }
      })
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [quotationDocuments, getQuotation, customers])

  const customerOptions = useMemo(
    () => customers.map((c) => ({ id: c.id, label: `${c.customerCode} · ${c.customerName}` })),
    [customers],
  )

  const productSmartOptions = useMemo(
    () =>
      products.map((p) => ({
        value: p.id,
        label: `${p.productCode} · ${p.productName}`,
        searchText: `${p.productCode} ${p.productName}`.toLowerCase(),
      })),
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
    const discountBase = round2(subtotal + totalGst)
    const orderDiscountAmount =
      orderDiscountMode === 'percent'
        ? round2(discountBase * (Math.min(100, Math.max(0, orderDiscountInput)) / 100))
        : round2(Math.min(Math.max(0, orderDiscountInput), discountBase + freightAmount))
    const grandTotal = round2(subtotal + totalGst + freightAmount - orderDiscountAmount)
    return {
      totalQty,
      basicAmount,
      subtotal,
      totalLineDiscount,
      gstByRate,
      totalGst,
      orderDiscountAmount,
      grandTotal,
    }
  }, [computedLines, freightAmount, orderDiscountInput, orderDiscountMode])

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

  function handleCreateModeChange(mode: SoCreateMode) {
    if (mode === createMode) return
    setCreateMode(mode)
    setValidationErrors({})
    if (mode === 'direct') {
      setQuotationDocumentId('')
      if (directSoReason.startsWith('Approved quotation handover')) setDirectSoReason('')
      return
    }
    const restoreId =
      opportunityPrefill?.quotationDocumentId
      ?? quotationDocumentIdParam
      ?? ''
    if (restoreId) applyQuotation(restoreId)
  }

  function chooseCreateMode(mode: SoCreateMode) {
    handleCreateModeChange(mode)
    setModeChosen(true)
    setActiveSection('quick')
  }

  function reopenModeChooser() {
    setModeChosen(false)
    setValidationErrors({})
  }

  function updateLine(key: string, patch: Partial<SoLineDraft>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }

  function addLine() {
    setLines((prev) => [...prev, newLineDraft('', 0)])
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

  function validate(): FieldErrorMap {
    return validateSalesOrderCreate({
      createMode,
      fromOpportunity: Boolean(fromOpportunity),
      opportunitySoGateEnabled: opportunitySoGate?.enabled,
      opportunitySoGateReason: opportunitySoGate?.disabledReason,
      quotationDocumentId: quotationDocumentId || null,
      opportunityPrefillQuotationDocumentId: opportunityPrefill?.quotationDocumentId ?? null,
      customerId,
      lines,
      customerPoNumber,
      paymentTerms,
      deliveryTerms,
    }).fieldErrors
  }

  async function persist(saveMode: 'save' | 'save_new' | 'save_close') {
    const errors = validate()
    if (Object.keys(errors).length) {
      handleInvalidSubmit({
        errors,
        fieldOrder: [
          'quotationDocumentId',
          'customerId',
          'lines',
          'customerPoNumber',
          'paymentTerms',
          'deliveryTerms',
        ],
        onFieldErrors: setValidationErrors,
      })
      return
    }
    setValidationErrors({})

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

    const convertDocId = opportunityPrefill?.quotationDocumentId
    const shouldConvertQuotation = Boolean(
      createMode === 'quotation'
      && opportunityPrefill?.canConvertQuotation
      && convertDocId
      && (!quotationDocumentId || quotationDocumentId === convertDocId),
    )

    if (shouldConvertQuotation && convertDocId) {
      r = await Promise.resolve(convertQuotation(convertDocId, handover))
    } else {
      const primary = lines[0]
      const linkedDoc = quotationDocumentId ? getQuotationDocument(quotationDocumentId) : undefined
      const linkedQuo = linkedDoc ? getQuotation(linkedDoc.quotationId) : undefined
      const opportunityId = opportunityPrefill?.opportunityId ?? linkedDoc?.opportunityId ?? null
      const contactId = opportunityPrefill
        ? getOpportunity(opportunityPrefill.opportunityId)?.contactId ?? null
        : linkedDoc?.contactId ?? null
      const quotationId = linkedQuo?.id ?? opportunityPrefill?.quotationId ?? null
      const linePayload = lines.map((l) => {
        const product = getProduct(l.productId)
        return {
          productOrItem: product?.productName ?? l.productId,
          description: product?.productName ?? '',
          productId: l.productId,
          qty: l.qty,
          uom: 'NOS',
          unitPrice: l.unitPrice,
          discountPct: l.discountPct,
          taxPct: l.taxPct,
        }
      })

      if (isApiMode()) {
        r = await apiCreateSalesOrder({
          customerId,
          source: quotationId || opportunityId ? 'quotation' : 'direct',
          productId: primary.productId,
          qty: lines.reduce((s, l) => s + l.qty, 0),
          unitPrice: primary.unitPrice,
          customerPoNumber: customerPoNumber.trim(),
          paymentTerms: paymentTerms.trim(),
          deliveryTerms: deliveryTerms.trim(),
          directSoReason: directSoReason.trim() || null,
          expectedDeliveryDate: expectedDeliveryDate || null,
          deliveryLocation: handover.deliveryLocation ?? null,
          locationId: locationId || null,
          internalRemarks: handover.internalRemarks ?? null,
          opportunityId,
          contactId,
          quotationId,
          quotationNo: linkedQuo?.quotationNo ?? null,
          quotationRevisionNo: linkedDoc?.revisionNo ?? linkedQuo?.revisionNo ?? null,
          quotationDocumentId: quotationDocumentId || null,
          customerPoDate: customerPoDate || null,
          lines: linePayload,
        })
      } else {
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
          opportunityId,
          contactId,
          quotationId,
          quotationNo: linkedQuo?.quotationNo ?? null,
          quotationRevisionNo: linkedDoc?.revisionNo ?? linkedQuo?.revisionNo ?? null,
          quotationDocumentId: quotationDocumentId || null,
          customerPoDate: customerPoDate || undefined,
          freightAmount,
          orderDiscountAmount: orderSummary.orderDiscountAmount,
          lines: lines.map((l) => ({
            productId: l.productId,
            qty: l.qty,
            unitPrice: l.unitPrice,
            discountPct: l.discountPct,
            taxPct: l.taxPct,
          })),
        })
      }
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
        notify.success('Sales order saved — ready for next entry')
        setCustomerPoNumber('')
        setCustomerPoDate('')
        setAttachments([])
        setActiveSection('quick')
        return
      }
      if (saveMode === 'save_close') {
        navigate(listPath)
        return
      }
      navigate(resolveSalesOrderDetailPath(r.salesOrderId, fromCrm))
      return
    }
    notify.error(r.error ?? 'Could not create sales order')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    persist('save')
  }

  const needsDirectReasonField = createMode === 'direct'
  const isQuoteHandover = createMode === 'quotation' && Boolean(
    quotationDocumentId || opportunityPrefill?.quotationDocumentId || opportunityPrefill?.canConvertQuotation,
  )
  const modeBadgeLabel = createMode === 'quotation'
    ? (opportunityPrefill?.canConvertQuotation ? 'Quote handover' : 'From quotation')
    : 'Direct SO'
  const hasValidLines = lines.length > 0 && lines.every((l) => l.productId && l.qty >= 1 && l.unitPrice > 0)

  const completionItems = useMemo(() => [
    {
      id: 'quick',
      label: 'Quick Entry',
      done: Boolean(
        customerId
        && customerPoNumber.trim()
        && (createMode === 'direct' || quotationDocumentId || opportunityPrefill?.quotationDocumentId),
      ),
    },
    { id: 'lines', label: 'Products', done: hasValidLines },
    {
      id: 'commercial',
      label: 'Commercial',
      done: Boolean(paymentTerms.trim() && deliveryTerms.trim()),
    },
    { id: 'documents', label: 'Documents', done: attachments.length > 0 },
  ], [
    createMode,
    customerId,
    customerPoNumber,
    quotationDocumentId,
    opportunityPrefill?.quotationDocumentId,
    hasValidLines,
    paymentTerms,
    deliveryTerms,
    attachments.length,
  ])

  const completionPercent = Math.round((completionItems.filter((i) => i.done).length / completionItems.length) * 100)

  function scrollToSection(sectionId: string) {
    const navId = sectionId === 'customer' ? 'quick' : sectionId
    setActiveSection(navId)
    window.requestAnimationFrame(() => {
      const elId = (sectionId === 'customer' || sectionId === 'quick')
        ? 'so-section-quick'
        : `so-section-${sectionId}`
      document.getElementById(elId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  const sectionNavItems = useMemo(() => [
    {
      id: 'quick',
      label: 'Quick',
      icon: Building2,
      done: completionItems.find((i) => i.id === 'quick')?.done,
    },
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
  const quotationDisplayNo = linkedQuotationNo ?? opportunityQuotationNo ?? '—'

  const documentStrip = [
    { label: 'SO No.', value: 'Auto on save' },
    { label: 'Status', value: 'Draft SO' },
    { label: 'Mode', value: modeBadgeLabel, highlight: true },
    { label: 'Customer', value: customer?.customerName ?? '—', highlight: Boolean(customerId) },
    { label: 'Customer PO', value: customerPoNumber.trim() || '—', highlight: Boolean(customerPoNumber.trim()) },
    { label: 'Quotation', value: createMode === 'quotation' ? quotationDisplayNo : '—', highlight: createMode === 'quotation' && quotationDisplayNo !== '—' },
    { label: 'Opportunity', value: opportunityPrefill?.opportunityNo ?? '—', highlight: Boolean(opportunityPrefill) },
    { label: 'Lines', value: String(lines.length), highlight: lines.length > 0 },
    { label: 'Grand Total', value: orderSummary.grandTotal > 0 ? formatCurrency(orderSummary.grandTotal) : '—', highlight: orderSummary.grandTotal > 0 },
  ]

  const recordTitle = fromOpportunity && opportunityPrefill
    ? opportunityPrefill.opportunityName
    : customer?.customerName ?? 'New Sales Order'

  const selectedQuoteGate = useMemo(() => {
    if (createMode !== 'quotation') return null
    const docId = quotationDocumentId || opportunityPrefill?.quotationDocumentId
    if (!docId) return null
    return resolveCreateSalesOrderGateForQuotationDocument(docId)
  }, [createMode, quotationDocumentId, opportunityPrefill?.quotationDocumentId])

  const gateBlocked = Boolean(
    fromOpportunity
    && createMode === 'quotation'
    && opportunitySoGate
    && !opportunitySoGate.enabled,
  )
  const canSave = !isSubmitting && hasValidLines && !gateBlocked

  const nextSmartAction = createMode === 'quotation' && !quotationDocumentId && !opportunityPrefill?.quotationDocumentId
    ? {
        id: 'quotation',
        title: 'Select quotation',
        description: 'Search an approved quotation to auto-fill customer, lines, and terms.',
        ctaLabel: 'Choose quotation',
        focusField: 'quotationDocumentId',
        sectionId: 'quick',
      }
    : !customerId
      ? {
          id: 'customer',
          title: 'Select customer',
          description: 'Choose the bill-to company for this sales order.',
          ctaLabel: 'Go to customer',
          focusField: 'customerId',
          sectionId: 'quick',
        }
      : !customerPoNumber.trim()
        ? {
            id: 'po',
            title: 'Enter customer PO',
            description: 'Customer PO number is required before saving.',
            ctaLabel: 'Enter PO',
            focusField: 'customerPoNumber',
            sectionId: 'quick',
          }
        : !hasValidLines
          ? {
              id: 'lines',
              title: 'Complete product lines',
              description: 'Add quantity and unit price for each line.',
              ctaLabel: 'Go to products',
              focusField: 'lines',
              sectionId: 'lines',
            }
          : !paymentTerms.trim() || !deliveryTerms.trim()
            ? {
                id: 'commercial',
                title: 'Set commercial terms',
                description: 'Choose payment and delivery terms before saving.',
                ctaLabel: 'Commercial terms',
                focusField: !paymentTerms.trim() ? 'paymentTerms' : 'deliveryTerms',
                sectionId: 'commercial',
              }
            : {
                id: 'save',
                title: 'Ready to save',
                description: 'Review totals and save the draft sales order.',
                ctaLabel: 'Save Draft SO',
              }

  const factBox = (
    <CrmSmartOverviewPanel
      ariaLabel="Smart sales order overview"
      title={
        fromOpportunity
          ? (fromCrm ? 'Pipeline → Sales Order' : 'Opportunity → Sales Order')
          : createMode === 'quotation'
            ? 'Quotation → Sales Order'
            : 'New Sales Order'
      }
      chips={[
        { label: 'Draft SO', tone: 'info' },
        {
          label: modeBadgeLabel,
          tone: createMode === 'quotation' ? 'success' as const : 'neutral' as const,
        },
        ...(fromOpportunity && createMode === 'direct'
          ? [{ label: 'From opportunity', tone: 'info' as const }]
          : []),
        ...(gateBlocked ? [{ label: 'Blocked', tone: 'warning' as const }] : []),
      ]}
      meta={[
        createMode === 'quotation' ? 'Mode: From quotation' : 'Mode: Direct sales order',
        customer?.customerName ? `Customer: ${customer.customerName}` : 'No customer',
        opportunityPrefill ? `Deal: ${opportunityPrefill.opportunityNo}` : 'No opportunity',
        quotationDisplayNo !== '—' ? `Quote: ${quotationDisplayNo}` : 'No quotation',
      ]}
      progressLabel="Order readiness"
      progressPercent={completionPercent}
      signals={[
        {
          id: 'mode',
          label: createMode === 'quotation'
            ? (isQuoteHandover ? 'Quotation linked' : 'Quotation missing')
            : 'Direct SO path',
          tone: createMode === 'direct' || isQuoteHandover ? 'ok' : 'warn',
        },
        { id: 'customer', label: customerId ? 'Customer linked' : 'Customer missing', tone: customerId ? 'ok' : 'warn' },
        { id: 'po', label: customerPoNumber.trim() ? 'PO captured' : 'PO missing', tone: customerPoNumber.trim() ? 'ok' : 'warn' },
        { id: 'lines', label: hasValidLines ? `${lines.length} product line${lines.length === 1 ? '' : 's'}` : 'Lines incomplete', tone: hasValidLines ? 'ok' : 'warn' },
        {
          id: 'commercial',
          label: completionItems.find((i) => i.id === 'commercial')?.done ? 'Commercial ready' : 'Commercial incomplete',
          tone: completionItems.find((i) => i.id === 'commercial')?.done ? 'ok' : 'warn',
        },
      ]}
      nextAction={nextSmartAction}
      onNextAction={() => {
        if (nextSmartAction.id === 'save') {
          persist('save')
          return
        }
        scrollToSection(nextSmartAction.sectionId ?? 'quick')
      }}
      quickActions={[
        {
          id: 'save',
          label: 'Save Draft SO',
          icon: FileText,
          onClick: () => persist('save'),
          disabled: !canSave,
        },
        {
          id: 'list',
          label: fromCrm ? 'CRM Sales Orders' : 'Sales Orders',
          icon: Building2,
          onClick: () => navigate(listPath),
        },
      ]}
      keyDetails={[
        { label: 'Status', value: 'Draft SO' },
        { label: 'Create mode', value: modeBadgeLabel },
        { label: 'Customer', value: customer?.customerName ?? '—' },
        { label: 'Customer PO', value: customerPoNumber.trim() || '—' },
        { label: 'Quotation', value: quotationDisplayNo },
        { label: 'Opportunity', value: opportunityPrefill?.opportunityNo ?? '—' },
        { label: 'Lines', value: String(lines.length) },
        { label: 'Grand Total', value: formatCurrency(orderSummary.grandTotal) },
        ...(expectedDeliveryDate ? [{ label: 'Delivery', value: formatDate(expectedDeliveryDate) }] : []),
      ]}
      footer={
        gateBlocked ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-950">
            {selectedQuoteGate?.disabledReason
              ?? opportunitySoGate?.disabledReason
              ?? 'Available after quotation approval.'}
          </p>
        ) : createMode === 'quotation' && isQuoteHandover ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-[12px] text-emerald-900">
            From quotation — customer, lines, and commercial terms auto-fill from the selected quote.
          </p>
        ) : null
      }
    />
  )

  const lineGrid = (
    <div className="so-pricing-panel so-pricing-panel--pro">
      <div className="so-pricing-table-wrap">
        <table className="so-pricing-table">
          <colgroup>
            <col className="so-pricing-col-idx" />
            <col className="so-pricing-col-product" />
            <col className="so-pricing-col-qty" />
            <col className="so-pricing-col-price" />
            <col className="so-pricing-col-disc" />
            <col className="so-pricing-col-gst" />
            <col className="so-pricing-col-money" />
            <col className="so-pricing-col-money" />
            <col className="so-pricing-col-money" />
            <col className="so-pricing-col-action" />
          </colgroup>
          <thead>
            <tr>
              <th className="so-pricing-th so-pricing-th--center">#</th>
              <th className="so-pricing-th">Product</th>
              <th className="so-pricing-th so-pricing-th--right">Qty</th>
              <th className="so-pricing-th so-pricing-th--right">Unit price</th>
              <th className="so-pricing-th so-pricing-th--right">Disc %</th>
              <th className="so-pricing-th so-pricing-th--right">GST %</th>
              <th className="so-pricing-th so-pricing-th--right so-pricing-th--calc">Taxable</th>
              <th className="so-pricing-th so-pricing-th--right so-pricing-th--calc">GST</th>
              <th className="so-pricing-th so-pricing-th--right so-pricing-th--calc">Line total</th>
              <th className="so-pricing-th so-pricing-th--center" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {computedLines.map((line, idx) => {
              const draft = lines[idx]
              if (!draft) return null
              const product = draft.productId ? getProduct(draft.productId) : undefined
              return (
                <tr key={line.key} className="so-pricing-row">
                  <td className="so-pricing-td so-pricing-td--center tabular-nums text-erp-muted">
                    {idx + 1}
                  </td>
                  <td className="so-pricing-td so-pricing-td--product">
                    <ErpSmartSelect
                      options={productSmartOptions}
                      value={draft.productId}
                      onChange={(id) => {
                        if (!id) return
                        updateLine(line.key, {
                          productId: id,
                          unitPrice: getProduct(id)?.standardPrice ?? draft.unitPrice,
                        })
                      }}
                      placeholder="Select product…"
                      appearance="dropdown"
                      dropdownMinWidth={360}
                    />
                    {product?.status === 'draft' ? (
                      <p className="so-pricing-warn">
                        <ShieldAlert className="h-3 w-3" /> Not engineering-released
                      </p>
                    ) : null}
                  </td>
                  <td className="so-pricing-td">
                    <Input
                      type="number"
                      min={1}
                      className="so-pricing-input so-pricing-input--num"
                      value={draft.qty}
                      onChange={(e) => updateLine(line.key, { qty: Math.max(1, Number(e.target.value) || 1) })}
                    />
                  </td>
                  <td className="so-pricing-td">
                    <Input
                      type="number"
                      min={0}
                      className="so-pricing-input so-pricing-input--num"
                      value={draft.unitPrice}
                      onChange={(e) => updateLine(line.key, { unitPrice: Math.max(0, Number(e.target.value) || 0) })}
                    />
                  </td>
                  <td className="so-pricing-td">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      className="so-pricing-input so-pricing-input--num"
                      value={draft.discountPct}
                      onChange={(e) => updateLine(line.key, { discountPct: Math.max(0, Number(e.target.value) || 0) })}
                    />
                  </td>
                  <td className="so-pricing-td">
                    <select
                      className="erp-input so-pricing-input so-pricing-input--select"
                      value={draft.taxPct}
                      onChange={(e) => updateLine(line.key, { taxPct: Number(e.target.value) })}
                    >
                      {GST_RATE_OPTIONS.map((rate) => (
                        <option key={rate} value={rate}>{rate}%</option>
                      ))}
                    </select>
                  </td>
                  <td className="so-pricing-td so-pricing-td--right so-pricing-td--calc tabular-nums">
                    {formatCurrency(line.taxableValue)}
                  </td>
                  <td className="so-pricing-td so-pricing-td--right so-pricing-td--calc tabular-nums">
                    {formatCurrency(line.gstAmount)}
                  </td>
                  <td className="so-pricing-td so-pricing-td--right so-pricing-td--total tabular-nums">
                    {formatCurrency(line.lineTotal)}
                  </td>
                  <td className="so-pricing-td so-pricing-td--center">
                    <button
                      type="button"
                      className="so-pricing-remove"
                      onClick={() => removeLine(line.key)}
                      aria-label="Remove line"
                      disabled={lines.length <= 1}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="so-pricing-toolbar">
        <button type="button" className="so-pricing-add" onClick={addLine}>
          <Plus className="h-4 w-4" />
          Add product line
        </button>
        <p className="so-pricing-toolbar__hint">
          <span className="so-pricing-toolbar__count">{lines.length}</span>
          {' '}line{lines.length === 1 ? '' : 's'} · qty, price & GST edit inline
        </p>
      </div>

      <div className="so-pricing-totals">
        <div className="so-pricing-adjust">
          <p className="so-pricing-adjust__title">Order adjustments</p>
          <div className="so-pricing-charges">
            <label className="so-pricing-charge">
              <span className="so-pricing-charge__label">Freight</span>
              <div className="so-pricing-charge__control">
                <span className="so-pricing-charge__prefix" aria-hidden>₹</span>
                <Input
                  type="number"
                  min={0}
                  className="so-pricing-input so-pricing-input--num"
                  value={freightAmount}
                  onChange={(e) => setFreightAmount(Math.max(0, Number(e.target.value) || 0))}
                />
              </div>
            </label>
            <div className="so-pricing-charge">
              <div className="so-pricing-charge__label-row">
                <span className="so-pricing-charge__label">Order discount</span>
                <div className="so-pricing-discount-mode" role="group" aria-label="Discount type">
                  <button
                    type="button"
                    className={`so-pricing-discount-mode__btn${orderDiscountMode === 'flat' ? ' so-pricing-discount-mode__btn--active' : ''}`}
                    aria-pressed={orderDiscountMode === 'flat'}
                    onClick={() => {
                      if (orderDiscountMode === 'flat') return
                      setOrderDiscountMode('flat')
                      setOrderDiscountInput(0)
                    }}
                  >
                    Flat ₹
                  </button>
                  <button
                    type="button"
                    className={`so-pricing-discount-mode__btn${orderDiscountMode === 'percent' ? ' so-pricing-discount-mode__btn--active' : ''}`}
                    aria-pressed={orderDiscountMode === 'percent'}
                    onClick={() => {
                      if (orderDiscountMode === 'percent') return
                      setOrderDiscountMode('percent')
                      setOrderDiscountInput(0)
                    }}
                  >
                    % Discount
                  </button>
                </div>
              </div>
              <label className="so-pricing-charge__control">
                <span className="so-pricing-charge__prefix" aria-hidden>
                  {orderDiscountMode === 'percent' ? '%' : '₹'}
                </span>
                <Input
                  type="number"
                  min={0}
                  max={orderDiscountMode === 'percent' ? 100 : undefined}
                  step={orderDiscountMode === 'percent' ? 0.5 : 1}
                  className="so-pricing-input so-pricing-input--num"
                  value={orderDiscountInput}
                  onChange={(e) => {
                    const raw = Math.max(0, Number(e.target.value) || 0)
                    setOrderDiscountInput(
                      orderDiscountMode === 'percent' ? Math.min(100, raw) : raw,
                    )
                  }}
                  aria-label={orderDiscountMode === 'percent' ? 'Order discount percent' : 'Order discount amount'}
                />
              </label>
              {orderDiscountMode === 'percent' && orderDiscountInput > 0 ? (
                <p className="so-pricing-charge__hint">
                  Equals {formatCurrency(orderSummary.orderDiscountAmount)} off taxable + GST
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <aside className="so-pricing-summary" aria-label="Order summary">
          <p className="so-pricing-summary__title">Order summary</p>
          <div className="so-pricing-summary__rows">
            <div className="so-pricing-summary__row">
              <span>Total quantity</span>
              <span className="tabular-nums">{orderSummary.totalQty}</span>
            </div>
            <div className="so-pricing-summary__row">
              <span>Basic amount</span>
              <span className="tabular-nums">{formatCurrency(orderSummary.basicAmount)}</span>
            </div>
            {orderSummary.totalLineDiscount > 0 ? (
              <div className="so-pricing-summary__row">
                <span>Line discount</span>
                <span className="tabular-nums">−{formatCurrency(orderSummary.totalLineDiscount)}</span>
              </div>
            ) : null}
            <div className="so-pricing-summary__row">
              <span>Taxable amount</span>
              <span className="tabular-nums">{formatCurrency(orderSummary.subtotal)}</span>
            </div>
            {[...orderSummary.gstByRate.entries()]
              .sort(([a], [b]) => a - b)
              .map(([rate, amount]) => (
                <div key={rate} className="so-pricing-summary__row">
                  <span>GST @ {rate}%</span>
                  <span className="tabular-nums">{formatCurrency(amount)}</span>
                </div>
              ))}
            <div className="so-pricing-summary__row">
              <span>Total GST</span>
              <span className="tabular-nums">{formatCurrency(orderSummary.totalGst)}</span>
            </div>
            <div className="so-pricing-summary__row">
              <span>Freight</span>
              <span className="tabular-nums">{formatCurrency(freightAmount)}</span>
            </div>
            <div className="so-pricing-summary__row">
              <span>
                Order discount
                {orderDiscountMode === 'percent' && orderDiscountInput > 0
                  ? ` (${orderDiscountInput}%)`
                  : ''}
              </span>
              <span className="tabular-nums">
                {orderSummary.orderDiscountAmount > 0
                  ? `−${formatCurrency(orderSummary.orderDiscountAmount)}`
                  : formatCurrency(0)}
              </span>
            </div>
          </div>
          <div className="so-pricing-summary__grand">
            <span>Grand total</span>
            <strong className="tabular-nums">{formatCurrency(orderSummary.grandTotal)}</strong>
          </div>
        </aside>
      </div>
    </div>
  )

  const customerFields = (
    <>
      <div className="so-create-path-chip" role="status">
        <span className="so-create-path-chip__mode" aria-hidden>
          {createMode === 'quotation' ? <FileText className="h-3.5 w-3.5" /> : <Zap className="h-3.5 w-3.5" />}
        </span>
        <span className="so-create-path-chip__label">Creating</span>
        <span className="so-create-path-chip__value">
          {createMode === 'quotation' ? 'From quotation' : 'Direct sales order'}
        </span>
        {!skipModeChooser ? (
          <button type="button" className="so-create-path-chip__change" onClick={reopenModeChooser}>
            Change path
          </button>
        ) : null}
      </div>

      {createMode === 'quotation' ? (
        <ErpFieldRow
          label="Quotation Number"
          required
          colSpan={3}
          dataField="quotationDocumentId"
          fieldError={validationErrors.quotationDocumentId}
          hint="Approved quotations only — selecting one fills customer, lines, and terms"
        >
          <ErpSmartSelect
            options={quotationOptions}
            value={quotationDocumentId}
            onChange={(v) => {
              if (v) applyQuotation(v)
              else setQuotationDocumentId('')
            }}
            allowEmpty
            placeholder="Search quotation no, customer, city, amount…"
            dropdownMinWidth={480}
          />
        </ErpFieldRow>
      ) : null}

      <ErpFieldGroup label="Bill-to customer" className="so-qe-customer-group">
        <ErpFieldRow label="Customer" required colSpan={3} dataField="customerId" fieldError={validationErrors.customerId}>
          <QuickCreateSelect
            entityType="customer"
            value={customerId}
            onChange={setCustomerId}
            options={customerOptions}
            placeholder="Search by code, name, or city…"
          />
        </ErpFieldRow>
        {customer ? (
          <aside className="so-customer-card" aria-label="Selected customer">
            <div className="so-customer-card__header">
              <div className="so-customer-card__avatar" aria-hidden>
                {customer.customerName
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((w) => w[0])
                  .join('')
                  .toUpperCase()}
              </div>
              <div className="so-customer-card__identity">
                <div className="so-customer-card__title-row">
                  <h3 className="so-customer-card__name">{customer.customerName}</h3>
                  <span className="so-customer-card__code">{customer.customerCode}</span>
                </div>
                <p className="so-customer-card__location">
                  <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span>
                    {[customer.city, customer.state, customer.pincode].filter(Boolean).join(', ')}
                  </span>
                </p>
              </div>
              <AppLink
                to={resolveCompany360Path(customer.id, pathname)}
                className="so-customer-card__360"
              >
                View 360
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </AppLink>
            </div>

            <dl className="so-customer-card__facts">
              <div className="so-customer-card__fact">
                <dt>GSTIN</dt>
                <dd className="tabular-nums">{customer.gstin?.trim() || '—'}</dd>
              </div>
              <div className="so-customer-card__fact">
                <dt>Credit days</dt>
                <dd className="tabular-nums">{customer.creditDays} days</dd>
              </div>
              <div className="so-customer-card__fact">
                <dt>Credit limit</dt>
                <dd className="tabular-nums">
                  {customer.creditLimit != null && customer.creditLimit > 0
                    ? formatCurrency(customer.creditLimit)
                    : 'No limit'}
                </dd>
              </div>
              {customer.contactPerson ? (
                <div className="so-customer-card__fact so-customer-card__fact--wide">
                  <dt>Primary contact</dt>
                  <dd>
                    {customer.contactPerson}
                    {customer.contactPhone ? (
                      <span className="so-customer-card__contact-meta"> · {customer.contactPhone}</span>
                    ) : null}
                  </dd>
                </div>
              ) : null}
            </dl>
          </aside>
        ) : (
          <div className="so-customer-card so-customer-card--empty" role="status">
            <div className="so-customer-card__empty-icon" aria-hidden>
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <p className="so-customer-card__empty-title">No customer selected</p>
              <p className="so-customer-card__empty-copy">
                Search and select a bill-to company to load GSTIN, credit terms, and contact details.
              </p>
            </div>
          </div>
        )}
      </ErpFieldGroup>

      <ErpFieldGroup label="Customer purchase order" className="so-qe-po-group">
        <ErpFieldRow label="Customer PO Number" required dataField="customerPoNumber" fieldError={validationErrors.customerPoNumber}>
          <Input
            value={customerPoNumber}
            onChange={(e) => setCustomerPoNumber(e.target.value)}
            placeholder="e.g. PO/2026/1842"
          />
        </ErpFieldRow>
        <ErpFieldRow label="Customer PO Date">
          <Input type="date" value={customerPoDate} onChange={(e) => setCustomerPoDate(e.target.value)} />
        </ErpFieldRow>
        <ErpFieldRow label="Expected Delivery Date">
          <Input
            type="date"
            value={expectedDeliveryDate}
            onChange={(e) => setExpectedDeliveryDate(e.target.value)}
          />
        </ErpFieldRow>
      </ErpFieldGroup>
    </>
  )

  const linesSection = (
    <ErpCardSection
      id="so-section-lines"
      nbaTarget="lines"
      title="Product & Pricing"
      subtitle="Build line items, then review adjustments and the live order total."
      icon={ClipboardList}
      accent="blue"
      collapsible
      defaultOpen
      className="!max-w-none so-pricing-section"
      columns={1}
    >
      {lineGrid}
    </ErpCardSection>
  )

  const commercialSection = (
    <ErpCardSection
      id="so-section-commercial"
      title="Commercial & Delivery"
      subtitle="Payment, fulfilment location, and optional notes."
      icon={Banknote}
      accent="green"
      collapsible
      defaultOpen
      className="!max-w-none so-commercial-section"
      columns={1}
    >
      <div className="so-commercial-body">
        <ErpFieldGroup label="Commercial terms" className="so-commercial-group" columns={2}>
          <ErpFieldRow label="Payment Terms" required dataField="paymentTerms" fieldError={validationErrors.paymentTerms}>
            <CommercialTermSelect
              termType="payment"
              value={paymentTerms}
              onChange={setPaymentTerms}
              placeholder="Select payment terms"
            />
          </ErpFieldRow>
          <ErpFieldRow label="Delivery Terms" required dataField="deliveryTerms" fieldError={validationErrors.deliveryTerms}>
            <CommercialTermSelect
              termType="delivery"
              value={deliveryTerms}
              onChange={setDeliveryTerms}
              placeholder="Select delivery terms"
            />
          </ErpFieldRow>
        </ErpFieldGroup>

        <ErpFieldGroup label="Fulfilment" className="so-commercial-group" columns={2}>
          <LocationFieldRow
            value={locationId}
            onChange={(locId) => {
              setLocationId(locId)
              const loc = locations.find((l) => l.id === locId)
              if (loc) setDeliveryLocation(locationDisplayLabel(loc))
            }}
            usage="sales"
            colSpan={2}
            label="Fulfilment location"
            hint="Where goods will ship from — inherited from Lead → Opportunity → Quotation when available"
          />
        </ErpFieldGroup>

        <ErpFieldGroup label="Notes" className="so-commercial-group" columns={1}>
          {needsDirectReasonField ? (
            <ErpFieldRow
              label="Reason for Direct Sales Order"
              hint="Optional — useful for audit when skipping quotation conversion"
              className="col-span-full"
            >
              <Textarea
                rows={3}
                value={directSoReason}
                onChange={(e) => setDirectSoReason(e.target.value)}
                placeholder="Optional: why this order bypasses the standard quotation flow…"
              />
            </ErpFieldRow>
          ) : null}
          <ErpFieldRow label="Internal Remarks" className="col-span-full">
            <Textarea
              rows={2}
              value={internalRemarks}
              onChange={(e) => setInternalRemarks(e.target.value)}
              placeholder="Special instructions, freight notes, commercial exceptions…"
            />
          </ErpFieldRow>
        </ErpFieldGroup>
      </div>
    </ErpCardSection>
  )

  const documentsSection = (
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
  )

  const contextBanner = fromOpportunity && opportunityPrefill ? (
    <div className="crm-so-handover">
      <div className="crm-so-handover__header">
        <div className="crm-so-handover__icon">
          <Handshake className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="crm-so-handover__eyebrow">
            {fromCrm ? 'CRM pipeline handover' : 'From opportunity'}
          </p>
          <p className="crm-so-handover__title">{opportunityPrefill.opportunityName}</p>
        </div>
        <DynamicsStatusChip
          label={opportunityPrefill.canConvertQuotation ? 'Quote accepted' : 'From opportunity'}
          tone={opportunityPrefill.canConvertQuotation ? 'success' : 'info'}
        />
      </div>
      <div className="crm-quotation-new__opp-summary">
        <div>
          <p className="crm-quotation-new__opp-label">Opportunity</p>
          <p className="crm-quotation-new__opp-value">{opportunityPrefill.opportunityNo}</p>
        </div>
        <div>
          <p className="crm-quotation-new__opp-label">Customer</p>
          <p className="crm-quotation-new__opp-value">{customer?.customerName ?? '—'}</p>
        </div>
        <div>
          <p className="crm-quotation-new__opp-label">Quotation</p>
          <p className="crm-quotation-new__opp-value">{quotationDisplayNo}</p>
        </div>
        <div>
          <p className="crm-quotation-new__opp-label">Quote value</p>
          <p className="crm-quotation-new__opp-value">
            {opportunityPrefill.quotationGrandTotal > 0
              ? formatCurrency(opportunityPrefill.quotationGrandTotal)
              : formatCurrency(orderSummary.grandTotal)}
          </p>
        </div>
        <div>
          <p className="crm-quotation-new__opp-label">Lines</p>
          <p className="crm-quotation-new__opp-value">
            {opportunityPrefill.quotationLineCount > 0
              ? `${opportunityPrefill.quotationLineCount} · ${opportunityPrefill.quotationItemsSummary || 'Prefilled'}`
              : `${lines.length} line${lines.length === 1 ? '' : 's'}`}
          </p>
        </div>
        <div>
          <p className="crm-quotation-new__opp-label">Status</p>
          <p className="crm-quotation-new__opp-value">Draft SO</p>
        </div>
      </div>
    </div>
  ) : null

  const formBody = (
    <div className="erp-form-body crm-so-create-body">
      {contextBanner}
      <ErpQuickEntrySection
        id="so-section-quick"
        title="Quick Entry"
        subtitle={
          createMode === 'quotation'
            ? 'From quotation — pick an approved quote, then confirm PO details.'
            : 'Direct sales order — choose customer and PO; quotation not required.'
        }
        collapsedSummary={
          customer
            ? `${customer.customerName}${customerPoNumber ? ` · PO ${customerPoNumber}` : ''}`
            : createMode === 'quotation'
              ? 'Select quotation and customer'
              : 'Select customer and PO'
        }
      >
        {customerFields}
      </ErpQuickEntrySection>

      {linesSection}
      {commercialSection}
      {documentsSection}
    </div>
  )

  if (!modeChosen) {
    return (
      <OperationalPageShell
        title="New Sales Order"
        badge={fromCrm ? 'CRM' : 'Sales'}
        variant="dynamics"
        favoritePath={fromCrm ? CRM_SALES_ORDERS_PATH : '/sales/orders/new'}
        breadcrumbs={
          fromCrm
            ? crmChildBreadcrumbs('Sales Orders', CRM_SALES_ORDERS_PATH, 'New')
            : salesChildBreadcrumbs('Sales Orders', '/sales/orders', 'New')
        }
      >
        <SalesOrderCreateModeChooser
          fromCrm={fromCrm}
          onSelect={chooseCreateMode}
          onCancel={() => navigate(listPath)}
        />
      </OperationalPageShell>
    )
  }

  return (
    <>
      <CrmCardFormShell
        title={createTitle}
        badge={fromCrm ? 'CRM' : 'Sales'}
        className={`${ENTERPRISE_FORM_CLASS} enterprise-workspace--crm-smart-overview crm-so-create-page`}
        collapsibleFactBox
        factBoxLabel="Smart Context"
        suppressFactBoxRecord
        stickyFooter
        recordNo="New"
        recordTitle={recordTitle}
        status="Draft SO"
        statusTone="info"
        stage={
          createMode === 'quotation'
            ? (opportunityPrefill?.canConvertQuotation ? 'Quote handover' : 'From quotation')
            : fromOpportunity
              ? (fromCrm ? 'Pipeline handover' : 'From Opportunity')
              : 'Direct SO'
        }
        createdDate={formatDate(new Date().toISOString().slice(0, 10))}
        company={customer?.customerName}
        favoritePath={fromCrm ? `${CRM_SALES_ORDERS_PATH}` : '/sales/orders/new'}
        breadcrumbs={
          fromCrm
            ? crmChildBreadcrumbs('Sales Orders', CRM_SALES_ORDERS_PATH, 'New')
            : salesChildBreadcrumbs('Sales Orders', '/sales/orders', createTitle)
        }
        documentStrip={documentStrip}
        factBox={factBox}
        onSubmit={handleSubmit}
        onSaveShortcut={() => persist('save')}
        onSaveCloseShortcut={() => persist('save_close')}
        onSaveAndNewShortcut={() => persist('save_new')}
        footer={(
          <ErpStickySaveBar
            sticky
            cancelTo={listPath}
            submitLabel="Save"
            isSubmitting={isSubmitting}
            onSave={() => void persist('save')}
            onSaveAndNew={() => void persist('save_new')}
            onSaveAndClose={() => void persist('save_close')}
            hint={(
              <span className="text-[12px] text-erp-muted">
                {completionPercent}% complete · {formatCurrency(orderSummary.grandTotal)} grand total
                {expectedDeliveryDate ? ` · Delivery ${formatDate(expectedDeliveryDate)}` : ''}
                {' · Ctrl+S Save · Ctrl+Shift+S Save & Close · Alt+N Save & New'}
              </span>
            )}
          />
        )}
      >
        <EnterpriseFormSectionNav
          sections={sectionNavItems}
          activeId={activeSection}
          onSelect={scrollToSection}
        />

        <EnterpriseFormMetrics metrics={formMetrics} />

        {formBody}
      </CrmCardFormShell>
    </>
  )
}
