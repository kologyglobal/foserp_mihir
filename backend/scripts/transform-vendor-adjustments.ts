import { readdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(process.cwd(), 'src/modules/accounting/payables/vendor-adjustments')

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else out.push(p)
  }
  return out
}

const replacements: Array<[RegExp, string]> = [
  [/vendor-invoice/g, 'vendor-adjustment'],
  [/VendorInvoice/g, 'VendorAdjustment'],
  [/vendor_invoice/g, 'vendor_adjustment'],
  [/VENDOR_INVOICE/g, 'VENDOR_ADJUSTMENT'],
  [/supplierInvoice/g, 'supplierReference'],
  [/SupplierInvoice/g, 'SupplierReference'],
  [/invoiceGrandTotal/g, 'adjustmentGrandTotal'],
  [/InvoiceGrandTotal/g, 'AdjustmentGrandTotal'],
  [/vendorInvoiceNumber/g, 'vendorAdjustmentNumber'],
  [/VendorInvoiceNumber/g, 'VendorAdjustmentNumber'],
  [/finance\.ap\.vendor_invoice/g, 'finance.ap.adjustment'],
  [/VIN-DRAFT/g, 'VADJ-DRAFT'],
  [/VENDOR_INVOICE_LINE/g, 'VENDOR_ADJUSTMENT_LINE'],
  [/invoiceType/g, 'adjustmentType'],
  [/InvoiceType/g, 'AdjustmentType'],
  [/debitAccountId/g, 'offsetAccountId'],
  [/DebitAccount/g, 'OffsetAccount'],
  [/LINE_DEBIT/g, 'LINE_OFFSET'],
]

for (const file of walk(root)) {
  const base = file.split(/[/\\]/).pop()!
  const newBase = replacements.reduce((n, [re, rep]) => n.replace(re, rep), base)
  let content = readFileSync(file, 'utf8')
  for (const [re, rep] of replacements) content = content.replace(re, rep)
  const target = newBase !== base ? join(file, '..', newBase) : file
  writeFileSync(target, content, 'utf8')
  if (target !== file) unlinkSync(file)
}

console.log('Transformed vendor-adjustments module')
