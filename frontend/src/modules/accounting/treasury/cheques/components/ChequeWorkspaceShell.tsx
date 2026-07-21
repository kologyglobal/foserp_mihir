import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { BankCashWorkspaceTabs } from '@/components/accounting/bankCash'
import { FinanceLegalEntitySwitcher } from '@/modules/accounting/settings/FinanceLegalEntitySwitcher'

export function ChequeWorkspaceShell({
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
      description={description ?? 'Issued, received and post-dated cheques with clearance tracking.'}
      breadcrumbs={[
        { label: 'Accounting', to: '/accounting' },
        { label: 'Bank & Cash', to: '/accounting/bank-cash' },
        ...(pathname !== '/accounting/bank-cash/cheques' ? [{ label: 'Cheques', to: '/accounting/bank-cash/cheques' }] : []),
        ...(pathname !== '/accounting/bank-cash/cheques' ? [{ label: title }] : []),
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
        <BankCashWorkspaceTabs active="cheques" />
        {children}
      </div>
    </OperationalPageShell>
  )
}
