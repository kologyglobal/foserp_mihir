import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { ArrowUpFromLine, Eye, Pencil, Plus, RefreshCw, RotateCcw, XCircle } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { SearchInput } from '@/components/ui/SearchInput'
import { TableLink } from '@/components/ui/AppLink'
import { EmptyState } from '@/components/ui/EmptyState'
import { DataTable } from '@/components/tables/DataTable'
import { LoadingState } from '@/design-system/components/LoadingState'
import { StatusDot, statusToneFromLabel } from '@/components/design-system/StatusDot'
import { EnterpriseRowActionsMenu, type RowActionItem } from '@/design-system/enterprise/EnterpriseTablePrimitives'
import { cancelIssueDemo, getIssues, postIssueDemo, reverseIssueDemo, seedDemoMovementsIfEmpty } from '@/services/inventory'
import type { InventoryIssueListRow } from '@/types/inventoryDomain'
import { ISSUE_REGISTER_TABS, ISSUE_SOURCE_LABELS, ISSUE_STATUS_LABELS } from '@/utils/inventoryMovementLabels'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { useInventoryPermissions } from '@/utils/permissions/inventory'
import { MovementDemoBanner } from '@/components/inventory/movements/movementShared'

export function IssuesRegisterPage() {
  const navigate = useNavigate()
  const perms = useInventoryPermissions()
  const [params] = useSearchParams()
  const [tab, setTab] = useState(params.get('tab') ?? 'all')
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<InventoryIssueListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshToken, setRefreshToken] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    await seedDemoMovementsIfEmpty()
    const tabDef = ISSUE_REGISTER_TABS.find((t) => t.id === tab)
    setRows(await getIssues({ status: tabDef?.status ?? undefined, search }))
    setLoading(false)
  }, [tab, search, refreshToken])

  useEffect(() => { void load() }, [load])

  const columns = useMemo<ColumnDef<InventoryIssueListRow>[]>(() => [
    { accessorKey: 'documentNumber', header: 'Document', cell: ({ row }) => <TableLink to={`/inventory/movements/issues/${row.original.id}`}>{row.original.documentNumber}</TableLink> },
    { accessorKey: 'documentDate', header: 'Date', cell: ({ row }) => formatDate(row.original.documentDate) },
    { accessorKey: 'sourceType', header: 'Source', cell: ({ row }) => ISSUE_SOURCE_LABELS[row.original.sourceType] },
    { accessorKey: 'sourceDocumentNo', header: 'Source Doc' },
    { accessorKey: 'warehouseName', header: 'Warehouse' },
    { accessorKey: 'totalIssuedQty', header: 'Qty', cell: ({ row }) => <span className="font-mono">{row.original.totalIssuedQty}</span> },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusDot label={ISSUE_STATUS_LABELS[row.original.status]} tone={statusToneFromLabel(row.original.status)} /> },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const actions: RowActionItem[] = [{ id: 'view', label: 'View', icon: Eye, onClick: () => navigate(`/inventory/movements/issues/${row.original.id}`) }]
        if (row.original.status === 'draft' && perms.canEditIssue) actions.push({ id: 'edit', label: 'Edit Draft', icon: Pencil, onClick: () => navigate(`/inventory/movements/issues/${row.original.id}/edit`) })
        if (['pending_issue', 'partially_issued'].includes(row.original.status) && perms.canEditIssue) actions.push({ id: 'continue', label: 'Continue Issue', onClick: () => navigate(`/inventory/movements/issues/${row.original.id}/edit`) })
        if (['draft', 'pending_issue'].includes(row.original.status) && perms.canPostIssue) actions.push({ id: 'post', label: 'Post Demo', onClick: async () => { try { await postIssueDemo(row.original.id, { allowNegativeStock: perms.canOverrideNegativeStock }); notify.success('Posted'); setRefreshToken((n) => n + 1) } catch (e) { notify.error(e instanceof Error ? e.message : 'Failed') } } })
        if (row.original.status === 'posted' && perms.canReverseIssue) actions.push({ id: 'reverse', label: 'Reverse', icon: RotateCcw, onClick: async () => { await reverseIssueDemo(row.original.id); notify.success('Reversed'); setRefreshToken((n) => n + 1) } })
        if (!['posted', 'cancelled', 'reversed'].includes(row.original.status) && perms.canCancelIssue) actions.push({ id: 'cancel', label: 'Cancel', icon: XCircle, onClick: async () => { await cancelIssueDemo(row.original.id); setRefreshToken((n) => n + 1) } })
        return <EnterpriseRowActionsMenu actions={actions} />
      },
    },
  ], [navigate, perms])

  if (!perms.canViewIssues) {
    return <OperationalPageShell variant="dynamics" layout="enterprise" badge="Inventory" title="Issues" breadcrumbs={[{ label: 'Inventory', to: '/inventory' }, { label: 'Issues' }]} autoBreadcrumbs={false}><EmptyState icon={ArrowUpFromLine} title="Access denied" /></OperationalPageShell>
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Inventory & Warehouse"
      title="Material Issues Register"
      description="Issues to production, sales, maintenance and transfers."
      breadcrumbs={[{ label: 'Inventory & Warehouse', to: '/inventory' }, { label: 'Issues' }]}
      autoBreadcrumbs={false}
      favoritePath="/inventory/movements/issues"
      commandBar={<ErpCommandBar inline sticky={false} primaryAction={perms.canCreateIssue ? { id: 'new', label: 'Quick Issue', icon: Plus, onClick: () => navigate('/inventory/movements/issues/new') } : undefined} secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => setRefreshToken((n) => n + 1) }]} />}
    >
      <MovementDemoBanner />
      <div className="mb-4 flex flex-wrap gap-2">
        {ISSUE_REGISTER_TABS.map((t) => (
          <button key={t.id} type="button" className={`erp-btn h-8 px-3 text-[12px] ${tab === t.id ? 'erp-btn-primary' : 'erp-btn-ghost'}`} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
        <SearchInput value={search} onChange={setSearch} placeholder="Search…" className="max-w-xs" />
      </div>
      {loading ? <LoadingState variant="table" /> : null}
      {!loading && rows.length === 0 ? <EmptyState icon={ArrowUpFromLine} title="No issues" /> : null}
      {!loading && rows.length > 0 ? <DataTable columns={columns} data={rows} /> : null}
    </OperationalPageShell>
  )
}
