import { useMemo, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import {
  Activity,
  Banknote,
  CheckCircle,
  ClipboardList,
  FileText,
  GitBranch,
  Paperclip,
} from 'lucide-react'
import {
  ErpAdditionalInfoToggle,
  ErpAdditionalInfoPanel,
  ErpAdditionalSectionNav,
  useErpAdditionalInfo,
} from '../../components/erp/card-form'
import { CrmCardFormShell, ENTERPRISE_FORM_CLASS } from '@/components/crm/CrmCardFormShell'
import { Quotation360RecordHeader } from '@/components/quotations/Quotation360RecordHeader'
import { QuotationSummaryCard } from '@/components/quotations/QuotationSummaryCard'
import { CrmStageNotes } from '@/components/crm/shared/CrmStageNotes'
import { QuotationSmartOverviewPanel } from '@/components/quotations/QuotationSmartOverviewPanel'
import { crmBreadcrumbs } from '../../utils/crmNavigation'
import { formatDate } from '../../utils/dates/format'
import { useCrmStore } from '../../store/crmStore'
import { resolveStoreAction } from '../../store/storeAction'
import { useSalesStore } from '../../store/salesStore'
import { useMasterStore } from '../../store/masterStore'
import { notify } from '@/store/toastStore'
import { systemPrompt } from '@/utils/systemConfirm'
import {
  QuotationLineItemsEditor,
  QuotationApprovalPanel,
  QuotationRevisionHistory,
  QuotationWorkflowStepper,
  QuotationCommercialSummary,
  QuotationSectionList,
  quotationStatusLabel,
  quotationRevisionLabel,
} from '@/components/quotations'
import { QuickFollowUpDrawer, LogActivityDrawer } from '@/components/crm'
import { CrmUnifiedActivityFeed } from '@/components/crm/CrmUnifiedActivityFeed'
import { CrmDeleteConfirmModal } from '@/components/crm/CrmDeleteConfirmModal'
import { EntityAttachmentsPanel } from '../../components/crm/shared/EntityAttachmentsPanel'
import { demoNotesFromTexts, entityNotesToFeedNotes } from '../../utils/crmEntityNotes'
import { opportunityRequirementDisplay } from '../../utils/leadRequirementLines'
import { QUOTATION_NOTE_STAGE_OPTIONS, quotationNoteStageLabel } from '@/utils/crmNoteStageOptions'
import type { CrmEntityNoteDto } from '../../services/api/crmApi'
import type { CrmActivity, FollowUp, QuotationDocumentStatus } from '../../types/crm'
import { ErpButton } from '../../components/erp/ErpButton'
import { Enterprise360Documents } from '../../design-system/workspace360'
import { useQuotationAttachmentStore } from '../../store/quotationAttachmentStore'
import { useApiMode } from '../../hooks/useApiMode'
import { resolveCreateSalesOrderGateForQuotationDocument } from '../../utils/opportunitySalesOrderDraft'
import { resolveSalesOrderDetailPath } from '../../utils/crmSalesOrderNavigation'
import { resolveQuotationRevisionPolicy } from '../../utils/quotationRevisionPolicy'
import { OpportunityQuotationValueMismatchBanner } from '../../components/crm/OpportunityQuotationValueMismatchBanner'
import { buildUnifiedFeed } from '../../utils/crmUnifiedFeed'
import { canCrmPermission } from '../../utils/permissions/crm'
import { isQuotationDeletableStatus } from '../../utils/quotationDeletePolicy'
import { useQuotationConversion } from '../crm/hooks/useQuotationConversion'
import { QuotationConversionDialog } from '@/components/quotations/QuotationConversionDialog'
import { useCrmRecordLoadState } from '@/components/crm/CrmRecordLoadGate'
import { PageLoadingFallback } from '@/components/system/PageLoadingFallback'

function mapStatusTone(
  status: QuotationDocumentStatus,
): 'neutral' | 'info' | 'success' | 'warning' | 'critical' {
  if (status === 'approved' || status === 'converted' || status === 'sent') return 'success'
  if (status === 'rejected') return 'critical'
  if (status === 'pending_approval' || status === 'draft') return 'warning'
  return 'info'
}

export function Quotation360Page() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const apiMode = useApiMode()
  const allDocs = useCrmStore((s) => s.quotationDocuments)
  const getLatest = useCrmStore((s) => s.getLatestQuotationDocument)
  const opportunities = useCrmStore((s) => s.opportunities)
  const contacts = useCrmStore((s) => s.contacts)
  const activities = useCrmStore((s) => s.activities)
  const followUps = useCrmStore((s) => s.followUps)
  const deleteActivity = useCrmStore((s) => s.deleteActivity)
  const deleteFollowUp = useCrmStore((s) => s.deleteFollowUp)
  const submitForApproval = useCrmStore((s) => s.submitQuotationDocumentForApproval)
  const markSent = useCrmStore((s) => s.markQuotationDocumentSent)
  const approveDocument = useCrmStore((s) => s.approveQuotationDocument)
  const recallQuotationDocument = useCrmStore((s) => s.recallQuotationDocumentFromApproval)
  const customerApproveDocument = useCrmStore((s) => s.customerApproveQuotationDocument)
  const createRevision = useCrmStore((s) => s.createQuotationRevision)
  const deleteQuotation = useCrmStore((s) => s.deleteQuotation)
  const updateOpportunity = useCrmStore((s) => s.updateOpportunity)
  const getQuotation = useSalesStore((s) => s.getQuotation)
  const customers = useMasterStore((s) => s.customers)
  const products = useMasterStore((s) => s.products)
  const attachmentItems = useQuotationAttachmentStore((s) => s.items)

  const [activeAdditionalSection, setActiveAdditionalSection] = useState<string | null>('products')
  const [followUpOpen, setFollowUpOpen] = useState(false)
  const [logActivityOpen, setLogActivityOpen] = useState(false)
  const [noteComposerOpen, setNoteComposerOpen] = useState(false)
  const [editingActivity, setEditingActivity] = useState<CrmActivity | null>(null)
  const [editingFollowUp, setEditingFollowUp] = useState<FollowUp | null>(null)
  const [deleteActivityTarget, setDeleteActivityTarget] = useState<CrmActivity | null>(null)
  const [deleteFollowUpTarget, setDeleteFollowUpTarget] = useState<FollowUp | null>(null)
  const [deleteQuotationOpen, setDeleteQuotationOpen] = useState(false)
  const [deletingQuotation, setDeletingQuotation] = useState(false)
  const [pendingActivityId, setPendingActivityId] = useState<string | null>(null)
  const [pendingFollowUpId, setPendingFollowUpId] = useState<string | null>(null)
  const [actionBusy, setActionBusy] = useState(false)
  const canAddActivity = canCrmPermission('crm.activity.create')
  const canAddFollowUp = canCrmPermission('crm.follow_up.create')
  const canEditActivity = canCrmPermission('crm.activity.update')
  const canDeleteActivity = canCrmPermission('crm.activity.delete')
  const canEditFollowUp = canCrmPermission('crm.follow_up.update')
  const canDeleteFollowUp = canCrmPermission('crm.follow_up.delete')
  const canDeleteQuotationPerm = canCrmPermission('crm.quotation.delete')
  const conversion = useQuotationConversion()

  const doc = id ? getLatest(id) : undefined
  const quoDocs = useMemo(
    () => (id ? allDocs.filter((d) => d.quotationId === id).sort((a, b) => b.revisionNo - a.revisionNo) : []),
    [allDocs, id],
  )
  const quotation = id ? getQuotation(id) : undefined
  const customer = quotation ? customers.find((c) => c.id === quotation.customerId) : undefined
  const product = quotation ? products.find((p) => p.id === quotation.productId) : undefined
  const opportunity = doc?.opportunityId ? opportunities.find((o) => o.id === doc.opportunityId) : undefined
  const contact = doc?.contactId ? contacts.find((c) => c.id === doc.contactId) : undefined

  const quoActivities = useMemo(
    () => (id
      ? activities
        .filter((a) => a.quotationId === id || (doc?.opportunityId && a.opportunityId === doc.opportunityId))
        .sort((a, b) => b.activityDate.localeCompare(a.activityDate))
        .slice(0, 8)
      : []),
    [activities, id, doc?.opportunityId],
  )

  const quoFollowUps = useMemo(
    () => (id
      ? followUps
        .filter((f) => f.quotationId === id || (doc?.opportunityId && f.opportunityId === doc.opportunityId))
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
        .slice(0, 8)
      : []),
    [followUps, id, doc?.opportunityId],
  )

  const lastActivity = useMemo(() => {
    if (!quoActivities.length) return null
    return [...quoActivities].sort((a, b) => b.activityDate.localeCompare(a.activityDate))[0] ?? null
  }, [quoActivities])

  const quoDemoNotes = useMemo(
    // opportunityRequirementDisplay: legacy docs stored the encoded <!--fos-lead-lines--> payload here.
    () => demoNotesFromTexts([
      { label: 'Commercial notes', text: opportunityRequirementDisplay(doc?.commercialNotes) },
      { label: 'Technical notes', text: opportunityRequirementDisplay(doc?.technicalNotes) },
    ]),
    [doc?.commercialNotes, doc?.technicalNotes],
  )
  /** API entity notes reported by the Notes card — merged into the unified feed. */
  const [entityNotes, setEntityNotes] = useState<CrmEntityNoteDto[]>([])

  const nextQuoFollowUp = useMemo(
    () => quoFollowUps.find((f) => f.status === 'pending' || f.status === 'overdue') ?? null,
    [quoFollowUps],
  )

  const unifiedFeedItems = useMemo(
    () => buildUnifiedFeed({
      activities: quoActivities,
      followUps: quoFollowUps,
      notes: [...quoDemoNotes, ...entityNotesToFeedNotes(entityNotes, quotationNoteStageLabel)],
      systemEvents: doc
        ? [{ id: 'created', label: 'Quotation Document', date: doc.createdAt?.slice(0, 10) || doc.modifiedAt?.slice(0, 10) || new Date().toISOString().slice(0, 10) }]
        : [],
    }),
    [quoActivities, quoFollowUps, quoDemoNotes, entityNotes, doc],
  )

  const quotationAttachments = useMemo(
    () => (id ? attachmentItems.filter((a) => a.quotationId === id) : []),
    [attachmentItems, id],
  )

  const attachmentDocs = useMemo(
    () => quotationAttachments.map((a) => ({
      id: a.id,
      name: a.fileName,
      type: a.documentTypeName,
      date: formatDate(a.uploadedAt),
    })),
    [quotationAttachments],
  )

  const lineCount = doc?.priceLines.length ?? 0
  const commercialDone = Boolean(doc && doc.totalAmount > 0 && quotation?.validityDate)
  const hasOptionalDetailData = Boolean(
    lineCount > 0
    || quotationAttachments.length > 0
    || quoActivities.length > 0
    || quoFollowUps.length > 0
    || quoDocs.length > 1
    || commercialDone
    || (doc?.sections.length ?? 0) > 0
    || (doc?.approvalHistory.length ?? 0) > 0,
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
    if (!doc) return []
    return [
      {
        id: 'products',
        label: 'Line items',
        status: String(lineCount),
        tone: lineCount > 0 ? 'ok' as const : 'missing' as const,
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
        id: 'sections',
        label: 'Sections',
        status: String(doc.sections.length),
        tone: doc.sections.length > 0 ? 'ok' as const : 'neutral' as const,
        icon: FileText,
      },
      {
        id: 'activities',
        label: 'Activities',
        status: String(quoActivities.length + quoFollowUps.length),
        tone: quoActivities.length > 0 || quoFollowUps.length > 0 ? 'ok' as const : 'neutral' as const,
        icon: Activity,
      },
      {
        id: 'documents',
        label: 'Attachments',
        status: String(quotationAttachments.length),
        tone: quotationAttachments.length > 0 ? 'ok' as const : 'neutral' as const,
        icon: Paperclip,
      },
      {
        id: 'revisions',
        label: 'Revisions',
        status: String(quoDocs.length),
        tone: quoDocs.length > 1 ? 'ok' as const : 'neutral' as const,
        icon: GitBranch,
      },
      {
        id: 'approval',
        label: 'Approval',
        status: doc.approvalHistory.length > 0 ? 'History' : quotationStatusLabel(doc.status),
        tone: doc.status === 'approved' || doc.status === 'converted'
          ? 'ok' as const
          : doc.status === 'pending_approval' ? 'missing' as const : 'neutral' as const,
        icon: CheckCircle,
      },
    ]
  }, [
    doc,
    lineCount,
    commercialDone,
    quoActivities.length,
    quoFollowUps.length,
    quotationAttachments.length,
    quoDocs.length,
  ])

  const recordReady = Boolean(id && doc && quotation)
  const { showLoader, showNotFound } = useCrmRecordLoadState(recordReady)

  if (showLoader) {
    return <PageLoadingFallback label="Loading quotation…" />
  }

  if (showNotFound || !id || !doc || !quotation) {
    return (
      <div className="erp-page flex flex-col items-center justify-center gap-3 p-12 text-center">
        <p className="text-erp-muted">Quotation not found.</p>
        <Link to="/crm/quotations" className="text-sm font-semibold text-erp-primary hover:underline">
          Back to quotations
        </Link>
      </div>
    )
  }

  const quoDoc = doc
  const quoId = id
  const quo = quotation
  const favoritePath = `/crm/quotations/${quoId}`
  const contactPhone = contact?.phone || customer?.contactPhone || ''
  const contactEmail = contact?.email || customer?.contactEmail || ''
  const contactName = contact?.name ?? customer?.contactPerson

  const revisionPolicy = resolveQuotationRevisionPolicy({
    status: quoDoc.status,
    customerApproval: quo?.customerApproval ?? 'pending',
    isLatest: true,
  })
  const canEdit = revisionPolicy.canDirectEdit && !quoDoc.locked
  const canSubmit = (quoDoc.status === 'draft' || quoDoc.status === 'rejected') && !quoDoc.locked
  const canApprove = quoDoc.status === 'pending_approval'
  const canRecall = quoDoc.status === 'pending_approval'
  const canMarkSent = quoDoc.status === 'approved'
  const canCustomerApprove = quoDoc.status === 'sent' && quo?.customerApproval === 'pending'
  const canRevise = revisionPolicy.canCreateRevision
  const canDeleteQuotation =
    canDeleteQuotationPerm
    && isQuotationDeletableStatus(quoDoc.status)
    && isQuotationDeletableStatus(quotation?.status ?? quoDoc.status)
  const soGate = resolveCreateSalesOrderGateForQuotationDocument(quoDoc.id)

  async function handleSubmitApproval() {
    setActionBusy(true)
    try {
      const r = await resolveStoreAction(submitForApproval(quoDoc.id))
      if (!r.ok) {
        notify.error(r.error ?? 'Could not submit')
        return
      }
      notify.success('Quotation submitted for approval')
      navigate('/crm/quotations')
    } finally {
      setActionBusy(false)
    }
  }

  async function handleMarkSent() {
    setActionBusy(true)
    try {
      const r = await resolveStoreAction(markSent(quoDoc.id))
      if (!r.ok) {
        notify.error(r.error ?? 'Could not mark sent')
        return
      }
      notify.success('Quotation sent to customer')
    } finally {
      setActionBusy(false)
    }
  }

  async function handleApprove() {
    setActionBusy(true)
    try {
      const r = await resolveStoreAction(approveDocument(quoDoc.id, 'Approved from Quotation 360'))
      if (!r.ok) {
        notify.error(r.error ?? 'Could not approve')
        return
      }
      notify.success('Quotation approved')
    } finally {
      setActionBusy(false)
    }
  }

  async function handleRecall() {
    setActionBusy(true)
    try {
      const r = await resolveStoreAction(
        recallQuotationDocument(quoDoc.id, 'Recalled to Draft from Quotation 360'),
      )
      if (!r.ok) {
        notify.error(r.error ?? 'Could not recall quotation')
        return
      }
      notify.success('Quotation recalled to Draft — you can edit directly')
    } finally {
      setActionBusy(false)
    }
  }

  async function handleCustomerApprove() {
    setActionBusy(true)
    try {
      const r = await resolveStoreAction(customerApproveDocument(quoDoc.id, 'Customer approved from Quotation 360'))
      if (!r.ok) {
        notify.error(r.error ?? 'Could not record customer approval')
        return
      }
      notify.success('Customer approval recorded')
    } finally {
      setActionBusy(false)
    }
  }

  async function handleNewRevision() {
    const reason = await systemPrompt({
      title: 'Create revision',
      description: 'Describe why a new revision is needed.',
      fieldLabel: 'Revision reason',
      defaultValue: 'Customer requested changes',
      confirmLabel: 'Create revision',
      required: true,
    })
    if (!reason) return
    setActionBusy(true)
    try {
      const r = await resolveStoreAction(createRevision(quoDoc.id, reason))
      if (r.ok && r.documentId) {
        notify.success('Quotation revised successfully')
        navigate(`/crm/quotations/${quoId}/editor?doc=${r.documentId}`)
      } else {
        notify.error(r.error ?? 'Could not create revision')
      }
    } finally {
      setActionBusy(false)
    }
  }

  function selectAdditionalSection(sectionId: string) {
    const normalized =
      sectionId === 'followup' || sectionId === 'followups' || sectionId === 'notes' || sectionId === 'history'
        ? 'activities'
        : sectionId === 'general' || sectionId === 'summary' || sectionId === 'pricing'
          ? 'products'
          : sectionId === 'attachments' ? 'documents'
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
    if (sectionId === 'summary' || sectionId === 'general') {
      document.getElementById('quo-section-summary')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    if (sectionId === 'notes') {
      document.getElementById('quo-section-notes')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    const additionalIds = new Set(additionalSectionItems.map((s) => s.id))
    if (additionalIds.has(sectionId)) {
      selectAdditionalSection(sectionId)
    }
  }

  function openConvertToSalesOrder() {
    if (soGate.salesOrderId) {
      navigate(resolveSalesOrderDetailPath(soGate.salesOrderId, true))
      return
    }
    if (!soGate.enabled) {
      notify.error(soGate.disabledReason ?? 'Available after customer approval.')
      return
    }
    conversion.openConversionModal(quoDoc.id)
  }

  const smartOverviewInput = {
    quotationNo: quo.quotationNo,
    customerName: customer?.customerName ?? '',
    customerId: quo.customerId,
    status: quoDoc.status,
    customerApproval: quo?.customerApproval ?? 'pending',
    lineCount: quoDoc.priceLines.length,
    hasValidLine: quoDoc.priceLines.some((l) => l.productOrItem?.trim() && l.qty > 0 && l.unitPrice > 0),
    grandTotal: quoDoc.totalAmount,
    validUntil: quo.validityDate,
    opportunityId: opportunity?.id ?? null,
    salesOrderId: quo.salesOrderId ?? quoDoc.salesOrderId ?? null,
    ownerName: quoDoc.salesOwnerName ?? undefined,
    lastSavedLabel: quoDoc.modifiedAt ? `Last updated ${formatDate(quoDoc.modifiedAt)}` : undefined,
  }

  const commandBar = (
    <Quotation360RecordHeader
      quotationNo={quo.quotationNo}
      customerName={customer?.customerName}
      opportunityLabel={opportunity?.opportunityNo ?? opportunity?.opportunityName}
      favoritePath={favoritePath}
      documentStatus={quoDoc.status}
      revisionNo={quoDoc.revisionNo}
      ownerName={quoDoc.salesOwnerName}
      canEdit={canEdit}
      canMarkSent={canMarkSent}
      canSubmitApproval={canSubmit}
      canApprove={canApprove}
      canRecall={canRecall}
      canCustomerApprove={canCustomerApprove}
      canRevise={canRevise}
      canDelete={canDeleteQuotation}
      showCreateSalesOrder={soGate.enabled || Boolean(soGate.salesOrderId)}
      canCreateSalesOrder={soGate.enabled}
      createSalesOrderDisabledReason={soGate.disabledReason}
      salesOrderId={soGate.salesOrderId ?? quo.salesOrderId ?? quoDoc.salesOrderId ?? null}
      onEdit={() => navigate(`/crm/quotations/${quoId}/editor?doc=${quoDoc.id}`)}
      onPreview={() => navigate(`/crm/quotations/${quoId}/preview?doc=${quoDoc.id}`)}
      onScheduleFollowUp={() => setFollowUpOpen(true)}
      onMarkSent={() => void handleMarkSent()}
      onSubmitApproval={() => void handleSubmitApproval()}
      onApprove={() => void handleApprove()}
      onRecall={() => void handleRecall()}
      onCustomerApprove={() => void handleCustomerApprove()}
      onNewRevision={() => void handleNewRevision()}
      onCreateSalesOrder={openConvertToSalesOrder}
      onDelete={canDeleteQuotation ? () => setDeleteQuotationOpen(true) : undefined}
      onViewSalesOrder={
        (soGate.salesOrderId ?? quo.salesOrderId ?? quoDoc.salesOrderId)
          ? () =>
              navigate(
                resolveSalesOrderDetailPath(
                  soGate.salesOrderId ?? quo.salesOrderId ?? quoDoc.salesOrderId!,
                  true,
                ),
              )
          : undefined
      }
    />
  )

  const factBox = (
    <QuotationSmartOverviewPanel
      input={smartOverviewInput}
      revisionNo={quoDoc.revisionNo}
      onGoToSection={scrollToSection}
      onEdit={() => navigate(`/crm/quotations/${quoId}/editor?doc=${quoDoc.id}`)}
      onPreview={() => navigate(`/crm/quotations/${quoId}/preview?doc=${quoDoc.id}`)}
      onSubmitApproval={() => void handleSubmitApproval()}
      onApprove={() => void handleApprove()}
      onMarkSent={() => void handleMarkSent()}
      onCustomerApprove={() => void handleCustomerApprove()}
      onCreateSalesOrder={openConvertToSalesOrder}
      canEdit={canEdit}
    />
  )

  return (
    <>
      {actionBusy ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-white/60"
          role="status"
          aria-live="polite"
        >
          <PageLoadingFallback label="Updating quotation…" />
        </div>
      ) : null}
      <QuotationConversionDialog
        conversion={conversion}
        onViewSalesOrder={(salesOrderId) => navigate(resolveSalesOrderDetailPath(salesOrderId, true))}
      />
      <CrmCardFormShell
        title={quo.quotationNo}
        badge="CRM"
        className={`crm-opp-form-page crm-lead-form-page crm-lead-form-page--sticky-record ${ENTERPRISE_FORM_CLASS} enterprise-workspace--crm-smart-overview`}
        recordTitle={quo.quotationNo}
        status={quotationStatusLabel(quoDoc.status)}
        statusTone={mapStatusTone(quoDoc.status)}
        stage={quo.inquiryNo ?? quotationRevisionLabel(quoDoc.revisionNo)}
        createdDate={formatDate(quo.createdAt)}
        owner={quoDoc.salesOwnerName ?? 'Unassigned'}
        company={customer?.customerName}
        lastSaved={quoDoc.modifiedAt ? `Last updated ${formatDate(quoDoc.modifiedAt)}` : undefined}
        favoritePath={favoritePath}
        breadcrumbs={crmBreadcrumbs(
          { label: 'Quotations', to: '/crm/quotations' },
          { label: quo.quotationNo },
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

          {quoDoc.status === 'converted' && (quoDoc.salesOrderNo || quo.salesOrderId || soGate.salesOrderId) ? (
            <div className="dyn-detail-banner dyn-detail-banner--success">
              Converted to Sales Order
              {quoDoc.salesOrderNo || quo.salesOrderNo ? (
                <>
                  {' '}
                  —
                  {' '}
                  <button
                    type="button"
                    className="font-mono font-semibold underline-offset-2 hover:underline"
                    onClick={() => {
                      const soId = soGate.salesOrderId ?? quo.salesOrderId ?? quoDoc.salesOrderId
                      if (soId) navigate(resolveSalesOrderDetailPath(soId, true))
                    }}
                  >
                    {quoDoc.salesOrderNo ?? quo.salesOrderNo}
                  </button>
                </>
              ) : null}
              . Operational actions continue in Sales.
            </div>
          ) : null}

          {quoDoc.status === 'rejected' || quo?.customerApproval === 'rejected' ? (
            <div className="dyn-detail-banner dyn-detail-banner--critical">
              {quoDoc.status === 'rejected'
                ? 'Internally rejected — create a new revision (or edit and resubmit) to continue.'
                : 'Customer rejected — create a new revision to address feedback and resend.'}
            </div>
          ) : null}

          {quoDoc.status === 'pending_approval' ? (
            <div className="dyn-detail-banner dyn-detail-banner--warning">
              Pending internal approval — revision is not available. Approve, Reject, or Recall to Draft first.
            </div>
          ) : null}

          {opportunity ? (
            <OpportunityQuotationValueMismatchBanner
              opportunityId={opportunity.id}
              opportunityValue={opportunity.value}
              quotationGrandTotal={quoDoc.totalAmount}
              documentKey={quoDoc.id}
              canUpdateOpportunity={opportunity.status === 'open'}
              onReviewPricing={() => scrollToSection('products')}
              onUpdateOpportunityValue={async () => {
                const r = await resolveStoreAction(
                  updateOpportunity(opportunity.id, { value: quoDoc.totalAmount }),
                )
                if (r.ok) notify.success('Opportunity value updated to match quotation total')
                else notify.error(r.error ?? 'Could not update opportunity value')
              }}
            />
          ) : null}

          <div className="dyn-detail-pipeline">
            <QuotationWorkflowStepper
              status={quoDoc.status}
              customerApproval={quo?.customerApproval}
              salesOrderId={soGate.salesOrderId ?? quo.salesOrderId ?? quoDoc.salesOrderId ?? null}
              salesOrderNo={quoDoc.salesOrderNo ?? quo.salesOrderNo ?? null}
              onViewSalesOrder={
                (soGate.salesOrderId ?? quo.salesOrderId ?? quoDoc.salesOrderId)
                  ? () =>
                      navigate(
                        resolveSalesOrderDetailPath(
                          soGate.salesOrderId ?? quo.salesOrderId ?? quoDoc.salesOrderId!,
                          true,
                        ),
                      )
                  : undefined
              }
            />
          </div>

          <QuotationSummaryCard
            quotation={quo}
            document={quoDoc}
            customerName={customer?.customerName}
            customerId={customer?.id}
            contactName={contactName}
            contactPhone={contactPhone}
            contactEmail={contactEmail}
            city={customer?.city}
            productName={product?.productName}
            opportunityNo={opportunity?.opportunityNo}
            opportunityId={opportunity?.id}
            lastActivityAt={lastActivity?.activityDate ?? quoDoc.modifiedAt}
            lastActivityLabel={lastActivity?.subject ?? null}
          />

          <CrmStageNotes
            entityType="QUOTATION"
            entityId={quoId}
            sectionId="quo-section-notes"
            stageOptions={QUOTATION_NOTE_STAGE_OPTIONS}
            historyLabel="Quotation notes history"
            currentStage={quoDoc.status}
            demoNotes={quoDemoNotes}
            editPath={canEdit ? `/crm/quotations/${quoId}/editor?doc=${quoDoc.id}` : undefined}
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
                  <QuotationLineItemsEditor
                    priceLines={quoDoc.priceLines}
                    freightAmount={quoDoc.freightAmount}
                    installationAmount={quoDoc.installationAmount}
                    customCharges={quoDoc.customCharges}
                    probability={opportunity?.probability ?? 0}
                    readOnly
                    showFreightExtras
                    scopeNotes={opportunityRequirementDisplay(quoDoc.commercialNotes)}
                  />
                ),
                commercial: (
                  <div className="space-y-4">
                    <QuotationCommercialSummary document={quoDoc} />
                    {(quoDoc.commercialNotes || quoDoc.technicalNotes) ? (
                      <div className="grid gap-4 lg:grid-cols-2">
                        {quoDoc.commercialNotes ? (
                          <div>
                            <p className="text-[11px] font-semibold uppercase text-erp-muted">Commercial notes</p>
                            <p className="mt-1 text-sm leading-relaxed text-erp-text whitespace-pre-wrap">
                              {quoDoc.commercialNotes}
                            </p>
                          </div>
                        ) : null}
                        {quoDoc.technicalNotes ? (
                          <div>
                            <p className="text-[11px] font-semibold uppercase text-erp-muted">Technical notes</p>
                            <p className="mt-1 text-sm leading-relaxed text-erp-text whitespace-pre-wrap">
                              {quoDoc.technicalNotes}
                            </p>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ),
                sections: (
                  <div className="space-y-3">
                    <QuotationSectionList document={quoDoc} />
                    {canEdit ? (
                      <ErpButton
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => navigate(`/crm/quotations/${quoId}/editor?doc=${quoDoc.id}`)}
                      >
                        Edit in builder
                      </ErpButton>
                    ) : null}
                  </div>
                ),
                activities: (
                  <CrmUnifiedActivityFeed
                    items={unifiedFeedItems}
                    nextFollowUp={nextQuoFollowUp}
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
                        document.getElementById('quo-section-notes')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
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
                  <EntityAttachmentsPanel entityType="QUOTATION" entityId={quoId} />
                ) : (
                  <Enterprise360Documents
                    documents={attachmentDocs}
                    onUpload={canEdit ? () => navigate(`/crm/quotations/${quoId}/editor?doc=${quoDoc.id}`) : undefined}
                  />
                ),
                revisions: (
                  <div className="space-y-3">
                    <QuotationRevisionHistory documents={quoDocs} quotationId={quoId} />
                    {canRevise ? (
                      <ErpButton
                        type="button"
                        size="sm"
                        variant="secondary"
                        icon={GitBranch}
                        onClick={() => void handleNewRevision()}
                      >
                        Create new revision
                      </ErpButton>
                    ) : null}
                  </div>
                ),
                approval: (
                  <div className="max-w-lg">
                    <QuotationApprovalPanel documentId={quoDoc.id} />
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
        context={{ quotationId: id, customerId: quotation.customerId, opportunityId: doc.opportunityId }}
        followUp={editingFollowUp}
      />
      <LogActivityDrawer
        open={logActivityOpen}
        onClose={() => {
          setLogActivityOpen(false)
          setEditingActivity(null)
        }}
        context={{
          customerId: quotation.customerId,
          contactId: doc.contactId,
          opportunityId: doc.opportunityId,
        }}
        activity={editingActivity}
      />
      <CrmDeleteConfirmModal
        open={deleteQuotationOpen}
        title="Delete quotation?"
        description={`"${quo.quotationNo}" will be permanently removed. Only draft quotations can be deleted.`}
        confirmLabel="Delete quotation"
        onCancel={() => setDeleteQuotationOpen(false)}
        onConfirm={() => {
          void (async () => {
            setDeletingQuotation(true)
            try {
              const r = await resolveStoreAction(deleteQuotation(quoId))
              if (r.ok) {
                notify.success('Quotation deleted')
                setDeleteQuotationOpen(false)
                navigate('/crm/quotations')
              } else {
                notify.error(r.error ?? 'Could not delete quotation')
              }
            } finally {
              setDeletingQuotation(false)
            }
          })()
        }}
        isDeleting={deletingQuotation}
      />
      <CrmDeleteConfirmModal
        open={Boolean(deleteActivityTarget)}
        title="Delete activity?"
        description={deleteActivityTarget ? `"${deleteActivityTarget.subject}" will be removed from this quotation’s timeline.` : undefined}
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
    </>
  )
}
