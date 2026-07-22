/** Re-export Prisma AP adjustment enums for domain consumers (Phase 4C2). */
export {
  VendorAdjustmentType,
  VendorAdjustmentStatus,
  VendorAdjustmentReason,
  VendorAdjustmentTaxEffect,
  VendorAdjustmentItcTreatment,
  VendorAdjustmentTdsTreatment,
  VendorAdjustmentLineType,
  VendorAdjustmentSourceLinkType,
} from '@prisma/client'

export const VENDOR_ADJUSTMENT_AUDIT_ACTIONS = [
  'VENDOR_ADJUSTMENT_CREATED',
  'VENDOR_ADJUSTMENT_UPDATED',
  'VENDOR_ADJUSTMENT_VALIDATED',
  'VENDOR_ADJUSTMENT_SUBMITTED',
  'VENDOR_ADJUSTMENT_APPROVED',
  'VENDOR_ADJUSTMENT_REJECTED',
  'VENDOR_ADJUSTMENT_REVISED',
  'VENDOR_ADJUSTMENT_READY_TO_POST',
  'VENDOR_ADJUSTMENT_POSTED',
  'VENDOR_ADJUSTMENT_CANCELLED',
  'VENDOR_ADJUSTMENT_REVERSED',
] as const

export type VendorAdjustmentAuditAction = (typeof VENDOR_ADJUSTMENT_AUDIT_ACTIONS)[number]
