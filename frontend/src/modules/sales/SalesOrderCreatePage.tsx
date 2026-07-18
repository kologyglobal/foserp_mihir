import { useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Banknote,
  Building2,
  ClipboardList,
  FileImage,
  FileSpreadsheet,
  FileText,
  Handshake,
  Paperclip,
  PenLine,
  Plus,
  ShieldAlert,
  Trash2,
} from 'lucide-react'
import {
  ErpAdditionalInfoPanel,
  ErpAdditionalInfoToggle,
  ErpCardSection,
  ErpFieldRow,
  ErpQuickEntrySection,
  ErpStickySaveBar,
  useErpAdditionalInfo,
} from '../../components/erp/card-form'
import { FactBoxPaneAiToggle } from '../../components/erp/card-form/FactBoxPaneAiToggle'
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
import { ErpSegmentedControl } from '../../components/erp/ErpSegmentedControl'
import { CommercialTermSelect } from '../../components/masters/GeographySelects'
import { QuickCreateSelect } from '../../components/quick-create/QuickCreateSelect'
import { Input, Textarea } from '../../components/forms/Inputs'
import { AppLink } from '../../components/ui/AppLink'
import { resolveCompany360Path } from '../../config/entity360Routes'
import { Toast } from '../../components/ui/Toast'
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

const GST_RATE_OPTIONS = [0, 5, 12, 18, 28] as const

