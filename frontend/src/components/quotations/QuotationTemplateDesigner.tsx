import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Eye, Layout, Layers, Printer, Save, Download, Bookmark, FileText, Plus, Pencil,
} from 'lucide-react'
import { OperationalPageShell } from '../design-system/OperationalPageShell'
import { ErpButton } from '../erp/ErpButton'
import { ErpCommandBar } from '../erp/ErpCommandBar'
import { DynamicsStatusChip } from '../dynamics/DynamicsStatusChip'
import { resolveStoreAction } from '../../store/storeAction'
import { useCrmStore } from '../../store/crmStore'
import { QuotationSectionEditor } from './QuotationSectionEditor'
import { QuotationPrintDocument } from './QuotationPrintDocument'
import { QuotationPrintLayoutPanel } from './QuotationPrintLayoutPanel'
import type { QuotationPrintLayout, QuotationSection, QuotationTemplateSection } from '../../types/crm'
import type { Customer } from '../../types/master'
import { cloneTemplateSections } from '../../utils/quotationEngine/cloneSections'
import { DEFAULT_QUOTATION_PRINT_LAYOUT, resolveQuotationPrintLayout } from '../../utils/quotationEngine/printLayout'
import { printQuotationDocument } from '../../utils/quotationEngine/pdfExport'
import { EnterpriseDocumentStrip } from '../../design-system/workspace'
import { cn } from '../../utils/cn'
import { crmBreadcrumbs } from '../../utils/crmNavigation'
import { notify } from '../../store/toastStore'

interface QuotationTemplateDesignerProps {
  templateId: string
  previewMode?: boolean
}

function genId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
}

type DesignerTab = 'sections' | 'layout' | 'settings'

function templateFormBreadcrumbs(templateId: string, templateName: string, currentLabel: string) {
  return crmBreadcrumbs(
    { label: 'Quotation Templates', to: '/crm/quotation-templates' },
    { label: templateName, to: `/crm/quotation-templates/${templateId}` },
    { label: currentLabel },
  )
}

