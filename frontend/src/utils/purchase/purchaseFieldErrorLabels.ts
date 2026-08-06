import { formatRequiredFieldsNotifyMessage } from '@/utils/formValidation'

/** Stable field path → short label for purchase forms / PO API Zod paths. */
const HEADER_FIELD_LABELS: Record<string, string> = {
  vendorId: 'Vendor',
  orderDate: 'PO Date',
  documentDate: 'PO Date',
  expectedDeliveryDate: 'Expected Delivery Date',
  placeOfSupply: 'Place of Supply',
  currencyCode: 'Currency',
  paymentTerms: 'Payment Terms',
  deliveryTerms: 'Delivery Terms',
  paymentTermId: 'Payment Term',
  deliveryTermId: 'Delivery Term',
  deliveryWarehouseId: 'Delivery Warehouse',
  freightAmount: 'Freight',
  taxAmount: 'Tax',
  termsAndConditions: 'Terms & Conditions',
  remarks: 'Remarks',
  lines: 'Item lines',
  body: 'Form',
}

const LINE_PROP_LABELS: Record<string, string> = {
  itemId: 'Item',
  itemName: 'Item name',
  itemCode: 'Item code',
  lineType: 'Line type',
  quantity: 'Quantity',
  uomQuantity: 'Quantity',
  rate: 'Rate',
  uomId: 'UOM',
  hsnId: 'HSN/SAC',
  hsnCode: 'HSN/SAC',
  binId: 'Bin',
  requiredDate: 'Required date',
  description: 'Description',
  remarks: 'Remarks',
}

/**
 * Map API / Zod field path + issue message to a short label for banners and toasts.
 * Example: lines.0.quantity + "Quantity must…" → "Line 1 · Quantity"
 */
export function humanizePurchaseFieldPath(field: string): string {
  const path = field.replace(/^body\./, '').trim()
  if (!path) return 'Form'

  const lineMatch = path.match(/^lines\.(\d+)(?:\.(.+))?$/)
  if (lineMatch) {
    const lineNo = Number(lineMatch[1]) + 1
    const prop = lineMatch[2]
    if (!prop) return `Line ${lineNo}`
    const propLabel = LINE_PROP_LABELS[prop] ?? prop
    return `Line ${lineNo} · ${propLabel}`
  }

  return HEADER_FIELD_LABELS[path] ?? path
}

/**
 * Prefer the issue message when it already names the field; otherwise combine path + message.
 */
export function formatPurchaseValidationItem(
  field: string,
  message: string,
): { field: string; message: string; label: string } {
  const msg = (message || '').trim()
  const pathLabel = humanizePurchaseFieldPath(field)

  // Zod often returns human-readable issue text already.
  if (msg && !/^(required|invalid|expected)/i.test(msg) && msg.length > 3) {
    // Avoid "lines.0.quantity: …" noise when message is enough and specific.
    if (/^item name is required/i.test(msg)) {
      return { field, message: msg, label: pathLabel.includes('Line') ? `${pathLabel}` : 'Item name' }
    }
    if (/add at least one line/i.test(msg)) {
      return { field, message: msg, label: 'At least one item line' }
    }
    if (/vendor is required/i.test(msg) || /invalid uuid/i.test(msg) && field === 'vendorId') {
      return { field, message: msg, label: 'Vendor' }
    }
    // "Either uomQuantity or quantity is required"
    if (/uomQuantity|quantity is required/i.test(msg)) {
      return { field, message: msg, label: pathLabel.includes('Line') ? `${pathLabel}` : 'Quantity' }
    }
    // Generic Zod uuid message for vendor
    if (field === 'vendorId') {
      return { field, message: msg, label: 'Vendor' }
    }
    // Keep readable short issue messages as labels for the checklist
    if (msg.length <= 80 && !msg.includes(field)) {
      return { field, message: msg, label: msg.replace(/\.$/, '') }
    }
    return { field, message: msg, label: `${pathLabel}: ${msg.replace(/\.$/, '')}` }
  }

  return { field, message: msg || 'Required', label: pathLabel }
}

export function formatPurchaseFieldErrorList(
  fieldErrors: Array<{ field: string; message: string }>,
): string[] {
  const labels: string[] = []
  const seen = new Set<string>()
  for (const e of fieldErrors) {
    const { label } = formatPurchaseValidationItem(e.field, e.message)
    const key = label.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    labels.push(label)
  }
  return labels
}

export function formatPurchaseValidationNotifyMessage(
  fieldErrors: Array<{ field: string; message: string }>,
): string {
  return formatRequiredFieldsNotifyMessage(formatPurchaseFieldErrorList(fieldErrors))
}
