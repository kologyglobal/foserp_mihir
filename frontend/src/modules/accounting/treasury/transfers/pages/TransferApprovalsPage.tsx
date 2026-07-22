import { Navigate } from 'react-router-dom'
import { isApiMode } from '@/config/apiConfig'

/** Approvals shortcut — filtered transfer list (pending approval) rather than a duplicate screen. */
export function TransferApprovalsPage() {
  if (!isApiMode()) return <Navigate to="/accounting/bank-cash/transfers" replace />
  return <Navigate to="/accounting/bank-cash/transfers?status=PENDING_APPROVAL" replace />
}
