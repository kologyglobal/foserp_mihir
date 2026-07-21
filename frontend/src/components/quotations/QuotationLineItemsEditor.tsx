import { useMemo } from 'react'
import type { QuotationPriceLine } from '../../types/crm'
import { ErpLineItemsGrid } from '../erp/ErpLineItemsGrid'
import { FormattedCurrencyInput } from '../forms/FormattedCurrencyInput'
import { useMasterStore } from '../../store/masterStore'
import { formatCrmCurrency } from '../../utils/crmMetrics'
import { calcPriceSummary } from '../../utils/crmQuotationCalc'
import {
  opportunityLinesToQuotationPriceLines,
  quotationPriceLinesToOpportunityLines,
  syncOpportunityLines,
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
  probability = 0,
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

  const extras: QuotationLineExtras = { freightAmount, installationAmount, customCharges }
  const quoteSummary = useMemo(
    () => calcPriceSummary(priceLines, freightAmount, installationAmount, customCharges),
    [priceLines, freightAmount, installationAmount, customCharges],
  )

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
      <ErpLineItemsGrid
        lines={oppLines}
        onChange={handleLinesChange}
        productOptions={productOptions}
        productPickMap={pickMap}
        rowErrors={rowErrors}
        probability={probability}
        readOnly={readOnly}
        variant="opportunity"
      />

      {showFreightExtras && !readOnly ? (
        <div className="quotation-line-items-editor__extras grid gap-3 sm:grid-cols-3">
          <label className="block text-sm">
            <span className="font-medium text-erp-text">Freight</span>
            <FormattedCurrencyInput
              value={freightAmount}
              onValueChange={(next) => handleExtrasChange({ freightAmount: Math.max(0, next) })}
              className="erp-input mt-1 text-right tabular-nums"
              aria-label="Freight"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-erp-text">Installation</span>
            <FormattedCurrencyInput
              value={installationAmount}
              onValueChange={(next) => handleExtrasChange({ installationAmount: Math.max(0, next) })}
              className="erp-input mt-1 text-right tabular-nums"
              aria-label="Installation"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-erp-text">Other charges</span>
            <FormattedCurrencyInput
              value={customCharges}
              onValueChange={(next) => handleExtrasChange({ customCharges: Math.max(0, next) })}
              className="erp-input mt-1 text-right tabular-nums"
              aria-label="Other charges"
            />
          </label>
        </div>
      ) : null}

      {showFreightExtras && readOnly && (freightAmount > 0 || installationAmount > 0 || customCharges > 0) ? (
        <div className="quo-editor-price__summary">
          {freightAmount > 0 ? (
            <div className="quo-editor-price__summary-row">
              <span>Freight</span>
              <span className="tabular-nums text-right">{formatCrmCurrency(freightAmount)}</span>
            </div>
          ) : null}
          {installationAmount > 0 ? (
            <div className="quo-editor-price__summary-row">
              <span>Installation</span>
              <span className="tabular-nums text-right">{formatCrmCurrency(installationAmount)}</span>
            </div>
          ) : null}
          {customCharges > 0 ? (
            <div className="quo-editor-price__summary-row">
              <span>Other charges</span>
              <span className="tabular-nums text-right">{formatCrmCurrency(customCharges)}</span>
            </div>
          ) : null}
          <div className="quo-editor-price__summary-row quo-editor-price__summary-row--total">
            <span>Grand total (incl. extras)</span>
            <span className="tabular-nums text-right">{formatCrmCurrency(quoteSummary.grandTotal)}</span>
          </div>
        </div>
      ) : null}

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
