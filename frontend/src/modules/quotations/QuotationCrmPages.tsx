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
import { notify } from '@/store/toastStore'
import { isApiMode } from '../../config/apiConfig'
import { syncQuotationsFromApi } from '../../services/bridges/quotationApiBridge'
import { systemPrompt } from '@/utils/systemConfirm'
import {
  CreateBlankQuotationTemplateModal,
  blankTemplateDefaultTerms,
} from '@/components/quotations/CreateBlankQuotationTemplateModal'
import { exportRowsToCsv } from '../../utils/exportCsv'
import { runCrmExport } from '../../utils/crmServerExport'
import { useSavedViews } from '../../hooks/useSavedViews'
import { QUOTATION_REGISTER_PRESETS } from '../../config/savedViewPresets'
import {
  QuotationBuilder, QuotationPreview, QuotationRevisionHistory,
  quotationStatusLabel,
} from '@/components/quotations'
import { QuickFollowUpDrawer } from '@/components/crm'
import { useCrmRecordLoadState } from '@/components/crm/CrmRecordLoadGate'
import { PageLoadingFallback } from '@/components/system/PageLoadingFallback'
import { resolveQuotationPrintLayout } from '../../utils/quotationEngine/printLayout'
import { QuotationPrintDocument } from '@/components/quotations/QuotationPrintDocument'
import { QuotationTemplateBuilder } from '@/components/quotations/QuotationTemplateBuilder'
import { QuotationTemplateCard, QuotationTemplateEmptyState } from '@/components/quotations/QuotationTemplateCard'
import { formatCrmCurrency } from '../../utils/crmMetrics'
import { buildCrmQuotationRegisterKpis, buildQuotationTemplateKpis } from '../../utils/crmModuleKpis'
import type { QuotationDocumentStatus } from '../../types/crm'
import type { QuotationListItem } from '@/components/quotations/QuotationCrmCard'
import { Quotation360Page } from './Quotation360Page'
import { resolveCreateSalesOrderGateForQuotationDocument } from '../../utils/opportunitySalesOrderDraft'
import { resolveSalesOrderDetailPath } from '../../utils/crmSalesOrderNavigation'
import { useQuotationConversion } from '../crm/hooks/useQuotationConversion'
import { QuotationConversionDialog } from '@/components/quotations/QuotationConversionDialog'
import { CrmDeleteConfirmModal } from '@/components/crm/CrmDeleteConfirmModal'
import { canCrmPermission } from '@/utils/permissions/crm'
import { isQuotationDeletableStatus } from '@/utils/quotationDeletePolicy'

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
  const [searchParams, setSearchParams] = useSearchParams()
  const openDetailPanel = useUIStore((s) => s.openDetailPanel)
  const quotationDocuments = useCrmStore((s) => s.quotationDocuments)
  const conversion = useQuotationConversion()
  const opportunities = useCrmStore((s) => s.opportunities)
  const getQuotation = useSalesStore((s) => s.getQuotation)
  const customers = useMasterStore((s) => s.customers)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<QuotationDocumentStatus | ''>('')
  const [sortBy, setSortBy] = useState<'date' | 'value' | 'expiry' | 'status'>('date')
  const [segment, setSegment] = useState<'all' | 'pending' | 'draft' | 'approved'>('all')
  const [ownerFilter, setOwnerFilter] = useState('')
  const [followUpQuotation, setFollowUpQuotation] = useState<QuotationListItem | null>(null)
  const [deleteTargets, setDeleteTargets] = useState<QuotationListItem[]>([])
  const [deleting, setDeleting] = useState(false)
  const [urlSeeded, setUrlSeeded] = useState(false)
  const canDelete = canCrmPermission('crm.quotation.delete')
  const deleteQuotation = useCrmStore((s) => s.deleteQuotation)

  useEffect(() => {
    if (!isApiMode()) return
    void syncQuotationsFromApi().catch(() => {
      notify.error('Could not refresh quotations from server')
    })
  }, [])

  useEffect(() => {
    if (urlSeeded) return
    const status = searchParams.get('status')
    const segmentParam = searchParams.get('segment')
    const owner = searchParams.get('owner')
    if (status) setStatusFilter(status as QuotationDocumentStatus)
    if (segmentParam === 'pending' || segmentParam === 'draft' || segmentParam === 'approved') {
      setSegment(segmentParam)
    } else if (segmentParam === 'all') {
      setSegment('all')
    }
    if (owner) setOwnerFilter(owner)
    setUrlSeeded(true)
  }, [searchParams, urlSeeded])

  useEffect(() => {
    if (!urlSeeded) return
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (statusFilter) next.set('status', statusFilter)
      else next.delete('status')
      if (segment && segment !== 'all') next.set('segment', segment)
      else next.delete('segment')
      if (ownerFilter) next.set('owner', ownerFilter)
      else next.delete('owner')
      return next
    }, { replace: true })
  }, [statusFilter, segment, ownerFilter, urlSeeded, setSearchParams])

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
        customerApproval: q?.customerApproval,
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
        {
          label: 'Status',
          value:
            d.status === 'sent' && item.customerApproval === 'approved'
              ? 'Customer Approved'
              : quotationStatusLabel(d.status),
        },
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
      if (!r.ok) notify.error(r.error ?? 'Export failed')
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
        item.document.status === 'sent' && item.customerApproval === 'approved'
          ? 'Customer Approved'
          : quotationStatusLabel(item.document.status),
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

  async function reviseQuotation(item: QuotationListItem) {
    const soGate = resolveCreateSalesOrderGateForQuotationDocument(item.document.id)
    if (item.document.status !== 'approved' || soGate.salesOrderId) {
      notify.error(
        soGate.salesOrderId
          ? 'Revised quotation is not available after a sales order is created.'
          : 'Revised quotation is only available for approved quotations.',
      )
      return
    }
    const reason = await systemPrompt({
      title: 'Revised Quotation',
      description: 'Describe why a new revision is needed. Company details stay locked on the revision.',
      fieldLabel: 'Revision reason',
      defaultValue: 'Customer requested changes',
      confirmLabel: 'Create revision',
      required: true,
    })
    if (!reason) return
    const createRevision = useCrmStore.getState().createQuotationRevision
    const r = await resolveStoreAction(createRevision(item.document.id, reason))
    if (r.ok && r.documentId) {
      notify.success('Quotation revised successfully')
      navigate(`/crm/quotations/${item.document.quotationId}/editor?doc=${r.documentId}`)
    } else {
      notify.error(r.error ?? 'Could not create revised quotation')
    }
  }

  function requestDeleteQuotations(rows: QuotationListItem[]) {
    const draftRows = rows.filter((r) => isQuotationDeletableStatus(r.document.status))
    if (draftRows.length === 0) {
      notify.warning('Only draft quotations can be deleted')
      return
    }
    if (draftRows.length !== rows.length) {
      notify.warning('Non-draft quotations cannot be deleted and were excluded')
    }
    setDeleteTargets(draftRows)
  }

  async function confirmDeleteQuotations() {
    if (deleteTargets.length === 0) return
    setDeleting(true)
    try {
      let okCount = 0
      for (const row of deleteTargets) {
        const r = await resolveStoreAction(deleteQuotation(row.document.quotationId))
        if (r.ok) okCount += 1
        else notify.error(r.error ?? `Could not delete ${row.quotationNo}`)
      }
      if (okCount > 0) {
        notify.success(okCount === 1 ? 'Quotation deleted' : `${okCount} quotations deleted`)
        setDeleteTargets([])
      }
    } finally {
      setDeleting(false)
    }
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
          onRevise={(item) => void reviseQuotation(item)}
          onPreview={openQuotationPreview}
          onCreateSalesOrder={(item) => {
            const gate = resolveCreateSalesOrderGateForQuotationDocument(item.document.id)
            if (gate.salesOrderId) {
              navigate(resolveSalesOrderDetailPath(gate.salesOrderId, true))
              return
            }
            if (!gate.enabled) {
              notify.error(gate.disabledReason ?? 'Available after quotation approval.')
              return
            }
            conversion.openConversionModal(item.document.id)
          }}
          onPrint={(item) => navigate(`/crm/quotations/${item.document.quotationId}/preview?doc=${item.document.id}`)}
          onSubmitApproval={(item) => {
            void (async () => {
              if (item.document.status !== 'draft' && item.document.status !== 'rejected') {
                notify.warning('Only draft or rejected quotations can be submitted for approval')
                return
              }
              const submit = useCrmStore.getState().submitQuotationDocumentForApproval
              const r = await resolveStoreAction(submit(item.document.id))
              if (!r.ok) {
                notify.error(r.error ?? 'Could not submit for approval')
                return
              }
              notify.success('Quotation submitted for approval')
              navigate('/crm/quotations')
            })()
          }}
          onApprove={(item) => {
            void (async () => {
              if (item.document.status !== 'pending_approval') {
                notify.warning('Only pending quotations can be approved')
                return
              }
              const r = await resolveStoreAction(
                useCrmStore.getState().approveQuotationDocument(item.document.id, 'Approved from list'),
              )
              if (!r.ok) {
                notify.error(r.error ?? 'Could not approve')
                return
              }
              notify.success('Quotation approved')
            })()
          }}
          onReject={(item) => {
            void (async () => {
              if (item.document.status !== 'pending_approval') {
                notify.warning('Only pending quotations can be rejected')
                return
              }
              const remarks = await systemPrompt({
                title: 'Reject quotation',
                description: 'Provide a reason for rejection.',
                fieldLabel: 'Rejection reason',
                defaultValue: '',
                confirmLabel: 'Reject',
                required: true,
              })
              if (!remarks) return
              const r = await resolveStoreAction(
                useCrmStore.getState().rejectQuotationDocument(item.document.id, remarks),
              )
              if (!r.ok) {
                notify.error(r.error ?? 'Could not reject')
                return
              }
              notify.success('Quotation rejected')
            })()
          }}
          onMarkSent={(item) => {
            void (async () => {
              if (item.document.status !== 'approved') {
                notify.warning('Only approved quotations can be sent')
                return
              }
              const r = await resolveStoreAction(
                useCrmStore.getState().markQuotationDocumentSent(item.document.id),
              )
              if (!r.ok) {
                notify.error(r.error ?? 'Could not send quotation')
                return
              }
              notify.success('Quotation sent to customer')
            })()
          }}
          onCustomerApprove={(item) => {
            void (async () => {
              if (item.document.status !== 'sent') {
                notify.warning('Only sent quotations can receive customer approval')
                return
              }
              const r = await resolveStoreAction(
                useCrmStore.getState().customerApproveQuotationDocument(item.document.id, 'Customer approved from list'),
              )
              if (!r.ok) {
                notify.error(r.error ?? 'Could not record customer approval')
                return
              }
              notify.success('Customer approval recorded')
            })()
          }}
          onScheduleActivity={(item) => setFollowUpQuotation(item)}
          onBulkExport={exportSelectedQuotations}
          onBulkDelete={canDelete ? requestDeleteQuotations : undefined}
          canEdit
          canDelete={canDelete}
        />
      </EnterpriseRegisterTableShell>
      <QuotationConversionDialog
        conversion={conversion}
        onViewSalesOrder={(salesOrderId) => navigate(resolveSalesOrderDetailPath(salesOrderId, true))}
      />
    </OperationalPageShell>
    <CrmDeleteConfirmModal
      open={deleteTargets.length > 0}
      title={deleteTargets.length > 1 ? `Delete ${deleteTargets.length} quotations?` : 'Delete quotation?'}
      description={
        deleteTargets.length === 1
          ? `"${deleteTargets[0]!.quotationNo}" will be permanently removed. Only draft quotations can be deleted.`
          : 'Selected draft quotations will be permanently removed. Non-draft quotations cannot be deleted.'
      }
      confirmLabel={deleteTargets.length > 1 ? 'Delete quotations' : 'Delete quotation'}
      onCancel={() => setDeleteTargets([])}
      onConfirm={() => void confirmDeleteQuotations()}
      isDeleting={deleting}
    />
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
    </>
  )
}

