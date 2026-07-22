import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Bookmark,
  ClipboardList,
  Columns3,
  Download,
  Filter,
  Printer,
  RefreshCw,
  RotateCcw,
} from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { SearchInput } from '@/components/ui/SearchInput'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import {
  LedgerAuditDrawer,
  LedgerEntriesTable,
  LedgerEntryDetailsDrawer,
  LedgerExportDialog,
  LedgerFilterDrawer,
  LedgerSummaryStrip,
  RelatedDocumentDrawer,
  type LedgerLookups,
  type LedgerRowAction,
  type LedgerSortKey,
} from '@/components/accounting/ledger'
import {
  DEFAULT_LEDGER_FILTER,
  exportLedgerEntries,
  getCostCentreLedgerSummary,
  getGeneralLedgerSummary,
  getLedgerAuditTrail,
  getLedgerEntries,
  getLedgerEntryById,
  getLedgerLookups,
  getManufacturingLedgerSummary,
  getPrintPreview,
  getProjectLedgerSummary,
  getSavedLedgerViews,
  LedgerEntriesServiceError,
  saveLedgerView,
} from '@/services/accounting/ledgerEntriesService'
import { getAccounts as getCoaAccounts } from '@/services/accounting/chartOfAccountsService'
import type {
  CostCentreLedgerSummary,
  LedgerEntry,
  LedgerEntryAuditEvent,
  LedgerEntryFilter,
  LedgerExportFormat,
  LedgerExportScope,
  LedgerSummary,
  LedgerViewTab,
  ManufacturingLedgerSummary,
  ProjectLedgerSummary,
  SavedLedgerView,
} from '@/types/ledgerEntries'
import { LEDGER_VIEW_TAB_LABELS } from '@/types/ledgerEntries'
import { useLedgerPermissions } from '@/utils/permissions/ledgerEntries'
import {
  applyDateRangeToFilter,
  buildLedgerPrintHtml,
  DATE_QUICK_OPTIONS,
  downloadTextFile,
  openPrintWindow,
  periodLabelFromFilter,
  sortLedgerRows,
} from '@/utils/accounting/ledgerWorkspace'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDateTime } from '@/utils/dates/format'
import { MQ_MOBILE, useMediaQuery } from '@/hooks/useMediaQuery'
import { notify } from '@/store/toastStore'
import { getSessionUser } from '@/utils/permissions'
import { cn } from '@/utils/cn'

type LoadState = 'loading' | 'ready' | 'error' | 'empty'

const OPTIONAL_COLUMNS = [
  { id: 'documentDate', label: 'Document Date' },
  { id: 'referenceNumber', label: 'Reference Number' },
  { id: 'externalDocumentNumber', label: 'External Document No.' },
  { id: 'accountCategory', label: 'Account Category' },
  { id: 'partyType', label: 'Party Type' },
  { id: 'location', label: 'Location' },
  { id: 'plant', label: 'Plant' },
  { id: 'productionOrder', label: 'Production Order' },
  { id: 'itemCode', label: 'Item Code' },
  { id: 'batchNumber', label: 'Batch Number' },
  { id: 'currency', label: 'Currency' },
  { id: 'sourceModule', label: 'Source Module' },
  { id: 'sourceDocument', label: 'Source Document' },
  { id: 'createdBy', label: 'Created By' },
  { id: 'postedBy', label: 'Posted By' },
  { id: 'postedAt', label: 'Posted Date' },
  { id: 'reversalVoucher', label: 'Reversal Voucher' },
]

const WORKSPACE_TABS: LedgerViewTab[] = [
  'general',
  'account',
  'voucher',
  'party',
  'cost_centre',
  'project',
  'manufacturing',
]

function tabAllowed(tab: LedgerViewTab, perms: ReturnType<typeof useLedgerPermissions>): boolean {
  if (tab === 'account') return perms.canViewAccount
  if (tab === 'voucher') return perms.canViewVoucher
  if (tab === 'party') return perms.canViewParty
  if (tab === 'cost_centre') return perms.canViewCostCentre
  if (tab === 'project') return perms.canViewProject
  if (tab === 'manufacturing') return perms.canViewManufacturing
  return perms.canView
}

