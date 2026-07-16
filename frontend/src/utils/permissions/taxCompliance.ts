/**
 * GST & TDS Compliance fine-grained frontend permissions.
 *
 * SECURITY: Backend must enforce tenant isolation + RBAC on every tax read/write
 * when APIs exist. UI gating alone is not security.
 */

import { useMemo } from 'react'
import { getSessionUser, type ErpRole } from './index'

export const TAX_COMPLIANCE_PERMISSIONS = [
  'accounting.tax.view',
  'accounting.tax.export',
  'accounting.tax.print',
  'accounting.tax.setup',
  'accounting.tax.gst.view',
  'accounting.tax.gst.reconcile',
  'accounting.tax.gst.prepare_return',
  'accounting.tax.gst.mark_filed',
  'accounting.tax.gst.manage_exceptions',
  'accounting.tax.gst.e_invoice',
  'accounting.tax.gst.e_way',
  'accounting.tax.tds.view',
  'accounting.tax.tds.deduct',
  'accounting.tax.tds.challan',
  'accounting.tax.tds.prepare_return',
  'accounting.tax.tds.certificate',
  'accounting.tax.tds.reconcile',
  'accounting.tax.tcs.view',
  'accounting.tax.tcs.collect',
  'accounting.tax.notices.manage',
  'accounting.tax.calendar.view',
  'accounting.tax.audit.view',
] as const

export type TaxCompliancePermission = (typeof TAX_COMPLIANCE_PERMISSIONS)[number]

const ALL = [...TAX_COMPLIANCE_PERMISSIONS]

const VIEW_GST: TaxCompliancePermission[] = [
  'accounting.tax.view',
  'accounting.tax.export',
  'accounting.tax.print',
  'accounting.tax.gst.view',
  'accounting.tax.calendar.view',
  'accounting.tax.audit.view',
]

const GST_EXEC: TaxCompliancePermission[] = [
  ...VIEW_GST,
  'accounting.tax.gst.reconcile',
  'accounting.tax.gst.prepare_return',
  'accounting.tax.gst.manage_exceptions',
  'accounting.tax.gst.e_invoice',
  'accounting.tax.gst.e_way',
  'accounting.tax.notices.manage',
]

const TDS_EXEC: TaxCompliancePermission[] = [
  'accounting.tax.view',
  'accounting.tax.export',
  'accounting.tax.print',
  'accounting.tax.tds.view',
  'accounting.tax.tds.deduct',
  'accounting.tax.tds.challan',
  'accounting.tax.tds.prepare_return',
  'accounting.tax.tds.certificate',
  'accounting.tax.tds.reconcile',
  'accounting.tax.tcs.view',
  'accounting.tax.tcs.collect',
  'accounting.tax.calendar.view',
]

const ACCOUNTANT: TaxCompliancePermission[] = [
  ...GST_EXEC,
  ...TDS_EXEC.filter((p) => !GST_EXEC.includes(p)),
  'accounting.tax.gst.mark_filed',
]

const FINANCE_MANAGER: TaxCompliancePermission[] = [...ALL]
const ADMIN: TaxCompliancePermission[] = [...ALL]

const ROLE_PACKS: Partial<Record<ErpRole, TaxCompliancePermission[]>> = {
  admin: ADMIN,
  ceo: FINANCE_MANAGER,
  director: FINANCE_MANAGER,
  accounts_head: FINANCE_MANAGER,
  accounts_user: ACCOUNTANT,
  accounts: ACCOUNTANT,
  management: FINANCE_MANAGER,
  purchase_head: [...VIEW_GST, 'accounting.tax.tds.view', 'accounting.tax.tds.deduct'],
  purchase_user: ['accounting.tax.view', 'accounting.tax.gst.view', 'accounting.tax.tds.view'],
  sales_manager: [...VIEW_GST, 'accounting.tax.gst.e_invoice', 'accounting.tax.gst.e_way'],
  sales: ['accounting.tax.view', 'accounting.tax.gst.view', 'accounting.tax.export'],
}

function resolveTaxPermissions(role: ErpRole): Set<TaxCompliancePermission> {
  return new Set(ROLE_PACKS[role] ?? ACCOUNTANT)
}

export function hasTaxCompliancePermission(permission: TaxCompliancePermission, role?: ErpRole): boolean {
  const effective = role ?? getSessionUser().role
  return resolveTaxPermissions(effective).has(permission)
}

export function useTaxCompliancePermissions() {
  const role = getSessionUser().role
  return useMemo(() => {
    const set = resolveTaxPermissions(role)
    const can = (p: TaxCompliancePermission) => set.has(p)
    return {
      role,
      can,
      canView: can('accounting.tax.view'),
      canExport: can('accounting.tax.export'),
      canSetup: can('accounting.tax.setup'),
      canGstView: can('accounting.tax.gst.view'),
      canGstReconcile: can('accounting.tax.gst.reconcile'),
      canGstMarkFiled: can('accounting.tax.gst.mark_filed'),
      canTdsView: can('accounting.tax.tds.view'),
      canTdsDeduct: can('accounting.tax.tds.deduct'),
      canTcsView: can('accounting.tax.tcs.view'),
      canManageNotices: can('accounting.tax.notices.manage'),
    }
  }, [role])
}
