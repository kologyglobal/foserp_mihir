import {
  downloadElementAsPdf,
  findPrintDocumentElement,
  type DocumentPdfResult,
} from './documentPdfDownload'
import { notify } from '@/store/toastStore'

/** Browser print for on-page `.po-print-doc` preview. */
export function printPurchaseDocument(options?: { fileName?: string }): void {
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

/** Capture the on-page purchase letterhead document as a real A4 PDF. */
export async function downloadPurchaseDocumentPdf(fileName: string): Promise<DocumentPdfResult> {
  const el = findPrintDocumentElement('.po-print-doc')
  if (!el) {
    return { ok: false, error: 'Print document not found on page.' }
  }
  return downloadElementAsPdf(el, fileName)
}

export async function handlePurchasePdfDownload(fileName: string): Promise<void> {
  const result = await downloadPurchaseDocumentPdf(fileName)
  if (!result.ok) {
    notify.error(result.error)
    return
  }
  notify.success(`Downloaded ${result.fileName}`)
}
