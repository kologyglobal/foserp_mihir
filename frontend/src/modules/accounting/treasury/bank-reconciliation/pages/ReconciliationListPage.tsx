import { isApiMode } from '@/config/apiConfig'
import { BankReconciliationPage as DemoBankReconciliationPage } from '@/modules/accounting/BankReconciliationPage'
import { ApiReconciliationListPage } from './ReconciliationListPage.api'

/** Route entry — API session list when VITE_USE_API=true, else demo Bank & Cash reconciliation page. */
export function ReconciliationListPage() {
  if (!isApiMode()) return <DemoBankReconciliationPage />
  return <ApiReconciliationListPage />
}
