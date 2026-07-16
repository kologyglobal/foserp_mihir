import type {
  PurchaseApprovalMatrixTier,
  PurchaseApprovalRole,
  PurchaseSetup,
} from '../types/purchaseDomain'
import { PURCHASE_DOMAIN_ACTORS } from '../data/purchase/purchaseDomainSeed'
import type { ErpRole, SessionUser } from './permissions'
import { getSessionUser } from './permissions'

export function resolveApprovalRolesForAmount(
  amount: number,
  setup: PurchaseSetup,
): PurchaseApprovalRole[] {
  const tiers = [...setup.approvalMatrix]
    .filter((t) => t.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder)
  const match =
    tiers.find((t) => amount >= t.minAmount && (t.maxAmount == null || amount <= t.maxAmount)) ??
    tiers[tiers.length - 1]
  return match?.requiredRoles?.length ? [...match.requiredRoles] : ['purchase_head']
}

export function actorForApprovalRole(role: PurchaseApprovalRole) {
  switch (role) {
    case 'department_head':
      return PURCHASE_DOMAIN_ACTORS.departmentHead
    case 'purchase_head':
      return PURCHASE_DOMAIN_ACTORS.purchaseHead
    case 'finance_head':
      return PURCHASE_DOMAIN_ACTORS.financeHead
    case 'management':
      return PURCHASE_DOMAIN_ACTORS.management
    default:
      return PURCHASE_DOMAIN_ACTORS.purchaseHead
  }
}

/** Map ERP session roles → purchase approval matrix roles (demo-friendly). */
export function sessionApprovalRoles(user: SessionUser = getSessionUser()): PurchaseApprovalRole[] {
  const role = user.role as ErpRole
  if (role === 'admin' || role === 'ceo' || role === 'director' || role === 'management') {
    return ['department_head', 'purchase_head', 'finance_head', 'management']
  }
  if (role === 'purchase_head' || role === 'purchase') return ['purchase_head']
  if (role === 'accounts_head' || role === 'accounts') return ['finance_head']
  if (
    role === 'store_manager' ||
    role === 'production_head' ||
    role === 'planning_manager' ||
    role === 'production_supervisor'
  ) {
    return ['department_head']
  }
  return []
}

export function sessionCanActAsApprover(
  approverRole: PurchaseApprovalRole,
  approverId: string,
  user: SessionUser = getSessionUser(),
): boolean {
  const roles = sessionApprovalRoles(user)
  if (!roles.includes(approverRole)) return false
  if (user.role === 'admin' || user.role === 'ceo' || user.role === 'director' || user.role === 'management') {
    return true
  }
  const actor = actorForApprovalRole(approverRole)
  return actor.id === approverId || roles.includes(approverRole)
}

export function formatMatrixTierSummary(tier: PurchaseApprovalMatrixTier): string {
  const max =
    tier.maxAmount == null
      ? 'and above'
      : `to ₹${tier.maxAmount.toLocaleString('en-IN')}`
  return `₹${tier.minAmount.toLocaleString('en-IN')} ${max}`
}
