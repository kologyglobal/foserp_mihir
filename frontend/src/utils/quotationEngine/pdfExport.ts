import { useDmsStore } from '../../store/dmsStore'
import { downloadPrintDocumentPdf, type DocumentPdfResult } from '../documentPdfDownload'
import { quotationNoWithRevision, quotationRevisionLabel, quotationRevisionSuffix } from './revisionLabels'

/** Browser print dialog (Save as PDF still available from the system print UI). */
export function printQuotationDocument(options?: { fileName?: string }): void {
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

/** Suggested PDF file name for print / download dialogs. Original create has no R suffix. */
export function quotationPdfFileName(quotationNo: string, revisionNo?: number): string {
  const rev = revisionNo != null ? quotationRevisionSuffix(revisionNo) : ''
  return rev ? `${quotationNo}-${rev}.pdf` : `${quotationNo}.pdf`
}

/** Download a real PDF that matches the on-screen quotation letterhead preview. */
export async function downloadQuotationPdf(options: {
  fileName: string
}): Promise<DocumentPdfResult> {
  return downloadPrintDocumentPdf({
    fileName: options.fileName,
    selectors: ['.quo-print-doc', '.quo-preview-canvas .quo-print-doc'],
  })
}

export function saveQuotationPdfToDms(input: {
  quotationNo: string
  revisionNo: number
  quotationId: string
  documentId: string
  customerId?: string
}): { ok: boolean; error?: string; documentId?: string } {
  const revLabel = quotationRevisionLabel(input.revisionNo)
  const content = [
    'QUOTATION PDF EXPORT',
    `Quotation: ${quotationNoWithRevision(input.quotationNo, input.revisionNo)}`,
    `Revision: ${revLabel}`,
    `Generated: ${new Date().toISOString()}`,
    'Use Download PDF on the quotation preview for the formatted customer document.',
  ].join('\n')

  const entityLinks = input.customerId
    ? [{ entityType: 'customer' as const, entityId: input.customerId, linkRole: 'reference' as const }]
    : undefined

  return useDmsStore.getState().uploadDocument({
    title: quotationNoWithRevision(input.quotationNo, input.revisionNo),
    fileName: quotationPdfFileName(input.quotationNo, input.revisionNo),
    category: 'sales_attachment',
    mimeType: 'application/pdf',
    fileContent: content,
    revision: revLabel,
    remarks: 'Quotation PDF generated from CRM quotation builder',
    entityLinks,
  })
}
