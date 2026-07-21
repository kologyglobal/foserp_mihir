import { isApiMode } from '@/config/apiConfig'
import { BookWorkspaceShell } from '../components/BookWorkspaceShell'
import { BookDemoNotice } from '../components/BookDemoNotice'
import { ApiBookPage } from './ApiBookPage'

/** Route entry — live GL-derived bankbook when VITE_USE_API=true, else an API-mode-required notice (no client-side ledger simulation). */
export function BankbookPage() {
  if (!isApiMode()) {
    return (
      <BookWorkspaceShell kind="bank" title="Bankbook">
        <BookDemoNotice kind="bank" />
      </BookWorkspaceShell>
    )
  }
  return <ApiBookPage kind="bank" />
}
