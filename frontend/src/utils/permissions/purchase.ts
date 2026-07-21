/**
 * Purchase module fine-grained permissions.
 *
 * SECURITY: UI gating is supplementary. Backend `requirePermission` is authoritative.
 */

import { useMemo } from 'react'
import { isApiMode } from '../../config/apiConfig'
import { getStoredSession, type AuthSession } from '../../services/api/client'
import { getSessionUser, type ErpRole } from './index'

/**
 * Soft-guard only: Tenant Admin / Admin / Administrator / Super Admin open purchase UI
 * even if RolePermissions lag a catalog expansion. Does not disable gates for other roles.
 */
const PURCHASE_ADMIN_ROLE_FALLBACK = new Set([
  'super admin',
  'tenant admin',
  'admin',
  'administrator',
])

function hasPurchaseAdminRoleFallback(session: AuthSession | null | undefined): boolean {
  const roles = session?.user.roles ?? []
  return roles.some((r) => PURCHASE_ADMIN_ROLE_FALLBACK.has(r.trim().toLowerCase()))
}

/** Canonical purchase permission strings — keep in sync with backend `PERMISSIONS`. */
export const PURCHASE_PERMISSIONS = [
  'purchase.view',
  'purchase.dashboard.view',
  'purchase.pr.view',
  'purchase.pr.create',
  'purchase.pr.edit',
  'purchase.pr.submit',
  'purchase.pr.approve',
  'purchase.pr.reject',
  'purchase.pr.cancel',
  'purchase.pr.reopen',
  'purchase.planning.view',
  'purchase.planning.edit',
  'purchase.planning.assign_buyer',
  'purchase.planning.select_vendor',
  'purchase.planning.approve',
  'purchase.planning.create_po',
  'purchase.planning.cancel',
  'purchase.rfq.view',
  'purchase.rfq.create',
  'purchase.rfq.send',
  'purchase.rfq.enter_quote',
  'purchase.rfq.compare',
  'purchase.rfq.award',
  'purchase.rfq.convert_to_po',
  'purchase.po.view',
  'purchase.po.create',
  'purchase.po.edit',
  'purchase.po.approve',
  'purchase.po.send',
  'purchase.po.cancel',
  'purchase.po.close',
  /** Maker-checker bypass — approve own PR/PO when Setup policy = PERMISSION_ONLY. */
  'purchase.approvals.self_approve',
  'purchase.grn.view',
  'purchase.grn.create',
  'purchase.grn.post',
  'purchase.quality.view',
  'purchase.quality.inspect',
  'purchase.invoice.view',
  'purchase.invoice.create',
  'purchase.invoice.verify',
  'purchase.invoice.approve',
  'purchase.invoice.post',
  'purchase.return.view',
  'purchase.return.create',
  'purchase.return.post',
  'purchase.reports.view',
  'purchase.setup.view',
  'purchase.setup.manage',
] as const

export type PurchasePermission = (typeof PURCHASE_PERMISSIONS)[number]

/** Legacy JWT/DB keys → canonical (bidirectional checks in canPurchasePermission). */
const PURCHASE_PERMISSION_ALIASES: Record<string, PurchasePermission> = {
  'purchase.requisition.view': 'purchase.pr.view',
  'purchase.requisition.create': 'purchase.pr.create',
  'purchase.requisition.edit': 'purchase.pr.edit',
  'purchase.requisition.submit': 'purchase.pr.submit',
  'purchase.requisition.approve': 'purchase.pr.approve',
  'purchase.quotation.view': 'purchase.rfq.view',
  'purchase.quotation.create': 'purchase.rfq.enter_quote',
  'purchase.quotation.compare': 'purchase.rfq.compare',
  'purchase.order.view': 'purchase.po.view',
  'purchase.order.create': 'purchase.po.create',
  'purchase.order.edit': 'purchase.po.edit',
  'purchase.order.approve': 'purchase.po.approve',
  'purchase.order.release': 'purchase.po.send',
  'purchase.order.cancel': 'purchase.po.cancel',
}

const ALL = [...PURCHASE_PERMISSIONS]

/** Persona permission packs used by demo RBAC (mapped onto ErpRole below). */
const REQUESTER: PurchasePermission[] = [
  'purchase.view',
  'purchase.dashboard.view',
  'purchase.pr.view',
  'purchase.pr.create',
  'purchase.pr.edit',
  'purchase.pr.submit',
]

