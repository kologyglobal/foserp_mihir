export type PoEditorHeaderFields = {
  documentDate: string
  vendorId: string
  expectedDeliveryDate: string
  placeOfSupply?: string
}

export type PoEditorLineFields = {
  key: string
  lineNo: number
  itemId?: string
  itemCode: string
  itemName: string
  quantity: number
  rate: number
  uom?: string
}

export type PoValidationMode = 'draft' | 'submit'

export type PoValidationResult = {
  errors: string[]
  fieldErrors: Record<string, string>
  lineErrors: Record<string, string>
  /** FastTab section ids to expand (`general` | `commercial` | `lines`) */
  sectionsToOpen: Array<'general' | 'commercial' | 'lines'>
  /** Prefer scrolling to this field DOM id when present */
  firstFieldId: string | null
  firstSection: 'general' | 'commercial' | 'lines' | null
}

export function purchaseFieldId(field: string) {
  return `purchase-field-${field}`
}

export function purchaseLineFieldId(lineKey: string, field: string) {
  return `purchase-line-${lineKey}-${field}`
}

function lineHasAnyContent(line: PoEditorLineFields) {
  return Boolean(
    line.itemId ||
      line.itemCode.trim() ||
      line.itemName.trim() ||
      Number(line.quantity) > 0 ||
      Number(line.rate) > 0,
  )
}

function lineIsComplete(line: PoEditorLineFields) {
  const hasItem = Boolean(line.itemId || line.itemCode.trim() || line.itemName.trim())
  return hasItem && Number(line.quantity) > 0 && Number(line.rate) > 0
}

/**
 * Client-side Purchase Order validation for editor Save Draft / Submit for Approval.
 * Messages are concise for the top validation summary.
 */
export function validatePurchaseOrderForm(
  header: PoEditorHeaderFields,
  lines: PoEditorLineFields[],
  mode: PoValidationMode = 'submit',
): PoValidationResult {
  const errors: string[] = []
  const fieldErrors: Record<string, string> = {}
  const lineErrors: Record<string, string> = {}
  const sectionsToOpen: Array<'general' | 'commercial' | 'lines'> = []

  const pushSection = (section: 'general' | 'commercial' | 'lines') => {
    if (!sectionsToOpen.includes(section)) sectionsToOpen.push(section)
  }

  if (!header.vendorId.trim()) {
    errors.push('Vendor is required.')
    fieldErrors.vendorId = 'Required'
    pushSection('general')
  }

  if (mode === 'draft') {
    return {
      errors,
      fieldErrors,
      lineErrors,
      sectionsToOpen,
      firstFieldId: fieldErrors.vendorId ? purchaseFieldId('vendorId') : null,
      firstSection: sectionsToOpen[0] ?? null,
    }
  }

  if (!header.documentDate.trim()) {
    errors.push('PO Date is required.')
    fieldErrors.documentDate = 'Required'
    pushSection('general')
  }

  if (!header.expectedDeliveryDate.trim()) {
    errors.push('Expected Delivery Date is required.')
    fieldErrors.expectedDeliveryDate = 'Required'
    pushSection('commercial')
  } else if (
    header.documentDate &&
    header.expectedDeliveryDate < header.documentDate
  ) {
    errors.push('Expected Delivery Date cannot be before PO Date.')
    fieldErrors.expectedDeliveryDate = 'Cannot be before PO Date'
    pushSection('commercial')
  }

  const usableLines = lines.filter(lineHasAnyContent)
  const completeLines = usableLines.filter(lineIsComplete)

  if (completeLines.length === 0) {
    errors.push('At least one complete item line is required.')
    pushSection('lines')
  }

  for (const line of usableLines) {
    const prefix = `Line ${line.lineNo}`
    const hasItem = Boolean(line.itemId || line.itemCode.trim() || line.itemName.trim())

    if (!hasItem) {
      errors.push(`${prefix}: Item is required.`)
      lineErrors[`${line.key}:item`] = 'Item required'
      pushSection('lines')
    }
    if (!(Number(line.quantity) > 0)) {
      errors.push(`${prefix}: Quantity must be greater than zero.`)
      lineErrors[`${line.key}:quantity`] = 'Must be > 0'
      pushSection('lines')
    }
    if (!(Number(line.rate) > 0)) {
      errors.push(`${prefix}: Rate is required.`)
      lineErrors[`${line.key}:rate`] = 'Rate required'
      pushSection('lines')
    }
  }

  let firstFieldId: string | null = null
  if (fieldErrors.vendorId) firstFieldId = purchaseFieldId('vendorId')
  else if (fieldErrors.documentDate) firstFieldId = purchaseFieldId('documentDate')
  else if (fieldErrors.expectedDeliveryDate) firstFieldId = purchaseFieldId('expectedDeliveryDate')
  else if (usableLines.length === 0 && completeLines.length === 0) {
    firstFieldId = purchaseFieldId('lines')
  } else {
    for (const line of usableLines) {
      if (lineErrors[`${line.key}:item`]) {
        firstFieldId = purchaseLineFieldId(line.key, 'item')
        break
      }
      if (lineErrors[`${line.key}:quantity`]) {
        firstFieldId = purchaseLineFieldId(line.key, 'quantity')
        break
      }
      if (lineErrors[`${line.key}:rate`]) {
        firstFieldId = purchaseLineFieldId(line.key, 'rate')
        break
      }
    }
    if (!firstFieldId && completeLines.length === 0) {
      firstFieldId = purchaseFieldId('lines')
    }
  }

  return {
    errors,
    fieldErrors,
    lineErrors,
    sectionsToOpen,
    firstFieldId,
    firstSection: sectionsToOpen[0] ?? null,
  }
}
