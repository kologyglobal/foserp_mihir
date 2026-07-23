/**
 * Manufacturing fine-grained frontend permissions (UI planning / placeholder).
 * Gates actions and routes in the SPA only — backend authorization is not implemented yet.
 */

import { useMemo } from 'react'
import type { ManufacturingUiRole } from '../../types/manufacturingRoles'
import { MANUFACTURING_UI_ROLES } from '../../types/manufacturingRoles'
import { getManufacturingUiRole, useManufacturingUiRole } from '../manufacturing/uiRoleStore'
import { isApiMode } from '../../config/apiConfig'
import { getStoredSession } from '../../services/api/client'
import { hasWorkspaceAdminRole } from './workspaceAdmin'

export const MANUFACTURING_PERMISSIONS = [
  'manufacturing.view',
  'manufacturing.dashboard.view',
  'manufacturing.bom.view',
  'manufacturing.bom.create',
  'manufacturing.bom.edit',
  'manufacturing.bom.import',
  'manufacturing.bom.activate',
  'manufacturing.bom.deactivate',
  'manufacturing.bom.view_cost',
  'manufacturing.production_plan.view',
  'manufacturing.production_plan.create',
  'manufacturing.production_plan.edit',
  'manufacturing.production_plan.release',
  'manufacturing.production_plan.close',
  'manufacturing.production_plan.create_work_order',
  // Phase 6A1 — Production Planning workbench (frontend-only; no backend enforcement yet)
  'manufacturing.production_plan.calculate',
  'manufacturing.production_plan.review',
  'manufacturing.production_plan.clone',
  'manufacturing.production_plan.suggestion_review',
  'manufacturing.unplanned_demand.view',
  'manufacturing.planning_exception.view',
  'manufacturing.planning_exception.acknowledge',
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
  'manufacturing.materials.transfer',
  'manufacturing.wip.move',
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
  'manufacturing.routes.validate',
  'manufacturing.routes.certify',
  'manufacturing.routes.version',
  'manufacturing.routes.close',
  'manufacturing.work_orders.override_route',
  // Phase 1 setup masters (backend-enforced — see docs/manufacturing/PRODUCTION_PHASE1_README.md)
  'manufacturing.setup.view',
  'manufacturing.profile.view',
  'manufacturing.profile.manage',
  'manufacturing.work_centre.view',
  'manufacturing.work_centre.manage',
  'manufacturing.machine.view',
  'manufacturing.machine.manage',
  // Phase 2A — production demands + work order execution (backend-enforced —
  // see docs/manufacturing/PRODUCTION_PHASE2A_README.md)
  'manufacturing.demand.view',
  'manufacturing.demand.create',
  'manufacturing.demand.convert',
  'manufacturing.work_orders.release',
  'manufacturing.work_orders.assign',
  'manufacturing.stage.view',
  'manufacturing.stage.execute',
  'manufacturing.progress.record',
  'manufacturing.progress.correct',
  'manufacturing.timeline.view',
  'manufacturing.control_room.view',
  // Phase 2B — assignments, operator my-work, daily production, issues (backend-enforced)
  'manufacturing.daily_production.view',
  'manufacturing.daily_production.create',
  'manufacturing.daily_production.submit',
  'manufacturing.assignment.view',
  'manufacturing.assignment.manage',
  'manufacturing.assignment.reassign',
  'manufacturing.operator.my_work',
  'manufacturing.operator.start',
  'manufacturing.operator.pause',
  'manufacturing.operator.complete',
  'manufacturing.issue.view',
  'manufacturing.issue.report',
  'manufacturing.issue.acknowledge',
  'manufacturing.issue.resolve',
  'manufacturing.downtime.view',
  'manufacturing.downtime.manage',
  'manufacturing.runtime_change.view',
  'manufacturing.runtime_change.request',
  'manufacturing.runtime_change.apply',
  'manufacturing.runtime_change.approve',
  'manufacturing.runtime_change.reject',
  'manufacturing.runtime_change.quantity',
  'manufacturing.runtime_change.schedule',
  'manufacturing.runtime_change.assignment',
  'manufacturing.runtime_change.machine',
  'manufacturing.runtime_change.work_centre',
  'manufacturing.runtime_change.route',
  'manufacturing.runtime_change.skip',
  'manufacturing.runtime_change.job_work',
  'manufacturing.runtime_change.hold',
  'manufacturing.runtime_change.admin',
  // Phase 5C — transaction corrections / reversals
  'manufacturing.correction.view',
  'manufacturing.correction.request',
  'manufacturing.correction.apply',
  'manufacturing.correction.approve',
  'manufacturing.correction.reject',
  'manufacturing.correction.admin',
  'manufacturing.correction.reverse.progress',
  'manufacturing.correction.reverse.material_issue',
  'manufacturing.correction.reverse.material_return',
  'manufacturing.correction.reverse.wip',
  'manufacturing.correction.reverse.daily_production',
  'manufacturing.correction.reverse.job_work',
  // Phase 7A — store workbench / warehouse / FG
  'manufacturing.store_workbench.view',
  'manufacturing.warehouse_mapping.view',
  'manufacturing.warehouse_mapping.manage',
  'manufacturing.material_position.view',
  'manufacturing.fg_receipt.view',
  'manufacturing.fg_receipt.create',
  'manufacturing.fg_receipt.post',
  'manufacturing.work_order.close_readiness',
  // Phase 7D — ops reporting (shopfloor live, exceptions, traceability)
  'manufacturing.reports.shopfloor.view',
  'manufacturing.traceability.view',
  'manufacturing.exceptions.view',
  'manufacturing.exceptions.acknowledge',
  // Phase 7E — work-order costing + manufacturing accounting (backend-enforced —
  // see docs/manufacturing/PRODUCTION_PHASE7E_README.md)
  'manufacturing.cost.calculate',
  'manufacturing.cost.details',
  'manufacturing.cost.provisional_view',
  'manufacturing.costing_policy.view',
  'manufacturing.costing_policy.manage',
  'manufacturing.accounting.view',
  'manufacturing.accounting.validate',
  'manufacturing.accounting.post',
  'manufacturing.accounting.retry',
  'manufacturing.accounting.financial_close',
  'manufacturing.accounting.reconcile',
] as const