const DEPARTMENT_MANAGER: PurchasePermission[] = [
  ...REQUESTER,
  'purchase.pr.approve',
  'purchase.pr.reject',
  'purchase.reports.view',
]

const PURCHASE_EXECUTIVE: PurchasePermission[] = [
  'purchase.view',
  'purchase.dashboard.view',
  'purchase.pr.view',
  'purchase.pr.create',
  'purchase.pr.edit',
  'purchase.pr.submit',
  'purchase.planning.view',
  'purchase.planning.edit',
  'purchase.planning.assign_buyer',
  'purchase.planning.select_vendor',
  'purchase.planning.create_po',
  'purchase.rfq.view',
  'purchase.rfq.create',
  'purchase.rfq.send',
  'purchase.rfq.enter_quote',
  'purchase.rfq.compare',
  'purchase.po.view',
  'purchase.po.create',
  'purchase.po.edit',
  'purchase.grn.view',
  'purchase.quality.view',
  'purchase.invoice.view',
  'purchase.return.view',
  'purchase.reports.view',
]

/** Broad purchase ops; setup reserved for Administrator. */
const PURCHASE_MANAGER: PurchasePermission[] = ALL.filter(
  (p) => p !== 'purchase.setup.manage' && p !== 'purchase.setup.view',
)

const STORE_EXECUTIVE: PurchasePermission[] = [
  'purchase.view',
  'purchase.dashboard.view',
  'purchase.po.view',
  'purchase.grn.view',
  'purchase.grn.create',
  'purchase.grn.post',
  'purchase.quality.view',
  'purchase.return.view',
  'purchase.return.create',
  'purchase.return.post',
  'purchase.reports.view',
]

const QUALITY_INSPECTOR: PurchasePermission[] = [
  'purchase.view',
  'purchase.dashboard.view',
  'purchase.grn.view',
  'purchase.quality.view',
  'purchase.quality.inspect',
  'purchase.return.view',
]

const FINANCE_EXECUTIVE: PurchasePermission[] = [
  'purchase.view',
  'purchase.dashboard.view',
  'purchase.po.view',
  'purchase.grn.view',
  'purchase.invoice.view',
  'purchase.invoice.create',
  'purchase.invoice.verify',
  'purchase.return.view',
  'purchase.reports.view',
]

const FINANCE_MANAGER: PurchasePermission[] = [
  ...FINANCE_EXECUTIVE,
  'purchase.invoice.approve',
  'purchase.invoice.post',
]

const MANAGEMENT: PurchasePermission[] = [
  'purchase.view',
  'purchase.dashboard.view',
  'purchase.pr.view',
  'purchase.pr.approve',
  'purchase.pr.reject',
  'purchase.planning.view',
  'purchase.planning.approve',
  'purchase.rfq.view',
  'purchase.rfq.compare',
  'purchase.rfq.award',
  'purchase.po.view',
  'purchase.po.approve',
  'purchase.po.send',
  'purchase.po.cancel',
  'purchase.grn.view',
  'purchase.quality.view',
  'purchase.invoice.view',
  'purchase.invoice.approve',
  'purchase.return.view',
  'purchase.reports.view',
]

/**
 * Demo-mode role → purchase permission map.
 * Api mode uses JWT `user.permissions` instead (see `canPurchasePermission`).
 */
export const DEMO_PURCHASE_ROLE_PERMISSIONS: Record<ErpRole, PurchasePermission[] | '*'> = {
  admin: '*',
  ceo: MANAGEMENT,
  director: MANAGEMENT,
  management: MANAGEMENT,
  engineering_head: DEPARTMENT_MANAGER,
  planning_manager: DEPARTMENT_MANAGER,
  planning: DEPARTMENT_MANAGER,
  engineering: DEPARTMENT_MANAGER,
  sales_manager: REQUESTER,
  sales: REQUESTER,
  purchase_head: PURCHASE_MANAGER,
  purchase_user: PURCHASE_EXECUTIVE,
  purchase: PURCHASE_EXECUTIVE,
  store_manager: STORE_EXECUTIVE,
  store_user: STORE_EXECUTIVE,
  stores: STORE_EXECUTIVE,
  production_head: REQUESTER,
  production_supervisor: REQUESTER,
  shop_floor: ['purchase.pr.view'],
  production: REQUESTER,
  quality_head: QUALITY_INSPECTOR,
  quality_inspector: QUALITY_INSPECTOR,
  quality: QUALITY_INSPECTOR,
  dispatch_manager: ['purchase.view', 'purchase.dashboard.view', 'purchase.po.view'],
  dispatch_user: ['purchase.view', 'purchase.po.view'],
  dispatch: ['purchase.view', 'purchase.dashboard.view', 'purchase.po.view'],
  accounts_head: FINANCE_MANAGER,
  accounts_user: FINANCE_EXECUTIVE,
  accounts: FINANCE_MANAGER,
}