export function QuotationTemplateDesigner({ templateId, previewMode }: QuotationTemplateDesignerProps) {
  const navigate = useNavigate()
  const tpl = useCrmStore((s) => s.getTemplate(templateId))
  const updateTemplate = useCrmStore((s) => s.updateQuotationTemplate)
  const [sections, setSections] = useState<QuotationSection[]>([])
  const [printLayout, setPrintLayout] = useState<QuotationPrintLayout>(DEFAULT_QUOTATION_PRINT_LAYOUT)
  const [meta, setMeta] = useState({
    templateName: '',
    productFamily: '',
    defaultTerms: '',
    defaultWarranty: '',
    defaultExclusions: '',
    isActive: true,
  })
  const [activeTab, setActiveTab] = useState<DesignerTab>('sections')
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null)
  const [previewZoom, setPreviewZoom] = useState(0.55)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({})

  useEffect(() => {
    if (!tpl) return
    setSections(cloneTemplateSections(tpl.sections, genId))
    setPrintLayout(resolveQuotationPrintLayout(tpl))
    setMeta({
      templateName: tpl.templateName,
      productFamily: tpl.productFamily,
      defaultTerms: tpl.defaultTerms,
      defaultWarranty: tpl.defaultWarranty,
      defaultExclusions: tpl.defaultExclusions,
      isActive: tpl.isActive,
    })
  }, [templateId, tpl, tpl?.version, tpl?.sections.length])

  const sorted = useMemo(() => [...sections].sort((a, b) => a.sequenceNo - b.sequenceNo), [sections])

  const mockDoc = useMemo(() => ({
    id: 'preview',
    quotationId: 'preview',
    revisionNo: 0,
    templateId,
    opportunityId: null,
    sections: sorted,
    priceLines: [{
      id: 'pl-preview',
      productOrItem: 'Sample Product — 45 M3 Bulker Trailer',
      description: 'Supply as per technical specification',
      qty: 2,
      uom: 'Nos',
      unitPrice: 2850000,
      discountPct: 5,
      taxPct: 18,
      lineTotal: 0,
      isOptional: false,
    }],
    freightAmount: 0,
    installationAmount: 0,
    customCharges: 0,
    status: 'draft' as const,
    totalAmount: 5700000,
    revisionReason: null,
    locked: false,
    approvalHistory: [],
    contactId: null,
    salesOwnerId: null,
    salesOwnerName: 'Rajesh Kumar',
    commercialNotes: null,
    technicalNotes: null,
    createdAt: new Date().toISOString(),
    createdById: '',
    createdByName: '',
    modifiedAt: new Date().toISOString(),
    modifiedById: '',
    modifiedByName: '',
    approvedById: null,
    approvedByName: null,
    approvedAt: null,
  }), [sorted, templateId])

  const mockQuotation = useMemo(() => ({
    id: 'preview',
    quotationNo: 'QT-PREVIEW-001',
    inquiryId: '',
    inquiryNo: 'INQ-PREVIEW',
    customerId: '',
    productId: '',
    qty: 2,
    revisionNo: 0,
    rootQuotationId: 'preview',
    isLatestRevision: true,
    locked: false,
    status: 'draft' as const,
    customerApproval: 'pending' as const,
    customerApprovalAt: null,
    customerApprovalBy: null,
    customerRejectionReason: null,
    terms: meta.defaultTerms,
    paymentTerms: '30% Advance, Balance Against PI',
    deliveryTerms: 'Ex Works — 6-8 weeks from PO',
    validityDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    pricing: { unitPrice: 2850000, discountPct: 5, subtotal: 5700000, gstPct: 18, gstAmount: 974700, grandTotal: 6380700 },
    changeHistory: [],
    salesOrderId: null,
    salesOrderNo: null,
    createdAt: new Date().toISOString(),
    createdById: '',
    createdByName: '',
    modifiedAt: new Date().toISOString(),
    modifiedById: '',
    modifiedByName: '',
    approvedById: null,
    approvedByName: null,
    approvedAt: null,
  }), [meta.defaultTerms])

  const mockCustomer = useMemo((): Customer => ({
    id: 'preview-customer',
    customerCode: 'CUST-PREVIEW',
    customerName: 'UltraTech Cement Ltd.',
    customerType: 'corporate',
    industry: 'Cement',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400001',
    addressLine1: 'Ahura Centre, Mahakali Caves Road, Andheri East',
    contactPerson: 'Vikram Mehta',
    contactPhone: '+91 98200 12345',
    contactEmail: 'vikram.mehta@ultratech.com',
    gstin: '27AAACU9603R1ZN',
    creditDays: 30,
    salesTerritory: 'West',
    isActive: true,
    createdAt: new Date().toISOString(),
  }), [])

  if (!tpl) {
    return (
      <OperationalPageShell title="Template not found" variant="dynamics" badge="CRM">
        <Link to="/crm/quotation-templates"><ErpButton variant="secondary" icon={ArrowLeft}>Back</ErpButton></Link>
      </OperationalPageShell>
    )
  }

  async function saveTemplate() {
    if (isSubmitting) return false
    setIsSubmitting(true)
    try {
      const stripped: QuotationTemplateSection[] = sorted.map(({ id: _id, specRows, ...rest }) => ({
        ...rest,
        specRows: specRows?.map(({ id: _rid, ...row }) => row),
      }))
      const r = await resolveStoreAction(
        updateTemplate(templateId, {
          templateName: meta.templateName,
          productFamily: meta.productFamily,
          defaultTerms: meta.defaultTerms,
          defaultWarranty: meta.defaultWarranty,
          defaultExclusions: meta.defaultExclusions,
          isActive: meta.isActive,
          sections: stripped,
          printLayout,
          version: (tpl?.version ?? 1) + 1,
        }),
      )
      if (!r.ok) notify.error(r.error ?? 'Could not save template')
      else notify.success('Template saved')
      return r.ok
    } finally {
      setIsSubmitting(false)
    }
  }

  function scrollToSection(sectionId: string) {
    setActiveSectionId(sectionId)
    sectionRefs.current[sectionId]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const specTableCount = sorted.filter((s) => s.contentFormat === 'spec_table').length

  if (previewMode) {
    return (
      <OperationalPageShell
        title={`Preview — ${meta.templateName}`}
        description={`${meta.productFamily} · ${sorted.length} sections · ${printLayout.pageSize} layout`}
        variant="dynamics"
        badge="CRM"
        favoritePath={`/crm/quotation-templates/${templateId}/preview`}
        breadcrumbs={templateFormBreadcrumbs(templateId, meta.templateName || tpl.templateName, 'Preview')}
        autoBreadcrumbs={false}
        commandBar={(
          <ErpCommandBar
            inline
            sticky={false}
            primaryAction={{
              id: 'designer',
              label: 'Open Designer',
              icon: Pencil,
              onClick: () => navigate(`/crm/quotation-templates/${templateId}/editor`),
            }}
            secondaryActions={[
              { id: 'print', label: 'Print', icon: Printer, onClick: printQuotationDocument },
              { id: 'pdf', label: 'Export PDF', icon: Download, onClick: printQuotationDocument },
            ]}
            moreActions={[
              { id: 'templates', label: 'All Templates', icon: Bookmark, onClick: () => navigate('/crm/quotation-templates') },
              { id: 'quotations', label: 'Quotations', icon: FileText, onClick: () => navigate('/crm/quotations') },
            ]}
          />
        )}
        insights={[
          { label: 'Sections', value: sorted.length, accent: 'blue' },
          { label: 'Spec Tables', value: specTableCount, accent: 'green' },
          { label: 'Page Size', value: printLayout.pageSize, accent: 'slate' },
          { label: 'Version', value: `v${tpl.version ?? 1}`, accent: 'slate' },
        ]}
      >
        <div className="quo-preview-shell">
          <div className="quo-preview-canvas">
            <QuotationPrintDocument
              doc={mockDoc}
              quotation={mockQuotation}
              customer={mockCustomer}
              printLayout={printLayout}
            />
          </div>
        </div>
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      title={meta.templateName || 'Document Designer'}
      variant="dynamics"
      badge="CRM"
      favoritePath={`/crm/quotation-templates/${templateId}/editor`}
      breadcrumbs={templateFormBreadcrumbs(templateId, meta.templateName || tpl.templateName, 'Designer')}
      autoBreadcrumbs={false}
      className="quo-template-designer-page"
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={{
            id: 'save',
            label: isSubmitting ? 'Saving…' : 'Save',
            icon: Save,
            onClick: () => { void saveTemplate() },
            disabled: isSubmitting,
          }}
          secondaryActions={[
            {
              id: 'save-close',
              label: 'Save & Close',
              icon: Bookmark,
              disabled: isSubmitting,
              onClick: () => {
                void saveTemplate().then((ok) => {
                  if (ok) navigate('/crm/quotation-templates')
                })
              },
            },
            {
              id: 'preview',
              label: 'Full Preview',
              icon: Eye,
              disabled: isSubmitting,
              onClick: () => {
                void saveTemplate().then((ok) => {
                  if (ok) navigate(`/crm/quotation-templates/${templateId}/preview`)
                })
              },
            },
            { id: 'print', label: 'Print', icon: Printer, onClick: printQuotationDocument },
            {
              id: 'pdf',
              label: 'Export PDF',
              icon: Download,
              disabled: isSubmitting,
              onClick: () => {
                void saveTemplate().then((ok) => {
                  if (ok) printQuotationDocument()
                })
              },
            },
          ]}
          moreActions={[
            { id: 'templates', label: 'All Templates', icon: Bookmark, onClick: () => navigate('/crm/quotation-templates') },
            { id: 'quotations', label: 'Quotations', icon: FileText, onClick: () => navigate('/crm/quotations') },
            { id: 'new-quotation', label: 'New Quotation', icon: Plus, onClick: () => navigate('/crm/quotations/new') },
          ]}
        />
      )}
    >
      <div className="quo-template-workspace">
        <EnterpriseDocumentStrip
          fields={[
            { label: 'Product family', value: meta.productFamily || '—' },
            { label: 'Sections', value: String(sorted.length), highlight: true },
            { label: 'Spec tables', value: String(specTableCount) },
            { label: 'Page size', value: printLayout.pageSize },
            { label: 'Version', value: `v${tpl.version ?? 1}` },
            { label: 'Status', value: meta.isActive ? 'Active' : 'Inactive', highlight: meta.isActive },
          ]}
        />

        <div className="quo-template-workspace__head">
          <nav className="dyn-form-section-nav quo-template-workspace__tabs" aria-label="Designer views">
            <button
              type="button"
              className={cn('dyn-form-section-nav__tab', activeTab === 'sections' && 'dyn-form-section-nav__tab--active')}
              onClick={() => setActiveTab('sections')}
            >
              <Layers className="h-3.5 w-3.5" />
              Sections
            </button>
            <button
              type="button"
              className={cn('dyn-form-section-nav__tab', activeTab === 'layout' && 'dyn-form-section-nav__tab--active')}
              onClick={() => setActiveTab('layout')}
            >
              <Layout className="h-3.5 w-3.5" />
              Page layout
            </button>
            <button
              type="button"
              className={cn('dyn-form-section-nav__tab', activeTab === 'settings' && 'dyn-form-section-nav__tab--active')}
              onClick={() => setActiveTab('settings')}
            >
              <Pencil className="h-3.5 w-3.5" />
              Template settings
            </button>
          </nav>
          <DynamicsStatusChip label="Live preview" tone="success" />
        </div>

        <div className={cn('quo-template-workspace__grid', activeTab !== 'sections' && 'quo-template-workspace__grid--no-nav')}>
          {activeTab === 'sections' ? (
            <nav className="quo-editor-outline quo-template-workspace__nav" aria-label="Document sections">
              <p className="quo-editor-outline__title">Section navigator</p>
              <p className="quo-editor-outline__completion">{sorted.length} sections · click to jump</p>
              <ul className="quo-editor-outline__list">
                {sorted.map((sec, idx) => (
                  <li key={sec.id}>
                    <button
                      type="button"
                      className={cn('quo-editor-outline__item', activeSectionId === sec.id && 'quo-editor-outline__item--active')}
                      onClick={() => scrollToSection(sec.id)}
                    >
                      <span className="quo-editor-outline__num">{idx + 1}</span>
                      <span className="quo-editor-outline__label">{sec.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}

          <main className="quo-template-workspace__editor">
            {activeTab === 'layout' ? (
              <QuotationPrintLayoutPanel layout={printLayout} onChange={setPrintLayout} />
            ) : activeTab === 'settings' ? (
              <div className="quo-template-settings">
                <header className="quo-editor-document__header">
                  <div>
                    <p className="quo-editor-document__eyebrow">Template metadata</p>
                    <h2 className="quo-editor-document__title">Template settings</h2>
                    <p className="quo-editor-document__meta">Name, defaults, and activation — reflected in new quotations</p>
                  </div>
                  <DynamicsStatusChip label={meta.isActive ? 'Active' : 'Inactive'} tone={meta.isActive ? 'success' : 'warning'} />
                </header>
                <div className="quo-template-settings__grid">
                  <label className="quo-template-settings__field">
                    <span>Template name</span>
                    <input className="erp-input" value={meta.templateName} onChange={(e) => setMeta((m) => ({ ...m, templateName: e.target.value }))} />
                  </label>
                  <label className="quo-template-settings__field">
                    <span>Product family</span>
                    <input className="erp-input" value={meta.productFamily} onChange={(e) => setMeta((m) => ({ ...m, productFamily: e.target.value }))} />
                  </label>
                  <label className="quo-template-settings__field quo-template-settings__field--wide">
                    <span>Default terms</span>
                    <input className="erp-input" value={meta.defaultTerms} onChange={(e) => setMeta((m) => ({ ...m, defaultTerms: e.target.value }))} />
                  </label>
                  <label className="quo-template-settings__field quo-template-settings__field--wide">
                    <span>Default warranty</span>
                    <input className="erp-input" value={meta.defaultWarranty} onChange={(e) => setMeta((m) => ({ ...m, defaultWarranty: e.target.value }))} />
                  </label>
                  <label className="quo-template-settings__field quo-template-settings__field--wide">
                    <span>Default exclusions</span>
                    <input className="erp-input" value={meta.defaultExclusions} onChange={(e) => setMeta((m) => ({ ...m, defaultExclusions: e.target.value }))} />
                  </label>
                  <label className="quo-template-settings__check">
                    <input type="checkbox" checked={meta.isActive} onChange={(e) => setMeta((m) => ({ ...m, isActive: e.target.checked }))} />
                    Active template — available when creating quotations
                  </label>
                </div>
              </div>
            ) : (
              <div className="quo-editor-document">
                <header className="quo-editor-document__header">
                  <div>
                    <p className="quo-editor-document__eyebrow">Section designer</p>
                    <h2 className="quo-editor-document__title">Document sections</h2>
                    <p className="quo-editor-document__meta">Add, reorder, and configure sections — preview updates as you edit</p>
                  </div>
                  <DynamicsStatusChip label={`${sorted.length} sections`} tone="neutral" />
                </header>
                <QuotationSectionEditor
                  sections={sections}
                  locked={false}
                  onChange={setSections}
                  sectionRefs={sectionRefs}
                  onSectionFocus={setActiveSectionId}
                  templateMode
                />
              </div>
            )}
          </main>

          <aside className="quo-template-workspace__preview" aria-label="Live print preview">
            <div className="quo-template-workspace__preview-toolbar">
              <p className="quo-template-workspace__preview-label">Print preview</p>
              <div className="quo-template-designer__zoom">
                <button type="button" aria-label="Zoom out" onClick={() => setPreviewZoom((z) => Math.max(0.35, z - 0.05))}>−</button>
                <span>{Math.round(previewZoom * 100)}%</span>
                <button type="button" aria-label="Zoom in" onClick={() => setPreviewZoom((z) => Math.min(1, z + 0.05))}>+</button>
                <button type="button" className="quo-template-workspace__fit" onClick={() => setPreviewZoom(0.55)}>Fit</button>
              </div>
            </div>
            <div className="quo-template-workspace__preview-scroll">
              <div className="quo-template-workspace__preview-canvas" style={{ zoom: previewZoom }}>
                <QuotationPrintDocument
                  doc={mockDoc}
                  quotation={mockQuotation}
                  customer={mockCustomer}
                  printLayout={printLayout}
                />
              </div>
            </div>
          </aside>
        </div>
      </div>
    </OperationalPageShell>
  )
}
