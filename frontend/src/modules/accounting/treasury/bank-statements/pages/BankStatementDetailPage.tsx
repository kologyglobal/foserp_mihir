import { isApiMode } from '@/config/apiConfig'
import { BankStatementDetailPage as DemoDetailPage } from '@/modules/accounting/BankStatementDetailPage'
import { ApiBankStatementDetailPage } from './BankStatementDetailPage.api'

export function BankStatementDetailPage() {
  if (!isApiMode()) return <DemoDetailPage />
  return <ApiBankStatementDetailPage />
}
