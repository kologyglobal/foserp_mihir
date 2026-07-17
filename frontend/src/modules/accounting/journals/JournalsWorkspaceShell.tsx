import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { DynamicsTabs } from '@/components/dynamics/DynamicsTabs'
import { FinanceLegalEntitySwitcher } from '@/modules/accounting/settings/FinanceLegalEntitySwitcher'
import { shouldNavigate } from '@/utils/safeState'

const TABS = [
  { label: 'Journals', path: '/accounting/entries/journals' },
  { label: 'All Entries', path: '/accounting/ledger-entries' },
  { label: 'Approvals', path: '/accounting/entries/approvals' },
  { label: 'General Ledger', path: '/accounting/ledger-entries' },
]

export function JournalsWorkspaceShell({
  title,
  description,
  children,
  actions,
  commandBar,
  activeTab,
}: {
  title: string
  description?: string
  children: ReactNode
  actions?: ReactNode
  commandBar?: ReactNode
  activeTab?: 'journals' | 'approvals'
}) {
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  const activePath =
    activeTab === 'approvals' || pathname.startsWith('/accounting/entries/approvals')
      ? '/accounting/entries/approvals'
      : pathname.startsWith('/accounting/entries/journals')
        ? '/accounting/entries/journals'
        : pathname

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title={title}
      description={
        description ??
        'Create, validate, submit, and approve manual journal entries — posting is deferred to Phase 2C2B.'
      }
      breadcrumbs={[
        { label: 'Accounting', to: '/accounting' },
        { label: 'Entries', to: '/accounting/entries/journals' },
        { label: title },
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
          items={TABS}
          activePath={activePath}
          onChange={(path) => {
            if (shouldNavigate(pathname, path)) navigate(path)
          }}
        />
        <div className="min-w-0 rounded border border-erp-border bg-white p-3">{children}</div>
      </div>
    </OperationalPageShell>
  )
}
