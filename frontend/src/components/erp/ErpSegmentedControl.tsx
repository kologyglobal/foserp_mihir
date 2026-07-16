import type { LucideIcon } from 'lucide-react'
import { cn } from '../../utils/cn'

export interface ErpSegmentedOption<T extends string = string> {
  value: T
  label: string
  description?: string
  icon?: LucideIcon
  disabled?: boolean
}

export interface ErpSegmentedControlProps<T extends string = string> {
  value: T
  onChange: (value: T) => void
  options: ErpSegmentedOption<T>[]
  name?: string
  className?: string
  /** Compact inline pill toggle (default: card grid) */
  variant?: 'cards' | 'pills'
}

export function ErpSegmentedControl<T extends string = string>({
  value,
  onChange,
  options,
  name,
  className,
  variant = 'cards',
}: ErpSegmentedControlProps<T>) {
  if (variant === 'pills') {
    return (
      <div
        className={cn('erp-segmented-pills', className)}
        role="radiogroup"
        aria-label={name}
      >
        {options.map((opt) => {
          const selected = value === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={opt.disabled}
              className={cn(
                'erp-segmented-pills__btn',
                selected && 'erp-segmented-pills__btn--active',
              )}
              onClick={() => onChange(opt.value)}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div
      className={cn('erp-segmented-control', className)}
      role="radiogroup"
      aria-label={name}
    >
      {options.map((opt) => {
        const Icon = opt.icon
        const selected = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={opt.disabled}
            className={cn(
              'erp-segmented-control__option',
              selected && 'erp-segmented-control__option--active',
            )}
            onClick={() => onChange(opt.value)}
          >
            {Icon ? (
              <span className="erp-segmented-control__icon-wrap" aria-hidden>
                <Icon className="erp-segmented-control__icon" />
              </span>
            ) : null}
            <span className="erp-segmented-control__label">{opt.label}</span>
            {opt.description ? (
              <span className="erp-segmented-control__desc">{opt.description}</span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
