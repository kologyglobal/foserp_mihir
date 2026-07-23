import type { RouteObject } from 'react-router-dom'
import { RoleHomePage, RoleInboxPage } from '@/modules/role-experience'
import { ExecutiveDashboardPage, UnifiedInboxPage } from '@/modules/control-towers'

/** Role home / inbox retained. Demo /home/approvals removed. */
export const homeRouteChildren: RouteObject[] = [
  { index: true, element: <RoleHomePage /> },
  { path: 'home', element: <RoleHomePage /> },
  { path: 'home/inbox', element: <RoleInboxPage /> },
  { path: 'executive', element: <ExecutiveDashboardPage /> },
  { path: 'inbox', element: <UnifiedInboxPage /> },
]
