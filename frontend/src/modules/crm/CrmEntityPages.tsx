import { useCallback, useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import {
  Target, Plus, UserPlus, Calendar,
  Download, Upload, Save,
} from 'lucide-react'
import { entity360CustomerPath } from '../../config/entity360Routes'
import { useMasterStore } from '../../store/masterStore'
import { useCrmStore } from '../../store/crmStore'
import { useMrpStore } from '../../store/mrpStore'
import { useReceivables } from '../../hooks/useStableStoreData'
import { useUIStore } from '../../store/uiStore'
import { COMPANY_TERMINOLOGY } from '../../utils/companyLabels'
import { QuickFollowUpDrawer } from '../../components/crm'
import { CompanyImportDialog } from '../../components/crm/CompanyImportDialog'
import { ContactImportDialog } from '../../components/crm/ContactImportDialog'
import { OperationalPageShell } from '../../components/design-system/OperationalPageShell'
import { CrmFilterDrawer } from '../../components/crm/CrmFilterDrawer'
import { CrmListSortSelect } from '../../components/crm/CrmListFilterBar'
import { SaveViewDialog } from '../../components/design-system/SaveViewDialog'
import { CrmCompaniesTable } from '../../components/crm/CrmCompaniesTable'
import { CrmContactsTable } from '../../components/crm/CrmContactsTable'
import type { EnrichedContactRow } from '../../components/crm/CrmContactsTable'
import type { EnterpriseKpiItem } from '../../design-system/enterprise/enterpriseKpiTypes'
import { KPI_ICON_PRESETS } from '../../design-system/enterprise'
import { EnterpriseRegisterTableShell } from '../../design-system/list-page/EnterpriseRegisterTableShell'
import { formatCompactCurrency } from '../../utils/formatters/currency'
import { formatCrmCurrency } from '../../utils/crmMetrics'
import { exportRowsToCsv } from '../../utils/exportCsv'
import { runCrmExport } from '../../utils/crmServerExport'
import { ErpCommandBar } from '../../components/erp/ErpCommandBar'
import { crmModuleBreadcrumbs } from '../../utils/crmNavigation'
import { useSavedViews } from '../../hooks/useSavedViews'
import { useCrmFilterDrawer } from '../../hooks/useCrmFilterDrawer'
import { useDesignationOptions } from '../../hooks/useCrmMasters'
import {
  buildContactFilterFields,
  contactFilterChipResolver,
} from '../../config/crmContactFilterConfig'
import {
  buildCompanyFilterFields,
  companyFiltersToCrmValues,
  crmValuesToCompanyFilters,
} from '../../config/crmCompanyFilterConfig'
import {
  buildCompanyPortfolioKpis,
  buildEnrichedCompanyRows,
  DEFAULT_COMPANY_FILTERS,
  filterCompanyRows,
  filtersToRecord,
  hasActiveCompanyFilters,
  recordToFilters,
  sortCompanyRows,
  type CompanyPortfolioFilters,
  type CompanySortKey,
} from '../../utils/crmCompaniesPortfolio'
import { COMPANY_REGISTER_PRESETS, CONTACT_REGISTER_PRESETS } from '../../config/savedViewPresets'
import type { CrmContact } from '../../types/crm'
import { CrmDeleteConfirmModal } from '../../components/crm/CrmDeleteConfirmModal'
import { resolveStoreAction } from '../../store/storeAction'
import { notify } from '../../store/toastStore'
import { canCrmPermission } from '../../utils/permissions'

export type CrmCustomersPageProps = {
  /** List hub path used for favorites + saved views */
  hubPath?: string
  title?: string
  description?: string
  /** Module identity in the page shell (CRM vs Sales). */
  badge?: string
  /** Resolve Company / Customer 360 URL for a given company id */
  customer360Path?: (customerId: string) => string
  breadcrumbs?: Array<{ label: string; to?: string }>
  /** Explicit page guide (CRM routes skip registry resolution by default). */
  pageGuide?: { purpose: string; nextStep?: string } | null
}

export function CrmCustomersPage({
  hubPath = '/crm/customers',
  title = 'Companies',
  description = 'CRM account hub — pipeline, opportunities, quotations, and activity by company (not Sales operations)',
  badge = 'CRM',
  customer360Path = entity360CustomerPath,
  breadcrumbs,
  pageGuide = {
    purpose: 'CRM companies — account relationships, pipeline, quotations, and activity. Operational receivables and order fulfilment use Sales → Companies.',
    nextStep:
      'Create Opportunity, Quotation, Follow-up, or Sales Order directly from here — funnel links are optional.',
  },
}: CrmCustomersPageProps = {}) {
  const navigate = useNavigate()
  const openDetailPanel = useUIStore((s) => s.openDetailPanel)
  const customers = useMasterStore((s) => s.customers)
  const contacts = useCrmStore((s) => s.contacts)
  const opportunities = useCrmStore((s) => s.opportunities)
  const followUps = useCrmStore((s) => s.followUps)
  const activities = useCrmStore((s) => s.activities)
  const quotationDocuments = useCrmStore((s) => s.quotationDocuments)
  const salesOrders = useMrpStore((s) => s.salesOrders)
  const receivables = useReceivables()
  const open360 = useCallback((customerId: string) => navigate(customer360Path(customerId)), [navigate, customer360Path])
  const pageBreadcrumbs = breadcrumbs ?? crmModuleBreadcrumbs(title, hubPath)

  const [filters, setFilters] = useState<CompanyPortfolioFilters>(DEFAULT_COMPANY_FILTERS)
  const [sortBy, setSortBy] = useState<CompanySortKey>('pipeline')
  const [followUpCustomer, setFollowUpCustomer] = useState<string | null>(null)
  const [quickFollowUpOpen, setQuickFollowUpOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const deleteCustomer = useMasterStore((s) => s.deleteCustomer)
  const canDelete = canCrmPermission('crm.company.delete')
  const [deleteCompanyTarget, setDeleteCompanyTarget] = useState<{ id: string; name: string } | null>(null)
  const [isDeletingCompany, setIsDeletingCompany] = useState(false)

  const patchFilters = useCallback((patch: Partial<CompanyPortfolioFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }))
  }, [])

  const applyFilters = useCallback((record: Record<string, string>) => {
    const next = recordToFilters(record)
    setFilters(next)
    if (
      next.sortBy === 'pipeline' || next.sortBy === 'lastActivity' || next.sortBy === 'followUp'
      || next.sortBy === 'openOpportunities' || next.sortBy === 'outstandingAr' || next.sortBy === 'name'
    ) {
      setSortBy(next.sortBy)
    }
  }, [])

  const savedViews = useSavedViews({
    pageId: hubPath,
    filters: { ...filtersToRecord(filters), sortBy },
    onApply: applyFilters,
    systemPresets: COMPANY_REGISTER_PRESETS,
  })

  const enriched = useMemo(
    () =>
      buildEnrichedCompanyRows({
        customers,
        contacts,
        opportunities,
        followUps,
        activities,
        quotationDocuments,
        salesOrders,
        receivables,
      }),
    [customers, contacts, opportunities, followUps, activities, quotationDocuments, salesOrders, receivables],
  )

  const filtered = useMemo(() => filterCompanyRows(enriched, filters), [enriched, filters])
  const sorted = useMemo(() => sortCompanyRows(filtered, sortBy), [filtered, sortBy])
  const kpis = useMemo(() => buildCompanyPortfolioKpis(enriched), [enriched])
  // Cap to 4 primary KPIs — quotes/AR demoted from first-viewport strip
  const companyKpiStrip = useMemo<EnterpriseKpiItem[]>(
    () => [
      { id: 'total', label: 'Total Companies', value: kpis.totalCompanies, icon: KPI_ICON_PRESETS.open, accent: 'blue', context: 'Portfolio size', updatedAt: Date.now() },
      {
        id: 'active-pipeline',
        label: 'Active Pipeline',
        value: kpis.activePipelineCompanies,
        icon: KPI_ICON_PRESETS.qualified,
        accent: 'green',
        context: `${kpis.openOpportunities} open opportunities`,
        onClick: () => patchFilters({ pipelineStatus: 'active', activeOpportunity: true }),
        updatedAt: Date.now(),
      },
      {
        id: 'pipeline-value',
        label: 'Pipeline Value',
        value: formatCompactCurrency(kpis.pipelineValue),
        icon: KPI_ICON_PRESETS.pipeline,
        accent: 'blue',
        context: `${formatCompactCurrency(kpis.quotationValue)} in quotes`,
        onClick: () => patchFilters({ pipelineStatus: 'active' }),
        updatedAt: Date.now(),
      },
      {
        id: 'overdue',
        label: 'Overdue Follow-ups',
        value: kpis.overdueFollowUps,
        icon: KPI_ICON_PRESETS.lost,
        accent: 'red',
        context: kpis.outstandingAr > 0
          ? `Needs action · ${formatCompactCurrency(kpis.outstandingAr)} AR`
          : 'Needs sales action today',
        trend: kpis.overdueFollowUps > 0 ? { direction: 'down', label: 'Action required', tone: 'negative' } : undefined,
        onClick: () => patchFilters({ overdueFollowUp: true }),
        updatedAt: Date.now(),
      },
    ],
    [kpis, patchFilters],
  )

  const territories = useMemo(() => [...new Set(customers.map((c) => c.salesTerritory).filter(Boolean))].sort(), [customers])
  const cities = useMemo(() => [...new Set(customers.map((c) => c.city).filter(Boolean))].sort() as string[], [customers])
  const industries = useMemo(
    () => [...new Set(customers.map((c) => c.industry ?? 'Transport & Logistics'))].sort(),
    [customers],
  )
  const owners = useMemo(() => [...new Set(enriched.map((r) => r.ownerName))].sort(), [enriched])
  const types = useMemo(() => ['corporate', 'dealer', 'government'] as const, [])

  const companyFilterFields = useMemo(
    () => buildCompanyFilterFields({ cities, territories, industries, owners, types }),
    [cities, territories, industries, owners, types],
  )

  const filterDrawer = useCrmFilterDrawer({
    values: companyFiltersToCrmValues(filters),
    onChange: (next) => setFilters(crmValuesToCompanyFilters(next, sortBy)),
    fields: companyFilterFields,
    defaults: companyFiltersToCrmValues(DEFAULT_COMPANY_FILTERS),
    excludeFromCount: ['search', 'sortBy'],
  })

  function clearAllFilters() {
    filterDrawer.clearAll()
    setSortBy('pipeline')
  }

  function openCompanyPreview(row: (typeof sorted)[0]) {
    const { customer, summary, status, primaryContact, ownerName, outstandingAr, openQuotations } = row
    openDetailPanel({
      title: customer.customerName,
      subtitle: `${customer.city} · ${ownerName}`,
      fields: [
        { label: 'Code', value: customer.customerCode },
        { label: 'Primary Contact', value: primaryContact },
        { label: 'Owner', value: ownerName },
        { label: 'Status', value: status.label },
        { label: 'Pipeline', value: formatCrmCurrency(summary.pipelineValue) },
        { label: 'Open Opportunities', value: String(summary.openOpportunities) },
        { label: 'Open Quotations', value: String(openQuotations) },
        { label: 'Outstanding AR', value: formatCrmCurrency(outstandingAr) },
      ],
      timeline: [
        {
          id: 'activity',
          label: summary.lastActivityAt ? 'Last activity' : 'No recent activity',
          time: summary.lastActivityAt ?? '—',
          status: 'current',
        },
        ...(summary.nextFollowUpDate
          ? [{
              id: 'followup',
              label: summary.hasOverdueFollowUp ? 'Overdue follow-up' : 'Next follow-up',
              time: summary.nextFollowUpDate,
              status: summary.hasOverdueFollowUp ? 'pending' as const : 'current' as const,
            }]
          : []),
      ],
      links: [{ label: 'Open Customer 360', href: customer360Path(customer.id) }],
      aiSummary: `${customer.customerName} has ${summary.openOpportunities} open opportunit${summary.openOpportunities === 1 ? 'y' : 'ies'} worth ${formatCrmCurrency(summary.pipelineValue)}. Status: ${status.label.toLowerCase()}.${summary.hasOverdueFollowUp ? ' Overdue follow-up needs attention.' : ''}`,
      actions: [
        { label: 'Customer 360', onClick: () => open360(customer.id), primary: true },
        { label: 'New Opportunity', onClick: () => navigate(`/crm/opportunities/new?customerId=${customer.id}`) },
        { label: 'Follow-up', onClick: () => setFollowUpCustomer(customer.id) },
      ],
    })
  }

  function exportSelectedCompanies(selected: (typeof sorted)[0][]) {
    exportRowsToCsv(
      'companies-selected',
      [
        'Code',
        'Company',
        'City',
        'Territory',
        'Industry',
        'Type',
        'Owner',
        'Primary Contact',
        'Phone',
        'Pipeline',
        'Opportunities',
        'Quotations',
        'Quotation Value',
        'Open SO',
        'Outstanding AR',
        'Last Activity',
        'Next Follow-up',
        'Status',
      ],
      selected.map((r) => [
        r.customer.customerCode,
        r.customer.customerName,
        r.customer.city,
        r.customer.salesTerritory,
        r.customer.industry ?? 'Transport & Logistics',
        r.customer.customerType,
        r.ownerName,
        r.primaryContact,
        r.customer.contactPhone,
        r.summary.pipelineValue,
        r.summary.openOpportunities,
        r.openQuotations,
        r.quotationValue,
        r.openSO,
        r.outstandingAr,
        r.summary.lastActivityAt ?? '',
        r.summary.nextFollowUpDate ?? '',
        r.status.label,
      ]),
    )
  }

  function openDeleteCompany(row: { customer: { id: string; customerName: string } }) {
    setDeleteCompanyTarget({ id: row.customer.id, name: row.customer.customerName })
  }

  function confirmDeleteCompany() {
    if (!deleteCompanyTarget) return
    setIsDeletingCompany(true)
    void (async () => {
      try {
        const r = await resolveStoreAction(deleteCustomer(deleteCompanyTarget.id))
        if (r.ok) {
          setDeleteCompanyTarget(null)
          notify.success('Company deleted')
        } else {
          notify.error(r.error ?? 'Delete failed')
        }
      } finally {
        setIsDeletingCompany(false)
      }
    })()
  }

  function openCompanyImport() {
    setImportOpen(true)
  }

  function exportAllCompanies() {
    void runCrmExport(
      'companies',
      () => exportSelectedCompanies(sorted),
      { search: filters.search || undefined },
    ).then((r) => {
      if (!r.ok) notify.error(r.error ?? 'Export failed')
    })
  }

  return (
    <>
      <OperationalPageShell
        title={title}
        description={description}
        favoritePath={hubPath}
        badge={badge}
        variant="dynamics"
        autoBreadcrumbs={false}
        breadcrumbs={pageBreadcrumbs}
        pageGuide={pageGuide}
        commandBar={
          <ErpCommandBar
            inline
            sticky={false}
            primaryAction={{
              id: 'new-company',
              label: COMPANY_TERMINOLOGY.new,
              icon: Plus,
              onClick: () => navigate('/masters/companies/new'),
            }}
            secondaryActions={[
              { id: 'new-opp', label: 'New Opportunity', icon: Target, onClick: () => navigate('/crm/opportunities/new') },
              { id: 'quick-fu', label: 'Quick Follow-up', icon: Calendar, onClick: () => setQuickFollowUpOpen(true) },
              { id: 'import', label: 'Import', icon: Upload, onClick: openCompanyImport },
              { id: 'export', label: 'Export', icon: Download, onClick: exportAllCompanies },
            ]}
            moreActions={[
              { id: 'save-view', label: 'Save View', icon: Save, onClick: savedViews.openSaveDialog },
            ]}
          />
        }
        kpiStrip={companyKpiStrip}
      >
        <EnterpriseRegisterTableShell>
          <CrmCompaniesTable
            rows={sorted}
            search={filters.search}
            onSearchChange={(search) => patchFilters({ search })}
            showCompactSearch={false}
            hasActiveFilters={hasActiveCompanyFilters(filters)}
            onClearFilters={clearAllFilters}
            registerFilter={{
              search: filters.search,
              onSearchChange: (search) => patchFilters({ search }),
              searchPlaceholder: 'Search company, contact, city, owner…',
              activeFilterCount: filterDrawer.activeCount,
              onOpenFilters: filterDrawer.openDrawer,
              chips: filterDrawer.chips,
              onRemoveChip: filterDrawer.removeChip,
              onClearAll: clearAllFilters,
              savedView: savedViews.activeView,
              onSavedViewChange: savedViews.selectView,
              savedViews: savedViews.viewNames,
              onSaveView: savedViews.openSaveDialog,
              sort: (
                <CrmListSortSelect
                  value={sortBy}
                  onChange={(v) => setSortBy(v as CompanySortKey)}
                  aria-label="Sort companies"
                  options={[
                    { value: 'pipeline', label: 'Sort: Pipeline Value' },
                    { value: 'lastActivity', label: 'Sort: Last Activity' },
                    { value: 'followUp', label: 'Sort: Next Follow-up' },
                    { value: 'openOpportunities', label: 'Sort: Open Opportunities' },
                    { value: 'outstandingAr', label: 'Sort: Outstanding AR' },
                    { value: 'name', label: 'Sort: Company Name' },
                  ]}
                />
              ),
            }}
            emptyAction={
              sorted.length === 0 ? (
                <div className="flex flex-wrap justify-center gap-2">
                  <button type="button" className="erp-btn erp-btn--primary text-[13px]" onClick={() => navigate('/masters/companies/new')}>
                    {COMPANY_TERMINOLOGY.new}
                  </button>
                  <button type="button" className="erp-btn erp-btn--secondary text-[13px]" onClick={openCompanyImport}>
                    Import Companies
                  </button>
                </div>
              ) : undefined
            }
            onOpen360={open360}
            onOpportunity={(id) => navigate(`/crm/opportunities/new?customerId=${id}`)}
            onFollowUp={setFollowUpCustomer}
            onQuotation={(id) => navigate(`/crm/quotations/new?customerId=${id}`)}
            onPreview={openCompanyPreview}
            onBulkExport={exportSelectedCompanies}
            onDelete={openDeleteCompany}
            onBulkDelete={(selected) => selected.forEach((r) => openDeleteCompany(r))}
            canDelete={canDelete}
          />
        </EnterpriseRegisterTableShell>
      </OperationalPageShell>

      <CompanyImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={(count) => {
          notify.success(`${count} compan${count === 1 ? 'y' : 'ies'} imported`)
        }}
      />
      <CrmFilterDrawer
        open={filterDrawer.open}
        onClose={filterDrawer.closeDrawer}
        fields={companyFilterFields}
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
      <QuickFollowUpDrawer open={!!followUpCustomer} onClose={() => setFollowUpCustomer(null)} context={{ customerId: followUpCustomer }} />
      <QuickFollowUpDrawer open={quickFollowUpOpen} onClose={() => setQuickFollowUpOpen(false)} />
      <CrmDeleteConfirmModal
        open={Boolean(deleteCompanyTarget)}
        title={`Delete ${deleteCompanyTarget?.name ?? 'company'}?`}
        onCancel={() => setDeleteCompanyTarget(null)}
        onConfirm={confirmDeleteCompany}
        isDeleting={isDeletingCompany}
      />
    </>
  )
}

