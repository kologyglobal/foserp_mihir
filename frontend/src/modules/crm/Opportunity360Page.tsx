import { useMemo, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import {
  Activity,
  ArrowRight,
  Banknote,
  ClipboardList,
  FileText,
  Paperclip,
  Target,
} from 'lucide-react'
import { Select } from '../../components/forms/Inputs'
import { CrmCardFormShell, ENTERPRISE_FORM_CLASS } from '@/components/crm/CrmCardFormShell'
import { useCrmRecordLoadState } from '@/components/crm/CrmRecordLoadGate'
import { PageLoadingFallback } from '@/components/system/PageLoadingFallback'
import {
  ErpAdditionalInfoToggle,
  ErpAdditionalInfoPanel,
  ErpAdditionalSectionNav,
  useErpAdditionalInfo,
} from '../../components/erp/card-form'
import { ErpButton } from '../../components/erp/ErpButton'
import { ErpLineItemsGrid } from '../../components/erp/ErpLineItemsGrid'
import { Button } from '../../components/ui/Button'
import { DynamicsStatusChip } from '../../components/dynamics/DynamicsStatusChip'
import {
  QuickFollowUpDrawer,
  QuotationTemplateSelector,
  LogActivityDrawer,
  LostDealFields,
} from '../../components/crm'
import { CrmUnifiedActivityFeed } from '../../components/crm/CrmUnifiedActivityFeed'
import { Opportunity360RecordHeader } from '../../components/crm/Opportunity360RecordHeader'
import { OpportunitySummaryCard } from '../../components/crm/OpportunitySummaryCard'
import { CrmStageNotes } from '../../components/crm/shared/CrmStageNotes'
import { OPPORTUNITY_NOTE_STAGE_OPTIONS } from '../../utils/crmNoteStageOptions'
import { OpportunitySmartOverviewPanel } from '../../components/crm/OpportunitySmartOverviewPanel'
import { useCrmStore } from '../../store/crmStore'
import { filterAllowedQuotationTemplates } from '../../utils/quotationEngine/builtinTemplateSync'
import { resolveStoreAction } from '../../store/storeAction'
import { useMasterStore } from '../../store/masterStore'
import { useSalesStore } from '../../store/salesStore'
import { useOpportunityAttachmentStore } from '../../store/opportunityAttachmentStore'
import { formatCrmCurrency } from '../../utils/crmMetrics'
import { formatDate } from '../../utils/dates/format'
import type { OpportunityStage } from '../../types/crm'
import {
  buildOpportunityPipelineStages,
  displayLostReason,
  opportunityPriorityLabel,
  opportunityStageLabel,
} from '../../utils/opportunityUtils'
import { useResolvedOpportunityStages } from '../../hooks/useCrmMasters'
import { resolveOpportunityLines, buildOpportunityCommercialBreakdown } from '../../utils/opportunityLineCalc'
import { OpportunityCommercialBreakdownPanel } from '../../components/crm/OpportunityCommercialBreakdownPanel'
import { useProductMasterOptionMap } from '../../utils/opportunityProductOptions'
import {
  Enterprise360Pipeline,
  Enterprise360Documents,
} from '../../design-system/workspace360'
import { EntityAttachmentsPanel } from '../../components/crm/shared/EntityAttachmentsPanel'
import { OpportunityHistoryPanel } from '../../components/crm/shared/OpportunityHistoryPanel'
import { demoNotesFromTexts, entityNotesToFeedNotes } from '../../utils/crmEntityNotes'
import type { CrmEntityNoteDto } from '../../services/api/crmApi'
import {
  buildOpportunitySystemEvents,
  buildUnifiedFeed,
} from '../../utils/crmUnifiedFeed'
import type { CrmActivity, FollowUp } from '../../types/crm'
import { useApiMode } from '@/hooks/useApiMode'
import { CrmDeleteConfirmModal } from '../../components/crm/CrmDeleteConfirmModal'
import { canCrmPermission } from '../../utils/permissions'
import {
  CREATE_SALES_ORDER_LOCKED_REASON,
  buildSalesOrderNewUrl,
  resolveOpportunityCreateSalesOrderGate,
} from '../../utils/opportunitySalesOrderDraft'
import { resolveOpportunityCreateQuotationGate } from '../../utils/opportunityCreateQuotationGate'
import { findFeaturedQuotationTemplate } from '../../utils/quotationTemplates'
import { crmBreadcrumbs } from '../../utils/crmNavigation'
import { sanitizeOpportunityScopeNotes } from '../../utils/leadRequirementLines'
import { OpportunityQuotationValueMismatchBanner } from '../../components/crm/OpportunityQuotationValueMismatchBanner'
import { notify } from '../../store/toastStore'
import {
  formatMissingStageFieldsMessage,
  getOpportunityStageCompleteness,
} from '@/config/crmStageRequirements'

export function Opportunity360Page() {
  const apiMode = useApiMode()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const opportunity = useCrmStore((s) => (id ? s.opportunities.find((o) => o.id === id) : undefined))
  const moveOpportunityStage = useCrmStore((s) => s.moveOpportunityStage)
  const deleteOpportunity = useCrmStore((s) => s.deleteOpportunity)
  const updateOpportunity = useCrmStore((s) => s.updateOpportunity)
  const completeActivity = useCrmStore((s) => s.completeActivity)
  const activities = useCrmStore((s) => s.activities)
  const followUps = useCrmStore((s) => s.followUps)
  const contacts = useCrmStore((s) => s.contacts)
  const quotationDocuments = useCrmStore((s) => s.quotationDocuments)
  const quotationTemplates = useCrmStore((s) => s.quotationTemplates)
  const templates = useMemo(
    () => filterAllowedQuotationTemplates(quotationTemplates),
    [quotationTemplates],
  )
  const createQuotation = useCrmStore((s) => s.createQuotationFromOpportunity)
  const customers = useMasterStore((s) => s.customers)
  const products = useMasterStore((s) => s.products)
  const items = useMasterStore((s) => s.items)
  const uoms = useMasterStore((s) => s.uoms)
  const getQuotation = useSalesStore((s) => s.getQuotation)
  const attachmentItems = useOpportunityAttachmentStore((s) => s.items)
  const { options: productOptions, pickMap } = useProductMasterOptionMap(
    products,
    items,
    uoms,
    undefined,
    opportunity ? [opportunity.productId, ...(opportunity.lines?.map((l) => l.productId) ?? [])] : undefined,
  )

  const [followUpOpen, setFollowUpOpen] = useState(false)
  const [logActivityOpen, setLogActivityOpen] = useState(false)
  const [editingActivity, setEditingActivity] = useState<CrmActivity | null>(null)
  const [editingFollowUp, setEditingFollowUp] = useState<FollowUp | null>(null)
  const deleteActivity = useCrmStore((s) => s.deleteActivity)
  const deleteFollowUp = useCrmStore((s) => s.deleteFollowUp)
  const [deleteActivityTarget, setDeleteActivityTarget] = useState<CrmActivity | null>(null)
  const [deleteFollowUpTarget, setDeleteFollowUpTarget] = useState<FollowUp | null>(null)
  const [pendingFollowUpId, setPendingFollowUpId] = useState<string | null>(null)
  const [moveOpen, setMoveOpen] = useState(false)
  const [quoteOpen, setQuoteOpen] = useState(false)
  const [targetStage, setTargetStage] = useState<OpportunityStage>('qualified')
  const [lostReason, setLostReason] = useState('')
  const [manualWon, setManualWon] = useState(false)
  const [templateId, setTemplateId] = useState(() => findFeaturedQuotationTemplate(templates)?.id ?? templates[0]?.id ?? '')
  const canDelete = canCrmPermission('crm.opportunity.delete')
  const canClose = canCrmPermission('crm.opportunity.close')
  const canChangeOppStagePerm = canCrmPermission('crm.opportunity.update')
  const canAddActivity = canCrmPermission('crm.activity.create')
  const canEditActivity = canCrmPermission('crm.activity.update')
  const canDeleteActivity = canCrmPermission('crm.activity.delete')
  const canCompleteActivity = canCrmPermission('crm.activity.complete')
  const canAddFollowUp = canCrmPermission('crm.follow_up.create')
  const canEditFollowUp = canCrmPermission('crm.follow_up.update')
  const canDeleteFollowUp = canCrmPermission('crm.follow_up.delete')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [pendingActivityId, setPendingActivityId] = useState<string | null>(null)
  const [noteComposerOpen, setNoteComposerOpen] = useState(false)
  const [activeAdditionalSection, setActiveAdditionalSection] = useState<string | null>('products')
  const stageOptions = useResolvedOpportunityStages()

  const oppActivities = useMemo(
    () => (id ? activities.filter((a) => a.opportunityId === id).sort((a, b) => b.activityDate.localeCompare(a.activityDate)) : []),
    [activities, id],
  )
  const oppFollowUps = useMemo(
    () => (id ? followUps.filter((f) => f.opportunityId === id).sort((a, b) => a.dueDate.localeCompare(b.dueDate)) : []),
    [followUps, id],
  )
  const nextFollowUp = useMemo(
    () => oppFollowUps.find((f) => f.status === 'pending' || f.status === 'overdue') ?? null,
    [oppFollowUps],
  )
  const oppDemoNotes = useMemo(
    () => demoNotesFromTexts([
      {
        label: 'Product requirement',
        text: sanitizeOpportunityScopeNotes(opportunity?.productRequirement),
        createdAt: opportunity?.modifiedAt ?? opportunity?.createdAt,
      },
      {
        label: 'Lost reason',
        text: opportunity?.lostReason,
        createdAt: opportunity?.modifiedAt ?? opportunity?.createdAt,
      },
    ]),
    [opportunity?.productRequirement, opportunity?.lostReason, opportunity?.modifiedAt, opportunity?.createdAt],
  )
  /** API entity notes reported by the Notes card — merged into the unified feed. */
  const [entityNotes, setEntityNotes] = useState<CrmEntityNoteDto[]>([])
  const unifiedFeedItems = useMemo(() => {
    if (!opportunity) return []
    return buildUnifiedFeed({
      activities: oppActivities,
      followUps: oppFollowUps,
      notes: [...oppDemoNotes, ...entityNotesToFeedNotes(entityNotes, opportunityStageLabel)],
      systemEvents: buildOpportunitySystemEvents(opportunity),
    })
  }, [opportunity, oppActivities, oppFollowUps, oppDemoNotes, entityNotes])

  const oppDocs = useMemo(() => {
    if (!opportunity?.quotationId) return []
    return quotationDocuments
      .filter((d) => d.quotationId === opportunity.quotationId)
      .sort((a, b) => b.revisionNo - a.revisionNo)
  }, [quotationDocuments, opportunity?.quotationId])

  const opportunityAttachments = useMemo(
    () => (id ? attachmentItems.filter((a) => a.opportunityId === id) : []),
    [attachmentItems, id],
  )

  const attachmentDocs = useMemo(
    () => opportunityAttachments.map((a) => ({
      id: a.id,
      name: a.fileName,
      type: a.documentTypeName,
      date: formatDate(a.uploadedAt),
    })),
    [opportunityAttachments],
  )

  const lastActivity = useMemo(() => {
    if (!oppActivities.length) return null
    const sorted = [...oppActivities].sort((a, b) => b.activityDate.localeCompare(a.activityDate))
    return sorted[0] ?? null
  }, [oppActivities])

  const productLineCount = useMemo(() => {
    if (!opportunity) return 0
    const product = products.find((p) => p.id === opportunity.productId)
    return resolveOpportunityLines(opportunity, product).filter((l) => l.productOrItem?.trim()).length
  }, [opportunity, products])

  const commercialDone = Boolean(opportunity && opportunity.value > 0 && opportunity.expectedCloseDate)
  const hasOptionalDetailData = Boolean(
    productLineCount > 0
    || opportunityAttachments.length > 0
    || oppActivities.length > 0
    || oppFollowUps.length > 0
    || oppDocs.length > 0
    || commercialDone,
  )

  const {
    open: showAdditionalDetails,
    setOpen: setShowAdditionalDetails,
    toggle: toggleAdditionalDetails,
    panelId: additionalPanelId,
  } = useErpAdditionalInfo({
    preferOpen: hasOptionalDetailData,
  })

  const additionalSectionItems = useMemo(() => {
    if (!opportunity) return []
    return [
      {
        id: 'products',
        label: 'Products',
        status: String(productLineCount),
        tone: productLineCount > 0 ? 'ok' as const : 'missing' as const,
        icon: ClipboardList,
      },
      {
        id: 'activities',
        label: 'Activities',
        status: String(oppActivities.length),
        tone: oppActivities.length > 0 ? 'ok' as const : 'neutral' as const,
        icon: Activity,
      },
      {
        id: 'documents',
        label: 'Attachments',
        status: String(opportunityAttachments.length),
        tone: opportunityAttachments.length > 0 ? 'ok' as const : 'neutral' as const,
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
        id: 'quotations',
        label: 'Quotations',
        status: String(oppDocs.length),
        tone: oppDocs.length > 0 ? 'ok' as const : 'neutral' as const,
        icon: FileText,
      },
    ]
  }, [
    opportunity,
    productLineCount,
    oppActivities.length,
    opportunityAttachments.length,
    commercialDone,
    oppDocs.length,
  ])

  const recordReady = Boolean(opportunity)
  const { showLoader, showNotFound } = useCrmRecordLoadState(recordReady)

  if (showLoader) {
    return <PageLoadingFallback label="Loading opportunity…" />
  }

  if (showNotFound || !opportunity) {
    return (
      <div className="erp-page opp-360-empty flex flex-col items-center justify-center gap-4 p-12 text-center">
        <div className="opp-360-empty__icon">
          <Target className="h-8 w-8 text-erp-primary" />
        </div>
        <p className="text-lg font-semibold text-erp-text">Opportunity not found</p>
        <p className="max-w-sm text-sm text-erp-muted">This deal may have been removed or the link is incorrect.</p>
        <Link to="/crm/opportunities">
          <ErpButton variant="secondary">Back to pipeline</ErpButton>
        </Link>
      </div>
    )
  }

  const opp = opportunity

  const customer = customers.find((c) => c.id === opp.customerId)
  const contact = opp.contactId ? contacts.find((c) => c.id === opp.contactId) : null
  const contactPhone = contact?.phone || customer?.contactPhone || ''
  const contactEmail = contact?.email || customer?.contactEmail || ''
  const product = products.find((p) => p.id === opp.productId)
  const salesQuo = opp.quotationId ? getQuotation(opp.quotationId) : undefined
  const latestDoc = oppDocs[0]
  const isOpen = opp.status === 'open'
  const oppLines = resolveOpportunityLines(opp, product)
  const commercial = buildOpportunityCommercialBreakdown(opp.value, opp.probability, oppLines)
  const weighted = commercial.weightedForecast
  const overdueFu =
    opp.nextFollowUpDate
    && opp.nextFollowUpDate.slice(0, 10) < new Date().toISOString().slice(0, 10)
  const pipeline = buildOpportunityPipelineStages(opp.stage, stageOptions)
  const dealStatusLabel = opportunityStageLabel(opp.stage)
  const pipelineTone = opp.stage === 'lost' ? 'lost' as const : 'default' as const
  const pipelineStatusNote =
    opp.stage === 'lost'
      ? 'Deal closed as Lost — sales stage stopped.'
      : opp.stage === 'on_hold'
        ? 'Deal is On Hold — progress paused until resumed.'
        : null
  const canChangeOppStage = isOpen && canChangeOppStagePerm
  const soGate = resolveOpportunityCreateSalesOrderGate(opp.id, latestDoc?.id)
  const quoteGate = resolveOpportunityCreateQuotationGate(opp.id)
  const favoritePath = `/crm/opportunities/${opp.id}`
  const statusTone = opp.stage === 'won' ? 'success' as const : opp.stage === 'lost' ? 'critical' as const : 'info' as const

  const moveGateEntity = {
    ...opportunity,
    ...(targetStage === 'lost' ? { lostReason } : {}),
  }
  const targetCompleteness = getOpportunityStageCompleteness(moveGateEntity, targetStage)

  function confirmMove() {
    void (async () => {
      if ((targetStage === 'won' || targetStage === 'lost') && !canClose) {
        notify.error('Requires crm.opportunity.close')
        return
      }
      if (!targetCompleteness.isComplete) {
        notify.error(formatMissingStageFieldsMessage(targetCompleteness.missingFields, opportunityStageLabel(targetStage)))
        return
      }
      const r = await resolveStoreAction(
        moveOpportunityStage({
          opportunityId: opp.id,
          stage: targetStage,
          lostReason: targetStage === 'lost' ? lostReason : undefined,
          manualWonApproval: targetStage === 'won' ? manualWon : undefined,
        }),
      )
      if (r.ok) {
        setMoveOpen(false)
      } else {
        notify.error(r.error ?? 'Could not change stage')
      }
    })()
  }

  function createQuote() {
    void (async () => {
      const gate = resolveOpportunityCreateQuotationGate(opp.id)
      if (!gate.enabled) {
        notify.error(gate.disabledReason ?? 'Complete opportunity requirements before creating a quotation.')
        return
      }
      const tpl = templateId || findFeaturedQuotationTemplate(templates)?.id || templates[0]?.id
      if (!tpl) {
        notify.error('Select a quotation template first')
        return
      }
      if (!templateId && tpl) setTemplateId(tpl)
      const unitPrice = opp.value > 0 ? opp.value / 1.18 : (opp.lines?.[0]?.unitPrice ?? 0)
      if (!(unitPrice > 0)) {
        notify.error('Deal value or line unit price must be greater than zero')
        return
      }
      const r = await resolveStoreAction(createQuotation(opp.id, tpl, unitPrice))
      if (r.ok && r.documentId) {
        setQuoteOpen(false)
        notify.success('Quotation created')
        navigate(`/crm/quotations/${r.quotationId}/editor?doc=${r.documentId}`)
        return
      }
      notify.error(r.error ?? 'Could not create quotation')
    })()
  }

  function openCreateQuotation() {
    const gate = resolveOpportunityCreateQuotationGate(opp.id)
    if (!gate.enabled) {
      notify.error(gate.disabledReason ?? 'Complete opportunity requirements before creating a quotation.')
      return
    }
    if (!templateId) {
      const featured = findFeaturedQuotationTemplate(templates)?.id ?? templates[0]?.id ?? ''
      if (featured) setTemplateId(featured)
    }
    setQuoteOpen(true)
  }

  function openMoveStage(stage: OpportunityStage) {
    setTargetStage(stage)
    if (stage !== 'lost') setLostReason('')
    setMoveOpen(true)
  }

  function handleDuplicate() {
    const params = new URLSearchParams({ customerId: opp.customerId })
    if (opp.leadId) params.set('leadId', opp.leadId)
    navigate(`/crm/opportunities/new?${params.toString()}`)
  }

  function confirmDeleteOpportunity() {
    if (!id) return
    setIsDeleting(true)
    void (async () => {
      try {
        const r = await resolveStoreAction(deleteOpportunity(id))
        if (r.ok) {
          navigate('/crm/opportunities')
        } else {
          notify.error(r.error ?? 'Delete failed')
        }
      } finally {
        setIsDeleting(false)
        setDeleteOpen(false)
      }
    })()
  }

  function handleCompleteActivity(activity: CrmActivity) {
    setPendingActivityId(activity.id)
    void (async () => {
      try {
        const r = await resolveStoreAction(completeActivity(activity.id, activity.outcome ?? 'Completed'))
        if (!r.ok) notify.error(r.error ?? 'Could not complete activity')
      } finally {
        setPendingActivityId(null)
      }
    })()
  }

  function selectAdditionalSection(sectionId: string) {
    const normalized =
      sectionId === 'followup' || sectionId === 'followups' || sectionId === 'notes' || sectionId === 'history'
        ? 'activities'
        : sectionId === 'general' || sectionId === 'summary'
          ? 'products'
          : sectionId
    setActiveAdditionalSection(normalized)
    if (!showAdditionalDetails) setShowAdditionalDetails(true)
    window.setTimeout(() => {
      document
        .getElementById(`erp-additional-panel-${normalized}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 40)
  }

  function scrollToSection(sectionId: string) {
    const mapped =
      sectionId === 'general' || sectionId === 'summary' ? 'summary'
        : sectionId === 'followup' || sectionId === 'followups' || sectionId === 'notes' || sectionId === 'history'
          ? 'activities'
          : sectionId === 'attachments' ? 'documents'
            : sectionId

    if (mapped === 'summary') {
      document.getElementById('opp-section-summary')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    if (mapped === 'notes') {
      document.getElementById('opp-section-notes')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    const additionalIds = new Set(additionalSectionItems.map((s) => s.id))
    if (additionalIds.has(mapped)) {
      selectAdditionalSection(mapped)
    }
  }

  const smartOverviewInput = {
    opportunityName: opportunity.opportunityName,
    customerName: customer?.customerName ?? '',
    customerId: opportunity.customerId,
    stage: opportunity.stage,
    priority: opportunity.priority,
    status: opportunity.status,
    ownerName: opportunity.ownerName,
    dealValue: opportunity.value,
    weightedValue: weighted,
    probability: opportunity.probability,
    lineCount: oppLines.length,
    hasValidLine: oppLines.some((l) => l.productOrItem?.trim()),
    expectedCloseDate: opportunity.expectedCloseDate,
    nextFollowUpDate: opportunity.nextFollowUpDate,
    quotationId: opportunity.quotationId,
    salesOrderId: opportunity.salesOrderId,
    healthScore: opportunity.healthScore,
    activityCount: oppActivities.length,
    openFollowUpCount: oppFollowUps.filter((f) => f.status === 'pending' || f.status === 'overdue').length,
    overdueFollowUp: Boolean(overdueFu),
    isOpen,
    canCreateSalesOrder: soGate.enabled,
    createSalesOrderLockedReason: soGate.disabledReason ?? CREATE_SALES_ORDER_LOCKED_REASON,
    canCreateQuotation: quoteGate.enabled,
    createQuotationLockedReason: quoteGate.disabledReason ?? undefined,
    lastSavedLabel: opportunity.modifiedAt ? `Last updated ${formatDate(opportunity.modifiedAt)}` : undefined,
  }

  const commandBar = (
    <Opportunity360RecordHeader
      opportunity={opportunity}
      favoritePath={favoritePath}
      isOpen={isOpen}
      canDelete={canDelete}
      canClose={canClose}
      showCreateSalesOrder={soGate.enabled || Boolean(soGate.salesOrderId)}
      canCreateSalesOrder={soGate.enabled}
      createSalesOrderDisabledReason={soGate.disabledReason}
      canCreateQuotation={quoteGate.enabled}
      createQuotationDisabledReason={quoteGate.disabledReason}
      contactPhone={contactPhone}
      contactEmail={contactEmail}
      onEdit={() => navigate(`/crm/opportunities/${opportunity.id}/edit`)}
      onMoveStage={() => openMoveStage(opportunity.stage)}
      onScheduleActivity={() => setFollowUpOpen(true)}
      onCreateQuotation={openCreateQuotation}
      onCreateSalesOrder={() => {
        if (!soGate.enabled) {
          notify.error(soGate.disabledReason ?? 'Available after customer approval.')
          return
        }
        navigate(buildSalesOrderNewUrl(opportunity.id, soGate.quotationDocumentId, { fromCrm: true }))
      }}
      onLogActivity={() => setLogActivityOpen(true)}
      onMarkWon={() => openMoveStage('won')}
      onMarkLost={() => openMoveStage('lost')}
      onViewHistory={() => selectAdditionalSection('activities')}
      onDuplicate={handleDuplicate}
      onDelete={() => setDeleteOpen(true)}
    />
  )

  const factBox = (
    <OpportunitySmartOverviewPanel
      input={smartOverviewInput}
      onGoToSection={scrollToSection}
      onScheduleFollowUp={() => setFollowUpOpen(true)}
      onCreateQuotation={openCreateQuotation}
      onCreateSalesOrder={() => {
        if (!soGate.enabled) {
          notify.error(soGate.disabledReason ?? 'Available after customer approval.')
          return
        }
        navigate(buildSalesOrderNewUrl(opportunity.id, soGate.quotationDocumentId, { fromCrm: true }))
      }}
      onLogActivity={() => setLogActivityOpen(true)}
    />
  )

  return (
    <>
      <CrmCardFormShell
        title={opportunity.opportunityName}
        badge="CRM"
        className={`crm-opp-form-page crm-lead-form-page crm-lead-form-page--sticky-record ${ENTERPRISE_FORM_CLASS} enterprise-workspace--crm-smart-overview`}
        recordTitle={opportunity.opportunityName}
        status={opportunity.status}
        statusTone={statusTone}
        stage={opportunityStageLabel(opportunity.stage)}
        createdDate={formatDate(opportunity.createdAt)}
        owner={opportunity.ownerName}
        priority={opportunityPriorityLabel(opportunity.priority)}
        company={customer?.customerName}
        lastSaved={opportunity.modifiedAt ? `Last updated ${formatDate(opportunity.modifiedAt)}` : undefined}
        favoritePath={favoritePath}
        breadcrumbs={crmBreadcrumbs(
          { label: 'Opportunities', to: '/crm/opportunities' },
          { label: opportunity.opportunityNo },
        )}
        commandBar={commandBar}
        factBox={factBox}
        suppressFactBoxRecord
        workspaceRecordHeader
        collapsibleFactBox
        factBoxLabel="Smart Context"
        stickyFooter={false}
      >
        <div className="erp-form-body crm-lead-form-body">

          {overdueFu ? (
            <div className="dyn-detail-banner">
              Overdue follow-up due {formatDate(opportunity.nextFollowUpDate!)}. Contact the customer today.
            </div>
          ) : null}

          {opportunity.lostReason ? (
            <div className="dyn-detail-banner dyn-detail-banner--critical">
              Lost reason: {displayLostReason(opportunity.lostReason)}
            </div>
          ) : null}

          {latestDoc ? (
            <OpportunityQuotationValueMismatchBanner
              opportunityId={opportunity.id}
              opportunityValue={opportunity.value}
              quotationGrandTotal={latestDoc.totalAmount}
              documentKey={latestDoc.id}
              canUpdateOpportunity={isOpen}
              onReviewPricing={() => {
                if (opportunity.quotationId) {
                  navigate(`/crm/quotations/${opportunity.quotationId}/editor?doc=${latestDoc.id}`)
                  return
                }
                selectAdditionalSection('quotations')
              }}
              onUpdateOpportunityValue={async () => {
                const r = await resolveStoreAction(
                  updateOpportunity(opportunity.id, { value: latestDoc.totalAmount }),
                )
                if (r.ok) notify.success('Opportunity value updated to match quotation total')
                else notify.error(r.error ?? 'Could not update opportunity value')
              }}
            />
          ) : null}

          <div className="dyn-detail-pipeline">
            <Enterprise360Pipeline
              title="Sales Stage"
              currentStageLabel={dealStatusLabel}
              recordStatusLabel={dealStatusLabel}
              recordStatusKey="Deal stage"
              statusNote={pipelineStatusNote}
              tone={pipelineTone}
              stages={pipeline}
              variant="stepper"
              actions={
                canChangeOppStage ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="lead-change-stage__trigger"
                    onClick={() => openMoveStage(opportunity.stage)}
                  >
                    Change Stage
                  </Button>
                ) : null
              }
            />
          </div>

          <OpportunitySummaryCard
            opportunity={opportunity}
            customerName={customer?.customerName}
            customerId={customer?.id}
            contactName={contact?.name ?? customer?.contactPerson}
            contactPhone={contactPhone}
            contactEmail={contactEmail}
            city={customer?.city}
            productName={product?.productName}
            lastActivityAt={lastActivity?.activityDate ?? opportunity.lastActivityAt ?? opportunity.modifiedAt}
            lastActivityLabel={lastActivity?.subject ?? null}
            dealValueLabel={commercial.dealValueLabel}
            dealValueHint={commercial.dealValueHint}
            dealValue={commercial.estimatedDealValue}
          />

          <CrmStageNotes
            entityType="OPPORTUNITY"
            entityId={opportunity.id}
            sectionId="opp-section-notes"
            stageOptions={
              stageOptions.length > 0
                ? stageOptions.map((s) => ({ code: s.id, label: s.label }))
                : OPPORTUNITY_NOTE_STAGE_OPTIONS
            }
            historyLabel="Opportunity notes history"
            currentStage={opportunity.stage}
            demoNotes={oppDemoNotes}
            editPath={`/crm/opportunities/${opportunity.id}/edit`}
            composerOpen={noteComposerOpen}
            onComposerOpenChange={setNoteComposerOpen}
            onNotesChange={setEntityNotes}
          />

          <ErpAdditionalInfoToggle
            open={showAdditionalDetails}
            onToggle={() => toggleAdditionalDetails()}
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
                products: (
                  <ErpLineItemsGrid
                    lines={oppLines}
                    onChange={() => {}}
                    productOptions={productOptions}
                    productPickMap={pickMap}
                    probability={opportunity.probability}
                    readOnly
                    variant="opportunity"
                  />
                ),
                activities: (
                  <CrmUnifiedActivityFeed
                    items={unifiedFeedItems}
                    nextFollowUp={nextFollowUp}
                    leadNextFollowUpDate={opportunity.nextFollowUpDate}
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
                      setNoteComposerOpen(true)
                      window.requestAnimationFrame(() => {
                        document.getElementById('opp-section-notes')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
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
                    onCompleteActivity={canCompleteActivity ? handleCompleteActivity : undefined}
                    pendingActivityId={pendingActivityId}
                    pendingFollowUpId={pendingFollowUpId}
                    systemExtra={
                      apiMode ? (
                        <div className="space-y-2">
                          <p className="text-[12px] font-semibold uppercase tracking-wide text-erp-muted">
                            Detailed change history
                          </p>
                          <OpportunityHistoryPanel opportunityId={opportunity.id} />
                        </div>
                      ) : null
                    }
                  />
                ),
                documents: apiMode ? (
                  <EntityAttachmentsPanel entityType="OPPORTUNITY" entityId={opportunity.id} />
                ) : (
                  <Enterprise360Documents
                    documents={attachmentDocs}
                    onUpload={isOpen ? () => navigate(`/crm/opportunities/${opportunity.id}/edit`) : undefined}
                  />
                ),
                commercial: (
                  <OpportunityCommercialBreakdownPanel
                    breakdown={commercial}
                    expectedCloseDate={opportunity.expectedCloseDate}
                  />
                ),
                quotations: (
                  <div className="space-y-2">
                    {oppDocs.length === 0 ? (
                      <div className="opp-360-empty-panel">
                        <FileText className="h-8 w-8 text-erp-muted" />
                        <p>No quotation documents linked</p>
                        {isOpen && !opportunity.quotationId ? (
                          <div className="mt-2 flex flex-col items-center gap-2">
                            {!quoteGate.enabled && quoteGate.disabledReason ? (
                              <p className="max-w-md text-center text-[12px] text-amber-800">{quoteGate.disabledReason}</p>
                            ) : null}
                            <div className="flex flex-wrap items-center justify-center gap-2">
                              <QuotationTemplateSelector
                                templates={templates}
                                value={templateId}
                                onChange={setTemplateId}
                                variant="select"
                              />
                              <ErpButton
                                type="button"
                                size="sm"
                                onClick={openCreateQuotation}
                                disabled={!quoteGate.enabled}
                                disabledReason={quoteGate.disabledReason ?? undefined}
                              >
                                Create quotation
                              </ErpButton>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      oppDocs.map((d) => (
                        <button
                          key={d.id}
                          type="button"
                          className="opp-360-quote-card"
                          onClick={() => navigate(`/crm/quotations/${d.quotationId}/editor?doc=${d.id}`)}
                        >
                          <div>
                            <p className="opp-360-quote-card__title">
                              {salesQuo?.quotationNo ?? d.quotationId}
                              <span className="opp-360-quote-card__rev">Rev {d.revisionNo}</span>
                            </p>
                            <DynamicsStatusChip
                              label={d.status}
                              tone={d.status === 'approved' ? 'success' : d.status === 'draft' ? 'neutral' : 'pending'}
                            />
                          </div>
                          <div className="opp-360-quote-card__tail">
                            <span className="opp-360-quote-card__amount">{formatCrmCurrency(d.totalAmount)}</span>
                            <ArrowRight className="h-4 w-4 text-erp-muted" />
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                ),
              }}
            />
          </ErpAdditionalInfoPanel>
        </div>
      </CrmCardFormShell>

      <QuickFollowUpDrawer
        open={followUpOpen}
        onClose={() => {
          setFollowUpOpen(false)
          setEditingFollowUp(null)
        }}
        context={{
          customerId: opportunity.customerId,
          contactId: opportunity.contactId,
          opportunityId: opportunity.id,
          assignedTo: opportunity.ownerId,
          assignedToName: opportunity.ownerName,
        }}
        followUp={editingFollowUp}
      />
      <LogActivityDrawer
        open={logActivityOpen}
        onClose={() => {
          setLogActivityOpen(false)
          setEditingActivity(null)
        }}
        context={{ customerId: opportunity.customerId, contactId: opportunity.contactId, opportunityId: opportunity.id }}
        activity={editingActivity}
      />
      <CrmDeleteConfirmModal
        open={Boolean(deleteActivityTarget)}
        title="Delete activity?"
        description={deleteActivityTarget ? `"${deleteActivityTarget.subject}" will be removed from this opportunity’s timeline.` : undefined}
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
                notify.success('Activity deleted')
              } else {
                notify.error(r.error ?? 'Failed to delete activity')
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
                notify.success('Follow-up deleted')
              } else {
                notify.error(r.error ?? 'Failed to delete follow-up')
              }
            } finally {
              setPendingFollowUpId(null)
            }
          })()
        }}
        isDeleting={pendingFollowUpId === deleteFollowUpTarget?.id}
      />
      {moveOpen ? (
        <div className="crm-opp-move-modal">
          <div className="crm-opp-move-modal__panel">
            <h3 className="crm-opp-move-modal__title">Move deal stage</h3>
            <p className="crm-opp-move-modal__deal">{opportunity.opportunityName}</p>
            <label className="block text-sm">
              <span className="font-medium text-erp-text">New stage</span>
              <Select native wrapClassName="mt-1" value={targetStage} onChange={(e) => setTargetStage(e.target.value as OpportunityStage)} className="erp-input">
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
            {!targetCompleteness.isComplete && targetCompleteness.missingFields.length > 0 ? (
              <p className="mt-3 text-sm text-amber-800">
                {formatMissingStageFieldsMessage(targetCompleteness.missingFields, opportunityStageLabel(targetStage))}
              </p>
            ) : null}
            <div className="crm-opp-move-modal__actions">
              <button type="button" className="crm-opp-move-modal__btn" onClick={() => setMoveOpen(false)}>
                Cancel
              </button>
              <button type="button" className="crm-opp-move-modal__btn crm-opp-move-modal__btn--primary" onClick={confirmMove} disabled={!targetCompleteness.isComplete}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {quoteOpen ? (
        <div className="crm-opp-move-modal">
          <div className="crm-opp-move-modal__panel">
            <h3 className="crm-opp-move-modal__title">Create quotation</h3>
            <p className="crm-opp-move-modal__deal">{opportunity.opportunityName}</p>
            <p className="text-[13px] text-erp-muted">
              {opportunity.quotationId
                ? 'A quotation is already linked — this will create a new document from the selected template.'
                : 'Generate a quotation document from this opportunity using a template.'}
            </p>
            {!quoteGate.enabled && quoteGate.disabledReason ? (
              <p className="mt-2 text-sm text-amber-800">{quoteGate.disabledReason}</p>
            ) : null}
            <label className="block text-sm">
              <span className="font-medium text-erp-text">Template</span>
              <div className="mt-1">
                <QuotationTemplateSelector
                  templates={templates}
                  value={templateId}
                  onChange={setTemplateId}
                  variant="select"
                  label=""
                />
              </div>
            </label>
            <div className="crm-opp-move-modal__actions">
              <button type="button" className="crm-opp-move-modal__btn" onClick={() => setQuoteOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="crm-opp-move-modal__btn crm-opp-move-modal__btn--primary inline-flex items-center justify-center gap-1.5"
                onClick={createQuote}
                disabled={!quoteGate.enabled}
              >
                Create quotation
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <CrmDeleteConfirmModal
        open={deleteOpen}
        title={`Delete ${opportunity.opportunityName}?`}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={confirmDeleteOpportunity}
        isDeleting={isDeleting}
      />
    </>
  )
}
