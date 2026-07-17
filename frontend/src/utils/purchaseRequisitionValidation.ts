import type {
  PurchaseRequisition,
  PurchaseRequisitionLine,
  PurchaseRequisitionPriority,
  PurchaseRequisitionSource,
} from '../types/purchaseDomain'

export type PrEditorHeader = {
  documentDate: string
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
  /** true = create RFQ after approval; false = ready for direct PO */
  rfqRequired: boolean
}

export type PrEditorLine = PurchaseRequisitionLine & { key: string }

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
    errors.push('Department is mandatory.')
    fieldErrors.department = 'Required'
  }
  if (!header.locationId.trim()) {
    errors.push('Location is mandatory.')
    fieldErrors.locationId = 'Required'
  }
  if (
    header.expectedDeliveryDate &&
    header.documentDate &&
    header.expectedDeliveryDate < header.documentDate
  ) {
    errors.push('Required-by date cannot be before PR date.')
    fieldErrors.expectedDeliveryDate = 'Cannot be before PR date'
  }

  const usableLines = lines.filter(
    (l) => l.itemName.trim() || l.itemCode.trim() || l.itemId || Number(l.quantity) > 0,
  )
  if (usableLines.length === 0) {
    errors.push('At least one line is mandatory.')
  }

  for (const line of usableLines) {
    const prefix = `Line ${line.lineNo}`
    if (!line.itemName.trim() && !line.itemCode.trim()) {
      errors.push(`${prefix}: Item or service description is mandatory.`)
      lineErrors[`${line.key}:itemName`] = 'Description required'
    }
    if (!(Number(line.quantity) > 0)) {
      errors.push(`${prefix}: Quantity must be greater than zero.`)
      lineErrors[`${line.key}:quantity`] = 'Must be > 0'
    }
    if (!line.uom.trim()) {
      errors.push(`${prefix}: Unit of measure is mandatory.`)
      lineErrors[`${line.key}:uom`] = 'Required'
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
  if (header.source === 'work_order' && !header.productionOrderNo.trim()) {
    errors.push('Production Order is mandatory when source is Production Order.')
    fieldErrors.productionOrderNo = 'Required'
  }
  if (header.source === 'maintenance' && !header.maintenanceOrderNo.trim()) {
    errors.push('Maintenance Order is mandatory when source is Maintenance.')
    fieldErrors.maintenanceOrderNo = 'Required'
  }

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
  const usable = lines.filter((l) => l.itemName.trim() || l.itemCode.trim() || Number(l.quantity) > 0)
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
