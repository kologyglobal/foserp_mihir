import { ClipboardList, Package } from 'lucide-react'
import {
  PurchaseDocumentWorkspaceTabs,
  type DocumentWorkspaceTabModel,
  type DocumentWorkspaceTabStatus,
} from '@/components/purchase/PurchaseDocumentWorkspaceTabs'
import type { PrValidationResult } from '@/utils/purchaseRequisitionValidation'

/** Two workspaces: header (Quick Entry + Additional Information) | Line Items. */
export type PrEditorWorkspace = 'requisition' | 'line_items'

export type PrWorkspaceTabStatus = DocumentWorkspaceTabStatus
export type PrWorkspaceTabModel = DocumentWorkspaceTabModel<PrEditorWorkspace>

/** Submit-critical / high-traffic fields on Quick Entry (WS1). */
const QUICK_FIELD_KEYS = [
  'department',
  'locationId',
  'expectedDeliveryDate',
  'purpose',
] as const

/** Extended / source-linked fields on Additional Information (WS1). */
const ADDITIONAL_FIELD_KEYS = ['productionOrderNo', 'maintenanceOrderNo'] as const

/** Map FastTab / scroll section ids → workspace. */
export function prSectionToWorkspace(
  section: 'general' | 'lines' | 'finance' | 'attachments' | 'approval' | 'costing' | null | undefined,
): PrEditorWorkspace {
  if (section === 'lines' || section === 'finance' || section === 'attachments') {
    return 'line_items'
  }
  // general / costing / approval live on Requisition workspace
  return 'requisition'
}

export function prWorkspaceHasValidationErrors(
  workspace: PrEditorWorkspace,
  result: PrValidationResult,
): boolean {
  if (workspace === 'line_items') {
    if (Object.keys(result.lineErrors).length > 0) return true
    return result.errors.some(
      (e) =>
        /line/i.test(e) ||
        /quantity/i.test(e) ||
        /description/i.test(e) ||
        /unit/i.test(e) ||
        /At least one line/i.test(e),
    )
  }
  // requisition: quick + additional header fields
  if (QUICK_FIELD_KEYS.some((key) => Boolean(result.fieldErrors[key]))) return true
  if (ADDITIONAL_FIELD_KEYS.some((key) => Boolean(result.fieldErrors[key]))) return true
  return false
}

function countQuickFieldsPending(result: PrValidationResult): number {
  let n = 0
  for (const key of QUICK_FIELD_KEYS) {
    if (result.fieldErrors[key]) n += 1
  }
  return n
}

function countIncompleteLines(result: PrValidationResult): number {
  const lineKeys = new Set(
    Object.keys(result.lineErrors).map((key) => key.split(':')[0] ?? key),
  )
  if (lineKeys.size > 0) return lineKeys.size
  if (result.errors.some((e) => /At least one line/i.test(e))) return 1
  return 0
}

function countRequisitionFieldsPending(result: PrValidationResult): number {
  let n = countQuickFieldsPending(result)
  for (const key of ADDITIONAL_FIELD_KEYS) {
    if (result.fieldErrors[key]) n += 1
  }
  return n
}

/**
 * Derive workspace tab chrome from live validation (same rules as submit)
 * plus dirty flag — does not change validation rule definitions.
 */
export function derivePrWorkspaceTabs(args: {
  submitValidation: PrValidationResult
  attemptedValidation: PrValidationResult | null
  dirty: boolean
}): PrWorkspaceTabModel[] {
  const { submitValidation, attemptedValidation, dirty } = args
  const showAttemptErrors = attemptedValidation != null && attemptedValidation.errors.length > 0

  const requisitionPending = countRequisitionFieldsPending(submitValidation)
  const incompleteLines = countIncompleteLines(submitValidation)

  const requisitionStatus = ((): { status: PrWorkspaceTabStatus; statusDetail: string } => {
    if (showAttemptErrors && prWorkspaceHasValidationErrors('requisition', attemptedValidation!)) {
      return {
        status: 'validation_error',
        statusDetail:
          requisitionPending > 0
            ? `${requisitionPending} field${requisitionPending === 1 ? '' : 's'} pending`
            : 'Validation error',
      }
    }
    if (requisitionPending > 0) {
      return {
        status: 'fields_pending',
        statusDetail: `${requisitionPending} field${requisitionPending === 1 ? '' : 's'} pending`,
      }
    }
    if (dirty) {
      return { status: 'unsaved', statusDetail: 'Unsaved' }
    }
    return { status: 'complete', statusDetail: 'Complete' }
  })()

  const lineItemsStatus = ((): { status: PrWorkspaceTabStatus; statusDetail: string } => {
    if (showAttemptErrors && prWorkspaceHasValidationErrors('line_items', attemptedValidation!)) {
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
      id: 'requisition',
      label: 'Requisition',
      icon: ClipboardList,
      ...requisitionStatus,
    },
    {
      id: 'line_items',
      label: 'Line Items',
      icon: Package,
      ...lineItemsStatus,
    },
  ]
}

export type PurchaseRequisitionWorkspaceTabsProps = {
  active: PrEditorWorkspace
  onChange: (workspace: PrEditorWorkspace) => void
  tabs: PrWorkspaceTabModel[]
  className?: string
}

/** Two-workspace PR tab strip — Requisition (Quick Entry + Additional) | Line Items. */
export function PurchaseRequisitionWorkspaceTabs({
  active,
  onChange,
  tabs,
  className,
}: PurchaseRequisitionWorkspaceTabsProps) {
  return (
    <PurchaseDocumentWorkspaceTabs
      active={active}
      onChange={onChange}
      tabs={tabs}
      ariaLabel="Purchase requisition workspaces"
      idPrefix="pr"
      className={className}
    />
  )
}
