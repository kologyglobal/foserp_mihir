import { Navigate } from 'react-router-dom'
import { isApiMode } from '@/config/apiConfig'
import { ApiChequeDetailPage } from './ApiChequeDetailPage'

/**
 * Route entry — API cheque detail when VITE_USE_API=true.
 * The demo Cheque Management page has no dedicated detail screen (inline status transitions
 * only), so demo mode redirects back to the cheque list.
 */
export function ChequeDetailPage() {
  if (!isApiMode()) return <Navigate to="/accounting/bank-cash/cheques" replace />
  return <ApiChequeDetailPage />
}
