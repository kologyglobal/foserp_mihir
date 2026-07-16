import { Navigate, useLocation } from 'react-router-dom'

/** Legacy Customer Master routes → Company Master. */
export function MastersCustomersLegacyRedirect() {
  const { pathname, search, hash } = useLocation()
  const target = pathname.replace(/^\/masters\/customers(?=\/|$)/, '/masters/companies')
  return <Navigate to={`${target}${search}${hash}`} replace />
}

/** Legacy Permission Master routes → Role Permission Matrix. */
export function MastersPermissionsLegacyRedirect() {
  const { pathname, search, hash } = useLocation()
  const target = pathname.replace(/^\/masters\/permissions(?=\/|$)/, '/masters/role-permissions')
  return <Navigate to={`${target}${search}${hash}`} replace />
}