export type ManufacturingPermission = (typeof MANUFACTURING_PERMISSIONS)[number]

const READ_BASE: ManufacturingPermission[] = [
  'manufacturing.view',
  'manufacturing.work_orders.view',
  'manufacturing.materials.view',
  'manufacturing.bom.view',
  'manufacturing.production_plan.view',
  'manufacturing.unplanned_demand.view',
  'manufacturing.planning_exception.view',
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
  'manufacturing.setup.view',
  'manufacturing.profile.view',
  'manufacturing.work_centre.view',
  'manufacturing.machine.view',
  'manufacturing.demand.view',
  'manufacturing.stage.view',
  'manufacturing.timeline.view',
  'manufacturing.control_room.view',
  'manufacturing.daily_production.view',
  'manufacturing.assignment.view',
  'manufacturing.issue.view',
  'manufacturing.downtime.view',
  'manufacturing.correction.view',
  'manufacturing.store_workbench.view',
  'manufacturing.warehouse_mapping.view',
  'manufacturing.material_position.view',
  'manufacturing.fg_receipt.view',
  'manufacturing.work_order.close_readiness',
  'manufacturing.production_plan.review',
  'manufacturing.production_plan.suggestion_review',
  'manufacturing.reports.shopfloor.view',
  'manufacturing.traceability.view',
  'manufacturing.exceptions.view',
  'manufacturing.exceptions.acknowledge',
  'manufacturing.cost.details',
  'manufacturing.cost.provisional_view',
  'manufacturing.costing_policy.view',
  'manufacturing.accounting.view',
  'manufacturing.accounting.reconcile',
]

