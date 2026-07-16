import type { ReactNode } from 'react'
import type {
  FinancialReportComparisonMode,
  FinancialReportFilter,
  FinancialReportLookups,
} from '@/types/financialReports'
import { cn } from '@/utils/cn'

const COMPARISON_OPTIONS: { value: FinancialReportComparisonMode; label: string }[] = [
  { value: 'none', label: 'No comparison' },
  { value: 'previous_year', label: 'Previous year' },
  { value: 'budget', label: 'Budget' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'ytd', label: 'Year to date' },
]

function FilterField({
  label,
  children,
  className,
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-0.5', className)}>
      <label className="text-[10px] font-semibold uppercase tracking-wide text-erp-muted">{label}</label>
      {children}
    </div>
  )
}

export function FinancialReportFilterBar({
  filter,
  onChange,
  lookups,
  onApply,
  onReset,
  className,
  compact = true,
}: {
  filter: FinancialReportFilter
  onChange: (filter: FinancialReportFilter) => void
  lookups: FinancialReportLookups
  onApply?: () => void
  onReset?: () => void
  className?: string
  compact?: boolean
}) {
  function patch(partial: Partial<FinancialReportFilter>) {
    onChange({ ...filter, ...partial })
  }

  function handleFyChange(fyLabel: string) {
    const fy = lookups.financialYears.find((f) => f.label === fyLabel)
    if (fy) {
      patch({ fy: fyLabel, fromDate: fy.startDate, toDate: fy.endDate })
    } else {
      patch({ fy: fyLabel })
    }
  }

  return (
    <div
      className={cn(
        'flex flex-wrap items-end gap-2 border-b border-erp-border bg-erp-surface-alt/40 px-3 py-2',
        compact && 'gap-x-2 gap-y-2',
        className,
      )}
    >
      <FilterField label="Financial year" className="min-w-[10rem]">
        <select
          className="erp-input h-8 w-full text-[12px]"
          aria-label="Financial year"
          value={filter.fy}
          onChange={(e) => handleFyChange(e.target.value)}
        >
          {lookups.financialYears.map((fy) => (
            <option key={fy.label} value={fy.label}>
              {fy.label}
            </option>
          ))}
        </select>
      </FilterField>

      <FilterField label="From" className="min-w-[8.5rem]">
        <input
          type="date"
          className="erp-input h-8 w-full text-[12px]"
          aria-label="From date"
          value={filter.fromDate}
          onChange={(e) => patch({ fromDate: e.target.value })}
        />
      </FilterField>

      <FilterField label="To" className="min-w-[8.5rem]">
        <input
          type="date"
          className="erp-input h-8 w-full text-[12px]"
          aria-label="To date"
          value={filter.toDate}
          onChange={(e) => patch({ toDate: e.target.value })}
        />
      </FilterField>

      <FilterField label="Plant" className="min-w-[9rem]">
        <select
          className="erp-input h-8 w-full text-[12px]"
          aria-label="Plant"
          value={filter.plant}
          onChange={(e) => patch({ plant: e.target.value })}
        >
          <option value="">All plants</option>
          {lookups.plants.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code} — {p.name}
            </option>
          ))}
        </select>
      </FilterField>

      <FilterField label="Department" className="min-w-[9rem]">
        <select
          className="erp-input h-8 w-full text-[12px]"
          aria-label="Department"
          value={filter.department}
          onChange={(e) => patch({ department: e.target.value })}
        >
          <option value="">All departments</option>
          {lookups.departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.code} — {d.name}
            </option>
          ))}
        </select>
      </FilterField>

      <FilterField label="Cost centre" className="min-w-[9rem]">
        <select
          className="erp-input h-8 w-full text-[12px]"
          aria-label="Cost centre"
          value={filter.costCentre}
          onChange={(e) => patch({ costCentre: e.target.value })}
        >
          <option value="">All cost centres</option>
          {lookups.costCentres.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} — {c.name}
            </option>
          ))}
        </select>
      </FilterField>

      <FilterField label="Project" className="min-w-[9rem]">
        <select
          className="erp-input h-8 w-full text-[12px]"
          aria-label="Project"
          value={filter.project}
          onChange={(e) => patch({ project: e.target.value })}
        >
          <option value="">All projects</option>
          {lookups.projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code} — {p.name}
            </option>
          ))}
        </select>
      </FilterField>

      <FilterField label="Comparison" className="min-w-[9rem]">
        <select
          className="erp-input h-8 w-full text-[12px]"
          aria-label="Comparison mode"
          value={filter.comparisonMode}
          onChange={(e) => patch({ comparisonMode: e.target.value as FinancialReportComparisonMode })}
        >
          {COMPARISON_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </FilterField>

      <div className="flex h-8 items-center gap-2 pb-0.5">
        <label className="inline-flex cursor-pointer items-center gap-1.5 text-[12px] text-erp-text">
          <input
            type="checkbox"
            className="rounded border-erp-border"
            checked={filter.includeZeroBalance}
            onChange={(e) => patch({ includeZeroBalance: e.target.checked })}
          />
          <span>Include zero balances</span>
        </label>
      </div>

      {onReset || onApply ? (
        <div className="ml-auto flex shrink-0 items-end gap-2 pb-0.5">
          {onReset ? (
            <button
              type="button"
              className="erp-btn erp-btn-ghost h-8 px-3 text-[12px] font-semibold"
              onClick={onReset}
            >
              Reset
            </button>
          ) : null}
          {onApply ? (
            <button
              type="button"
              className="erp-btn erp-btn-primary h-8 px-4 text-[12px] font-semibold"
              onClick={onApply}
            >
              Apply
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
