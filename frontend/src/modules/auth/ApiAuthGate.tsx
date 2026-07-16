import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthProvider'
import { isApiMode } from '@/config/apiConfig'

export function ApiAuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (!isApiMode()) return <>{children}</>

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-erp-bg text-sm text-erp-muted">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-erp-primary border-t-transparent" />
          Checking session…
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  return <>{children}</>
}
