import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import {
  purchasePdfPageSizeMm,
  type PurchasePrintOrientationLocked,
} from './purchasePrintFormat'

export type DocumentPdfResult = { ok: true; fileName: string } | { ok: false; error: string }

export type DownloadElementAsPdfOptions = {
  /** Locked to A4; only orientation may vary by document type. Default portrait. */
  orientation?: PurchasePrintOrientationLocked
}

function resolveFileName(fileName: string): string {
  const trimmed = fileName.trim() || 'Document.pdf'
  return trimmed.toLowerCase().endsWith('.pdf') ? trimmed : `${trimmed}.pdf`
}

function waitForNextPaint(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve())
    })
  })
}

async function waitForImages(root: HTMLElement): Promise<void> {
  const images = Array.from(root.querySelectorAll('img'))
  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve()
            return
          }
          const done = () => resolve()
          img.addEventListener('load', done, { once: true })
          img.addEventListener('error', done, { once: true })
          window.setTimeout(done, 2500)
        }),
    ),
  )
}

function applyExactColorAdjust(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>('*').forEach((node) => {
    node.style.setProperty('-webkit-print-color-adjust', 'exact')
    node.style.setProperty('print-color-adjust', 'exact')
  })
}

/** Blocks that start their own page in the on-screen document design. */
const PDF_PAGE_BREAK_SELECTOR = [
  '[data-pdf-page-break]',
  '.kology-prop__page--break',
  '.quo-print-section--break',
].join(', ')

/** Blocks that must not be split between two PDF pages. */
const PDF_KEEP_TOGETHER_SELECTOR = [
  'thead',
  'tr',
  '.quo-print-section',
  '.kology-prop__page',
  '.so-print-party',
  '.pi-print-party',
  '.po-print-party',
  '.so-print-totals',
  '.pi-print-totals',
  '.mi-si-print-doc__footer-grid',
  '.mi-si-print-doc__totals',
  '.so-print-signatures',
  '.pi-print-signatures',
  '.so-print-doc__footer',
  '.pi-print-doc__footer',
].join(', ')

type PdfBreakPlan = {
  pageBreaks: number[]
  keepTogether: { top: number; bottom: number }[]
}

/**
 * Translate the on-screen page-break intent (`break-before: page`,
 * `break-inside: avoid`) into canvas-pixel offsets, since html2canvas
 * flattens the document into one image and drops CSS fragmentation.
 */
function measureBreakPlan(element: HTMLElement, canvasWidth: number): PdfBreakPlan {
  const bounds = element.getBoundingClientRect()
  const pxScale = bounds.width > 0 ? canvasWidth / bounds.width : 1
  const toLocal = (clientY: number) => Math.round((clientY - bounds.top) * pxScale)

  const pageBreaks = new Set<number>()
  element.querySelectorAll<HTMLElement>(PDF_PAGE_BREAK_SELECTOR).forEach((node) => {
    const top = toLocal(node.getBoundingClientRect().top)
    if (top > 0) pageBreaks.add(top)
  })

  const keepTogether: { top: number; bottom: number }[] = []
  element.querySelectorAll<HTMLElement>(PDF_KEEP_TOGETHER_SELECTOR).forEach((node) => {
    const rect = node.getBoundingClientRect()
    if (rect.height <= 0) return
    keepTogether.push({ top: toLocal(rect.top), bottom: toLocal(rect.bottom) })
  })

  return {
    pageBreaks: [...pageBreaks].sort((a, b) => a - b),
    keepTogether,
  }
}

function resolveSliceEnd(
  plan: PdfBreakPlan,
  start: number,
  pageHeightPx: number,
  totalHeightPx: number,
): number {
  const maxEnd = start + pageHeightPx
  if (maxEnd >= totalHeightPx) return totalHeightPx

  // Breaks that sit almost exactly on the current page top would emit a blank
  // page, so they are skipped and their content packs onto this page instead.
  const earliestBreak = start + Math.max(4, pageHeightPx * 0.05)
  const nextPageBreak = plan.pageBreaks.find((y) => y > earliestBreak)
  if (nextPageBreak != null && nextPageBreak <= maxEnd) return nextPageBreak

  let end = maxEnd
  for (let pass = 0; pass < 4; pass += 1) {
    let moved = false
    for (const block of plan.keepTogether) {
      if (block.bottom - block.top >= pageHeightPx) continue
      if (block.top > start && block.top < end && block.bottom > end) {
        end = block.top
        moved = true
      }
    }
    if (!moved) break
  }

  return end > start + pageHeightPx * 0.2 ? end : maxEnd
}

