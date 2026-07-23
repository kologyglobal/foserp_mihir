import { Navigate, useParams } from 'react-router-dom'
import { customer360Path } from '../../config/entity360Routes'
import { BOM_SETUP_PATH } from '../../config/bomRoutes'

export function Bom360LegacyRedirect() {
  return <Navigate to={BOM_SETUP_PATH} replace />
}

export function Customer360LegacyRedirect() {
  const { id } = useParams()
  if (!id) return <Navigate to="/masters/companies" replace />
  return <Navigate to={customer360Path(id)} replace />
}
