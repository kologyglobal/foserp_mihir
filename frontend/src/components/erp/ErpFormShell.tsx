import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { PageHeader } from '../ui/PageHeader'
import { AppLink } from '../ui/AppLink'
import { Breadcrumbs } from '../ui/Breadcrumbs'
import { ErpValidationSummary } from './ErpValidationSummary'
import { ErpFormFooter } from './ErpFormFooter'
import { cn } from '../../utils/cn'

interface ErpFormShellProps {
  title: string
  subtitle?: string
  backTo: string
  backLabel: string
  onSubmit: (e: React.FormEvent) => void
  isSubmitting?: boolean
  submitLabel?: string
  validationErrors?: string[]
  lockedReason?: string
  footerHint?: ReactNode
  footerActions?: ReactNode
  stickyFooter?: boolean
  breadcrumbs?: { label: string; to?: string }[]
  commandBar?: ReactNode
  children: ReactNode
  className?: string
}

/**
 * Standard ERP form shell:
 * Header → validation → sections → Save/Cancel footer at end of form
 */
export function ErpFormShell({
  title,
  subtitle,
  backTo,
  backLabel,
  onSubmit,
  isSubmitting,
  submitLabel,
  validationErrors,
  lockedReason,
  footerHint,
  footerActions,
  stickyFooter = false,
  breadcrumbs,
  commandBar,
  children,
  className,
}: ErpFormShellProps) {
  const locked = Boolean(lockedReason)

  return (
    <div className={cn('erp-form-shell erp-page', className)}>
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <Breadcrumbs items={breadcrumbs} className="mb-2" />
      ) : (
        <AppLink to={backTo} className="mb-2 inline-flex items-center gap-1.5 text-[13px]">
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </AppLink>
      )}
      <PageHeader title={title} description={subtitle} />
      {commandBar ? <div className="mb-3">{commandBar}</div> : null}
      <form onSubmit={onSubmit} className="erp-form-shell-body mt-4 flex min-h-0 flex-col">
        <ErpValidationSummary errors={validationErrors} lockedReason={lockedReason} className="mb-4" />
        <div
          className={cn(
            'erp-form-shell-content min-h-0 flex-1 space-y-4 overflow-y-auto',
            stickyFooter ? 'erp-form-shell-content--padded pb-28' : 'pb-4',
          )}
        >
          {children}
        </div>
        <ErpFormFooter
          sticky={stickyFooter}
          isSubmitting={isSubmitting}
          submitLabel={submitLabel}
          cancelTo={backTo}
          hint={footerHint}
          actions={footerActions}
          submitDisabled={locked}
          submitDisabledReason={lockedReason}
        />
      </form>
    </div>
  )
}

/** Drawer form — scrollable body + always-visible footer */
export function ErpDrawerFormShell({
  onSubmit,
  isSubmitting,
  submitLabel = 'Save',
  onCancel,
  validationErrors,
  children,
  footerLink,
}: {
  onSubmit: (e: React.FormEvent) => void
  isSubmitting?: boolean
  submitLabel?: string
  onCancel: () => void
  validationErrors?: string[]
  children: ReactNode
  footerLink?: { href: string; label: string; onClick?: () => void }
}) {
  return (
    <form onSubmit={onSubmit} className="erp-drawer-form flex h-full min-h-0 flex-col">
      <ErpValidationSummary errors={validationErrors} className="mb-3 shrink-0" />
      <div className="erp-drawer-form-content min-h-0 flex-1 overflow-y-auto">{children}</div>
      <div className="erp-drawer-form-footer mt-3 shrink-0 space-y-2 border-t border-erp-border bg-erp-surface pt-3">
        {footerLink ? (
          <a
            href={footerLink.href}
            onClick={footerLink.onClick}
            className="block text-[12px] font-semibold text-erp-primary hover:underline"
          >
            {footerLink.label}
          </a>
        ) : null}
        <ErpFormFooter
          sticky={false}
          isSubmitting={isSubmitting}
          submitLabel={submitLabel}
          onCancel={onCancel}
        />
      </div>
    </form>
  )
}
