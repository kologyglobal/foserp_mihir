import type { ReactNode } from 'react'
import { Input } from '@/components/forms/Inputs'
import { cn } from '@/utils/cn'

export type PurchaseTaxTotalsChargeRow =
  | {
      id: string
      label: string
      kind: 'value'
      value: string
      hidden?: boolean
    }
  | {
      id: string
      label: string
      kind: 'input'
      value: number
      disabled?: boolean
      onChange: (value: number) => void
      hidden?: boolean
    }

export interface PurchaseTaxTotalsCalcRow {
  id: string
  label: string
  value: string
  hidden?: boolean
}

export interface PurchaseTaxTotalsPanelProps {
  /** Left column — mix of read-only amounts and compact editable charge inputs. */
  charges: PurchaseTaxTotalsChargeRow[]
  /** Right column — calculated rows (taxable, GST split, round off). Grand Total is separate. */
  calcRows: PurchaseTaxTotalsCalcRow[]
  grandTotalLabel?: string
  grandTotalValue: string
  /** Optional footer under the two columns (e.g. origin hint). */
  footer?: ReactNode
  className?: string
  chargesHeading?: string
  calcHeading?: string
}

function ChargeField({ row }: { row: PurchaseTaxTotalsChargeRow }) {
  if (row.kind === 'value') {
    return (
      <div className="flex min-h-8 items-baseline justify-between gap-3 border-b border-dashed border-erp-border/70 py-1.5">
        <span className="shrink-0 text-[11px] font-medium text-erp-muted">{row.label}</span>
        <span className="text-right text-[12px] font-medium tabular-nums text-erp-text">{row.value}</span>
      </div>
    )
  }

  return (
    <div className="flex min-h-8 items-center justify-between gap-3 py-1">
      <label className="shrink-0 text-[11px] font-medium text-erp-muted" htmlFor={`tax-charge-${row.id}`}>
        {row.label}
      </label>
      <Input
        id={`tax-charge-${row.id}`}
        type="number"
        disabled={row.disabled}
        value={row.value}
        onChange={(e) => row.onChange(Number(e.target.value))}
        className="h-8 w-[7.5rem] shrink-0 text-right text-[12px] tabular-nums"
      />
    </div>
  )
}

function CalcRowView({ row }: { row: PurchaseTaxTotalsCalcRow }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 text-[12px]">
      <dt className="text-erp-muted">{row.label}</dt>
      <dd className="font-medium tabular-nums text-erp-text">{row.value}</dd>
    </div>
  )
}

/**
 * Two-column Tax & Totals body for purchase document editors.
 * Left: charges (editable inputs where needed; plain values for calculated amounts).
 * Right: final calculation as presentation rows — never Input lookalikes — with dominant Grand Total.
 */
export function PurchaseTaxTotalsPanel({
  charges,
  calcRows,
  grandTotalLabel = 'Grand Total',
  grandTotalValue,
  footer,
  className,
  chargesHeading = 'Charges and taxes',
  calcHeading = 'Final calculation',
}: PurchaseTaxTotalsPanelProps) {
  const visibleCharges = charges.filter((r) => !r.hidden)
  const visibleCalc = calcRows.filter((r) => !r.hidden)

  return (
    <div className={cn('w-full', className)}>
      <div className="grid gap-4 md:grid-cols-2 md:gap-6">
        <section aria-label={chargesHeading}>
          <p className="erp-field-group__label mb-1.5">{chargesHeading}</p>
          <div className="space-y-0.5">
            {visibleCharges.map((row) => (
              <ChargeField key={row.id} row={row} />
            ))}
          </div>
        </section>

        <section aria-label={calcHeading}>
          <p className="erp-field-group__label mb-1.5">{calcHeading}</p>
          <dl className="rounded-md border border-erp-border bg-erp-surface px-3 py-2">
            {visibleCalc.map((row) => (
              <CalcRowView key={row.id} row={row} />
            ))}
            <div className="mt-1.5 flex items-center justify-between gap-3 rounded-md border-t border-erp-border bg-erp-primary-soft px-2.5 py-2.5">
              <dt className="text-[13px] font-bold text-erp-text">{grandTotalLabel}</dt>
              <dd className="text-[18px] font-bold tabular-nums tracking-tight text-erp-primary">
                {grandTotalValue}
              </dd>
            </div>
          </dl>
        </section>
      </div>
      {footer ? <div className="mt-3">{footer}</div> : null}
    </div>
  )
}
