import type { SalesInvoiceDto } from '../types/moneyIn'
import { downloadPrintDocumentPdf, type DocumentPdfResult } from './documentPdfDownload'

export function salesInvoicePdfFileName(
  invoice: Pick<SalesInvoiceDto, 'invoiceNumber' | 'draftReference'>,
): string {
  const label = invoice.invoiceNumber?.trim() || invoice.draftReference?.trim() || 'SalesInvoice'
  const safe = label.replace(/[^\w.-]+/g, '_') || 'SalesInvoice'
  return `${safe}.pdf`
}

/** Download PDF of the on-screen Money In sales invoice letterhead preview. */
export async function downloadSalesInvoicePdf(invoice: SalesInvoiceDto): Promise<DocumentPdfResult> {
  return downloadPrintDocumentPdf({
    fileName: salesInvoicePdfFileName(invoice),
    // Prefer the unified letterhead only (same DOM as screen + print).
    selectors: ['.mi-si-print-doc', '#sales-invoice-print'],
  })
}

export function printSalesInvoiceDocument(options?: { fileName?: string }): void {
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
