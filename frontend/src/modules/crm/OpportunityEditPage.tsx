import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Activity,
  Archive,
  ArrowRightLeft,
  Banknote,
  Building2,
  CheckCircle2,
  ClipboardList,
  Copy,
  FileText,
  History,
  PauseCircle,
  Paperclip,
  Phone,
  Mail,
  Save,
  User,
  XCircle,
} from 'lucide-react'
import { ErpCardSection, ErpFieldRow, ErpStickySaveBar, ErpViewField } from '../../components/erp/card-form'
import { ErpCardCommandBar } from '../../components/erp/card-form/ErpCardCommandBar'
import { ErpLineItemsGrid } from '../../components/erp/ErpLineItemsGrid'
import { CrmTypedDocumentUpload } from '../../components/crm/CrmTypedDocumentUpload'
import { EntityAttachmentsPanel } from '../../components/crm/shared/EntityAttachmentsPanel'
import { LostDealFields } from '../../components/crm'
import { CrmDeleteConfirmModal } from '../../components/crm/CrmDeleteConfirmModal'
import { Input, Select, Textarea } from '../../components/forms/Inputs'
import { ErpButton, ErpButtonGroup } from '../../components/erp/ErpButton'
import { useApiMode } from '../../hooks/useApiMode'
import { formatCrmCurrency } from '../../utils/crmMetrics'
import { formatDate } from '../../utils/dates/format'
import type { OpportunityStage } from '../../types/crm'
import { opportunityPriorityLabel, opportunityStageLabel } from '../../utils/opportunityUtils'
import { buildSalesOrderNewUrl } from '../../utils/opportunitySalesOrderDraft'
import { isEncodedLeadRequirementPayload } from '../../utils/leadRequirementLines'
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
import { AppLink } from '../../components/ui/AppLink'
import { useOpportunityEditor } from './hooks/useOpportunityEditor'

