import type { RouteObject } from 'react-router-dom'
import { LoginPage } from '@/modules/auth/LoginPage'
import { ChangePasswordPage } from '@/modules/auth/ChangePasswordPage'

export const authRoute: RouteObject = {
  path: '/login',
  element: <LoginPage />,
}

/** Authenticated account routes (no special permission — any signed-in user). */
export const accountRouteChildren: RouteObject[] = [
  { path: 'account/change-password', element: <ChangePasswordPage /> },
]
