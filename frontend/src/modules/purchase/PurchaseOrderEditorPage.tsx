import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Building2,
  CheckCircle,
  ClipboardList,
  Copy,
  Eraser,
  FileSignature,
  MapPin,
  Package,
  Plus,
  Printer,
  Save,
  Send,
} from 'lucide-react'
import { PurchaseCardFormShell } from '@/components/purchase/PurchaseCardFormShell'
import {
  purchaseSectionId,
  scrollToPurchaseValidationTarget,
} from '@/components/purchase/PurchaseEnterpriseFormKit'
import {
  PurchaseOrderWorkspaceTabs,
  derivePoWorkspaceTabs,
  poSectionToWorkspace,
  poWorkspaceHasValidationErrors,
  type PoEditorWorkspace,
} from '@/components/purchase/PurchaseOrderWorkspaceTabs'
import {
  PurchaseDocumentFactBox,
  buildPurchaseRelatedLinks,
  purchaseDocumentApprovalFact,
} from '@/components/purchase/PurchaseDocumentFactBox'
import { purchaseStatusTone } from '@/components/purchase/purchaseCardFormShared'
import { PurchaseOrderLinesTable } from '@/components/purchase/PurchaseOrderLinesTable'
import { PurchaseDocumentWorkflowStrip } from '@/components/purchase/PurchaseDocumentWorkflowStrip'
import {
  PurchaseOrderOriginBanner,
  PurchaseOrderOriginPicker,
} from '@/components/purchase/PurchaseOrderOriginPicker'
import {
  PurchaseDocumentAttachments,
  purchaseAttachmentIdsFromRows,
  purchaseAttachmentRowsFromIds,
  type PurchaseDocumentAttachmentRow,
} from '@/components/purchase/PurchaseDocumentAttachments'
import { PurchaseTaxTotalsPanel } from '@/components/purchase/PurchaseTaxTotalsPanel'
import { PurchaseTermsNotesTabs } from '@/components/purchase/PurchaseTermsNotesTabs'
import { PurchaseTermSelect } from '@/components/purchase/PurchaseTermSelect'
import {
  ErpCardSection,
  ErpFieldRow,
  ErpFormSpan,
  ErpStickySaveBar,
} from '@/components/erp/card-form'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { ErpButton, ErpButtonGroup } from '@/components/erp/ErpButton'
import { Input, Select } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import { Modal } from '@/design-system/components/Modal'
import { EnterpriseFormMetrics } from '@/design-system/workspace'
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard'
import {
  attachmentsSummary,
  commercialTermsSummary,
  hasMeaningfulTaxTotals,
  notesSummary,
  taxTotalsSummary,
} from '@/modules/purchase/purchaseFastTabSummaries'
import {
  createPurchaseOrder,
  createPurchaseOrderFromBlanket,
  createPurchaseOrderFromComparison,
  createPurchaseOrderFromPr,
  createPurchaseOrderFromVendorQuotation,
  getBlanketOrders,
  getPurchaseItems,
  getPurchaseOrderById,
  getPurchaseRequisitions,
  getPurchaseSetup,
  getQuotationComparison,
  getRFQs,
  getVendorQuotations,
  getVendors,
  PurchaseServiceError,
  submitPurchaseOrder,
  updatePurchaseOrder,
  PURCHASE_ORDER_DOMAIN_STATUS_LABELS,
  PURCHASE_ORDER_ORIGIN_LABELS,
  PURCHASE_ORDER_TYPE_LABELS,
} from '@/services/purchase'
import type {
  BlanketPurchaseOrder,
  PurchaseItem,
  PurchaseItemCategory,
  PurchaseOrder,
  PurchaseOrderLine,
  PurchaseOrderLineItemType,
  PurchaseOrderOrigin,
  PurchaseOrderType,
  PurchaseRequisition,
  PurchaseSetup,
  QuotationComparison,
  RequestForQuotation,
  Vendor,
  VendorQuotation,
} from '@/types/purchaseDomain'
import { PURCHASE_DEMO_LOCATION, PURCHASE_DEMO_LOCATION_FG } from '@/data/purchase/purchaseDomainSeed'
import {
  isPurchaseInsuranceTermsApplicable,
  PURCHASE_DELIVERY_TERMS,
  PURCHASE_FREIGHT_TERMS,
  PURCHASE_INSURANCE_TERMS,
  PURCHASE_PACKING_TERMS,
  PURCHASE_PAYMENT_TERMS,
  PURCHASE_PRICE_BASIS,
} from '@/data/purchase/purchaseCommercialTerms'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import {
  purchaseFieldId,
  validatePurchaseOrderForm,
} from '@/utils/purchaseOrderValidation'
import { notify } from '@/store/toastStore'

const ACTOR = { id: 'user-buyer-01', code: 'BUY01', name: 'Rahul Patil' }
const LOCATION_OPTIONS = [PURCHASE_DEMO_LOCATION, PURCHASE_DEMO_LOCATION_FG]

const EDITABLE_STATUSES: PurchaseOrder['status'][] = ['draft', 'pending_approval']
const REVISABLE_STATUSES: PurchaseOrder['status'][] = [
  'released',
  'partially_received',
  'fully_received',
  'invoiced',
]

function today() {
  return new Date().toISOString().slice(0, 10)
}

function normalizeStateLabel(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Prefer place-of-supply vs vendor state; fall back to vendor.isInterstate when either side is blank. */
function deriveIsInterstate(vendorState: string, placeOfSupply: string, fallback = false): boolean {
  const vendor = normalizeStateLabel(vendorState)
  const place = normalizeStateLabel(placeOfSupply)
  if (!vendor || !place) return fallback
  return vendor !== place
}

function mentionsInsurance(...values: Array<string | null | undefined>) {
  return values.some((v) => Boolean(v && /insurance/i.test(v)))
}

type PoEditorLine = PurchaseOrderLine & { key: string }

function emptyLine(partial?: Partial<PurchaseOrderLine>): PoEditorLine {
  return {
    key: crypto.randomUUID(),
    id: '',
    lineNo: 1,
    itemType: 'raw_material',
    itemId: '',
    itemCode: '',
    itemName: '',
    description: '',
    specification: '',
    category: 'raw_material',
    uom: 'NOS',
    hsnCode: '',
    sacCode: null,
    quantity: 1,
    rate: 0,
    discountPct: 0,
    discountAmount: 0,
    gstRatePct: 18,
    taxAmount: 0,
    taxableAmount: 0,
    cgst: 0,
    sgst: 0,
    igst: 0,
    lineTotal: 0,
    requiredDate: today(),
    deliverySchedule: '',
    warehouseId: PURCHASE_DEMO_LOCATION.id,
    warehouseName: PURCHASE_DEMO_LOCATION.name,
    costCentre: '',
    project: '',
    productionOrder: '',
    receivedQty: 0,
    pendingQty: 0,
    invoicedQty: 0,
    lineStatus: 'open',
    locationId: PURCHASE_DEMO_LOCATION.id,
    locationName: PURCHASE_DEMO_LOCATION.name,
    expectedDeliveryDate: today(),
    prLineId: null,
    rfqLineId: null,
    vendorQuotationLineId: null,
    remarks: '',
    ...partial,
  }
}

function computeLine(line: PoEditorLine, isInterstate: boolean): PoEditorLine {
  const qty = Number(line.quantity) || 0
  const rate = Number(line.rate) || 0
  const basic = Number((qty * rate).toFixed(2))
  const discountAmount =
    line.discountPct > 0
      ? Number(((basic * (Number(line.discountPct) || 0)) / 100).toFixed(2))
      : Number(line.discountAmount) || 0
  const taxableAmount = Math.max(0, Number((basic - discountAmount).toFixed(2)))
  const gstRatePct = Number(line.gstRatePct) || 0
  const taxAmount = Number(((taxableAmount * gstRatePct) / 100).toFixed(2))
  const half = Number((taxAmount / 2).toFixed(2))
  const lineTotal = Number((taxableAmount + taxAmount).toFixed(2))
  const receivedQty = Number(line.receivedQty) || 0
  const pendingQty = Math.max(0, Number((qty - receivedQty).toFixed(2)))
  const lineStatus: PurchaseOrderLine['lineStatus'] =
    line.lineStatus === 'cancelled'
      ? 'cancelled'
      : receivedQty <= 0
        ? 'open'
        : receivedQty >= qty
          ? 'received'
          : 'partial'
  return {
    ...line,
    discountAmount,
    taxableAmount,
    taxAmount,
    cgst: isInterstate ? 0 : half,
    sgst: isInterstate ? 0 : half,
    igst: isInterstate ? taxAmount : 0,
    lineTotal,
    pendingQty,
    lineStatus,
  }
}

function renumberLines(lines: PoEditorLine[], isInterstate: boolean) {
  return lines.map((l, i) => computeLine({ ...l, lineNo: i + 1 }, isInterstate))
}

function aggregateTotals(
  lines: PoEditorLine[],
  tradeDiscount: number,
  freight: number,
  packingCharges: number,
  insuranceCharges: number,
  otherCharges: number,
  tcsAmount: number,
) {
  const subtotal = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.rate) || 0), 0)
  const lineDiscount = lines.reduce((s, l) => s + (Number(l.discountAmount) || 0), 0)
  const discount = lineDiscount + tradeDiscount
  const taxableAmount = lines.reduce((s, l) => s + l.taxableAmount, 0)
  const cgst = lines.reduce((s, l) => s + l.cgst, 0)
  const sgst = lines.reduce((s, l) => s + l.sgst, 0)
  const igst = lines.reduce((s, l) => s + l.igst, 0)
  const rawTotal =
    taxableAmount + cgst + sgst + igst + freight + packingCharges + insuranceCharges + otherCharges + tcsAmount
  const totalAmount = Math.round(rawTotal)
  const roundOff = Number((totalAmount - rawTotal).toFixed(2))
  return {
    subtotal: Number(subtotal.toFixed(2)),
    lineDiscount: Number(lineDiscount.toFixed(2)),
    discount: Number(discount.toFixed(2)),
    taxableAmount: Number(taxableAmount.toFixed(2)),
    cgst: Number(cgst.toFixed(2)),
    sgst: Number(sgst.toFixed(2)),
    igst: Number(igst.toFixed(2)),
    roundOff,
    totalAmount,
  }
}

