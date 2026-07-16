import { CheckCircle2, ClipboardCheck } from 'lucide-react'
import type { JobCardQcCheck, QcChecklistItem } from '../../types/qc'
import { cn } from '../../utils/cn'

interface QcChecklistPanelProps {
  items: QcChecklistItem[] | JobCardQcCheck[]
  readonly?: boolean
  onChange?: (checks: JobCardQcCheck[]) => void
  compact?: boolean
}

function isJobCardChecks(items: QcChecklistItem[] | JobCardQcCheck[]): items is JobCardQcCheck[] {
  return items.length > 0 && 'passed' in items[0]
}

export function QcChecklistPanel({ items, readonly = false, onChange, compact = false }: QcChecklistPanelProps) {
  if (items.length === 0) return null

  const checks: JobCardQcCheck[] = isJobCardChecks(items)
    ? items
    : items.map((item) => ({ ...item, passed: false }))

  function toggle(id: string) {
    if (readonly || !onChange) return
    onChange(checks.map((c) => (c.id === id ? { ...c, passed: !c.passed } : c)))
  }

  return (
    <div
      className={cn(
        'rounded-md border border-amber-200/80 bg-amber-50/50',
        compact ? 'px-3 py-2' : 'px-4 py-3',
      )}
    >
      <div className={cn('flex items-center gap-2 font-semibold uppercase tracking-wide text-amber-800', compact ? 'mb-2 text-[10px]' : 'mb-3 text-[11px]')}>
        <ClipboardCheck className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
        QC Checklist
      </div>
      <ul className={cn('space-y-2', compact && 'space-y-1.5')}>
        {checks.map((item) => (
          <li key={item.id}>
            {readonly ? (
              <span className={cn('flex items-center gap-2 text-[13px]', item.passed ? 'text-erp-text' : 'text-erp-muted')}>
                <CheckCircle2 className={cn('h-4 w-4 shrink-0', item.passed ? 'text-erp-success' : 'text-erp-muted/40')} />
                {item.label}
              </span>
            ) : (
              <label className="flex cursor-pointer items-center gap-2 text-[13px] text-erp-text">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-erp-border text-erp-primary focus:ring-erp-primary"
                  checked={item.passed}
                  onChange={() => toggle(item.id)}
                />
                <span className={item.passed ? 'font-medium' : undefined}>{item.label}</span>
              </label>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
