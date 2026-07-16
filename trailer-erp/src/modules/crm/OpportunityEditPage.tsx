import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Activity,
  Banknote,
  Building2,
  ClipboardList,
  Copy,
  FileText,
  Mail,
  MessageCircle,
  Paperclip,
  Phone,
  Save,
  User,
  Video,
} from 'lucide-react'
import { ErpCardSection, ErpFieldRow, ErpStickySaveBar, ErpViewField } from '../../components/erp/card-form'
import { ErpCardCommandBar } from '../../components/erp/card-form/ErpCardCommandBar'
import { FactBoxPaneAiToggle } from '../../components/erp/card-form/FactBoxPaneAiToggle'
import { ErpLineItemsGrid } from '../../components/erp/ErpLineItemsGrid'
import { CrmTypedDocumentUpload } from '../../components/crm/CrmTypedDocumentUpload'
import { Input, Select, Textarea } from '../../components/forms/Inputs'
import { useUnsavedChangesGuard } from '../../hooks/useUnsavedChangesGuard'
import { useCrmStore } from '../../store/crmStore'
import { resolveStoreAction } from '../../store/storeAction'
import { useMasterStore } from '../../store/masterStore'
import { useOpportunityAttachmentStore } from '../../store/opportunityAttachmentStore'
import type { CrmTypedAttachment } from '../../types/crmDocuments'
import { formatCrmCurrency } from '../../utils/crmMetrics'
import { formatDate } from '../../utils/dates/format'
import type { OpportunityLine, OpportunityPriority } from '../../types/crm'
import { useCrmOwnerOptions, useOpportunityPriorityOptions } from '../../hooks/useCrmMasters'
import {
  opportunityPriorityLabel,
  opportunityStageLabel,
  resolveOpportunityPriorityOptions,
} from '../../utils/opportunityUtils'
import {
  calcOpportunityLinesSummary,
  calcWeightedValue,
  resolveOpportunityLines,
  syncOpportunityLines,
  validateOpportunityLines,
} from '../../utils/opportunityLineCalc'
import { useProductMasterOptionMap } from '../../utils/opportunityProductOptions'
import { CrmCardFormShell } from '@/components/crm/CrmCardFormShell'
import { CrmSmartOverviewPanel } from '@/components/crm/CrmSmartOverviewPanel'
import { crmBreadcrumbs } from '../../utils/crmNavigation'
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
import { LocationFieldRow } from '../../components/masters/LocationFieldRow'
import { useDocumentLocation } from '../../hooks/useDocumentLocation'
import { AppLink } from '../../components/ui/AppLink'

