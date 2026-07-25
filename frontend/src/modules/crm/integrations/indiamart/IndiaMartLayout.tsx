import { NavLink, Outlet, Navigate, useLocation } from 'react-router-dom'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { canCrmPermission } from '@/utils/permissions'
import { useApiMode } from '@/hooks/useApiMode'

const TABS = [
  { to: '/crm/integrations/indiamart/dashboard', label: 'Dashboard', perm: 'crm.indiamart.view' },
  { to: '/crm/integrations/indiamart/inbox', label: 'Enquiry Inbox', perm: 'crm.indiamart.enquiry.view' },
  { to: '/crm/integrations/indiamart/leads', label: 'Imported Leads', perm: 'crm.indiamart.enquiry.view' },
  { to: '/crm/integrations/indiamart/product-mappings', label: 'Product Mapping', perm: 'crm.indiamart.product_mapping.manage' },
  { to: '/crm/integrations/indiamart/sync-history', label: 'Sync History', perm: 'crm.indiamart.sync_history.view' },
  { to: '/crm/integrations/indiamart/settings', label: 'Settings', perm: 'crm.indiamart.settings.view' },
] as const

export function IndiaMartLayout() {
  const apiMode = useApiMode()
  const location = useLocation()

  if (!apiMode) {
    return (
      <OperationalPageShell
        title="IndiaMART"
        breadcrumbs={[
          { label: 'CRM', to: '/crm' },
          { label: 'Integrations' },
          { label: 'IndiaMART' },
        ]}
      >
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          IndiaMART integration requires API mode (`VITE_USE_API=true`). Demo mode does not sync external enquiries.
        </div>
      </OperationalPageShell>
    )
  }

  if (!canCrmPermission('crm.indiamart.view') && !canCrmPermission('crm.indiamart.enquiry.view')) {
    return <Navigate to="/crm" replace />
  }

  if (location.pathname === '/crm/integrations/indiamart' || location.pathname === '/crm/integrations/indiamart/') {
    return <Navigate to="/crm/integrations/indiamart/dashboard" replace />
  }

  return (
    <OperationalPageShell
      title="IndiaMART Integration"
      breadcrumbs={[
        { label: 'CRM', to: '/crm' },
        { label: 'Integrations' },
        { label: 'IndiaMART' },
      ]}
    >
      <div className="mb-4 flex flex-wrap gap-2 border-b border-erp-border pb-2">
        {TABS.filter((t) => {
          if (t.perm === 'crm.indiamart.product_mapping.manage') {
            return canCrmPermission(t.perm)
          }
          return canCrmPermission(t.perm) || canCrmPermission('crm.indiamart.view')
        }).map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `rounded-md px-3 py-1.5 text-sm font-medium ${
                isActive ? 'bg-erp-primary text-white' : 'text-erp-text hover:bg-erp-surface'
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </div>
      <Outlet />
    </OperationalPageShell>
  )
}