/** 2. Production Manager — plans, WOs, start/hold/complete/close */
const PRODUCTION_MANAGER: ManufacturingPermission[] = [
  ...READ_BASE,
  'manufacturing.dashboard.view',
  'manufacturing.bom.create',
  'manufacturing.bom.edit',
  'manufacturing.bom.import',
  'manufacturing.bom.activate',
  'manufacturing.bom.deactivate',
  'manufacturing.bom.view_cost',
  'manufacturing.production_plan.create',
  'manufacturing.production_plan.edit',
  'manufacturing.production_plan.release',
  'manufacturing.production_plan.close',
  'manufacturing.production_plan.create_work_order',
  'manufacturing.production_plan.calculate',
  'manufacturing.production_plan.review',
  'manufacturing.production_plan.clone',
  'manufacturing.production_plan.suggestion_review',
  'manufacturing.planning_exception.acknowledge',
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
  'manufacturing.materials.transfer',
  'manufacturing.wip.move',
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
  'manufacturing.routes.validate',
  'manufacturing.routes.certify',
  'manufacturing.routes.version',
  'manufacturing.routes.close',
  'manufacturing.work_orders.override_route',
  'manufacturing.setup.view',
  'manufacturing.profile.view',
  'manufacturing.profile.manage',
  'manufacturing.work_centre.view',
  'manufacturing.work_centre.manage',
  'manufacturing.machine.view',
  'manufacturing.machine.manage',
  'manufacturing.demand.view',
  'manufacturing.demand.create',
  'manufacturing.demand.convert',
  'manufacturing.work_orders.release',
  'manufacturing.work_orders.assign',
  'manufacturing.stage.view',
  'manufacturing.stage.execute',
  'manufacturing.progress.record',
  'manufacturing.progress.correct',
  'manufacturing.timeline.view',
  'manufacturing.control_room.view',
  'manufacturing.daily_production.view',
  'manufacturing.daily_production.create',
  'manufacturing.daily_production.submit',
  'manufacturing.assignment.view',
  'manufacturing.assignment.manage',
  'manufacturing.assignment.reassign',
  'manufacturing.operator.my_work',
  'manufacturing.operator.start',
  'manufacturing.operator.pause',
  'manufacturing.operator.complete',
  'manufacturing.issue.view',
  'manufacturing.issue.report',
  'manufacturing.issue.acknowledge',
  'manufacturing.issue.resolve',
  'manufacturing.downtime.view',
  'manufacturing.downtime.manage',
  'manufacturing.correction.view',
  'manufacturing.correction.request',
  'manufacturing.correction.apply',
  'manufacturing.correction.approve',
  'manufacturing.correction.reject',
  'manufacturing.correction.reverse.progress',
  'manufacturing.correction.reverse.material_issue',
  'manufacturing.correction.reverse.wip',
  'manufacturing.correction.reverse.daily_production',
  'manufacturing.store_workbench.view',
  'manufacturing.warehouse_mapping.view',
  'manufacturing.warehouse_mapping.manage',
  'manufacturing.material_position.view',
  'manufacturing.fg_receipt.view',
  'manufacturing.fg_receipt.create',
  'manufacturing.fg_receipt.post',
  'manufacturing.work_order.close_readiness',
  'manufacturing.reports.shopfloor.view',
  'manufacturing.traceability.view',
  'manufacturing.exceptions.view',
  'manufacturing.exceptions.acknowledge',
  'manufacturing.cost.calculate',
  'manufacturing.cost.details',
  'manufacturing.cost.provisional_view',
  'manufacturing.costing_policy.view',
  'manufacturing.accounting.view',
  'manufacturing.accounting.validate',
]
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
  'manufacturing.demand.view',
  'manufacturing.stage.view',
  'manufacturing.stage.execute',
  'manufacturing.progress.record',
  'manufacturing.timeline.view',
  'manufacturing.control_room.view',
  'manufacturing.work_orders.assign',
  'manufacturing.daily_production.view',
  'manufacturing.daily_production.create',
  'manufacturing.daily_production.submit',
  'manufacturing.assignment.view',
  'manufacturing.assignment.manage',
  'manufacturing.assignment.reassign',
  'manufacturing.operator.my_work',
  'manufacturing.operator.start',
  'manufacturing.operator.pause',
  'manufacturing.operator.complete',
  'manufacturing.issue.view',
  'manufacturing.issue.report',
  'manufacturing.issue.acknowledge',
  'manufacturing.issue.resolve',
  'manufacturing.downtime.view',
  'manufacturing.downtime.manage',
  'manufacturing.correction.view',
  'manufacturing.correction.request',
  'manufacturing.reports.shopfloor.view',
  'manufacturing.exceptions.view',
  'manufacturing.exceptions.acknowledge',
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
  'manufacturing.materials.transfer',
  'manufacturing.wip.move',
  'manufacturing.store_workbench.view',
  'manufacturing.warehouse_mapping.view',
  'manufacturing.material_position.view',
  'manufacturing.fg_receipt.view',
  'manufacturing.fg_receipt.create',
  'manufacturing.fg_receipt.post',
  'manufacturing.work_order.close_readiness',
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
  'manufacturing.setup.view',
  'manufacturing.profile.view',
  'manufacturing.work_centre.view',
  'manufacturing.machine.view',
  'manufacturing.demand.view',
  'manufacturing.stage.view',
  'manufacturing.timeline.view',
  'manufacturing.control_room.view',
  'manufacturing.daily_production.view',
  'manufacturing.assignment.view',
  'manufacturing.issue.view',
  'manufacturing.downtime.view',
  'manufacturing.correction.view',
  'manufacturing.store_workbench.view',
  'manufacturing.warehouse_mapping.view',
  'manufacturing.material_position.view',
  'manufacturing.fg_receipt.view',
  'manufacturing.reports.shopfloor.view',
  'manufacturing.traceability.view',
  'manufacturing.exceptions.view',
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

/**
 * Map session ErpRole / legacy aliases onto manufacturing UI roles.
 * `production_head` ≡ production manager (plans, BOM create, WO lifecycle).
 */
