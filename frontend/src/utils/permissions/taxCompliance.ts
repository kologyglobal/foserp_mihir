/**
 * GST & TDS Compliance fine-grained frontend permissions.
 *
 * API mode: maps to `finance.tax.*` / `tax.gst.*` backend codes.
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
  'accounting.tax.gst.file_return',
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
  'accounting.tax.gst.file_return',
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

function apiPermissionSet(): Set<string> {
  return new Set(getStoredSession()?.user.permissions ?? [])
}

function hasApiPerm(...codes: string[]): boolean {
  if (hasWorkspaceAdminRole()) return true
  const set = apiPermissionSet()
  return codes.some((c) => set.has(c) || set.has('tenant.manage'))
}

function hasApiTaxView(): boolean {
  return hasApiPerm('finance.tax.view', 'tax.gst.view', 'tax.gst.reconcile') || hasFinancePermission('finance.tax.view')
}

function hasApiTaxExtract(): boolean {
  return (
    hasApiTaxView() ||
    hasApiPerm('finance.tax.extract') ||
    hasFinancePermission('finance.tax.extract')
  )
}

function hasApiEInvoiceManage(): boolean {
  return hasApiPerm('finance.tax.einvoice.manage') || hasFinancePermission('finance.tax.einvoice.manage')
}

function hasApiEWayManage(): boolean {
  return hasApiPerm('finance.tax.eway.manage') || hasFinancePermission('finance.tax.eway.manage')
}

function hasApiGstReconcile(): boolean {
  return hasApiPerm('tax.gst.reconcile')
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
    if (permission === 'accounting.tax.gst.reconcile') return hasApiGstReconcile()
    if (permission === 'accounting.tax.gst.prepare_return') return hasApiPerm('tax.gst.returns.prepare')
    if (permission === 'accounting.tax.gst.file_return') return hasApiPerm('tax.gst.returns.file')
    if (permission === 'accounting.tax.gst.mark_filed') return hasApiPerm('tax.gst.returns.mark_filed')
    if (permission === 'accounting.tax.gst.e_invoice') return hasApiEInvoiceManage()
    if (permission === 'accounting.tax.gst.e_way') return hasApiEWayManage()
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
        canSetup: hasApiPerm('tax.gst.setup.manage', 'tax.gst.rates.manage'),
        canGstView: canView,
        canGstReconcile: hasApiGstReconcile(),
        canGstPrepareReturn: hasApiPerm('tax.gst.returns.prepare'),
        canGstLockReturn: hasApiPerm('tax.gst.returns.lock'),
        canGstFileReturn: hasApiPerm('tax.gst.returns.file'),
        canGstMarkFiled: hasApiPerm('tax.gst.returns.mark_filed'),
        canRateOpsView: hasApiPerm('tax.gst.rates.view', 'tax.gst.setup.manage', 'tax.gst.view', 'finance.tax.view'),
        canRateOpsManage: hasApiPerm('tax.gst.rates.manage', 'tax.gst.setup.manage'),
        canDataQualityView: hasApiPerm(
          'tax.gst.quality.view',
          'tax.gst.setup.manage',
          'tax.gst.view',
          'finance.tax.view',
        ),
        canDataQualityManage: hasApiPerm('tax.gst.quality.manage', 'tax.gst.setup.manage'),
        canGlReconView: hasApiPerm(
          'tax.gst.gl_recon.view',
          'tax.gst.reconcile',
          'tax.gst.setup.manage',
          'tax.gst.view',
          'finance.tax.view',
        ),
        canGlReconManage: hasApiPerm('tax.gst.gl_recon.manage', 'tax.gst.setup.manage', 'tax.gst.reconcile'),
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
      canGstPrepareReturn: can('accounting.tax.gst.prepare_return'),
      canGstLockReturn: can('accounting.tax.gst.prepare_return'),
      canGstFileReturn: can('accounting.tax.gst.file_return'),
      canGstMarkFiled: can('accounting.tax.gst.mark_filed'),
      canRateOpsView: can('accounting.tax.gst.view') || can('accounting.tax.setup'),
      canRateOpsManage: can('accounting.tax.setup'),
      canDataQualityView: can('accounting.tax.gst.view') || can('accounting.tax.setup'),
      canDataQualityManage: can('accounting.tax.setup'),
      canGlReconView: can('accounting.tax.gst.view') || can('accounting.tax.gst.reconcile') || can('accounting.tax.setup'),
      canGlReconManage: can('accounting.tax.setup') || can('accounting.tax.gst.reconcile'),
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
