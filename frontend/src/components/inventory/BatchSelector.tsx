import { useEffect, useRef, useState } from 'react'
import { getAvailableBatches } from '@/services/inventory/traceabilityService'
import type { BatchSelectionMethod, BatchSelectionPreviewLine } from '@/types/inventoryDomain'
import { BATCH_METHOD_LABELS } from '@/utils/inventoryMovementLabels'
import { formatDate } from '@/utils/dates/format'
import { formatNumber } from '@/utils/formatters/currency'
import { cn } from '@/utils/cn'

export interface BatchSelectorProps {
  itemId: string
  warehouseId: string
  qty: number
  value: string | null
  onChange: (batchNo: string | null) => void
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
    getAvailableBatches(itemId, warehouseId, qty, method)
      .then((rows) => {
        if (!cancelled) {
          setPreview(rows)
          if (!value && rows[0] && method !== 'manual' && !autoSelectedRef.current) {
            autoSelectedRef.current = true
            onChange(rows[0].batchNo)
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
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="">Select batch…</option>
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
