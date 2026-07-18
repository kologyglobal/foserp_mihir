import { useMemo, useRef, useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Eye, Lock, Send, CheckCircle, ArrowLeft, GitBranch, FileText, Unlock, Download, Printer, Paperclip,
} from 'lucide-react'
import { OperationalPageShell } from '../design-system/OperationalPageShell'
import { DynamicsKpiRow, DynamicsKpiTile } from '../dynamics/DynamicsKpiTile'
import { DynamicsStatusChip } from '../dynamics/DynamicsStatusChip'
import { ErpCommandBar } from '../erp/ErpCommandBar'
import { ErpButton } from '../erp/ErpButton'
import { ErpFieldRow, ErpFormGrid } from '../erp/card-form'
import { Input, Select } from '../forms/Inputs'
import { CommercialTermSelect } from '../masters/GeographySelects'
import { useCrmStore } from '../../store/crmStore'
import { resolveStoreAction } from '../../store/storeAction'
import { useSalesStore } from '../../store/salesStore'
import { useMasterStore } from '../../store/masterStore'
import { formatCrmCurrency } from '../../utils/crmMetrics'
import { formatDate } from '../../utils/dates/format'
import { QuotationSectionEditor } from './QuotationSectionEditor'
import { QuotationLineItemsEditor } from './QuotationLineItemsEditor'
import { QuotationApprovalPanel } from './QuotationApprovalPanel'
import { QuotationRevisionHistory } from './QuotationRevisionHistory'
import { QuotationDataSourcePanel } from './QuotationDataSourcePanel'
import { quotationStatusLabel, quotationStatusTone } from './QuotationCrmCard'
import { LiveStatusBadge } from '../premium/LiveStatusBadge'
import { DocumentFooterActions } from '../../design-system'
import { sectionCompletionStatus, validateQuotationForPrint } from '../../utils/quotationEngine/validation'
import { saveQuotationPdfToDms } from '../../utils/quotationEngine/pdfExport'
import { commercialTermsNeedApproval, extractCommercialTermsFromSections } from '../../utils/quotationTermUtils'
import type { QuotationPriceLine, QuotationSection } from '../../types/crm'
import { cn } from '../../utils/cn'
import { crmBreadcrumbs } from '../../utils/crmNavigation'
import { CrmTypedDocumentUpload } from '@/components/crm/CrmTypedDocumentUpload'
import { useQuotationAttachmentStore } from '../../store/quotationAttachmentStore'
import { notify } from '../../store/toastStore'
import { systemPrompt } from '../../utils/systemConfirm'
import type { CrmTypedAttachment } from '../../types/crmDocuments'

