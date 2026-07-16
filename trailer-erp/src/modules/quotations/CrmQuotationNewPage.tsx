import { useMemo, useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Banknote,
  Bookmark,
  ClipboardList,
  FileText,
  Handshake,
  Paperclip,
} from 'lucide-react'
import { DynamicsStatusChip } from '../../components/dynamics/DynamicsStatusChip'
import { OpportunitySelectPicker } from '../../components/crm/OpportunitySelectPicker'
import { QuotationTemplateSelector } from '@/components/quotations/QuotationTemplateSelector'
import { QuotationLineItemsEditor } from '@/components/quotations/QuotationLineItemsEditor'
import { ErpCardSection, ErpFieldRow, ErpStickySaveBar } from '../../components/erp/card-form'
import { Input } from '../../components/forms/Inputs'
import { resolveStoreAction } from '../../store/storeAction'
import { useCrmStore } from '../../store/crmStore'
import { useMasterStore } from '../../store/masterStore'
import { findFeaturedQuotationTemplate } from '../../utils/quotationTemplates'
import { formatCrmCurrency } from '../../utils/crmMetrics'
import { formatDate } from '../../utils/dates/format'
import { opportunityStageLabel } from '../../utils/opportunityUtils'
import type { OpportunityLine } from '../../types/crm'
import {
  calcOpportunityLinesSummary,
  calcWeightedValue,
  createEmptyOpportunityLine,
  opportunityLinesToQuotationPriceLines,
  quotationPriceLinesToOpportunityLines,
  resolveOpportunityLines,
  syncOpportunityLines,
  validateOpportunityLines,
} from '../../utils/opportunityLineCalc'
import { LocationFieldRow } from '../../components/masters/LocationFieldRow'
import { useDocumentLocation } from '../../hooks/useDocumentLocation'
import { CrmCardFormShell } from '@/components/crm/CrmCardFormShell'
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
  buildQuotationKeyDetails,
  buildQuotationSmartSignals,
  computeQuotationCompleteness,
  quotationOverviewChips,
  quotationOverviewTitle,
  resolveQuotationNextBestAction,
} from '../../utils/quotationSmartOverview'

