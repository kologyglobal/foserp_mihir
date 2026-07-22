import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
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
  [/tx\.vendorInvoice\b/g, 'tx.vendorAdjustment'],
  [/documentType: 'VENDOR_ADJUSTMENT'/g, "documentType: 'VENDOR_ADJUSTMENT'"],
  [/sourceDocumentType: 'VENDOR_ADJUSTMENT'/g, "sourceDocumentType: 'VENDOR_ADJUSTMENT'"],
  [/referenceDocumentType: sourceLine \? 'VENDOR_ADJUSTMENT_LINE' : 'VENDOR_ADJUSTMENT'/g,
    "referenceDocumentType: sourceLine ? 'VENDOR_ADJUSTMENT_LINE' : (invoice.adjustmentType === 'VENDOR_DEBIT_NOTE' ? 'VENDOR_DEBIT_NOTE' : 'VENDOR_CREDIT_ADJUSTMENT')"],
  [/input\.taxTreatment/g, 'input.purchaseTaxTreatment'],
  [/body\.taxTreatment/g, 'body.purchaseTaxTreatment'],
  [/body\.itcEligibility/g, 'body.itcTreatment'],
  [/body\.tdsRecognitionMode/g, 'body.tdsTreatment'],
  [/header\.taxTreatment/g, 'header.purchaseTaxTreatment'],
  [/header\.itcEligibility/g, 'header.itcTreatment'],
  [/header\.tdsRecognitionMode/g, 'header.tdsTreatment'],
  [/data\.taxTreatment/g, 'data.purchaseTaxTreatment'],
  [/data\.itcEligibility/g, 'data.itcTreatment'],
  [/data\.tdsRecognitionMode/g, 'data.tdsTreatment'],
  [/taxTreatment: input\./g, 'purchaseTaxTreatment: input.'],
  [/taxTreatment: header\./g, 'purchaseTaxTreatment: header.'],
  [/taxTreatment: line\./g, 'purchaseTaxTreatment: line.'],
  [/itcEligibility: header\./g, 'itcTreatment: header.'],
  [/tdsRecognitionMode: header\./g, 'tdsTreatment: header.'],
  [/itcEligibility: line\./g, 'itcTreatment: line.'],
  [/taxTreatment: line\./g, 'purchaseTaxTreatment: line.'],
  [/input\.tdsRecognitionMode/g, 'input.tdsTreatment'],
  [/tdsRecognitionMode: input\./g, 'tdsTreatment: input.'],
  [/tdsRecognitionMode\?: TdsRecognitionMode/g, 'tdsTreatment?: VendorAdjustmentTdsTreatment'],
  [/import type \{([^}]*?)TdsRecognitionMode([^}]*?)\} from '@prisma\/client'/g,
    "import type {$1VendorAdjustmentTdsTreatment, VendorInvoiceTaxTreatment$2} from '@prisma/client'"],
]

for (const file of walk(root)) {
  let content = readFileSync(file, 'utf8')
  const before = content
  for (const [re, rep] of replacements) content = content.replace(re, rep)
  if (content !== before) writeFileSync(file, content, 'utf8')
}

console.log('Bulk field renames applied')
