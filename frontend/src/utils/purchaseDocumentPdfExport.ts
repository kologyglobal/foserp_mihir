import {
  downloadElementAsPdf,
  findPrintDocumentElement,
  type DocumentPdfResult,
} from './documentPdfDownload'
import {
  purchasePrintOrientation,
  type PurchasePrintDocumentKind,
  type PurchasePrintOrientationLocked,
} from './purchasePrintFormat'
import { notify } from '@/store/toastStore'

export type PurchasePrintOptions = {
  fileName?: string
  documentKind?: PurchasePrintDocumentKind
  /** Override only when caller already resolved orientation from document kind. */
  orientation?: PurchasePrintOrientationLocked
}

function resolveOrientation(options?: PurchasePrintOptions): PurchasePrintOrientationLocked {
  if (options?.orientation) return options.orientation
  if (options?.documentKind) return purchasePrintOrientation(options.documentKind)
  return 'portrait'
}

/**
 * Inject @page A4 size for the browser print dialog, then restore after print.
 * Paper size is always A4 — orientation only varies by document type.
 */
function withPrintPageStyle(orientation: PurchasePrintOrientationLocked, run: () => void): void {
  const style = document.createElement('style')
  style.setAttribute('data-fos-purchase-print-page', '1')
  style.textContent = `@page { size: A4 ${orientation}; margin: 10mm 12mm; }`
  document.head.appendChild(style)

  const cleanup = () => {
    style.remove()
    window.removeEventListener('afterprint', cleanup)
  }
  window.addEventListener('afterprint', cleanup)
  // Fallback cleanup if afterprint does not fire
  window.setTimeout(cleanup, 60_000)
  run()
}

/** Browser print for on-page `.po-print-doc` preview — fixed A4. */
export function printPurchaseDocument(options?: PurchasePrintOptions): void {
  const previousTitle = document.title
  const orientation = resolveOrientation(options)
  if (options?.fileName?.trim()) {
    document.title = options.fileName.trim().replace(/\.pdf$/i, '')
  }
  window.requestAnimationFrame(() => {
    window.setTimeout(() => {
      withPrintPageStyle(orientation, () => {
        try {
          window.print()
        } finally {
          window.setTimeout(() => {
            document.title = previousTitle
          }, 800)
        }
      })
    }, 120)
  })
}

/** Capture the on-page purchase letterhead document as a real A4 PDF. */
export async function downloadPurchaseDocumentPdf(
  fileName: string,
  options?: Omit<PurchasePrintOptions, 'fileName'>,
): Promise<DocumentPdfResult> {
  const el = findPrintDocumentElement('.po-print-doc')
  if (!el) {
    return { ok: false, error: 'Print document not found on page.' }
  }
  return downloadElementAsPdf(el, fileName, {
    orientation: resolveOrientation(options),
  })
}

export async function handlePurchasePdfDownload(
  fileName: string,
  options?: Omit<PurchasePrintOptions, 'fileName'>,
): Promise<void> {
  const result = await downloadPurchaseDocumentPdf(fileName, options)
  if (!result.ok) {
    notify.error(result.error)
    return
  }
  notify.success(`Downloaded ${result.fileName}`)
}
