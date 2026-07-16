import { useMemo, useState, useCallback, useEffect } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Plus, FileText, Download, Bookmark, Pencil, Eye, ArrowLeft, Copy, Layers, LayoutGrid, Table2, Save,
} from 'lucide-react'
import { ErpCommandBar } from '../../components/erp/ErpCommandBar'
import { crmChildBreadcrumbs, crmModuleBreadcrumbs } from '../../utils/crmNavigation'
import { useCrmFilterDrawer } from '../../hooks/useCrmFilterDrawer'
import type { CrmFilterField } from '../../types/crmListFilters'
import { DynamicsStatusChip } from '../../components/dynamics/DynamicsStatusChip'
import { CrmQuotationsTable } from '@/components/quotations/CrmQuotationsTable'
import { OperationalPageShell } from '../../components/design-system/OperationalPageShell'
import { EnterpriseRegisterTableShell } from '../../design-system/list-page/EnterpriseRegisterTableShell'
import { SaveViewDialog } from '../../components/design-system/SaveViewDialog'
import { CrmFilterDrawer } from '../../components/crm/CrmFilterDrawer'
import { CrmListFilterBar, CrmListSortSelect } from '../../components/crm/CrmListFilterBar'
import { ErpButton } from '../../components/erp/ErpButton'
import { useCrmStore } from '../../store/crmStore'
import { resolveStoreAction } from '../../store/storeAction'
import { findFeaturedQuotationTemplate } from '../../utils/quotationTemplates'
import { useSalesStore } from '../../store/salesStore'
import { useMasterStore } from '../../store/masterStore'
import { useUIStore } from '../../store/uiStore'
import { exportRowsToCsv } from '../../utils/exportCsv'
import { runCrmExport } from '../../utils/crmServerExport'
import { useSavedViews } from '../../hooks/useSavedViews'
import { QUOTATION_REGISTER_PRESETS } from '../../config/savedViewPresets'
import {
  QuotationBuilder, QuotationPreview, QuotationRevisionHistory,
  quotationStatusLabel,
} from '@/components/quotations'
import { QuickFollowUpDrawer } from '@/components/crm'
import { resolveQuotationPrintLayout } from '../../utils/quotationEngine/printLayout'
import { QuotationPrintDocument } from '@/components/quotations/QuotationPrintDocument'
import { QuotationTemplateBuilder } from '@/components/quotations/QuotationTemplateBuilder'
import { QuotationTemplateCard, QuotationTemplateEmptyState } from '@/components/quotations/QuotationTemplateCard'
import { formatCrmCurrency } from '../../utils/crmMetrics'
import { buildCrmQuotationRegisterKpis, buildQuotationTemplateKpis } from '../../utils/crmModuleKpis'
import type { QuotationDocumentStatus } from '../../types/crm'
import type { QuotationListItem } from '@/components/quotations/QuotationCrmCard'
import { Quotation360Page } from './Quotation360Page'
import { Toast } from '../../components/ui/Toast'

const QUOTATION_FILTER_FIELDS: CrmFilterField[] = [
  {
    type: 'select',
    key: 'status',
    label: 'Status',
    options: [
      { value: 'draft', label: 'Draft' },
      { value: 'sent', label: 'Sent' },
      { value: 'pending_approval', label: 'Pending approval' },
      { value: 'approved', label: 'Approved' },
      { value: 'rejected', label: 'Rejected' },
      { value: 'converted', label: 'Converted' },
    ],
  },
  {
    type: 'select',
    key: 'segment',
    label: 'Portfolio Segment',
    options: [
      { value: 'pending', label: 'Pending approval' },
      { value: 'draft', label: 'Drafts' },
      { value: 'approved', label: 'Approved' },
    ],
  },
]

