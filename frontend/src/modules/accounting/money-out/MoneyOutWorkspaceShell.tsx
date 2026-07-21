import { useEffect, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { DynamicsTabs } from '@/components/dynamics/DynamicsTabs'
import { FinanceLegalEntitySwitcher } from '@/modules/accounting/settings/FinanceLegalEntitySwitcher'
import { shouldNavigate } from '@/utils/safeState'
import { MONEY_OUT_WORKSPACE_TABS } from './moneyOutUi'

export function MoneyOutWorkspaceShell({
  title,
  description,
  children,
  actions,
  commandBar,
}: {
  title: string
  description?: string
  children: ReactNode
  actions?: ReactNode
  commandBar?: ReactNode
}) {
  const { pathname, search } = useLocation()
  const navigate = useNavigate()

  const activePath = pathname.startsWith('/accounting/money-out/vendor-invoices')
    ? '/accounting/money-out/vendor-invoices'
    : pathname.startsWith('/accounting/money-out/vendor-payments')
      ? '/accounting/money-out/vendor-payments'
      : pathname.startsWith('/accounting/money-out/vendor-advances')
        ? '/accounting/money-out/vendor-advances'
        : pathname.startsWith('/accounting/money-out/vendor-adjustments')
          ? '/accounting/money-out/vendor-adjustments'
            : pathname.startsWith('/accounting/money-out/corrections') ||
              pathname.startsWith('/accounting/money-out/reversals')
            ? '/accounting/money-out/corrections'
            : pathname.startsWith('/accounting/money-out/reconciliation')
              ? '/accounting/money-out/reconciliation'
              : pathname.startsWith('/accounting/money-out/close-gate')
                ? '/accounting/money-out/close-gate'
                : pathname.startsWith('/accounting/money-out/allocations')
          ? '/accounting/money-out/vendor-payments'
          : pathname.startsWith('/accounting/money-out/payables')
            ? '/accounting/money-out/payables'
            : pathname.startsWith('/accounting/money-out/outstanding')
              ? '/accounting/money-out/outstanding'
              : pathname.startsWith('/accounting/money-out/vendors')
                ? '/accounting/money-out/vendors'
                : pathname.startsWith('/accounting/money-out/ageing')
                  ? '/accounting/money-out/ageing'
                  : pathname.startsWith('/accounting/money-out/payment-planning')
                    ? '/accounting/money-out/payment-planning'
                    : pathname.startsWith('/accounting/money-out/approvals')
              ? '/accounting/money-out/approvals'
              : MONEY_OUT_WORKSPACE_TABS.find(
                  (t) => pathname === t.path || pathname.startsWith(`${t.path}/`),
                )?.path ?? '/accounting/money-out'

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [activePath])

  const liveTabs = MONEY_OUT_WORKSPACE_TABS.filter((t) => !('preview' in t && t.preview)).map((t) => ({
    label: t.label,
    path: t.path,
  }))

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title={title}
      description={
        description ??
        'Vendor invoices, payments, advances, payables reporting, approvals, corrections, AP-to-GL reconciliation, and close-gate readiness.'
      }
      breadcrumbs={[
        { label: 'Accounting', to: '/accounting' },
        { label: 'Money Out', to: '/accounting/money-out' },
        ...(pathname !== '/accounting/money-out' ? [{ label: title }] : []),
      ]}
      autoBreadcrumbs={false}
      favoritePath={`${pathname}${search}`}
      commandBar={commandBar}
      actions={
        <>
          <FinanceLegalEntitySwitcher />
          {actions}
        </>
      }
      mergeHeaderWithWorkspace
    >
      <div className="flex flex-col gap-2">
        <DynamicsTabs
          items={liveTabs}
          activePath={activePath}
          onChange={(path) => {
            if (shouldNavigate(pathname, path)) navigate(path)
          }}
        />
        <div className="min-w-0 rounded border border-erp-border bg-white p-3">{children}</div>
        <p className="px-1 text-[11px] text-erp-muted">
          Vendor Invoices · Vendor Payments · Vendor Advances · Vendor Adjustments · Payables · Outstanding · Vendors ·
          Ageing · Payment Planning · Approvals · Corrections · Reconciliation · Close Gate — available
        </p>
      </div>
    </OperationalPageShell>
  )
}
