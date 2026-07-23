import { useEffect, useRef, useState } from 'react'
import { getAvailableBatches } from '@/services/inventory/traceabilityService'
import { getInventoryItemLineage, listInventoryLots } from '@/services/api/inventoryApi'
import { isApiMode } from '@/config/apiConfig'
import type { BatchSelectionMethod, BatchSelectionPreviewLine } from '@/types/inventoryDomain'
import { BATCH_METHOD_LABELS } from '@/utils/inventoryMovementLabels'
import { formatDate } from '@/utils/dates/format'
import { formatNumber } from '@/utils/formatters/currency'
import { cn } from '@/utils/cn'

/** Prefer InventoryLot when present; fall back to InventoryBatch balances (stock-posting SoT). */
async function loadApiBatches(
  itemId: string,
  warehouseId: string,
  qty: number,
): Promise<BatchSelectionPreviewLine[]> {
  const lots = await listInventoryLots({ itemId, warehouseId, status: 'ACTIVE', limit: 100 })
  const fromLots = lots.data
    .map((lot) => ({
      itemId: lot.itemId,
      itemCode: '',
      batchNo: lot.lotNumber,
      expiryDate: lot.expiryDate,
      availableQty: Number(lot.quantityOnHand),
      selectedQty: Math.min(qty, Number(lot.quantityOnHand)),
    }))
    .filter((lot) => lot.availableQty > 0)
  if (fromLots.length > 0) return fromLots

  const lineage = await getInventoryItemLineage(itemId)
  return lineage.data.batches
    .map((batch) => {
      const availableQty = batch.balances
        .filter((b) => b.warehouseId === warehouseId && b.stockStatus === 'UNRESTRICTED')
        .reduce((sum, b) => sum + Number(b.quantity), 0)
      return {
        itemId,
        itemCode: '',
        batchNo: batch.batchNumber,
        expiryDate: batch.expiryDate,
        availableQty,
        selectedQty: Math.min(qty, availableQty),
        batchId: batch.id,
      }
    })
    .filter((row) => row.availableQty > 0)
}

export interface BatchSelectorProps {
  itemId: string
  warehouseId: string
  qty: number
  value: string | null
  onChange: (batchNo: string | null, meta?: { batchId?: string }) => void
  method?: BatchSelectionMethod
  disabled?: boolean
  showFefoPreview?: boolean
}

export function BatchSelector({
  itemId,
  warehouseId,
  qty,
  value,
  onChange,
  method = 'fefo',
  disabled = false,
  showFefoPreview = true,
}: BatchSelectorProps) {
  const [preview, setPreview] = useState<BatchSelectionPreviewLine[]>([])
  const [loading, setLoading] = useState(false)
  const autoSelectedRef = useRef(false)

  useEffect(() => {
    if (!itemId || !warehouseId || qty <= 0) {
      setPreview([])
      autoSelectedRef.current = false
      return
    }
    let cancelled = false
    setLoading(true)
    const request = isApiMode()
      ? loadApiBatches(itemId, warehouseId, qty)
      : getAvailableBatches(itemId, warehouseId, qty, method)
    request
      .then((rows) => {
        if (!cancelled) {
          setPreview(rows)
          if (!value && rows[0] && method !== 'manual' && !autoSelectedRef.current) {
            autoSelectedRef.current = true
            const first = rows[0] as BatchSelectionPreviewLine & { batchId?: string }
            onChange(first.batchNo, first.batchId ? { batchId: first.batchId } : undefined)
          }
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [itemId, warehouseId, qty, method])

  if (loading) return <p className="text-[12px] text-erp-muted">Loading batches…</p>
  if (preview.length === 0) return <p className="text-[12px] text-erp-muted">No available batches.</p>

  return (
    <div className="space-y-2">
      <select
        className="erp-input h-9 w-full text-[12px]"
        value={value ?? ''}
        disabled={disabled}
        onChange={(e) => {
          const batchNo = e.target.value || null
          const match = preview.find((b) => b.batchNo === batchNo) as
            | (BatchSelectionPreviewLine & { batchId?: string })
            | undefined
          onChange(batchNo, match?.batchId ? { batchId: match.batchId } : undefined)
        }}
      >
        <option value="">— Select —</option>
        {preview.map((b) => (
          <option key={b.batchNo} value={b.batchNo}>
            {b.batchNo}
            {b.expiryDate ? ` · exp ${formatDate(b.expiryDate)}` : ''}
            {` · avail ${formatNumber(b.availableQty)}`}
          </option>
        ))}
      </select>
      {showFefoPreview && method === 'fefo' ? (
        <div className="rounded border border-erp-border bg-erp-bg-subtle/50 p-2">
          <p className="mb-1 text-[11px] font-semibold uppercase text-erp-muted">
            {BATCH_METHOD_LABELS.fefo} preview
          </p>
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-erp-muted">
                <th className="text-left">Batch</th>
                <th className="text-left">Expiry</th>
                <th className="text-right">Selected</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((b) => (
                <tr key={b.batchNo} className={cn(value === b.batchNo && 'font-semibold text-erp-primary')}>
                  <td className="font-mono">{b.batchNo}</td>
                  <td>{b.expiryDate ? formatDate(b.expiryDate) : '—'}</td>
                  <td className="text-right font-mono">{formatNumber(b.selectedQty)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}