const VALIDITY_PERIOD_OPTIONS = [15, 30, 45, 60, 90] as const

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate.slice(0, 10))
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function daysBetween(from: string, to: string): number {
  const a = new Date(from.slice(0, 10))
  const b = new Date(to.slice(0, 10))
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

interface QuotationBuilderProps {
  documentId: string
}

export function QuotationBuilder({ documentId }: QuotationBuilderProps) {
  const navigate = useNavigate()
  const doc = useCrmStore((s) => s.getQuotationDocument(documentId))
  const updateSections = useCrmStore((s) => s.updateQuotationDocumentSections)
  const updatePriceTable = useCrmStore((s) => s.updateQuotationDocumentPriceTable)
  const updateQuotationDraft = useSalesStore((s) => s.updateQuotationDraft)
  const createRevision = useCrmStore((s) => s.createQuotationRevision)
  const markSent = useCrmStore((s) => s.markQuotationDocumentSent)
  const submitApproval = useCrmStore((s) => s.submitQuotationDocumentForApproval)
  const opportunities = useCrmStore((s) => s.opportunities)
  const quotation = useSalesStore((s) => (doc ? s.getQuotation(doc.quotationId) : undefined))
  const customers = useMasterStore((s) => s.customers)
  const allDocs = useCrmStore((s) => s.quotationDocuments)
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null)
  const [savedFlash, setSavedFlash] = useState(false)
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({})

  const quotationIdForAttachments = doc?.quotationId ?? 'draft:quotation-editor'
  const setQuotationAttachments = useQuotationAttachmentStore((s) => s.setForQuotation)
  const [attachments, setAttachmentsState] = useState<CrmTypedAttachment[]>(() =>
    useQuotationAttachmentStore.getState().getForQuotation(quotationIdForAttachments),
  )

  useEffect(() => {
    if (doc?.quotationId) {
      setAttachmentsState(useQuotationAttachmentStore.getState().getForQuotation(doc.quotationId))
    }
  }, [doc?.quotationId])

  function setAttachments(next: CrmTypedAttachment[]) {
    setAttachmentsState(next)
    if (doc?.quotationId) {
      setQuotationAttachments(doc.quotationId, next)
    }
  }

  const revisionDocs = useMemo(
    () => (doc ? allDocs.filter((d) => d.quotationId === doc.quotationId).sort((a, b) => b.revisionNo - a.revisionNo) : []),
    [allDocs, doc],
  )

  const sortedSections = useMemo(
    () => (doc ? [...doc.sections].sort((a, b) => a.sequenceNo - b.sequenceNo) : []),
    [doc],
  )

  const approvalWarnings = useMemo(
    () => (doc ? commercialTermsNeedApproval(doc.sections) : []),
    [doc],
  )

  if (!doc || !quotation) {
    return (
      <OperationalPageShell title="Quotation Editor" variant="dynamics" badge="CRM">
        <div className="quo-editor-empty">
          <FileText className="h-10 w-10 text-erp-muted" />
          <p className="font-semibold text-erp-text">Quotation document not found</p>
          <Link to="/crm/quotations">
            <ErpButton variant="secondary" size="sm" icon={ArrowLeft}>Back to quotations</ErpButton>
          </Link>
        </div>
      </OperationalPageShell>
    )
  }

  const customer = customers.find((c) => c.id === quotation.customerId)
  const opportunity = doc.opportunityId ? opportunities.find((o) => o.id === doc.opportunityId) : undefined
  const contact = doc.contactId ? useCrmStore.getState().getContact(doc.contactId) : null
  const locked = doc.locked
  const canEdit = !locked && doc.status !== 'converted'
  /** Revised quotations keep company / customer identity fixed from the approved source. */
  const companyLocked = doc.revisionNo > 0 || Boolean(doc.revisionReason)
  const maxDiscount = doc.priceLines.reduce((m, l) => Math.max(m, l.discountPct), 0)
  const completion = sectionCompletionStatus(doc)
  const printIssues = validateQuotationForPrint(doc, customer)

  function handleSections(sections: QuotationSection[]) {
    updateSections(documentId, sections)
    const terms = extractCommercialTermsFromSections(sections)
    if (terms.paymentTerms || terms.deliveryTerms) {
      updateQuotationDraft(doc!.quotationId, {
        paymentTerms: terms.paymentTerms || undefined,
        deliveryTerms: terms.deliveryTerms || undefined,
      })
    }
    flashSaved()
  }

  function handlePrice(
    lines: QuotationPriceLine[],
    extras: { freightAmount: number; installationAmount: number; customCharges: number },
  ) {
    updatePriceTable(documentId, lines, extras)
    flashSaved()
  }

  function flashSaved() {
    setSavedFlash(true)
    window.setTimeout(() => setSavedFlash(false), 1500)
  }

  const quotationDate = (quotation.createdAt ?? new Date().toISOString()).slice(0, 10)
  const validUntil = quotation.validityDate?.slice(0, 10) ?? ''
  const validityPeriodValue = (() => {
    if (!quotationDate || !validUntil) return 'custom'
    const days = daysBetween(quotationDate, validUntil)
    return (VALIDITY_PERIOD_OPTIONS as readonly number[]).includes(days) ? String(days) : 'custom'
  })()

  function patchCommercial(
    patch: Partial<{ paymentTerms: string; deliveryTerms: string; validityDate: string }>,
  ) {
    if (!canEdit || !doc) return
    void resolveStoreAction(updateQuotationDraft(doc.quotationId, patch))
    flashSaved()
  }

  function scrollToSection(sectionId: string) {
    setActiveSectionId(sectionId)
    sectionRefs.current[sectionId]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
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
    const r = await resolveStoreAction(createRevision(documentId, reason))
    if (r.ok && r.documentId) navigate(`/crm/quotations/${doc!.quotationId}/editor?doc=${r.documentId}`)
  }

  function handleSaveAndClose() {
    flashSaved()
    navigate(`/crm/quotations/${doc!.quotationId}`)
  }

  function handleGeneratePdf() {
    navigate(`/crm/quotations/${doc!.quotationId}/print?doc=${documentId}`)
  }

  async function handleSubmitApprovalClick() {
    const r = await resolveStoreAction(submitApproval(documentId))
    if (!r.ok) notify.error(r.error ?? 'Could not submit for approval')
  }

  function handleSavePdfToDms() {
    if (!quotation || !doc) return
    const r = saveQuotationPdfToDms({
      quotationNo: quotation.quotationNo,
      revisionNo: doc.revisionNo,
      quotationId: doc.quotationId,
      documentId: doc.id,
      customerId: quotation.customerId,
    })
    if (r.ok) notify.success('Quotation PDF saved to DMS')
    else notify.error(r.error ?? 'Failed to save PDF')
  }

  const secondaryActions = [
    { id: 'preview', label: 'Preview', icon: Eye, onClick: () => navigate(`/crm/quotations/${doc.quotationId}/preview?doc=${documentId}`) },
    { id: 'print', label: 'Print', icon: Printer, onClick: () => navigate(`/crm/quotations/${doc.quotationId}/print?doc=${documentId}`) },
    { id: 'pdf', label: 'Export PDF', icon: Download, onClick: handleGeneratePdf },
    { id: 'dms', label: 'Save to DMS', icon: FileText, onClick: handleSavePdfToDms },
  ]

  if (!locked && doc.status === 'draft') {
    secondaryActions.splice(3, 0, { id: 'mark-sent', label: 'Mark Sent', icon: Send, onClick: () => { markSent(documentId) } })
  }

  if (locked && doc.status !== 'converted') {
    secondaryActions.push({ id: 'new-revision', label: 'New Revision', icon: GitBranch, onClick: handleNewRevision })
  }

  return (
    <OperationalPageShell
      title={quotation.quotationNo}
      description={`Revision ${doc.revisionNo} · ${customer?.customerName ?? 'Customer'} · ${quotationStatusLabel(doc.status)}`}
      favoritePath={`/crm/quotations/${doc.quotationId}/editor?doc=${documentId}`}
      badge="Quote Editor"
      variant="dynamics"
      breadcrumbs={crmBreadcrumbs(
        { label: 'Quotations', to: '/crm/quotations' },
        { label: quotation.quotationNo, to: `/crm/quotations/${doc.quotationId}` },
        { label: 'Editor' },
      )}
      autoBreadcrumbs={false}
      actions={
        <Link to={`/crm/quotations/${doc.quotationId}`}>
          <ErpButton variant="secondary" size="sm" icon={ArrowLeft}>Quote 360</ErpButton>
        </Link>
      }
      commandBar={
        <ErpCommandBar
          sticky={false}
          primaryAction={
            !locked && doc.status === 'draft'
              ? { id: 'submit-approval', label: 'Submit Approval', icon: CheckCircle, onClick: () => submitApproval(documentId) }
              : { id: 'preview', label: 'Preview Document', icon: Eye, onClick: () => navigate(`/crm/quotations/${doc.quotationId}/preview?doc=${documentId}`) }
          }
          secondaryActions={secondaryActions}
        />
      }
    >
      <DynamicsKpiRow columns={5}>
        <DynamicsKpiTile label="Grand Total" value={formatCrmCurrency(doc.totalAmount)} tone="primary" />
        <DynamicsKpiTile label="Completion" value={`${completion.complete}/${completion.total}`} tone={completion.missing.length ? 'warning' : 'success'} />
        <DynamicsKpiTile label="Revision" value={`R${doc.revisionNo}`} tone="neutral" helper={doc.revisionReason ?? 'Current document'} />
        <DynamicsKpiTile label="Sections" value={doc.sections.length} tone="neutral" />
        <DynamicsKpiTile label="Max Discount" value={`${maxDiscount}%`} tone={maxDiscount > 10 ? 'warning' : 'neutral'} helper={doc.salesOwnerName ?? 'Unassigned'} />
      </DynamicsKpiRow>

      <div className={cn('quo-editor-status-bar', locked ? 'quo-editor-status-bar--locked' : 'quo-editor-status-bar--editable')}>
        {locked ? <Lock className="h-4 w-4 shrink-0" /> : <Unlock className="h-4 w-4 shrink-0" />}
        <div className="min-w-0 flex-1">
          <p className="quo-editor-status-bar__title">{locked ? 'Document is locked' : 'Editing mode — changes save automatically'}</p>
          <p className="quo-editor-status-bar__hint">
            {approvalWarnings.length > 0
              ? approvalWarnings[0]
              : printIssues.length > 0
                ? `${printIssues.length} print warning(s) — review before sending`
                : 'All required commercial fields look good'}
          </p>
        </div>
        <LiveStatusBadge label={quotationStatusLabel(doc.status)} tone={quotationStatusTone(doc.status)} pulse={false} />
        {savedFlash ? <span className="quo-editor-saved-flash">Saved</span> : null}
      </div>

      <div className="quo-editor-layout">
        <nav className="quo-editor-outline" aria-label="Document sections">
          <p className="quo-editor-outline__title">Section navigator</p>
          <p className="quo-editor-outline__completion">{completion.complete} of {completion.total} complete</p>
          <ul className="quo-editor-outline__list">
            {sortedSections.map((sec, idx) => {
              const incomplete = completion.missing.includes(sec.title)
              return (
                <li key={sec.id}>
                  <button
                    type="button"
                    className={cn('quo-editor-outline__item', activeSectionId === sec.id && 'quo-editor-outline__item--active', incomplete && 'quo-editor-outline__item--warn')}
                    onClick={() => scrollToSection(sec.id)}
                  >
                    <span className="quo-editor-outline__num">{idx + 1}</span>
                    <span className="quo-editor-outline__label">{sec.title}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        <main className="quo-editor-main">
          <div className="quo-editor-document">
            <header className="quo-editor-document__header">
              <div>
                <p className="quo-editor-document__eyebrow">Quotation document</p>
                <h2 className="quo-editor-document__title">{customer?.customerName ?? 'Customer quotation'}</h2>
                <p className="quo-editor-document__meta">
                  {quotation.quotationNo} · Rev {doc.revisionNo}
                  {quotation.validityDate ? ` · Valid till ${formatDate(quotation.validityDate)}` : ''}
                </p>
              </div>
              <DynamicsStatusChip label={locked ? 'Locked' : 'Editable'} tone={locked ? 'warning' : 'success'} />
            </header>

            <section className="quo-editor-commercial-fields" aria-label="Commercial terms">
              <p className="quo-editor-outline__title">Commercial</p>
              <ErpFormGrid columns={2} dense>
                <ErpFieldRow
                  label="Client / Company"
                  readOnly
                  colSpan={2}
                  hint={companyLocked ? 'Company is locked on revised quotations' : 'Linked from the quotation customer'}
                >
                  <Input
                    value={customer?.customerName ?? '—'}
                    readOnly
                    className="erp-input"
                  />
                </ErpFieldRow>
                <ErpFieldRow label="Quotation date" readOnly>
                  <Input type="date" value={quotationDate} readOnly className="erp-input" />
                </ErpFieldRow>
                <ErpFieldRow label="Valid until" required>
                  <Input
                    type="date"
                    value={validUntil}
                    disabled={!canEdit}
                    onChange={(e) => patchCommercial({ validityDate: e.target.value })}
                    className="erp-input"
                  />
                </ErpFieldRow>
                <ErpFieldRow label="Validity period">
                  <Select
                    native
                    value={validityPeriodValue}
                    disabled={!canEdit}
                    onChange={(e) => {
                      if (e.target.value === 'custom') return
                      patchCommercial({ validityDate: addDays(quotationDate, Number(e.target.value)) })
                    }}
                    className="erp-input"
                  >
                    {VALIDITY_PERIOD_OPTIONS.map((d) => (
                      <option key={d} value={d}>{d} days</option>
                    ))}
                    <option value="custom">Custom (from dates)</option>
                  </Select>
                </ErpFieldRow>
                <ErpFieldRow label="Currency" readOnly>
                  <Input value="INR" readOnly className="erp-input" />
                </ErpFieldRow>
                <ErpFieldRow label="Payment terms" required colSpan={2}>
                  <CommercialTermSelect
                    termType="payment"
                    value={quotation.paymentTerms ?? ''}
                    onChange={(v) => patchCommercial({ paymentTerms: v })}
                    placeholder="Select payment terms"
                    disabled={!canEdit}
                  />
                </ErpFieldRow>
                <ErpFieldRow label="Delivery timeline" required colSpan={2}>
                  <CommercialTermSelect
                    termType="delivery"
                    value={quotation.deliveryTerms ?? ''}
                    onChange={(v) => patchCommercial({ deliveryTerms: v })}
                    placeholder="Select delivery terms"
                    disabled={!canEdit}
                  />
                </ErpFieldRow>
              </ErpFormGrid>
            </section>

            <QuotationSectionEditor
              sections={doc.sections}
              locked={locked}
              onChange={handleSections}
              sectionRefs={sectionRefs}
              onSectionFocus={setActiveSectionId}
              renderPriceTable={() => (
                <QuotationLineItemsEditor
                  priceLines={doc.priceLines}
                  freightAmount={doc.freightAmount}
                  installationAmount={doc.installationAmount}
                  customCharges={doc.customCharges}
                  probability={opportunity?.probability ?? 0}
                  readOnly={!canEdit}
                  showFreightExtras
                  scopeNotes={doc.commercialNotes ?? ''}
                  onChange={canEdit ? handlePrice : undefined}
                />
              )}
            />
          </div>
        </main>

        <aside className="quo-editor-sidebar">
          <div className="quo-editor-sidebar-panel">
            <h3 className="quo-editor-sidebar-panel__title">Data sources</h3>
            <QuotationDataSourcePanel
              doc={doc}
              quotation={quotation}
              customer={customer}
              opportunity={opportunity}
              contactName={contact?.name}
            />
          </div>
          <div className="quo-editor-sidebar-panel">
            <h3 className="quo-editor-sidebar-panel__title">Approval workflow</h3>
            <QuotationApprovalPanel documentId={documentId} />
          </div>
          <div className="quo-editor-sidebar-panel">
            <div className="quo-editor-sidebar-panel__head">
              <h3 className="quo-editor-sidebar-panel__title">
                <Paperclip className="mr-1.5 inline h-3.5 w-3.5" />
                Attachments
              </h3>
              <span className="quo-editor-sidebar__count">{attachments.length}</span>
            </div>
            <CrmTypedDocumentUpload
              attachments={attachments}
              onChange={setAttachments}
              disabled={!canEdit}
            />
          </div>
          <div className="quo-editor-sidebar-panel">
            <div className="quo-editor-sidebar-panel__head">
              <h3 className="quo-editor-sidebar-panel__title">Revision history</h3>
              <span className="quo-editor-sidebar__count">{revisionDocs.length} versions</span>
            </div>
            <QuotationRevisionHistory documents={revisionDocs} quotationId={doc.quotationId} />
          </div>
        </aside>
      </div>

      <DocumentFooterActions
        onCancel={() => navigate(`/crm/quotations/${doc.quotationId}`)}
        onSaveDraft={canEdit ? flashSaved : undefined}
        showSaveDraft={canEdit}
        onSave={flashSaved}
        saveDisabled={!canEdit}
        saveDisabledReason={locked ? 'Document is locked' : 'Document cannot be edited'}
        onPreview={() => navigate(`/crm/quotations/${doc.quotationId}/preview?doc=${documentId}`)}
        onSubmitApproval={!locked && doc.status === 'draft' ? handleSubmitApprovalClick : undefined}
        showSubmitApproval={!locked && doc.status === 'draft'}
        onGeneratePdf={handleGeneratePdf}
        onSaveAndClose={handleSaveAndClose}
      />
    </OperationalPageShell>
  )
}
