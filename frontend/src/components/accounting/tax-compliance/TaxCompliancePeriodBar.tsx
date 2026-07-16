import { useEffect, useState } from 'react'
import {
  listGstins,
  listTaxPeriods,
  loadPeriodFilter,
  savePeriodFilter,
} from '@/services/accounting/taxComplianceService'
import type { GstinProfile, PeriodFilterState, TaxCompliancePeriod } from '@/types/taxCompliance'

/** Period + GSTIN filters preserved in sessionStorage across compatible views */
export function TaxCompliancePeriodBar({
  value,
  onChange,
}: {
  value?: PeriodFilterState
  onChange?: (next: PeriodFilterState) => void
}) {
  const [periods, setPeriods] = useState<TaxCompliancePeriod[]>([])
  const [gstins, setGstins] = useState<GstinProfile[]>([])
  const [filter, setFilter] = useState<PeriodFilterState>(() => value ?? loadPeriodFilter())

  useEffect(() => {
    void Promise.all([listTaxPeriods(), listGstins()]).then(([p, g]) => {
      setPeriods(p)
      setGstins(g)
    })
  }, [])

  useEffect(() => {
    if (value) setFilter(value)
  }, [value])

  const apply = (next: PeriodFilterState) => {
    setFilter(next)
    savePeriodFilter(next)
    onChange?.(next)
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded border border-erp-border bg-white px-3 py-2">
      <label className="flex flex-col gap-0.5 text-[11px] font-semibold text-erp-muted">
        Period
        <select
          className="h-8 min-w-[140px] rounded border border-erp-border bg-white px-2 text-[12px] text-erp-text"
          value={filter.periodKey}
          onChange={(e) => apply({ ...filter, periodKey: e.target.value })}
          aria-label="Compliance period"
        >
          {periods.map((p) => (
            <option key={p.periodKey} value={p.periodKey}>
              {p.label} ({p.fyLabel})
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-0.5 text-[11px] font-semibold text-erp-muted">
        GSTIN
        <select
          className="h-8 min-w-[220px] rounded border border-erp-border bg-white px-2 text-[12px] text-erp-text"
          value={filter.gstinId}
          onChange={(e) => apply({ ...filter, gstinId: e.target.value })}
          aria-label="GSTIN"
        >
          {gstins.map((g) => (
            <option key={g.id} value={g.id}>
              {g.gstin} — {g.stateName}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