export function OpportunityEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const opportunity = useCrmStore((s) => (id ? s.opportunities.find((o) => o.id === id) : undefined))
  const updateOpportunity = useCrmStore((s) => s.updateOpportunity)
  const contacts = useCrmStore((s) => s.contacts)
  const customer = useMasterStore((s) => s.customers.find((c) => c.id === opportunity?.customerId))
  const products = useMasterStore((s) => s.products)
  const items = useMasterStore((s) => s.items)
  const uoms = useMasterStore((s) => s.uoms)
  const product = useMasterStore((s) => (opportunity?.productId ? s.getProduct(opportunity.productId) : undefined))
  const ownerOptions = useCrmOwnerOptions()
  const priorityOptions = useOpportunityPriorityOptions()
  const { options: productOptions, pickMap } = useProductMasterOptionMap(products, items, uoms)
  const resolvedPriorities = useMemo(
    () => (priorityOptions.length > 0 ? priorityOptions : resolveOpportunityPriorityOptions().map((p) => ({ value: p.value, label: p.label }))),
    [priorityOptions],
  )

  const initialLines = useMemo(
    () => (opportunity ? resolveOpportunityLines(opportunity, product) : []),
    [opportunity, product],
  )

  const [activeSection, setActiveSection] = useState('general')
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [rowErrors, setRowErrors] = useState<Record<string, string[]>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [opportunityName, setOpportunityName] = useState(opportunity?.opportunityName ?? '')
  const [contactId, setContactId] = useState(opportunity?.contactId ?? '')
  const [lines, setLines] = useState<OpportunityLine[]>(initialLines)
  const [probability, setProbability] = useState(String(opportunity?.probability ?? 0))
  const [expectedCloseDate, setExpectedCloseDate] = useState(opportunity?.expectedCloseDate?.slice(0, 10) ?? '')
  const [priority, setPriority] = useState<OpportunityPriority>(opportunity?.priority ?? 'medium')
  const [ownerId, setOwnerId] = useState(opportunity?.ownerId ?? ownerOptions[0]?.value ?? 'user-demo')
  const [productRequirement, setProductRequirement] = useState(opportunity?.productRequirement ?? '')
  const { locationId, setLocationId } = useDocumentLocation('sales', opportunity?.locationId)

  const attachmentScopeId = id ?? 'draft:edit-opp'
  const setOpportunityAttachments = useOpportunityAttachmentStore((s) => s.setForOpportunity)
  const [attachments, setAttachmentsState] = useState<CrmTypedAttachment[]>(() =>
    useOpportunityAttachmentStore.getState().getForOpportunity(attachmentScopeId),
  )

  useEffect(() => {
    setAttachmentsState(useOpportunityAttachmentStore.getState().getForOpportunity(attachmentScopeId))
  }, [attachmentScopeId])

  function setAttachments(next: CrmTypedAttachment[]) {
    setAttachmentsState(next)
    setOpportunityAttachments(attachmentScopeId, next)
  }

  const customerContacts = contacts.filter((c) => c.customerId === opportunity?.customerId)
  const owner = ownerOptions.find((o) => o.value === ownerId) ?? { value: ownerId, label: opportunity?.ownerName ?? '—' }
  const summary = calcOpportunityLinesSummary(syncOpportunityLines(lines))
  const dealValue = summary.grandTotal
  const weighted = calcWeightedValue(dealValue, Number(probability) || 0)

  const hasValidLine = lines.some((l) => l.productOrItem?.trim())
  const completionItems = useMemo(() => [
    { id: 'general', label: 'General', done: Boolean(opportunityName.trim()) },
    { id: 'products', label: 'Products', done: hasValidLine },
    { id: 'commercial', label: 'Commercial', done: dealValue > 0 && Boolean(expectedCloseDate) },
    { id: 'documents', label: 'Attachments', done: attachments.length > 0 },
  ], [opportunityName, hasValidLine, dealValue, expectedCloseDate, attachments.length])

  const completionPercent = Math.round((completionItems.filter((i) => i.done).length / completionItems.length) * 100)

  const sectionNavItems = useMemo(() => [
    { id: 'general', label: 'General', icon: User, done: completionItems.find((i) => i.id === 'general')?.done },
    { id: 'products', label: 'Products', icon: ClipboardList, done: completionItems.find((i) => i.id === 'products')?.done },
    { id: 'commercial', label: 'Commercial', icon: Banknote, done: completionItems.find((i) => i.id === 'commercial')?.done },
    { id: 'documents', label: 'Attachments', icon: Paperclip, done: completionItems.find((i) => i.id === 'documents')?.done },
  ], [completionItems])

  const formMetrics = useMemo(() => [
    { label: 'Completion', value: `${completionPercent}%`, accent: 'blue' as const, hint: `${completionItems.filter((i) => i.done).length} of ${completionItems.length} sections` },
    { label: 'Deal Value', value: formatCrmCurrency(dealValue), accent: 'green' as const, hint: `${lines.length} line${lines.length === 1 ? '' : 's'}` },
    { label: 'Weighted Forecast', value: formatCrmCurrency(weighted), accent: 'violet' as const, hint: `${probability}% probability` },
    { label: 'Expected Close', value: expectedCloseDate ? formatDate(expectedCloseDate) : '—', accent: 'amber' as const, hint: opportunity ? opportunityStageLabel(opportunity.stage) : '—' },
  ], [completionPercent, completionItems, dealValue, lines.length, weighted, probability, expectedCloseDate, opportunity])

  const validationGuideItems = useMemo(
    () => validationErrors.map((err, i) => ({ id: `err-${i}`, label: err, message: err })),
    [validationErrors],
  )

  const { markDirty, resetDirty } = useUnsavedChangesGuard(Boolean(opportunity && opportunity.status === 'open'))
  const dirtyBaselineReady = useRef(false)
  const dirtyBaseline = useRef('')
  const dirtySnapshot = useMemo(
    () =>
      JSON.stringify({
        opportunityName,
        contactId,
        lines,
        probability,
        expectedCloseDate,
        priority,
        ownerId,
        productRequirement,
        locationId,
        attachmentIds: attachments.map((a) => a.id),
      }),
    [
      opportunityName,
      contactId,
      lines,
      probability,
      expectedCloseDate,
      priority,
      ownerId,
      productRequirement,
      locationId,
      attachments,
    ],
  )
  const dirtySnapshotRef = useRef(dirtySnapshot)
  dirtySnapshotRef.current = dirtySnapshot

  useEffect(() => {
    if (!opportunity || opportunity.status !== 'open') return
    dirtyBaselineReady.current = false
    const timer = window.setTimeout(() => {
      dirtyBaseline.current = dirtySnapshotRef.current
      dirtyBaselineReady.current = true
      resetDirty()
    }, 40)
    return () => window.clearTimeout(timer)
  }, [opportunity?.id, opportunity?.modifiedAt, resetDirty])

  useEffect(() => {
    if (!dirtyBaselineReady.current) return
    if (dirtySnapshot !== dirtyBaseline.current) markDirty()
    else resetDirty()
  }, [dirtySnapshot, markDirty, resetDirty])

  if (!id || !opportunity) {
    return (
      <div className="erp-page flex flex-col items-center justify-center gap-3 p-12 text-center">
        <p className="text-erp-muted">Opportunity not found.</p>
        <AppLink to="/crm/opportunities" className="text-sm font-semibold text-erp-primary">Back to pipeline</AppLink>
      </div>
    )
  }

  if (opportunity.status !== 'open') {
    return (
      <div className="erp-page flex flex-col items-center justify-center gap-3 p-12 text-center">
        <p className="text-erp-muted">Closed deals cannot be edited.</p>
        <AppLink to={`/crm/opportunities/${id}`} className="text-sm font-semibold text-erp-primary">View deal</AppLink>
      </div>
    )
  }

  const opp = opportunity
  const oppId = id

  function runValidation() {
    const base = validateOpportunityLines(lines, {
      customerId: opp.customerId,
      ownerId,
      stage: opp.stage,
      probability,
    })
    if (!opportunityName.trim()) base.errors.unshift('Opportunity name is required.')
    return base
  }

  function save(mode: 'save' | 'close' | 'quotation' = 'save') {
    const { errors, rowErrors: rErr } = runValidation()
    setValidationErrors(errors)
    setRowErrors(rErr)
    if (errors.length) return
    if (isSubmitting) return

    setIsSubmitting(true)
    void (async () => {
      try {
        const ownerRecord = ownerOptions.find((o) => o.value === ownerId) ?? { value: ownerId, label: opp.ownerName }
        const syncedLines = syncOpportunityLines(lines)
        const r = await resolveStoreAction(
          updateOpportunity(oppId, {
            opportunityName,
            contactId: contactId || null,
            lines: syncedLines,
            productId: syncedLines[0]?.productId ?? opp.productId,
            value: summary.grandTotal,
            probability: Number(probability) || 0,
            expectedCloseDate,
            priority,
            ownerId: ownerRecord.value,
            ownerName: ownerRecord.label,
            productRequirement,
            locationId: locationId || null,
          }),
        )
        if (!r.ok) {
          setValidationErrors([r.error ?? 'Could not save'])
          return
        }
        setOpportunityAttachments(oppId, attachments)
        resetDirty()
        if (mode === 'close') {
          navigate('/crm/opportunities')
          return
        }
        if (mode === 'quotation') {
          navigate(`/crm/quotations/new?opportunityId=${oppId}`)
          return
        }
        navigate(`/crm/opportunities/${oppId}`)
      } finally {
        setIsSubmitting(false)
      }
    })()
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    save('save')
  }

  function scrollToSection(sectionId: string) {
    setActiveSection(sectionId)
    document.getElementById(`opp-section-${sectionId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const documentStrip = [
    { label: 'Opportunity No.', value: opp.opportunityNo, highlight: true },
    { label: 'Status', value: 'Open' },
    { label: 'Stage', value: opportunityStageLabel(opp.stage) },
    { label: 'Owner', value: owner.label },
    { label: 'Customer', value: customer?.customerName ?? '—', highlight: Boolean(customer) },
    { label: 'Priority', value: opportunityPriorityLabel(priority) },
    { label: 'Deal Value', value: formatCrmCurrency(dealValue), highlight: dealValue > 0 },
    { label: 'Last Modified', value: opp.modifiedAt ? formatDate(opp.modifiedAt) : '—' },
  ]

  const commandBar = (
    <ErpCardCommandBar
      inline
      homeActions={[
        { id: 'save', label: 'Save', icon: Save, primary: true, onClick: () => save('save') },
        { id: '360', label: 'View 360', icon: Building2, onClick: () => navigate(`/crm/opportunities/${oppId}`) },
        { id: 'quote', label: 'Save & Quotation', icon: FileText, onClick: () => save('quotation') },
      ]}
      moreActions={[
        { id: 'activity', label: 'Log Activity', icon: Activity, onClick: () => navigate(`/crm/opportunities/${oppId}`) },
        { id: 'call', label: 'Call', icon: Phone, onClick: () => window.open(`tel:${customer?.contactPhone ?? ''}`) },
        { id: 'email', label: 'Email', icon: Mail, onClick: () => window.open(`mailto:${customer?.contactEmail ?? ''}`) },
        { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, onClick: () => navigate(`/crm/opportunities/${oppId}`) },
        { id: 'meeting', label: 'Meeting', icon: Video, onClick: () => navigate(`/crm/opportunities/${oppId}`) },
        { id: 'duplicate', label: 'Duplicate', icon: Copy, onClick: () => navigate(`/crm/opportunities/new?customerId=${opp.customerId}`) },
      ]}
    />
  )

  const factBox = (
    <CrmSmartOverviewPanel
      ariaLabel="Smart opportunity overview"
      title={opportunityOverviewTitle({
        opportunityName,
        customerName: customer?.customerName ?? '',
        customerId: opp.customerId,
        stage: opp.stage,
        priority,
        ownerName: owner.label,
        dealValue,
        weightedValue: weighted,
        lineCount: lines.length,
        hasValidLine,
        expectedCloseDate,
        quotationId: opp.quotationId,
        salesOrderId: opp.salesOrderId,
        isOpen: true,
      })}
      chips={opportunityOverviewChips({
        opportunityName,
        customerName: customer?.customerName ?? '',
        customerId: opp.customerId,
        stage: opp.stage,
        priority,
        ownerName: owner.label,
        dealValue,
        weightedValue: weighted,
        lineCount: lines.length,
        hasValidLine,
        isOpen: true,
      })}
      meta={[`Stage: ${opportunityStageLabel(opp.stage)}`, `Owner: ${owner.label}`]}
      savedLabel={opp.modifiedAt ? `Last updated ${formatDate(opp.modifiedAt)}` : undefined}
      progressLabel="Deal readiness"
      progressPercent={computeOpportunityCompleteness({
        opportunityName,
        customerName: customer?.customerName ?? '',
        customerId: opp.customerId,
        stage: opp.stage,
        priority,
        ownerName: owner.label,
        dealValue,
        weightedValue: weighted,
        lineCount: lines.length,
        hasValidLine,
        expectedCloseDate,
        quotationId: opp.quotationId,
        isOpen: true,
      })}
      signals={buildOpportunitySmartSignals({
        opportunityName,
        customerName: customer?.customerName ?? '',
        customerId: opp.customerId,
        stage: opp.stage,
        priority,
        ownerName: owner.label,
        dealValue,
        weightedValue: weighted,
        lineCount: lines.length,
        hasValidLine,
        expectedCloseDate,
        quotationId: opp.quotationId,
        isOpen: true,
      })}
      nextAction={resolveOpportunityNextBestAction({
        opportunityName,
        customerName: customer?.customerName ?? '',
        customerId: opp.customerId,
        stage: opp.stage,
        priority,
        ownerName: owner.label,
        dealValue,
        weightedValue: weighted,
        lineCount: lines.length,
        hasValidLine,
        expectedCloseDate,
        quotationId: opp.quotationId,
        salesOrderId: opp.salesOrderId,
        isOpen: true,
      })}
      onNextAction={() => {
        const action = resolveOpportunityNextBestAction({
          opportunityName,
          customerName: customer?.customerName ?? '',
          customerId: opp.customerId,
          stage: opp.stage,
          priority,
          ownerName: owner.label,
          dealValue,
          weightedValue: weighted,
          lineCount: lines.length,
          hasValidLine,
          expectedCloseDate,
          quotationId: opp.quotationId,
          salesOrderId: opp.salesOrderId,
          isOpen: true,
        })
        if (action.id === 'add_lines') scrollToSection('products')
        else if (action.id === 'set_value') scrollToSection('commercial')
        else if (action.id === 'create_quotation') save('quotation')
        else if (action.id === 'create_so') navigate(`/sales/orders/new?opportunityId=${oppId}`)
        else scrollToSection('general')
      }}
      quickActions={[
        { id: 'save', label: 'Save', icon: Save, onClick: () => save('save'), disabled: isSubmitting },
        { id: '360', label: 'Deal 360', icon: Building2, onClick: () => navigate(`/crm/opportunities/${oppId}`) },
        { id: 'quote', label: 'Quotation', icon: FileText, onClick: () => save('quotation'), disabled: !hasValidLine },
        { id: 'activity', label: 'Log Activity', icon: Activity, onClick: () => navigate(`/crm/opportunities/${oppId}`) },
      ]}
      keyDetails={buildOpportunityKeyDetails({
        opportunityName,
        customerName: customer?.customerName ?? '',
        customerId: opp.customerId,
        stage: opp.stage,
        priority,
        ownerName: owner.label,
        dealValue,
        weightedValue: weighted,
        lineCount: lines.length,
        hasValidLine,
        expectedCloseDate,
        nextFollowUpDate: opp.nextFollowUpDate,
        isOpen: true,
      })}
      aiInsight={buildOpportunityAiInsight({
        opportunityName,
        customerName: customer?.customerName ?? '',
        customerId: opp.customerId,
        stage: opp.stage,
        priority,
        ownerName: owner.label,
        dealValue,
        weightedValue: weighted,
        lineCount: lines.length,
        hasValidLine,
        quotationId: opp.quotationId,
        salesOrderId: opp.salesOrderId,
        isOpen: true,
      })}
    />
  )

  return (
    <CrmCardFormShell
      title="Edit Opportunity"
      badge="CRM"
      className={`${ENTERPRISE_FORM_CLASS} enterprise-workspace--crm-smart-overview`}
      recordNo={opp.opportunityNo}
      recordTitle={opportunityName || opp.opportunityName}
      status="Open"
      statusTone="info"
      stage={opportunityStageLabel(opp.stage)}
      createdDate={formatDate(opp.createdAt)}
      owner={owner.label}
      priority={opportunityPriorityLabel(priority)}
      company={customer?.customerName}
      lastSaved={opp.modifiedAt ? `Last updated ${formatDate(opp.modifiedAt)}` : undefined}
      favoritePath={`/crm/opportunities/${oppId}/edit`}
      breadcrumbs={crmBreadcrumbs(
        { label: 'Opportunities', to: '/crm/opportunities' },
        { label: opp.opportunityNo, to: `/crm/opportunities/${oppId}` },
        { label: 'Edit' },
      )}
      commandBar={commandBar}
      documentStrip={documentStrip}
      validationItems={validationGuideItems.length ? validationGuideItems : undefined}
      validationErrors={validationGuideItems.length ? undefined : validationErrors}
      factBox={factBox}
      suppressFactBoxRecord
      collapsibleFactBox
      factBoxLabel="Details"
      onSubmit={handleSubmit}
      onSaveShortcut={() => save('save')}
      onSaveCloseShortcut={() => save('close')}
      stickyFooter
      footer={(
        <ErpStickySaveBar
          sticky
          isSubmitting={isSubmitting}
          submitLabel="Save"
          cancelTo={`/crm/opportunities/${oppId}`}
          onSave={() => save('save')}
          onSaveAndClose={() => save('close')}
          hint={(
            <span className="text-[12px] text-erp-muted">
              {completionPercent}% complete · Ctrl+S Save · Ctrl+Shift+S Save &amp; Close
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
        id="opp-section-general"
        title="General"
        subtitle="Customer account, contact, and opportunity identity."
        icon={User}
        accent="blue"
        collapsible
        defaultOpen
      >
        <ErpViewField label="Customer" value={customer?.customerName ?? opp.customerId} />
        <ErpFieldRow label="Contact">
          <Select native value={contactId} onChange={(e) => setContactId(e.target.value)} className="erp-input">
            <option value="">—</option>
            {customerContacts.map((c) => (
              <option key={c.id} value={c.id}>{c.name}{c.designation ? ` · ${c.designation}` : ''}</option>
            ))}
          </Select>
        </ErpFieldRow>
        <LocationFieldRow value={locationId} onChange={(locId) => setLocationId(locId)} usage="sales" />
        <ErpFieldRow
          label="Opportunity Name"
          required
          colSpan={2}
          fieldState={validationErrors.some((e) => /name/i.test(e)) ? 'error' : 'idle'}
          fieldError={validationErrors.find((e) => /name/i.test(e))}
        >
          <Input
            value={opportunityName}
            onChange={(e) => setOpportunityName(e.target.value)}
            required
            className="erp-input"
          />
        </ErpFieldRow>
        <ErpViewField label="Stage" value={opportunityStageLabel(opp.stage)} />
        <ErpFieldRow label="Owner" required>
          <Select native value={ownerId} onChange={(e) => setOwnerId(e.target.value)} required className="erp-input">
            {ownerOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </ErpFieldRow>
        <ErpFieldRow label="Priority">
          <Select native value={priority} onChange={(e) => setPriority(e.target.value as OpportunityPriority)} className="erp-input">
            {resolvedPriorities.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </Select>
        </ErpFieldRow>
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
        <ErpFieldRow label="Scope Notes" colSpan={3} horizontal={false}>
          <Textarea
            rows={3}
            value={productRequirement}
            onChange={(e) => setProductRequirement(e.target.value)}
            className="erp-input"
          />
        </ErpFieldRow>
      </ErpCardSection>

      <ErpCardSection
        id="opp-section-commercial"
        title="Commercial"
        subtitle="Totals roll up from item lines — probability drives weighted pipeline value."
        icon={Banknote}
        accent="green"
        collapsible
        defaultOpen
      >
        <ErpViewField label="Expected Value (₹)" value={formatCrmCurrency(dealValue)} />
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
        <ErpViewField label="Weighted Value" value={formatCrmCurrency(weighted)} />
        <ErpFieldRow
          label="Expected Close Date"
          required
          fieldState={!expectedCloseDate && validationErrors.length ? 'error' : 'idle'}
          fieldError={!expectedCloseDate ? validationErrors.find((e) => /close/i.test(e)) : undefined}
        >
          <Input type="date" value={expectedCloseDate} onChange={(e) => setExpectedCloseDate(e.target.value)} required className="erp-input" />
        </ErpFieldRow>
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
    </CrmCardFormShell>
  )
}
