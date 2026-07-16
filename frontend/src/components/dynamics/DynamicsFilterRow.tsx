import type { ReactNode } from 'react'

export function DynamicsFilterRow({ children, onClear }: { children: ReactNode; onClear?: () => void }) {
  return (
    <div className="dyn-filter-row">
      {children}
      {onClear && (
        <button type="button" className="dyn-filter-clear" onClick={onClear}>
          Clear filters
        </button>
      )}
    </div>
  )
}

export function DynamicsFilterChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="dyn-filter-chip">
      <span className="dyn-filter-chip-label">{label}:</span> {value}
    </span>
  )
}
