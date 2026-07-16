import { Navigate } from 'react-router-dom'

/** @deprecated Use `/purchase/requisitions/new` — BC document workspace */
export function ManualPrFormPage() {
  return <Navigate to="/purchase/requisitions/new" replace />
}
