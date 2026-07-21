import type { PurchaseApprovalMatrixRole } from '@prisma/client'
import {
  resolveApprovalRolesFromDefaults,
  resolveEffectivePurchaseDefaults,
  type EffectivePurchaseDefaults,
} from './purchase-defaults.js'

export function matrixRoleToApi(role: PurchaseApprovalMatrixRole): string {
  switch (role) {
    case 'DEPARTMENT_HEAD':
      return 'department_head'
    case 'PURCHASE_HEAD':
      return 'purchase_head'
    case 'FINANCE_HEAD':
      return 'finance_head'
    case 'MANAGEMENT':
      return 'management'
    default:
      return 'purchase_head'
  }
}

export async function getPurchasePolicy(tenantId: string, plantId?: string | null) {
  return resolveEffectivePurchaseDefaults(tenantId, plantId)
}

export function resolveDocumentApprovalRoles(
  defaults: EffectivePurchaseDefaults,
  amount: number,
  documentType: 'PURCHASE_REQUISITION' | 'PURCHASE_ORDER',
) {
  return resolveApprovalRolesFromDefaults(defaults, amount, documentType)
}

export function assertDirectPoAllowed(
  defaults: EffectivePurchaseDefaults,
  hasSourceDocument: boolean,
): string | null {
  if (!hasSourceDocument && !defaults.allowDirectPo) {
    return 'Direct purchase orders are disabled in Purchase Setup.'
  }
  if (!hasSourceDocument && defaults.requirePrBeforePo) {
    return 'A purchase requisition is required before creating a purchase order.'
  }
  return null
}

export function assertRfqVendorCount(
  defaults: EffectivePurchaseDefaults,
  vendorCount: number,
): string | null {
  if (vendorCount < defaults.minimumRfqVendorCount) {
    return `At least ${defaults.minimumRfqVendorCount} vendor(s) are required on the RFQ.`
  }
  return null
}

export function assertRfqAmountPolicy(
  defaults: EffectivePurchaseDefaults,
  amount: number,
  rfqRequired: boolean,
): string | null {
  if (
    defaults.requireRfqAboveAmount != null &&
    amount >= defaults.requireRfqAboveAmount &&
    !rfqRequired
  ) {
    return `RFQ is required for amounts at or above ₹${defaults.requireRfqAboveAmount}.`
  }
  return null
}

export function assertShortCloseAllowed(defaults: EffectivePurchaseDefaults): string | null {
  if (!defaults.allowShortClose) {
    return 'Short-close is disabled in Purchase Setup.'
  }
  return null
}

export function assertLineTraceability(
  defaults: EffectivePurchaseDefaults,
  line: {
    lineNumber: number
    batchNumber?: string | null
    serialNumber?: string | null
    expiryDate?: Date | string | null
  },
): Array<{ field: string; message: string }> {
  const errors: Array<{ field: string; message: string }> = []
  if (defaults.requireBatch && !line.batchNumber?.toString().trim()) {
    errors.push({
      field: `lines[${line.lineNumber - 1}].batchNumber`,
      message: 'Batch number is required by Purchase Setup.',
    })
  }
  if (defaults.requireSerial && !line.serialNumber?.toString().trim()) {
    errors.push({
      field: `lines[${line.lineNumber - 1}].serialNumber`,
      message: 'Serial number is required by Purchase Setup.',
    })
  }
  if (defaults.requireExpiry && !line.expiryDate) {
    errors.push({
      field: `lines[${line.lineNumber - 1}].expiryDate`,
      message: 'Expiry date is required by Purchase Setup.',
    })
  }
  return errors
}
