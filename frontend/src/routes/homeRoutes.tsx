import type { RouteObject } from 'react-router-dom'
import { RoleHomePage, RoleInboxPage } from '@/modules/role-experience'
import { ExecutiveDashboardPage, UnifiedInboxPage } from '@/modules/control-towers'
import { CeoDashboardPage } from '@/modules/executive/CeoDashboardPage'

/** Role home / inbox retained. Demo /home/approvals removed. */
export const homeRouteChildren: RouteObject[] = [
  { index: true, element: <RoleHomePage /> },
  { path: 'home', element: <RoleHomePage /> },
  { path: 'home/inbox', element: <RoleInboxPage /> },
  { path: 'executive', element: <CeoDashboardPage /> },
  { path: 'executive/legacy', element: <ExecutiveDashboardPage /> },
  { path: 'inbox', element: <UnifiedInboxPage /> },
]
