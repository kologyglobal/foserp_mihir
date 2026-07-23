import type { RouteObject } from 'react-router-dom'
import { Navigate } from 'react-router-dom'

/** Classic MRP demo removed — live planning is Work Orders / Manufacturing Today. */
export const mrpRouteChildren: RouteObject[] = []

/**
 * Legacy production URL aliases → Manufacturing shell only.
 * Demo scan / shop-floor / MRP / legacy WO+JW pages removed.
 */
export const productionRouteChildren: RouteObject[] = [
  { path: 'production/control-tower', element: <Navigate to="/manufacturing/control-room" replace /> },
  { path: 'production', element: <Navigate to="/manufacturing/today" replace /> },
  { path: 'production/job-cards', element: <Navigate to="/manufacturing/work-orders" replace /> },
  { path: 'work-orders', element: <Navigate to="/manufacturing/work-orders" replace /> },
  { path: 'work-orders/:id', element: <Navigate to="/manufacturing/work-orders" replace /> },
  { path: 'work-orders/:id/360', element: <Navigate to="/manufacturing/work-orders" replace /> },
  { path: 'job-work', element: <Navigate to="/manufacturing/job-work" replace /> },
  { path: 'job-work/:id', element: <Navigate to="/manufacturing/job-work" replace /> },
]
