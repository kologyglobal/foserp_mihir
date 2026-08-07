import type { PurchaseOrderLine } from '@/types/purchaseDomain'
import {
  formatPurchaseQty,
  resolvePurchaseLineTrackingPresentation,
} from '@/utils/purchaseLineUom'
import { cn } from '@/utils/cn'

type LineUom = Pick<PurchaseOrderLine, 'itemId' | 'uom' | 'uomConversionFactor' | 'uomId'>

type Props = {
  line: LineUom
  /** Qty in purchase / vendor UOM when already split; otherwise same as base. */
  purchaseQty: number
  /** Qty in base / stock UOM (e.g. NOS). */
  baseQty: number
  className?: string
  showDualQtyLabels?: boolean
}

/**
 * Read-only tracking qty (outstanding / received / invoiced).
 * MUOM: vendor UOM on top (KG/MTR), stock UOM below (NOS).
 */
export function PurchaseLineTrackingQtyCell({
  line,
  purchaseQty,
  baseQty,
  className,
  showDualQtyLabels = false,
}: Props) {
  const pres = resolvePurchaseLineTrackingPresentation(line, purchaseQty, baseQty)

  if (!pres.dual) {
    return (
      <div className={cn('purchase-dual-qty purchase-dual-qty--single text-right', className)}>
        <div className="purchase-dual-qty__primary">
          {formatPurchaseQty(pres.baseQty)} {pres.baseUom}
        </div>
      </div>
    )
  }

  return (
    <div className={cn('purchase-dual-qty text-right', className)}>
      <div className="purchase-dual-qty__primary">
        {showDualQtyLabels ? <span className="purchase-dual-qty__label">Purchase</span> : null}
        {formatPurchaseQty(pres.purchaseQty)} {pres.purchaseUom}
      </div>
      <div className="purchase-dual-qty__secondary">
        {showDualQtyLabels ? <span className="purchase-dual-qty__label">Stock</span> : null}
        {formatPurchaseQty(pres.baseQty)} {pres.baseUom}
      </div>
    </div>
  )
}
