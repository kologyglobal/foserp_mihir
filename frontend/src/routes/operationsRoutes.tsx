import type { RouteObject } from 'react-router-dom'
import { ExceptionCentrePage } from '@/modules/operations/ExceptionCentrePage'

/** Phase 7D — cross-module Operations routes (exceptions centre; more to follow). */
export const operationsRouteChildren: RouteObject[] = [
  { path: 'operations/exceptions', element: <ExceptionCentrePage /> },
]
