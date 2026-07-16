import { TableLink } from '../ui/AppLink'
import { Badge } from '../ui/Badge'
import { formatNumber } from '@/utils/formatters/currency'
import type { StockPositionEnriched } from '@/types/inventory'

interface LowStockAlertProps {
  items: StockPositionEnriched[]
  compact?: boolean
}

function severity(item: StockPositionEnriched): { label: string; color: 'red' | 'orange' | 'yellow' } {
  const gap = item.reorderLevel - item.onHand
  if (item.onHand <= 0) return { label: 'Out of Stock', color: 'red' }
  if (gap > item.reorderLevel * 0.5) return { label: 'Critical', color: 'red' }
  if (gap > 0) return { label: 'Low Stock', color: 'orange' }
  return { label: 'Low Stock', color: 'yellow' }
}

export function LowStockAlert({ items, compact }: LowStockAlertProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-[13px] text-green-800">
        All stockable items are above reorder level.
      </div>
    )
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
        <span className="text-[13px] font-medium text-red-800">
          {items.length} item{items.length > 1 ? 's' : ''} below reorder level
        </span>
      </div>
    )
  }

  return (
    <div className="divide-y divide-erp-border">
      {items.map((item) => {
        const sev = severity(item)
        return (
          <div
            key={`${item.itemId}-${item.warehouseId}`}
            className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-erp-surface-alt"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <TableLink to={`/inventory/stock/${item.itemId}?warehouse=${item.warehouseId}`}>
                  {item.itemCode}
                </TableLink>
                <Badge color={sev.color} dot>{sev.label}</Badge>
              </div>
              <p className="mt-0.5 truncate text-[13px] text-erp-text">{item.itemName}</p>
              <p className="text-xs text-erp-muted">{item.warehouseName}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-semibold tabular-nums text-erp-danger">
                {formatNumber(item.onHand)} {item.uomCode}
              </p>
              <p className="text-xs text-erp-muted">
                Reorder: {formatNumber(item.reorderLevel)}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function stockStatus(item: StockPositionEnriched): { label: string; color: 'green' | 'red' | 'blue' | 'orange' | 'gray' } {
  if (item.onHand <= 0) return { label: 'Out of Stock', color: 'red' }
  if (item.isLowStock) return { label: 'Low Stock', color: 'red' }
  if (item.reservedQty > 0 && item.freeQty <= 0) return { label: 'Reserved', color: 'blue' }
  if (item.reservedQty > 0) return { label: 'Available', color: 'green' }
  return { label: 'Available', color: 'green' }
}