const ERP_ROLE_TO_MFG_UI: Record<string, ManufacturingUiRole> = {
  owner: 'owner',
  admin: 'owner',
  ceo: 'owner',
  director: 'owner',
  management: 'owner',
  production_manager: 'production_manager',
  production_head: 'production_manager',
  production: 'production_manager',
  planning_manager: 'production_manager',
  production_supervisor: 'supervisor',
  shop_floor: 'supervisor',
  store_manager: 'store_user',
  store_user: 'store_user',
  stores: 'store_user',
  quality_head: 'qc_user',
  quality_inspector: 'qc_user',
  quality: 'qc_user',
  job_work_user: 'job_work_user',
  viewer: 'viewer',
}

export function resolveManufacturingUiRole(
  role?: ManufacturingUiRole | string | null,
): ManufacturingUiRole {
  if (!role) return getManufacturingUiRole()
  if ((MANUFACTURING_UI_ROLES as readonly string[]).includes(role)) {
    return role as ManufacturingUiRole
  }
  return ERP_ROLE_TO_MFG_UI[role] ?? 'viewer'
}

const ROUTE_PERMISSION_MAP: Array<{ prefix: string; permission: ManufacturingPermission }> = [
  { prefix: '/manufacturing/setup/boms', permission: 'manufacturing.bom.view' },
  { prefix: '/manufacturing/setup/routings', permission: 'manufacturing.routes.view' },
  { prefix: '/manufacturing/setup', permission: 'manufacturing.setup.view' },
  { prefix: '/manufacturing/profiles', permission: 'manufacturing.profile.view' },
  { prefix: '/manufacturing/work-centres', permission: 'manufacturing.work_centre.view' },
  { prefix: '/manufacturing/machines', permission: 'manufacturing.machine.view' },
  { prefix: '/manufacturing/routes', permission: 'manufacturing.routes.view' },
  { prefix: '/manufacturing/control-room', permission: 'manufacturing.dashboard.view' },
  { prefix: '/manufacturing/guided-fulfilment', permission: 'manufacturing.dashboard.view' },
  { prefix: '/manufacturing/today', permission: 'manufacturing.control_room.view' },
  { prefix: '/manufacturing/daily-update', permission: 'manufacturing.daily_production.view' },
  { prefix: '/manufacturing/my-work', permission: 'manufacturing.operator.my_work' },
  { prefix: '/manufacturing/issues', permission: 'manufacturing.issue.view' },
  { prefix: '/manufacturing/corrections', permission: 'manufacturing.correction.view' },
  { prefix: '/manufacturing/store-workbench', permission: 'manufacturing.store_workbench.view' },
  { prefix: '/manufacturing/dashboard', permission: 'manufacturing.dashboard.view' },
  { prefix: '/manufacturing/bom', permission: 'manufacturing.bom.view' },
  { prefix: '/manufacturing/production-plan', permission: 'manufacturing.production_plan.view' },
  // Phase 6A1 — Production Planning workbench (distinct from legacy /production-plan netting workbench)
  { prefix: '/manufacturing/planning/unplanned-demand', permission: 'manufacturing.unplanned_demand.view' },
  { prefix: '/manufacturing/planning/exceptions', permission: 'manufacturing.planning_exception.view' },
  { prefix: '/manufacturing/planning', permission: 'manufacturing.production_plan.view' },
  { prefix: '/manufacturing/production-plans', permission: 'manufacturing.production_plan.view' },
  { prefix: '/manufacturing/shopfloor', permission: 'manufacturing.work_orders.view' },
  { prefix: '/manufacturing/traceability', permission: 'manufacturing.traceability.view' },
  { prefix: '/manufacturing/work-orders', permission: 'manufacturing.work_orders.view' },
  { prefix: '/manufacturing/job-work', permission: 'manufacturing.job_work.view' },
  { prefix: '/manufacturing/reports', permission: 'manufacturing.reports.view' },
  { prefix: '/manufacturing/settings', permission: 'manufacturing.settings.view' },
  { prefix: '/manufacturing', permission: 'manufacturing.view' },
]

export function getManufacturingPermissionsForUiRole(
  role: ManufacturingUiRole | string,
): ManufacturingPermission[] {
  return UI_ROLE_MAP[resolveManufacturingUiRole(role)] ?? VIEWER
}

/** @deprecated Prefer getManufacturingPermissionsForUiRole — kept for any ErpRole callers */
export function getManufacturingPermissionsForRole(_role: string): ManufacturingPermission[] {
  return getManufacturingPermissionsForUiRole(getManufacturingUiRole())
}

