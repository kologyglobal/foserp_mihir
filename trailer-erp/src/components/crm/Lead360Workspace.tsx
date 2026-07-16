import { useCallback, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Activity,
  Banknote,
  Building2,
  ClipboardList,
  Paperclip,
} from 'lucide-react'
import { FactBoxPaneAiToggle } from '@/components/erp/card-form/FactBoxPaneAiToggle'
import { ErpButton } from '@/components/erp/ErpButton'
import { canPermission } from '@/utils/permissions'
import { QuickFollowUpDrawer } from '@/components/crm/QuickFollowUpDrawer'
import { LogActivityDrawer } from '@/components/crm/CrmQuickCreateDrawers'
import { LeadHistoryDrawer } from '@/components/crm/LeadHistoryDrawer'
import { LeadStageChip } from '@/components/crm/LeadStageChip'
import { CrmUnifiedActivityFeed } from '@/components/crm/CrmUnifiedActivityFeed'
import { AppLink } from '@/components/ui/AppLink'
import { Button } from '@/components/ui/Button'
import { Toast } from '@/components/ui/Toast'
import { formatStatus } from '@/components/ui/Badge'
import { ErpCardSection } from '@/components/erp/card-form/ErpCardSection'
import {
  ErpQuickEntrySection,
  ErpFieldGroup,
  ErpAdditionalInfoToggle,
  ErpAdditionalInfoPanel,
  ErpAdditionalSectionNav,
  useErpAdditionalInfo,
  ErpViewField,
  ErpViewPhone,
  ErpViewEmail,
} from '@/components/erp/card-form'
import {
  Enterprise360Documents,
  Enterprise360Pipeline,
  Enterprise360RelatedRecords,
  useEnterprise360Keyboard,
} from '@/design-system/workspace360'
import { EntityAttachmentsPanel } from '@/components/crm/shared/EntityAttachmentsPanel'
import { EntityNotesPanel } from '@/components/crm/shared/EntityNotesPanel'
import { CrmEntityDetailDrawer } from '@/components/crm/shared/CrmEntityDetailDrawer'
import { demoNotesFromTexts } from '@/utils/crmEntityNotes'
import { useApiMode } from '@/hooks/useApiMode'
import type { CrmEntityTypeApi, DemoEntityNote } from '@/types/crmEntity'
import type { CrmActivity, FollowUp } from '@/types/crm'
import { Lead360RecordHeader } from '@/components/crm/Lead360RecordHeader'
import { LeadChangeStageControl } from '@/components/crm/LeadChangeStageControl'
import { LeadSmartOverviewPanel } from '@/components/crm/LeadSmartOverviewPanel'
import { ErpLineItemsGrid } from '@/components/erp/ErpLineItemsGrid'
import { CrmCardFormShell, ENTERPRISE_FORM_CLASS } from '@/components/crm/CrmCardFormShell'
import { useLeadAttachmentStore } from '@/store/leadAttachmentStore'
import { useLeadRoutes } from '@/hooks/useLeadRoutes'
import { useLead } from '@/hooks/useStableStoreData'
import { useCrmStore } from '@/store/crmStore'
import { useInvoiceStore } from '@/store/invoiceStore'
import { useMasterStore } from '@/store/masterStore'
import { useMrpStore } from '@/store/mrpStore'
import { useSalesStore } from '@/store/salesStore'
import { resolveStoreAction } from '@/store/storeAction'
import type { Lead } from '@/types/sales'
import { entity360CustomerPath } from '@/config/entity360Routes'
import { leadViewBreadcrumbs } from '@/utils/crmLeadNavigation'
import { filterActivitiesForLead, filterFollowUpsForLead, leadEngagementContext, linkedOpportunityIdsForLead } from '@/utils/leadEngagement'
import {
  buildLeadCrmPipeline,
  formatRelationshipAge,
  leadStatusLabel,
  relationshipAgeDays,
} from '@/utils/lead360Utils'
import {
  buildLeadSystemEvents,
  buildLeadUnifiedFeed,
} from '@/utils/crmUnifiedFeed'
import {
  isLeadStageLocked,
  leadPriorityLabel,
  leadStageLabel,
} from '@/utils/leadUtils'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { useProductMasterOptionMap } from '@/utils/opportunityProductOptions'
import { decodeLeadRequirementLines } from '@/utils/leadRequirementLines'
type NotesDetailState = {
  entityType: CrmEntityTypeApi
  entityId: string
  title: string
  subtitle?: string
  demoNotes?: DemoEntityNote[]
} | null