export function CrmQuotationListPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const openDetailPanel = useUIStore((s) => s.openDetailPanel)
  const quotationDocuments = useCrmStore((s) => s.quotationDocuments)
  const opportunities = useCrmStore((s) => s.opportunities)
  const getQuotation = useSalesStore((s) => s.getQuotation)
  const customers = useMasterStore((s) => s.customers)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<QuotationDocumentStatus | ''>('')
  const [sortBy, setSortBy] = useState<'date' | 'value' | 'expiry' | 'status'>('date')
  const [segment, setSegment] = useState<'all' | 'pending' | 'draft' | 'approved'>('all')
  const [ownerFilter, setOwnerFilter] = useState('')
  const [followUpQuotation, setFollowUpQuotation] = useState<QuotationListItem | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    const status = searchParams.get('status')
    const segment = searchParams.get('segment')
    const owner = searchParams.get('owner')
    if (status) setStatusFilter(status as QuotationDocumentStatus)
    if (segment === 'pending' || segment === 'draft' || segment === 'approved') {
      setSegment(segment)
    } else if (segment === 'all') {
      setSegment('all')
    }
    if (owner) setOwnerFilter(owner)
  }, [searchParams])

  const applyQuotationFilters = useCallback((saved: Record<string, string>) => {
    setSearch(saved.search ?? '')
    setStatusFilter((saved.status ?? '') as QuotationDocumentStatus | '')
    setSegment((saved.segment || 'all') as typeof segment)
    setOwnerFilter(saved.owner ?? '')
    const sb = saved.sortBy
    if (sb === 'date' || sb === 'value' || sb === 'expiry' || sb === 'status') {
      setSortBy(sb)
    }
  }, [])

  const savedViews = useSavedViews({
    pageId: '/crm/quotations',
    filters: {
      search,
      status: statusFilter,
      segment: segment === 'all' ? '' : segment,
      owner: ownerFilter,
      sortBy,
    },
    onApply: applyQuotationFilters,
    systemPresets: QUOTATION_REGISTER_PRESETS,
  })

  const enriched = useMemo((): QuotationListItem[] => {
    const map = new Map<string, typeof quotationDocuments[0]>()
    const revCounts = new Map<string, number>()
    for (const d of quotationDocuments) {
      revCounts.set(d.quotationId, (revCounts.get(d.quotationId) ?? 0) + 1)
      const cur = map.get(d.quotationId)
      if (!cur || d.revisionNo > cur.revisionNo) map.set(d.quotationId, d)
    }
    return [...map.values()].map((document) => {
      const q = getQuotation(document.quotationId)
      const opp = document.opportunityId ? opportunities.find((o) => o.id === document.opportunityId) : null
      const cust = q ? customers.find((c) => c.id === q.customerId) : null
      return {
        document,
        quotationNo: q?.quotationNo ?? document.quotationId,
        customerName: cust?.customerName ?? 'Customer',
        opportunityName: opp?.opportunityName,
        revisionCount: revCounts.get(document.quotationId) ?? 1,
        quotationDate: document.createdAt?.slice(0, 10) ?? q?.createdAt?.slice(0, 10) ?? '',
        expiryDate: q?.validityDate?.slice(0, 10) ?? '',
        ownerName: document.salesOwnerName ?? opp?.ownerName ?? '—',
      }
    })
  }, [quotationDocuments, getQuotation, opportunities, customers])

  const filtered = useMemo(() => {
    return enriched.filter((item) => {
      const d = item.document
      if (segment === 'pending' && d.status !== 'pending_approval') return false
      if (segment === 'draft' && d.status !== 'draft') return false
      if (segment === 'approved' && d.status !== 'approved' && d.status !== 'converted') return false
      if (statusFilter && d.status !== statusFilter) return false
      if (ownerFilter && item.ownerName !== ownerFilter) return false
      if (search) {
        const q = search.toLowerCase()
        if (
          !item.quotationNo.toLowerCase().includes(q)
          && !item.customerName.toLowerCase().includes(q)
          && !(item.opportunityName?.toLowerCase().includes(q))
        ) return false
      }
      return true
    })
  }, [enriched, segment, statusFilter, ownerFilter, search])

  const sorted = useMemo(() => {
    const list = [...filtered]
    if (sortBy === 'value') list.sort((a, b) => b.document.totalAmount - a.document.totalAmount)
    else if (sortBy === 'expiry') list.sort((a, b) => (b.expiryDate || '').localeCompare(a.expiryDate || ''))
    else if (sortBy === 'status') list.sort((a, b) => a.document.status.localeCompare(b.document.status))
    else list.sort((a, b) => (b.quotationDate || '').localeCompare(a.quotationDate || ''))
    return list
  }, [filtered, sortBy])

  const ownerOptions = useMemo(
    () => [...new Set(enriched.map((e) => e.ownerName).filter((o) => o && o !== '—'))].sort(),
    [enriched],
  )

  const kpis = useMemo(() => {
    const totalValue = enriched.reduce((s, e) => s + e.document.totalAmount, 0)
    const pending = enriched.filter((e) => e.document.status === 'pending_approval').length
    const approved = enriched.filter((e) => e.document.status === 'approved' || e.document.status === 'converted').length
    const draft = enriched.filter((e) => e.document.status === 'draft').length
    return { total: enriched.length, totalValue, pending, approved, draft }
  }, [enriched])

  const quotationKpiStrip = useMemo(
    () => buildCrmQuotationRegisterKpis(kpis, segment, (seg) => setSegment(seg as typeof segment)),
    [kpis, segment],
  )

  const quotationFilterFields = useMemo(
    () => [
      ...QUOTATION_FILTER_FIELDS,
      {
        type: 'select' as const,
        key: 'owner',
        label: 'Owner',
        options: ownerOptions.map((o) => ({ value: o, label: o })),
      },
    ],
    [ownerOptions],
  )

  const filterDrawer = useCrmFilterDrawer({
    values: { search, status: statusFilter, segment: segment === 'all' ? '' : segment, owner: ownerFilter },
    onChange: (next) => {
      if (typeof next.search === 'string') setSearch(next.search)
      if (typeof next.status === 'string') setStatusFilter(next.status as QuotationDocumentStatus | '')
      if (typeof next.segment === 'string') setSegment((next.segment || 'all') as typeof segment)
      if (typeof next.owner === 'string') setOwnerFilter(next.owner)
    },
    fields: quotationFilterFields,
    defaults: { search: '', status: '', segment: '', owner: '' },
    chipLabelResolver: (key, value) => {
      if (key === 'status') return quotationStatusLabel(value as QuotationDocumentStatus)
      if (key === 'segment') return value.replace('_', ' ')
      if (key === 'owner') return value
      return undefined
    },
  })

  const clearFilters = useCallback(() => {
    filterDrawer.clearAll()
    setSegment('all')
    setSortBy('date')
  }, [filterDrawer])

  const hasActiveQuotationFilters = useMemo(
    () => Boolean(
      search.trim()
      || statusFilter
      || segment !== 'all'
      || ownerFilter,
    ),
    [search, statusFilter, segment, ownerFilter],
  )

  function openQuotation(item: QuotationListItem) {
    navigate(`/crm/quotations/${item.document.quotationId}`)
  }

  function editQuotation(item: QuotationListItem) {
    navigate(`/crm/quotations/${item.document.quotationId}/editor?doc=${item.document.id}`)
  }

  function openQuotationPreview(item: QuotationListItem) {
    const d = item.document
    openDetailPanel({
      title: item.quotationNo,
      subtitle: `${item.customerName}${item.opportunityName ? ` · ${item.opportunityName}` : ''}`,
      fields: [
        { label: 'Customer', value: item.customerName },
        { label: 'Status', value: quotationStatusLabel(d.status) },
        { label: 'Revision', value: `R${d.revisionNo} (${item.revisionCount} total)` },
        { label: 'Total', value: formatCrmCurrency(d.totalAmount) },
        { label: 'Last Modified', value: d.modifiedAt ? new Date(d.modifiedAt).toLocaleDateString('en-IN') : '—' },
      ],
      timeline: [
        {
          id: 'revision',
          label: `Revision ${d.revisionNo}`,
          time: d.modifiedAt ?? d.createdAt,
          status: 'current',
        },
      ],
      links: [
        { label: 'Open quotation', href: `/crm/quotations/${d.quotationId}` },
        { label: 'Preview document', href: `/crm/quotations/${d.quotationId}/preview?doc=${d.id}` },
      ],
      aiSummary: `${item.quotationNo} for ${item.customerName} is ${quotationStatusLabel(d.status).toLowerCase()} at ${formatCrmCurrency(d.totalAmount)}.${d.status === 'pending_approval' ? ' Pending approval — follow up with approver.' : d.status === 'approved' ? ' Ready for customer send or SO conversion.' : ' Continue editing or submit for approval.'}`,
      actions: [
        { label: 'Edit', onClick: () => editQuotation(item), primary: true },
        { label: 'Preview PDF', onClick: () => navigate(`/crm/quotations/${d.quotationId}/preview?doc=${d.id}`) },
        { label: 'Open record', onClick: () => openQuotation(item) },
      ],
    })
  }

  function exportAllQuotations() {
    void runCrmExport(
      'quotations',
      () => exportRowsToCsv(
        'crm-quotations',
        ['Quotation', 'Customer', 'Quotation Date', 'Expiry', 'Amount', 'Status', 'Owner', 'Revision'],
        sorted.map((item) => [
          item.quotationNo,
          item.customerName,
          item.quotationDate,
          item.expiryDate,
          item.document.totalAmount,
          quotationStatusLabel(item.document.status),
          item.ownerName,
          item.document.revisionNo,
        ]),
      ),
      {
        search: search || undefined,
        status: statusFilter || undefined,
      },
      'crm-quotations.csv',
    ).then((r) => {
      if (!r.ok) setToast(r.error ?? 'Export failed')
    })
  }

  function exportSelectedQuotations(selected: QuotationListItem[]) {
    exportRowsToCsv(
      'quotations-selected',
      ['Quotation', 'Customer', 'Quotation Date', 'Expiry', 'Amount', 'Status', 'Owner', 'Revision'],
      selected.map((item) => [
        item.quotationNo,
        item.customerName,
        item.quotationDate,
        item.expiryDate,
        item.document.totalAmount,
        quotationStatusLabel(item.document.status),
        item.ownerName,
        item.document.revisionNo,
      ]),
    )
  }

  function duplicateQuotation(item: QuotationListItem) {
    const params = new URLSearchParams()
    if (item.document.opportunityId) params.set('opportunityId', item.document.opportunityId)
    const q = getQuotation(item.document.quotationId)
    if (q?.customerId) params.set('customerId', q.customerId)
    navigate(`/crm/quotations/new?${params.toString()}`)
  }

  return (
    <>
    <OperationalPageShell
      title="CRM Quotations"
      description="Editable quotation documents with revisions, approval workflow, and SO conversion"
      favoritePath="/crm/quotations"
      badge="CRM"
      variant="dynamics"
      autoBreadcrumbs={false}
      breadcrumbs={crmModuleBreadcrumbs('Quotations', '/crm/quotations')}
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={{
            id: 'new-quotation',
            label: 'New Quotation',
            icon: Plus,
            onClick: () => navigate('/crm/quotations/new'),
          }}
          secondaryActions={[
            { id: 'templates', label: 'Templates', icon: Bookmark, onClick: () => navigate('/crm/quotation-templates') },
            { id: 'export', label: 'Export', icon: Download, onClick: exportAllQuotations },
          ]}
          moreActions={[
            { id: 'save-view', label: 'Save View', icon: Save, onClick: savedViews.openSaveDialog },
          ]}
        />
      }
      kpiStrip={quotationKpiStrip}
    >
      <EnterpriseRegisterTableShell>
        <CrmQuotationsTable
          rows={sorted}
          search={search}
          onSearchChange={setSearch}
          showCompactSearch={false}
          hasActiveFilters={hasActiveQuotationFilters}
          onClearFilters={clearFilters}
          registerFilter={{
            search,
            onSearchChange: setSearch,
            searchPlaceholder: 'Search quotation, customer, opportunity…',
            activeFilterCount: filterDrawer.activeCount,
            onOpenFilters: filterDrawer.openDrawer,
            chips: filterDrawer.chips,
            onRemoveChip: filterDrawer.removeChip,
            onClearAll: clearFilters,
            savedView: savedViews.activeView,
            onSavedViewChange: savedViews.selectView,
            savedViews: savedViews.viewNames,
            onSaveView: savedViews.openSaveDialog,
            sort: (
              <CrmListSortSelect
                value={sortBy}
                onChange={(v) => setSortBy(v as typeof sortBy)}
                aria-label="Sort quotations"
                options={[
                  { value: 'date', label: 'Sort: Date' },
                  { value: 'value', label: 'Sort: Amount' },
                  { value: 'expiry', label: 'Sort: Expiry' },
                  { value: 'status', label: 'Sort: Status' },
                ]}
              />
            ),
          }}
          emptyAction={
            sorted.length === 0 ? (
              <div className="flex flex-wrap justify-center gap-2">
                <button type="button" className="erp-btn erp-btn--primary text-[13px]" onClick={() => navigate('/crm/quotations/new')}>
                  New Quotation
                </button>
                {(hasActiveQuotationFilters) ? (
                  <button type="button" className="erp-btn erp-btn--secondary text-[13px]" onClick={clearFilters}>
                    Clear Filters
                  </button>
                ) : null}
              </div>
            ) : undefined
          }
          onView={openQuotation}
          onEdit={editQuotation}
          onDuplicate={duplicateQuotation}
          onPreview={openQuotationPreview}
          onCreateSalesOrder={(item) => {
            const oppId = item.document.opportunityId
            const docId = item.document.id
            if (oppId) {
              navigate(`/sales/orders/new?opportunityId=${oppId}&quotationDocumentId=${docId}`)
            } else {
              navigate(`/sales/orders/new?quotationDocumentId=${docId}`)
            }
          }}
          onPrint={(item) => navigate(`/crm/quotations/${item.document.quotationId}/preview?doc=${item.document.id}`)}
          onSubmitApproval={(item) => navigate(`/crm/quotations/${item.document.quotationId}/editor?doc=${item.document.id}`)}
          onScheduleActivity={(item) => setFollowUpQuotation(item)}
          onBulkExport={exportSelectedQuotations}
          canEdit
        />
      </EnterpriseRegisterTableShell>
    </OperationalPageShell>
    <CrmFilterDrawer
      open={filterDrawer.open}
      onClose={filterDrawer.closeDrawer}
      fields={quotationFilterFields}
      values={filterDrawer.draft}
      onChange={(next) => filterDrawer.setDraft({ ...filterDrawer.draft, ...next })}
      onApply={filterDrawer.applyFilters}
      onReset={filterDrawer.resetDraft}
    />
    <SaveViewDialog
      open={savedViews.saveDialogOpen}
      defaultName={savedViews.activeView === 'My View' ? '' : savedViews.activeView}
      onClose={savedViews.closeSaveDialog}
      onSave={savedViews.saveCurrentView}
    />
    <QuickFollowUpDrawer
      open={!!followUpQuotation}
      onClose={() => setFollowUpQuotation(null)}
      context={{
        opportunityId: followUpQuotation?.document.opportunityId ?? undefined,
        customerId: followUpQuotation ? getQuotation(followUpQuotation.document.quotationId)?.customerId : undefined,
      }}
    />
    {toast ? <Toast message={toast} variant="error" /> : null}
    </>
  )
}