export function canManufacturingPermission(
  permission: ManufacturingPermission,
  uiRole?: ManufacturingUiRole | string,
): boolean {
  if (isApiMode() && hasWorkspaceAdminRole()) return true
  if (isApiMode()) {
    const perms = getStoredSession()?.user.permissions ?? []
    if (perms.includes(permission)) return true
    // Legacy route-matrix shell key also opens the manufacturing module shell.
    if (
      permission === 'manufacturing.view'
      && (perms.includes('production.view') || perms.includes('manufacturing.view'))
    ) {
      return true
    }
  }
  const role = resolveManufacturingUiRole(uiRole)
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

export function isManufacturingUiReadOnly(uiRole?: ManufacturingUiRole | string): boolean {
  const role = resolveManufacturingUiRole(uiRole)
  return role === 'viewer' || role === 'owner'
}

type RuntimeChangePermission = Extract<ManufacturingPermission, `manufacturing.runtime_change.${string}`>

/**
 * Runtime-change APIs are API-mode only. API mode must use the authenticated
 * permission set; demo-mode retains the manufacturing UI-role fallback.
 */
function canRuntimeChangePermission(permission: RuntimeChangePermission, uiRole?: ManufacturingUiRole): boolean {
  if (isApiMode()) {
    if (hasWorkspaceAdminRole()) return true
    const permissions = getStoredSession()?.user.permissions ?? []
    return permissions.includes('manufacturing.runtime_change.admin') || permissions.includes(permission)
  }
  return canManufacturingPermission(permission, uiRole)
}

export const canViewRuntimeChanges = (uiRole?: ManufacturingUiRole) => canRuntimeChangePermission('manufacturing.runtime_change.view', uiRole)
export const canRequestRuntimeChange = (uiRole?: ManufacturingUiRole) => canRuntimeChangePermission('manufacturing.runtime_change.request', uiRole)
export const canApplyRuntimeChange = (uiRole?: ManufacturingUiRole) => canRuntimeChangePermission('manufacturing.runtime_change.apply', uiRole)
export const canApproveRuntimeChange = (uiRole?: ManufacturingUiRole) => canRuntimeChangePermission('manufacturing.runtime_change.approve', uiRole)
export const canRejectRuntimeChange = (uiRole?: ManufacturingUiRole) => canRuntimeChangePermission('manufacturing.runtime_change.reject', uiRole)
export const canRequestQuantityChange = (uiRole?: ManufacturingUiRole) => canRequestRuntimeChange(uiRole) && canRuntimeChangePermission('manufacturing.runtime_change.quantity', uiRole)
export const canRequestScheduleChange = (uiRole?: ManufacturingUiRole) => canRequestRuntimeChange(uiRole) && canRuntimeChangePermission('manufacturing.runtime_change.schedule', uiRole)
export const canRequestDueDateChange = canRequestScheduleChange
export const canRequestPriorityChange = canRequestScheduleChange
export const canRequestAssignmentChange = (uiRole?: ManufacturingUiRole) => canRequestRuntimeChange(uiRole) && canRuntimeChangePermission('manufacturing.runtime_change.assignment', uiRole)
export const canRequestSupervisorChange = canRequestAssignmentChange
export const canRequestOperatorChange = canRequestAssignmentChange
export const canRequestMachineChange = (uiRole?: ManufacturingUiRole) => canRequestRuntimeChange(uiRole) && canRuntimeChangePermission('manufacturing.runtime_change.machine', uiRole)
export const canRequestWorkCentreChange = (uiRole?: ManufacturingUiRole) => canRequestRuntimeChange(uiRole) && canRuntimeChangePermission('manufacturing.runtime_change.work_centre', uiRole)
export const canRequestRouteChange = (uiRole?: ManufacturingUiRole) => canRequestRuntimeChange(uiRole) && canRuntimeChangePermission('manufacturing.runtime_change.route', uiRole)
export const canRequestAddOperationChange = canRequestRouteChange
export const canRequestRepeatOperationChange = canRequestRouteChange
export const canRequestSkipChange = (uiRole?: ManufacturingUiRole) => canRequestRuntimeChange(uiRole) && canRuntimeChangePermission('manufacturing.runtime_change.skip', uiRole)
export const canRequestSkipOperationChange = canRequestSkipChange
export const canRequestJobWorkChange = (uiRole?: ManufacturingUiRole) => canRequestRuntimeChange(uiRole) && canRuntimeChangePermission('manufacturing.runtime_change.job_work', uiRole)
export const canRequestConvertToJobWorkChange = canRequestJobWorkChange
export const canRequestHoldChange = (uiRole?: ManufacturingUiRole) => canRequestRuntimeChange(uiRole) && canRuntimeChangePermission('manufacturing.runtime_change.hold', uiRole)
export const canRequestWorkOrderHoldChange = canRequestHoldChange
export const canRequestWorkOrderResumeChange = canRequestHoldChange
export const canRequestStageHoldChange = canRequestHoldChange
export const canRequestStageResumeChange = canRequestHoldChange

/** Phase 5B WIP / material transfer — API mode uses session permissions. */
export const canMoveWip = (uiRole?: ManufacturingUiRole) => canManufacturingPermission('manufacturing.wip.move', uiRole)
export const canTransferMaterials = (uiRole?: ManufacturingUiRole) => canManufacturingPermission('manufacturing.materials.transfer', uiRole)

type CorrectionPermission = Extract<ManufacturingPermission, `manufacturing.correction.${string}`>

/**
 * Correction APIs are API-mode only. Soft-gate primarily on correction.*;
 * type-specific reverse keys refine the UI but do not hard-block when missing.
 */
function canCorrectionPermission(permission: CorrectionPermission, uiRole?: ManufacturingUiRole): boolean {
  if (isApiMode()) {
    if (hasWorkspaceAdminRole()) return true
    const permissions = getStoredSession()?.user.permissions ?? []
    return permissions.includes('manufacturing.correction.admin') || permissions.includes(permission)
  }
  return canManufacturingPermission(permission, uiRole)
}

export const canViewCorrections = (uiRole?: ManufacturingUiRole) =>
  canCorrectionPermission('manufacturing.correction.view', uiRole)
export const canRequestCorrection = (uiRole?: ManufacturingUiRole) =>
  canCorrectionPermission('manufacturing.correction.request', uiRole)
export const canApplyCorrection = (uiRole?: ManufacturingUiRole) =>
  canCorrectionPermission('manufacturing.correction.apply', uiRole)
export const canApproveCorrection = (uiRole?: ManufacturingUiRole) =>
  canCorrectionPermission('manufacturing.correction.approve', uiRole)
export const canRejectCorrection = (uiRole?: ManufacturingUiRole) =>
  canCorrectionPermission('manufacturing.correction.reject', uiRole)

/** Phase 7A5 — Store workbench (API mode uses session permissions). */
export const canViewStoreWorkbench = (uiRole?: ManufacturingUiRole) =>
  canManufacturingPermission('manufacturing.store_workbench.view', uiRole)

/**
 * Phase 7D — ops reporting (shopfloor live board, traceability, operations exceptions).
 * Soft-gate on the dedicated fine-grained permission OR the broader read permission that
 * already covers this surface today, so existing roles are not locked out by the new keys.
 */
export const canViewShopfloorLive = (uiRole?: ManufacturingUiRole) =>
  canManufacturingPermission('manufacturing.reports.shopfloor.view', uiRole)
  || canManufacturingPermission('manufacturing.work_orders.view', uiRole)
export const canViewTraceability = (uiRole?: ManufacturingUiRole) =>
  canManufacturingPermission('manufacturing.traceability.view', uiRole)
  || canManufacturingPermission('manufacturing.work_orders.view', uiRole)
export const canViewExceptions = (uiRole?: ManufacturingUiRole) =>
  canManufacturingPermission('manufacturing.exceptions.view', uiRole)
  || canManufacturingPermission('manufacturing.view', uiRole)
export const canAcknowledgeException = (uiRole?: ManufacturingUiRole) =>
  canManufacturingPermission('manufacturing.exceptions.acknowledge', uiRole)

const CORRECTION_TYPE_REVERSE_KEYS: Record<string, CorrectionPermission> = {
  PROGRESS: 'manufacturing.correction.reverse.progress',
  MATERIAL_ISSUE: 'manufacturing.correction.reverse.material_issue',
  MATERIAL_RETURN: 'manufacturing.correction.reverse.material_return',
  WIP_MOVEMENT: 'manufacturing.correction.reverse.wip',
  DAILY_PRODUCTION: 'manufacturing.correction.reverse.daily_production',
  JOB_WORK: 'manufacturing.correction.reverse.job_work',
}

/** Soft type gate — requires request; type reverse key preferred but not mandatory. */
export function canRequestCorrectionOfType(transactionType: string, uiRole?: ManufacturingUiRole): boolean {
  if (!canRequestCorrection(uiRole)) return false
  const typeKey = CORRECTION_TYPE_REVERSE_KEYS[transactionType]
  if (!typeKey) return true
  if (canCorrectionPermission(typeKey, uiRole)) return true
  // Soft: still allow when user has correction.request even without the type key
  return true
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
      canCreatePlan: can('manufacturing.production_plan.create'),
      canEditPlan: can('manufacturing.production_plan.edit'),
      canReleasePlan: can('manufacturing.production_plan.release'),
      canClosePlan: can('manufacturing.production_plan.close'),
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
      canViewStoreWorkbench: can('manufacturing.store_workbench.view'),
      canViewShopfloorLive: canViewShopfloorLive(uiRole),
      canViewTraceability: canViewTraceability(uiRole),
      canViewExceptions: canViewExceptions(uiRole),
      canAcknowledgeException: canAcknowledgeException(uiRole),
    }
  }, [uiRole])
}

