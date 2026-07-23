import { useDmsStore } from '../../store/dmsStore'
import { triggerPrintPdf } from '../documentPrint'

/** Browser print → PDF (customer-facing layout uses @media print styles) */
export function printQuotationDocument(): void {
  triggerPrintPdf()
}

export function saveQuotationPdfToDms(input: {
  quotationNo: string
  revisionNo: number
  quotationId: string
  documentId: string
  customerId?: string
}): { ok: boolean; error?: string; documentId?: string } {
  const content = [
    'QUOTATION PDF EXPORT',
    `Quotation: ${input.quotationNo}`,
    `Revision: R${input.revisionNo}`,
    `Generated: ${new Date().toISOString()}`,
    'Use Print → Save as PDF for full formatted output.',
  ].join('\n')

  const entityLinks = input.customerId
    ? [{ entityType: 'customer' as const, entityId: input.customerId, linkRole: 'reference' as const }]
    : undefined

  return useDmsStore.getState().uploadDocument({
    title: `${input.quotationNo} Rev ${input.revisionNo}`,
    fileName: `${input.quotationNo}-R${input.revisionNo}.pdf`,
    category: 'sales_attachment',
    mimeType: 'application/pdf',
    fileContent: content,
    revision: `R${input.revisionNo}`,
    remarks: 'Quotation PDF generated from CRM quotation builder',
    entityLinks,
  })
}
