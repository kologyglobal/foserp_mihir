import { isApiMode } from '@/config/apiConfig'
import { SIWorkspaceShell } from '../components/SIWorkspaceShell'
import { SIDemoNotice } from '../components/SIDemoNotice'
import { ApiSIListPage } from './ApiSIListPage'

/** Route entry — API standing-instruction list when VITE_USE_API=true, else an API-mode-required notice. */
export function SIListPage() {
  if (!isApiMode()) {
    return (
      <SIWorkspaceShell title="Standing Instructions">
        <SIDemoNotice />
      </SIWorkspaceShell>
    )
  }
  return <ApiSIListPage />
}