/**
 * Phase 1 setup permissions — work centres, machines, BOMs, routings, profiles.
 * API mode: reads real session permissions (`getStoredSession().user.permissions`).
 * Demo mode: derives from the manufacturing UI role switcher (owner/manager get manage;
 * everyone else gets view only) since there is no backend session to read from.
 */
export function useManufacturingSetupPermissions() {
  const uiRole = useManufacturingUiRole()
  return useMemo(() => {
    const can = (p: ManufacturingPermission) => canManufacturingPermission(p, uiRole)
    return {
      canViewSetup: can('manufacturing.setup.view'),
      canManageProfile: can('manufacturing.profile.manage'),
      canViewProfile: can('manufacturing.profile.view'),
      canManageBom: can('manufacturing.bom.create') || can('manufacturing.bom.edit'),
      canImportBom: can('manufacturing.bom.import'),
      canActivateBom: can('manufacturing.bom.activate'),
      canManageRouting: can('manufacturing.routes.create') || can('manufacturing.routes.edit'),
      canActivateRouting: can('manufacturing.routes.activate'),
      canValidateRouting:
        can('manufacturing.routes.validate') || can('manufacturing.routes.edit'),
      canCertifyRouting:
        can('manufacturing.routes.certify') || can('manufacturing.routes.activate'),
      canVersionRouting:
        can('manufacturing.routes.version') || can('manufacturing.routes.create'),
      canCloseRouting:
        can('manufacturing.routes.close') || can('manufacturing.routes.activate'),
      canManageWorkCentre: can('manufacturing.work_centre.manage'),
      canViewWorkCentre: can('manufacturing.work_centre.view'),
      canManageMachine: can('manufacturing.machine.manage'),
      canViewMachine: can('manufacturing.machine.view'),
    }
  }, [uiRole])
}

