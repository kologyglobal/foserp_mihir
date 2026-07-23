/**
 * Gate & Security fine-grained frontend permissions.
 *
 * SECURITY: UI gating alone is not security. All permissions must also be
 * enforced by the future gate backend (tenant isolation + RBAC on every
 * gate read / write / approve / release action).
 */

import { useMemo } from 'react'
import { getSessionUser, type ErpRole } from './index'

export const GATE_PERMISSIONS = [
  'gate.dashboard.view',
  'gate.register.view',

  'gate.visitor.view',
  'gate.visitor.create',
  'gate.visitor.edit',
  'gate.visitor.approve',
  'gate.visitor.entry',
  'gate.visitor.exit',

  'gate.vehicle.view',
  'gate.vehicle.create',
  'gate.vehicle.edit',
  'gate.vehicle.entry',
  'gate.vehicle.exit',

  'gate.material_inward.view',
  'gate.material_inward.create',
  'gate.material_inward.edit',

  'gate.material_outward.view',
  'gate.material_outward.verify',
  'gate.material_outward.release',

  'gate.pass.view',
  'gate.pass.create',
  'gate.pass.edit',
  'gate.pass.approve',
  'gate.pass.return',

  'gate.contractor.view',
  'gate.contractor.create',
  'gate.contractor.exit',

  'gate.courier.view',
  'gate.courier.create',
  'gate.courier.handover',

  'gate.approval.view',
  'gate.approval.action',

  'gate.report.view',
  'gate.settings.manage',
] as const

export type GatePermission = (typeof GATE_PERMISSIONS)[number]

const ALL = [...GATE_PERMISSIONS]

/** Security guard / gate operator — full day-to-day gate operations, no approvals or setup */
const GATE_OPERATOR: GatePermission[] = [
  'gate.dashboard.view',
  'gate.register.view',
  'gate.visitor.view',
  'gate.visitor.create',
  'gate.visitor.edit',
  'gate.visitor.entry',
  'gate.visitor.exit',
  'gate.vehicle.view',
  'gate.vehicle.create',
  'gate.vehicle.edit',
  'gate.vehicle.entry',
  'gate.vehicle.exit',
  'gate.material_inward.view',
  'gate.material_inward.create',
  'gate.material_inward.edit',
  'gate.material_outward.view',
  'gate.material_outward.verify',
  'gate.material_outward.release',
  'gate.pass.view',
  'gate.pass.create',
  'gate.pass.return',
  'gate.contractor.view',
  'gate.contractor.create',
  'gate.contractor.exit',
  'gate.courier.view',
  'gate.courier.create',
  'gate.courier.handover',
  'gate.approval.view',
  'gate.report.view',
]

/** Security supervisor / admin head — everything including approvals and settings */
const GATE_SUPERVISOR: GatePermission[] = [...ALL]

/** Host / department manager — approvals plus read-only visibility */
const GATE_APPROVER: GatePermission[] = [
  'gate.dashboard.view',
  'gate.register.view',
  'gate.visitor.view',
  'gate.visitor.approve',
  'gate.vehicle.view',
  'gate.material_inward.view',
  'gate.material_outward.view',
  'gate.pass.view',
  'gate.pass.approve',
  'gate.contractor.view',
  'gate.courier.view',
  'gate.approval.view',
  'gate.approval.action',
  'gate.report.view',
]

/** Read-only visibility for audit / cross-functional roles */
const GATE_VIEWER: GatePermission[] = [
  'gate.dashboard.view',
  'gate.register.view',
  'gate.visitor.view',
  'gate.vehicle.view',
  'gate.material_inward.view',
  'gate.material_outward.view',
  'gate.pass.view',
  'gate.contractor.view',
  'gate.courier.view',
  'gate.approval.view',
  'gate.report.view',
]

const ROLE_PACKS: Partial<Record<ErpRole, GatePermission[]>> = {
  admin: GATE_SUPERVISOR,
  ceo: GATE_SUPERVISOR,
  director: GATE_SUPERVISOR,
  management: GATE_SUPERVISOR,
  dispatch_manager: GATE_SUPERVISOR,
  dispatch_user: GATE_OPERATOR,
  dispatch: GATE_SUPERVISOR,
  store_manager: GATE_OPERATOR,
  store_user: GATE_OPERATOR,
  stores: GATE_OPERATOR,
  production_head: GATE_APPROVER,
  production_supervisor: GATE_APPROVER,
  production: GATE_APPROVER,
  purchase_head: GATE_APPROVER,
  purchase_user: GATE_VIEWER,
  purchase: GATE_VIEWER,
  quality_head: GATE_VIEWER,
  quality_inspector: GATE_VIEWER,
  quality: GATE_VIEWER,
  sales_manager: GATE_VIEWER,
  sales: GATE_VIEWER,
  accounts_head: GATE_VIEWER,
  accounts_user: GATE_VIEWER,
  accounts: GATE_VIEWER,
  engineering_head: GATE_VIEWER,
  planning_manager: GATE_VIEWER,
  shop_floor: [],
}

function resolve(role: ErpRole): Set<GatePermission> {
  return new Set(ROLE_PACKS[role] ?? GATE_VIEWER)
}

export function hasGatePermission(permission: GatePermission, role?: ErpRole): boolean {
  return resolve(role ?? getSessionUser().role).has(permission)
}

export function useGatePermissions() {
  const user = getSessionUser()
  return useMemo(() => {
    const set = resolve(user.role)
    const can = (p: GatePermission) => set.has(p)
    return {
      role: user.role,
      canView: can('gate.dashboard.view') || can('gate.register.view'),
      canViewDashboard: can('gate.dashboard.view'),
      canViewRegister: can('gate.register.view'),
      canViewVisitor: can('gate.visitor.view'),
      canCreateVisitor: can('gate.visitor.create'),
      canEditVisitor: can('gate.visitor.edit'),
      canApproveVisitor: can('gate.visitor.approve'),
      canVisitorEntry: can('gate.visitor.entry'),
      canVisitorExit: can('gate.visitor.exit'),
      canViewVehicle: can('gate.vehicle.view'),
      canCreateVehicle: can('gate.vehicle.create'),
      canEditVehicle: can('gate.vehicle.edit'),
      canVehicleEntry: can('gate.vehicle.entry'),
      canVehicleExit: can('gate.vehicle.exit'),
      canViewInward: can('gate.material_inward.view'),
      canCreateInward: can('gate.material_inward.create'),
      canEditInward: can('gate.material_inward.edit'),
      canViewOutward: can('gate.material_outward.view'),
      canVerifyOutward: can('gate.material_outward.verify'),
      canReleaseOutward: can('gate.material_outward.release'),
      canViewPass: can('gate.pass.view'),
      canCreatePass: can('gate.pass.create'),
      canEditPass: can('gate.pass.edit'),
      canApprovePass: can('gate.pass.approve'),
      canReturnPass: can('gate.pass.return'),
      canViewContractor: can('gate.contractor.view'),
      canCreateContractor: can('gate.contractor.create'),
      canContractorExit: can('gate.contractor.exit'),
      canViewCourier: can('gate.courier.view'),
      canCreateCourier: can('gate.courier.create'),
      canCourierHandover: can('gate.courier.handover'),
      canViewApprovals: can('gate.approval.view'),
      canActionApprovals: can('gate.approval.action'),
      canViewReports: can('gate.report.view'),
      canManageSettings: can('gate.settings.manage'),
      can,
    }
  }, [user.role])
}
