import { useMemo, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import {
  Activity,
  Archive,
  ArrowRight,
  Banknote,
  Building2,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Copy,
  FileDown,
  FileText,
  Mail,
  MessageCircle,
  Paperclip,
  Pencil,
  Phone,
  Printer,
  ShoppingCart,
  Target,
  Trash2,
  Video,
  XCircle,
} from 'lucide-react'
import { Select } from '../../components/forms/Inputs'
import { AppLink } from '../../components/ui/AppLink'
import { FactBoxPaneAiToggle } from '../../components/erp/card-form/FactBoxPaneAiToggle'
import { CrmCardFormShell } from '@/components/crm/CrmCardFormShell'
import { ENTERPRISE_FORM_DETAIL_CLASS } from '../../design-system/workspace'
import { DynamicsStatusChip } from '../../components/dynamics/DynamicsStatusChip'
import { ErpCardSection, ErpViewField, ErpViewPhone, ErpViewEmail } from '../../components/erp/card-form'
import { ErpCardCommandBar } from '../../components/erp/card-form/ErpCardCommandBar'
import { ErpButton } from '../../components/erp/ErpButton'
import { ErpLineItemsGrid } from '../../components/erp/ErpLineItemsGrid'
import { Button } from '../../components/ui/Button'
import { Toast } from '../../components/ui/Toast'
import {
  QuickFollowUpDrawer,
  QuotationTemplateSelector,
  CreateSalesOrderFromOpportunityAction,
  LogActivityDrawer,
  LostDealFields,
} from '../../components/crm'
import { CrmUnifiedActivityFeed } from '../../components/crm/CrmUnifiedActivityFeed'
import { useCrmStore } from '../../store/crmStore'
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
  resolveOpportunityStages,
} from '../../utils/opportunityUtils'
import { resolveOpportunityLines, calcOpportunityLinesSummary } from '../../utils/opportunityLineCalc'
import { useProductMasterOptionMap } from '../../utils/opportunityProductOptions'
import {
  Enterprise360Pipeline,
  Enterprise360Documents,
} from '../../design-system/workspace360'
import { EntityAttachmentsPanel } from '../../components/crm/shared/EntityAttachmentsPanel'
import { EntityNotesPanel } from '../../components/crm/shared/EntityNotesPanel'
import { OpportunityHistoryPanel } from '../../components/crm/shared/OpportunityHistoryPanel'
import { CrmEntityDetailDrawer } from '../../components/crm/shared/CrmEntityDetailDrawer'
import { demoNotesFromTexts } from '../../utils/crmEntityNotes'
import {
  buildOpportunitySystemEvents,
  buildUnifiedFeed,
} from '../../utils/crmUnifiedFeed'
import type { CrmEntityTypeApi, DemoEntityNote } from '../../types/crmEntity'
import type { CrmActivity, FollowUp } from '../../types/crm'
import { useApiMode } from '@/hooks/useApiMode'
import {
  EnterpriseFormMetrics,
} from '../../design-system/workspace'
import { CrmDeleteConfirmModal } from '../../components/crm/CrmDeleteConfirmModal'
import { canPermission } from '../../utils/permissions'
import { crmBreadcrumbs } from '../../utils/crmNavigation'
import { CrmSmartOverviewPanel } from '@/components/crm/CrmSmartOverviewPanel'
import {
  buildOpportunityAiInsight,
  buildOpportunityKeyDetails,
  buildOpportunitySmartSignals,
  computeOpportunityCompleteness,
  opportunityOverviewChips,
  opportunityOverviewTitle,
  resolveOpportunityNextBestAction,
} from '../../utils/opportunitySmartOverview'

type NotesDetailState = {
  entityType: CrmEntityTypeApi
  entityId: string
  title: string
  subtitle?: string
  demoNotes?: DemoEntityNote[]
} | null

