/**
 * Inventory & Warehouse fine-grained frontend permissions (Phase 1 + forward-compatible keys).
 * UI gating only — Backend authorization must enforce the same permission rules.
 */

import { useMemo } from 'react'
import { isApiMode } from '../../config/apiConfig'
import { getStoredSession } from '../../services/api/client'
import { getSessionUser, type ErpRole } from './index'
import { hasWorkspaceAdminRole } from './workspaceAdmin'

export const INVENTORY_PERMISSIONS = [
  'inventory.view',
  'inventory.view_cost',
  'inventory.items.view',
  'inventory.items.create',
  'inventory.items.edit',
  'inventory.items.deactivate',
  'inventory.stock.view',
  'inventory.view_audit',
  'inventory.receipts.view',
  'inventory.receipts.create',
  'inventory.receipts.edit',
  'inventory.receipts.post',
  'inventory.receipts.cancel',
  'inventory.quality.view',
  'inventory.quality.inspect',
  'inventory.quality.release',
  'inventory.quality.accept_deviation',
  'inventory.issues.view',
  'inventory.issues.create',
  'inventory.issues.edit',
  'inventory.issues.post',
  'inventory.issues.reverse',
  'inventory.issues.cancel',
  'inventory.issues.override_negative_stock',
  'inventory.transfers.view',
  'inventory.transfers.create',
  'inventory.transfers.dispatch',
  'inventory.transfers.receive',
  'inventory.transfers.cancel',
  'inventory.adjustments.view',
  'inventory.adjustments.create',
  'inventory.adjustments.submit',
  'inventory.adjustments.approve',
  'inventory.adjustments.post',
  'inventory.returns.view',
  'inventory.returns.create',
  'inventory.returns.post',
  'inventory.batch.view',
  'inventory.serial.view',
  'inventory.reservations.view',
  'inventory.reservations.manage',
  'inventory.view_item_ledger',
  'inventory.traceability.view',
  'inventory.planning.view',
  'inventory.reports.view',
  'inventory.setup.manage',
  'inventory.stock_count.view',
  'inventory.stock_count.create',
  'inventory.stock_count.count',
  'inventory.stock_count.reveal_system_quantity',
  'inventory.stock_count.review',
  'inventory.stock_count.request_recount',
  'inventory.stock_count.approve',
  'inventory.stock_count.post',
] as const

export type InventoryPermission = (typeof INVENTORY_PERMISSIONS)[number]

const ALL: InventoryPermission[] = [...INVENTORY_PERMISSIONS]

const STORE_USER: InventoryPermission[] = [
  'inventory.view',
  'inventory.items.view',
  'inventory.items.create',
  'inventory.items.edit',
  'inventory.stock.view',
  'inventory.receipts.view',
  'inventory.receipts.create',
  'inventory.receipts.edit',
  'inventory.issues.view',
  'inventory.issues.create',
  'inventory.issues.edit',
  'inventory.transfers.view',
  'inventory.transfers.create',
  'inventory.adjustments.view',
  'inventory.adjustments.create',
  'inventory.adjustments.submit',
  'inventory.returns.view',
  'inventory.returns.create',
  'inventory.planning.view',
  'inventory.reports.view',
  'inventory.stock_count.view',
  'inventory.stock_count.create',
  'inventory.stock_count.count',
]

const STORE_MANAGER: InventoryPermission[] = [...ALL]

const SHOP_FLOOR: InventoryPermission[] = [
  'inventory.view',
  'inventory.items.view',
  'inventory.stock.view',
  'inventory.receipts.view',
  'inventory.receipts.create',
  'inventory.issues.view',
  'inventory.issues.create',
  'inventory.transfers.view',
  'inventory.transfers.create',
  'inventory.transfers.dispatch',
  'inventory.transfers.receive',
]

const PLANNING: InventoryPermission[] = [
  'inventory.view',
  'inventory.items.view',
  'inventory.stock.view',
  'inventory.view_audit',
  'inventory.receipts.view',
  'inventory.issues.view',
  'inventory.transfers.view',
  'inventory.adjustments.view',
  'inventory.returns.view',
  'inventory.planning.view',
  'inventory.reports.view',
]

const AUDITOR: InventoryPermission[] = [
  'inventory.view',
  'inventory.items.view',
  'inventory.stock.view',
  'inventory.view_audit',
  'inventory.receipts.view',
  'inventory.issues.view',
  'inventory.transfers.view',
  'inventory.adjustments.view',
  'inventory.returns.view',
  'inventory.planning.view',
  'inventory.reports.view',
]

