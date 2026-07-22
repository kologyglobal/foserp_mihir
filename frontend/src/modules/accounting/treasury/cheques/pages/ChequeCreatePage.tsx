import { Navigate } from 'react-router-dom'
import { isApiMode } from '@/config/apiConfig'
import { ApiChequeCreatePage } from './ApiChequeCreatePage'

/**
 * Route entry — API cheque create form when VITE_USE_API=true.
 * The demo Cheque Management page has no dedicated create screen (inline status transitions
 * only), so demo mode redirects back to the cheque list.
 */
export function ChequeCreatePage() {
  if (!isApiMode()) return <Navigate to="/accounting/bank-cash/cheques" replace />
  return <ApiChequeCreatePage />
}
