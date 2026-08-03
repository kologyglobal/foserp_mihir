import type { PurchaseOrderLine } from '@/types/purchaseDomain'
import {
  formatPurchaseQty,
  getPurchaseLineBaseUomCode,
  purchaseLineHasDualUom,
} from '@/utils/purchaseLineUom'
import { cn } from '@/utils/cn'

type LineUom = Pick<PurchaseOrderLine, 'itemId' | 'uom' | 'uomConversionFactor'>

type Props = {
  line: LineUom
  /** Qty in purchase / vendor UOM (e.g. MTR). */
  purchaseQty: number
  /** Qty in base / stock UOM (e.g. NOS). */
  baseQty: number
  className?: string
}

/**
 * Read-only tracking qty (outstanding / received / invoiced).
 * When MUOM applies, shows purchase UOM on top and base UOM beneath — same pattern as Qty column.
 */
export function PurchaseLineTrackingQtyCell({ line, purchaseQty, baseQty, className }: Props) {
  const dual = purchaseLineHasDualUom(line)
  const purchaseUom = (line.uom || '—').trim()
  const baseUom = getPurchaseLineBaseUomCode(line.itemId)

  if (!dual || !baseUom) {
    const qty = purchaseQty || baseQty
    const uom = purchaseUom !== '—' ? purchaseUom : baseUom || '—'
    return (
      <div className={cn('whitespace-nowrap tabular-nums text-[11px]', className)}>
        {formatPurchaseQty(qty)} {uom}
      </div>
    )
  }

  return (
    <div className={cn('tabular-nums text-right', className)}>
      <div className="whitespace-nowrap text-[11px] font-medium text-erp-text">
        {formatPurchaseQty(purchaseQty)} {purchaseUom}
      </div>
      <div className="mt-0.5 whitespace-nowrap text-[10px] font-medium text-erp-muted">
        {formatPurchaseQty(baseQty)} {baseUom}
      </div>
    </div>
  )
}
