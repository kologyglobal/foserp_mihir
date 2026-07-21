import { useEffect, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { DynamicsTabs } from '@/components/dynamics/DynamicsTabs'
import { FinanceLegalEntitySwitcher } from '@/modules/accounting/settings/FinanceLegalEntitySwitcher'
import { shouldNavigate } from '@/utils/safeState'
import { MONEY_IN_WORKSPACE_TABS } from './moneyInUi'

export function MoneyInWorkspaceShell({
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

  const activePath = pathname.startsWith('/accounting/money-in/invoices')
    ? '/accounting/money-in/invoices'
    : pathname.startsWith('/accounting/money-in/receipts')
      ? '/accounting/money-in/receipts'
      : pathname.startsWith('/accounting/money-in/credit-notes')
        ? '/accounting/money-in/credit-notes'
        : MONEY_IN_WORKSPACE_TABS.find(
            (t) =>
              t.path !== '/accounting/money-in/invoices' &&
              t.path !== '/accounting/money-in/receipts' &&
              t.path !== '/accounting/money-in/credit-notes' &&
              (pathname === t.path || pathname.startsWith(`${t.path}/`)),
          )?.path ?? '/accounting/money-in'

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [activePath])

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title={title}
      description={
        description ??
        'Sales invoices, receipts, credit notes, outstanding receivables, ageing, and AR-to-GL reconciliation.'
      }
      breadcrumbs={[
        { label: 'Accounting', to: '/accounting' },
        { label: 'Money In', to: '/accounting/money-in' },
        ...(pathname !== '/accounting/money-in' ? [{ label: title }] : []),
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
          items={[...MONEY_IN_WORKSPACE_TABS]}
          activePath={activePath}
          onChange={(path) => {
            if (shouldNavigate(pathname, path)) navigate(path)
          }}
        />
        <div className="min-w-0 rounded border border-erp-border bg-white p-3">{children}</div>
        <p className="text-[11px] text-erp-muted px-1">
          Receipts — available · Credit Notes — available
        </p>
      </div>
    </OperationalPageShell>
  )
}
