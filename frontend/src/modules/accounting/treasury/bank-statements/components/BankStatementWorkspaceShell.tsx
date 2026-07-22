import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { DynamicsTabs } from '@/components/dynamics/DynamicsTabs'
import { BankCashWorkspaceTabs } from '@/components/accounting/bankCash'
import { FinanceLegalEntitySwitcher } from '@/modules/accounting/settings/FinanceLegalEntitySwitcher'
import { shouldNavigate } from '@/utils/safeState'
import { isApiMode } from '@/config/apiConfig'
import { BANK_STATEMENT_LIVE_LINKS } from '../utils/bankStatementUi'
import type { BankCashWorkspaceTab } from '@/types/bankCash'

export function BankStatementWorkspaceShell({
  title,
  description,
  children,
  actions,
  commandBar,
  workspaceTab = 'statements',
}: {
  title: string
  description?: string
  children: ReactNode
  actions?: ReactNode
  commandBar?: ReactNode
  workspaceTab?: BankCashWorkspaceTab
}) {
  const { pathname, search } = useLocation()
  const navigate = useNavigate()

  const subTabs = isApiMode()
    ? BANK_STATEMENT_LIVE_LINKS.map((l) => ({ label: l.label, path: l.path }))
    : []

  const activeSubPath =
    subTabs.find((t) => pathname === t.path || pathname.startsWith(`${t.path}/`))?.path ??
    '/accounting/bank-cash/statements'

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title={title}
      description={description ?? 'Import, validate, and manage bank statements against treasury accounts.'}
      breadcrumbs={[
        { label: 'Accounting', to: '/accounting' },
        { label: 'Bank & Cash', to: '/accounting/bank-cash' },
        ...(pathname.startsWith('/accounting/bank-cash/statements') ||
        pathname.startsWith('/accounting/bank-cash/mapping-templates') ||
        pathname.startsWith('/accounting/bank-cash/import-batches')
          ? [{ label: 'Bank Statements', to: '/accounting/bank-cash/statements' }]
          : []),
        ...(pathname !== '/accounting/bank-cash/statements' ? [{ label: title }] : []),
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
        <BankCashWorkspaceTabs active={workspaceTab} />
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
