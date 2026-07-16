import { Plus, Trash2 } from 'lucide-react'
import type { QuotationPriceLine } from '../../types/crm'
import { FormattedCurrencyInput } from '../forms/FormattedCurrencyInput'
import { calcPriceSummary, syncLineTotals } from '../../utils/crmQuotationCalc'
import { formatCrmCurrency } from '../../utils/crmMetrics'
import { amountInWordsINR } from '../../utils/quotationEngine/amountInWords'

interface QuotationPriceTableProps {
  lines: QuotationPriceLine[]
  freightAmount: number
  installationAmount: number
  customCharges: number
  editable?: boolean
  onChange?: (lines: QuotationPriceLine[], extras: { freightAmount: number; installationAmount: number; customCharges: number }) => void
}

export function QuotationPriceTable({
  lines,
  freightAmount,
  installationAmount,
  customCharges,
  editable,
  onChange,
}: QuotationPriceTableProps) {
  const synced = syncLineTotals(lines)
  const summary = calcPriceSummary(synced, freightAmount, installationAmount, customCharges)

  const lineDetail = (line: QuotationPriceLine) => {
    const base = line.qty * line.unitPrice
    const discAmt = base * (line.discountPct / 100)
    const taxable = base - discAmt
    const gstAmt = taxable * (line.taxPct / 100)
    return { base, discAmt, taxable, gstAmt }
  }

  const updateLine = (id: string, patch: Partial<QuotationPriceLine>) => {
    if (!onChange) return
    const next = synced.map((l) => (l.id === id ? { ...l, ...patch } : l))
    onChange(syncLineTotals(next), { freightAmount, installationAmount, customCharges })
  }

  const addLine = () => {
    if (!onChange) return
    const line: QuotationPriceLine = {
      id: `pl-${Date.now()}`,
      productOrItem: 'New item',
      description: '',
      qty: 1,
      uom: 'Nos',
      unitPrice: 0,
      discountPct: 0,
      taxPct: 18,
      lineTotal: 0,
      isOptional: false,
    }
    onChange([...synced, line], { freightAmount, installationAmount, customCharges })
  }

  const removeLine = (id: string) => {
    if (!onChange) return
    onChange(synced.filter((l) => l.id !== id), { freightAmount, installationAmount, customCharges })
  }

  return (
    <div className="quo-editor-price erp-line-items-grid">
      <div className="quo-editor-price__table-wrap erp-line-items-grid__wrap">
        <table className="quo-editor-price__table erp-line-items-grid__table">
          <thead>
            <tr>
              <th className="erp-line-items-grid__sticky-sr">Sr</th>
              <th className="erp-line-items-grid__sticky-product">Description</th>
              <th className="text-right">Qty</th>
              <th>UOM</th>
              <th className="text-right">Basic</th>
              <th className="text-right">Disc %</th>
              <th className="text-right">Disc Amt</th>
              <th className="text-right">Taxable</th>
              <th className="text-right">GST %</th>
              <th className="text-right">GST Amt</th>
              <th className="text-right">Total</th>
              {editable ? <th className="w-10" /> : null}
            </tr>
          </thead>
          <tbody>
            {synced.map((line, idx) => {
              const { discAmt, taxable, gstAmt } = lineDetail(line)
              return (
              <tr key={line.id}>
                <td className="tabular-nums text-erp-muted erp-line-items-grid__sticky-sr">{idx + 1}</td>
                <td className="erp-line-items-grid__sticky-product">
                  {editable ? (
                    <input className="quo-editor-price__input" value={line.productOrItem} onChange={(e) => updateLine(line.id, { productOrItem: e.target.value })} />
                  ) : line.productOrItem}
                </td>
                <td>
                  {editable ? (
                    <input className="quo-editor-price__input" value={line.description} onChange={(e) => updateLine(line.id, { description: e.target.value })} />
                  ) : line.description}
                </td>
                <td className="text-right">
                  {editable ? (
                    <input type="number" className="quo-editor-price__input quo-editor-price__input--num" value={line.qty} onChange={(e) => updateLine(line.id, { qty: Number(e.target.value) })} />
                  ) : line.qty}
                </td>
                <td>{line.uom}</td>
                <td className="text-right tabular-nums">
                  {editable ? (
                    <FormattedCurrencyInput
                      className="quo-editor-price__input quo-editor-price__input--num"
                      value={line.unitPrice}
                      onValueChange={(unitPrice) => updateLine(line.id, { unitPrice: Math.max(0, unitPrice) })}
                      aria-label="Unit price"
                    />
                  ) : formatCrmCurrency(line.unitPrice)}
                </td>
                <td className="text-right">
                  {editable ? (
                    <input type="number" className="quo-editor-price__input quo-editor-price__input--num" value={line.discountPct} onChange={(e) => updateLine(line.id, { discountPct: Number(e.target.value) })} />
                  ) : `${line.discountPct}%`}
                </td>
                <td className="text-right tabular-nums">{formatCrmCurrency(discAmt)}</td>
                <td className="text-right tabular-nums">{formatCrmCurrency(taxable)}</td>
                <td className="text-right">
                  {editable ? (
                    <input type="number" className="quo-editor-price__input quo-editor-price__input--num" value={line.taxPct} onChange={(e) => updateLine(line.id, { taxPct: Number(e.target.value) })} />
                  ) : `${line.taxPct}%`}
                </td>
                <td className="text-right tabular-nums">{formatCrmCurrency(gstAmt)}</td>
                <td className="text-right font-semibold tabular-nums text-erp-primary">{formatCrmCurrency(line.lineTotal)}</td>
                {editable ? (
                  <td>
                    <button type="button" className="quo-editor-price__remove" onClick={() => removeLine(line.id)} aria-label="Remove line">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                ) : null}
              </tr>
            )})}
          </tbody>
        </table>
      </div>

      {editable ? (
        <button type="button" className="quo-editor-price__add" onClick={addLine}>
          <Plus className="h-4 w-4" />
          Add line item
        </button>
      ) : null}

      <div className="quo-editor-price__summary">
        <div className="quo-editor-price__summary-row">
          <span>Basic amount</span>
          <span className="tabular-nums">{formatCrmCurrency(summary.basicAmount)}</span>
        </div>
        <div className="quo-editor-price__summary-row">
          <span>Discount</span>
          <span className="tabular-nums">{formatCrmCurrency(summary.discountAmount)}</span>
        </div>
        <div className="quo-editor-price__summary-row">
          <span>Taxable value</span>
          <span className="tabular-nums">{formatCrmCurrency(summary.taxableValue)}</span>
        </div>
        <div className="quo-editor-price__summary-row">
          <span>GST</span>
          <span className="tabular-nums">{formatCrmCurrency(summary.gstAmount)}</span>
        </div>
        {editable ? (
          <>
            <div className="quo-editor-price__summary-row">
              <span>Freight</span>
              <FormattedCurrencyInput
                className="quo-editor-price__summary-input"
                value={freightAmount}
                onValueChange={(next) => onChange?.(synced, { freightAmount: Math.max(0, next), installationAmount, customCharges })}
                aria-label="Freight"
              />
            </div>
            <div className="quo-editor-price__summary-row">
              <span>Installation</span>
              <FormattedCurrencyInput
                className="quo-editor-price__summary-input"
                value={installationAmount}
                onValueChange={(next) => onChange?.(synced, { freightAmount, installationAmount: Math.max(0, next), customCharges })}
                aria-label="Installation"
              />
            </div>
          </>
        ) : (
          <>
            {freightAmount > 0 ? (
              <div className="quo-editor-price__summary-row">
                <span>Freight</span>
                <span className="tabular-nums">{formatCrmCurrency(freightAmount)}</span>
              </div>
            ) : null}
            {installationAmount > 0 ? (
              <div className="quo-editor-price__summary-row">
                <span>Installation</span>
                <span className="tabular-nums">{formatCrmCurrency(installationAmount)}</span>
              </div>
            ) : null}
          </>
        )}
        <div className="quo-editor-price__summary-row quo-editor-price__summary-row--total">
          <span>Grand total</span>
          <span className="tabular-nums">{formatCrmCurrency(summary.grandTotal)}</span>
        </div>
        <p className="quo-editor-price__words">
          <em>Amount in words:</em> {amountInWordsINR(summary.grandTotal)}
        </p>
      </div>
    </div>
  )
}

export { calcPriceSummary }