export function CrmQuotationEditorPage() {
  const { id } = useParams<{ id: string }>()
  const [params] = useSearchParams()
  const docId = params.get('doc')
  const getLatest = useCrmStore((s) => s.getLatestQuotationDocument)
  const documentId = docId ?? (id ? getLatest(id)?.id : undefined)

  if (!documentId) {
    return (
      <OperationalPageShell title="Quotation Editor" variant="dynamics" badge="CRM">
        <div className="quo-editor-empty">
          <p className="font-semibold text-erp-text">No quotation document selected</p>
          <p className="text-sm text-erp-muted">Open a quotation from the portfolio or Quote 360 page.</p>
        </div>
      </OperationalPageShell>
    )
  }

  return <QuotationBuilder documentId={documentId} />
}

export function CrmQuotationPreviewPage() {
  const { id } = useParams<{ id: string }>()
  const [params] = useSearchParams()
  const docId = params.get('doc')
  const getLatest = useCrmStore((s) => s.getLatestQuotationDocument)
  const documentId = docId ?? (id ? getLatest(id)?.id : undefined)

  if (!documentId) {
    return (
      <OperationalPageShell title="Quotation Preview" variant="dynamics" badge="CRM">
        <p className="text-erp-muted">No preview available.</p>
      </OperationalPageShell>
    )
  }

  return <QuotationPreview documentId={documentId} />
}

