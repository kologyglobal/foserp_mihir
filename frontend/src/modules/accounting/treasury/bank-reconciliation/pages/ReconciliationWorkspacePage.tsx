import { isApiMode } from '@/config/apiConfig'
import { BankReconciliationWorkbenchPage as DemoBankReconciliationWorkbenchPage } from '@/modules/accounting/BankReconciliationWorkbenchPage'
import { ApiReconciliationWorkspacePage } from './ReconciliationWorkspacePage.api'

/** Route entry for `/accounting/bank-cash/reconciliation/:statementId` — statement-scoped workspace in API mode, demo workbench otherwise. */
export function ReconciliationWorkspacePage() {
  if (!isApiMode()) return <DemoBankReconciliationWorkbenchPage />
  return <ApiReconciliationWorkspacePage />
}
