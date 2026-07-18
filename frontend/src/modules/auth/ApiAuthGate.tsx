import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthProvider'
import { isApiMode } from '@/config/apiConfig'
import { PageLoadingFallback } from '@/components/system/PageLoadingFallback'

export function ApiAuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (!isApiMode()) return <>{children}</>

  if (isLoading) {
    return (
      <div className="min-h-screen bg-erp-bg">
        <PageLoadingFallback label="Checking session…" />
      </div>
    )
  }

  if (!isAuthenticated) {
    const from = `${location.pathname}${location.search}${location.hash}`
    return <Navigate to="/login" state={{ from }} replace />
  }

  return <>{children}</>
}