export function OpportunityEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const apiMode = useApiMode()
  const editor = useOpportunityEditor(id)
  const {
    opportunity,
    customer,
    customerContacts,
    owner,
    ownerOptions,
    resolvedPriorities,
    stageOptions,
    productOptions,
    productPickMap,
    form,
    summary,
    dealValue,
    weighted,
    hasValidLine,
    validationErrors,
    rowErrors,
    forceOpenProductsKey,
    isDirty,
    isSaving,
    isDeleting,
    isEditable,
    canUpdate,
    canClose,
    canDelete,
    dialog,
    targetStage,
    setTargetStage,
    lostReason,
    setLostReason,
    manualWon,
    setManualWon,
    save,
    cancel,
    confirmDiscard,
    confirmOpen360,
    executeAction,
    confirmMoveStage,
    confirmDelete,
    confirmExistingQuotation,
    closeDialog,
    detailsPath,
  } = editor

  const [activeSection, setActiveSection] = useState('general')

  const {
    opportunityName,
    setOpportunityName,
    contactId,
    setContactId,
    lines,
    setLines,
    probability,
    setProbability,
    expectedCloseDate,
    setExpectedCloseDate,
    priority,
    setPriority,
    ownerId,
    setOwnerId,
    productRequirement,
    setProductRequirement,
    locationId,
    setLocationId,
    attachments,
    setAttachments,
  } = form

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
    { label: 'Final Quoted', value: formatCrmCurrency(dealValue), accent: 'green' as const, hint: `${lines.length} line${lines.length === 1 ? '' : 's'} · from products` },
    { label: 'Weighted Forecast', value: formatCrmCurrency(weighted), accent: 'violet' as const, hint: `${probability}% × Final Quoted` },
    { label: 'Expected Close', value: expectedCloseDate ? formatDate(expectedCloseDate) : '—', accent: 'amber' as const, hint: opportunity ? opportunityStageLabel(opportunity.stage) : '—' },
  ], [completionPercent, completionItems, dealValue, lines.length, weighted, probability, expectedCloseDate, opportunity])

  if (!id || !opportunity) {
    return (
      <div className="erp-page flex flex-col items-center justify-center gap-3 p-12 text-center">
        <p className="text-erp-muted">Opportunity not found.</p>
        <AppLink to="/crm/opportunities" className="text-sm font-semibold text-erp-primary">Back to pipeline</AppLink>
      </div>
    )
  }

  if (!isEditable) {
    return (
      <div className="erp-page flex flex-col items-center justify-center gap-3 p-12 text-center">
        <p className="text-erp-muted">Closed deals cannot be edited.</p>
        <AppLink to={detailsPath} className="text-sm font-semibold text-erp-primary">View deal</AppLink>
      </div>
    )
  }

  const opp = opportunity
  const oppId = id

  function scrollToSection(sectionId: string) {
    setActiveSection(sectionId)
    document.getElementById(`opp-section-${sectionId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    void save()
  }

  const contactPhone = customer?.contactPhone ?? ''
  const contactEmail = customer?.contactEmail ?? ''

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
        { id: '360', label: 'View 360', icon: Building2, onClick: () => void executeAction('open360') },
        {
          id: 'quote',
          label: 'Save & Quotation',
          icon: FileText,
          disabled: isSaving || (isDirty && !canUpdate),
          onClick: () => void executeAction('saveAndQuotation'),
        },
      ]}
      moreActions={[
        {
          id: 'move-stage',
          label: 'Move Stage',
          icon: ArrowRightLeft,
          disabled: !canUpdate,
          onClick: () => void executeAction('moveStage'),
        },
        {
          id: 'won',
          label: 'Mark Won',
          icon: CheckCircle2,
          disabled: !canClose,
          onClick: () => void executeAction('markWon'),
        },
        {
          id: 'lost',
          label: 'Mark Lost',
          icon: XCircle,
          danger: true,
          disabled: !canClose,
          onClick: () => void executeAction('markLost'),
        },
        {
          id: 'hold',
          label: 'Put on Hold',
          icon: PauseCircle,
          disabled: !canUpdate || opp.stage === 'on_hold',
          onClick: () => void executeAction('putOnHold'),
        },
        { id: 'duplicate', label: 'Duplicate', icon: Copy, onClick: () => void executeAction('duplicate') },
        { id: 'audit', label: 'View Audit', icon: History, onClick: () => void executeAction('viewAudit') },
        {
          id: 'archive',
          label: 'Archive / Delete',
          icon: Archive,
          danger: true,
          disabled: !canDelete,
          onClick: () => void executeAction('archive'),
        },
        { id: 'activity', label: 'Log Activity', icon: Activity, onClick: () => void executeAction('logActivity') },
        {
          id: 'call',
          label: 'Call',
          icon: Phone,
          disabled: !contactPhone,
          onClick: () => contactPhone && window.open(`tel:${contactPhone}`),
        },
        {
          id: 'email',
          label: 'Email',
          icon: Mail,
          disabled: !contactEmail,
          onClick: () => contactEmail && window.open(`mailto:${contactEmail}`),
        },
      ]}
    />
  )

  const smartInput = {
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
    nextFollowUpDate: opp.nextFollowUpDate,
    isOpen: true,
  }

  const factBox = (
    <CrmSmartOverviewPanel
      ariaLabel="Smart opportunity overview"
      title={opportunityOverviewTitle(smartInput)}
      chips={opportunityOverviewChips(smartInput)}
      meta={[`Stage: ${opportunityStageLabel(opp.stage)}`, `Owner: ${owner.label}`]}
      savedLabel={opp.modifiedAt ? `Last updated ${formatDate(opp.modifiedAt)}` : undefined}
      progressLabel="Deal readiness"
      progressPercent={computeOpportunityCompleteness(smartInput)}
      signals={buildOpportunitySmartSignals(smartInput)}
      nextAction={resolveOpportunityNextBestAction(smartInput)}
      onNextAction={() => {
        const action = resolveOpportunityNextBestAction(smartInput)
        if (action.id === 'create_quotation') {
          void executeAction('saveAndQuotation')
          return
        }
        if (action.id === 'create_so') {
          navigate(buildSalesOrderNewUrl(oppId, undefined, { fromCrm: true }))
          return
        }
        scrollToSection(action.sectionId ?? 'general')
      }}
      quickActions={[
        {
          id: 'save',
          label: isSaving ? 'Saving…' : 'Save',
          icon: Save,
          onClick: () => void executeAction('save'),
          disabled: isSaving || !isDirty || !canUpdate,
        },
        { id: '360', label: 'Deal 360', icon: Building2, onClick: () => void executeAction('open360') },
        {
          id: 'quote',
          label: 'Quotation',
          icon: FileText,
          onClick: () => void executeAction('saveAndQuotation'),
          disabled: !hasValidLine || isSaving || !canUpdate,
        },
        { id: 'activity', label: 'Log Activity', icon: Activity, onClick: () => void executeAction('logActivity') },
      ]}
      keyDetails={buildOpportunityKeyDetails(smartInput)}
      aiInsight={buildOpportunityAiInsight(smartInput)}
    />
  )

  return (
    <>
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
          { label: opp.opportunityNo, to: detailsPath },
          { label: 'Edit' },
        )}
        commandBar={commandBar}
        documentStrip={documentStrip}
        factBox={factBox}
        suppressFactBoxRecord
        collapsibleFactBox
        factBoxLabel="Smart Context"
        onSubmit={handleSubmit}
        onSaveShortcut={() => void executeAction('save')}
        onSaveCloseShortcut={() => void executeAction('saveAndClose')}
        stickyFooter
        footer={(
          <ErpStickySaveBar
            sticky
            isSubmitting={isSaving}
            submitLabel="Save"
            submitDisabled={!isDirty || !canUpdate}
            submitDisabledReason={!canUpdate ? 'No update permission' : !isDirty ? 'No unsaved changes' : undefined}
            onCancel={cancel}
            onSave={() => void executeAction('save')}
            onSaveAndClose={() => void executeAction('saveAndClose')}
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
            dataField="opportunityName"
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
            <Select native value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)} className="erp-input">
              {resolvedPriorities.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </Select>
          </ErpFieldRow>
        </ErpCardSection>

        <ErpCardSection
          id="opp-section-products"
          nbaTarget="products"
          title="Product / Item Lines"
          subtitle="Pick products and set qty, price, and tax per line."
          icon={ClipboardList}
          accent="teal"
          collapsible
          defaultOpen
          forceOpenKey={forceOpenProductsKey || undefined}
        >
          <div className="col-span-3">
            <ErpLineItemsGrid
              lines={lines}
              onChange={setLines}
              productOptions={productOptions}
              productPickMap={productPickMap}
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
            </div>
          </ErpFieldRow>
          <ErpViewField
            label="Weighted Forecast (₹)"
            value={formatCrmCurrency(weighted)}
            hint={`${probability}% × Final Quoted Value`}
          />
          <ErpViewField label="Product Subtotal" value={formatCrmCurrency(summary.basicAmount)} hint="Sum of qty × unit price before discount" />
          <ErpViewField label="Discount" value={summary.totalDiscount > 0 ? formatCrmCurrency(summary.totalDiscount) : '—'} />
          <ErpViewField label="Tax" value={formatCrmCurrency(summary.gstAmount)} hint="GST from product lines" />
          <ErpFieldRow
            label="Expected Close Date"
            required
            dataField="expectedCloseDate"
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
          defaultOpen={attachments.length > 0 || apiMode}
        >
          {apiMode ? (
            <div className="col-span-3">
              <EntityAttachmentsPanel entityType="OPPORTUNITY" entityId={oppId} title="Opportunity attachments" />
            </div>
          ) : (
            <CrmTypedDocumentUpload
              attachments={attachments}
              onChange={setAttachments}
            />
          )}
        </ErpCardSection>
      </CrmCardFormShell>

      {dialog?.type === 'discard' ? (
        <div className="erp-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="opp-discard-title">
          <div className="erp-modal-panel max-w-md">
            <h2 id="opp-discard-title" className="text-[16px] font-semibold text-erp-text">Discard unsaved changes?</h2>
            <p className="mt-2 text-[13px] text-erp-muted">Your edits will be lost if you leave this page.</p>
            <ErpButtonGroup className="mt-5 justify-end">
              <ErpButton type="button" variant="secondary" onClick={closeDialog}>Keep editing</ErpButton>
              <ErpButton type="button" variant="primary" onClick={confirmDiscard}>Discard</ErpButton>
            </ErpButtonGroup>
          </div>
        </div>
      ) : null}

      {dialog?.type === 'open360' ? (
        <div className="erp-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="opp-360-title">
          <div className="erp-modal-panel max-w-md">
            <h2 id="opp-360-title" className="text-[16px] font-semibold text-erp-text">Unsaved changes</h2>
            <p className="mt-2 text-[13px] text-erp-muted">Save before opening Opportunity 360?</p>
            <ErpButtonGroup className="mt-5 justify-end">
              <ErpButton type="button" variant="ghost" onClick={closeDialog}>Cancel</ErpButton>
              <ErpButton type="button" variant="secondary" onClick={() => void confirmOpen360('discard')}>
                Open Without Saving
              </ErpButton>
              <ErpButton type="button" variant="primary" disabled={isSaving} onClick={() => void confirmOpen360('save')}>
                {isSaving ? 'Saving…' : 'Save & Open'}
              </ErpButton>
            </ErpButtonGroup>
          </div>
        </div>
      ) : null}

      {dialog?.type === 'moveStage' ? (
        <div className="crm-opp-move-modal">
          <div className="crm-opp-move-modal__panel">
            <h3 className="crm-opp-move-modal__title">Move deal stage</h3>
            <p className="crm-opp-move-modal__deal">{opportunityName || opp.opportunityName}</p>
            <label className="block text-sm">
              <span className="font-medium text-erp-text">New stage</span>
              <Select
                native
                wrapClassName="mt-1"
                value={targetStage}
                onChange={(e) => setTargetStage(e.target.value as OpportunityStage)}
                className="erp-input"
              >
                {stageOptions.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </Select>
            </label>
            {targetStage === 'lost' ? (
              <LostDealFields className="mt-3" value={lostReason} onChange={setLostReason} />
            ) : null}
            {targetStage === 'won' ? (
              <label className="mt-3 flex items-center gap-2 text-sm text-erp-text">
                <input type="checkbox" checked={manualWon} onChange={(e) => setManualWon(e.target.checked)} />
                Manual win approval
              </label>
            ) : null}
            <div className="crm-opp-move-modal__actions">
              <button type="button" className="crm-opp-move-modal__btn" onClick={closeDialog}>Cancel</button>
              <button type="button" className="crm-opp-move-modal__btn crm-opp-move-modal__btn--primary" onClick={() => void confirmMoveStage()}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {dialog?.type === 'existingQuotation' ? (
        <div className="erp-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="opp-quote-title">
          <div className="erp-modal-panel max-w-md">
            <h2 id="opp-quote-title" className="text-[16px] font-semibold text-erp-text">Quotation already linked</h2>
            <p className="mt-2 text-[13px] text-erp-muted">
              This opportunity already has an active quotation. Open it, or create another from the opportunity.
            </p>
            <ErpButtonGroup className="mt-5 justify-end">
              <ErpButton type="button" variant="ghost" onClick={closeDialog}>Cancel</ErpButton>
              <ErpButton type="button" variant="secondary" onClick={() => confirmExistingQuotation('createNew')}>
                Create new
              </ErpButton>
              <ErpButton type="button" variant="primary" onClick={() => confirmExistingQuotation('openExisting')}>
                Open existing
              </ErpButton>
            </ErpButtonGroup>
          </div>
        </div>
      ) : null}

      <CrmDeleteConfirmModal
        open={dialog?.type === 'delete'}
        title={`Archive ${opp.opportunityName}?`}
        description="This opportunity will be removed from the active pipeline. Historical references may remain for audit."
        confirmLabel="Archive"
        onCancel={closeDialog}
        onConfirm={() => void confirmDelete()}
        isDeleting={isDeleting}
      />
    </>
  )
}
