import { Building2, Package } from 'lucide-react'
import {
  PurchaseDocumentWorkspaceTabs,
  type DocumentWorkspaceTabModel,
  type DocumentWorkspaceTabStatus,
} from '@/components/purchase/PurchaseDocumentWorkspaceTabs'
import type { PoValidationResult } from '@/utils/purchaseOrderValidation'

export type PoEditorWorkspace = 'vendor_order' | 'items_financials'

export type PoWorkspaceTabStatus = DocumentWorkspaceTabStatus
export type PoWorkspaceTabModel = DocumentWorkspaceTabModel<PoEditorWorkspace>

/** Map FastTab sections from purchaseOrderValidation → workspace. */
export function poSectionToWorkspace(
  section: 'general' | 'commercial' | 'lines' | null | undefined,
): PoEditorWorkspace {
  if (section === 'lines') return 'items_financials'
  return 'vendor_order'
}

export function poWorkspaceHasValidationErrors(
  workspace: PoEditorWorkspace,
  result: PoValidationResult,
): boolean {
  if (workspace === 'vendor_order') {
    return result.sectionsToOpen.some((s) => s === 'general' || s === 'commercial')
  }
  return result.sectionsToOpen.includes('lines')
}

function countVendorFieldsPending(result: PoValidationResult): number {
  let n = 0
  if (result.fieldErrors.vendorId) n += 1
  if (result.fieldErrors.documentDate) n += 1
  if (result.fieldErrors.expectedDeliveryDate) n += 1
  return n
}

function countIncompleteLines(result: PoValidationResult): number {
  const lineKeys = new Set(
    Object.keys(result.lineErrors).map((key) => key.split(':')[0] ?? key),
  )
  if (lineKeys.size > 0) return lineKeys.size
  if (result.sectionsToOpen.includes('lines')) return 1
  return 0
}

/**
 * Derive workspace tab chrome from live validation (same rules as submit)
 * plus dirty flag — does not mutate validation rule definitions.
 */
export function derivePoWorkspaceTabs(args: {
  submitValidation: PoValidationResult
  /** Validation used for red error state after Save/Submit attempt */
  attemptedValidation: PoValidationResult | null
  dirty: boolean
}): PoWorkspaceTabModel[] {
  const { submitValidation, attemptedValidation, dirty } = args
  const showAttemptErrors = attemptedValidation != null && attemptedValidation.errors.length > 0

  const vendorPending = countVendorFieldsPending(submitValidation)
  const incompleteLines = countIncompleteLines(submitValidation)

  const vendorStatus = ((): { status: PoWorkspaceTabStatus; statusDetail: string } => {
    if (showAttemptErrors && poWorkspaceHasValidationErrors('vendor_order', attemptedValidation!)) {
      return {
        status: 'validation_error',
        statusDetail:
          vendorPending > 0
            ? `${vendorPending} field${vendorPending === 1 ? '' : 's'} pending`
            : 'Validation error',
      }
    }
    if (vendorPending > 0) {
      return {
        status: 'fields_pending',
        statusDetail: `${vendorPending} field${vendorPending === 1 ? '' : 's'} pending`,
      }
    }
    if (dirty) {
      return { status: 'unsaved', statusDetail: 'Unsaved' }
    }
    return { status: 'complete', statusDetail: 'Complete' }
  })()

  const itemsStatus = ((): { status: PoWorkspaceTabStatus; statusDetail: string } => {
    if (showAttemptErrors && poWorkspaceHasValidationErrors('items_financials', attemptedValidation!)) {
      return {
        status: 'validation_error',
        statusDetail:
          incompleteLines > 0
            ? `${incompleteLines} incomplete line${incompleteLines === 1 ? '' : 's'}`
            : 'Validation error',
      }
    }
    if (incompleteLines > 0) {
      return {
        status: 'incomplete_lines',
        statusDetail: `${incompleteLines} incomplete line${incompleteLines === 1 ? '' : 's'}`,
      }
    }
    if (dirty) {
      return { status: 'unsaved', statusDetail: 'Unsaved' }
    }
    return { status: 'complete', statusDetail: 'Complete' }
  })()

  return [
    {
      id: 'vendor_order',
      label: 'Vendor & Order Details',
      icon: Building2,
      ...vendorStatus,
    },
    {
      id: 'items_financials',
      label: 'Items & Financials',
      icon: Package,
      ...itemsStatus,
    },
  ]
}

export type PurchaseOrderWorkspaceTabsProps = {
  active: PoEditorWorkspace
  onChange: (workspace: PoEditorWorkspace) => void
  tabs: PoWorkspaceTabModel[]
  className?: string
}

/** Two-workspace document tab strip with progress / validation status chips. */
export function PurchaseOrderWorkspaceTabs({
  active,
  onChange,
  tabs,
  className,
}: PurchaseOrderWorkspaceTabsProps) {
  return (
    <PurchaseDocumentWorkspaceTabs
      active={active}
      onChange={onChange}
      tabs={tabs}
      ariaLabel="Purchase order workspaces"
      idPrefix="po"
      className={className}
    />
  )
}
