import { Outlet } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthProvider'
import { DocumentTitle } from '@/components/layout/DocumentTitle'

/**
 * Root router layout — keeps every route (including public /login) inside AuthProvider.
 * Single provider instance for ApiAuthGate, LoginPage, and authenticated shells.
 */
export function AuthRootLayout() {
  return (
    <AuthProvider>
      <DocumentTitle />
      <Outlet />
    </AuthProvider>
  )
}