/**
 * Phase 2A work order execution permissions — demands, work order lifecycle, stage progress.
 * API mode: reads real session permissions. Demo mode: derives from the manufacturing UI role
 * switcher, same as {@link useManufacturingSetupPermissions}.
 */
export function useManufacturingWorkOrderPermissions() {
  const uiRole = useManufacturingUiRole()
  return useMemo(() => {
    const can = (p: ManufacturingPermission) => canManufacturingPermission(p, uiRole)
    return {
      canViewWo: can('manufacturing.work_orders.view'),
      canCreateWo: can('manufacturing.work_orders.create'),
      canSplitWo: can('manufacturing.work_orders.edit') || can('manufacturing.work_orders.create'),
      canRelease: can('manufacturing.work_orders.release'),
      canAssign: can('manufacturing.work_orders.assign'),
      canStart: can('manufacturing.work_orders.start'),
      canProgress: can('manufacturing.progress.record'),
      canCorrectProgress: can('manufacturing.progress.correct'),
      canHold: can('manufacturing.work_orders.hold'),
      canResume: can('manufacturing.work_orders.resume'),
      canComplete: can('manufacturing.production.complete'),
      canCancel: can('manufacturing.work_orders.cancel'),
      canViewDemand: can('manufacturing.demand.view'),
      canCreateDemand: can('manufacturing.demand.create'),
      canConvertDemand: can('manufacturing.demand.convert'),
      canViewStage: can('manufacturing.stage.view'),
      canExecuteStage: can('manufacturing.stage.execute'),
      canViewTimeline: can('manufacturing.timeline.view'),
      canViewControlRoom: can('manufacturing.control_room.view'),
      canViewMaterials: can('manufacturing.materials.view'),
      canReserveMaterials: can('manufacturing.materials.reserve'),
      canCreateMaterialRequirement: can('manufacturing.materials.create_requirement'),
      canIssueMaterials: can('manufacturing.materials.issue'),
      canReturnMaterials: can('manufacturing.materials.return'),
      canViewFgReceipts: can('manufacturing.fg_receipt.view'),
      canPostFgReceipt: can('manufacturing.fg_receipt.post'),
    }
  }, [uiRole])
}

/**
 * Phase 2B — assignments, operator my-work, daily production, issues.
 * API mode: reads real session permissions. Demo mode: derives from UI role switcher.
 */
