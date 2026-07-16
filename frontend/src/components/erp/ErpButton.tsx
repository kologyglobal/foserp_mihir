import type { ButtonHTMLAttributes, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '../ui/Button'
import { cn } from '../../utils/cn'

export type ErpButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'danger'
  | 'success'
  | 'warning'
  | 'outline'
  | 'link'
  | 'info'

export type ErpButtonSize = 'sm' | 'md' | 'lg'

const variantMap: Record<
  ErpButtonVariant,
  'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'outline' | 'accent' | 'info'
> = {
  primary: 'primary',
  secondary: 'secondary',
  ghost: 'ghost',
  danger: 'danger',
  success: 'success',
  warning: 'accent',
  outline: 'outline',
  link: 'ghost',
  info: 'info',
}

const sizeMap: Record<ErpButtonSize, 'sm' | 'md' | 'lg'> = {
  sm: 'sm',
  md: 'md',
  lg: 'lg',
}

export interface ErpButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ErpButtonVariant
  size?: ErpButtonSize
  icon?: LucideIcon
  loading?: boolean
  /** Shown when disabled — tooltip via title */
  disabledReason?: string
}

/** Standard ERP button — use instead of raw HTML buttons on core pages */
export function ErpButton({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  loading,
  disabled,
  disabledReason,
  className,
  children,
  title,
  ...props
}: ErpButtonProps) {
  const isDisabled = disabled || loading
  return (
    <Button
      variant={variantMap[variant]}
      size={sizeMap[size]}
      disabled={isDisabled}
      title={isDisabled && disabledReason ? disabledReason : title}
      className={cn(
        variant === 'link' && 'erp-btn--link',
        className,
      )}
      {...props}
    >
      {Icon ? <Icon className="h-4 w-4 shrink-0" /> : null}
      {loading ? 'Please wait…' : children}
    </Button>
  )
}

export function ErpIconButton({
  icon: Icon,
  label,
  variant = 'ghost',
  size = 'sm',
  className,
  ...props
}: ErpButtonProps & { label: string }) {
  return (
    <ErpButton
      variant={variant}
      size={size}
      icon={Icon}
      aria-label={label}
      className={cn('px-2', className)}
      {...props}
    />
  )
}

export function ErpButtonGroup({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-wrap items-center gap-2', className)}>{children}</div>
}
