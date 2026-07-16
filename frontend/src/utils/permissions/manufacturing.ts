/**
 * Manufacturing fine-grained frontend permissions (Phases 1–4).
 * UI gating only — backend authorization must enforce the same permission rules.
 */

import { useMemo } from 'react'
import { getSessionUser, type ErpRole } from './index'

export const MANUFACTURING_PERMISSIONS = [
  'manufacturing.view',
  'manufacturing.dashboard.view',
  'manufacturing.bom.view',
  'manufacturing.bom.create',
  'manufacturing.bom.edit',
  'manufacturing.bom.activate',
  'manufacturing.bom.deactivate',
  'manufacturing.bom.view_cost',
  'manufacturing.production_plan.view',
  'manufacturing.production_plan.create_work_order',
  'manufacturing.view_audit',
  'manufacturing.work_orders.view',
  'manufacturing.work_orders.create',
  'manufacturing.work_orders.edit',
  'manufacturing.work_orders.start',
  'manufacturing.work_orders.hold',
  'manufacturing.work_orders.resume',
  'manufacturing.work_orders.cancel',
  'manufacturing.work_orders.close',
  'manufacturing.work_orders.close_with_difference',
  'manufacturing.work_orders.reopen',
  'manufacturing.materials.view',
  'manufacturing.materials.reserve',
  'manufacturing.materials.create_requirement',
  'manufacturing.materials.issue',
  'manufacturing.materials.return',
  'manufacturing.production.complete',
  'manufacturing.production.complete_and_close',
  'manufacturing.quality.view',
  'manufacturing.quality.inspect',
  'manufacturing.quality.accept_deviation',
  'manufacturing.scrap.record',
  'manufacturing.rework.manage',
  'manufacturing.cost.view',
  'manufacturing.variance.view',
  'manufacturing.job_work.view',
  'manufacturing.job_work.create',
  'manufacturing.job_work.edit',
  'manufacturing.job_work.dispatch',
  'manufacturing.job_work.receive',
  'manufacturing.job_work.return_material',
  'manufacturing.job_work.reconcile',
  'manufacturing.job_work.approve_difference',
  'manufacturing.job_work.link_invoice',
  'manufacturing.job_work.close',
  'manufacturing.job_work.cancel',
  'manufacturing.job_work.view_cost',
  'manufacturing.reports.view',
  'manufacturing.reports.export',
  'manufacturing.settings.view',
  'manufacturing.settings.manage',
] as const

export type ManufacturingPermission = (typeof MANUFACTURING_PERMISSIONS)[number]

const ALL: ManufacturingPermission[] = [...MANUFACTURING_PERMISSIONS]

const WO_CORE: ManufacturingPermission[] = [
  'manufacturing.view',
  'manufacturing.dashboard.view',
  'manufacturing.bom.view',
  'manufacturing.production_plan.view',
  'manufacturing.production_plan.create_work_order',
  'manufacturing.work_orders.view',
  'manufacturing.work_orders.create',
  'manufacturing.work_orders.edit',
  'manufacturing.work_orders.start',
  'manufacturing.work_orders.hold',
  'manufacturing.work_orders.resume',
  'manufacturing.work_orders.cancel',
  'manufacturing.work_orders.close',
  'manufacturing.work_orders.close_with_difference',
  'manufacturing.work_orders.reopen',
  'manufacturing.materials.view',
  'manufacturing.materials.reserve',
  'manufacturing.materials.create_requirement',
  'manufacturing.production.complete',
  'manufacturing.production.complete_and_close',
  'manufacturing.scrap.record',
  'manufacturing.rework.manage',
  'manufacturing.cost.view',
  'manufacturing.variance.view',
  'manufacturing.job_work.view',
  'manufacturing.job_work.create',
  'manufacturing.job_work.edit',
  'manufacturing.job_work.dispatch',
  'manufacturing.job_work.receive',
  'manufacturing.job_work.return_material',
  'manufacturing.job_work.reconcile',
  'manufacturing.job_work.approve_difference',
  'manufacturing.job_work.link_invoice',
  'manufacturing.job_work.close',
  'manufacturing.job_work.cancel',
  'manufacturing.job_work.view_cost',
  'manufacturing.reports.view',
  'manufacturing.reports.export',
  'manufacturing.settings.view',
  'manufacturing.view_audit',
]

