import { useEffect, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { DynamicsTabs } from '@/components/dynamics/DynamicsTabs'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'
import { FinanceLegalEntitySwitcher } from '@/modules/accounting/settings/FinanceLegalEntitySwitcher'
import { cn } from '@/utils/cn'
import { shouldNavigate } from '@/utils/safeState'
import { MONEY_IN_WORKSPACE_TABS } from './moneyInUi'

export function MoneyInWorkspaceShell({
  title,
  description,
  children,
  actions,
  commandBar,
  kpiStrip,
  contentClassName,
}: {
  title: string
  description?: string
  children: ReactNode
  actions?: ReactNode
  commandBar?: ReactNode
  kpiStrip?: EnterpriseKpiItem[]
  /** Override the default bordered content panel (e.g. flush register tables). */
  contentClassName?: string
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
        : pathname.startsWith(`${arBase}/corrections`)
          ? `${arBase}/corrections`
          : MONEY_IN_WORKSPACE_TABS.map((t) => ({
            ...t,
            path: t.path.replace('/accounting/money-in', arBase),
          })).find(
            (t) =>
              t.path !== `${arBase}/invoices` &&
              t.path !== `${arBase}/receipts` &&
              t.path !== `${arBase}/credit-notes` &&
              t.path !== `${arBase}/corrections` &&
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
      kpiStrip={kpiStrip}
      actions={
        <>
          <FinanceLegalEntitySwitcher />
          {actions}
        </>
      }
      mergeHeaderWithWorkspace
    >
      <div className="flex flex-col gap-3">
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
        <div className={cn('min-w-0 rounded border border-erp-border bg-white p-3', contentClassName)}>
          {children}
        </div>
      </div>
    </OperationalPageShell>
  )
}
