import { Navigate, useParams } from 'react-router-dom'
import { bom360Path, customer360Path } from '../../config/entity360Routes'

export function Bom360LegacyRedirect() {
  const { id } = useParams()
  if (!id) return <Navigate to="/masters/bom" replace />
  return <Navigate to={bom360Path(id)} replace />
}

export function Customer360LegacyRedirect() {
  const { id } = useParams()
  if (!id) return <Navigate to="/masters/companies" replace />
  return <Navigate to={customer360Path(id)} replace />
}
