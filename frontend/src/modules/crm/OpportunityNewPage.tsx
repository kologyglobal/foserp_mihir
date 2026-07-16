import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Banknote,
  Building2,
  ClipboardList,
  FileText,
  Paperclip,
  User,
} from 'lucide-react'
import { ErpCardSection, ErpFieldRow, ErpStickySaveBar, ErpQuickEntrySection, ErpAdditionalInfoToggle, ErpAdditionalInfoPanel, useErpAdditionalInfo, ErpViewField } from '../../components/erp/card-form'
import { ErpLineItemsGrid } from '../../components/erp/ErpLineItemsGrid'
import { CrmTypedDocumentUpload } from '../../components/crm/CrmTypedDocumentUpload'
import { Input, Select, Textarea } from '../../components/forms/Inputs'
import { useCrmStore } from '../../store/crmStore'
import { resolveStoreAction } from '../../store/storeAction'
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
  syncOpportunityLines,
  validateOpportunityLines,
} from '../../utils/opportunityLineCalc'
import { decodeLeadRequirementLines, isEncodedLeadRequirementPayload, sanitizeOpportunityScopeNotes } from '../../utils/leadRequirementLines'
import { resolveLeadConvertToOpportunityGate } from '../../utils/leadUtils'
import { useProductMasterOptionMap } from '../../utils/opportunityProductOptions'
import { LocationFieldRow } from '../../components/masters/LocationFieldRow'
import { useDocumentLocation } from '../../hooks/useDocumentLocation'
import { CrmCardFormShell } from '@/components/crm/CrmCardFormShell'
import { CrmSmartOverviewPanel } from '@/components/crm/CrmSmartOverviewPanel'
import { FactBoxPaneAiToggle } from '../../components/erp/card-form/FactBoxPaneAiToggle'
import { crmChildBreadcrumbs } from '../../utils/crmNavigation'
import {
  ENTERPRISE_FORM_CLASS,
  EnterpriseFormMetrics,
  EnterpriseFormSectionNav,
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

function initialLinesFromLead(requirement?: string): OpportunityLine[] {
  return decodeLeadRequirementLines(requirement ?? '', null).lines
}

function initialScopeNotesFromLead(requirement?: string): string {
  return sanitizeOpportunityScopeNotes(requirement)
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
  const { options: productOptions, pickMap } = useProductMasterOptionMap(products, items, uoms)

  const initialCustomerId = prefillCustomerId || lead?.customerId || ''
  const initialOwnerId = lead?.leadOwnerId ?? ownerOptions[0]?.value ?? user.id
  const initialPriority = (lead?.priority ?? resolvedPriorities[0]?.value ?? 'medium') as OpportunityPriority
  const initialStage: OpportunityStage = 'new_lead'
  const initialProbability = String(getStageProbability(initialStage) || 30)

  const [activeSection, setActiveSection] = useState('quick')
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [rowErrors, setRowErrors] = useState<Record<string, string[]>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [customerId, setCustomerId] = useState(initialCustomerId)
  const [contactId, setContactId] = useState('')
  const [opportunityName, setOpportunityName] = useState('')
  const [nameManuallyEdited, setNameManuallyEdited] = useState(false)
  const [productRequirement, setProductRequirement] = useState(() => initialScopeNotesFromLead(lead?.productRequirement))
  const [lines, setLines] = useState<OpportunityLine[]>(() => initialLinesFromLead(lead?.productRequirement))
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
    const gate = resolveLeadConvertToOpportunityGate(lead)
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

  // Prefill contact from lead contact person / primary company contact
  useEffect(() => {
    if (!prefillLeadId || !customerId || contactId) return
    const byName = lead?.contactPerson
      ? customerContacts.find((c) => c.name.trim().toLowerCase() === lead.contactPerson!.trim().toLowerCase())
      : undefined
    const next = byName ?? customerContacts.find((c) => c.isPrimary) ?? customerContacts[0]
    if (next) setContactId(next.id)
  }, [prefillLeadId, lead?.contactPerson, customerId, customerContacts, contactId])

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
    return validateOpportunityLines(lines, {
      customerId,
      ownerId,
      stage,
      probability,
    })
  }

  function resetForm() {
    setCustomerId(prefillCustomerId || '')
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
    setValidationErrors([])
    setRowErrors({})
  }

  const leadConvertGate = !prefillLeadId
    ? ({ ok: true } as const)
    : !lead
      ? ({ ok: false, reason: 'Lead not found' } as const)
      : resolveLeadConvertToOpportunityGate(lead)

  function createDeal(mode: 'open' | 'close' | 'new' | 'quotation') {
    const { errors, rowErrors: rErr } = runValidation()
    const leadErrors =
      prefillLeadId && !leadConvertGate.ok ? [leadConvertGate.reason] : []
    const allErrors = [...leadErrors, ...errors]
    setValidationErrors(allErrors)
    setRowErrors(rErr)
    if (allErrors.length) {
      const needsMore = errors.some((e) => /line|product|item/i.test(e)) || Object.keys(rErr).length > 0
      if (needsMore) setShowAdditionalDetails(true)
      return
    }
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
          return
        }

        bindDraftAttachments(attachmentScopeId, r.opportunityId)
        setOpportunityAttachments(r.opportunityId, attachments.map((a) => ({ ...a, opportunityId: r.opportunityId })))

        if (mode === 'quotation') {
          navigate(`/crm/quotations/new?opportunityId=${r.opportunityId}`)
          return
        }
        if (mode === 'new') {
          resetForm()
          setActiveSection('quick')
          setShowAdditionalDetails(false)
          return
        }
        if (mode === 'close') {
          navigate('/crm/opportunities')
          return
        }
        navigate(`/crm/opportunities/${r.opportunityId}`)
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

  const hasOptionalOppData = Boolean(
    lead
    || hasValidLine
    || productRequirement.trim()
    || attachments.length > 0,
  )
  const {
    open: showAdditionalDetails,
    setOpen: setShowAdditionalDetails,
    toggle: toggleAdditionalDetails,
    panelId: additionalPanelId,
  } = useErpAdditionalInfo({
    preferOpen: hasOptionalOppData,
  })
  const additionalSectionCount = 4
  const additionalAttentionCount = [
    !hasValidLine,
    dealValue <= 0,
    attachments.length === 0,
  ].filter(Boolean).length

  function scrollToSection(sectionId: string) {
    const additionalIds = new Set(['products', 'commercial', 'documents', 'location'])
    const needsExpand = additionalIds.has(sectionId) && !showAdditionalDetails
    if (needsExpand) setShowAdditionalDetails(true)
    setActiveSection(sectionId === 'general' ? 'quick' : sectionId)
    window.setTimeout(() => {
      const id = sectionId === 'general' ? 'opp-section-quick' : `opp-section-${sectionId}`
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, needsExpand ? 300 : 0)
  }

  const sectionNavItems = useMemo(() => {
    const quick = { id: 'quick', label: 'Quick', icon: User, done: completionItems.find((i) => i.id === 'quick')?.done }
    if (!showAdditionalDetails) return [quick]
    return [
      quick,
      { id: 'products', label: 'Products', icon: ClipboardList, done: completionItems.find((i) => i.id === 'products')?.done },
      { id: 'commercial', label: 'Commercial', icon: Banknote, done: completionItems.find((i) => i.id === 'commercial')?.done },
      { id: 'documents', label: 'Attachments', icon: Paperclip, done: completionItems.find((i) => i.id === 'documents')?.done },
    ]
  }, [completionItems, showAdditionalDetails])

  const formMetrics = useMemo(() => [
    { label: 'Completion', value: `${completionPercent}%`, accent: 'blue' as const, hint: `${completionItems.filter((i) => i.done).length} of ${completionItems.length} sections` },
    { label: 'Deal Value', value: formatCrmCurrency(dealValue), accent: 'green' as const, hint: `${lines.length} line${lines.length === 1 ? '' : 's'}` },
    { label: 'Weighted Forecast', value: formatCrmCurrency(weighted), accent: 'violet' as const, hint: `${probability}% probability` },
    { label: 'Expected Close', value: expectedCloseDate ? formatDate(expectedCloseDate) : '—', accent: 'amber' as const, hint: opportunityStageLabel(stage) },
  ], [completionPercent, completionItems, dealValue, lines.length, weighted, probability, expectedCloseDate, stage])

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

  const validationGuideItems = useMemo(
    () => validationErrors.map((err, i) => ({ id: `err-${i}`, label: err, message: err })),
    [validationErrors],
  )

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
      nextAction={nextAction}
      onNextAction={() => {
        if (nextAction.id === 'link_company') scrollToSection('general')
        else if (nextAction.id === 'add_lines') scrollToSection('products')
        else if (nextAction.id === 'set_value') scrollToSection('commercial')
        else if (nextAction.id === 'create_quotation') createDeal('quotation')
        else scrollToSection('general')
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
      validationItems={validationGuideItems}
      validationErrors={validationGuideItems.length ? undefined : validationErrors}
      factBox={factBox}
      suppressFactBoxRecord
      collapsibleFactBox
      factBoxLabel="Details"
      onSubmit={handleSubmit}
      onSaveShortcut={() => createDeal('open')}
      onSaveCloseShortcut={() => createDeal('close')}
      onSaveAndNewShortcut={() => createDeal('new')}
      stickyFooter
      formSaveActions={{
        isSubmitting,
        saveLabel: 'Save',
        onSave: () => createDeal('open'),
        onSaveAndNew: () => createDeal('new'),
        onSaveAndClose: () => createDeal('close'),
        onCancel: () => navigate('/crm/opportunities'),
      }}
      footer={(
        <ErpStickySaveBar
          sticky
          isSubmitting={isSubmitting}
          submitLabel="Save"
          cancelTo="/crm/opportunities"
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
      <EnterpriseFormSectionNav
        sections={sectionNavItems}
        activeId={activeSection}
        onSelect={scrollToSection}
        trailing={<FactBoxPaneAiToggle />}
      />

      <EnterpriseFormMetrics metrics={formMetrics} />

      <div className="erp-form-body">
      <ErpQuickEntrySection
        id="opp-section-quick"
        title="Quick Entry"
        subtitle="Customer, opportunity name, and ownership — create the deal fast."
      >
        <ErpFieldRow label="Customer" required>
          <Select
            value={customerId}
            onChange={(e) => {
              setCustomerId(e.target.value)
              setContactId('')
            }}
            required
            className="erp-input"
          >
            <option value="">Select customer…</option>
            {customers.filter((c) => c.isActive).map((c) => (
              <option key={c.id} value={c.id}>{c.customerName} · {c.city}</option>
            ))}
          </Select>
        </ErpFieldRow>
        <ErpFieldRow label="Contact">
          <Select native value={contactId} onChange={(e) => setContactId(e.target.value)} disabled={!customerId} className="erp-input">
            <option value="">—</option>
            {customerContacts.map((c) => (
              <option key={c.id} value={c.id}>{c.name}{c.designation ? ` · ${c.designation}` : ''}</option>
            ))}
          </Select>
        </ErpFieldRow>
        <ErpFieldRow
          label="Opportunity Name"
          required
          hint={
            nameManuallyEdited
              ? 'Custom name — clear the field to resume auto-naming'
              : 'Auto-filled from company / product (HubSpot style) — edit anytime'
          }
        >
          <Input
            value={opportunityName}
            onChange={(e) => handleOpportunityNameChange(e.target.value)}
            placeholder="Select a company to auto-name, or type your own"
            required
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
        <ErpFieldRow label="Owner" required>
          <Select native value={ownerId} onChange={(e) => setOwnerId(e.target.value)} required className="erp-input">
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
        <ErpFieldRow label="Expected Close Date" hint="Optional at create — set when the deal firms up">
          <Input type="date" value={expectedCloseDate} onChange={(e) => setExpectedCloseDate(e.target.value)} className="erp-input" />
        </ErpFieldRow>
        {lead ? (
          <ErpFieldRow label="Source Lead" readOnly colSpan={2}>
            <Input value={`${lead.leadNo} · ${lead.prospectName}`} readOnly className="erp-input" />
          </ErpFieldRow>
        ) : null}
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

      <ErpCardSection
        id="opp-section-products"
        title="Product / Item Lines"
        subtitle="Pick products and set qty, price, and tax per line."
        icon={ClipboardList}
        accent="teal"
        collapsible
        defaultOpen
      >
        <div className="col-span-3">
          <ErpLineItemsGrid
            lines={lines}
            onChange={setLines}
            productOptions={productOptions}
            productPickMap={pickMap}
            rowErrors={rowErrors}
            probability={Number(probability) || 0}
            variant="opportunity"
          />
        </div>
        <div className="col-span-3 opp-scope-notes">
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
      </ErpCardSection>

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
            <div className="dyn-probability-field__bar" aria-hidden>
              <div className="dyn-probability-field__fill" style={{ width: `${Number(probability) || 0}%` }} />
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
      </ErpAdditionalInfoPanel>
      </div>
    </CrmCardFormShell>
  )
}
