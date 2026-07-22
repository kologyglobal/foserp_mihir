import type {
  PurchaseItemCategory,
  PurchaseRequisition,
  PurchaseRequisitionLine,
  PurchaseRequisitionPriority,
  PurchaseRequisitionSource,
} from '../types/purchaseDomain'
import type { EngineeringProductType } from '../types/taxMaster'

export type PrEditorHeader = {
  documentDate: string
  /** Stored as backend `departmentId` (max 36 chars). */
  department: string
  locationId: string
  locationCode: string
  locationName: string
  locationState: string
  locationCity: string
  requesterId: string
  requesterCode: string
  requesterName: string
  expectedDeliveryDate: string
  priority: PurchaseRequisitionPriority
  requisitionType: PurchaseRequisition['requisitionType']
  source: PurchaseRequisitionSource
  costCentre: string
  project: string
  productionOrderNo: string
  maintenanceOrderNo: string
  referenceNumber: string
  purpose: string
  remarks: string
  /** true = RFQ path after approval; false = Planning Sheet after approval */
  rfqRequired: boolean
}

/** Department options — `value` is persisted as `departmentId` (≤36 chars). */
export const PR_DEPARTMENT_OPTIONS = [
  { value: 'PROD_PLAN', label: 'Production Planning' },
  { value: 'STORES', label: 'Stores' },
  { value: 'MAINT', label: 'Maintenance' },
  { value: 'DISPATCH', label: 'Dispatch' },
  { value: 'PURCHASE', label: 'Purchase' },
  { value: 'QUALITY', label: 'Quality' },
] as const

export function prDepartmentLabel(code: string): string {
  const hit = PR_DEPARTMENT_OPTIONS.find((d) => d.value === code)
  if (hit) return hit.label
  // Legacy free-text departments stored before codes were introduced
  const byLabel = PR_DEPARTMENT_OPTIONS.find(
    (d) => d.label.toLowerCase() === code.trim().toLowerCase(),
  )
  return byLabel?.label ?? code
}

export function normalizePrDepartmentCode(value: string): string {
  const v = value.trim()
  if (!v) return ''
  const byValue = PR_DEPARTMENT_OPTIONS.find((d) => d.value === v)
  if (byValue) return byValue.value
  const byLabel = PR_DEPARTMENT_OPTIONS.find(
    (d) => d.label.toLowerCase() === v.toLowerCase(),
  )
  return byLabel?.value ?? v.slice(0, 36)
}

export type PrEditorLine = Omit<PurchaseRequisitionLine, 'category'> & {
  key: string
  /** Item Master engineering product type — shown as Product Type on the grid. */
  productType: EngineeringProductType | ''
  /** Purchase category derived from productType — kept for domain/API payloads. */
  category: PurchaseItemCategory | ''
  /** Action Message accept checkbox (planning-sheet style). */
  actionMessage: boolean
}

export type PrValidationResult = {
  errors: string[]
  warnings: string[]
  fieldErrors: Record<string, string>
  lineErrors: Record<string, string>
}

