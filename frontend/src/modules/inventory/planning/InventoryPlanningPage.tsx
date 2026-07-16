import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ClipboardList, MoreHorizontal, RefreshCw, Save } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { SaveViewDialog } from '@/components/design-system/SaveViewDialog'
import { SmartFilterBar } from '@/components/design-system/SmartFilterBar'
import { SearchInput } from '@/components/ui/SearchInput'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import {
  createProductionRequestDraftDemo,
  createPurchaseRequisitionDraftDemo,
  createTransferDraftFromPlanningDemo,
  getInventoryPlanning,
  ignorePlanningSuggestion,
  INVENTORY_SAVED_VIEW_PRESETS,
  updatePlanningQuantity,
  updatePlanningRequiredDate,
} from '@/services/inventory'
import type { InventoryPlanningRow, PlanningSuggestedSource } from '@/types/inventoryDomain'
import { useInventoryPermissions } from '@/utils/permissions/inventory'
import { formatNumber } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { useMasterStore } from '@/store/masterStore'
import { useSavedViews } from '@/hooks/useSavedViews'
import { ReservationsPanel } from '@/components/inventory/ReservationsPanel'
import { cn } from '@/utils/cn'

const SOURCE_LABELS: Record<PlanningSuggestedSource, string> = {
  purchase: 'Purchase',
  production: 'Production',
  transfer: 'Transfer',
  no_action: 'No Action',
}

type LoadState = 'loading' | 'ready' | 'error' | 'empty'

