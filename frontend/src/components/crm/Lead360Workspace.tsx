import { useCallback, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Activity,
  Banknote,
  Building2,
  ClipboardList,
  Paperclip,
} from 'lucide-react'
import { QuickFollowUpDrawer } from '@/components/crm/QuickFollowUpDrawer'
import { LogActivityDrawer } from '@/components/crm/CrmQuickCreateDrawers'
import { LeadHistoryDrawer } from '@/components/crm/LeadHistoryDrawer'
import { CrmUnifiedActivityFeed } from '@/components/crm/CrmUnifiedActivityFeed'
import { CrmDeleteConfirmModal } from '@/components/crm/CrmDeleteConfirmModal'
import { canCrmPermission } from '@/utils/permissions/crm'
import { AppLink } from '@/components/ui/AppLink'
import { Button } from '@/components/ui/Button'
import { Toast } from '@/components/ui/Toast'
import { formatStatus } from '@/components/ui/Badge'
import {
  ErpAdditionalInfoToggle,
  ErpAdditionalInfoPanel,
  ErpAdditionalSectionNav,
  useErpAdditionalInfo,
  ErpViewField,
} from '@/components/erp/card-form'
import { Enterprise360Documents,
  Enterprise360Pipeline,
  Enterprise360RelatedRecords,
  useEnterprise360Keyboard,
} from '@/design-system/workspace360'
import { EntityAttachmentsPanel } from '@/components/crm/shared/EntityAttachmentsPanel'
import { demoNotesFromTexts } from '@/utils/crmEntityNotes'
import { useApiMode } from '@/hooks/useApiMode'
import type { CrmActivity, FollowUp } from '@/types/crm'
import { Lead360RecordHeader } from '@/components/crm/Lead360RecordHeader'
import { LeadChangeStageControl } from '@/components/crm/LeadChangeStageControl'
import { LeadSummaryCard, resolveLeadContactDesignation } from '@/components/crm/LeadSummaryCard'
import { LeadNotesCard } from '@/components/crm/LeadNotesCard'
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
import { leadViewBreadcrumbs } from '@/utils/crmLeadNavigation'
import { resolveSalesOrderDetailPath } from '@/utils/crmSalesOrderNavigation'
import {
  filterActivitiesForLead,
  filterFollowUpsForLead,
  leadEngagementContext,
  linkedOpportunityIdsForLead,
  primaryLinkedOpportunityIdForLead,
} from '@/utils/leadEngagement'
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
  leadPriorityLabel,
  leadStageLabel,
  resolveLeadConvertToOpportunityGate,
} from '@/utils/leadUtils'
import {
  formatMissingStageFieldsMessage,
  getLeadStageCompleteness,
} from '@/config/crmStageRequirements'
import { canOpenLeadEditor, resolveLeadEditPolicy } from '@/utils/leadEditPolicy'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { useProductMasterOptionMap } from '@/utils/opportunityProductOptions'
import { decodeLeadRequirementLines, resolveLeadRequirementLinesRaw } from '@/utils/leadRequirementLines'

