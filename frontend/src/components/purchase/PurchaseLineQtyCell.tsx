import type { PurchaseOrderLine } from '@/types/purchaseDomain'
import {
  formatPurchaseQty,
  getPurchaseLineBaseUomCode,
  purchaseLineHasDualUom,
} from '@/utils/purchaseLineUom'
import { cn } from '@/utils/cn'

type LineQty = Pick<PurchaseOrderLine, 'itemId' | 'uom' | 'uomQuantity' | 'quantity' | 'uomConversionFactor'>

type Props = {
  line: LineQty
  editable?: boolean
  value?: number
  onChange?: (value: number) => void
  disabled?: boolean
  className?: string
  inputId?: string
}

/** Purchase qty + unit; when MUOM applies, also show base/stock qty (e.g. 30 MTR / 10 NOS). */
export function PurchaseLineQtyCell({
  line,
  editable = false,
  value,
  onChange,
  disabled = false,
  className,
  inputId,
}: Props) {
  const purchaseQty = Number(value ?? line.uomQuantity ?? line.quantity) || 0
  const purchaseUom = (line.uom || '—').trim()
  const dual = purchaseLineHasDualUom(line)
  const baseUom = getPurchaseLineBaseUomCode(line.itemId)
  const baseQty = Number(line.quantity) || 0

  if (editable) {
    return (
      <div className={cn('min-w-[10rem] text-right', className)}>
        <div className="flex items-center justify-end gap-2 whitespace-nowrap">
          <input
            id={inputId}
            type="number"
            min={0}
            step="any"
            className="erp-input h-8 w-[4.5rem] shrink-0 text-right text-[11px]"
            disabled={disabled}
            title="Purchase quantity"
            value={purchaseQty}
            onChange={(e) => onChange?.(Number(e.target.value))}
          />
          <span className="min-w-[2.75rem] shrink-0 text-left text-[11px] font-semibold uppercase tracking-wide text-erp-text">
            {purchaseUom}
          </span>
        </div>
        {dual && baseUom ? (
          <p className="mt-1 whitespace-nowrap text-right text-[10px] font-medium tabular-nums text-erp-muted">
            {formatPurchaseQty(baseQty)} {baseUom}
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <div className={cn('min-w-[10rem] text-right tabular-nums', className)}>
      <div className="whitespace-nowrap text-[11px] font-medium text-erp-text">
        {formatPurchaseQty(purchaseQty)} {purchaseUom}
      </div>
      {dual && baseUom ? (
        <div className="mt-0.5 whitespace-nowrap text-[10px] font-medium text-erp-muted">
          {formatPurchaseQty(baseQty)} {baseUom}
        </div>
      ) : null}
    </div>
  )
}
