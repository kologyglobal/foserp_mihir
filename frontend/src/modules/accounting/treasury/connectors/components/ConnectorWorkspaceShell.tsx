import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { BankCashWorkspaceTabs } from '@/components/accounting/bankCash'
import { FinanceLegalEntitySwitcher } from '@/modules/accounting/settings/FinanceLegalEntitySwitcher'

export function ConnectorWorkspaceShell({
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
      description={
        description ??
        'Bank connectors: sandbox FS, allow-listed REST, and live SFTP import MT940/CAMT as BANK_API. Open Banking consent only — AIS pull, FX, and intercompany remain deferred.'
      }
      breadcrumbs={[
        { label: 'Accounting', to: '/accounting' },
        { label: 'Bank & Cash', to: '/accounting/bank-cash' },
        { label: 'Bank connectors' },
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
        <BankCashWorkspaceTabs active="bank_connectors" />
        {children}
      </div>
    </OperationalPageShell>
  )
}