/** @deprecated Use `/crm/leads` (LeadListPage) */
export function CrmLeadsPage() {
  return <Navigate to="/crm/leads" replace />
}

export function CrmContactsPage() {
  const navigate = useNavigate()
  const openDetailPanel = useUIStore((s) => s.openDetailPanel)
  const contacts = useCrmStore((s) => s.contacts)
  const followUps = useCrmStore((s) => s.followUps)
  const activities = useCrmStore((s) => s.activities)
  const opportunities = useCrmStore((s) => s.opportunities)
  const customers = useMasterStore((s) => s.customers)
  const [search, setSearch] = useState('')
  const [customerFilter, setCustomerFilter] = useState('')
  const [designationFilter, setDesignationFilter] = useState('')
  const [cityFilter, setCityFilter] = useState('')
  const [territoryFilter, setTerritoryFilter] = useState('')
  const [primaryOnly, setPrimaryOnly] = useState(false)
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [sortBy, setSortBy] = useState<'name' | 'company' | 'designation' | 'lastActivity' | 'followUp'>('name')
  const [followUpContact, setFollowUpContact] = useState<CrmContact | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const deleteContact = useCrmStore((s) => s.deleteContact)
  const canDelete = canCrmPermission('crm.contact.delete')
  const [deleteContactTarget, setDeleteContactTarget] = useState<{ id: string; name: string } | null>(null)
  const [isDeletingContact, setIsDeletingContact] = useState(false)

  const designationMasterNames = useDesignationOptions()
  const designationFromContacts = useMemo(
    () => [...new Set(contacts.map((c) => c.designation).filter(Boolean))].sort(),
    [contacts],
  )
  const designationFilterOptions = useMemo(
    () => [...new Set([...designationMasterNames.map((o) => o.value), ...designationFromContacts])].sort(),
    [designationMasterNames, designationFromContacts],
  )
  const territories = useMemo(() => [...new Set(customers.map((c) => c.salesTerritory).filter(Boolean))].sort(), [customers])
  const cities = useMemo(() => [...new Set(customers.map((c) => c.city).filter(Boolean))].sort() as string[], [customers])

  const contactFilterFields = useMemo(
    () => buildContactFilterFields({
      customers: customers.map((c) => ({ id: c.id, customerName: c.customerName })),
      designations: designationFilterOptions,
      cities,
      territories: territories as string[],
    }),
    [customers, designationFilterOptions, cities, territories],
  )

  const contactFilterDrawer = useCrmFilterDrawer({
    values: {
      search,
      customer: customerFilter,
      designation: designationFilter,
      city: cityFilter,
      territory: territoryFilter,
      primaryOnly,
      overdueOnly,
    },
    onChange: (next) => {
      if (typeof next.search === 'string') setSearch(next.search)
      if (typeof next.customer === 'string') setCustomerFilter(next.customer)
      if (typeof next.designation === 'string') setDesignationFilter(next.designation)
      if (typeof next.city === 'string') setCityFilter(next.city)
      if (typeof next.territory === 'string') setTerritoryFilter(next.territory)
      if (typeof next.primaryOnly === 'boolean') setPrimaryOnly(next.primaryOnly)
      if (typeof next.overdueOnly === 'boolean') setOverdueOnly(next.overdueOnly)
    },
    fields: contactFilterFields,
    defaults: {
      search: '',
      customer: '',
      designation: '',
      city: '',
      territory: '',
      primaryOnly: false,
      overdueOnly: false,
    },
    chipLabelResolver: (key, value) => contactFilterChipResolver(key, value, customers),
  })

  const contactFiltersRecord = useMemo(
    () => ({
      search,
      customer: customerFilter,
      designation: designationFilter,
      city: cityFilter,
      territory: territoryFilter,
      primaryOnly: primaryOnly ? 'true' : 'false',
      overdueOnly: overdueOnly ? 'true' : 'false',
      sortBy,
    }),
    [search, customerFilter, designationFilter, cityFilter, territoryFilter, primaryOnly, overdueOnly, sortBy],
  )

  const applyContactFilters = useCallback((saved: Record<string, string>) => {
    setSearch(saved.search ?? '')
    setCustomerFilter(saved.customer ?? '')
    setDesignationFilter(saved.designation ?? '')
    setCityFilter(saved.city ?? '')
    setTerritoryFilter(saved.territory ?? '')
    setPrimaryOnly(saved.primaryOnly === 'true')
    setOverdueOnly(saved.overdueOnly === 'true')
    const sb = saved.sortBy
    if (sb === 'name' || sb === 'company' || sb === 'designation' || sb === 'lastActivity' || sb === 'followUp') {
      setSortBy(sb)
    }
  }, [])

  const savedViews = useSavedViews({
    pageId: '/crm/contacts',
    filters: contactFiltersRecord,
    onApply: applyContactFilters,
    systemPresets: CONTACT_REGISTER_PRESETS,
  })

  const clearFilters = useCallback(() => {
    contactFilterDrawer.clearAll()
    setSortBy('name')
  }, [contactFilterDrawer])

  const hasActiveContactFilters = useMemo(
    () => Boolean(
      search.trim()
      || customerFilter
      || designationFilter
      || cityFilter
      || territoryFilter
      || primaryOnly
      || overdueOnly,
    ),
    [search, customerFilter, designationFilter, cityFilter, territoryFilter, primaryOnly, overdueOnly],
  )

  const rows = useMemo(() => {
    const list = contacts
      .filter((c) => {
        const cust = customers.find((x) => x.id === c.customerId)
        if (search) {
          const q = search.toLowerCase()
          const haystack = [
            c.name,
            c.email,
            c.phone,
            c.designation,
            cust?.customerName,
            cust?.city,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
          if (!haystack.includes(q)) return false
        }
        if (customerFilter && c.customerId !== customerFilter) return false
        if (designationFilter && c.designation !== designationFilter) return false
        if (cityFilter && cust?.city !== cityFilter) return false
        if (territoryFilter && cust?.salesTerritory !== territoryFilter) return false
        if (primaryOnly && !c.isPrimary) return false
        if (overdueOnly && !followUps.some((f) => f.contactId === c.id && f.status === 'overdue')) return false
        return true
      })
      .map((c) => {
        const cust = customers.find((x) => x.id === c.customerId)
        const lastAct = activities.filter((a) => a.contactId === c.id).sort((a, b) => b.activityDate.localeCompare(a.activityDate))[0]
        const nextFu = followUps.filter((f) => f.contactId === c.id && (f.status === 'pending' || f.status === 'overdue')).sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0]
        const openOpportunities = opportunities.filter((o) => o.contactId === c.id && o.status === 'open').length
        const lastActivityAt = lastAct?.activityDate ?? null
        let daysSinceActivity: number | null = null
        if (lastActivityAt) {
          const start = new Date(lastActivityAt.slice(0, 10))
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          daysSinceActivity = Math.floor((today.getTime() - start.getTime()) / 86400000)
        }
        return {
          contact: c,
          customerId: c.customerId,
          customerName: cust?.customerName ?? '—',
          customerCode: cust?.customerCode ?? '—',
          city: cust?.city ?? '—',
          state: cust?.state ?? '—',
          territory: cust?.salesTerritory ?? '—',
          industry: cust?.industry ?? 'Transport & Logistics',
          customerType: cust?.customerType ?? '—',
          lastAct,
          nextFu,
          openOpportunities,
          daysSinceActivity,
        }
      })

    const sorted = [...list]
    if (sortBy === 'company') sorted.sort((a, b) => a.customerName.localeCompare(b.customerName))
    else if (sortBy === 'designation') sorted.sort((a, b) => a.contact.designation.localeCompare(b.contact.designation))
    else if (sortBy === 'lastActivity') sorted.sort((a, b) => (b.lastAct?.activityDate ?? '').localeCompare(a.lastAct?.activityDate ?? ''))
    else if (sortBy === 'followUp') sorted.sort((a, b) => (a.nextFu?.dueDate ?? '9999-12-31').localeCompare(b.nextFu?.dueDate ?? '9999-12-31'))
    else sorted.sort((a, b) => a.contact.name.localeCompare(b.contact.name))
    return sorted
  }, [contacts, customers, activities, followUps, opportunities, search, customerFilter, designationFilter, cityFilter, territoryFilter, primaryOnly, overdueOnly, sortBy])

  const kpis = useMemo(() => {
    const primary = contacts.filter((c) => c.isPrimary).length
    const companies = new Set(contacts.map((c) => c.customerId)).size
    const overdue = followUps.filter((f) => f.contactId && f.status === 'overdue').length
    return { total: contacts.length, primary, companies, overdue }
  }, [contacts, followUps])

  const contactKpiStrip = useMemo<EnterpriseKpiItem[]>(
    () => [
      { id: 'total', label: 'Total Contacts', value: kpis.total, icon: KPI_ICON_PRESETS.open, accent: 'blue', context: 'In directory', updatedAt: Date.now() },
      { id: 'primary', label: 'Primary Contacts', value: kpis.primary, icon: KPI_ICON_PRESETS.qualified, accent: 'green', context: 'Key decision makers', updatedAt: Date.now() },
      { id: 'companies', label: 'Companies Covered', value: kpis.companies, icon: KPI_ICON_PRESETS.pipeline, accent: 'slate', context: 'Unique accounts', updatedAt: Date.now() },
      {
        id: 'overdue',
        label: 'Overdue Follow-ups',
        value: kpis.overdue,
        icon: KPI_ICON_PRESETS.lost,
        accent: kpis.overdue > 0 ? 'red' : 'slate',
        context: kpis.overdue > 0 ? 'Needs action' : 'All clear',
        trend: kpis.overdue > 0 ? { direction: 'down', label: 'Follow up now', tone: 'negative' } : undefined,
        onClick: () => setOverdueOnly(true),
        updatedAt: Date.now(),
      },
    ],
    [kpis],
  )

  function openDeleteContact(row: EnrichedContactRow) {
    setDeleteContactTarget({ id: row.contact.id, name: row.contact.name })
  }

  function confirmDeleteContact() {
    if (!deleteContactTarget) return
    setIsDeletingContact(true)
    void (async () => {
      try {
        const r = await resolveStoreAction(deleteContact(deleteContactTarget.id))
        if (r.ok) {
          setDeleteContactTarget(null)
          notify.success('Contact deleted')
        } else {
          notify.error(r.error ?? 'Delete failed')
        }
      } finally {
        setIsDeletingContact(false)
      }
    })()
  }

  function openContactImport() {
    setImportOpen(true)
  }

  function exportAllContacts() {
    void runCrmExport(
      'contacts',
      () => exportSelectedContacts(rows),
      { search: search || undefined },
    ).then((r) => {
      if (!r.ok) notify.error(r.error ?? 'Export failed')
    })
  }

  function openContactPreview(row: EnrichedContactRow) {
    const { contact, customerName, city, lastAct, nextFu } = row
    openDetailPanel({
      title: contact.name,
      subtitle: `${contact.designation} · ${customerName}`,
      fields: [
        { label: 'Company', value: customerName },
        { label: 'Email', value: contact.email || '—' },
        { label: 'Phone', value: contact.phone || '—' },
        { label: 'City', value: city },
        { label: 'Primary', value: contact.isPrimary ? 'Yes' : 'No' },
        { label: 'Last Activity', value: lastAct ? new Date(lastAct.activityDate).toLocaleDateString('en-IN') : '—' },
        { label: 'Next Follow-up', value: nextFu?.dueDate ?? '—' },
      ],
      timeline: nextFu
        ? [{
            id: 'followup',
            label: nextFu.status === 'overdue' ? 'Overdue follow-up' : 'Upcoming follow-up',
            time: nextFu.dueDate,
            status: nextFu.status === 'overdue' ? 'current' : 'current',
          }]
        : [],
      links: [{ label: 'Open Customer 360', href: entity360CustomerPath(contact.customerId) }],
      aiSummary: `${contact.name} is ${contact.isPrimary ? 'the primary contact' : 'a contact'} at ${customerName}.${nextFu?.status === 'overdue' ? ' Follow-up is overdue — schedule outreach today.' : ' Recommended next step: log activity or schedule follow-up.'}`,
      actions: [
        { label: 'Customer 360', onClick: () => navigate(entity360CustomerPath(contact.customerId)), primary: true },
        { label: 'Follow-up', onClick: () => setFollowUpContact(contact) },
        ...(contact.phone ? [{ label: 'Call', onClick: () => window.open(`tel:${contact.phone}`) }] : []),
        ...(contact.email ? [{ label: 'Email', onClick: () => window.open(`mailto:${contact.email}`) }] : []),
      ],
    })
  }

  function duplicateContact(row: EnrichedContactRow) {
    const params = new URLSearchParams({
      customerId: row.contact.customerId,
      duplicateFrom: row.contact.id,
    })
    navigate(`/masters/contacts/new?${params.toString()}`)
  }

  function exportSelectedContacts(selected: EnrichedContactRow[]) {
    exportRowsToCsv(
      'contacts-selected',
      [
        'Name',
        'Designation',
        'Primary',
        'Company',
        'Company Code',
        'City',
        'State',
        'Territory',
        'Industry',
        'Type',
        'Email',
        'Phone',
        'Open Opportunities',
        'Last Activity',
        'Last Activity Type',
        'Next Follow-up',
        'Assigned To',
        'Follow-up Status',
      ],
      selected.map((r) => [
        r.contact.name,
        r.contact.designation,
        r.contact.isPrimary ? 'Yes' : 'No',
        r.customerName,
        r.customerCode,
        r.city,
        r.state,
        r.territory,
        r.industry,
        r.customerType,
        r.contact.email,
        r.contact.phone,
        r.openOpportunities,
        r.lastAct?.activityDate ?? '',
        r.lastAct?.type ?? '',
        r.nextFu?.dueDate ?? '',
        r.nextFu?.assignedToName ?? '',
        r.nextFu?.status ?? '',
      ]),
    )
  }

  return (
    <>
      <OperationalPageShell
        title="Contacts"
        description="Customer contact directory linked to companies, follow-ups, and activity"
        favoritePath="/crm/contacts"
        badge="CRM"
        variant="dynamics"
        autoBreadcrumbs={false}
        breadcrumbs={crmModuleBreadcrumbs('Contacts', '/crm/contacts')}
        commandBar={
          <ErpCommandBar
            inline
            sticky={false}
            primaryAction={{
              id: 'new-contact',
              label: 'New Contact',
              icon: UserPlus,
              onClick: () => navigate('/masters/contacts/new'),
            }}
            secondaryActions={[
              { id: 'import', label: 'Import', icon: Upload, onClick: openContactImport },
              { id: 'export', label: 'Export', icon: Download, onClick: exportAllContacts },
            ]}
            moreActions={[
              { id: 'save-view', label: 'Save View', icon: Save, onClick: savedViews.openSaveDialog },
            ]}
          />
        }
        kpiStrip={contactKpiStrip}
      >
        <EnterpriseRegisterTableShell>
          <CrmContactsTable
            rows={rows}
            companyLabel={COMPANY_TERMINOLOGY.singular}
            search={search}
            onSearchChange={setSearch}
            showCompactSearch={false}
            hasActiveFilters={hasActiveContactFilters}
            onClearFilters={clearFilters}
            registerFilter={{
              search,
              onSearchChange: setSearch,
              searchPlaceholder: 'Search name, email, phone, company…',
              activeFilterCount: contactFilterDrawer.activeCount,
              onOpenFilters: contactFilterDrawer.openDrawer,
              chips: contactFilterDrawer.chips,
              onRemoveChip: contactFilterDrawer.removeChip,
              onClearAll: clearFilters,
              savedView: savedViews.activeView,
              onSavedViewChange: savedViews.selectView,
              savedViews: savedViews.viewNames,
              onSaveView: savedViews.openSaveDialog,
              sort: (
                <CrmListSortSelect
                  value={sortBy}
                  onChange={(v) => setSortBy(v as typeof sortBy)}
                  aria-label="Sort contacts"
                  options={[
                    { value: 'name', label: 'Sort: Contact Name' },
                    { value: 'company', label: 'Sort: Company' },
                    { value: 'designation', label: 'Sort: Designation' },
                    { value: 'lastActivity', label: 'Sort: Last Activity' },
                    { value: 'followUp', label: 'Sort: Next Follow-up' },
                  ]}
                />
              ),
            }}
            emptyAction={
              rows.length === 0 ? (
                <div className="flex flex-wrap justify-center gap-2">
                  <button type="button" className="erp-btn erp-btn--primary text-[13px]" onClick={() => navigate('/masters/contacts/new')}>
                    New Contact
                  </button>
                  <button type="button" className="erp-btn erp-btn--secondary text-[13px]" onClick={openContactImport}>
                    Import Contacts
                  </button>
                </div>
              ) : undefined
            }
            onPreview={openContactPreview}
            onEdit={(row) => navigate(`/crm/contacts/${row.contact.id}/edit`)}
            canEdit
            onView={(row) => navigate(`/crm/contacts/${row.contact.id}`)}
            onDuplicate={duplicateContact}
            onFollowUp={setFollowUpContact}
            onCreateOpportunity={(row) => navigate(`/crm/opportunities/new?customerId=${row.contact.customerId}`)}
            onCreateQuotation={(row) => navigate(`/crm/quotations/new?customerId=${row.contact.customerId}`)}
            onOpen360={(id) => navigate(entity360CustomerPath(id))}
            onBulkExport={exportSelectedContacts}
            onDelete={openDeleteContact}
            onBulkDelete={(selected) => selected.forEach((r) => openDeleteContact(r))}
            canDelete={canDelete}
          />
        </EnterpriseRegisterTableShell>
      </OperationalPageShell>
      <ContactImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={(count) => {
          notify.success(`${count} contact${count === 1 ? '' : 's'} imported`)
        }}
      />
      <CrmFilterDrawer
        open={contactFilterDrawer.open}
        onClose={contactFilterDrawer.closeDrawer}
        fields={contactFilterFields}
        values={contactFilterDrawer.draft}
        onChange={(next) => contactFilterDrawer.setDraft({ ...contactFilterDrawer.draft, ...next })}
        onApply={contactFilterDrawer.applyFilters}
        onReset={contactFilterDrawer.resetDraft}
      />
      <QuickFollowUpDrawer
        open={!!followUpContact}
        onClose={() => setFollowUpContact(null)}
        context={{ customerId: followUpContact?.customerId, contactId: followUpContact?.id }}
      />
      <SaveViewDialog
        open={savedViews.saveDialogOpen}
        defaultName={savedViews.activeView === 'My View' ? '' : savedViews.activeView}
        onClose={savedViews.closeSaveDialog}
        onSave={savedViews.saveCurrentView}
      />
      <CrmDeleteConfirmModal
        open={Boolean(deleteContactTarget)}
        title={`Delete ${deleteContactTarget?.name ?? 'contact'}?`}
        onCancel={() => setDeleteContactTarget(null)}
        onConfirm={confirmDeleteContact}
        isDeleting={isDeletingContact}
      />
    </>
  )
}

/** @deprecated Follow-ups live on the Opportunity Pipeline page */
export function CrmFollowUpsPage() {
  return <Navigate to="/crm/opportunities?view=follow-ups" replace />
}

/** @deprecated Activities live on the Opportunity Pipeline page */
export function CrmActivitiesPage() {
  return <Navigate to="/crm/opportunities?view=activities" replace />
}
