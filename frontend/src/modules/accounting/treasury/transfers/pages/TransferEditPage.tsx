import { isApiMode } from '@/config/apiConfig'
import { FundTransferDetailPage as DemoFundTransferDetailPage } from '@/modules/accounting/FundTransferEditorPage'
import { ApiTransferEditPage } from './ApiTransferEditPage'

/** Route entry — API edit form when VITE_USE_API=true, else demo Fund Transfer detail (inline edit). */
export function TransferEditPage() {
  if (!isApiMode()) return <DemoFundTransferDetailPage />
  return <ApiTransferEditPage />
}
