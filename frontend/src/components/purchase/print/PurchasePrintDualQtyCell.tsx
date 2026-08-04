import { formatNumber } from '@/utils/formatters/currency'
import type { DualQtyPrintValues } from '@/utils/purchasePrintDualQty'

type Props = DualQtyPrintValues & {
  as?: 'td' | 'div'
  className?: string
}

/** Stacked purchase UOM (top) + stock UOM (bottom) for purchase print/PDF. */
export function PurchasePrintDualQtyCell({
  purchaseQty,
  purchaseUom,
  stockQty,
  stockUom,
  showDual,
  as = 'td',
  className = 'num',
}: Props) {
  const content = !showDual ? (
    <span className="po-print-qty-line">
      {formatNumber(stockQty)} {stockUom}
    </span>
  ) : (
    <div className="po-print-dual-qty">
      <span className="po-print-qty-line">
        {formatNumber(purchaseQty)} {purchaseUom}
      </span>
      <span className="po-print-qty-line po-print-qty-line--stock">
        {formatNumber(stockQty)} {stockUom}
      </span>
    </div>
  )

  if (as === 'div') {
    return <div className={className}>{content}</div>
  }
  return <td className={className}>{content}</td>
}
