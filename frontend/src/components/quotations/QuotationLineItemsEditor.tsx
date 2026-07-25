import { useMemo, useState } from 'react'
import type { QuotationPriceLine } from '../../types/crm'
import { ErpProductPricingPanel } from '../erp/ErpProductPricingSection'
import { useMasterStore } from '../../store/masterStore'
import {
  opportunityLinesToQuotationPriceLines,
  quotationPriceLinesToOpportunityLines,
  syncOpportunityLines,
  type OrderDiscountMode,
} from '../../utils/opportunityLineCalc'
import { useProductMasterOptionMap } from '../../utils/opportunityProductOptions'

export interface QuotationLineExtras {
  freightAmount: number
  installationAmount: number
  customCharges: number
}

interface QuotationLineItemsEditorProps {
  priceLines: QuotationPriceLine[]
  onChange?: (lines: QuotationPriceLine[], extras: QuotationLineExtras) => void
  freightAmount?: number
  installationAmount?: number
  customCharges?: number
  probability?: number
  readOnly?: boolean
  scopeNotes?: string
  onScopeNotesChange?: (value: string) => void
  showFreightExtras?: boolean
  rowErrors?: Record<string, string[]>
}

export function QuotationLineItemsEditor({
  priceLines,
  onChange,
  freightAmount = 0,
  installationAmount = 0,
  customCharges = 0,
  readOnly,
  scopeNotes,
  onScopeNotesChange,
  showFreightExtras = false,
  rowErrors,
}: QuotationLineItemsEditorProps) {
  const products = useMasterStore((s) => s.products)
  const items = useMasterStore((s) => s.items)
  const uoms = useMasterStore((s) => s.uoms)
  const retainProductIds = useMemo(
    () => priceLines.map((l) => l.productId),
    [priceLines],
  )
  const { options: productOptions, pickMap } = useProductMasterOptionMap(
    products,
    items,
    uoms,
    undefined,
    retainProductIds,
  )

  const oppLines = useMemo(
    () => quotationPriceLinesToOpportunityLines(priceLines),
    [priceLines],
  )

  const [orderDiscountMode, setOrderDiscountMode] = useState<OrderDiscountMode>('flat')
  const [orderDiscountInput, setOrderDiscountInput] = useState(0)

  const extras: QuotationLineExtras = { freightAmount, installationAmount, customCharges }

  function handleLinesChange(nextOppLines: ReturnType<typeof syncOpportunityLines>) {
    if (!onChange) return
    onChange(opportunityLinesToQuotationPriceLines(nextOppLines), extras)
  }

  function handleExtrasChange(patch: Partial<QuotationLineExtras>) {
    if (!onChange) return
    onChange(priceLines, { ...extras, ...patch })
  }

  return (
    <div className="quotation-line-items-editor space-y-4">
      <ErpProductPricingPanel
        lines={oppLines}
        onChange={handleLinesChange}
        productOptions={productOptions}
        productPickMap={pickMap}
        rowErrors={rowErrors}
        readOnly={readOnly}
        showAdjustments
        freightAmount={freightAmount}
        onFreightChange={
          onChange && !readOnly
            ? (next) => handleExtrasChange({ freightAmount: next })
            : undefined
        }
        orderDiscountMode={orderDiscountMode}
        onOrderDiscountModeChange={readOnly ? undefined : setOrderDiscountMode}
        orderDiscountInput={orderDiscountInput}
        onOrderDiscountInputChange={readOnly ? undefined : setOrderDiscountInput}
        installationAmount={installationAmount}
        onInstallationChange={
          showFreightExtras && onChange && !readOnly
            ? (next) => handleExtrasChange({ installationAmount: next })
            : undefined
        }
        customCharges={customCharges}
        onCustomChargesChange={
          showFreightExtras && onChange && !readOnly
            ? (next) => handleExtrasChange({ customCharges: next })
            : undefined
        }
      />

      {scopeNotes !== undefined || onScopeNotesChange ? (
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold text-erp-text">Scope Notes</span>
          {readOnly ? (
            <p className="text-[14px] text-erp-muted">{scopeNotes?.trim() || '—'}</p>
          ) : (
            <textarea
              rows={3}
              value={scopeNotes ?? ''}
              onChange={(e) => onScopeNotesChange?.(e.target.value)}
              placeholder="Additional technical-commercial scope beyond line items…"
              className="erp-input w-full resize-y"
            />
          )}
        </label>
      ) : null}
    </div>
  )
}
