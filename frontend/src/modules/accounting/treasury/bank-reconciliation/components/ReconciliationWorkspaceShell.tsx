import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { DynamicsTabs } from '@/components/dynamics/DynamicsTabs'
import { BankCashWorkspaceTabs } from '@/components/accounting/bankCash'
import { FinanceLegalEntitySwitcher } from '@/modules/accounting/settings/FinanceLegalEntitySwitcher'
import { shouldNavigate } from '@/utils/safeState'
import { RECONCILIATION_LIVE_LINKS } from '../utils/bankReconciliationUi'

/** Workspace shell for the bank reconciliation module (sessions / workspace / history / exceptions). */
export function ReconciliationWorkspaceShell({
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

  const activeSubPath =
    RECONCILIATION_LIVE_LINKS.find((l) => pathname === l.path || pathname.startsWith(`${l.path}/`))?.path ??
    '/accounting/bank-cash/reconciliation'

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title={title}
      description={description ?? 'Match bank statement lines against ledger entries, review suggestions, and finalize reconciliation periods.'}
      breadcrumbs={[
        { label: 'Accounting', to: '/accounting' },
        { label: 'Bank & Cash', to: '/accounting/bank-cash' },
        { label: 'Bank Reconciliation', to: '/accounting/bank-cash/reconciliation' },
        ...(pathname !== '/accounting/bank-cash/reconciliation' ? [{ label: title }] : []),
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
        <BankCashWorkspaceTabs active="reconciliation" />
        <DynamicsTabs
          items={RECONCILIATION_LIVE_LINKS.map((l) => ({ label: l.label, path: l.path }))}
          activePath={activeSubPath}
          onChange={(path) => {
            if (shouldNavigate(pathname, path)) navigate(path)
          }}
        />
        {children}
      </div>
    </OperationalPageShell>
  )
}
