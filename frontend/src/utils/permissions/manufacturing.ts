/**
 * Manufacturing fine-grained frontend permissions (UI planning / placeholder).
 * Gates actions and routes in the SPA only — backend authorization is not implemented yet.
 */

import { useMemo } from 'react'
import type { ManufacturingUiRole } from '../../types/manufacturingRoles'
import { getManufacturingUiRole, useManufacturingUiRole } from '../manufacturing/uiRoleStore'

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
  'manufacturing.routes.view',
  'manufacturing.routes.create',
  'manufacturing.routes.edit',
  'manufacturing.routes.activate',
  'manufacturing.work_orders.override_route',
] as const

export type ManufacturingPermission = (typeof MANUFACTURING_PERMISSIONS)[number]

const READ_BASE: ManufacturingPermission[] = [
  'manufacturing.view',
  'manufacturing.work_orders.view',
  'manufacturing.materials.view',
  'manufacturing.bom.view',
  'manufacturing.production_plan.view',
  'manufacturing.job_work.view',
  'manufacturing.routes.view',
]

/** 1. Owner / Management — dashboard, reports, all WOs, performance */
const OWNER: ManufacturingPermission[] = [
  ...READ_BASE,
  'manufacturing.dashboard.view',
  'manufacturing.quality.view',
  'manufacturing.reports.view',
  'manufacturing.reports.export',
  'manufacturing.cost.view',
  'manufacturing.variance.view',
  'manufacturing.bom.view_cost',
  'manufacturing.job_work.view_cost',
  'manufacturing.view_audit',
  'manufacturing.settings.view',
]

/** 2. Production Manager — plans, WOs, start/hold/complete/close */
const PRODUCTION_MANAGER: ManufacturingPermission[] = [
  ...READ_BASE,
  'manufacturing.dashboard.view',
  'manufacturing.bom.create',
  'manufacturing.bom.edit',
  'manufacturing.bom.activate',
  'manufacturing.bom.deactivate',
  'manufacturing.bom.view_cost',
  'manufacturing.production_plan.create_work_order',
  'manufacturing.work_orders.create',
  'manufacturing.work_orders.edit',
  'manufacturing.work_orders.start',
  'manufacturing.work_orders.hold',
  'manufacturing.work_orders.resume',
  'manufacturing.work_orders.cancel',
  'manufacturing.work_orders.close',
  'manufacturing.work_orders.close_with_difference',
  'manufacturing.work_orders.reopen',
  'manufacturing.materials.reserve',
  'manufacturing.materials.create_requirement',
  'manufacturing.production.complete',
  'manufacturing.production.complete_and_close',
  'manufacturing.scrap.record',
  'manufacturing.rework.manage',
  'manufacturing.quality.view',
  'manufacturing.cost.view',
  'manufacturing.variance.view',
  'manufacturing.job_work.create',
  'manufacturing.job_work.edit',
  'manufacturing.job_work.view_cost',
  'manufacturing.reports.view',
  'manufacturing.reports.export',
  'manufacturing.settings.view',
  'manufacturing.settings.manage',
  'manufacturing.view_audit',
  'manufacturing.routes.view',
  'manufacturing.routes.create',
  'manufacturing.routes.edit',
  'manufacturing.routes.activate',
  'manufacturing.work_orders.override_route',
]

/** 3. Supervisor — start, hold, resume, complete */
const SUPERVISOR: ManufacturingPermission[] = [
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
]

