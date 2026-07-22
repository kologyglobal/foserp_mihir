import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { BankCashWorkspaceTabs } from '@/components/accounting/bankCash'
import { FinanceLegalEntitySwitcher } from '@/modules/accounting/settings/FinanceLegalEntitySwitcher'

export function AdjustmentWorkspaceShell({
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
  const { pathname } = useLocation()

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title={title}
      description={description ?? 'Bank charges, interest, fees and other non-transfer treasury bank transactions posted to the GL.'}
      breadcrumbs={[
        { label: 'Accounting', to: '/accounting' },
        { label: 'Bank & Cash', to: '/accounting/bank-cash' },
        ...(pathname !== '/accounting/bank-cash/treasury-adjustments'
          ? [{ label: 'Bank Transactions', to: '/accounting/bank-cash/treasury-adjustments' }]
          : []),
        ...(pathname !== '/accounting/bank-cash/treasury-adjustments' ? [{ label: title }] : []),
      ]}
      autoBreadcrumbs={false}
      favoritePath={pathname}
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
        <BankCashWorkspaceTabs active="treasury_adjustments" />
        {children}
      </div>
    </OperationalPageShell>
  )
}
