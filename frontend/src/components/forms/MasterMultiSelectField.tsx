import { cn } from '../../utils/cn'

export interface MasterMultiSelectOption {
  value: string
  label: string
}

function parseMultiSelectValue(value: string): string[] {
  return value
    .split(',')
    .map((part) => part.trim().toLowerCase().replace(/\s+/g, '_'))
    .filter(Boolean)
}

export function formatMasterMultiSelectValue(
  value: string | number | boolean | null | undefined,
  options: MasterMultiSelectOption[],
): string {
  const selected = parseMultiSelectValue(String(value ?? ''))
  if (selected.length === 0) return '—'
  const labels = selected.map((token) => {
    const match = options.find(
      (opt) => opt.value === token || opt.label.toLowerCase().replace(/\s+/g, '_') === token,
    )
    return match?.label ?? token.replace(/_/g, ' ')
  })
  return labels.join(', ')
}

export function MasterMultiSelectField({
  value,
  onChange,
  options,
  className,
}: {
  value: string
  onChange: (value: string) => void
  options: MasterMultiSelectOption[]
  className?: string
}) {
  const selected = new Set(parseMultiSelectValue(value))

  const toggle = (token: string) => {
    const next = new Set(selected)
    if (next.has(token)) next.delete(token)
    else next.add(token)
    onChange([...next].join(','))
  }

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {options.map((opt) => {
        const checked = selected.has(opt.value)
        return (
          <label
            key={opt.value}
            className={cn(
              'inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-[13px] transition',
              checked
                ? 'border-erp-primary bg-erp-primary/5 text-erp-text'
                : 'border-erp-border bg-erp-surface text-erp-muted hover:border-erp-primary/30',
            )}
          >
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-erp-border text-erp-primary"
              checked={checked}
              onChange={() => toggle(opt.value)}
            />
            <span className="font-medium">{opt.label}</span>
          </label>
        )
      })}
    </div>
  )
}
