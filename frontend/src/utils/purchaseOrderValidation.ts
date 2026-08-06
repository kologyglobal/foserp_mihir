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
  lineType?: 'GOODS' | 'SERVICE'
  hsnId?: string | null
  hsnCode?: string
  sacCode?: string | null
}

export type PoValidationMode = 'draft' | 'submit'

export type PoValidationResult = {
  errors: string[]
  fieldErrors: Record<string, string>
  lineErrors: Record<string, string>
  /** FastTab section ids to expand (`general` | `lines` | `notes`) */
  sectionsToOpen: Array<'general' | 'lines' | 'notes'>
  /** Prefer scrolling to this field DOM id when present */
  firstFieldId: string | null
  firstSection: 'general' | 'lines' | 'notes' | null
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

function isFreeTextLine(line: PoEditorLineFields) {
  return !line.itemId && Boolean(line.itemName.trim() || line.itemCode.trim())
}

function lineHasHsn(line: PoEditorLineFields) {
  return Boolean(line.hsnId || line.hsnCode?.trim() || line.sacCode?.trim())
}

function lineIsComplete(line: PoEditorLineFields) {
  const hasItem = Boolean(line.itemId || line.itemCode.trim() || line.itemName.trim())
  const isQuick = isFreeTextLine(line)
  return (
    hasItem &&
    Number(line.quantity) > 0 &&
    Number(line.rate) >= 0 &&
    (!isQuick || lineHasHsn(line))
  )
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
  const sectionsToOpen: Array<'general' | 'lines' | 'notes'> = []

  const pushSection = (section: 'general' | 'lines' | 'notes') => {
    if (!sectionsToOpen.includes(section)) sectionsToOpen.push(section)
  }

  if (!header.vendorId.trim()) {
    errors.push('Vendor is required.')
    fieldErrors.vendorId = 'Required'
    pushSection('general')
  }

  const usableLines = lines.filter(lineHasAnyContent)

  // Draft still hits the same create/update line schema — free-text HSN must be present
  // before the API, otherwise save fails with lines.N.hsnId validation.
  if (mode === 'draft') {
    if (usableLines.length === 0) {
      errors.push('At least one item line is required.')
      pushSection('lines')
    }

    for (const line of usableLines) {
      if (!isFreeTextLine(line)) continue
      const prefix = `Line ${line.lineNo}`
      if (!line.itemName.trim()) {
        errors.push(`${prefix}: Item name is required for quick lines.`)
        lineErrors[`${line.key}:item`] = 'Name required'
        pushSection('lines')
      }
      if (!lineHasHsn(line)) {
        errors.push(`${prefix}: HSN/SAC is required for quick lines.`)
        lineErrors[`${line.key}:hsn`] = 'HSN/SAC required'
        pushSection('lines')
      }
    }

    // Catalog lines need a positive qty when content is entered (API requires quantity).
    for (const line of usableLines) {
      if (isFreeTextLine(line)) continue
      if (!(Number(line.quantity) > 0)) {
        errors.push(`Line ${line.lineNo}: Quantity must be greater than zero.`)
        lineErrors[`${line.key}:quantity`] = 'Must be > 0'
        pushSection('lines')
      }
    }

    let firstFieldId: string | null = null
    if (fieldErrors.vendorId) firstFieldId = purchaseFieldId('vendorId')
    else if (usableLines.length === 0) firstFieldId = purchaseFieldId('lines')
    else {
      for (const line of usableLines) {
        if (lineErrors[`${line.key}:item`]) {
          firstFieldId = purchaseLineFieldId(line.key, 'item')
          break
        }
        if (lineErrors[`${line.key}:hsn`]) {
          firstFieldId = purchaseLineFieldId(line.key, 'hsn')
          break
        }
        if (lineErrors[`${line.key}:quantity`]) {
          firstFieldId = purchaseLineFieldId(line.key, 'quantity')
          break
        }
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

  if (!header.documentDate.trim()) {
    errors.push('PO Date is required.')
    fieldErrors.documentDate = 'Required'
    pushSection('general')
  }

  if (!header.expectedDeliveryDate.trim()) {
    errors.push('Expected Delivery Date is required.')
    fieldErrors.expectedDeliveryDate = 'Required'
    pushSection('general')
  } else if (
    header.documentDate &&
    header.expectedDeliveryDate < header.documentDate
  ) {
    errors.push('Expected Delivery Date cannot be before PO Date.')
    fieldErrors.expectedDeliveryDate = 'Cannot be before PO Date'
    pushSection('general')
  }

  const completeLines = usableLines.filter(lineIsComplete)

  if (completeLines.length === 0) {
    errors.push('At least one complete item line is required.')
    pushSection('lines')
  }

  for (const line of usableLines) {
    const prefix = `Line ${line.lineNo}`
    const hasItem = Boolean(line.itemId || line.itemCode.trim() || line.itemName.trim())
    const isQuick = isFreeTextLine(line)

    if (!hasItem) {
      errors.push(`${prefix}: Item is required.`)
      lineErrors[`${line.key}:item`] = 'Item required'
      pushSection('lines')
    }
    if (isQuick && !lineHasHsn(line)) {
      errors.push(`${prefix}: HSN/SAC is required for quick lines.`)
      lineErrors[`${line.key}:hsn`] = 'HSN/SAC required'
      pushSection('lines')
    }
    if (!(Number(line.quantity) > 0)) {
      errors.push(`${prefix}: Quantity must be greater than zero.`)
      lineErrors[`${line.key}:quantity`] = 'Must be > 0'
      pushSection('lines')
    }
    if (!(Number(line.rate) >= 0) || Number.isNaN(Number(line.rate))) {
      errors.push(`${prefix}: Rate must be zero or greater.`)
      lineErrors[`${line.key}:rate`] = 'Rate invalid'
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
      if (lineErrors[`${line.key}:hsn`]) {
        firstFieldId = purchaseLineFieldId(line.key, 'hsn')
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
