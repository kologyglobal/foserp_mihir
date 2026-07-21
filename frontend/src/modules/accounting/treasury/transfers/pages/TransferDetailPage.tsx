import { isApiMode } from '@/config/apiConfig'
import { FundTransferDetailPage as DemoFundTransferDetailPage } from '@/modules/accounting/FundTransferEditorPage'
import { ApiTransferDetailPage } from './ApiTransferDetailPage'

/** Route entry — API transfer detail when VITE_USE_API=true, else demo Fund Transfer detail. */
export function TransferDetailPage() {
  if (!isApiMode()) return <DemoFundTransferDetailPage />
  return <ApiTransferDetailPage />
}
