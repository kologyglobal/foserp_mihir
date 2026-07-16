import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Download, Plus, Save, Upload } from 'lucide-react'
import { OperationalPageShell } from '../../components/design-system/OperationalPageShell'
import { SaveViewDialog } from '../../components/design-system/SaveViewDialog'
import { EnterpriseRegisterTableShell } from '../../design-system/list-page/EnterpriseRegisterTableShell'
import { ErpCommandBar } from '../../components/erp/ErpCommandBar'
import { CrmLeadsTable } from '../../components/crm/CrmLeadsTable'
import { CrmFilterDrawer } from '../../components/crm/CrmFilterDrawer'
import { CrmListSortSelect } from '../../components/crm/CrmListFilterBar'
import { DeleteLeadModal } from '../../components/crm/DeleteLeadModal'
import { AssignOwnerDialog } from '../../components/crm/AssignOwnerDialog'
import { LeadHistoryDrawer } from '../../components/crm/LeadHistoryDrawer'
import { LeadImportDialog } from '../../components/crm/LeadImportDialog'
import { useSalesStore } from '../../store/salesStore'
import { resolveStoreAction } from '../../store/storeAction'
import { useCrmStore } from '../../store/crmStore'
import { useMasterStore } from '../../store/masterStore'
import { useSavedViews } from '../../hooks/useSavedViews'
import { useCrmFilterDrawer } from '../../hooks/useCrmFilterDrawer'
import { LEAD_REGISTER_PRESETS } from '../../config/savedViewPresets'
import {
  buildLeadFilterFields,
  crmValuesToLeadFilters,
  leadFilterChipLabelResolver,
  leadFiltersToCrmValues,
} from '../../config/crmLeadFilterConfig'
import { buildLeadRegisterKpiItems } from '../../utils/leadKpiItems'
import { exportRowsToCsv } from '../../utils/exportCsv'
import { runCrmExport } from '../../utils/crmServerExport'
import { useApiMode } from '@/hooks/useApiMode'
import { downloadLeadImportTemplate } from '../../utils/leadImport'
import { canCrmPermission } from '../../utils/permissions'
import {
  filterActivitiesForLead,
  filterFollowUpsForLead,
  leadEngagementContext,
  linkedOpportunityIdsForLead,
  primaryLinkedOpportunityIdForLead,
} from '../../utils/leadEngagement'
import {
  isLeadStageLocked,
  leadStageLabel,
  resolveLeadConvertToOpportunityGate,
} from '../../utils/leadUtils'
import {
  DEFAULT_LEAD_LIST_FILTERS,
  type LeadListFilters,
  enrichLeadRow,
  filterLeadRows,
  sortLeadRows,
  type LeadSortKey,
  canDeleteLead,
  leadDisplayStatusLabel,
  hasActiveLeadFilters,
  serializeLeadFilters,
} from '../../utils/leadListUtils'
import { notify } from '../../store/toastStore'
import { QuickFollowUpDrawer } from '../../components/crm/QuickFollowUpDrawer'
import { LogActivityDrawer } from '../../components/crm/CrmQuickCreateDrawers'
import { useLeadRoutes } from '../../hooks/useLeadRoutes'
import { leadListBreadcrumbs } from '../../utils/crmLeadNavigation'
import { getLeadUser } from '../../data/crm/leadUsers'