export function Lead360Workspace() {
  const apiMode = useApiMode()
  const { id } = useParams()
  const navigate = useNavigate()
  const routes = useLeadRoutes()
  const lead = useLead(id)
  const opportunities = useCrmStore((s) => s.opportunities)
  const activities = useCrmStore((s) => s.activities)
  const followUps = useCrmStore((s) => s.followUps)
  const quotations = useSalesStore((s) => s.quotations)
  const salesOrders = useMrpStore((s) => s.salesOrders)
  const invoices = useInvoiceStore((s) => s.invoices)
  const customers = useMasterStore((s) => s.customers)
  const products = useMasterStore((s) => s.products)
  const items = useMasterStore((s) => s.items)
  const uoms = useMasterStore((s) => s.uoms)
  const { options: productOptions, pickMap } = useProductMasterOptionMap(products, items, uoms)
  const advanceLeadStage = useSalesStore((s) => s.advanceLeadStage)

  const [toast, setToast] = useState<string | null>(null)
  const [followUpOpen, setFollowUpOpen] = useState(false)
  const [logActivityOpen, setLogActivityOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [activeAdditionalSection, setActiveAdditionalSection] = useState('requirement')
  const [notesDetail, setNotesDetail] = useState<NotesDetailState>(null)
  const [noteComposerOpen, setNoteComposerOpen] = useState(false)

  const attachmentItems = useLeadAttachmentStore((s) => s.items)
  const leadAttachments = useMemo(
    () => (id ? attachmentItems.filter((a) => a.leadId === id) : []),
    [attachmentItems, id],
  )

  const leadDemoNotes = useMemo(
    () => demoNotesFromTexts([
      { label: 'Remarks', text: lead?.remarks, createdAt: lead?.createdDate },
      { label: 'Follow-up notes', text: lead?.followUpNotes },
    ]),
    [lead],
  )

  function openActivityNotes(activity: CrmActivity) {
    setNotesDetail({
      entityType: 'ACTIVITY',
      entityId: activity.id,
      title: activity.subject,
      subtitle: activity.type.replace(/_/g, ' '),
      demoNotes: demoNotesFromTexts([{ label: 'Description', text: activity.description }]),
    })
  }

  function openFollowUpNotes(followUp: FollowUp) {
    setNotesDetail({
      entityType: 'FOLLOW_UP',
      entityId: followUp.id,
      title: followUp.followUpType.replace(/_/g, ' '),
      subtitle: `${followUp.dueDate} · ${followUp.assignedToName}`,
      demoNotes: demoNotesFromTexts([{ label: 'Follow-up notes', text: followUp.notes }]),
    })
  }

  const customerName = useCallback(
    (customerId: string) => customers.find((c) => c.id === customerId)?.customerName ?? customerId,
    [customers],
  )

  const leadOpportunities = useMemo(
    () => (lead ? opportunities.filter((o) => o.leadId === lead.id || o.id === lead.opportunityId) : []),
    [opportunities, lead],
  )
  const linkedOppIds = useMemo(
    () => (lead ? linkedOpportunityIdsForLead(lead, opportunities) : []),
    [lead, opportunities],
  )
  const leadActivities = useMemo(
    () => (lead ? filterActivitiesForLead(lead, activities, linkedOppIds) : []),
    [lead, activities, linkedOppIds],
  )
  const leadFollowUps = useMemo(
    () => (lead ? filterFollowUpsForLead(lead, followUps, linkedOppIds) : []),
    [lead, followUps, linkedOppIds],
  )

  const customer = lead?.customerId ? customers.find((c) => c.id === lead.customerId) : undefined
  const linkedOpportunity = lead?.opportunityId ? opportunities.find((o) => o.id === lead.opportunityId) : undefined
  const customerQuotations = useMemo(
    () => (lead?.customerId ? quotations.filter((q) => q.customerId === lead.customerId).slice(0, 5) : []),
    [quotations, lead?.customerId],
  )
  const leadQuotations = useMemo(() => {
    if (!lead) return []
    const oppIds = new Set(leadOpportunities.map((o) => o.id))
    return quotations.filter((q) => (q.opportunityId && oppIds.has(q.opportunityId)) || q.customerId === lead.customerId)
  }, [quotations, lead, leadOpportunities])
  const customerOrders = useMemo(
    () => (lead?.customerId ? salesOrders.filter((o) => o.customerId === lead.customerId).slice(0, 5) : []),
    [salesOrders, lead?.customerId],
  )
  const customerInvoices = useMemo(
    () => (lead?.customerId ? invoices.filter((i) => i.customerId === lead.customerId).slice(0, 5) : []),
    [invoices, lead?.customerId],
  )

  useEnterprise360Keyboard(
    {
      onEdit: lead ? () => navigate(routes.edit(lead.id)) : undefined,
      onFollowUp: () => setFollowUpOpen(true),
      onCall: lead?.mobile ? () => window.open(`tel:${lead.mobile}`) : () => setLogActivityOpen(true),
      onCreateQuotation: lead?.customerId
        ? () => navigate(`/crm/quotations/new?customerId=${lead.customerId}`)
        : undefined,
      onCreateOpportunity: lead
        ? () => navigate(`/crm/opportunities/new?customerId=${lead.customerId ?? ''}&leadId=${lead.id}`)
        : undefined,
    },
    Boolean(lead),
  )

  const nextFollowUpPreview = useMemo(
    () => leadFollowUps.find((f) => f.status === 'pending' || f.status === 'overdue'),
    [leadFollowUps],
  )

  const hasOptionalDetailData = Boolean(
    lead?.productRequirement?.trim()
    || (lead?.expectedValue ?? 0) > 0
    || lead?.expectedCloseDate
    || lead?.nextFollowUpDate
    || nextFollowUpPreview
    || leadDemoNotes.length > 0
    || leadAttachments.length > 0
    || leadActivities.length > 0
    || leadFollowUps.length > 0
    || lead?.industry
    || customer,
  )

  const {
    open: showAdditionalDetails,
    setOpen: setShowAdditionalDetails,
    toggle: toggleAdditionalDetails,
    panelId: additionalPanelId,
  } = useErpAdditionalInfo({
    preferOpen: hasOptionalDetailData,
  })

  const requirementLineCount = useMemo(
    () => decodeLeadRequirementLines(lead?.productRequirement ?? '', lead?.expectedQty).lines.filter((l) => l.productOrItem?.trim()).length,
    [lead?.productRequirement, lead?.expectedQty],
  )

  const additionalSectionItems = useMemo(() => {
    if (!lead) return []
    const commercialDone = lead.expectedValue > 0 && Boolean(lead.expectedCloseDate)
    const attachCount = leadAttachments.length
    const timelineCount =
      leadActivities.length
      + leadFollowUps.length
      + leadDemoNotes.length
      + 1 // at least Lead Created system event
    const stageLabel = leadStageLabel(lead.stage)
    const statusTone =
      lead.stage === 'qualified' || lead.lifecycleStatus === 'converted'
        ? 'ok' as const
        : 'neutral' as const
    return [
      {
        id: 'requirement',
        label: 'Products',
        status: requirementLineCount > 0
          ? `${requirementLineCount} item${requirementLineCount === 1 ? '' : 's'}`
          : 'Needs input',
        tone: requirementLineCount > 0 ? 'ok' as const : 'missing' as const,
        icon: ClipboardList,
      },
      {
        id: 'commercial',
        label: 'Commercial',
        status: commercialDone ? 'Complete' : 'Needs input',
        tone: commercialDone ? 'ok' as const : 'missing' as const,
        icon: Banknote,
      },
      {
        id: 'activities',
        label: 'Timeline',
        status: `${timelineCount} update${timelineCount === 1 ? '' : 's'}`,
        tone: 'neutral' as const,
        icon: Activity,
      },
      {
        id: 'documents',
        label: 'Attachments',
        status: attachCount > 0
          ? `${attachCount} file${attachCount === 1 ? '' : 's'}`
          : 'No files',
        tone: 'neutral' as const,
        icon: Paperclip,
      },
      {
        id: 'status',
        label: 'Status',
        status: stageLabel,
        tone: statusTone,
        icon: Building2,
      },
    ]
  }, [
    lead, requirementLineCount, leadFollowUps.length,
    leadDemoNotes.length, leadAttachments.length, leadActivities.length,
  ])

  if (!lead) {
    return (
      <div className="erp-page flex flex-col items-center justify-center gap-3 p-12">
        <p className="text-erp-muted">Lead not found.</p>
        <AppLink to={routes.base}>Back to leads</AppLink>
      </div>
    )
  }

  const currentLead = lead

  const isConverted = lead.stage === 'converted_to_opportunity' || lead.lifecycleStatus === 'converted' || Boolean(linkedOpportunity)
  const isClosed = lead.stage === 'closed' || lead.lifecycleStatus === 'closed'
  const nextStages = lead.stage === 'new' ? ['contacted'] : lead.stage === 'contacted' ? ['qualified'] : []
  const engagementCtx = leadEngagementContext(lead)
  const canEdit = !isLeadStageLocked(lead.stage) && !isClosed
  const canConvertOpp = canEdit && lead.stage === 'qualified' && Boolean(lead.customerId) && !isConverted
  const canClose = canEdit && lead.stage !== 'closed' && !isConverted

  const pipelineCtx = {
    hasOpportunity: leadOpportunities.length > 0,
    hasQuotation: leadQuotations.length > 0,
    inNegotiation: linkedOpportunity?.stage === 'negotiation'
      || leadQuotations.some((q) => ['submitted', 'pending_approval', 'approved'].includes(q.status)),
    isWon: lead.stage === 'converted_to_opportunity' || linkedOpportunity?.stage === 'won',
  }
  const {
    stages: pipelineStages,
    currentLabel: pipelineCurrentLabel,
    recordStatusLabel: pipelineRecordStatus,
    statusNote: pipelineStatusNote,
    tone: pipelineTone,
  } = buildLeadCrmPipeline(
    lead,
    leadActivities,
    pipelineCtx,
  )
  const canChangeStage = canEdit && canPermission('sales', 'edit')
  const systemEvents = buildLeadSystemEvents(
    lead,
    customerQuotations.length > 0,
    customerOrders.length > 0,
    customerInvoices.length > 0,
  )
  const unifiedFeedItems = buildLeadUnifiedFeed({
    activities: leadActivities,
    followUps: leadFollowUps,
    notes: leadDemoNotes,
    systemEvents,
  })
  const relAge = formatRelationshipAge(relationshipAgeDays(lead.createdDate))
  const nextFollowUp = nextFollowUpPreview

  const displayName = lead.customerId ? customerName(lead.customerId) : lead.prospectName

  function handleCloseLead() {
    const today = new Date().toISOString().slice(0, 10)
    void (async () => {
      const r = await resolveStoreAction(
        advanceLeadStage(currentLead.id, 'closed', {
          closedDate: today,
          closedReason: 'not_interested',
        }),
      )
      setToast(r.ok ? 'Lead closed' : r.error ?? 'Failed')
    })()
  }

  const canManageActivities = canPermission('sales', 'edit')

  function selectAdditionalSection(sectionId: string) {
    const normalized =
      sectionId === 'followup' || sectionId === 'followups' || sectionId === 'notes'
        ? 'activities'
        : sectionId
    setActiveAdditionalSection(normalized)
    window.setTimeout(() => {
      document.getElementById(`lead-section-${normalized}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 40)
  }

  function scrollToSection(sectionId: string) {
    const mapped =
      sectionId === 'general' ? 'quick'
        : sectionId === 'followup' || sectionId === 'followups' || sectionId === 'notes' ? 'activities'
          : sectionId === 'additional' || sectionId === 'communication' ? 'status'
            : sectionId
    const additionalIds = new Set(additionalSectionItems.map((s) => s.id))
    if (mapped === 'quick') {
      document.getElementById('lead-section-quick')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    if (additionalIds.has(mapped)) {
      if (!showAdditionalDetails) setShowAdditionalDetails(true)
      selectAdditionalSection(mapped)
      return
    }
  }

  const territory = customer?.salesTerritory ?? '—'
  const convertedRecords = [
    linkedOpportunity
      ? { id: linkedOpportunity.id, label: linkedOpportunity.opportunityNo, href: `/crm/opportunities/${linkedOpportunity.id}`, meta: linkedOpportunity.opportunityName }
      : null,
    customerQuotations[0]
      ? { id: customerQuotations[0].id, label: customerQuotations[0].quotationNo, href: `/crm/quotations/${customerQuotations[0].id}`, meta: formatCurrency(customerQuotations[0].pricing.grandTotal) }
      : null,
    customerOrders[0]
      ? { id: customerOrders[0].id, label: customerOrders[0].salesOrderNo, href: `/sales/orders/${customerOrders[0].id}`, meta: customerOrders[0].status }
      : null,
    customerInvoices[0]
      ? { id: customerInvoices[0].id, label: customerInvoices[0].invoiceNo, href: `/invoices/${customerInvoices[0].id}`, meta: formatCurrency(customerInvoices[0].gst.grandTotal) }
      : null,
  ].filter(Boolean) as { id: string; label: string; href: string; meta?: string }[]

  const attachmentDocs = leadAttachments.map((a) => ({
    id: a.id,
    name: a.fileName,
    type: a.documentTypeName,
    date: formatDate(a.uploadedAt),
  }))

  const smartOverviewInput = {
    prospectName: lead.prospectName,
    customerId: lead.customerId,
    contactPerson: lead.contactPerson ?? '',
    mobile: lead.mobile ?? '',
    email: lead.email ?? '',
    productRequirement: lead.productRequirement ?? '',
    remarks: lead.remarks ?? '',
    expectedValue: lead.expectedValue ?? 0,
    expectedCloseDate: lead.expectedCloseDate ?? '',
    nextFollowUpDate: lead.nextFollowUpDate || nextFollowUp?.dueDate || '',
    leadStage: lead.stage,
    lifecycleStatus: lead.lifecycleStatus,
    priority: lead.priority,
    ownerName: lead.leadOwnerName,
    lastSavedLabel: lead.modifiedAt
      ? `Last updated ${formatDate(lead.modifiedAt)}`
      : `Created ${formatDate(lead.createdDate)}`,
  }

  function handleSmartOverviewAction(sectionId: string) {
    if (sectionId === 'followup') {
      setFollowUpOpen(true)
      scrollToSection('activities')
      return
    }
    if (sectionId === 'requirement' || sectionId === 'commercial') {
      scrollToSection(sectionId)
      return
    }
    // Company / contact gaps → edit form (detail view is read-only)
    if (canEdit && lead) {
      navigate(routes.edit(lead.id))
      return
    }
    scrollToSection('general')
  }

  const commandBar = (
    <Lead360RecordHeader
      lead={lead}
      displayName={displayName}
      favoritePath={routes.view(lead.id)}
      canEdit={canEdit}
      canConvert={canConvertOpp}
      canClose={canClose}
      isConverted={isConverted}
      onEdit={() => navigate(routes.edit(lead.id))}
      onScheduleActivity={() => setFollowUpOpen(true)}
      onCreateQuotation={() => navigate(`/crm/quotations/new?customerId=${lead.customerId}`)}
      onConvert={() => navigate(`/crm/opportunities/new?customerId=${lead.customerId ?? ''}&leadId=${lead.id}`)}
      onLogActivity={() => setLogActivityOpen(true)}
      onViewHistory={() => setHistoryOpen(true)}
      onDuplicate={() => navigate(`${routes.new}?duplicateFrom=${lead.id}`)}
      onArchive={() => setToast('Archive — connect to workflow')}
      onCloseLead={handleCloseLead}
    />
  )

  const factBox = (
    <LeadSmartOverviewPanel
      input={smartOverviewInput}
      onGoToSection={handleSmartOverviewAction}
      onCreateOpportunity={() => navigate(`/crm/opportunities/new?customerId=${lead.customerId ?? ''}&leadId=${lead.id}`)}
      onScheduleFollowUp={() => setFollowUpOpen(true)}
      onLogActivity={() => setLogActivityOpen(true)}
    />
  )

  return (
    <>
      <CrmCardFormShell
        title={displayName}
        badge="CRM"
        className={`crm-lead-form-page crm-lead-form-page--sticky-record ${ENTERPRISE_FORM_CLASS} enterprise-workspace--crm-smart-overview`}
        recordTitle={displayName}
        status={leadStatusLabel(lead)}
        statusTone={isConverted ? 'success' : isClosed ? 'critical' : 'info'}
        stage={leadStageLabel(lead.stage)}
        createdDate={formatDate(lead.createdDate)}
        owner={lead.leadOwnerName}
        priority={leadPriorityLabel(lead.priority)}
        company={lead.prospectName}
        lastSaved={lead.modifiedAt ? `Last updated ${formatDate(lead.modifiedAt)}` : undefined}
        favoritePath={routes.view(lead.id)}
        breadcrumbs={leadViewBreadcrumbs(routes)}
        commandBar={commandBar}
        factBox={factBox}
        suppressFactBoxRecord
        workspaceRecordHeader
        collapsibleFactBox
        factBoxLabel="Details"
        stickyFooter={false}
      >
        <div className="erp-form-body crm-lead-form-body">
        <div className="erp-form-body__toolbar">
          <FactBoxPaneAiToggle />
        </div>

        {isConverted ? (
          <div className="dyn-detail-banner dyn-detail-banner--success">
            Lead converted to Opportunity.
            {linkedOpportunity ? (
              <>
                {' '}
                <AppLink to={`/crm/opportunities/${linkedOpportunity.id}`} className="font-semibold underline">
                  Open {linkedOpportunity.opportunityNo}
                </AppLink>
              </>
            ) : null}
          </div>
        ) : null}

        <div className="dyn-detail-pipeline">
          <Enterprise360Pipeline
            title="Sales Stage Tracker"
            stages={pipelineStages}
            currentStageLabel={pipelineCurrentLabel}
            recordStatusLabel={pipelineRecordStatus}
            recordStatusKey="Lead status"
            statusNote={pipelineStatusNote}
            tone={pipelineTone}
            variant="stepper"
            actions={
              canChangeStage ? (
                <LeadChangeStageControl
                  leadId={currentLead.id}
                  currentStage={currentLead.stage}
                  onDone={setToast}
                />
              ) : null
            }
          />
        </div>

        <ErpQuickEntrySection
          id="lead-section-quick"
          title="Quick Entry"
          subtitle="Company, contact, and ownership — expand for products, commercial, and activity."
        >
          <ErpFieldGroup>
            <ErpViewField label="Company / Prospect" colSpan={3} value={lead.prospectName} />
            {lead.customerId ? (
              <ErpViewField label="Customer Master" colSpan={3}>
                <AppLink to={entity360CustomerPath(lead.customerId)} className="erp-view-field__link">
                  {customerName(lead.customerId)}
                </AppLink>
              </ErpViewField>
            ) : null}
          </ErpFieldGroup>

          <ErpFieldGroup label="Contact">
            <ErpViewField label="Contact Person" value={lead.contactPerson} />
            <ErpViewPhone value={lead.mobile} />
            <ErpViewEmail value={lead.email} />
          </ErpFieldGroup>

          <ErpFieldGroup label="Ownership & status">
            <ErpViewField label="Lead Owner" value={lead.leadOwnerName} />
            <ErpViewField label="Lead Source" value={formatStatus(lead.source)} />
            <ErpViewField label="Priority" value={leadPriorityLabel(lead.priority)} />
            <ErpViewField label="Lead Stage">
              <LeadStageChip stage={lead.stage} />
            </ErpViewField>
            <ErpViewField label="Created Date" value={formatDate(lead.createdDate)} />
          </ErpFieldGroup>

          <ErpViewField label="Notes" colSpan={3} value={lead.remarks} className="crm-lead-notes-row" />
        </ErpQuickEntrySection>

        <ErpAdditionalInfoToggle
          open={showAdditionalDetails}
          onToggle={() => {
            toggleAdditionalDetails()
          }}
          panelId={additionalPanelId}
          sectionCount={additionalSectionItems.length}
          attentionCount={additionalSectionItems.filter((s) => s.tone === 'missing').length}
        />

        <ErpAdditionalInfoPanel open={showAdditionalDetails} id={additionalPanelId} scrollOnOpen={false}>
          <ErpAdditionalSectionNav
            sections={additionalSectionItems}
            activeId={activeAdditionalSection}
            onSelect={selectAdditionalSection}
            title=""
          />

          {activeAdditionalSection === 'requirement' ? (
            <ErpCardSection
              id="lead-section-requirement"
              title="Products"
              subtitle="Products and quantities captured for this lead."
              icon={ClipboardList}
              accent="teal"
              columns={3}
            >
              <div className="col-span-3">
                <ErpLineItemsGrid
                  lines={decodeLeadRequirementLines(lead.productRequirement ?? '', lead.expectedQty).lines}
                  onChange={() => {}}
                  productOptions={productOptions}
                  productPickMap={pickMap}
                  probability={lead.probability ?? 0}
                  variant="opportunity"
                  readOnly
                />
              </div>
              <ErpViewField label="Industry" value={lead.industry} />
            </ErpCardSection>
          ) : null}

          {activeAdditionalSection === 'commercial' ? (
            <ErpCardSection
              id="lead-section-commercial"
              title="Commercial"
              subtitle="Revenue estimation and forecasting."
              icon={Banknote}
              accent="green"
              columns={3}
            >
              <ErpViewField label="Expected Revenue (₹)" value={formatCurrency(lead.expectedValue)} />
              <ErpViewField label="Probability" value={`${lead.probability}%`} />
              <ErpViewField
                label="Expected Closing Date"
                value={lead.expectedCloseDate ? formatDate(lead.expectedCloseDate) : undefined}
              />
              <ErpViewField label="Currency" value="INR (₹)" />
            </ErpCardSection>
          ) : null}

          {activeAdditionalSection === 'activities' ? (
            <ErpCardSection
              id="lead-section-activities"
              title="Activity Timeline"
              subtitle="One chronological history — activities, notes, follow-ups, and system events."
              icon={Activity}
              accent="amber"
              columns={1}
            >
              <div className="col-span-3 space-y-3">
                {noteComposerOpen ? (
                  <div className="crm-unified-feed__composer">
                    <EntityNotesPanel entityType="LEAD" entityId={lead.id} demoNotes={leadDemoNotes} />
                    <ErpButton type="button" size="sm" variant="ghost" onClick={() => setNoteComposerOpen(false)}>
                      Hide notes editor
                    </ErpButton>
                  </div>
                ) : null}
                <CrmUnifiedActivityFeed
                  items={unifiedFeedItems}
                  nextFollowUp={nextFollowUp}
                  leadNextFollowUpDate={lead.nextFollowUpDate}
                  canAddActivity={canManageActivities}
                  canAddFollowUp={canManageActivities}
                  canAddNote
                  onLogActivity={() => setLogActivityOpen(true)}
                  onScheduleFollowUp={() => setFollowUpOpen(true)}
                  onAddNote={() => setNoteComposerOpen(true)}
                  onOpenActivityNotes={openActivityNotes}
                  onOpenFollowUpNotes={openFollowUpNotes}
                />
              </div>
            </ErpCardSection>
          ) : null}

          {activeAdditionalSection === 'documents' ? (
            <ErpCardSection
              id="lead-section-documents"
              title="Attachments"
              subtitle="Drawings, RFQs, and supporting documents."
              icon={Paperclip}
              accent="slate"
              columns={1}
            >
              {apiMode ? (
                <EntityAttachmentsPanel entityType="LEAD" entityId={lead.id} />
              ) : (
                <Enterprise360Documents
                  documents={attachmentDocs}
                  onUpload={canEdit ? () => navigate(routes.edit(lead.id)) : undefined}
                />
              )}
            </ErpCardSection>
          ) : null}

          {activeAdditionalSection === 'status' ? (
            <ErpCardSection
              id="lead-section-status"
              title="Status & reference"
              subtitle="Territory, lifecycle, and related commercial records."
              icon={Building2}
              accent="violet"
              columns={3}
            >
              <ErpViewField label="Territory" value={territory} />
              <ErpViewField label="Lifecycle" value={formatStatus(lead.lifecycleStatus)} />
              <ErpViewField label="Activity Status" value={formatStatus(lead.activityStatus)} />
              <ErpViewField label="Relationship Age" value={relAge} />
              {customer ? (
                <ErpViewField
                  label="Address"
                  colSpan={3}
                  value={`${customer.addressLine1}, ${customer.city} ${customer.pincode}`}
                />
              ) : null}
              {customer?.gstin ? (
                <ErpViewField label="GST" value={customer.gstin} />
              ) : null}

              {convertedRecords.length > 0 ? (
                <div className="col-span-3">
                  <Enterprise360RelatedRecords title="Opportunity & Sales" items={convertedRecords} />
                </div>
              ) : null}

              {canEdit && nextStages.length > 0 ? (
                <div className="col-span-3 flex flex-wrap gap-2 pt-2">
                  {nextStages.map((stage) => (
                    <Button
                      key={stage}
                      size="sm"
                      onClick={() => {
                        void (async () => {
                          const r = await resolveStoreAction(advanceLeadStage(lead.id, stage as Lead['stage']))
                          setToast(r.ok ? `Moved to ${leadStageLabel(stage as Lead['stage'])}` : r.error ?? 'Failed')
                        })()
                      }}
                    >
                      Mark {leadStageLabel(stage as Lead['stage'])}
                    </Button>
                  ))}
                </div>
              ) : null}
            </ErpCardSection>
          ) : null}
        </ErpAdditionalInfoPanel>
        </div>
      </CrmCardFormShell>

      <LeadHistoryDrawer
        open={historyOpen}
        lead={lead}
        leadViewPath={routes.view(lead.id)}
        onClose={() => setHistoryOpen(false)}
        onScheduleFollowUp={() => { setHistoryOpen(false); setFollowUpOpen(true) }}
        onLogActivity={() => { setHistoryOpen(false); setLogActivityOpen(true) }}
      />
      <QuickFollowUpDrawer open={followUpOpen} onClose={() => setFollowUpOpen(false)} context={engagementCtx} />
      <LogActivityDrawer open={logActivityOpen} onClose={() => setLogActivityOpen(false)} context={{ ...engagementCtx, lockLead: true }} />
      <CrmEntityDetailDrawer
        open={!!notesDetail}
        onClose={() => setNotesDetail(null)}
        entityType={notesDetail?.entityType ?? 'ACTIVITY'}
        entityId={notesDetail?.entityId ?? null}
        title={notesDetail?.title ?? 'Notes'}
        subtitle={notesDetail?.subtitle}
        demoNotes={notesDetail?.demoNotes}
      />
      {toast ? <Toast message={toast} /> : null}
    </>
  )
}
