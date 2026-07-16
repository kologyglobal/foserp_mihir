import { SalesOrderListPage } from '../sales/SalesPages'

/** CRM pipeline view — reuses the proven sales order register with CRM chrome. */
export function CrmSalesOrderListPage() {
  return <SalesOrderListPage crmMode />
}
