/**
 * Merges the independent validation surfaces (amount calc, duplicate scan, account readiness,
 * accounting preview) into the single `VendorInvoiceCalculationValidation` returned to callers.
 */
import { calcError, calcWarning, VENDOR_INVOICE_CALC_CODES } from './vendor-invoice-calculation.errors.js'
import type {
  VendorInvoiceAccountReadiness,
  VendorInvoiceAccountingPreview,
  VendorInvoiceCalculationValidation,
  VendorInvoiceDuplicateAssessment,
  VendorInvoiceValidationIssue,
} from './vendor-invoice-calculation.types.js'

const SEVERITY_RANK: Record<VendorInvoiceValidationIssue['severity'], number> = { ERROR: 0, WARNING: 1, INFO: 2 }

/** Stable ordering for persisted/serialized output: severity, then field, then code. */
export function sortValidationIssues(issues: VendorInvoiceValidationIssue[]): VendorInvoiceValidationIssue[] {
  return [...issues].sort((a, b) => {
    const rankDiff = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
    if (rankDiff !== 0) return rankDiff
    const fieldDiff = (a.field ?? '').localeCompare(b.field ?? '')
    if (fieldDiff !== 0) return fieldDiff
    return a.code.localeCompare(b.code)
  })
}

export interface MergeVendorInvoiceValidationParams {
  amountErrors: VendorInvoiceValidationIssue[]
  amountWarnings: VendorInvoiceValidationIssue[]
  duplicateAssessment: VendorInvoiceDuplicateAssessment
  accountReadiness: VendorInvoiceAccountReadiness
  accountingPreview: VendorInvoiceAccountingPreview
}

export function mergeVendorInvoiceValidation(params: MergeVendorInvoiceValidationParams): VendorInvoiceCalculationValidation {
  const { duplicateAssessment, accountReadiness, accountingPreview } = params
  const errors: VendorInvoiceValidationIssue[] = [...params.amountErrors]
  const warnings: VendorInvoiceValidationIssue[] = [...params.amountWarnings]
  const information: VendorInvoiceValidationIssue[] = []

  if (duplicateAssessment.isBlocking) {
    errors.push(
      calcError(
        VENDOR_INVOICE_CALC_CODES.DUPLICATE_SUPPLIER_INVOICE_BLOCKING,
        `Supplier invoice number ${duplicateAssessment.normalizedSupplierInvoiceNumber} already exists (non-cancelled) for this vendor`,
        'supplierInvoiceNumber',
      ),
    )
  } else if (duplicateAssessment.riskLevel !== 'NONE') {
    warnings.push(
      calcWarning(
        VENDOR_INVOICE_CALC_CODES.DUPLICATE_SUPPLIER_INVOICE_SUSPECTED,
        `Found ${duplicateAssessment.matches.length} similar vendor invoice(s) for this vendor — review before posting`,
        'supplierInvoiceNumber',
      ),
    )
  }

  if (!accountReadiness.isReady) {
    errors.push(...accountReadiness.issues)
  }

  if (!accountingPreview.isBalanced) {
    // Preview issues largely restate unresolved-account readiness issues (same field/code) — only
    // surface ones that add new information (e.g. the final unbalanced-total error).
    const seen = new Set(errors.map((e) => `${e.code}:${e.field ?? ''}`))
    for (const issue of accountingPreview.issues) {
      const key = `${issue.code}:${issue.field ?? ''}`
      if (seen.has(key)) continue
      seen.add(key)
      errors.push(issue)
    }
  }

  return {
    isValid: errors.length === 0,
    errors: sortValidationIssues(errors),
    warnings: sortValidationIssues(warnings),
    information: sortValidationIssues(information),
  }
}
