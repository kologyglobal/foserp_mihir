import { isApiMode } from '@/config/apiConfig'
import { AdjustmentWorkspaceShell } from '../components/AdjustmentWorkspaceShell'
import { AdjustmentDemoNotice } from '../components/AdjustmentDemoNotice'
import { ApiAdjustmentDetailPage } from './ApiAdjustmentDetailPage'

/** Route entry — API adjustment detail when VITE_USE_API=true, else an API-mode-required notice. */
export function AdjustmentDetailPage() {
  if (!isApiMode()) {
    return (
      <AdjustmentWorkspaceShell title="Bank Transaction">
        <AdjustmentDemoNotice />
      </AdjustmentWorkspaceShell>
    )
  }
  return <ApiAdjustmentDetailPage />
}
