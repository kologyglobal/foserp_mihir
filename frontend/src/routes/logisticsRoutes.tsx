import type { RouteObject } from 'react-router-dom'
import { Navigate } from 'react-router-dom'

/**
 * Logistics is the product label for Dispatch.
 * Keep `/logistics` working for bookmarks / mistyped URLs — real workspace is `/dispatch`.
 */
export const logisticsRouteChildren: RouteObject[] = [
  { path: 'logistics', element: <Navigate to="/dispatch" replace /> },
  { path: 'logistics/*', element: <Navigate to="/dispatch" replace /> },
]
