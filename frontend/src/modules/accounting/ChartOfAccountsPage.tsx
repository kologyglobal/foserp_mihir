import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BookOpen,
  ChevronDown,
  Columns3,
  Download,
  Filter,
  FolderTree,
  MoreHorizontal,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  RefreshCw,
  Upload,
} from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { SearchInput } from '@/components/ui/SearchInput'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'
import {
  AccountConfirmModal,
  AccountDeactivateDialog,
  AccountDrawerShell,
  AccountFactBox,
  AccountFilterDrawer,
  AccountFormDrawer,
  AccountHierarchyTree,
  AccountImportDialog,
  AccountListTable,
  type AccountListAction,
  type AccountSortKey,
} from '@/components/accounting/coa'
import {
  activateAccount,
  ChartOfAccountsServiceError,
  deactivateAccount,
  deleteAccount,
  duplicateAccount,
  exportAccounts,
  getAccountHierarchy,
  getAccounts,
  getCoaSummary,
  getDimensionLookups,
  DEFAULT_COA_FILTER,
} from '@/services/accounting/chartOfAccountsService'
import {
  defaultDimensionConfiguration,
  defaultManufacturingConfiguration,
  defaultPostingControl,
  defaultTaxConfiguration,
  type AccountExportFormat,
  type AccountExportScope,
  type AccountFilter,
  type AccountHierarchyNode,
  type AccountType,
  type ChartOfAccount,
} from '@/types/chartOfAccounts'
import { useCoaPermissions } from '@/utils/permissions/chartOfAccounts'
import { MQ_BELOW_LG, MQ_MOBILE, MQ_XL_UP, useMediaQuery } from '@/hooks/useMediaQuery'
import { notify } from '@/store/toastStore'
import { cn } from '@/utils/cn'

type LoadState = 'loading' | 'ready' | 'error' | 'empty'
type ListTab = AccountFilter['listTab']

const LIST_TABS: { id: ListTab; label: string }[] = [
  { id: 'all', label: 'All Accounts' },
  { id: 'posting', label: 'Posting Accounts' },
  { id: 'group', label: 'Group Accounts' },
  { id: 'inactive', label: 'Inactive' },
  { id: 'control', label: 'Control Accounts' },
]

const OPTIONAL_COLUMN_OPTIONS = [
  { id: 'alias', label: 'Account Alias' },
  { id: 'gstRelevant', label: 'GST Relevant' },
  { id: 'tdsRelevant', label: 'TDS Relevant' },
  { id: 'recon', label: 'Reconciliation Required' },
  { id: 'costCentre', label: 'Cost Centre Required' },
  { id: 'createdBy', label: 'Created By' },
  { id: 'createdDate', label: 'Created Date' },
]

function downloadBlob(fileName: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

function sortAccounts(
  rows: ChartOfAccount[],
  sortKey: AccountSortKey,
  sortDir: 'asc' | 'desc',
  parentMap: Record<string, string>,
): ChartOfAccount[] {
  const dir = sortDir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    let cmp = 0
    switch (sortKey) {
      case 'code':
        cmp = a.code.localeCompare(b.code, undefined, { numeric: true })
        break
      case 'name':
        cmp = a.name.localeCompare(b.name)
        break
      case 'accountType':
        cmp = a.accountType.localeCompare(b.accountType)
        break
      case 'category':
        cmp = a.category.localeCompare(b.category)
        break
      case 'parent':
        cmp = (parentMap[a.parentId ?? ''] ?? '').localeCompare(parentMap[b.parentId ?? ''] ?? '')
        break
      case 'normalBalance':
        cmp = a.normalBalance.localeCompare(b.normalBalance)
        break
      case 'allowDirectPosting':
        cmp = Number(a.posting.allowDirectPosting) - Number(b.posting.allowDirectPosting)
        break
      case 'isControlAccount':
        cmp = Number(a.posting.isControlAccount) - Number(b.posting.isControlAccount)
        break
      case 'currentBalance':
        cmp = a.currentBalance - b.currentBalance
        break
      case 'active':
        cmp = Number(a.active) - Number(b.active)
        break
      default:
        cmp = 0
    }
    return cmp * dir
  })
}