/** 4. Store User — material requirement, reserve, issue */
const STORE_USER: ManufacturingPermission[] = [
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

/** 5. QC User — QC pending, accept / reject / rework */
const QC_USER: ManufacturingPermission[] = [
  'manufacturing.view',
  'manufacturing.dashboard.view',
  'manufacturing.work_orders.view',
  'manufacturing.quality.view',
  'manufacturing.quality.inspect',
  'manufacturing.quality.accept_deviation',
  'manufacturing.rework.manage',
  'manufacturing.job_work.view',
]

/** 6. Job Work User — create, send, receive, reconcile */
const JOB_WORK_USER: ManufacturingPermission[] = [
  'manufacturing.view',
  'manufacturing.work_orders.view',
  'manufacturing.materials.view',
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
]

/** 7. Viewer — read-only */
const VIEWER: ManufacturingPermission[] = [
  ...READ_BASE,
  'manufacturing.dashboard.view',
  'manufacturing.quality.view',
  'manufacturing.reports.view',
  'manufacturing.cost.view',
  'manufacturing.settings.view',
]

const UI_ROLE_MAP: Record<ManufacturingUiRole, ManufacturingPermission[]> = {
  owner: OWNER,
  production_manager: PRODUCTION_MANAGER,
  supervisor: SUPERVISOR,
  store_user: STORE_USER,
  qc_user: QC_USER,
  job_work_user: JOB_WORK_USER,
  viewer: VIEWER,
}

const ROUTE_PERMISSION_MAP: Array<{ prefix: string; permission: ManufacturingPermission }> = [
  { prefix: '/manufacturing/routes', permission: 'manufacturing.routes.view' },
  { prefix: '/manufacturing/control-room', permission: 'manufacturing.dashboard.view' },
  { prefix: '/manufacturing/dashboard', permission: 'manufacturing.dashboard.view' },
  { prefix: '/manufacturing/bom', permission: 'manufacturing.bom.view' },
  { prefix: '/manufacturing/production-plan', permission: 'manufacturing.production_plan.view' },
  { prefix: '/manufacturing/shopfloor', permission: 'manufacturing.work_orders.view' },
  { prefix: '/manufacturing/work-orders', permission: 'manufacturing.work_orders.view' },
  { prefix: '/manufacturing/job-work', permission: 'manufacturing.job_work.view' },
  { prefix: '/manufacturing/reports', permission: 'manufacturing.reports.view' },
  { prefix: '/manufacturing/settings', permission: 'manufacturing.settings.view' },
  { prefix: '/manufacturing', permission: 'manufacturing.view' },
]

export function getManufacturingPermissionsForUiRole(role: ManufacturingUiRole): ManufacturingPermission[] {
  return UI_ROLE_MAP[role] ?? VIEWER
}

/** @deprecated Prefer getManufacturingPermissionsForUiRole — kept for any ErpRole callers */
export function getManufacturingPermissionsForRole(_role: string): ManufacturingPermission[] {
  return getManufacturingPermissionsForUiRole(getManufacturingUiRole())
}

export function canManufacturingPermission(
  permission: ManufacturingPermission,
  uiRole?: ManufacturingUiRole,
): boolean {
  const role = uiRole ?? getManufacturingUiRole()
  return getManufacturingPermissionsForUiRole(role).includes(permission)
}

export function canAccessManufacturingShell(uiRole?: ManufacturingUiRole): boolean {
  return canManufacturingPermission('manufacturing.view', uiRole)
}

export function canManufacturingRoute(pathname: string, uiRole?: ManufacturingUiRole): boolean {
  if (!canAccessManufacturingShell(uiRole)) return false
  const match = [...ROUTE_PERMISSION_MAP]
    .sort((a, b) => b.prefix.length - a.prefix.length)
    .find((entry) => pathname === entry.prefix || pathname.startsWith(`${entry.prefix}/`))
  if (!match) return true
  return canManufacturingPermission(match.permission, uiRole)
}

export function isManufacturingPath(pathname: string): boolean {
  return pathname === '/manufacturing' || pathname.startsWith('/manufacturing/')
}

export function isManufacturingUiReadOnly(uiRole?: ManufacturingUiRole): boolean {
  const role = uiRole ?? getManufacturingUiRole()
  return role === 'viewer' || role === 'owner'
}

export function useManufacturingPermissions() {
  const uiRole = useManufacturingUiRole()
  return useMemo(() => {
    const can = (p: ManufacturingPermission) => canManufacturingPermission(p, uiRole)
    return {
      /** Active manufacturing UI planning role (demo switcher). */
      role: uiRole,
      uiRole,
      isReadOnlyRole: isManufacturingUiReadOnly(uiRole),
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
      canViewRoute: can('manufacturing.routes.view'),
      canCreateRoute: can('manufacturing.routes.create'),
      canEditRoute: can('manufacturing.routes.edit'),
      canActivateRoute: can('manufacturing.routes.activate'),
      canOverrideRoute: can('manufacturing.work_orders.override_route'),
    }
  }, [uiRole])
}
