import { Outlet } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthProvider'

/**
 * Root router layout — keeps every route (including public /login) inside AuthProvider.
 * Single provider instance for ApiAuthGate, LoginPage, and authenticated shells.
 */
export function AuthRootLayout() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  )
}
