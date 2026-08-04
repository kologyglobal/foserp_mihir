import type { CustomerReceiptDto } from '../types/moneyIn'
import { downloadPrintDocumentPdf, type DocumentPdfResult } from './documentPdfDownload'

export function customerReceiptPdfFileName(
  receipt: Pick<CustomerReceiptDto, 'receiptNumber' | 'draftReference'>,
): string {
  const label = receipt.receiptNumber?.trim() || receipt.draftReference?.trim() || 'CustomerReceipt'
  const safe = label.replace(/[^\w.-]+/g, '_') || 'CustomerReceipt'
  return `${safe}.pdf`
}

/** Download a PDF of the on-screen Money In customer receipt letterhead preview. */
export async function downloadCustomerReceiptPdf(receipt: CustomerReceiptDto): Promise<DocumentPdfResult> {
  return downloadPrintDocumentPdf({
    fileName: customerReceiptPdfFileName(receipt),
    selectors: ['.mi-rcpt-print-doc', '#customer-receipt-print', '.pi-print-doc'],
  })
}

/** Browser print dialog from the on-page preview. */
export function printCustomerReceiptDocument(options?: { fileName?: string }): void {
  const previousTitle = document.title
  if (options?.fileName?.trim()) {
    document.title = options.fileName.trim().replace(/\.pdf$/i, '')
  }
  window.requestAnimationFrame(() => {
    window.setTimeout(() => {
      try {
        window.print()
      } finally {
        window.setTimeout(() => {
          document.title = previousTitle
        }, 800)
      }
    }, 120)
  })
}
