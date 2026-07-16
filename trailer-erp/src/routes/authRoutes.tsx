import { LoginPage } from '@/modules/auth/LoginPage'

export const authRoute = {
  path: '/login',
  element: <LoginPage />,
} as const
