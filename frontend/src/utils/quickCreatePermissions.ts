import type { QuickCreateEntityType } from '../types/quickCreate'
import { isApiMode } from '../config/apiConfig'
import { getStoredSession } from '../services/api/client'
import { canPermission, getPermissionDenialReason } from './permissions'
import { canCrmPermission } from './permissions/crm'

function hasApiPermission(permission: string): boolean {
  if (!isApiMode()) return false
  return (getStoredSession()?.user.permissions ?? []).includes(permission)
}

export function canQuickCreateEntity(entityType: QuickCreateEntityType): boolean {
  return getQuickCreatePermission(entityType).allowed
}

export function getQuickCreateDenialReason(entityType: QuickCreateEntityType): string {
  const { allowed, module, action, crmPermission } = getQuickCreatePermission(entityType)
  if (allowed) return ''
  if (crmPermission) return `Requires ${crmPermission}`
  if (module && action) return getPermissionDenialReason(module, action)
  return 'You do not have permission to create this record'
}

function getQuickCreatePermission(entityType: QuickCreateEntityType): {
  allowed: boolean
  module?: Parameters<typeof canPermission>[0]
  action?: Parameters<typeof canPermission>[1]
  crmPermission?: string
} {
  switch (entityType) {
    case 'customer':
      if (canCrmPermission('crm.company.create') || canPermission('masters', 'create')) {
        return { allowed: true }
      }
      return { allowed: false, crmPermission: 'crm.company.create' }
    case 'contact':
      if (canCrmPermission('crm.contact.create') || canPermission('masters', 'create')) {
        return { allowed: true }
      }
      return { allowed: false, crmPermission: 'crm.contact.create' }
    case 'product':
      if (
        hasApiPermission('master.product.create')
        || canCrmPermission('crm.master.create')
        || canPermission('masters', 'create')
      ) {
        return { allowed: true }
      }
      return { allowed: false, module: 'masters', action: 'create' }
    case 'vendor':
      if (canPermission('purchase', 'create') || canPermission('masters', 'create')) {
        return { allowed: true }
      }
      return { allowed: false, module: 'purchase', action: 'create' }
    case 'item':
      if (
        canPermission('masters', 'create')
        || canPermission('purchase', 'create')
        || canPermission('engineering', 'create')
      ) {
        return { allowed: true }
      }
      return { allowed: false, module: 'masters', action: 'create' }
    case 'paymentTerms':
    case 'taxCategory':
    case 'deliveryTerms':
      if (
        canPermission('masters', 'create')
        || canPermission('accounts', 'create')
        || canPermission('purchase', 'approve')
        || canCrmPermission('crm.quotation.approve')
      ) {
        return { allowed: true }
      }
      return { allowed: false, module: 'masters', action: 'create' }
    case 'transporter':
      if (canPermission('dispatch', 'create') || canPermission('masters', 'create')) {
        return { allowed: true }
      }
      return { allowed: false, module: 'dispatch', action: 'create' }
    case 'inspectionPlan':
      if (canPermission('quality', 'create') || canPermission('quality', 'approve')) {
        return { allowed: true }
      }
      return { allowed: false, module: 'quality', action: 'create' }
    default:
      return { allowed: false }
  }
}

/** Whether newly created vendor/item should start inactive (pending approval). */
export function quickCreateStartsPendingApproval(entityType: 'vendor' | 'item'): boolean {
  if (entityType === 'vendor') {
    return canPermission('purchase', 'create') && !canPermission('purchase', 'approve') && !canPermission('masters', 'create')
  }
  return (
    (canPermission('purchase', 'create') || canPermission('inventory', 'create'))
    && !canPermission('masters', 'create')
    && !canPermission('engineering', 'release')
  )
}
