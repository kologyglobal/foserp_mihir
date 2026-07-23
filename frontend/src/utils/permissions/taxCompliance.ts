/**
 * GST & TDS Compliance fine-grained frontend permissions.
 *
 * API mode: maps to `finance.tax.view` / `finance.tax.extract` /
 * `finance.tax.einvoice.manage` / `finance.tax.eway.manage`.
 * Demo mode: role packs for the mock workspace.
 *
 * SECURITY: Backend enforces tenant isolation + RBAC on GST reads/mutations.
 */

import { useMemo } from 'react'
import { isApiMode } from '../../config/apiConfig'
import { getStoredSession } from '../../services/api/client'
import { hasFinancePermission } from './finance'
import { getSessionUser, type ErpRole } from './index'
import { hasWorkspaceAdminRole } from './workspaceAdmin'

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

function hasApiTaxView(): boolean {
  return hasWorkspaceAdminRole() || hasFinancePermission('finance.tax.view')
}

function hasApiTaxExtract(): boolean {
  return (
    hasWorkspaceAdminRole() ||
    hasFinancePermission('finance.tax.extract') ||
    hasFinancePermission('finance.tax.view')
  )
}

function hasApiEInvoiceManage(): boolean {
  return hasWorkspaceAdminRole() || hasFinancePermission('finance.tax.einvoice.manage')
}

function hasApiEWayManage(): boolean {
  return hasWorkspaceAdminRole() || hasFinancePermission('finance.tax.eway.manage')
}

export function hasTaxCompliancePermission(permission: TaxCompliancePermission, role?: ErpRole): boolean {
  if (isApiMode()) {
    if (hasWorkspaceAdminRole()) return true
    if (
      permission === 'accounting.tax.view' ||
      permission === 'accounting.tax.gst.view' ||
      permission === 'accounting.tax.export' ||
      permission === 'accounting.tax.print' ||
      permission === 'accounting.tax.calendar.view' ||
      permission === 'accounting.tax.audit.view'
    ) {
      return hasApiTaxView()
    }
    if (permission === 'accounting.tax.gst.e_invoice') return hasApiEInvoiceManage()
    if (permission === 'accounting.tax.gst.e_way') return hasApiEWayManage()
    // Filing / TDS / notices remain demo-gated off in API mode
    return false
  }
  const effective = role ?? getSessionUser().role
  return resolveTaxPermissions(effective).has(permission)
}

export function useTaxCompliancePermissions() {
  const role = getSessionUser().role
  const apiPermKey = isApiMode() ? (getStoredSession()?.user.permissions?.join(',') ?? '') : ''

  return useMemo(() => {
    if (isApiMode()) {
      const canView = hasApiTaxView()
      const canExport = hasApiTaxExtract()
      return {
        role,
        can: (p: TaxCompliancePermission) => hasTaxCompliancePermission(p, role),
        canView,
        canExport,
        canSetup: false,
        canGstView: canView,
        canGstReconcile: false,
        canGstMarkFiled: false,
        canEInvoice: hasApiEInvoiceManage(),
        canEWay: hasApiEWayManage(),
        canTdsView: false,
        canTdsDeduct: false,
        canTcsView: false,
        canManageNotices: false,
        isApiMode: true as const,
      }
    }

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
      canEInvoice: can('accounting.tax.gst.e_invoice'),
      canEWay: can('accounting.tax.gst.e_way'),
      canTdsView: can('accounting.tax.tds.view'),
      canTdsDeduct: can('accounting.tax.tds.deduct'),
      canTcsView: can('accounting.tax.tcs.view'),
      canManageNotices: can('accounting.tax.notices.manage'),
      isApiMode: false as const,
    }
  }, [role, apiPermKey])
}