export function LedgerEntriesPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const perms = useLedgerPermissions()
  const isMobile = useMediaQuery(MQ_MOBILE)

  const viewFromUrl = (searchParams.get('view') as LedgerViewTab | null) ?? 'general'

  const [filter, setFilter] = useState<LedgerEntryFilter>(() =>
    applyDateRangeToFilter({ ...DEFAULT_LEDGER_FILTER, viewTab: viewFromUrl }),
  )
  const [draftFilter, setDraftFilter] = useState(filter)
  const [filterOpen, setFilterOpen] = useState(false)
  const [rows, setRows] = useState<LedgerEntry[]>([])
  const [summary, setSummary] = useState<LedgerSummary | null>(null)
  const [mfgSummary, setMfgSummary] = useState<ManufacturingLedgerSummary | null>(null)
  const [projectSummary, setProjectSummary] = useState<ProjectLedgerSummary | null>(null)
  const [costCentreSummary, setCostCentreSummary] = useState<CostCentreLedgerSummary | null>(null)
  const [lookups, setLookups] = useState<LedgerLookups | null>(null)
  const [savedViews, setSavedViews] = useState<SavedLedgerView[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)
  const [sortKey, setSortKey] = useState<LedgerSortKey>('postingDate')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(0)
  const pageSize = 25
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [optionalColumns, setOptionalColumns] = useState<string[]>(['referenceNumber', 'reversalVoucher'])
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [viewsOpen, setViewsOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [detailEntry, setDetailEntry] = useState<LedgerEntry | null>(null)
  const [detailAudit, setDetailAudit] = useState<LedgerEntryAuditEvent[]>([])
  const [relatedOpen, setRelatedOpen] = useState(false)
  const [auditOpen, setAuditOpen] = useState(false)
  const [kpiActive, setKpiActive] = useState<string | null>(null)
  const [pickerAccount, setPickerAccount] = useState('')
  const [pickerVoucher, setPickerVoucher] = useState('')
  const [pickerParty, setPickerParty] = useState('')
  const [accountOptions, setAccountOptions] = useState<{ id: string; code: string; name: string }[]>([])

  useEffect(() => {
    if (filter.viewTab !== 'account') return
    let cancelled = false
    void getCoaAccounts({ listTab: 'posting' }).then((list) => {
      if (cancelled) return
      setAccountOptions(list.map((a) => ({ id: a.id, code: a.code, name: a.name })))
    })
    return () => {
      cancelled = true
    }
  }, [filter.viewTab])

  useEffect(() => {
    const tab = viewFromUrl
    setFilter((f) => applyDateRangeToFilter({ ...f, viewTab: tab }))
  }, [viewFromUrl])

  const load = useCallback(
    async (signal?: { cancelled: boolean }) => {
      setLoadState('loading')
      setErrorMessage(null)
      try {
        const active = applyDateRangeToFilter(filter)
        const [list, summ, looks, views] = await Promise.all([
          getLedgerEntries(active),
          getGeneralLedgerSummary(active),
          lookups ? Promise.resolve(lookups) : getLedgerLookups(),
          getSavedLedgerViews(),
        ])
        let mfg: ManufacturingLedgerSummary | null = null
        let projectSum: ProjectLedgerSummary | null = null
        let ccSum: CostCentreLedgerSummary | null = null
        if (active.viewTab === 'manufacturing') {
          mfg = await getManufacturingLedgerSummary(active)
        }
        if (active.viewTab === 'project' && active.projectId) {
          projectSum = await getProjectLedgerSummary(active.projectId, active)
        }
        if (active.viewTab === 'cost_centre' && active.costCentreId) {
          ccSum = await getCostCentreLedgerSummary(active.costCentreId, active)
        }
        if (signal?.cancelled) return
        setRows(list)
        setSummary(summ)
        setMfgSummary(mfg)
        setProjectSummary(projectSum)
        setCostCentreSummary(ccSum)
        setLookups(looks)
        setSavedViews(views)
        setLoadState(list.length === 0 ? 'empty' : 'ready')
      } catch (err) {
        if (signal?.cancelled) return
        setErrorMessage(err instanceof Error ? err.message : 'Ledger entries could not be loaded.')
        setLoadState('error')
      }
    },
    [filter, lookups],
  )

  useEffect(() => {
    const signal = { cancelled: false }
    void load(signal)
    return () => {
      signal.cancelled = true
    }
  }, [load, refreshToken])

  const sorted = useMemo(() => sortLedgerRows(rows, sortKey, sortDir), [rows, sortKey, sortDir])
  const paged = useMemo(() => sorted.slice(page * pageSize, page * pageSize + pageSize), [sorted, page])

  useEffect(() => {
    setPage(0)
    setSelectedIds(new Set())
  }, [filter, sortKey, sortDir])

  const showRunningBalance = Boolean(filter.accountId) && filter.viewTab !== 'manufacturing'
  const periodLabel = periodLabelFromFilter(filter)

  const filterChips = useMemo(() => {
    const chips: { key: string; label: string; clear: () => void }[] = []
    chips.push({
      key: 'period',
      label: `Posting Date: ${DATE_QUICK_OPTIONS.find((o) => o.value === filter.dateQuickRange)?.label ?? 'Range'}`,
      clear: () =>
        setFilter((f) =>
          applyDateRangeToFilter({ ...f, dateQuickRange: 'this_financial_year', postingDateFrom: '', postingDateTo: '' }),
        ),
    })
    if (filter.accountId || filter.accountCode) {
      chips.push({
        key: 'account',
        label: `Account: ${filter.accountCode || filter.accountId}`,
        clear: () => setFilter((f) => ({ ...f, accountId: '', accountCode: '', accountName: '' })),
      })
    }
    if (filter.voucherType) {
      chips.push({
        key: 'vtype',
        label: `Voucher Type: ${filter.voucherType}`,
        clear: () => setFilter((f) => ({ ...f, voucherType: '' })),
      })
    }
    if (filter.entryStatus) {
      chips.push({
        key: 'status',
        label: `Status: ${filter.entryStatus}`,
        clear: () => setFilter((f) => ({ ...f, entryStatus: '' })),
      })
    }
    if (filter.partyName || filter.partyId) {
      chips.push({
        key: 'party',
        label: `Party: ${filter.partyName || filter.partyId}`,
        clear: () => setFilter((f) => ({ ...f, partyId: '', partyName: '', partyCode: '', partyType: '' })),
      })
    }
    if (filter.costCentreId) {
      chips.push({
        key: 'cc',
        label: `Cost Centre: ${lookups?.costCentres.find((c) => c.id === filter.costCentreId)?.code ?? filter.costCentreId}`,
        clear: () => setFilter((f) => ({ ...f, costCentreId: '' })),
      })
    }
    if (filter.projectId) {
      chips.push({
        key: 'prj',
        label: `Project: ${lookups?.projects.find((p) => p.id === filter.projectId)?.code ?? filter.projectId}`,
        clear: () => setFilter((f) => ({ ...f, projectId: '' })),
      })
    }
    if (filter.hasReversal === 'yes') {
      chips.push({
        key: 'rev',
        label: 'Has Reversal',
        clear: () => setFilter((f) => ({ ...f, hasReversal: '', entryStatus: '' })),
      })
    }
    return chips
  }, [filter, lookups])

  const setViewTab = (tab: LedgerViewTab) => {
    if (!tabAllowed(tab, perms)) {
      notify.error('You do not have permission for this ledger view')
      return
    }
    if (tab === 'account') {
      // stay on page with picker until account chosen
      setSearchParams({ view: 'account' })
      setFilter((f) => ({ ...f, viewTab: 'account' }))
      return
    }
    if (tab === 'voucher') {
      setSearchParams({ view: 'voucher' })
      setFilter((f) => ({ ...f, viewTab: 'voucher' }))
      return
    }
    if (tab === 'party') {
      setSearchParams({ view: 'party' })
      setFilter((f) => ({ ...f, viewTab: 'party' }))
      return
    }
    setSearchParams(tab === 'general' ? {} : { view: tab })
    setFilter((f) => applyDateRangeToFilter({ ...f, viewTab: tab }))
  }

  const openEntry = async (entry: LedgerEntry) => {
    setDetailEntry(entry)
    if (perms.canViewAudit) {
      try {
        setDetailAudit(await getLedgerAuditTrail(entry.id))
      } catch {
        setDetailAudit([])
      }
    } else {
      setDetailAudit([])
    }
  }

  const handleAction = async (action: LedgerRowAction, entry: LedgerEntry) => {
    switch (action) {
      case 'view':
        await openEntry(entry)
        break
      case 'openVoucher':
        if (entry.voucherId) navigate(`/accounting/ledger-entries/voucher/${entry.voucherId}`)
        else if (entry.voucherNumber) navigate(`/accounting/entries/journals`)
        break
      case 'openAccount':
        navigate(`/accounting/ledger-entries/account/${entry.account.accountId}`)
        break
      case 'openParty':
        if (entry.party) {
          navigate(
            `/accounting/ledger-entries/party/${entry.party.partyType.toLowerCase()}/${entry.party.partyId}`,
          )
        }
        break
      case 'viewSource':
        setDetailEntry(entry)
        setRelatedOpen(true)
        break
      case 'viewRelated':
        setDetailEntry(entry)
        setRelatedOpen(true)
        break
      case 'viewReversal': {
        const targetId = entry.reversal?.reversalEntryId || entry.reversal?.originalEntryId
        if (targetId) {
          try {
            const linked = await getLedgerEntryById(targetId)
            if (linked) await openEntry(linked)
            else notify.error('Linked reversal entry not found')
          } catch (err) {
            notify.error(err instanceof Error ? err.message : 'Could not open reversal')
          }
        }
        break
      }
      case 'viewAudit':
        setDetailEntry(entry)
        if (perms.canViewAudit) {
          setDetailAudit(await getLedgerAuditTrail(entry.id))
          setAuditOpen(true)
        } else notify.error('Missing audit permission')
        break
      case 'print':
        void handlePrint([entry])
        break
      case 'export':
        setSelectedIds(new Set([entry.id]))
        setExportOpen(true)
        break
      default:
        break
    }
  }

  const handleExport = async (scope: LedgerExportScope, format: LedgerExportFormat) => {
    if (!perms.canExport) return notify.error('Missing export permission')
    try {
      const result = await exportLedgerEntries({
        scope,
        format,
        filter,
        selectedIds: [...selectedIds],
      })
      downloadTextFile(result.fileName, result.content, result.mime)
      notify.success(result.message)
    } catch (err) {
      notify.error(err instanceof LedgerEntriesServiceError ? err.message : 'Export failed')
    }
  }

  const handlePrint = async (printRows?: LedgerEntry[]) => {
    if (!perms.canPrint) return notify.error('Missing print permission')
    try {
      const preview = await getPrintPreview('General Ledger', filter, printRows?.map((r) => r.id))
      const html = buildLedgerPrintHtml({
        companyName: preview.companyName,
        reportName: preview.reportName,
        periodLabel,
        filtersLabel: filter.voucherType || filter.accountCode || 'All accounts',
        generatedBy: getSessionUser().name,
        generatedAt: formatDateTime(preview.generatedAt),
        rows: printRows ?? preview.rows,
        formatCurrency,
      })
      const ok = openPrintWindow(preview.reportName, html)
      if (!ok) notify.error('Pop-up blocked — allow pop-ups to print')
      else notify.success('Print preview opened (frontend demo)')
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Print failed')
    }
  }

  const saveCurrentView = async () => {
    if (!perms.canSaveView) return notify.error('Missing save view permission')
    const name = `View ${new Date().toLocaleString('en-IN')}`
    try {
      await saveLedgerView({
        name,
        filters: filter,
        columns: optionalColumns,
        sortKey,
        sortDir,
      })
      setSavedViews(await getSavedLedgerViews())
      notify.success(`Saved “${name}” in this browser session only (demo).`)
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Could not save view')
    }
  }

  if (!perms.canView) {
    return (
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Accounting"
        title="Ledger Entries"
        breadcrumbs={[{ label: 'Accounting', to: '/accounting' }, { label: 'Ledger Entries' }]}
        autoBreadcrumbs={false}
      >
        <EmptyState icon={ClipboardList} title="Access denied" description="You cannot view ledger entries." />
      </OperationalPageShell>
    )
  }

  const showDimensionPicker =
    filter.viewTab === 'account' || filter.viewTab === 'voucher' || filter.viewTab === 'party'

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Ledger Entries"
      description="Review posted accounting entries, account movements, voucher impact and dimension-wise balances."
      breadcrumbs={[{ label: 'Accounting', to: '/accounting' }, { label: 'Ledger Entries' }]}
      autoBreadcrumbs={false}
      favoritePath="/accounting/ledger-entries"
      showDescription
      kpiStrip={undefined}
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[
            {
              id: 'export',
              label: 'Export',
              icon: Download,
              disabled: !perms.canExport,
              onClick: () => setExportOpen(true),
            },
            {
              id: 'print',
              label: 'Print',
              icon: Printer,
              disabled: !perms.canPrint,
              onClick: () => void handlePrint(),
            },
            {
              id: 'refresh',
              label: 'Refresh',
              icon: RefreshCw,
              onClick: () => setRefreshToken((n) => n + 1),
            },
          ]}
          moreActions={[
            {
              id: 'open-account',
              label: 'Open Account Ledger',
              onClick: () => setViewTab('account'),
              hidden: !perms.canViewAccount,
            },
            {
              id: 'open-party',
              label: 'Open Party Ledger',
              onClick: () => setViewTab('party'),
              hidden: !perms.canViewParty,
            },
            {
              id: 'open-voucher',
              label: 'Open Voucher Entries',
              onClick: () => setViewTab('voucher'),
              hidden: !perms.canViewVoucher,
            },
            {
              id: 'save-view',
              label: 'Save Current View',
              icon: Bookmark,
              disabled: !perms.canSaveView,
              onClick: () => void saveCurrentView(),
            },
            {
              id: 'reset',
              label: 'Reset View',
              icon: RotateCcw,
              onClick: () => {
                setFilter(applyDateRangeToFilter({ ...DEFAULT_LEDGER_FILTER, viewTab: filter.viewTab }))
                setOptionalColumns(['referenceNumber', 'reversalVoucher'])
                setKpiActive(null)
                notify.success('View reset')
              },
            },
          ]}
        />
      )}
    >
      <p className="mb-3 text-[12px] font-medium text-erp-muted">{periodLabel}</p>

      <div className="mb-3 flex flex-wrap gap-1 border-b border-erp-border">
        {WORKSPACE_TABS.filter((t) => tabAllowed(t, perms)).map((tab) => (
          <button
            key={tab}
            type="button"
            className={cn(
              'rounded-t-md px-3 py-2 text-[12px] font-semibold',
              filter.viewTab === tab
                ? 'border border-b-white border-erp-border bg-white text-erp-primary'
                : 'text-erp-muted hover:text-erp-text',
            )}
            onClick={() => setViewTab(tab)}
          >
            {LEDGER_VIEW_TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {showDimensionPicker ? (
        <div className="mb-3 rounded-lg border border-erp-border bg-white p-3">
          {filter.viewTab === 'account' ? (
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-[12px] font-semibold">
                Account
                <select
                  className="erp-input mt-1 h-9 min-w-[16rem] text-[12px]"
                  value={pickerAccount}
                  onChange={(e) => setPickerAccount(e.target.value)}
                >
                  <option value="">Select posting account…</option>
                  {accountOptions.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} — {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="erp-btn erp-btn-primary h-9 px-3 text-[12px]"
                disabled={!pickerAccount}
                onClick={() => navigate(`/accounting/ledger-entries/account/${pickerAccount}`)}
              >
                Open Account Ledger
              </button>
              <p className="w-full text-[11px] text-erp-muted">
                Or open an account from General Ledger → Open Account.
              </p>
            </div>
          ) : null}
          {filter.viewTab === 'voucher' ? (
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-[12px] font-semibold">
                Voucher
                <select
                  className="erp-input mt-1 h-9 min-w-[16rem] text-[12px]"
                  value={pickerVoucher}
                  onChange={(e) => setPickerVoucher(e.target.value)}
                >
                  <option value="">Select posted voucher…</option>
                  {(lookups?.vouchers ?? []).map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.number} · {v.type}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="erp-btn erp-btn-primary h-9 px-3 text-[12px]"
                disabled={!pickerVoucher.trim()}
                onClick={() => navigate(`/accounting/ledger-entries/voucher/${pickerVoucher.trim()}`)}
              >
                Open Voucher Entries
              </button>
            </div>
          ) : null}
          {filter.viewTab === 'party' ? (
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-[12px] font-semibold">
                Party
                <select
                  className="erp-input mt-1 h-9 min-w-[16rem] text-[12px]"
                  value={pickerParty}
                  onChange={(e) => setPickerParty(e.target.value)}
                >
                  <option value="">Select party…</option>
                  {(lookups?.parties ?? []).map((p) => (
                    <option key={p.id} value={`${p.type}|${p.id}`}>
                      {p.type} · {p.code} — {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="erp-btn erp-btn-primary h-9 px-3 text-[12px]"
                disabled={!pickerParty}
                onClick={() => {
                  const [type, id] = pickerParty.split('|')
                  navigate(`/accounting/ledger-entries/party/${type.toLowerCase()}/${id}`)
                }}
              >
                Open Party Ledger
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {summary && !showDimensionPicker ? (
        <div className="mb-3">
          <LedgerSummaryStrip
            summary={summary}
            activeId={kpiActive}
            onKpiClick={(id) => {
              setKpiActive(id)
              if (id === 'reversedEntries') {
                setFilter((f) => ({ ...f, hasReversal: 'yes', entryStatus: 'Reversed' }))
              } else if (id === 'entryCount') {
                setFilter((f) => ({ ...f, hasReversal: '', entryStatus: '' }))
              }
            }}
          />
        </div>
      ) : null}

      {filter.viewTab === 'manufacturing' && mfgSummary && perms.canViewBalance ? (
        <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {(
            [
              ['Material Consumption', mfgSummary.materialConsumption],
              ['Labour Cost', mfgSummary.labourCost],
              ['Factory Overhead', mfgSummary.factoryOverhead],
              ['WIP Movement', mfgSummary.wipMovement],
              ['Finished Goods', mfgSummary.finishedGoodsValue],
              ['Production Variance', mfgSummary.productionVariance],
              ['Scrap Value', mfgSummary.scrapValue],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="rounded-lg border border-erp-border bg-white px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-erp-muted">{label}</p>
              <p className="mt-0.5 text-[13px] font-semibold tabular-nums">{formatCurrency(value)}</p>
              <p className="text-[10px] text-erp-muted">Demo</p>
            </div>
          ))}
        </div>
      ) : null}

      {filter.viewTab === 'project' && projectSummary && perms.canViewBalance ? (
        <div className="mb-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-erp-border bg-white px-4 py-3 text-[12px]">
            <span className="font-mono font-semibold">{projectSummary.projectCode}</span>
            <span className="font-semibold">{projectSummary.projectName}</span>
            <span className="text-erp-muted">Customer: {projectSummary.customer}</span>
            <span className="text-erp-muted">PM: {projectSummary.projectManager}</span>
            <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-800">
              {projectSummary.status}
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {(
              [
                ['Revenue', projectSummary.revenue],
                ['Material Cost', projectSummary.materialCost],
                ['Labour Cost', projectSummary.labourCost],
                ['Overhead', projectSummary.overhead],
                ['Other Cost', projectSummary.otherCost],
                ['Net Result', projectSummary.netResult],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="rounded-lg border border-erp-border bg-white px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-erp-muted">{label}</p>
                <p className="mt-0.5 text-[13px] font-semibold tabular-nums">{formatCurrency(value)}</p>
                <p className="text-[10px] text-erp-muted">Demo</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {filter.viewTab === 'cost_centre' && costCentreSummary && perms.canViewBalance ? (
        <div className="mb-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-erp-border bg-white px-4 py-3 text-[12px]">
            <span className="font-mono font-semibold">{costCentreSummary.costCentreCode}</span>
            <span className="font-semibold">{costCentreSummary.costCentreName}</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                ['Total Debit', costCentreSummary.totalDebit],
                ['Total Credit', costCentreSummary.totalCredit],
                ['Net Cost', costCentreSummary.netCost],
                ['Entries', costCentreSummary.entryCount],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="rounded-lg border border-erp-border bg-white px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-erp-muted">{label}</p>
                <p className="mt-0.5 text-[13px] font-semibold tabular-nums">
                  {label === 'Entries' ? value : formatCurrency(Number(value))}
                </p>
                <p className="text-[10px] text-erp-muted">Demo</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {!showDimensionPicker ? (
        <>
          <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-erp-border bg-erp-surface/40 px-3 py-2">
            <SearchInput
              value={filter.search}
              onChange={(search) => setFilter((f) => ({ ...f, search }))}
              placeholder="Entry, voucher, account, party, narration…"
              className="w-full max-w-xs"
              size="sm"
            />
            <select
              className="erp-input h-9 w-auto min-w-[9rem] text-[12px]"
              aria-label="Date range"
              value={filter.dateQuickRange}
              onChange={(e) =>
                setFilter((f) =>
                  applyDateRangeToFilter({
                    ...f,
                    dateQuickRange: e.target.value as LedgerEntryFilter['dateQuickRange'],
                  }),
                )
              }
            >
              {DATE_QUICK_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {filter.dateQuickRange === 'custom' ? (
              <>
                <input
                  type="date"
                  className="erp-input h-9 text-[12px]"
                  aria-label="From date"
                  value={filter.postingDateFrom}
                  onChange={(e) => setFilter((f) => ({ ...f, postingDateFrom: e.target.value }))}
                />
                <input
                  type="date"
                  className="erp-input h-9 text-[12px]"
                  aria-label="To date"
                  value={filter.postingDateTo}
                  onChange={(e) => setFilter((f) => ({ ...f, postingDateTo: e.target.value }))}
                />
              </>
            ) : null}
            {filter.viewTab === 'cost_centre' ? (
              <select
                className="erp-input h-9 min-w-[10rem] text-[12px]"
                aria-label="Cost centre"
                value={filter.costCentreId}
                onChange={(e) => setFilter((f) => ({ ...f, costCentreId: e.target.value }))}
              >
                <option value="">All cost centres</option>
                {(lookups?.costCentres ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>
            ) : null}
            {filter.viewTab === 'project' ? (
              <select
                className="erp-input h-9 min-w-[10rem] text-[12px]"
                aria-label="Project"
                value={filter.projectId}
                onChange={(e) => setFilter((f) => ({ ...f, projectId: e.target.value }))}
              >
                <option value="">All projects</option>
                {(lookups?.projects ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </option>
                ))}
              </select>
            ) : null}
            <select
              className="erp-input h-9 w-auto min-w-[8rem] text-[12px]"
              aria-label="Voucher type"
              value={filter.voucherType}
              onChange={(e) =>
                setFilter((f) => ({
                  ...f,
                  voucherType: e.target.value as LedgerEntryFilter['voucherType'],
                }))
              }
            >
              <option value="">Voucher Type</option>
              {[
                'Payment',
                'Receipt',
                'Contra',
                'Journal',
                'Purchase Invoice',
                'Sales Invoice',
                'Stock Journal',
                'Production',
                'GST',
                'TDS',
                'Opening',
                'Reversal',
              ].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <select
              className="erp-input h-9 w-auto min-w-[7rem] text-[12px]"
              aria-label="Status"
              value={filter.entryStatus}
              onChange={(e) =>
                setFilter((f) => ({
                  ...f,
                  entryStatus: e.target.value as LedgerEntryFilter['entryStatus'],
                }))
              }
            >
              <option value="">Status</option>
              {['Posted', 'Reversed', 'Reversal Entry', 'Opening Balance', 'Adjustment', 'System Generated'].map(
                (s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ),
              )}
            </select>
            <button
              type="button"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-erp-border bg-white px-2.5 text-[12px] font-semibold"
              onClick={() => {
                setDraftFilter(filter)
                setFilterOpen(true)
              }}
            >
              <Filter className="h-3.5 w-3.5" />
              More Filters
            </button>
            <div className="ml-auto flex flex-wrap items-center gap-1">
              <div className="relative">
                <button
                  type="button"
                  className="inline-flex h-9 items-center gap-1 rounded-lg border border-erp-border bg-white px-2.5 text-[12px] font-semibold"
                  onClick={() => setViewsOpen((o) => !o)}
                >
                  <Bookmark className="h-3.5 w-3.5" />
                  Saved Views
                </button>
                {viewsOpen ? (
                  <div className="absolute right-0 z-20 mt-1 w-64 rounded-lg border border-erp-border bg-white py-1 shadow-lg">
                    {savedViews.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        className="flex w-full px-3 py-2 text-left text-[12px] hover:bg-erp-surface-alt"
                        onClick={() => {
                          setFilter(applyDateRangeToFilter(v.filters))
                          setOptionalColumns(v.columns)
                          setSortKey(v.sortKey as LedgerSortKey)
                          setSortDir(v.sortDir)
                          setViewsOpen(false)
                          notify.success(`Applied “${v.name}” (session demo)`)
                        }}
                      >
                        {v.name}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="flex w-full border-t border-erp-border px-3 py-2 text-left text-[12px] font-semibold text-erp-primary"
                      onClick={() => {
                        setViewsOpen(false)
                        void saveCurrentView()
                      }}
                    >
                      Save current view…
                    </button>
                  </div>
                ) : null}
              </div>
              <div className="relative">
                <button
                  type="button"
                  className="inline-flex h-9 items-center gap-1 rounded-lg border border-erp-border bg-white px-2.5 text-[12px] font-semibold"
                  onClick={() => setColumnsOpen((o) => !o)}
                  aria-label="Columns"
                >
                  <Columns3 className="h-3.5 w-3.5" />
                  Columns
                </button>
                {columnsOpen ? (
                  <div className="absolute right-0 z-20 mt-1 max-h-64 w-56 overflow-y-auto rounded-lg border border-erp-border bg-white p-2 shadow-lg">
                    {OPTIONAL_COLUMNS.map((col) => (
                      <label key={col.id} className="flex items-center gap-2 px-1 py-1 text-[12px]">
                        <input
                          type="checkbox"
                          checked={optionalColumns.includes(col.id)}
                          onChange={(e) =>
                            setOptionalColumns((prev) =>
                              e.target.checked ? [...prev, col.id] : prev.filter((id) => id !== col.id),
                            )
                          }
                        />
                        {col.label}
                      </label>
                    ))}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-erp-border bg-white px-2.5 text-[12px] font-semibold"
                onClick={() => setExportOpen(true)}
                disabled={!perms.canExport}
              >
                <Download className="h-3.5 w-3.5" />
                Export
              </button>
              <button
                type="button"
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-erp-border bg-white px-2.5 text-[12px] font-semibold"
                onClick={() => setRefreshToken((n) => n + 1)}
                aria-label="Refresh"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {filterChips.length > 0 ? (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {filterChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  className="inline-flex items-center gap-1 rounded-full bg-erp-primary-soft px-2.5 py-1 text-[11px] font-semibold text-erp-primary"
                  onClick={chip.clear}
                >
                  {chip.label} ×
                </button>
              ))}
              <button
                type="button"
                className="text-[11px] font-semibold text-erp-muted hover:text-erp-text"
                onClick={() =>
                  setFilter(applyDateRangeToFilter({ ...DEFAULT_LEDGER_FILTER, viewTab: filter.viewTab }))
                }
              >
                Clear Filters
              </button>
            </div>
          ) : null}

          {loadState === 'loading' ? <LoadingState variant="table" rows={10} /> : null}

          {loadState === 'error' ? (
            <EmptyState
              icon={ClipboardList}
              title="Ledger entries could not be loaded."
              description={errorMessage ?? undefined}
              action={(
                <div className="flex gap-2">
                  <button type="button" className="erp-btn erp-btn-primary h-9 px-4 text-[13px]" onClick={() => setRefreshToken((n) => n + 1)}>
                    Retry
                  </button>
                  <Link to="/accounting" className="erp-btn erp-btn-ghost h-9 px-4 text-[13px]">
                    Return to Accounting Dashboard
                  </Link>
                </div>
              )}
            />
          ) : null}

          {loadState === 'empty' ? (
            <EmptyState
              icon={ClipboardList}
              title={
                filterChips.length > 1
                  ? 'No ledger entries match the selected filters.'
                  : 'No posted ledger entries are available for the selected period.'
              }
              description="Adjust the date range or clear filters to continue."
              action={(
                <div className="flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    className="erp-btn erp-btn-primary h-9 px-4 text-[13px]"
                    onClick={() =>
                      setFilter(applyDateRangeToFilter({ ...DEFAULT_LEDGER_FILTER, viewTab: filter.viewTab }))
                    }
                  >
                    Clear Filters
                  </button>
                  <button
                    type="button"
                    className="erp-btn erp-btn-ghost h-9 px-4 text-[13px]"
                    onClick={() =>
                      setFilter((f) =>
                        applyDateRangeToFilter({ ...f, dateQuickRange: 'this_financial_year' }),
                      )
                    }
                  >
                    Change Date Range
                  </button>
                </div>
              )}
            />
          ) : null}

          {loadState === 'ready' ? (
            <EnterpriseRegisterTableShell className="border-0 shadow-none">
              <LedgerEntriesTable
                rows={paged}
                selectedIds={selectedIds}
                onToggleSelect={(id) =>
                  setSelectedIds((prev) => {
                    const next = new Set(prev)
                    if (next.has(id)) next.delete(id)
                    else next.add(id)
                    return next
                  })
                }
                onSelectAll={(checked) =>
                  setSelectedIds(checked ? new Set(paged.map((r) => r.id)) : new Set())
                }
                onOpenEntry={(e) => void openEntry(e)}
                onAction={(a, e) => void handleAction(a, e)}
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={(key) => {
                  if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
                  else {
                    setSortKey(key)
                    setSortDir('asc')
                  }
                }}
                page={page}
                pageSize={pageSize}
                onPageChange={setPage}
                total={sorted.length}
                visibleOptionalColumns={optionalColumns}
                showRunningBalance={showRunningBalance}
                canViewBalance={perms.canViewBalance}
                isMobile={isMobile}
                loading={false}
              />
            </EnterpriseRegisterTableShell>
          ) : null}
        </>
      ) : null}

      <LedgerFilterDrawer
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        filter={draftFilter}
        onChange={setDraftFilter}
        onApply={() => {
          setFilter(applyDateRangeToFilter(draftFilter))
          setFilterOpen(false)
        }}
        onReset={() =>
          setDraftFilter(applyDateRangeToFilter({ ...DEFAULT_LEDGER_FILTER, viewTab: filter.viewTab }))
        }
        onSaveView={() => {
          setFilter(applyDateRangeToFilter(draftFilter))
          setFilterOpen(false)
          void saveCurrentView()
        }}
        lookups={lookups ?? { costCentres: [], projects: [], plants: [], departments: [], parties: [], vouchers: [] }}
      />

      <LedgerEntryDetailsDrawer
        open={Boolean(detailEntry) && !relatedOpen && !auditOpen}
        onClose={() => setDetailEntry(null)}
        entry={detailEntry}
        auditEvents={detailAudit}
        onOpenVoucher={() => detailEntry && void handleAction('openVoucher', detailEntry)}
        onOpenAccount={() => detailEntry && void handleAction('openAccount', detailEntry)}
        onOpenSource={() => setRelatedOpen(true)}
        onPrint={() => detailEntry && void handlePrint([detailEntry])}
        onExport={() => {
          if (detailEntry) {
            setSelectedIds(new Set([detailEntry.id]))
            setExportOpen(true)
          }
        }}
        onViewAudit={() => {
          if (!perms.canViewAudit) return notify.error('Missing audit permission')
          setAuditOpen(true)
        }}
      />

      <RelatedDocumentDrawer
        open={relatedOpen}
        onClose={() => setRelatedOpen(false)}
        sourceDocument={detailEntry?.sourceDocument ?? null}
        entryLabel={detailEntry?.entryNumber}
      />

      <LedgerAuditDrawer
        open={auditOpen}
        onClose={() => setAuditOpen(false)}
        events={detailAudit}
        entryNumber={detailEntry?.entryNumber ?? ''}
      />

      <LedgerExportDialog open={exportOpen} onClose={() => setExportOpen(false)} onConfirm={(s, f) => void handleExport(s, f)} />
    </OperationalPageShell>
  )
}
