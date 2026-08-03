import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/utils/cn'

export interface HrApprovalDrawerField {
  label: string
  value: ReactNode
}

interface HrApprovalDrawerProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  /** Who / what / how much / why — rendered as a compact 2-col grid above children. */
  fields?: HrApprovalDrawerField[]
  /** Extra body content below fields — editable inputs, impact preview, timeline, etc. */
  children?: ReactNode
  onApprove?: () => void | Promise<void>
  onReject?: () => void | Promise<void>
  approveLabel?: string
  rejectLabel?: string
  approveDisabled?: boolean
  busy?: boolean
  /** Fully custom footer — overrides the default Approve/Reject buttons. */
  footer?: ReactNode
  className?: string
}

/**
 * Standard HR approval side-drawer — who/what/how much/why + impact preview, with
 * Approve/Reject actions. Also usable as a plain read-only detail drawer by omitting
 * onApprove/onReject (e.g. attendance day details).
 */
export function HrApprovalDrawer({
  open,
  onClose,
  title,
  subtitle,
  fields,
  children,
  onApprove,
  onReject,
  approveLabel = 'Approve',
  rejectLabel = 'Reject',
  approveDisabled = false,
  busy = false,
  footer,
  className,
}: HrApprovalDrawerProps) {
  if (!open) return null

  return (
    <div className="hr-approval-drawer-root" role="presentation">
      <button type="button" className="hr-approval-drawer__backdrop" onClick={onClose} aria-label="Close drawer" />
      <aside className={cn('hr-approval-drawer', className)} role="dialog" aria-modal="true">
        <div className="hr-approval-drawer__header">
          <div className="min-w-0">
            <div className="hr-approval-drawer__title">{title}</div>
            {subtitle ? <div className="hr-approval-drawer__subtitle">{subtitle}</div> : null}
          </div>
          <button type="button" className="hr-approval-drawer__close" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="hr-approval-drawer__body">
          {fields && fields.length > 0 ? (
            <div className="hr-approval-drawer__fields">
              {fields.map((f, idx) => (
                <div key={`${f.label}-${idx}`} className="hr-approval-drawer__field">
                  <div className="hr-approval-drawer__field-label">{f.label}</div>
                  <div className="hr-approval-drawer__field-value">{f.value ?? '—'}</div>
                </div>
              ))}
            </div>
          ) : null}
          {children}
        </div>

        <div className="hr-approval-drawer__footer">
          {footer ??
            (onApprove || onReject ? (
              <>
                {onApprove ? (
                  <button
                    type="button"
                    className="btn btn--primary"
                    disabled={approveDisabled || busy}
                    onClick={() => void onApprove()}
                  >
                    {busy ? 'Working…' : approveLabel}
                  </button>
                ) : null}
                {onReject ? (
                  <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => void onReject()}>
                    {rejectLabel}
                  </button>
                ) : null}
              </>
            ) : (
              <button type="button" className="btn btn--ghost" onClick={onClose}>
                Close
              </button>
            ))}
        </div>
      </aside>
    </div>
  )
}
