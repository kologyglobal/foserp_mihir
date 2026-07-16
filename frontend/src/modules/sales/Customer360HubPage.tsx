import { Outlet } from 'react-router-dom'
import { CrmCustomersPage } from '../crm/CrmEntityPages'
import { salesCustomer360Path } from '../../config/entity360Routes'
import { COMPANY_TERMINOLOGY } from '../../utils/companyLabels'
import { salesModuleBreadcrumbs } from '../../utils/salesNavigation'

/** Nested layout — hub at /sales/customers, detail at /sales/customers/:id/360 */
export function SalesCustomersRouteLayout() {
  return <Outlet />
}

/** Company 360 hub — CRM register UX under Sales module identity. */
export function Customer360HubPage() {
  return (
    <CrmCustomersPage
      hubPath="/sales/customers"
      title={COMPANY_TERMINOLOGY.hub360}
      description="Sales company hub — operations and receivables context (pipeline work stays in CRM → Companies)"
      badge="Sales"
      customer360Path={salesCustomer360Path}
      breadcrumbs={salesModuleBreadcrumbs(COMPANY_TERMINOLOGY.hub360, '/sales/customers')}
      pageGuide={{
        purpose: 'Sales company hub — commercial operations, receivables context, and order history by company. Pipeline and deal work stays in CRM → Companies.',
        nextStep: 'Open Company 360, or jump to CRM for opportunities and quotations.',
      }}
    />
  )
}
