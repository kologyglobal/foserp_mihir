import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { Package, Plus, RefreshCw } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { SearchInput } from '@/components/ui/SearchInput'
import { TableLink } from '@/components/ui/AppLink'
import { EmptyState } from '@/components/ui/EmptyState'
import { DataTable } from '@/components/tables/DataTable'
import { LoadingState } from '@/design-system/components/LoadingState'
import { StatusDot, statusToneFromLabel } from '@/components/design-system/StatusDot'
import { getItems } from '@/services/inventory'
import type { InventoryItem } from '@/types/inventoryDomain'
import { INVENTORY_ITEM_REGISTER_TABS, INVENTORY_ITEM_TYPE_LABELS, trackingLabel } from '@/utils/inventoryItemLabels'
import { formatCurrency } from '@/utils/formatters/currency'
import { useInventoryPermissions } from '@/utils/permissions/inventory'

export function InventoryItemsListPage() {
  const navigate = useNavigate()
  const perms = useInventoryPermissions()
  const [params] = useSearchParams()
  const [rows, setRows] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState(params.get('tab') ?? 'all')
  const [refreshToken, setRefreshToken] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const tabDef = INVENTORY_ITEM_REGISTER_TABS.find((t) => t.id === tab)
      const filter: Parameters<typeof getItems>[0] = { search }
      if (tabDef?.itemType) filter.itemType = tabDef.itemType
      if (tab === 'inactive') filter.status = 'inactive'
      setRows(await getItems(filter))
    } finally {
      setLoading(false)
    }
  }, [search, tab, refreshToken])

  useEffect(() => { void load() }, [load])

  const columns = useMemo<ColumnDef<InventoryItem>[]>(() => [
    {
      accessorKey: 'itemCode',
      header: 'Item Code',
      cell: ({ row }) => (
        <TableLink to={`/inventory/items/${row.original.id}`}>{row.original.itemCode}</TableLink>
      ),
    },
    { accessorKey: 'itemName', header: 'Item Name' },
    {
      accessorKey: 'itemType',
      header: 'Type',
      cell: ({ row }) => INVENTORY_ITEM_TYPE_LABELS[row.original.itemType],
    },
    { accessorKey: 'categoryName', header: 'Category' },
    { accessorKey: 'baseUomCode', header: 'UOM' },
    {
      accessorKey: 'availableQuantity',
      header: 'Available',
      cell: ({ row }) => <span className="font-mono">{row.original.availableQuantity}</span>,
    },
    {
      id: 'tracking',
      header: 'Tracking',
      cell: ({ row }) => trackingLabel(row.original),
    },
    {
      accessorKey: 'standardCost',
      header: 'Std Cost',
      cell: ({ row }) => perms.canViewCost ? formatCurrency(row.original.standardCost) : '—',
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <StatusDot label={row.original.status} tone={statusToneFromLabel(row.original.status)} />
      ),
    },
  ], [perms.canViewCost])

  if (!perms.canViewItems) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Inventory" title="Items" breadcrumbs={[{ label: 'Inventory', to: '/inventory' }, { label: 'Items' }]} autoBreadcrumbs={false}>
        <EmptyState icon={Package} title="Access denied" description="You do not have permission to view inventory items." />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Inventory & Warehouse"
      title="Items Register"
      description="Inventory-enriched item master with stock snapshot, tracking and costing."
      breadcrumbs={[{ label: 'Inventory & Warehouse', to: '/inventory' }, { label: 'Items' }]}
      autoBreadcrumbs={false}
      favoritePath="/inventory/items"
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={perms.canCreateItem ? { id: 'new', label: 'New Item', icon: Plus, onClick: () => navigate('/inventory/items/new') } : undefined}
          secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => setRefreshToken((n) => n + 1) }]}
        />
      )}
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1">
          {INVENTORY_ITEM_REGISTER_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`erp-btn h-8 px-3 text-[12px] ${tab === t.id ? 'erp-btn-primary' : 'erp-btn-ghost'}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search items…" className="max-w-xs" />
      </div>
      {loading ? <LoadingState variant="table" /> : null}
      {!loading && rows.length === 0 ? (
        <EmptyState icon={Package} title="No items found" description="Adjust filters or create a new inventory item." />
      ) : null}
      {!loading && rows.length > 0 ? <DataTable columns={columns} data={rows} /> : null}
    </OperationalPageShell>
  )
}
