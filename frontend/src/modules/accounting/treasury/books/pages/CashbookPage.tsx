import { isApiMode } from '@/config/apiConfig'
import { CashBookPage as DemoCashBookPage } from '@/modules/accounting/CashBookPage'
import { ApiBookPage } from './ApiBookPage'

/**
 * Route entry — demo mode reuses the existing Zustand-backed `CashBookPage` (already a complete,
 * self-contained page with its own shell/tabs); API mode renders the new GL-derived treasury
 * cashbook. Keeps demo mode working unchanged per Phase 5B3 constraints.
 */
export function CashbookPage() {
  if (!isApiMode()) {
    return <DemoCashBookPage />
  }
  return <ApiBookPage kind="cash" />
}
