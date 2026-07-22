import { isApiMode } from '@/config/apiConfig'
import { AdjustmentWorkspaceShell } from '../components/AdjustmentWorkspaceShell'
import { AdjustmentDemoNotice } from '../components/AdjustmentDemoNotice'
import { ApiAdjustmentListPage } from './ApiAdjustmentListPage'

/** Route entry — API adjustment list when VITE_USE_API=true, else an API-mode-required notice (no demo GL simulation). */
export function AdjustmentListPage() {
  if (!isApiMode()) {
    return (
      <AdjustmentWorkspaceShell title="Bank Transactions">
        <AdjustmentDemoNotice />
      </AdjustmentWorkspaceShell>
    )
  }
  return <ApiAdjustmentListPage />
}