const ROLE_INVENTORY_PERMISSIONS: Partial<Record<ErpRole, InventoryPermission[]>> = {
  admin: ALL,
  ceo: ALL,
  director: ALL,
  store_manager: STORE_MANAGER,
  store_user: STORE_USER,
  stores: STORE_MANAGER,
  shop_floor: SHOP_FLOOR,
  production_supervisor: SHOP_FLOOR,
  production_head: [...SHOP_FLOOR, 'inventory.view_cost', 'inventory.issues.post'],
  planning_manager: [...PLANNING, 'inventory.view_cost'],
  planning: PLANNING,
  purchase_head: [
    'inventory.view', 'inventory.items.view', 'inventory.stock.view', 'inventory.view_cost',
    'inventory.receipts.view', 'inventory.receipts.create', 'inventory.returns.view', 'inventory.returns.create',
  ],
  purchase_user: ['inventory.view', 'inventory.items.view', 'inventory.stock.view', 'inventory.receipts.view', 'inventory.returns.view'],
  purchase: ['inventory.view', 'inventory.items.view', 'inventory.stock.view', 'inventory.receipts.view', 'inventory.returns.view'],
  quality_head: [
    'inventory.view', 'inventory.items.view', 'inventory.stock.view', 'inventory.view_audit',
    'inventory.receipts.view', 'inventory.quality.inspect', 'inventory.quality.release',
    'inventory.adjustments.view', 'inventory.adjustments.approve',
  ],
  quality_inspector: ['inventory.view', 'inventory.stock.view', 'inventory.receipts.view', 'inventory.quality.inspect'],
  quality: ['inventory.view', 'inventory.stock.view', 'inventory.receipts.view'],
  accounts_head: [...AUDITOR, 'inventory.view_cost', 'inventory.adjustments.approve', 'inventory.adjustments.post'],
  accounts_user: AUDITOR,
  accounts: AUDITOR,
}

const ROUTE_PERMISSION_MAP: Array<{ prefix: string; permission: InventoryPermission }> = [
  { prefix: '/inventory/setup', permission: 'inventory.setup.manage' },
  { prefix: '/inventory/reports', permission: 'inventory.reports.view' },
  { prefix: '/inventory/accounting', permission: 'inventory.view' },
  { prefix: '/inventory/planning', permission: 'inventory.planning.view' },
  { prefix: '/inventory/stock-count/new', permission: 'inventory.stock_count.create' },
  { prefix: '/inventory/stock-count', permission: 'inventory.stock_count.view' },
  { prefix: '/inventory/movements/transfers', permission: 'inventory.transfers.view' },
  { prefix: '/inventory/movements/adjustments', permission: 'inventory.adjustments.view' },
  { prefix: '/inventory/movements/returns', permission: 'inventory.returns.view' },
  { prefix: '/inventory/movements/receipts', permission: 'inventory.receipts.view' },
  { prefix: '/inventory/movements/issues', permission: 'inventory.issues.view' },
  { prefix: '/inventory/items/new', permission: 'inventory.items.create' },
  { prefix: '/inventory/items', permission: 'inventory.items.view' },
  { prefix: '/inventory/stock', permission: 'inventory.stock.view' },
  { prefix: '/inventory', permission: 'inventory.view' },
]

function rolePermissions(role: ErpRole): InventoryPermission[] {
  return ROLE_INVENTORY_PERMISSIONS[role] ?? ['inventory.view']
}

export function canInventoryPermission(permission: InventoryPermission, role?: ErpRole): boolean {
  if (isApiMode() && hasWorkspaceAdminRole()) return true
  if (isApiMode()) {
    const perms = getStoredSession()?.user.permissions ?? []
    if (perms.includes(permission)) return true
  }
  const r = role ?? getSessionUser().role
  if (r === 'admin' || r === 'ceo' || r === 'director') return true
  return rolePermissions(r).includes(permission)
}

export function canAccessInventoryShell(role?: ErpRole): boolean {
  return canInventoryPermission('inventory.view', role)
}

export function canViewInventoryNavItem(path: string, role?: ErpRole): boolean {
  const r = role ?? getSessionUser().role
  if (!canAccessInventoryShell(r)) return false
  const match = [...ROUTE_PERMISSION_MAP].sort((a, b) => b.prefix.length - a.prefix.length).find(
    (entry) => path === entry.prefix || path.startsWith(`${entry.prefix}/`),
  )
  if (!match) return true
  return canInventoryPermission(match.permission, r)
}

export function resolveInventoryRoutePermission(pathname: string): InventoryPermission | null {
  const match = [...ROUTE_PERMISSION_MAP].sort((a, b) => b.prefix.length - a.prefix.length).find(
    (entry) => pathname === entry.prefix || pathname.startsWith(`${entry.prefix}/`),
  )
  return match?.permission ?? null
}