export function Opportunity360Page() {
  const apiMode = useApiMode()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const opportunity = useCrmStore((s) => (id ? s.opportunities.find((o) => o.id === id) : undefined))
  const moveOpportunityStage = useCrmStore((s) => s.moveOpportunityStage)
  const deleteOpportunity = useCrmStore((s) => s.deleteOpportunity)
  const completeActivity = useCrmStore((s) => s.completeActivity)
  const deleteActivity = useCrmStore((s) => s.deleteActivity)
  const activities = useCrmStore((s) => s.activities)
  const followUps = useCrmStore((s) => s.followUps)
  const contacts = useCrmStore((s) => s.contacts)
  const quotationDocuments = useCrmStore((s) => s.quotationDocuments)
  const templates = useCrmStore((s) => s.quotationTemplates)
  const createQuotation = useCrmStore((s) => s.createQuotationFromOpportunity)
  const customers = useMasterStore((s) => s.customers)
  const products = useMasterStore((s) => s.products)
  const items = useMasterStore((s) => s.items)
  const uoms = useMasterStore((s) => s.uoms)
  const getQuotation = useSalesStore((s) => s.getQuotation)
  const attachmentItems = useOpportunityAttachmentStore((s) => s.items)
  const { options: productOptions, pickMap } = useProductMasterOptionMap(products, items, uoms)

  const [toast, setToast] = useState<string | null>(null)
  const [followUpOpen, setFollowUpOpen] = useState(false)
  const [logActivityOpen, setLogActivityOpen] = useState(false)
  const [moveOpen, setMoveOpen] = useState(false)
  const [quoteOpen, setQuoteOpen] = useState(false)
  const [targetStage, setTargetStage] = useState<OpportunityStage>('qualified')
  const [lostReason, setLostReason] = useState('')
  const [manualWon, setManualWon] = useState(false)
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? '')
  const canDelete = canPermission('sales', 'override')
  const canManageActivities = canPermission('sales', 'edit')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [pendingActivityId, setPendingActivityId] = useState<string | null>(null)
  const [deleteActivityTarget, setDeleteActivityTarget] = useState<{ id: string; subject: string } | null>(null)
  const [notesDetail, setNotesDetail] = useState<NotesDetailState>(null)
  const [noteComposerOpen, setNoteComposerOpen] = useState(false)
  const stageOptions = useMemo(() => resolveOpportunityStages(), [])

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
      { label: 'Product requirement', text: opportunity?.productRequirement },
      { label: 'Lost reason', text: opportunity?.lostReason },
    ]),
    [opportunity?.productRequirement, opportunity?.lostReason],
  )
  const unifiedFeedItems = useMemo(
    () => {
      if (!opportunity) return []
      return buildUnifiedFeed({
        activities: oppActivities,
        followUps: oppFollowUps,
        notes: oppDemoNotes,
        systemEvents: buildOpportunitySystemEvents(opportunity),
      })
    },
    [opportunity, oppActivities, oppFollowUps, oppDemoNotes],
  )
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

  if (!opportunity) {
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

  const customer = customers.find((c) => c.id === opp.customerId)
  const contact = opp.contactId ? contacts.find((c) => c.id === opp.contactId) : null
  const contactPhone = contact?.phone || customer?.contactPhone || ''
  const contactEmail = contact?.email || customer?.contactEmail || ''
  const product = products.find((p) => p.id === opp.productId)
  const salesQuo = opp.quotationId ? getQuotation(opp.quotationId) : undefined
  const latestDoc = oppDocs[0]
  const weighted = opp.value * (opp.probability / 100)
  const overdueFu =
    opp.nextFollowUpDate &&
    opp.nextFollowUpDate.slice(0, 10) < new Date().toISOString().slice(0, 10)
  const isOpen = opp.status === 'open'
  const oppLines = resolveOpportunityLines(opp, product)
  const lineSummary = calcOpportunityLinesSummary(oppLines)
  const pipeline = buildOpportunityPipelineStages(opp.stage)
  const dealStatusLabel = opportunityStageLabel(opp.stage)
  const pipelineTone = opp.stage === 'lost' ? 'lost' as const : 'default' as const
  const pipelineStatusNote =
    opp.stage === 'lost'
      ? 'Deal closed as Lost — sales stage stopped.'
      : opp.stage === 'on_hold'
        ? 'Deal is On Hold — progress paused until resumed.'
        : null
  const canChangeOppStage = isOpen && canManageActivities

  function confirmMove() {
    void (async () => {
      const r = await resolveStoreAction(
        moveOpportunityStage({
          opportunityId: opp.id,
          stage: targetStage,
          lostReason: targetStage === 'lost' ? lostReason : undefined,
          manualWonApproval: targetStage === 'won' ? manualWon : undefined,
        }),
      )
      if (r.ok) setMoveOpen(false)
    })()
  }

  function createQuote() {
    void (async () => {
      const r = await resolveStoreAction(createQuotation(opp.id, templateId, opp.value / 1.18))
      if (r.ok && r.documentId) {
        setQuoteOpen(false)
        navigate(`/crm/quotations/${r.quotationId}/editor?doc=${r.documentId}`)
      }
    })()
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
          setToast(r.error ?? 'Delete failed')
        }
      } finally {
        setIsDeleting(false)
        setDeleteOpen(false)
      }
    })()
  }

  function handleCompleteActivity(activity: import('../../types/crm').CrmActivity) {
    setPendingActivityId(activity.id)
    void (async () => {
      try {
        const r = await resolveStoreAction(completeActivity(activity.id, activity.outcome ?? 'Completed'))
        if (!r.ok) setToast(r.error ?? 'Could not complete activity')
      } finally {
        setPendingActivityId(null)
      }
    })()
  }

  function confirmDeleteActivity() {
    if (!deleteActivityTarget) return
    setPendingActivityId(deleteActivityTarget.id)
    void (async () => {
      try {
        const r = await resolveStoreAction(deleteActivity(deleteActivityTarget.id))
        if (r.ok) {
          setDeleteActivityTarget(null)
        } else {
          setToast(r.error ?? 'Delete failed')
        }
      } finally {
        setPendingActivityId(null)
      }
    })()
  }

  function scrollToSection(sectionId: string) {
    const mapped = sectionId === 'followups' || sectionId === 'notes' || sectionId === 'history' ? 'activities' : sectionId
    document.getElementById(`opp-section-${mapped}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const formMetrics = [
    { label: 'Deal Value', value: formatCrmCurrency(opportunity.value), accent: 'green' as const, hint: `${oppLines.length} line${oppLines.length === 1 ? '' : 's'}` },
    { label: 'Weighted Forecast', value: formatCrmCurrency(weighted), accent: 'violet' as const, hint: `${opportunity.probability}% probability` },
    { label: 'Health Score', value: `${opportunity.healthScore}%`, accent: opportunity.healthScore >= 70 ? 'green' as const : opportunity.healthScore >= 40 ? 'amber' as const : 'blue' as const, hint: 'Deal health' },
    { label: 'Expected Close', value: formatDate(opportunity.expectedCloseDate), accent: 'amber' as const, hint: overdueFu ? 'Follow-up overdue' : opportunityStageLabel(opportunity.stage) },
  ]

  const documentStrip = [
    { label: 'Opportunity No.', value: opportunity.opportunityNo, highlight: true },
    { label: 'Status', value: opportunity.status },
    { label: 'Stage', value: opportunityStageLabel(opportunity.stage) },
    { label: 'Owner', value: opportunity.ownerName },
    { label: 'Customer', value: customer?.customerName ?? '—', highlight: Boolean(customer) },
    { label: 'Priority', value: opportunityPriorityLabel(opportunity.priority) },
    { label: 'Deal Value', value: formatCrmCurrency(opportunity.value), highlight: opportunity.value > 0 },
    { label: 'Last Activity', value: opportunity.lastActivityAt ? formatDate(opportunity.lastActivityAt) : '—' },
  ]

  const statusTone = opportunity.stage === 'won' ? 'success' as const : opportunity.stage === 'lost' ? 'critical' as const : 'info' as const

  const commandBar = (
    <ErpCardCommandBar
      inline
      homeActions={[
        ...(isOpen ? [{ id: 'edit', label: 'Edit', icon: Pencil, onClick: () => navigate(`/crm/opportunities/${opportunity.id}/edit`), primary: true }] : []),
        ...(isOpen ? [{ id: 'move-stage', label: 'Move Stage', icon: Target, onClick: () => openMoveStage(opportunity.stage) }] : []),
        { id: 'follow-up', label: 'Schedule Activity', icon: Calendar, onClick: () => setFollowUpOpen(true) },
        ...(isOpen ? [{ id: 'quote', label: 'Create Quotation', icon: FileText, onClick: () => setQuoteOpen(true) }] : []),
        ...(isOpen && !opportunity.salesOrderId ? [{
          id: 'so',
          label: 'Create Sales Order',
          icon: ShoppingCart,
          onClick: () => navigate(`/sales/orders/new?opportunityId=${opportunity.id}${latestDoc ? `&quotationDocumentId=${latestDoc.id}` : ''}`),
        }] : []),
      ]}
      moreActions={[
        { id: 'log', label: 'Log Activity', icon: Activity, onClick: () => setLogActivityOpen(true) },
        { id: 'call', label: 'Call', icon: Phone, onClick: () => (contactPhone ? window.open(`tel:${contactPhone}`) : setLogActivityOpen(true)) },
        { id: 'email', label: 'Email', icon: Mail, onClick: () => (contactEmail ? window.open(`mailto:${contactEmail}`) : setLogActivityOpen(true)) },
        { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, onClick: () => setLogActivityOpen(true) },
        { id: 'meeting', label: 'Meeting', icon: Video, onClick: () => setLogActivityOpen(true) },
        ...(isOpen ? [
          { id: 'won', label: 'Mark as Won', icon: CheckCircle2, onClick: () => openMoveStage('won') },
          { id: 'lost', label: 'Mark as Lost', icon: XCircle, onClick: () => openMoveStage('lost') },
        ] : []),
        ...(opportunity.salesOrderId ? [{
          id: 'view-so',
          label: 'View Sales Order',
          icon: ShoppingCart,
          onClick: () => navigate(`/sales/orders/${opportunity.salesOrderId}`),
        }] : []),
        ...(latestDoc ? [{
          id: 'view-quote',
          label: 'Open Quotation',
          icon: FileText,
          onClick: () => navigate(`/crm/quotations/${latestDoc.quotationId}/editor?doc=${latestDoc.id}`),
        }] : []),
        { id: 'history', label: 'View History', icon: Calendar, onClick: () => scrollToSection('activities') },
        { id: 'duplicate', label: 'Duplicate', icon: Copy, onClick: handleDuplicate },
        { id: 'export', label: 'Export PDF', icon: FileDown, onClick: () => window.print() },
        { id: 'print', label: 'Print', icon: Printer, onClick: () => window.print() },
        { id: 'archive', label: 'Archive', icon: Archive, onClick: () => setToast('Archive — connect to workflow') },
        ...(canDelete ? [{ id: 'delete', label: 'Delete Opportunity', icon: Trash2, onClick: () => setDeleteOpen(true), danger: true }] : []),
        ...(isOpen ? [{ id: 'close', label: 'Mark as Lost', icon: XCircle, onClick: () => openMoveStage('lost'), danger: true }] : []),
      ]}
    />
  )

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
    lineCount: oppLines.length,
    hasValidLine: oppLines.some((l) => l.productOrItem?.trim()),
    expectedCloseDate: opportunity.expectedCloseDate,
    nextFollowUpDate: opportunity.nextFollowUpDate,
    quotationId: opportunity.quotationId,
    salesOrderId: opportunity.salesOrderId,
    healthScore: opportunity.healthScore,
    overdueFollowUp: Boolean(overdueFu),
    isOpen,
    lastSavedLabel: opportunity.modifiedAt ? `Last updated ${formatDate(opportunity.modifiedAt)}` : undefined,
  }

  const nextAction = resolveOpportunityNextBestAction(smartOverviewInput)

  const factBox = (
    <CrmSmartOverviewPanel
      ariaLabel="Smart opportunity overview"
      title={opportunityOverviewTitle(smartOverviewInput)}
      chips={opportunityOverviewChips(smartOverviewInput)}
      meta={[`Stage: ${opportunityStageLabel(opportunity.stage)}`, `Owner: ${opportunity.ownerName}`]}
      savedLabel={smartOverviewInput.lastSavedLabel}
      progressLabel="Deal readiness"
      progressPercent={computeOpportunityCompleteness(smartOverviewInput)}
      signals={buildOpportunitySmartSignals(smartOverviewInput)}
      nextAction={nextAction}
      onNextAction={() => {
        if (nextAction.id === 'schedule_followup') setFollowUpOpen(true)
        else if (nextAction.id === 'create_quotation') setQuoteOpen(true)
        else if (nextAction.id === 'create_so') {
          navigate(`/sales/orders/new?opportunityId=${opportunity.id}${latestDoc ? `&quotationDocumentId=${latestDoc.id}` : ''}`)
        } else if (nextAction.id === 'add_lines') scrollToSection('products')
        else if (nextAction.id === 'set_value') scrollToSection('commercial')
        else if (nextAction.id === 'link_company') scrollToSection('general')
        else scrollToSection('general')
      }}
      quickActions={[
        {
          id: 'edit',
          label: 'Edit',
          icon: Pencil,
          onClick: () => navigate(`/crm/opportunities/${opportunity.id}/edit`),
          disabled: !isOpen,
        },
        {
          id: 'follow-up',
          label: 'Schedule Follow-up',
          icon: Calendar,
          onClick: () => setFollowUpOpen(true),
        },
        {
          id: 'quote',
          label: 'Create Quotation',
          icon: FileText,
          onClick: () => setQuoteOpen(true),
          disabled: !isOpen,
        },
        {
          id: 'activity',
          label: 'Log Activity',
          icon: Activity,
          onClick: () => setLogActivityOpen(true),
        },
      ]}
      keyDetails={buildOpportunityKeyDetails(smartOverviewInput)}
      aiInsight={buildOpportunityAiInsight(smartOverviewInput)}
      footer={
        latestDoc ? (
          <div className="opp-360-convert-card">
            <p className="opp-360-convert-card__label">Sales order</p>
            <CreateSalesOrderFromOpportunityAction
              opportunityId={opportunity.id}
              quotationDocumentId={latestDoc.id}
              size="sm"
              showHint
            />
          </div>
        ) : !opportunity.salesOrderId ? (
          <div className="opp-360-convert-card">
            <p className="opp-360-convert-card__label">Sales order</p>
            <CreateSalesOrderFromOpportunityAction opportunityId={opportunity.id} size="sm" />
          </div>
        ) : null
      }
    />
  )

  return (
    <>
      <CrmCardFormShell
        title={opportunity.opportunityNo}
        badge="CRM"
        className={`${ENTERPRISE_FORM_DETAIL_CLASS} enterprise-workspace--crm-smart-overview`}
        recordNo={opportunity.opportunityNo}
        recordTitle={opportunity.opportunityName}
        status={opportunity.status}
        statusTone={statusTone}
        stage={opportunityStageLabel(opportunity.stage)}
        createdDate={formatDate(opportunity.createdAt)}
        owner={opportunity.ownerName}
        priority={opportunityPriorityLabel(opportunity.priority)}
        company={customer?.customerName}
        lastSaved={opportunity.modifiedAt ? `Last updated ${formatDate(opportunity.modifiedAt)}` : undefined}
        favoritePath={`/crm/opportunities/${opportunity.id}`}
        breadcrumbs={crmBreadcrumbs(
          { label: 'Opportunities', to: '/crm/opportunities' },
          { label: opportunity.opportunityNo },
        )}
        commandBar={commandBar}
        documentStrip={documentStrip}
        factBox={factBox}
        suppressFactBoxRecord
        collapsibleFactBox
        factBoxLabel="Details"
        stickyFooter={false}
      >
              <div className="erp-form-body__toolbar">
                <FactBoxPaneAiToggle />
              </div>

              <EnterpriseFormMetrics metrics={formMetrics} />

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

              <div className="dyn-detail-pipeline">
                <Enterprise360Pipeline
                  title="Sales Stage Tracker"
                  currentStageLabel={dealStatusLabel}
                  recordStatusLabel={dealStatusLabel}
                  recordStatusKey="Deal status"
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

              <ErpCardSection
                id="opp-section-general"
                title="General"
                subtitle="Customer account, contact, and deal identity."
                icon={Building2}
                accent="blue"
                collapsible
                defaultOpen
              >
                <ErpViewField label="Opportunity Name" colSpan={2} value={opportunity.opportunityName} />
                <ErpViewField label="Customer">
                  {customer ? (
                    <AppLink to={`/entity360/customers/${customer.id}`} className="erp-view-field__link">
                      {customer.customerName}
                    </AppLink>
                  ) : undefined}
                </ErpViewField>
                <ErpViewField label="Contact" value={contact?.name ?? customer?.contactPerson} />
                <ErpViewPhone label="Mobile" value={contactPhone} />
                <ErpViewEmail label="Email" value={contactEmail} />
                <ErpViewField label="City" value={customer?.city} />
                <ErpViewField label="Owner" value={opportunity.ownerName} />
                <ErpViewField label="Stage" value={opportunityStageLabel(opportunity.stage)} />
                <ErpViewField label="Priority" value={opportunityPriorityLabel(opportunity.priority)} />
                <ErpViewField label="Product Requirement" colSpan={2} value={opportunity.productRequirement} />
                {product ? (
                  <ErpViewField label="Linked Product" colSpan={2} value={product.productName} />
                ) : null}
              </ErpCardSection>

              <ErpCardSection
                id="opp-section-products"
                title="Product / Item Lines"
                subtitle={`${oppLines.length} line${oppLines.length === 1 ? '' : 's'} · ${formatCrmCurrency(lineSummary.grandTotal)}`}
                icon={ClipboardList}
                accent="teal"
                collapsible
                defaultOpen
              >
                <div className="col-span-3">
                  <ErpLineItemsGrid
                    lines={oppLines}
                    onChange={() => {}}
                    productOptions={productOptions}
                    productPickMap={pickMap}
                    probability={opportunity.probability}
                    readOnly
                    variant="opportunity"
                  />
                </div>
              </ErpCardSection>

              <ErpCardSection
                id="opp-section-commercial"
                title="Commercial"
                subtitle="Deal value, probability, and forecast."
                icon={Banknote}
                accent="green"
                collapsible
                defaultOpen
              >
                <ErpViewField label="Deal Value (₹)" value={formatCrmCurrency(opportunity.value)} />
                <ErpViewField label="Probability" value={`${opportunity.probability}%`} />
                <ErpViewField label="Weighted Value" value={formatCrmCurrency(weighted)} />
                <ErpViewField
                  label="Expected Close Date"
                  value={opportunity.expectedCloseDate ? formatDate(opportunity.expectedCloseDate) : undefined}
                />
                <ErpViewField label="GST Amount" value={formatCrmCurrency(lineSummary.gstAmount)} />
                <ErpViewField label="Grand Total" value={formatCrmCurrency(lineSummary.grandTotal)} />
              </ErpCardSection>

              <ErpCardSection
                id="opp-section-attachments"
                title="Attachments"
                subtitle="Drawings, RFQs, and supporting documents."
                icon={Paperclip}
                accent="slate"
                collapsible
                defaultOpen={opportunityAttachments.length > 0}
              >
                {apiMode ? (
                  <EntityAttachmentsPanel entityType="OPPORTUNITY" entityId={opportunity.id} />
                ) : (
                  <Enterprise360Documents
                    documents={attachmentDocs}
                    onUpload={isOpen ? () => navigate(`/crm/opportunities/${opportunity.id}/edit`) : undefined}
                  />
                )}
              </ErpCardSection>

              <ErpCardSection
                id="opp-section-activities"
                title="Activity Timeline"
                subtitle="One chronological history — activities, notes, follow-ups, and system events."
                icon={Activity}
                accent="amber"
                collapsible
                defaultOpen
              >
                <div className="col-span-2 space-y-3">
                  {noteComposerOpen ? (
                    <div className="crm-unified-feed__composer">
                      <EntityNotesPanel entityType="OPPORTUNITY" entityId={opportunity.id} demoNotes={oppDemoNotes} />
                      <ErpButton type="button" size="sm" variant="ghost" onClick={() => setNoteComposerOpen(false)}>
                        Hide notes editor
                      </ErpButton>
                    </div>
                  ) : null}
                  <CrmUnifiedActivityFeed
                    items={unifiedFeedItems}
                    nextFollowUp={nextFollowUp}
                    leadNextFollowUpDate={opportunity.nextFollowUpDate}
                    canAddActivity={canManageActivities}
                    canAddFollowUp={canManageActivities}
                    canAddNote
                    onLogActivity={() => setLogActivityOpen(true)}
                    onScheduleFollowUp={() => setFollowUpOpen(true)}
                    onAddNote={() => setNoteComposerOpen(true)}
                    onOpenActivityNotes={openActivityNotes}
                    onOpenFollowUpNotes={openFollowUpNotes}
                    onCompleteActivity={canManageActivities ? handleCompleteActivity : undefined}
                    onDeleteActivity={canDelete ? (activity) => setDeleteActivityTarget({ id: activity.id, subject: activity.subject }) : undefined}
                    pendingActivityId={pendingActivityId}
                    systemExtra={
                      apiMode ? (
                        <div className="space-y-2">
                          <p className="text-[12px] font-semibold uppercase tracking-wide text-erp-muted">Detailed change history</p>
                          <OpportunityHistoryPanel opportunityId={opportunity.id} />
                        </div>
                      ) : null
                    }
                  />
                </div>
              </ErpCardSection>

              <ErpCardSection
                id="opp-section-quotations"
                title="Quotations"
                subtitle="Linked quotation documents"
                icon={FileText}
                accent="slate"
                collapsible
                defaultOpen={oppDocs.length > 0}
              >
                <div className="col-span-2 space-y-2">
                  {oppDocs.length === 0 ? (
                    <div className="opp-360-empty-panel">
                      <FileText className="h-8 w-8 text-erp-muted" />
                      <p>No quotation documents linked</p>
                      {isOpen && !opportunity.quotationId ? (
                        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                          <QuotationTemplateSelector templates={templates} value={templateId} onChange={setTemplateId} />
                          <ErpButton type="button" size="sm" onClick={createQuote}>
                            Create quotation
                          </ErpButton>
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
                          <DynamicsStatusChip label={d.status} tone={d.status === 'approved' ? 'success' : d.status === 'draft' ? 'neutral' : 'pending'} />
                        </div>
                        <div className="opp-360-quote-card__tail">
                          <span className="opp-360-quote-card__amount">{formatCrmCurrency(d.totalAmount)}</span>
                          <ArrowRight className="h-4 w-4 text-erp-muted" />
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </ErpCardSection>
      </CrmCardFormShell>

      <QuickFollowUpDrawer
        open={followUpOpen}
        onClose={() => setFollowUpOpen(false)}
        context={{
          customerId: opportunity.customerId,
          contactId: opportunity.contactId,
          opportunityId: opportunity.id,
          assignedTo: opportunity.ownerId,
          assignedToName: opportunity.ownerName,
        }}
      />
      <LogActivityDrawer
        open={logActivityOpen}
        onClose={() => setLogActivityOpen(false)}
        context={{ customerId: opportunity.customerId, contactId: opportunity.contactId, opportunityId: opportunity.id }}
      />
      <CrmEntityDetailDrawer
        open={!!notesDetail}
        onClose={() => setNotesDetail(null)}
        entityType={notesDetail?.entityType ?? 'ACTIVITY'}
        entityId={notesDetail?.entityId ?? null}
        title={notesDetail?.title ?? 'Notes'}
        subtitle={notesDetail?.subtitle}
        demoNotes={notesDetail?.demoNotes}
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
            <div className="crm-opp-move-modal__actions">
              <button type="button" className="crm-opp-move-modal__btn" onClick={() => setMoveOpen(false)}>
                Cancel
              </button>
              <button type="button" className="crm-opp-move-modal__btn crm-opp-move-modal__btn--primary" onClick={confirmMove}>
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
            <label className="block text-sm">
              <span className="font-medium text-erp-text">Template</span>
              <div className="mt-1">
                <QuotationTemplateSelector templates={templates} value={templateId} onChange={setTemplateId} />
              </div>
            </label>
            <div className="crm-opp-move-modal__actions">
              <button type="button" className="crm-opp-move-modal__btn" onClick={() => setQuoteOpen(false)}>
                Cancel
              </button>
              <button type="button" className="crm-opp-move-modal__btn crm-opp-move-modal__btn--primary inline-flex items-center justify-center gap-1.5" onClick={createQuote}>
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
      <CrmDeleteConfirmModal
        open={Boolean(deleteActivityTarget)}
        title="Delete activity?"
        description={deleteActivityTarget ? `"${deleteActivityTarget.subject}" will be removed from the timeline.` : undefined}
        confirmLabel="Delete activity"
        onCancel={() => setDeleteActivityTarget(null)}
        onConfirm={confirmDeleteActivity}
        isDeleting={pendingActivityId === deleteActivityTarget?.id}
      />
      {toast ? <Toast message={toast} /> : null}
    </>
  )
}
