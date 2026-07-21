import { isApiMode } from '@/config/apiConfig'
import { FundTransfersPage as DemoFundTransfersPage } from '@/modules/accounting/FundTransfersPage'
import { ApiTransferListPage } from './ApiTransferListPage'

/** Route entry — API transfer list when VITE_USE_API=true, else demo Fund Transfers page. */
export function TransferListPage() {
  if (!isApiMode()) return <DemoFundTransfersPage />
  return <ApiTransferListPage />
}