export function useInventoryPermissions() {
  const role = getSessionUser().role
  return useMemo(
    () => ({
      role,
      canView: canInventoryPermission('inventory.view', role),
      canViewCost: canInventoryPermission('inventory.view_cost', role),
      canViewItems: canInventoryPermission('inventory.items.view', role),
      canCreateItem: canInventoryPermission('inventory.items.create', role),
      canEditItem: canInventoryPermission('inventory.items.edit', role),
      canDeactivateItem: canInventoryPermission('inventory.items.deactivate', role),
      canViewStock: canInventoryPermission('inventory.stock.view', role),
      canViewAudit: canInventoryPermission('inventory.view_audit', role),
      canViewReceipts: canInventoryPermission('inventory.receipts.view', role),
      canCreateReceipt: canInventoryPermission('inventory.receipts.create', role),
      canEditReceipt: canInventoryPermission('inventory.receipts.edit', role),
      canPostReceipt: canInventoryPermission('inventory.receipts.post', role),
      canCancelReceipt: canInventoryPermission('inventory.receipts.cancel', role),
      canInspectQuality: canInventoryPermission('inventory.quality.inspect', role),
      canReleaseQuality: canInventoryPermission('inventory.quality.release', role),
      canAcceptQualityDeviation: canInventoryPermission('inventory.quality.accept_deviation', role),
      canViewIssues: canInventoryPermission('inventory.issues.view', role),
      canCreateIssue: canInventoryPermission('inventory.issues.create', role),
      canEditIssue: canInventoryPermission('inventory.issues.edit', role),
      canPostIssue: canInventoryPermission('inventory.issues.post', role),
      canReverseIssue: canInventoryPermission('inventory.issues.reverse', role),
      canCancelIssue: canInventoryPermission('inventory.issues.cancel', role),
      canOverrideNegativeStock: canInventoryPermission('inventory.issues.override_negative_stock', role),
      canViewTransfers: canInventoryPermission('inventory.transfers.view', role),
      canCreateTransfer: canInventoryPermission('inventory.transfers.create', role),
      canDispatchTransfer: canInventoryPermission('inventory.transfers.dispatch', role),
      canReceiveTransfer: canInventoryPermission('inventory.transfers.receive', role),
      canCancelTransfer: canInventoryPermission('inventory.transfers.cancel', role),
      canViewAdjustments: canInventoryPermission('inventory.adjustments.view', role),
      canCreateAdjustment: canInventoryPermission('inventory.adjustments.create', role),
      canSubmitAdjustment: canInventoryPermission('inventory.adjustments.submit', role),
      canApproveAdjustment: canInventoryPermission('inventory.adjustments.approve', role),
      canPostAdjustment: canInventoryPermission('inventory.adjustments.post', role),
      canViewReturns: canInventoryPermission('inventory.returns.view', role),
      canCreateReturn: canInventoryPermission('inventory.returns.create', role),
      canPostReturn: canInventoryPermission('inventory.returns.post', role),
      canViewBatches: canInventoryPermission('inventory.batch.view', role),
      canViewSerials: canInventoryPermission('inventory.serial.view', role),
      canViewReservations: canInventoryPermission('inventory.reservations.view', role),
      canManageReservations: canInventoryPermission('inventory.reservations.manage', role),
      canViewItemLedger: canInventoryPermission('inventory.view_item_ledger', role),
      canViewTraceability: canInventoryPermission('inventory.traceability.view', role),
      canViewPlanning: canInventoryPermission('inventory.planning.view', role),
      canViewReports: canInventoryPermission('inventory.reports.view', role),
      canManageSetup: canInventoryPermission('inventory.setup.manage', role),
      canViewStockCount: canInventoryPermission('inventory.stock_count.view', role),
      canCreateStockCount: canInventoryPermission('inventory.stock_count.create', role),
      canCountStock: canInventoryPermission('inventory.stock_count.count', role),
      canRevealSystemQty: canInventoryPermission('inventory.stock_count.reveal_system_quantity', role),
      canReviewStockCount: canInventoryPermission('inventory.stock_count.review', role),
      canRequestRecount: canInventoryPermission('inventory.stock_count.request_recount', role),
      canApproveStockVariance: canInventoryPermission('inventory.stock_count.approve', role),
      canPostStockCount: canInventoryPermission('inventory.stock_count.post', role),
    }),
    [role],
  )
}

export function inventoryActionGate(
  permission: InventoryPermission,
  action: () => void,
  onDenied?: () => void,
): void {
  if (canInventoryPermission(permission)) action()
  else onDenied?.()
}

export function isInventoryPath(pathname: string): boolean {
  return pathname === '/inventory' || pathname.startsWith('/inventory/')
}
