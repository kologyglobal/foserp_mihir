import { memo, type ButtonHTMLAttributes } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '../../utils/cn'

const variants = {
  primary: 'erp-btn erp-btn--primary',
  secondary: 'erp-btn erp-btn--secondary',
  outline: 'erp-btn erp-btn--outline',
  ghost: 'erp-btn erp-btn--ghost',
  danger: 'erp-btn erp-btn--danger',
  success: 'erp-btn erp-btn--success',
  warning: 'erp-btn erp-btn--warning',
  info: 'erp-btn erp-btn--info',
} as const

const sizes = {
  sm: 'erp-btn--sm',
  md: 'erp-btn--md',
  lg: 'erp-btn--lg',
} as const

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants
  size?: keyof typeof sizes
  loading?: boolean
}

export const Button = memo(function Button({
  className,
  variant = 'primary',
  size = 'md',
  loading,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  )
})