export function CrmQuotationPrintPage() {
  const { id } = useParams<{ id: string }>()
  const [params] = useSearchParams()
  const docId = params.get('doc')
  const getLatest = useCrmStore((s) => s.getLatestQuotationDocument)
  const getDoc = useCrmStore((s) => s.getQuotationDocument)
  const opportunities = useCrmStore((s) => s.opportunities)
  const documentId = docId ?? (id ? getLatest(id)?.id : undefined)
  const doc = documentId ? getDoc(documentId) : undefined
  const quotation = useSalesStore((s) => (doc ? s.getQuotation(doc.quotationId) : undefined))
  const customers = useMasterStore((s) => s.customers)
  const customer = quotation ? customers.find((c) => c.id === quotation.customerId) : undefined
  const opportunity = doc?.opportunityId ? opportunities.find((o) => o.id === doc.opportunityId) : undefined
  const template = doc?.templateId ? useCrmStore.getState().getTemplate(doc.templateId) : undefined
  const printLayout = resolveQuotationPrintLayout(template)

  if (!doc || !quotation) {
    return <div className="p-6">Print view not available.</div>
  }

  return (
    <div className="quo-print-page">
      <QuotationPrintDocument doc={doc} quotation={quotation} customer={customer} opportunity={opportunity} printLayout={printLayout} />
    </div>
  )
}

