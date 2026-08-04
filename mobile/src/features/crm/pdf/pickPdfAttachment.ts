import type { CrmAttachment } from '@/types/crm'

const PDF_DOC_TYPES = new Set([
  'quotation_pdf',
  'QUOTATION_PDF',
  'signed_quotation',
  'SIGNED_QUOTATION',
  'sales_order_pdf',
  'SALES_ORDER_PDF',
  'pdf',
  'PDF',
])

export function pickPdfAttachment(files: CrmAttachment[]): CrmAttachment | null {
  const pdfs = files.filter(
    (f) =>
      (f.mimeType || '').includes('pdf') ||
      PDF_DOC_TYPES.has(String(f.documentType || '')) ||
      (f.originalFilename || '').toLowerCase().endsWith('.pdf'),
  )
  if (!pdfs.length) return null
  const sorted = pdfs.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
  return sorted[0] ?? null
}
