import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Banknote,
  Building2,
  FileText,
  Paperclip,
} from 'lucide-react'
import { ErpCardSection, ErpFieldRow, ErpStickySaveBar, ErpQuickEntrySection, ErpViewField } from '../../components/erp/card-form'
import { ErpProductPricingSection } from '../../components/erp/ErpProductPricingSection'
import { CrmTypedDocumentUpload } from '../../components/crm/CrmTypedDocumentUpload'
import { Input, Select, Textarea } from '../../components/forms/Inputs'
import { SELECT_PLACEHOLDER } from '../../components/forms/selectStandards'
import { QuickCreateSelect } from '../../components/quick-create/QuickCreateSelect'
import { useCrmStore } from '../../store/crmStore'
import { resolveStoreAction } from '../../store/storeAction'
import { notify } from '../../store/toastStore'
import { useMasterStore } from '../../store/masterStore'
import { useSalesStore } from '../../store/salesStore'
import { useOpportunityAttachmentStore } from '../../store/opportunityAttachmentStore'
import type { CrmTypedAttachment } from '../../types/crmDocuments'
import { getSessionUser } from '../../utils/permissions'
import { formatCrmCurrency } from '../../utils/crmMetrics'
import { formatDate } from '../../utils/dates/format'
import type { OpportunityLine, OpportunityPriority, OpportunityStage } from '../../types/crm'
import { useCrmOwnerOptions, useOpportunityPriorityOptions, useResolvedOpportunityStages } from '../../hooks/useCrmMasters'
import {
  getStageProbability,
  opportunityPriorityLabel,
  opportunityStageLabel,
  resolveOpportunityPriorityOptions,
  buildHubSpotStyleOpportunityName,
} from '../../utils/opportunityUtils'
import {
  calcOpportunityLinesSummary,
  calcWeightedValue,
  createEmptyOpportunityLine,
  opportunityLineUnitPriceFieldKey,
  syncOpportunityLines,
  UNIT_PRICE_REQUIRED_MESSAGE,
} from '../../utils/opportunityLineCalc'
import {
  getCrmDateInputMax,
  getDateInputMin,
} from '../../utils/validation/crmDatePolicy'
import {
  fieldErrorsToMessages,
  handleInvalidSubmit,
  crmShowCompletenessHints,
  type FieldErrorMap,
} from '../../utils/formValidation'
import { useInlineFormValidation } from '../../hooks/useInlineFormValidation'
import { validateOpportunityForm } from '../../utils/validation/crmSchemas/opportunitySchema'
import { decodeLeadRequirementLines, isEncodedLeadRequirementPayload, sanitizeOpportunityScopeNotes } from '../../utils/leadRequirementLines'
import { resolveLeadConvertActionGate } from '../../utils/leadUtils'
import { canCrmPermission } from '../../utils/permissions/crm'
import { useProductMasterOptionMap } from '../../utils/opportunityProductOptions'
import { LocationFieldRow } from '../../components/masters/LocationFieldRow'
import { useDocumentLocation } from '../../hooks/useDocumentLocation'
import { CrmCardFormShell } from '@/components/crm/CrmCardFormShell'
import { CrmSmartOverviewPanel } from '@/components/crm/CrmSmartOverviewPanel'
import { crmChildBreadcrumbs } from '../../utils/crmNavigation'
import {
  ENTERPRISE_FORM_CLASS,
} from '../../design-system/workspace'
import {
  buildOpportunityAiInsight,
  buildOpportunityKeyDetails,
  buildOpportunitySmartSignals,
  computeOpportunityCompleteness,
  opportunityOverviewChips,
  opportunityOverviewTitle,
  resolveOpportunityNextBestAction,
} from '../../utils/opportunitySmartOverview'

function defaultCloseDate() {
  const d = new Date()
  d.setDate(d.getDate() + 30)
  return d.toISOString().slice(0, 10)
}

function initialLinesFromLead(requirement?: string, remarks?: string | null): OpportunityLine[] {
  return decodeLeadRequirementLines(requirement ?? '', null, remarks).lines
}

