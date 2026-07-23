import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { MoreHorizontal, Package, Plus, RefreshCw, ShieldOff } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { SearchInput } from '@/components/ui/SearchInput'
import { TableLink } from '@/components/ui/AppLink'
import { EmptyState } from '@/components/ui/EmptyState'
import { DataTable } from '@/components/tables/DataTable'
import { LoadingState } from '@/design-system/components/LoadingState'
import { StatusDot, statusToneFromLabel } from '@/components/design-system/StatusDot'
import { deactivateItem, duplicateItem, getItems } from '@/services/inventory'
import type { InventoryItem } from '@/types/inventoryDomain'
import { INVENTORY_ITEM_REGISTER_TABS, INVENTORY_ITEM_TYPE_LABELS, trackingLabel } from '@/utils/inventoryItemLabels'
import { formatCurrency } from '@/utils/formatters/currency'
import { useInventoryPermissions } from '@/utils/permissions/inventory'
import { notify } from '@/store/toastStore'
import { cn } from '@/utils/cn'
import { isApiMode } from '@/config/apiConfig'

export function InventoryItemsListPage() {
  const navigate = useNavigate()
  const perms = useInventoryPermissions()
  const [params] = useSearchParams()
  const [rows, setRows] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(params.get('search') ?? '')
  const [tab, setTab] = useState(params.get('tab') ?? 'all')
  const [refreshToken, setRefreshToken] = useState(0)
  const [menuId, setMenuId] = useState<string | null>(null)

  const [loadError, setLoadError] = useState(false)

  const load = useCallback(async () => {
    void refreshToken
    setLoading(true)
    setLoadError(false)
    try {
      const tabDef = INVENTORY_ITEM_REGISTER_TABS.find((t) => t.id === tab)
      const filter: Parameters<typeof getItems>[0] = { search }
      if (tabDef?.itemType) filter.itemType = tabDef.itemType
      if (tab === 'inactive') filter.status = 'inactive'
      setRows(await getItems(filter))
    } catch {
      setRows([])
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [search, tab, refreshToken])

  useEffect(() => {
    void load()
  }, [load])

  const onDuplicate = useCallback(async (id: string) => {
    if (isApiMode()) {
      navigate(`/masters/items/${id}/edit`)
      notify.info('Open Masters → Items to create a copy in live mode')
      return
    }
    try {
      const d = await duplicateItem(id)
      notify.success('Item duplicated')
      navigate(`/inventory/items/${d.id}`)
    } catch {
      notify.error('Duplicate failed')
    }
  }, [navigate])

  const onDeactivate = useCallback(async (id: string) => {
    if (!perms.canDeactivateItem) return
    try {
      await deactivateItem(id)
      notify.success('Item deactivated')
      setRefreshToken((n) => n + 1)
    } catch {
      notify.error('Deactivate failed')
    }
  }, [perms.canDeactivateItem])

  const columns = useMemo<ColumnDef<InventoryItem>[]>(
    () => [
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
        header: 'Item Type',
        cell: ({ row }) => INVENTORY_ITEM_TYPE_LABELS[row.original.itemType],
      },
      { accessorKey: 'categoryName', header: 'Category' },
      { accessorKey: 'baseUomCode', header: 'Base UOM' },
      {
        accessorKey: 'defaultWarehouseName',
        header: 'Default Warehouse',
        cell: ({ row }) => row.original.defaultWarehouseName ?? '—',
      },
      {
        accessorKey: 'availableQuantity',
        header: 'Available Quantity',
        cell: ({ row }) => <span className="font-mono">{row.original.availableQuantity}</span>,
      },
      {
        accessorKey: 'reorderLevel',
        header: 'Reorder Level',
        cell: ({ row }) => <span className="font-mono">{row.original.reorderLevel}</span>,
      },
      ...(perms.canViewCost
        ? [
            {
              id: 'currentCost',
              header: 'Current Cost',
              cell: ({ row }: { row: { original: InventoryItem } }) =>
                formatCurrency(row.original.averageCost || row.original.standardCost),
            } as ColumnDef<InventoryItem>,
          ]
        : []),
      {
        id: 'tracking',
        header: 'Tracking',
        cell: ({ row }) => trackingLabel(row.original),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <StatusDot label={row.original.status} tone={statusToneFromLabel(row.original.status)} />
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const item = row.original
          const open = menuId === item.id
          return (
            <div className="relative">
              <button
                type="button"
                className="rounded p-1 text-erp-muted hover:bg-erp-bg-subtle hover:text-erp-text"
                aria-label={`Actions for ${item.itemCode}`}
                onClick={() => setMenuId(open ? null : item.id)}
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
              {open ? (
                <div className="absolute right-0 z-20 mt-1 min-w-[160px] rounded border border-erp-border bg-white py-1 shadow-md">
                  {[
                    { label: 'View Item', onClick: () => navigate(`/inventory/items/${item.id}`) },
                    ...(perms.canEditItem
                      ? [{
                          label: 'Edit Item',
                          onClick: () =>
                            navigate(
                              isApiMode()
                                ? `/masters/items/${item.id}/edit`
                                : `/inventory/items/${item.id}/edit`,
                            ),
                        }]
                      : []),
                    {
                      label: 'View Stock',
                      onClick: () => navigate(`/inventory/stock/${item.id}`),
                    },
                    {
                      label: 'View Movements',
                      onClick: () => navigate(`/inventory/items/${item.id}/ledger`),
                    },
                    ...(perms.canCreateItem
                      ? [{ label: 'Duplicate', onClick: () => void onDuplicate(item.id) }]
                      : []),
                    ...(perms.canDeactivateItem && item.status === 'active'
                      ? [{ label: 'Deactivate', onClick: () => void onDeactivate(item.id) }]
                      : []),
                  ].map((a) => (
                    <button
                      key={a.label}
                      type="button"
                      className={cn(
                        'block w-full px-3 py-1.5 text-left text-[12px] hover:bg-erp-bg-subtle',
                        a.label === 'Deactivate' ? 'text-rose-700' : 'text-erp-text',
                      )}
                      onClick={() => {
                        setMenuId(null)
                        a.onClick()
                      }}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          )
        },
      },
    ],
    [perms.canViewCost, perms.canEditItem, perms.canCreateItem, perms.canDeactivateItem, menuId, navigate, onDuplicate, onDeactivate],
  )

  if (!perms.canViewItems) {
    return (
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Inventory & Warehouse"
        title="Items Register"
        breadcrumbs={[{ label: 'Inventory & Warehouse', to: '/inventory' }, { label: 'Items' }]}
        autoBreadcrumbs={false}
      >
        <EmptyState
          icon={ShieldOff}
          title="Access denied"
          description="You do not have permission to view inventory items (inventory.items.view)."
        />
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
          primaryAction={
            perms.canCreateItem
              ? {
                  id: 'new',
                  label: 'New Item',
                  icon: Plus,
                  onClick: () => navigate(isApiMode() ? '/masters/items/new' : '/inventory/items/new'),
                }
              : undefined
          }
          secondaryActions={[
            { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => setRefreshToken((n) => n + 1) },
          ]}
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
      {!loading && loadError ? (
        <EmptyState
          icon={Package}
          title="Could not load items"
          description="Something went wrong while loading the items register. Try again."
          action={(
            <button
              type="button"
              className="erp-btn erp-btn-primary h-9 px-3 text-[13px]"
              onClick={() => setRefreshToken((n) => n + 1)}
            >
              Retry
            </button>
          )}
        />
      ) : null}
      {!loading && !loadError && rows.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No items found"
          description="Adjust filters or create a new inventory item."
        />
      ) : null}
      {!loading && !loadError && rows.length > 0 ? <DataTable columns={columns} data={rows} /> : null}
    </OperationalPageShell>
  )
}
