import type { CrmTaxInvoice } from '../types/crmCommercial'
import { downloadPrintDocumentPdf, type DocumentPdfResult } from './documentPdfDownload'

export function crmTaxInvoicePdfFileName(invoiceNo: string): string {
  const safe = invoiceNo.trim().replace(/[^\w.-]+/g, '_') || 'TaxInvoice'
  return `${safe}.pdf`
}

/** Download a PDF of the on-screen tax invoice letterhead preview. */
export async function downloadCrmTaxInvoicePdf(invoice: CrmTaxInvoice): Promise<DocumentPdfResult> {
  return downloadPrintDocumentPdf({
    fileName: crmTaxInvoicePdfFileName(invoice.invoiceNo),
    selectors: ['.ti-print-doc', '#crm-tax-invoice-print', '.pi-print-doc'],
  })
}

/** Browser print dialog from the on-page preview. */
export function printCrmTaxInvoiceDocument(options?: { fileName?: string }): void {
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
