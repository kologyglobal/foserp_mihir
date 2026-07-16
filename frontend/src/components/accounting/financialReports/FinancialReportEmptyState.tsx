import type { ReactNode } from 'react'
import { AlertCircle, BarChart3, FileSearch, RefreshCw } from 'lucide-react'
import { LoadingState } from '@/design-system/components/LoadingState'
import { cn } from '@/utils/cn'
import { FinancialReportEmptyState } from './FinancialReportsSummaryCards'

export function FinancialReportLoadingState({
  variant = 'table',
  rows = 8,
  className,
}: {
  variant?: 'table' | 'card' | 'dashboard'
  rows?: number
  className?: string
}) {
  return <LoadingState variant={variant} rows={rows} className={className} />
}

export function FinancialReportErrorState({
  title = 'Unable to load report',
  description,
  onRetry,
  className,
}: {
  title?: string
  description?: string
  onRetry?: () => void
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 px-6 py-16 text-center', className)}>
      <AlertCircle className="h-10 w-10 text-rose-500" strokeWidth={1.5} />
      <p className="text-[15px] font-semibold text-erp-text">{title}</p>
      {description ? <p className="max-w-md text-[13px] text-erp-muted">{description}</p> : null}
      {onRetry ? (
        <button
          type="button"
          className="erp-btn erp-btn-secondary mt-2 inline-flex h-9 items-center gap-2 px-4 text-[12px] font-semibold"
          onClick={onRetry}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </button>
      ) : null}
    </div>
  )
}

export function FinancialReportNoDataState({
  title = 'No data for this period',
  description = 'Adjust filters or include zero-balance accounts, then apply again.',
  actions,
}: {
  title?: string
  description?: string
  actions?: ReactNode
  className?: string
}) {
  return (
    <FinancialReportEmptyState
      title={title}
      description={description}
      actions={actions}
    />
  )
}

export function FinancialReportAccessDeniedState({
  className,
}: {
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 px-6 py-16 text-center', className)}>
      <FileSearch className="h-10 w-10 text-erp-muted" strokeWidth={1.5} />
      <p className="text-[15px] font-semibold text-erp-text">Access denied</p>
      <p className="max-w-md text-[13px] text-erp-muted">
        You do not have permission to view this financial report.
      </p>
    </div>
  )
}

export function FinancialReportDemoBanner({
  message = 'Demo financial reports — figures are illustrative and not statutory filings.',
  className,
}: {
  message?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900',
        className,
      )}
      role="status"
    >
      <BarChart3 className="h-4 w-4 shrink-0 text-amber-600" />
      <span>{message}</span>
    </div>
  )
}

/** @deprecated Use FinancialReportEmptyState — kept for PayableEmptyState-style naming parity */
export { FinancialReportEmptyState }
