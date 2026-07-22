/** Re-export Prisma AP enums for domain consumers (Phase 4A1). */
export {
  VendorInvoiceStatus,
  VendorInvoiceType,
  VendorInvoiceLineType,
  VendorInvoiceSourceLinkType,
  VendorInvoiceTaxTreatment,
  InputTaxCreditEligibility,
  TdsRecognitionMode,
} from '@prisma/client'

/** AuditLog action names — draft/workflow actions written from Phase 4A3; POSTED/REVERSED remain registration-only until Phase 4A4+. */
export const VENDOR_INVOICE_AUDIT_ACTIONS = [
  'VENDOR_INVOICE_CREATED',
  'VENDOR_INVOICE_UPDATED',
  'VENDOR_INVOICE_VALIDATED',
  'VENDOR_INVOICE_SUBMITTED',
  'VENDOR_INVOICE_APPROVED',
  'VENDOR_INVOICE_REJECTED',
  'VENDOR_INVOICE_REVISED',
  'VENDOR_INVOICE_READY_TO_POST',
  'VENDOR_INVOICE_POSTED',
  'VENDOR_INVOICE_CANCELLED',
  'VENDOR_INVOICE_REVERSED',
] as const

export type VendorInvoiceAuditAction = (typeof VENDOR_INVOICE_AUDIT_ACTIONS)[number]
