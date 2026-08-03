/**
 * Sidebar / app-launcher module visibility — mirrors backend permission grants.
 * Workspace admins (Super Admin, Tenant Admin, Admin) bypass via underlying helpers.
 */

import { canPermission } from './index'
import { canAccessAdminShell } from './admin'
import { canAccessCrmShell } from './crm'
import { canAccessPurchaseShell } from './purchase'
import { canAccessInventoryShell } from './inventory'
import { canAccessManufacturingShell } from './manufacturing'
import { hasFinancePermission } from './finance'
import { hasMaintenancePermission } from './maintenance'
import { canAccessHrmsShell } from './hrms'
import { canAccessKnowledgeShell } from './knowledge'

/** Whether a sidebar module category should appear for the current session. */
export function canAccessModuleCategory(categoryId: string): boolean {
  switch (categoryId) {
    case 'executive':
      return canPermission('reports', 'view')
    case 'crm':
      return canAccessCrmShell()
    case 'sales':
      return canPermission('sales', 'view')
    case 'accounting':
      return hasFinancePermission('finance.view')
    case 'purchase':
      return canAccessPurchaseShell()
    case 'production':
      return canAccessManufacturingShell()
    case 'quality':
      return canPermission('quality', 'view')
    case 'maintenance':
      // Prefer maintenance.view; fall back to manufacturing shell so operators can reach Report Breakdown
      return hasMaintenancePermission('maintenance.view') || canAccessManufacturingShell()
    case 'hrms':
      return canAccessHrmsShell()
    case 'inventory':
      return canAccessInventoryShell()
    case 'dispatch':
    case 'gate':
      return canPermission('dispatch', 'view')
    case 'masters':
      return canPermission('masters', 'view')
    case 'traceability':
    case 'traceability-barcode':
      return canPermission('traceability', 'view')
    case 'engineering':
      return canPermission('engineering', 'view')
    case 'mrp':
      return canPermission('production', 'view')
    case 'reports':
      return canPermission('reports', 'view')
    case 'knowledge':
      return canAccessKnowledgeShell()
    case 'admin':
      return canAccessAdminShell()
    default:
      return true
  }
}

/** Post-login / brand link landing — CRM-only users skip executive home. */
export function getUserLandingPath(): string {
  if (canAccessCrmShell() && !canPermission('reports', 'view')) {
    return '/crm'
  }
  return '/home'
}
