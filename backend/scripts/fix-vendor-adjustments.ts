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
  [/prisma\.vendorInvoice\b/g, 'prisma.vendorAdjustment'],
  [/prisma\.vendorInvoiceLine\b/g, 'prisma.vendorAdjustmentLine'],
  [/prisma\.vendorInvoiceSourceLink\b/g, 'prisma.vendorAdjustmentSourceLink'],
  [/vendorInvoiceId/g, 'vendorAdjustmentId'],
  [/vendorInvoiceStatusSchema/g, 'vendorAdjustmentStatusSchema'],
  [/VendorAdjustmentTaxTreatment/g, 'VendorAdjustmentTaxEffect'],
  [/vendorInvoiceCalculation/g, 'vendorAdjustmentCalculation'],
  [/VendorInvoiceCalculation/g, 'VendorAdjustmentCalculation'],
  [/vendorInvoiceHeaderDiscountTypeSchema/g, 'vendorAdjustmentHeaderDiscountTypeSchema'],
  [/vendorInvoicePurchaseSupplyTypeSchema/g, 'vendorAdjustmentPurchaseSupplyTypeSchema'],
  [/vendorInvoiceSourceLinkTypeSchema/g, 'vendorAdjustmentSourceLinkTypeSchema'],
  [/vendorInvoiceTaxTreatmentSchema/g, 'vendorAdjustmentTaxEffectSchema'],
  [/inputTaxCreditEligibilitySchema/g, 'vendorAdjustmentItcTreatmentSchema'],
  [/tdsRecognitionModeSchema/g, 'vendorAdjustmentTdsTreatmentSchema'],
  [/buildSupplierReferenceUniquenessKey/g, 'buildSupplierReferenceUniquenessKey'],
  [/normalizeSupplierReferenceNumber/g, 'normalizeSupplierReferenceNumber'],
  [/findVendorAdjustmentWithLinesOrThrow/g, 'findVendorAdjustmentWithLinesOrThrow'],
  [/createVendorAdjustmentPayableOpenItem/g, 'createVendorAdjustmentPayableOpenItem'],
  [/finalizePostedVendorAdjustment/g, 'finalizePostedVendorAdjustment'],
  [/findPayableOpenItemBySourceVendorAdjustment/g, 'findPayableOpenItemBySourceVendorAdjustment'],
]

for (const file of walk(root)) {
  let content = readFileSync(file, 'utf8')
  for (const [re, rep] of replacements) content = content.replace(re, rep)
  writeFileSync(file, content, 'utf8')
}

console.log('Fixed prisma model references')