const SHOP_FLOOR: ManufacturingPermission[] = [
  'manufacturing.view',
  'manufacturing.dashboard.view',
  'manufacturing.work_orders.view',
  'manufacturing.work_orders.start',
  'manufacturing.work_orders.hold',
  'manufacturing.work_orders.resume',
  'manufacturing.materials.view',
  'manufacturing.production.complete',
  'manufacturing.scrap.record',
  'manufacturing.job_work.view',
  'manufacturing.job_work.receive',
]

const PLANNING: ManufacturingPermission[] = [
  'manufacturing.view',
  'manufacturing.dashboard.view',
  'manufacturing.bom.view',
  'manufacturing.bom.create',
  'manufacturing.bom.edit',
  'manufacturing.bom.activate',
  'manufacturing.production_plan.view',
  'manufacturing.production_plan.create_work_order',
  'manufacturing.work_orders.view',
  'manufacturing.work_orders.create',
  'manufacturing.work_orders.edit',
  'manufacturing.materials.view',
  'manufacturing.job_work.view',
  'manufacturing.job_work.create',
  'manufacturing.job_work.edit',
  'manufacturing.reports.view',
  'manufacturing.view_audit',
]

const STORE: ManufacturingPermission[] = [
  'manufacturing.view',
  'manufacturing.work_orders.view',
  'manufacturing.materials.view',
  'manufacturing.materials.reserve',
  'manufacturing.materials.create_requirement',
  'manufacturing.materials.issue',
  'manufacturing.materials.return',
  'manufacturing.job_work.view',
  'manufacturing.job_work.dispatch',
  'manufacturing.job_work.return_material',
]

const QUALITY: ManufacturingPermission[] = [
  'manufacturing.view',
  'manufacturing.work_orders.view',
  'manufacturing.quality.view',
  'manufacturing.quality.inspect',
  'manufacturing.quality.accept_deviation',
  'manufacturing.rework.manage',
  'manufacturing.job_work.view',
  'manufacturing.job_work.receive',
]

const READ_ONLY: ManufacturingPermission[] = [
  'manufacturing.view',
  'manufacturing.dashboard.view',
  'manufacturing.bom.view',
  'manufacturing.production_plan.view',
  'manufacturing.work_orders.view',
  'manufacturing.materials.view',
  'manufacturing.job_work.view',
  'manufacturing.reports.view',
]

const ROLE_MAP: Partial<Record<ErpRole, ManufacturingPermission[]>> = {
  admin: ALL,
  ceo: [...READ_ONLY, 'manufacturing.cost.view', 'manufacturing.variance.view'],
  director: [...READ_ONLY, 'manufacturing.cost.view'],
  production_head: [...WO_CORE, 'manufacturing.settings.manage', 'manufacturing.bom.view', 'manufacturing.bom.create', 'manufacturing.bom.edit', 'manufacturing.bom.activate', 'manufacturing.bom.deactivate', 'manufacturing.bom.view_cost', 'manufacturing.quality.view', 'manufacturing.quality.inspect'],
  production_supervisor: WO_CORE,
  planning_manager: PLANNING,
  shop_floor: SHOP_FLOOR,
  engineering_head: [
    'manufacturing.view',
    'manufacturing.dashboard.view',
    'manufacturing.bom.view',
    'manufacturing.bom.create',
    'manufacturing.bom.edit',
    'manufacturing.bom.activate',
    'manufacturing.bom.deactivate',
    'manufacturing.bom.view_cost',
    'manufacturing.view_audit',
  ],
  store_manager: STORE,
  store_user: ['manufacturing.view', 'manufacturing.materials.view', 'manufacturing.materials.issue', 'manufacturing.materials.return', 'manufacturing.job_work.dispatch'],
  purchase_head: [...READ_ONLY, 'manufacturing.materials.create_requirement', 'manufacturing.job_work.link_invoice'],
  quality_head: QUALITY,
  sales_manager: READ_ONLY,
}

const ROUTE_PERMISSION_MAP: Array<{ prefix: string; permission: ManufacturingPermission }> = [
  { prefix: '/manufacturing/bom', permission: 'manufacturing.bom.view' },
  { prefix: '/manufacturing/production-plan', permission: 'manufacturing.production_plan.view' },
  { prefix: '/manufacturing/work-orders', permission: 'manufacturing.work_orders.view' },
  { prefix: '/manufacturing/job-work', permission: 'manufacturing.job_work.view' },
  { prefix: '/manufacturing/reports', permission: 'manufacturing.reports.view' },
  { prefix: '/manufacturing/settings', permission: 'manufacturing.settings.view' },
  { prefix: '/manufacturing', permission: 'manufacturing.dashboard.view' },
]

export function getManufacturingPermissionsForRole(role: ErpRole): ManufacturingPermission[] {
  return ROLE_MAP[role] ?? READ_ONLY
}