export function CrmQuotationRevisionsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const allDocs = useCrmStore((s) => s.quotationDocuments)
  const docs = useMemo(() => (id ? allDocs.filter((d) => d.quotationId === id).sort((a, b) => b.revisionNo - a.revisionNo) : []), [allDocs, id])

  return (
    <OperationalPageShell
      title="Revision History"
      description="All document versions for this quotation"
      badge="CRM"
      variant="dynamics"
      breadcrumbs={crmChildBreadcrumbs('Quotations', '/crm/quotations', 'Revisions')}
      autoBreadcrumbs={false}
      actions={(
        <ErpButton variant="secondary" size="sm" icon={ArrowLeft} onClick={() => navigate(`/crm/quotations/${id}`)}>
          Quote 360
        </ErpButton>
      )}
    >
      <div className="max-w-md">
        {id ? <QuotationRevisionHistory documents={docs} quotationId={id} /> : null}
      </div>
    </OperationalPageShell>
  )
}

export function CrmQuotationDetailPage() {
  return <Quotation360Page />
}

export function CrmQuotationTemplatesPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const templates = useCrmStore((s) => s.quotationTemplates)
  const duplicateTemplate = useCrmStore((s) => s.duplicateQuotationTemplate)
  const tpl = id ? templates.find((t) => t.id === id) : null

  const [search, setSearch] = useState('')
  const [familyFilter, setFamilyFilter] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'family' | 'sections' | 'version'>('name')
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card')

  const families = useMemo(
    () => [...new Set(templates.map((t) => t.productFamily))].sort(),
    [templates],
  )

  const filtered = useMemo(() => {
    const list = templates.filter((t) => {
      if (familyFilter && t.productFamily !== familyFilter) return false
      if (search) {
        const q = search.toLowerCase()
        if (!t.templateName.toLowerCase().includes(q) && !t.productFamily.toLowerCase().includes(q)) return false
      }
      return true
    })
    const sorted = [...list]
    if (sortBy === 'family') sorted.sort((a, b) => a.productFamily.localeCompare(b.productFamily))
    else if (sortBy === 'sections') sorted.sort((a, b) => b.sections.length - a.sections.length)
    else if (sortBy === 'version') sorted.sort((a, b) => (b.version ?? 1) - (a.version ?? 1))
    else sorted.sort((a, b) => a.templateName.localeCompare(b.templateName))
    return sorted
  }, [templates, search, familyFilter, sortBy])

  const kpis = useMemo(() => {
    const active = templates.filter((t) => t.isActive).length
    const avgSections = templates.length
      ? Math.round(templates.reduce((s, t) => s + t.sections.length, 0) / templates.length)
      : 0
    const specTables = templates.reduce(
      (s, t) => s + t.sections.filter((sec) => sec.contentFormat === 'spec_table').length,
      0,
    )
    return { total: templates.length, active, avgSections, specTables, families: families.length }
  }, [templates, families.length])

  const templateFilterFields = useMemo((): CrmFilterField[] => [
    {
      type: 'select',
      key: 'family',
      label: 'Product Family',
      options: families.map((f) => ({ value: f, label: f })),
    },
  ], [families])

  const templateFilterDrawer = useCrmFilterDrawer({
    values: { search, family: familyFilter },
    onChange: (next) => {
      if (typeof next.search === 'string') setSearch(next.search)
      if (typeof next.family === 'string') setFamilyFilter(next.family)
    },
    fields: templateFilterFields,
    defaults: { search: '', family: '' },
  })

  const templateKpiStrip = useMemo(
    () => buildQuotationTemplateKpis(kpis),
    [kpis],
  )

  const viewToggle = (
    <div className="crm-companies-view-toggle" role="group" aria-label="View mode">
      <button type="button" aria-pressed={viewMode === 'card'} onClick={() => setViewMode('card')}>
        <LayoutGrid className="mr-1 inline h-3.5 w-3.5" />
        Cards
      </button>
      <button type="button" aria-pressed={viewMode === 'list'} onClick={() => setViewMode('list')}>
        <Table2 className="mr-1 inline h-3.5 w-3.5" />
        Table
      </button>
    </div>
  )

  async function handleDuplicate(sourceId: string) {
    const source = templates.find((t) => t.id === sourceId)
    const name = prompt('Template name', source ? `${source.templateName} (Copy)` : 'New Template')
    if (!name) return
    const r = await resolveStoreAction(duplicateTemplate(sourceId, name))
    if (r.ok && r.templateId) navigate(`/crm/quotation-templates/${r.templateId}/editor`)
    else if (!r.ok) alert(r.error ?? 'Could not duplicate template')
  }

  if (id && tpl) {
    const specCount = tpl.sections.filter((s) => s.contentFormat === 'spec_table').length
    const layout = resolveQuotationPrintLayout(tpl)
    const detailKpiStrip = buildQuotationTemplateKpis({
      total: tpl.sections.length,
      active: tpl.isActive ? 1 : 0,
      avgSections: tpl.sections.length,
      specTables: specCount,
      families: 1,
    })
    return (
      <OperationalPageShell
        title={tpl.templateName}
        description={`${tpl.productFamily} · v${tpl.version ?? 1} · ${tpl.sections.length} sections · ${specCount} technical spec tables`}
        favoritePath={`/crm/quotation-templates/${tpl.id}`}
        badge="CRM"
        variant="dynamics"
        breadcrumbs={crmChildBreadcrumbs('Quotation Templates', '/crm/quotation-templates', tpl.templateName)}
        autoBreadcrumbs={false}
        commandBar={(
          <ErpCommandBar
            inline
            sticky={false}
            primaryAction={{
              id: 'edit',
              label: 'Open Designer',
              icon: Pencil,
              onClick: () => navigate(`/crm/quotation-templates/${tpl.id}/editor`),
            }}
            secondaryActions={[
              { id: 'preview', label: 'Preview', icon: Eye, onClick: () => navigate(`/crm/quotation-templates/${tpl.id}/preview`) },
              { id: 'duplicate', label: 'Duplicate', icon: Copy, onClick: () => handleDuplicate(tpl.id) },
            ]}
            moreActions={[
              { id: 'templates', label: 'All Templates', icon: Bookmark, onClick: () => navigate('/crm/quotation-templates') },
              { id: 'quotations', label: 'Quotations', icon: FileText, onClick: () => navigate('/crm/quotations') },
              { id: 'new-quotation', label: 'New Quotation', icon: Plus, onClick: () => navigate('/crm/quotations/new') },
            ]}
          />
        )}
        kpiStrip={detailKpiStrip}
      >
        {tpl.defaultTerms ? (
          <div className="crm-template-detail-intro">
            <p className="crm-template-detail-intro__label">Default commercial terms</p>
            <p className="crm-template-detail-intro__text">{tpl.defaultTerms}</p>
          </div>
        ) : null}

        {tpl.defaultWarranty ? (
          <div className="crm-template-detail-intro">
            <p className="crm-template-detail-intro__label">Default warranty</p>
            <p className="crm-template-detail-intro__text">{tpl.defaultWarranty}</p>
          </div>
        ) : null}

        <div className="crm-template-detail-intro">
          <p className="crm-template-detail-intro__label">Print / PDF layout</p>
          <p className="crm-template-detail-intro__text">
            {layout.pageSize} · {layout.marginMm}mm margins · {Math.round(layout.fontScale * 100)}% font · {layout.headerStyle} header
            {layout.pageBreakBefore.length ? ` · ${layout.pageBreakBefore.length} page breaks` : ''}
          </p>
        </div>

        <div className="crm-template-sections">
          <h2 className="crm-template-sections__title">Document structure</h2>
          <ol className="crm-template-sections__list">
            {tpl.sections.map((s, i) => (
              <li key={`${s.title}-${i}`} className="crm-template-sections__item">
                <span className="crm-template-sections__num">{i + 1}</span>
                <div className="crm-template-sections__body">
                  <p className="crm-template-sections__name">{s.title}</p>
                  <p className="crm-template-sections__meta">
                    {s.sectionType.replace(/_/g, ' ')}
                    {s.contentFormat === 'spec_table' ? ' · technical spec table' : ''}
                  </p>
                </div>
                <DynamicsStatusChip
                  label={s.contentFormat === 'spec_table' ? 'Spec table' : s.sectionType === 'price_table' ? 'Price grid' : 'Rich text'}
                  tone="neutral"
                />
              </li>
            ))}
          </ol>
        </div>
      </OperationalPageShell>
    )
  }

  return (
    <>
    <OperationalPageShell
      title="Quotation Templates"
      description="Reusable technical-commercial document templates — ISO tanks, trailers, services, and spare parts"
      favoritePath="/crm/quotation-templates"
      badge="CRM"
      variant="dynamics"
      breadcrumbs={crmModuleBreadcrumbs('Quotation Templates', '/crm/quotation-templates')}
      autoBreadcrumbs={false}
      actions={viewToggle}
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={{
            id: 'new',
            label: 'New Template',
            icon: Plus,
            onClick: () => navigate('/crm/quotation-templates/new'),
          }}
          secondaryActions={[
            { id: 'quotations', label: 'Quotations', icon: FileText, onClick: () => navigate('/crm/quotations') },
            { id: 'new-quotation', label: 'New Quotation', icon: Plus, onClick: () => navigate('/crm/quotations/new') },
          ]}
        />
      )}
      kpiStrip={templateKpiStrip}
      filterBar={(
        <CrmListFilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search template or product family…"
          activeFilterCount={templateFilterDrawer.activeCount}
          onOpenFilters={templateFilterDrawer.openDrawer}
          chips={templateFilterDrawer.chips}
          onRemoveChip={templateFilterDrawer.removeChip}
          onClearAll={templateFilterDrawer.chips.length > 0 ? () => { templateFilterDrawer.clearAll(); setSortBy('name') } : undefined}
          resultCount={filtered.length}
          sort={(
            <CrmListSortSelect
              value={sortBy}
              onChange={(v) => setSortBy(v as typeof sortBy)}
              aria-label="Sort quotation templates"
              options={[
                { value: 'name', label: 'Sort: Template Name' },
                { value: 'family', label: 'Sort: Product Family' },
                { value: 'sections', label: 'Sort: Section Count' },
                { value: 'version', label: 'Sort: Version' },
              ]}
            />
          )}
        />
      )}
    >
      {filtered.length === 0 ? (
        <QuotationTemplateEmptyState onCreate={() => navigate('/crm/quotation-templates/new')} />
      ) : viewMode === 'card' ? (
        <div className="crm-template-grid">
          {filtered.map((t) => (
            <QuotationTemplateCard key={t.id} template={t} onDuplicate={handleDuplicate} />
          ))}
        </div>
      ) : (
        <div className="crm-template-table-wrap">
          <table className="crm-template-table">
            <thead>
              <tr>
                <th>Template</th>
                <th>Family</th>
                <th>Sections</th>
                <th>Version</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id}>
                  <td>
                    <button type="button" className="crm-template-table__link" onClick={() => navigate(`/crm/quotation-templates/${t.id}`)}>
                      {t.templateName}
                    </button>
                  </td>
                  <td>{t.productFamily}</td>
                  <td className="tabular-nums">{t.sections.length}</td>
                  <td className="tabular-nums">v{t.version ?? 1}</td>
                  <td>
                    <DynamicsStatusChip label={t.isActive ? 'Active' : 'Inactive'} tone={t.isActive ? 'success' : 'neutral'} />
                  </td>
                  <td>
                    <div className="crm-template-table__actions">
                      <button type="button" className="crm-card-action crm-card-action--primary" onClick={() => navigate(`/crm/quotation-templates/${t.id}/editor`)}>
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </button>
                      <button type="button" className="crm-card-action" onClick={() => navigate(`/crm/quotation-templates/${t.id}/preview`)}>
                        <Eye className="h-3.5 w-3.5" /> Preview
                      </button>
                      <button type="button" className="crm-card-action" onClick={() => handleDuplicate(t.id)}>
                        <Copy className="h-3.5 w-3.5" /> Duplicate
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </OperationalPageShell>
    <CrmFilterDrawer
      open={templateFilterDrawer.open}
      onClose={templateFilterDrawer.closeDrawer}
      fields={templateFilterFields}
      values={templateFilterDrawer.draft}
      onChange={(next) => templateFilterDrawer.setDraft({ ...templateFilterDrawer.draft, ...next })}
      onApply={templateFilterDrawer.applyFilters}
      onReset={templateFilterDrawer.resetDraft}
    />
    </>
  )
}

