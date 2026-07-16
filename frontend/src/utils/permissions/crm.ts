import { isApiMode } from '../../config/apiConfig'
import { getStoredSession } from '../../services/api/client'
import { canPermission } from './index'

/**
 * Permission gate for Convert Quotation → SO.
 * Mapping: convert_sales_order → crm.quotation.convert; sales.order.create → crm.sales_order.create
 * Never gated on quotation owner.
 */
export function canConvertQuotationToSalesOrderPermission(): boolean {
  return canCrmPermission('crm.quotation.convert') && canCrmPermission('crm.sales_order.create')
}

/** Shell access for /crm and /m/crm (any CRM view is enough). */
export function canAccessCrmShell(): boolean {
  return (
    canCrmPermission('crm.dashboard.view')
    || canCrmPermission('crm.lead.view')
    || canCrmPermission('crm.opportunity.view')
    || canCrmPermission('crm.company.view')
    || canCrmPermission('crm.quotation.view')
  )
}

/** Check CRM permission — uses session permissions in API mode, demo matrix otherwise. */
export function canCrmPermission(permission: string): boolean {
  if (isApiMode()) {
    const perms = getStoredSession()?.user.permissions ?? []
    return perms.includes(permission)
  }
  // Demo RBAC matrix still uses legacy sales.* keys — only this helper may map to them.
  if (permission.endsWith('.view') || permission.includes('dashboard') || permission.includes('report') || permission.includes('search')) {
    return canPermission('sales', 'view')
  }
  if (permission.includes('.delete')) return canPermission('sales', 'override')
  if (
    permission.includes('.create')
    || permission.includes('.update')
    || permission.includes('.execute')
    || permission.includes('.assign')
    || permission.includes('.qualify')
    || permission.includes('.convert')
    || permission.includes('.approve')
    || permission.includes('.close')
    || permission.includes('.complete')
    || permission.includes('.confirm')
  ) {
    return canPermission('sales', 'edit')
  }
  return canPermission('sales', 'view')
}