export function validatePurchaseRequisitionForm(
  header: PrEditorHeader,
  lines: PrEditorLine[],
): PrValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const fieldErrors: Record<string, string> = {}
  const lineErrors: Record<string, string> = {}

  if (!header.department.trim()) {
    errors.push('Department is required.')
    fieldErrors.department = 'Department is required.'
  }
  if (!header.requesterId.trim()) {
    errors.push('Requested By is required.')
    fieldErrors.requesterId = 'Requested By is required.'
  }
  if (!header.documentDate.trim()) {
    errors.push('Requisition date is required.')
    fieldErrors.documentDate = 'Requisition date is required.'
  }
  if (!header.expectedDeliveryDate.trim()) {
    errors.push('Required date is required.')
    fieldErrors.expectedDeliveryDate = 'Required date is required.'
  }
  if (!header.locationId.trim()) {
    errors.push('Location is mandatory.')
    fieldErrors.locationId = 'Required'
  }
  // RFQ Required is a boolean on the form; always present once rendered.
  // Keep an explicit check for defensive completeness.
  if (typeof header.rfqRequired !== 'boolean') {
    errors.push('RFQ Required selection is mandatory.')
    fieldErrors.rfqRequired = 'RFQ Required selection is mandatory.'
  }
  if (
    header.expectedDeliveryDate &&
    header.documentDate &&
    header.expectedDeliveryDate < header.documentDate
  ) {
    errors.push('Required date cannot be before requisition date.')
    fieldErrors.expectedDeliveryDate = 'Required date cannot be before requisition date.'
  }

  const usableLines = lines.filter(
    (l) => l.itemName.trim() || l.itemCode.trim() || l.itemId,
  )
  if (usableLines.length === 0) {
    errors.push('Add at least one item.')
  }

  for (const line of usableLines) {
    const prefix = `Line ${line.lineNo}`
    if (!line.productType && !line.category) {
      errors.push(`${prefix}: Product type is mandatory.`)
      lineErrors[`${line.key}:productType`] = 'Required'
    }
    if (!line.itemName.trim() && !line.itemCode.trim() && !line.itemId) {
      errors.push(`${prefix}: Item is required.`)
      lineErrors[`${line.key}:itemName`] = 'Item is required.'
    }
    if (!(Number(line.quantity) > 0)) {
      errors.push(`${prefix}: Quantity must be greater than zero.`)
      lineErrors[`${line.key}:quantity`] = 'Quantity must be greater than zero.'
    }
    if (!line.uom.trim() && !(line.uomId ?? '').trim()) {
      errors.push(`${prefix}: UOM is required.`)
      lineErrors[`${line.key}:uom`] = 'UOM is required.'
    }
    if (Number(line.estimatedRate) < 0) {
      errors.push(`${prefix}: Estimated unit price cannot be negative.`)
      lineErrors[`${line.key}:estimatedRate`] = 'Cannot be negative'
    }
  }

  if (header.priority === 'urgent' && !header.purpose.trim()) {
    errors.push('Purpose is mandatory for urgent requisitions.')
    fieldErrors.purpose = 'Required for Urgent'
  }
  // Production / Maintenance order fields are hidden in the UI for now.
  // if (header.source === 'work_order' && !header.productionOrderNo.trim()) {
  //   errors.push('Production Order is mandatory when source is Production Order.')
  //   fieldErrors.productionOrderNo = 'Required'
  // }
  // if (header.source === 'maintenance' && !header.maintenanceOrderNo.trim()) {
  //   errors.push('Maintenance Order is mandatory when source is Maintenance.')
  //   fieldErrors.maintenanceOrderNo = 'Required'
  // }

  const seen = new Map<string, number>()
  for (const line of usableLines) {
    const key = (line.itemId || line.itemCode || line.itemName).trim().toLowerCase()
    if (!key) continue
    const count = (seen.get(key) ?? 0) + 1
    seen.set(key, count)
    if (count === 2) {
      warnings.push(`Duplicate item warning: “${line.itemCode || line.itemName}” appears more than once.`)
    }
  }

  return { errors, warnings, fieldErrors, lineErrors }
}

export function summarizePrLines(lines: PrEditorLine[]) {
  const usable = lines.filter((l) => l.itemName.trim() || l.itemCode.trim() || l.itemId)
  const totalQty = usable.reduce((s, l) => s + (Number(l.quantity) || 0), 0)
  const subtotal = usable.reduce((s, l) => s + (Number(l.amount) || 0), 0)
  const taxPct = 18
  const tax = Number(((subtotal * taxPct) / 100).toFixed(2))
  return {
    totalLines: usable.length,
    totalQuantity: totalQty,
    estimatedSubtotal: Number(subtotal.toFixed(2)),
    estimatedTaxes: tax,
    estimatedTotal: Number((subtotal + tax).toFixed(2)),
    estimatedTaxPct: taxPct,
  }
}
