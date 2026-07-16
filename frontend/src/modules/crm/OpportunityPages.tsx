import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, LayoutGrid, Table2, Bell, Activity, Save } from 'lucide-react'
import { OperationalPageShell } from '../../components/design-system/OperationalPageShell'
import { SaveViewDialog } from '../../components/design-system/SaveViewDialog'
import { EnterpriseRegisterTableShell } from '../../design-system/list-page/EnterpriseRegisterTableShell'
import { CrmFilterDrawer } from '../../components/crm/CrmFilterDrawer'
import { CrmListFilterBar, CrmListSortSelect } from '../../components/crm/CrmListFilterBar'
import { useCrmStore } from '../../store/crmStore'
import { useMasterStore } from '../../store/masterStore'
import { useUIStore } from '../../store/uiStore'
import { useCrmFilterDrawer } from '../../hooks/useCrmFilterDrawer'
import { useSavedViews } from '../../hooks/useSavedViews'
import { OPPORTUNITY_REGISTER_PRESETS } from '../../config/savedViewPresets'
import { buildOpportunityFilterFields, opportunityFilterChipResolver } from '../../config/crmOpportunityFilterConfig'
import { useCrmMasterStore } from '../../store/crmMasterStore'
import type { Opportunity, OpportunityStage } from '../../types/crm'
import {
  OpportunityKanban,
  CrmFollowUpsPanel,
  CrmActivitiesPanel,
  QuickFollowUpDrawer,
  LogActivityDrawer,
} from '../../components/crm'
import { CrmOpportunitiesTable } from '../../components/crm/CrmOpportunitiesTable'
import type { EnterpriseKpiItem } from '../../design-system/enterprise/enterpriseKpiTypes'
import { formatCompactCurrency } from '../../utils/formatters/currency'
import { formatCrmCurrency } from '../../utils/crmMetrics'
import { exportRowsToCsv } from '../../utils/exportCsv'
import { runCrmExport } from '../../utils/crmServerExport'
import { opportunityStageLabel, sortOpportunities, hasActiveOpportunityFilters, type OpportunitySortKey } from '../../utils/opportunityUtils'
import { KPI_ICON_PRESETS } from '../../design-system/enterprise'
import { ErpCommandBar } from '../../components/erp/ErpCommandBar'
import { crmModuleBreadcrumbs } from '../../utils/crmNavigation'
import { CrmDeleteConfirmModal } from '../../components/crm/CrmDeleteConfirmModal'
import { AssignOwnerDialog } from '../../components/crm/AssignOwnerDialog'
import { resolveStoreAction } from '../../store/storeAction'
import { canCrmPermission } from '../../utils/permissions'
import { Toast } from '../../components/ui/Toast'
import {
  buildSalesOrderNewUrl,
  resolveOpportunityCreateSalesOrderGate,
} from '../../utils/opportunitySalesOrderDraft'
import { resolveSalesOrderDetailPath } from '../../utils/crmSalesOrderNavigation'
import { notify } from '../../store/toastStore'

type PipelineView = 'kanban' | 'list' | 'follow-ups' | 'activities'

function usePipelineView(): [PipelineView, (view: PipelineView) => void] {
  const [params, setSearchParams] = useSearchParams()
  const viewParam = params.get('view')
  const view: PipelineView =
    viewParam === 'list' ? 'list'
    : viewParam === 'follow-ups' ? 'follow-ups'
    : viewParam === 'activities' ? 'activities'
    : 'kanban'

  function setView(next: PipelineView) {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev)
      if (next === 'kanban') p.delete('view')
      else p.set('view', next)
      return p
    }, { replace: true })
  }

  return [view, setView]
}

const VIEW_TABS: { id: PipelineView; label: string; icon: typeof LayoutGrid }[] = [
  { id: 'kanban', label: 'Pipeline', icon: LayoutGrid },
  { id: 'list', label: 'List', icon: Table2 },
  { id: 'follow-ups', label: 'Follow-ups', icon: Bell },
  { id: 'activities', label: 'Activities', icon: Activity },
]

