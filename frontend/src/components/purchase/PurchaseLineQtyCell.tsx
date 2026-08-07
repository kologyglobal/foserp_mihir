import type { PurchaseOrderLine } from '@/types/purchaseDomain'
import {
  formatPurchaseQty,
  resolvePurchaseLineQtyPresentation,
} from '@/utils/purchaseLineUom'
import { cn } from '@/utils/cn'
import { DecimalInput } from '@/components/forms/Inputs'

type LineQty = Pick<PurchaseOrderLine, 'itemId' | 'uom' | 'uomQuantity' | 'quantity' | 'uomConversionFactor' | 'uomId'>

type Props = {
  line: LineQty
  editable?: boolean
  value?: number
  onChange?: (value: number) => void
  disabled?: boolean
  className?: string
  inputId?: string
  /** PO view: caption Purchase (vendor UOM) / Stock (base UOM) on dual rows. */
  showDualQtyLabels?: boolean
}

/** Purchase qty + unit; when MUOM applies, vendor UOM on top and stock/base UOM below (e.g. 800 KG / 16 NOS). */
export function PurchaseLineQtyCell({
  line,
  editable = false,
  value,
  onChange,
  disabled = false,
  className,
  inputId,
  showDualQtyLabels = false,
}: Props) {
  const pres = resolvePurchaseLineQtyPresentation(line)
  const editQty = Number(value ?? pres.purchaseQty) || 0

  if (editable) {
    return (
      <div className={cn('min-w-[10rem] text-right', className)}>
        <div className="flex items-center justify-end gap-2 whitespace-nowrap">
          <DecimalInput
            id={inputId}
            min={0}
            className="h-8 w-[4.5rem] shrink-0 text-right text-[12px]"
            disabled={disabled}
            title="Purchase quantity"
            value={editQty}
            onChange={(v) => onChange?.(v)}
          />
          <span className="min-w-[2.75rem] shrink-0 text-left text-[12px] font-semibold uppercase tracking-wide text-erp-text">
            {pres.purchaseUom}
          </span>
        </div>
        {pres.dual ? (
          <p className="purchase-dual-qty__secondary mt-1 text-right">
            {formatPurchaseQty(pres.baseQty)} {pres.baseUom}
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'purchase-dual-qty text-right',
        !pres.dual && 'purchase-dual-qty--single',
        className,
      )}
    >
      <div className="purchase-dual-qty__primary">
        {showDualQtyLabels && pres.dual ? (
          <span className="purchase-dual-qty__label">Purchase</span>
        ) : null}
        {formatPurchaseQty(pres.purchaseQty)} {pres.purchaseUom}
      </div>
      {pres.dual ? (
        <div className="purchase-dual-qty__secondary">
          {showDualQtyLabels ? (
            <span className="purchase-dual-qty__label">Stock</span>
          ) : null}
          {formatPurchaseQty(pres.baseQty)} {pres.baseUom}
        </div>
      ) : null}
    </div>
  )
}