export function CrmQuotationNewPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const templates = useCrmStore((s) => s.quotationTemplates)
  const opportunities = useCrmStore((s) => s.opportunities)
  const customers = useMasterStore((s) => s.customers)
  const products = useMasterStore((s) => s.products)
  const createFromOpp = useCrmStore((s) => s.createQuotationFromOpportunity)
  const updateOpportunity = useCrmStore((s) => s.updateOpportunity)

  const prefillOppId = searchParams.get('opportunityId') ?? ''
  const prefillCustomerId = searchParams.get('customerId') ?? ''

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

  const [activeSection, setActiveSection] = useState('general')
  const [opportunityId, setOpportunityId] = useState(defaultOppId)
  const [templateId, setTemplateId] = useState(featuredTemplate?.id ?? '')
  const [lines, setLines] = useState<OpportunityLine[]>(() => {
    const opp = openOpps.find((o) => o.id === defaultOppId)
    return opp ? resolveOpportunityLines(opp, opp.productId ? products.find((p) => p.id === opp.productId) : undefined) : [createEmptyOpportunityLine(1)]
  })
  const [scopeNotes, setScopeNotes] = useState('')
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [rowErrors, setRowErrors] = useState<Record<string, string[]>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

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

  const selectedOpp = openOpps.find((o) => o.id === opportunityId)
  const { locationId, setLocationId } = useDocumentLocation('sales', selectedOpp?.locationId)
  const selectedCustomer = selectedOpp
    ? customers.find((c) => c.id === selectedOpp.customerId)
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

  const otherTemplates = templates.filter((t) => t.id !== featuredTemplate?.id)

  function handleOpportunityChange(id: string) {
    setOpportunityId(id)
    const opp = openOpps.find((o) => o.id === id)
    if (opp) {
      const product = opp.productId ? products.find((p) => p.id === opp.productId) : undefined
      setLines(resolveOpportunityLines(opp, product))
      setScopeNotes(opp.productRequirement ?? '')
      if (opp.locationId) setLocationId(opp.locationId)
    } else {
      setLines([createEmptyOpportunityLine(1)])
      setScopeNotes('')
    }
  }

  function validate(): string[] {
    const errors: string[] = []
    if (!opportunityId) errors.push('Select an opportunity to link this quotation.')
    if (!templateId) errors.push('Select a quotation template.')
    const lineValidation = validateOpportunityLines(syncedLines, {
      customerId: selectedOpp?.customerId ?? '',
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

  async function createQuotation(mode: 'editor' | 'close') {
    const errors = validate()
    const { rowErrors: rErr } = validateOpportunityLines(syncedLines, {
      customerId: selectedOpp?.customerId ?? '',
      ownerId: selectedOpp?.ownerId ?? '',
      stage: selectedOpp?.stage ?? 'new_lead',
      probability: String(probability),
    })
    setValidationErrors(errors)
    setRowErrors(rErr)
    if (errors.length) return

    setIsSubmitting(true)
    if (locationId && opportunityId) {
      updateOpportunity(opportunityId, { locationId })
    }
    const primaryUnitPrice = syncedLines[0]?.unitPrice ?? 0
    const r = await resolveStoreAction(createFromOpp(opportunityId, templateId, primaryUnitPrice, syncedLines))
    setIsSubmitting(false)

    if (!r.ok || !r.quotationId) {
      setValidationErrors([r.error ?? 'Could not create quotation'])
      return
    }

    bindDraftAttachments(attachmentScopeId, r.quotationId)
    setQuotationAttachments(r.quotationId, attachments.map((a) => ({ ...a, quotationId: r.quotationId })))

    if (mode === 'close') {
      navigate(`/crm/quotations/${r.quotationId}`)
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

  const completionItems = [
    { id: 'general', label: 'Opportunity', done: Boolean(opportunityId) },
    { id: 'template', label: 'Template', done: Boolean(templateId) },
    { id: 'products', label: 'Products', done: hasValidLine },
    { id: 'commercial', label: 'Commercial', done: lineSummary.grandTotal > 0 },
    { id: 'documents', label: 'Attachments', done: attachments.length > 0 },
  ]
  const completionPercent = Math.round((completionItems.filter((i) => i.done).length / completionItems.length) * 100)

  const sectionNavItems = [
    { id: 'general', label: 'Opportunity', icon: Handshake, done: completionItems.find((i) => i.id === 'general')?.done },
    { id: 'template', label: 'Template', icon: Bookmark, done: completionItems.find((i) => i.id === 'template')?.done },
    { id: 'products', label: 'Products', icon: ClipboardList, done: completionItems.find((i) => i.id === 'products')?.done },
    { id: 'commercial', label: 'Commercial', icon: Banknote, done: completionItems.find((i) => i.id === 'commercial')?.done },
    { id: 'documents', label: 'Attachments', icon: Paperclip, done: completionItems.find((i) => i.id === 'documents')?.done },
  ]

  const formMetrics = useMemo(() => [
    { label: 'Completion', value: `${completionPercent}%`, accent: 'blue' as const, hint: `${completionItems.filter((i) => i.done).length} of ${completionItems.length} sections` },
    { label: 'Line Items', value: String(syncedLines.length), accent: 'green' as const, hint: hasValidLine ? formatCrmCurrency(lineSummary.grandTotal) : 'Add products' },
    { label: 'Grand Total', value: lineSummary.grandTotal > 0 ? formatCrmCurrency(lineSummary.grandTotal) : '—', accent: 'violet' as const, hint: `${probability}% probability` },
    { label: 'Weighted', value: weighted > 0 ? formatCrmCurrency(weighted) : '—', accent: 'amber' as const, hint: selectedOpp?.opportunityNo ?? 'No deal' },
  ], [completionPercent, completionItems, syncedLines.length, hasValidLine, lineSummary.grandTotal, probability, weighted, selectedOpp?.opportunityNo])

  const documentStrip = [
    { label: 'Quotation No.', value: 'Auto on save', highlight: false },
    { label: 'Status', value: 'Draft' },
    { label: 'Customer', value: selectedCustomer?.customerName ?? '—', highlight: Boolean(selectedCustomer) },
    { label: 'Opportunity', value: selectedOpp?.opportunityNo ?? '—', highlight: Boolean(selectedOpp) },
    { label: 'Template', value: selectedTemplate?.templateName ?? '—', highlight: Boolean(selectedTemplate) },
    { label: 'Lines', value: String(syncedLines.length), highlight: syncedLines.length > 0 },
    { label: 'Grand Total', value: lineSummary.grandTotal > 0 ? formatCrmCurrency(lineSummary.grandTotal) : '—', highlight: lineSummary.grandTotal > 0 },
    { label: 'Owner', value: selectedOpp?.ownerName ?? '—' },
  ]

  const validationGuideItems = useMemo(
    () => validationErrors.map((err, i) => ({ id: `err-${i}`, label: err, message: err })),
    [validationErrors],
  )

  const smartOverviewInput = useMemo(() => ({
    quotationNo: '',
    customerName: selectedCustomer?.customerName ?? '',
    customerId: selectedOpp?.customerId ?? null,
    status: 'Draft',
    lineCount: syncedLines.length,
    hasValidLine,
    grandTotal: lineSummary.grandTotal,
    validUntil: null,
    opportunityId: opportunityId || null,
    ownerName: selectedOpp?.ownerName,
  }), [
    selectedCustomer?.customerName,
    selectedOpp?.customerId,
    selectedOpp?.ownerName,
    syncedLines.length,
    hasValidLine,
    lineSummary.grandTotal,
    opportunityId,
  ])

  const nextAction = resolveQuotationNextBestAction(smartOverviewInput)

  const factBox = (
    <CrmSmartOverviewPanel
      ariaLabel="Smart quotation overview"
      title={quotationOverviewTitle(smartOverviewInput)}
      chips={quotationOverviewChips(smartOverviewInput)}
      meta={[
        selectedOpp?.opportunityNo ? `Deal: ${selectedOpp.opportunityNo}` : 'No opportunity',
        selectedTemplate?.templateName ? `Template: ${selectedTemplate.templateName}` : 'No template',
      ]}
      progressLabel="Quotation readiness"
      progressPercent={computeQuotationCompleteness(smartOverviewInput)}
      signals={buildQuotationSmartSignals(smartOverviewInput)}
      nextAction={nextAction}
      onNextAction={() => {
        if (nextAction.id === 'link_customer') scrollToSection('general')
        else if (nextAction.id === 'add_lines') scrollToSection('products')
        else if (nextAction.id === 'set_validity') scrollToSection('commercial')
        else scrollToSection('general')
      }}
      quickActions={[
        {
          id: 'create',
          label: 'Create Quotation',
          icon: FileText,
          onClick: () => createQuotation('editor'),
          disabled: isSubmitting || !hasValidLine,
        },
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
      stage={selectedOpp ? opportunityStageLabel(selectedOpp.stage) : '—'}
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
      factBoxLabel="Details"
      onSubmit={handleSubmit}
      onSaveShortcut={() => createQuotation('editor')}
      onSaveCloseShortcut={() => createQuotation('close')}
      footer={(
        <ErpStickySaveBar
          isSubmitting={isSubmitting}
          submitLabel="Create Quotation"
          cancelTo="/crm/quotations"
          onSave={() => createQuotation('editor')}
          onSaveAndClose={() => createQuotation('close')}
          hint={(
            <span className="text-[12px] text-erp-muted">
              {completionPercent}% complete · Ctrl+S Create · Ctrl+Shift+S Create &amp; Close
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

      <ErpCardSection
        id="quote-section-general"
        title="Opportunity Source"
        subtitle="Link the quotation to an open deal — customer and commercial context flow from the opportunity."
        icon={Handshake}
        accent="blue"
        collapsible
        defaultOpen
      >
        <div className="col-span-2 space-y-4">
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
                  {(selectedProduct?.productName ?? selectedOpp.productRequirement) || '—'}
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
                ? 'No open opportunities for this customer — create a deal from the pipeline first.'
                : 'No open opportunities — create a deal from the pipeline first.'}
            </p>
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
        <div className="col-span-2 space-y-4 crm-quotation-new">
          {featuredTemplate ? (
            <button
              type="button"
              className={`crm-template-new__featured crm-quotation-new__template${templateId === featuredTemplate.id ? ' crm-quotation-new__template--selected' : ''}`}
              onClick={() => setTemplateId(featuredTemplate.id)}
            >
              <Bookmark className="h-6 w-6 shrink-0" />
              <div>
                <p className="crm-template-new__eyebrow">Recommended</p>
                <p className="crm-template-new__title">{featuredTemplate.templateName}</p>
                <p className="crm-template-new__hint">
                  {featuredTemplate.productFamily} · {featuredTemplate.sections.length} sections
                </p>
              </div>
            </button>
          ) : null}
          {otherTemplates.length > 0 ? (
            <>
              <p className="crm-template-new__section-title">Other templates</p>
              <div className="crm-template-new__grid">
                {otherTemplates.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`crm-template-new__option crm-quotation-new__template${templateId === t.id ? ' crm-quotation-new__template--selected' : ''}`}
                    onClick={() => setTemplateId(t.id)}
                  >
                    <p className="crm-template-new__title">{t.templateName}</p>
                    <p className="crm-template-new__hint">{t.productFamily} · {t.sections.length} sections</p>
                  </button>
                ))}
              </div>
            </>
          ) : null}
          <QuotationTemplateSelector templates={templates} value={templateId} onChange={setTemplateId} />
        </div>
      </ErpCardSection>

      <ErpCardSection
        id="quote-section-products"
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
        title="Commercial Summary"
        subtitle="Totals from line items and deal forecast."
        icon={Banknote}
        accent="green"
        collapsible
        defaultOpen
      >
        <ErpFieldRow label="Grand Total (₹)" readOnly>
          <Input value={formatCrmCurrency(lineSummary.grandTotal)} readOnly className="erp-input" />
        </ErpFieldRow>
        <ErpFieldRow label="GST Amount" readOnly>
          <Input value={formatCrmCurrency(lineSummary.gstAmount)} readOnly className="erp-input" />
        </ErpFieldRow>
        <ErpFieldRow label="Probability" readOnly>
          <Input value={`${probability}%`} readOnly className="erp-input" />
        </ErpFieldRow>
        <ErpFieldRow label="Weighted Value" readOnly>
          <Input value={formatCrmCurrency(weighted)} readOnly className="erp-input" />
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
        title="Attachments"
        subtitle="RFQs, drawings, and supporting documents for this quotation."
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
