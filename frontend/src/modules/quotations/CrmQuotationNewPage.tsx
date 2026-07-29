import { useMemo, useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Banknote,
  Building2,
  Check,
  ClipboardList,
  FileText,
  Handshake,
  Paperclip,
  PenLine,
} from 'lucide-react'
import { OpportunitySelectPicker } from '../../components/crm/OpportunitySelectPicker'
import { QuotationTemplateSelector } from '@/components/quotations/QuotationTemplateSelector'
import { QuotationLineItemsEditor } from '@/components/quotations/QuotationLineItemsEditor'
import {
  ErpCardSection,
  ErpFieldGroup,
  ErpFieldRow,
} from '../../components/erp/card-form'
import { FormActionBar } from '../../components/erp/FormActionBar'
import { Input, Select } from '../../components/forms/Inputs'
import { QuickCreateSelect } from '../../components/quick-create/QuickCreateSelect'
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
  sanitizeOpportunityScopeNotes,
} from '../../utils/leadRequirementLines'
import { LocationFieldRow } from '../../components/masters/LocationFieldRow'
import { CommercialTermSelect } from '../../components/masters/GeographySelects'
import { useDocumentLocation } from '../../hooks/useDocumentLocation'
import { useTenantProfileStore } from '../../store/tenantProfileStore'
import { CrmCardFormShell } from '@/components/crm/CrmCardFormShell'
import { crmChildBreadcrumbs } from '../../utils/crmNavigation'
import { CrmTypedDocumentUpload } from '../../components/crm/CrmTypedDocumentUpload'
import { useQuotationAttachmentStore } from '../../store/quotationAttachmentStore'
import type { CrmTypedAttachment } from '../../types/crmDocuments'
import { ENTERPRISE_FORM_CLASS } from '../../design-system/workspace'
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
import { resolveDefaultCommercialTerm, resolveDefaultDeliveryTime } from '../../utils/quotationTermUtils'
import { useDeliveryTimeOptions } from '../../hooks/useCrmMasters'
import { SELECT_PLACEHOLDER } from '../../components/forms/selectStandards'
import { cn } from '../../utils/cn'

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
  const updatePriceTable = useCrmStore((s) => s.updateQuotationDocumentPriceTable)
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
  const [validityPeriodDays, setValidityPeriodDays] = useState<number | 'custom'>(DEFAULT_VALIDITY_DAYS)
  const [validUntil, setValidUntil] = useState(() => addDays(todayIsoDate(), DEFAULT_VALIDITY_DAYS))
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
  const [deliveryTime, setDeliveryTime] = useState(() =>
    defaultOppId || prefillCustomerId ? resolveDefaultDeliveryTime() : '',
  )
  const deliveryTimeOptions = useDeliveryTimeOptions()
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [rowErrors, setRowErrors] = useState<Record<string, string[]>>({})
  const [forceOpenProductsKey, setForceOpenProductsKey] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [saveAttempted, setSaveAttempted] = useState(false)
  const [freightAmount, setFreightAmount] = useState(0)

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
    () =>
      customers.map((c) => ({
        id: c.id,
        label: `${c.customerCode} · ${c.customerName}${c.city ? ` · ${c.city}` : ''}`,
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
  const showLocationField = !useTenantProfileStore((s) => s.isServices())
  const selectedCustomer = effectiveCustomerId
    ? customers.find((c) => c.id === effectiveCustomerId)
    : undefined
  const selectedTemplate = templates.find((t) => t.id === templateId)

  const syncedLines = syncOpportunityLines(lines)
  const lineSummary = calcOpportunityLinesSummary(syncedLines)
  const probability = selectedOpp?.probability ?? 0
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
      deliveryTime,
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
        deliveryTime: 'Delivery time',
        lines: 'Line items',
      }
      const sectionByField: Record<string, string> = {
        opportunityId: 'quote-section-quick',
        customerId: 'quote-section-quick',
        templateId: 'quote-section-quick',
        validUntil: 'quote-section-commercial',
        paymentTerms: 'quote-section-commercial',
        deliveryTerms: 'quote-section-commercial',
        deliveryTime: 'quote-section-commercial',
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
      deliveryTime: deliveryTime.trim(),
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
    if (r.documentId && freightAmount > 0) {
      await resolveStoreAction(
        updatePriceTable(r.documentId, priceLines, {
          freightAmount,
          installationAmount: 0,
          customCharges: 0,
        }),
      )
    }
    notify.success('Quotation created successfully')

    if (mode === 'new') {
      setAttachments([])
      setLines([createEmptyOpportunityLine(1)])
      setScopeNotes('')
      setFreightAmount(0)
      setValidationErrors([])
      setRowErrors({})
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
    const mapped =
      sectionId === 'source' || sectionId === 'customer' || sectionId === 'template'
        ? 'quick'
        : sectionId
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
      deliveryTime,
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
      deliveryTime,
      attachments.length,
      errorSectionIds,
    ],
  )
  const completionPercent = computeQuotationFormCompletionPercent(completionItems)

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
      className={`${ENTERPRISE_FORM_CLASS} crm-lead-form-page crm-lead-form-page--zoho crm-quotation-form-page--zoho enterprise-workspace--crm-smart-overview crm-quote-create-page`}
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
      factBox={factBox}
      suppressFactBoxRecord
      hideRecordBar
      collapsibleFactBox
      factBoxLabel="Smart Context"
      onSubmit={handleSubmit}
      onSaveShortcut={() => createQuotation('editor')}
      onSaveCloseShortcut={() => createQuotation('close')}
      onSaveAndNewShortcut={() => createQuotation('new')}
      stickyFooter
      footer={(
        <FormActionBar
          sticky
          busy={isSubmitting}
          dirty={Boolean(customerId || opportunityId || hasValidLine)}
          onCancel={() => navigate('/crm/quotations')}
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
      <div className="erp-form-body crm-lead-form-body crm-quote-create-body">
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

      <div className="crm-lead-zoho-layout">
        <nav className="crm-lead-zoho-rail" aria-label="Quotation form sections">
          <p className="crm-lead-zoho-rail__eyebrow">Create Quotation</p>
          <p className="crm-lead-zoho-rail__title">Sections</p>
          <ul className="crm-lead-zoho-rail__list">
            {completionItems.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={cn('crm-lead-zoho-rail__item', item.done && 'is-done')}
                  onClick={() => scrollToSection(item.id)}
                >
                  <span className="crm-lead-zoho-rail__marker" aria-hidden>
                    {item.done ? <Check size={12} strokeWidth={2.5} /> : null}
                  </span>
                  <span className="crm-lead-zoho-rail__label">{item.label}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="crm-lead-zoho-rail__progress" aria-label={`${completionPercent}% complete`}>
            <div className="crm-lead-zoho-rail__progress-meta">
              <span>Completion</span>
              <strong>{completionPercent}%</strong>
            </div>
            <div className="crm-lead-zoho-rail__bar">
              <div className="crm-lead-zoho-rail__bar-fill" style={{ width: `${completionPercent}%` }} />
            </div>
          </div>
        </nav>

        <div className="crm-lead-form-flow crm-lead-zoho-canvas">
      <div id="quote-section-quick" className="crm-lead-quick-entry crm-lead-zoho-block">
      <ErpFieldGroup label="Quotation Information" columns={4} className="crm-lead-zoho-section">
        <ErpFieldRow label="Create path" colSpan={3} horizontal={false}>
          <div className="quote-create-path" role="group" aria-label="Create path">
            <div className="quote-create-path__segment">
              <button
                type="button"
                className={cn('quote-create-path__btn', createMode === 'opportunity' && 'is-active')}
                onClick={() => handleCreateModeChange('opportunity')}
              >
                <Handshake className="h-3.5 w-3.5" aria-hidden />
                Opportunity
              </button>
              <button
                type="button"
                className={cn('quote-create-path__btn', createMode === 'direct' && 'is-active')}
                onClick={() => handleCreateModeChange('direct')}
              >
                <PenLine className="h-3.5 w-3.5" aria-hidden />
                Direct
              </button>
            </div>
            {!skipModeChooser ? (
              <button type="button" className="quote-create-path__reset" onClick={reopenModeChooser}>
                Start over
              </button>
            ) : null}
          </div>
        </ErpFieldRow>

        {createMode === 'opportunity' ? (
          <ErpFieldRow label="Opportunity" required horizontal={false} className="crm-quotation-info__source" dataField="opportunityId">
            <OpportunitySelectPicker
              opportunities={openOpps}
              customers={customers}
              products={products}
              value={opportunityId}
              onChange={handleOpportunityChange}
            />
          </ErpFieldRow>
        ) : (
          <ErpFieldRow label="Customer" required horizontal={false} className="crm-quotation-info__source" dataField="customerId">
            <QuickCreateSelect
              entityType="customer"
              value={customerId}
              onChange={setCustomerId}
              options={customerOptions}
              placeholder="Search by code, name, or city…"
              allowEmpty
              emptyOptionLabel={SELECT_PLACEHOLDER}
            />
          </ErpFieldRow>
        )}

        <ErpFieldRow label="Template" required horizontal={false} className="crm-quotation-info__template" dataField="templateId">
          <QuotationTemplateSelector
            templates={templates}
            value={templateId}
            onChange={setTemplateId}
            variant="select"
            label=""
          />
        </ErpFieldRow>

        {(selectedOpp || selectedCustomer) ? (
          <div className="quote-create-context" role="status" aria-label="Selected record summary">
            {selectedOpp ? (
              <>
                <span className="quote-create-context__chip">
                  <span className="quote-create-context__k">Deal</span>
                  <span className="quote-create-context__v">{selectedOpp.opportunityNo}</span>
                </span>
                <span className="quote-create-context__chip">
                  <span className="quote-create-context__k">Stage</span>
                  <span className="quote-create-context__v">{opportunityStageLabel(selectedOpp.stage)}</span>
                </span>
                <span className="quote-create-context__chip">
                  <span className="quote-create-context__k">Owner</span>
                  <span className="quote-create-context__v">{selectedOpp.ownerName}</span>
                </span>
                <span className="quote-create-context__chip">
                  <span className="quote-create-context__k">Value</span>
                  <span className="quote-create-context__v tabular-nums">{formatCrmCurrency(selectedOpp.value)}</span>
                </span>
              </>
            ) : null}
            {selectedCustomer ? (
              <>
                <span className="quote-create-context__chip quote-create-context__chip--primary">
                  <span className="quote-create-context__k">Customer</span>
                  <span className="quote-create-context__v">
                    {selectedCustomer.customerName}
                    {selectedCustomer.customerCode ? ` · ${selectedCustomer.customerCode}` : ''}
                  </span>
                </span>
                {selectedCustomer.city ? (
                  <span className="quote-create-context__chip">
                    <span className="quote-create-context__k">City</span>
                    <span className="quote-create-context__v">{selectedCustomer.city}</span>
                  </span>
                ) : null}
                {selectedCustomer.gstin?.trim() ? (
                  <span className="quote-create-context__chip">
                    <span className="quote-create-context__k">GSTIN</span>
                    <span className="quote-create-context__v tabular-nums">{selectedCustomer.gstin}</span>
                  </span>
                ) : null}
              </>
            ) : null}
          </div>
        ) : (
          <p className="quote-create-context quote-create-context--hint">
            {createMode === 'opportunity'
              ? (prefillCustomerId && openOpps.length === 0
                ? 'No open opportunities for this customer — switch to Direct, or create a deal first.'
                : 'Select an opportunity to load the customer and product lines.')
              : 'Select a customer to continue.'}
          </p>
        )}
      </ErpFieldGroup>
      </div>

      {showLocationField ? (
        <div id="quote-section-location">
          <ErpCardSection
            title="Location"
            subtitle="Sales branch / location for this quotation."
            icon={Building2}
            accent="teal"
            columns={4}
            collapsible
            defaultOpen
          >
            <LocationFieldRow
              value={locationId}
              onChange={(locId) => setLocationId(locId)}
              usage="sales"
              label="Sales location"
              horizontal={false}
            />
          </ErpCardSection>
        </div>
      ) : null}

      <div id="quote-section-products">
      <ErpCardSection
        nbaTarget="products"
        forceOpenKey={forceOpenProductsKey || undefined}
        title="Product & Pricing"
        subtitle="Build line items, then review adjustments and the live order total."
        icon={ClipboardList}
        accent="blue"
        collapsible
        defaultOpen
        className="!max-w-none so-pricing-section quote-create-pricing"
        columns={1}
      >
        <div className="quote-create-pricing__panel">
          <div className="quote-create-pricing__lines">
            <QuotationLineItemsEditor
              priceLines={priceLines}
              freightAmount={freightAmount}
              onChange={(nextLines, extras) => {
                setLines(quotationPriceLinesToOpportunityLines(nextLines))
                setFreightAmount(extras.freightAmount)
              }}
              probability={probability}
              scopeNotes={scopeNotes}
              onScopeNotesChange={setScopeNotes}
              rowErrors={rowErrors}
            />
          </div>
        </div>
      </ErpCardSection>
      </div>

      <div id="quote-section-commercial">
      <ErpCardSection
        title="Commercial terms"
        subtitle="Validity, payment, and delivery."
        icon={Banknote}
        collapsible
        defaultOpen
        className="!max-w-none quote-create-commercial"
        columns={1}
      >
        <ErpFieldGroup label="Validity" columns={4}>
          <ErpFieldRow label="Quotation date" required>
            <Input
              type="date"
              value={quotationDate}
              onChange={(e) => handleQuotationDateChange(e.target.value)}
              className="erp-input"
            />
          </ErpFieldRow>
          <ErpFieldRow label="Validity period" required>
            <Select
              native
              value={validityPeriodDays === 'custom' ? 'custom' : String(validityPeriodDays)}
              onChange={(e) => handleValidityPeriodChange(e.target.value)}
              className="erp-input"
            >
              {VALIDITY_PERIOD_OPTIONS.map((d) => (
                <option key={d} value={d}>{d} days</option>
              ))}
              <option value="custom">Custom date</option>
            </Select>
          </ErpFieldRow>
          <ErpFieldRow
            label="Valid until"
            required
            dataField="validUntil"
            hint={
              validityPeriodDays === 'custom'
                ? 'Pick an expiry date'
                : `Quotation date + ${validityPeriodDays} days`
            }
          >
            <Input
              type="date"
              value={validUntil}
              onChange={(e) => handleValidUntilChange(e.target.value)}
              readOnly={validityPeriodDays !== 'custom'}
              className="erp-input"
            />
          </ErpFieldRow>
          <ErpFieldRow label="Currency" readOnly>
            <Input value="INR" readOnly className="erp-input" />
          </ErpFieldRow>
        </ErpFieldGroup>
        <ErpFieldGroup label="Commercial" columns={4}>
          <ErpFieldRow label="Payment terms" required dataField="paymentTerms">
            <CommercialTermSelect
              termType="payment"
              value={paymentTerms}
              onChange={setPaymentTerms}
              placeholder={SELECT_PLACEHOLDER}
            />
          </ErpFieldRow>
          <ErpFieldRow label="Delivery terms" required dataField="deliveryTerms">
            <CommercialTermSelect
              termType="delivery"
              value={deliveryTerms}
              onChange={setDeliveryTerms}
              placeholder={SELECT_PLACEHOLDER}
            />
          </ErpFieldRow>
          <ErpFieldRow label="Delivery time" required dataField="deliveryTime">
            <Select
              value={deliveryTime}
              onChange={(e) => setDeliveryTime(e.target.value)}
              error={saveAttempted && !deliveryTime.trim()}
            >
              <option value="">{SELECT_PLACEHOLDER}</option>
              {deliveryTimeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </Select>
          </ErpFieldRow>
          <ErpFieldRow label="Quoted total" readOnly>
            <Input value={formatCrmCurrency(lineSummary.grandTotal)} readOnly className="erp-input" />
          </ErpFieldRow>
        </ErpFieldGroup>
      </ErpCardSection>
      </div>

      <div id="quote-section-documents">
      <ErpCardSection
        title="Attachments"
        subtitle="Optional supporting files."
        icon={Paperclip}
        collapsible
        defaultOpen={attachments.length > 0}
      >
        <CrmTypedDocumentUpload
          attachments={attachments}
          onChange={setAttachments}
        />
      </ErpCardSection>
      </div>
        </div>
      </div>
      </div>
    </CrmCardFormShell>
  )
}
