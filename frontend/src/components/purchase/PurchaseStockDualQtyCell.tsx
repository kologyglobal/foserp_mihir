import { resolveDualQtyForPrint } from '@/utils/purchasePrintDualQty'
import { formatPurchaseQty } from '@/utils/purchaseLineUom'
import { cn } from '@/utils/cn'

type Props = {
  /** Qty in stock / base UOM (e.g. NOS). */
  baseQty: number
  itemId?: string | null
  /** Known vendor-UOM qty; derived from item master factor when omitted. */
  purchaseQty?: number | null
  /** Known line snapshots; derived from item master when omitted. */
  purchaseUom?: string | null
  stockUom?: string | null
  uomConversionFactor?: number | null
  className?: string
  /** Hide the UOM code on single-unit items (when a separate UOM column exists). */
  bareWhenSingle?: boolean
}

/**
 * Stacked vendor qty (top) + stock qty (bottom) for documents that store base quantities
 * (planning, returns, RFQ, comparison). Falls back to a single value for 1:1 items.
 */
export function PurchaseStockDualQtyCell({
  baseQty,
  itemId,
  purchaseQty,
  purchaseUom,
  stockUom,
  uomConversionFactor,
  className,
  bareWhenSingle = false,
}: Props) {
  const dual = resolveDualQtyForPrint({
    stockQty: Number(baseQty) || 0,
    stockUom,
    itemId,
    purchaseQty,
    purchaseUom,
    uomConversionFactor,
  })

  if (!dual.showDual) {
    return (
      <div className={cn('purchase-dual-qty purchase-dual-qty--single text-right', className)}>
        <div className="purchase-dual-qty__primary">
          {formatPurchaseQty(dual.stockQty)}
          {bareWhenSingle ? '' : ` ${dual.stockUom}`}
        </div>
      </div>
    )
  }

  return (
    <div className={cn('purchase-dual-qty text-right', className)}>
      <div className="purchase-dual-qty__primary">
        {formatPurchaseQty(dual.purchaseQty)} {dual.purchaseUom}
      </div>
      <div className="purchase-dual-qty__secondary">
        {formatPurchaseQty(dual.stockQty)} {dual.stockUom}
      </div>
    </div>
  )
}