export function useManufacturingPhase2bPermissions() {
  const uiRole = useManufacturingUiRole()
  return useMemo(() => {
    const can = (p: ManufacturingPermission) => canManufacturingPermission(p, uiRole)
    return {
      canViewDailyProduction: can('manufacturing.daily_production.view'),
      canCreateDailyProduction: can('manufacturing.daily_production.create'),
      canSubmitDailyProduction: can('manufacturing.daily_production.submit'),
      canViewAssignments: can('manufacturing.assignment.view'),
      canManageAssignments: can('manufacturing.assignment.manage'),
      canReassignAssignments: can('manufacturing.assignment.reassign'),
      canMyWork: can('manufacturing.operator.my_work'),
      canOperatorStart: can('manufacturing.operator.start'),
      canOperatorPause: can('manufacturing.operator.pause'),
      canOperatorComplete: can('manufacturing.operator.complete'),
      canViewIssues: can('manufacturing.issue.view'),
      canReportIssue: can('manufacturing.issue.report'),
      canAcknowledgeIssue: can('manufacturing.issue.acknowledge'),
      canResolveIssue: can('manufacturing.issue.resolve'),
      canViewDowntime: can('manufacturing.downtime.view'),
      canManageDowntime: can('manufacturing.downtime.manage'),
    }
  }, [uiRole])
}

/**
 * Phase 7E — work-order costing + manufacturing accounting.
 * API mode: soft-gate on the authenticated session permission set (workspace admins pass).
 * Demo mode: falls back to the manufacturing UI role packs. Backend always re-enforces.
 */
type CostingAccountingPermission = Extract<
  ManufacturingPermission,
  `manufacturing.cost.${string}` | `manufacturing.accounting.${string}` | `manufacturing.costing_policy.${string}`
>

function canCostingAccountingPermission(
  permission: CostingAccountingPermission,
  uiRole?: ManufacturingUiRole,
): boolean {
  if (isApiMode()) {
    if (hasWorkspaceAdminRole()) return true
    const permissions = getStoredSession()?.user.permissions ?? []
    return permissions.includes(permission)
  }
  return canManufacturingPermission(permission, uiRole)
}

export const canViewCost = (uiRole?: ManufacturingUiRole) =>
  canCostingAccountingPermission('manufacturing.cost.view', uiRole)
export const canCalculateCost = (uiRole?: ManufacturingUiRole) =>
  canCostingAccountingPermission('manufacturing.cost.calculate', uiRole)
export const canViewAccounting = (uiRole?: ManufacturingUiRole) =>
  canCostingAccountingPermission('manufacturing.accounting.view', uiRole)
export const canValidateAccounting = (uiRole?: ManufacturingUiRole) =>
  canCostingAccountingPermission('manufacturing.accounting.validate', uiRole)
export const canPostAccounting = (uiRole?: ManufacturingUiRole) =>
  canCostingAccountingPermission('manufacturing.accounting.post', uiRole)
export const canRetryAccounting = (uiRole?: ManufacturingUiRole) =>
  canCostingAccountingPermission('manufacturing.accounting.retry', uiRole)
export const canFinancialClose = (uiRole?: ManufacturingUiRole) =>
  canCostingAccountingPermission('manufacturing.accounting.financial_close', uiRole)
export const canReconcileAccounting = (uiRole?: ManufacturingUiRole) =>
  canCostingAccountingPermission('manufacturing.accounting.reconcile', uiRole)
export const canViewCostingPolicy = (uiRole?: ManufacturingUiRole) =>
  canCostingAccountingPermission('manufacturing.costing_policy.view', uiRole)
export const canManageCostingPolicy = (uiRole?: ManufacturingUiRole) =>
  canCostingAccountingPermission('manufacturing.costing_policy.manage', uiRole)

/**
 * Phase 6A1 — Production Planning workbench (plans, unplanned demand, WO suggestions,
 * planning exceptions, calculation runs). API mode: reads real session permissions when
 * available; demo mode derives from the manufacturing UI role switcher, same as the
 * other Phase permission hooks. Frontend-only gate — no backend enforcement yet.
 */
export function useProductionPlanningPermissions() {
  const uiRole = useManufacturingUiRole()
  return useMemo(() => {
    const can = (p: ManufacturingPermission) => canManufacturingPermission(p, uiRole)
    return {
      canView: can('manufacturing.production_plan.view'),
      canCreate: can('manufacturing.production_plan.create'),
      canEdit: can('manufacturing.production_plan.edit'),
      canCalculate: can('manufacturing.production_plan.calculate'),
      canReview: can('manufacturing.production_plan.review'),
      canClone: can('manufacturing.production_plan.clone'),
      canCancel: can('manufacturing.production_plan.edit'),
      canReviewSuggestions: can('manufacturing.production_plan.suggestion_review'),
      canViewUnplannedDemand: can('manufacturing.unplanned_demand.view'),
      canViewExceptions: can('manufacturing.planning_exception.view'),
      canAcknowledgeExceptions: can('manufacturing.planning_exception.acknowledge'),
    }
  }, [uiRole])
}
