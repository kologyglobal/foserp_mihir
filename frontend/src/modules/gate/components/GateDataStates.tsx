import type { LucideIcon } from 'lucide-react'
import { AlertTriangle, Inbox } from 'lucide-react'
import type { ReactNode } from 'react'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { ErpButton } from '@/components/erp/ErpButton'

export type GateLoadState = 'loading' | 'ready' | 'empty' | 'error'

/**
 * Standard loading / empty / error wrapper for gate pages.
 * In API mode a failure renders the error state with retry — never demo data.
 */
export function GateDataStates({
  state,
  error,
  onRetry,
  emptyTitle = 'Nothing to show',
  emptyDescription,
  emptyIcon = Inbox,
  emptyAction,
  loadingVariant = 'table',
  children,
}: {
  state: GateLoadState
  error?: string
  onRetry?: () => void
  emptyTitle?: string
  emptyDescription?: string
  emptyIcon?: LucideIcon
  emptyAction?: ReactNode
  loadingVariant?: 'table' | 'card' | 'form' | 'dashboard'
  children: ReactNode
}) {
  if (state === 'loading') return <LoadingState variant={loadingVariant} />
  if (state === 'error') {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Could not load gate data"
        description={error || 'An unexpected error occurred while contacting the server.'}
        action={
          onRetry ? (
            <ErpButton size="sm" variant="secondary" onClick={onRetry}>
              Retry
            </ErpButton>
          ) : undefined
        }
      />
    )
  }
  if (state === 'empty') {
    return <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} action={emptyAction} />
  }
  return <>{children}</>
}
