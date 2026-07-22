import { isApiMode } from '@/config/apiConfig'
import { BankStatementsPage as DemoBankStatementsPage } from '@/modules/accounting/BankStatementsPage'
import { ApiBankStatementListPage } from './BankStatementListPage.api'

/** Route entry — API list when VITE_USE_API=true, else demo page. */
export function BankStatementListPage() {
  if (!isApiMode()) return <DemoBankStatementsPage />
  return <ApiBankStatementListPage />
}