export function OpportunityPipelinePage() {
  const navigate = useNavigate()
  const openDetailPanel = useUIStore((s) => s.openDetailPanel)
  const customers = useMasterStore((s) => s.customers)
  const [params] = useSearchParams()
  const [view, setView] = usePipelineView()
  const opportunities = useCrmStore((s) => s.opportunities)
  const deleteOpportunity = useCrmStore((s) => s.deleteOpportunity)
  const assignOpportunity = useCrmStore((s) => s.assignOpportunity)
  const canDelete = canCrmPermission('crm.opportunity.delete')
  const canEdit = canCrmPermission('crm.opportunity.update')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<OpportunitySortKey>('value')
  const [stageFilter, setStageFilter] = useState<OpportunityStage | ''>((params.get('stage') as OpportunityStage) ?? '')
  const [ownerFilter, setOwnerFilter] = useState(params.get('owner') ?? '')
  const [lostReasonFilter, setLostReasonFilter] = useState(params.get('lostReason') ?? '')

  useEffect(() => {
    const lr = params.get('lostReason') ?? ''
    if (lr) setLostReasonFilter(lr)
  }, [params])
  const [followUpOpp, setFollowUpOpp] = useState<Opportunity | null>(null)
  const [logActivityOpp, setLogActivityOpp] = useState<Opportunity | null>(null)
  const [deleteOppTarget, setDeleteOppTarget] = useState<Opportunity | null>(null)
  const [isDeletingOpp, setIsDeletingOpp] = useState(false)
  const [assignTargets, setAssignTargets] = useState<Opportunity[] | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const owners = useMemo(() => [...new Set(opportunities.map((o) => o.ownerName))].sort(), [opportunities])
  const masterEntries = useCrmMasterStore((s) => s.entries)

  const oppFilterFields = useMemo(() => buildOpportunityFilterFields(owners), [owners, masterEntries])

  const filterDrawer = useCrmFilterDrawer({
    values: { search, stage: stageFilter, owner: ownerFilter, lostReason: lostReasonFilter },
    onChange: (next) => {
      if (typeof next.search === 'string') setSearch(next.search)
      if (typeof next.stage === 'string') setStageFilter(next.stage as OpportunityStage | '')
      if (typeof next.owner === 'string') setOwnerFilter(next.owner)
      if (typeof next.lostReason === 'string') setLostReasonFilter(next.lostReason)
    },
    fields: oppFilterFields,
    defaults: { search: '', stage: '', owner: '', lostReason: '' },
    chipLabelResolver: opportunityFilterChipResolver,
  })

  const oppFiltersRecord = useMemo(
    () => ({ search, stage: stageFilter, owner: ownerFilter, lostReason: lostReasonFilter, sortBy }),
    [search, stageFilter, ownerFilter, lostReasonFilter, sortBy],
  )

  const applyOppFilters = useCallback((saved: Record<string, string>) => {
    setSearch(saved.search ?? '')
    setStageFilter((saved.stage ?? '') as OpportunityStage | '')
    setOwnerFilter(saved.owner ?? '')
    setLostReasonFilter(saved.lostReason ?? '')
    const sb = saved.sortBy
    if (
      sb === 'value' || sb === 'closeDate' || sb === 'probability'
      || sb === 'name' || sb === 'stage' || sb === 'owner' || sb === 'lastActivity'
    ) {
      setSortBy(sb)
    }
  }, [])

  const savedViews = useSavedViews({
    pageId: '/crm/opportunities',
    filters: oppFiltersRecord,
    onApply: applyOppFilters,
    systemPresets: OPPORTUNITY_REGISTER_PRESETS,
  })

  const clearFilters = useCallback(() => {
    filterDrawer.clearAll()
    setLostReasonFilter('')
    setSortBy('value')
  }, [filterDrawer])

  const filtered = useMemo(() => {
    return opportunities.filter((o) => {
      if (search) {
        const q = search.toLowerCase()
        const customer = customers.find((c) => c.id === o.customerId)
        const haystack = [
          o.opportunityName,
          o.opportunityNo,
          o.ownerName,
          customer?.customerName,
          customer?.customerCode,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(q)) return false
      }
      if (stageFilter && o.stage !== stageFilter) return false
      if (ownerFilter && o.ownerId !== ownerFilter && o.ownerName !== ownerFilter) return false
      if (lostReasonFilter && o.lostReason !== lostReasonFilter && !o.lostReason?.startsWith(`${lostReasonFilter}|`)) return false
      if (params.get('customer') && o.customerId !== params.get('customer')) return false
      return true
    })
  }, [opportunities, search, stageFilter, ownerFilter, lostReasonFilter, params, customers])

  const activeOppFilters = useMemo(
    () => hasActiveOpportunityFilters({
      search,
      stage: stageFilter,
      owner: ownerFilter,
      lostReason: lostReasonFilter,
    }),
    [search, stageFilter, ownerFilter, lostReasonFilter],
  )

  const sorted = useMemo(
    () => sortOpportunities(filtered, sortBy),
    [filtered, sortBy],
  )

  const kpis = useMemo(() => {
    const open = opportunities.filter((o) => o.status === 'open')
    const won = opportunities.filter((o) => o.stage === 'won')
    const pipeline = open.reduce((s, o) => s + o.value, 0)
    const weighted = open.reduce((s, o) => s + o.value * (o.probability / 100), 0)
    const winRate = opportunities.length > 0 ? Math.round((won.length / opportunities.length) * 100) : 0
    return { total: opportunities.length, open: open.length, pipeline, weighted, winRate }
  }, [opportunities])

  const oppKpiStrip = useMemo<EnterpriseKpiItem[]>(
    () => [
      {
        id: 'open',
        label: 'Open Deals',
        value: kpis.open,
        icon: KPI_ICON_PRESETS.open,
        accent: 'blue' as const,
        context: `${formatCompactCurrency(kpis.pipeline)} pipeline`,
        trend: { direction: 'up' as const, label: `${kpis.open} active`, tone: 'positive' as const },
        updatedAt: Date.now(),
      },
      {
        id: 'pipeline',
        label: 'Pipeline Value',
        value: formatCompactCurrency(kpis.pipeline),
        icon: KPI_ICON_PRESETS.pipeline,
        accent: 'green' as const,
        context: `${kpis.open} open opportunities`,
        updatedAt: Date.now(),
      },
      {
        id: 'weighted',
        label: 'Weighted Forecast',
        value: formatCompactCurrency(kpis.weighted),
        icon: KPI_ICON_PRESETS.revenue,
        accent: 'amber' as const,
        context: 'Probability-adjusted',
        updatedAt: Date.now(),
      },
      {
        id: 'win-rate',
        label: 'Win Rate',
        value: `${kpis.winRate}%`,
        icon: KPI_ICON_PRESETS.qualified,
        accent: 'slate' as const,
        context: `${kpis.total} total deals`,
        trend: kpis.winRate >= 30
          ? { direction: 'up' as const, label: 'Healthy', tone: 'positive' as const }
          : { direction: 'flat' as const, label: 'Monitor', tone: 'neutral' as const },
        updatedAt: Date.now(),
      },
    ],
    [kpis],
  )

  function openOpportunityPreview(opp: Opportunity) {
    const customer = customers.find((c) => c.id === opp.customerId)
    openDetailPanel({
      title: opp.opportunityNo,
      subtitle: `${opp.opportunityName} · ${opp.ownerName}`,
      fields: [
        { label: 'Company', value: customer?.customerName ?? '—' },
        { label: 'Stage', value: opportunityStageLabel(opp.stage) },
        { label: 'Value', value: formatCrmCurrency(opp.value) },
        { label: 'Probability', value: `${opp.probability}%` },
        { label: 'Weighted', value: formatCrmCurrency(opp.value * (opp.probability / 100)) },
        { label: 'Close Date', value: opp.expectedCloseDate?.slice(0, 10) ?? '—' },
        { label: 'Owner', value: opp.ownerName },
      ],
      timeline: opp.nextFollowUpDate
        ? [{ id: 'followup', label: 'Next follow-up', time: opp.nextFollowUpDate.slice(0, 10), status: 'current' }]
        : [],
      links: [{ label: 'Open opportunity', href: `/crm/opportunities/${opp.id}` }],
      aiSummary: `${opp.opportunityName} is in ${opportunityStageLabel(opp.stage).toLowerCase()} stage with ${opp.probability}% win probability. Weighted value ${formatCrmCurrency(opp.value * (opp.probability / 100))}.`,
      actions: [
        { label: 'Open deal', onClick: () => navigate(`/crm/opportunities/${opp.id}`), primary: true },
        { label: 'Edit', onClick: () => navigate(`/crm/opportunities/${opp.id}/edit`) },
      ],
    })
  }

  function exportSelectedOpportunities(selected: Opportunity[]) {
    void runCrmExport(
      'opportunities',
      () => exportRowsToCsv(
        'opportunities-selected',
        ['Opp No', 'Deal', 'Stage', 'Value', 'Probability', 'Owner'],
        selected.map((o) => [
          o.opportunityNo,
          o.opportunityName,
          opportunityStageLabel(o.stage),
          o.value,
          `${o.probability}%`,
          o.ownerName,
        ]),
      ),
      {
        ownerId: ownerFilter || undefined,
        stage: stageFilter || undefined,
        search: search || undefined,
      },
    ).then((r) => {
      if (!r.ok) setToast(r.error ?? 'Export failed')
    })
  }

  function confirmDeleteOpportunity() {
    if (!deleteOppTarget) return
    setIsDeletingOpp(true)
    void (async () => {
      try {
        const r = await resolveStoreAction(deleteOpportunity(deleteOppTarget.id))
        if (r.ok) {
          setDeleteOppTarget(null)
        } else {
          setToast(r.error ?? 'Delete failed')
        }
      } finally {
        setIsDeletingOpp(false)
      }
    })()
  }

  function openAssignDialog(selected: Opportunity[]) {
    if (selected.length === 0) return
    setAssignTargets(selected)
  }

  async function confirmAssignOwner(ownerId: string, ownerLabel: string) {
    const selected = assignTargets ?? []
    if (selected.length === 0) return { ok: false as const, error: 'No opportunities selected' }

    let updated = 0
    let lastError: string | undefined
    for (const opp of selected) {
      const result = await resolveStoreAction(assignOpportunity(opp.id, ownerId, ownerLabel))
      if (result.ok) updated += 1
      else lastError = result.error
    }
    if (updated > 0) {
      notify.success(`${updated} opportunit${updated === 1 ? 'y' : 'ies'} assigned to ${ownerLabel}`)
    }
    if (updated < selected.length) {
      return { ok: false as const, error: lastError ?? 'Some assignments failed' }
    }
  }

  const viewToggle = (
    <div className="crm-opp-view-toggle" role="group" aria-label="Pipeline view">
      {VIEW_TABS.map((tab) => {
        const Icon = tab.icon
        return (
          <button
            key={tab.id}
            type="button"
            aria-pressed={view === tab.id}
            onClick={() => setView(tab.id)}
          >
            <Icon className="mr-1 inline h-3.5 w-3.5" />
            {tab.label}
          </button>
        )
      })}
    </div>
  )

  return (
    <>
      <OperationalPageShell
        title="Opportunity Pipeline"
        description="Deals, follow-ups, and logged activities in one pipeline workspace"
        favoritePath="/crm/opportunities"
        badge="CRM"
        variant="dynamics"
        autoBreadcrumbs={false}
        breadcrumbs={crmModuleBreadcrumbs('Opportunities', '/crm/opportunities')}
        actions={viewToggle}
        commandBar={
          <ErpCommandBar
            inline
            sticky={false}
            primaryAction={{
              id: 'new-opp',
              label: 'New Opportunity',
              icon: Plus,
              onClick: () => navigate('/crm/opportunities/new'),
            }}
            moreActions={[
              { id: 'save-view', label: 'Save View', icon: Save, onClick: savedViews.openSaveDialog },
            ]}
          />
        }
        insights={undefined}
        filterBar={view !== 'list' ? (
          <CrmListFilterBar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search deal, opp no, company, owner…"
            activeFilterCount={filterDrawer.activeCount}
            onOpenFilters={filterDrawer.openDrawer}
            chips={filterDrawer.chips}
            onRemoveChip={filterDrawer.removeChip}
            onClearAll={filterDrawer.chips.length > 0 ? clearFilters : undefined}
            resultCount={sorted.length}
            savedView={savedViews.activeView}
            onSavedViewChange={savedViews.selectView}
            savedViews={savedViews.viewNames}
            sort={(
              <CrmListSortSelect
                value={sortBy}
                onChange={(v) => setSortBy(v as OpportunitySortKey)}
                aria-label="Sort opportunities"
                options={[
                  { value: 'value', label: 'Sort: Deal Value' },
                  { value: 'closeDate', label: 'Sort: Close Date' },
                  { value: 'probability', label: 'Sort: Probability' },
                  { value: 'name', label: 'Sort: Deal Name' },
                  { value: 'stage', label: 'Sort: Stage' },
                  { value: 'owner', label: 'Sort: Owner' },
                  { value: 'lastActivity', label: 'Sort: Last Activity' },
                ]}
              />
            )}
          />
        ) : undefined}
        kpiStrip={oppKpiStrip}
      >
        <div className="crm-opp-workspace">
          {view === 'kanban' ? (
            <OpportunityKanban opportunities={sorted} />
          ) : view === 'list' ? (
            <EnterpriseRegisterTableShell>
              <CrmOpportunitiesTable
                rows={sorted}
                search={search}
                onSearchChange={setSearch}
                showCompactSearch={false}
                hasActiveFilters={activeOppFilters}
                onClearFilters={clearFilters}
                registerFilter={{
                  search,
                  onSearchChange: setSearch,
                  searchPlaceholder: 'Search deal, opp no, company, owner…',
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
                      onChange={(v) => setSortBy(v as OpportunitySortKey)}
                      aria-label="Sort opportunities"
                      options={[
                        { value: 'value', label: 'Sort: Deal Value' },
                        { value: 'closeDate', label: 'Sort: Close Date' },
                        { value: 'probability', label: 'Sort: Probability' },
                        { value: 'name', label: 'Sort: Deal Name' },
                        { value: 'stage', label: 'Sort: Stage' },
                        { value: 'owner', label: 'Sort: Owner' },
                        { value: 'lastActivity', label: 'Sort: Last Activity' },
                      ]}
                    />
                  ),
                }}
                emptyAction={
                  sorted.length === 0 ? (
                    <div className="flex flex-wrap justify-center gap-2">
                      <button type="button" className="erp-btn erp-btn--primary text-[13px]" onClick={() => navigate('/crm/opportunities/new')}>
                        New Opportunity
                      </button>
                    </div>
                  ) : undefined
                }
                onPreview={openOpportunityPreview}
                onView={(row) => navigate(`/crm/opportunities/${row.id}`)}
                onEdit={(row) => navigate(`/crm/opportunities/${row.id}/edit`)}
                onCreateQuotation={(row) => navigate(`/crm/quotations/new?opportunityId=${row.id}`)}
                onScheduleActivity={(row) => setFollowUpOpp(row)}
                onLogActivity={(row) => setLogActivityOpp(row)}
                onCreateSalesOrder={(row) => {
                  const gate = resolveOpportunityCreateSalesOrderGate(row.id)
                  if (gate.salesOrderId) {
                    navigate(resolveSalesOrderDetailPath(gate.salesOrderId, true))
                    return
                  }
                  if (!gate.enabled) {
                    notify.error(gate.disabledReason ?? 'Available after quotation approval.')
                    return
                  }
                  navigate(buildSalesOrderNewUrl(row.id, gate.quotationDocumentId, { fromCrm: true }))
                }}
                onMoveStage={(row) => navigate(`/crm/opportunities/${row.id}`)}
                onBulkExport={exportSelectedOpportunities}
                onBulkAssign={openAssignDialog}
                onDelete={(row) => setDeleteOppTarget(row)}
                onBulkDelete={(selected) => selected.length === 1 && setDeleteOppTarget(selected[0]!)}
                canEdit={canEdit}
                canDelete={canDelete}
              />
            </EnterpriseRegisterTableShell>
          ) : view === 'follow-ups' ? (
            <CrmFollowUpsPanel scope="pipeline" />
          ) : (
            <CrmActivitiesPanel scope="pipeline" />
          )}
        </div>
      </OperationalPageShell>

      <CrmFilterDrawer
        open={filterDrawer.open}
        onClose={filterDrawer.closeDrawer}
        fields={oppFilterFields}
        values={filterDrawer.draft}
        onChange={(next) => filterDrawer.setDraft({ ...filterDrawer.draft, ...next })}
        onApply={filterDrawer.applyFilters}
        onReset={filterDrawer.resetDraft}
      />
      <QuickFollowUpDrawer
        open={!!followUpOpp}
        onClose={() => setFollowUpOpp(null)}
        context={{
          customerId: followUpOpp?.customerId,
          contactId: followUpOpp?.contactId ?? undefined,
          opportunityId: followUpOpp?.id,
          assignedTo: followUpOpp?.ownerId,
          assignedToName: followUpOpp?.ownerName,
        }}
      />
      <LogActivityDrawer
        open={!!logActivityOpp}
        onClose={() => setLogActivityOpp(null)}
        context={{
          customerId: logActivityOpp?.customerId,
          contactId: logActivityOpp?.contactId ?? undefined,
          opportunityId: logActivityOpp?.id,
        }}
      />
      <SaveViewDialog
        open={savedViews.saveDialogOpen}
        defaultName={savedViews.activeView === 'My View' ? '' : savedViews.activeView}
        onClose={savedViews.closeSaveDialog}
        onSave={savedViews.saveCurrentView}
      />
      <CrmDeleteConfirmModal
        open={Boolean(deleteOppTarget)}
        title={`Delete ${deleteOppTarget?.opportunityName ?? 'opportunity'}?`}
        onCancel={() => setDeleteOppTarget(null)}
        onConfirm={confirmDeleteOpportunity}
        isDeleting={isDeletingOpp}
      />
      <AssignOwnerDialog
        open={Boolean(assignTargets?.length)}
        onClose={() => setAssignTargets(null)}
        entityKind="opportunity"
        count={assignTargets?.length ?? 0}
        currentOwnerId={assignTargets?.length === 1 ? assignTargets[0]?.ownerId : undefined}
        currentOwnerName={assignTargets?.length === 1 ? assignTargets[0]?.ownerName : undefined}
        onAssign={confirmAssignOwner}
      />
      {toast ? <Toast message={toast} variant="error" /> : null}
    </>
  )
}

/** @deprecated Use OpportunityPipelinePage */
export const OpportunityListPage = OpportunityPipelinePage

/** @deprecated Use OpportunityPipelinePage */
export const OpportunityKanbanPage = OpportunityPipelinePage
