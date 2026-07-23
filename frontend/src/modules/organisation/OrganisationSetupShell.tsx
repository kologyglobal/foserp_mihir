import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { DynamicsTabs } from '@/components/dynamics/DynamicsTabs'
import {
  ORGANISATION_SETUP_WORKSPACE_TABS,
  findOrganisationSetupNavItem,
  organisationSetupBreadcrumbs,
  organisationSetupNavIsActive,
} from '@/config/organisationSetupNav'
import { FinanceLegalEntitySwitcher } from '@/modules/accounting/settings/FinanceLegalEntitySwitcher'
import { shouldNavigate } from '@/utils/safeState'

export function OrganisationSetupShell({
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
  const active = findOrganisationSetupNavItem(pathname)
  const pageTitle = title ?? active?.label ?? 'Organisation Setup'

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Settings"
      title={pageTitle}
      description={description ?? 'Company legal entity, tax registrations, accounts, and fiscal calendar.'}
      breadcrumbs={organisationSetupBreadcrumbs(pathname)}
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
          items={ORGANISATION_SETUP_WORKSPACE_TABS.map((t) => ({
            label: t.label,
            path: t.path,
          }))}
          activePath={
            ORGANISATION_SETUP_WORKSPACE_TABS.find((t) => organisationSetupNavIsActive(pathname, t))?.path ??
            pathname
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
