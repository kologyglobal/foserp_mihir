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

  const arBase = pathname.startsWith('/accounting/receivables') ? '/accounting/receivables' : '/accounting/money-in'

  const activePath = pathname.startsWith(`${arBase}/invoices`)
    ? `${arBase}/invoices`
    : pathname.startsWith(`${arBase}/receipts`)
      ? `${arBase}/receipts`
      : pathname.startsWith(`${arBase}/credit-notes`)
        ? `${arBase}/credit-notes`
        : MONEY_IN_WORKSPACE_TABS.map((t) => ({
            ...t,
            path: t.path.replace('/accounting/money-in', arBase),
          })).find(
            (t) =>
              t.path !== `${arBase}/invoices` &&
              t.path !== `${arBase}/receipts` &&
              t.path !== `${arBase}/credit-notes` &&
              (pathname === t.path || pathname.startsWith(`${t.path}/`)),
          )?.path ?? arBase

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
          items={MONEY_IN_WORKSPACE_TABS.map((t) => ({
            ...t,
            path: t.path.replace('/accounting/money-in', arBase),
          }))}
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
