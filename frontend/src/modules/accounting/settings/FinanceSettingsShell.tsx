import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { DynamicsTabs } from '@/components/dynamics/DynamicsTabs'
import {
  FINANCE_SETTINGS_WORKSPACE_TABS,
  financeSettingsBreadcrumbs,
  findFinanceSettingsNavItem,
  financeSettingsNavIsActive,
} from '@/config/financeSettingsNav'
import { shouldNavigate } from '@/utils/safeState'
import { FinanceLegalEntitySwitcher } from './FinanceLegalEntitySwitcher'

export function FinanceSettingsShell({
  title,
  description,
  children,
  commandBar,
  actions,
}: {
  title?: string
  description?: string
  children: ReactNode
  commandBar?: ReactNode
  actions?: ReactNode
}) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const active = findFinanceSettingsNavItem(pathname)
  const pageTitle = title ?? active?.label ?? 'Finance Setup'

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title={pageTitle}
      description={description ?? 'Set up your company accounts, periods, and posting defaults.'}
      breadcrumbs={financeSettingsBreadcrumbs(pathname)}
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
        <DynamicsTabs
          items={FINANCE_SETTINGS_WORKSPACE_TABS.map((t) => ({
            label: t.label,
            path: t.path,
            group: t.group,
          }))}
          activePath={
            FINANCE_SETTINGS_WORKSPACE_TABS.find((t) => financeSettingsNavIsActive(pathname, t))?.path ?? pathname
          }
          onChange={(path) => {
            if (shouldNavigate(pathname, path)) navigate(path)
          }}
        />
        <div className="min-w-0 rounded border border-erp-border bg-white p-3">{children}</div>
      </div>
    </OperationalPageShell>
  )
}

/** @deprecated Use per-page FinanceSettingsShell wrapper instead of layout route. */
export function FinanceSettingsLayout({ children }: { children: ReactNode }) {
  return <FinanceSettingsShell>{children}</FinanceSettingsShell>
}