function initialScopeNotesFromLead(requirement?: string, remarks?: string | null): string {
  // Encoded product lines or notes duplicated into productRequirement must not fill Scope Notes.
  if (isEncodedLeadRequirementPayload(requirement)) return ''
  const raw = String(requirement ?? '').trim()
  const notes = String(remarks ?? '').trim()
  if (notes && raw === notes) return ''
  return sanitizeOpportunityScopeNotes(requirement)
}

const OPP_FIELD_ORDER = ['customerId', 'opportunityName', 'expectedCloseDate', 'ownerId', 'stage', 'probability'] as const
const OPP_FIELD_LABELS: Record<string, string> = {
  customerId: 'Customer',
  opportunityName: 'Opportunity Name',
  expectedCloseDate: 'Expected Close Date',
  ownerId: 'Owner',
  stage: 'Stage',
  probability: 'Probability',
}
const OPP_SECTION_BY_FIELD: Record<string, string> = {
  customerId: 'opp-section-quick',
  opportunityName: 'opp-section-quick',
  expectedCloseDate: 'opp-section-quick',
  ownerId: 'opp-section-quick',
  stage: 'opp-section-quick',
  probability: 'opp-section-commercial',
}

export function OpportunityNewPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const prefillCustomerId = searchParams.get('customerId') ?? ''
  const prefillLeadId = searchParams.get('leadId') ?? ''

  const user = getSessionUser()
  const createOpportunity = useCrmStore((s) => s.createOpportunity)
  const contacts = useCrmStore((s) => s.contacts)
  const customers = useMasterStore((s) => s.customers)
  const products = useMasterStore((s) => s.products)
  const items = useMasterStore((s) => s.items)
  const uoms = useMasterStore((s) => s.uoms)
  const lead = useSalesStore((s) => (prefillLeadId ? s.getLead(prefillLeadId) : undefined))

  const ownerOptions = useCrmOwnerOptions()
  const priorityOptions = useOpportunityPriorityOptions()
  const stageOptions = useResolvedOpportunityStages()
  const resolvedPriorities = useMemo(
    () => (priorityOptions.length > 0 ? priorityOptions : resolveOpportunityPriorityOptions().map((p) => ({ value: p.value, label: p.label }))),
    [priorityOptions],
  )

  const initialCustomerId = prefillCustomerId || lead?.customerId || ''
  const initialOwnerId = lead?.leadOwnerId ?? ownerOptions[0]?.value ?? user.id
  const initialPriority = (lead?.priority ?? resolvedPriorities[0]?.value ?? 'medium') as OpportunityPriority
  const initialStage: OpportunityStage = 'new_lead'
  const initialProbability = String(getStageProbability(initialStage) || 30)

  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [rowErrors, setRowErrors] = useState<Record<string, string[]>>({})
  const [forceOpenProductsKey, setForceOpenProductsKey] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [saveAttempted, setSaveAttempted] = useState(false)

  const [customerId, setCustomerId] = useState(initialCustomerId)
  const [contactId, setContactId] = useState(() => lead?.contactId ?? '')
  const [opportunityName, setOpportunityName] = useState('')
  const [nameManuallyEdited, setNameManuallyEdited] = useState(false)
  const [productRequirement, setProductRequirement] = useState(() =>
    initialScopeNotesFromLead(lead?.productRequirement, lead?.remarks),
  )
  const [lines, setLines] = useState<OpportunityLine[]>(() =>
    initialLinesFromLead(lead?.productRequirement, lead?.remarks),
  )
  const retainProductIds = useMemo(() => lines.map((l) => l.productId), [lines])
  const { options: productOptions, pickMap } = useProductMasterOptionMap(
    products,
    items,
    uoms,
    undefined,
    retainProductIds,
  )
  const [probability, setProbability] = useState(initialProbability)
  const [expectedCloseDate, setExpectedCloseDate] = useState(lead?.expectedCloseDate?.slice(0, 10) || defaultCloseDate())
  const [stage, setStage] = useState<OpportunityStage>(initialStage)
  const [ownerId, setOwnerId] = useState(initialOwnerId)
  const [priority, setPriority] = useState<OpportunityPriority>(initialPriority)
  const { locationId, setLocationId } = useDocumentLocation('sales', lead?.locationId)

  const attachmentScopeId = 'draft:new-opp'
  const setOpportunityAttachments = useOpportunityAttachmentStore((s) => s.setForOpportunity)
  const bindDraftAttachments = useOpportunityAttachmentStore((s) => s.bindDraftToOpportunity)
  const [attachments, setAttachmentsState] = useState<CrmTypedAttachment[]>(() =>
    useOpportunityAttachmentStore.getState().getForOpportunity(attachmentScopeId),
  )

  const inline = useInlineFormValidation(
    {
      customerId,
      opportunityName,
      expectedCloseDate,
      ownerId,
    },
    {
      customerId: { required: true, message: 'Customer is required' },
      opportunityName: { required: true, message: 'Opportunity Name is required' },
      expectedCloseDate: { required: true, message: 'Expected Close Date is required' },
      ownerId: { required: true, message: 'Owner is required' },
    },
  )

  const customerOptions = useMemo(
    () =>
      customers
        .filter((c) => c.isActive)
        .map((c) => ({
          id: c.id,
          label: `${c.customerName}${c.city ? ` · ${c.city}` : ''}`,
        })),
    [customers],
  )
  const customer = customers.find((c) => c.id === customerId)
  const customerContacts = contacts.filter((c) => c.customerId === customerId)
  const primaryProductName = useMemo(() => {
    const synced = syncOpportunityLines(lines)
    const first = synced.find((l) => l.productOrItem?.trim())
    return first?.productOrItem?.trim() || ''
  }, [lines])
  const contactName = customerContacts.find((c) => c.id === contactId)?.name

  const autoNameParts = useMemo(
    () => ({
      companyName: customer?.customerName,
      prospectName: lead?.prospectName,
      productName: primaryProductName || undefined,
      contactName,
    }),
    [customer?.customerName, lead?.prospectName, primaryProductName, contactName],
  )

  // HubSpot-style: keep name in sync until the user edits it
  useEffect(() => {
    if (nameManuallyEdited) return
    const next = buildHubSpotStyleOpportunityName(autoNameParts)
    if (!next) return
    setOpportunityName((prev) => (prev === next ? prev : next))
  }, [autoNameParts, nameManuallyEdited])

  useEffect(() => {
    if (!prefillLeadId || !lead) return
    const gate = resolveLeadConvertActionGate(lead, canCrmPermission('crm.lead.convert'))
    if (!gate.ok) {
      setValidationErrors((prev) => (prev.includes(gate.reason) ? prev : [gate.reason, ...prev]))
    }
  }, [prefillLeadId, lead])

  // Keep owner on a valid option once owners hydrate (API session / masters)
  useEffect(() => {
    if (ownerOptions.length === 0) {
      if (user.id && ownerId !== user.id) setOwnerId(user.id)
      return
    }
    const valid = ownerOptions.some((o) => o.value === ownerId)
    if (!valid) setOwnerId(ownerOptions[0]!.value)
  }, [ownerOptions, ownerId, user.id])

  // Default Contact when Customer changes: keep valid selection, else lead match → primary → first
  useEffect(() => {
    if (!customerId) {
      setContactId((prev) => (prev ? '' : prev))
      return
    }
    const list = contacts.filter((c) => c.customerId === customerId)
    setContactId((prev) => {
      if (prev && list.some((c) => c.id === prev)) return prev
      if (prefillLeadId && lead?.contactId && list.some((c) => c.id === lead.contactId)) {
        return lead.contactId
      }
      const byName =
        prefillLeadId && lead?.contactPerson
          ? list.find((c) => c.name.trim().toLowerCase() === lead.contactPerson!.trim().toLowerCase())
          : undefined
      const next = byName ?? list.find((c) => c.isPrimary) ?? list[0]
      return next?.id ?? ''
    })
  }, [customerId, contacts, prefillLeadId, lead?.contactId, lead?.contactPerson])

  useEffect(() => {
    setAttachmentsState(useOpportunityAttachmentStore.getState().getForOpportunity(attachmentScopeId))
  }, [attachmentScopeId])

  function setAttachments(next: CrmTypedAttachment[]) {
    setAttachmentsState(next)
    setOpportunityAttachments(attachmentScopeId, next)
  }

  const owner = ownerOptions.find((o) => o.value === ownerId) ?? { value: user.id, label: user.name }
  const summary = calcOpportunityLinesSummary(syncOpportunityLines(lines))
  const dealValue = summary.grandTotal
  const weighted = calcWeightedValue(dealValue, Number(probability) || 0)

  function handleOpportunityNameChange(value: string) {
    setOpportunityName(value)
    if (!value.trim()) {
      setNameManuallyEdited(false)
      return
    }
    const nextAuto = buildHubSpotStyleOpportunityName(autoNameParts)
    setNameManuallyEdited(value.trim() !== nextAuto)
  }

  function runValidation() {
    return validateOpportunityForm({
      customerId,
      opportunityName,
      ownerId,
      stage,
      probability,
      expectedCloseDate,
      lines,
    })
  }

  /** Blank create form — no lead/customer prefill left over after Save & New. */
  function resetForm() {
    setCustomerId('')
    setContactId('')
    setOpportunityName('')
    setNameManuallyEdited(false)
    setProductRequirement('')
    setLines([createEmptyOpportunityLine(1)])
    setProbability(String(getStageProbability('new_lead') || 30))
    setExpectedCloseDate(defaultCloseDate())
    setStage('new_lead')
    setOwnerId(ownerOptions[0]?.value ?? user.id)
    setPriority((resolvedPriorities[0]?.value ?? 'medium') as OpportunityPriority)
    setAttachments([])
    setOpportunityAttachments(attachmentScopeId, [])
    setValidationErrors([])
    setRowErrors({})
    setSaveAttempted(false)
  }

  function handleCancel() {
    setOpportunityAttachments(attachmentScopeId, [])
    navigate('/crm/opportunities')
  }

  const leadConvertGate = !prefillLeadId
    ? ({ ok: true } as const)
    : !lead
      ? ({ ok: false, reason: 'Lead not found' } as const)
      : resolveLeadConvertActionGate(lead, canCrmPermission('crm.lead.convert'))

  function createDeal(mode: 'open' | 'close' | 'new' | 'quotation') {
    inline.touchAll()
    const { fieldErrors, rowErrors: rErr } = runValidation()
    const leadErrors = prefillLeadId && !leadConvertGate.ok ? [leadConvertGate.reason] : []
    const merged: FieldErrorMap = { ...fieldErrors }
    leadErrors.forEach((msg, i) => { merged[`_lead_${i}`] = msg })
    setRowErrors(rErr)
    if (Object.keys(merged).length || Object.keys(rErr).length) {
      const fieldMap = merged
      const lineKeys = Object.keys(fieldMap).filter(
        (k) => k.startsWith('unitPrice-') || k.startsWith('qty-') || k.startsWith('product-') || k.startsWith('taxPct-'),
      )
      const fieldOrder = [...OPP_FIELD_ORDER, ...lineKeys]
      const fieldLabels: Record<string, string> = { ...OPP_FIELD_LABELS }
      const sectionByField: Record<string, string> = {
        ...OPP_SECTION_BY_FIELD,
        ...Object.fromEntries(lineKeys.map((k) => [k, 'opp-section-products'])),
      }
      for (const key of lineKeys) {
        if (key.startsWith('unitPrice-')) fieldLabels[key] = 'Unit Price'
        else if (key.startsWith('qty-')) fieldLabels[key] = 'Quantity'
        else if (key.startsWith('product-')) fieldLabels[key] = 'Product / Item'
        else if (key.startsWith('taxPct-')) fieldLabels[key] = 'GST %'
      }
      if (!lineKeys.length && Object.keys(rErr).length) {
        const firstLineId = Object.keys(rErr)[0]!
        const key = opportunityLineUnitPriceFieldKey(firstLineId)
        fieldMap[key] = UNIT_PRICE_REQUIRED_MESSAGE
        fieldOrder.push(key)
        fieldLabels[key] = 'Unit Price'
        sectionByField[key] = 'opp-section-products'
      }
      setSaveAttempted(true)
      handleInvalidSubmit({
        errors: fieldMap,
        fieldOrder,
        fieldLabels,
        sectionByField,
        expandSection: (sectionId) => {
          if (sectionId === 'opp-section-products') {
            setForceOpenProductsKey((k) => k + 1)
          }
        },
        onFieldErrors: (map) => setValidationErrors(fieldErrorsToMessages(map, fieldOrder)),
        delayMs: 120,
      })
      return
    }
    setValidationErrors([])
    if (isSubmitting) return

    setIsSubmitting(true)
    void (async () => {
      try {
        const syncedLines = syncOpportunityLines(lines)
        const primaryProductId = syncedLines[0]?.productId ?? null
        const r = await resolveStoreAction(
          createOpportunity({
            customerId,
            contactId: contactId || null,
            productId: primaryProductId,
            opportunityName: opportunityName.trim(),
            productRequirement: sanitizeOpportunityScopeNotes(productRequirement)
              || syncedLines.map((l) => l.productOrItem).filter(Boolean).join('; ')
              || opportunityName.trim(),
            lines: syncedLines,
            stage,
            value: summary.grandTotal,
            probability: Number(probability) || 0,
            expectedCloseDate,
            ownerId: owner.value,
            ownerName: owner.label,
            priority,
            status: 'open',
            lostReason: null,
            leadId: prefillLeadId || null,
            inquiryId: null,
            quotationId: null,
            salesOrderId: null,
            nextFollowUpDate: null,
            locationId: locationId || null,
          }),
        )

        if (!r.ok || !r.opportunityId) {
          setValidationErrors([r.error ?? 'Could not create opportunity'])
          notify.error(r.error ?? 'Could not create opportunity')
          return
        }

        bindDraftAttachments(attachmentScopeId, r.opportunityId)
        setOpportunityAttachments(r.opportunityId, attachments.map((a) => ({ ...a, opportunityId: r.opportunityId })))
        notify.success('Opportunity created successfully')

        if (mode === 'quotation') {
          navigate(`/crm/quotations/new?opportunityId=${r.opportunityId}`)
          return
        }
        if (mode === 'new') {
          resetForm()
          // Drop lead/customer query so the next entry stays blank
          if (searchParams.toString()) {
            navigate('/crm/opportunities/new', { replace: true })
          }
          return
        }
        // Save / Save & Close → opportunities register
        setOpportunityAttachments(attachmentScopeId, [])
        navigate('/crm/opportunities')
      } finally {
        setIsSubmitting(false)
      }
    })()
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    createDeal('open')
  }

  function handleStageChange(next: OpportunityStage) {
    setStage(next)
    const prob = getStageProbability(next)
    if (prob != null && prob > 0) setProbability(String(prob))
  }

  const hasValidLine = lines.some((l) => l.productOrItem?.trim())
  const completionItems = useMemo(() => [
    { id: 'quick', label: 'Quick Entry', done: Boolean(customerId && opportunityName.trim()) },
    { id: 'products', label: 'Products', done: hasValidLine },
    { id: 'commercial', label: 'Commercial', done: dealValue > 0 && Boolean(expectedCloseDate) },
    { id: 'documents', label: 'Attachments', done: attachments.length > 0 },
  ], [customerId, opportunityName, hasValidLine, dealValue, expectedCloseDate, attachments.length])

  const completionPercent = Math.round((completionItems.filter((i) => i.done).length / completionItems.length) * 100)

  function scrollToSection(sectionId: string) {
    const id = sectionId === 'general' ? 'opp-section-quick' : `opp-section-${sectionId}`
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const documentStrip = [
    { label: 'Opportunity No.', value: 'Auto on save', highlight: false },
    { label: 'Status', value: 'Open' },
    { label: 'Stage', value: opportunityStageLabel(stage) },
    { label: 'Owner', value: owner.label },
    { label: 'Customer', value: customer?.customerName ?? '—', highlight: Boolean(customerId) },
    { label: 'Priority', value: opportunityPriorityLabel(priority) },
    { label: 'Deal Value', value: formatCrmCurrency(dealValue), highlight: dealValue > 0 },
    { label: 'Source Lead', value: lead?.leadNo ?? '—', highlight: Boolean(lead) },
  ]

  const smartOverviewInput = useMemo(() => ({
    opportunityName,
    customerName: customer?.customerName ?? '',
    customerId,
    stage,
    priority,
    ownerName: owner.label,
    dealValue,
    weightedValue: weighted,
    lineCount: lines.length,
    hasValidLine,
    expectedCloseDate,
    isOpen: true,
  }), [opportunityName, customer?.customerName, customerId, stage, priority, owner.label, dealValue, weighted, lines.length, hasValidLine, expectedCloseDate])

  const nextAction = resolveOpportunityNextBestAction(smartOverviewInput)

  const factBox = (
    <CrmSmartOverviewPanel
      ariaLabel="Smart opportunity overview"
      title={opportunityOverviewTitle(smartOverviewInput)}
      chips={opportunityOverviewChips(smartOverviewInput)}
      meta={[`Stage: ${opportunityStageLabel(stage)}`, `Owner: ${owner.label}`]}
      progressLabel="Deal readiness"
      progressPercent={computeOpportunityCompleteness(smartOverviewInput)}
      signals={buildOpportunitySmartSignals(smartOverviewInput)}
      showGapSignals={crmShowCompletenessHints({
        dirty: Boolean(customerId || opportunityName.trim() || lines.some((l) => l.productOrItem?.trim())),
        saveAttempted,
      })}
      nextAction={nextAction}
      onNextAction={() => {
        if (nextAction.id === 'create_quotation') {
          createDeal('quotation')
          return
        }
        scrollToSection(nextAction.sectionId ?? 'general')
      }}
      quickActions={[
        {
          id: 'quote',
          label: 'Create Quotation',
          icon: FileText,
          onClick: () => createDeal('quotation'),
          disabled: !customerId || !hasValidLine,
        },
        {
          id: 'pipeline',
          label: 'Pipeline',
          icon: Building2,
          onClick: () => navigate('/crm/opportunities'),
        },
      ]}
      keyDetails={buildOpportunityKeyDetails(smartOverviewInput)}
      aiInsight={buildOpportunityAiInsight(smartOverviewInput)}
    />
  )

  return (
    <CrmCardFormShell
      title="New Opportunity"
      badge="CRM"
      className={`${ENTERPRISE_FORM_CLASS} enterprise-workspace--crm-smart-overview`}
      recordNo="New"
      recordTitle={opportunityName || customer?.customerName || 'New Opportunity'}
      status="Open"
      statusTone="info"
      stage={opportunityStageLabel(stage)}
      createdDate={formatDate(new Date().toISOString().slice(0, 10))}
      owner={owner.label}
      priority={opportunityPriorityLabel(priority)}
      company={customer?.customerName}
      favoritePath="/crm/opportunities/new"
      breadcrumbs={crmChildBreadcrumbs('Opportunities', '/crm/opportunities', 'New Opportunity')}
      documentStrip={documentStrip}
      factBox={factBox}
      suppressFactBoxRecord
      collapsibleFactBox
      factBoxLabel="Smart Context"
      onSubmit={handleSubmit}
      onSaveShortcut={() => createDeal('open')}
      onSaveCloseShortcut={() => createDeal('close')}
      onSaveAndNewShortcut={() => createDeal('new')}
      stickyFooter
      footer={(
        <ErpStickySaveBar
          sticky
          isSubmitting={isSubmitting}
          submitLabel="Save"
          onCancel={handleCancel}
          onSave={() => createDeal('open')}
          onSaveAndNew={() => createDeal('new')}
          onSaveAndClose={() => createDeal('close')}
          hint={(
            <span className="text-[12px] text-erp-muted">
              {completionPercent}% complete · Ctrl+S Save · Ctrl+Shift+S Save &amp; Close · Alt+N Save &amp; New
            </span>
          )}
        />
      )}
    >
      <div className="erp-form-body">
      <ErpQuickEntrySection
        id="opp-section-quick"
        title="Quick Entry"
        subtitle="Customer, opportunity name, and ownership — create the deal fast."
      >
        <ErpFieldRow
          label="Customer"
          required
          dataField="customerId"
          fieldState={
            inline.fieldError('customerId') || validationErrors.some((e) => /company|customer/i.test(e))
              ? 'error'
              : inline.fieldState('customerId')
          }
          fieldError={
            inline.fieldError('customerId')
            ?? validationErrors.find((e) => /company|customer/i.test(e))
          }
        >
          <QuickCreateSelect
            entityType="customer"
            value={customerId}
            onChange={(id) => {
              setCustomerId(id)
              setContactId('')
              inline.touch('customerId')
            }}
            options={customerOptions}
            placeholder="Select customer…"
            allowEmpty
            emptyOptionLabel={SELECT_PLACEHOLDER}
          />
        </ErpFieldRow>
        <ErpFieldRow label="Contact">
          <Select native value={contactId} onChange={(e) => setContactId(e.target.value)} disabled={!customerId} className="erp-input">
            <option value="">{SELECT_PLACEHOLDER}</option>
            {customerContacts.map((c) => (
              <option key={c.id} value={c.id}>{c.name}{c.designation ? ` · ${c.designation}` : ''}</option>
            ))}
          </Select>
        </ErpFieldRow>
        <ErpFieldRow
          label="Opportunity Name"
          required
          dataField="opportunityName"
          fieldState={
            inline.fieldError('opportunityName') || validationErrors.some((e) => /name/i.test(e))
              ? 'error'
              : inline.fieldState('opportunityName')
          }
          fieldError={
            inline.fieldError('opportunityName')
            ?? validationErrors.find((e) => /name/i.test(e))
          }
          hint={
            nameManuallyEdited
              ? 'Custom name — clear the field to resume auto-naming'
              : 'Auto-filled from company / product (HubSpot style) — edit anytime'
          }
        >
          <Input
            value={opportunityName}
            onChange={(e) => handleOpportunityNameChange(e.target.value)}
            onBlur={() => inline.touch('opportunityName')}
            placeholder="Select a company to auto-name, or type your own"
            required
            error={Boolean(inline.fieldError('opportunityName'))}
            className="erp-input"
          />
        </ErpFieldRow>
        <ErpFieldRow label="Stage">
          <Select native value={stage} onChange={(e) => handleStageChange(e.target.value as OpportunityStage)} className="erp-input">
            {stageOptions.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </Select>
        </ErpFieldRow>
        <ErpFieldRow
          label="Owner"
          required
          dataField="ownerId"
          fieldState={inline.fieldError('ownerId') ? 'error' : inline.fieldState('ownerId')}
          fieldError={inline.fieldError('ownerId')}
        >
          <Select
            native
            value={ownerId}
            onChange={(e) => {
              setOwnerId(e.target.value)
              inline.touch('ownerId')
            }}
            onBlur={() => inline.touch('ownerId')}
            required
            className="erp-input"
          >
            {ownerOptions.length === 0 ? (
              <option value={user.id}>{user.name}</option>
            ) : (
              ownerOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}{o.role ? ` · ${o.role}` : ''}</option>
              ))
            )}
          </Select>
        </ErpFieldRow>
        <ErpFieldRow label="Priority">
          <Select native value={priority} onChange={(e) => setPriority(e.target.value as OpportunityPriority)} className="erp-input">
            {resolvedPriorities.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </Select>
        </ErpFieldRow>
        <ErpFieldRow
          label="Expected Close Date"
          required
          dataField="expectedCloseDate"
          fieldState={
            inline.fieldError('expectedCloseDate') || validationErrors.some((e) => /close date/i.test(e))
              ? 'error'
              : inline.fieldState('expectedCloseDate')
          }
          fieldError={
            inline.fieldError('expectedCloseDate')
            ?? validationErrors.find((e) => /close date/i.test(e))
          }
        >
          <Input
            type="date"
            value={expectedCloseDate}
            min={getDateInputMin()}
            max={getCrmDateInputMax()}
            onChange={(e) => {
              setExpectedCloseDate(e.target.value)
              inline.touch('expectedCloseDate')
            }}
            onBlur={() => inline.touch('expectedCloseDate')}
            required
            error={Boolean(inline.fieldError('expectedCloseDate'))}
            className="erp-input"
          />
        </ErpFieldRow>
        {lead ? (
          <ErpFieldRow label="Source Lead" readOnly colSpan={2}>
            <Input value={`${lead.leadNo} · ${lead.prospectName}`} readOnly className="erp-input" />
          </ErpFieldRow>
        ) : null}
      </ErpQuickEntrySection>


      <ErpCardSection
        id="opp-section-location"
        title="Location"
        subtitle="Sales branch / location for this opportunity."
        icon={Building2}
        accent="teal"
        columns={3}
        collapsible
        defaultOpen
      >
        <LocationFieldRow value={locationId} onChange={(locId) => setLocationId(locId)} usage="sales" />
      </ErpCardSection>

      <ErpProductPricingSection
        sectionId="opp-section-products"
        nbaTarget="products"
        forceOpenKey={forceOpenProductsKey || undefined}
        title="Product & Pricing"
        subtitle="Build line items, then review adjustments and the live order total."
        accent="blue"
        lines={lines}
        onChange={setLines}
        productOptions={productOptions}
        productPickMap={pickMap}
        rowErrors={rowErrors}
      >
        <div className="opp-scope-notes mt-4">
          <ErpFieldRow label="Scope Notes" colSpan={3} horizontal={false}>
            <Textarea
              rows={3}
              value={productRequirement}
              onChange={(e) => {
                const next = e.target.value
                setProductRequirement(isEncodedLeadRequirementPayload(next) ? '' : next)
              }}
              placeholder="Additional technical or commercial scope beyond line items…"
              className="erp-input"
            />
          </ErpFieldRow>
        </div>
      </ErpProductPricingSection>

      <ErpCardSection
        id="opp-section-commercial"
        title="Commercial"
        subtitle="Product lines drive Final Quoted Value — probability drives weighted forecast."
        icon={Banknote}
        accent="green"
        collapsible
        defaultOpen
      >
        <ErpViewField
          label="Final Quoted Value (₹)"
          value={formatCrmCurrency(dealValue)}
          hint="Synced from product lines (subtotal − discount + tax)."
        />
        <ErpFieldRow label="Probability" required>
          <div className="dyn-probability-field">
            <div className="dyn-probability-field__track">
              <input
                type="range"
                className="dyn-probability-field__range"
                min={0}
                max={100}
                step={5}
                value={probability}
                onChange={(e) => setProbability(e.target.value)}
                aria-label="Win probability"
              />
              <span className="dyn-probability-field__value">{probability}%</span>
            </div>
          </div>
        </ErpFieldRow>
        <ErpViewField
          label="Weighted Forecast (₹)"
          value={formatCrmCurrency(weighted)}
          hint={`${probability}% × Final Quoted Value`}
        />
        <ErpViewField label="Currency" value="INR (₹)" />
      </ErpCardSection>

      <ErpCardSection
        id="opp-section-documents"
        title="Attachments"
        subtitle="Choose document type, then upload supporting files."
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
