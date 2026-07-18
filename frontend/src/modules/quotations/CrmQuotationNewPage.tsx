import { useMemo, useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Banknote,
  Bookmark,
  Building2,
  ClipboardList,
  FileText,
  Handshake,
  Paperclip,
  PenLine,
} from 'lucide-react'
import { DynamicsStatusChip } from '../../components/dynamics/DynamicsStatusChip'
import { OpportunitySelectPicker } from '../../components/crm/OpportunitySelectPicker'
import { QuotationTemplateSelector } from '@/components/quotations/QuotationTemplateSelector'
import { QuotationLineItemsEditor } from '@/components/quotations/QuotationLineItemsEditor'
import { ErpCardSection, ErpFieldRow, ErpStickySaveBar } from '../../components/erp/card-form'
import { ErpSegmentedControl } from '../../components/erp/ErpSegmentedControl'
import { ErpSmartSelect } from '../../components/erp/ErpSmartSelect'
import { Input, Select } from '../../components/forms/Inputs'
import { resolveStoreAction } from '../../store/storeAction'
import { useCrmStore } from '../../store/crmStore'
import { useMasterStore } from '../../store/masterStore'
import { findFeaturedQuotationTemplate } from '../../utils/quotationTemplates'
import { formatCrmCurrency } from '../../utils/crmMetrics'
import { formatDate } from '../../utils/dates/format'
import { opportunityStageLabel } from '../../utils/opportunityUtils'
import { OpportunityQuotationValueMismatchBanner } from '../../components/crm/OpportunityQuotationValueMismatchBanner'
import { notify } from '../../store/toastStore'
import type { Opportunity, OpportunityLine } from '../../types/crm'
import type { Product } from '../../types/master'
import {
  calcOpportunityLinesSummary,
  calcWeightedValue,
  createEmptyOpportunityLine,
  opportunityLinesToQuotationPriceLines,
  quotationPriceLinesToOpportunityLines,
  resolveOpportunityLines,
  syncOpportunityLines,
  validateOpportunityLines,
  opportunityLineUnitPriceFieldKey,
  UNIT_PRICE_REQUIRED_MESSAGE,
} from '../../utils/opportunityLineCalc'
import { opportunityRowErrorsToFieldMap } from '../../utils/opportunityLineValidationFocus'
import { handleInvalidSubmit } from '../../utils/formValidation'
import {
  decodeLeadRequirementLines,
  hasLeadRequirementLines,
  isEncodedLeadRequirementPayload,
  opportunityRequirementDisplay,
  sanitizeOpportunityScopeNotes,
  summarizeLeadRequirementLines,
} from '../../utils/leadRequirementLines'
import { LocationFieldRow } from '../../components/masters/LocationFieldRow'
import { CommercialTermSelect } from '../../components/masters/GeographySelects'
import { useDocumentLocation } from '../../hooks/useDocumentLocation'
import { CrmCardFormShell } from '@/components/crm/CrmCardFormShell'
import { FactBoxPaneAiToggle } from '../../components/erp/card-form/FactBoxPaneAiToggle'
import { crmChildBreadcrumbs } from '../../utils/crmNavigation'
import { CrmTypedDocumentUpload } from '../../components/crm/CrmTypedDocumentUpload'
import { useQuotationAttachmentStore } from '../../store/quotationAttachmentStore'
import type { CrmTypedAttachment } from '../../types/crmDocuments'
import {
  EnterpriseFormMetrics,
  EnterpriseFormSectionNav,
} from '../../design-system/workspace'
import { CrmSmartOverviewPanel } from '@/components/crm/CrmSmartOverviewPanel'
import {
  buildQuotationAiInsight,
  buildQuotationFormSectionCompletion,
  buildQuotationKeyDetails,
  buildQuotationSmartSignals,
  computeQuotationCompleteness,
  computeQuotationFormCompletionPercent,
  quotationOverviewChips,
  quotationOverviewTitle,
  resolveQuotationNextBestAction,
} from '../../utils/quotationSmartOverview'
import { resolveDefaultCommercialTerm } from '../../utils/quotationTermUtils'

type QuoteCreateMode = 'opportunity' | 'direct'

/** Prefer stored lines; hydrate encoded <!--fos-lead-lines--> productRequirement when lines are absent. */
function linesFromOpportunity(opp: Opportunity, product?: Product) {
  if (opp.lines?.length) return resolveOpportunityLines(opp, product)
  if (isEncodedLeadRequirementPayload(opp.productRequirement)) {
    const { lines } = decodeLeadRequirementLines(opp.productRequirement)
    if (hasLeadRequirementLines(lines)) return lines
  }
  return resolveOpportunityLines(opp, product)
}