/** Longest-prefix wins — used by soft route guards and Access Denied labels. */
export const PURCHASE_ROUTE_VIEW_PERMISSIONS: Array<{
  prefix: string
  permission: PurchasePermission
  pageName: string
}> = [
  { prefix: '/purchase/setup', permission: 'purchase.setup.view', pageName: 'Purchase Setup' },
  { prefix: '/purchase/masters', permission: 'purchase.setup.view', pageName: 'Purchase Masters' },
  { prefix: '/purchase/approvals', permission: 'purchase.pr.approve', pageName: 'Purchase Approvals' },
  { prefix: '/purchase/requisitions', permission: 'purchase.pr.view', pageName: 'Purchase Requisitions' },
  { prefix: '/purchase/planning-sheet', permission: 'purchase.planning.view', pageName: 'Purchase Planning Sheet' },
  { prefix: '/purchase/rfqs', permission: 'purchase.rfq.view', pageName: 'RFQs' },
  { prefix: '/purchase/vendor-quotations', permission: 'purchase.rfq.view', pageName: 'Vendor Quotations' },
  { prefix: '/purchase/comparison', permission: 'purchase.rfq.compare', pageName: 'Quote Comparison' },
  { prefix: '/purchase/orders', permission: 'purchase.po.view', pageName: 'Purchase Orders' },
  { prefix: '/purchase/invoices', permission: 'purchase.invoice.view', pageName: 'Purchase Invoices' },
  { prefix: '/purchase/grn', permission: 'purchase.grn.view', pageName: 'Gate Entry & GRN' },
  { prefix: '/purchase/grns', permission: 'purchase.grn.view', pageName: 'Gate Entry & GRN' },
  { prefix: '/purchase/quality-inspections', permission: 'purchase.quality.view', pageName: 'Quality Inspections' },
  { prefix: '/purchase/returns', permission: 'purchase.return.view', pageName: 'Purchase Returns' },
  { prefix: '/purchase/vendor-performance', permission: 'purchase.reports.view', pageName: 'Vendor Performance' },
  { prefix: '/purchase/reports', permission: 'purchase.reports.view', pageName: 'Purchase Reports' },
  { prefix: '/purchase/manual-pr', permission: 'purchase.pr.create', pageName: 'Manual PR' },
  { prefix: '/purchase', permission: 'purchase.view', pageName: 'Purchase' },
]

/** Nav path → required view (or manage) permission. */
export const PURCHASE_NAV_ITEM_PERMISSIONS: Record<string, PurchasePermission> = {
  '/purchase': 'purchase.view',
  '/purchase/approvals': 'purchase.pr.approve',
  '/purchase/requisitions': 'purchase.pr.view',
  '/purchase/planning-sheet': 'purchase.planning.view',
  '/purchase/rfqs': 'purchase.rfq.view',
  '/purchase/vendor-quotations': 'purchase.rfq.view',
  '/purchase/comparison': 'purchase.rfq.compare',
  '/purchase/orders': 'purchase.po.view',
  '/purchase/invoices': 'purchase.invoice.view',
  '/purchase/grn': 'purchase.grn.view',
  '/purchase/quality-inspections': 'purchase.quality.view',
  '/purchase/returns': 'purchase.return.view',
  '/purchase/vendor-performance': 'purchase.reports.view',
  '/purchase/reports': 'purchase.reports.view',
  '/purchase/setup': 'purchase.setup.view',
  '/purchase/masters': 'purchase.setup.view',
}

function demoPermissionsForRole(role: ErpRole): Set<string> | '*' {
  const pack = DEMO_PURCHASE_ROLE_PERMISSIONS[role]
  if (pack === '*') return '*'
  return new Set(pack)
}

function permissionSetIncludes(granted: readonly string[], required: string): boolean {
  if (granted.includes(required)) return true
  for (const g of granted) {
    const canonical = PURCHASE_PERMISSION_ALIASES[g]
    if (canonical === required) return true
  }
  const asCanonical = PURCHASE_PERMISSION_ALIASES[required]
  if (asCanonical && granted.includes(asCanonical)) return true
  return false
}

