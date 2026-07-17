import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { DynamicsTabs } from '@/components/dynamics/DynamicsTabs'
import { FinanceLegalEntitySwitcher } from '@/modules/accounting/settings/FinanceLegalEntitySwitcher'
import { shouldNavigate } from '@/utils/safeState'

const TABS = [
  { label: 'Journals', path: '/accounting/entries/journals' },
  { label: 'All Entries', path: '/accounting/ledger-entries' },
  { label: 'Approvals', path: '/accounting/entries/journals?tab=approvals' },
  { label: 'General Ledger', path: '/accounting/ledger-entries' },
]

export function JournalsWorkspaceShell({
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
  const activePath = pathname.startsWith('/accounting/entries/journals')
    ? '/accounting/entries/journals'
    : pathname

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title={title}
      description={description ?? 'Create, validate, and submit manual journal entries — draft workflow only (no posting in this phase).'}
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
            if (path.includes('?tab=approvals')) {
              navigate('/accounting/entries/journals')
              return
            }
            if (shouldNavigate(pathname, path)) navigate(path)
          }}
        />
        {search.includes('tab=approvals') ? (
          <div className="rounded border border-amber-200 bg-amber-50 p-4 text-[13px] text-amber-900">
            Journal approvals will be available in the next phase. Submitted journals route to approval status only — no approve/reject actions yet.
          </div>
        ) : null}
        <div className="min-w-0 rounded border border-erp-border bg-white p-3">{children}</div>
      </div>
    </OperationalPageShell>
  )
}