/** Find the professional print document currently on screen. */
export function findPrintDocumentElement(
  selectors: string | string[] = [
    '.quo-print-doc',
    '.so-print-doc',
    '.rcpt-print-doc',
    '.pi-print-doc',
    '.wo-print-doc',
    '.po-print-doc',
  ],
): HTMLElement | null {
  const list = Array.isArray(selectors) ? selectors : [selectors]
  for (const selector of list) {
    const el = document.querySelector(selector)
    if (el instanceof HTMLElement) return el
  }
  return null
}

/**
 * Capture a visible print/preview document and download a multi-page A4 PDF
 * that matches the on-screen professional layout.
 * Paper size is always A4 — orientation only (portrait | landscape).
 */
export async function downloadElementAsPdf(
  element: HTMLElement,
  fileName: string,
  options: DownloadElementAsPdfOptions = {},
): Promise<DocumentPdfResult> {
  const safeName = resolveFileName(fileName)
  const orientation = options.orientation ?? 'portrait'
  const pageMm = purchasePdfPageSizeMm(orientation)

  try {
    await waitForImages(element)
    await waitForNextPaint()

    const canvas = await html2canvas(element, {
      scale: Math.min(2.5, window.devicePixelRatio > 1 ? 2 : 2),
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff',
      logging: false,
      // html2canvas re-evaluates media queries inside a clone iframe sized to
      // windowWidth/windowHeight. Overriding them with the element's own box
      // makes responsive rules fire that never fire on screen, so the defaults
      // (live viewport) are what keeps the export identical to the preview.
      onclone: (clonedDoc: Document) => {
        const cloned =
          clonedDoc.querySelector('.mi-si-print-doc') ??
          clonedDoc.querySelector('.so-print-doc') ??
          clonedDoc.querySelector('.rcpt-print-doc') ??
          clonedDoc.querySelector('.pi-print-doc') ??
          clonedDoc.querySelector('.quo-print-doc') ??
          clonedDoc.querySelector('.wo-print-doc') ??
          clonedDoc.querySelector('.po-print-doc')
        if (cloned instanceof HTMLElement) {
          applyExactColorAdjust(cloned)
          cloned.style.overflow = 'visible'
        }
      },
    })

    if (!canvas.width || !canvas.height) {
      return { ok: false, error: 'Could not render document for PDF export.' }
    }

    const pdf = new jsPDF({
      orientation,
      unit: 'mm',
      format: 'a4',
      compress: true,
    })

    const pageWidth = pdf.internal.pageSize.getWidth() || pageMm.width
    const pageHeight = pdf.internal.pageSize.getHeight() || pageMm.height
    const imgWidth = pageWidth

    const pageCanvas = document.createElement('canvas')
    const pageCtx = pageCanvas.getContext('2d')
    if (!pageCtx) return { ok: false, error: 'PDF canvas unavailable in this browser.' }

    const pxPerMm = canvas.width / imgWidth
    const pageHeightPx = Math.floor(pageHeight * pxPerMm)
    const breakPlan = measureBreakPlan(element, canvas.width)
    let renderedHeightPx = 0
    let pageIndex = 0

    while (renderedHeightPx < canvas.height) {
      const sliceEnd = resolveSliceEnd(breakPlan, renderedHeightPx, pageHeightPx, canvas.height)
      const sliceHeight = Math.max(1, sliceEnd - renderedHeightPx)
      pageCanvas.width = canvas.width
      pageCanvas.height = sliceHeight
      pageCtx.fillStyle = '#ffffff'
      pageCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height)
      pageCtx.drawImage(
        canvas,
        0,
        renderedHeightPx,
        canvas.width,
        sliceHeight,
        0,
        0,
        canvas.width,
        sliceHeight,
      )

      const sliceData = pageCanvas.toDataURL('image/jpeg', 0.92)
      const sliceHeightMm = sliceHeight / pxPerMm
      if (pageIndex > 0) pdf.addPage()
      pdf.addImage(sliceData, 'JPEG', 0, 0, imgWidth, sliceHeightMm)

      renderedHeightPx += sliceHeight
      pageIndex += 1
      if (pageIndex > 40) break
    }

    pdf.save(safeName)
    return { ok: true, fileName: safeName }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'PDF download failed.',
    }
  }
}

export async function downloadPrintDocumentPdf(options: {
  fileName: string
  selectors?: string | string[]
  orientation?: PurchasePrintOrientationLocked
}): Promise<DocumentPdfResult> {
  const element = findPrintDocumentElement(options.selectors)
  if (!element) {
    return {
      ok: false,
      error: 'Document preview is not ready. Open Preview / Print, then download PDF.',
    }
  }
  return downloadElementAsPdf(element, options.fileName, {
    orientation: options.orientation,
  })
}
