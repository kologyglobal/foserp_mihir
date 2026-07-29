/**
 * Standard cost versions (upsert) + variance register.
 */
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { RefreshCw, Scale } from 'lucide-react'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input, Select } from '@/components/forms/Inputs'
import { ItemLookupSelect } from '@/components/lookups/ItemLookupSelect'
import { Button } from '@/design-system/components/Button'
import { isApiMode } from '@/config/apiConfig'
import {
  fetchInventoryCostVariances,
  fetchStandardCostVersions,
  postStandardCostVersion,
  type InventoryCostVarianceDto,
} from '@/services/api/inventoryCostingApi'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { useInventoryPermissions } from '@/utils/permissions/inventory'
import { InventoryCostingShell } from './InventoryCostingShell'
import { inventoryCostingPaths } from './inventoryCostingPaths'

const DEMO_VARIANCES: InventoryCostVarianceDto[] = [
  {
    id: 'demo-var-1',
    itemId: 'demo-item-steel',
    warehouseId: 'demo-wh-rm',
    inventoryMovementId: 'demo-mv-1',
    varianceType: 'PURCHASE_PRICE',
    quantity: '100.0000',
    standardUnitCost: '80.0000',
    actualUnitCost: '85.0000',
    varianceAmount: '500.0000',
    postingDate: '2026-07-20T00:00:00.000Z',
    sourceType: 'GOODS_RECEIPT',
    sourceId: 'demo-grn-1',
    remarks: 'Demo purchase price vs standard',
    createdAt: '2026-07-20T10:00:00.000Z',
  },
]

