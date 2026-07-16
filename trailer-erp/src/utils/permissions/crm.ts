import { isApiMode } from '../../config/apiConfig'
import { getStoredSession } from '../../services/api/client'
import { canPermission } from './index'

/** Check CRM permission — uses session permissions in API mode, demo matrix otherwise. */
export function canCrmPermission(permission: string): boolean {
  if (isApiMode()) {
    const perms = getStoredSession()?.user.permissions ?? []
    return perms.includes(permission)
  }
  if (permission.endsWith('.view') || permission.includes('dashboard') || permission.includes('report') || permission.includes('search')) {
    return canPermission('sales', 'view')
  }
  if (permission.includes('.delete')) return canPermission('sales', 'override')
  if (permission.includes('.create') || permission.includes('.update') || permission.includes('.execute') || permission.includes('.assign') || permission.includes('.qualify') || permission.includes('.convert') || permission.includes('.close') || permission.includes('.complete')) {
    return canPermission('sales', 'edit')
  }
  return canPermission('sales', 'view')
}