export function CrmLeadListPage() {
  const apiMode = useApiMode()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const routes = useLeadRoutes()
  const leads = useSalesStore((s) => s.leads)
  const quotations = useSalesStore((s) => s.quotations)
  const archiveLead = useSalesStore((s) => s.archiveLead)
  const updateLead = useSalesStore((s) => s.updateLead)
  const assignLead = useSalesStore((s) => s.assignLead)
  const customers = useMasterStore((s) => s.customers)
  const opportunities = useCrmStore((s) => s.opportunities)
  const activities = useCrmStore((s) => s.activities)
  const followUps = useCrmStore((s) => s.followUps)

  const [filters, setFilters] = useState<LeadListFilters>({ ...DEFAULT_LEAD_LIST_FILTERS })
  const [sortBy, setSortBy] = useState<LeadSortKey>('lastModified')
  const [historyLeadId, setHistoryLeadId] = useState<string | null>(null)
  const [activityLeadId, setActivityLeadId] = useState<string | null>(null)
  const [historyFollowUpOpen, setHistoryFollowUpOpen] = useState(false)
  const [logActivityOpen, setLogActivityOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ReturnType<typeof enrichLeadRow> | null>(null)
  const [deleteBlockReason, setDeleteBlockReason] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [assignTargets, setAssignTargets] = useState<ReturnType<typeof enrichLeadRow>[] | null>(null)

  const canEdit = canCrmPermission('crm.lead.update')
  const canDelete = canCrmPermission('crm.lead.delete')

  useEffect(() => {
    const stage = searchParams.get('stage') ?? ''
    const priority = searchParams.get('priority') ?? ''
    const ownerCode = searchParams.get('owner') ?? ''
    const owner = ownerCode ? (getLeadUser(ownerCode)?.name ?? ownerCode) : ''
    if (stage || priority || owner) {
      setFilters((prev) => ({
        ...prev,
        ...(stage ? { stage } : {}),
        ...(priority ? { priority } : {}),
        ...(owner ? { owner } : {}),
      }))
    }
  }, [searchParams])

  const applyLeadFilters = useCallback((saved: Record<string, string>) => {
    setFilters({
      ...DEFAULT_LEAD_LIST_FILTERS,
      search: saved.search ?? '',
      stage: saved.stage ?? '',
      status: saved.status ?? '',
      owner: saved.owner ?? '',
      source: saved.source ?? '',
      industry: saved.industry ?? '',
      priority: saved.priority ?? '',
      probMin: saved.probMin ?? '',
      probMax: saved.probMax ?? '',
      valueMin: saved.valueMin ?? '',
      valueMax: saved.valueMax ?? '',
      dateFrom: saved.dateFrom ?? '',
      dateTo: saved.dateTo ?? '',
      modifiedFrom: saved.modifiedFrom ?? '',
      modifiedTo: saved.modifiedTo ?? '',
    })
    const sb = saved.sortBy
    if (
      sb === 'lastModified' || sb === 'prospect' || sb === 'expectedValue'
      || sb === 'probability' || sb === 'createdDate' || sb === 'owner' || sb === 'stage'
    ) {
      setSortBy(sb)
    }
  }, [])

  const savedViews = useSavedViews({
    pageId: routes.base,
    filters: { ...serializeLeadFilters(filters), sortBy },
    onApply: applyLeadFilters,
    systemPresets: LEAD_REGISTER_PRESETS,
  })

  const enrichedRows = useMemo(() => {
    const visible = leads.filter((l) => !l.isArchived)
    const rows = visible.map((lead) => {
      const customer = lead.customerId ? customers.find((c) => c.id === lead.customerId) : undefined
      return enrichLeadRow(lead, customer)
    })
    return sortLeadRows(filterLeadRows(rows, filters), sortBy)
  }, [leads, customers, filters, sortBy])

  const ownerOptions = useMemo(
    () => [...new Set(leads.map((l) => l.leadOwnerName))].sort(),
    [leads],
  )
  const sourceOptions = useMemo(
    () => [...new Set(enrichedRows.map((r) => r.sourceDisplay))].sort(),
    [enrichedRows],
  )
  const industryOptions = useMemo(
    () => [...new Set(enrichedRows.map((r) => r.industryDisplay).filter((i) => i !== '—'))].sort(),
    [enrichedRows],
  )

  const leadFilterFields = useMemo(
    () => buildLeadFilterFields({ ownerOptions, sourceOptions, industryOptions }),
    [ownerOptions, sourceOptions, industryOptions],
  )

  const filterDrawer = useCrmFilterDrawer({
    values: leadFiltersToCrmValues(filters),
    onChange: (next) => setFilters(crmValuesToLeadFilters(next)),
    fields: leadFilterFields,
    defaults: leadFiltersToCrmValues(DEFAULT_LEAD_LIST_FILTERS),
    chipLabelResolver: leadFilterChipLabelResolver,
  })

  const leadKpis = useMemo(() => {
    const visible = leads.filter((l) => !l.isArchived)
    const open = visible.filter((l) => l.stage !== 'closed' && l.stage !== 'converted_to_opportunity').length
    const qualified = visible.filter((l) => l.stage === 'qualified' || l.stage === 'requirement_collected').length
    const converted = visible.filter((l) => l.stage === 'converted_to_opportunity').length
    const lost = visible.filter((l) => l.stage === 'closed').length
    const pipeline = visible.reduce((s, l) => s + l.expectedValue, 0)
    return { open, qualified, converted, lost, pipeline }
  }, [leads])

  const leadKpiStrip = useMemo(
    () => buildLeadRegisterKpiItems(
      leads,
      leadKpis,
      { status: filters.status, stage: filters.stage },
      (patch) => setFilters((f) => ({ ...f, ...patch })),
    ),
    [leads, leadKpis, filters.status, filters.stage],
  )

  const historyLead = historyLeadId ? leads.find((l) => l.id === historyLeadId) ?? null : null
  const activityLead = activityLeadId ? leads.find((l) => l.id === activityLeadId) ?? null : null
  const historyCtx = historyLead ? leadEngagementContext(historyLead) : undefined
  const activityCtx = activityLead ? leadEngagementContext(activityLead) : historyCtx

  function clearFilters() {
    filterDrawer.clearAll()
  }

  function showToast(message: string, variant: 'error' | 'success' | 'warning' = 'error') {
    if (variant === 'success') notify.success(message)
    else if (variant === 'warning') notify.warning(message)
    else notify.failed(message)
  }

  function exportLeads() {
    void runCrmExport(
      'leads',
      () => exportRowsToCsv(
        'leads',
        [
          'Lead No', 'Prospect', 'Source', 'Industry', 'Lead Owner', 'Expected Value', 'Probability',
          'Status', 'Stage', 'Last Modified On',
        ],
        enrichedRows.map((r) => [
          r.lead.leadNo,
          r.prospectDisplay,
          r.sourceDisplay,
          r.industryDisplay,
          r.lead.leadOwnerName,
          r.lead.expectedValue,
          `${r.lead.probability}%`,
          leadDisplayStatusLabel(r.displayStatus),
          leadStageLabel(r.lead.stage),
          r.lastModified,
        ]),
      ),
      serializeLeadFilters(filters),
    ).then((r) => {
      if (!r.ok) showToast(r.error ?? 'Export failed')
    })
  }

  function openDeleteModal(row: ReturnType<typeof enrichLeadRow>) {
    const opportunityCount = opportunities.filter((o) => o.leadId === row.lead.id).length
    const quotationCount = quotations.filter((q) => q.opportunityId && opportunities.some((o) => o.leadId === row.lead.id && o.id === q.opportunityId)).length
    const linkedOppIds = linkedOpportunityIdsForLead(row.lead, opportunities)
    const check = canDeleteLead({
      lead: row.lead,
      opportunities,
      activities: filterActivitiesForLead(row.lead, activities, linkedOppIds),
      followUps: filterFollowUpsForLead(row.lead, followUps, linkedOppIds),
      inquiryCount: opportunityCount,
      quotationCount,
    })
    setDeleteBlockReason(check.ok ? null : check.reason ?? null)
    setDeleteTarget(row)
  }

  function confirmDelete() {
    if (!deleteTarget || deleteBlockReason) return
    setIsDeleting(true)
    void (async () => {
      try {
        const r = await resolveStoreAction(archiveLead(deleteTarget.lead.id))
        if (r.ok) {
          setDeleteTarget(null)
          showToast('Lead archived from active records', 'success')
        } else {
          showToast(r.error ?? 'Delete failed')
        }
      } finally {
        setIsDeleting(false)
      }
    })()
  }

  function openLeadImport() {
    downloadLeadImportTemplate()
    setImportOpen(true)
    showToast('Lead import template downloaded — fill it and upload in the dialog', 'success')
  }

  function exportSelectedLeads(selected: ReturnType<typeof enrichLeadRow>[]) {
    exportRowsToCsv(
      'leads-selected',
      ['Lead No', 'Prospect', 'Owner', 'Stage', 'Value'],
      selected.map((r) => [
        r.lead.leadNo,
        r.prospectDisplay,
        r.lead.leadOwnerName,
        leadStageLabel(r.lead.stage),
        r.lead.expectedValue,
      ]),
    )
  }

  function bulkSetActivityStatus(selected: ReturnType<typeof enrichLeadRow>[], status: 'active' | 'inactive') {
    void (async () => {
      if (apiMode) {
        const { bulkStatusLeadsApi } = await import('../../services/api/crmApi')
        const res = await bulkStatusLeadsApi(
          selected.map((r) => r.lead.id),
          status,
        )
        showToast(`${res.data.processed} lead${res.data.processed === 1 ? '' : 's'} marked ${status}`, res.data.failed ? 'warning' : 'success')
        return
      }
      let updated = 0
      for (const row of selected) {
        const result = await resolveStoreAction(updateLead(row.lead.id, { activityStatus: status }))
        if (result.ok) updated += 1
      }
      showToast(`${updated} lead${updated === 1 ? '' : 's'} marked ${status}`, 'success')
    })()
  }

  function openAssignDialog(selected: ReturnType<typeof enrichLeadRow>[]) {
    if (selected.length === 0) return
    setAssignTargets(selected)
  }

  async function confirmAssignOwner(ownerId: string, ownerLabel: string) {
    const selected = assignTargets ?? []
    if (selected.length === 0) return { ok: false as const, error: 'No leads selected' }

    if (apiMode) {
      try {
        const { bulkAssignLeadsApi } = await import('../../services/api/crmApi')
        const res = await bulkAssignLeadsApi(selected.map((r) => r.lead.id), ownerId)
        const failedIds = new Set(res.data.failures.map((f) => f.id))
        useSalesStore.setState((s) => ({
          leads: s.leads.map((l) => {
            if (!selected.some((r) => r.lead.id === l.id) || failedIds.has(l.id)) return l
            return {
              ...l,
              leadOwnerId: ownerId,
              leadOwnerName: ownerLabel,
              salesOwner: ownerLabel,
            }
          }),
        }))
        showToast(
          `${res.data.processed} lead${res.data.processed === 1 ? '' : 's'} assigned to ${ownerLabel}`,
          res.data.failed ? 'warning' : 'success',
        )
        if (res.data.processed === 0) {
          return { ok: false as const, error: res.data.failures[0]?.message ?? 'Assignment failed' }
        }
        return
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Assignment failed'
        showToast(message)
        return { ok: false as const, error: message }
      }
    }

    let updated = 0
    let lastError: string | undefined
    for (const row of selected) {
      const result = await resolveStoreAction(assignLead(row.lead.id, ownerId))
      if (result.ok) updated += 1
      else lastError = result.error
    }
    if (updated > 0) {
      showToast(`${updated} lead${updated === 1 ? '' : 's'} assigned to ${ownerLabel}`, 'success')
    }
    if (updated < selected.length) {
      return { ok: false as const, error: lastError ?? 'Some assignments failed' }
    }
  }

  function bulkEmailLeads(selected: ReturnType<typeof enrichLeadRow>[]) {
    const emails = selected
      .map((r) => r.lead.email)
      .filter((e): e is string => Boolean(e))
    if (emails.length === 0) {
      showToast('No email addresses on selected leads', 'warning')
      return
    }
    window.location.href = `mailto:${emails.join(',')}?subject=Follow-up`
  }

  return (
    <>
      <OperationalPageShell
        title="Leads"
        description="Manage prospects, lead ownership, stages, expected value and conversion readiness."
        favoritePath={routes.favoritePath}
        badge="CRM"
        variant="dynamics"
        autoBreadcrumbs={false}
        breadcrumbs={leadListBreadcrumbs(routes)}
        commandBar={
          <ErpCommandBar
            inline
            sticky={false}
            primaryAction={{
              id: 'new-lead',
              label: 'New Lead',
              icon: Plus,
              onClick: () => navigate(routes.new),
            }}
            secondaryActions={[
              { id: 'import', label: 'Import', icon: Upload, onClick: openLeadImport },
              { id: 'export', label: 'Export', icon: Download, onClick: exportLeads },
            ]}
            moreActions={[
              { id: 'save-view', label: 'Save View', icon: Save, onClick: savedViews.openSaveDialog },
            ]}
          />
        }
        kpiStrip={leadKpiStrip}
      >
        <EnterpriseRegisterTableShell>
          <CrmLeadsTable
            rows={enrichedRows}
            routes={routes}
            canEdit={canEdit}
            canDelete={canDelete}
            search={filters.search}
            onSearchChange={(search) => setFilters((f) => ({ ...f, search }))}
            showCompactSearch={false}
            hasActiveFilters={hasActiveLeadFilters(filters)}
            onClearFilters={clearFilters}
            registerFilter={{
              search: filters.search,
              onSearchChange: (search) => setFilters((f) => ({ ...f, search })),
              searchPlaceholder: 'Search Lead ID, Company, Contact, Owner, Mobile…',
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
                  onChange={(v) => setSortBy(v as LeadSortKey)}
                  aria-label="Sort leads"
                  options={[
                    { value: 'lastModified', label: 'Sort: Last Modified' },
                    { value: 'prospect', label: 'Sort: Prospect / Company' },
                    { value: 'expectedValue', label: 'Sort: Expected Value' },
                    { value: 'probability', label: 'Sort: Probability' },
                    { value: 'createdDate', label: 'Sort: Created Date' },
                    { value: 'owner', label: 'Sort: Owner' },
                    { value: 'stage', label: 'Sort: Stage' },
                  ]}
                />
              ),
            }}
            emptyAction={
              enrichedRows.length === 0 ? (
                <div className="flex flex-wrap justify-center gap-2">
                  <button type="button" className="erp-btn erp-btn--primary text-[13px]" onClick={() => navigate(routes.new)}>
                    New Lead
                  </button>
                  <button type="button" className="erp-btn erp-btn--secondary text-[13px]" onClick={openLeadImport}>
                    Import Leads
                  </button>
                </div>
              ) : undefined
            }
            onView={(row) => navigate(routes.view(row.lead.id))}
            onEdit={(row) => {
              if (isLeadStageLocked(row.lead.stage)) {
                showToast('This lead is locked (converted or closed) and cannot be edited', 'warning')
                return
              }
              navigate(routes.edit(row.lead.id))
            }}
            onDelete={openDeleteModal}
            onCreateOpportunity={(row) => {
              const gate = resolveLeadConvertToOpportunityGate(row.lead)
              if (!gate.ok) {
                showToast(gate.reason, 'warning')
                return
              }
              const { customerId, id: leadId } = row.lead
              navigate(`/crm/opportunities/new?customerId=${encodeURIComponent(customerId!)}&leadId=${encodeURIComponent(leadId)}`)
            }}
            onScheduleActivity={(row) => {
              setActivityLeadId(row.lead.id)
              setLogActivityOpen(true)
            }}
            linkedOpportunityId={(row) => primaryLinkedOpportunityIdForLead(row.lead, opportunities)}
            onCreateQuotation={(row) => {
              const oppId = primaryLinkedOpportunityIdForLead(row.lead, opportunities)
              if (!oppId) {
                showToast('Convert to opportunity before creating a quotation', 'warning')
                return
              }
              navigate(`/crm/quotations/new?opportunityId=${encodeURIComponent(oppId)}`)
            }}
            onBulkExport={exportSelectedLeads}
            onBulkDelete={(selected) => selected.forEach((r) => openDeleteModal(r))}
            onBulkInactive={(selected) => bulkSetActivityStatus(selected, 'inactive')}
            onBulkActive={(selected) => bulkSetActivityStatus(selected, 'active')}
            onBulkChangeOwner={openAssignDialog}
            onAssign={openAssignDialog}
            onBulkEmail={bulkEmailLeads}
          />
        </EnterpriseRegisterTableShell>
      </OperationalPageShell>

      <LeadImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={(count) => {
          showToast(`${count} lead${count === 1 ? '' : 's'} imported`, 'success')
        }}
      />
      <CrmFilterDrawer
        open={filterDrawer.open}
        onClose={filterDrawer.closeDrawer}
        fields={leadFilterFields}
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
      <LeadHistoryDrawer
        open={Boolean(historyLead)}
        lead={historyLead}
        leadViewPath={historyLead ? routes.view(historyLead.id) : undefined}
        onClose={() => { setHistoryLeadId(null); setHistoryFollowUpOpen(false) }}
        onScheduleFollowUp={() => setHistoryFollowUpOpen(true)}
        onLogActivity={() => {
          if (historyLead) setActivityLeadId(historyLead.id)
          setLogActivityOpen(true)
        }}
      />
      <QuickFollowUpDrawer
        open={historyFollowUpOpen}
        onClose={() => setHistoryFollowUpOpen(false)}
        context={historyCtx}
      />
      <LogActivityDrawer
        open={logActivityOpen}
        onClose={() => { setLogActivityOpen(false); setActivityLeadId(null) }}
        context={activityCtx ? { ...activityCtx, lockLead: true } : undefined}
      />
      <DeleteLeadModal
        open={Boolean(deleteTarget)}
        leadLabel={deleteTarget?.lead.leadNo ?? ''}
        blockReason={deleteBlockReason}
        onCancel={() => { setDeleteTarget(null); setDeleteBlockReason(null) }}
        onConfirm={confirmDelete}
        isDeleting={isDeleting}
      />
      <AssignOwnerDialog
        open={Boolean(assignTargets?.length)}
        onClose={() => setAssignTargets(null)}
        entityKind="lead"
        count={assignTargets?.length ?? 0}
        currentOwnerId={assignTargets?.length === 1 ? assignTargets[0]?.lead.leadOwnerId : undefined}
        currentOwnerName={assignTargets?.length === 1 ? assignTargets[0]?.lead.leadOwnerName : undefined}
        onAssign={confirmAssignOwner}
      />
    </>
  )
}

export function LeadListPage() {
  return <CrmLeadListPage />
}