export function InventoryPlanningPage() {
  const navigate = useNavigate()
  const perms = useInventoryPermissions()
  const warehouses = useMasterStore((s) => s.warehouses)

  const [search, setSearch] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [suggestedSource, setSuggestedSource] = useState<PlanningSuggestedSource | 'all'>('all')
  const [rows, setRows] = useState<InventoryPlanningRow[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [menuId, setMenuId] = useState<string | null>(null)
  const [editQtyId, setEditQtyId] = useState<string | null>(null)
  const [editQtyValue, setEditQtyValue] = useState('')
  const [editDateId, setEditDateId] = useState<string | null>(null)
  const [editDateValue, setEditDateValue] = useState('')
  const [reservationContext, setReservationContext] = useState<{ itemId: string; warehouseId: string; itemCode: string } | null>(null)

  const systemPresets = useMemo(() => {
    const presets: Record<string, Record<string, string>> = { 'My View': {} }
    for (const p of INVENTORY_SAVED_VIEW_PRESETS.filter((v) => v.workspace === '/inventory/planning')) {
      presets[p.name] = p.filters
    }
    return presets
  }, [])

  const savedViews = useSavedViews({
    pageId: '/inventory/planning',
    filters: { search, warehouseId, suggestedSource, reorderRequired: '' },
    systemPresets,
    onApply: (f: Record<string, string>) => {
      setSearch(f.search ?? '')
      setWarehouseId(f.warehouseId ?? '')
      setSuggestedSource((f.suggestedSource as PlanningSuggestedSource | 'all') ?? 'all')
    },
  })

  const load = useCallback(async () => {
    setLoadState('loading')
    try {
      const data = await getInventoryPlanning({
        search: search || undefined,
        warehouseId: warehouseId || undefined,
        suggestedSource: suggestedSource === 'all' ? undefined : suggestedSource,
        includeIgnored: false,
      })
      const filtered = savedViews.activeView === 'Reorder Required'
        ? data.filter((r) => r.suggestedQuantity > 0)
        : data
      setRows(filtered)
      setLoadState(filtered.length === 0 ? 'empty' : 'ready')
    } catch {
      setLoadState('error')
    }
  }, [search, warehouseId, suggestedSource, savedViews.activeView])

  useEffect(() => { void load() }, [load])

  const summary = useMemo(() => ({
    suggestions: rows.length,
    purchase: rows.filter((r) => r.suggestedSource === 'purchase').length,
    production: rows.filter((r) => r.suggestedSource === 'production').length,
    totalQty: rows.reduce((s, r) => s + r.suggestedQuantity, 0),
  }), [rows])

  const kpiItems = useMemo(() => [
    { id: 'sug', label: 'Suggestions', value: summary.suggestions, accent: 'blue' as const },
    { id: 'pr', label: 'Purchase', value: summary.purchase, accent: 'green' as const },
    { id: 'prod', label: 'Production', value: summary.production, accent: 'amber' as const },
    { id: 'qty', label: 'Total Suggested Qty', value: formatNumber(summary.totalQty), accent: 'slate' as const },
  ], [summary])

  async function handleCreatePr(row: InventoryPlanningRow) {
    try {
      const draft = await createPurchaseRequisitionDraftDemo(row)
      notify.success(`PR draft ${draft.documentNumber} created (demo)`)
      void load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to create PR draft')
    }
  }

  async function handleCreateProd(row: InventoryPlanningRow) {
    const draft = await createProductionRequestDraftDemo(row)
    notify.success(`Production request ${draft.documentNumber} created (demo)`)
    void load()
  }

  async function handleCreateTransfer(row: InventoryPlanningRow) {
    const draft = await createTransferDraftFromPlanningDemo(row)
    notify.success(`Transfer draft ${draft.documentNumber} created (demo)`)
    void load()
  }

  if (!perms.canViewPlanning) {
    return (
      <OperationalPageShell title="Access denied" description="You do not have permission to view inventory planning.">
        <p className="text-sm text-erp-muted">Contact your administrator for inventory.planning.view access.</p>
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Inventory & Warehouse"
      title="Inventory Planning"
      description="Simple replenishment suggestions — no advanced MRP. Projected Stock = Available + Expected Receipts − Reserved − Planned Consumption."
      breadcrumbs={[{ label: 'Inventory & Warehouse', to: '/inventory' }, { label: 'Planning' }]}
      autoBreadcrumbs={false}
      favoritePath="/inventory/planning"
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[
            { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() },
            { id: 'save-view', label: 'Save View', icon: Save, onClick: savedViews.openSaveDialog },
            { id: 'stock', label: 'Stock Availability', onClick: () => navigate('/inventory/stock') },
          ]}
        />
      )}
      kpiStrip={kpiItems}
    >
      <SmartFilterBar
        savedView={savedViews.activeView}
        onSavedViewChange={savedViews.selectView}
        savedViews={savedViews.viewNames}
        onSaveView={savedViews.openSaveDialog}
      />

      <div className="mb-3 flex flex-wrap items-end gap-2">
        <div className="min-w-[200px] flex-1">
          <label htmlFor="planning-search" className="sr-only">Search items</label>
          <SearchInput value={search} onChange={setSearch} placeholder="Search item…" />
        </div>
        <div>
          <label htmlFor="planning-wh" className="mb-1 block text-[11px] text-erp-muted">Warehouse</label>
          <select id="planning-wh" className="erp-input h-9 text-[12px]" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
            <option value="">All</option>
            {warehouses.filter((w) => w.isActive).map((w) => (
              <option key={w.id} value={w.id}>{w.warehouseName}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="planning-src" className="mb-1 block text-[11px] text-erp-muted">Suggested Source</label>
          <select id="planning-src" className="erp-input h-9 text-[12px]" value={suggestedSource} onChange={(e) => setSuggestedSource(e.target.value as PlanningSuggestedSource | 'all')}>
            <option value="all">All</option>
            {Object.entries(SOURCE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
      </div>

      <p className="mb-3 text-[12px] text-erp-muted">
        Suggested Qty = Maximum Stock − Projected Stock. Demo drafts only — no live posting.
      </p>

      {loadState === 'loading' ? <LoadingState variant="table" /> : null}
      {loadState === 'error' ? <p className="text-sm text-red-600" role="alert">Failed to load planning suggestions.</p> : null}
      {loadState === 'empty' ? (
        <EmptyState icon={ClipboardList} title="No replenishment suggestions" description="All items are within stock limits or planning is disabled." />
      ) : null}

      {loadState === 'ready' ? (
        <div className="overflow-x-auto">
          <EnterpriseRegisterTableShell>
            <table className="erp-table w-full min-w-[1200px]">
              <thead>
                <tr>
                  <th scope="col">Item</th>
                  <th scope="col">Warehouse</th>
                  <th scope="col" className="text-right">Available</th>
                  <th scope="col" className="text-right">Min</th>
                  <th scope="col" className="text-right">Safety</th>
                  <th scope="col" className="text-right">Max</th>
                  <th scope="col" className="text-right">Reserved</th>
                  <th scope="col" className="text-right">Open PO</th>
                  <th scope="col" className="text-right">Open Prod</th>
                  <th scope="col" className="text-right">Planned Cons.</th>
                  <th scope="col" className="text-right">Projected</th>
                  <th scope="col" className="text-right">Suggested Qty</th>
                  <th scope="col">Source</th>
                  <th scope="col">Required Date</th>
                  <th scope="col" className="w-12"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className={cn(row.status === 'ignored' && 'opacity-50')}>
                    <td>
                      <Link to={`/inventory/items/${row.itemId}`} className="font-mono text-erp-primary hover:underline">
                        {row.itemCode}
                      </Link>
                      <div className="text-[11px] text-erp-muted">{row.itemName}</div>
                    </td>
                    <td>{row.warehouseName}</td>
                    <td className="text-right font-mono">{formatNumber(row.availableStock)}</td>
                    <td className="text-right font-mono">{formatNumber(row.minimumStock)}</td>
                    <td className="text-right font-mono">{formatNumber(row.safetyStock)}</td>
                    <td className="text-right font-mono">{formatNumber(row.maximumStock)}</td>
                    <td className="text-right font-mono">{formatNumber(row.reservedDemand)}</td>
                    <td className="text-right font-mono">{formatNumber(row.openPurchaseOrders)}</td>
                    <td className="text-right font-mono">{formatNumber(row.openProductionOrders)}</td>
                    <td className="text-right font-mono">{formatNumber(row.plannedConsumption)}</td>
                    <td className={cn('text-right font-mono font-semibold', row.projectedStock < row.safetyStock ? 'text-amber-700' : '')}>
                      {formatNumber(row.projectedStock)}
                    </td>
                    <td className="text-right font-mono font-semibold text-erp-primary">
                      {editQtyId === row.id ? (
                        <input
                          type="number"
                          className="erp-input h-7 w-20 text-right text-[12px]"
                          value={editQtyValue}
                          onChange={(e) => setEditQtyValue(e.target.value)}
                          onBlur={async () => {
                            await updatePlanningQuantity(row.id, Number(editQtyValue))
                            setEditQtyId(null)
                            void load()
                          }}
                          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                          aria-label={`Edit suggested quantity for ${row.itemCode}`}
                        />
                      ) : formatNumber(row.suggestedQuantity)}
                    </td>
                    <td>
                      <span className="rounded bg-erp-bg-subtle px-1.5 py-0.5 text-[11px] font-medium">
                        {SOURCE_LABELS[row.suggestedSource]}
                      </span>
                    </td>
                    <td>
                      {editDateId === row.id ? (
                        <input
                          type="date"
                          className="erp-input h-7 text-[12px]"
                          value={editDateValue}
                          onChange={(e) => setEditDateValue(e.target.value)}
                          onBlur={async () => {
                            await updatePlanningRequiredDate(row.id, editDateValue)
                            setEditDateId(null)
                            void load()
                          }}
                          aria-label={`Edit required date for ${row.itemCode}`}
                        />
                      ) : formatDate(row.requiredDate)}
                    </td>
                    <td className="relative">
                      <button
                        type="button"
                        className="rounded p-1 hover:bg-erp-bg-subtle focus:outline-none focus:ring-2 focus:ring-erp-primary"
                        aria-label={`Actions for ${row.itemCode}`}
                        aria-haspopup="true"
                        aria-expanded={menuId === row.id}
                        onClick={() => setMenuId(menuId === row.id ? null : row.id)}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                      {menuId === row.id ? (
                        <div className="absolute right-0 z-20 mt-1 min-w-[200px] rounded border border-erp-border bg-white py-1 shadow-lg" role="menu">
                          {row.suggestedSource === 'purchase' ? (
                            <MenuBtn label="Create PR Draft" onClick={() => { setMenuId(null); void handleCreatePr(row) }} />
                          ) : null}
                          {row.suggestedSource === 'production' ? (
                            <MenuBtn label="Create Production Request" onClick={() => { setMenuId(null); void handleCreateProd(row) }} />
                          ) : null}
                          {row.suggestedSource === 'transfer' ? (
                            <MenuBtn label="Create Transfer Draft" onClick={() => { setMenuId(null); void handleCreateTransfer(row) }} />
                          ) : null}
                          <MenuBtn label="Change Quantity" onClick={() => { setEditQtyId(row.id); setEditQtyValue(String(row.suggestedQuantity)); setMenuId(null) }} />
                          <MenuBtn label="Change Date" onClick={() => { setEditDateId(row.id); setEditDateValue(row.requiredDate); setMenuId(null) }} />
                          <MenuBtn label="Ignore Suggestion" onClick={async () => { setMenuId(null); await ignorePlanningSuggestion(row.id); void load() }} />
                          <MenuBtn label="Open Item" onClick={() => { setMenuId(null); navigate(`/inventory/items/${row.itemId}`) }} />
                          <MenuBtn label="View Stock" onClick={() => { setMenuId(null); navigate(`/inventory/stock/${row.itemId}`) }} />
                          <MenuBtn label="View Reservations" onClick={() => {
                            setMenuId(null)
                            setReservationContext({ itemId: row.itemId, warehouseId: row.warehouseId, itemCode: row.itemCode })
                          }} />
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </EnterpriseRegisterTableShell>
        </div>
      ) : null}

      {reservationContext ? (
        <section className="mt-6 rounded-lg border border-erp-border bg-erp-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Reservations — {reservationContext.itemCode}</h3>
            <button type="button" className="text-[12px] text-erp-muted underline" onClick={() => setReservationContext(null)}>
              Close
            </button>
          </div>
          <ReservationsPanel itemId={reservationContext.itemId} warehouseId={reservationContext.warehouseId} />
        </section>
      ) : null}

      <SaveViewDialog
        open={savedViews.saveDialogOpen}
        defaultName={savedViews.activeView === 'My View' ? '' : savedViews.activeView}
        onClose={savedViews.closeSaveDialog}
        onSave={savedViews.saveCurrentView}
      />
    </OperationalPageShell>
  )
}

function MenuBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="block w-full px-3 py-1.5 text-left text-[12px] hover:bg-erp-bg-subtle" role="menuitem" onClick={onClick}>
      {label}
    </button>
  )
}
