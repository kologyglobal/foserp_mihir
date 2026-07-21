import { isApiMode } from '@/config/apiConfig'
import { SIWorkspaceShell } from '../components/SIWorkspaceShell'
import { SIDemoNotice } from '../components/SIDemoNotice'
import { ApiSICreatePage } from './ApiSICreatePage'

/** Route entry — API standing-instruction create form when VITE_USE_API=true, else an API-mode-required notice. */
export function SICreatePage() {
  if (!isApiMode()) {
    return (
      <SIWorkspaceShell title="New Standing Instruction">
        <SIDemoNotice />
      </SIWorkspaceShell>
    )
  }
  return <ApiSICreatePage />
}
