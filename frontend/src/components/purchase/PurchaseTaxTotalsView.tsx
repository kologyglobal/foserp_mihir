import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

export interface PurchaseTaxTotalsViewChargeRow {
  id: string
  label: string
  value: string
  hidden?: boolean
}

export interface PurchaseTaxTotalsViewCalcRow {
  id: string
  label: string
  value: string
  hidden?: boolean
}

export interface PurchaseTaxTotalsViewProps {
  charges: PurchaseTaxTotalsViewChargeRow[]
  calcRows: PurchaseTaxTotalsViewCalcRow[]
  grandTotalLabel?: string
  grandTotalValue: string
  footer?: ReactNode
  className?: string
  chargesHeading?: string
  calcHeading?: string
}

function ChargeRowView({ row }: { row: PurchaseTaxTotalsViewChargeRow }) {
  return (
    <div className="flex min-h-8 items-baseline justify-between gap-3 border-b border-dashed border-erp-border/70 py-1.5">
      <span className="shrink-0 text-[11px] font-medium text-erp-muted">{row.label}</span>
      <span className="text-right text-[12px] font-medium tabular-nums text-erp-text">{row.value}</span>
    </div>
  )
}

function CalcRowView({ row }: { row: PurchaseTaxTotalsViewCalcRow }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 text-[12px]">
      <dt className="text-erp-muted">{row.label}</dt>
      <dd className="font-medium tabular-nums text-erp-text">{row.value}</dd>
    </div>
  )
}

export function PurchaseTaxTotalsView({
  charges,
  calcRows,
  grandTotalLabel = 'Grand Total',
  grandTotalValue,
  footer,
  className,
  chargesHeading = 'Charges and taxes',
  calcHeading = 'Final calculation',
}: PurchaseTaxTotalsViewProps) {
  const visibleCharges = charges.filter((r) => !r.hidden)
  const visibleCalc = calcRows.filter((r) => !r.hidden)

  return (
    <div className={cn('w-full', className)}>
      <div className="grid gap-4 md:grid-cols-2 md:gap-6">
        <section aria-label={chargesHeading}>
          <p className="erp-field-group__label mb-1.5">{chargesHeading}</p>
          <div className="space-y-0.5">
            {visibleCharges.map((row) => (
              <ChargeRowView key={row.id} row={row} />
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