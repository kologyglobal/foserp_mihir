import { notify } from '@/store/toastStore'

/**
 * Opens the browser print dialog for the current page.
 * Users choose “Save as PDF” / “Microsoft Print to PDF” for a PDF file.
 * Matches the repo’s established HTML → print pattern (no binary PDF engine).
 */
export function triggerPrintPdf(opts?: { silent?: boolean }): void {
  if (!opts?.silent) {
    notify.info('Use “Save as PDF” in the print dialog to download a PDF')
  }
  window.setTimeout(() => window.print(), 50)
}

/** Open HTML in a new window and trigger print / Save as PDF. */
export function openHtmlPrintWindow(html: string, _filenameHint?: string): void {
  const win = window.open('', '_blank', 'noopener,noreferrer')
  if (!win) {
    notify.error('Pop-up blocked — allow pop-ups to download PDF')
    return
  }
  win.document.open()
  win.document.write(html)
  win.document.close()
  win.focus()
  const run = () => {
    try {
      win.print()
    } catch {
      /* ignore */
    }
  }
  win.onload = run
  window.setTimeout(run, 400)
}