export function InventoryStandardCostPage() {
  const api = isApiMode()
  const perms = useInventoryPermissions()
  const [rows, setRows] = useState<InventoryCostVarianceDto[]>([])
  const [versions, setVersions] = useState<
    Array<{
      id: string
      itemCode: string
      itemName: string
      unitCost: string
      effectiveFrom: string
      version: number
      status: string
      difference: string
    }>
  >([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    itemId: '',
    unitCost: '',
    effectiveFrom: new Date().toISOString().slice(0, 10),
    remarks: '',
    activate: true,
  })

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (!api) {
        setRows(DEMO_VARIANCES)
        setVersions([])
        return
      }
      const [varRes, verRes] = await Promise.all([
        fetchInventoryCostVariances({ limit: 100 }),
        fetchStandardCostVersions({ limit: 100 }),
      ])
      setRows(varRes.data ?? [])
      setVersions(verRes.data ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load standard costs')
    } finally {
      setLoading(false)
    }
  }, [api])

  useEffect(() => {
    void load()
  }, [load])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!api) {
      notify.info('Standard cost versions require API mode')
      return
    }
    if (!perms.canManageSetup) {
      notify.error('inventory.setup.manage required')
      return
    }
    const unitCost = Number(form.unitCost)
    if (!form.itemId.trim() || !Number.isFinite(unitCost) || unitCost < 0) {
      notify.error('Select an item and enter a non-negative unit cost')
      return
    }
    setBusy(true)
    try {
      await postStandardCostVersion({
        itemId: form.itemId.trim(),
        unitCost,
        effectiveFrom: form.effectiveFrom,
        remarks: form.remarks.trim() || undefined,
        activate: form.activate,
      })
      notify.success('Standard cost version saved')
      setForm((f) => ({ ...f, unitCost: '', remarks: '' }))
      await load()
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Failed to save standard cost')
    } finally {
      setBusy(false)
    }
  }

  return (
    <InventoryCostingShell
      title="Standard Cost"
      favoritePath={inventoryCostingPaths.standard}
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]}
        />
      }
    >
      <div className="border-b border-erp-border p-4">
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-erp-muted">
          New standard cost version
        </h3>
        <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" onSubmit={onSubmit}>
          <label className="block text-[12px] sm:col-span-2 lg:col-span-1">
            <span className="text-erp-muted">Item</span>
            <div className="mt-1">
              <ItemLookupSelect
                value={form.itemId}
                onChange={(sel) => setForm((f) => ({ ...f, itemId: sel?.itemId ?? '' }))}
                placeholder="Search by item code or name…"
                allowEmpty
                disabled={!perms.canManageSetup}
              />
            </div>
          </label>
          <label className="block text-[12px]">
            <span className="text-erp-muted">Unit cost</span>
            <Input
              type="number"
              step="0.0001"
              min="0"
              value={form.unitCost}
              onChange={(e) => setForm((f) => ({ ...f, unitCost: e.target.value }))}
              className="mt-1"
            />
          </label>
          <label className="block text-[12px]">
            <span className="text-erp-muted">Effective from</span>
            <Input
              type="date"
              value={form.effectiveFrom}
              onChange={(e) => setForm((f) => ({ ...f, effectiveFrom: e.target.value }))}
              className="mt-1"
            />
          </label>
          <label className="block text-[12px] sm:col-span-2">
            <span className="text-erp-muted">Remarks</span>
            <Input
              value={form.remarks}
              onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
              className="mt-1"
            />
          </label>
          <label className="flex items-end gap-2 text-[12px]">
            <Select
              value={form.activate ? 'yes' : 'no'}
              onChange={(e) => setForm((f) => ({ ...f, activate: e.target.value === 'yes' }))}
            >
              <option value="yes">Activate immediately</option>
              <option value="no">Save inactive</option>
            </Select>
          </label>
          <div className="flex items-end">
            <Button type="submit" size="sm" disabled={busy || !perms.canManageSetup}>
              {busy ? 'Saving…' : 'Save version'}
            </Button>
          </div>
        </form>
        {!perms.canManageSetup ? (
          <p className="mt-2 text-[12px] text-amber-800">Requires inventory.setup.manage to post versions.</p>
        ) : null}
      </div>

      <div className="border-b border-erp-border px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-erp-muted">
        Standard cost versions
      </div>
      {!loading && versions.length > 0 ? (
        <div className="erp-table-wrap overflow-x-auto border-b border-erp-border">
          <table className="erp-table w-full min-w-[800px] text-left text-[12px]">
            <thead>
              <tr>
                <th>Item</th>
                <th className="text-right">Standard</th>
                <th>Effective</th>
                <th>Version</th>
                <th>Status</th>
                <th className="text-right">vs master rate</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((v) => (
                <tr key={v.id}>
                  <td className="font-medium">
                    {v.itemCode} — {v.itemName}
                  </td>
                  <td className="text-right tabular-nums">{formatCurrency(Number(v.unitCost))}</td>
                  <td>{formatDate(v.effectiveFrom.slice(0, 10))}</td>
                  <td>v{v.version}</td>
                  <td>{v.status}</td>
                  <td className="text-right tabular-nums">{formatCurrency(Number(v.difference))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <div className="border-b border-erp-border px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-erp-muted">
        Cost variances
      </div>
      {loading ? (
        <div className="p-3">
          <LoadingState variant="table" />
        </div>
      ) : null}
      {error ? <p className="px-3 py-3 text-[13px] text-rose-700">{error}</p> : null}
      {!loading && rows.length === 0 ? (
        <EmptyState icon={Scale} title="No variances" description="Variances appear when actual receipt/issue cost differs from active standard." />
      ) : null}
      {!loading && rows.length > 0 ? (
        <div className="erp-table-wrap overflow-x-auto">
          <table className="erp-table w-full min-w-[720px] text-left text-[12px]">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th className="text-right">Std</th>
                <th className="text-right">Actual</th>
                <th className="text-right">Variance</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{formatDate(r.postingDate.slice(0, 10))}</td>
                  <td>{r.varianceType}</td>
                  <td className="text-right font-mono tabular-nums">{formatCurrency(Number(r.standardUnitCost))}</td>
                  <td className="text-right font-mono tabular-nums">{formatCurrency(Number(r.actualUnitCost))}</td>
                  <td className="text-right font-mono tabular-nums font-semibold">{formatCurrency(Number(r.varianceAmount))}</td>
                  <td className="text-erp-muted">{r.sourceType}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </InventoryCostingShell>
  )
}
