import { useRef } from 'react'
import { cn } from '../../utils/cn'
import type { LeadPriority } from '../../types/sales'

interface CrmLeadPriorityChipsProps {
  value: LeadPriority
  onChange: (value: LeadPriority) => void
  options: { value: LeadPriority; label: string }[]
}

const TONE: Record<LeadPriority, string> = {
  low: 'crm-lead-priority--low',
  medium: 'crm-lead-priority--medium',
  high: 'crm-lead-priority--high',
  critical: 'crm-lead-priority--critical',
}

/** Visual priority picker — faster than a dropdown for sales users */
export function CrmLeadPriorityChips({ value, onChange, options }: CrmLeadPriorityChipsProps) {
  const groupRef = useRef<HTMLDivElement>(null)

  function focusChip(index: number) {
    const buttons = groupRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')
    buttons?.[index]?.focus()
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const idx = options.findIndex((o) => o.value === value)
    if (idx < 0) return

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      const next = (idx + 1) % options.length
      onChange(options[next].value)
      focusChip(next)
      return
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      const next = (idx - 1 + options.length) % options.length
      onChange(options[next].value)
      focusChip(next)
      return
    }
    if (e.key === 'Home') {
      e.preventDefault()
      onChange(options[0].value)
      focusChip(0)
      return
    }
    if (e.key === 'End') {
      e.preventDefault()
      const last = options.length - 1
      onChange(options[last].value)
      focusChip(last)
    }
  }

  return (
    <div
      ref={groupRef}
      className="crm-lead-priority-chips"
      role="radiogroup"
      aria-label="Lead priority"
      onKeyDown={onKeyDown}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          tabIndex={value === opt.value ? 0 : -1}
          className={cn(
            'crm-lead-priority-chip',
            TONE[opt.value],
            value === opt.value && 'crm-lead-priority-chip--active',
          )}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