export function CrmQuotationTemplateNewPage() {
  const navigate = useNavigate()
  const templates = useCrmStore((s) => s.quotationTemplates)
  const createTemplate = useCrmStore((s) => s.createQuotationTemplate)

  async function handleBlank() {
    const name = prompt('Template name', 'Custom Quotation Template')
    if (!name) return
    const r = await resolveStoreAction(createTemplate({ templateName: name, productFamily: 'Custom', sections: [] }))
    if (r.ok && r.templateId) navigate(`/crm/quotation-templates/${r.templateId}/editor`)
    else if (!r.ok) alert(r.error ?? 'Could not create template')
  }

  async function handleFromBase(baseId: string) {
    const base = templates.find((t) => t.id === baseId)
    if (!base) return
    const name = prompt('Template name', `${base.templateName} (Copy)`)
    if (!name) return
    const r = await resolveStoreAction(
      createTemplate({ templateName: name, productFamily: base.productFamily, sourceTemplateId: baseId }),
    )
    if (r.ok && r.templateId) navigate(`/crm/quotation-templates/${r.templateId}/editor`)
    else if (!r.ok) alert(r.error ?? 'Could not create template')
  }

  const featured = findFeaturedQuotationTemplate(templates)
  const others = templates.filter((t) => !featured || t.id !== featured.id)

  return (
    <OperationalPageShell
      title="New Quotation Template"
      description="Start from a proven technical-commercial base or build a blank template"
      badge="CRM"
      variant="dynamics"
      breadcrumbs={crmChildBreadcrumbs('Quotation Templates', '/crm/quotation-templates', 'New Template')}
      autoBreadcrumbs={false}
      favoritePath="/crm/quotation-templates/new"
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={{
            id: 'blank',
            label: 'Blank Template',
            icon: Layers,
            onClick: handleBlank,
          }}
          secondaryActions={[
            { id: 'back', label: 'All Templates', icon: ArrowLeft, onClick: () => navigate('/crm/quotation-templates') },
            { id: 'quotations', label: 'Quotations', icon: FileText, onClick: () => navigate('/crm/quotations') },
          ]}
        />
      )}
      kpiStrip={buildQuotationTemplateKpis({
        total: templates.length,
        active: templates.filter((t) => t.isActive).length,
        avgSections: templates.length
          ? Math.round(templates.reduce((s, t) => s + t.sections.length, 0) / templates.length)
          : 0,
        specTables: templates.reduce(
          (s, t) => s + t.sections.filter((sec) => sec.contentFormat === 'spec_table').length,
          0,
        ),
        families: new Set(templates.map((t) => t.productFamily)).size,
      })}
    >
      <div className="crm-template-new">
        <button type="button" className="crm-template-new__blank" onClick={handleBlank}>
          <Layers className="h-6 w-6" />
          <div>
            <p className="crm-template-new__title">Blank template</p>
            <p className="crm-template-new__hint">Add sections manually — scope, specs, terms, and price grid</p>
          </div>
        </button>

        {featured ? (
          <button type="button" className="crm-template-new__featured" onClick={() => handleFromBase(featured.id)}>
            <Bookmark className="h-6 w-6" />
            <div>
              <p className="crm-template-new__eyebrow">Recommended base</p>
              <p className="crm-template-new__title">{featured.templateName}</p>
              <p className="crm-template-new__hint">{featured.sections.length} sections · full ISO tank technical-commercial structure</p>
            </div>
          </button>
        ) : null}

        <h2 className="crm-template-new__section-title">Other product templates</h2>
        <div className="crm-template-new__grid">
          {others.map((t) => (
            <button key={t.id} type="button" className="crm-template-new__option" onClick={() => handleFromBase(t.id)}>
              <p className="crm-template-new__title">{t.templateName}</p>
              <p className="crm-template-new__hint">{t.productFamily} · {t.sections.length} sections</p>
            </button>
          ))}
        </div>
      </div>
    </OperationalPageShell>
  )
}

export function CrmQuotationTemplateEditorPage() {
  const { id } = useParams<{ id: string }>()
  if (!id) return null
  return <QuotationTemplateBuilder templateId={id} />
}

export function CrmQuotationTemplatePreviewPage() {
  const { id } = useParams<{ id: string }>()
  if (!id) return null
  return <QuotationTemplateBuilder templateId={id} previewMode />
}
