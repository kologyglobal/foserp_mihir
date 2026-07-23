import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { BankCashWorkspaceTabs } from '@/components/accounting/bankCash'
import { FinanceLegalEntitySwitcher } from '@/modules/accounting/settings/FinanceLegalEntitySwitcher'

export function BookWorkspaceShell({
  kind,
  title,
  description,
  children,
  actions,
}: {
  kind: 'bank' | 'cash'
  title: string
  description?: string
  children: ReactNode
  actions?: ReactNode
}) {
  const { pathname } = useLocation()

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title={title}
      description={
        description ?? (kind === 'bank' ? 'Chronological bank account ledger with running balance.' : 'Chronological cash account ledger with running balance.')
      }
      breadcrumbs={[
        { label: 'Accounting', to: '/accounting' },
        { label: 'Bank & Cash', to: '/accounting/bank-cash' },
        { label: title },
      ]}
      autoBreadcrumbs={false}
      favoritePath={pathname}
      actions={
        <>
          <FinanceLegalEntitySwitcher />
          {actions}
        </>
      }
      mergeHeaderWithWorkspace
    >
      <div className="flex flex-col gap-2">
        <BankCashWorkspaceTabs active={kind === 'bank' ? 'bank_book' : 'cashbook'} />
        {children}
      </div>
    </OperationalPageShell>
  )
}
