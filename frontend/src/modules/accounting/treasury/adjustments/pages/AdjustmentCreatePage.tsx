import { isApiMode } from '@/config/apiConfig'
import { AdjustmentWorkspaceShell } from '../components/AdjustmentWorkspaceShell'
import { AdjustmentDemoNotice } from '../components/AdjustmentDemoNotice'
import { ApiAdjustmentCreatePage } from './ApiAdjustmentCreatePage'

/** Route entry — API adjustment create form when VITE_USE_API=true, else an API-mode-required notice. */
export function AdjustmentCreatePage() {
  if (!isApiMode()) {
    return (
      <AdjustmentWorkspaceShell title="New Bank Transaction">
        <AdjustmentDemoNotice />
      </AdjustmentWorkspaceShell>
    )
  }
  return <ApiAdjustmentCreatePage />
}