const DEFAULT_VALIDITY_DAYS = 30
const VALIDITY_PERIOD_OPTIONS = [15, 30, 45, 60, 90] as const

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate.slice(0, 10))
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function daysBetween(from: string, to: string): number {
  const a = new Date(from.slice(0, 10))
  const b = new Date(to.slice(0, 10))
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

export function CrmQuotationNewPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const templates = useCrmStore((s) => s.quotationTemplates) ?? []
  const opportunities = useCrmStore((s) => s.opportunities) ?? []
  const customers = useMasterStore((s) => s.customers) ?? []
  const products = useMasterStore((s) => s.products) ?? []
  const createFromOpp = useCrmStore((s) => s.createQuotationFromOpportunity)
  const createDirect = useCrmStore((s) => s.createQuotationDirect)
  const updateOpportunity = useCrmStore((s) => s.updateOpportunity)

  const prefillOppId = searchParams.get('opportunityId') ?? ''
  const prefillCustomerId = searchParams.get('customerId') ?? ''

  const initialMode: QuoteCreateMode = prefillOppId
    ? 'opportunity'
    : prefillCustomerId
      ? 'direct'
      : 'opportunity'

  const openOpps = useMemo(() => {
    const open = opportunities
      .filter((o) => o.status === 'open')
      .filter((o) => !prefillCustomerId || o.customerId === prefillCustomerId)
      .sort((a, b) => b.value - a.value)
    return open
  }, [opportunities, prefillCustomerId])

  const defaultOppId = prefillOppId && openOpps.some((o) => o.id === prefillOppId)
    ? prefillOppId
    : openOpps[0]?.id ?? ''

  const featuredTemplate = findFeaturedQuotationTemplate(templates)

  const [createMode, setCreateMode] = useState<QuoteCreateMode>(initialMode)
  const [activeSection, setActiveSection] = useState('source')
  const [opportunityId, setOpportunityId] = useState(initialMode === 'opportunity' ? defaultOppId : '')
  const [customerId, setCustomerId] = useState(() => {
    if (initialMode === 'direct' && prefillCustomerId) return prefillCustomerId
    if (initialMode === 'opportunity' && defaultOppId) {
      return openOpps.find((o) => o.id === defaultOppId)?.customerId ?? ''
    }
    return prefillCustomerId
  })
  const [templateId, setTemplateId] = useState(featuredTemplate?.id ?? '')
  const [lines, setLines] = useState<OpportunityLine[]>(() => {
    if (initialMode !== 'opportunity') return [createEmptyOpportunityLine(1)]
    const opp = openOpps.find((o) => o.id === defaultOppId)
    return opp
      ? linesFromOpportunity(opp, opp.productId ? products.find((p) => p.id === opp.productId) : undefined)
      : [createEmptyOpportunityLine(1)]
  })
  const [scopeNotes, setScopeNotes] = useState('')
  const [quotationDate, setQuotationDate] = useState(todayIsoDate)
  /** Empty until set — missing validity must surface as Required, not Complete. */
  const [validUntil, setValidUntil] = useState('')
  const [validityPeriodDays, setValidityPeriodDays] = useState<number | 'custom'>(DEFAULT_VALIDITY_DAYS)
  const [paymentTerms, setPaymentTerms] = useState(() => resolveDefaultCommercialTerm('payment-terms').text)
  const [deliveryTerms, setDeliveryTerms] = useState(() => resolveDefaultCommercialTerm('delivery-terms').text)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [rowErrors, setRowErrors] = useState<Record<string, string[]>>({})
  const [forceOpenProductsKey, setForceOpenProductsKey] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)

  function handleQuotationDateChange(value: string) {
    setQuotationDate(value)
    if (validityPeriodDays !== 'custom' && value) {
      setValidUntil(addDays(value, validityPeriodDays))
    }
  }

  function handleValidityPeriodChange(raw: string) {
    if (raw === 'custom') {
      setValidityPeriodDays('custom')
      return
    }
    const days = Number(raw)
    setValidityPeriodDays(days)
    setValidUntil(addDays(quotationDate || todayIsoDate(), days))
  }

  function handleValidUntilChange(value: string) {
    setValidUntil(value)
    if (quotationDate && value) {
      const days = daysBetween(quotationDate, value)
      setValidityPeriodDays(
        (VALIDITY_PERIOD_OPTIONS as readonly number[]).includes(days) ? days : 'custom',
      )
    }
  }

  useEffect(() => {
    if (!templateId && featuredTemplate?.id) setTemplateId(featuredTemplate.id)
  }, [featuredTemplate?.id, templateId])

  const attachmentScopeId = 'draft:new-quotation'
  const setQuotationAttachments = useQuotationAttachmentStore((s) => s.setForQuotation)
  const bindDraftAttachments = useQuotationAttachmentStore((s) => s.bindDraftToQuotation)
  const [attachments, setAttachmentsState] = useState<CrmTypedAttachment[]>(() =>
    useQuotationAttachmentStore.getState().getForQuotation(attachmentScopeId),
  )

  useEffect(() => {
    setAttachmentsState(useQuotationAttachmentStore.getState().getForQuotation(attachmentScopeId))
  }, [attachmentScopeId])

  function setAttachments(next: CrmTypedAttachment[]) {
    setAttachmentsState(next)
    setQuotationAttachments(attachmentScopeId, next)
  }

  const customerOptions = useMemo(
    () => customers.map((c) => ({
      value: c.id,
      label: `${c.customerCode} · ${c.customerName}`,
      searchText: `${c.customerCode} ${c.customerName} ${c.city ?? ''}`.toLowerCase(),
      meta: c.city,
    })),
    [customers],
  )

  const selectedOpp = createMode === 'opportunity'
    ? openOpps.find((o) => o.id === opportunityId)
    : undefined
  const effectiveCustomerId = createMode === 'opportunity'
    ? (selectedOpp?.customerId ?? '')
    : customerId
  const { locationId, setLocationId } = useDocumentLocation('sales', selectedOpp?.locationId)
  const selectedCustomer = effectiveCustomerId
    ? customers.find((c) => c.id === effectiveCustomerId)
    : undefined
  const selectedTemplate = templates.find((t) => t.id === templateId)
  const selectedProduct = selectedOpp?.productId
    ? products.find((p) => p.id === selectedOpp.productId)
    : undefined

  const syncedLines = syncOpportunityLines(lines)
  const lineSummary = calcOpportunityLinesSummary(syncedLines)
  const probability = selectedOpp?.probability ?? 0
  const weighted = calcWeightedValue(lineSummary.grandTotal, probability)
  const priceLines = useMemo(() => opportunityLinesToQuotationPriceLines(syncedLines), [syncedLines])

  function handleCreateModeChange(mode: QuoteCreateMode) {
    if (mode === createMode) return
    setCreateMode(mode)
    setValidationErrors([])
    if (mode === 'opportunity') {
      const nextOppId = opportunityId || defaultOppId
      setOpportunityId(nextOppId)
      const opp = openOpps.find((o) => o.id === nextOppId)
      if (opp) {
        const product = opp.productId ? products.find((p) => p.id === opp.productId) : undefined
        setLines(linesFromOpportunity(opp, product))
        setScopeNotes(sanitizeOpportunityScopeNotes(opp.productRequirement))
        setCustomerId(opp.customerId)
        if (opp.locationId) setLocationId(opp.locationId)
      }
    } else {
      setOpportunityId('')
      const fromOpp = selectedOpp?.customerId
      const nextCustomer = customerId || fromOpp || prefillCustomerId
      setCustomerId(nextCustomer)
      setLines([createEmptyOpportunityLine(1)])
      setScopeNotes('')
    }
  }

  function handleOpportunityChange(id: string) {
    setOpportunityId(id)
    const opp = openOpps.find((o) => o.id === id)
    if (opp) {
      const product = opp.productId ? products.find((p) => p.id === opp.productId) : undefined
      setLines(linesFromOpportunity(opp, product))
      setScopeNotes(sanitizeOpportunityScopeNotes(opp.productRequirement))
      setCustomerId(opp.customerId)
      if (opp.locationId) setLocationId(opp.locationId)
    } else {
      setLines([createEmptyOpportunityLine(1)])
      setScopeNotes('')
    }
  }

  function validate(): string[] {
    const errors: string[] = []
    if (createMode === 'opportunity') {
      if (!opportunityId) errors.push('Select an opportunity to link this quotation.')
    } else if (!customerId) {
      errors.push('Select a client / company for this quotation.')
    }
    if (!templateId) errors.push('Select a quotation template.')
    if (!validUntil) errors.push('Set a valid-until date for this quotation.')
    if (!paymentTerms.trim()) errors.push('Select payment terms.')
    if (!deliveryTerms.trim()) errors.push('Select delivery terms / timeline.')
    const lineValidation = validateOpportunityLines(syncedLines, {
      customerId: effectiveCustomerId,
      ownerId: selectedOpp?.ownerId ?? '',
      stage: selectedOpp?.stage ?? 'new_lead',
      probability: String(probability),
    })
    if (!syncedLines.some((l) => l.productOrItem?.trim() && l.qty > 0 && l.unitPrice > 0)) {
      errors.push('Add at least one product line with quantity and unit price.')
    }
    errors.push(...lineValidation.errors.filter((e) => !e.includes('customer') && !e.includes('owner')))
    return errors
  }

  async function createQuotation(mode: 'editor' | 'close' | 'new') {
    const errors = validate()
    const { rowErrors: rErr } = validateOpportunityLines(syncedLines, {
      customerId: effectiveCustomerId,
      ownerId: selectedOpp?.ownerId ?? '',
      stage: selectedOpp?.stage ?? 'new_lead',
      probability: String(probability),
    })
    setValidationErrors(errors)
    setRowErrors(rErr)
    if (errors.length || Object.keys(rErr).length) {
      const fieldMap = opportunityRowErrorsToFieldMap(rErr)
      const lineKeys = Object.keys(fieldMap)
      if (!lineKeys.length && Object.keys(rErr).length) {
        const firstLineId = Object.keys(rErr)[0]!
        fieldMap[opportunityLineUnitPriceFieldKey(firstLineId)] = UNIT_PRICE_REQUIRED_MESSAGE
      }
      const keys = Object.keys(fieldMap)
      const fieldLabels: Record<string, string> = {}
      const sectionByField: Record<string, string> = {}
      for (const key of keys) {
        sectionByField[key] = 'quote-section-products'
        if (key.startsWith('unitPrice-')) fieldLabels[key] = 'Unit Price'
        else if (key.startsWith('qty-')) fieldLabels[key] = 'Quantity'
        else if (key.startsWith('product-')) fieldLabels[key] = 'Product / Item'
        else fieldLabels[key] = 'Line item'
      }
      const headerOnly = errors.filter((e) => !/line|product|unit price/i.test(e))
      const merged: Record<string, string> = { ...fieldMap }
      headerOnly.forEach((e, i) => { if (!Object.values(merged).includes(e)) merged[`_msg_${i}`] = e })
      handleInvalidSubmit({
        errors: Object.keys(merged).length ? merged : errors,
        fieldOrder: [...keys, ...Object.keys(merged).filter((k) => k.startsWith('_msg_'))],
        fieldLabels,
        sectionByField,
        expandSection: (sectionId) => {
          if (sectionId === 'quote-section-products') setForceOpenProductsKey((k) => k + 1)
          document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        },
        delayMs: 120,
      })
      return
    }

    setIsSubmitting(true)
    const primaryUnitPrice = syncedLines[0]?.unitPrice ?? 0
    const commercialExtras = {
      paymentTerms: paymentTerms.trim(),
      deliveryTerms: deliveryTerms.trim(),
      validityDate: validUntil,
    }

    const safeLocationId = locationId?.trim() ? locationId : null

    let r: { ok: boolean; error?: string; quotationId?: string; documentId?: string }
    if (createMode === 'opportunity') {
      if (safeLocationId && opportunityId) {
        updateOpportunity(opportunityId, { locationId: safeLocationId })
      }
      r = await resolveStoreAction(
        createFromOpp(opportunityId, templateId, primaryUnitPrice, syncedLines, {
          ...commercialExtras,
          locationId: safeLocationId,
        }),
      )
    } else {
      r = await resolveStoreAction(createDirect(customerId, templateId, primaryUnitPrice, syncedLines, {
        locationId: safeLocationId,
        scopeNotes,
        ...commercialExtras,
      }))
    }
    setIsSubmitting(false)

    if (!r.ok || !r.quotationId) {
      setValidationErrors([r.error ?? 'Could not create quotation'])
      return
    }

    bindDraftAttachments(attachmentScopeId, r.quotationId)
    setQuotationAttachments(r.quotationId, attachments.map((a) => ({ ...a, quotationId: r.quotationId })))

    if (mode === 'new') {
      setAttachments([])
      setLines([createEmptyOpportunityLine(1)])
      setScopeNotes('')
      setValidationErrors([])
      setRowErrors({})
      setActiveSection('source')
      if (createMode === 'direct') {
        setCustomerId('')
      }
      return
    }

    if (mode === 'close') {
      navigate('/crm/quotations')
      return
    }
    navigate(`/crm/quotations/${r.quotationId}/editor?doc=${r.documentId}`)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    createQuotation('editor')
  }

  function scrollToSection(sectionId: string) {
    setActiveSection(sectionId)
    document.getElementById(`quote-section-${sectionId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const hasValidLine = syncedLines.some((l) => l.productOrItem?.trim() && l.qty > 0 && l.unitPrice > 0)

  const errorSectionIds = useMemo(() => {
    const ids = new Set<string>()
    for (const err of validationErrors) {
      const lower = err.toLowerCase()
      if (lower.includes('opportunity')) ids.add('source')
      if (lower.includes('client') || lower.includes('company') || lower.includes('customer')) {
        ids.add('customer')
      }
      if (lower.includes('template')) ids.add('template')
      if (lower.includes('product') || lower.includes('line')) ids.add('products')
      if (
        lower.includes('payment')
        || lower.includes('delivery')
        || lower.includes('commercial')
        || lower.includes('valid-until')
        || lower.includes('validity')
      ) {
        ids.add('commercial')
      }
    }
    if (Object.keys(rowErrors).length) ids.add('products')
    return ids
  }, [validationErrors, rowErrors])

  const completionItems = useMemo(
    () => buildQuotationFormSectionCompletion({
      createMode,
      opportunitySelected: Boolean(opportunityId),
      customerId: effectiveCustomerId || null,
      templateId,
      lineCount: syncedLines.length,
      hasValidLine,
      grandTotal: lineSummary.grandTotal,
      validUntil: validUntil || null,
      paymentTerms,
      deliveryTerms,
      attachmentCount: attachments.length,
      errorSectionIds,
    }),
    [
      createMode,
      opportunityId,
      effectiveCustomerId,
      templateId,
      syncedLines.length,
      hasValidLine,
      lineSummary.grandTotal,
      validUntil,
      paymentTerms,
      deliveryTerms,
      attachments.length,
      errorSectionIds,
    ],
  )
  const completionPercent = computeQuotationFormCompletionPercent(completionItems)
  const mandatoryDoneCount = completionItems.filter((i) => i.mandatory && i.done).length
  const mandatoryTotal = completionItems.filter((i) => i.mandatory).length

  const sectionNavItems = useMemo(() => [
    {
      id: 'source',
      label: 'Source',
      icon: createMode === 'opportunity' ? Handshake : PenLine,
      status: completionItems.find((i) => i.id === 'source')?.status,
    },
    {
      id: 'customer',
      label: 'Customer',
      icon: Building2,
      status: completionItems.find((i) => i.id === 'customer')?.status,
    },
    {
      id: 'template',
      label: 'Template',
      icon: Bookmark,
      status: completionItems.find((i) => i.id === 'template')?.status,
    },
    {
      id: 'products',
      label: 'Products',
      icon: ClipboardList,
      status: completionItems.find((i) => i.id === 'products')?.status,
    },
    {
      id: 'commercial',
      label: 'Commercial',
      icon: Banknote,
      status: completionItems.find((i) => i.id === 'commercial')?.status,
    },
    {
      id: 'documents',
      label: 'Review',
      icon: Paperclip,
      status: completionItems.find((i) => i.id === 'documents')?.status,
    },
  ], [completionItems, createMode])

  const formMetrics = useMemo(() => [
    {
      label: 'Completion',
      value: `${completionPercent}%`,
      accent: 'blue' as const,
      hint: `${mandatoryDoneCount} of ${mandatoryTotal} required sections`,
    },
    { label: 'Line Items', value: String(syncedLines.length), accent: 'green' as const, hint: hasValidLine ? formatCrmCurrency(lineSummary.grandTotal) : 'Add products' },
    { label: 'Grand Total', value: lineSummary.grandTotal > 0 ? formatCrmCurrency(lineSummary.grandTotal) : '—', accent: 'violet' as const, hint: createMode === 'opportunity' ? `${probability}% probability` : 'Direct quote' },
    { label: 'Weighted', value: weighted > 0 ? formatCrmCurrency(weighted) : '—', accent: 'amber' as const, hint: selectedOpp?.opportunityNo ?? (createMode === 'direct' ? 'No deal linked' : 'No deal') },
  ], [completionPercent, mandatoryDoneCount, mandatoryTotal, syncedLines.length, hasValidLine, lineSummary.grandTotal, probability, weighted, selectedOpp?.opportunityNo, createMode])

  const documentStrip = [
    { label: 'Quotation No.', value: 'Auto on save', highlight: false },
    { label: 'Status', value: 'Draft' },
    { label: 'Customer', value: selectedCustomer?.customerName ?? '—', highlight: Boolean(selectedCustomer) },
    { label: 'Opportunity', value: selectedOpp?.opportunityNo ?? (createMode === 'direct' ? 'Direct' : '—'), highlight: Boolean(selectedOpp) },
    { label: 'Template', value: selectedTemplate?.templateName ?? '—', highlight: Boolean(selectedTemplate) },
    { label: 'Lines', value: String(syncedLines.length), highlight: syncedLines.length > 0 },
    { label: 'Grand Total', value: lineSummary.grandTotal > 0 ? formatCrmCurrency(lineSummary.grandTotal) : '—', highlight: lineSummary.grandTotal > 0 },
    { label: 'Owner', value: selectedOpp?.ownerName ?? '—' },
  ]

  const validationGuideItems = useMemo(
    () => validationErrors.map((err, i) => ({ id: `err-${i}`, label: err })),
    [validationErrors],
  )

  const smartOverviewInput = useMemo(() => ({
    quotationNo: '',
    customerName: selectedCustomer?.customerName ?? '',
    customerId: effectiveCustomerId || null,
    status: 'Draft',
    lineCount: syncedLines.length,
    hasValidLine,
    grandTotal: lineSummary.grandTotal,
    validUntil: validUntil || null,
    opportunityId: opportunityId || null,
    ownerName: selectedOpp?.ownerName,
  }), [
    selectedCustomer?.customerName,
    effectiveCustomerId,
    selectedOpp?.ownerName,
    syncedLines.length,
    hasValidLine,
    lineSummary.grandTotal,
    validUntil,
    opportunityId,
  ])

  const nextAction = resolveQuotationNextBestAction(smartOverviewInput)

  const factBox = (
    <CrmSmartOverviewPanel
      ariaLabel="Smart quotation overview"
      title={quotationOverviewTitle(smartOverviewInput)}
      chips={quotationOverviewChips(smartOverviewInput)}
      meta={[
        selectedOpp?.opportunityNo
          ? `Deal: ${selectedOpp.opportunityNo}`
          : createMode === 'direct'
            ? 'Direct quote (no opportunity)'
            : 'No opportunity',
        selectedTemplate?.templateName ? `Template: ${selectedTemplate.templateName}` : 'No template',
      ]}
      progressLabel="Quotation readiness"
      progressPercent={computeQuotationCompleteness(smartOverviewInput)}
      signals={buildQuotationSmartSignals(smartOverviewInput)}
      nextAction={nextAction}
      onNextAction={() => {
        if (nextAction.id === 'link_customer') scrollToSection('customer')
        else if (nextAction.id === 'add_lines') scrollToSection('products')
        else if (nextAction.id === 'set_validity') scrollToSection('commercial')
        else if (nextAction.id === 'review') scrollToSection('documents')
        else scrollToSection('source')
      }}
      quickActions={[
        {
          id: 'list',
          label: 'All Quotations',
          icon: FileText,
          onClick: () => navigate('/crm/quotations'),
        },
        {
          id: 'templates',
          label: 'Manage Templates',
          icon: Bookmark,
          onClick: () => navigate('/crm/quotation-templates'),
        },
      ]}
      keyDetails={buildQuotationKeyDetails(smartOverviewInput)}
      aiInsight={buildQuotationAiInsight(smartOverviewInput)}
      footer={selectedOpp?.quotationId ? (
        <p className="text-[12px] text-amber-800 rounded-lg border border-amber-200 bg-amber-50 p-3">
          Deal already has a quotation — creating another starts a new document path.
        </p>
      ) : null}
    />
  )

  const recordTitle = selectedOpp?.opportunityName
    ?? selectedCustomer?.customerName
    ?? 'New Quotation'

  return (
    <CrmCardFormShell
      title="New Quotation"
      badge="CRM"
      className="enterprise-workspace--dynamics-form enterprise-workspace--crm-smart-overview"
      recordNo="New"
      recordTitle={recordTitle}
      status="Draft"
      statusTone="info"
      stage={selectedOpp ? opportunityStageLabel(selectedOpp.stage) : createMode === 'direct' ? 'Direct' : '—'}
      createdDate={formatDate(new Date().toISOString().slice(0, 10))}
      owner={selectedOpp?.ownerName}
      company={selectedCustomer?.customerName}
      favoritePath="/crm/quotations/new"
      breadcrumbs={crmChildBreadcrumbs('Quotations', '/crm/quotations', 'New Quotation')}
      documentStrip={documentStrip}
      validationItems={validationGuideItems}
      validationErrors={validationGuideItems.length ? undefined : validationErrors}
      factBox={factBox}
      suppressFactBoxRecord
      collapsibleFactBox
      factBoxLabel="Smart Context"
      onSubmit={handleSubmit}
      onSaveShortcut={() => createQuotation('editor')}
      onSaveCloseShortcut={() => createQuotation('close')}
      onSaveAndNewShortcut={() => createQuotation('new')}
      stickyFooter
      formSaveActions={{
        isSubmitting,
        saveLabel: 'Save',
        onSave: () => void createQuotation('editor'),
        onSaveAndNew: () => void createQuotation('new'),
        onSaveAndClose: () => void createQuotation('close'),
        onCancel: () => navigate('/crm/quotations'),
      }}
      footer={(
        <ErpStickySaveBar
          sticky
          isSubmitting={isSubmitting}
          submitLabel="Save"
          cancelTo="/crm/quotations"
          onSave={() => void createQuotation('editor')}
          onSaveAndNew={() => void createQuotation('new')}
          onSaveAndClose={() => void createQuotation('close')}
          hint={(
            <span className="text-[12px] text-erp-muted">
              {completionPercent}% complete · Ctrl+S Save · Ctrl+Shift+S Save &amp; Close · Alt+N Save &amp; New
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

      {selectedOpp && lineSummary.grandTotal > 0 ? (
        <OpportunityQuotationValueMismatchBanner
          opportunityId={selectedOpp.id}
          opportunityValue={selectedOpp.value}
          quotationGrandTotal={lineSummary.grandTotal}
          documentKey="new"
          onReviewPricing={() => scrollToSection('products')}
          onUpdateOpportunityValue={async () => {
            const r = await resolveStoreAction(
              updateOpportunity(selectedOpp.id, { value: lineSummary.grandTotal }),
            )
            if (r.ok) notify.success('Opportunity value updated to match quotation total')
            else notify.error(r.error ?? 'Could not update opportunity value')
          }}
        />
      ) : null}

      <ErpCardSection
        id="quote-section-source"
        title="Quotation Source"
        subtitle="Create from an open opportunity, or quote a client directly."
        icon={Handshake}
        accent="blue"
        collapsible
        defaultOpen
      >
        <div className="col-span-2 space-y-4">
          <ErpFieldRow label="Create from" colSpan={2}>
            <ErpSegmentedControl<QuoteCreateMode>
              name="Quotation create mode"
              value={createMode}
              onChange={handleCreateModeChange}
              options={[
                {
                  value: 'opportunity',
                  label: 'From opportunity',
                  description: 'Link an open deal — customer and lines flow from the opportunity.',
                  icon: Handshake,
                },
                {
                  value: 'direct',
                  label: 'Direct (select client)',
                  description: 'Quote a client without a deal — sales order can also be created directly later.',
                  icon: PenLine,
                },
              ]}
            />
          </ErpFieldRow>
          {createMode === 'direct' ? (
            <p className="rounded-lg border border-erp-border bg-erp-surface-alt px-3 py-2 text-[12px] text-erp-text">
              Direct quotation: early pricing without a pipeline deal. You can still create a sales order
              directly later when the customer and items exist.
            </p>
          ) : null}

          {createMode === 'opportunity' ? (
            <>
              <OpportunitySelectPicker
                opportunities={openOpps}
                customers={customers}
                products={products}
                value={opportunityId}
                onChange={handleOpportunityChange}
              />
              {selectedOpp ? (
                <div className="crm-quotation-new__opp-summary">
                  <div>
                    <p className="crm-quotation-new__opp-label">Deal no.</p>
                    <p className="crm-quotation-new__opp-value">{selectedOpp.opportunityNo}</p>
                  </div>
                  <div>
                    <p className="crm-quotation-new__opp-label">Customer</p>
                    <p className="crm-quotation-new__opp-value">{selectedCustomer?.customerName ?? '—'}</p>
                  </div>
                  <div>
                    <p className="crm-quotation-new__opp-label">Product</p>
                    <p className="crm-quotation-new__opp-value">
                      {(selectedProduct?.productName
                        || summarizeLeadRequirementLines(syncedLines)
                        || opportunityRequirementDisplay(selectedOpp.productRequirement)
                      ) || '—'}
                    </p>
                  </div>
                  <div>
                    <p className="crm-quotation-new__opp-label">Deal value</p>
                    <p className="crm-quotation-new__opp-value">{formatCrmCurrency(selectedOpp.value)}</p>
                  </div>
                  <div>
                    <p className="crm-quotation-new__opp-label">Owner</p>
                    <p className="crm-quotation-new__opp-value">{selectedOpp.ownerName}</p>
                  </div>
                  <div>
                    <p className="crm-quotation-new__opp-label">Stage</p>
                    <DynamicsStatusChip label={opportunityStageLabel(selectedOpp.stage)} tone="info" />
                  </div>
                </div>
              ) : (
                <p className="text-sm text-erp-muted">
                  {prefillCustomerId && openOpps.length === 0
                    ? 'No open opportunities for this customer — switch to Direct, or create a deal from the pipeline.'
                    : 'No open opportunities — switch to Direct, or create a deal from the pipeline first.'}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-erp-muted">
              Direct quote — select the client in the next section. Set validity under Commercial.
            </p>
          )}
        </div>
      </ErpCardSection>

      <ErpCardSection
        id="quote-section-customer"
        title="Customer"
        subtitle="Bill-to company and sales location for this quotation."
        icon={Building2}
        accent="blue"
        collapsible
        defaultOpen
      >
        <div className="col-span-2 space-y-4">
          {createMode === 'direct' ? (
            <>
              <ErpFieldRow label="Client / Company" required colSpan={2} hint="Required for a direct quotation">
                <ErpSmartSelect
                  options={customerOptions}
                  value={customerId}
                  onChange={(v) => setCustomerId(v)}
                  placeholder="Search customer code, name, or city…"
                  appearance="dropdown"
                />
              </ErpFieldRow>
              {selectedCustomer ? (
                <div className="crm-quotation-new__opp-summary">
                  <div>
                    <p className="crm-quotation-new__opp-label">Customer</p>
                    <p className="crm-quotation-new__opp-value">{selectedCustomer.customerName}</p>
                  </div>
                  <div>
                    <p className="crm-quotation-new__opp-label">Code</p>
                    <p className="crm-quotation-new__opp-value">{selectedCustomer.customerCode}</p>
                  </div>
                  <div>
                    <p className="crm-quotation-new__opp-label">City</p>
                    <p className="crm-quotation-new__opp-value">{selectedCustomer.city || '—'}</p>
                  </div>
                  <div>
                    <p className="crm-quotation-new__opp-label">Contact</p>
                    <p className="crm-quotation-new__opp-value">{selectedCustomer.contactPerson || '—'}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-erp-muted">
                  Select a client to continue. Direct quotes skip the opportunity — you can still create a sales order later when customer and items exist.
                </p>
              )}
            </>
          ) : (
            <ErpFieldRow label="Customer" readOnly colSpan={2} hint="From the linked opportunity">
              <Input value={selectedCustomer?.customerName ?? '—'} readOnly className="erp-input" />
            </ErpFieldRow>
          )}

          <LocationFieldRow value={locationId} onChange={(locId) => setLocationId(locId)} usage="sales" colSpan={2} />
        </div>
      </ErpCardSection>

      <ErpCardSection
        id="quote-section-template"
        title="Quotation Template"
        subtitle="Technical-commercial document structure and section layout."
        icon={Bookmark}
        accent="teal"
        collapsible
        defaultOpen
      >
        <div className="col-span-2 crm-quotation-new">
          <QuotationTemplateSelector
            templates={templates}
            value={templateId}
            onChange={setTemplateId}
            variant="rich"
          />
        </div>
      </ErpCardSection>

      <ErpCardSection
        id="quote-section-products"
        forceOpenKey={forceOpenProductsKey || undefined}
        title="Product / Item Lines"
        subtitle="Search products, set qty and pricing — totals roll up to the quotation."
        icon={ClipboardList}
        accent="violet"
        collapsible
        defaultOpen
      >
        <div className="col-span-3">
          <QuotationLineItemsEditor
            priceLines={priceLines}
            onChange={(nextLines) => setLines(quotationPriceLinesToOpportunityLines(nextLines))}
            probability={probability}
            scopeNotes={scopeNotes}
            onScopeNotesChange={setScopeNotes}
            rowErrors={rowErrors}
          />
        </div>
      </ErpCardSection>

      <ErpCardSection
        id="quote-section-commercial"
        title="Commercial Terms"
        subtitle="Validity, currency, payment and delivery — incomplete until valid-until and terms are set."
        icon={Banknote}
        accent="green"
        collapsible
        defaultOpen
      >
        <ErpFieldRow label="Quotation date" required hint="Issue date used to derive validity period">
          <Input
            type="date"
            value={quotationDate}
            onChange={(e) => handleQuotationDateChange(e.target.value)}
            className="erp-input"
          />
        </ErpFieldRow>
        <ErpFieldRow label="Valid until" required hint="Critical — quotation expires after this date">
          <Input
            type="date"
            value={validUntil}
            onChange={(e) => handleValidUntilChange(e.target.value)}
            className="erp-input"
          />
        </ErpFieldRow>
        <ErpFieldRow label="Validity period" hint="Updates valid-until from quotation date">
          <Select
            native
            value={validityPeriodDays === 'custom' ? 'custom' : String(validityPeriodDays)}
            onChange={(e) => handleValidityPeriodChange(e.target.value)}
            className="erp-input"
          >
            {VALIDITY_PERIOD_OPTIONS.map((d) => (
              <option key={d} value={d}>{d} days</option>
            ))}
            <option value="custom">Custom (from dates)</option>
          </Select>
        </ErpFieldRow>
        <ErpFieldRow label="Currency" readOnly hint="Tenant / document currency (INR)">
          <Input value="INR" readOnly className="erp-input" />
        </ErpFieldRow>
        <ErpFieldRow label="Payment terms" required colSpan={2}>
          <CommercialTermSelect
            termType="payment"
            value={paymentTerms}
            onChange={setPaymentTerms}
            placeholder="Select payment terms"
          />
        </ErpFieldRow>
        <ErpFieldRow label="Delivery timeline" required colSpan={2} hint="Delivery terms / lead-time commitment">
          <CommercialTermSelect
            termType="delivery"
            value={deliveryTerms}
            onChange={setDeliveryTerms}
            placeholder="Select delivery terms"
          />
        </ErpFieldRow>
        <ErpFieldRow label="Grand Total (₹)" readOnly>
          <Input value={formatCrmCurrency(lineSummary.grandTotal)} readOnly className="erp-input" />
        </ErpFieldRow>
        <ErpFieldRow label="GST Amount" readOnly>
          <Input value={formatCrmCurrency(lineSummary.gstAmount)} readOnly className="erp-input" />
        </ErpFieldRow>
        <ErpFieldRow label="Probability" readOnly>
          <Input value={createMode === 'opportunity' ? `${probability}%` : '—'} readOnly className="erp-input" />
        </ErpFieldRow>
        <ErpFieldRow label="Weighted Value" readOnly>
          <Input value={createMode === 'opportunity' ? formatCrmCurrency(weighted) : '—'} readOnly className="erp-input" />
        </ErpFieldRow>
        <ErpFieldRow label="Customer" readOnly>
          <Input value={selectedCustomer?.customerName ?? '—'} readOnly className="erp-input" />
        </ErpFieldRow>
        <ErpFieldRow label="Billing city" readOnly>
          <Input value={selectedCustomer?.city ?? '—'} readOnly className="erp-input" />
        </ErpFieldRow>
      </ErpCardSection>

      <ErpCardSection
        id="quote-section-documents"
        title="Attachments & Review"
        subtitle="Optional supporting files — then create the quotation draft."
        icon={Paperclip}
        accent="slate"
        collapsible
        defaultOpen={attachments.length > 0}
      >
        <CrmTypedDocumentUpload
          attachments={attachments}
          onChange={setAttachments}
        />
      </ErpCardSection>
    </CrmCardFormShell>
  )
}
