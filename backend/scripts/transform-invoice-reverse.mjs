import fs from 'fs'

const p =
  'src/modules/accounting/payables/vendor-invoices/posting/vendor-invoice-reverse.service.ts'
let c = fs.readFileSync(p, 'utf8')

const reps = [
  [/VendorPaymentNotFoundError/g, 'VendorInvoiceNotFoundError'],
  [/VendorPaymentStaleVersionError/g, 'VendorInvoiceStaleVersionError'],
  [/VendorPaymentActiveAllocationsExistError/g, 'VendorInvoiceActiveAllocationsExistError'],
  [/VendorPaymentOpenItemNotFullyRestoredError/g, 'VendorInvoiceOpenItemNotFullyRestoredError'],
  [/VendorPaymentOriginalPostingEventMissingError/g, 'VendorInvoiceOriginalPostingEventMissingError'],
  [/VendorPaymentOriginalVoucherMissingError/g, 'VendorInvoiceOriginalVoucherMissingError'],
  [/VendorPaymentReversalDateInvalidError/g, 'VendorInvoiceReversalDateInvalidError'],
  [/VendorPaymentReversalEligibilityError/g, 'VendorInvoiceReversalEligibilityError'],
  [/VendorPaymentReversalFailedError/g, 'VendorInvoiceReversalFailedError'],
  [/VendorPaymentReversalNotAllowedError/g, 'VendorInvoiceReversalNotAllowedError'],
  [/VendorPaymentReversalNotPostedError/g, 'VendorInvoiceReversalNotPostedError'],
  [/mapPostingErrorToVendorPaymentReversalError/g, 'mapPostingErrorToVendorInvoiceReversalError'],
  [/buildVendorPaymentReverseEventKey/g, 'buildVendorInvoiceReverseEventKey'],
  [/assertPaymentReversePermission/g, 'assertInvoiceReversePermission'],
  [/ReverseVendorPaymentInput/g, 'ReverseVendorInvoiceInput'],
  [/ReverseVendorPaymentResult/g, 'ReverseVendorInvoiceResult'],
  [/VendorPaymentReversalPreview/g, 'VendorInvoiceReversalPreview'],
  [/getVendorPaymentReversalPreview/g, 'getVendorInvoiceReversalPreview'],
  [/reverseVendorPaymentFromRequest/g, 'reverseVendorInvoiceFromRequest'],
  [/reverseVendorPayment\b/g, 'reverseVendorInvoice'],
  [/vendorPaymentId/g, 'vendorInvoiceId'],
  [/vendorPaymentNumber/g, 'vendorInvoiceNumber'],
  [/VENDOR_PAYMENT_REVERSED/g, 'VENDOR_INVOICE_REVERSED'],
  [/VENDOR_PAYMENT_REVERSAL_/g, 'VENDOR_INVOICE_REVERSAL_'],
  [/finance\.ap\.payment\.reverse/g, 'finance.ap.vendor_invoice.reverse'],
  [/Vendor Payment/g, 'Vendor Invoice'],
  [/vendor payment/g, 'vendor invoice'],
  [/Posted payment/g, 'Posted invoice'],
  [/Payment DEBIT/g, 'Invoice CREDIT'],
  [/DEBIT open item/g, 'CREDIT open item'],
  [/entity: 'vendor_payment'/g, "entity: 'vendor_invoice'"],
  [/prisma\.vendorPayment/g, 'prisma.vendorInvoice'],
  [/tx\.vendorPayment/g, 'tx.vendorInvoice'],
  [/VendorPayment/g, 'VendorInvoice'],
  [/payment: VendorInvoice/g, 'invoice: VendorInvoice'],
  [/\bpayment\./g, 'invoice.'],
  [/const payment =/g, 'const invoice ='],
  [/if \(!payment\)/g, 'if (!invoice)'],
  [/\(payment,/g, '(invoice,'],
  [/, payment,/g, ', invoice,'],
  [/\(payment\)/g, '(invoice)'],
  [/paymentId:/g, 'invoiceId:'],
  [/args\.paymentId/g, 'args.invoiceId'],
  [/from '\.\.\/vendor-payment\.errors\.js'/g, "from '../vendor-invoice.errors.js'"],
  [/from '\.\/vendor-payment-posting\.errors\.js'/g, "from './vendor-invoice-posting.errors.js'"],
  [/from '\.\/vendor-payment-posting\.types\.js'/g, "from './vendor-invoice-posting.types.js'"],
  [/sourceDocumentType: 'VENDOR_PAYMENT'/g, "sourceDocumentType: 'VENDOR_INVOICE'"],
  [/'DEBIT'/g, "'CREDIT'"],
]

for (const [a, b] of reps) c = c.replace(a, b)

// Invoice has no payableOpenItemId — resolve via sourceVendorInvoiceId
c = c.replace(
  /if \(!invoice\.payableOpenItemId\) \{[\s\S]*?throw new VendorInvoiceReversalEligibilityError\('Posted invoice is missing CREDIT open item'\)\n  \}/,
  `const resolvedOpenItem = await prisma.payableOpenItem.findFirst({
    where: { tenantId: context.tenantId, legalEntityId: invoice.legalEntityId, sourceVendorInvoiceId: invoice.id },
  })
  if (!resolvedOpenItem) {
    throw new VendorInvoiceReversalEligibilityError('Posted invoice is missing CREDIT open item')
  }
  const openItemId = resolvedOpenItem.id`,
)

// Replace remaining invoice.payableOpenItemId references with openItemId
c = c.replace(/invoice\.payableOpenItemId!/g, 'openItemId')
c = c.replace(/invoice\.payableOpenItemId/g, 'openItemId')

// Preview function also needs open item resolution
c = c.replace(
  /if \(invoice\.payableOpenItemId\) \{/,
  'const previewOpenItemId = (await prisma.payableOpenItem.findFirst({ where: { tenantId, legalEntityId: invoice.legalEntityId, sourceVendorInvoiceId: invoice.id } }))?.id\n  if (previewOpenItemId) {',
)

fs.writeFileSync(p, c)
console.log('transformed', p, c.length)
