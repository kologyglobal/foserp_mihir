import { useMemo, useState, useEffect } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Banknote,
  Bookmark,
  Building2,
  ClipboardList,
  ExternalLink,
  FileText,
  Handshake,
  MapPin,
  Paperclip,
  PenLine,
} from 'lucide-react'
import { DynamicsStatusChip } from '../../components/dynamics/DynamicsStatusChip'
import { OpportunitySelectPicker } from '../../components/crm/OpportunitySelectPicker'
import { QuotationTemplateSelector } from '@/components/quotations/QuotationTemplateSelector'
import { QuotationLineItemsEditor } from '@/components/quotations/QuotationLineItemsEditor'
import {
  ErpCardSection,
  ErpFieldGroup,
  ErpFieldRow,
  ErpQuickEntrySection,
  ErpStickySaveBar,
} from '../../components/erp/card-form'
import { ErpSmartSelect } from '../../components/erp/ErpSmartSelect'
import { Input, Select } from '../../components/forms/Inputs'
import { AppLink } from '../../components/ui/AppLink'
import { OperationalPageShell } from '../../components/design-system/OperationalPageShell'
import { QuotationCreateModeChooser } from '../../components/quotations/QuotationCreateModeChooser'
import { resolveStoreAction } from '../../store/storeAction'
import { useCrmStore } from '../../store/crmStore'
import { useMasterStore } from '../../store/masterStore'
import { findFeaturedQuotationTemplate } from '../../utils/quotationTemplates'
import { filterAllowedQuotationTemplates } from '../../utils/quotationEngine/builtinTemplateSync'
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
  opportunityLineUnitPriceFieldKey,
  UNIT_PRICE_REQUIRED_MESSAGE,
} from '../../utils/opportunityLineCalc'
import { handleInvalidSubmit, crmShowCompletenessHints } from '../../utils/formValidation'
import { validateQuotationCreate } from '../../utils/validation/crmSchemas/quotationSchema'
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
import { crmChildBreadcrumbs } from '../../utils/crmNavigation'
import { CrmTypedDocumentUpload } from '../../components/crm/CrmTypedDocumentUpload'
import { useQuotationAttachmentStore } from '../../store/quotationAttachmentStore'
import type { CrmTypedAttachment } from '../../types/crmDocuments'
import {
  ENTERPRISE_FORM_CLASS,
  EnterpriseFormMetrics,
  EnterpriseFormSectionNav,
} from '../../design-system/workspace'
import { CrmSmartOverviewPanel } from '@/components/crm/CrmSmartOverviewPanel'
import { resolveCompany360Path } from '../../config/entity360Routes'
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
  const { pathname } = useLocation()
  const [searchParams] = useSearchParams()
  const quotationTemplates = useCrmStore((s) => s.quotationTemplates)
  const templates = useMemo(
    () => filterAllowedQuotationTemplates(quotationTemplates),
    [quotationTemplates],
  )
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

  /** Prefill / deep-link skips the chooser; blank New Quotation starts with path selection. */
  const skipModeChooser = Boolean(prefillOppId || prefillCustomerId)

  const openOpps = useMemo(() => {
    const open = opportunities
      .filter((o) => o.status === 'open')
      .filter((o) => !prefillCustomerId || o.customerId === prefillCustomerId)
      .sort((a, b) => b.value - a.value)
    return open
  }, [opportunities, prefillCustomerId])

  const defaultOppId = prefillOppId && openOpps.some((o) => o.id === prefillOppId)
    ? prefillOppId
    : ''

  const featuredTemplate = findFeaturedQuotationTemplate(templates)

  const [createMode, setCreateMode] = useState<QuoteCreateMode>(initialMode)
  const [modeChosen, setModeChosen] = useState(skipModeChooser)
  const [activeSection, setActiveSection] = useState('quick')
  const [opportunityId, setOpportunityId] = useState(defaultOppId)
  const [customerId, setCustomerId] = useState(() => {
    if (prefillCustomerId) return prefillCustomerId
    if (defaultOppId) {
      return openOpps.find((o) => o.id === defaultOppId)?.customerId ?? ''
    }
    return ''
  })
  const [templateId, setTemplateId] = useState(featuredTemplate?.id ?? '')
  const [lines, setLines] = useState<OpportunityLine[]>(() => {
    if (!defaultOppId) return [createEmptyOpportunityLine(1)]
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
  const [paymentTerms, setPaymentTerms] = useState(() =>
    defaultOppId || prefillCustomerId
      ? resolveDefaultCommercialTerm('payment-terms').text
      : '',
  )
  const [deliveryTerms, setDeliveryTerms] = useState(() =>
    defaultOppId || prefillCustomerId
      ? resolveDefaultCommercialTerm('delivery-terms').text
      : '',
  )
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [rowErrors, setRowErrors] = useState<Record<string, string[]>>({})
  const [forceOpenProductsKey, setForceOpenProductsKey] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [saveAttempted, setSaveAttempted] = useState(false)

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
      const opp = nextOppId ? openOpps.find((o) => o.id === nextOppId) : undefined
      if (opp) {
        const product = opp.productId ? products.find((p) => p.id === opp.productId) : undefined
        setLines(linesFromOpportunity(opp, product))
        setScopeNotes(sanitizeOpportunityScopeNotes(opp.productRequirement))
        setCustomerId(opp.customerId)
        if (opp.locationId) setLocationId(opp.locationId)
      } else {
        setLines([createEmptyOpportunityLine(1)])
        setScopeNotes('')
        setCustomerId(prefillCustomerId)
      }
    } else {
      setOpportunityId('')
      setCustomerId(prefillCustomerId || customerId)
      setLines([createEmptyOpportunityLine(1)])
      setScopeNotes('')
    }
  }

  function chooseCreateMode(mode: QuoteCreateMode) {
    handleCreateModeChange(mode)
    setCreateMode(mode)
    setModeChosen(true)
    setActiveSection('quick')
  }

  function reopenModeChooser() {
    setModeChosen(false)
    setValidationErrors([])
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

  function validate() {
    return validateQuotationCreate({
      createMode,
      opportunityId,
      customerId: effectiveCustomerId || customerId,
      templateId,
      validUntil,
      paymentTerms,
      deliveryTerms,
      lines: syncedLines,
      ownerId: selectedOpp?.ownerId ?? '',
      stage: selectedOpp?.stage ?? 'new_lead',
      probability: String(probability),
    })
  }

  async function createQuotation(mode: 'editor' | 'close' | 'new') {
    const { fieldErrors, rowErrors: rErr, messages } = validate()
    setValidationErrors(messages)
    setRowErrors(rErr)
    if (messages.length || Object.keys(rErr).length) {
      const fieldMap = { ...fieldErrors }
      const lineKeys = Object.keys(fieldMap).filter(
        (k) => k.startsWith('unitPrice-') || k.startsWith('qty-') || k.startsWith('product-') || k.startsWith('taxPct-'),
      )
      if (!lineKeys.length && Object.keys(rErr).length) {
        const firstLineId = Object.keys(rErr)[0]!
        fieldMap[opportunityLineUnitPriceFieldKey(firstLineId)] = UNIT_PRICE_REQUIRED_MESSAGE
      }
      const keys = Object.keys(fieldMap)
      const fieldLabels: Record<string, string> = {
        opportunityId: 'Opportunity',
        customerId: 'Client / Company',
        templateId: 'Template',
        validUntil: 'Valid until',
        paymentTerms: 'Payment terms',
        deliveryTerms: 'Delivery terms',
        lines: 'Line items',
      }
      const sectionByField: Record<string, string> = {
        opportunityId: 'quote-section-quick',
        customerId: 'quote-section-quick',
        templateId: 'quote-section-quick',
        validUntil: 'quote-section-commercial',
        paymentTerms: 'quote-section-commercial',
        deliveryTerms: 'quote-section-commercial',
        lines: 'quote-section-products',
      }
      for (const key of keys) {
        if (key.startsWith('unitPrice-') || key.startsWith('qty-') || key.startsWith('product-') || key.startsWith('taxPct-')) {
          sectionByField[key] = 'quote-section-products'
          if (key.startsWith('unitPrice-')) fieldLabels[key] = 'Unit Price'
          else if (key.startsWith('qty-')) fieldLabels[key] = 'Quantity'
          else if (key.startsWith('product-')) fieldLabels[key] = 'Product / Item'
          else if (key.startsWith('taxPct-')) fieldLabels[key] = 'GST %'
          else fieldLabels[key] = 'Line item'
        } else if (key.startsWith('_msg_')) {
          fieldLabels[key] = 'Form'
        }
      }
      setSaveAttempted(true)
      handleInvalidSubmit({
        errors: Object.keys(fieldMap).length ? fieldMap : messages,
        fieldOrder: keys,
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
      const msg = r.error ?? 'Could not create quotation'
      setValidationErrors([msg])
      notify.error(msg)
      return
    }

    bindDraftAttachments(attachmentScopeId, r.quotationId)
    setQuotationAttachments(r.quotationId, attachments.map((a) => ({ ...a, quotationId: r.quotationId })))
    notify.success('Quotation created successfully')

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
    const mapped = sectionId === 'source' || sectionId === 'customer' ? 'quick' : sectionId
    setActiveSection(mapped)
    document.getElementById(`quote-section-${mapped}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
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

  const sectionNavItems = useMemo(() => {
    const sourceStatus = completionItems.find((i) => i.id === 'source')?.status
    const customerStatus = completionItems.find((i) => i.id === 'customer')?.status
    const quickStatus =
      sourceStatus === 'error' || customerStatus === 'error'
        ? 'error' as const
        : sourceStatus === 'complete' && customerStatus === 'complete'
          ? 'complete' as const
          : sourceStatus === 'in_progress' || customerStatus === 'in_progress'
            ? 'in_progress' as const
            : 'required' as const
    return [
      {
        id: 'quick',
        label: 'Quick',
        icon: createMode === 'opportunity' ? Handshake : Building2,
        status: quickStatus,
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
    ]
  }, [completionItems, createMode])

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
      showGapSignals={crmShowCompletenessHints({
        dirty: Boolean(customerId || opportunityId || syncedLines.some((l) => l.productOrItem?.trim())),
        saveAttempted,
      })}
      nextAction={nextAction}
      onNextAction={() => {
        scrollToSection(nextAction.sectionId ?? 'source')
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

  if (!modeChosen) {
    return (
      <OperationalPageShell
        title="New Quotation"
        badge="CRM"
        variant="dynamics"
        favoritePath="/crm/quotations/new"
        breadcrumbs={crmChildBreadcrumbs('Quotations', '/crm/quotations', 'New Quotation')}
      >
        <QuotationCreateModeChooser
          onSelect={chooseCreateMode}
          onCancel={() => navigate('/crm/quotations')}
        />
      </OperationalPageShell>
    )
  }

  return (
    <CrmCardFormShell
      title="New Quotation"
      badge="CRM"
      className={`${ENTERPRISE_FORM_CLASS} enterprise-workspace--crm-smart-overview crm-quote-create-page`}
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
      factBox={factBox}
      suppressFactBoxRecord
      collapsibleFactBox
      factBoxLabel="Smart Context"
      onSubmit={handleSubmit}
      onSaveShortcut={() => createQuotation('editor')}
      onSaveCloseShortcut={() => createQuotation('close')}
      onSaveAndNewShortcut={() => createQuotation('new')}
      stickyFooter
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
              {completionPercent}% complete · {formatCrmCurrency(lineSummary.grandTotal)} grand total
              {validUntil ? ` · Valid until ${formatDate(validUntil)}` : ''}
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

      <div className="erp-form-body crm-quote-create-body">
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

      <ErpQuickEntrySection
        id="quote-section-quick"
        title="Quick Entry"
        subtitle="Create path, customer, and fulfilment location."
        icon={createMode === 'opportunity' ? Handshake : Building2}
        collapsible
        defaultOpen
        columns={1}
        className="!max-w-none"
        collapsedSummary={
          selectedCustomer
            ? `${createMode === 'opportunity' ? 'From opportunity' : 'Direct'} · ${selectedCustomer.customerName}`
            : createMode === 'opportunity'
              ? 'From opportunity · select a deal'
              : 'Direct quote · select a client'
        }
      >
        <div className="so-create-path-chip" role="status">
          <span className="so-create-path-chip__mode" aria-hidden>
            {createMode === 'opportunity' ? <Handshake className="h-3.5 w-3.5" /> : <PenLine className="h-3.5 w-3.5" />}
          </span>
          <span className="so-create-path-chip__label">Creating</span>
          <span className="so-create-path-chip__value">
            {createMode === 'opportunity' ? 'From opportunity' : 'Direct quotation'}
          </span>
          {!skipModeChooser ? (
            <button type="button" className="so-create-path-chip__change" onClick={reopenModeChooser}>
              Change path
            </button>
          ) : null}
        </div>

        <ErpFieldGroup
          label={createMode === 'direct' ? 'Client' : undefined}
          className="so-qe-customer-group"
        >
          {createMode === 'opportunity' ? (
            <>
              <ErpFieldRow label="Opportunity" required colSpan={3}>
                <OpportunitySelectPicker
                  opportunities={openOpps}
                  customers={customers}
                  products={products}
                  value={opportunityId}
                  onChange={handleOpportunityChange}
                />
              </ErpFieldRow>
              {selectedOpp ? (
                <aside className="crm-so-handover" aria-label="Linked opportunity">
                  <div className="crm-quotation-new__opp-summary">
                    <div>
                      <p className="crm-quotation-new__opp-label">Deal no.</p>
                      <p className="crm-quotation-new__opp-value">{selectedOpp.opportunityNo}</p>
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
                </aside>
              ) : (
                <p className="text-sm text-erp-muted">
                  {prefillCustomerId && openOpps.length === 0
                    ? 'No open opportunities for this customer — change path to Direct, or create a deal from the pipeline.'
                    : 'Select an open opportunity to load the customer and product lines.'}
                </p>
              )}
            </>
          ) : null}
        </ErpFieldGroup>

        <ErpFieldGroup label="Bill-to customer" className="so-qe-customer-group">
          {createMode === 'direct' ? (
            <ErpFieldRow label="Client / Company" required colSpan={3} dataField="customerId" hint="Required for a direct quotation">
              <ErpSmartSelect
                options={customerOptions}
                value={customerId}
                onChange={(v) => setCustomerId(v)}
                placeholder="Search customer code, name, or city…"
                appearance="dropdown"
              />
            </ErpFieldRow>
          ) : null}

          {selectedCustomer ? (
            <aside className="so-customer-card" aria-label="Selected customer">
              <div className="so-customer-card__header">
                <div className="so-customer-card__avatar" aria-hidden>
                  {selectedCustomer.customerName
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((w) => w[0])
                    .join('')
                    .toUpperCase()}
                </div>
                <div className="so-customer-card__identity">
                  <div className="so-customer-card__title-row">
                    <h3 className="so-customer-card__name">{selectedCustomer.customerName}</h3>
                    <span className="so-customer-card__code">{selectedCustomer.customerCode}</span>
                  </div>
                  <p className="so-customer-card__location">
                    <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span>
                      {[selectedCustomer.city, selectedCustomer.state, selectedCustomer.pincode]
                        .filter(Boolean)
                        .join(', ') || 'Location not set'}
                    </span>
                  </p>
                </div>
                <AppLink
                  to={resolveCompany360Path(selectedCustomer.id, pathname)}
                  className="so-customer-card__360"
                >
                  View 360
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                </AppLink>
              </div>
              <dl className="so-customer-card__facts">
                <div className="so-customer-card__fact">
                  <dt>GSTIN</dt>
                  <dd className="tabular-nums">{selectedCustomer.gstin?.trim() || '—'}</dd>
                </div>
                <div className="so-customer-card__fact">
                  <dt>Credit days</dt>
                  <dd className="tabular-nums">{selectedCustomer.creditDays} days</dd>
                </div>
                <div className="so-customer-card__fact">
                  <dt>Credit limit</dt>
                  <dd className="tabular-nums">
                    {selectedCustomer.creditLimit != null && selectedCustomer.creditLimit > 0
                      ? formatCrmCurrency(selectedCustomer.creditLimit)
                      : 'No limit'}
                  </dd>
                </div>
                {selectedCustomer.contactPerson ? (
                  <div className="so-customer-card__fact so-customer-card__fact--wide">
                    <dt>Primary contact</dt>
                    <dd>
                      {selectedCustomer.contactPerson}
                      {selectedCustomer.contactPhone ? (
                        <span className="so-customer-card__contact-meta"> · {selectedCustomer.contactPhone}</span>
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
                  {createMode === 'opportunity'
                    ? 'Link an opportunity to load the bill-to company, GSTIN, and credit terms.'
                    : 'Search and select a client to load GSTIN, credit terms, and contact details.'}
                </p>
              </div>
            </div>
          )}
        </ErpFieldGroup>

        <ErpFieldGroup label="Fulfilment" className="so-qe-po-group">
          <LocationFieldRow
            value={locationId}
            onChange={(locId) => setLocationId(locId)}
            usage="sales"
            colSpan={3}
            label="Sales location"
            hint="Where goods will ship from — inherited from the opportunity when available"
          />
        </ErpFieldGroup>
      </ErpQuickEntrySection>

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
        nbaTarget="products"
        forceOpenKey={forceOpenProductsKey || undefined}
        title="Product & Pricing"
        subtitle="Build line items, then review the live quotation total."
        icon={ClipboardList}
        accent="violet"
        collapsible
        defaultOpen
        className="!max-w-none so-pricing-section"
        columns={1}
      >
        <div className="so-pricing-panel so-pricing-panel--pro">
          <div className="so-pricing-table-wrap quote-pricing-lines">
            <QuotationLineItemsEditor
              priceLines={priceLines}
              onChange={(nextLines) => setLines(quotationPriceLinesToOpportunityLines(nextLines))}
              probability={probability}
              scopeNotes={scopeNotes}
              onScopeNotesChange={setScopeNotes}
              rowErrors={rowErrors}
            />
          </div>
          <div className="so-pricing-totals quote-pricing-totals">
            <div className="quote-pricing-totals__spacer" aria-hidden />
            <aside className="so-pricing-summary" aria-label="Quotation totals">
              <p className="so-pricing-summary__title">Quote summary</p>
              <div className="so-pricing-summary__rows">
                <div className="so-pricing-summary__row">
                  <span>Lines</span>
                  <span className="tabular-nums">{syncedLines.length}</span>
                </div>
                <div className="so-pricing-summary__row">
                  <span>Taxable</span>
                  <span className="tabular-nums">{formatCrmCurrency(lineSummary.taxableAmount)}</span>
                </div>
                <div className="so-pricing-summary__row">
                  <span>GST</span>
                  <span className="tabular-nums">{formatCrmCurrency(lineSummary.gstAmount)}</span>
                </div>
                {createMode === 'opportunity' ? (
                  <div className="so-pricing-summary__row">
                    <span>Weighted ({probability}%)</span>
                    <span className="tabular-nums">{formatCrmCurrency(weighted)}</span>
                  </div>
                ) : null}
              </div>
              <div className="so-pricing-summary__grand">
                <span>Grand total</span>
                <strong className="tabular-nums">{formatCrmCurrency(lineSummary.grandTotal)}</strong>
              </div>
            </aside>
          </div>
        </div>
      </ErpCardSection>

      <ErpCardSection
        id="quote-section-commercial"
        title="Commercial & Validity"
        subtitle="Validity window, payment and delivery terms."
        icon={Banknote}
        accent="green"
        collapsible
        defaultOpen
        className="!max-w-none so-commercial-section"
        columns={1}
      >
        <div className="so-commercial-body">
          <ErpFieldGroup label="Validity" className="so-commercial-group" columns={3}>
            <ErpFieldRow label="Quotation date" required hint="Issue date used to derive validity period">
              <Input
                type="date"
                value={quotationDate}
                onChange={(e) => handleQuotationDateChange(e.target.value)}
                className="erp-input"
              />
            </ErpFieldRow>
            <ErpFieldRow label="Valid until" required dataField="validUntil" hint="Critical — quotation expires after this date">
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
          </ErpFieldGroup>

          <ErpFieldGroup label="Commercial terms" className="so-commercial-group" columns={2}>
            <ErpFieldRow label="Payment terms" required dataField="paymentTerms">
              <CommercialTermSelect
                termType="payment"
                value={paymentTerms}
                onChange={setPaymentTerms}
                placeholder="Select payment terms"
              />
            </ErpFieldRow>
            <ErpFieldRow label="Delivery timeline" required dataField="deliveryTerms" hint="Delivery terms / lead-time commitment">
              <CommercialTermSelect
                termType="delivery"
                value={deliveryTerms}
                onChange={setDeliveryTerms}
                placeholder="Select delivery terms"
              />
            </ErpFieldRow>
          </ErpFieldGroup>
        </div>
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
      </div>
    </CrmCardFormShell>
  )
}