type SoCreateMode = 'quotation' | 'direct'

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
  const [toast, setToast] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    open: showAdditionalDetails,
    setOpen: setShowAdditionalDetails,
    toggle: toggleAdditionalDetails,
    panelId: additionalPanelId,
  } = useErpAdditionalInfo({
    preferOpen: Boolean(opportunityIdParam || quotationDocumentIdParam),
  })

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

  function handleCreateModeChange(mode: SoCreateMode) {
    if (mode === createMode) return
    setCreateMode(mode)
    setValidationErrors([])
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
    const effectiveQuoteId = quotationDocumentId || opportunityPrefill?.quotationDocumentId || null

    if (fromOpportunity && createMode === 'quotation' && opportunitySoGate && !opportunitySoGate.enabled) {
      errors.push(opportunitySoGate.disabledReason ?? 'Available after quotation approval.')
    }

    if (createMode === 'quotation' && !effectiveQuoteId) {
      errors.push('Select an approved quotation.')
    }
    if (!customerId) errors.push('Select a customer.')
    if (!lines.length) errors.push('Add at least one product line.')
    if (lines.some((l) => !l.productId)) errors.push('Every line needs a product.')
    if (lines.some((l) => !l.qty || l.qty < 1)) errors.push('Line quantities must be at least 1.')
    if (lines.some((l) => l.unitPrice <= 0)) errors.push('Line unit prices must be greater than zero.')
    if (!customerPoNumber.trim()) errors.push('Customer PO number is required.')
    if (!paymentTerms.trim()) errors.push('Payment terms are required.')
    if (!deliveryTerms.trim()) errors.push('Delivery terms are required.')
    if (createMode === 'direct' && directSoReason.trim().length < 10) {
      errors.push('Provide a clear reason for direct SO (minimum 10 characters).')
    }
    return errors
  }

  async function persist(saveMode: 'save' | 'save_new' | 'save_close') {
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
          orderDiscountAmount,
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
        setToast('Sales order saved — ready for next entry')
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
    setToast(r.error ?? 'Could not create sales order')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    persist('save')
  }

  const needsDirectReason = createMode === 'direct'
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
      done: Boolean(
        paymentTerms.trim()
        && deliveryTerms.trim()
        && (!needsDirectReason || directSoReason.trim().length >= 10),
      ),
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
    needsDirectReason,
    directSoReason,
    attachments.length,
  ])

  const completionPercent = Math.round((completionItems.filter((i) => i.done).length / completionItems.length) * 100)

  function scrollToSection(sectionId: string) {
    const additionalIds = new Set(['lines', 'commercial', 'documents'])
    const needsExpand = additionalIds.has(sectionId) && !showAdditionalDetails
    if (needsExpand) setShowAdditionalDetails(true)
    const navId = sectionId === 'customer' ? 'quick' : sectionId
    setActiveSection(navId)
    window.setTimeout(() => {
      const elId = (sectionId === 'customer' || sectionId === 'quick')
        ? 'so-section-quick'
        : `so-section-${sectionId}`
      document.getElementById(elId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, needsExpand ? 300 : 0)
  }

  const sectionNavItems = useMemo(() => {
    const quick = {
      id: 'quick',
      label: 'Quick',
      icon: Building2,
      done: completionItems.find((i) => i.id === 'quick')?.done,
    }
    if (!showAdditionalDetails) return [quick]
    return [
      quick,
      { id: 'lines', label: 'Products', icon: ClipboardList, done: completionItems.find((i) => i.id === 'lines')?.done },
      { id: 'commercial', label: 'Commercial', icon: Banknote, done: completionItems.find((i) => i.id === 'commercial')?.done },
      { id: 'documents', label: 'Documents', icon: Paperclip, done: completionItems.find((i) => i.id === 'documents')?.done },
    ]
  }, [completionItems, showAdditionalDetails])

  const additionalSectionCount = 3
  const additionalAttentionCount = [
    !hasValidLines,
    !paymentTerms.trim() || !deliveryTerms.trim() || (needsDirectReason && directSoReason.trim().length < 10),
    attachments.length === 0 && !customerPoNumber.trim(),
  ].filter(Boolean).length

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

  const validationGuideItems = useMemo(
    () => validationErrors.map((err, i) => ({ id: `err-${i}`, label: err, message: err })),
    [validationErrors],
  )

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
    ? { id: 'quotation', title: 'Select quotation', description: 'Search an approved quotation to auto-fill customer, lines, and terms.', ctaLabel: 'Choose quotation' }
    : !customerId
      ? { id: 'customer', title: 'Select customer', description: 'Choose the bill-to company for this sales order.', ctaLabel: 'Go to customer' }
      : !customerPoNumber.trim()
        ? { id: 'po', title: 'Enter customer PO', description: 'Customer PO number is required before saving.', ctaLabel: 'Enter PO' }
        : !hasValidLines
          ? { id: 'lines', title: 'Complete product lines', description: 'Add quantity and unit price for each line.', ctaLabel: 'Go to products' }
          : needsDirectReason && directSoReason.trim().length < 10
            ? { id: 'commercial', title: 'Add direct SO reason', description: 'Explain why this order bypasses quotation conversion.', ctaLabel: 'Commercial terms' }
            : { id: 'save', title: 'Ready to save', description: 'Review totals and save the draft sales order.', ctaLabel: 'Save Draft SO' }

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
        if (nextSmartAction.id === 'save') persist('save')
        else if (nextSmartAction.id === 'lines') scrollToSection('lines')
        else if (nextSmartAction.id === 'commercial') scrollToSection('commercial')
        else scrollToSection('quick')
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
    <div className="so-pricing-panel">
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
              <th className="so-pricing-th so-pricing-th--right">Unit Price</th>
              <th className="so-pricing-th so-pricing-th--right">Disc %</th>
              <th className="so-pricing-th so-pricing-th--right">GST %</th>
              <th className="so-pricing-th so-pricing-th--right">Taxable</th>
              <th className="so-pricing-th so-pricing-th--right">GST</th>
              <th className="so-pricing-th so-pricing-th--right">Line Total</th>
              <th className="so-pricing-th" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {computedLines.map((line, idx) => {
              const draft = lines[idx]
              if (!draft) return null
              const product = draft.productId ? getProduct(draft.productId) : undefined
              return (
                <tr key={line.key}>
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
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-amber-700">
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
                  <td className="so-pricing-td so-pricing-td--right tabular-nums">
                    {formatCurrency(line.taxableValue)}
                  </td>
                  <td className="so-pricing-td so-pricing-td--right tabular-nums">
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
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <button type="button" className="so-pricing-add" onClick={addLine}>
        <Plus className="h-3.5 w-3.5" /> Add product line
      </button>

      <div className="so-pricing-footer">
        <div className="so-pricing-charges">
          <label className="so-pricing-charge">
            <span className="so-pricing-charge__label">Freight (₹)</span>
            <Input
              type="number"
              min={0}
              className="so-pricing-input so-pricing-input--num"
              value={freightAmount}
              onChange={(e) => setFreightAmount(Math.max(0, Number(e.target.value) || 0))}
            />
          </label>
          <label className="so-pricing-charge">
            <span className="so-pricing-charge__label">Order Discount (₹)</span>
            <Input
              type="number"
              min={0}
              className="so-pricing-input so-pricing-input--num"
              value={orderDiscountAmount}
              onChange={(e) => setOrderDiscountAmount(Math.max(0, Number(e.target.value) || 0))}
            />
          </label>
        </div>

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
            <span className="tabular-nums">
              {orderDiscountAmount > 0 ? `−${formatCurrency(orderDiscountAmount)}` : formatCurrency(0)}
            </span>
          </div>
          <div className="quo-editor-price__summary-row quo-editor-price__summary-row--total">
            <span>Grand Total</span>
            <span className="tabular-nums">{formatCurrency(orderSummary.grandTotal)}</span>
          </div>
        </div>
      </div>
    </div>
  )

  const customerFields = (
    <>
      <ErpFieldRow label="Create from" colSpan={2}>
        <ErpSegmentedControl<SoCreateMode>
          name="Sales order create mode"
          value={createMode}
          onChange={handleCreateModeChange}
          options={[
            {
              value: 'quotation',
              label: 'From quotation',
              description: 'Search an approved quotation — customer, lines, and terms auto-fill.',
              icon: FileText,
            },
            {
              value: 'direct',
              label: 'Direct sales order',
              description: 'Choose the customer first and build the order without a quotation (items required).',
              icon: PenLine,
            },
          ]}
        />
      </ErpFieldRow>

      {createMode === 'quotation' ? (
        <ErpFieldRow
          label="Quotation Number"
          required
          colSpan={2}
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
      ) : (
        <div className="col-span-2">
          <p className="pi-create-mode-hint">
            <PenLine className="h-4 w-4 shrink-0" aria-hidden />
            Direct mode — choose the bill-to customer below. Quotation is not required; a direct SO reason is needed in Commercial.
          </p>
        </div>
      )}

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
            <AppLink to={resolveCompany360Path(customer.id, pathname)} className="shrink-0 text-[11px] font-semibold">
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
    </>
  )

  const linesSection = (
    <ErpCardSection
      id="so-section-lines"
      title="Product & Pricing"
      subtitle="Set quantity, price, discount and GST per product line."
      icon={ClipboardList}
      accent="violet"
      collapsible
      defaultOpen
      className="!max-w-none"
      columns={1}
    >
      {lineGrid}
    </ErpCardSection>
  )

  const commercialSection = (
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
  ) : (
    <div className="crm-so-handover">
      <div className="crm-so-handover__header">
        <div className="crm-so-handover__icon">
          <FileText className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="crm-so-handover__eyebrow">Sales order create</p>
          <p className="crm-so-handover__title">
            {createMode === 'quotation' ? 'Convert an approved quotation' : 'Create a direct sales order'}
          </p>
        </div>
        <DynamicsStatusChip
          label={createMode === 'quotation' ? 'From quotation' : 'Direct SO'}
          tone={createMode === 'quotation' ? 'success' : 'info'}
        />
      </div>
    </div>
  )

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
      >
        {customerFields}
      </ErpQuickEntrySection>

      <ErpAdditionalInfoToggle
        open={showAdditionalDetails}
        onToggle={() => {
          if (showAdditionalDetails) setActiveSection('quick')
          toggleAdditionalDetails()
        }}
        panelId={additionalPanelId}
        sectionCount={additionalSectionCount}
        attentionCount={additionalAttentionCount}
      />

      <ErpAdditionalInfoPanel open={showAdditionalDetails} id={additionalPanelId}>
        {linesSection}
        {commercialSection}
        {documentsSection}
      </ErpAdditionalInfoPanel>
    </div>
  )

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
        validationItems={validationGuideItems.length ? validationGuideItems : undefined}
        validationErrors={validationGuideItems.length ? undefined : validationErrors}
        factBox={factBox}
        onSubmit={handleSubmit}
        onSaveShortcut={() => persist('save')}
        onSaveCloseShortcut={() => persist('save_close')}
        onSaveAndNewShortcut={() => persist('save_new')}
        formSaveActions={{
          isSubmitting,
          saveLabel: 'Save',
          onSave: () => void persist('save'),
          onSaveAndNew: () => void persist('save_new'),
          onSaveAndClose: () => void persist('save_close'),
          onCancel: () => navigate(listPath),
        }}
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
          trailing={<FactBoxPaneAiToggle />}
        />

        <EnterpriseFormMetrics metrics={formMetrics} />

        {formBody}
      </CrmCardFormShell>
      {toast ? <Toast message={toast} variant={toast.includes('saved') ? 'success' : 'error'} /> : null}
    </>
  )
}