interface PoEditorHeader {
  documentDate: string
  orderType: PurchaseOrderType
  vendorId: string
  vendorGstin: string
  vendorState: string
  vendorAddress: string
  isInterstate: boolean
  placeOfSupply: string
  purchaseLocationId: string
  deliveryLocationId: string
  department: string
  expectedDeliveryDate: string
  validityDate: string
  paymentTerms: string
  deliveryTerms: string
  freightTerms: string
  packingTerms: string
  insuranceTerms: string
  warranty: string
  inspectionRequirement: string
  priceBasis: string
  purchaseRequisitionNumber: string | null
  rfqNumber: string | null
  vendorQuotationNumber: string | null
  comparisonNumber: string | null
  blanketOrderNumber: string | null
  termsAndConditions: string
  internalNotes: string
  remarks: string
  tradeDiscount: number
  freight: number
  packingCharges: number
  insuranceCharges: number
  otherCharges: number
  tcsAmount: number
}

function defaultHeader(): PoEditorHeader {
  return {
    documentDate: today(),
    orderType: 'standard',
    vendorId: '',
    vendorGstin: '',
    vendorState: '',
    vendorAddress: '',
    isInterstate: false,
    placeOfSupply: '',
    purchaseLocationId: PURCHASE_DEMO_LOCATION.id,
    deliveryLocationId: PURCHASE_DEMO_LOCATION.id,
    department: 'Purchase',
    expectedDeliveryDate: today(),
    validityDate: '',
    paymentTerms: 'Net 30',
    deliveryTerms: 'FOR Chakan',
    freightTerms: 'Buyer freight',
    packingTerms: '',
    insuranceTerms: '',
    warranty: '',
    inspectionRequirement: '',
    priceBasis: '',
    purchaseRequisitionNumber: null,
    rfqNumber: null,
    vendorQuotationNumber: null,
    comparisonNumber: null,
    blanketOrderNumber: null,
    termsAndConditions: '',
    internalNotes: '',
    remarks: '',
    tradeDiscount: 0,
    freight: 0,
    packingCharges: 0,
    insuranceCharges: 0,
    otherCharges: 0,
    tcsAmount: 0,
  }
}

function headerFromPo(po: PurchaseOrder): PoEditorHeader {
  return {
    documentDate: po.documentDate,
    orderType: po.orderType,
    vendorId: po.vendor.id,
    vendorGstin: po.vendor.gstin,
    vendorState: po.vendor.state,
    vendorAddress: po.vendor.address,
    isInterstate: po.vendor.isInterstate,
    placeOfSupply: po.placeOfSupply,
    purchaseLocationId: po.purchaseLocation.id,
    deliveryLocationId: po.deliveryLocation.id,
    department: po.department,
    expectedDeliveryDate: po.expectedDeliveryDate,
    validityDate: po.validityDate ?? '',
    paymentTerms: po.paymentTerms,
    deliveryTerms: po.deliveryTerms,
    freightTerms: po.freightTerms,
    packingTerms: po.packingTerms,
    insuranceTerms: po.insuranceTerms,
    warranty: po.warranty,
    inspectionRequirement: po.inspectionRequirement,
    priceBasis: po.priceBasis,
    purchaseRequisitionNumber: po.purchaseRequisitionNumber,
    rfqNumber: po.rfqNumber,
    vendorQuotationNumber: po.vendorQuotationNumber,
    comparisonNumber: po.comparisonNumber,
    blanketOrderNumber: po.blanketOrderNumber,
    termsAndConditions: po.termsAndConditions,
    internalNotes: po.internalNotes,
    remarks: po.remarks,
    tradeDiscount: po.tradeDiscount,
    freight: po.freight,
    packingCharges: po.packingCharges,
    insuranceCharges: po.insuranceCharges,
    otherCharges: po.otherCharges,
    tcsAmount: po.tcsAmount,
  }
}

function linesFromPo(po: PurchaseOrder): PoEditorLine[] {
  return po.lines.map((l) => ({ ...l, key: l.id || crypto.randomUUID() }))
}

