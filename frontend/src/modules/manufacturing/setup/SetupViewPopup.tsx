import type { ReactNode } from 'react'
import { AccountDrawerShell } from '@/components/accounting/coa/AccountDrawerShell'
import { ErpButton } from '@/components/erp/ErpButton'
import { cn } from '@/utils/cn'

export type SetupViewField = {
  label: string
  value: ReactNode
  mono?: boolean
  fullWidth?: boolean
}

/**
 * Read-only centered popup for Manufacturing Setup registers (View action).
 */
export function SetupViewPopup({
  open,
  onClose,
  title,
  subtitle,
  fields,
  footerExtra,
  widthClassName = 'max-w-lg',
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  fields: SetupViewField[]
  /** Extra footer actions before Close (e.g. Edit). */
  footerExtra?: ReactNode
  widthClassName?: string
}) {
  return (
    <AccountDrawerShell
      open={open}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      eyebrow="Manufacturing Setup"
      widthClassName={widthClassName}
      footer={
        <div className="flex justify-end gap-2">
          {footerExtra}
          <ErpButton variant="outline" onClick={onClose}>
            Close
          </ErpButton>
        </div>
      }
    >
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {fields.map((field) => (
          <div
            key={field.label}
            className={cn(
              'rounded-md border border-erp-border bg-erp-surface-alt/40 px-3 py-2.5',
              field.fullWidth && 'sm:col-span-2',
            )}
          >
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-erp-muted">{field.label}</dt>
            <dd
              className={cn(
                'mt-1 break-words text-[13px] font-medium text-erp-text',
                field.mono && 'font-mono text-[12px]',
              )}
            >
              {field.value == null || field.value === '' ? '—' : field.value}
            </dd>
          </div>
        ))}
      </dl>
    </AccountDrawerShell>
  )
}
