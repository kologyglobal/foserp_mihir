import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Banknote,
  ClipboardList,
  FileText,
  MapPin,
  Package,
  Paperclip,
} from 'lucide-react'
import { PurchaseCardFormShell } from '@/components/purchase/PurchaseCardFormShell'
import { useOptionalAuth } from '@/context/AuthProvider'
import { isApiMode } from '@/config/apiConfig'
import {
  PurchaseEnterpriseFactBox,
  purchaseSectionId,
  scrollToPurchaseSection,
} from '@/components/purchase/PurchaseEnterpriseFormKit'
import {
  purchaseStatusTone,
} from '@/components/purchase/purchaseCardFormShared'
import { PurchaseRequisitionLinesTable } from '@/components/purchase/PurchaseRequisitionLinesTable'
import {
  emptyPurchaseOrderAdjustments,
  computePrOrderDocumentTotals,
  PurchaseOrderAdjustmentsBlock,
  type PurchaseOrderAdjustmentsState,
} from '@/components/purchase/PurchaseOrderAdjustmentsBlock'
import { PurchaseRequisitionPathBanner } from '@/components/purchase/PurchaseRequisitionPathBanner'
import {
  PurchaseDocumentAttachments,
  type PurchaseDocumentAttachmentRow,
} from '@/components/purchase/PurchaseDocumentAttachments'
import {
  ErpCardSection,
  ErpFieldRow,
} from '@/components/erp/card-form'
import { ErpButton, ErpButtonGroup } from '@/components/erp/ErpButton'
import { Input, Textarea, Select } from '@/components/forms/Inputs'
import {
  approvalActivitySummary,
  attachmentsSummary,
  formatFastTabDate,
  hasMeaningfulTaxTotals,
  joinFastTabSummary,
  taxTotalsSummary,
} from '@/modules/purchase/purchaseFastTabSummaries'
import { Badge } from '@/components/ui/Badge'
import { LoadingState } from '@/design-system/components/LoadingState'
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard'
import {
  createPurchaseRequisition,
  getApprovalHistory,
  getPurchaseItems,
  getPurchaseRequisitionById,
  getPurchaseSetup,
  getPurchaseWarehouses,
  getVendors,
  previewNextPurchaseRequisitionNumber,
  PurchaseServiceError,
  submitPurchaseRequisition,
  updatePurchaseRequisition,
  PURCHASE_REQUISITION_ATTACHMENT_KIND_LABELS,
  PURCHASE_REQUISITION_PRIORITY_LABELS,
  PURCHASE_REQUISITION_SOURCE_LABELS,
  PURCHASE_REQUISITION_STATUS_LABELS,
  PURCHASE_REQUISITION_TYPE_LABELS,
} from '@/services/purchase'
import {
  type ApprovalHistory,
  type PurchaseItem,
  type PurchaseItemCategory,
  type PurchaseRequisition,
  type PurchaseRequisitionAttachmentKind,
  type PurchaseRequisitionAttachmentPlaceholder,
  type Vendor,
  purchaseRequisitionApprovalStatusLabel,
} from '@/types/purchaseDomain'
import {
  summarizePrLines,
  validatePurchaseRequisitionForm,
  PR_DEPARTMENT_OPTIONS,
  prDepartmentLabel,
  normalizePrDepartmentCode,
  type PrEditorHeader,
  type PrEditorLine,
} from '@/utils/purchaseRequisitionValidation'
import {
  mapEngineeringProductTypeToPurchaseCategory,
  mapPurchaseCategoryToEngineeringProductType,
  normalizeEngineeringProductType,
} from '@/utils/purchaseProductType'
import { resolveCatalogItemProductType } from '@/utils/purchaseCatalogFilter'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import {
  getPurchaseLineUomOptions,
  resolveDefaultPurchaseUom,
} from '@/utils/purchaseLineUom'
import { resolveItemDefaultBin } from '@/utils/itemDefaultBin'
import { useBinOptions } from '@/hooks/useBinOptions'
import { useMasterStore } from '@/store/masterStore'
import { notify } from '@/store/toastStore'
import { systemConfirm } from '@/utils/systemConfirm'
import { getSessionUser } from '@/utils/permissions'
import { PURCHASE_FORM_ROUTES } from './purchaseFormRoutes'

const ACTOR = { id: '', code: '', name: '' }

type LocationOption = {
  id: string
  code: string
  name: string
  state: string
  city: string
}

const EMPTY_LOCATION: LocationOption = {
  id: '',
  code: '',
  name: '',
  state: '',
  city: '',
}

function prPlaceholdersToRows(
  list: PurchaseRequisitionAttachmentPlaceholder[],
  uploadedBy: string,
): PurchaseDocumentAttachmentRow[] {
  return list.map((a) => ({
    id: a.id,
    fileName: a.fileName.trim() || a.id,
    type: PURCHASE_REQUISITION_ATTACHMENT_KIND_LABELS[a.kind],
    uploadedBy,
    uploadedAt: '',
    sizeBytes: null,
  }))
}

function kindFromTypeLabel(type: string): PurchaseRequisitionAttachmentKind {
  const entry = Object.entries(PURCHASE_REQUISITION_ATTACHMENT_KIND_LABELS).find(
    ([, label]) => label === type,
  )
  if (entry) return entry[0] as PurchaseRequisitionAttachmentKind
  const lower = type.toLowerCase()
  if (lower.includes('draw')) return 'drawing'
  if (lower.includes('image')) return 'image'
  if (lower.includes('pdf') || lower.includes('document')) return 'requirement_document'
  if (lower.includes('spec')) return 'technical_specification'
  return 'other'
}

