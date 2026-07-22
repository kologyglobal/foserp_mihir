import { isApiMode } from '@/config/apiConfig'
import { FundTransferNewPage as DemoFundTransferNewPage } from '@/modules/accounting/FundTransferEditorPage'
import { ApiTransferCreatePage } from './ApiTransferCreatePage'

/** Route entry — API create form when VITE_USE_API=true, else demo Fund Transfer editor. */
export function TransferCreatePage() {
  if (!isApiMode()) return <DemoFundTransferNewPage />
  return <ApiTransferCreatePage />
}