export function Lead360Workspace() {
  const apiMode = useApiMode()
  const { id } = useParams()
  const navigate = useNavigate()
  const routes = useLeadRoutes()
  const lead = useLead(id)
  const opportunities = useCrmStore((s) => s.opportunities)
  const activities = useCrmStore((s) => s.activities)
  const followUps = useCrmStore((s) => s.followUps)
  const contacts = useCrmStore((s) => s.contacts)
  const quotations = useSalesStore((s) => s.quotations)
  const salesOrders = useMrpStore((s) => s.salesOrders)
  const invoices = useInvoiceStore((s) => s.invoices)
  const customers = useMasterStore((s) => s.customers)
  const products = useMasterStore((s) => s.products)
  const items = useMasterStore((s) => s.items)
  const uoms = useMasterStore((s) => s.uoms)
  const { options: productOptions, pickMap } = useProductMasterOptionMap(products, items, uoms)
  const advanceLeadStage = useSalesStore((s) => s.advanceLeadStage)
  const archiveLead = useSalesStore((s) => s.archiveLead)

  const [toast, setToast] = useState<string | null>(null)
  const [followUpOpen, setFollowUpOpen] = useState(false)
  const [logActivityOpen, setLogActivityOpen] = useState(false)
  const [editingActivity, setEditingActivity] = useState<CrmActivity | null>(null)
  const [editingFollowUp, setEditingFollowUp] = useState<FollowUp | null>(null)
  const [deleteActivityTarget, setDeleteActivityTarget] = useState<CrmActivity | null>(null)
  const [deleteFollowUpTarget, setDeleteFollowUpTarget] = useState<FollowUp | null>(null)
  const [pendingActivityId, setPendingActivityId] = useState<string | null>(null)
  const [pendingFollowUpId, setPendingFollowUpId] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [activeAdditionalSection, setActiveAdditionalSection] = useState<string | null>('requirement')
  const [notesComposerOpen, setNotesComposerOpen] = useState(false)
  const deleteActivity = useCrmStore((s) => s.deleteActivity)
  const deleteFollowUp = useCrmStore((s) => s.deleteFollowUp)

  const attachmentItems = useLeadAttachmentStore((s) => s.items)
  const leadAttachments = useMemo(
    () => (id ? attachmentItems.filter((a) => a.leadId === id) : []),
    [attachmentItems, id],
  )

  const leadDemoNotes = useMemo(
    () => demoNotesFromTexts([
      {
        label: 'Remarks',
        text: lead?.remarks,
        createdAt: lead?.modifiedAt ?? lead?.createdDate,
        authorName: lead?.leadOwnerName,
      },
      { label: 'Follow-up notes', text: lead?.followUpNotes, authorName: lead?.leadOwnerName },
    ]),
    [lead],
  )

  const customerName = useCallback(
    (customerId: string) => customers.find((c) => c.id === customerId)?.customerName ?? customerId,
    [customers],
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
  const quoteOpportunityId = lead
    ? primaryLinkedOpportunityIdForLead(lead, opportunities)
    : null
  const linkedOpportunity = quoteOpportunityId
    ? opportunities.find((o) => o.id === quoteOpportunityId)
    : undefined
  const customerQuotations = useMemo(
    () => (lead?.customerId ? quotations.filter((q) => q.customerId === lead.customerId).slice(0, 5) : []),
    [quotations, lead?.customerId],
  )
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
      onCreateQuotation: quoteOpportunityId
        ? () => navigate(`/crm/quotations/new?opportunityId=${quoteOpportunityId}`)
        : undefined,
      onCreateOpportunity: lead
        ? () => {
            const gate = resolveLeadConvertToOpportunityGate(lead)
            if (!gate.ok) {
              setToast(gate.reason)
              return
            }
            navigate(`/crm/opportunities/new?customerId=${encodeURIComponent(lead.customerId!)}&leadId=${encodeURIComponent(lead.id)}`)
          }
        : undefined,
    },
    Boolean(lead),
  )

  const nextFollowUpPreview = useMemo(
    () => leadFollowUps.find((f) => f.status === 'pending' || f.status === 'overdue'),
    [leadFollowUps],
  )

  const contactDesignation = useMemo(
    () => (lead ? resolveLeadContactDesignation(lead, contacts) : null),
    [lead, contacts],
  )

  const lastActivity = useMemo(() => {
    if (!leadActivities.length) return null
    const sorted = [...leadActivities].sort((a, b) => b.activityDate.localeCompare(a.activityDate))
    return sorted[0] ?? null
  }, [leadActivities])

  const hasOptionalDetailData = Boolean(
    lead?.remarks?.trim()
    || resolveLeadRequirementLinesRaw(lead?.productRequirement, lead?.remarks)
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
    () =>
      decodeLeadRequirementLines(lead?.productRequirement ?? '', lead?.expectedQty, lead?.remarks).lines.filter(
        (l) => l.productOrItem?.trim(),
      ).length,
    [lead?.productRequirement, lead?.expectedQty, lead?.remarks],
  )

  const additionalSectionItems = useMemo(() => {
    if (!lead) return []
    const commercialDone = lead.expectedValue > 0 && Boolean(lead.expectedCloseDate)
    const attachCount = leadAttachments.length
    const activityCount = leadActivities.length
    const stageLabel = leadStageLabel(lead.stage)
    const statusTone =
      lead.stage === 'qualified' || lead.lifecycleStatus === 'converted'
        ? 'ok' as const
        : 'neutral' as const
    return [
      {
        id: 'requirement',
        label: 'Products',
        status: String(requirementLineCount),
        tone: requirementLineCount > 0 ? 'ok' as const : 'missing' as const,
        icon: ClipboardList,
      },
      {
        id: 'activities',
        label: 'Activities',
        status: String(activityCount),
        tone: activityCount > 0 ? 'ok' as const : 'neutral' as const,
        icon: Activity,
      },
      {
        id: 'documents',
        label: 'Attachments',
        status: String(attachCount),
        tone: attachCount > 0 ? 'ok' as const : 'neutral' as const,
        icon: Paperclip,
      },
      {
        id: 'commercial',
        label: 'Commercial',
        status: commercialDone ? 'Complete' : 'Needs input',
        tone: commercialDone ? 'ok' as const : 'missing' as const,
        icon: Banknote,
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
    lead, requirementLineCount, leadAttachments.length, leadActivities.length,
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
  const editPolicy = resolveLeadEditPolicy(lead)
  const canEdit = canOpenLeadEditor(editPolicy)
  const canConvertOpp = canEdit && editPolicy.mode !== 'limited' && lead.stage === 'qualified' && Boolean(lead.customerId) && !isConverted
  const canClose = canEdit && editPolicy.canChangeStage && lead.stage !== 'closed' && !isConverted

  const {
    stages: pipelineStages,
    currentLabel: pipelineCurrentLabel,
    recordStatusLabel: pipelineRecordStatus,
    statusNote: pipelineStatusNote,
    tone: pipelineTone,
  } = buildLeadCrmPipeline(lead, leadActivities)
  const canChangeStage = editPolicy.canChangeStage && canCrmPermission('crm.lead.update')
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

  function handleArchiveLead() {
    void (async () => {
      const r = await resolveStoreAction(archiveLead(currentLead.id))
      if (r.ok) {
        setToast('Lead archived')
        navigate(routes.base)
      } else {
        setToast(r.error ?? 'Archive failed')
      }
    })()
  }

  const canAddActivity = canCrmPermission('crm.activity.create')
  const canAddFollowUp = canCrmPermission('crm.follow_up.create')
  const canEditActivity = canCrmPermission('crm.activity.update')
  const canDeleteActivity = canCrmPermission('crm.activity.delete')
  const canEditFollowUp = canCrmPermission('crm.follow_up.update')
  const canDeleteFollowUp = canCrmPermission('crm.follow_up.delete')

  function selectAdditionalSection(sectionId: string) {
    const normalized =
      sectionId === 'followup' || sectionId === 'followups' || sectionId === 'notes'
        ? 'activities'
        : sectionId
    setActiveAdditionalSection(normalized)
    window.setTimeout(() => {
      document
        .getElementById(`erp-additional-panel-${normalized}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
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
      ? {
          id: customerOrders[0].id,
          label: customerOrders[0].salesOrderNo,
          href: resolveSalesOrderDetailPath(customerOrders[0].id, true),
          meta: customerOrders[0].status,
        }
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
    hasLinkedOpportunity: Boolean(quoteOpportunityId),
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
      quoteOpportunityId={quoteOpportunityId}
      onEdit={() => navigate(routes.edit(lead.id))}
      onScheduleActivity={() => setFollowUpOpen(true)}
      onCreateQuotation={() => {
        if (!quoteOpportunityId) return
        navigate(`/crm/quotations/new?opportunityId=${quoteOpportunityId}`)
      }}
      onConvert={() => navigate(`/crm/opportunities/new?customerId=${lead.customerId ?? ''}&leadId=${lead.id}`)}
      onLogActivity={() => setLogActivityOpen(true)}
      onViewHistory={() => setHistoryOpen(true)}
      onDuplicate={() => navigate(`${routes.new}?duplicateFrom=${lead.id}`)}
      onArchive={handleArchiveLead}
      onCloseLead={handleCloseLead}
    />
  )

  const factBox = (
    <LeadSmartOverviewPanel
      input={smartOverviewInput}
      onGoToSection={handleSmartOverviewAction}
      onCreateOpportunity={() => {
        const gate = resolveLeadConvertToOpportunityGate(lead)
        if (!gate.ok) {
          setToast(gate.reason)
          return
        }
        navigate(`/crm/opportunities/new?customerId=${encodeURIComponent(lead.customerId!)}&leadId=${encodeURIComponent(lead.id)}`)
      }}
      onCreateQuotation={
        quoteOpportunityId
          ? () => navigate(`/crm/quotations/new?opportunityId=${encodeURIComponent(quoteOpportunityId)}`)
          : undefined
      }
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
        factBoxLabel="Smart Context"
        stickyFooter={false}
      >
        <div className="erp-form-body crm-lead-form-body">

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
            title="Lead Stage"
            stages={pipelineStages}
            currentStageLabel={pipelineCurrentLabel}
            recordStatusLabel={pipelineRecordStatus}
            recordStatusKey="Lead stage"
            funnelStatusKey="Lead stage"
            statusNote={pipelineStatusNote}
            tone={pipelineTone}
            variant="stepper"
            actions={
              canChangeStage ? (
                <LeadChangeStageControl
                  leadId={currentLead.id}
                  currentStage={currentLead.stage}
                  onDone={(msg) => setToast(msg)}
                  onBlocked={(missing, target) => {
                    setToast(formatMissingStageFieldsMessage(missing, leadStageLabel(target)))
                  }}
                />
              ) : null
            }
          />
        </div>

        <LeadSummaryCard
          lead={currentLead}
          customerName={customer ? customer.customerName : null}
          designation={contactDesignation}
          lastActivityAt={lastActivity?.activityDate ?? currentLead.modifiedAt ?? null}
          lastActivityLabel={lastActivity?.subject ?? null}
        />

        <LeadNotesCard
          leadId={currentLead.id}
          currentStage={currentLead.stage}
          demoNotes={leadDemoNotes}
          editPath={routes.edit(currentLead.id)}
          composerOpen={notesComposerOpen}
          onComposerOpenChange={setNotesComposerOpen}
        />

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
            layout="responsive"
            sections={additionalSectionItems}
            activeId={activeAdditionalSection}
            onSelect={selectAdditionalSection}
            title=""
            panels={{
              requirement: (
                <div className="space-y-4">
                  <ErpLineItemsGrid
                    lines={decodeLeadRequirementLines(lead.productRequirement ?? '', lead.expectedQty, lead.remarks).lines}
                    onChange={() => {}}
                    productOptions={productOptions}
                    productPickMap={pickMap}
                    probability={lead.probability ?? 0}
                    variant="opportunity"
                    readOnly
                  />
                  <div className="erp-form-grid erp-form-grid--dense erp-form-grid--cols-3">
                    <ErpViewField label="Industry" value={lead.industry} />
                  </div>
                </div>
              ),
              activities: (
                <CrmUnifiedActivityFeed
                  items={unifiedFeedItems}
                  nextFollowUp={nextFollowUp}
                  leadNextFollowUpDate={lead.nextFollowUpDate}
                  canAddActivity={canAddActivity}
                  canAddFollowUp={canAddFollowUp}
                  canAddNote
                  onLogActivity={() => {
                    setEditingActivity(null)
                    setLogActivityOpen(true)
                  }}
                  onScheduleFollowUp={() => {
                    setEditingFollowUp(null)
                    setFollowUpOpen(true)
                  }}
                  onAddNote={() => {
                    setNotesComposerOpen(true)
                    window.requestAnimationFrame(() => {
                      document.getElementById('lead-section-notes')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    })
                  }}
                  onEditActivity={canEditActivity ? (activity) => {
                    setEditingActivity(activity)
                    setLogActivityOpen(true)
                  } : undefined}
                  onDeleteActivity={canDeleteActivity ? (activity) => setDeleteActivityTarget(activity) : undefined}
                  onEditFollowUp={canEditFollowUp ? (followUp) => {
                    setEditingFollowUp(followUp)
                    setFollowUpOpen(true)
                  } : undefined}
                  onDeleteFollowUp={canDeleteFollowUp ? (followUp) => setDeleteFollowUpTarget(followUp) : undefined}
                  pendingActivityId={pendingActivityId}
                  pendingFollowUpId={pendingFollowUpId}
                />
              ),
              documents: apiMode ? (
                <EntityAttachmentsPanel entityType="LEAD" entityId={lead.id} />
              ) : (
                <Enterprise360Documents
                  documents={attachmentDocs}
                  onUpload={canEdit ? () => navigate(routes.edit(lead.id)) : undefined}
                />
              ),
              commercial: (
                <div className="erp-form-grid erp-form-grid--dense erp-form-grid--cols-3">
                  <ErpViewField label="Expected Revenue (₹)" value={formatCurrency(lead.expectedValue)} />
                  <ErpViewField label="Probability" value={`${lead.probability}%`} />
                  <ErpViewField
                    label="Expected Closing Date"
                    value={lead.expectedCloseDate ? formatDate(lead.expectedCloseDate) : undefined}
                  />
                  <ErpViewField label="Currency" value="INR (₹)" />
                </div>
              ),
              status: (
                <div className="space-y-3">
                  <div className="erp-form-grid erp-form-grid--dense erp-form-grid--cols-3">
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
                  </div>
                  {convertedRecords.length > 0 ? (
                    <Enterprise360RelatedRecords title="Opportunity & Sales" items={convertedRecords} />
                  ) : null}
                  {canEdit && nextStages.length > 0 ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {nextStages.map((stage) => (
                        <Button
                          key={stage}
                          size="sm"
                          onClick={() => {
                            void (async () => {
                              const target = stage as Lead['stage']
                              const missing = getLeadStageCompleteness(currentLead, target).missingFields
                              if (missing.length > 0) {
                                setToast(formatMissingStageFieldsMessage(missing, leadStageLabel(target)))
                                return
                              }
                              const r = await resolveStoreAction(advanceLeadStage(lead.id, target))
                              setToast(r.ok ? `Moved to ${leadStageLabel(target)}` : (r.error ?? 'Failed'))
                            })()
                          }}
                        >
                          Mark {leadStageLabel(stage as Lead['stage'])}
                        </Button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ),
            }}
          />
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
      <QuickFollowUpDrawer
        open={followUpOpen}
        onClose={() => {
          setFollowUpOpen(false)
          setEditingFollowUp(null)
        }}
        context={engagementCtx}
        followUp={editingFollowUp}
      />
      <LogActivityDrawer
        open={logActivityOpen}
        onClose={() => {
          setLogActivityOpen(false)
          setEditingActivity(null)
        }}
        context={{ ...engagementCtx, lockLead: true }}
        activity={editingActivity}
      />
      <CrmDeleteConfirmModal
        open={Boolean(deleteActivityTarget)}
        title="Delete activity?"
        description={deleteActivityTarget ? `"${deleteActivityTarget.subject}" will be removed from this lead’s timeline.` : undefined}
        confirmLabel="Delete activity"
        onCancel={() => setDeleteActivityTarget(null)}
        onConfirm={() => {
          if (!deleteActivityTarget) return
          setPendingActivityId(deleteActivityTarget.id)
          void (async () => {
            try {
              const r = await resolveStoreAction(deleteActivity(deleteActivityTarget.id))
              if (r.ok) {
                setDeleteActivityTarget(null)
                setToast('Activity deleted')
              } else {
                setToast(r.error ?? 'Failed to delete activity')
              }
            } finally {
              setPendingActivityId(null)
            }
          })()
        }}
        isDeleting={pendingActivityId === deleteActivityTarget?.id}
      />
      <CrmDeleteConfirmModal
        open={Boolean(deleteFollowUpTarget)}
        title="Delete follow-up?"
        description={deleteFollowUpTarget
          ? `Follow-up (${deleteFollowUpTarget.followUpType.replace(/_/g, ' ')}) due ${deleteFollowUpTarget.dueDate} will be removed.`
          : undefined}
        confirmLabel="Delete follow-up"
        onCancel={() => setDeleteFollowUpTarget(null)}
        onConfirm={() => {
          if (!deleteFollowUpTarget) return
          setPendingFollowUpId(deleteFollowUpTarget.id)
          void (async () => {
            try {
              const r = await resolveStoreAction(deleteFollowUp(deleteFollowUpTarget.id))
              if (r.ok) {
                setDeleteFollowUpTarget(null)
                setToast('Follow-up deleted')
              } else {
                setToast(r.error ?? 'Failed to delete follow-up')
              }
            } finally {
              setPendingFollowUpId(null)
            }
          })()
        }}
        isDeleting={pendingFollowUpId === deleteFollowUpTarget?.id}
      />
      {toast ? <Toast message={toast} /> : null}
    </>
  )
}
