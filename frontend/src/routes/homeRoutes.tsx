import type { RouteObject } from 'react-router-dom'
import {
  ExecutiveDashboardPage,
  UnifiedInboxPage,
} from '@/modules/control-towers'
import { RoleHomePage, RoleInboxPage, RoleApprovalsPage } from '@/modules/role-experience'

export const homeRouteChildren: RouteObject[] = [
  { index: true, element: <RoleHomePage /> },
  { path: 'home', element: <RoleHomePage /> },
  { path: 'home/inbox', element: <RoleInboxPage /> },
  { path: 'home/approvals', element: <RoleApprovalsPage /> },
  { path: 'executive', element: <ExecutiveDashboardPage /> },
  { path: 'inbox', element: <UnifiedInboxPage /> },
]