export function CrmQuotationEditorPage() {
  const { id } = useParams<{ id: string }>()
  const [params] = useSearchParams()
  const docId = params.get('doc')
  const getLatest = useCrmStore((s) => s.getLatestQuotationDocument)
  const getDoc = useCrmStore((s) => s.getQuotationDocument)
  const documentId = docId ?? (id ? getLatest(id)?.id : undefined)
  const found = Boolean(documentId && getDoc(documentId!))
  const { showLoader, showNotFound } = useCrmRecordLoadState(found)

  if (showLoader) {
    return (
      <OperationalPageShell title="Quotation Editor" variant="dynamics" badge="CRM">
        <PageLoadingFallback label="Loading quotation editor…" />
      </OperationalPageShell>
    )
  }

  if (showNotFound || !documentId) {
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
    const name = await systemPrompt({
      title: 'Duplicate template',
      fieldLabel: 'Template name',
      defaultValue: source ? `${source.templateName} (Copy)` : 'New Template',
      confirmLabel: 'Duplicate',
      required: true,
    })
    if (!name) return
    const r = await resolveStoreAction(duplicateTemplate(sourceId, name))
    if (r.ok && r.templateId) navigate(`/crm/quotation-templates/${r.templateId}/editor`)
    else if (!r.ok) notify.error(r.error ?? 'Could not duplicate template')
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
  const [blankOpen, setBlankOpen] = useState(false)

  async function handleBlankCreate(values: Parameters<typeof blankTemplateDefaultTerms>[0]) {
    const r = await resolveStoreAction(
      createTemplate({
        templateName: values.templateName,
        productFamily: values.templateType,
        sections: [],
        defaultTerms: blankTemplateDefaultTerms(values),
        printLayout: values.printLayout,
      }),
    )
    if (r.ok && r.templateId) {
      navigate(`/crm/quotation-templates/${r.templateId}/editor`)
      return
    }
    throw new Error(r.error ?? 'Could not create template')
  }

  async function handleFromBase(baseId: string) {
    const base = templates.find((t) => t.id === baseId)
    if (!base) return
    const name = await systemPrompt({
      title: 'Create from template',
      fieldLabel: 'Template name',
      defaultValue: `${base.templateName} (Copy)`,
      confirmLabel: 'Create',
      required: true,
    })
    if (!name) return
    const r = await resolveStoreAction(
      createTemplate({ templateName: name, productFamily: base.productFamily, sourceTemplateId: baseId }),
    )
    if (r.ok && r.templateId) navigate(`/crm/quotation-templates/${r.templateId}/editor`)
    else if (!r.ok) notify.error(r.error ?? 'Could not create template')
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
            onClick: () => setBlankOpen(true),
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
        <button type="button" className="crm-template-new__blank" onClick={() => setBlankOpen(true)}>
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
      <CreateBlankQuotationTemplateModal
        open={blankOpen}
        onClose={() => setBlankOpen(false)}
        onCreate={handleBlankCreate}
      />
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