function rowsToPrPlaceholders(
  rows: PurchaseDocumentAttachmentRow[],
  prev: PurchaseRequisitionAttachmentPlaceholder[],
): PurchaseRequisitionAttachmentPlaceholder[] {
  const prevById = new Map(prev.map((p) => [p.id, p]))
  return rows.map((r) => {
    const existing = prevById.get(r.id)
    if (existing) {
      return { ...existing, fileName: r.fileName }
    }
    return {
      id: r.id,
      kind: kindFromTypeLabel(r.type),
      fileName: r.fileName,
      remarks: '',
    }
  })
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function emptyLine(partial?: Partial<PrEditorLine>): PrEditorLine {
  return {
    key: crypto.randomUUID(),
    id: '',
    lineNo: 1,
    itemType: 'inventory',
    itemId: '',
    itemCode: '',
    itemName: '',
    specification: '',
    productType: '',
    category: '',
    uomId: null,
    uom: 'NOS',
    uomConversionFactor: 1,
    hsnCode: '',
    sacCode: null,
    quantity: 0,
    estimatedRate: 0,
    amount: 0,
    currentStock: 0,
    openPoQty: 0,
    preferredVendorId: null,
    preferredVendorName: null,
    vendorNumber: '',
    requiredDate: today(),
    orderDate: '',
    customerName: '',
    locationId: '',
    locationName: '',
    binCode: '',
    purchaseOrderId: null,
    purchaseOrderNumber: '',
    purchaseQuoteNumber: '',
    purpose: '',
    remarks: '',
    attachmentNote: '',
    actionMessage: false,
    ...partial,
  }
}

function resolveLocation(
  locationId: string,
  options: LocationOption[],
): LocationOption {
  if (!locationId) return EMPTY_LOCATION
  return options.find((l) => l.id === locationId) ?? EMPTY_LOCATION
}

function defaultHeader(opts?: {
  locationId?: string
  skipRfq?: boolean
  locations?: LocationOption[]
  requester?: { id: string; code: string; name: string }
}): PrEditorHeader {
  const locations = opts?.locations?.length ? opts.locations : []
  const loc = resolveLocation(opts?.locationId ?? locations[0]?.id ?? '', locations)
  const requester = opts?.requester ?? ACTOR
  return {
    documentDate: today(),
    department: '',
    locationId: loc.id,
    locationCode: loc.code,
    locationName: loc.name,
    locationState: loc.state,
    locationCity: loc.city,
    requesterId: requester.id,
    requesterCode: requester.code,
    requesterName: requester.name,
    expectedDeliveryDate: today(),
    priority: 'normal',
    requisitionType: 'material',
    source: 'manual',
    costCentre: '',
    project: '',
    productionOrderNo: '',
    maintenanceOrderNo: '',
    referenceNumber: '',
    purpose: '',
    remarks: '',
    rfqRequired: !(opts?.skipRfq ?? false),
    sourceType: '',
    sourceId: '',
    sourceDocumentNumber: '',
    maintenancePartId: '',
  }
}

function headerFromPr(pr: PurchaseRequisition): PrEditorHeader {
  return {
    documentDate: pr.documentDate,
    department: normalizePrDepartmentCode(pr.department),
    locationId: pr.location.id,
    locationCode: pr.location.code,
    locationName: pr.location.name,
    locationState: pr.location.state,
    locationCity: pr.location.city,
    requesterId: pr.requester.id,
    requesterCode: pr.requester.code,
    requesterName: pr.requester.name,
    expectedDeliveryDate: pr.expectedDeliveryDate ?? '',
    priority: pr.priority === ('medium' as string) ? 'normal' : pr.priority,
    requisitionType: pr.requisitionType,
    source: pr.source,
    costCentre: pr.costCentre,
    project: pr.project,
    productionOrderNo: pr.productionOrderNo,
    maintenanceOrderNo: pr.maintenanceOrderNo,
    referenceNumber: pr.referenceNumber,
    purpose: pr.purpose ?? '',
    remarks: pr.remarks,
    rfqRequired: pr.rfqRequired !== false,
  }
}

function resolveLineUomConversionFactor(itemId: string, uomId: string | null | undefined): number {
  if (!itemId) return 1
  const options = getPurchaseLineUomOptions(itemId)
  if (!options.length) return 1
  const hit = options.find((o) => o.id === uomId)
  return hit?.factor ?? options[0]?.factor ?? 1
}

function linesFromPr(pr: PurchaseRequisition): PrEditorLine[] {
  return pr.lines.map((l) => {
    const productType =
      (l as PrEditorLine).productType ||
      mapPurchaseCategoryToEngineeringProductType(l.category)
    return {
      ...l,
      key: l.id || crypto.randomUUID(),
      productType,
      category: l.category || mapEngineeringProductTypeToPurchaseCategory(productType),
      uomConversionFactor: resolveLineUomConversionFactor(l.itemId, l.uomId),
      actionMessage: false,
    }
  })
}

export function PurchaseRequisitionEditorPage() {
  const auth = useOptionalAuth()
  const session = auth?.session ?? null
  const { id } = useParams()
  const isNew = !id
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [recordId, setRecordId] = useState<string | null>(id ?? null)
  const [documentNumber, setDocumentNumber] = useState<string | null>(null)
  const [status, setStatus] = useState<PurchaseRequisition['status']>('draft')
  const [header, setHeader] = useState<PrEditorHeader>(defaultHeader)
  const [lines, setLines] = useState<PrEditorLine[]>([])
  /** Client-side estimate only — not persisted on PR save/API yet. */
  const [orderAdjustments, setOrderAdjustments] = useState<PurchaseOrderAdjustmentsState>(
    emptyPurchaseOrderAdjustments,
  )
  const [attachments, setAttachments] = useState<PurchaseRequisitionAttachmentPlaceholder[]>([])
  const [history, setHistory] = useState<ApprovalHistory[]>([])
  const [createdMeta, setCreatedMeta] = useState({ by: ACTOR.name, at: '' })
  const [updatedMeta, setUpdatedMeta] = useState({ by: '', at: '' })
  const [catalogItems, setCatalogItems] = useState<PurchaseItem[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [locationOptions, setLocationOptions] = useState<LocationOption[]>([])
  const [attemptedSubmit, setAttemptedSubmit] = useState(false)
  const [, setLastSavedAt] = useState<Date | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const binOptions = useBinOptions()

  const editable = status === 'draft' || status === 'rejected'
  const { dirty, markDirty, resetDirty } = useUnsavedChangesGuard(editable)

  useEffect(() => {
    if (!isNew || !isApiMode() || !session?.user) return
    const name = `${session.user.firstName ?? ''} ${session.user.lastName ?? ''}`.trim()
    setHeader((prev) => ({
      ...prev,
      requesterId: session.user.id,
      requesterCode: session.user.email?.split('@')[0] ?? '',
      requesterName: name || session.user.email || session.user.id,
    }))
    setCreatedMeta((prev) => ({ ...prev, by: name || session.user.email || prev.by }))
  }, [isNew, session])

  /** Deep-link from Maintenance shortage: source=MAINTENANCE + purpose/remarks. */
  useEffect(() => {
    if (!isNew) return
    const source = searchParams.get('source')
    if (source !== 'MAINTENANCE' && source !== 'maintenance') return
    const purpose =
      searchParams.get('purchasePurpose') ?? searchParams.get('purpose') ?? 'MAINTENANCE spare shortage'
    const remarks = searchParams.get('remarks') ?? searchParams.get('notes') ?? ''
    const ticketRef = searchParams.get('sourceDocumentId') ?? ''
    const sourceDocumentNumber = searchParams.get('sourceDocumentNumber') ?? ''
    const maintenancePartId = searchParams.get('maintenancePartId') ?? ''
    setHeader((prev) => ({
      ...prev,
      source: 'maintenance',
      purpose: purpose || prev.purpose,
      remarks: remarks || prev.remarks,
      maintenanceOrderNo: ticketRef || prev.maintenanceOrderNo,
      referenceNumber: ticketRef || prev.referenceNumber,
      sourceType: 'MAINTENANCE',
      sourceId: ticketRef || prev.sourceId,
      sourceDocumentNumber: sourceDocumentNumber || ticketRef || prev.sourceDocumentNumber,
      maintenancePartId: maintenancePartId || prev.maintenancePartId,
    }))
  }, [isNew, searchParams])

  const validation = useMemo(
    () => validatePurchaseRequisitionForm(header, lines),
    [header, lines],
  )
  const showErrors = attemptedSubmit
  const summary = useMemo(() => summarizePrLines(lines), [lines])
  const orderTotals = useMemo(
    // PR is demand capture — no commercial GST until RFQ/PO/invoice.
    () => computePrOrderDocumentTotals(lines, orderAdjustments, 0),
    [lines, orderAdjustments],
  )
  const financeDefaultOpen = hasMeaningfulTaxTotals(
    orderTotals.basicAmount,
    orderTotals.gstAmount,
    orderTotals.grandTotal,
  )
  const financeSummaryText = useMemo(
    () =>
      taxTotalsSummary({
        subtotal: orderTotals.basicAmount,
        tax: orderTotals.gstAmount,
        total: orderTotals.grandTotal,
      }),
    [orderTotals.basicAmount, orderTotals.gstAmount, orderTotals.grandTotal],
  )
  const attachmentsSummaryText = useMemo(
    () => attachmentsSummary(attachments.length),
    [attachments.length],
  )
  const approvalSummaryText = useMemo(
    () =>
      approvalActivitySummary({
        statusLabel: PURCHASE_REQUISITION_STATUS_LABELS[status],
        historyCount: history.length,
      }),
    [status, history.length],
  )
  const quickEntrySummaryText = useMemo(
    () =>
      joinFastTabSummary([
        header.department.trim() || false,
        PURCHASE_REQUISITION_PRIORITY_LABELS[header.priority],
        PURCHASE_REQUISITION_TYPE_LABELS[header.requisitionType],
        header.rfqRequired ? 'RFQ Purchase Path' : 'Direct Purchase Planning Path',
        header.locationName || false,
        PURCHASE_REQUISITION_SOURCE_LABELS[header.source],
        header.project.trim() || false,
        header.referenceNumber.trim() ? `Ref ${header.referenceNumber.trim()}` : false,
        header.remarks.trim() ? 'Remarks set' : false,
        formatFastTabDate(header.expectedDeliveryDate)
          ? `Need-by ${formatFastTabDate(header.expectedDeliveryDate)}`
          : false,
      ]),
    [
      header.department,
      header.priority,
      header.requisitionType,
      header.rfqRequired,
      header.locationName,
      header.source,
      header.project,
      header.referenceNumber,
      header.remarks,
      header.expectedDeliveryDate,
    ],
  )

  const formMetrics = useMemo(
    () => [
      {
        label: 'Lines',
        value: String(summary.totalLines),
        accent: 'green' as const,
      },
      {
        label: 'Total Qty',
        value: String(orderTotals.totalQty),
        accent: 'slate' as const,
      },
      {
        label: 'Est. Subtotal',
        value: formatCurrency(orderTotals.basicAmount),
        accent: 'blue' as const,
      },
      {
        label: 'Est. Total',
        value: formatCurrency(orderTotals.grandTotal),
        accent: 'amber' as const,
        highlight: orderTotals.grandTotal > 0,
      },
    ],
    [summary.totalLines, orderTotals],
  )

  const deliveryRisk = useMemo(() => {
    if (header.priority === 'urgent') return { label: 'Elevated', highlight: true as const }
    if (!header.expectedDeliveryDate) return { label: 'Not set', highlight: false as const }
    const needBy = new Date(`${header.expectedDeliveryDate}T00:00:00`)
    if (Number.isNaN(needBy.getTime())) return { label: 'Not set', highlight: false as const }
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const diffDays = Math.round((needBy.getTime() - today.getTime()) / 86_400_000)
    if (diffDays < 0) return { label: 'Overdue need-by', highlight: true as const }
    if (diffDays <= 3) return { label: 'Due within 3 days', highlight: true as const }
    return { label: 'On track', highlight: false as const }
  }, [header.priority, header.expectedDeliveryDate])

  const documentTitle =
    documentNumber ?? (isNew ? 'New requisition' : 'Purchase Requisition')
  const departmentFact = header.department
    ? prDepartmentLabel(header.department)
    : 'Not selected'

  const recordHeaderFacts = useMemo(
    () => [
      ...(documentNumber
        ? [{ label: 'PR No', value: documentNumber }]
        : isNew
          ? [{ label: 'PR No', value: 'Loading…' }]
          : []),
      { label: 'Department', value: departmentFact },
      { label: 'Requester', value: header.requesterName },
      {
        label: 'Date',
        value: header.documentDate ? formatDate(header.documentDate) : 'Not selected',
      },
      {
        label: 'Priority',
        value: PURCHASE_REQUISITION_PRIORITY_LABELS[header.priority],
      },
    ],
    [
      isNew,
      documentNumber,
      departmentFact,
      header.requesterName,
      header.documentDate,
      header.priority,
    ],
  )

  const patchHeader = (patch: Partial<PrEditorHeader>) => {
    setHeader((h) => ({ ...h, ...patch }))
    markDirty()
  }

  const renumber = (next: PrEditorLine[]) =>
    next.map((l, i) => ({ ...l, lineNo: i + 1, amount: Number(((Number(l.quantity) || 0) * (Number(l.estimatedRate) || 0)).toFixed(2)) }))

  const patchLine = (key: string, patch: Partial<PrEditorLine>) => {
    setLines((prev) =>
      renumber(
        prev.map((l) => {
          if (l.key !== key) return l
          const merged = { ...l, ...patch }
          merged.amount = Number(
            ((Number(merged.quantity) || 0) * (Number(merged.estimatedRate) || 0)).toFixed(2),
          )
          return merged
        }),
      ),
    )
    markDirty()
  }

  const setLinesDirty = (next: PrEditorLine[]) => {
    setLines(renumber(next))
    markDirty()
  }

  useEffect(() => {
    // Include non-purchasable master rows (Finish Product / Sub Assembly) so Product Type
    // filters match Item Master — same as PO editors.
    void Promise.all([
      getPurchaseItems({ forceRefresh: true, purchasableOnly: false }),
      getVendors(),
      getPurchaseWarehouses(),
    ]).then(([items, v, warehouses]) => {
      setCatalogItems(items)
      setVendors(v)
      if (warehouses.length) {
        setLocationOptions(
          warehouses.map((w) => ({
            id: w.id,
            code: w.code,
            name: w.name,
            state: w.state,
            city: w.city,
          })),
        )
      }
    })
  }, [])

  const threeEmptyLines = (loc?: { locationId: string; locationName: string }) =>
    [emptyLine(loc), emptyLine(loc), emptyLine(loc)].map((l, i) => ({
      ...l,
      lineNo: i + 1,
    }))

  useEffect(() => {
    if (!isNew) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const [setup, nextNumber, warehouses] = await Promise.all([
        getPurchaseSetup(),
        previewNextPurchaseRequisitionNumber().catch(() => null),
        getPurchaseWarehouses(),
      ])
      if (cancelled) return
      if (nextNumber) setDocumentNumber(nextNumber)
      const locs =
        warehouses.length > 0
          ? warehouses.map((w) => ({
              id: w.id,
              code: w.code,
              name: w.name,
              state: w.state,
              city: w.city,
            }))
          : []
      setLocationOptions(locs)
      // Requisition Setup default wins; fall back to the General Setup warehouse.
      const candidateIds = [
        setup.requisition.defaultWarehouseId,
        setup.general.defaultWarehouseId,
      ]
      const preferredId =
        candidateIds.find((id) => id && locs.some((l) => l.id === id)) ?? ''
      const loc = resolveLocation(preferredId ?? '', locs)
      setHeader((prev) => {
        // Preserve the session-derived requester — this effect resolves after the
        // session effect and must not reset it back to the empty ACTOR default.
        const fallback = getSessionUser()
        return defaultHeader({
          locationId: loc.id,
          skipRfq: setup.requisition.skipRfq,
          locations: locs,
          requester: prev.requesterId
            ? { id: prev.requesterId, code: prev.requesterCode, name: prev.requesterName }
            : { id: fallback.id, code: '', name: fallback.name },
        })
      })
      const lineLoc = loc.id
        ? { locationId: loc.id, locationName: loc.name }
        : undefined
      setLines(threeEmptyLines(lineLoc))
      resetDirty()
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [isNew, resetDirty])

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

  useEffect(() => {
    if (isNew || !id) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const pr = await getPurchaseRequisitionById(id)
      if (cancelled) return
      if (!pr) {
        setLoading(false)
        notify.error('Purchase requisition not found')
        navigate('/purchase/requisitions')
        return
      }
      setRecordId(pr.id)
      setDocumentNumber(pr.documentNumber)
      setStatus(pr.status)
      setHeader(headerFromPr(pr))
      setLines(linesFromPr(pr))
      setAttachments(pr.attachmentPlaceholders ?? [])
      setCreatedMeta({ by: pr.createdBy, at: pr.createdAt })
      setUpdatedMeta({ by: pr.updatedBy ?? '', at: pr.updatedAt ?? '' })
      const hist = await getApprovalHistory(pr.id)
      if (!cancelled) setHistory(hist)
      resetDirty()
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [id, isNew, navigate, resetDirty])

  const toInput = useCallback(() => {
    const location = {
      id: header.locationId,
      code: header.locationCode,
      name: header.locationName,
      state: header.locationState,
      city: header.locationCity,
    }
    const sessionUser = session?.user
    const requesterId = header.requesterId || sessionUser?.id || ''
    const requesterName =
      header.requesterName ||
      (sessionUser
        ? `${sessionUser.firstName ?? ''} ${sessionUser.lastName ?? ''}`.trim() ||
          sessionUser.email
        : '')
    return {
      documentDate: header.documentDate,
      department: header.department,
      location,
      requester: {
        id: requesterId,
        code: header.requesterCode || sessionUser?.email?.split('@')[0] || '',
        name: requesterName,
      },
      expectedDeliveryDate: header.expectedDeliveryDate || null,
      priority: header.priority,
      requisitionType: header.requisitionType,
      source: header.source,
      costCentre: header.costCentre,
      project: header.project,
      productionOrderNo: header.productionOrderNo,
      maintenanceOrderNo: header.maintenanceOrderNo,
      referenceNumber: header.referenceNumber,
      purpose: header.purpose || null,
      remarks: header.remarks,
      rfqRequired: header.rfqRequired,
      sourceType: header.sourceType || undefined,
      sourceId: header.sourceId || undefined,
      sourceDocumentNumber: header.sourceDocumentNumber || undefined,
      maintenancePartId: header.maintenancePartId || undefined,
      attachmentPlaceholders: attachments,
      estimatedTaxPct: summary.estimatedTaxPct,
      lines: lines
        .filter(
          (l) =>
            (l.itemName.trim() || l.itemCode.trim() || l.itemId) &&
            (l.productType || l.category) &&
            Number(l.quantity) > 0,
        )
        .map(({ key: _key, productType, category, actionMessage: _actionMessage, ...rest }) => ({
          ...rest,
          category: (category ||
            mapEngineeringProductTypeToPurchaseCategory(productType) ||
            'consumable') as PurchaseItemCategory,
        })),
    }
  }, [attachments, header, lines, session, summary.estimatedTaxPct])

  const persistDraft = async (): Promise<PurchaseRequisition | null> => {
    if (!editable || saving) return null
    setAttemptedSubmit(true)
    if (validation.errors.length) {
      const section =
        validation.fieldErrors.department ||
        validation.fieldErrors.requesterId ||
        validation.fieldErrors.purpose ||
        validation.fieldErrors.documentDate
          ? 'request'
          : validation.fieldErrors.locationId || validation.fieldErrors.expectedDeliveryDate
            ? 'delivery'
            : validation.errors.some((e) => /line|quantity|item|uom/i.test(e))
              ? 'lines'
              : 'request'
      focusValidationSection(section)
      notify.error(validation.errors[0] ?? 'Fix validation errors before saving')
      return null
    }
    setSaving(true)
    try {
      if (recordId) {
        const updated = await updatePurchaseRequisition(recordId, toInput())
        setDocumentNumber(updated.documentNumber)
        setStatus(updated.status)
        setUpdatedMeta({ by: updated.updatedBy ?? '', at: updated.updatedAt ?? '' })
        setLastSavedAt(new Date())
        resetDirty()
        return updated
      }
      const created = await createPurchaseRequisition(toInput())
      setRecordId(created.id)
      setDocumentNumber(created.documentNumber)
      setStatus(created.status)
      setCreatedMeta({ by: created.createdBy, at: created.createdAt })
      setLastSavedAt(new Date())
      resetDirty()
      return created
    } catch (err) {
      notify.error(err instanceof PurchaseServiceError ? err.message : 'Save failed')
      return null
    } finally {
      setSaving(false)
    }
  }

  const saveDraft = async () => {
    const saved = await persistDraft()
    if (!saved) return
    notify.success(`Saved · ${saved.documentNumber}`)
    if (!id && saved.id) {
      navigate(PURCHASE_FORM_ROUTES.requisition.edit(saved.id), { replace: true })
    }
  }

  const saveAndClose = async () => {
    const saved = await persistDraft()
    if (!saved) return
    notify.success(`Saved · ${saved.documentNumber}`)
    navigate(PURCHASE_FORM_ROUTES.requisition.list, { replace: true })
  }

  const canSubmitForApproval = editable && (status === 'draft' || status === 'rejected')

  const submitForApproval = async () => {
    if (!canSubmitForApproval || saving) return
    const saved = await persistDraft()
    if (!saved) return
    if (saved.status !== 'draft' && saved.status !== 'rejected') {
      notify.success(`${saved.documentNumber} is already ${purchaseRequisitionApprovalStatusLabel(saved.status)}`)
      return
    }
    setSaving(true)
    try {
      const submitted = await submitPurchaseRequisition(saved.id)
      setStatus(submitted.status)
      setDocumentNumber(submitted.documentNumber)
      setUpdatedMeta({ by: submitted.updatedBy ?? '', at: submitted.updatedAt ?? '' })
      notify.success(`${submitted.documentNumber} submitted for approval`)
      resetDirty()
      navigate(`/purchase/requisitions/${submitted.id}`, { replace: true })
    } catch (err) {
      notify.error(err instanceof PurchaseServiceError ? err.message : 'Submit failed')
    } finally {
      setSaving(false)
    }
  }

  const focusValidationSection = useCallback(
    (section: 'request' | 'procurement' | 'delivery' | 'lines' | 'notes' | 'general') => {
      const mapped =
        section === 'general' || section === 'procurement'
          ? 'request'
          : section
      window.requestAnimationFrame(() => {
        scrollToPurchaseSection(mapped)
      })
    },
    [],
  )

  const focusValidationItem = useCallback(
    (message: string) => {
      const looksLikeLine =
        /line/i.test(message) ||
        /quantity/i.test(message) ||
        /description/i.test(message) ||
        /unit/i.test(message) ||
        /At least one line/i.test(message)
      const looksLikeDelivery =
        /location|warehouse|required date|need.?by|delivery/i.test(message)
      window.requestAnimationFrame(() => {
        scrollToPurchaseSection(
          looksLikeLine ? 'lines' : looksLikeDelivery ? 'delivery' : 'request',
        )
      })
    },
    [],
  )

  const applyItemCatalog = (key: string, itemId: string) => {
    const line = lines.find((l) => l.key === key)
    const item = catalogItems.find((i) => i.id === itemId)
    if (!item || !line) return
    // Guard: Product Type filter is strict — do not accept cross-type picks.
    const itemProductType = resolveCatalogItemProductType(item)
    if (
      line.productType &&
      itemProductType &&
      itemProductType !== normalizeEngineeringProductType(line.productType)
    ) {
      return
    }
    // Prefer line Product Type when set; else Item Master type / category fallback.
    const productType =
      normalizeEngineeringProductType(line.productType) ||
      itemProductType ||
      mapPurchaseCategoryToEngineeringProductType(item.category) ||
      ''
    const category =
      mapEngineeringProductTypeToPurchaseCategory(productType) ||
      item.category ||
      line.category ||
      ''
    const vendor = item.preferredVendorId
      ? vendors.find((v) => v.id === item.preferredVendorId)
      : undefined
    const defaultUom = resolveDefaultPurchaseUom(item.id)
    const master = useMasterStore.getState().items.find((i) => i.id === itemId)
    const defaultBin = resolveItemDefaultBin(
      {
        defaultBinId: master?.defaultBinId ?? item.defaultBinId,
        defaultBinCode: master?.defaultBinCode ?? item.defaultBinCode,
      },
      binOptions,
    )
    patchLine(key, {
      itemId: item.id,
      itemCode: item.itemCode,
      itemName: item.itemName,
      productType,
      category,
      uomId: defaultUom?.id ?? item.uomId,
      uom: defaultUom?.code ?? item.uom,
      uomConversionFactor: defaultUom?.factor ?? 1,
      hsnCode: item.hsnCode,
      sacCode: item.sacCode,
      gstRatePct: item.gstRatePct ?? 0,
      estimatedRate: item.standardRate,
      quantity: Number(line.quantity) > 0 ? line.quantity : 1,
      itemType: category === 'job_work' || productType === 'service' ? 'service' : 'inventory',
      preferredVendorId: vendor?.id ?? null,
      preferredVendorName: vendor?.vendorName ?? null,
      vendorNumber: vendor?.vendorCode ?? '',
      currentStock: Math.max(0, Math.round(item.reorderLevel * 1.4)),
      openPoQty: Math.max(0, Math.round(item.reorderLevel * 0.3)),
      binCode: defaultBin.binCode || line.binCode || '',
    })
  }

  const importCsvText = (text: string) => {
    const rows = text
      .split(/\r?\n/)
      .map((r) => r.trim())
      .filter(Boolean)
      .slice(1)
    if (!rows.length) {
      notify.info('No data rows found in file')
      return
    }
    const imported: PrEditorLine[] = rows.map((row, index) => {
      const [code, name, qty, uom, rate] = row.split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
      const quantity = Number(qty) || 1
      const estimatedRate = Number(rate) || 0
      const matched = catalogItems.find((i) => i.itemCode === code)
      const defaultUom = matched ? resolveDefaultPurchaseUom(matched.id) : null
      return emptyLine({
        lineNo: index + 1,
        itemId: matched?.id ?? '',
        itemCode: code || matched?.itemCode || '',
        itemName: name || matched?.itemName || code || 'Imported item',
        uomId: defaultUom?.id ?? matched?.uomId ?? null,
        uom: uom || defaultUom?.code || matched?.uom || 'NOS',
        uomConversionFactor: defaultUom?.factor ?? 1,
        quantity,
        estimatedRate: estimatedRate || matched?.standardRate || 0,
        hsnCode: matched?.hsnCode ?? '',
        category: matched?.category ?? mapEngineeringProductTypeToPurchaseCategory(matched?.productType) ?? '',
        productType: matched?.productType ?? '',
        locationId: header.locationId,
        locationName: header.locationName,
      })
    })
    setLinesDirty([...(lines.filter((l) => l.itemName || l.itemCode)), ...imported])
    notify.success(`Imported ${imported.length} line(s)`)
  }

  if (loading) {
    return (
      <PurchaseCardFormShell
        title="Purchase Requisition"
        description="Loading…"
        status="Draft"
        favoritePath="/purchase/requisitions/new"
        breadcrumbs={[
          { label: 'Purchase', to: '/purchase' },
          { label: 'Requisitions', to: '/purchase/requisitions' },
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
      title={isNew ? 'New Purchase Requisition' : `Edit ${documentNumber ?? 'Purchase Requisition'}`}
      description="Manual purchase requisition — demand capture before RFQ / PO"
      recordNo={documentNumber ?? (isNew ? 'New' : undefined)}
      recordTitle={documentTitle}
      status={purchaseRequisitionApprovalStatusLabel(status)}
      statusTone={purchaseStatusTone(status)}
      statusKey={status}
      recordHeaderFacts={recordHeaderFacts}
      favoritePath={recordId ? `/purchase/requisitions/${recordId}/edit` : '/purchase/requisitions/new'}
      breadcrumbs={[
        { label: 'Requisitions', to: '/purchase/requisitions' },
        { label: isNew ? 'New' : documentNumber ?? 'Edit' },
      ]}
      createdBy={createdMeta.by || undefined}
      createdDate={createdMeta.at ? formatDate(createdMeta.at.slice(0, 10)) : undefined}
      modifiedBy={updatedMeta.by || undefined}
      modifiedDate={updatedMeta.at ? formatDate(updatedMeta.at.slice(0, 10)) : undefined}
      validationErrors={showErrors ? validation.errors : []}
      validationItems={[
        ...(showErrors
          ? validation.errors.map((message, i) => {
              const looksLikeLine =
                /line/i.test(message) ||
                /quantity/i.test(message) ||
                /description/i.test(message) ||
                /unit/i.test(message) ||
                /At least one line/i.test(message)
              const sectionLabel = looksLikeLine ? 'Line Items' : 'Request Details'
              return {
                id: `pr-err-${i}`,
                label: `${sectionLabel} · ${message}`,
                message: 'Required',
                onClick: () => focusValidationItem(message),
              }
            })
          : []),
        ...validation.warnings.map((message, i) => ({
          id: `pr-warn-${i}`,
          label: message,
          message: 'Warning',
        })),
      ]}
      commandBar={null}
      className="crm-lead-form-page purchase-pr-form-page enterprise-workspace--dynamics-form"
      factBoxLabel="Smart Context"
      factBoxSubtitle="Path, approval, and delivery summary for this requisition."
      factBox={
        <PurchaseEnterpriseFactBox
          title="Smart Context"
          metrics={formMetrics}
          summary={[
            {
              label: 'PR Path',
              value: header.rfqRequired ? 'RFQ Purchase Path' : 'Direct Purchase Planning Path',
              highlight: !header.rfqRequired,
            },
            {
              label: 'RFQ Required',
              value: header.rfqRequired ? 'Yes' : 'No',
              highlight: header.rfqRequired,
            },
            {
              label: 'Approval Status',
              value: purchaseRequisitionApprovalStatusLabel(status),
            },
            {
              label: 'Department',
              value: header.department ? prDepartmentLabel(header.department) : '—',
              highlight: Boolean(header.department),
            },
            {
              label: 'Priority',
              value: PURCHASE_REQUISITION_PRIORITY_LABELS[header.priority],
              highlight: header.priority === 'urgent',
            },
            {
              label: 'Line Count',
              value: String(summary.totalLines),
            },
            {
              label: 'Estimated Total',
              value: formatCurrency(orderTotals.grandTotal),
              highlight: true,
            },
            {
              label: 'Delivery Risk',
              value: deliveryRisk.label,
              highlight: deliveryRisk.highlight,
            },
            ...(dirty
              ? [{ label: 'Changes', value: 'Unsaved', highlight: true as const }]
              : []),
          ]}
        >
          <div className="purchase-pr-smart-context__footer mt-3 space-y-2 border-t border-erp-border pt-3 text-[11px] text-erp-muted">
            <p>PR number is reserved from the series and confirmed on save.</p>
            <p>Urgent PRs require Purpose before submit.</p>
            {dirty ? <Badge color="orange">Unsaved changes</Badge> : null}
          </div>
        </PurchaseEnterpriseFactBox>
      }
      stickyFooter
      footer={
        <div className="erp-form-footer erp-form-footer-sticky flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
            <ErpButton
              type="button"
              variant="secondary"
              disabled={saving}
              onClick={() => {
                void (async () => {
                  if (dirty) {
                    const leave = await systemConfirm({
                      title: 'Discard changes?',
                      description: 'You have unsaved changes. Discard them and leave this page?',
                      confirmLabel: 'Discard',
                      cancelLabel: 'Keep editing',
                      variant: 'danger',
                    })
                    if (!leave) return
                  }
                  resetDirty()
                  navigate(PURCHASE_FORM_ROUTES.requisition.list)
                })()
              }}
            >
              Cancel
            </ErpButton>
            <span className="text-[12px] text-erp-muted">
              {editable ? 'Ctrl+S Save draft' : 'Read-only for this status'}
              {dirty ? ' · Unsaved changes' : ''}
            </span>
          </div>
          {editable ? (
            <ErpButtonGroup className="w-full sm:w-auto">
              <ErpButton
                type="button"
                variant="secondary"
                disabled={saving}
                onClick={() => void saveDraft()}
              >
                {saving ? 'Saving…' : 'Save Draft'}
              </ErpButton>
              <ErpButton
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => void saveAndClose()}
              >
                Save & Close
              </ErpButton>
              {canSubmitForApproval ? (
                <ErpButton
                  type="button"
                  variant="primary"
                  disabled={saving}
                  onClick={() => void submitForApproval()}
                >
                  Submit for Approval
                </ErpButton>
              ) : null}
            </ErpButtonGroup>
          ) : null}
        </div>
      }
      onSaveShortcut={() => void saveDraft()}
      onSaveCloseShortcut={() => void saveAndClose()}
    >
      <div className="purchase-pr-form-canvas space-y-4">
        <PurchaseRequisitionPathBanner
          rfqRequired={header.rfqRequired}
          className="purchase-pr-path-banner"
        />

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (!file) return
            void file.text().then(importCsvText)
            e.target.value = ''
          }}
        />

        <ErpCardSection
          id={purchaseSectionId('request')}
          title="Request Details"
          subtitle="Who is requesting and how this demand will be fulfilled"
          collapsedSummary={quickEntrySummaryText || undefined}
          icon={FileText}
          accent="blue"
          collapsible
          defaultOpen
          dense
          columns={6}
          className="crm-lead-zoho-section purchase-pr-request-section"
        >
          <ErpFieldRow
            label="PR Number"
            readOnly
            horizontal={false}
            hint={isNew ? 'Preview from number series — assigned when you save' : undefined}
          >
            <Input
              value={documentNumber ?? ''}
              placeholder="Loading number…"
              readOnly
              className="bg-erp-surface-alt"
            />
          </ErpFieldRow>
          <ErpFieldRow label="Requestor" readOnly horizontal={false}>
            <Input value={header.requesterName} readOnly className="bg-erp-surface-alt" />
          </ErpFieldRow>
          <ErpFieldRow
            label="Department"
            required
            horizontal={false}
            fieldError={showErrors ? validation.fieldErrors.department : undefined}
            fieldState={showErrors && validation.fieldErrors.department ? 'error' : 'idle'}
          >
            <Select
              value={header.department}
              disabled={!editable}
              onChange={(e) => patchHeader({ department: e.target.value })}
            >
              <option value="">Select department</option>
              {PR_DEPARTMENT_OPTIONS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </Select>
          </ErpFieldRow>
          <ErpFieldRow label="Request Date" required horizontal={false}>
            <Input
              type="date"
              value={header.documentDate}
              disabled={!editable}
              onChange={(e) => patchHeader({ documentDate: e.target.value })}
            />
          </ErpFieldRow>
          <ErpFieldRow label="Priority" horizontal={false}>
            <Select
              value={header.priority}
              disabled={!editable}
              onChange={(e) =>
                patchHeader({ priority: e.target.value as PrEditorHeader['priority'] })
              }
            >
              {Object.entries(PURCHASE_REQUISITION_PRIORITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </ErpFieldRow>
          <ErpFieldRow
            label="RFQ Required"
            required
            horizontal={false}
            hint={
              header.rfqRequired
                ? 'RFQ is required to create PO'
                : 'Create Direct PO'
            }
          >
            <Select
              value={header.rfqRequired ? 'yes' : 'no'}
              disabled={!editable}
              onChange={(e) => patchHeader({ rfqRequired: e.target.value === 'yes' })}
            >
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </Select>
          </ErpFieldRow>
          <ErpFieldRow label="Purchase Type" horizontal={false}>
            <Select
              value={header.requisitionType}
              disabled={!editable}
              onChange={(e) =>
                patchHeader({
                  requisitionType: e.target.value as PrEditorHeader['requisitionType'],
                })
              }
            >
              {Object.entries(PURCHASE_REQUISITION_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </ErpFieldRow>
          <ErpFieldRow label="Source" horizontal={false}>
            <Select
              value={header.source}
              disabled={!editable}
              onChange={(e) =>
                patchHeader({ source: e.target.value as PrEditorHeader['source'] })
              }
            >
              {Object.entries(PURCHASE_REQUISITION_SOURCE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </ErpFieldRow>
          <ErpFieldRow
            label="Required By"
            horizontal={false}
            fieldError={showErrors ? validation.fieldErrors.expectedDeliveryDate : undefined}
            fieldState={
              showErrors && validation.fieldErrors.expectedDeliveryDate ? 'error' : 'idle'
            }
          >
            <Input
              type="date"
              value={header.expectedDeliveryDate}
              disabled={!editable}
              onChange={(e) => patchHeader({ expectedDeliveryDate: e.target.value })}
            />
          </ErpFieldRow>
          <ErpFieldRow label="Reference" horizontal={false}>
            <Input
              value={header.referenceNumber}
              disabled={!editable}
              onChange={(e) => patchHeader({ referenceNumber: e.target.value })}
              placeholder="Optional reference"
            />
          </ErpFieldRow>
          <ErpFieldRow label="Project" horizontal={false}>
            <Input
              value={header.project}
              disabled={!editable}
              onChange={(e) => patchHeader({ project: e.target.value })}
              placeholder="Optional project"
            />
          </ErpFieldRow>
          <ErpFieldRow
            label="Purpose"
            required={header.priority === 'urgent'}
            horizontal={false}
            className="erp-field-row--span-2"
            fieldError={showErrors ? validation.fieldErrors.purpose : undefined}
            fieldState={showErrors && validation.fieldErrors.purpose ? 'error' : 'idle'}
          >
            <Input
              value={header.purpose}
              disabled={!editable}
              onChange={(e) => patchHeader({ purpose: e.target.value })}
              placeholder={
                header.priority === 'urgent' ? 'Required for urgent PRs' : 'Brief justification'
              }
            />
          </ErpFieldRow>
        </ErpCardSection>

        <ErpCardSection
          id={purchaseSectionId('delivery')}
          title="Delivery Details"
          subtitle="Where material is needed"
          icon={MapPin}
          accent="blue"
          collapsible
          defaultOpen
          columns={3}
          className="crm-lead-zoho-section"
        >
          <ErpFieldRow
            label="Warehouse"
            required
            horizontal={false}
            fieldError={showErrors ? validation.fieldErrors.locationId : undefined}
            fieldState={showErrors && validation.fieldErrors.locationId ? 'error' : 'idle'}
          >
            <Select
              value={header.locationId}
              disabled={!editable}
              onChange={(e) => {
                const loc = locationOptions.find((l) => l.id === e.target.value)
                if (!loc) return
                patchHeader({
                  locationId: loc.id,
                  locationCode: loc.code,
                  locationName: loc.name,
                  locationState: loc.state,
                  locationCity: loc.city,
                })
              }}
            >
              {locationOptions.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </ErpFieldRow>
          <ErpFieldRow label="Delivery Location" readOnly horizontal={false}>
            <Input
              value={
                [header.locationName, header.locationCity, header.locationState]
                  .filter(Boolean)
                  .join(', ') || '—'
              }
              readOnly
              className="bg-erp-surface-alt"
            />
          </ErpFieldRow>
          <ErpFieldRow
            label="Need By Date"
            horizontal={false}
            fieldError={showErrors ? validation.fieldErrors.expectedDeliveryDate : undefined}
            fieldState={
              showErrors && validation.fieldErrors.expectedDeliveryDate ? 'error' : 'idle'
            }
          >
            <Input
              type="date"
              value={header.expectedDeliveryDate}
              disabled={!editable}
              onChange={(e) => patchHeader({ expectedDeliveryDate: e.target.value })}
            />
          </ErpFieldRow>
        </ErpCardSection>

        <ErpCardSection
          id={purchaseSectionId('lines')}
          title="Line Items"
          subtitle="Catalog or manual lines for this requisition"
          icon={Package}
          accent="blue"
          collapsible
          defaultOpen
          columns={1}
          className="crm-lead-zoho-section purchase-doc-lines-section purchase-pr-lines-section"
          badge={
            <span className="text-[11px] tabular-nums text-erp-muted">
              {lines.length} line{lines.length === 1 ? '' : 's'}
            </span>
          }
        >
            <PurchaseRequisitionLinesTable
              lines={lines}
              catalogItems={catalogItemsForPicker}
              vendors={vendors}
              editable={editable}
              reqNo={documentNumber}
              showErrors={showErrors}
              lineErrors={validation.lineErrors}
              formatCurrency={formatCurrency}
              estimatedTotal={orderTotals.grandTotal}
              onAddLine={() =>
                setLinesDirty([
                  ...lines,
                  emptyLine({
                    locationId: header.locationId,
                    locationName: header.locationName,
                  }),
                ])
              }
              onCopyLastLine={() => {
                const selected = lines[lines.length - 1]
                if (!selected) return
                setLinesDirty([
                  ...lines,
                  emptyLine({
                    ...selected,
                    key: crypto.randomUUID(),
                    id: '',
                    purchaseOrderId: null,
                    purchaseOrderNumber: '',
                    purchaseQuoteNumber: '',
                  }),
                ])
              }}
              onImportExcel={() => fileInputRef.current?.click()}
              onClearLines={() =>
                setLinesDirty(
                  threeEmptyLines({
                    locationId: header.locationId,
                    locationName: header.locationName,
                  }),
                )
              }
              onPatchLine={patchLine}
              onRemoveLine={(key) => {
                void (async () => {
                  const line = lines.find((l) => l.key === key)
                  const hasContent = Boolean(
                    line &&
                      (line.itemId ||
                        line.itemCode.trim() ||
                        line.itemName.trim() ||
                        Number(line.quantity) > 0),
                  )
                  if (hasContent) {
                    const ok = await systemConfirm({
                      title: 'Delete item line?',
                      description: 'This line has entered data and will be removed.',
                      confirmLabel: 'Delete',
                      cancelLabel: 'Keep',
                      variant: 'danger',
                    })
                    if (!ok) return
                  }
                  const next = lines.filter((l) => l.key !== key)
                  if (next.length === 0) {
                    setLinesDirty(
                      [
                        emptyLine({
                          locationId: header.locationId,
                          locationName: header.locationName,
                        }),
                      ].map((l, i) => ({ ...l, lineNo: i + 1 })),
                    )
                    return
                  }
                  setLinesDirty(next)
                })()
              }}
              onSelectCatalogItem={applyItemCatalog}
            />
            <PurchaseOrderAdjustmentsBlock
              className="mt-4"
              lines={lines}
              value={orderAdjustments}
              readOnly={!editable}
              taxPct={0}
              onChange={(next) => {
                setOrderAdjustments(next)
                markDirty()
              }}
            />
            {showErrors &&
            validation.errors.some(
              (e) =>
                e.includes('line') ||
                e.includes('Line') ||
                e.includes('Quantity') ||
                e.includes('description') ||
                e.includes('Unit') ||
                e.includes('Product type'),
            ) ? (
              <p className="mt-2 text-[12px] text-erp-danger-fg">Fix line errors before submit.</p>
            ) : null}
        </ErpCardSection>

        <ErpCardSection
          id={purchaseSectionId('notes')}
          title="Notes"
          subtitle="Internal remarks and estimated line totals"
          collapsedSummary={
            financeSummaryText || (header.remarks.trim() ? 'Remarks set' : undefined)
          }
          icon={Banknote}
          accent="blue"
          collapsible
          defaultOpen={financeDefaultOpen || Boolean(header.remarks.trim())}
          columns={3}
          className="crm-lead-zoho-section"
        >
          <ErpFieldRow label="Remarks" horizontal={false} className="erp-field-row--wide">
            <Textarea
              value={header.remarks}
              disabled={!editable}
              onChange={(e) => patchHeader({ remarks: e.target.value })}
              rows={3}
              placeholder="Optional notes for purchase team"
            />
          </ErpFieldRow>
          <ErpFieldRow label="Lines" readOnly horizontal={false}>
            <Input value={String(summary.totalLines)} readOnly className="bg-erp-surface-alt" />
          </ErpFieldRow>
          <ErpFieldRow label="Total Qty" readOnly horizontal={false}>
            <Input value={String(orderTotals.totalQty)} readOnly className="bg-erp-surface-alt" />
          </ErpFieldRow>
          <ErpFieldRow label="Est. Subtotal" readOnly horizontal={false}>
            <Input
              value={formatCurrency(orderTotals.basicAmount)}
              readOnly
              className="bg-erp-surface-alt"
            />
          </ErpFieldRow>
          <ErpFieldRow label="Est. Total" readOnly horizontal={false}>
            <Input
              value={formatCurrency(orderTotals.grandTotal)}
              readOnly
              className="bg-erp-primary-soft font-semibold text-erp-primary"
            />
          </ErpFieldRow>
        </ErpCardSection>

        <ErpCardSection
          id={purchaseSectionId('attachments')}
          title="Attachments"
          subtitle="Supporting files for this requisition"
          collapsedSummary={attachmentsSummaryText || undefined}
          icon={Paperclip}
          accent="blue"
          collapsible
          defaultOpen={false}
          columns={1}
          className="crm-lead-zoho-section"
        >
          <PurchaseDocumentAttachments
            files={prPlaceholdersToRows(attachments, header.requesterName || createdMeta.by || 'User')}
            disabled={!editable}
            uploadedBy={header.requesterName || createdMeta.by || 'User'}
            hint="Technical specs, drawings, requirement docs, and supporting files"
            onChange={(next) => {
              setAttachments(rowsToPrPlaceholders(next, attachments))
              markDirty()
            }}
          />
        </ErpCardSection>

        <ErpCardSection
          id={purchaseSectionId('timeline')}
          title="Timeline"
          subtitle="Approval and activity history"
          collapsedSummary={approvalSummaryText || undefined}
          icon={ClipboardList}
          accent="blue"
          collapsible
          defaultOpen={history.length > 0}
          columns={1}
          className="crm-lead-zoho-section"
        >
          {history.length === 0 ? (
            <p className="text-[12px] text-erp-muted">No approval activity yet.</p>
          ) : (
            <ul className="divide-y divide-erp-border rounded-lg border border-erp-border bg-white">
              {history.map((h) => (
                <li key={h.id} className="flex justify-between gap-3 px-3 py-2.5 text-[12px]">
                  <span>
                    <span className="font-medium capitalize text-erp-text">
                      {h.action.replace(/_/g, ' ')}
                    </span>
                    <span className="text-erp-muted"> · {h.actorName}</span>
                    {h.remarks ? (
                      <span className="block text-erp-muted">{h.remarks}</span>
                    ) : null}
                  </span>
                  <span className="shrink-0 tabular-nums text-erp-muted">
                    {formatDate(h.actedAt.slice(0, 10))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </ErpCardSection>
      </div>
    </PurchaseCardFormShell>
  )
}
