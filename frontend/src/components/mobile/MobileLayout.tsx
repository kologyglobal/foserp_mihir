import { Outlet } from 'react-router-dom'
import { ProtectedOutlet } from '../auth/ProtectedRoute'
import { MobileAppShell } from './MobileComponents'

export function MobileLayout() {
  return (
    <MobileAppShell>
      <ProtectedOutlet>
        <Outlet />
      </ProtectedOutlet>
    </MobileAppShell>
  )
}
