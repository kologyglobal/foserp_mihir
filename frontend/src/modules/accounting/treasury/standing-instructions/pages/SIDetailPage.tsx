import { isApiMode } from '@/config/apiConfig'
import { SIWorkspaceShell } from '../components/SIWorkspaceShell'
import { SIDemoNotice } from '../components/SIDemoNotice'
import { ApiSIDetailPage } from './ApiSIDetailPage'

/** Route entry — API standing-instruction detail when VITE_USE_API=true, else an API-mode-required notice. */
export function SIDetailPage() {
  if (!isApiMode()) {
    return (
      <SIWorkspaceShell title="Standing Instruction">
        <SIDemoNotice />
      </SIWorkspaceShell>
    )
  }
  return <ApiSIDetailPage />
}
