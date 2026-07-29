/**
 * Maintenance fine-grained frontend permissions (JWT permission strings).
 * Backend enforces the same keys — UI gates are soft only.
 */
import { useMemo } from 'react'
import { getStoredSession } from '@/services/api/client'
import { isApiMode } from '@/config/apiConfig'
import { hasWorkspaceAdminRole } from './workspaceAdmin'

export const MAINTENANCE_PERMISSIONS = [
  'maintenance.view',
  'maintenance.create',
  'maintenance.start',
  'maintenance.update',
  'maintenance.test',
  'maintenance.close',
  'maintenance.cost.view',
  'maintenance.cost.manage',
  'maintenance.report.view',
] as const

export type MaintenancePermission = (typeof MAINTENANCE_PERMISSIONS)[number]

export function hasMaintenancePermission(key: MaintenancePermission): boolean {
  if (isApiMode() && hasWorkspaceAdminRole()) return true
  if (isApiMode()) {
    const perms = getStoredSession()?.user.permissions ?? []
    return perms.includes(key)
  }
  return false
}

export function useMaintenancePermissions() {
  return useMemo(
    () => ({
      canView: hasMaintenancePermission('maintenance.view'),
      canCreate: hasMaintenancePermission('maintenance.create'),
      canStart: hasMaintenancePermission('maintenance.start'),
      canUpdate: hasMaintenancePermission('maintenance.update'),
      canTest: hasMaintenancePermission('maintenance.test'),
      canClose: hasMaintenancePermission('maintenance.close'),
      canViewCost: hasMaintenancePermission('maintenance.cost.view'),
      canManageCost: hasMaintenancePermission('maintenance.cost.manage'),
      canReport: hasMaintenancePermission('maintenance.report.view'),
    }),
    [],
  )
}
