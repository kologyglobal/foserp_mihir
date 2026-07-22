import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const fixes: Array<[string, Array<[RegExp, string]>]> = [
  [
    'vendor-adjustment-line.repository.ts',
    [
      [/tx\.vendorInvoiceLine/g, 'tx.vendorAdjustmentLine'],
    ],
  ],
  [
    'vendor-adjustment-workflow.service.ts',
    [
      [/tx\.vendorInvoice\.update/g, 'tx.vendorAdjustment.update'],
    ],
  ],
  [
    'vendor-adjustment.repository.ts',
    [
      [/tx\.vendorInvoice\.update/g, 'tx.vendorAdjustment.update'],
      [/tx\.vendorInvoiceSourceLink/g, 'tx.vendorAdjustmentSourceLink'],
      [/tx\.vendorInvoice\.updateMany/g, 'tx.vendorAdjustment.updateMany'],
      [/taxTreatment:/g, 'taxEffect:'],
      [/itcEligibility:/g, 'itcTreatment:'],
      [/tdsRecognitionMode:/g, 'tdsTreatment:'],
      [/documentType: 'VENDOR_ADJUSTMENT'/g, "documentType: input.documentType"],
      [/side: 'CREDIT',\n        documentType: input.documentType/g, 'side: input.side,\n        documentType: input.documentType'],
    ],
  ],
  [
    'vendor-adjustment.schemas.ts',
    [
      [/export const vendorAdjustmentTypeSchema = z\.enum\(\['GOODS', 'SERVICE', 'EXPENSE', 'ASSET', 'MIXED'\]\)/,
        "export const vendorAdjustmentTypeSchema = z.enum(['VENDOR_DEBIT_NOTE', 'VENDOR_CREDIT_ADJUSTMENT'])"],
      [/vendorAdjustmentStatusSchema/g, 'vendorAdjustmentStatusSchema'],
    ],
  ],
]

const root = join(process.cwd(), 'src/modules/accounting/payables/vendor-adjustments')

for (const [file, reps] of fixes) {
  const path = join(root, file.includes('/') ? file : file)
  const actual = [join(root, file), join(root, 'posting', file)].find((p) => {
    try { readFileSync(p); return true } catch { return false }
  })
  if (!actual) continue
  let content = readFileSync(actual, 'utf8')
  for (const [re, rep] of reps) content = content.replace(re, rep)
  writeFileSync(actual, content, 'utf8')
}

// Fix schemas file fully
const schemaPath = join(root, 'vendor-adjustment.schemas.ts')
let schema = readFileSync(schemaPath, 'utf8')
schema = schema.replace(
  /export const vendorAdjustmentStatusSchema = z\.enum\([\s\S]*?\]\)/,
  `export const vendorAdjustmentStatusSchema = z.enum([
  'DRAFT',
  'PENDING_APPROVAL',
  'REJECTED',
  'READY_TO_POST',
  'POSTED',
  'CANCELLED',
  'REVERSED',
])`,
)
schema = schema.replace(/vendorInvoiceStatusSchema/g, 'vendorAdjustmentStatusSchema')
writeFileSync(schemaPath, schema, 'utf8')

console.log('Applied targeted fixes')
