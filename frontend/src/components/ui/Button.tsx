import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../../utils/cn'

/**
 * Action-colored buttons shared across ERP.
 * primary = save / main CTA · success = approve / complete · danger = delete / reject
 * warning = hold / caution · secondary = cancel-adjacent · outline = alternate · ghost = tertiary
 */
const variants = {
  primary: 'erp-btn erp-btn--primary',
  secondary: 'erp-btn erp-btn--secondary',
  outline: 'erp-btn erp-btn--outline',
  ghost: 'erp-btn erp-btn--ghost',
  danger: 'erp-btn erp-btn--danger',
  accent: 'erp-btn erp-btn--warning',
  success: 'erp-btn erp-btn--success',
  info: 'erp-btn erp-btn--info',
} as const

const sizes = {
  xs: 'erp-btn--xs',
  sm: 'erp-btn--sm',
  md: 'erp-btn--md',
  lg: 'erp-btn--lg',
  icon: 'erp-btn--icon',
} as const

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants
  size?: keyof typeof sizes
}

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(variants[variant], sizes[size], className)}
      {...props}
    >
      {children}
    </button>
  )
}

export const ActionButton = Button
