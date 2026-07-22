import { useEffect, useState } from 'react'
import {
  getPeriodCloseSetup,
  loadPeriodCloseFilter,
  savePeriodCloseFilter,
} from '@/services/accounting/periodCloseService'
import type { PeriodCloseSetup, PeriodFilterState } from '@/types/periodClose'

export function PeriodClosePeriodBar({
  value,
  onChange,
}: {
  value?: PeriodFilterState
  onChange?: (next: PeriodFilterState) => void
}) {
  const [setup, setSetup] = useState<PeriodCloseSetup | null>(null)
  const [filter, setFilter] = useState<PeriodFilterState>(() => value ?? loadPeriodCloseFilter())

  useEffect(() => {
    void getPeriodCloseSetup().then((s) => {
      setSetup(s)
      const current = value ?? loadPeriodCloseFilter()
      // Bootstrap API filter when first landing with demo defaults
      if (s.companies[0] && (!current.periodId || current.companyId === 'co-vasant')) {
        const fy = s.fiscalYears[0]
        const periodsForFy = s.periods.filter((p) => p.fiscalYear === fy?.code)
        const focus = periodsForFy.find((p) => p.code === current.periodCode) ?? periodsForFy[0]
        if (fy && focus) {
          const next: PeriodFilterState = {
            companyId: s.companies[0].id,
            companyName: s.companies[0].name,
            fiscalYear: fy.label,
            fiscalYearId: fy.code,
            periodCode: focus.code,
            periodLabel: focus.label,
            periodId: focus.id,
          }
          setFilter(next)
          savePeriodCloseFilter(next)
          onChange?.(next)
        }
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bootstrap once on mount
  }, [])

  useEffect(() => {
    if (value) setFilter(value)
  }, [value])

  const apply = (next: PeriodFilterState) => {
    setFilter(next)
    savePeriodCloseFilter(next)
    onChange?.(next)
  }

  const periods = setup?.periods.filter((p) => p.fiscalYear === (filter.fiscalYearId ?? filter.fiscalYear)) ?? []

  return (
    <div className="flex flex-wrap items-end gap-3 rounded border border-erp-border bg-white px-3 py-2">
      <label className="flex flex-col gap-0.5 text-[11px] font-semibold text-erp-muted">
        Company
        <select
          className="h-8 min-w-[180px] rounded border border-erp-border bg-white px-2 text-[12px] text-erp-text"
          value={filter.companyId}
          onChange={(e) => {
            const co = setup?.companies.find((c) => c.id === e.target.value)
            apply({
              ...filter,
              companyId: e.target.value,
              companyName: co?.name ?? filter.companyName,
            })
          }}
          aria-label="Company"
        >
          {(setup?.companies ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-0.5 text-[11px] font-semibold text-erp-muted">
        Financial Year
        <select
          className="h-8 min-w-[120px] rounded border border-erp-border bg-white px-2 text-[12px] text-erp-text"
          value={filter.fiscalYearId ?? filter.fiscalYear}
          onChange={(e) => {
            const fyCode = e.target.value
            const fy = setup?.fiscalYears.find((y) => y.code === fyCode)
            const first = setup?.periods.find((p) => p.fiscalYear === fyCode)
            apply({
              ...filter,
              fiscalYear: fy?.label ?? fyCode,
              fiscalYearId: fyCode,
              periodCode: first?.code ?? filter.periodCode,
              periodLabel: first?.label ?? filter.periodLabel,
              periodId: first?.id,
            })
          }}
          aria-label="Financial year"
        >
          {(setup?.fiscalYears ?? []).map((fy) => (
            <option key={fy.code} value={fy.code}>
              {fy.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-0.5 text-[11px] font-semibold text-erp-muted">
        Close Period
        <select
          className="h-8 min-w-[140px] rounded border border-erp-border bg-white px-2 text-[12px] text-erp-text"
          value={filter.periodCode}
          onChange={(e) => {
            const p = periods.find((x) => x.code === e.target.value)
            apply({
              ...filter,
              periodCode: e.target.value,
              periodLabel: p?.label ?? e.target.value,
              periodId: p?.id,
            })
          }}
          aria-label="Close period"
        >
          {periods.map((p) => (
            <option key={p.id ?? p.code} value={p.code}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <p className="pb-1 text-[11px] text-erp-muted">
        Closing: <span className="font-semibold text-erp-text">{filter.periodLabel}</span>
      </p>
    </div>
  )
}
