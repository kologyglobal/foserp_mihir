import { Navigate, useLocation } from 'react-router-dom'

/** Legacy CRM Masters owner routes → Global User Management. */
export function CrmOwnersLegacyRedirect() {
  const { pathname, search, hash } = useLocation()
  const target = pathname.replace(/^\/crm\/masters\/owners(?=\/|$)/, '/masters/users')
  return <Navigate to={`${target}${search}${hash}`} replace />
}
