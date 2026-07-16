import { useMemo, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import {
  Activity,
  Banknote,
  Calendar,
  CheckCircle,
  Eye,
  FileText,
  GitBranch,
  LayoutGrid,
  MessageSquare,
  Paperclip,
  Pencil,
  Send,
  AlertCircle,
} from 'lucide-react'
import { Entity360Panel } from '../../components/design-system/Entity360Shell'
import { CommandBar, CommandBarButton, CommandBarGroup } from '../../components/ui/CommandBar'
import { FactBoxPaneAiToggle } from '../../components/erp/card-form/FactBoxPaneAiToggle'
import {
  ENTERPRISE_FORM_DETAIL_CLASS,
  EnterpriseFormMetrics,
  EnterpriseFormSectionNav,
} from '../../design-system/workspace'
import { CrmCardFormShell } from '@/components/crm/CrmCardFormShell'
import { CrmSmartOverviewPanel } from '@/components/crm/CrmSmartOverviewPanel'
import { crmBreadcrumbs } from '../../utils/crmNavigation'
import { formatDate } from '../../utils/dates/format'
import { useCrmStore } from '../../store/crmStore'
import { resolveStoreAction } from '../../store/storeAction'
import { useSalesStore } from '../../store/salesStore'
import { useMasterStore } from '../../store/masterStore'
import { formatCrmCurrency } from '../../utils/crmMetrics'
import {
  QuotationLineItemsEditor,
  QuotationApprovalPanel,
  QuotationRevisionHistory,
  ConvertQuotationToSOAction,
  quotationStatusLabel,
  quotationStatusTone,
  QuotationHeroCard,
  QuotationWorkflowStepper,
  QuotationCommercialSummary,
  QuotationSectionList,
} from '@/components/quotations'
import { QuickFollowUpDrawer, ActivityTimeline } from '@/components/crm'
import { EntityNotesPanel } from '../../components/crm/shared/EntityNotesPanel'
import { EntityAttachmentsPanel } from '../../components/crm/shared/EntityAttachmentsPanel'
import { CrmEntityDetailDrawer } from '../../components/crm/shared/CrmEntityDetailDrawer'
import { demoNotesFromTexts } from '../../utils/crmEntityNotes'
import type { CrmEntityTypeApi, DemoEntityNote } from '../../types/crmEntity'
import type { CrmActivity, FollowUp } from '../../types/crm'
import { ErpButton } from '../../components/erp/ErpButton'
import { LiveStatusBadge } from '../../components/premium/LiveStatusBadge'
import { Enterprise360Documents } from '../../design-system/workspace360'
import type { QuotationDocumentStatus } from '../../types/crm'
import { useQuotationAttachmentStore } from '../../store/quotationAttachmentStore'
import { useApiMode } from '../../hooks/useApiMode'
import {
  buildQuotationAiInsight,
  buildQuotationKeyDetails,
  buildQuotationSmartSignals,
  computeQuotationCompleteness,
  quotationOverviewChips,
  quotationOverviewTitle,
  resolveQuotationNextBestAction,
} from '../../utils/quotationSmartOverview'

type QuoTab = 'overview' | 'sections' | 'pricing' | 'revisions' | 'approval' | 'notes' | 'attachments'

function mapStatusTone(status: QuotationDocumentStatus): 'neutral' | 'info' | 'success' | 'warning' | 'critical' {
  const tone = quotationStatusTone(status)
  if (tone === 'healthy' || tone === 'live') return 'success'
  if (tone === 'critical') return 'critical'
  if (tone === 'warning') return 'warning'
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
  const submitForApproval = useCrmStore((s) => s.submitQuotationDocumentForApproval)
  const markSent = useCrmStore((s) => s.markQuotationDocumentSent)
  const createRevision = useCrmStore((s) => s.createQuotationRevision)
  const getQuotation = useSalesStore((s) => s.getQuotation)
  const customers = useMasterStore((s) => s.customers)
  const products = useMasterStore((s) => s.products)
  const attachmentItems = useQuotationAttachmentStore((s) => s.items)

  const [tab, setTab] = useState<QuoTab>('overview')
  const [activeSection, setActiveSection] = useState<QuoTab>('overview')
  const [followUpOpen, setFollowUpOpen] = useState(false)
  const [notesDetail, setNotesDetail] = useState<{
    entityType: CrmEntityTypeApi
    entityId: string
    title: string
    subtitle?: string
    demoNotes?: DemoEntityNote[]
  } | null>(null)

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

  const quoDemoNotes = useMemo(
    () => demoNotesFromTexts([
      { label: 'Commercial notes', text: doc?.commercialNotes },
      { label: 'Technical notes', text: doc?.technicalNotes },
    ]),
    [doc?.commercialNotes, doc?.technicalNotes],
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

  if (!id || !doc || !quotation) {
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

  const maxDiscount = quoDoc.priceLines.reduce((m, l) => Math.max(m, l.discountPct), 0)
  const canEdit = !quoDoc.locked && quoDoc.status !== 'converted'
  const canSubmit = ['draft', 'sent'].includes(quoDoc.status) && !quoDoc.locked
  const canMarkSent = quoDoc.status === 'draft' && !quoDoc.locked
  const canRevise = quoDoc.locked || quoDoc.status === 'approved' || quoDoc.status === 'rejected'

  async function handleSubmitApproval() {
    const r = await resolveStoreAction(submitForApproval(quoDoc.id))
    if (!r.ok) alert(r.error ?? 'Could not submit')
  }

  async function handleMarkSent() {
    const r = await resolveStoreAction(markSent(quoDoc.id))
    if (!r.ok) alert(r.error ?? 'Could not mark sent')
  }

  async function handleNewRevision() {
    const reason = prompt('Revision reason?') ?? 'Customer requested changes'
    const r = await resolveStoreAction(createRevision(quoDoc.id, reason))
    if (r.ok && r.documentId) {
      navigate(`/crm/quotations/${quoId}/editor?doc=${r.documentId}`)
    } else {
      alert(r.error ?? 'Could not create revision')
    }
  }

  function selectSection(sectionId: QuoTab) {
    setActiveSection(sectionId)
    setTab(sectionId)
  }

  const sectionNavItems = [
    { id: 'overview', label: 'Overview', icon: LayoutGrid },
    { id: 'sections', label: 'Sections', icon: FileText, done: quoDoc.sections.length > 0 },
    { id: 'pricing', label: 'Pricing', icon: Banknote, done: quoDoc.priceLines.length > 0 },
    { id: 'revisions', label: 'Revisions', icon: GitBranch, done: quoDocs.length > 1 },
    { id: 'approval', label: 'Approval', icon: CheckCircle, done: quoDoc.approvalHistory.length > 0 },
    { id: 'notes', label: 'Notes', icon: MessageSquare, done: quoDemoNotes.length > 0 },
    { id: 'attachments', label: 'Attachments', icon: Paperclip, done: quotationAttachments.length > 0 },
  ]

  const formMetrics = [
    { label: 'Grand Total', value: formatCrmCurrency(quoDoc.totalAmount), accent: 'green' as const, hint: customer?.customerName ?? 'Customer' },
    { label: 'Revision', value: `R${quoDoc.revisionNo}`, accent: 'blue' as const, hint: quo.inquiryNo ?? '—' },
    { label: 'Line Items', value: String(quoDoc.priceLines.length), accent: 'violet' as const, hint: product?.productName ?? 'Product' },
    { label: 'Max Discount', value: `${maxDiscount}%`, accent: maxDiscount > 10 ? 'amber' as const : 'green' as const, hint: quo.validityDate ? `Valid ${formatDate(quo.validityDate)}` : '—' },
  ]

  const documentStrip = [
    { label: 'Quotation No.', value: quo.quotationNo, highlight: true },
    { label: 'Revision', value: `R${quoDoc.revisionNo}` },
    { label: 'Status', value: quotationStatusLabel(quoDoc.status) },
    { label: 'Customer', value: customer?.customerName ?? '—', highlight: Boolean(customer) },
    { label: 'Grand Total', value: formatCrmCurrency(quoDoc.totalAmount), highlight: true },
    { label: 'Inquiry', value: quo.inquiryNo ?? '—' },
    { label: 'Owner', value: quoDoc.salesOwnerName ?? '—' },
    { label: 'Valid Till', value: quo.validityDate ? formatDate(quo.validityDate) : '—' },
  ]

  const commandBar = (
    <CommandBar className="ent-ws-command-bar">
      <CommandBarGroup>
        <CommandBarButton icon={Calendar} label="Follow-up" primary onClick={() => setFollowUpOpen(true)} />
        {canEdit ? (
          <CommandBarButton
            icon={Pencil}
            label="Editor"
            onClick={() => navigate(`/crm/quotations/${quoId}/editor?doc=${quoDoc.id}`)}
          />
        ) : null}
        <CommandBarButton
          icon={Eye}
          label="Preview"
          onClick={() => navigate(`/crm/quotations/${quoId}/preview?doc=${quoDoc.id}`)}
        />
        {canMarkSent ? (
          <CommandBarButton icon={Send} label="Mark Sent" onClick={handleMarkSent} />
        ) : null}
        {canSubmit ? (
          <CommandBarButton icon={CheckCircle} label="Submit Approval" onClick={handleSubmitApproval} />
        ) : null}
        {canRevise ? (
          <CommandBarButton icon={GitBranch} label="New Revision" onClick={handleNewRevision} />
        ) : null}
      </CommandBarGroup>
      <CommandBarGroup>
        <ConvertQuotationToSOAction documentId={quoDoc.id} showHandoverNote={false} />
      </CommandBarGroup>
    </CommandBar>
  )

  const smartOverviewInput = {
    quotationNo: quo.quotationNo,
    customerName: customer?.customerName ?? '',
    customerId: quo.customerId,
    status: quotationStatusLabel(quoDoc.status),
    lineCount: quoDoc.priceLines.length,
    hasValidLine: quoDoc.priceLines.some((l) => l.productOrItem?.trim() && l.qty > 0 && l.unitPrice > 0),
    grandTotal: quoDoc.totalAmount,
    validUntil: quo.validityDate,
    opportunityId: opportunity?.id ?? null,
    salesOrderId: quo.salesOrderId ?? quoDoc.salesOrderId ?? null,
    ownerName: quoDoc.salesOwnerName ?? undefined,
  }

  const nextAction = resolveQuotationNextBestAction(smartOverviewInput)

  const factBox = (
    <CrmSmartOverviewPanel
      ariaLabel="Smart quotation overview"
      title={quotationOverviewTitle(smartOverviewInput)}
      chips={quotationOverviewChips(smartOverviewInput)}
      meta={[
        `Revision R${quoDoc.revisionNo}`,
        quoDoc.salesOwnerName ? `Owner: ${quoDoc.salesOwnerName}` : 'Unassigned',
      ]}
      progressLabel="Quotation readiness"
      progressPercent={computeQuotationCompleteness(smartOverviewInput)}
      signals={buildQuotationSmartSignals(smartOverviewInput)}
      nextAction={nextAction}
      onNextAction={() => {
        if (nextAction.id === 'convert_so') selectSection('overview')
        else if (nextAction.id === 'add_lines') selectSection('pricing')
        else if (nextAction.id === 'set_validity') selectSection('overview')
        else if (nextAction.id === 'link_customer') selectSection('overview')
        else if (canEdit) navigate(`/crm/quotations/${quoId}/editor?doc=${quoDoc.id}`)
        else selectSection('overview')
      }}
      quickActions={[
        {
          id: 'follow-up',
          label: 'Follow-up',
          icon: Calendar,
          onClick: () => setFollowUpOpen(true),
        },
        {
          id: 'edit',
          label: 'Editor',
          icon: Pencil,
          onClick: () => navigate(`/crm/quotations/${quoId}/editor?doc=${quoDoc.id}`),
          disabled: !canEdit,
        },
        {
          id: 'preview',
          label: 'Preview',
          icon: Eye,
          onClick: () => navigate(`/crm/quotations/${quoId}/preview?doc=${quoDoc.id}`),
        },
      ]}
      keyDetails={buildQuotationKeyDetails(smartOverviewInput)}
      aiInsight={buildQuotationAiInsight(smartOverviewInput)}
      footer={(
        <div className="rounded-lg border border-erp-border bg-erp-surface p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Status</p>
          <div className="mt-2">
            <LiveStatusBadge label={quotationStatusLabel(quoDoc.status)} tone={quotationStatusTone(quoDoc.status)} pulse={false} />
          </div>
          <div className="mt-3">
            <ConvertQuotationToSOAction documentId={quoDoc.id} showHandoverNote />
          </div>
          {quoDoc.status === 'converted' && quoDoc.salesOrderNo ? (
            <p className="mt-2 text-[12px] font-medium text-emerald-700">
              CRM handover complete — linked to {quoDoc.salesOrderNo}. Operational actions run from Sales module.
            </p>
          ) : null}
        </div>
      )}
    />
  )

  return (
    <>
      <CrmCardFormShell
        title={quo.quotationNo}
        badge="CRM"
        className={`${ENTERPRISE_FORM_DETAIL_CLASS} enterprise-workspace--crm-smart-overview`}
        recordNo={quo.quotationNo}
        recordTitle={`${customer?.customerName ?? 'Quotation'} · R${quoDoc.revisionNo}`}
        status={quotationStatusLabel(quoDoc.status)}
        statusTone={mapStatusTone(quoDoc.status)}
        stage={quo.inquiryNo ?? '—'}
        createdDate={formatDate(quo.createdAt)}
        owner={quoDoc.salesOwnerName ?? 'Unassigned'}
        company={customer?.customerName}
        favoritePath={`/crm/quotations/${quoId}`}
        breadcrumbs={crmBreadcrumbs(
          { label: 'Quotations', to: '/crm/quotations' },
          { label: quo.quotationNo },
        )}
        commandBar={commandBar}
        documentStrip={documentStrip}
        factBox={factBox}
        suppressFactBoxRecord
        collapsibleFactBox
        factBoxLabel="Details"
        stickyFooter={false}
      >
        <EnterpriseFormSectionNav
          sections={sectionNavItems}
          activeId={activeSection}
          onSelect={(sectionId) => selectSection(sectionId as QuoTab)}
          trailing={<FactBoxPaneAiToggle />}
        />

        <EnterpriseFormMetrics metrics={formMetrics} />

        {tab === 'overview' && (
          <div className="space-y-4">
            <QuotationHeroCard
              document={doc}
              quotation={quotation}
              customer={customer}
              productName={product?.productName}
              opportunity={opportunity ? { opportunityNo: opportunity.opportunityNo, opportunityName: opportunity.opportunityName } : undefined}
              contact={contact ? { name: contact.name } : undefined}
              revisionCount={quoDocs.length}
              onOpenCustomer={customer ? () => navigate(`/entity360/customers/${customer.id}`) : undefined}
              onOpenOpportunity={opportunity ? () => navigate(`/crm/opportunities/${opportunity.id}`) : undefined}
            />
            <QuotationWorkflowStepper status={doc.status} />

            <div className="grid gap-4 lg:grid-cols-2">
              <QuotationCommercialSummary document={doc} />

              <Entity360Panel title="Next best action" subtitle="Recommended from document state">
                <div className="space-y-3 p-4">
                  {doc.status === 'pending_approval' ? (
                    <div className="flex items-start gap-2 rounded-lg border border-erp-warning/30 bg-erp-warning-soft/30 p-3">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-erp-warning" />
                      <div>
                        <p className="text-sm font-semibold text-erp-text">Awaiting approval</p>
                        <p className="text-[12px] text-erp-muted">Review pricing and commercial terms in the Approval tab.</p>
                        <button type="button" className="mt-2 text-[12px] font-semibold text-erp-primary" onClick={() => selectSection('approval')}>
                          Open approval →
                        </button>
                      </div>
                    </div>
                  ) : doc.status === 'draft' ? (
                    <div className="flex items-start gap-2 rounded-lg border border-erp-border bg-erp-surface-alt/40 p-3">
                      <Pencil className="mt-0.5 h-4 w-4 shrink-0 text-erp-primary" />
                      <div>
                        <p className="text-sm font-semibold text-erp-text">Complete and send quotation</p>
                        <p className="text-[12px] text-erp-muted">Finish sections in the editor, then mark sent or submit for approval.</p>
                        <button
                          type="button"
                          className="mt-2 text-[12px] font-semibold text-erp-primary"
                          onClick={() => navigate(`/crm/quotations/${quoId}/editor?doc=${quoDoc.id}`)}
                        >
                          Open editor →
                        </button>
                      </div>
                    </div>
                  ) : doc.status === 'approved' ? (
                    <div className="flex items-start gap-2 rounded-lg border border-erp-success/30 bg-erp-success-soft/20 p-3">
                      <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-erp-success" />
                      <div>
                        <p className="text-sm font-semibold text-erp-text">Ready to convert</p>
                        <p className="text-[12px] text-erp-muted">Approved quotation can be converted to a sales order.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 rounded-lg border border-erp-border bg-erp-surface-alt/40 p-3">
                      <Activity className="mt-0.5 h-4 w-4 shrink-0 text-erp-primary" />
                      <div>
                        <p className="text-sm font-semibold text-erp-text">Schedule customer follow-up</p>
                        <p className="text-[12px] text-erp-muted">Keep momentum after sending the quotation.</p>
                        <button type="button" className="mt-2 text-[12px] font-semibold text-erp-primary" onClick={() => setFollowUpOpen(true)}>
                          Quick follow-up →
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </Entity360Panel>
            </div>

            {(quoActivities.length > 0 || quoFollowUps.length > 0) ? (
              <div className="grid gap-4 lg:grid-cols-2">
                {quoActivities.length > 0 ? (
                  <Entity360Panel title="Recent activities" subtitle="Logged on this quotation or linked opportunity">
                    <div className="p-4">
                      <ActivityTimeline activities={quoActivities} onOpenNotes={openActivityNotes} />
                    </div>
                  </Entity360Panel>
                ) : null}
                {quoFollowUps.length > 0 ? (
                  <Entity360Panel title="Follow-ups" subtitle="Scheduled customer touchpoints">
                    <ul className="space-y-2 p-4 text-sm">
                      {quoFollowUps.map((f) => (
                        <li key={f.id} className="flex flex-wrap items-start justify-between gap-2 rounded border border-erp-border p-2">
                          <span>{f.followUpType.replace(/_/g, ' ')} — {f.dueDate} · {f.status}</span>
                          <ErpButton type="button" size="sm" variant="secondary" onClick={() => openFollowUpNotes(f)}>
                            Notes
                          </ErpButton>
                        </li>
                      ))}
                    </ul>
                  </Entity360Panel>
                ) : null}
              </div>
            ) : null}

            {(doc.commercialNotes || doc.technicalNotes) ? (
              <Entity360Panel
                title="Document notes"
                subtitle="Commercial and technical context — full notes on the Notes tab"
              >
                <div className="grid gap-4 p-4 lg:grid-cols-2">
                  {doc.commercialNotes ? (
                    <div>
                      <p className="text-[11px] font-semibold uppercase text-erp-muted">Commercial</p>
                      <p className="mt-1 text-sm leading-relaxed text-erp-text whitespace-pre-wrap">{doc.commercialNotes}</p>
                    </div>
                  ) : null}
                  {doc.technicalNotes ? (
                    <div>
                      <p className="text-[11px] font-semibold uppercase text-erp-muted">Technical</p>
                      <p className="mt-1 text-sm leading-relaxed text-erp-text whitespace-pre-wrap">{doc.technicalNotes}</p>
                    </div>
                  ) : null}
                </div>
              </Entity360Panel>
            ) : null}
          </div>
        )}

        {tab === 'sections' && (
          <Entity360Panel title="Document sections" subtitle={`${doc.sections.length} sections in this revision`}>
            <div className="p-4">
              <QuotationSectionList document={doc} />
              {canEdit ? (
                <button
                  type="button"
                  className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-erp-primary px-3 py-2 text-[12px] font-semibold text-white hover:opacity-90"
                  onClick={() => navigate(`/crm/quotations/${quoId}/editor?doc=${quoDoc.id}`)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit in builder
                </button>
              ) : null}
            </div>
          </Entity360Panel>
        )}

        {tab === 'pricing' && (
          <Entity360Panel title="Price breakdown" subtitle="Line items and tax summary">
            <div className="p-4">
              <QuotationLineItemsEditor
                priceLines={doc.priceLines}
                freightAmount={doc.freightAmount}
                installationAmount={doc.installationAmount}
                customCharges={doc.customCharges}
                probability={opportunity?.probability ?? 0}
                readOnly
                showFreightExtras
                scopeNotes={doc.commercialNotes ?? ''}
              />
            </div>
          </Entity360Panel>
        )}

        {tab === 'revisions' && (
          <Entity360Panel title="Revision history" subtitle={`${quoDocs.length} document versions`}>
            <div className="p-4">
              <QuotationRevisionHistory documents={quoDocs} quotationId={id} />
              {canRevise ? (
                <button
                  type="button"
                  className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-erp-border px-3 py-2 text-[12px] font-semibold text-erp-text hover:bg-erp-surface-alt"
                  onClick={handleNewRevision}
                >
                  <GitBranch className="h-3.5 w-3.5" />
                  Create new revision
                </button>
              ) : null}
            </div>
          </Entity360Panel>
        )}

        {tab === 'approval' && (
          <Entity360Panel title="Approval workflow" subtitle="Review gates and sign-off history">
            <div className="max-w-lg p-4">
              <QuotationApprovalPanel documentId={doc.id} />
            </div>
          </Entity360Panel>
        )}

        {tab === 'notes' && (
          <Entity360Panel
            title="Notes"
            subtitle={apiMode ? 'Notes stored on this quotation' : 'Document notes from this quotation'}
          >
            <div className="p-4">
              <EntityNotesPanel
                entityType="QUOTATION"
                entityId={quoId}
                demoNotes={quoDemoNotes}
                demoOnly={!apiMode}
              />
            </div>
          </Entity360Panel>
        )}

        {tab === 'attachments' && (
          <Entity360Panel title="Attachments" subtitle="RFQs, drawings, and supporting documents">
            <div className="p-4">
              {apiMode ? (
                <EntityAttachmentsPanel entityType="QUOTATION" entityId={quoId} />
              ) : (
                <Enterprise360Documents
                  documents={attachmentDocs}
                  onUpload={canEdit ? () => navigate(`/crm/quotations/${id}/editor?doc=${doc.id}`) : undefined}
                />
              )}
            </div>
          </Entity360Panel>
        )}
      </CrmCardFormShell>

      <QuickFollowUpDrawer
        open={followUpOpen}
        onClose={() => setFollowUpOpen(false)}
        context={{ quotationId: id, customerId: quotation.customerId, opportunityId: doc.opportunityId }}
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
    </>
  )
}