/**
 * Check a fine-grained purchase permission.
 * SECURITY: Enforced in the UI as a soft gate — backend must validate the same keys.
 */
export function canPurchasePermission(permission: PurchasePermission | string): boolean {
  if (isApiMode()) {
    const session = getStoredSession()
    const perms = session?.user.permissions ?? []
    if (permissionSetIncludes(perms, permission)) return true
    return hasPurchaseAdminRoleFallback(session)
  }
  const pack = demoPermissionsForRole(getSessionUser().role)
  if (pack === '*') return true
  if (pack instanceof Set) {
    return permissionSetIncludes([...pack], permission)
  }
  return false
}

/** Any purchase view access — controls Purchase shell / sidebar category. */
export function canAccessPurchaseShell(): boolean {
  return (
    canPurchasePermission('purchase.view')
    || canPurchasePermission('purchase.dashboard.view')
    || canPurchasePermission('purchase.pr.view')
    || canPurchasePermission('purchase.rfq.view')
    || canPurchasePermission('purchase.po.view')
    || canPurchasePermission('purchase.planning.view')
    || canPurchasePermission('purchase.grn.view')
    || canPurchasePermission('purchase.quality.view')
    || canPurchasePermission('purchase.invoice.view')
    || canPurchasePermission('purchase.return.view')
    || canPurchasePermission('purchase.reports.view')
    || canPurchasePermission('purchase.setup.manage')
  )
}

export function isPurchasePath(pathname: string): boolean {
  return pathname === '/purchase' || pathname.startsWith('/purchase/')
}

export function resolvePurchaseRoutePermission(pathname: string): {
  permission: PurchasePermission
  pageName: string
} | null {
  const sorted = [...PURCHASE_ROUTE_VIEW_PERMISSIONS].sort((a, b) => b.prefix.length - a.prefix.length)
  for (const entry of sorted) {
    if (pathname === entry.prefix || pathname.startsWith(`${entry.prefix}/`)) {
      return { permission: entry.permission, pageName: entry.pageName }
    }
  }
  return null
}

function canEnterPurchaseModule(): boolean {
  return (
    canPurchasePermission('purchase.view')
    || canPurchasePermission('purchase.dashboard.view')
    || canAccessPurchaseShell()
  )
}

export function canPurchaseRoute(pathname: string): boolean {
  if (!isPurchasePath(pathname)) return true
  if (pathname === '/purchase/approvals' || pathname.startsWith('/purchase/approvals/')) {
    return (
      canPurchasePermission('purchase.pr.approve')
      || canPurchasePermission('purchase.po.approve')
    )
  }
  const resolved = resolvePurchaseRoutePermission(pathname)
  if (!resolved) return canEnterPurchaseModule()
  if (resolved.permission === 'purchase.view') return canEnterPurchaseModule()
  return canPurchasePermission(resolved.permission)
}

export function canViewPurchaseNavItem(path: string): boolean {
  if (path === '/purchase/approvals') {
    return (
      canPurchasePermission('purchase.pr.approve')
      || canPurchasePermission('purchase.po.approve')
    )
  }
  const required = PURCHASE_NAV_ITEM_PERMISSIONS[path]
  if (!required) return canAccessPurchaseShell()
  if (required === 'purchase.view') return canEnterPurchaseModule()
  return canPurchasePermission(required)
}

export function getPurchasePermissionDenialReason(permission: PurchasePermission | string): string {
  return `Requires ${permission} — your role does not have this permission`
}

/**
 * Command-bar helper: hide when no permission; disable + tooltip when status blocks.
 * SECURITY: Does not replace API authorization.
 */
export function purchaseActionGate(opts: {
  permission: PurchasePermission
  statusAllowed: boolean
  statusBlockedReason?: string
}): { hidden: boolean; disabled: boolean; title?: string; disabledReason?: string } {
  const allowed = canPurchasePermission(opts.permission)
  if (!allowed) {
    const title = getPurchasePermissionDenialReason(opts.permission)
    return { hidden: true, disabled: true, title, disabledReason: title }
  }
  if (!opts.statusAllowed) {
    const title = opts.statusBlockedReason ?? 'Not available for the current document status'
    return { hidden: false, disabled: true, title, disabledReason: title }
  }
  return { hidden: false, disabled: false }
}