export function canManufacturingPermission(permission: ManufacturingPermission, role?: ErpRole): boolean {
  const r = role ?? getSessionUser().role
  if (r === 'admin') return true
  return getManufacturingPermissionsForRole(r).includes(permission)
}

export function canAccessManufacturingShell(role?: ErpRole): boolean {
  return canManufacturingPermission('manufacturing.view', role)
}

export function canManufacturingRoute(pathname: string, role?: ErpRole): boolean {
  if (!canAccessManufacturingShell(role)) return false
  const match = [...ROUTE_PERMISSION_MAP].sort((a, b) => b.prefix.length - a.prefix.length).find(
    (entry) => pathname === entry.prefix || pathname.startsWith(`${entry.prefix}/`),
  )
  if (!match) return true
  return canManufacturingPermission(match.permission, role)
}

export function isManufacturingPath(pathname: string): boolean {
  return pathname === '/manufacturing' || pathname.startsWith('/manufacturing/')
}

export function useManufacturingPermissions() {
  const role = getSessionUser().role
  return useMemo(() => {
    const can = (p: ManufacturingPermission) => canManufacturingPermission(p, role)
    return {
      role,
      canView: can('manufacturing.view'),
      canViewDashboard: can('manufacturing.dashboard.view'),
      canViewBom: can('manufacturing.bom.view'),
      canCreateBom: can('manufacturing.bom.create'),
      canEditBom: can('manufacturing.bom.edit'),
      canActivateBom: can('manufacturing.bom.activate'),
      canDeactivateBom: can('manufacturing.bom.deactivate'),
      canViewCost: can('manufacturing.cost.view') || can('manufacturing.bom.view_cost'),
      canViewPlan: can('manufacturing.production_plan.view'),
      canCreateWoFromPlan: can('manufacturing.production_plan.create_work_order'),
      canViewAudit: can('manufacturing.view_audit'),
      canViewWo: can('manufacturing.work_orders.view'),
      canCreateWo: can('manufacturing.work_orders.create'),
      canEditWo: can('manufacturing.work_orders.edit'),
      canStartWo: can('manufacturing.work_orders.start'),
      canHoldWo: can('manufacturing.work_orders.hold'),
      canResumeWo: can('manufacturing.work_orders.resume'),
      canCancelWo: can('manufacturing.work_orders.cancel'),
      canCloseWo: can('manufacturing.work_orders.close'),
      canCloseWoDiff: can('manufacturing.work_orders.close_with_difference'),
      canReopenWo: can('manufacturing.work_orders.reopen'),
      canViewMaterials: can('manufacturing.materials.view'),
      canReserveMaterials: can('manufacturing.materials.reserve'),
      canCreateRequirement: can('manufacturing.materials.create_requirement'),
      canIssueMaterials: can('manufacturing.materials.issue'),
      canReturnMaterials: can('manufacturing.materials.return'),
      canCompleteProduction: can('manufacturing.production.complete'),
      canCompleteAndClose: can('manufacturing.production.complete_and_close'),
      canViewQuality: can('manufacturing.quality.view'),
      canInspectQuality: can('manufacturing.quality.inspect'),
      canAcceptDeviation: can('manufacturing.quality.accept_deviation'),
      canRecordScrap: can('manufacturing.scrap.record'),
      canManageRework: can('manufacturing.rework.manage'),
      canViewVariance: can('manufacturing.variance.view'),
      canViewJobWork: can('manufacturing.job_work.view'),
      canCreateJobWork: can('manufacturing.job_work.create'),
      canEditJobWork: can('manufacturing.job_work.edit'),
      canDispatchJobWork: can('manufacturing.job_work.dispatch'),
      canReceiveJobWork: can('manufacturing.job_work.receive'),
      canReturnJobWorkMaterial: can('manufacturing.job_work.return_material'),
      canReconcileJobWork: can('manufacturing.job_work.reconcile'),
      canApproveJwDifference: can('manufacturing.job_work.approve_difference'),
      canLinkJwInvoice: can('manufacturing.job_work.link_invoice'),
      canCloseJobWork: can('manufacturing.job_work.close'),
      canCancelJobWork: can('manufacturing.job_work.cancel'),
      canViewJobWorkCost: can('manufacturing.job_work.view_cost'),
      canViewReports: can('manufacturing.reports.view'),
      canExportReports: can('manufacturing.reports.export'),
      canViewSettings: can('manufacturing.settings.view'),
      canManageSettings: can('manufacturing.settings.manage'),
    }
  }, [role])
}
