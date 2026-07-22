import { isApiMode } from '@/config/apiConfig'
import { ChequeManagementPage as DemoChequeManagementPage } from '@/modules/accounting/ChequeManagementPage'
import { ApiChequeListPage } from './ApiChequeListPage'

/** Route entry — API cheque list when VITE_USE_API=true, else demo Cheque Management page. */
export function ChequeListPage() {
  if (!isApiMode()) return <DemoChequeManagementPage />
  return <ApiChequeListPage />
}
