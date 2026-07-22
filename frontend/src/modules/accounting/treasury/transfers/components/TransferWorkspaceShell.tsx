import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { DynamicsTabs } from '@/components/dynamics/DynamicsTabs'
import { BankCashWorkspaceTabs } from '@/components/accounting/bankCash'
import { FinanceLegalEntitySwitcher } from '@/modules/accounting/settings/FinanceLegalEntitySwitcher'
import { shouldNavigate } from '@/utils/safeState'
import { isApiMode } from '@/config/apiConfig'
import { TRANSFER_LIVE_LINKS } from '../utils/treasuryTransferUi'

export function TransferWorkspaceShell({
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

  const subTabs = isApiMode() ? TRANSFER_LIVE_LINKS.map((l) => ({ label: l.label, path: l.path })) : []

  const activeSubPath =
    subTabs.find((t) => pathname === t.path || pathname.startsWith(`${t.path}/`))?.path ?? '/accounting/bank-cash/transfers'

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title={title}
      description={description ?? 'Internal transfers between bank and cash treasury accounts.'}
      breadcrumbs={[
        { label: 'Accounting', to: '/accounting' },
        { label: 'Bank & Cash', to: '/accounting/bank-cash' },
        ...(pathname !== '/accounting/bank-cash/transfers' ? [{ label: 'Transfers', to: '/accounting/bank-cash/transfers' }] : []),
        ...(pathname !== '/accounting/bank-cash/transfers' ? [{ label: title }] : []),
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
        <BankCashWorkspaceTabs active="fund_transfers" />
        {isApiMode() && subTabs.length > 0 ? (
          <DynamicsTabs
            items={subTabs}
            activePath={activeSubPath}
            onChange={(path) => {
              if (shouldNavigate(pathname, path)) navigate(path)
            }}
          />
        ) : null}
        {children}
      </div>
    </OperationalPageShell>
  )
}
