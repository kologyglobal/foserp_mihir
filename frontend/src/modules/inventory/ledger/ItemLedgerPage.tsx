import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import { SearchInput } from '@/components/ui/SearchInput'
import { TraceabilityDrawer } from '@/components/inventory/TraceabilityDrawer'
import { getItemById, getItemLedger } from '@/services/inventory'
import type { ItemLedgerEntry, ItemLedgerFilter, ItemLedgerTransactionType } from '@/types/inventoryDomain'
import { LEDGER_TXN_TYPE_LABELS } from '@/utils/inventoryTraceabilityLabels'
import { useInventoryPermissions } from '@/utils/permissions/inventory'
import { formatCurrency, formatNumber } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { useMasterStore } from '@/store/masterStore'

type LoadState = 'loading' | 'ready' | 'error' | 'empty'

const TXN_TYPES: Array<ItemLedgerTransactionType | 'all'> = [
  'all',
  'opening_balance',
  'receipt',
  'issue',
  'transfer_in',
  'transfer_out',
  'adjustment_in',
  'adjustment_out',
  'return_in',
  'return_out',
  'production_consume',
  'production_output',
  'reservation',
  'reservation_release',
]

export function ItemLedgerPage() {
  const params = useParams()
  const itemId = params.itemId ?? params.id
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const perms = useInventoryPermissions()
  const warehouses = useMasterStore((s) => s.warehouses)

  const [itemCode, setItemCode] = useState('')
  const [itemName, setItemName] = useState('')
  const [search, setSearch] = useState('')
  const [warehouseId, setWarehouseId] = useState(searchParams.get('warehouseId') ?? '')
  const [transactionType, setTransactionType] = useState<ItemLedgerTransactionType | 'all'>('all')
  const [rows, setRows] = useState<ItemLedgerEntry[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [traceOpen, setTraceOpen] = useState(false)

  const filter: ItemLedgerFilter = useMemo(() => ({
    warehouseId: warehouseId || undefined,
    transactionType,
    search: search || undefined,
  }), [warehouseId, transactionType, search])

  const load = useCallback(async () => {
    if (!itemId) return
    if (!perms.canViewItemLedger) {
      setLoadState('error')
      return
    }
    setLoadState('loading')
    try {
      const [item, ledger] = await Promise.all([
        getItemById(itemId),
        getItemLedger(itemId, filter),
      ])
      if (item) {
        setItemCode(item.itemCode)
        setItemName(item.itemName)
      }
      setRows(ledger)
      setLoadState(ledger.length === 0 ? 'empty' : 'ready')
    } catch {
      setLoadState('error')
    }
  }, [itemId, filter, perms.canViewItemLedger])

  useEffect(() => { void load() }, [load])

  if (!perms.canViewItemLedger) {
    return (
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Inventory & Warehouse"
        title="Item Ledger"
        description="Read-only item transaction history."
        breadcrumbs={[
          { label: 'Inventory & Warehouse', to: '/inventory' },
          { label: 'Item Ledger' },
        ]}
        autoBreadcrumbs={false}
      >
        <p className="text-sm text-erp-muted">Item ledger requires inventory.view_item_ledger permission.</p>
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Inventory & Warehouse"
      title={itemCode ? `${itemCode} — Item Ledger` : 'Item Ledger'}
      description={itemName || 'Read-only transaction history with document drill-down.'}
      breadcrumbs={[
        { label: 'Inventory & Warehouse', to: '/inventory' },
        { label: 'Stock', to: '/inventory/stock' },
        { label: itemCode || 'Ledger' },
      ]}
      autoBreadcrumbs={false}
      favoritePath={`/inventory/items/${itemId}/ledger`}
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[
            { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() },
            { id: 'stock', label: 'Stock', onClick: () => navigate(`/inventory/stock/${itemId}`) },
            { id: 'item', label: 'Item Card', onClick: () => navigate(`/inventory/items/${itemId}`) },
            { id: 'trace', label: 'Traceability', onClick: () => setTraceOpen(true) },
          ]}
        />
      )}
    >
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <div className="min-w-[200px] flex-1">
          <SearchInput value={search} onChange={setSearch} placeholder="Search document, remarks…" />
        </div>
        <select className="erp-input h-9 text-[12px]" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
          <option value="">All warehouses</option>
          {warehouses.filter((w) => w.isActive).map((w) => (
            <option key={w.id} value={w.id}>{w.warehouseName}</option>
          ))}
        </select>
        <select
          className="erp-input h-9 text-[12px]"
          value={transactionType}
          onChange={(e) => setTransactionType(e.target.value as ItemLedgerTransactionType | 'all')}
        >
          {TXN_TYPES.map((t) => (
            <option key={t} value={t}>{t === 'all' ? 'All types' : LEDGER_TXN_TYPE_LABELS[t]}</option>
          ))}
        </select>
      </div>

      {loadState === 'loading' ? <LoadingState variant="table" /> : null}
      {loadState === 'error' ? <p className="text-sm text-red-600">Failed to load item ledger.</p> : null}
      {loadState === 'empty' ? <p className="text-sm text-erp-muted">No ledger entries for this item.</p> : null}
      {loadState === 'ready' ? (
        <table className="erp-table w-full text-[12px]">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Document</th>
              <th>Warehouse</th>
              <th>Batch</th>
              <th>Serial</th>
              <th className="text-right">Qty In</th>
              <th className="text-right">Qty Out</th>
              <th className="text-right">Balance</th>
              {perms.canViewCost ? <th className="text-right">Unit Cost</th> : null}
              {perms.canViewCost ? <th className="text-right">Value</th> : null}
              <th>User</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{formatDate(r.transactionDate)}</td>
                <td>{LEDGER_TXN_TYPE_LABELS[r.transactionType]}</td>
                <td>
                  {r.documentHref ? (
                    <Link to={r.documentHref} className="font-mono text-erp-primary hover:underline">
                      {r.documentNo}
                    </Link>
                  ) : (
                    <span className="font-mono">{r.documentNo}</span>
                  )}
                </td>
                <td>{r.warehouseName}</td>
                <td className="font-mono">{r.batchNo ?? '—'}</td>
                <td className="font-mono">{r.serialNo ?? '—'}</td>
                <td className="text-right font-mono">{r.qtyIn > 0 ? formatNumber(r.qtyIn) : '—'}</td>
                <td className="text-right font-mono">{r.qtyOut > 0 ? formatNumber(r.qtyOut) : '—'}</td>
                <td className="text-right font-mono font-semibold">{formatNumber(r.balance)}</td>
                {perms.canViewCost ? (
                  <td className="text-right font-mono">{formatCurrency(r.unitCost)}</td>
                ) : null}
                {perms.canViewCost ? (
                  <td className="text-right font-mono">{formatCurrency(r.value)}</td>
                ) : null}
                <td>{r.userName}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      <TraceabilityDrawer
        open={traceOpen}
        entityType="item"
        entityId={itemId ?? null}
        onClose={() => setTraceOpen(false)}
      />
    </OperationalPageShell>
  )
}