/** Merge permission + status gate into command-bar / row-action fields. */
export function withPurchaseActionGate<T extends { disabled?: boolean; disabledReason?: string; hidden?: boolean }>(
  action: T,
  opts: {
    permission: PurchasePermission
    statusAllowed: boolean
    statusBlockedReason?: string
    hideWhenStatusBlocked?: boolean
  },
): T & { hidden: boolean; disabled: boolean; disabledReason?: string } {
  const gate = purchaseActionGate(opts)
  if (gate.hidden) {
    return { ...action, hidden: true, disabled: true, disabledReason: gate.disabledReason }
  }
  if (!opts.statusAllowed && opts.hideWhenStatusBlocked) {
    return { ...action, hidden: true, disabled: true }
  }
  return {
    ...action,
    hidden: Boolean(action.hidden),
    disabled: Boolean(action.disabled) || gate.disabled,
    disabledReason: gate.disabled ? gate.disabledReason : action.disabledReason,
  }
}

/** Convenience flags for purchase pages — prefer over scattering string literals. */
export function usePurchasePermissions() {
  const role = getSessionUser().role
  return useMemo(() => {
    const can = (permission: PurchasePermission) => canPurchasePermission(permission)
    return {
      can,
      canViewModule: can('purchase.view') || can('purchase.dashboard.view'),
      canViewDashboard: can('purchase.dashboard.view') || can('purchase.view'),
      canViewRequisition: can('purchase.pr.view'),
      canCreateRequisition: can('purchase.pr.create'),
      canEditRequisition: can('purchase.pr.edit'),
      canSubmitRequisition: can('purchase.pr.submit'),
      canApproveRequisition: can('purchase.pr.approve'),
      canRejectRequisition: can('purchase.pr.reject'),
      canCancelRequisition: can('purchase.pr.cancel'),
      canReopenRequisition: can('purchase.pr.reopen'),
      canViewPlanning: can('purchase.planning.view'),
      canEditPlanning: can('purchase.planning.edit'),
      canAssignPlanningBuyer: can('purchase.planning.assign_buyer'),
      canSelectPlanningVendor: can('purchase.planning.select_vendor'),
      canApprovePlanning: can('purchase.planning.approve'),
      canCreatePoFromPlanning: can('purchase.planning.create_po'),
      canCancelPlanning: can('purchase.planning.cancel'),
      canViewRfq: can('purchase.rfq.view'),
      canCreateRfq: can('purchase.rfq.create'),
      canSendRfq: can('purchase.rfq.send'),
      canEnterQuote: can('purchase.rfq.enter_quote'),
      canViewQuotation: can('purchase.rfq.view') || can('purchase.rfq.enter_quote'),
      canCreateQuotation: can('purchase.rfq.enter_quote'),
      canCompareQuotation: can('purchase.rfq.compare'),
      canAwardRfq: can('purchase.rfq.award'),
      canConvertRfqToPo: can('purchase.rfq.convert_to_po'),
      canViewOrder: can('purchase.po.view'),
      canCreateOrder: can('purchase.po.create'),
      canEditOrder: can('purchase.po.edit'),
      canApproveOrder: can('purchase.po.approve'),
      canSendOrder: can('purchase.po.send'),
      canReleaseOrder: can('purchase.po.send'),
      canCancelOrder: can('purchase.po.cancel'),
      canCloseOrder: can('purchase.po.close'),
      canViewGrn: can('purchase.grn.view'),
      canCreateGrn: can('purchase.grn.create'),
      canPostGrn: can('purchase.grn.post'),
      canViewQuality: can('purchase.quality.view'),
      canInspectQuality: can('purchase.quality.inspect'),
      canViewInvoice: can('purchase.invoice.view'),
      canCreateInvoice: can('purchase.invoice.create'),
      canVerifyInvoice: can('purchase.invoice.verify'),
      canApproveInvoice: can('purchase.invoice.approve'),
      canPostInvoice: can('purchase.invoice.post'),
      canViewReturn: can('purchase.return.view'),
      canCreateReturn: can('purchase.return.create'),
      canPostReturn: can('purchase.return.post'),
      canViewReports: can('purchase.reports.view'),
      canManageSetup: can('purchase.setup.manage'),
      canAccessShell: canAccessPurchaseShell(),
    }
  }, [role])
}

/** Alias matching the brief — `canPurchase('purchase.po.approve')`. */
export function canPurchase(permission: PurchasePermission | string): boolean {
  return canPurchasePermission(permission)
}