export function PurchaseOrderEditorPage() {
  const { id } = useParams()
  const isNew = !id
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [creating, setCreating] = useState(false)
  const [recordId, setRecordId] = useState<string | null>(id ?? null)
  const [documentNumber, setDocumentNumber] = useState<string | null>(null)
  const [status, setStatus] = useState<PurchaseOrder['status']>('draft')
  const [revisionNo, setRevisionNo] = useState(0)
  const [createdMeta, setCreatedMeta] = useState({ by: ACTOR.name, at: '' })
  const [updatedMeta, setUpdatedMeta] = useState({ by: '', at: '' })

  const [header, setHeader] = useState<PoEditorHeader>(defaultHeader)
  const [lines, setLines] = useState<PoEditorLine[]>([])
  const [attachments, setAttachments] = useState<PurchaseDocumentAttachmentRow[]>([])
  const [workspace, setWorkspace] = useState<PoEditorWorkspace>('vendor_order')
  const [, setActiveSection] = useState('general')
  const [attemptedMode, setAttemptedMode] = useState<'draft' | 'submit' | null>(null)
  const [forceOpenKey, setForceOpenKey] = useState(0)
  const [forceOpenSections, setForceOpenSections] = useState<
    Partial<Record<'general' | 'commercial' | 'lines', number>>
  >({})
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const attachmentIds = purchaseAttachmentIdsFromRows(attachments)

  const [vendors, setVendors] = useState<Vendor[]>([])
  const [catalogItems, setCatalogItems] = useState<PurchaseItem[]>([])
  const [purchaseSetup, setPurchaseSetup] = useState<PurchaseSetup | null>(null)

  const originParam = (searchParams.get('origin') ?? '') as string
  const originModeFromParam: PurchaseOrderOrigin =
    originParam === 'pr'
      ? 'purchase_requisition'
      : originParam === 'vq'
        ? 'vendor_quotation'
        : originParam === 'comparison'
          ? 'quotation_comparison'
          : originParam === 'blanket'
            ? 'blanket_order'
            : 'manual'

  const [originMode, setOriginMode] = useState<PurchaseOrderOrigin>(originModeFromParam)
  /** Deep-link / query param: origin already chosen; otherwise start with compact source chips. */
  const [originChosen, setOriginChosen] = useState(
    () =>
      Boolean(originParam) ||
      Boolean(
        searchParams.get('prId') ||
          searchParams.get('comparisonId') ||
          searchParams.get('vqId') ||
          searchParams.get('blanketId'),
      ),
  )
  const willAutoCreateFromQuery =
    (originModeFromParam === 'quotation_comparison' && Boolean(searchParams.get('comparisonId'))) ||
    (originModeFromParam === 'vendor_quotation' && Boolean(searchParams.get('vqId')))
  const [originLookupOpen, setOriginLookupOpen] = useState(
    () =>
      Boolean(originParam) &&
      originModeFromParam !== 'manual' &&
      !willAutoCreateFromQuery,
  )
  const [approvedPrs, setApprovedPrs] = useState<PurchaseRequisition[]>([])
  const [selectedPrId, setSelectedPrId] = useState(searchParams.get('prId') ?? '')
  const [selectedPrVendorId, setSelectedPrVendorId] = useState('')

  const [eligibleComparisons, setEligibleComparisons] = useState<
    { comparison: QuotationComparison; rfq: RequestForQuotation }[]
  >([])
  const [selectedComparisonId, setSelectedComparisonId] = useState(searchParams.get('comparisonId') ?? '')

  const [approvedVqs, setApprovedVqs] = useState<VendorQuotation[]>([])
  const [selectedVqId, setSelectedVqId] = useState(searchParams.get('vqId') ?? '')

  const [activeBlankets, setActiveBlankets] = useState<BlanketPurchaseOrder[]>([])
  const [selectedBlanketId, setSelectedBlanketId] = useState(searchParams.get('blanketId') ?? '')
  const [blanketQuantities, setBlanketQuantities] = useState<Record<string, number>>({})

  const editable = EDITABLE_STATUSES.includes(status)
  const { dirty, markDirty, resetDirty } = useUnsavedChangesGuard(editable)

  const selectedVendor = useMemo(() => vendors.find((v) => v.id === header.vendorId), [vendors, header.vendorId])
  const catalogItemsForPicker = useMemo(
    () =>
      catalogItems.map((item) => ({
        ...item,
        preferredVendorName:
          vendors.find((v) => v.id === item.preferredVendorId)?.vendorName ?? null,
        lastPurchaseRate: item.standardRate,
        availableStock: item.isStockable
          ? Math.max(0, Math.round(item.reorderLevel * 1.4))
          : null,
      })),
    [catalogItems, vendors],
  )
  const isInterstate = header.isInterstate

  const [sourceDocRefs, setSourceDocRefs] = useState<{
    purchaseRequisitionId: string | null
    rfqId: string | null
    vendorQuotationId: string | null
    comparisonId: string | null
    blanketOrderId: string | null
  }>({
    purchaseRequisitionId: null,
    rfqId: null,
    vendorQuotationId: null,
    comparisonId: null,
    blanketOrderId: null,
  })

  const inspectionCategories = purchaseSetup?.quality.inspectionRequiredCategories ?? []
  const showInspectionRequirement = useMemo(() => {
    if (header.inspectionRequirement.trim()) return true
    if (header.orderType === 'capital' || header.orderType === 'job_work') return true
    return lines.some((line) => {
      const hasItem = Boolean(line.itemId || line.itemCode.trim() || line.itemName.trim())
      if (!hasItem) return false
      const catalog = line.itemId ? catalogItems.find((i) => i.id === line.itemId) : undefined
      if (catalog?.qcRequired) return true
      const category = (catalog?.category ?? line.category) as PurchaseItemCategory | ''
      return Boolean(category && inspectionCategories.includes(category))
    })
  }, [
    header.inspectionRequirement,
    header.orderType,
    lines,
    catalogItems,
    inspectionCategories,
  ])

  const showTcs = Boolean(purchaseSetup?.tax.tcsEnabled) || Number(header.tcsAmount) > 0

  const showInsuranceTerms =
    isPurchaseInsuranceTermsApplicable(
      header.priceBasis,
      header.deliveryTerms,
      header.insuranceTerms,
    ) ||
    Number(header.insuranceCharges) > 0 ||
    mentionsInsurance(header.freightTerms, header.deliveryTerms, header.packingTerms)

  const computedLines = useMemo(() => renumberLines(lines, isInterstate), [lines, isInterstate])
  const validation = useMemo(
    () =>
      validatePurchaseOrderForm(
        {
          documentDate: header.documentDate,
          vendorId: header.vendorId,
          expectedDeliveryDate: header.expectedDeliveryDate,
          placeOfSupply: header.placeOfSupply,
        },
        computedLines,
        'submit',
      ),
    [header.documentDate, header.vendorId, header.expectedDeliveryDate, header.placeOfSupply, computedLines],
  )
  const draftValidation = useMemo(
    () =>
      validatePurchaseOrderForm(
        {
          documentDate: header.documentDate,
          vendorId: header.vendorId,
          expectedDeliveryDate: header.expectedDeliveryDate,
        },
        computedLines,
        'draft',
      ),
    [header.documentDate, header.vendorId, header.expectedDeliveryDate, computedLines],
  )
  const showErrors = attemptedMode !== null
  const activeValidation = attemptedMode === 'draft' ? draftValidation : validation
  const workspaceTabs = useMemo(
    () =>
      derivePoWorkspaceTabs({
        submitValidation: validation,
        attemptedValidation: showErrors ? activeValidation : null,
        dirty,
      }),
    [validation, showErrors, activeValidation, dirty],
  )
  const totals = useMemo(
    () =>
      aggregateTotals(
        computedLines,
        Number(header.tradeDiscount) || 0,
        Number(header.freight) || 0,
        Number(header.packingCharges) || 0,
        Number(header.insuranceCharges) || 0,
        Number(header.otherCharges) || 0,
        Number(header.tcsAmount) || 0,
      ),
    [computedLines, header.tradeDiscount, header.freight, header.packingCharges, header.insuranceCharges, header.otherCharges, header.tcsAmount],
  )

  const gstTotal = totals.cgst + totals.sgst + totals.igst
  const taxTotalsDefaultOpen = hasMeaningfulTaxTotals(
    totals.subtotal,
    gstTotal,
    totals.totalAmount,
  )

  const commercialSummary = useMemo(
    () =>
      commercialTermsSummary({
        expectedDelivery: header.expectedDeliveryDate,
        paymentTerms: header.paymentTerms,
        freightTerms: header.freightTerms,
        deliveryTerms: header.deliveryTerms,
        priceBasis: header.priceBasis,
        validityDate: header.validityDate,
      }),
    [
      header.expectedDeliveryDate,
      header.paymentTerms,
      header.freightTerms,
      header.deliveryTerms,
      header.priceBasis,
      header.validityDate,
    ],
  )

  const taxSummary = useMemo(
    () =>
      taxTotalsSummary({
        subtotal: totals.subtotal,
        tax: gstTotal,
        total: totals.totalAmount,
      }),
    [totals.subtotal, gstTotal, totals.totalAmount],
  )

  const documentFactBox = useMemo(() => {
    const approval = purchaseDocumentApprovalFact(status)
    const firstLine = computedLines.find((l) => l.itemId || l.itemCode.trim() || l.itemName.trim())
    const related = buildPurchaseRelatedLinks({
      purchaseRequisitionId: sourceDocRefs.purchaseRequisitionId,
      purchaseRequisitionNumber: header.purchaseRequisitionNumber,
      rfqId: sourceDocRefs.rfqId,
      rfqNumber: header.rfqNumber,
      vendorQuotationId: sourceDocRefs.vendorQuotationId,
      vendorQuotationNumber: header.vendorQuotationNumber,
      comparisonId: sourceDocRefs.comparisonId,
      comparisonNumber: header.comparisonNumber,
      blanketOrderId: sourceDocRefs.blanketOrderId,
      blanketOrderNumber: header.blanketOrderNumber,
    })
    return (
      <PurchaseDocumentFactBox
        vendor={
          selectedVendor
            ? {
                id: selectedVendor.id,
                code: selectedVendor.vendorCode,
                name: selectedVendor.vendorName,
                rating: selectedVendor.rating,
                paymentTerms: header.paymentTerms || selectedVendor.paymentTerms,
                leadTimeDays: selectedVendor.leadTimeDays,
              }
            : null
        }
        purchaseHistory={{
          lastPurchasePrice: firstLine && firstLine.rate > 0 ? firstLine.rate : null,
          lastVendorName: selectedVendor?.vendorName ?? null,
          averageLeadTimeDays: selectedVendor?.leadTimeDays ?? null,
        }}
        documentStatus={{
          statusLabel: PURCHASE_ORDER_DOMAIN_STATUS_LABELS[status],
          ...approval,
          createdBy: createdMeta.by || ACTOR.name,
          modifiedBy: updatedMeta.by || null,
          modifiedDate: updatedMeta.at ? formatDate(updatedMeta.at.slice(0, 10)) : null,
        }}
        related={related}
      />
    )
  }, [
    status,
    computedLines,
    sourceDocRefs,
    header.purchaseRequisitionNumber,
    header.rfqNumber,
    header.vendorQuotationNumber,
    header.comparisonNumber,
    header.blanketOrderNumber,
    header.paymentTerms,
    selectedVendor,
    createdMeta.by,
    updatedMeta.by,
    updatedMeta.at,
  ])

  const notesPeek = useMemo(
    () => notesSummary(header.termsAndConditions, header.internalNotes, header.remarks),
    [header.termsAndConditions, header.internalNotes, header.remarks],
  )

  const attachmentsPeek = useMemo(
    () => attachmentsSummary(attachments.length),
    [attachments.length],
  )

  const formMetrics = useMemo(
    () => [
      {
        label: 'Lines',
        value: String(computedLines.length),
        accent: 'green' as const,
      },
      {
        label: 'Subtotal',
        value: formatCurrency(totals.subtotal),
        accent: 'blue' as const,
      },
      {
        label: 'Tax',
        value: formatCurrency(gstTotal),
        accent: 'violet' as const,
      },
      {
        label: 'Grand Total',
        value: formatCurrency(totals.totalAmount),
        accent: 'amber' as const,
        highlight: totals.totalAmount > 0,
      },
    ],
    [computedLines.length, totals.subtotal, gstTotal, totals.totalAmount],
  )

  const documentTitle = isNew ? 'New Purchase Order' : (documentNumber ?? 'Purchase Order')
  const vendorFact = selectedVendor?.vendorName || 'Not selected'

  const recordHeaderFacts = useMemo(
    () => [
      ...(isNew
        ? [{ label: 'PO No', value: documentNumber ?? 'Auto-generated' }]
        : []),
      { label: 'Vendor', value: vendorFact },
      { label: 'Buyer', value: ACTOR.name },
      {
        label: 'Date',
        value: header.documentDate ? formatDate(header.documentDate) : 'Not selected',
      },
    ],
    [isNew, documentNumber, vendorFact, header.documentDate],
  )

  const patchHeader = (patch: Partial<PoEditorHeader>) => {
    setHeader((h) => ({ ...h, ...patch }))
    markDirty()
  }

  const setLinesDirty = (next: PoEditorLine[]) => {
    setLines(next)
    markDirty()
  }

  const patchLine = (key: string, patch: Partial<PurchaseOrderLine>) => {
    setLinesDirty(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }

  const applyVendor = (vendorId: string) => {
    const vendor = vendors.find((v) => v.id === vendorId)
    if (!vendor) {
      patchHeader({ vendorId: '', vendorGstin: '', vendorState: '', vendorAddress: '', isInterstate: false })
      return
    }
    const placeOfSupply = header.placeOfSupply || vendor.state
    patchHeader({
      vendorId: vendor.id,
      vendorGstin: vendor.gstin,
      vendorState: vendor.state,
      vendorAddress: vendor.address,
      placeOfSupply,
      isInterstate: deriveIsInterstate(vendor.state, placeOfSupply, vendor.isInterstate),
      paymentTerms: header.paymentTerms || vendor.paymentTerms,
      deliveryTerms: header.deliveryTerms || vendor.deliveryTerms,
    })
  }

  const applyItemCatalog = (key: string, itemId: string) => {
    const item = catalogItems.find((i) => i.id === itemId)
    if (!item) return
    patchLine(key, {
      itemId: item.id,
      itemCode: item.itemCode,
      itemName: item.itemName,
      description: item.itemName,
      category: item.category,
      itemType: (item.category === 'job_work' ? 'job_work' : item.category) as PurchaseOrderLineItemType,
      uom: item.uom,
      hsnCode: item.hsnCode,
      sacCode: item.sacCode,
      rate: item.standardRate,
      gstRatePct: item.gstRatePct,
    })
  }

  useEffect(() => {
    void Promise.all([
      getVendors(),
      getPurchaseItems(),
      getPurchaseRequisitions(),
      getVendorQuotations(),
      getRFQs(),
      getBlanketOrders(),
      getPurchaseSetup(),
    ]).then(async ([vendorRows, items, prs, vqs, rfqs, blankets, setup]) => {
      setVendors(vendorRows.filter((v) => v.isActive))
      setCatalogItems(items)
      setPurchaseSetup(setup)
      setApprovedPrs(
        prs
          .filter((p) => p.status === 'approved' || p.status === 'converted_to_rfq')
          .sort((a, b) => Number(!a.rfqRequired) - Number(!b.rfqRequired)),
      )
      setApprovedVqs(vqs.filter((q) => q.status === 'selected'))
      setActiveBlankets(blankets.filter((b) => b.status === 'active'))

      const rfqsWithComparison = rfqs.filter((r) => r.comparisonId)
      const comparisons = await Promise.all(
        rfqsWithComparison.map(async (rfq) => {
          const cmp = await getQuotationComparison(rfq.id)
          return cmp ? { comparison: cmp, rfq } : null
        }),
      )
      setEligibleComparisons(
        comparisons.filter(
          (c): c is { comparison: QuotationComparison; rfq: RequestForQuotation } =>
            c !== null && c.comparison.status === 'completed' && c.comparison.recommendationStatus === 'approved',
        ),
      )
    })
  }, [])

  useEffect(() => {
    if (isNew || !id) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const po = await getPurchaseOrderById(id)
      if (cancelled) return
      if (!po) {
        setLoading(false)
        notify.error('Purchase order not found')
        navigate('/purchase/orders')
        return
      }
      if (REVISABLE_STATUSES.includes(po.status)) {
        notify.info('This order is released — opening the revise workflow')
        navigate(`/purchase/orders/${po.id}/revise`, { replace: true })
        return
      }
      if (!EDITABLE_STATUSES.includes(po.status)) {
        notify.info(`${po.documentNumber} is ${PURCHASE_ORDER_DOMAIN_STATUS_LABELS[po.status]} — opening read-only view`)
        navigate(`/purchase/orders/${po.id}`, { replace: true })
        return
      }
      setRecordId(po.id)
      setDocumentNumber(po.documentNumber)
      setStatus(po.status)
      setRevisionNo(po.revisionNo)
      setOriginMode(po.origin)
      setHeader(headerFromPo(po))
      setLines(linesFromPo(po))
      setAttachments(purchaseAttachmentRowsFromIds(po.attachmentIds ?? [], { uploadedBy: ACTOR.name }))
      setCreatedMeta({ by: po.createdBy, at: po.createdAt })
      setUpdatedMeta({ by: po.updatedBy ?? '', at: po.updatedAt ?? '' })
      setLastSavedAt(po.updatedAt ? new Date(po.updatedAt) : po.createdAt ? new Date(po.createdAt) : null)
      setSourceDocRefs({
        purchaseRequisitionId: po.purchaseRequisitionId,
        rfqId: po.rfqId,
        vendorQuotationId: po.vendorQuotationId,
        comparisonId: po.comparisonId,
        blanketOrderId: po.blanketOrderId,
      })
      resetDirty()
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [id, isNew, navigate, resetDirty])

  const toInput = useCallback(() => {
    const purchaseLocation = LOCATION_OPTIONS.find((l) => l.id === header.purchaseLocationId) ?? PURCHASE_DEMO_LOCATION
    const deliveryLocation = LOCATION_OPTIONS.find((l) => l.id === header.deliveryLocationId) ?? PURCHASE_DEMO_LOCATION
    return {
      vendorId: header.vendorId,
      documentDate: header.documentDate,
      orderType: header.orderType,
      location: { ...purchaseLocation },
      purchaseLocation: { ...purchaseLocation },
      deliveryLocation: { ...deliveryLocation },
      department: header.department,
      buyer: ACTOR,
      requester: ACTOR,
      placeOfSupply: header.placeOfSupply,
      expectedDeliveryDate: header.expectedDeliveryDate,
      validityDate: header.validityDate || null,
      paymentTerms: header.paymentTerms,
      deliveryTerms: header.deliveryTerms,
      freightTerms: header.freightTerms,
      packingTerms: header.packingTerms,
      insuranceTerms: header.insuranceTerms,
      warranty: header.warranty,
      inspectionRequirement: header.inspectionRequirement,
      priceBasis: header.priceBasis,
      termsAndConditions: header.termsAndConditions,
      internalNotes: header.internalNotes,
      remarks: header.remarks,
      attachmentIds,
      freight: Number(header.freight) || 0,
      otherCharges: Number(header.otherCharges) || 0,
      packingCharges: Number(header.packingCharges) || 0,
      insuranceCharges: Number(header.insuranceCharges) || 0,
      tradeDiscount: Number(header.tradeDiscount) || 0,
      tcsAmount: Number(header.tcsAmount) || 0,
      discount: totals.lineDiscount + (Number(header.tradeDiscount) || 0),
      lines: computedLines
        .filter((l) => l.itemId || l.itemCode.trim() || l.itemName.trim())
        .map(({ key: _key, ...rest }) => rest),
    }
  }, [attachmentIds, computedLines, header, totals.lineDiscount])

  const revealValidation = useCallback(
    (result: typeof validation, mode: 'draft' | 'submit') => {
      setAttemptedMode(mode)
      if (!result.errors.length) return
      const nextKey = forceOpenKey + 1
      setForceOpenKey(nextKey)
      const opened: Partial<Record<'general' | 'commercial' | 'lines', number>> = {}
      for (const section of result.sectionsToOpen) {
        opened[section] = nextKey
      }
      setForceOpenSections(opened)
      const targetWorkspace = poSectionToWorkspace(result.firstSection)
      setWorkspace(targetWorkspace)
      // Defer scroll until the target workspace panel is mounted.
      window.requestAnimationFrame(() => {
        scrollToPurchaseValidationTarget({
          fieldId: result.firstFieldId,
          sectionId: result.firstSection,
          onActive: setActiveSection,
        })
      })
    },
    [forceOpenKey],
  )

  const focusValidationItem = useCallback(
    (message: string) => {
      const inVendor = poWorkspaceHasValidationErrors('vendor_order', activeValidation)
      const inItems = poWorkspaceHasValidationErrors('items_financials', activeValidation)
      const looksLikeLine =
        /line/i.test(message) ||
        /item/i.test(message) ||
        /quantity/i.test(message) ||
        /rate/i.test(message)
      const target: PoEditorWorkspace =
        looksLikeLine && inItems
          ? 'items_financials'
          : inVendor
            ? 'vendor_order'
            : inItems
              ? 'items_financials'
              : poSectionToWorkspace(activeValidation.firstSection)
      setWorkspace(target)
      window.requestAnimationFrame(() => {
        scrollToPurchaseValidationTarget({
          fieldId: activeValidation.firstFieldId,
          sectionId: activeValidation.firstSection,
          onActive: setActiveSection,
        })
      })
    },
    [activeValidation],
  )

  const saveDraft = async (andView = false) => {
    if (!editable) return
    if (draftValidation.errors.length) {
      revealValidation(draftValidation, 'draft')
      return
    }
    setSaving(true)
    try {
      const input = toInput()
      if (recordId) {
        const updated = await updatePurchaseOrder(recordId, input)
        setDocumentNumber(updated.documentNumber)
        setStatus(updated.status)
        setUpdatedMeta({ by: updated.updatedBy ?? '', at: updated.updatedAt ?? '' })
        notify.success(`Draft saved · ${updated.documentNumber}`)
        setLastSavedAt(new Date())
        resetDirty()
        if (andView) navigate(`/purchase/orders/${recordId}`)
      } else {
        const created = await createPurchaseOrder(input)
        setRecordId(created.id)
        setDocumentNumber(created.documentNumber)
        setStatus(created.status)
        setCreatedMeta({ by: created.createdBy, at: created.createdAt })
        notify.success(`Draft created · ${created.documentNumber}`)
        setLastSavedAt(new Date())
        resetDirty()
        navigate(`/purchase/orders/${created.id}/edit`, { replace: true })
      }
    } catch (err) {
      notify.error(err instanceof PurchaseServiceError ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const submitForApproval = async () => {
    if (validation.errors.length) {
      revealValidation(validation, 'submit')
      return
    }
    setSaving(true)
    try {
      let poId = recordId
      const input = toInput()
      if (!poId) {
        const created = await createPurchaseOrder(input)
        poId = created.id
        setRecordId(created.id)
        setDocumentNumber(created.documentNumber)
      } else {
        await updatePurchaseOrder(poId, input)
      }
      const submitted = await submitPurchaseOrder(poId)
      setStatus(submitted.status)
      setLastSavedAt(new Date())
      resetDirty()
      notify.success(`${submitted.documentNumber} submitted for approval`)
      navigate(`/purchase/orders/${poId}`)
    } catch (err) {
      notify.error(err instanceof PurchaseServiceError ? err.message : 'Submit failed')
    } finally {
      setSaving(false)
    }
  }

  const createFromOrigin = async () => {
    setCreating(true)
    try {
      let created: PurchaseOrder
      if (originMode === 'purchase_requisition') {
        if (!selectedPrId) {
          notify.error('Select an approved requisition')
          return
        }
        created = await createPurchaseOrderFromPr(selectedPrId, selectedPrVendorId || undefined)
      } else if (originMode === 'quotation_comparison') {
        if (!selectedComparisonId) {
          notify.error('Select a completed & approved comparison')
          return
        }
        created = await createPurchaseOrderFromComparison(selectedComparisonId)
      } else if (originMode === 'vendor_quotation') {
        if (!selectedVqId) {
          notify.error('Select an approved vendor quotation')
          return
        }
        created = await createPurchaseOrderFromVendorQuotation(selectedVqId)
      } else if (originMode === 'blanket_order') {
        if (!selectedBlanketId) {
          notify.error('Select an active blanket order')
          return
        }
        const blanket = activeBlankets.find((b) => b.id === selectedBlanketId)
        const lineInputs = (blanket?.lines ?? [])
          .map((l) => ({ itemId: l.itemId, quantity: Number(blanketQuantities[l.itemId]) || 0 }))
          .filter((l) => l.quantity > 0)
        if (!lineInputs.length) {
          notify.error('Enter a quantity for at least one blanket line')
          return
        }
        created = await createPurchaseOrderFromBlanket(selectedBlanketId, lineInputs)
      } else {
        return
      }
      notify.success(`${created.documentNumber} created`)
      navigate(`/purchase/orders/${created.id}/edit`, { replace: true })
    } catch (err) {
      notify.error(err instanceof PurchaseServiceError ? err.message : 'Could not create purchase order')
    } finally {
      setCreating(false)
    }
  }

  useEffect(() => {
    if (!isNew) return
    if (originMode === 'quotation_comparison' && selectedComparisonId) {
      void createFromOrigin()
    }
    if (originMode === 'vendor_quotation' && selectedVqId) {
      void createFromOrigin()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) {
    return (
      <PurchaseCardFormShell
        title="Purchase Order"
        description="Loading…"
        status="Draft"
        favoritePath="/purchase/orders/new"
        breadcrumbs={[
          { label: 'Purchase', to: '/purchase' },
          { label: 'Orders', to: '/purchase/orders' },
          { label: 'Loading' },
        ]}
        footer={null}
      >
        <LoadingState variant="form" rows={8} />
      </PurchaseCardFormShell>
    )
  }

  /** Block save until manual form is visible (source origins create via modal then navigate). */
  const awaitingOriginCreate =
    isNew && !recordId && (!originChosen || originMode !== 'manual')
  const showPoForm = !awaitingOriginCreate

  const selectOrigin = (mode: PurchaseOrderOrigin) => {
    setOriginMode(mode)
    setOriginChosen(true)
    setOriginLookupOpen(mode !== 'manual')
  }

  const reopenOriginSelector = () => {
    setOriginChosen(false)
    setOriginLookupOpen(false)
  }

  /** Origin-gated source refs: only relevant labels; hide empty values (no wall of "—"). */
  const allSourceRefs: { label: string; value: string | null }[] = [
    { label: 'Source PR', value: header.purchaseRequisitionNumber },
    { label: 'Source RFQ', value: header.rfqNumber },
    { label: 'Source Vendor Quotation', value: header.vendorQuotationNumber },
    { label: 'Source Comparison', value: header.comparisonNumber },
    { label: 'Source Blanket Order', value: header.blanketOrderNumber },
  ]
  const sourceLabelsByOrigin: Record<Exclude<PurchaseOrderOrigin, 'manual'>, string[]> = {
    purchase_requisition: ['Source PR'],
    quotation_comparison: ['Source RFQ', 'Source Comparison'],
    vendor_quotation: ['Source Vendor Quotation', 'Source RFQ'],
    blanket_order: ['Source Blanket Order'],
  }
  const sourceCandidates =
    originMode === 'manual'
      ? []
      : allSourceRefs.filter((r) => sourceLabelsByOrigin[originMode].includes(r.label))
  const populatedSourceRefs = sourceCandidates.filter(
    (r): r is { label: string; value: string } => Boolean(r.value),
  )
  const showManualSourceFact = originMode === 'manual'

  return (
    <>
    <PurchaseCardFormShell
      title={isNew ? 'New Purchase Order' : `Edit ${documentNumber ?? 'Purchase Order'}`}
      description="Vendor purchase commitment — draft and pending-approval documents only"
      recordNo={documentNumber ?? (isNew ? 'New' : undefined)}
      recordTitle={documentTitle}
      status={PURCHASE_ORDER_DOMAIN_STATUS_LABELS[status]}
      statusTone={purchaseStatusTone(status)}
      statusKey={status}
      recordHeaderId={revisionNo > 0 ? `R${revisionNo}` : undefined}
      recordHeaderFacts={recordHeaderFacts}
      favoritePath={recordId ? `/purchase/orders/${recordId}/edit` : '/purchase/orders/new'}
      breadcrumbs={[
        { label: 'Orders', to: '/purchase/orders' },
        { label: isNew ? 'New' : documentNumber ?? 'Edit' },
      ]}
      createdBy={createdMeta.by || undefined}
      createdDate={createdMeta.at ? formatDate(createdMeta.at.slice(0, 10)) : undefined}
      modifiedBy={updatedMeta.by || undefined}
      modifiedDate={updatedMeta.at ? formatDate(updatedMeta.at.slice(0, 10)) : undefined}
      validationTitle={
        showErrors && activeValidation.errors.length
          ? attemptedMode === 'draft'
            ? 'Purchase Order cannot be saved.'
            : 'Purchase Order cannot be submitted.'
          : undefined
      }
      validationErrors={showErrors ? activeValidation.errors : []}
      validationItems={
        showErrors
          ? activeValidation.errors.map((message, i) => {
              const workspaceLabel =
                /vendor/i.test(message) ||
                /po date/i.test(message) ||
                /expected delivery/i.test(message)
                  ? 'Vendor & Order Details'
                  : 'Items & Financials'
              return {
                id: `po-err-${i}`,
                label: `${workspaceLabel} · ${message}`,
                message: 'Required',
                onClick: () => focusValidationItem(message),
              }
            })
          : undefined
      }
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          collapseSecondaryOnNarrow
          moreActions={[
            {
              id: 'print',
              label: 'Print',
              icon: Printer,
              onClick: () => window.print(),
            },
          ]}
        />
      }
      factBox={documentFactBox}
      collapsibleFactBox
      stickyFooter
      footer={
        <ErpStickySaveBar
          sticky
          hint={
            <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
              {dirty ? (
                <span className="font-medium text-erp-warning-fg">Unsaved changes</span>
              ) : (
                <span className="text-erp-muted">All changes saved</span>
              )}
              {lastSavedAt ? (
                <span className="text-erp-muted">
                  Last saved{' '}
                  {lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              ) : null}
            </span>
          }
          onSaveDraft={() => void saveDraft(false)}
          saveDraftLabel={saving ? 'Saving…' : 'Save Draft'}
          onSave={() => void submitForApproval()}
          submitLabel="Submit for Approval"
          isSubmitting={saving}
          submitDisabled={
            awaitingOriginCreate || !editable || saving || (showErrors && validation.errors.length > 0)
          }
          submitDisabledReason={
            showErrors && validation.errors.length > 0 ? 'Fix validation errors first' : undefined
          }
          cancelLabel="Back"
          onCancel={() => navigate('/purchase/orders')}
          actions={
            <ErpButtonGroup>
              <ErpButton
                type="button"
                variant="ghost"
                icon={ArrowLeft}
                disabled={saving}
                onClick={() => navigate('/purchase/orders')}
              >
                Back
              </ErpButton>
              <ErpButton
                type="button"
                variant="secondary"
                icon={Save}
                disabled={awaitingOriginCreate || !editable || saving}
                onClick={() => void saveDraft(false)}
              >
                {saving ? 'Saving…' : 'Save Draft'}
              </ErpButton>
              <ErpButton
                type="button"
                variant="primary"
                icon={Send}
                disabled={
                  awaitingOriginCreate ||
                  !editable ||
                  saving ||
                  (showErrors && validation.errors.length > 0)
                }
                disabledReason={
                  showErrors && validation.errors.length > 0
                    ? 'Fix validation errors first'
                    : undefined
                }
                onClick={() => void submitForApproval()}
              >
                Submit for Approval
              </ErpButton>
            </ErpButtonGroup>
          }
        />
      }
      onSaveShortcut={() => void saveDraft(false)}
    >
      {isNew ? (
        !originChosen ? (
          <PurchaseOrderOriginPicker
            className="mb-4"
            onSelect={selectOrigin}
            pendingPoCount={approvedPrs.filter((p) => !p.rfqRequired && !p.convertedPoId).length}
          />
        ) : (
          <PurchaseOrderOriginBanner
            originLabel={PURCHASE_ORDER_ORIGIN_LABELS[originMode]}
            showSelectSource={originMode !== 'manual'}
            onSelectSource={() => setOriginLookupOpen(true)}
            onChangeSource={reopenOriginSelector}
          />
        )
      ) : null}

      {showPoForm ? (

        <>
          <PurchaseDocumentWorkflowStrip
            status={status}
            nextActionContext={{ canSubmit: editable }}
          />

          <EnterpriseFormMetrics metrics={formMetrics} />

          <PurchaseOrderWorkspaceTabs
            active={workspace}
            onChange={setWorkspace}
            tabs={workspaceTabs}
          />

          {workspace === 'vendor_order' ? (
            <div
              id="po-workspace-panel-vendor_order"
              role="tabpanel"
              aria-labelledby="po-workspace-tab-vendor_order"
              className="space-y-3"
            >
          <ErpCardSection
            id={purchaseSectionId('general')}
            title="Order Information"
            subtitle="Document identity and buyer context"
            icon={ClipboardList}
            accent="blue"
            collapsible
            defaultOpen
            forceOpenKey={forceOpenSections.general}
            dense
          >
            <ErpFieldRow label="PO Number" readOnly>
              <Input value={documentNumber ?? 'Auto-generated'} readOnly className="bg-erp-surface-alt" />
            </ErpFieldRow>
            <ErpFieldRow
              id={purchaseFieldId('documentDate')}
              label="PO Date"
              required
              fieldError={showErrors ? activeValidation.fieldErrors.documentDate : undefined}
              fieldState={showErrors && activeValidation.fieldErrors.documentDate ? 'error' : 'idle'}
            >
              <Input
                type="date"
                value={header.documentDate}
                disabled={!editable}
                onChange={(e) => patchHeader({ documentDate: e.target.value })}
              />
            </ErpFieldRow>
            <ErpFieldRow label="Order Type">
              <Select
                value={header.orderType}
                disabled={!editable}
                onChange={(e) => patchHeader({ orderType: e.target.value as PurchaseOrderType })}
              >
                {Object.entries(PURCHASE_ORDER_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </ErpFieldRow>
            <ErpFieldRow label="Buyer" readOnly>
              <Input value={ACTOR.name} readOnly className="bg-erp-surface-alt" />
            </ErpFieldRow>
            <ErpFieldRow label="Currency" readOnly>
              <Input value="INR" readOnly className="bg-erp-surface-alt" />
            </ErpFieldRow>
            <ErpFieldRow label="Department">
              <Input
                value={header.department}
                disabled={!editable}
                onChange={(e) => patchHeader({ department: e.target.value })}
              />
            </ErpFieldRow>
          </ErpCardSection>

          <ErpCardSection
            title="Vendor Information"
            subtitle="Supplier identity and place of supply"
            icon={Building2}
            accent="teal"
            collapsible
            defaultOpen
            forceOpenKey={forceOpenSections.general}
            dense
          >
            <ErpFieldRow
              id={purchaseFieldId('vendorId')}
              label="Vendor"
              required
              fieldError={showErrors ? activeValidation.fieldErrors.vendorId : undefined}
              fieldState={showErrors && activeValidation.fieldErrors.vendorId ? 'error' : 'idle'}
            >
              <Select value={header.vendorId} disabled={!editable} onChange={(e) => applyVendor(e.target.value)}>
                <option value="">Select vendor…</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.vendorCode} — {v.vendorName}
                  </option>
                ))}
              </Select>
            </ErpFieldRow>
            <ErpFieldRow label="Vendor Address" readOnly>
              <Input value={header.vendorAddress || selectedVendor?.address || ''} readOnly className="bg-erp-surface-alt" />
            </ErpFieldRow>
            <ErpFieldRow label="Vendor GST Number" readOnly>
              <Input value={header.vendorGstin} readOnly className="bg-erp-surface-alt font-mono" />
            </ErpFieldRow>
            <ErpFieldRow label="Place of Supply">
              <Input
                value={header.placeOfSupply}
                disabled={!editable}
                onChange={(e) => {
                  const placeOfSupply = e.target.value
                  patchHeader({
                    placeOfSupply,
                    isInterstate: deriveIsInterstate(
                      header.vendorState,
                      placeOfSupply,
                      selectedVendor?.isInterstate ?? false,
                    ),
                  })
                }}
              />
            </ErpFieldRow>
            {selectedVendor ? (
              <ErpFormSpan span={3}>
                <div className="mt-1 rounded-md border border-erp-border bg-erp-surface-alt/60 px-3 py-2.5 text-[12px]">
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-erp-muted">
                    Vendor summary
                  </p>
                  <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <span className="text-erp-muted">Code</span>
                      <p className="font-mono font-medium text-erp-text">{selectedVendor.vendorCode}</p>
                    </div>
                    <div>
                      <span className="text-erp-muted">GSTIN</span>
                      <p className="font-mono font-medium text-erp-text">
                        {selectedVendor.gstin || '—'}
                      </p>
                    </div>
                    <div>
                      <span className="text-erp-muted">Payment terms</span>
                      <p className="font-medium text-erp-text">
                        {header.paymentTerms || selectedVendor.paymentTerms || '—'}
                      </p>
                    </div>
                    <div>
                      <span className="text-erp-muted">Lead time</span>
                      <p className="font-medium text-erp-text">
                        {selectedVendor.leadTimeDays != null
                          ? `${selectedVendor.leadTimeDays} days`
                          : '—'}
                      </p>
                    </div>
                  </div>
                </div>
              </ErpFormSpan>
            ) : null}
          </ErpCardSection>

          <ErpCardSection
            title="Location and Delivery"
            subtitle="Purchase and ship-to locations"
            icon={MapPin}
            accent="slate"
            collapsible
            defaultOpen
            dense
          >
            <ErpFieldRow label="Purchase Location">
              <Select
                value={header.purchaseLocationId}
                disabled={!editable}
                onChange={(e) => patchHeader({ purchaseLocationId: e.target.value })}
              >
                {LOCATION_OPTIONS.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </ErpFieldRow>
            <ErpFieldRow label="Delivery Location">
              <Select
                value={header.deliveryLocationId}
                disabled={!editable}
                onChange={(e) => patchHeader({ deliveryLocationId: e.target.value })}
              >
                {LOCATION_OPTIONS.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </ErpFieldRow>
          </ErpCardSection>

          <ErpCardSection
            title="Source Reference"
            subtitle="Origin document linkage for this purchase order"
            icon={ClipboardList}
            accent="blue"
            collapsible
            defaultOpen
            dense
          >
            {showManualSourceFact ? (
              <ErpFormSpan span={3}>
                <p className="text-[13px] text-erp-muted">
                  Source: <span className="text-erp-text">{PURCHASE_ORDER_ORIGIN_LABELS.manual}</span>
                </p>
              </ErpFormSpan>
            ) : populatedSourceRefs.length > 0 ? (
              populatedSourceRefs.map((ref) => (
                <ErpFieldRow key={ref.label} label={ref.label} readOnly>
                  <Input value={ref.value} readOnly className="bg-erp-surface-alt font-mono" />
                </ErpFieldRow>
              ))
            ) : (
              <ErpFormSpan span={3}>
                <p className="text-[13px] text-erp-muted">
                  Source: <span className="text-erp-text">{PURCHASE_ORDER_ORIGIN_LABELS[originMode]}</span>
                  {!originChosen ? null : (
                    <span className="ml-1">(select a source document to populate references)</span>
                  )}
                </p>
              </ErpFormSpan>
            )}
          </ErpCardSection>

          <ErpCardSection
            id={purchaseSectionId('commercial')}
            title="Commercial Terms"
            subtitle="Delivery window, price basis, and commercial clauses"
            collapsedSummary={commercialSummary || undefined}
            icon={FileSignature}
            accent="violet"
            collapsible
            defaultOpen={false}
            forceOpenKey={forceOpenSections.commercial}
            dense
          >
            <ErpFormSpan span={3}>
              <p className="erp-field-group__label">Dates</p>
            </ErpFormSpan>
            <ErpFieldRow
              id={purchaseFieldId('expectedDeliveryDate')}
              label="Expected Delivery Date"
              required
              fieldError={showErrors ? activeValidation.fieldErrors.expectedDeliveryDate : undefined}
              fieldState={
                showErrors && activeValidation.fieldErrors.expectedDeliveryDate ? 'error' : 'idle'
              }
            >
              <Input
                type="date"
                value={header.expectedDeliveryDate}
                disabled={!editable}
                onChange={(e) => patchHeader({ expectedDeliveryDate: e.target.value })}
              />
            </ErpFieldRow>
            <ErpFieldRow label="Validity Date">
              <Input
                type="date"
                value={header.validityDate}
                disabled={!editable}
                onChange={(e) => patchHeader({ validityDate: e.target.value })}
              />
            </ErpFieldRow>
            <ErpFieldRow label="Price Basis">
              <PurchaseTermSelect
                value={header.priceBasis}
                options={PURCHASE_PRICE_BASIS}
                disabled={!editable}
                onChange={(v) => patchHeader({ priceBasis: v })}
                emptyLabel="Select price basis…"
              />
            </ErpFieldRow>

            <ErpFormSpan span={3}>
              <p className="erp-field-group__label">Commercial</p>
            </ErpFormSpan>
            <ErpFieldRow label="Payment Terms">
              <PurchaseTermSelect
                value={header.paymentTerms}
                options={PURCHASE_PAYMENT_TERMS}
                disabled={!editable}
                onChange={(v) => patchHeader({ paymentTerms: v })}
                emptyLabel="Select payment terms…"
              />
            </ErpFieldRow>
            <ErpFieldRow label="Delivery Terms">
              <PurchaseTermSelect
                value={header.deliveryTerms}
                options={PURCHASE_DELIVERY_TERMS}
                disabled={!editable}
                onChange={(v) => patchHeader({ deliveryTerms: v })}
                emptyLabel="Select delivery terms…"
              />
            </ErpFieldRow>
            <ErpFieldRow label="Freight Terms">
              <PurchaseTermSelect
                value={header.freightTerms}
                options={PURCHASE_FREIGHT_TERMS}
                disabled={!editable}
                onChange={(v) => patchHeader({ freightTerms: v })}
                emptyLabel="Select freight terms…"
              />
            </ErpFieldRow>

            <ErpFormSpan span={3}>
              <p className="erp-field-group__label">Additional Conditions</p>
            </ErpFormSpan>
            <ErpFieldRow label="Packing Terms">
              <PurchaseTermSelect
                value={header.packingTerms}
                options={PURCHASE_PACKING_TERMS}
                disabled={!editable}
                onChange={(v) => patchHeader({ packingTerms: v })}
                emptyLabel="Select packing terms…"
              />
            </ErpFieldRow>
            {showInsuranceTerms ? (
              <ErpFieldRow label="Insurance Terms">
                <PurchaseTermSelect
                  value={header.insuranceTerms}
                  options={PURCHASE_INSURANCE_TERMS}
                  disabled={!editable}
                  onChange={(v) => patchHeader({ insuranceTerms: v })}
                  emptyLabel="Select insurance terms…"
                />
              </ErpFieldRow>
            ) : null}
            <ErpFieldRow label="Warranty">
              <Input
                value={header.warranty}
                disabled={!editable}
                onChange={(e) => patchHeader({ warranty: e.target.value })}
                placeholder="e.g. 12 months manufacturing defect"
              />
            </ErpFieldRow>
            {showInspectionRequirement ? (
              <ErpFieldRow label="Inspection Requirement" colSpan={3}>
                <Input
                  value={header.inspectionRequirement}
                  disabled={!editable}
                  onChange={(e) => patchHeader({ inspectionRequirement: e.target.value })}
                  placeholder="e.g. Mill TC + dimensional check on receipt"
                />
              </ErpFieldRow>
            ) : null}
          </ErpCardSection>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-erp-border pt-3">
            <ErpButton
              type="button"
              variant="secondary"
              icon={Save}
              disabled={awaitingOriginCreate || !editable || saving}
              onClick={() => void saveDraft(false)}
            >
              {saving ? 'Saving…' : 'Save Draft'}
            </ErpButton>
            <ErpButton
              type="button"
              variant="primary"
              icon={ArrowRight}
              onClick={() => setWorkspace('items_financials')}
            >
              Continue to Items &amp; Financials
            </ErpButton>
          </div>
            </div>
          ) : (
            <div
              id="po-workspace-panel-items_financials"
              role="tabpanel"
              aria-labelledby="po-workspace-tab-items_financials"
              className="space-y-3"
            >
          <ErpCardSection
            id={purchaseSectionId('lines')}
            title="Item Lines"
            subtitle="Catalog or manual lines — table on tablet/desktop; expandable cards on mobile"
            icon={Package}
            accent="teal"
            collapsible
            defaultOpen
            forceOpenKey={forceOpenSections.lines}
            dense
            columns={1}
            className="ring-1 ring-teal-200/70 shadow-sm"
            badge={
              <span className="text-[11px] tabular-nums text-erp-muted">
                {computedLines.length} line{computedLines.length === 1 ? '' : 's'}
              </span>
            }
          >
            <div id={purchaseFieldId('lines')}>
              <PurchaseOrderLinesTable
                lines={computedLines}
                catalogItems={catalogItemsForPicker}
                warehouseOptions={LOCATION_OPTIONS}
                editable={editable}
                isInterstate={isInterstate}
                dirty={dirty}
                formatCurrency={formatCurrency}
                showErrors={showErrors}
                lineErrors={activeValidation.lineErrors}
                onAddLine={() => setLinesDirty([...lines, emptyLine()])}
                onPatchLine={patchLine}
                onRemoveLine={(key) => setLinesDirty(lines.filter((l) => l.key !== key))}
                onSelectCatalogItem={applyItemCatalog}
                secondaryActions={[
                  {
                    id: 'copy',
                    label: 'Copy last line',
                    icon: Copy,
                    disabled: !editable || lines.length === 0,
                    onClick: () => {
                      const last = lines[lines.length - 1]
                      if (!last) return
                      setLinesDirty([
                        ...lines,
                        {
                          ...last,
                          key: crypto.randomUUID(),
                          id: '',
                          lineNo: lines.length + 1,
                        },
                      ])
                    },
                  },
                  {
                    id: 'clear',
                    label: 'Clear lines',
                    icon: Eraser,
                    disabled: !editable || lines.length === 0,
                    onClick: () => setLinesDirty([]),
                  },
                ]}
              />
              {showErrors &&
              activeValidation.errors.some(
                (e) =>
                  /line/i.test(e) ||
                  /item/i.test(e) ||
                  /quantity/i.test(e) ||
                  /rate/i.test(e),
              ) ? (
                <p className="mt-2 text-[12px] text-erp-danger-fg">
                  Fix line errors before submit.
                </p>
              ) : null}
            </div>
          </ErpCardSection>

          <ErpCardSection
            id={purchaseSectionId('tax')}
            title="Tax & Totals"
            subtitle="Charges, GST breakdown, and grand total"
            collapsedSummary={taxSummary || undefined}
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
                  id: 'basic',
                  label: 'Basic Amount',
                  kind: 'value',
                  value: formatCurrency(totals.subtotal),
                },
                {
                  id: 'lineDiscount',
                  label: 'Line Discount',
                  kind: 'value',
                  value: formatCurrency(totals.lineDiscount),
                },
                {
                  id: 'tradeDiscount',
                  label: 'Trade Discount',
                  kind: 'input',
                  value: header.tradeDiscount,
                  disabled: !editable,
                  onChange: (v) => patchHeader({ tradeDiscount: v }),
                },
                {
                  id: 'freight',
                  label: 'Freight',
                  kind: 'input',
                  value: header.freight,
                  disabled: !editable,
                  onChange: (v) => patchHeader({ freight: v }),
                },
                {
                  id: 'packing',
                  label: 'Packing Charges',
                  kind: 'input',
                  value: header.packingCharges,
                  disabled: !editable,
                  onChange: (v) => patchHeader({ packingCharges: v }),
                },
                {
                  id: 'insurance',
                  label: 'Insurance',
                  kind: 'input',
                  value: header.insuranceCharges,
                  disabled: !editable,
                  onChange: (v) => patchHeader({ insuranceCharges: v }),
                },
                {
                  id: 'other',
                  label: 'Other Charges',
                  kind: 'input',
                  value: header.otherCharges,
                  disabled: !editable,
                  onChange: (v) => patchHeader({ otherCharges: v }),
                },
                {
                  id: 'tcs',
                  label: 'TCS',
                  kind: 'input',
                  value: header.tcsAmount,
                  disabled: !editable,
                  onChange: (v) => patchHeader({ tcsAmount: v }),
                  hidden: !showTcs,
                },
              ]}
              calcRows={[
                {
                  id: 'taxable',
                  label: 'Taxable Amount',
                  value: formatCurrency(totals.taxableAmount),
                },
                {
                  id: 'cgst',
                  label: 'CGST',
                  value: formatCurrency(totals.cgst),
                  hidden: isInterstate,
                },
                {
                  id: 'sgst',
                  label: 'SGST',
                  value: formatCurrency(totals.sgst),
                  hidden: isInterstate,
                },
                {
                  id: 'igst',
                  label: 'IGST',
                  value: formatCurrency(totals.igst),
                  hidden: !isInterstate,
                },
                {
                  id: 'roundOff',
                  label: 'Round Off',
                  value: formatCurrency(totals.roundOff),
                },
              ]}
              grandTotalValue={formatCurrency(totals.totalAmount)}
            />
          </ErpCardSection>

          <ErpCardSection
            id={purchaseSectionId('notes')}
            title="Terms, Notes & Attachments"
            subtitle="Commercial narrative, internal notes, and supporting files"
            collapsedSummary={notesPeek || attachmentsPeek || undefined}
            icon={CheckCircle}
            accent="slate"
            collapsible
            defaultOpen={false}
            dense
            columns={1}
          >
            <PurchaseTermsNotesTabs
              disabled={!editable}
              values={{
                termsAndConditions: header.termsAndConditions,
                internalNotes: header.internalNotes,
                remarks: header.remarks,
              }}
              onChange={(patch) => patchHeader(patch)}
              attachmentsIndicator={attachments.length > 0}
              attachmentsTitle={
                attachments.length
                  ? `${attachments.length} file${attachments.length === 1 ? '' : 's'}`
                  : undefined
              }
              attachmentsPanel={
                <PurchaseDocumentAttachments
                  files={attachments}
                  disabled={!editable}
                  uploadedBy={ACTOR.name}
                  hint="PO specifications, drawings, quotations, and supporting documents"
                  onChange={(next) => {
                    setAttachments(next)
                    markDirty()
                  }}
                />
              }
            />
            {revisionNo > 0 ? (
              <p className="mt-2 text-[12px] text-erp-muted">Revision {revisionNo}</p>
            ) : null}
          </ErpCardSection>
            </div>
          )}
        </>
      ) : null}
    </PurchaseCardFormShell>

    <Modal
      open={isNew && !recordId && originLookupOpen && originMode !== 'manual'}
      onClose={() => setOriginLookupOpen(false)}
      title={`Create from ${PURCHASE_ORDER_ORIGIN_LABELS[originMode]}`}
      description={
        originMode === 'purchase_requisition'
          ? 'Select an approved requisition. Optionally override the preferred vendor.'
          : originMode === 'quotation_comparison'
            ? 'Select a completed comparison with an approved recommendation.'
            : originMode === 'vendor_quotation'
              ? 'Select a vendor quotation marked as selected / approved.'
              : 'Release quantities against an active blanket order.'
      }
      size={originMode === 'blanket_order' ? 'lg' : 'md'}
      closeDisabled={creating}
      footer={
        <div className="flex justify-end gap-2">
          <ErpButton
            type="button"
            variant="ghost"
            disabled={creating}
            onClick={() => setOriginLookupOpen(false)}
          >
            Cancel
          </ErpButton>
          <ErpButton
            type="button"
            variant="primary"
            icon={Plus}
            disabled={
              creating ||
              (originMode === 'purchase_requisition' && !selectedPrId) ||
              (originMode === 'quotation_comparison' && !selectedComparisonId) ||
              (originMode === 'vendor_quotation' && !selectedVqId) ||
              (originMode === 'blanket_order' && !selectedBlanketId)
            }
            onClick={() => void createFromOrigin()}
          >
            {creating ? 'Creating…' : 'Create Purchase Order'}
          </ErpButton>
        </div>
      }
    >
      {originMode === 'purchase_requisition' ? (
        <div className="space-y-3">
          {approvedPrs.length === 0 ? (
            <p className="text-[13px] text-erp-muted">No approved requisitions available.</p>
          ) : (
            <Select value={selectedPrId} onChange={(e) => setSelectedPrId(e.target.value)}>
              <option value="">Select approved requisition…</option>
              {approvedPrs.map((pr) => (
                <option key={pr.id} value={pr.id}>
                  {pr.documentNumber} · {pr.department} · {formatCurrency(pr.totalAmount)}
                  {pr.status === 'approved' && !pr.rfqRequired
                    ? ' · Ready for PO'
                    : pr.status === 'converted_to_rfq'
                      ? ' · Via RFQ'
                      : pr.rfqRequired
                        ? ' · RFQ required'
                        : ''}
                </option>
              ))}
            </Select>
          )}
          <Select value={selectedPrVendorId} onChange={(e) => setSelectedPrVendorId(e.target.value)}>
            <option value="">Vendor (optional — use PR preferred vendor)</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.vendorCode} — {v.vendorName}
              </option>
            ))}
          </Select>
        </div>
      ) : originMode === 'quotation_comparison' ? (
        <div className="space-y-3">
          {eligibleComparisons.length === 0 ? (
            <p className="text-[13px] text-erp-muted">No completed &amp; approved comparisons available.</p>
          ) : (
            <Select
              value={selectedComparisonId}
              onChange={(e) => setSelectedComparisonId(e.target.value)}
            >
              <option value="">Select comparison…</option>
              {eligibleComparisons.map(({ comparison, rfq }) => (
                <option key={comparison.id} value={comparison.id}>
                  {comparison.documentNumber} · RFQ {rfq.documentNumber} · {comparison.recommendedVendorName}
                </option>
              ))}
            </Select>
          )}
        </div>
      ) : originMode === 'vendor_quotation' ? (
        <div className="space-y-3">
          {approvedVqs.length === 0 ? (
            <p className="text-[13px] text-erp-muted">No approved (selected) vendor quotations available.</p>
          ) : (
            <Select value={selectedVqId} onChange={(e) => setSelectedVqId(e.target.value)}>
              <option value="">Select vendor quotation…</option>
              {approvedVqs.map((vq) => (
                <option key={vq.id} value={vq.id}>
                  {vq.documentNumber} · {vq.vendor.name} · {formatCurrency(vq.totalAmount)}
                </option>
              ))}
            </Select>
          )}
        </div>
      ) : originMode === 'blanket_order' ? (
        <div className="space-y-3">
          {activeBlankets.length === 0 ? (
            <p className="text-[13px] text-erp-muted">No active blanket orders available.</p>
          ) : (
            <Select
              value={selectedBlanketId}
              onChange={(e) => {
                setSelectedBlanketId(e.target.value)
                setBlanketQuantities({})
              }}
            >
              <option value="">Select active blanket order…</option>
              {activeBlankets.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.documentNumber} · {b.vendor.name}
                </option>
              ))}
            </Select>
          )}
          {selectedBlanketId
            ? (() => {
                const blanket = activeBlankets.find((b) => b.id === selectedBlanketId)
                if (!blanket) return null
                return (
                  <div className="overflow-x-auto rounded-md border border-erp-border">
                    <table className="erp-table text-[12px]">
                      <thead>
                        <tr>
                          <th>Item Code</th>
                          <th>Item</th>
                          <th className="num">Max Qty</th>
                          <th className="num">Released</th>
                          <th className="num">Available</th>
                          <th className="num">Rate</th>
                          <th className="num">Release Qty</th>
                        </tr>
                      </thead>
                      <tbody>
                        {blanket.lines.map((l) => {
                          const available = Math.max(0, l.maxQuantity - l.releasedQuantity)
                          return (
                            <tr key={l.id}>
                              <td className="font-mono">{l.itemCode}</td>
                              <td>{l.itemName}</td>
                              <td className="num">{l.maxQuantity}</td>
                              <td className="num">{l.releasedQuantity}</td>
                              <td className="num">{available}</td>
                              <td className="num">{formatCurrency(l.rate)}</td>
                              <td className="num">
                                <input
                                  type="number"
                                  min={0}
                                  max={available}
                                  className="erp-input h-8 w-24 text-right text-[12px]"
                                  value={blanketQuantities[l.itemId] ?? 0}
                                  onChange={(e) =>
                                    setBlanketQuantities((prev) => ({
                                      ...prev,
                                      [l.itemId]: Number(e.target.value),
                                    }))
                                  }
                                />
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              })()
            : null}
        </div>
      ) : null}
    </Modal>
    </>
  )
}
