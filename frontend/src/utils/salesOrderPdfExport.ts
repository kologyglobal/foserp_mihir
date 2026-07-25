import { downloadPrintDocumentPdf, type DocumentPdfResult } from './documentPdfDownload'

/** Browser print dialog for sales order documents. */
export function printSalesOrderDocument(options?: { fileName?: string }): void {
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

export function salesOrderPdfFileName(salesOrderNo: string): string {
  const safe = salesOrderNo.trim().replace(/[^\w.-]+/g, '_') || 'SalesOrder'
  return `${safe}.pdf`
}

/** Download a real PDF that matches the on-screen sales order letterhead preview. */
export async function downloadSalesOrderPdf(options: {
  fileName: string
}): Promise<DocumentPdfResult> {
  return downloadPrintDocumentPdf({
    fileName: options.fileName,
    selectors: ['.so-print-doc'],
  })
}