export function ChartOfAccountsPage() {
  const navigate = useNavigate()
  const perms = useCoaPermissions()
  const isMobile = useMediaQuery(MQ_MOBILE)
  const isTablet = useMediaQuery(MQ_BELOW_LG)
  const isXl = useMediaQuery(MQ_XL_UP)

  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [allAccounts, setAllAccounts] = useState<ChartOfAccount[]>([])
  const [hierarchy, setHierarchy] = useState<AccountHierarchyNode[]>([])
  const [summary, setSummary] = useState({ total: 0, posting: 0, group: 0, inactive: 0, withBalance: 0 })
  const [dimensionLookups, setDimensionLookups] = useState({
    costCentres: [] as { id: string; code: string; name: string }[],
    departments: [] as { id: string; code: string; name: string }[],
    projects: [] as { id: string; code: string; name: string }[],
    plants: [] as { id: string; code: string; name: string }[],
    locations: [] as { id: string; code: string; name: string }[],
  })
  const [refreshToken, setRefreshToken] = useState(0)

  const [filter, setFilter] = useState<AccountFilter>({ ...DEFAULT_COA_FILTER })
  const [draftFilter, setDraftFilter] = useState<AccountFilter>({ ...DEFAULT_COA_FILTER })
  const [filterOpen, setFilterOpen] = useState(false)
  const [treeOpen, setTreeOpen] = useState(false)
  const [factBoxOpen, setFactBoxOpen] = useState(true)
  const [expandedIds, setExpandedIds] = useState<string[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [sortKey, setSortKey] = useState<AccountSortKey>('code')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(0)
  const pageSize = 25
  const [optionalColumns, setOptionalColumns] = useState<string[]>([])
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [newMenuOpen, setNewMenuOpen] = useState(false)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const newMenuRef = useRef<HTMLDivElement>(null)
  const exportMenuRef = useRef<HTMLDivElement>(null)
  const columnsRef = useRef<HTMLDivElement>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [formAccountType, setFormAccountType] = useState<AccountType>('Posting')
  const [editingAccount, setEditingAccount] = useState<ChartOfAccount | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [deactivateTarget, setDeactivateTarget] = useState<ChartOfAccount | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ChartOfAccount | null>(null)
  const [balanceWarnTarget, setBalanceWarnTarget] = useState<ChartOfAccount | null>(null)

  useEffect(() => {
    setFactBoxOpen(isXl)
  }, [isXl])

  const load = useCallback(async (signal?: { cancelled: boolean }) => {
    setLoadState('loading')
    setErrorMessage(null)
    try {
      const [accounts, tree, summ, dims] = await Promise.all([
        getAccounts({}),
        getAccountHierarchy(),
        getCoaSummary(),
        getDimensionLookups(),
      ])
      if (signal?.cancelled) return
      setAllAccounts(accounts)
      setHierarchy(tree)
      setSummary(summ)
      setDimensionLookups(dims)
      setExpandedIds((prev) => (prev.length ? prev : tree.map((n) => n.id)))
      setLoadState(accounts.length === 0 ? 'empty' : 'ready')
    } catch (err) {
      if (signal?.cancelled) return
      setErrorMessage(err instanceof Error ? err.message : 'Failed to load chart of accounts')
      setLoadState('error')
    }
  }, [])

  useEffect(() => {
    const signal = { cancelled: false }
    void load(signal)
    return () => {
      signal.cancelled = true
    }
  }, [load, refreshToken])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (newMenuRef.current && !newMenuRef.current.contains(t)) setNewMenuOpen(false)
      if (exportMenuRef.current && !exportMenuRef.current.contains(t)) setExportMenuOpen(false)
      if (columnsRef.current && !columnsRef.current.contains(t)) setColumnsOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const parentMap = useMemo(() => {
    const map: Record<string, string> = {}
    for (const a of allAccounts) map[a.id] = `${a.code} — ${a.name}`
    return map
  }, [allAccounts])

  const filteredRows = useMemo(() => {
    // Client-side re-filter from the loaded universe using active filter
    const q = filter.search.trim().toLowerCase()
    return allAccounts.filter((account) => {
      const parent = account.parentId ? allAccounts.find((a) => a.id === account.parentId) : undefined
      if (q) {
        const hay = [account.code, account.name, account.alias, account.category, parent?.name ?? '']
          .join(' ')
          .toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (filter.category && account.category !== filter.category) return false
      if (filter.accountType && account.accountType !== filter.accountType) return false
      if (filter.parentId && account.parentId !== filter.parentId) return false
      if (filter.normalBalance && account.normalBalance !== filter.normalBalance) return false
      if (filter.directPosting === 'yes' && !account.posting.allowDirectPosting) return false
      if (filter.directPosting === 'no' && account.posting.allowDirectPosting) return false
      if (filter.controlAccount === 'yes' && !account.posting.isControlAccount) return false
      if (filter.controlAccount === 'no' && account.posting.isControlAccount) return false
      if (filter.activeStatus === 'Active' && !account.active) return false
      if (filter.activeStatus === 'Inactive' && account.active) return false
      if (filter.gstRelevant === 'yes' && !account.tax.gstRelevant) return false
      if (filter.gstRelevant === 'no' && account.tax.gstRelevant) return false
      if (filter.tdsRelevant === 'yes' && !account.tax.tdsRelevant) return false
      if (filter.tdsRelevant === 'no' && account.tax.tdsRelevant) return false
      if (filter.reconciliationRequired === 'yes' && !account.posting.reconciliationRequired) return false
      if (filter.reconciliationRequired === 'no' && account.posting.reconciliationRequired) return false
      if (filter.costCentreRequired === 'yes' && !account.posting.costCentreRequired) return false
      if (filter.costCentreRequired === 'no' && account.posting.costCentreRequired) return false
      if (filter.hasBalance === 'yes' && account.currentBalance === 0) return false
      if (filter.hasBalance === 'no' && account.currentBalance !== 0) return false
      if (filter.createdBy && !account.createdBy.toLowerCase().includes(filter.createdBy.toLowerCase())) return false
      if (filter.createdDateFrom && account.createdAt.slice(0, 10) < filter.createdDateFrom) return false
      if (filter.createdDateTo && account.createdAt.slice(0, 10) > filter.createdDateTo) return false
      if (filter.listTab === 'posting' && account.accountType !== 'Posting') return false
      if (filter.listTab === 'group' && account.accountType !== 'Group') return false
      if (filter.listTab === 'inactive' && account.active) return false
      if (filter.listTab === 'control' && !account.posting.isControlAccount) return false
      if (filter.treeGroupId) {
        const inTree = (id: string | null): boolean => {
          if (!id) return false
          if (id === filter.treeGroupId) return true
          const node = allAccounts.find((a) => a.id === id)
          return node ? inTree(node.parentId) : false
        }
        if (account.id !== filter.treeGroupId && !inTree(account.parentId)) return false
      }
      return true
    })
  }, [allAccounts, filter])

  const sortedRows = useMemo(
    () => sortAccounts(filteredRows, sortKey, sortDir, parentMap),
    [filteredRows, sortKey, sortDir, parentMap],
  )

  const pagedRows = useMemo(
    () => sortedRows.slice(page * pageSize, page * pageSize + pageSize),
    [sortedRows, page],
  )

  useEffect(() => {
    setPage(0)
  }, [filter, sortKey, sortDir])

  const selectedAccount = useMemo(
    () => allAccounts.find((a) => a.id === selectedId) ?? null,
    [allAccounts, selectedId],
  )

  const childCount = useMemo(
    () => (selectedId ? allAccounts.filter((a) => a.parentId === selectedId).length : 0),
    [allAccounts, selectedId],
  )

  const filterChips = useMemo(() => {
    const chips: { key: string; label: string; clear: () => void }[] = []
    if (filter.treeGroupId) {
      const node = allAccounts.find((a) => a.id === filter.treeGroupId)
      chips.push({
        key: 'tree',
        label: node ? `${node.name}` : 'Group',
        clear: () => setFilter((f) => ({ ...f, treeGroupId: null })),
      })
    }
    if (filter.category) {
      chips.push({
        key: 'category',
        label: filter.category,
        clear: () => setFilter((f) => ({ ...f, category: '' })),
      })
    }
    if (filter.accountType) {
      chips.push({
        key: 'type',
        label: `${filter.accountType} Account`,
        clear: () => setFilter((f) => ({ ...f, accountType: '' })),
      })
    }
    if (filter.activeStatus) {
      chips.push({
        key: 'status',
        label: filter.activeStatus,
        clear: () => setFilter((f) => ({ ...f, activeStatus: '' })),
      })
    }
    if (filter.controlAccount === 'yes') {
      chips.push({
        key: 'control',
        label: 'Control Account',
        clear: () => setFilter((f) => ({ ...f, controlAccount: '' })),
      })
    }
    if (filter.hasBalance === 'yes') {
      chips.push({
        key: 'balance',
        label: 'Has Balance',
        clear: () => setFilter((f) => ({ ...f, hasBalance: '' })),
      })
    }
    if (filter.listTab !== 'all') {
      const tab = LIST_TABS.find((t) => t.id === filter.listTab)
      chips.push({
        key: 'tab',
        label: tab?.label ?? filter.listTab,
        clear: () => setFilter((f) => ({ ...f, listTab: 'all' })),
      })
    }
    return chips
  }, [filter, allAccounts])

  const kpiStrip: EnterpriseKpiItem[] = useMemo(
    () => [
      {
        id: 'total',
        label: 'Total Accounts',
        value: summary.total,
        accent: 'blue',
        active: filter.listTab === 'all' && !filter.hasBalance && filter.activeStatus === '',
        onClick: () => setFilter((f) => ({ ...DEFAULT_COA_FILTER, search: f.search })),
      },
      {
        id: 'posting',
        label: 'Posting Accounts',
        value: summary.posting,
        accent: 'green',
        active: filter.listTab === 'posting',
        onClick: () => setFilter((f) => ({ ...f, listTab: 'posting', accountType: '', activeStatus: '', hasBalance: '' })),
      },
      {
        id: 'group',
        label: 'Group Accounts',
        value: summary.group,
        accent: 'slate',
        active: filter.listTab === 'group',
        onClick: () => setFilter((f) => ({ ...f, listTab: 'group', accountType: '', activeStatus: '', hasBalance: '' })),
      },
      {
        id: 'inactive',
        label: 'Inactive Accounts',
        value: summary.inactive,
        accent: 'amber',
        active: filter.listTab === 'inactive',
        onClick: () => setFilter((f) => ({ ...f, listTab: 'inactive', activeStatus: '', hasBalance: '' })),
      },
      {
        id: 'balance',
        label: 'Accounts with Balance',
        value: summary.withBalance,
        accent: 'blue',
        active: filter.hasBalance === 'yes',
        onClick: () => setFilter((f) => ({ ...f, hasBalance: 'yes', listTab: 'all' })),
      },
    ],
    [summary, filter],
  )

  const openCreate = (type: AccountType, parentId?: string | null) => {
    setFormMode('create')
    setFormAccountType(type)
    if (parentId) {
      const parent = allAccounts.find((a) => a.id === parentId)
      setEditingAccount({
        id: '',
        code: '',
        name: '',
        alias: '',
        accountType: type,
        category: parent?.category ?? 'Asset',
        parentId,
        normalBalance: parent?.normalBalance ?? 'Debit',
        description: '',
        active: true,
        systemAccount: false,
        posting: parent?.posting ?? defaultPostingControl(type),
        tax: parent?.tax ?? defaultTaxConfiguration(),
        manufacturing: parent?.manufacturing ?? defaultManufacturingConfiguration(),
        dimensions: parent?.dimensions ?? defaultDimensionConfiguration(),
        currentBalance: 0,
        hasLedgerActivity: false,
        createdBy: '',
        createdAt: '',
        modifiedBy: '',
        modifiedAt: '',
      })
    } else {
      setEditingAccount(null)
    }
    setFormOpen(true)
    setNewMenuOpen(false)
  }

  const openEdit = (account: ChartOfAccount) => {
    setFormMode('edit')
    setEditingAccount(account)
    setFormAccountType(account.accountType)
    setFormOpen(true)
  }

  const handleExport = async (scope: AccountExportScope, format: AccountExportFormat) => {
    setExportMenuOpen(false)
    if (!perms.canExport) {
      notify.error('You do not have export permission')
      return
    }
    try {
      const result = await exportAccounts(scope, format, filter)
      downloadBlob(result.fileName, result.content, result.mime)
      notify.success(result.message)
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Export failed')
    }
  }

  const handleAction = async (action: AccountListAction, account: ChartOfAccount) => {
    setSelectedId(account.id)
    switch (action) {
      case 'view':
        navigate(`/accounting/chart-of-accounts/${account.id}`)
        break
      case 'edit':
        if (!perms.canEdit) return notify.error('Missing edit permission')
        openEdit(account)
        break
      case 'addChild':
        if (!perms.canCreate) return notify.error('Missing create permission')
        if (account.accountType !== 'Group') {
          notify.error('Only group accounts can create child accounts')
          return
        }
        openCreate('Posting', account.id)
        break
      case 'duplicate':
        if (!perms.canCreate) return notify.error('Missing create permission')
        try {
          const copy = await duplicateAccount(account.id)
          notify.success(`Duplicated as ${copy.code}`)
          setRefreshToken((n) => n + 1)
          setSelectedId(copy.id)
        } catch (err) {
          notify.error(err instanceof ChartOfAccountsServiceError ? err.message : 'Duplicate failed')
        }
        break
      case 'viewLedger':
        navigate(`/accounting/ledger-entries/account/${account.id}`)
        break
      case 'activate':
        if (!perms.canActivate) return notify.error('Missing activate permission')
        try {
          await activateAccount(account.id)
          notify.success(`${account.code} activated`)
          setRefreshToken((n) => n + 1)
        } catch (err) {
          notify.error(err instanceof ChartOfAccountsServiceError ? err.message : 'Activate failed')
        }
        break
      case 'deactivate':
        if (!perms.canDeactivate) return notify.error('Missing deactivate permission')
        if (account.currentBalance !== 0) {
          setBalanceWarnTarget(account)
        } else {
          setDeactivateTarget(account)
        }
        break
      case 'delete':
        if (!perms.canDelete) return notify.error('Missing delete permission')
        setDeleteTarget(account)
        break
      default:
        break
    }
  }

  const confirmDeactivate = async (reason: string) => {
    if (!deactivateTarget) return
    try {
      await deactivateAccount(deactivateTarget.id, reason)
      notify.success(`${deactivateTarget.code} deactivated`)
      setDeactivateTarget(null)
      setRefreshToken((n) => n + 1)
    } catch (err) {
      notify.error(err instanceof ChartOfAccountsServiceError ? err.message : 'Deactivate failed')
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteAccount(deleteTarget.id)
      notify.success(`${deleteTarget.code} deleted`)
      if (selectedId === deleteTarget.id) setSelectedId(null)
      setDeleteTarget(null)
      setRefreshToken((n) => n + 1)
    } catch (err) {
      notify.error(err instanceof ChartOfAccountsServiceError ? err.message : 'Delete failed')
    }
  }

  const showTreeInline = !isTablet && !isMobile
  const showFactInline = factBoxOpen && !isMobile && !isTablet && Boolean(selectedAccount)

  const newMenu = (
    <div className="relative" ref={newMenuRef}>
      <button
        type="button"
        className="erp-btn erp-btn-primary inline-flex h-9 items-center gap-1.5 px-3 text-[13px] font-semibold disabled:opacity-40"
        disabled={!perms.canCreate}
        title={!perms.canCreate ? 'Missing create permission' : undefined}
        onClick={() => setNewMenuOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={newMenuOpen}
      >
        <Plus className="h-4 w-4" />
        New
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
      {newMenuOpen ? (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1 w-52 rounded-lg border border-erp-border bg-white py-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full px-3 py-2 text-left text-[13px] hover:bg-erp-surface-alt"
            onClick={() => openCreate('Group')}
          >
            New Group Account
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full px-3 py-2 text-left text-[13px] hover:bg-erp-surface-alt"
            onClick={() => openCreate('Posting')}
          >
            New Posting Account
          </button>
        </div>
      ) : null}
    </div>
  )

  const exportMenu = (
    <div className="relative" ref={exportMenuRef}>
      <button
        type="button"
        className="erp-btn erp-btn-ghost inline-flex h-9 items-center gap-1.5 px-3 text-[13px] font-semibold disabled:opacity-40"
        disabled={!perms.canExport}
        onClick={() => setExportMenuOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={exportMenuOpen}
      >
        <Download className="h-4 w-4" />
        Export
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
      {exportMenuOpen ? (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1 w-64 rounded-lg border border-erp-border bg-white py-1 shadow-lg"
        >
          {(
            [
              ['current_view', 'Export Current View'],
              ['all', 'Export All Accounts'],
              ['posting', 'Export Posting Accounts'],
              ['group', 'Export Group Accounts'],
              ['hierarchy', 'Export Account Hierarchy'],
              ['audit', 'Export Audit Information'],
            ] as [AccountExportScope, string][]
          ).map(([scope, label]) => (
            <div key={scope} className="border-b border-erp-border last:border-0">
              <p className="px-3 pt-2 text-[10px] font-semibold uppercase tracking-wide text-erp-muted">{label}</p>
              <div className="flex gap-1 px-2 pb-2">
                {(['csv', 'excel', 'pdf'] as AccountExportFormat[]).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    className="rounded px-2 py-1 text-[11px] font-semibold text-erp-primary hover:bg-erp-primary-soft"
                    onClick={() => void handleExport(scope, fmt)}
                  >
                    {fmt.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )

  if (!perms.canView) {
    return (
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Accounting"
        title="Chart of Accounts"
        description="Manage hierarchical general ledger accounts, posting controls, classifications, and account mappings."
        breadcrumbs={[{ label: 'Accounting', to: '/accounting' }, { label: 'Chart of Accounts' }]}
        autoBreadcrumbs={false}
        favoritePath="/accounting/chart-of-accounts"
        showDescription
      >
        <EmptyState
          icon={BookOpen}
          title="Access denied"
          description="You do not have permission to view the Chart of Accounts."
        />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Chart of Accounts"
      description="Manage hierarchical general ledger accounts, posting controls, classifications, and account mappings."
      breadcrumbs={[{ label: 'Accounting', to: '/accounting' }, { label: 'Chart of Accounts' }]}
      autoBreadcrumbs={false}
      favoritePath="/accounting/chart-of-accounts"
      showDescription
      kpiStrip={loadState === 'ready' || loadState === 'empty' ? kpiStrip : undefined}
      commandBar={(
        <div className="flex flex-wrap items-center gap-2">
          {newMenu}
          <button
            type="button"
            className="erp-btn erp-btn-ghost inline-flex h-9 items-center gap-1.5 px-3 text-[13px] font-semibold disabled:opacity-40"
            disabled={!perms.canImport}
            onClick={() => setImportOpen(true)}
          >
            <Upload className="h-4 w-4" />
            Import
          </button>
          {exportMenu}
          <ErpCommandBar
            inline
            sticky={false}
            moreActions={[
              {
                id: 'refresh',
                label: 'Refresh',
                icon: RefreshCw,
                onClick: () => setRefreshToken((n) => n + 1),
              },
              {
                id: 'toggle-fact',
                label: factBoxOpen ? 'Hide FactBox' : 'Show FactBox',
                icon: factBoxOpen ? PanelRightClose : PanelRightOpen,
                onClick: () => setFactBoxOpen((o) => !o),
                hidden: isMobile,
              },
              {
                id: 'tree',
                label: 'Account Groups',
                icon: FolderTree,
                onClick: () => setTreeOpen(true),
                hidden: showTreeInline,
              },
            ]}
          />
        </div>
      )}
    >
      {loadState === 'loading' ? <LoadingState variant="table" rows={10} /> : null}

      {loadState === 'error' ? (
        <EmptyState
          icon={BookOpen}
          title="Could not load accounts"
          description={errorMessage ?? 'An unexpected error occurred.'}
          action={(
            <button type="button" className="erp-btn erp-btn-primary h-9 px-4 text-[13px]" onClick={() => setRefreshToken((n) => n + 1)}>
              Retry
            </button>
          )}
        />
      ) : null}

      {loadState === 'empty' ? (
        <EmptyState
          icon={BookOpen}
          title="No accounts have been created yet."
          description="Create the account hierarchy manually or import an existing chart of accounts."
          action={(
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                className="erp-btn erp-btn-primary h-9 px-4 text-[13px] font-semibold"
                disabled={!perms.canCreate}
                onClick={() => openCreate('Group')}
              >
                Create First Account
              </button>
              <button
                type="button"
                className="erp-btn erp-btn-ghost h-9 px-4 text-[13px] font-semibold"
                disabled={!perms.canImport}
                onClick={() => setImportOpen(true)}
              >
                Import Chart of Accounts
              </button>
            </div>
          )}
        />
      ) : null}

      {loadState === 'ready' ? (
        <div className={cn('flex min-h-[560px] gap-0 overflow-hidden rounded-lg border border-erp-border bg-white')}>
          {showTreeInline ? (
            <AccountHierarchyTree
              className="w-[280px] shrink-0"
              nodes={hierarchy}
              selectedId={filter.treeGroupId}
              expandedIds={expandedIds}
              onExpandedChange={setExpandedIds}
              onSelect={(id) => setFilter((f) => ({ ...f, treeGroupId: id }))}
            />
          ) : null}

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex flex-wrap items-center gap-1 border-b border-erp-border px-2 pt-2">
              {LIST_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={cn(
                    'rounded-t-md px-3 py-2 text-[12px] font-semibold',
                    filter.listTab === tab.id
                      ? 'border border-b-white border-erp-border bg-white text-erp-primary'
                      : 'text-erp-muted hover:text-erp-text',
                  )}
                  onClick={() => setFilter((f) => ({ ...f, listTab: tab.id }))}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2 border-b border-erp-border bg-erp-surface/40 px-3 py-2">
              {!showTreeInline ? (
                <button
                  type="button"
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-erp-border bg-white px-2.5 text-[12px] font-semibold"
                  onClick={() => setTreeOpen(true)}
                >
                  <FolderTree className="h-3.5 w-3.5" />
                  Account Groups
                </button>
              ) : null}
              <SearchInput
                value={filter.search}
                onChange={(search) => setFilter((f) => ({ ...f, search }))}
                placeholder="Search code, name, parent, category, alias…"
                className="w-full max-w-xs"
                size="sm"
              />
              <button
                type="button"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-erp-border bg-white px-2.5 text-[12px] font-semibold"
                onClick={() => {
                  setDraftFilter(filter)
                  setFilterOpen(true)
                }}
              >
                <Filter className="h-3.5 w-3.5" />
                Filters
              </button>
              <select
                className="erp-input h-9 w-auto min-w-[8rem] text-[12px]"
                aria-label="Account Category"
                value={filter.category}
                onChange={(e) =>
                  setFilter((f) => ({
                    ...f,
                    category: e.target.value as AccountFilter['category'],
                  }))
                }
              >
                <option value="">Account Category</option>
                {['Asset', 'Liability', 'Equity', 'Income', 'Expense'].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                className="erp-input h-9 w-auto min-w-[8rem] text-[12px]"
                aria-label="Account Type"
                value={filter.accountType}
                onChange={(e) =>
                  setFilter((f) => ({
                    ...f,
                    accountType: e.target.value as AccountFilter['accountType'],
                  }))
                }
              >
                <option value="">Account Type</option>
                <option value="Group">Group</option>
                <option value="Posting">Posting</option>
              </select>
              <select
                className="erp-input h-9 w-auto min-w-[7rem] text-[12px]"
                aria-label="Active Status"
                value={filter.activeStatus}
                onChange={(e) =>
                  setFilter((f) => ({
                    ...f,
                    activeStatus: e.target.value as AccountFilter['activeStatus'],
                  }))
                }
              >
                <option value="">Active Status</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>

              <div className="ml-auto flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  className="rounded p-2 text-erp-muted hover:bg-white hover:text-erp-text"
                  title="Expand all groups"
                  aria-label="Expand all groups"
                  onClick={() => {
                    const collect = (nodes: AccountHierarchyNode[]): string[] =>
                      nodes.flatMap((n) => [n.id, ...collect(n.children)])
                    setExpandedIds(collect(hierarchy))
                  }}
                >
                  <MoreHorizontal className="h-4 w-4 rotate-90" />
                </button>
                <div className="relative" ref={columnsRef}>
                  <button
                    type="button"
                    className="inline-flex h-9 items-center gap-1 rounded-lg border border-erp-border bg-white px-2.5 text-[12px] font-semibold"
                    onClick={() => setColumnsOpen((o) => !o)}
                    aria-label="Column settings"
                  >
                    <Columns3 className="h-3.5 w-3.5" />
                    Columns
                  </button>
                  {columnsOpen ? (
                    <div className="absolute right-0 z-20 mt-1 w-56 rounded-lg border border-erp-border bg-white p-2 shadow-lg">
                      {OPTIONAL_COLUMN_OPTIONS.map((col) => (
                        <label key={col.id} className="flex items-center gap-2 px-1 py-1.5 text-[12px]">
                          <input
                            type="checkbox"
                            checked={optionalColumns.includes(col.id)}
                            onChange={(e) => {
                              setOptionalColumns((prev) =>
                                e.target.checked ? [...prev, col.id] : prev.filter((id) => id !== col.id),
                              )
                            }}
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
                  onClick={() => setRefreshToken((n) => n + 1)}
                  aria-label="Refresh"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Refresh
                </button>
                <button
                  type="button"
                  className="rounded p-2 text-erp-muted hover:bg-white hover:text-erp-text"
                  title={factBoxOpen ? 'Hide FactBox' : 'Show FactBox'}
                  aria-label={factBoxOpen ? 'Hide FactBox' : 'Show FactBox'}
                  onClick={() => setFactBoxOpen((o) => !o)}
                >
                  {factBoxOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {filterChips.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 border-b border-erp-border px-3 py-2">
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
                  onClick={() => setFilter({ ...DEFAULT_COA_FILTER })}
                >
                  Clear Filters
                </button>
              </div>
            ) : null}

            <EnterpriseRegisterTableShell className="min-h-0 flex-1 border-0 shadow-none">
              {sortedRows.length === 0 ? (
                <EmptyState
                  icon={Filter}
                  title="No accounts match the selected filters."
                  description="Adjust or clear filters to see accounts."
                  action={(
                    <button
                      type="button"
                      className="erp-btn erp-btn-primary h-9 px-4 text-[13px]"
                      onClick={() => setFilter({ ...DEFAULT_COA_FILTER })}
                    >
                      Clear Filters
                    </button>
                  )}
                />
              ) : (
                <AccountListTable
                  rows={pagedRows}
                  parentMap={parentMap}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  onOpen={(a) => navigate(`/accounting/chart-of-accounts/${a.id}`)}
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
                  total={sortedRows.length}
                  visibleOptionalColumns={optionalColumns}
                  canViewBalance={perms.canViewBalance}
                  onAction={handleAction}
                  isMobile={isMobile}
                  loading={false}
                />
              )}
            </EnterpriseRegisterTableShell>
          </div>

          {showFactInline ? (
            <AccountFactBox
              account={selectedAccount}
              parentName={selectedAccount?.parentId ? parentMap[selectedAccount.parentId] : undefined}
              childCount={childCount}
              canEdit={perms.canEdit}
              canViewBalance={perms.canViewBalance}
              canViewAudit={perms.canViewAudit}
              canDeactivate={perms.canDeactivate}
              canActivate={perms.canActivate}
              onEdit={() => selectedAccount && openEdit(selectedAccount)}
              onViewLedger={() => selectedAccount && navigate(`/accounting/ledger-entries/account/${selectedAccount.id}`)}
              onViewCard={() => selectedAccount && navigate(`/accounting/chart-of-accounts/${selectedAccount.id}`)}
              onDuplicate={() => selectedAccount && void handleAction('duplicate', selectedAccount)}
              onDeactivate={() => selectedAccount && void handleAction('deactivate', selectedAccount)}
              onActivate={() => selectedAccount && void handleAction('activate', selectedAccount)}
              collapsed={false}
              onToggleCollapse={() => setFactBoxOpen(false)}
            />
          ) : null}
        </div>
      ) : null}

      <AccountDrawerShell
        open={treeOpen}
        onClose={() => setTreeOpen(false)}
        title="Account Groups"
        subtitle="Filter the list by selecting a group"
        widthClassName="max-w-sm"
      >
        <AccountHierarchyTree
          className="h-[70vh] border-0"
          nodes={hierarchy}
          selectedId={filter.treeGroupId}
          expandedIds={expandedIds}
          onExpandedChange={setExpandedIds}
          onSelect={(id) => {
            setFilter((f) => ({ ...f, treeGroupId: id }))
            setTreeOpen(false)
          }}
        />
      </AccountDrawerShell>

      <AccountFilterDrawer
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        filter={draftFilter}
        onChange={setDraftFilter}
        onApply={() => {
          setFilter(draftFilter)
          setFilterOpen(false)
        }}
        onReset={() => {
          setDraftFilter({ ...DEFAULT_COA_FILTER, listTab: filter.listTab, search: filter.search })
        }}
        onSaveView={() => notify.success('View saved for this browser session (demo).')}
        accounts={allAccounts}
      />

      <AccountFormDrawer
        open={formOpen}
        onClose={() => setFormOpen(false)}
        mode={formMode}
        initialAccountType={formAccountType}
        account={formMode === 'edit' ? editingAccount : editingAccount?.parentId ? editingAccount : null}
        accounts={allAccounts}
        dimensionLookups={dimensionLookups}
        canManageSystem={perms.canManageSystem}
        onSaved={(acc) => {
          notify.success(formMode === 'create' ? `Created ${acc.code}` : `Updated ${acc.code}`)
          setFormOpen(false)
          setSelectedId(acc.id)
          setRefreshToken((n) => n + 1)
        }}
      />

      <AccountImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={(result) => {
          notify.success(result.message)
          setRefreshToken((n) => n + 1)
        }}
      />

      <AccountDeactivateDialog
        open={Boolean(deactivateTarget)}
        onClose={() => setDeactivateTarget(null)}
        accountName={deactivateTarget ? `${deactivateTarget.code} — ${deactivateTarget.name}` : ''}
        onConfirm={(reason) => void confirmDeactivate(reason)}
      />

      <AccountConfirmModal
        open={Boolean(balanceWarnTarget)}
        onClose={() => setBalanceWarnTarget(null)}
        title="Account has a balance"
        description={
          balanceWarnTarget
            ? `${balanceWarnTarget.code} still shows a demo balance. Deactivating may affect reporting visibility. Continue?`
            : undefined
        }
        confirmLabel="Continue"
        onConfirm={() => {
          if (balanceWarnTarget) {
            setDeactivateTarget(balanceWarnTarget)
            setBalanceWarnTarget(null)
          }
        }}
      />

      <AccountConfirmModal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Delete account?"
        description={
          deleteTarget
            ? `Delete ${deleteTarget.code} — ${deleteTarget.name}? This cannot be undone in the demo session.`
            : undefined
        }
        confirmLabel="Delete"
        destructive
        onConfirm={() => void confirmDelete()}
      />
    </OperationalPageShell>
  )
}
