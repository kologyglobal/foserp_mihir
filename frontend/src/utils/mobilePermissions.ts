import type { ExperienceRole } from '../types/roleExperience'
import { canPermission } from './permissions'
import type { PermissionAction, PermissionModule } from '../config/permissionMatrix'

export type MobileOpsRole =
  | 'gate_keeper'
  | 'store_user'
  | 'shop_floor'
  | 'quality_inspector'
  | 'dispatch_user'
  | 'manager'

export function mapExperienceToMobileRole(role: ExperienceRole): MobileOpsRole {
  switch (role) {
    case 'stores':
    case 'purchase':
      return 'store_user'
    case 'production':
      return 'shop_floor'
    case 'quality':
      return 'quality_inspector'
    case 'dispatch':
      return 'dispatch_user'
    case 'ceo':
    case 'coo':
    case 'accounts':
    case 'planning':
      return 'manager'
    default:
      return 'store_user'
  }
}

export function mobileCan(module: PermissionModule, action: PermissionAction): boolean {
  return canPermission(module, action)
}

export function mobileGateCanCreate(): boolean {
  return canPermission('dispatch', 'create') || canPermission('inventory', 'create')
}

export function mobileGrnCanReceive(): boolean {
  return canPermission('purchase', 'post') || canPermission('inventory', 'post')
}

export function mobileQcCanInspect(): boolean {
  return (
    canPermission('quality', 'post') ||
    canPermission('quality', 'edit') ||
    canPermission('production', 'post')
  )
}

export function mobileCanApprove(): boolean {
  return canPermission('approval', 'approve')
}

export function mobileDispatchCanPost(): boolean {
  return canPermission('dispatch', 'post')
}

export function mobileShopFloorCanEdit(): boolean {
  return canPermission('production', 'edit') || canPermission('production', 'post')
}
