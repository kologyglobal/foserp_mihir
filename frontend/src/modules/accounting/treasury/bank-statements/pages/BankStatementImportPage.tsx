import { isApiMode } from '@/config/apiConfig'
import { BankStatementImportPage as DemoImportPage } from '@/modules/accounting/BankStatementImportPage'
import { ApiBankStatementImportPage } from './BankStatementImportPage.api'

export function BankStatementImportPage() {
  if (!isApiMode()) return <DemoImportPage />
  return <ApiBankStatementImportPage />
}
