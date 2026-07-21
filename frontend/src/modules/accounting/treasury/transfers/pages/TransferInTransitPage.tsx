import { isApiMode } from '@/config/apiConfig'
import { FundTransfersPage as DemoFundTransfersPage } from '@/modules/accounting/FundTransfersPage'
import { ApiTransferListPage } from './ApiTransferListPage'

/** Transfers currently dispatched but not yet received — In Transit sub-view. */
export function TransferInTransitPage() {
  if (!isApiMode()) return <DemoFundTransfersPage />
  return (
    <ApiTransferListPage
      fixedStatus="IN_TRANSIT"
      title="Transfers In Transit"
      description="Transfers dispatched from the source account and awaiting receipt confirmation at the destination."
    />
  )
}
