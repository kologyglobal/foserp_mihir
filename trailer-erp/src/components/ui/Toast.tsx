import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'
import { cn } from '../../utils/cn'
import type { ToastVariant } from '../../store/toastStore'

interface ToastProps {
  message: string | null
  variant?: ToastVariant
  onDismiss?: () => void
  /** When true (default), pin to top-right — set false inside ToastHost stack */
  floating?: boolean
}

const VARIANT_STYLES: Record<ToastVariant, string> = {
  success: 'border-green-200 bg-green-50 text-green-900',
  error: 'border-red-200 bg-red-50 text-red-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-950',
  info: 'border-erp-border bg-erp-surface text-erp-text',
}

export function Toast({ message, variant = 'info', onDismiss, floating = true }: ToastProps) {
  if (!message) return null
  const Icon =
    variant === 'success' ? CheckCircle2 : variant === 'error' ? XCircle : variant === 'warning' ? AlertTriangle : Info
  return (
    <div
      className={cn(
        'flex max-w-sm items-start gap-2.5 rounded-lg border px-4 py-3 shadow-erp-md',
        floating && 'fixed top-4 right-4 z-[100] sm:top-5 sm:right-5',
        VARIANT_STYLES[variant],
      )}
      role="status"
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <p className="flex-1 text-[13px] font-medium">{message}</p>
      {onDismiss ? (
        <button
          type="button"
          className="shrink-0 rounded p-0.5 opacity-60 hover:opacity-100"
          onClick={onDismiss}
          aria-label="Dismiss"
        >
          ×
        </button>
      ) : null}
    </div>
  )
}
